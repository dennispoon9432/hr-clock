/* 更表解析 + 遲到報告計算（純函數，無 DOM） */
(function (root) {
  const p2 = n => String(n).padStart(2, '0');
  const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  const OFF = /^(off|休|休息|例假|假|rd|al|sl|ph|cl|ml|x|-|—|\/)$/i;

  /** 文字（Excel 複製 / CSV）→ 二維陣列 */
  function textToGrid(text) {
    const lines = text.replace(/\r/g, '').split('\n');
    const tab = text.includes('\t');
    return lines.filter(l => l.trim()).map(l => tab ? l.split('\t') : splitCsv(l)).map(r => r.map(c => String(c).trim()));
  }
  function splitCsv(line) {
    const out = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
      else if (c === '"') q = true; else if (c === ',') { out.push(cur); cur = ''; } else cur += c;
    }
    out.push(cur); return out;
  }

  /** 各種日期寫法 → yyyy-mm-dd；唔係日期就 null。香港習慣 日/月 */
  function parseDate(s, year) {
    s = String(s || '').trim().replace(/[（(].*?[)）]/g, '').replace(/星期.|週.|\s+(mon|tue|wed|thu|fri|sat|sun)\w*$/i, '').trim();
    let m, y, mo, d;
    if ((m = s.match(/^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?$/))) [, y, mo, d] = m;
    else if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/))) { [, d, mo, y] = m; if (y.length === 2) y = '20' + y; }
    else if ((m = s.match(/^(\d{1,2})[/.](\d{1,2})$/))) { [, d, mo] = m; y = year; }
    else if ((m = s.match(/^(\d{1,2})月(\d{1,2})日?$/))) { [, mo, d] = m; y = year; }
    else if ((m = s.match(/^(\d{1,2})[-\s]([a-z]{3})\w*(?:[-\s](\d{2,4}))?$/i)) && MONTHS[m[2].toLowerCase()]) {
      d = m[1]; mo = MONTHS[m[2].toLowerCase()]; y = m[3] ? (m[3].length === 2 ? '20' + m[3] : m[3]) : year;
    }
    else if ((m = s.match(/^([a-z]{3})\w*[-\s](\d{1,2})(?:,?\s*(\d{4}))?$/i)) && MONTHS[m[1].toLowerCase()]) {
      mo = MONTHS[m[1].toLowerCase()]; d = m[2]; y = m[3] || year;
    }
    else return null;
    y = +y; mo = +mo; d = +d;
    if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    const dt = new Date(y, mo - 1, d);
    if (dt.getMonth() !== mo - 1) return null;
    return `${y}-${p2(mo)}-${p2(d)}`;
  }

  /** 更份格 → {start,end} / 'OFF' / null(看不懂) */
  function parseShift(cell, shifts) {
    const s = String(cell || '').trim();
    if (!s || OFF.test(s)) return 'OFF';
    const code = shifts.find(x => x.code.toLowerCase() === s.toLowerCase());
    if (code) return { start: code.start, end: code.end, note: code.code };
    const m = s.replace(/\s/g, '').match(/^(\d{1,2})(?::?(\d{2}))?(am|pm)?[-–~至到](\d{1,2})(?::?(\d{2}))?(am|pm)?$/i);
    if (!m) return null;
    let h1 = +m[1], h2 = +m[4];
    if (/pm/i.test(m[3] || '') && h1 < 12) h1 += 12;
    if (/pm/i.test(m[6] || '') && h2 < 12) h2 += 12;
    if (h1 > 24 || h2 > 24) return null;
    return { start: `${p2(h1)}:${m[2] || '00'}`, end: `${p2(h2 % 24)}:${m[5] || '00'}`, note: '' };
  }

  function findStaff(val, staff) {
    const v = String(val || '').trim().toLowerCase();
    if (!v) return null;
    return staff.find(s => s.staff_id.toLowerCase() === v) || staff.find(s => s.name.toLowerCase() === v) || null;
  }

  /**
   * 支援兩種格式：
   *  A) 格仔更表：第一行係日期，每行一個員工，格入面寫更份（A / 09:00-18:00 / OFF）
   *  B) 清單：欄位 日期, 員工, [分店], 開始, 結束  或  日期, 員工, 更份
   */
  function parseRoster(grid, { shop_id, year, shifts = [], staff = [] }) {
    const rows = [], errors = [];
    if (!grid.length) return { rows, errors: ['冇資料'] };
    const head = grid[0].map(h => String(h).trim());
    const H = head.map(h => h.toLowerCase());
    const idx = re => H.findIndex(h => re.test(h));
    const isList = idx(/^(date|日期)$/) >= 0;

    if (isList) {
      const cDate = idx(/^(date|日期)$/), cStaff = idx(/^(staff|staff_id|員工|員工編號|姓名|name|編號)$/);
      const cShop = idx(/^(shop|shop_id|分店|店)$/), cStart = idx(/^(start|開始|上班)$/), cEnd = idx(/^(end|結束|下班)$/);
      const cShift = idx(/^(shift|更|更份|班)$/);
      if (cStaff < 0) return { rows, errors: ['搵唔到「員工」欄'] };
      grid.slice(1).forEach((r, i) => {
        const line = i + 2;
        const date = parseDate(r[cDate], year);
        const st = findStaff(r[cStaff], staff);
        if (!date) return errors.push(`第 ${line} 行：日期「${r[cDate]}」睇唔明`);
        if (!st) return errors.push(`第 ${line} 行：搵唔到員工「${r[cStaff]}」`);
        const sh = cShift >= 0 ? parseShift(r[cShift], shifts) : parseShift(`${r[cStart]}-${r[cEnd]}`, shifts);
        if (sh === 'OFF') return;
        if (!sh) return errors.push(`第 ${line} 行：更份睇唔明`);
        rows.push({ date, staff_id: st.staff_id, shop_id: (cShop >= 0 && r[cShop]) || shop_id || st.shop_id, start: sh.start, end: sh.end, note: sh.note });
      });
    } else {
      const dateCols = head.map((h, i) => ({ i, date: parseDate(h, year) })).filter(x => x.date);
      if (!dateCols.length) return { rows, errors: ['第一行搵唔到日期，請確認第一行係日期（例如 1/11、2026-11-01）'] };
      const infoCols = head.map((_, i) => i).filter(i => !dateCols.some(d => d.i === i));
      grid.slice(1).forEach((r, i) => {
        const line = i + 2;
        let st = null;
        for (const c of infoCols) { st = findStaff(r[c], staff); if (st) break; }
        if (!st) {
          const label = infoCols.map(c => r[c]).filter(Boolean).join(' ');
          // 星期行 / 空行 靜靜雞跳過
          if (!label || /^(星期|週|day|weekday|日|一|二|三|四|五|六)/i.test(label)) return;
          return errors.push(`第 ${line} 行：搵唔到員工「${label}」`);
        }
        dateCols.forEach(({ i: c, date }) => {
          const sh = parseShift(r[c], shifts);
          if (sh === 'OFF') return;
          if (!sh) return errors.push(`第 ${line} 行 ${date}：更份「${r[c]}」睇唔明`);
          rows.push({ date, staff_id: st.staff_id, shop_id: shop_id || st.shop_id, start: sh.start, end: sh.end, note: sh.note });
        });
      });
    }
    return { rows, errors };
  }

  /* ===== 報告 ===== */
  const MIN = 60000;
  const toMs = (date, hhmm) => new Date(`${date}T${hhmm.length === 5 ? hhmm : '0' + hhmm}:00`).getTime();
  const tsMs = ts => new Date(ts.replace(' ', 'T')).getTime();
  const hm = ms => { const d = new Date(ms); return `${p2(d.getHours())}:${p2(d.getMinutes())}`; };

  function computeReport({ roster, punches, staff, from, to, grace = 5 }) {
    const nameOf = id => (staff.find(s => s.staff_id === id) || {}).name || id;
    const byStaff = {};
    punches.forEach(p => { p.ms = tsMs(p.timestamp); (byStaff[p.staff_id] = byStaff[p.staff_id] || []).push(p); });
    const used = new Set();

    const detail = roster.map(r => {
      const s = toMs(r.date, r.start);
      let e = toMs(r.date, r.end); if (e <= s) e += 24 * 60 * MIN; // 通宵更
      const list = byStaff[r.staff_id] || [];
      const ins = list.filter(p => p.type === 'IN' && p.ms >= s - 4 * 60 * MIN && p.ms < e).sort((a, b) => a.ms - b.ms);
      const outs = list.filter(p => p.type === 'OUT' && p.ms > s && p.ms <= e + 6 * 60 * MIN).sort((a, b) => b.ms - a.ms);
      const pin = ins[0], pout = outs[0];
      [...ins, ...outs].forEach(p => used.add(p));
      const late = pin ? Math.max(0, Math.round((pin.ms - s) / MIN)) : 0;
      const early = pout ? Math.max(0, Math.round((e - pout.ms) / MIN)) : 0;
      const flags = [];
      if (!pin && !pout) flags.push('absent');
      else {
        if (!pin) flags.push('noIn');
        if (!pout) flags.push('noOut');
        if (pin && late > grace) flags.push('late');
        if (pout && early > 0) flags.push('early');
      }
      if (pin && pin.shop_id !== r.shop_id) flags.push('otherShop');
      return {
        date: r.date, staff_id: r.staff_id, name: nameOf(r.staff_id), shop_id: r.shop_id,
        start: r.start, end: r.end, in: pin ? hm(pin.ms) : '', out: pout ? hm(pout.ms) : '',
        inShop: pin ? pin.shop_id : '', late: flags.includes('late') ? late : 0, early: flags.includes('early') ? early : 0,
        hours: pin && pout ? Math.round((pout.ms - pin.ms) / 36e5 * 100) / 100 : '',
        flags, ok: !flags.some(f => f !== 'otherShop'),
      };
    }).sort((a, b) => (a.date + a.name).localeCompare(b.date + b.name));

    const unscheduled = punches.filter(p => !used.has(p) && p.date >= from && p.date <= to)
      .map(p => ({ timestamp: p.timestamp, staff_id: p.staff_id, name: nameOf(p.staff_id), shop_id: p.shop_id, type: p.type }));

    const sum = {};
    detail.forEach(d => {
      const x = sum[d.staff_id] = sum[d.staff_id] || { staff_id: d.staff_id, name: d.name, shifts: 0, onTime: 0, late: 0, lateMin: 0, early: 0, earlyMin: 0, absent: 0, missing: 0, hours: 0 };
      x.shifts++;
      if (d.ok) x.onTime++;
      if (d.flags.includes('late')) { x.late++; x.lateMin += d.late; }
      if (d.flags.includes('early')) { x.early++; x.earlyMin += d.early; }
      if (d.flags.includes('absent')) x.absent++;
      if (d.flags.includes('noIn') || d.flags.includes('noOut')) x.missing++;
      if (d.hours) x.hours = Math.round((x.hours + d.hours) * 100) / 100;
    });
    return { detail, summary: Object.values(sum).sort((a, b) => b.late - a.late || b.lateMin - a.lateMin), unscheduled };
  }

  const api = { textToGrid, parseDate, parseShift, parseRoster, computeReport };
  if (typeof module !== 'undefined') module.exports = api; else root.Roster = api;
})(this);
