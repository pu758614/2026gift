/**
 * 交換禮物 — Google Apps Script 後端
 *
 * 使用方式：在 Google Sheet 中「擴充功能 → Apps Script」，把這整份貼到 Code.gs。
 * 在「專案設定 → 指令碼屬性」新增 ADMIN_PASSWORD = 你的後台密碼。
 * 部署 → 新增部署作業 → 類型「網頁應用程式」→ 執行身分「我」→ 存取權「所有人」。
 */

var GIFTS_SHEET = 'Gifts';
var STATE_SHEET = 'State';
var HEADERS = ['id', 'name', 'w1', 'w2', 'w3', 'fakeIndex', 'createdAt', 'revealed'];
var MAX_NAME = 30;
var MAX_WORD = 20;

/* ---------- 入口 ---------- */

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'public';
  try {
    if (action === 'public') return json_(publicData_());
    return json_({ ok: false, error: '未知的動作' });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ ok: false, error: '資料格式錯誤' });
  }

  try {
    switch (body.action) {
      case 'submit':
        return json_(submit_(body));
      case 'adminList':
        checkPassword_(body.password);
        return json_({ ok: true, gifts: readGifts_(), state: readState_() });
      case 'delete':
        checkPassword_(body.password);
        return json_(withLock_(function () { return deleteGift_(body.id); }));
      case 'reveal':
        checkPassword_(body.password);
        return json_(withLock_(function () { return revealGift_(body.id); }));
      case 'reset':
        checkPassword_(body.password);
        return json_(withLock_(resetAll_));
      case 'setDisplay':
        checkPassword_(body.password);
        return json_(withLock_(function () { return setDisplay_(body); }));
      case 'login':
        checkPassword_(body.password);
        return json_({ ok: true });
      default:
        return json_({ ok: false, error: '未知的動作' });
    }
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

/* ---------- 動作 ---------- */

function publicData_() {
  var gifts = readGifts_().map(function (g) {
    var item = { id: g.id, words: g.words, revealed: g.revealed };
    if (g.revealed) {
      item.name = g.name;
      item.fakeIndex = g.fakeIndex;
    }
    return item;
  });
  return { ok: true, gifts: gifts, state: readState_() };
}

function submit_(body) {
  var name = clean_(body.name, MAX_NAME);
  var words = (body.words || []).map(function (w) { return clean_(w, MAX_WORD); });
  var fakeIndex = Number(body.fakeIndex);

  if (!name) throw new Error('請填寫姓名');
  if (words.length !== 3 || words.some(function (w) { return !w; })) throw new Error('請填寫三個特徵');
  if (!(fakeIndex === 0 || fakeIndex === 1 || fakeIndex === 2)) throw new Error('請選擇哪一個是假的');

  // 打亂順序，讓假的不會固定在某個位置
  var order = shuffle_([0, 1, 2]);
  var shuffled = order.map(function (i) { return words[i]; });
  var newFake = order.indexOf(fakeIndex);

  return withLock_(function () {
    var sheet = giftsSheet_();
    var last = sheet.getLastRow();
    var nextId = 1;
    if (last >= 2) {
      var ids = sheet.getRange(2, 1, last - 1, 1).getValues();
      ids.forEach(function (r) { if (Number(r[0]) >= nextId) nextId = Number(r[0]) + 1; });
    }
    sheet.appendRow([nextId, name, shuffled[0], shuffled[1], shuffled[2], newFake, new Date().toISOString(), false]);
    return { ok: true, id: nextId };
  });
}

function deleteGift_(id) {
  var sheet = giftsSheet_();
  var row = findRow_(sheet, id);
  if (!row) throw new Error('找不到這筆資料');
  sheet.deleteRow(row);
  var state = readState_();
  if (state.revealId === Number(id)) writeState_({ revealId: null, revealAt: state.revealAt });
  return { ok: true };
}

function revealGift_(id) {
  var sheet = giftsSheet_();
  var row = findRow_(sheet, id);
  if (!row) throw new Error('找不到這筆資料');
  sheet.getRange(row, 8).setValue(true);
  writeState_({ revealId: Number(id), revealAt: Date.now() });
  return { ok: true };
}

function resetAll_() {
  var sheet = giftsSheet_();
  var last = sheet.getLastRow();
  if (last >= 2) sheet.deleteRows(2, last - 1);
  writeState_({ revealId: null, revealAt: Date.now(), resetAt: Date.now() });
  return { ok: true };
}

/** 大螢幕顯示設定：模式（all / carousel）與動態展示速度（1～10） */
function setDisplay_(body) {
  var patch = {};
  if (body.mode === 'all' || body.mode === 'carousel') patch.displayMode = body.mode;
  if (body.speed != null) {
    var s = Math.round(Number(body.speed));
    if (s >= 1 && s <= 10) patch.speed = s;
  }
  if (!Object.keys(patch).length) throw new Error('沒有要更新的設定');
  writeState_(patch);
  return { ok: true, state: readState_() };
}

/* ---------- 工具 ---------- */

function readGifts_() {
  var sheet = giftsSheet_();
  var last = sheet.getLastRow();
  if (last < 2) return [];
  var values = sheet.getRange(2, 1, last - 1, HEADERS.length).getValues();
  return values
    .filter(function (r) { return r[0] !== '' && r[0] !== null; })
    .map(function (r) {
      return {
        id: Number(r[0]),
        name: String(r[1]),
        words: [String(r[2]), String(r[3]), String(r[4])],
        fakeIndex: Number(r[5]),
        createdAt: r[6] instanceof Date ? r[6].toISOString() : String(r[6]),
        revealed: r[7] === true || String(r[7]).toUpperCase() === 'TRUE'
      };
    })
    .sort(function (a, b) { return a.id - b.id; });
}

function readState_() {
  var v = stateSheet_().getRange('A1').getValue();
  if (!v) return { revealId: null, revealAt: 0 };
  try { return JSON.parse(v); } catch (e) { return { revealId: null, revealAt: 0 }; }
}

// 合併寫入：只更新傳入的欄位，保留其他欄位（例如公佈時不會洗掉 resetAt 和顯示設定）
function writeState_(patch) {
  var state = readState_();
  Object.keys(patch).forEach(function (k) { state[k] = patch[k]; });
  stateSheet_().getRange('A1').setValue(JSON.stringify(state));
}

function giftsSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(GIFTS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(GIFTS_SHEET);
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function stateSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(STATE_SHEET) || ss.insertSheet(STATE_SHEET);
}

function findRow_(sheet, id) {
  var last = sheet.getLastRow();
  if (last < 2) return 0;
  var ids = sheet.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (Number(ids[i][0]) === Number(id)) return i + 2;
  }
  return 0;
}

function checkPassword_(pw) {
  var real = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
  if (!real) throw new Error('尚未設定 ADMIN_PASSWORD（Apps Script 專案設定 → 指令碼屬性）');
  if (String(pw || '') !== real) throw new Error('密碼錯誤');
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function clean_(s, max) {
  return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, max);
}

function shuffle_(arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** 在編輯器手動執行一次，可預先建立分頁並觸發授權 */
function setup() {
  giftsSheet_();
  stateSheet_();
}
