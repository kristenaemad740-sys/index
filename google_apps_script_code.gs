/**
 * ==============================================================================
 *  🏆 اليوم الرياضي لأسرة الكاروز — Google Apps Script (Algorithm v4.0)
 * ==============================================================================
 *  الخوارزمية الأصلية المستقرة:
 *  - مطابقة مرنة للأسماء (Flexible Full Name & Partial Subsequence Matching)
 *  - أولوية الأصدقاء (Friend Priority First)
 *  - موازنة الفرق (Smallest Team First)
 *  - كسر التعادل الدائري حسب الجنس (Round-Robin Tie Breaker)
 *  - منع التسجيل المكرر برقم الواتساب
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
  return createJsonResponse({
    status: 'online',
    service: 'Al-Karoz Sports Day API v4.0',
    totalRegistrations: registrations.length,
    timestamp: new Date().toISOString()
  });
}

function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── 1. تطبيع النصوص والأرقام ────────────────────────────────────────────────
function normalizeName(name) {
  if (!name) return '';
  return String(name).trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizePhone(phone) {
  if (!phone) return '';
  let cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.indexOf('20') === 0 && cleaned.length === 12) cleaned = cleaned.substring(2);
  if (cleaned.length === 10 && cleaned.indexOf('1') === 0) cleaned = '0' + cleaned;
  return cleaned;
}

// ── 2. مطابقة أسماء الأصدقاء ─────────────────────────────────────────────────
function isSubSequence(subWords, fullWords) {
  if (!subWords || !fullWords || subWords.length === 0 || fullWords.length === 0) return false;
  if (subWords.length > fullWords.length) return false;
  for (let i = 0; i <= fullWords.length - subWords.length; i++) {
    let match = true;
    for (let j = 0; j < subWords.length; j++) {
      if (fullWords[i + j] !== subWords[j]) { match = false; break; }
    }
    if (match) return true;
  }
  return false;
}

function getMatchLength(friendName, participantName) {
  const normF = normalizeName(friendName);
  const normP = normalizeName(participantName);
  if (!normF || !normP) return 0;

  const fWords = normF.split(' ');
  const pWords = normP.split(' ');

  if (normF === normP) return fWords.length;
  if (isSubSequence(pWords, fWords)) return pWords.length;
  if (isSubSequence(fWords, pWords)) return fWords.length;

  return 0;
}

function findMatchedTeamForFriend(fName, registrations) {
  const normF = normalizeName(fName);
  if (!normF || !registrations || registrations.length === 0) return null;

  const matches = [];
  for (let i = 0; i < registrations.length; i++) {
    const p = registrations[i];
    const mlen = getMatchLength(fName, p.name);
    if (mlen > 0) matches.push({ team: p.team, matchLength: mlen });
  }

  if (matches.length === 0) return null;

  let maxLen = 0;
  for (let i = 0; i < matches.length; i++) {
    if (matches[i].matchLength > maxLen) maxLen = matches[i].matchLength;
  }

  const topMatches = matches.filter(function(m) { return m.matchLength === maxLen; });
  const topTeams = [];
  for (let i = 0; i < topMatches.length; i++) {
    if (topTeams.indexOf(topMatches[i].team) === -1) topTeams.push(topMatches[i].team);
  }

  if (topTeams.length === 1) return topTeams[0];
  return null;
}

// ── 3. قراءة وكتابة البيانات في Google Sheets ─────────────────────────────────
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

  // 1. منع التكرار برقم الهاتف
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

  // 2. إحصاء أحجام الفرق والجنس
  const teamSizes = { red: 0, green: 0, yellow: 0, black: 0 };
  const genderCounts = { male: 0, female: 0 };

  for (let i = 0; i < registrations.length; i++) {
    const p = registrations[i];
    if (p.team in teamSizes) teamSizes[p.team]++;
    if (p.gender in genderCounts) genderCounts[p.gender]++;
  }

  let assignedTeamId = '';

  // 3. تقييم طلبات الأصدقاء
  const teamFriendCounts = { red: 0, green: 0, yellow: 0, black: 0 };
  let totalValidFriends = 0;

  if (data.wantsFriends && data.friendNames && data.friendNames.length > 0) {
    for (let i = 0; i < data.friendNames.length; i++) {
      const matchedTeam = findMatchedTeamForFriend(data.friendNames[i], registrations);
      if (matchedTeam && (matchedTeam in teamFriendCounts)) {
        teamFriendCounts[matchedTeam]++;
        totalValidFriends++;
      }
    }
  }

  // أولوية الأصدقاء
  if (totalValidFriends > 0) {
    let maxFriends = 0;
    for (let i = 0; i < TEAMS.length; i++) {
      if (teamFriendCounts[TEAMS[i]] > maxFriends) maxFriends = teamFriendCounts[TEAMS[i]];
    }

    const topFriendTeams = TEAMS.filter(function(t) { return teamFriendCounts[t] === maxFriends; });

    if (topFriendTeams.length === 1) {
      assignedTeamId = topFriendTeams[0];
    } else {
      let minSizeInTied = 999999;
      for (let i = 0; i < topFriendTeams.length; i++) {
        if (teamSizes[topFriendTeams[i]] < minSizeInTied) minSizeInTied = teamSizes[topFriendTeams[i]];
      }
      const balancedTeams = topFriendTeams.filter(function(t) { return teamSizes[t] === minSizeInTied; });
      if (balancedTeams.length === 1) {
        assignedTeamId = balancedTeams[0];
      } else {
        const rrIdx = (genderCounts[data.gender] || 0) % balancedTeams.length;
        assignedTeamId = balancedTeams[rrIdx];
      }
    }
  }

  // بدون أصدقاء -> الفريق الأصغر
  if (!assignedTeamId) {
    let overallMinSize = 999999;
    for (let i = 0; i < TEAMS.length; i++) {
      if (teamSizes[TEAMS[i]] < overallMinSize) overallMinSize = teamSizes[TEAMS[i]];
    }
    const smallestTeams = TEAMS.filter(function(t) { return teamSizes[t] === overallMinSize; });
    if (smallestTeams.length === 1) {
      assignedTeamId = smallestTeams[0];
    } else {
      const rrIdxNoFriend = (genderCounts[data.gender] || 0) % smallestTeams.length;
      assignedTeamId = smallestTeams[rrIdxNoFriend];
    }
  }

  // 4. حفظ المشترك الجديد
  const participantId = 'p_' + new Date().getTime().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
  const nowIso = new Date().toISOString();

  const newRow = [
    participantId,
    String(data.name || '').trim(),
    normPhone,
    data.gender || 'male',
    data.wantsFriends === true,
    data.wantsFriends ? (data.friendsCount || 0) : 0,
    (data.friendNames || []).join(', '),
    assignedTeamId,
    nowIso
  ];

  sheet.appendRow(newRow);

  const finalParticipant = {
    id: participantId,
    name: String(data.name || '').trim(),
    phone: normPhone,
    gender: data.gender,
    wantsFriends: data.wantsFriends === true,
    friendsCount: data.wantsFriends ? (data.friendsCount || 0) : 0,
    friendNames: data.friendNames || [],
    team: assignedTeamId,
    registrationTime: nowIso
  };

  return { success: true, data: finalParticipant, existing: false };
}
