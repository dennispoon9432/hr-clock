/**
 * HR 打卡系統 — Google Apps Script 後端
 * 貼入 Google Sheet → 擴充功能 → Apps Script，然後執行一次 setup()
 */

const TZ = 'Asia/Hong_Kong';

const SHEETS = {
  Shops:   ['shop_id', 'name', 'pin'],
  Staff:   ['staff_id', 'name', 'shop_id', 'active', 'face', 'updated'],
  Punches: ['timestamp', 'date', 'time', 'staff_id', 'name', 'shop_id', 'type', 'score', 'photo', 'device', 'client_time', 'offline'],
  Roster:  ['date', 'staff_id', 'shop_id', 'start', 'end', 'note'],
  Shifts:  ['code', 'start', 'end'],
};

/* ---------- 一次性設定 ---------- */
function setup() {
  const ss = SpreadsheetApp.getActive();
  ss.setSpreadsheetTimeZone(TZ);
  Object.keys(SHEETS).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    const head = SHEETS[name];
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');
    sh.setFrozenRows(1);
    // 全部用純文字，避免 Sheet 自動將日期/時間轉格式
    sh.getRange(1, 1, sh.getMaxRows(), head.length).setNumberFormat('@');
  });
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('ADMIN_PASSWORD')) props.setProperty('ADMIN_PASSWORD', 'admin1234');
  if (!props.getProperty('PHOTO_FOLDER')) {
    const folder = DriveApp.createFolder('HR打卡相片');
    props.setProperty('PHOTO_FOLDER', folder.getId());
  }
  const shops = ss.getSheetByName('Shops');
  if (shops.getLastRow() < 2) shops.appendRow(['S01', '旺角店', '1234']);
  const shifts = ss.getSheetByName('Shifts');
  if (shifts.getLastRow() < 2) {
    shifts.getRange(2, 1, 3, 3).setValues([['A', '09:00', '18:00'], ['B', '13:00', '22:00'], ['C', '11:00', '20:00']]);
  }
  Logger.log('完成！管理員密碼預設 admin1234，請到「專案設定 → 指令碼屬性」修改 ADMIN_PASSWORD');
}

/* ---------- HTTP ---------- */
function doGet() {
  return out({ ok: true, data: 'HR API running' });
}

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents);
    const fn = PUBLIC[req.action] || KIOSK[req.action] || ADMIN[req.action];
    if (!fn) throw new Error('未知指令: ' + req.action);
    if (KIOSK[req.action]) checkKiosk(req);
    if (ADMIN[req.action]) checkAdmin(req);
    return out({ ok: true, data: fn(req) });
  } catch (err) {
    return out({ ok: false, error: String(err.message || err) });
  }
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function checkAdmin(req) {
  const pw = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
  if (!req.password || req.password !== pw) throw new Error('管理員密碼錯誤');
}

function checkKiosk(req) {
  const shop = rows('Shops').find(s => s.shop_id === req.shop_id);
  if (!shop || String(shop.pin) !== String(req.pin)) throw new Error('分店或 PIN 錯誤');
}

/* ---------- Sheet helpers ---------- */
function sheet(name) { return SpreadsheetApp.getActive().getSheetByName(name); }

function norm(v) {
  if (v instanceof Date) {
    return v.getFullYear() < 1901
      ? Utilities.formatDate(v, TZ, 'HH:mm')
      : Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  }
  return v === null || v === undefined ? '' : String(v);
}

function rows(name) {
  const sh = sheet(name);
  const head = SHEETS[name];
  if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, head.length).getValues()
    .map((r, i) => {
      const o = { _row: i + 2 };
      head.forEach((h, j) => o[h] = norm(r[j]));
      return o;
    });
}

function writeAll(name, list) {
  const sh = sheet(name);
  const head = SHEETS[name];
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, head.length).clearContent();
  if (!list.length) return;
  const data = list.map(o => head.map(h => o[h] === undefined ? '' : String(o[h])));
  sh.getRange(2, 1, data.length, head.length).setNumberFormat('@').setValues(data);
}

function upsert(name, key, obj) {
  const sh = sheet(name);
  const head = SHEETS[name];
  const found = rows(name).find(r => r[key] === obj[key]);
  if (found) {
    const merged = head.map(h => obj[h] !== undefined ? String(obj[h]) : found[h]);
    sh.getRange(found._row, 1, 1, head.length).setNumberFormat('@').setValues([merged]);
  } else {
    const r = sh.getLastRow() + 1;
    sh.getRange(r, 1, 1, head.length).setNumberFormat('@').setValues([head.map(h => obj[h] !== undefined ? String(obj[h]) : '')]);
  }
}

function withLock(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

/* ---------- 公開 ---------- */
const PUBLIC = {
  shops: () => rows('Shops').map(s => ({ shop_id: s.shop_id, name: s.name })),
};

/* ---------- 打卡機 (需要分店 PIN) ---------- */
const KIOSK = {
  kioskData: () => ({
    serverTime: Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss'),
    staff: rows('Staff')
      .filter(s => s.active !== 'N' && s.face)
      .map(s => ({ staff_id: s.staff_id, name: s.name, face: JSON.parse(s.face) })),
  }),

  punch: (req) => withLock(() => {
    const staff = rows('Staff').find(s => s.staff_id === req.staff_id);
    if (!staff) throw new Error('搵唔到員工');
    // 離線補上傳用平板時間，否則用伺服器時間（防止改平板時鐘）
    const when = req.offline && req.client_time ? new Date(req.client_time) : new Date();
    const ts = Utilities.formatDate(when, TZ, 'yyyy-MM-dd HH:mm:ss');
    let photo = '';
    if (req.photo) {
      try {
        const folder = DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty('PHOTO_FOLDER'));
        const blob = Utilities.newBlob(Utilities.base64Decode(req.photo), 'image/jpeg',
          ts.replace(/[: ]/g, '-') + '_' + staff.staff_id + '_' + req.type + '.jpg');
        photo = folder.createFile(blob).getUrl();
      } catch (e) { photo = 'ERR ' + e.message; }
    }
    sheet('Punches').appendRow([ts, ts.slice(0, 10), ts.slice(11, 16), staff.staff_id, staff.name,
      req.shop_id, req.type, req.score || '', photo, req.device || '', req.client_time || '', req.offline ? 'Y' : '']);
    return { name: staff.name, time: ts, type: req.type };
  }),
};

/* ---------- 管理員 (需要密碼) ---------- */
const ADMIN = {
  adminLogin: () => true,

  listAll: () => ({
    shops: rows('Shops').map(strip),
    staff: rows('Staff').map(s => ({ staff_id: s.staff_id, name: s.name, shop_id: s.shop_id, active: s.active || 'Y', hasFace: !!s.face, updated: s.updated })),
    shifts: rows('Shifts').map(strip),
  }),

  saveShop: (req) => withLock(() => upsert('Shops', 'shop_id', req.shop)),

  saveStaff: (req) => withLock(() => {
    const s = req.staff;
    upsert('Staff', 'staff_id', { staff_id: s.staff_id, name: s.name, shop_id: s.shop_id, active: s.active || 'Y' });
  }),

  saveFace: (req) => withLock(() => {
    upsert('Staff', 'staff_id', {
      staff_id: req.staff_id,
      face: JSON.stringify(req.face),
      updated: Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'),
    });
  }),

  saveShifts: (req) => withLock(() => writeAll('Shifts', req.shifts)),

  importRoster: (req) => withLock(() => {
    // 相同 日期+員工 嘅舊更會被新更取代
    const keys = new Set(req.rows.map(r => r.date + '|' + r.staff_id));
    const keep = rows('Roster').filter(r => !keys.has(r.date + '|' + r.staff_id));
    writeAll('Roster', keep.concat(req.rows).sort((a, b) => (a.date + a.staff_id).localeCompare(b.date + b.staff_id)));
    return req.rows.length;
  }),

  reportData: (req) => {
    const inRange = d => d >= req.from && d <= req.to;
    // 打卡多拎一日，處理通宵更
    const to2 = Utilities.formatDate(new Date(new Date(req.to + 'T00:00:00').getTime() + 86400000 * 1.5), TZ, 'yyyy-MM-dd');
    return {
      roster: rows('Roster').filter(r => inRange(r.date)).map(strip),
      punches: rows('Punches').filter(p => p.date >= req.from && p.date <= to2).map(strip),
      staff: rows('Staff').map(s => ({ staff_id: s.staff_id, name: s.name, shop_id: s.shop_id })),
    };
  },
};

function strip(o) { const c = Object.assign({}, o); delete c._row; return c; }
