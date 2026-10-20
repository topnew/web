let searchData = null;
let searchFormCache = {};

pages.search = async function() {
  searchData = null;
  e('#search-form')[0].reset();
  e('#search-pgno').val('');
  e('#search-cat2').val('');
  await search();
};

async function search(cmd) {
  const form = searchForm(cmd);
  e('#page-add').addClass('hide');
  e('#search-form').removeClass('hide');
  const allRows = searchBook();
  const rows    = searchFilter(allRows, form);
  searchSort(rows, form);
  if (form.cmd === 'CSV')    return exportFile('book', rows, form);
  if (form.cmd === 'Grid')   return searchGrid(rows, form);
  if (form.cmd !== 'Detail') return searchReport(rows, form);

  // Detail only
  searchData = rows;
  searchFormCache = form;
  const pgno = searchPgno(rows.length, form);
  searchDetail(pgno);
}

function searchBook() {
  const allRows = app.book;
  // balance pass in (ymd,id) order
  const run = {};
  for (const row of allRows) {
    run[row.d] = (run[row.d] || 0) + row.amt;
    row.balaD  = run[row.d];
    run[row.c] = (run[row.c] || 0) - row.amt;
    row.balaC  = run[row.c];
  }
  return allRows;
}

function searchChart(cats, rows, cmd) {
  let data = 'Date';
  if (cmd === 'Pie') {
    data = 'Label,Value';
    const row = rows[0];
    const items = cats.map(cat => ({
        label: app.cats[cat] ?? cat,
        value: Math.abs((row?.[cat] ?? 0) / 100)
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
    items.forEach(it => {
      data += `\n${it.label},${it.value}`;
    });
  } else {
    cats.forEach(cat => {
      data += `,${app.cats[cat] ?? cat}`;
    });
    rows.forEach(row => {
      data += `\n${row.ymd}`;
      cats.forEach(cat => {
        data += `,${row[cat] / 100}`;
      });
    });
  }
  const html = `<div id="search-chart" class="chart" data-w="800" data-h="300" data-legend="T" data-y-format="format" data-chart="${cmd.toLowerCase()}">${data}</div>`;
  e('#search-data').html(html);
  const el = e('#search-chart')[0];
  Chart.render(el);

  const chart = document.getElementById('search-chart');
  const svg = chart.querySelector('svg');
  function updateChart() {
    if (window.innerWidth < 600) {
      svg.style.transform = 'rotate(90deg) translateX(400px) scale(2)';
      svg.style.transformOrigin = 'center center';
      svg.style.width = '500px';
    } else {
      chart.style.height = '';
      svg.style.transform = '';
      svg.style.transformOrigin = '';
    }
  }
  updateChart();
  window.addEventListener('resize', updateChart);
}

function searchDetail(pgno) {
  if (!searchData || !searchFormCache) return;
  const form    = searchFormCache;
  const total   = searchData.length;
  const pgsize  = Math.min(20, Number(form.pgsize) || 20);
  const pgnoMax = Math.max(1, Math.ceil(total / pgsize));
  if (pgno < 1 || pgno > pgnoMax) pgno = pgnoMax;

  let start = (pgno - 1) * pgsize;
  if (start + pgsize >= total) start = Math.max(0, total - pgsize);  // keep last page full
  const data = searchData.slice(start, start + pgsize);

  const cat  = form.cat;
  const cat2 = form.cat2;
  let pageSum = 0;

  const pgnos = searchPagination(pgno, pgnoMax);
  let html = `<br><m id="search-ttl">Total <b>${BSB.fmtInt(total)}</b> records</m>` + pgnos;

  e('#search-cat').next().find('.ss-single').html(`${cat2
    ? `<b class="red">${cat} ${cat2 == cat ? 'only' : `+ ${cat2}`}</b>`
    : e('#search-cat option:checked').text()
  }`);
  if (!cat2) document.querySelector('#search-cat').slim.setSelected(cat);

  if (!data.length) { e('#search-data').html(html); return; }

  const isMob = isMobile();
  html += `<div style="max-width:100%;overflow:auto"><table class="hand table" style="white-space:pre${isMob ? '' : ';width:auto'}">`;
  html += isMob
    ? `<tr class="b-grey"><td>Debit / Credit</td><td class="ar">Amount</td></tr>`
    : `<tr class="bg"><td>Date</td><td colspan="2">Debit</td><td colspan="2">Credit</td><td class="ar">Amount</td><td class="ar">Balance</td><td>Remark</td></tr>`;

  for (const row of data) {
    const isD = cat && row.d.startsWith(cat);
    const isC = cat && row.c.startsWith(cat);
    const colorD = isD ? 'b-green badge' : 'green badge';
    const colorC = isC ? 'b-gold badge' : 'gold badge';
    const sign = !isD && isC ? '-' : '';
    if (!isD || !isC) pageSum += sign ? -row.amt : row.amt;

    let rem = row.rem || '';
    try {
      const obj = JSON.parse(rem);
      if (obj && typeof obj === 'object') {
        rem = Object.entries(obj).map(([k, v]) => {
          let bg = 'b-grey';
          if (k === 'DUE') bg = 'b-red';
          else if (k === 'CID') bg = 'b-green';
          else if (k === 'INV') bg = 'b-blue';
          const txt = k === 'REF' ? v : `${k}: ${v}`;
          return `<n class="badge ${bg} rem" data-k="${k.toLowerCase()}">${txt}</n>`;
        }).join(' ');
      } else if (rem) rem = `<n class="badge bg rem" data-k="rem">${rem}</n>`;
    } catch { rem = rem ? `<n class="badge bg rem" data-k="rem">${rem}</n>` : ''; }
    if (!rem) rem = `<n class="badge grey"><n class="small">${row.id}</n></n>`;

    const d1 = `<n class="${colorD} cd1">${row.d}</n>`;
    const d2 = `<n class="${colorD} cd2" data-cd="${row.d}">${app.cats?.[row.d] || row.d}</n>`;
    const c1 = `<n class="${colorC} cd1">${row.c}</n>`;
    const c2 = `<n class="${colorC} cd2" data-cd="${row.c}">${app.cats?.[row.c] || row.c}</n>`;

    if (isMob) {
      html += `<tr><td><n class="dark ymd">${row.ymd}</n><br>${d1} ${d2}<br>${c1} ${c2}<br>${rem}</td>`;
      html += `<td class="ar grey"><n class="add-book big ${sign ? 'red' : 'green'}" data-id="${row.id}" data-ymd="${row.ymd}">${sign}${BSB.fmtAmt(row.amt / 100)}</n>`;
      html += `<br><n class="small add-book2-mob">${BSB.fmtAmt(row.balaD / 100)}</n>`;
      html += `<br><n class="small add-book2-mob">${BSB.fmtAmt(row.balaC / 100)}</n></td></tr>`;
    } else {
      const bala = cat && row.d.startsWith(cat) ? row.balaD : row.balaC;
      html += `<tr><td><n class="ymd">${row.ymd}</n></td><td>${d1}</td><td>${d2}</td><td>${c1}</td><td>${c2}</td>`;
      html += `<td data-id="${row.id}" data-ymd="${row.ymd}" class="add-book ar ${sign ? 'red' : 'green'}">${sign}${BSB.fmtAmt(row.amt / 100)}</td>`;
      html += `<td class="ar add-book2 ${bala < 0 ? 'red' : bala > 0 ? 'green' : 'grey'}">${BSB.fmtAmt(bala / 100)}</td><td>${rem}</td><tr>`;
    }
  }

  html += '<tr>' + (isMob ? '<td>Sum of Above</td>' : '<td colspan="3"></td><td colspan="2">Sum of Above</td>');
  html += `<td class="ar${pageSum < 0 ? ' red' : ''}">${BSB.fmtAmt(pageSum / 100)}</td>`;
  html += (isMob ? '' : '<td colspan="2"></td>') + '</tr></table></div>';
  e('#search-data').html(html + pgnos);
}

function searchFilter(allRows, form) {
  return allRows.filter(row => {
    if (form.ymdFm && row.ymd < form.ymdFm) return false;
    if (form.ymdTo && row.ymd > form.ymdTo) return false;
    if (form.amtFm && row.amt < form.amtFm) return false;
    if (form.amtTo && row.amt > form.amtTo) return false;
    if (form.rem && !row.rem?.includes(form.rem)) return false;
    if (form.inv || form.due || form.cid) {
      let remObj = null;
      try { remObj = JSON.parse(row.rem); } catch { return false; }
      for (const key of ['inv','due','cid']) {
        if (!form[key]) continue;
        const val = remObj?.[key.toUpperCase()];
        if (val == null || String(val) !== form[key]) return false;
      }
    }
    if (form.cat && form.cat2) {
      if (form.cat === form.cat2) return row.c === form.cat || row.d === form.cat;
      return (row.c === form.cat && row.d === form.cat2) || (row.c === form.cat2 && row.d === form.cat);
    } else if (form.cat) {
      return row.c?.startsWith(form.cat) || row.d?.startsWith(form.cat);
    }
    return true;
  });
}

function searchForm(cmd) {
  const keys = ['pgno','pgsize','cat','cat2','ymdFm','ymdTo','amt','rem','cid','inv','due','dlen','clen','sort','avg'];
  const form = Object.fromEntries(keys.map(n => [n, e(`#search-${n}`).val()]));
  for (const key of ['inv','cid','due']) {
    form[key] = form[key].replace(new RegExp(`^${key}\\s*:\\s*`, 'i'), '').trim();
  }
  form.cmd = cmd || 'Detail';

  if (form.cmd === 'Detail') form.dlen = '';
  else if (form.cmd === 'Grid') form.dlen = ['Y', 'Q', 'M'].includes(form.dlen) ? form.dlen : '';
  else if (!form.dlen) form.dlen = 'Y';
  e('#search-dlen').val(form.dlen);

  if (form.cmd !== 'Detail') {
    if (form.dlen === 'D') {
      if (!form.ymdTo) { form.ymdTo = BSB.fmtYmd(); e('#search-ymdTo').val(form.ymdTo); }
      let ago3M = new Date(form.ymdTo);
      ago3M.setMonth(ago3M.getMonth() - 3);
      ago3M = BSB.fmtYmd(ago3M);
      if (!form.ymdFm || form.ymdFm < ago3M) { form.ymdFm = ago3M; e('#search-ymdFm').val(ago3M); }
    } else if (form.dlen === 'W' && !form.ymdTo) {
      form.ymdTo = BSB.fmtYmd();
      e('#search-ymdTo').val(form.ymdTo);
      if (!form.ymdFm) {
        const { fm } = BSB.getDateRange('YTD');
        form.ymdFm = fm;
        e('#search-ymdFm').val(fm);
      }
    }
    if (form.cat.length > Number(form.clen)) {
      form.clen = Math.min(5, form.cat.length)
      e('#search-clen').val(form.clen);
    }
  }

  form.ymdFm = form.ymdFm.replaceAll('-', '');
  form.ymdTo = form.ymdTo.replaceAll('-', '');

  if (form.cmd === 'Grid') {
    form.cat = form.cat.substring(0, 1) || '5';
    e('#search-form .cat-select')[0].slim.setSelected(form.cat);
  }

  const arr = form.amt.split('..').map(v => v.trim());
  form.amtFm = BSB.cent2int(arr[0]);
  form.amtTo = BSB.cent2int(arr[1]);

  searchFormCache = form;
  return form;
}

function searchGrid(data, form) {
  data = searchGridData(data, form);
  const cols = [...new Set(
    Object.values(data).flatMap(d => Object.values(d).flatMap(Object.keys))
  )].sort();

  let html = '<br><div style="max-width:100%;overflow:auto"><table class="table" style="white-space:pre">';
  for (const ymd of Object.keys(data).sort((a, b) => b.localeCompare(a))) {
    const block = data[ymd];
    const rows  = Object.keys(block).sort();
    html += '<tr class="b-grey b ar">';
    html += `<td class="al">${ymd}</td>`;
    const c1len = app.cats[Number(rows[0])].length;
    for (const c of cols) html += `<td>${app.cats[Number(rows[0] + c)]?.substring(c1len) || c}</td>`;
    html += '<td>*</td></tr>';

    const sum = [];
    for (const row of rows) {
      html += `<tr class="ar"><td class="al"><b>${app.cats[Number(row)] || row}</b></td>`;
      let ttl = 0;
      for (const c of cols) {
        const v = (block[row][c] ?? 0) / 100;
        ttl += v;
        html += `<td class="${v < 0 ? 'red' : 'green'}">${v ? BSB.fmtAmt(v) : '.'}</td>`;
        sum[c] = (sum[c] ?? 0) + v;
      }
      html += `<td class="${ttl < 0 ? 'red' : 'green'}">${BSB.fmtAmt(ttl)}</td></tr>`;
      sum['ttl'] = (sum['ttl'] ?? 0) + ttl;
    }

    html += '<tr class="b-gold b ar">';
    html += `<td class="al">Total</td>`;
    for (const c of cols) html += `<td class="${sum[c] < 0 ? 'red' : 'green'}">${sum[c] ? BSB.fmtAmt(sum[c]) : '.'}</td>`;
    html += `<td class="${sum['ttl'] < 0 ? 'red' : 'green'}">${BSB.fmtAmt(sum['ttl'])}</td></tr>`;
  }
  html += '</table></div>';
  e('#search-data').html(html);
}

function searchGridData(rows, form) {
  const grid = {}; // grid[ymd][rowKey][colKey] = amount
  const cat = String(form.cat).substring(0, 1); // e.g. '5'
  const incPos = (app.acc.incPos || 0) && BSB.isInc(cat);
  const add = (ymd, code, amt) => {
    if (code.length < 3) return;
    const rowKey = code.substring(0, 3);
    let colKey = code.length >= 5 ? code.substring(3, 5) : '00';

    if (incPos) amt = -amt;
    if (!grid[ymd]) grid[ymd] = {};
    if (!grid[ymd][rowKey]) grid[ymd][rowKey] = {};
    grid[ymd][rowKey][colKey] = (grid[ymd][rowKey][colKey] || 0) + amt;
  };

  rows.forEach(line => {
    const ymd = form.dlen ? BSB.date2Mode(line.ymd, form.dlen) : 'sum';
    const amt = Number(line.amt) || 0;
    if (line.d.startsWith(cat)) add(ymd, line.d, amt);  // debit  +
    if (line.c.startsWith(cat)) add(ymd, line.c, -amt); // credit -
  });

  return grid;
}

function searchKey(vals) {
  searchData = null;
  e('#search-form')[0].reset();
  //e('#search-pgno').val('');
  Object.entries(vals).forEach(([k, v]) => e(`#search-${k}`).val(v));
  search();
}

function searchPgno(total, form) {
  const pgsize  = Math.min(20, Number(form.pgsize) || 20);
  const pgnoMax = Math.max(1, Math.ceil(total / pgsize));
  let pgno = Number(form.pgno);
  if (!pgno || pgno < 1 || pgno > pgnoMax) pgno = pgnoMax; // '' or 0 → last page
  e('#search-pgno').val(pgno);
  e('#search-pgno-max').val(pgnoMax);
  e('#search-total').val(total);
  return pgno;
}

function searchPagination(pgno, pgnoMax) {
  if (pgnoMax <= 1) return '';

  let start, end;
  if (pgno <= 3) { start = 1; end = Math.min(4, pgnoMax); }
  else if (pgno >= pgnoMax - 2) { start = Math.max(1, pgnoMax - 3); end = pgnoMax; }
  else { start = pgno - 1; end = pgno + 1; }

  let html = `<p class="ac pgnos">`;
  if (start > 1) html += `<n style="display:inline-block;transform:scaleX(-1)"><b class="btn bg px-3" data-pg="1">➜</b></n>`;
  for (let i = start; i <= end; i++) {
    html += ` <b class="btn bg${i === Number(pgno) ? '-sand' : ''}${i < 10 ? ' px-3' : ''}" data-pg="${i}">${i}</b>`;
  }
  if (end < pgnoMax) html += ` <b class="btn bg px-3" data-pg="${pgnoMax}">➜</b>`;
  return html + '</p>';
}

function searchSort(rows, form) {
  if (form.sort === 'his')      rows.sort((a,b) => b.ymd - a.ymd || b.id - a.id);
  else if (form.sort === 'amt') rows.sort((a,b) => a.amt - b.amt);
  else if (form.sort === 'id')  rows.sort((a,b) => a.id  - b.id  || a.ymd - b.ymd);
  else                          rows.sort((a,b) => a.ymd - b.ymd || a.id - b.id);
}

function searchReport(data, form) {
  data = searchReportData(data, form);
  const cats = [...new Set(
    Object.values(data).flatMap(row => Object.keys(row))
  )].sort((a, b) => {
    // Same top-level category
    if (a[0] === b[0]) {
      // Parent/child: child first
      if (a.startsWith(b)) return -1;
      if (b.startsWith(a)) return 1;
      return a.localeCompare(b);
    }
    return a.localeCompare(b);
  });

  const rows = Object.keys(data).sort().map(ymd => {
    const row = { ymd };
    cats.forEach(cat => row[cat] = data[ymd][cat] ?? 0);
    return row;
  });

  if (form.cmd !== 'Report') return searchChart(cats, rows, form.cmd);

  let html = '<br><div style="max-width:100%;overflow:auto"><table class="table hand" id="search-rep" style="white-space:pre;width:auto"><tr class="b-green"><td>Date</td>';
  cats.forEach(cat => {
    html += `<td class="ar ${cat > 9 ? (cat.length > 3 ? 'b-gold' : 'bg-gold') : 'b'}" data-cat="${cat}">${app.cats[cat] ?? cat}</td>`;
  });
  html += '</tr>';

  rows.forEach(row => {
    html += `<tr><td class="ymd-rep">${row.ymd}</td>`;
    cats.forEach(cat => {
      html += `<td class="ar">${BSB.fmtAmt(row[cat] / 100)}</td>`;
    });
    html += '</tr>';
  });
  html += '</table></div>';
  e('#search-data').html(html);
}

function searchReportData(rows, form) {
  const report = {};
  const incPos = app.acc.incPos || 0;
  const add = (ymd, cat, amt) => {
    cat = String(cat);
    c1 = cat.substring(0, 1);
    c3 = cat.substring(0, 3);
    c5 = cat.substring(0, 5);
    if (BSB.isInc(c1) && incPos) amt = -amt;
    if (!report[ymd]) report[ymd] = {};
    report[ymd][c1] = (report[ymd][c1] || 0) + amt;
    if (cat.length >= 3 && form.clen > 1) report[ymd][c3] = (report[ymd][c3] || 0) + amt;
    if (cat.length >= 5 && form.clen > 3) report[ymd][c5] = (report[ymd][c5] || 0) + amt;
  };
  rows.forEach(line => {
    const ymd = BSB.date2Mode(line.ymd, form.dlen);
    const amt = Number(line.amt) || 0;
    if (!form.cat || line.d.startsWith(form.cat)) add(ymd, line.d, amt);  // debit +
    if (!form.cat || line.c.startsWith(form.cat)) add(ymd, line.c, -amt); // credit -
  });
  return report;
}

e('#search-form').html(faIcons(`
  <input id="search-pgno" value="0" type="hidden">
  <input id="search-pgno-max" type="hidden">
  <input id="search-total" type="hidden">
  <input id="search-pgsize" value="20" type="hidden">
  <div class="cell-6 line-m">
    <div class="cell-6 p-1"><select class="cats cat-select" id="search-cat"><option value="">All Categories</option></select></div>
    <input type="hidden" id="search-cat2">
    <div class="cell-6 line-s">
      <div class="cell-8 p-1"><select id="search-fmto" class="bg">
        <option value="">Range</option>
        <option value="today">Today</option>
        <option value="yesterday">Yesterday</option>
        <option value="last7D">Last 7 Days</option>
        <option value="last30D">Last 30 Days</option>
        <option value="thisM">This Month</option>
        <option value="lastM">Last Month</option>
        <option value="thisQ">This Quarter</option>
        <option value="lastQ">Last Quarter</option>
        <option value="YTD">Year to Date (YTD)</option>
        <option value="lastFY">Last Financial Year</option>
      </select></div>
      <div class="cell-2 p-1 show" data-src=".search-more"><button class="bg ac">...</button></div>
      <div class="cell-2 p-1"><button class="bg-sand search-cmd"><i class="fa fa-find"></i></button></div>
    </div>
    <div class="line-m cell-12 search-more hide">
      <div class="p-1 cell-3"><input id="search-ymdFm" placeholder="Fm: 2025-07-21" class="date"></div>
      <div class="p-1 cell-3"><input id="search-ymdTo" placeholder="TO: 2026-07-21" class="date"></div>
      <div class="p-1 cell-3"><input placeholder="123 .. 456" id="search-amt" type="text"></div>
      <div class="p-1 cell-3"><input placeholder="Ref" id="search-rem" type="text"></div>
    </div>
  </div><div class="cell-6 line-m hide search-more">
    <div class="p-1 cell-3"><select id="search-dlen" class="b-grey">
      <option value="" selected>Detail</option>
      <option value="Y">Annually</option>
      <option value="Q">Quarterly</option>
      <option value="M">Monthly</option>
      <option value="W">Weekly</option>
      <option value="D">Daily</option>
    </select></div>
    <div class="p-1 cell-3"><select id="search-clen" class="b-grey">
      <option value="1">L.1 A/C</option>
      <option value="3">L.2 A/C</option>
      <option value="5">L.3 A/C</option>
    </select></div>
    <div class="p-1 cell-2"><input placeholder="INV:" id="search-inv" type="text"></div>
    <div class="p-1 cell-2"><input placeholder="CID:" id="search-cid" type="text"></div>
    <div class="p-1 cell-2"><input placeholder="DUE:" id="search-due" class="date"></div>
    <div class="p-1 cell-3"><select id="search-sort">
      <option value="">Sort</option>
      <option value="amt">Amount</option>
      <option value="id">Last Added</option>
      <option value="his">Oldest</option>
    </select></div>
    <div class="p-1 cell-3"><label><input type="checkbox" id="search-avg" value="1" class="cell-1"> AVG</label></div>
    <n class="cell-6 line-s">
      <div class="p-1 cell-2" title="Bar Chart"><button value="Bar" class="b-red search-cmd"><i class="fa fa-chart-simple"></i></button></div>
      <div class="p-1 cell-2" title="Line Chart"><button value="Line" class="b-green search-cmd"><i class="fa fa-chart-line"></i></button></div>
      <div class="p-1 cell-2" title="Pie Chart"><button value="Pie" class="b-blue search-cmd"><i class="fa fa-chart-pie"></i></button></div>
      <div class="p-1 cell-2" title="Grid"><button value="Grid" class="b-gold search-cmd"><i class="fa fa-table-cells"></i></button></div>
      <div class="p-1 cell-2" title="Download CSV"><button value="CSV" class="b-grey search-cmd"><i class="fa fa-download"></i></button></div>
      <div class="p-1 cell-2" title="Report"><button value="Report" class="b-green search-cmd"><i class="fa fa-list-ul"></i></button></div>
    </n>
  </div>
`));

function isMobile() { return window.matchMedia('(max-width: 673px)').matches; }

e(document).on('click', '.search-cmd', function() {
  searchData = null;
  e('#search-cat2').val('');
  search(e(this).val());
});

e(document).on('click', '.pgnos b.btn', async function(){
  const pgno = e(this).data('pg');
  e('#search-pgno').val(pgno);
  searchDetail(pgno);
})

e(document).on('click', '#search-data n.rem', function(ev){
  const rem = e(this).text();
  const el = e(ev.target);
  if (rem) searchKey({[el.data('k')]: el.text()});
});

e(document).on('click', '#search-data n.cd1', function(){
  const cat3 = e(this).text();
  let cat = e('#search-cat').val();
  let cat2 = e('#search-cat2').val();
  if (!cat && cat2) { cat = cat2; cat2 = ''; }
  if (cat && cat2 && cat != cat2) cat = cat2 = '';
  if (!cat && cat2) cat = cat2;
  cat2 = cat3;
  if (!cat && cat2) cat = cat2;
  e('#search-cat').val(cat);
  e('#search-cat2').val(cat2);
  searchKey({cat, cat2});
});

e(document).on('click', '#search-data n.cd2', function(){
  const cat = e(this).data('cd');
  e('#search-cat').val(cat);
  e('#search-cat2').val('');
  searchKey({cat});
});

e(document).on('click', '#search-data n.ymd', function(){
  const ymd = BSB.fmtYmd(e(this).text());
  searchKey({ymdFm: ymd, ymdTo: ymd});
});

e(document).on('click', '#search-due', function(){
  const due = e(this).val();
  if (due) e(this).val(due.replaceAll('DUE:', ''));
});

e(document).on('click', '#search-data td.ymd-rep', function(){
  const dlen = e('#search-dlen').val();
  const [ymdFm, ymdTo] = BSB.mode2Dates(e(this).text(), dlen);
  e('#search-ymdFm').val(ymdFm);
  e('#search-ymdTo').val(ymdTo);
  if (dlen === 'Y') e('#search-dlen').val('Q');
  else if (dlen === 'Q') e('#search-dlen').val('M');
  else if (dlen === 'M') e('#search-dlen').val('D');
  else { e('#search-dlen').val(''); return search(); }
  search('Report');
});

e(document).on('click', '#search-rep tr:not(:first-child) td:not(:first-child)', function () {
  const el = e(this);
  const i = el.index();
  const cat = el.parents('table').find('tr:first-child').children().eq(i).data('cat');
  const dlen = e('#search-dlen').val();
  const [ymdFm, ymdTo] = BSB.mode2Dates(el.parent().children(':first-child').text(), dlen);
  e('#search-ymdFm').val(ymdFm);
  e('#search-ymdTo').val(ymdTo);
  e('#search-cat').val(cat);
  search();
});

e('#search-fmto').on('change', function(){
  const x = BSB.getDateRange(e(this).val());
  e('#search-ymdFm').val(x.fm);
  e('#search-ymdTo').val(x.to);
});

e('#search-form').on('submit', ev => ev.preventDefault());