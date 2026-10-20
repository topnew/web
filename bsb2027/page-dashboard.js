pages.dashboard = async function () {
  e('#head').removeClass('hide');
  const rows = app.book;
  dashboardDue(rows);
  dashboardBalance(rows);
  const now = new Date();
  await loadDashboardEvents(now.getFullYear(), now.getMonth());
};

e('#page-dashboard').html(faIcons(`
<div id="dashboard-cal" class="hide"></div>
<div id="dashboard-chart" class="line">
  <div class="cell-7 line-s mb-2">
    <div class="cell-4" id="dashboard-chart-exp"></div>
    <div class="cell-8" id="dashboard-chart-year"></div>
  </div><div class="cell-5 mb-2" id="dashboard-chart-years"></div>
</div>

<div class="fr">
  <b class="btn bg-gold show" data-src="#dashboard-chart"><n class="fa fa-chart-simple"></n></b>
  <b class="btn b-dark show" data-src="#dashboard-calc"><n class="fa fa-calculator"></n></b>
  <b class="btn bg-gold show" data-src="#dashboard-cal"><n class="fa fa-calendar"></n></b>
</div>
<br><b>Due Date Reminders</b>
<div style="overflow:auto"><table class="table" style="white-space:pre" id="dashboard-due"></table></div>

<br><b>Account Balance</b>
<div style="overflow:auto"><table class="hand table" style="white-space:pre" id="dashboard-balance"></table></div>
<div id="dashboard-calc" class="hide pop"><div style="max-width:100%;width:400px"><div class="tab bg-sand">Interest Calculator</div><div class="box bg line-s">
  <label>Amount:</label>
  <input type="number" id="amount" placeholder="1000" min="0" step="0.01" value="1000" class="cell-7">
  <button onclick="calculate()" class="cell-5 bg-sand">GO</button>
  <br><br>
  <label class="cell-7">Rate (% per year):</label>
  <label class="cell-5">Term:</label>
  <input type="number" id="rate" placeholder="5" min="0" step="0.01" value="5" class="cell-7">
  <select id="term" class="cell-5">
    <optgroup label="Years">
      <option value="12" selected>1 Year</option>
      <option value="24">2 Years</option>
      <option value="36">3 Years</option>
      <option value="48">4 Years</option>
      <option value="60">5 Years</option>
    </optgroup>
    <optgroup label="Months">
      <option value="1">1 Month</option>
      <option value="2">2 Months</option>
      <option value="3">3 Months</option>
      <option value="4">4 Months</option>
      <option value="5">5 Months</option>
      <option value="6">6 Months</option>
      <option value="7">7 Months</option>
      <option value="8">8 Months</option>
      <option value="9">9 Months</option>
      <option value="10">10 Months</option>
      <option value="11">11 Months</option>
    </optgroup>
    <optgroup label="Days">
      <option value="-1">1 Day</option>
      <option value="-7">7 Days</option>
      <option value="-14">14 Days</option>
      <option value="-21">21 Days</option>
      <option value="-28">28 Days</option>
    </optgroup>
  </select>
  <br><br>
  <b id="result" class="line-s cell-12"></b>
</div></div></div>
`));

const YEAR_DAYS = 365;
function termToYears(v) {
  v = Number(v);
  if (v > 0) return v / 12;                  // months
  if (v < 0) return Math.abs(v) / YEAR_DAYS; // days
  return 0;
}
function calculate() {
  const amount = parseFloat(document.getElementById('amount').value);
  const rate   = parseFloat(document.getElementById('rate').value);
  const term   = Number(document.getElementById('term').value);
  const out = document.getElementById('result');
  if (!Number.isFinite(amount) || !Number.isFinite(rate)) {
    out.textContent = 'Please enter valid values.';
    return;
  }
  if (amount < 0 || rate < 0) {
    out.textContent = 'Amount and rate must be non-negative.';
    return;
  }
  const years    = termToYears(term);
  const interest = amount * (rate / 100) * years;
  const total    = amount + interest;
  out.innerHTML = `
    <n class="cell-7">Total: ${BSB.fmtAmt(total)}</n>
    <n class="cell-5">Interest: ${BSB.fmtAmt(interest)}</n>
  `;
}
// Live recalc on any change
['amount', 'rate', 'term'].forEach(id => {
  document.getElementById(id).addEventListener('input', calculate);
});
calculate();   // initial render

window.DashboardCal = (function () {
  const el = document.getElementById('dashboard-cal');
  if (!el) return { setEvents(){}, goto(){}, refresh(){} };

  const today = new Date(); today.setHours(0,0,0,0);
  let view = new Date(today.getFullYear(), today.getMonth(), 1);
  let eventsByDate = {};

  function indexEvents(list) {
    const map = {};
    for (const ev of (list || [])) {
      if (!ev.ymd) continue;
      const key = String(ev.ymd).replaceAll('-', '');   // normalize to compact
      (map[key] ||= []).push(ev);
    }
    return map;
  }

  function render() {
    const y = view.getFullYear(), m = view.getMonth();
    const cells = BSB.grid(y, m);
    const label = view.toLocaleString(undefined, { month: 'short', year: 'numeric' });
    let html = `
      <div class="dc-head">
        <button type="button" data-act="prevY" title="Previous year">«</button>
        <button type="button" data-act="prevM" title="Previous month">‹</button>
        <span class="title" data-act="gotoToday" title="Jump to current month">${label}</span>
        <button type="button" data-act="nextM" title="Next month">›</button>
        <button type="button" data-act="nextY" title="Next year">»</button>
      </div>
      <table class="dc-table"><tr>
        ${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=>`<th>${d}</th>`).join('')}
      </tr>`;
    for (let w = 0; w < 6; w++) {
      html += '<tr>';
      for (let d = 0; d < 7; d++) {
        const cur = cells[w*7 + d];
        const key = BSB.fmtYmd(cur).replaceAll('-', ''); // ← FIXED
        const inMonth = cur.getMonth() === m && cur.getFullYear() === y;
        const isToday = BSB.sameDate(cur, today);
        const list = eventsByDate[key] || [];
        const cls = [ inMonth ? '' : 'other', isToday ? 'today' : '' ].filter(Boolean).join(' ');
        html += `<td class="${cls}">
          <div class="dc-day">${cur.getDate()}</div>
          ${list.map(ev => renderEv.html(ev)).join('<br>')}
        </td>`;
      }
      html += '</tr>';
    }
    html += '</table>';
    el.innerHTML = html;
  }

  const renderEv = {
    colors: [
      ['0a556c','5d5f64','8c8f39','0a516c','21d8d6','5f9e2f','1d8f68','286dbf','7db800','a5c8d1'],
      ['f00','f44','f88','faa','e11','e55','ff6f30','d55','ff5f5f','d56a6a'],
      ['5bc0de','5cb85c','337ab7','3b9f93','2d7cb9','0146b3','76be3f','4e87ba','1cbb67','3f91a3'],
      ['f29b3f','f79d42','f0ad4e','d9ce00','f4b700','ff9f00','f2a200','f29c42','f0837b','db9f1b'],
      ['000','222','444','666','888','aaa','ccc','ddd','eee','dedede'],
      ['7359b8','be6d9c','9c7ac8','d9534f','ce1797','e10098','8e4244','c1495d','754c24','ea4a6e'],
      ['672d8b','6f05f8','b17b6d','9c005c','664e2d','8b6c46','8c1c1c','ce67d7','b25e84','e1bc32'],
      ['0a556c','5d5f64','8c8f39','0a516c','21d8d6','5f9e2f','1d8f68','286dbf','7db800','a5c8d1'],
    ],
    html(ev) {
      const isInc = BSB.isInc(ev.c);
      const isExp = isInc ? 0 : BSB.isExp(ev.d);
      const dc    = isInc ? ev.c : ev.d;
      const row   = this.colors[Number(dc.substring(0, 1)) % this.colors.length];
      const color = row[Number(dc) % row.length];
      const amt   = BSB.fmtAmt(ev.amt / 100);
      const cat   = (c) => app.cats[c] ?? c;
      const title = `${amt} : ${cat(ev.c)} » ${cat(ev.d)}`;
      const css = isInc ? 'blue' : (isExp ? 'red' : 'grey');
      return `<n class="add-book ${css}" data-id="${ev.id}" data-ymd="${ev.ymd}" title="${title}">${cat(dc)}</n>`
         + ` ${Math.round(ev.amt/100)} <i class="disc" style="background:#${color}"></i>`;
    }
  }

  const api = {
    setEvents(list) { eventsByDate = indexEvents(list); render(); },
    goto(year, month) { view = new Date(year, month, 1); render(); },
    gotoToday() {
      view = new Date(today.getFullYear(), today.getMonth(), 1);
      render();
      if (api.onNavigate) api.onNavigate(view.getFullYear(), view.getMonth());
    },
    getView() { return { year: view.getFullYear(), month: view.getMonth() }; },
    onNavigate: null,
    refresh: render
  };

  el.addEventListener('click', ev => {
    // Clickable header — jump to current month
    if (ev.target.closest('.title')) {
      ev.preventDefault();
      api.gotoToday();
      return;
    }
    const btn = ev.target.closest('button');
    if (btn) {
      ev.preventDefault();
      const a = btn.dataset.act;
      if (a === 'prevM')      view.setMonth(view.getMonth() - 1);
      else if (a === 'nextM') view.setMonth(view.getMonth() + 1);
      else if (a === 'prevY') view.setFullYear(view.getFullYear() - 1);
      else if (a === 'nextY') view.setFullYear(view.getFullYear() + 1);
      render(); // synchronous
      if (api.onNavigate) api.onNavigate(view.getFullYear(), view.getMonth());
      return;
    }
  });

  render();
  return api;
})();

async function loadDashboardEvents(y, m) {
  const cells = BSB.grid(y, m);
  const day1  = BSB.fmtYmd(cells[0]).replaceAll('-', '');
  const day2  = BSB.fmtYmd(cells[41]).replaceAll('-', '');
  const lines = app.book.filter(r => r.ymd >= day1 && r.ymd <= day2);
  DashboardCal.setEvents(lines);
}
DashboardCal.onNavigate = (y, m) => loadDashboardEvents(y, m);

function dashboardDue(rows) {
  const withDue = [];
  for (const r of rows) {
    if (!r.rem || !String(r.rem).includes('"DUE"')) continue; // quoted key
    let rem;
    try { rem = JSON.parse(r.rem); } catch { continue; }
    if (!rem?.DUE) continue;
    r.rem = rem; // keep parsed object on row
    withDue.push({ due: rem.DUE, r });
  }
  if (!withDue.length) return;

  withDue.sort((a, b) => b.due.localeCompare(a.due));
  let html = `<tr class="b-gold"><td>Due</td><td colspan="2">Debit</td><td colspan="2">Credit</td><td class="ar">Amount</td><td>Remark</td></tr>`;

  for (const { due, r } of withDue) {
    const { DUE, ...rest } = r.rem;
    const keys = Object.keys(rest);
    let remark;
    if (keys.length === 1 && keys[0] === 'REM') remark = `<n class="badge bg">${rest.REM}</n>`;
    else remark = keys.map(k => `<n class="badge bg">${k}: ${rest[k]}</n>`).join(' ');

    const today = BSB.fmtYmd();
    let day30 = new Date(today); day30.setDate(day30.getDate() + 30);
    day30 = BSB.fmtYmd(day30);

    html += `<tr>
      <td class="${due <= today ? 'bg-red' : due <= day30 ? 'b-green' : ''}">${due}</td>
      <td>${r.d ?? ''}</td>
      <td>${app.cats[r.d] ?? r.d}</td>
      <td>${r.c ?? ''}</td>
      <td>${app.cats[r.c] ?? r.c}</td>
      <td class="ar add-book hand" data-id="${r.id}" data-ymd="${r.ymd}">${BSB.fmtAmt((r.amt ?? 0) / 100)}</td>
      <td>${remark}</td>
    </tr>`;
  }
  e('#dashboard-due').html(html);
}

function dashboardBalance(rows) {
  let data = {};
  const incPos = app.acc.incPos || 0;
  const catLen = [1, 3, 5, 7 ,9];
  const add = (ym, cat, amt) => {
    if (!data[ym]) data[ym] = {};
    const c1  = cat.charAt(0);
    for (const L of catLen) {
      if (cat.length < L) break;
      const key = cat.slice(0, L);
      const v = (incPos && BSB.isInc(c1)) ? -amt : amt;
      data[ym][key] = (data[ym][key] || 0) + v;
    }
  };

  rows.forEach(line => {
    const ym = String(line.ymd).substring(0, 6); // "202612"
    add(ym, line.d,  line.amt);
    add(ym, line.c, -line.amt);
  });

  const cats = Object.entries(app.cats).sort((a, b) => a[0].localeCompare(b[0]));
  data = buildTimeline(data);
  dashboardChart(data);

  const hideYears = new Set(
    Object.keys(data.cols).sort().slice(0, -3) // everything except last 3
  );

  let html = `<tr class="b-green b-0"><td>${app.acc.ccy}</td>`;
  for (const y in data.cols) {
    if (hideYears.has(y)) continue;
    for (const q in data.cols[y]) {
      for (const ym in data.cols[y][q]) html += `<td class="hide ar cellYM${y} cellQ${q} gold">${ym}</td>`;
      html += `<td class="b ar hide cellY${y} cellQ">${q}</td>`;
    }
    html += `<td class="ar cellY">${y}</td>`;
  }
  html += `<td class="b ar">Total</td></tr>`;

  for (const [id, name] of cats) {
    html += `<tr class="tree ${id > 999 ? 'trHide' : id > 9 ? '' : 'on'}" tr="${id}"><td class="${id < 1000 ? 'blue' : id < 100000 ? 'gold' : 'grey'}">${' '.repeat(id.length - 1)}${id}   <n>${name}</n></td>`;
    let total = 0;
    for (const y in data.cols) {
      const yAmt = data.years[y]?.[id] ?? 0;
      total += yAmt; // always count
      if (hideYears.has(y)) continue; // skip only rendering

      for (const q in data.cols[y]) {
        for (const ym in data.cols[y][q]) {
          const amt = data.months[ym]?.[id] ?? 0;
          html += `<td class="hide ar cellYM${y} cellQ${q}">${amt ? BSB.fmtAmt(amt/100) : '.'}</td>`;
        }
        const qAmt = data.quarters[q]?.[id] ?? 0;
        html += `<td class="b ar hide cellY${y} ${qAmt < 0 ? 'red' : 'green'}">${qAmt ? BSB.fmtAmt(qAmt/100) : '.'}</td>`;
      }
      html += `<td class="ar ${yAmt < 0 ? 'red' : 'green'}">${yAmt ? BSB.fmtAmt(yAmt/100) : '.'}</td>`;
    }
    html += `<td class="b ar ${total < 0 ? 'red' : 'green'}">${total ? BSB.fmtAmt(total/100) : '.'}</td>`;
    html += `</tr>`;
  }

  e('#dashboard-balance').html(html);
  catHtmlKids('#page-dashboard');

  e('#dashboard-balance tr.tree').each(function () {
    const row = e(this);
    let x = 0;
    row.find('td:not(:first-child):not(:last-child)').each(function(){
      if (e(this).text() !== '.') x = 1;
    });
    if (!x) row.addClass(row.find('td:last-child').text() === '.' ? 'hide' : 'trHide');
  });
}

e(document).on('click', 'td.cellY', function () {
  const y = e(this).text();
  e('.cellY' + y).toggleClass('hide');
  e('.cellYM' + y).addClass('hide');
});
e(document).on('click', 'td.cellQ', function () {
  e('.cellQ' + e(this).text()).toggleClass('hide');
});

function buildTimeline(data) {
  const yms = Object.keys(data).sort();
  if (!yms.length) return { cols: {}, months: {}, quarters: {}, years: {} };

  const first = yms[0], last = yms[yms.length - 1];
  for (let ym = first; ym <= last; ym = nextYm(ym)) {
    if (!data[ym]) data[ym] = {};
  }

  const cols     = {}; // cols[Y][Q][ym]= true  (ordering scaffold)
  const months   = {}; // months[ym]    = { cat: amt }
  const quarters = {}; // quarters[Q]   = { cat: amt } Q = "2020Q1"
  const years    = {}; // years[Y]      = { cat: amt } Y = "2020"

  for (let ym = first; ym <= last; ym = nextYm(ym)) {
    const ymd = ym + '01';
    const q   = BSB.date2Mode(ymd, 'Q');
    const y   = BSB.date2Mode(ymd, 'Y');

    // Record in the ordering scaffold
    (cols[y] ||= {});
    (cols[y][q] ||= {});
    cols[y][q][ym] = true;

    // Accumulate
    months[ym] = data[ym];
    addInto(quarters, q, data[ym]);
    addInto(years,    y, data[ym]);
  }

  return { cols, months, quarters, years };

  function addInto(bucket, key, src) {
    if (!bucket[key]) bucket[key] = {};
    for (const cat in src) {
      bucket[key][cat] = (bucket[key][cat] || 0) + src[cat];
    }
  }
  function nextYm(ym) {
    let y = +ym.slice(0, 4);
    let m = +ym.slice(4, 6) + 1;
    if (m > 12) { m = 1; y++; }
    return String(y) + String(m).padStart(2, '0');
  }
}

function dashboardChart(data) {
  // ---- chart 1: all years, one row per year ----
  const yearsSet = new Set();
  for (const y in data.years) {
    for (const cat in data.years[y]) {
      if (Number(cat) < 10) yearsSet.add(cat);
    }
  }
  const catsAll = [...yearsSet].sort((a, b) => Number(a) - Number(b));
  const years = {};
  for (const y in data.years) {
    years[y] = {};
    for (const cat in data.years[y]) {
      if (Number(cat) < 10) years[y][cat] = data.years[y][cat];
    }
  }
  let html = renderChartDiv(buildChart(years, catsAll), `All Accounts ${app.acc.ccy}`);
  e('#dashboard-chart-years').html(html);

  // ---- one months-chart per year, with that year's own cat list ----
  html = '';
  for (const y in data.cols) {
    const monthsForYear = {};
    const catsSet = new Set();

    for (const q in data.cols[y]) {
      for (const ym in data.cols[y][q]) {
        const src = data.months[ym] || {};
        const filtered = {};
        for (const cat in src) {
          if (Number(cat) < 10) {
            filtered[cat] = src[cat];
            catsSet.add(cat);
          }
        }
        monthsForYear[ym] = filtered;
      }
    }

    const catsThisYear = [...catsSet].sort((a, b) => Number(a) - Number(b));

    html += renderChartDiv(buildChart(monthsForYear, catsThisYear), `${y}`, 'line');
  }
  e('#dashboard-chart-year').html(html);
  e('#dashboard-chart-year .chart:last-child').removeClass('hide');

  const exp = {};
  for (const y in data.years) {
    const yearExp = [];
    for (const cat in data.years[y]) {
      if (String(cat).length === 3 && BSB.isExp(cat)) {
        yearExp.push([cat, Math.abs(data.years[y][cat])]);
      }
    }
    yearExp.sort((a, b) => b[1] - a[1]);
    exp[y] = yearExp.slice(0, 5);   // keep as ARRAY, not object
  }
  html = '';
  for (const y in exp) {
    let csv = 'Label,Value';
    for (const [cat, amt] of exp[y]) {          // already in desc order
      const label = app.cats[cat] ?? cat;
      csv += `\n${label},${amt / 100}`;
    }
    html += renderChartDiv(csv, y, 'pie');
  }
  e('#dashboard-chart-exp').html(html);
  e('#dashboard-chart-exp .chart:last-child').removeClass('hide');

  e('#dashboard-chart .chart').each(function(el) {
    Chart.render(el);
  });
}

function buildChart(rows, cats) {
  let chart = 'Date';
  cats.forEach(cat => {
    chart += `,${app.cats[cat] ?? cat}`;
  });
  for (const key in rows) {
    chart += `\n${key}`;
    cats.forEach(cat => {
      chart += `,${(rows[key][cat] ?? 0) / 100}`;
    });
  }
  return chart;
}
function renderChartDiv(csv, title, bar) {
  return `<div class="chart${bar ? ' hide' : ''}"
    data-title="${bar === 'pie' ? '' : title}"
    ${bar === 'line' ? `data-x-angle="45" data-y-sum="1"` : ''}
    ${bar === 'pie' ? `data-val-show="1"` : ''}
    data-chart="${bar ?? 'bar'}" data-legend="T" data-y-format="format"
    data-w="${bar === 'pie' ? 300 : 600}" data-h="300">${csv}</div>`;
}

function setChartIndex(i) {
  ['#dashboard-chart-year', '#dashboard-chart-exp'].forEach(sel => {
    const all = e(sel).find('.chart');
    all.addClass('hide');
    const target = all.els[((i % all.els.length) + all.els.length) % all.els.length];
    target.classList.remove('hide');
  });
}
e(document).on('click', '#dashboard-chart-year .chart', function () {
  const me = e(this);
  const n  = me.parent().find('.chart').els.length;
  setChartIndex((me.index() + 1) % n); // forward
});
e(document).on('click', '#dashboard-chart-exp .chart', function () {
  const me = e(this);
  const n  = me.parent().find('.chart').els.length;
  setChartIndex((me.index() - 1 + n) % n); // backward
});