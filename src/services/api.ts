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

  // Helper: Subsequence check (consecutive tokens)
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

// ── 4. Global Objective Function & Scoring Engine ────────────────────────────
export function computeGlobalScore(
  participants: Participant[],
  originalTeams?: Record<string, string>
): number {
  const total = participants.length
  if (total === 0) return 0

  const totalMales = participants.filter(p => p.gender === 'male').length
  const globalMaleRatio = totalMales / total

  const teamSizes: Record<string, number> = { red: 0, green: 0, yellow: 0, black: 0 }
  const teamMales: Record<string, number> = { red: 0, green: 0, yellow: 0, black: 0 }

  for (const p of participants) {
    if (p.team in teamSizes) {
      teamSizes[p.team]++
      if (p.gender === 'male') teamMales[p.team]++
    }
  }

  const sizes = Object.values(teamSizes)
  const minSize = Math.min(...sizes)

  let score = 0

  // 1. Friend Requests Satisfaction Score
  const pById = new Map<string, Participant>()
  for (const p of participants) pById.set(p.id, p)

  const evaluatedMutualPairs = new Set<string>()

  for (const p of participants) {
    if (!p.wantsFriends || !p.friendNames || p.friendNames.length === 0) continue

    for (const fn of p.friendNames) {
      const { matched, status } = findMatchedParticipant(
        fn,
        participants.filter(other => other.id !== p.id)
      )

      if (status === 'MATCHED' && matched) {
        const isMutual =
          matched.wantsFriends &&
          matched.friendNames &&
          matched.friendNames.some(
            tFn => calculateNameMatchScore(tFn, p.name) >= 70
          )

        const pairKey = [p.id, matched.id].sort().join(':')

        if (isMutual) {
          if (!evaluatedMutualPairs.has(pairKey)) {
            evaluatedMutualPairs.add(pairKey)
            if (p.team === matched.team) {
              score += 100 // Mutual Friend Request Satisfied
            }
          }
        } else {
          if (p.team === matched.team) {
            score += 60 // One-way Friend Request Satisfied
          }
        }
      }
    }
  }

  // 2. Gender Balance Score per team
  for (const teamId of TEAMS.map(t => t.id)) {
    const s = teamSizes[teamId]
    if (s > 0) {
      const mRatio = teamMales[teamId] / s
      const delta = Math.abs(mRatio - globalMaleRatio)
      if (delta <= 0.10) score += 30
      else if (delta <= 0.22) score -= 20
      else score -= 50
    }
  }

  // 3. Team Size Balance Score per team
  for (const teamId of TEAMS.map(t => t.id)) {
    const s = teamSizes[teamId]
    if (s === minSize) score += 30
    else if (s === minSize + 1) score += 0
    else score -= 40
  }

  // 4. Minimum Change Principle (movement penalty for previously assigned participants)
  if (originalTeams) {
    for (const p of participants) {
      if (p.id in originalTeams && p.team !== originalTeams[p.id]) {
        score -= 15 // Small penalty for shifting an existing member
      }
    }
  }

  return score
}

// ── 5. Global Team Optimizer with Dynamic Rebalancing ────────────────────────
export function optimizeGlobalAssignments(
  newP: Participant,
  existingList: Participant[]
): { assignedTeam: string; updatedRegistrations: Participant[] } {
  const originalTeams: Record<string, string> = {}
  for (const p of existingList) originalTeams[p.id] = p.team

  const allParticipants = existingList.map(p => ({ ...p })).concat({ ...newP })
  const teamIds = TEAMS.map(t => t.id)

  let bestScore = -Infinity
  let bestConfig: Record<string, string> = {}

  // Option 1: Direct assignment of newP to each team
  for (const t of teamIds) {
    for (const p of allParticipants) {
      p.team = originalTeams[p.id] ?? t
    }

    const sc = computeGlobalScore(allParticipants, originalTeams)
    if (sc > bestScore) {
      bestScore = sc
      bestConfig = {}
      for (const p of allParticipants) bestConfig[p.id] = p.team
    }
  }

  // Option 2: Dynamic Rebalancing with Friends
  // Find connected friends (forward or reverse)
  const connectedFriendIds: string[] = []

  if (newP.wantsFriends && newP.friendNames) {
    for (const fn of newP.friendNames) {
      const match = findMatchedParticipant(fn, existingList)
      if (match.status === 'MATCHED' && match.matched) {
        connectedFriendIds.push(match.matched.id)
      }
    }
  }

  for (const p of existingList) {
    if (p.wantsFriends && p.friendNames) {
      for (const fn of p.friendNames) {
        if (calculateNameMatchScore(fn, newP.name) >= 70) {
          if (!connectedFriendIds.includes(p.id)) {
            connectedFriendIds.push(p.id)
          }
          break
        }
      }
    }
  }

  for (const fId of connectedFriendIds) {
    const targetTeam = originalTeams[fId]
    if (!targetTeam) continue

    // A: Try placing newP with friend
    for (const p of allParticipants) p.team = originalTeams[p.id] ?? targetTeam
    const pNew = allParticipants.find(p => p.id === newP.id)
    if (pNew) pNew.team = targetTeam

    const scDirect = computeGlobalScore(allParticipants, originalTeams)
    if (scDirect > bestScore) {
      bestScore = scDirect
      bestConfig = {}
      for (const p of allParticipants) bestConfig[p.id] = p.team
    }

    // B: Try shifting friend and newP to another team + swap independent member
    for (const otherT of teamIds) {
      if (otherT === targetTeam) continue

      for (const p of allParticipants) p.team = originalTeams[p.id] ?? otherT
      const friendP = allParticipants.find(p => p.id === fId)
      if (friendP) friendP.team = otherT
      if (pNew) pNew.team = otherT

      // Swap independent member to preserve size
      const independentSwap = allParticipants.find(
        p =>
          p.id !== newP.id &&
          p.id !== fId &&
          !p.wantsFriends &&
          originalTeams[p.id] === otherT &&
          p.gender === (friendP ? friendP.gender : 'male')
      )
      if (independentSwap) {
        independentSwap.team = targetTeam
      }

      const scSwap = computeGlobalScore(allParticipants, originalTeams)
      if (scSwap > bestScore) {
        bestScore = scSwap
        bestConfig = {}
        for (const p of allParticipants) bestConfig[p.id] = p.team
      }
    }
  }

  // Apply best configuration
  for (const p of allParticipants) {
    if (p.id in bestConfig) {
      p.team = bestConfig[p.id]
    }
  }

  const assignedTeam = bestConfig[newP.id] || teamIds[0]
  const updatedRegistrations = allParticipants.filter(p => p.id !== newP.id)

  return {
    assignedTeam,
    updatedRegistrations
  }
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
  // Validate Phone strictly
  const normalizedPhoneNum = normalizePhone(data.phone)
  if (!normalizedPhoneNum || !validatePhone(normalizedPhoneNum)) {
    return {
      status: 'error',
      participant: null as unknown as Participant,
      error: 'من فضلك أدخل رقم واتساب صحيح يبدأ بـ 01'
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
  await new Promise(resolve => setTimeout(resolve, 600))

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

  // 2. Global Team Optimization with Dynamic Rebalancing
  const newParticipantDraft: Participant = {
    id: `p_${Math.random().toString(36).substring(2, 9)}`,
    name: data.name.trim(),
    phone: normalizedPhoneNum,
    gender: data.gender,
    wantsFriends: data.wantsFriends,
    friendsCount: data.wantsFriends ? data.friendsCount : 0,
    friendNames: data.wantsFriends ? data.friendNames.map(n => n.trim()) : [],
    team: 'red',
    registrationTime: new Date().toISOString()
  }

  const { assignedTeam, updatedRegistrations } = optimizeGlobalAssignments(
    newParticipantDraft,
    registrations
  )

  newParticipantDraft.team = assignedTeam
  updatedRegistrations.push(newParticipantDraft)
  saveRegistrations(updatedRegistrations)

  return {
    status: 'success',
    participant: newParticipantDraft
  }
}

// ── 8. Audit & Validation Helper ─────────────────────────────────────────────
export interface AuditReport {
  totalParticipants: number
  totalMales: number
  totalFemales: number
  overallMalePct: number
  overallFemalePct: number
  teamCounts: Record<string, number>
  teamGenders: Record<string, { male: number; female: number; malePct: number; femalePct: number }>
  totalFriendRequests: number
  satisfiedRequests: number
  unsatisfiedRequests: { from: string; fromTeam: string; to: string; toTeam: string; query: string }[]
  ambiguousRequests: { from: string; query: string }[]
  unresolvedRequests: { from: string; query: string }[]
  satisfactionRate: number
  genderImbalanceWarnings: string[]
}

export function auditRegistrations(registrations: Participant[]): AuditReport {
  const total = registrations.length
  const totalMales = registrations.filter(p => p.gender === 'male').length
  const totalFemales = total - totalMales
  const overallMalePct = total > 0 ? (totalMales / total) * 100 : 0
  const overallFemalePct = total > 0 ? (totalFemales / total) * 100 : 0

  const teamCounts: Record<string, number> = { red: 0, green: 0, yellow: 0, black: 0 }
  const teamGenders: Record<string, { male: number; female: number; malePct: number; femalePct: number }> = {
    red: { male: 0, female: 0, malePct: 0, femalePct: 0 },
    green: { male: 0, female: 0, malePct: 0, femalePct: 0 },
    yellow: { male: 0, female: 0, malePct: 0, femalePct: 0 },
    black: { male: 0, female: 0, malePct: 0, femalePct: 0 },
  }

  for (const p of registrations) {
    if (p.team in teamCounts) {
      teamCounts[p.team]++
      teamGenders[p.team][p.gender]++
    }
  }

  const genderImbalanceWarnings: string[] = []
  for (const [teamId, counts] of Object.entries(teamGenders)) {
    const size = teamCounts[teamId]
    if (size > 0) {
      counts.malePct = (counts.male / size) * 100
      counts.femalePct = (counts.female / size) * 100
      if (Math.abs(counts.malePct - overallMalePct) > 15) {
        genderImbalanceWarnings.push(`⚠️ فريق (${teamId}) بعيد عن نسبة الجنس العامة بأكثر من 15%`)
      }
    }
  }

  let totalFriendRequests = 0
  let satisfiedRequests = 0
  const unsatisfiedRequests: { from: string; fromTeam: string; to: string; toTeam: string; query: string }[] = []
  const ambiguousRequests: { from: string; query: string }[] = []
  const unresolvedRequests: { from: string; query: string }[] = []

  for (const p of registrations) {
    if (p.wantsFriends && p.friendNames) {
      for (const fn of p.friendNames) {
        totalFriendRequests++
        const { matched, status } = findMatchedParticipant(
          fn,
          registrations.filter(other => other.id !== p.id)
        )
        if (status === 'MATCHED' && matched) {
          if (matched.team === p.team) {
            satisfiedRequests++
          } else {
            unsatisfiedRequests.push({
              from: p.name,
              fromTeam: p.team,
              to: matched.name,
              toTeam: matched.team,
              query: fn
            })
          }
        } else if (status === 'AMBIGUOUS') {
          ambiguousRequests.push({ from: p.name, query: fn })
        } else {
          unresolvedRequests.push({ from: p.name, query: fn })
        }
      }
    }
  }

  return {
    totalParticipants: total,
    totalMales,
    totalFemales,
    overallMalePct,
    overallFemalePct,
    teamCounts,
    teamGenders,
    totalFriendRequests,
    satisfiedRequests,
    unsatisfiedRequests,
    ambiguousRequests,
    unresolvedRequests,
    satisfactionRate: totalFriendRequests > 0 ? (satisfiedRequests / totalFriendRequests) * 100 : 100,
    genderImbalanceWarnings
  }
}
