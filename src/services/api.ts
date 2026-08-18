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

// ── Flexible Full Name Friend Matching Logic ──────────────────────────────────
export function isSubSequence(subWords: string[], fullWords: string[]): boolean {
  if (!subWords || !fullWords || subWords.length === 0 || fullWords.length === 0) {
    return false
  }
  if (subWords.length > fullWords.length) {
    return false
  }
  for (let i = 0; i <= fullWords.length - subWords.length; i++) {
    let match = true
    for (let j = 0; j < subWords.length; j++) {
      if (fullWords[i + j] !== subWords[j]) {
        match = false
        break
      }
    }
    if (match) return true
  }
  return false
}

export function getMatchLength(friendName: string, participantName: string): number {
  const normF = normalizeName(friendName)
  const normP = normalizeName(participantName)
  if (!normF || !normP) return 0

  const fWords = normF.split(' ')
  const pWords = normP.split(' ')

  // 1. Exact Match
  if (normF === normP) {
    return fWords.length
  }

  // 2. Friend Name contains Participant Name completely (Word order preserved)
  if (isSubSequence(pWords, fWords)) {
    return pWords.length
  }

  // 3. Participant Name contains Friend Name completely (Word order preserved)
  if (isSubSequence(fWords, pWords)) {
    return fWords.length
  }

  return 0
}

export function findMatchedTeamForFriend(fName: string, registrations: Participant[]): string | null {
  const normF = normalizeName(fName)
  if (!normF || !registrations || registrations.length === 0) {
    return null
  }

  const matches: { team: string; matchLength: number }[] = []

  registrations.forEach(p => {
    const mlen = getMatchLength(fName, p.name)
    if (mlen > 0) {
      matches.push({ team: p.team, matchLength: mlen })
    }
  })

  if (matches.length === 0) {
    return null
  }

  const maxLen = Math.max(...matches.map(m => m.matchLength))
  const topMatches = matches.filter(m => m.matchLength === maxLen)
  const topTeams = Array.from(new Set(topMatches.map(m => m.team)))

  if (topTeams.length === 1) {
    return topTeams[0]
  } else {
    return null // Ambiguous match at highest match length level -> Unresolved
  }
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

  // 2. Count current team sizes & gender counts
  const teamSizes: Record<string, number> = { red: 0, green: 0, yellow: 0, black: 0 }
  const genderCounts: Record<string, number> = { male: 0, female: 0 }

  registrations.forEach(p => {
    if (p.team in teamSizes) teamSizes[p.team]++
    if (p.gender in genderCounts) genderCounts[p.gender]++
  })

  let assignedTeamId = ''

  // 3. Friend Matching Evaluation (Spec v4.0.0)
  const teamFriendCounts: Record<string, number> = { red: 0, green: 0, yellow: 0, black: 0 }
  let totalValidFriends = 0

  if (data.wantsFriends && data.friendNames.length > 0) {
    data.friendNames.forEach(fName => {
      const matchedTeam = findMatchedTeamForFriend(fName, registrations)
      if (matchedTeam && matchedTeam in teamFriendCounts) {
        teamFriendCounts[matchedTeam]++
        totalValidFriends++
      }
    })
  }

  const teamIds = TEAMS.map(t => t.id)

  // Section 6: Friend Team Priority
  if (totalValidFriends > 0) {
    let maxFriends = 0
    teamIds.forEach(t => {
      if (teamFriendCounts[t] > maxFriends) {
        maxFriends = teamFriendCounts[t]
      }
    })

    const topFriendTeams = teamIds.filter(t => teamFriendCounts[t] === maxFriends)

    if (topFriendTeams.length === 1) {
      assignedTeamId = topFriendTeams[0]
    } else {
      // Section 7: Team Balance among tied friend teams
      let minSizeInTied = Infinity
      topFriendTeams.forEach(t => {
        if (teamSizes[t] < minSizeInTied) {
          minSizeInTied = teamSizes[t]
        }
      })

      const balancedTeams = topFriendTeams.filter(t => teamSizes[t] === minSizeInTied)

      if (balancedTeams.length === 1) {
        assignedTeamId = balancedTeams[0]
      } else {
        // Section 8: Round-Robin Tie Breaker
        const rrIndex = (genderCounts[data.gender] || 0) % balancedTeams.length
        assignedTeamId = balancedTeams[rrIndex]
      }
    }
  }

  // Section 9: No Friend Match -> Team Balance (Smallest Team First)
  if (!assignedTeamId) {
    let overallMinSize = Infinity
    teamIds.forEach(t => {
      if (teamSizes[t] < overallMinSize) {
        overallMinSize = teamSizes[t]
      }
    })

    const smallestTeams = teamIds.filter(t => teamSizes[t] === overallMinSize)

    if (smallestTeams.length === 1) {
      assignedTeamId = smallestTeams[0]
    } else {
      const rrIndexNoFriend = (genderCounts[data.gender] || 0) % smallestTeams.length
      assignedTeamId = smallestTeams[rrIndexNoFriend]
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
