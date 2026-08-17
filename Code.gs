/**
 * ==============================================================================
 * 🏆 اليوم الرياضي - أسرة الكاروز (كنيسة العذراء مريم بالبداري)
 * Google Apps Script Backend (Phase 3 Production API - Spec v4.0.0 Final Algorithm)
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
    if (str.indexOf('e') !== -1 || str.indexOf('E') !== -1) {
      var num = Number(str);
      if (!isNaN(num)) {
        str = num.toFixed(0);
      }
    }
  }

  var cleaned = str.replace(/'/g, '').replace(/\D/g, '');
  
  if (cleaned.indexOf('20') === 0 && cleaned.length === 12) {
    cleaned = cleaned.substring(2);
  }
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

// ── Friend Matching Logic (Hierarchical Priority Level 1 to 4) ────────────────
function getMatchScore(friendName, participantName) {
  var normF = normalizeName(friendName);
  var normP = normalizeName(participantName);
  if (!normF || !normP) return 0;

  var fWords = normF.split(' ');
  var pWords = normP.split(' ');

  // Level 1: Exact Full Name Match
  if (normF === normP) {
    return 1;
  }

  // Check if pWords contains fWords as a consecutive sequence or prefix
  var isSubSequence = false;
  for (var i = 0; i <= pWords.length - fWords.length; i++) {
    var sliceMatch = true;
    for (var j = 0; j < fWords.length; j++) {
      if (pWords[i + j] !== fWords[j]) {
        sliceMatch = false;
        break;
      }
    }
    if (sliceMatch) {
      isSubSequence = true;
      break;
    }
  }

  if (!isSubSequence) {
    if (normP.indexOf(normF + ' ') === 0 || normP.indexOf(' ' + normF) !== -1) {
      isSubSequence = true;
    }
  }

  if (isSubSequence) {
    if (fWords.length >= 4) return 1; // Full Name Match
    if (fWords.length === 3) return 2; // Three-Name Match
    if (fWords.length === 2) return 3; // Two-Name Match
    if (fWords.length === 1) return 4; // First Name Only Match
  }

  return 0; // No match
}

function findMatchedTeamForFriend(fName, registeredParticipants) {
  var normF = normalizeName(fName);
  if (!normF || !registeredParticipants || registeredParticipants.length === 0) {
    return null;
  }

  var candidatesByScore = { 1: [], 2: [], 3: [], 4: [] };

  registeredParticipants.forEach(function(p) {
    var score = getMatchScore(fName, p.rawName);
    if (score >= 1 && score <= 4) {
      candidatesByScore[score].push(p);
    }
  });

  // Evaluate scores from highest priority (1) to lowest (4)
  var scores = [1, 2, 3, 4];
  for (var k = 0; k < scores.length; k++) {
    var score = scores[k];
    var candidates = candidatesByScore[score];
    if (candidates.length > 0) {
      var candidateTeams = [];
      candidates.forEach(function(c) {
        if (candidateTeams.indexOf(c.team) === -1) {
          candidateTeams.push(c.team);
        }
      });

      if (candidateTeams.length === 1) {
        return candidateTeams[0]; // Unique team match at highest available priority level
      } else {
        return null; // Ambiguous match at this priority level -> Unresolved
      }
    }
  }

  return null;
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

  var displayValues = sheet.getDataRange().getDisplayValues();
  var rawValues = sheet.getDataRange().getValues();

  if (displayValues.length === 0) {
    sheet.appendRow(REQUIRED_HEADERS);
    displayValues = [REQUIRED_HEADERS];
    rawValues = [REQUIRED_HEADERS];
  }

  var headers = displayValues[0].map(function(h) { return String(h).trim(); });
  var map = {};
  
  REQUIRED_HEADERS.forEach(function(req, defaultIndex) {
    var index = headers.indexOf(req);
    if (index === -1) {
      map[req] = defaultIndex;
    } else {
      map[req] = index;
    }
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
    version: '4.0.0',
    timestamp: new Date().toISOString()
  });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  var acquired = false;

  try {
    try {
      acquired = lock.tryLock(10000);
    } catch (lErr) {
      acquired = false;
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
      error: err.message || 'حدث خطأ أثناء التسجيل، حاول مرة أخرى.'
    });
  } finally {
    if (acquired) {
      try {
        lock.releaseLock();
      } catch (rErr) {}
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
  var isUpdate = payload.isUpdate === true || payload.isUpdate === 'true' || payload.action === 'update';

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

  // 3. Ultra Robust Duplicate Check & Update Handler
  for (var i = 1; i < displayRows.length; i++) {
    var displayCellPhone = displayRows[i][map['phone']];
    var rawCellPhone = rawRows[i][map['phone']];

    var existingPhoneFromDisplay = normalizePhone(displayCellPhone);
    var existingPhoneFromRaw = normalizePhone(rawCellPhone);
    
    if (existingPhoneFromDisplay === phone || existingPhoneFromRaw === phone) {
      var rowIndex = i + 1; // 1-based row number
      var existingId = String(displayRows[i][map['id']] || '');
      var existingTeam = String(displayRows[i][map['team']] || '');
      var existingRegTime = String(displayRows[i][map['registrationTime']] || '');

      // If client requests an UPDATE to their existing record:
      if (isUpdate) {
        sheet.getRange(rowIndex, map['name'] + 1).setValue(name);
        sheet.getRange(rowIndex, map['gender'] + 1).setValue(gender);
        sheet.getRange(rowIndex, map['wantsFriends'] + 1).setValue(wantsFriends);
        sheet.getRange(rowIndex, map['friendsCount'] + 1).setValue(friendsCount);
        sheet.getRange(rowIndex, map['friendNames'] + 1).setValue(friendNames.join(', '));

        return createJsonResponse({
          success: true,
          existing: false,
          updated: true,
          data: {
            id: existingId,
            name: name,
            phone: phone,
            gender: gender,
            wantsFriends: wantsFriends,
            friendsCount: friendsCount,
            friendNames: friendNames,
            team: existingTeam,
            registrationTime: existingRegTime
          }
        });
      }

      // Default: Return existing record with existing: true flag
      var existingFriends = [];
      var rawFn = String(displayRows[i][map['friendNames']] || '');
      if (rawFn) {
        existingFriends = rawFn.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
      }

      return createJsonResponse({
        success: true,
        existing: true,
        data: {
          id: existingId,
          name: String(displayRows[i][map['name']] || ''),
          phone: phone,
          gender: String(displayRows[i][map['gender']] || ''),
          wantsFriends: String(displayRows[i][map['wantsFriends']]).toLowerCase() === 'true',
          friendsCount: Number(displayRows[i][map['friendsCount']]) || 0,
          friendNames: existingFriends,
          team: existingTeam,
          registrationTime: existingRegTime
        }
      });
    }
  }

  // 4. Team Assignment Logic for NEW participants (Hierarchical Spec v4.0.0)
  var assignedTeam = '';
  var registeredParticipants = [];
  var teamSizes = { red: 0, green: 0, yellow: 0, black: 0 };
  var genderCounts = { male: 0, female: 0 };

  for (var j = 1; j < displayRows.length; j++) {
    var pName = String(displayRows[j][map['name']] || '');
    var pGender = String(displayRows[j][map['gender']] || '');
    var pTeam = String(displayRows[j][map['team']] || '');

    if (pGender === 'male' || pGender === 'female') {
      genderCounts[pGender]++;
    }

    if (pTeam && teamSizes.hasOwnProperty(pTeam)) {
      teamSizes[pTeam]++;
    }

    if (pName && pTeam) {
      registeredParticipants.push({
        rawName: pName,
        team: pTeam,
        gender: pGender
      });
    }
  }

  // ── Friend Matching Evaluation ──
  var teamFriendCounts = { red: 0, green: 0, yellow: 0, black: 0 };
  var totalValidFriends = 0;

  if (wantsFriends && friendNames.length > 0) {
    friendNames.forEach(function(fName) {
      var matchedTeam = findMatchedTeamForFriend(fName, registeredParticipants);
      if (matchedTeam && teamFriendCounts.hasOwnProperty(matchedTeam)) {
        teamFriendCounts[matchedTeam]++;
        totalValidFriends++;
      }
    });
  }

  // Section 6: Friend Team Priority
  if (totalValidFriends > 0) {
    var maxFriends = 0;
    TEAMS.forEach(function(t) {
      if (teamFriendCounts[t] > maxFriends) {
        maxFriends = teamFriendCounts[t];
      }
    });

    var topFriendTeams = TEAMS.filter(function(t) {
      return teamFriendCounts[t] === maxFriends;
    });

    if (topFriendTeams.length === 1) {
      assignedTeam = topFriendTeams[0];
    } else {
      // Section 7: Team Balance among tied friend teams
      var minSizeInTied = Infinity;
      topFriendTeams.forEach(function(t) {
        if (teamSizes[t] < minSizeInTied) {
          minSizeInTied = teamSizes[t];
        }
      });

      var balancedTeams = topFriendTeams.filter(function(t) {
        return teamSizes[t] === minSizeInTied;
      });

      if (balancedTeams.length === 1) {
        assignedTeam = balancedTeams[0];
      } else {
        // Section 8: Round-Robin Tie Breaker
        var rrIndex = genderCounts[gender] % balancedTeams.length;
        assignedTeam = balancedTeams[rrIndex];
      }
    }
  }

  // Section 9: No Friend Match -> Team Balance (Smallest Team First)
  if (!assignedTeam) {
    var overallMinSize = Infinity;
    TEAMS.forEach(function(t) {
      if (teamSizes[t] < overallMinSize) {
        overallMinSize = teamSizes[t];
      }
    });

    var smallestTeams = TEAMS.filter(function(t) {
      return teamSizes[t] === overallMinSize;
    });

    if (smallestTeams.length === 1) {
      assignedTeam = smallestTeams[0];
    } else {
      var rrIndexNoFriend = genderCounts[gender] % smallestTeams.length;
      assignedTeam = smallestTeams[rrIndexNoFriend];
    }
  }

  // 5. Generate Record
  var newId = generateUniqueId();
  var registrationTime = Utilities.formatDate(new Date(), 'Africa/Cairo', "yyyy-MM-dd'T'HH:mm:ss.SSSXXX");

  var newRow = new Array(REQUIRED_HEADERS.length);
  newRow[map['id']] = newId;
  newRow[map['name']] = name;
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
