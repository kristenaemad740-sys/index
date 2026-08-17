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

  if (normF === normP) return true

  // Flexible substring match (e.g. "ريمون" matches "ريمون عصام")
  return normP.includes(normF) || normF.includes(normP)
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
  isUpdate?: boolean
}): Promise<{ status: 'success' | 'error'; participant: Participant; isExisting?: boolean; error?: string }> {
  if (SCRIPT_URL && SCRIPT_URL.trim() !== '') {
    try {
      const payload = {
        action: data.isUpdate ? 'update' : 'register',
        isUpdate: data.isUpdate === true,
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
        return { status: 'success', participant, isExisting: resData.existing === true }
      } else {
        return { status: 'error', participant: null as unknown as Participant, error: resData.error || 'تعذر التسجيل' }
      }
    } catch (err) {
      console.error('Google Apps Script API Error:', err)
      return { status: 'error', participant: null as unknown as Participant, error: 'تعذر الاتصال بالخادم.' }
    }
  }

  // ── Mock Fallback (when VITE_GOOGLE_SCRIPT_URL is not set) ────────────────
  await new Promise(resolve => setTimeout(resolve, 800))

  const normalizedPhoneNum = normalizePhone(data.phone)
  const registrations = getRegistrations()

  // 1. Duplicate Prevention & Update Logic
  const existingIndex = registrations.findIndex(p => normalizePhone(p.phone) === normalizedPhoneNum)
  if (existingIndex !== -1) {
    if (data.isUpdate) {
      const existing = registrations[existingIndex]
      existing.name = data.name.trim()
      existing.gender = data.gender
      existing.wantsFriends = data.wantsFriends
      existing.friendsCount = data.wantsFriends ? data.friendsCount : 0
      existing.friendNames = data.wantsFriends ? data.friendNames.map(n => n.trim()) : []
      saveRegistrations(registrations)
      return { status: 'success', participant: existing, isExisting: false }
    }
    return { status: 'success', participant: registrations[existingIndex], isExisting: true }
  }

  // 2. Default Round-Robin Allocation
  const sameGenderCount = registrations.filter(p => p.gender === data.gender).length
  const rrTeamIndex = sameGenderCount % 4
  let assignedTeamId = TEAMS[rrTeamIndex].id

  // 3. Smart & Fair Friend Matching Algorithm
  if (data.wantsFriends && data.friendNames.length > 0) {
    const teamVotes: Record<string, number> = { red: 0, green: 0, yellow: 0, black: 0 }
    let totalMatches = 0

    data.friendNames.forEach(fName => {
      const normF = normalizeName(fName)
      if (!normF) return

      const matchingParticipants = registrations.filter(p => isFriendMatch(fName, p.name))

      if (matchingParticipants.length === 1) {
        // Unique single match (e.g. only 1 "ريمون")
        const mTeam = matchingParticipants[0].team
        if (teamVotes.hasOwnProperty(mTeam)) {
          teamVotes[mTeam]++
          totalMatches++
        }
      } else if (matchingParticipants.length > 1) {
        // Multiple matches (e.g. "ريمون عصام" and "ريمون عماد")
        const exactMatch = matchingParticipants.find(p => normalizeName(p.name) === normF)
        if (exactMatch && teamVotes.hasOwnProperty(exactMatch.team)) {
          teamVotes[exactMatch.team]++
          totalMatches++
        } else {
          // Multiple candidates: split votes fairly for candidate team tie-breaking
          matchingParticipants.forEach(p => {
            if (teamVotes.hasOwnProperty(p.team)) {
              teamVotes[p.team] += 0.5
              totalMatches += 0.5
            }
          });
        }
      }
    })

    if (totalMatches > 0) {
      let maxVotes = 0
      TEAMS.forEach(t => {
        if (teamVotes[t.id] > maxVotes) {
          maxVotes = teamVotes[t.id]
        }
      })

      const topTeams = TEAMS.filter(t => teamVotes[t.id] === maxVotes).map(t => t.id)

      if (topTeams.length === 1) {
        assignedTeamId = topTeams[0]
      } else if (topTeams.length > 1) {
        const tieIndex = sameGenderCount % topTeams.length
        assignedTeamId = topTeams[tieIndex]
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
