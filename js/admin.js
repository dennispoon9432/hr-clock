let PW = '';
let DB = { shops: [], staff: [], shifts: [] };
let parsedRoster = [];
let lastReport = null;

const A = (action, data = {}) => api(action, { password: PW, ...data });
const shopName = id => (DB.shops.find(s => s.shop_id === id) || {}).name || id;

/* ===== 登入 ===== */
async function login(pw) {
  PW = pw;
  await A('adminLogin');
  try { sessionStorage.setItem('hr_pw', pw); } catch {}
  $('#login').classList.add('hidden');
  $('#app').classList.remove('hidden');
  await reload();
  initReport();
}
$('#loginBtn').onclick = () => login($('#pw').value).catch(e => toast(e.message, 'bad'));
$('#pw').onkeydown = e => e.key === 'Enter' && $('#loginBtn').click();
$('#logout').onclick = () => { try { sessionStorage.removeItem('hr_pw'); } catch {} location.reload(); };
try { const p = sessionStorage.getItem('hr_pw'); if (p) login(p).catch(() => {}); } catch {}

$$('.tabs button').forEach(b => b.onclick = () => {
  $$('.tabs button').forEach(x => x.classList.toggle('on', x === b));
  $$('section[id^=tab-]').forEach(s => s.classList.toggle('hidden', s.id !== 'tab-' + b.dataset.tab));
});

async function reload() {
  DB = await A('listAll');
  const opts = DB.shops.map(s => `<option value="${esc(s.shop_id)}">${esc(s.name)}</option>`).join('');
  $('#rShop').innerHTML = '<option value="">全部分店</option>' + opts;
  $('#impShop').innerHTML = opts;
  $('#shiftCodes').value = DB.shifts.map(s => `${s.code} ${s.start} ${s.end}`).join('\n');
  renderStaff(); renderShops();
}

/* ===== Modal ===== */
function modal(html) { $('#modalBody').innerHTML = html; $('#modal').classList.remove('hidden'); }
function closeModal() {
  const v = $('#modalBody video'); if (v) Face.stopCamera(v);
  $('#modal').classList.add('hidden'); $('#modalBody').innerHTML = '';
}
$('#modal').onclick = e => e.target.id === 'modal' && closeModal();

/* ===== 分店 ===== */
function renderShops() {
  $('#shopTbl').innerHTML = `<table><tr><th>編號</th><th>名稱</th><th>PIN</th><th></th></tr>` +
    DB.shops.map(s => `<tr><td>${esc(s.shop_id)}</td><td>${esc(s.name)}</td><td>${esc(s.pin)}</td>
      <td><button class="ghost" onclick="editShop('${esc(s.shop_id)}')">編輯</button></td></tr>`).join('') + '</table>';
}
function editShop(id) {
  const s = DB.shops.find(x => x.shop_id === id) || { shop_id: '', name: '', pin: String(Math.floor(1000 + Math.random() * 9000)) };
  modal(`<h3>${id ? '編輯' : '新增'}分店</h3>
    <label>分店編號</label><input id="fId" value="${esc(s.shop_id)}" ${id ? 'disabled' : ''} placeholder="例如 S02">
    <label>名稱</label><input id="fName" value="${esc(s.name)}">
    <label>平板 PIN</label><input id="fPin" value="${esc(s.pin)}" inputmode="numeric">
    <div class="row" style="margin-top:16px"><button id="fSave">儲存</button><button class="ghost" onclick="closeModal()">取消</button></div>`);
  $('#fSave').onclick = async () => {
    const shop = { shop_id: $('#fId').value.trim(), name: $('#fName').value.trim(), pin: $('#fPin').value.trim() };
    if (!shop.shop_id || !shop.name || !shop.pin) return toast('請填晒', 'bad');
    try { await A('saveShop', { shop }); closeModal(); toast('已儲存', 'ok'); reload(); } catch (e) { toast(e.message, 'bad'); }
  };
}
$('#addShop').onclick = () => editShop('');

/* ===== 員工 ===== */
function renderStaff() {
  $('#staffTbl').innerHTML = `<table><tr><th>編號</th><th>姓名</th><th>所屬分店</th><th>狀態</th><th>樣貌</th><th></th></tr>` +
    DB.staff.map(s => `<tr>
      <td>${esc(s.staff_id)}</td><td>${esc(s.name)}</td><td>${esc(shopName(s.shop_id))}</td>
      <td>${s.active === 'N' ? '<span class="tag bad">停用</span>' : '<span class="tag ok">在職</span>'}</td>
      <td>${s.hasFace ? `<span class="tag ok">已登記</span> <span class="muted">${esc(s.updated)}</span>` : '<span class="tag late">未登記</span>'}</td>
      <td class="row"><button class="ghost" onclick="editStaff('${esc(s.staff_id)}')">編輯</button>
        <button onclick="enroll('${esc(s.staff_id)}')">登記樣貌</button></td></tr>`).join('') + '</table>';
}
function editStaff(id) {
  const s = DB.staff.find(x => x.staff_id === id) || { staff_id: '', name: '', shop_id: DB.shops[0]?.shop_id, active: 'Y' };
  modal(`<h3>${id ? '編輯' : '新增'}員工</h3>
    <label>員工編號</label><input id="fId" value="${esc(s.staff_id)}" ${id ? 'disabled' : ''} placeholder="例如 E001">
    <label>姓名（要同更表寫法一樣）</label><input id="fName" value="${esc(s.name)}">
    <label>所屬分店</label><select id="fShop">${DB.shops.map(x => `<option value="${esc(x.shop_id)}" ${x.shop_id === s.shop_id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
    <label>狀態</label><select id="fActive"><option value="Y">在職</option><option value="N" ${s.active === 'N' ? 'selected' : ''}>停用（唔可以打卡）</option></select>
    <div class="row" style="margin-top:16px"><button id="fSave">儲存</button><button class="ghost" onclick="closeModal()">取消</button></div>`);
  $('#fSave').onclick = async () => {
    const staff = { staff_id: $('#fId').value.trim(), name: $('#fName').value.trim(), shop_id: $('#fShop').value, active: $('#fActive').value };
    if (!staff.staff_id || !staff.name) return toast('請填編號同姓名', 'bad');
    try { await A('saveStaff', { staff }); closeModal(); toast('已儲存', 'ok'); reload(); } catch (e) { toast(e.message, 'bad'); }
  };
}
$('#addStaff').onclick = () => editStaff('');

/* ===== 登記樣貌 ===== */
const SAMPLES = 5;
async function enroll(id) {
  const s = DB.staff.find(x => x.staff_id === id);
  modal(`<div class="enroll"><h3>登記樣貌：${esc(s.name)}</h3>
    <video id="eVideo" playsinline muted></video>
    <div class="dots">${'<span></span>'.repeat(SAMPLES)}</div>
    <p id="eMsg" style="text-align:center">載入中…</p>
    <p class="muted" style="text-align:center">望住鏡頭，慢慢左右輕輕轉吓頭。光線要充足，唔好戴口罩/太陽眼鏡。</p>
    <div class="row" style="justify-content:center"><button class="ghost" onclick="closeModal()">取消</button></div></div>`);
  const v = $('#eVideo');
  try { await Face.load(); await Face.startCamera(v); } catch (e) { $('#eMsg').textContent = '❌ ' + e.message; return; }
  const got = [];
  $('#eMsg').textContent = '影緊…';
  while (got.length < SAMPLES && $('#eVideo') === v) {
    const r = await Face.describe(v).catch(() => null);
    if (r && r.detection.score > 0.7) {
      const d = Array.from(r.descriptor);
      // 同上一張太似就唔要，攞多啲角度
      if (!got.length || faceapi.euclideanDistance(d, got[got.length - 1]) > 0.08) {
        got.push(d.map(x => Math.round(x * 1e4) / 1e4));
        $$('.dots span').forEach((el, i) => el.classList.toggle('on', i < got.length));
      }
    } else if ($('#eMsg')) $('#eMsg').textContent = r ? '請行近少少 / 光啲' : '搵唔到面…';
    await new Promise(res => setTimeout(res, 500));
  }
  if ($('#eVideo') !== v) return; // 已取消
  Face.stopCamera(v);
  $('#eMsg').textContent = '儲存緊…';
  try { await A('saveFace', { staff_id: id, face: got }); toast(`${s.name} 樣貌登記完成`, 'ok'); closeModal(); reload(); }
  catch (e) { $('#eMsg').textContent = '❌ ' + e.message; }
}

/* ===== 更份代號 ===== */
function readShiftCodes() {
  return $('#shiftCodes').value.split('\n').map(l => l.trim().split(/[\s,，]+/)).filter(p => p.length >= 3)
    .map(([code, start, end]) => ({ code, start: start.padStart(5, '0'), end: end.padStart(5, '0') }));
}
$('#saveShifts').onclick = async () => {
  try { await A('saveShifts', { shifts: readShiftCodes() }); toast('已儲存', 'ok'); } catch (e) { toast(e.message, 'bad'); }
};

/* ===== 匯入更表 ===== */
$('#impYear').value = new Date().getFullYear();
let fileGrid = null;
$('#impFile').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  if (/\.(csv|txt)$/i.test(f.name)) { $('#impText').value = await f.text(); fileGrid = null; return; }
  const wb = XLSX.read(await f.arrayBuffer(), { cellDates: true });
  const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' });
  fileGrid = raw.map(r => r.map(c => {
    if (c instanceof Date) return fmtDate(c);
    if (typeof c === 'number' && c > 0 && c < 1) { const m = Math.round(c * 1440); return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`; }
    return String(c).trim();
  })).filter(r => r.some(Boolean));
  $('#impText').value = fileGrid.map(r => r.join('\t')).join('\n');
  toast(`已讀取 ${f.name}`, 'ok');
};

$('#impParse').onclick = () => {
  const grid = Roster.textToGrid($('#impText').value);
  const { rows, errors } = Roster.parseRoster(grid, {
    shop_id: $('#impShop').value, year: +$('#impYear').value, shifts: readShiftCodes(), staff: DB.staff,
  });
  parsedRoster = rows;
  const name = id => (DB.staff.find(s => s.staff_id === id) || {}).name;
  $('#impOut').innerHTML = `
    ${errors.length ? `<div class="card" style="background:#fef2f2;margin:12px 0"><b>⚠️ ${errors.length} 個問題（呢啲唔會匯入）</b><ul>${errors.slice(0, 30).map(e => `<li>${esc(e)}</li>`).join('')}</ul></div>` : ''}
    <p><b>${rows.length}</b> 更可以匯入 ${rows.length ? `<button id="impGo">確認匯入</button>` : ''}</p>
    <div class="tbl-wrap" style="max-height:400px"><table><tr><th>日期</th><th>員工</th><th>分店</th><th>開始</th><th>結束</th><th>代號</th></tr>
    ${rows.map(r => `<tr><td>${r.date}</td><td>${esc(name(r.staff_id))} <span class="muted">${esc(r.staff_id)}</span></td><td>${esc(shopName(r.shop_id))}</td><td>${r.start}</td><td>${r.end}</td><td>${esc(r.note)}</td></tr>`).join('')}
    </table></div>`;
  const go = $('#impGo');
  if (go) go.onclick = async () => {
    go.disabled = true;
    try { const n = await A('importRoster', { rows: parsedRoster }); toast(`已匯入 ${n} 更`, 'ok'); $('#impOut').innerHTML = `<p>✅ 已匯入 ${n} 更</p>`; }
    catch (e) { toast(e.message, 'bad'); go.disabled = false; }
  };
};

/* ===== 報告 ===== */
function initReport() {
  const t = new Date();
  $('#rFrom').value = fmtDate(new Date(t.getFullYear(), t.getMonth(), 1));
  $('#rTo').value = fmtDate(t);
  $('#rGrace').value = CONFIG.GRACE_MIN;
}
const FLAG = {
  late: d => `<span class="tag late">遲到 ${d.late} 分</span>`,
  early: d => `<span class="tag late">早退 ${d.early} 分</span>`,
  absent: () => `<span class="tag bad">缺勤</span>`,
  noIn: () => `<span class="tag bad">冇打上班卡</span>`,
  noOut: () => `<span class="tag bad">冇打下班卡</span>`,
  otherShop: d => `<span class="tag info">喺${esc(shopName(d.inShop))}打卡</span>`,
};
const flagText = d => d.ok && !d.flags.length ? '準時' : d.flags.map(f => ({ late: `遲到${d.late}分`, early: `早退${d.early}分`, absent: '缺勤', noIn: '冇打上班卡', noOut: '冇打下班卡', otherShop: '其他分店打卡' }[f])).join(' / ');

$('#rRun').onclick = async () => {
  const from = $('#rFrom').value, to = $('#rTo').value, shop = $('#rShop').value, grace = +$('#rGrace').value || 0;
  if (!from || !to || from > to) return toast('日期唔啱', 'bad');
  $('#rOut').innerHTML = '<p class="muted">計算緊…</p>';
  try {
    const data = await A('reportData', { from, to });
    if (shop) data.roster = data.roster.filter(r => r.shop_id === shop);
    const rep = Roster.computeReport({ ...data, from, to, grace });
    if (shop) rep.unscheduled = rep.unscheduled.filter(p => p.shop_id === shop);
    lastReport = { rep, from, to };
    renderReport(rep);
  } catch (e) { $('#rOut').innerHTML = `<p style="color:var(--bad)">❌ ${esc(e.message)}</p>`; }
};

function renderReport(rep) {
  const d = rep.detail, n = f => d.filter(x => x.flags.includes(f)).length;
  const onTime = d.filter(x => x.ok).length;
  $('#rOut').innerHTML = `
    <div class="stats">
      <div class="stat"><span class="muted">總更數</span><b>${d.length}</b></div>
      <div class="stat"><span class="muted">準時率</span><b>${d.length ? Math.round(onTime / d.length * 100) : 0}%</b></div>
      <div class="stat"><span class="muted">遲到</span><b style="color:var(--warn)">${n('late')}</b></div>
      <div class="stat"><span class="muted">早退</span><b style="color:var(--warn)">${n('early')}</b></div>
      <div class="stat"><span class="muted">缺勤</span><b style="color:var(--bad)">${n('absent')}</b></div>
      <div class="stat"><span class="muted">漏打卡</span><b style="color:var(--bad)">${n('noIn') + n('noOut')}</b></div>
    </div>
    <div class="row" style="justify-content:space-between"><h3>員工總結</h3><button class="ghost" onclick="exportCsv('summary')">⬇ 匯出 CSV</button></div>
    <div class="tbl-wrap"><table><tr><th>員工</th><th>更數</th><th>準時</th><th>遲到次數</th><th>遲到總分鐘</th><th>早退</th><th>缺勤</th><th>漏打卡</th><th>總工時</th></tr>
    ${rep.summary.map(s => `<tr><td>${esc(s.name)} <span class="muted">${esc(s.staff_id)}</span></td><td>${s.shifts}</td><td>${s.onTime}</td>
      <td>${s.late ? `<b style="color:var(--warn)">${s.late}</b>` : 0}</td><td>${s.lateMin}</td><td>${s.early}</td>
      <td>${s.absent ? `<b style="color:var(--bad)">${s.absent}</b>` : 0}</td><td>${s.missing}</td><td>${s.hours}</td></tr>`).join('')}</table></div>

    <div class="row" style="justify-content:space-between;margin-top:18px"><h3>每更明細</h3>
      <div class="row"><label style="margin:0"><input type="checkbox" id="onlyBad" style="width:auto"> 只睇有問題</label>
      <button class="ghost" onclick="exportCsv('detail')">⬇ 匯出 CSV</button></div></div>
    <div class="tbl-wrap" style="max-height:520px"><table id="detailTbl"><tr><th>日期</th><th>員工</th><th>分店</th><th>編更</th><th>上班</th><th>下班</th><th>工時</th><th>狀態</th></tr>
    ${d.map(x => `<tr data-ok="${x.ok}"><td>${x.date}</td><td>${esc(x.name)}</td><td>${esc(shopName(x.shop_id))}</td><td>${x.start}-${x.end}</td>
      <td>${x.in || '—'}</td><td>${x.out || '—'}</td><td>${x.hours}</td>
      <td>${x.flags.length ? x.flags.map(f => FLAG[f](x)).join(' ') : '<span class="tag ok">準時</span>'}</td></tr>`).join('')}</table></div>

    ${rep.unscheduled.length ? `<h3 style="margin-top:18px">冇編更但有打卡（${rep.unscheduled.length}）</h3>
    <div class="tbl-wrap"><table><tr><th>時間</th><th>員工</th><th>分店</th><th>類型</th></tr>
    ${rep.unscheduled.map(p => `<tr><td>${p.timestamp}</td><td>${esc(p.name)}</td><td>${esc(shopName(p.shop_id))}</td><td>${p.type === 'IN' ? '上班' : '下班'}</td></tr>`).join('')}</table></div>` : ''}`;
  $('#onlyBad').onchange = e => $$('#detailTbl tr[data-ok]').forEach(tr => tr.classList.toggle('hidden', e.target.checked && tr.dataset.ok === 'true'));
}

function exportCsv(kind) {
  const { rep, from, to } = lastReport;
  const rows = kind === 'summary'
    ? [['員工編號', '姓名', '更數', '準時', '遲到次數', '遲到總分鐘', '早退次數', '早退總分鐘', '缺勤', '漏打卡', '總工時'],
       ...rep.summary.map(s => [s.staff_id, s.name, s.shifts, s.onTime, s.late, s.lateMin, s.early, s.earlyMin, s.absent, s.missing, s.hours])]
    : [['日期', '員工編號', '姓名', '分店', '更開始', '更結束', '上班打卡', '下班打卡', '工時', '遲到分鐘', '早退分鐘', '狀態'],
       ...rep.detail.map(x => [x.date, x.staff_id, x.name, shopName(x.shop_id), x.start, x.end, x.in, x.out, x.hours, x.late, x.early, flagText(x)])];
  const csv = '﻿' + rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `打卡${kind === 'summary' ? '總結' : '明細'}_${from}_${to}.csv`;
  a.click();
}
