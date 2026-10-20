pages.export = async function() {}

e(document).on('click', '.export-file', function(){
  exportFile(e(this).data('file'));
});
e(document).on('click', '.import-file', function(){
  const file = e(this).data('file');
  if (file === 'book' && !confirm('Are you sure to import CSV?\n\nCSV data will be added to existing transaction.')) return;
  e('#import-file').data('file', file)[0].click();
})

async function exportFile(file, data, form) {
  if (['acc', 'cat', 'book'].includes(file)) data = await getDB(file);
  else {
    // Add category names for CSV download
    data.forEach(line => {
      line.debit = app.cats[line.d] ?? '';
      line.credit = app.cats[line.c] ?? '';
    });
  }

  if (file === 'cat') {
    data = Object.entries(data).sort((a, b) => a[0].localeCompare(b[0])).map(([key, val]) => ({ cat: key, name: val }));
  } else if (file === 'book') {
    data = Object.values(data).sort((a, b) => a.ymd - b.ymd || a.id - b.id);
  }

  let filename = `BSB${app.aid}-${file.toUpperCase()}-${BSB.fmtYmd().replaceAll('-', '')}`;
  if (file === 'book' && form) {
    if (form.cat) filename += `_CAT${form.cat}`;
    if (form.ymdFm) filename += `_FM${form.ymdFm}`;
    if (form.ymdTo) filename += `_TO${form.ymdTo}`;
  }
  if (file === 'acc') {
    let json = JSON.stringify(data, null, 2);
    json = json.replace(/\[\s*([\s\S]*?)\s*\]/g, (match, contents) => {
      if (contents.includes('{') || contents.includes('[')) return match;
      // Flatten simple arrays onto a single line
      const singleLine = contents.split('\n').map(s => s.trim()).join(' ');
      return `[${singleLine}]`;
    });
    downloadFile(filename, json, '.json');
  } else {
    const rows = Object.values(data);
    const headers = Object.keys(rows[0]);
    let csv = headers.join(',') + '\n';
    csv += rows.map(row => headers.map(header => {
      let val = row[header];
      let str = val !== undefined && val !== null ? String(val) : '';
      if (str.includes('"')) str = str.replace(/"/g, '""');
      if (str.includes('\n')) str = str.replace(/\n/g, '\\n');
      return (str.includes(',') || str.includes('\\n') || str.includes('"')) ? `"${str}"` : str;
    }).join(',')).join('\n');
    downloadFile(filename, csv, '.csv');
  }
}

e(document).on('change', '#import-file', async function (el) {
  const file = el.target.files[0];
  if (!file) return;
  let data = await file.text();
  const storeName = e(this).data('file');
  try {
    if (storeName === 'acc') data = JSON.parse(data);
    else data = csvParse(data);
  } catch (err) { return alert('Could not parse file'); }

  const store = await getStore(storeName, 'readwrite');

  await new Promise((resolve, reject) => {
    const tx = store.transaction;
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
    tx.onabort    = () => reject(tx.error);
    if (storeName === 'acc') {
      store.clear();
      for (const [k, v] of Object.entries(data)) {
        store.put(
          k === 'id' ? Number(app.aid) : v,
          Number.isInteger(Number(k)) ? Number(k) : k
        );
      }
    } else if (storeName === 'cat') {
      for (const v of Object.values(data)) store.put(v.name, String(v.cat));
    } else { // book
      const rows = Object.values(data);
      // 1. snapshot current max PK once
      let maxPk = 0;
      const cursorReq = store.openCursor(null, 'prev'); // last record
      cursorReq.onsuccess = (ev) => {
        const cur = ev.target.result;
        maxPk = cur ? cur.key : 0;
        // 2. add every row blindly; track max numeric id
        let maxCsvId = 0;
        let skipped  = 0;
        for (const v of rows) {
          const n = Math.floor(Number(v.id));
          if (Number.isFinite(n) && n > 0) {
            if (n > maxCsvId) maxCsvId = n;
          } else {
            skipped++; // no usable numeric id — still imported
          }
          v.c   = String(v.c);
          v.d   = String(v.d);
          v.ymd = String(v.ymd).replaceAll('-', '');
          store.add(v); // PK auto-assigned
        }
        // 3. one bump at the end, only if CSV ids exceed current max PK
        if (maxCsvId > maxPk) {
          const probe = {};
          const addReq = store.add(probe, maxCsvId);
          addReq.onsuccess = () => store.delete(maxCsvId);
          // if it errors (shouldn't, since maxCsvId > maxPk), just skip the bump
        }
      };
      cursorReq.onerror = () => reject(cursorReq.error);
    }
  });

  const exportNames = { acc: 'Settings', cat: 'Categories', book: 'Transactions' };
  alert(`${exportNames[storeName] ?? ''} imported`);
});

function csvParse(text) {
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length < 2) return []; // Empty file or only header
  const headers = lines[0].split(',');
  return lines.slice(1).map(line => {
    const values = line.match(/(?:^|,)(?:"((?:""|[^"])*)"|([^",]*))/g)?.map(v => v.replace(/^,/, '').replace(/^"|"$/g, '')) || [];
    const obj = {};
    headers.forEach((header, i) => {
      let val = values[i] || '';
      // 1. Clean up wrapping double quotes if they exist (e.g., "x,b" -> x,b)
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      // 2. Unescape doubled-up quotes (e.g., "" -> ")
      val = val.replace(/""/g, '"');
      // 3. Convert literal \\n strings back into real newlines
      if (val.includes('\\n')) val = val.replace(/\\n/g, '\n');
      // 4. Auto-convert numbers, leave strings as strings
      obj[header] = isNaN(val) || val.trim() === '' ? val : Number(val);
    });
    return obj;
  });
}