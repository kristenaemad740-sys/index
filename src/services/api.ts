import { Participant, Gender, TEAMS } from '../types'

const LOCAL_STORAGE_KEY = 'figma_make_registrations'
const SCRIPT_URL = import.meta.env.VITE_GOOGLE_SCRIPT_URL || ''

// ── 1. Phone Normalization & Validation ──────────────────────────────────────
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

export function validatePhone(phone: string): boolean {
  const norm = normalizePhone(phone)
  if (!norm) return false
  return /^01[0125]\d{8}$/.test(norm)
}

// ── 2. Smart Arabic Name Normalization ───────────────────────────────────────
export function normalizeArabic(text: string): string {
  if (!text) return ''
  let s = String(text).trim()
  // Remove Tashkeel / Harakat
  s = s.replace(/[\u064B-\u065F\u0670]/g, '')
  // Remove Tatweel
  s = s.replace(/\u0640/g, '')
  // Normalize Alef variants (أ, إ, آ, ٱ -> ا)
  s = s.replace(/[أإآٱ]/g, 'ا')
  // Normalize Teh Marbuta (ة -> ه)
  s = s.replace(/ة/g, 'ه')
  // Normalize Yeh (ى -> ي)
  s = s.replace(/ى/g, 'ي')
  // Normalize Hamza variants
  s = s.replace(/[ؤئ]/g, 'ء')
  // Collapse whitespace
  return s.replace(/\s+/g, ' ').toLowerCase().trim()
}

export function normalizeName(name: string): string {
  return normalizeArabic(name)
}

export function tokenizeName(text: string): string[] {
  const norm = normalizeArabic(text)
  return norm ? norm.split(' ').filter(Boolean) : []
}

// ── 3. Smart Name Match Confidence Scoring ───────────────────────────────────
export function calculateNameMatchScore(queryName: string, targetName: string): number {
  const qNorm = normalizeArabic(queryName)
  const tNorm = normalizeArabic(targetName)
  if (!qNorm || !tNorm) return 0

  if (qNorm === tNorm) return 100

  const qTokens = tokenizeName(queryName)
  const tTokens = tokenizeName(targetName)
  if (qTokens.length === 0 || tTokens.length === 0) return 0

  const qLen = qTokens.length
  const tLen = tTokens.length

  // 1-token query
  if (qLen === 1 && tLen > 1) {
    if (qTokens[0] === tTokens[0]) return 40
    if (tTokens.includes(qTokens[0])) return 30
    return 0
  }

  // Helper: Subsequence check
  function isSubsequence(sub: string[], full: string[]): boolean {
    if (sub.length > full.length) return false
    for (let i = 0; i <= full.length - sub.length; i++) {
      let match = true
      for (let j = 0; j < sub.length; j++) {
        if (full[i + j] !== sub[j]) {
          match = false
          break
        }
      }
      if (match) return true
    }
    return false
  }

  if (qLen >= 2) {
    if (isSubsequence(qTokens, tTokens) || isSubsequence(tTokens, qTokens)) {
      if (Math.min(qLen, tLen) >= 2) return 90
    }
  }

  // Helper: Ordered subset check
  function isOrderedSubset(sub: string[], full: string[]): boolean {
    let fIdx = 0
    for (const word of sub) {
      let found = false
      while (fIdx < full.length) {
        if (full[fIdx] === word) {
          found = true
          fIdx++
          break
        }
        fIdx++
      }
      if (!found) return false
    }
    return true
  }

  if (isOrderedSubset(qTokens, tTokens) || isOrderedSubset(tTokens, qTokens)) {
    return 80
  }

  // First + another name token match
  if (qTokens[0] === tTokens[0]) {
    const matchedOther = qTokens.slice(1).some(w => tTokens.slice(1).includes(w))
    if (matchedOther) return 75
  }

  return 0
}

export function findMatchedParticipant(
  friendNameQuery: string,
  registeredParticipants: Participant[]
): { matched: Participant | null; status: 'MATCHED' | 'AMBIGUOUS' | 'UNRESOLVED'; score: number } {
  if (!friendNameQuery || !registeredParticipants || registeredParticipants.length === 0) {
    return { matched: null, status: 'UNRESOLVED', score: 0 }
  }

  const scored: { score: number; participant: Participant }[] = []
  for (const p of registeredParticipants) {
    const score = calculateNameMatchScore(friendNameQuery, p.name)
    if (score >= 40) {
      scored.push({ score, participant: p })
    }
  }

  if (scored.length === 0) {
    return { matched: null, status: 'UNRESOLVED', score: 0 }
  }

  scored.sort((a, b) => b.score - a.score)
  const topScore = scored[0].score
  const topCandidates = scored.filter(s => s.score === topScore).map(s => s.participant)

  // 1-word match (score 40)
  if (topScore === 40) {
    if (topCandidates.length === 1 && registeredParticipants.length >= 1) {
      return { matched: topCandidates[0], status: 'MATCHED', score: 40 }
    } else {
      return { matched: null, status: 'AMBIGUOUS', score: 40 }
    }
  }

  // 90-100: Auto Match if unambiguous
  if (topScore >= 90) {
    if (topCandidates.length === 1) {
      return { matched: topCandidates[0], status: 'MATCHED', score: topScore }
    } else {
      return { matched: null, status: 'AMBIGUOUS', score: topScore }
    }
  }

  // 70-89: Auto Match if clear gap to second best
  if (topScore >= 70) {
    if (topCandidates.length === 1) {
      if (scored.length > 1) {
        const gap = topScore - scored[1].score
        if (gap >= 10) {
          return { matched: topCandidates[0], status: 'MATCHED', score: topScore }
        } else {
          return { matched: null, status: 'AMBIGUOUS', score: topScore }
        }
      }
      return { matched: topCandidates[0], status: 'MATCHED', score: topScore }
    } else {
      return { matched: null, status: 'AMBIGUOUS', score: topScore }
    }
  }

  return { matched: null, status: 'UNRESOLVED', score: topScore }
}

// ── 4. Balanced Assignment Engine (Parallel Evaluation) ──────────────────────
export function evaluateBalancedAssignment(
  newP: { gender: Gender },
  registered: Participant[]
): string {
  const teamIds = TEAMS.map(t => t.id)
  const totalReg = registered.length + 1
  const totalMales = registered.filter(p => p.gender === 'male').length + (newP.gender === 'male' ? 1 : 0)
  const totalFemales = totalReg - totalMales
  const globalTargetRatio = (newP.gender === 'male' ? totalMales : totalFemales) / totalReg

  const teamSizes: Record<string, number> = { red: 0, green: 0, yellow: 0, black: 0, blue: 0, purple: 0 }
  const teamMales: Record<string, number> = { red: 0, green: 0, yellow: 0, black: 0, blue: 0, purple: 0 }
  const teamFemales: Record<string, number> = { red: 0, green: 0, yellow: 0, black: 0, blue: 0, purple: 0 }

  for (const p of registered) {
    if (p.team in teamSizes) {
      teamSizes[p.team]++
      if (p.gender === 'male') teamMales[p.team]++
      else teamFemales[p.team]++
    }
  }

  const sizes = Object.values(teamSizes)
  const minSize = Math.min(...sizes)

  const scores: Record<string, number> = {}

  for (const team of teamIds) {
    const currSize = teamSizes[team]
    const currG = newP.gender === 'male' ? teamMales[team] : teamFemales[team]
    const currOpp = newP.gender === 'male' ? teamFemales[team] : teamMales[team]

    const newSize = currSize + 1
    const newGRatio = (currG + 1) / newSize
    const delta = Math.abs(newGRatio - globalTargetRatio)

    // 1. Team Size Score
    let sizeScore = 0
    if (currSize === minSize) {
      sizeScore = 60
    } else if (currSize === minSize + 1) {
      sizeScore = 20
    } else {
      sizeScore = -60
    }

    // 2. Gender Ratio Balance Score
    let genderRatioScore = 0
    if (currSize === 0) {
      genderRatioScore = 40
    } else if (delta <= 0.12) {
      genderRatioScore = 40
    } else if (delta <= 0.25) {
      genderRatioScore = 15
    } else {
      genderRatioScore = -30
    }

    // 3. Count Balance Score
    const countScore = currG < currOpp ? 20 : 0

    scores[team] = sizeScore + genderRatioScore + countScore
  }

  const maxScore = Math.max(...teamIds.map(t => scores[t]))
  const bestTeams = teamIds.filter(t => scores[t] === maxScore)

  if (bestTeams.length === 1) {
    return bestTeams[0]
  }

  // Tie-breaker 1: Smaller team
  const minSizeInBest = Math.min(...bestTeams.map(t => teamSizes[t]))
  const tiedSmallest = bestTeams.filter(t => teamSizes[t] === minSizeInBest)

  if (tiedSmallest.length === 1) {
    return tiedSmallest[0]
  }

  // Tie-breaker 2: Deterministic round-robin
  const gCount = newP.gender === 'male' ? totalMales : totalFemales
  return tiedSmallest[gCount % tiedSmallest.length]
}

// ── 5. Anchor-based Team Formation Core ───────────────────────────────────────
export function assignTeamForParticipant(
  newP: { name: string; gender: Gender; wantsFriends: boolean; friendNames: string[] },
  registered: Participant[]
): string {
  const teamIds = TEAMS.map(t => t.id)

  // Step 1: Check Reverse Pending Friend Requests (did an earlier registrant request newP?)
  const reverseRequesters: Participant[] = []
  for (const p of registered) {
    if (p.wantsFriends && p.friendNames && p.friendNames.length > 0) {
      for (const fn of p.friendNames) {
        const score = calculateNameMatchScore(fn, newP.name)
        if (score >= 70) {
          reverseRequesters.push(p)
          break
        }
      }
    }
  }

  // If newP chose wantsFriends == NO (or has no valid friends), but was requested earlier -> join that requester's team!
  if (reverseRequesters.length > 0 && (!newP.wantsFriends || !newP.friendNames || newP.friendNames.length === 0)) {
    return reverseRequesters[0].team
  }

  // Step 2: If wantsFriends == YES
  if (newP.wantsFriends && newP.friendNames && newP.friendNames.length > 0) {
    const teamFriendCounts: Record<string, number> = { red: 0, green: 0, yellow: 0, black: 0, blue: 0, purple: 0 }
    let totalMatchedFriends = 0

    for (const fn of newP.friendNames) {
      const matchRes = findMatchedParticipant(fn, registered)
      if (matchRes.status === 'MATCHED' && matchRes.matched) {
        const t = matchRes.matched.team
        if (t in teamFriendCounts) {
          teamFriendCounts[t]++
          totalMatchedFriends++
        }
      }
    }

    if (totalMatchedFriends > 0) {
      const maxFriends = Math.max(...teamIds.map(t => teamFriendCounts[t]))
      const topTeams = teamIds.filter(t => teamFriendCounts[t] === maxFriends)

      if (topTeams.length === 1) {
        return topTeams[0]
      } else {
        // Tied friend count -> pick the one with smaller size
        const teamSizes: Record<string, number> = { red: 0, green: 0, yellow: 0, black: 0 }
        for (const p of registered) {
          if (p.team in teamSizes) teamSizes[p.team]++
        }
        const minSizeTied = Math.min(...topTeams.map(t => teamSizes[t]))
        const balancedTop = topTeams.filter(t => teamSizes[t] === minSizeTied)
        return balancedTop[0]
      }
    }

    // If forward friend matching found nobody registered yet, but reverse requesters exist:
    if (reverseRequesters.length > 0) {
      return reverseRequesters[0].team
    }
  }

  // Step 3: Balanced Assignment (wantsFriends == NO or friend not registered yet)
  return evaluateBalancedAssignment(newP, registered)
}

// ── 6. Local Storage Handlers ────────────────────────────────────────────────
export function getRegistrations(): Participant[] {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch (e) {
    console.error('Error reading localStorage', e)
    return []
  }
}

function saveRegistrations(registrations: Participant[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(registrations))
  } catch (e) {
    console.error('Error saving to localStorage', e)
  }
}

// ── 7. Full Registration Service ─────────────────────────────────────────────
export async function registerParticipant(data: {
  name: string
  phone: string
  gender: Gender
  wantsFriends: boolean
  friendsCount: number
  friendNames: string[]
  isUpdate?: boolean
}): Promise<{ status: 'success' | 'error'; participant: Participant; isExisting?: boolean; error?: string }> {
  const normalizedPhoneNum = normalizePhone(data.phone)
  if (!normalizedPhoneNum || !validatePhone(normalizedPhoneNum)) {
    return {
      status: 'error',
      participant: null as unknown as Participant,
      error: 'من فضلك أدخل رقم واتساب مصري صحيح يبدأ بـ 01'
    }
  }

  if (SCRIPT_URL && SCRIPT_URL.trim() !== '') {
    try {
      const payload = {
        action: data.isUpdate ? 'update' : 'register',
        isUpdate: data.isUpdate === true,
        name: data.name,
        phone: normalizedPhoneNum,
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

  // ── Mock Fallback (when VITE_GOOGLE_SCRIPT_URL is not set) ──────────────────
  await new Promise(resolve => setTimeout(resolve, 500))

  const registrations = getRegistrations()

  // 1. Duplicate Prevention & Update Logic
  const existingIndex = registrations.findIndex(
    p => normalizePhone(p.phone) === normalizedPhoneNum
  )

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

  // 2. Anchor-based Team Assignment
  const newParticipantDraft = {
    name: data.name.trim(),
    gender: data.gender,
    wantsFriends: data.wantsFriends,
    friendNames: data.wantsFriends ? data.friendNames.map(n => n.trim()) : []
  }

  const assignedTeamId = assignTeamForParticipant(newParticipantDraft, registrations)

  const newParticipant: Participant = {
    id: `p_${Math.random().toString(36).substring(2, 9)}`,
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
