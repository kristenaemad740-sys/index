/**
 * ==============================================================================
 *  🏆 اليوم الرياضي لأسرة الكاروز — Google Apps Script (Anchor Algorithm v4.8)
 * ==============================================================================
 *  الخوارزمية المستقرة القائمة على مبدأ الـ Anchor:
 *  - اختيار "تحب تكون مع صحابك؟" (YES / NO):
 *    * YES: البحث الذكي عن الأصدقاء والانضمام لفريقهم فوراً.
 *    * NO: مشترك مرن يتم توجيهه لتحقيق أفضل توازن بالتوازي (حجم + نسبة جنس + أعداد).
 *  - قاعدة الـ Anchor:
 *    * إذا سجل الصديق لاحقاً، ينضم تلقائياً إلى فريق صاحب الطلب (صاحب الطلب هو الـ Anchor ولا يتم نقله).
 *    * إذا كان الصديق مسجلاً بالفعل، ينضم الجديد لفريقه (المسجل هو الـ Anchor).
 *  - مطابقة ذكية للأسماء بالثقة وتطبيع الحروف العربية.
 *  - حماية كاملة من الأرقام الفارغة والمكررة.
 *
 *  كيفية التركيب:
 *  1. افتح ملف Google Sheets الخاص باليوم الرياضي.
 *  2. اضغط على Extensions → Apps Script.
 *  3. امسح الكود القديم والصق هذا الكود بالكامل.
 *  4. اضغط Deploy → Manage Deployments → Edit (القلم) → New Version → Deploy.
 * ==============================================================================
 */

const TEAMS = ['red', 'green', 'yellow', 'black', 'blue', 'purple'];
const SHEET_NAME = 'Sheet1';

function doPost(e) {
  try {
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);

    try {
      const data = JSON.parse(e.postData.contents);
      const action = data.action || 'register';

      if (action === 'getAll') {
        const registrations = getSheetRegistrations();
        return createJsonResponse({ success: true, count: registrations.length, data: registrations });
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
  const revealedProp = PropertiesService.getScriptProperties().getProperty('TEAMS_REVEALED');
  return createJsonResponse({
    status: 'online',
    service: 'Al-Karoz Sports Day API (Anchor Algorithm v4.8)',
    totalRegistrations: registrations.length,
    teamsRevealed: revealedProp === 'true',
    timestamp: new Date().toISOString()
  });
}

// ── دوال الأدمن: تشغيلها مرة واحدة من Apps Script Editor ────────────────────
// لإعلان الكشف عن الفرق: شغّل revealTeams()
function revealTeams() {
  PropertiesService.getScriptProperties().setProperty('TEAMS_REVEALED', 'true');
  Logger.log('✅ Teams revealed! Users will now see their team.');
}
// لإعادة الإخفاء: شغّل hideTeams()
function hideTeams() {
  PropertiesService.getScriptProperties().setProperty('TEAMS_REVEALED', 'false');
  Logger.log('🔒 Teams hidden again.');
}

function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── 1. تطبيع النصوص والأرقام ────────────────────────────────────────────────
function normalizeArabic(text) {
  if (!text) return '';
  let s = String(text).trim();
  s = s.replace(/[\u064B-\u065F\u0670]/g, '');
  s = s.replace(/\u0640/g, '');
  s = s.replace(/[أإآٱ]/g, 'ا');
  s = s.replace(/ة/g, 'ه');
  s = s.replace(/ى/g, 'ي');
  s = s.replace(/[ؤئ]/g, 'ء');
  return s.replace(/\s+/g, ' ').toLowerCase().trim();
}

function tokenizeName(text) {
  const norm = normalizeArabic(text);
  return norm ? norm.split(' ').filter(function(w) { return w.length > 0; }) : [];
}

function normalizePhone(phone) {
  if (!phone) return '';
  let cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.indexOf('20') === 0 && cleaned.length === 12) cleaned = cleaned.substring(2);
  if (cleaned.length === 10 && cleaned.indexOf('1') === 0) cleaned = '0' + cleaned;
  return cleaned;
}

// ── 2. تقييم تطابق الأسماء ودرجة الثقة ───────────────────────────────────────
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

// ── 3. التوزيع المتوازن بالتوازي (Parallel Balanced Assignment) ─────────────
function evaluateBalancedAssignment(newP, registered) {
  const totalReg = registered.length + 1;
  let totalMales = 0;
  for (let i = 0; i < registered.length; i++) {
    if (registered[i].gender === 'male') totalMales++;
  }
  if (newP.gender === 'male') totalMales++;
  const totalFemales = totalReg - totalMales;
  const globalTargetRatio = (newP.gender === 'male' ? totalMales : totalFemales) / totalReg;

  const teamSizes = { red: 0, green: 0, yellow: 0, black: 0, blue: 0, purple: 0 };
  const teamMales = { red: 0, green: 0, yellow: 0, black: 0, blue: 0, purple: 0 };
  const teamFemales = { red: 0, green: 0, yellow: 0, black: 0, blue: 0, purple: 0 };

  for (let i = 0; i < registered.length; i++) {
    const p = registered[i];
    const t = p.team;
    if (t in teamSizes) {
      teamSizes[t]++;
      if (p.gender === 'male') teamMales[t]++;
      else teamFemales[t]++;
    }
  }

  const sizesArr = [teamSizes.red, teamSizes.green, teamSizes.yellow, teamSizes.black, teamSizes.blue, teamSizes.purple];
  const minSize = Math.min.apply(null, sizesArr);

  const scores = {};

  for (let i = 0; i < TEAMS.length; i++) {
    const team = TEAMS[i];
    const currSize = teamSizes[team];
    const currG = newP.gender === 'male' ? teamMales[team] : teamFemales[team];
    const currOpp = newP.gender === 'male' ? teamFemales[team] : teamMales[team];

    const newSize = currSize + 1;
    const newGRatio = (currG + 1) / newSize;
    const delta = Math.abs(newGRatio - globalTargetRatio);

    let sizeScore = 0;
    if (currSize === minSize) sizeScore = 60;
    else if (currSize === minSize + 1) sizeScore = 20;
    else sizeScore = -60;

    let genderRatioScore = 0;
    if (currSize === 0) genderRatioScore = 40;
    else if (delta <= 0.12) genderRatioScore = 40;
    else if (delta <= 0.25) genderRatioScore = 15;
    else genderRatioScore = -30;

    const countScore = (currG < currOpp) ? 20 : 0;

    scores[team] = sizeScore + genderRatioScore + countScore;
  }

  let maxScore = -999999;
  for (let i = 0; i < TEAMS.length; i++) {
    if (scores[TEAMS[i]] > maxScore) maxScore = scores[TEAMS[i]];
  }

  const bestTeams = TEAMS.filter(function(t) { return scores[t] === maxScore; });
  if (bestTeams.length === 1) return bestTeams[0];

  let minSizeInBest = 999999;
  for (let i = 0; i < bestTeams.length; i++) {
    if (teamSizes[bestTeams[i]] < minSizeInBest) minSizeInBest = teamSizes[bestTeams[i]];
  }
  const tiedSmallest = bestTeams.filter(function(t) { return teamSizes[t] === minSizeInBest; });
  if (tiedSmallest.length === 1) return tiedSmallest[0];

  const gCount = newP.gender === 'male' ? totalMales : totalFemales;
  return tiedSmallest[gCount % tiedSmallest.length];
}

// ── 4. تعيين الفريق للمشترك وفق مبدأ الـ Anchor ──────────────────────────────
function assignTeamForParticipant(newP, registered) {
  // خطوة 1: فحص الطلبات العكسية (هل طلب أحد المشتركين السابقين هذا الشخص؟)
  const reverseRequesters = [];
  for (let i = 0; i < registered.length; i++) {
    const p = registered[i];
    if (p.wantsFriends && p.friendNames && p.friendNames.length > 0) {
      for (let j = 0; j < p.friendNames.length; j++) {
        if (calculateNameMatchScore(p.friendNames[j], newP.name) >= 70) {
          reverseRequesters.push(p);
          break;
        }
      }
    }
  }

  if (reverseRequesters.length > 0 && (!newP.wantsFriends || !newP.friendNames || newP.friendNames.length === 0)) {
    return reverseRequesters[0].team;
  }

  // خطوة 2: إذا اختار wantsFriends == YES
  if (newP.wantsFriends && newP.friendNames && newP.friendNames.length > 0) {
    const teamFriendCounts = { red: 0, green: 0, yellow: 0, black: 0, blue: 0, purple: 0 };
    let totalMatched = 0;

    for (let i = 0; i < newP.friendNames.length; i++) {
      const matchRes = findMatchedParticipant(newP.friendNames[i], registered);
      if (matchRes.status === 'MATCHED' && matchRes.matched) {
        const t = matchRes.matched.team;
        if (t in teamFriendCounts) {
          teamFriendCounts[t]++;
          totalMatched++;
        }
      }
    }

    if (totalMatched > 0) {
      let maxFriends = 0;
      for (let i = 0; i < TEAMS.length; i++) {
        if (teamFriendCounts[TEAMS[i]] > maxFriends) maxFriends = teamFriendCounts[TEAMS[i]];
      }

      const topTeams = TEAMS.filter(function(t) { return teamFriendCounts[t] === maxFriends; });
      if (topTeams.length === 1) return topTeams[0];

      const teamSizes = { red: 0, green: 0, yellow: 0, black: 0, blue: 0, purple: 0 };
      for (let i = 0; i < registered.length; i++) {
        if (registered[i].team in teamSizes) teamSizes[registered[i].team]++;
      }
      let minSizeTied = 999999;
      for (let i = 0; i < topTeams.length; i++) {
        if (teamSizes[topTeams[i]] < minSizeTied) minSizeTied = teamSizes[topTeams[i]];
      }
      const balancedTop = topTeams.filter(function(t) { return teamSizes[t] === minSizeTied; });
      return balancedTop[0];
    }

    if (reverseRequesters.length > 0) {
      return reverseRequesters[0].team;
    }
  }

  // خطوة 3: التوزيع المتوازن (wantsFriends == NO أو الصديق غير مسجل بعد)
  return evaluateBalancedAssignment(newP, registered);
}

// ── 5. قراءة وكتابة البيانات في Google Sheets ─────────────────────────────────
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

  // 2. تعيين الفريق وفق خوارزمية الـ Anchor
  const newParticipantDraft = {
    name: String(data.name || '').trim(),
    phone: normPhone,
    gender: data.gender || 'male',
    wantsFriends: data.wantsFriends === true,
    friendsCount: data.wantsFriends ? (data.friendsCount || 0) : 0,
    friendNames: data.wantsFriends ? (data.friendNames || []) : []
  };

  const assignedTeam = assignTeamForParticipant(newParticipantDraft, registrations);
  const participantId = 'p_' + new Date().getTime().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
  const nowIso = new Date().toISOString();

  const newRow = [
    participantId,
    newParticipantDraft.name,
    normPhone,
    newParticipantDraft.gender,
    newParticipantDraft.wantsFriends,
    newParticipantDraft.friendsCount,
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
    friendsCount: newParticipantDraft.friendsCount,
    friendNames: newParticipantDraft.friendNames,
    team: assignedTeam,
    registrationTime: nowIso
  };

  return { success: true, data: finalParticipant, existing: false };
}
