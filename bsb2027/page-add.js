pages.add = function() {
  addBookReset();
  e('#add-title').text('Add a transaction');
  addHistory();
}

e('#add-form').html(faIcons(`<h2 class="cell-12 red" id="add-title">Add a transaction</h2>
  <pre id="add-msg" class="rc b-green hide cell-12"></pre>
  <div class="cell-6 line-s b-green bb-0">
    <input value="${BSB.fmtYmd()}" id="add-ymd" class="cell-12 m-1 date">
  </div><div class="cell-6 b-gold bb-0 line-s">
    <input placeholder="Remark" id="add-REM" class="cell-12 m-1" type="text">
  </div><div class="cell-6"><div class="line-s b-green" id="debitBox">
    <h3 class="cell-12 m-2">A/C To: (Debit)</h3>
    <select class="cell-12 cat-select m-1"></select>
    <div class="cell-12 line-s">
      <b class="m-2 pt-1 add-line"><i class="fa fa-plus"></i></b>
      <input placeholder="QTY" class="qty cell ar m-1" type="number">
      <input step="0.01" placeholder="158.66"class="amt cell-6 ar m-1" type="number">
    </div>
  </div></div><div class="cell-6"><div class="line-s b-gold" id="creditBox">
    <h3 class="cell-12 m-2">A/C From: (Credit)</h3>
    <select class="cell-12 cat-select m-1"></select>
    <div class="cell-12 line-s">
      <b class="m-2 pt-1 add-line"><i class="fa fa-plus"></i></b>
      <input placeholder="QTY" class="qty cell ar m-1" type="number">
      <input step="0.01" placeholder="158.66" class="amt cell-6 ar m-1" type="number">
    </div>
  </div></div><div class="cell-6 line-s b-green bt-0">
    <input placeholder="DUE:" id="add-DUE" class="cell-6 m-1 date">
    <input placeholder="RATE: 5%" id="add-RATE" class="cell-6 m-1" type="text"></div><div class="cell-6 line-s b-gold bt-0">
    <input placeholder="INV:" id="add-INV" class="cell-6 m-1" type="text">
    <input placeholder="CID:" id="add-CID" class="cell-6 m-1" type="text">
  </div><div class="cell-6 line-s"></div><div class="cell-6 line-s">
    <div class="cell-6 p-1">
      <input class="bg-green hide" type="button" id="add-cmd-copy" value="Copy">
      <input class="b-green import-file" data-file="book" type="button" id="add-cmd-imp" value="CSV Import">
    </div><div class="cell-4 p-1 hide">
      <input type="button" class="bg-red" value="Delete" id="add-cmd-del">
    </div><div class="cell-6 p-1">
      <input type="button" class="bg-sand" value="Update" id="add-cmd-save">
    </div>
  </div>
  <input value="0" id="add-id" type="hidden">
`));

e(document).on('click', '#add-form b.add-line', function(){
  const p = e(this).parent();

  const isDebit = p.parent().is('#debitBox');
  const otherSide = e(isDebit ? '#creditBox' : '#debitBox').find('select').length;
  if (otherSide > 1) return alert('We are not allowed to add many credit - many debit');

  addLine(p);
  updateReadonlyState();
});

e(document).on('click', '#add-form b.del-line', function() {
  const p = e(this).parent();
  const pp = p.parent();
  p.prev().prev().remove(); // del select
  p.prev().remove(); // del slim
  p.remove();
  updateReadonlyState();
  updateTotalAmt(pp);
});

e(document).on('change', '#add-form input.amt', function () {
  const val = parseFloat(e(this).val());
  e(this).val(isNaN(val) ? '' : val.toFixed(2));
  updateTotalAmt(e(this).parent().parent());
});

e(document).on('click', '#add-cmd-copy', function(){
  const id = e('#add-id').val();
  if (!id || e(this).val() !== 'Copy') return;
  e(this).val('Copied').removeClass('b-green bg-green').addClass('bg-gold');
  const ymd = e('#add-id').data('ymd');
  e('#add-title').html(`Copied from # <n class="add-book hand green" data-id="${id}" data-ymd="${ymd}">${id}</n>`);
  e('#add-cmd-save').val('Add').parent();
  e('#add-id').val(0);
  hideDelete();
});

e(document).on('click', '#add-cmd-del', async function(){
  if (!confirm('Are you sure to delete this record?')) return;

  const id = e('#add-id').val();
  const ymd = e('#add-id').data('ymd');
  await deleteBookById(Number(id), String(ymd));
  e('#add-title').html(`Deleted # ${id}`);
  e('#add-cmd-save').val('Undo').addClass('b-red').removeClass('bg-sand');
  e('#add-cmd-copy').val('Deleted');
  hideDelete();
  app.book = await getBook();
});

e(document).on('click', '#add-cmd-save', async function(){
  let id = Number(e('#add-id').val());
  const ymd = String(e('#add-id').data('ymd'));
  const lines = getFormLines(id);
  if (id) await deleteBookById(id, ymd);
  if (!lines?.length) return;

  for (const line of lines) {
    line.id = id;
    id = await addBookSave(line);
  }

  e('#add-title').html(`Saved # ${id}`);
  e('#add-cmd-copy').removeClass('hide bg-gold').val('Copy').addClass('bg-green');
  e('#add-cmd-imp').addClass('hide');
  e('#add-cmd-save').val('Saved').removeClass('b-red').addClass('bg-sand');
  e('#add-id').val(id).data('ymd', lines[0]?.ymd);
  showDelete();
  app.book = await getBook(); // refresh cache
  addHistory(lines[0]);
});

function loadBookRem(rem) {
  let remObj = null;
  try {
    remObj = JSON.parse(rem);
  } catch {
    remObj = {REM: rem};
  }
  for (const key of ['INV', 'DUE', 'CID', 'RATE']) {
    if (remObj[key]) {
      e('#add-'+ key).val(key + ': ' + remObj[key]);
      delete remObj[key];
    }
  }

  const keys = Object.keys(remObj);
  if (keys.length === 1 && keys[0] === 'REM') {
    e('#add-REM').val(remObj.REM);
  } else {
    e('#add-REM').val(keys.length ? JSON.stringify(remObj) : '');
  }
}

function buildBookRem() {
  const remObj = {};
  for (const key of ['INV', 'DUE', 'CID', 'RATE']) {
    let value = e('#add-' + key).val()?.trim();
    if (value) {
      // Remove prefix like "INV: ", "CID: ", etc.
      value = value.replace(new RegExp('^' + key + '\\s*:\\s*', 'i'), '');
      if (value) remObj[key] = value;
    }
  }

  const rem = e('#add-REM').val()?.trim();
  if (rem) {
    // REM may itself contain JSON from loadBookRem()
    try {
      const extra = JSON.parse(rem);
      if (extra && typeof extra === 'object' && !Array.isArray(extra)) {
        Object.assign(remObj, extra);
      } else {
        remObj.REM = rem;
      }
    } catch {
      remObj.REM = rem;
    }
  }

  const keys = Object.keys(remObj);
  // Only REM -> save plain string
  if (keys.length === 1 && keys[0] === 'REM') return remObj.REM;

  // Anything else -> save JSON
  return keys.length ? JSON.stringify(remObj) : '';
}

function showDelete() {
  e('#add-cmd-del').parent().removeClass('hide');
  e('#add-cmd-save,#add-cmd-copy').parent().removeClass('cell-6').addClass('cell-4');
}
function hideDelete() {
  e('#add-cmd-del').parent().addClass('hide');
  e('#add-cmd-save,#add-cmd-copy').parent().removeClass('cell-4').addClass('cell-6');
}
function addBookReset() {
  e('#add-cmd-copy').addClass('hide').val('Copy').addClass('bg-green').removeClass('bg-gold');
  hideDelete()
  e('#add-cmd-imp').removeClass('hide');
  e('#add-cmd-save').val('Add').removeClass('b-red').addClass('bg-sand');
  e('#debitBox > *:nth-child(n+5)').remove();
  e('#creditBox > *:nth-child(n+5)').remove();
  e('#add-form')[0].reset();
  e('#add-id').val(0);
  e('#debitBox .ss-single').text(e('.cat-select option:first-child').text());
  e('#creditBox .ss-single').text(e('.cat-select option:first-child').text());
  updateReadonlyState();
}

function addLine(p, val) {
  const pClone = p.clone();
  pClone.find('b.add-line').removeClass('add-line').addClass('del-line').html(faIcons('<i class="fa fa-trash"></i>'));
  pClone.find('input.qty').val(val?.qty ?? '');
  pClone.find('input.amt').val(BSB.round(val?.amt, true));

  const prevClone = p.prev().prev().clone();
  prevClone.removeAttr('style').removeAttr('data-id').removeAttr('tabindex').removeAttr('aria-hidden');
  prevClone.val(val?.cat ?? '');

  const parent = p.els[0].parentElement;
  const lastChild = parent.lastElementChild;
  const x = lastChild === p.els[0] ? p : new E(lastChild);
  x.after(pClone).after(prevClone);
  new SlimSelect({ select: prevClone[0] });
}

function updateReadonlyState() {
  const creditCat = e('#creditBox').find('select').length;
  let debitCat = e('#debitBox').find('select').length;
  if (creditCat > 1) e('#debitBox input').attr('readonly', true);
  else e('#creditBox input').removeAttr('readonly');
  if (debitCat > 1) e('#creditBox input').attr('readonly', true);
  else if (creditCat < 2) e('#debitBox input').removeAttr('readonly');
}

function updateTotalAmt(pp) {
  let total = 0;
  pp.find('input.amt').each(function () {
    const val = e(this).val().replace(/[^0-9.-]/g, ''); // Remove commas and symbols
    const num = parseFloat(val);
    if (!isNaN(num)) total += num;
  });

  const isDebit = pp.is('#debitBox');
  const otherSide = e(isDebit ? '#creditBox' : '#debitBox').find('input.amt');
  otherSide.val(BSB.round(total));
}

e(document).on('click', '.add-book', async function(){
  showPage('add');
  addBookReset();
  const id = e(this).data('id');
  const ymd = e(this).data('ymd');
  if (!id || !ymd) return;

  const lines = await getBookById(Number(id), String(ymd));
  let catC = 0;
  let catD = 0;
  const pD = e('#debitBox .add-line').parent();
  const pC = e('#creditBox .add-line').parent();
  let pp = '';
  for (const [i, line] of lines.entries()) {
    if (i === 0) {
      loadBookRem(line.rem);
      const ymd = `${line.ymd.slice(0, 4)}-${line.ymd.slice(4, 6)}-${line.ymd.slice(6, 8)}`;
      e('#add-ymd').val(ymd);
      e('#add-form .qty').val(line.qty || '');
      e('#add-form .amt').val(BSB.round(line.amt, true));
      catC = line.c;
      catD = line.d;
      e('#creditBox .cat-select')[0].slim.setSelected(catC);
      e('#debitBox .cat-select')[0].slim.setSelected(catD);
      continue;
    }

    if (line.c != catC) {
      line.cat = line.c;
      addLine(pC, line);
      pp = '#creditBox';
    } else {
      line.cat = line.d;
      addLine(pD, line);
      pp = '#debitBox';
    }
  }

  e('#add-cmd-copy').removeClass('hide');
  showDelete()
  e('#add-cmd-imp').addClass('hide');
  e('#add-cmd-save').val('Update');
  e('#add-id').val(id).data('ymd', ymd);
  updateReadonlyState();
  if (pp) updateTotalAmt(e(pp));
  e('#add-title').text('Transaction # ' + id);
  await addHistory(lines[0]);
  window.scrollTo({ top: 0, behavior: 'smooth' });
})

async function addBookSave(line) {
  const store = await getStore('book', 'readwrite');
  line.id = Number(line.id) || 0;
  return new Promise((resolve, reject) => {
    const req = store.add(line);
    req.onsuccess = () => {
      if (line.id) return resolve(line.id);
      const id = req.result;
      line.id = id;
      const putReq = store.put(line, id);
      putReq.onsuccess = () => resolve(id);
      putReq.onerror = () => reject(putReq.error);
    };
    req.onerror = () => reject(req.error);
  });
}

async function getBookById(id, ymd) {
  const store = await getStore('book', 'readonly');
  const index = store.index('ymd');
  return new Promise((resolve, reject) => {
    const req = index.getAll([ymd, id]);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function deleteBookById(id, ymd) {
  const store = await getStore('book', 'readwrite');
  const index = store.index('ymd');
  return new Promise((resolve, reject) => {
    const req = index.openCursor(IDBKeyRange.only([String(ymd), Number(id)]));
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return resolve();
      cursor.delete();
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  });
}

function getFormLines(id) {
  const box = e('#debitBox select.cat-select').length > 1 ? '#debitBox' : '#creditBox';
  const cat2 = e(box === '#debitBox' ? '#creditBox select.cat-select' : '#debitBox select.cat-select').val() ?? '';

  const cats = e(box + ' select.cat-select');
  const qtys = e(box + ' .qty');
  const amts = e(box + ' .amt');
  const ymd = e('#add-ymd').val().replaceAll('-', '');
  const rem = buildBookRem();
  const lines = [];

  for (let i = 0; i < amts.length; i++) {
    let amt = Math.round(
      (Number(String(amts[i].value).replace(/,/g, '')) || 0) * 100
    );
    if (!amt) continue;

    let c, d;
    const cat = cats[i].value ?? '';
    if (box === '#debitBox') {
      d = cat; c = cat2;
    } else {
      c = cat; d = cat2;
    }
    if (!c || !d || c == d) continue;

    const qty = Number(qtys[i].value || 0);
    if (amt < 0) {
      amt = -amt;
      [d, c] = [c, d];
    }

    lines.push({ymd, id, d, c, amt, qty, rem});
  }

  return lines;
}

async function addHistory(line) {
  const d = line?.d ?? '';
  const c = line?.c ?? '';
  const cat = d && BSB.isExp(d) ? d : c;

  e('#search-form')[0].reset();
  searchKey({cat, cat2: cat, sort: cat ? 'his' : 'id', pgno: cat ? 1 : 0});
  e('#page-search').removeClass('hide');
  e('#search-form').addClass('hide');
  e('#page-add').removeClass('hide');
}