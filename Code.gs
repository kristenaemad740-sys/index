/**
 * ==============================================================================
 * 🏆 اليوم الرياضي - أسرة الكاروز (كنيسة العذراء مريم بالبداري)
 * Google Apps Script Backend (Phase 3 Production API - Ultra Robust)
 * ==============================================================================
 */

// ── Constants & Configuration ──────────────────────────────────────────────────
var SHEET_NAME = 'Participants';
var REQUIRED_HEADERS = [
  'id',
  'name',
  'phone',
  'gender',
  'wantsFriends',
  'friendsCount',
  'friendNames',
  'team',
  'registrationTime'
];
var TEAMS = ['red', 'green', 'yellow', 'black'];

// ── CORS & Helper Responses ────────────────────────────────────────────────────
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Ultra Robust Normalization Functions ────────────────────────────────────────
function normalizePhone(phone) {
  if (phone === null || phone === undefined || phone === '') return '';
  
  var str = '';
  if (typeof phone === 'number') {
    str = phone.toFixed(0);
  } else {
    str = String(phone).trim();
    // Handle scientific notation e.g. 1.287414593e+09 or floats
    if (str.indexOf('e') !== -1 || str.indexOf('E') !== -1) {
      var num = Number(str);
      if (!isNaN(num)) {
        str = num.toFixed(0);
      }
    }
  }

  // Remove single quotes if any and non-digits
  var cleaned = str.replace(/'/g, '').replace(/\D/g, '');
  
  // If 12 digits starting with '20' (e.g. 201287414593) -> strip '20'
  if (cleaned.indexOf('20') === 0 && cleaned.length === 12) {
    cleaned = cleaned.substring(2);
  }
  // If 10 digits starting with '1' (e.g. 1287414593 where 0 was stripped by Sheets) -> prepend '0'
  if (cleaned.length === 10 && cleaned.indexOf('1') === 0) {
    cleaned = '0' + cleaned;
  }
  return cleaned;
}

function isValidPhone(phone) {
  var normalized = normalizePhone(phone);
  return /^01[0125]\d{8}$/.test(normalized);
}

function normalizeName(name) {
  if (!name) return '';
  return String(name).trim().replace(/\s+/g, ' ').toLowerCase();
}

function isFriendMatch(friendName, participantName) {
  var normF = normalizeName(friendName);
  var normP = normalizeName(participantName);
  if (!normF || !normP) return false;

  // Exact match
  if (normF === normP) return true;

  // Flexible match: Requires requested friend name to have at least 2 words
  var fWords = normF.split(' ').filter(Boolean);
  if (fWords.length >= 2) {
    if (normP.indexOf(normF) !== -1 || normF.indexOf(normP) !== -1) {
      return true;
    }
  }
  return false;
}

// ── Unique ID Generator ───────────────────────────────────────────────────────
function generateUniqueId() {
  return 'p_' + new Date().getTime().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
}

// ── Sheet Initialization & Header Index Mapping ────────────────────────────────
function getSheetAndHeaderMap() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(REQUIRED_HEADERS);
  }

  // Use getDisplayValues to get exact formatted strings from cells!
  var displayValues = sheet.getDataRange().getDisplayValues();
  var rawValues = sheet.getDataRange().getValues();

  if (displayValues.length === 0) {
    sheet.appendRow(REQUIRED_HEADERS);
    displayValues = [REQUIRED_HEADERS];
    rawValues = [REQUIRED_HEADERS];
  }

  var headers = displayValues[0].map(function(h) { return String(h).trim(); });
  var map = {};
  
  REQUIRED_HEADERS.forEach(function(req) {
    var index = headers.indexOf(req);
    if (index === -1) {
      throw new Error('جدول البيانات غير مكتمل الإعداد. العمود المطلوب مفقود: ' + req);
    }
    map[req] = index;
  });

  return { sheet: sheet, map: map, displayValues: displayValues, rawValues: rawValues };
}

// ── Main Entry Points ──────────────────────────────────────────────────────────
function doGet(e) {
  if (e && e.parameter && e.parameter.action === 'cleanup') {
    return createJsonResponse(cleanupDuplicatePhones());
  }

  return createJsonResponse({
    status: 'online',
    service: 'Al-Karoz Sports Day API',
    version: '3.1.0',
    timestamp: new Date().toISOString()
  });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  var acquired = false;

  try {
    acquired = lock.tryLock(30000);
    if (!acquired) {
      return createJsonResponse({
        success: false,
        error: 'الخادم مشغول حاليًا، يرجى المحاولة بعد لحظات.'
      });
    }

    var requestData = {};
    if (e && e.postData && e.postData.contents) {
      try {
        requestData = JSON.parse(e.postData.contents);
      } catch (err) {
        requestData = e.parameter || {};
      }
    } else if (e && e.parameter) {
      requestData = e.parameter;
    }

    return handleRegistration(requestData);

  } catch (err) {
    return createJsonResponse({
      success: false,
      error: err.message || 'حدث خطأ غير متوقع أثناء معالجة الطلب.'
    });
  } finally {
    if (acquired) {
      lock.releaseLock();
    }
  }
}

// ── Registration Handler ──────────────────────────────────────────────────────
function handleRegistration(payload) {
  // 1. Server-side Validation
  var rawName = payload.name;
  var rawPhone = payload.phone;
  var rawGender = payload.gender;
  var rawWantsFriends = payload.wantsFriends === true || payload.wantsFriends === 'true';
  var rawFriendsCount = Number(payload.friendsCount) || 0;
  var rawFriendNames = Array.isArray(payload.friendNames) ? payload.friendNames : [];

  if (!rawName || !String(rawName).trim()) {
    return createJsonResponse({ success: false, error: 'من فضلك أدخل اسمك' });
  }

  var name = String(rawName).trim();

  if (!rawPhone || !isValidPhone(rawPhone)) {
    return createJsonResponse({ success: false, error: 'رقم الهاتف غير صحيح' });
  }

  var phone = normalizePhone(rawPhone);

  if (rawGender !== 'male' && rawGender !== 'female') {
    return createJsonResponse({ success: false, error: 'من فضلك اختر النوع' });
  }

  var gender = rawGender;

  var wantsFriends = rawWantsFriends;
  var friendsCount = 0;
  var friendNames = [];

  if (wantsFriends) {
    if (rawFriendsCount < 1) {
      return createJsonResponse({ success: false, error: 'من فضلك اختر عدد الأشخاص' });
    }
    friendsCount = rawFriendsCount;
    
    friendNames = rawFriendNames.map(function(fn) { return String(fn || '').trim(); });
    var hasEmpty = friendNames.some(function(fn) { return fn.length === 0; });
    
    if (friendNames.length !== friendsCount || hasEmpty) {
      return createJsonResponse({ success: false, error: 'من فضلك اكمل جميع أسماء الأشخاص' });
    }
  }

  // 2. Fetch Sheet Data
  var sheetInfo = getSheetAndHeaderMap();
  var sheet = sheetInfo.sheet;
  var map = sheetInfo.map;
  var displayRows = sheetInfo.displayValues;
  var rawRows = sheetInfo.rawValues;

  // 3. Ultra Robust Duplicate Check by Phone (checks display values AND raw values)
  for (var i = 1; i < displayRows.length; i++) {
    var displayCellPhone = displayRows[i][map['phone']];
    var rawCellPhone = rawRows[i][map['phone']];

    var existingPhoneFromDisplay = normalizePhone(displayCellPhone);
    var existingPhoneFromRaw = normalizePhone(rawCellPhone);
    
    if (existingPhoneFromDisplay === phone || existingPhoneFromRaw === phone) {
      // Participant exists! Return existing data without modifying anything
      var existingFriends = [];
      var rawFn = String(displayRows[i][map['friendNames']] || '');
      if (rawFn) {
        existingFriends = rawFn.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
      }

      return createJsonResponse({
        success: true,
        existing: true,
        data: {
          id: String(displayRows[i][map['id']] || ''),
          name: String(displayRows[i][map['name']] || ''),
          phone: phone, // Return sanitized 11-digit phone '01287414593'
          gender: String(displayRows[i][map['gender']] || ''),
          wantsFriends: String(displayRows[i][map['wantsFriends']]).toLowerCase() === 'true',
          friendsCount: Number(displayRows[i][map['friendsCount']]) || 0,
          friendNames: existingFriends,
          team: String(displayRows[i][map['team']] || ''),
          registrationTime: String(displayRows[i][map['registrationTime']] || '')
        }
      });
    }
  }

  // 4. Team Assignment Logic
  var assignedTeam = '';
  var registeredParticipants = [];
  var genderCounts = { male: 0, female: 0 };

  for (var j = 1; j < displayRows.length; j++) {
    var pName = String(displayRows[j][map['name']] || '');
    var pGender = String(displayRows[j][map['gender']] || '');
    var pTeam = String(displayRows[j][map['team']] || '');

    if (pGender === 'male' || pGender === 'female') {
      genderCounts[pGender]++;
    }

    if (pName && pTeam) {
      registeredParticipants.push({
        rawName: pName,
        team: pTeam
      });
    }
  }

  // Check Friend Matches
  if (wantsFriends && friendNames.length > 0) {
    var teamVotes = { red: 0, green: 0, yellow: 0, black: 0 };
    var totalMatches = 0;

    friendNames.forEach(function(fName) {
      var match = registeredParticipants.find(function(p) {
        return isFriendMatch(fName, p.rawName);
      });

      if (match && teamVotes.hasOwnProperty(match.team)) {
        teamVotes[match.team]++;
        totalMatches++;
      }
    });

    if (totalMatches > 0) {
      var maxVotes = 0;
      TEAMS.forEach(function(t) {
        if (teamVotes[t] > maxVotes) {
          maxVotes = teamVotes[t];
        }
      });

      var topTeams = TEAMS.filter(function(t) {
        return teamVotes[t] === maxVotes;
      });

      if (topTeams.length === 1) {
        assignedTeam = topTeams[0];
      } else {
        var tieIndex = genderCounts[gender] % topTeams.length;
        assignedTeam = topTeams[tieIndex];
      }
    }
  }

  // Fallback to standard gender-based Round-Robin
  if (!assignedTeam) {
    var rrIndex = genderCounts[gender] % TEAMS.length;
    assignedTeam = TEAMS[rrIndex];
  }

  // 5. Generate Record
  var newId = generateUniqueId();
  var registrationTime = Utilities.formatDate(new Date(), 'Africa/Cairo', "yyyy-MM-dd'T'HH:mm:ss.SSSXXX");

  // Construct Row Array matching Header Map exact order
  var newRow = new Array(REQUIRED_HEADERS.length);
  newRow[map['id']] = newId;
  newRow[map['name']] = name;
  // FORCE PLAIN TEXT IN GOOGLE SHEETS by prepending single quote
  newRow[map['phone']] = "'" + phone;
  newRow[map['gender']] = gender;
  newRow[map['wantsFriends']] = wantsFriends;
  newRow[map['friendsCount']] = friendsCount;
  newRow[map['friendNames']] = friendNames.join(', ');
  newRow[map['team']] = assignedTeam;
  newRow[map['registrationTime']] = registrationTime;

  // 6. Write Row to Sheet
  sheet.appendRow(newRow);

  // 7. Return Success API Response
  return createJsonResponse({
    success: true,
    existing: false,
    data: {
      id: newId,
      name: name,
      phone: phone,
      gender: gender,
      wantsFriends: wantsFriends,
      friendsCount: friendsCount,
      friendNames: friendNames,
      team: assignedTeam,
      registrationTime: registrationTime
    }
  });
}

// ── Diagnostic / Cleanup Function for Existing Duplicates ──────────────────────
function cleanupDuplicatePhones() {
  var sheetInfo = getSheetAndHeaderMap();
  var map = sheetInfo.map;
  var displayRows = sheetInfo.displayValues;
  var rawRows = sheetInfo.rawValues;

  var phoneMap = {};
  var duplicateGroups = [];

  for (var i = 1; i < displayRows.length; i++) {
    var rawPhone = displayRows[i][map['phone']] || rawRows[i][map['phone']];
    var normalized = normalizePhone(rawPhone);

    if (!normalized) continue;

    var item = {
      rowIndex: i + 1,
      id: String(displayRows[i][map['id']]),
      name: String(displayRows[i][map['name']]),
      rawPhone: String(rawPhone),
      normalizedPhone: normalized,
      gender: String(displayRows[i][map['gender']]),
      team: String(displayRows[i][map['team']]),
      registrationTime: String(displayRows[i][map['registrationTime']])
    };

    if (!phoneMap[normalized]) {
      phoneMap[normalized] = [item];
    } else {
      phoneMap[normalized].push(item);
    }
  }

  for (var norm in phoneMap) {
    if (phoneMap[norm].length > 1) {
      duplicateGroups.push({
        normalizedPhone: norm,
        count: phoneMap[norm].length,
        rows: phoneMap[norm]
      });
    }
  }

  return {
    success: true,
    totalRows: displayRows.length - 1,
    duplicateGroupsCount: duplicateGroups.length,
    duplicateGroups: duplicateGroups
  };
}
