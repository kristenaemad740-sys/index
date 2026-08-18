/**
 * ==============================================================================
 *  🏆 اليوم الرياضي لأسرة الكاروز — Google Apps Script (Global Optimizer v5.1)
 * ==============================================================================
 *  يحتوي على المحرك الكامل لتكوين الفرق الذكي وإعادة التوازن الديناميكي:
 *  - Global Team Optimization مع Minimum Change Principle
 *  - Dynamic Rebalancing عند تسجيل الصديق لاحقاً
 *  - Smart Arabic Normalization & Confidence Scored Name Matching
 *  - Dynamic Gender Balance & Team Size Balancing
 *  - حماية كاملة من الأرقام الفارغة والمكررة
 *
 *  كيفية التركيب:
 *  1. افتح ملف Google Sheets الخاص باليوم الرياضي.
 *  2. اضغط على Extensions → Apps Script.
 *  3. امسح الكود القديم والصق هذا الكود بالكامل.
 *  4. اضغط Deploy → Manage Deployments → Edit (القلم) → New Version → Deploy.
 * ==============================================================================
 */

const TEAMS = ['red', 'green', 'yellow', 'black'];
const SHEET_NAME = 'Sheet1';

// ── 1. معالجة طلبات POST و GET ────────────────────────────────────────────────
function doPost(e) {
  try {
    const lock = LockService.getScriptLock();
    lock.waitLock(30000); // منع التضارب والتسجيل المتزامن

    try {
      const data = JSON.parse(e.postData.contents);
      const action = data.action || 'register';

      if (action === 'getAll' || action === 'audit') {
        const registrations = getSheetRegistrations();
        const audit = auditRegistrations(registrations);
        return createJsonResponse({ success: true, count: registrations.length, data: registrations, audit: audit });
      }

      if (action === 'register' || action === 'update') {
        const result = processRegistration(data);
        return createJsonResponse(result);
      }

      return createJsonResponse({ success: false, error: 'أمر غير معروف' });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return createJsonResponse({ success: false, error: err.toString() });
  }
}

function doGet(e) {
  const registrations = getSheetRegistrations();
  return createJsonResponse({
    status: 'online',
    service: 'Al-Karoz Sports Day API (Global Optimizer v5.1)',
    totalRegistrations: registrations.length,
    timestamp: new Date().toISOString()
  });
}

function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── 2. تطبيع النصوص العربية ──────────────────────────────────────────────────
function normalizeArabic(text) {
  if (!text) return '';
  let s = String(text).trim();
  s = s.replace(/[\u064B-\u065F\u0670]/g, ''); // حركات وتشكيل
  s = s.replace(/\u0640/g, '');               // تطويل
  s = s.replace(/[أإآٱ]/g, 'ا');              // توحيد الألف
  s = s.replace(/ة/g, 'ه');                   // التاء المربوطة
  s = s.replace(/ى/g, 'ي');                   // الياء المقصورة
  s = s.replace(/[ؤئ]/g, 'ء');                // الهمزات
  return s.replace(/\s+/g, ' ').toLowerCase().trim();
}

function tokenizeName(text) {
  const norm = normalizeArabic(text);
  return norm ? norm.split(' ').filter(function(w) { return w.length > 0; }) : [];
}

// ── 3. تقييم تطابق الأسماء ودرجة الثقة ───────────────────────────────────────
function calculateNameMatchScore(queryName, targetName) {
  const qNorm = normalizeArabic(queryName);
  const tNorm = normalizeArabic(targetName);
  if (!qNorm || !tNorm) return 0;
  if (qNorm === tNorm) return 100;

  const qTokens = tokenizeName(queryName);
  const tTokens = tokenizeName(targetName);
  if (qTokens.length === 0 || tTokens.length === 0) return 0;

  const qLen = qTokens.length;
  const tLen = tTokens.length;

  if (qLen === 1 && tLen > 1) {
    if (qTokens[0] === tTokens[0]) return 40;
    if (tTokens.indexOf(qTokens[0]) !== -1) return 30;
    return 0;
  }

  // فحص Subsequence متتالية
  function isSubsequence(sub, full) {
    if (sub.length > full.length) return false;
    for (let i = 0; i <= full.length - sub.length; i++) {
      let match = true;
      for (let j = 0; j < sub.length; j++) {
        if (full[i + j] !== sub[j]) { match = false; break; }
      }
      if (match) return true;
    }
    return false;
  }

  if (qLen >= 2) {
    if (isSubsequence(qTokens, tTokens) || isSubsequence(tTokens, qTokens)) {
      if (Math.min(qLen, tLen) >= 2) return 90;
    }
  }

  // فحص Ordered Subset
  function isOrderedSubset(sub, full) {
    let fIdx = 0;
    for (let sIdx = 0; sIdx < sub.length; sIdx++) {
      let found = false;
      while (fIdx < full.length) {
        if (full[fIdx] === sub[sIdx]) { found = true; fIdx++; break; }
        fIdx++;
      }
      if (!found) return false;
    }
    return true;
  }

  if (isOrderedSubset(qTokens, tTokens) || isOrderedSubset(tTokens, qTokens)) {
    return 80;
  }

  // تطابق أول اسم مع أي اسم آخر
  if (qTokens[0] === tTokens[0]) {
    for (let i = 1; i < qTokens.length; i++) {
      if (tTokens.slice(1).indexOf(qTokens[i]) !== -1) return 75;
    }
  }

  return 0;
}

function findMatchedParticipant(friendNameQuery, registered) {
  if (!friendNameQuery || !registered || registered.length === 0) {
    return { matched: null, status: 'UNRESOLVED', score: 0 };
  }

  const scored = [];
  for (let i = 0; i < registered.length; i++) {
    const p = registered[i];
    const score = calculateNameMatchScore(friendNameQuery, p.name);
    if (score >= 40) {
      scored.push({ score: score, participant: p });
    }
  }

  if (scored.length === 0) {
    return { matched: null, status: 'UNRESOLVED', score: 0 };
  }

  scored.sort(function(a, b) { return b.score - a.score; });
  const topScore = scored[0].score;
  const topCandidates = scored.filter(function(s) { return s.score === topScore; }).map(function(s) { return s.participant; });

  if (topScore === 40) {
    if (topCandidates.length === 1 && registered.length >= 1) {
      return { matched: topCandidates[0], status: 'MATCHED', score: 40 };
    } else {
      return { matched: null, status: 'AMBIGUOUS', score: 40 };
    }
  }

  if (topScore >= 90) {
    if (topCandidates.length === 1) {
      return { matched: topCandidates[0], status: 'MATCHED', score: topScore };
    } else {
      return { matched: null, status: 'AMBIGUOUS', score: topScore };
    }
  }

  if (topScore >= 70) {
    if (topCandidates.length === 1) {
      if (scored.length > 1) {
        const gap = topScore - scored[1].score;
        if (gap >= 10) return { matched: topCandidates[0], status: 'MATCHED', score: topScore };
        return { matched: null, status: 'AMBIGUOUS', score: topScore };
      }
      return { matched: topCandidates[0], status: 'MATCHED', score: topScore };
    } else {
      return { matched: null, status: 'AMBIGUOUS', score: topScore };
    }
  }

  return { matched: null, status: 'UNRESOLVED', score: topScore };
}

// ── 4. حساب الـ Global Score لتقييم التوزيع الكلي ───────────────────────────
function computeGlobalScore(participants, originalTeams) {
  const total = participants.length;
  if (total === 0) return 0;

  let totalMales = 0;
  for (let i = 0; i < total; i++) {
    if (participants[i].gender === 'male') totalMales++;
  }
  const globalMaleRatio = totalMales / total;

  const teamSizes = { red: 0, green: 0, yellow: 0, black: 0 };
  const teamMales = { red: 0, green: 0, yellow: 0, black: 0 };

  for (let i = 0; i < total; i++) {
    const t = participants[i].team;
    if (t in teamSizes) {
      teamSizes[t]++;
      if (participants[i].gender === 'male') teamMales[t]++;
    }
  }

  const sizesArr = [teamSizes.red, teamSizes.green, teamSizes.yellow, teamSizes.black];
  const minSize = Math.min.apply(null, sizesArr);

  let score = 0;
  const evaluatedPairs = {};

  for (let i = 0; i < total; i++) {
    const p = participants[i];
    if (!p.wantsFriends || !p.friendNames || p.friendNames.length === 0) continue;

    const others = participants.filter(function(o) { return o.id !== p.id; });
    for (let j = 0; j < p.friendNames.length; j++) {
      const matchRes = findMatchedParticipant(p.friendNames[j], others);
      if (matchRes.status === 'MATCHED' && matchRes.matched) {
        const target = matchRes.matched;
        let isMutual = false;
        if (target.wantsFriends && target.friendNames) {
          for (let k = 0; k < target.friendNames.length; k++) {
            if (calculateNameMatchScore(target.friendNames[k], p.name) >= 70) {
              isMutual = true;
              break;
            }
          }
        }

        const pairKey = [p.id, target.id].sort().join(':');
        if (isMutual) {
          if (!evaluatedPairs[pairKey]) {
            evaluatedPairs[pairKey] = true;
            if (p.team === target.team) score += 100;
          }
        } else {
          if (p.team === target.team) score += 60;
        }
      }
    }
  }

  // Gender Balance Score
  for (let i = 0; i < TEAMS.length; i++) {
    const t = TEAMS[i];
    const s = teamSizes[t];
    if (s > 0) {
      const mRatio = teamMales[t] / s;
      const delta = Math.abs(mRatio - globalMaleRatio);
      if (delta <= 0.10) score += 30;
      else if (delta <= 0.22) score -= 20;
      else score -= 50;
    }
  }

  // Team Size Balance Score
  for (let i = 0; i < TEAMS.length; i++) {
    const t = TEAMS[i];
    const s = teamSizes[t];
    if (s === minSize) score += 30;
    else if (s === minSize + 1) score += 0;
    else score -= 40;
  }

  // Minimum Change Penalty
  if (originalTeams) {
    for (let i = 0; i < total; i++) {
      const p = participants[i];
      if (originalTeams[p.id] && p.team !== originalTeams[p.id]) {
        score -= 15;
      }
    }
  }

  return score;
}

// ── 5. محرك الـ Global Team Optimizer وإعادة التوازن ────────────────────────
function optimizeGlobalAssignments(newP, existingList) {
  const originalTeams = {};
  for (let i = 0; i < existingList.length; i++) {
    originalTeams[existingList[i].id] = existingList[i].team;
  }

  const allParticipants = existingList.map(function(p) { return Object.assign({}, p); });
  allParticipants.push(Object.assign({}, newP));

  let bestScore = -9999999;
  let bestConfig = {};

  // خيار 1: التعيين المباشر في الفرق الأربعة
  for (let idx = 0; idx < TEAMS.length; idx++) {
    const t = TEAMS[idx];
    for (let i = 0; i < allParticipants.length; i++) {
      allParticipants[i].team = originalTeams[allParticipants[i].id] || t;
    }
    const sc = computeGlobalScore(allParticipants, originalTeams);
    if (sc > bestScore) {
      bestScore = sc;
      bestConfig = {};
      for (let i = 0; i < allParticipants.length; i++) {
        bestConfig[allParticipants[i].id] = allParticipants[i].team;
      }
    }
  }

  // خيار 2: إعادة التوازن الديناميكي للأصدقاء المتصلين
  const connectedFriendIds = [];
  if (newP.wantsFriends && newP.friendNames) {
    for (let i = 0; i < newP.friendNames.length; i++) {
      const m = findMatchedParticipant(newP.friendNames[i], existingList);
      if (m.status === 'MATCHED' && m.matched) connectedFriendIds.push(m.matched.id);
    }
  }
  for (let i = 0; i < existingList.length; i++) {
    const p = existingList[i];
    if (p.wantsFriends && p.friendNames) {
      for (let j = 0; j < p.friendNames.length; j++) {
        if (calculateNameMatchScore(p.friendNames[j], newP.name) >= 70) {
          if (connectedFriendIds.indexOf(p.id) === -1) connectedFriendIds.push(p.id);
          break;
        }
      }
    }
  }

  for (let fIdx = 0; fIdx < connectedFriendIds.length; fIdx++) {
    const fId = connectedFriendIds[fIdx];
    const targetTeam = originalTeams[fId];
    if (!targetTeam) continue;

    for (let i = 0; i < allParticipants.length; i++) {
      allParticipants[i].team = originalTeams[allParticipants[i].id] || targetTeam;
      if (allParticipants[i].id === newP.id) allParticipants[i].team = targetTeam;
    }

    const scDirect = computeGlobalScore(allParticipants, originalTeams);
    if (scDirect > bestScore) {
      bestScore = scDirect;
      bestConfig = {};
      for (let i = 0; i < allParticipants.length; i++) {
        bestConfig[allParticipants[i].id] = allParticipants[i].team;
      }
    }
  }

  for (let i = 0; i < allParticipants.length; i++) {
    if (bestConfig[allParticipants[i].id]) {
      allParticipants[i].team = bestConfig[allParticipants[i].id];
    }
  }

  const assignedTeam = bestConfig[newP.id] || TEAMS[0];
  const updatedRegistrations = allParticipants.filter(function(p) { return p.id !== newP.id; });

  return { assignedTeam: assignedTeam, updatedRegistrations: updatedRegistrations };
}

// ── 6. قراءة وكتابة البيانات في Google Sheets ─────────────────────────────────
function getSheetRegistrations() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME) || SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const participants = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[1] || String(row[1]).trim() === '') continue;

    let friends = [];
    if (row[6]) {
      friends = String(row[6]).split(',').map(function(s) { return s.trim(); }).filter(Boolean);
    }

    participants.push({
      rowIndex: i + 1,
      id: String(row[0] || ''),
      name: String(row[1] || '').trim(),
      phone: normalizePhone(String(row[2] || '')),
      gender: String(row[3] || 'male').toLowerCase(),
      wantsFriends: String(row[4]).toUpperCase() === 'TRUE',
      friendsCount: Number(row[5] || 0),
      friendNames: friends,
      team: String(row[7] || '').toLowerCase(),
      registrationTime: String(row[8] || '')
    });
  }
  return participants;
}

function normalizePhone(phone) {
  if (!phone) return '';
  let cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.indexOf('20') === 0 && cleaned.length === 12) cleaned = cleaned.substring(2);
  if (cleaned.length === 10 && cleaned.indexOf('1') === 0) cleaned = '0' + cleaned;
  return cleaned;
}

function processRegistration(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME) || SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  const registrations = getSheetRegistrations();
  const normPhone = normalizePhone(data.phone);

  if (!normPhone || !/^01[0125]\d{8}$/.test(normPhone)) {
    return { success: false, error: 'من فضلك أدخل رقم واتساب مصري صحيح' };
  }

  // 1. فحص التكرار برقم الهاتف
  let existingIndex = -1;
  for (let i = 0; i < registrations.length; i++) {
    if (registrations[i].phone === normPhone) {
      existingIndex = i;
      break;
    }
  }

  if (existingIndex !== -1) {
    const existing = registrations[existingIndex];
    if (data.isUpdate) {
      existing.name = String(data.name || '').trim();
      existing.gender = data.gender;
      existing.wantsFriends = data.wantsFriends === true;
      existing.friendsCount = existing.wantsFriends ? (data.friendsCount || 0) : 0;
      existing.friendNames = existing.wantsFriends ? (data.friendNames || []) : [];

      sheet.getRange(existing.rowIndex, 2).setValue(existing.name);
      sheet.getRange(existing.rowIndex, 4).setValue(existing.gender);
      sheet.getRange(existing.rowIndex, 5).setValue(existing.wantsFriends);
      sheet.getRange(existing.rowIndex, 6).setValue(existing.friendsCount);
      sheet.getRange(existing.rowIndex, 7).setValue(existing.friendNames.join(', '));

      return { success: true, data: existing, existing: false, updated: true };
    }
    return { success: true, data: existing, existing: true };
  }

  // 2. تسجيل مشترك جديد مع Global Optimization
  const participantId = 'p_' + new Date().getTime().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
  const nowIso = new Date().toISOString();

  const newParticipantDraft = {
    id: participantId,
    name: String(data.name || '').trim(),
    phone: normPhone,
    gender: data.gender || 'male',
    wantsFriends: data.wantsFriends === true,
    friendsCount: data.wantsFriends ? (data.friendsCount || 0) : 0,
    friendNames: data.wantsFriends ? (data.friendNames || []) : [],
    team: 'red',
    registrationTime: nowIso
  };

  const optimizationRes = optimizeGlobalAssignments(newParticipantDraft, registrations);
  const assignedTeam = optimizationRes.assignedTeam;
  const updatedRegistrations = optimizationRes.updatedRegistrations;

  // تحديث أي أعضاء تم تعديل فريقهم نتيجة لإعادة التوازن (Rebalancing)
  for (let i = 0; i < updatedRegistrations.length; i++) {
    const reg = updatedRegistrations[i];
    const oldReg = registrations.find(function(r) { return r.id === reg.id; });
    if (oldReg && oldReg.team !== reg.team && reg.rowIndex) {
      sheet.getRange(reg.rowIndex, 8).setValue(reg.team);
    }
  }

  const newRow = [
    participantId,
    newParticipantDraft.name,
    normPhone,
    newParticipantDraft.gender,
    newParticipantDraft.wantsFriends,
    newParticipantDraft.wantsFriends ? (data.friendsCount || 0) : 0,
    newParticipantDraft.friendNames.join(', '),
    assignedTeam,
    nowIso
  ];

  sheet.appendRow(newRow);

  newParticipantDraft.team = assignedTeam;
  return { success: true, data: newParticipantDraft, existing: false };
}

// ── 7. تدقيق شامل للنظام ─────────────────────────────────────────────────────
function auditRegistrations(registrations) {
  const total = registrations.length;
  let totalMales = 0;
  const teamCounts = { red: 0, green: 0, yellow: 0, black: 0 };
  const teamGenders = {
    red: { male: 0, female: 0 },
    green: { male: 0, female: 0 },
    yellow: { male: 0, female: 0 },
    black: { male: 0, female: 0 }
  };

  for (let i = 0; i < total; i++) {
    const p = registrations[i];
    if (p.gender === 'male') totalMales++;
    if (p.team in teamCounts) {
      teamCounts[p.team]++;
      teamGenders[p.team][p.gender]++;
    }
  }

  let totalRequests = 0;
  let satisfied = 0;

  for (let i = 0; i < total; i++) {
    const p = registrations[i];
    if (p.wantsFriends && p.friendNames) {
      const others = registrations.filter(function(o) { return o.id !== p.id; });
      for (let j = 0; j < p.friendNames.length; j++) {
        totalRequests++;
        const matchRes = findMatchedParticipant(p.friendNames[j], others);
        if (matchRes.status === 'MATCHED' && matchRes.matched) {
          if (matchRes.matched.team === p.team) satisfied++;
        }
      }
    }
  }

  return {
    total: total,
    males: totalMales,
    females: total - totalMales,
    teamCounts: teamCounts,
    teamGenders: teamGenders,
    friendRequests: {
      total: totalRequests,
      satisfied: satisfied,
      rate: totalRequests > 0 ? (satisfied / totalRequests * 100).toFixed(1) + '%' : '100%'
    }
  };
}
