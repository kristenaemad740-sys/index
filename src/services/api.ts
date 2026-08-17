import { Participant, Gender, TEAMS } from '../types'

const LOCAL_STORAGE_KEY = 'figma_make_registrations'
const SCRIPT_URL = import.meta.env.VITE_GOOGLE_SCRIPT_URL || ''

// ── Phone Normalization ──────────────────────────────────────────────────────
export function normalizePhone(phone: string): string {
  if (!phone) return ''
  let cleaned = String(phone).replace(/\D/g, '')
  
  if (cleaned.startsWith('20') && cleaned.length === 12) {
    cleaned = cleaned.substring(2)
  }
  if (cleaned.length === 10 && cleaned.startsWith('1')) {
    cleaned = '0' + cleaned
  }
  return cleaned
}

// ── Phone Validation ─────────────────────────────────────────────────────────
export function validatePhone(phone: string): boolean {
  return /^01[0125]\d{8}$/.test(normalizePhone(phone))
}

// ── Name Normalization ───────────────────────────────────────────────────────
export function normalizeName(name: string): string {
  if (!name) return ''
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

// ── Friend Matching Logic ────────────────────────────────────────────────────
export function isFriendMatch(friendName: string, participantName: string): boolean {
  const normF = normalizeName(friendName)
  const normP = normalizeName(participantName)
  if (!normF || !normP) return false

  // Exact match
  if (normF === normP) return true

  // Flexible match: Requires requested friend name to have at least 2 words
  const fWords = normF.split(' ').filter(Boolean)
  if (fWords.length >= 2) {
    if (normP.includes(normF) || normF.includes(normP)) {
      return true
    }
  }
  return false
}

// ── Get Local Storage Registrations ──────────────────────────────────────────
export function getRegistrations(): Participant[] {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch (e) {
    console.error('Error reading localStorage', e)
    return []
  }
}

// ── Save Local Storage Registrations ─────────────────────────────────────────
function saveRegistrations(registrations: Participant[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(registrations))
  } catch (e) {
    console.error('Error saving to localStorage', e)
  }
}

// ── Production / Mock API Registration Service ────────────────────────────────
export async function registerParticipant(data: {
  name: string
  phone: string
  gender: Gender
  wantsFriends: boolean
  friendsCount: number
  friendNames: string[]
}): Promise<{ status: 'success' | 'error'; participant: Participant; error?: string }> {
  // If Production Google Script URL is configured, use Google Apps Script!
  if (SCRIPT_URL && SCRIPT_URL.trim() !== '') {
    try {
      const payload = {
        action: 'register',
        name: data.name,
        phone: data.phone,
        gender: data.gender,
        wantsFriends: data.wantsFriends,
        friendsCount: data.wantsFriends ? data.friendsCount : 0,
        friendNames: data.wantsFriends ? data.friendNames : []
      }

      const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        throw new Error(`HTTP error status: ${response.status}`)
      }

      const resData = await response.json()

      if (resData.success && resData.data) {
        const p = resData.data
        const participant: Participant = {
          id: p.id,
          name: p.name,
          phone: p.phone,
          gender: p.gender as Gender,
          wantsFriends: p.wantsFriends,
          friendsCount: p.friendsCount,
          friendNames: p.friendNames || [],
          team: p.team,
          registrationTime: p.registrationTime
        }
        return { status: 'success', participant }
      } else {
        return { status: 'error', participant: null as unknown as Participant, error: resData.error || 'تعذر التسجيل' }
      }
    } catch (err) {
      console.error('Google Apps Script API Error:', err)
      return { status: 'error', participant: null as unknown as Participant, error: 'تعذر الاتصال بالخادم.' }
    }
  }

  // ── Mock Fallback (when VITE_GOOGLE_SCRIPT_URL is not set) ────────────────
  await new Promise(resolve => setTimeout(resolve, 1200))

  const normalizedPhoneNum = normalizePhone(data.phone)
  const registrations = getRegistrations()

  // 1. Duplicate Prevention
  const existing = registrations.find(p => normalizePhone(p.phone) === normalizedPhoneNum)
  if (existing) {
    return {
      status: 'success',
      participant: existing
    }
  }

  // 2. Default Round-Robin Allocation
  const sameGenderCount = registrations.filter(p => p.gender === data.gender).length
  const rrTeamIndex = sameGenderCount % 4
  let assignedTeamId = TEAMS[rrTeamIndex].id

  // 3. Friend Priority Algorithm
  if (data.wantsFriends && data.friendNames.length > 0) {
    const matchedFriends = registrations.filter(p =>
      data.friendNames.some(fn => isFriendMatch(fn, p.name))
    )

    if (matchedFriends.length > 0) {
      const teamCounts: Record<string, number> = {}
      matchedFriends.forEach(f => {
        teamCounts[f.team] = (teamCounts[f.team] || 0) + 1
      })

      let maxCount = 0
      let candidateTeams: string[] = []

      for (const teamId in teamCounts) {
        const count = teamCounts[teamId]
        if (count > maxCount) {
          maxCount = count
          candidateTeams = [teamId]
        } else if (count === maxCount) {
          candidateTeams.push(teamId)
        }
      }

      if (candidateTeams.length === 1) {
        assignedTeamId = candidateTeams[0]
      } else if (candidateTeams.length > 1) {
        const tieIndex = sameGenderCount % candidateTeams.length
        assignedTeamId = candidateTeams[tieIndex]
      }
    }
  }

  // 4. Create and Save Participant
  const newParticipant: Participant = {
    id: Math.random().toString(36).substring(2, 9),
    name: data.name.trim(),
    phone: normalizedPhoneNum,
    gender: data.gender,
    wantsFriends: data.wantsFriends,
    friendsCount: data.wantsFriends ? data.friendsCount : 0,
    friendNames: data.wantsFriends ? data.friendNames.map(n => n.trim()) : [],
    team: assignedTeamId,
    registrationTime: new Date().toISOString()
  }

  registrations.push(newParticipant)
  saveRegistrations(registrations)

  return {
    status: 'success',
    participant: newParticipant
  }
}
