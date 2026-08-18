/**
 * ==============================================================================
 *  🏆 اليوم الرياضي لأسرة الكاروز — Google Apps Script (Algorithm v5.0)
 * ==============================================================================
 *  يحتوي على المحرك الكامل لتكوين الفرق الذكي وتوزيع الجنس وطلبات الأصدقاء.
 *  
 *  كيفية التركيب:
 *  1. افتح ملف Google Sheets الخاص باليوم الرياضي.
 *  2. اضغط على Extensions → Apps Script.
 *  3. امسح الكود القديم والصق هذا الكود بالكامل.
 *  4. اضغط Deploy → New Deployment → Web app → Anyone → Deploy.
 * ==============================================================================
 */

const TEAMS = ['red', 'green', 'yellow', 'black'];
const SHEET_NAME = 'Sheet1'; // اسم صفحة البيانات

// ── 1. معالجة طلبات POST و GET ────────────────────────────────────────────────
function doPost(e) {
  try {
    const lock = LockService.getScriptLock();
    lock.waitLock(30000); // قفل لتفادي الـ Race Conditions والتسجيل المتزامن

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
    service: 'Al-Karoz Sports Day API v5.0',
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
    if (score >= 70) {
      scored.push({ score: score, participant: p });
    }
  }

  if (scored.length === 0) {
    return { matched: null, status: 'UNRESOLVED', score: 0 };
  }

  scored.sort(function(a, b) { return b.score - a.score; });
  const topScore = scored[0].score;
  const topCandidates = scored.filter(function(s) { return s.score === topScore; }).map(function(s) { return s.participant; });

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

// ── 4. محرك تقييم واختيار الفريق (Algorithm v5.0) ────────────────────────────
function evaluateAndAssignTeam(newP, registered) {
  const totalReg = registered.length + 1;
  let totalMales = 0;
  for (let i = 0; i < registered.length; i++) {
    if (registered[i].gender === 'male') totalMales++;
  }
  if (newP.gender === 'male') totalMales++;
  const totalFemales = totalReg - totalMales;
  const globalTargetRatio = (newP.gender === 'male' ? totalMales : totalFemales) / totalReg;

  const teamSizes = { red: 0, green: 0, yellow: 0, black: 0 };
  const teamMales = { red: 0, green: 0, yellow: 0, black: 0 };
  const teamFemales = { red: 0, green: 0, yellow: 0, black: 0 };

  for (let i = 0; i < registered.length; i++) {
    const p = registered[i];
    const t = p.team;
    if (t in teamSizes) {
      teamSizes[t]++;
      if (p.gender === 'male') teamMales[t]++;
      else teamFemales[t]++;
    }
  }

  const sizesArr = [teamSizes.red, teamSizes.green, teamSizes.yellow, teamSizes.black];
  const minSize = Math.min.apply(null, sizesArr);
  const maxSize = Math.max.apply(null, sizesArr);

  // 1. فحص طلبات الأصدقاء الصادرة (Forward)
  const forwardFriends = [];
  if (newP.wantsFriends && newP.friendNames && newP.friendNames.length > 0) {
    for (let i = 0; i < newP.friendNames.length; i++) {
      const matchRes = findMatchedParticipant(newP.friendNames[i], registered);
      if (matchRes.status === 'MATCHED' && matchRes.matched) {
        forwardFriends.push(matchRes.matched);
      }
    }
  }

  // 2. فحص طلبات الأصدقاء الواردة مسبقاً (Reverse)
  const reverseFriends = [];
  for (let i = 0; i < registered.length; i++) {
    const p = registered[i];
    if (p.wantsFriends && p.friendNames && p.friendNames.length > 0) {
      for (let j = 0; j < p.friendNames.length; j++) {
        if (calculateNameMatchScore(p.friendNames[j], newP.name) >= 70) {
          reverseFriends.push(p);
          break;
        }
      }
    }
  }

  const teamScores = {};

  for (let idx = 0; idx < TEAMS.length; idx++) {
    const team = TEAMS[idx];
    let friendScore = 0;

    // Forward checks
    for (let f = 0; f < forwardFriends.length; f++) {
      const targetP = forwardFriends[f];
      if (targetP.team === team) {
        let isMutual = false;
        if (targetP.wantsFriends && targetP.friendNames) {
          for (let k = 0; k < targetP.friendNames.length; k++) {
            if (calculateNameMatchScore(targetP.friendNames[k], newP.name) >= 70) {
              isMutual = true;
              break;
            }
          }
        }
        friendScore += (isMutual ? 100 : 60);
      }
    }

    // Reverse checks
    for (let r = 0; r < reverseFriends.length; r++) {
      const reqP = reverseFriends[r];
      if (reqP.team === team) {
        let alreadyCounted = false;
        for (let f = 0; f < forwardFriends.length; f++) {
          if (forwardFriends[f].id === reqP.id) { alreadyCounted = true; break; }
        }
        if (!alreadyCounted) {
          friendScore += 60;
        }
      }
    }

    // Gender Balance
    const currentGCount = newP.gender === 'male' ? teamMales[team] : teamFemales[team];
    const currentOppCount = newP.gender === 'male' ? teamFemales[team] : teamMales[team];
    const newTeamSize = teamSizes[team] + 1;
    const newGRatio = (currentGCount + 1) / newTeamSize;
    const delta = newGRatio - globalTargetRatio;

    let genderScore = 0;
    if (currentGCount < currentOppCount) {
      genderScore = 30;
    } else if (Math.abs(delta) <= 0.12) {
      genderScore = 15;
    } else if (delta > 0.25) {
      genderScore = -50;
    } else {
      genderScore = -20;
    }

    // Team Size Balance
    let sizeScore = 0;
    const currSize = teamSizes[team];
    if (currSize === minSize) {
      sizeScore = 30;
    } else if (currSize === minSize + 1) {
      sizeScore = 10;
    } else if (currSize >= minSize + 3 || (maxSize - minSize >= 3 && currSize === maxSize)) {
      sizeScore = -40;
    }

    teamScores[team] = friendScore + genderScore + sizeScore;
  }

  // اختيار الفريق صاحب أعلى Score
  let maxScore = -999999;
  for (let idx = 0; idx < TEAMS.length; idx++) {
    if (teamScores[TEAMS[idx]] > maxScore) maxScore = teamScores[TEAMS[idx]];
  }

  const bestTeams = TEAMS.filter(function(t) { return teamScores[t] === maxScore; });
  if (bestTeams.length === 1) return bestTeams[0];

  // كسر التعادل: الفريق الأصغر
  let smallestSize = 999999;
  for (let idx = 0; idx < bestTeams.length; idx++) {
    if (teamSizes[bestTeams[idx]] < smallestSize) smallestSize = teamSizes[bestTeams[idx]];
  }
  const tiedSmallest = bestTeams.filter(function(t) { return teamSizes[t] === smallestSize; });
  if (tiedSmallest.length === 1) return tiedSmallest[0];

  // كسر التعادل النهائي: Round-Robin حتمي
  const gCount = newP.gender === 'male' ? totalMales : totalFemales;
  return tiedSmallest[gCount % tiedSmallest.length];
}

// ── 5. قراءة وكتابة البيانات في Google Sheets ─────────────────────────────────
function getSheetRegistrations() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME) || SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const participants = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[1] || String(row[1]).trim() === '') continue; // تخطي الصفوف الفارغة

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
      // تحديث البيانات دون كسر الفريق الحالي
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

  // 2. تسجيل مشترك جديد وحساب الفريق
  const newParticipantDraft = {
    name: String(data.name || '').trim(),
    gender: data.gender || 'male',
    wantsFriends: data.wantsFriends === true,
    friendNames: data.wantsFriends ? (data.friendNames || []) : []
  };

  const assignedTeam = evaluateAndAssignTeam(newParticipantDraft, registrations);
  const participantId = 'p_' + new Date().getTime().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
  const nowIso = new Date().toISOString();

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

  const finalParticipant = {
    id: participantId,
    name: newParticipantDraft.name,
    phone: normPhone,
    gender: newParticipantDraft.gender,
    wantsFriends: newParticipantDraft.wantsFriends,
    friendsCount: newParticipantDraft.wantsFriends ? (data.friendsCount || 0) : 0,
    friendNames: newParticipantDraft.friendNames,
    team: assignedTeam,
    registrationTime: nowIso
  };

  return { success: true, data: finalParticipant, existing: false };
}

// ── 6. تدقيق شامل للـ Admin ──────────────────────────────────────────────────
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
      for (let j = 0; j < p.friendNames.length; j++) {
        totalRequests++;
        const matchRes = findMatchedParticipant(p.friendNames[j], registrations);
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
    friendRequests: { total: totalRequests, satisfied: satisfied, rate: totalRequests > 0 ? (satisfied / totalRequests * 100).toFixed(1) + '%' : '100%' }
  };
}
