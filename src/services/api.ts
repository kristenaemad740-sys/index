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
  return /^01[0125]\d{8}$/.test(normalizePhone(phone))
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

  // Single word query matching first token of multi-word target
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

  // Strong Multi-Token Match (consecutive words)
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
    if (score >= 70) {
      scored.push({ score, participant: p })
    }
  }

  if (scored.length === 0) {
    return { matched: null, status: 'UNRESOLVED', score: 0 }
  }

  scored.sort((a, b) => b.score - a.score)
  const topScore = scored[0].score
  const topCandidates = scored.filter(s => s.score === topScore).map(s => s.participant)

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

// ── 4. Dynamic Scoring & Team Formation Engine (v5.0) ────────────────────────
export interface TeamScoreEvaluation {
  totalScore: number
  friendScore: number
  genderScore: number
  sizeScore: number
  reasons: string[]
  currentSize: number
}

export function evaluateTeamScores(
  newP: { name: string; gender: Gender; wantsFriends: boolean; friendNames: string[] },
  registered: Participant[]
): Record<string, TeamScoreEvaluation> {
  const teamIds = TEAMS.map(t => t.id)
  const totalReg = registered.length + 1
  const totalMales = registered.filter(p => p.gender === 'male').length + (newP.gender === 'male' ? 1 : 0)
  const totalFemales = totalReg - totalMales
  const globalTargetRatio = (newP.gender === 'male' ? totalMales : totalFemales) / totalReg

  const teamSizes: Record<string, number> = { red: 0, green: 0, yellow: 0, black: 0 }
  const teamMales: Record<string, number> = { red: 0, green: 0, yellow: 0, black: 0 }
  const teamFemales: Record<string, number> = { red: 0, green: 0, yellow: 0, black: 0 }

  for (const p of registered) {
    if (p.team in teamSizes) {
      teamSizes[p.team]++
      if (p.gender === 'male') teamMales[p.team]++
      else teamFemales[p.gender]++
    }
  }

  const sizesArray = Object.values(teamSizes)
  const minSize = Math.min(...sizesArray)
  const maxSize = Math.max(...sizesArray)

  // 1. Forward Friends Check
  const forwardFriends: { participant: Participant; rawQuery: string }[] = []
  if (newP.wantsFriends && newP.friendNames && newP.friendNames.length > 0) {
    for (const fn of newP.friendNames) {
      const matchRes = findMatchedParticipant(fn, registered)
      if (matchRes.status === 'MATCHED' && matchRes.matched) {
        forwardFriends.push({ participant: matchRes.matched, rawQuery: fn })
      }
    }
  }

  // 2. Reverse Friends Check (people who requested newP in previous registrations)
  const reverseFriends: { participant: Participant; rawQuery: string }[] = []
  for (const p of registered) {
    if (p.wantsFriends && p.friendNames && p.friendNames.length > 0) {
      for (const fn of p.friendNames) {
        if (calculateNameMatchScore(fn, newP.name) >= 70) {
          reverseFriends.push({ participant: p, rawQuery: fn })
          break
        }
      }
    }
  }

  const evaluations: Record<string, TeamScoreEvaluation> = {}

  for (const team of teamIds) {
    let friendScore = 0
    const reasons: string[] = []

    // Evaluate forward friend matches
    for (const { participant: targetP } of forwardFriends) {
      if (targetP.team === team) {
        // Check if mutual
        let isMutual = false
        if (targetP.wantsFriends && targetP.friendNames) {
          for (const tFn of targetP.friendNames) {
            if (calculateNameMatchScore(tFn, newP.name) >= 70) {
              isMutual = true
              break
            }
          }
        }

        if (isMutual) {
          friendScore += 100
          reasons.push(`طلب متبادل مع ${targetP.name} (+100)`)
        } else {
          friendScore += 60
          reasons.push(`طلب صديق مسجل: ${targetP.name} (+60)`)
        }
      }
    }

    // Evaluate reverse friend matches
    for (const { participant: requesterP } of reverseFriends) {
      if (requesterP.team === team) {
        const alreadyCounted = forwardFriends.some(f => f.participant.id === requesterP.id)
        if (!alreadyCounted) {
          friendScore += 60
          reasons.push(`${requesterP.name} كان طالبك مسبقاً (+60)`)
        }
      }
    }

    // Evaluate Gender Balance
    const currentGCount = newP.gender === 'male' ? teamMales[team] : teamFemales[team]
    const currentOppCount = newP.gender === 'male' ? teamFemales[team] : teamMales[team]
    const newTeamSize = teamSizes[team] + 1
    const newGRatio = (currentGCount + 1) / newTeamSize
    const delta = newGRatio - globalTargetRatio

    let genderScore = 0
    if (currentGCount < currentOppCount) {
      genderScore = 30
      reasons.push('توازن جنس ممتاز (+30)')
    } else if (Math.abs(delta) <= 0.12) {
      genderScore = 15
      reasons.push('توازن جنس مقبول (+15)')
    } else if (delta > 0.25) {
      genderScore = -50
      reasons.push('خلل جنس كبير (-50)')
    } else {
      genderScore = -20
      reasons.push('خلل جنس متوسط (-20)')
    }

    // Evaluate Team Size Balance
    let sizeScore = 0
    const currSize = teamSizes[team]
    if (currSize === minSize) {
      sizeScore = 30
      reasons.push('أصغر فريق متاح (+30)')
    } else if (currSize === minSize + 1) {
      sizeScore = 10
      reasons.push('حجم متقارب (+10)')
    } else if (currSize >= minSize + 3 || (maxSize - minSize >= 3 && currSize === maxSize)) {
      sizeScore = -40
      reasons.push('فريق كبير (-40)')
    } else {
      sizeScore = 0
    }

    const totalScore = friendScore + genderScore + sizeScore

    evaluations[team] = {
      totalScore,
      friendScore,
      genderScore,
      sizeScore,
      reasons,
      currentSize: currSize
    }
  }

  return evaluations
}

export function chooseBestTeam(
  evaluations: Record<string, TeamScoreEvaluation>,
  newP: { gender: Gender },
  genderCounts: Record<string, number>
): string {
  const teamIds = TEAMS.map(t => t.id)
  const maxScore = Math.max(...teamIds.map(t => evaluations[t].totalScore))
  const bestTeams = teamIds.filter(t => evaluations[t].totalScore === maxScore)

  if (bestTeams.length === 1) {
    return bestTeams[0]
  }

  // Tie-breaker 1: Choose smaller team
  const minSize = Math.min(...bestTeams.map(t => evaluations[t].currentSize))
  const tiedSmallest = bestTeams.filter(t => evaluations[t].currentSize === minSize)

  if (tiedSmallest.length === 1) {
    return tiedSmallest[0]
  }

  // Tie-breaker 2: Deterministic round-robin on gender count
  const rrIndex = (genderCounts[newP.gender] || 0) % tiedSmallest.length
  return tiedSmallest[rrIndex]
}

// ── 5. Local Storage Handlers ────────────────────────────────────────────────
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

// ── 6. Full Registration Service ─────────────────────────────────────────────
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

  // ── Mock Fallback (when VITE_GOOGLE_SCRIPT_URL is not set) ──────────────────
  await new Promise(resolve => setTimeout(resolve, 600))

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

  // 2. Gender counts for tie-breaking
  const genderCounts: Record<string, number> = { male: 0, female: 0 }
  registrations.forEach(p => {
    if (p.gender in genderCounts) genderCounts[p.gender]++
  })

  // 3. Algorithm v5.0 Evaluation
  const newParticipantDraft = {
    name: data.name.trim(),
    gender: data.gender,
    wantsFriends: data.wantsFriends,
    friendNames: data.wantsFriends ? data.friendNames.map(n => n.trim()) : []
  }

  const evals = evaluateTeamScores(newParticipantDraft, registrations)
  const assignedTeamId = chooseBestTeam(evals, newParticipantDraft, genderCounts)

  // 4. Save and return
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

// ── 7. Audit & Validation Helper ─────────────────────────────────────────────
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
        const { matched, status } = findMatchedParticipant(fn, registrations)
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
