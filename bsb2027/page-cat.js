pages.cat = async function () {
  let cat = app.cats;
  cat = Object.entries(cat).sort((a, b) => a[0].localeCompare(b[0]));

  const stat = {};
  for (const row of app.book) {
    BSB.stat(stat, row.c, row.amt);
    BSB.stat(stat, row.d, -row.amt);
  }
  e('#cat-data').html(catHtml(cat, stat));
  catHtmlKids('#page-cat');
};

function catHtml(cat, stat) {
  let html = `<div style="overflow:auto"><table class="hand table" style="white-space:pre"><tr class="b-dark b-0"><th>Category</th>`;
  html += `<th class="ar">${app.acc.ccy}</th>`;
  html += `<th class="ar">Records</th></tr>`;
  for (const [id, name] of cat) {
    html += `<tr class="tree on" tr="${id}"><td class="${id < 1000 ? 'blue' : id < 100000 ? 'gold' : 'grey'}">${' '.repeat(id.length - 1)}${id}   <n>${name}</n></td>`;
    const amt = stat[id]?.[1] ?? 0;
    const num = stat[id]?.[0] ?? 0;
    html += `<td class="ar add-bookc ${amt > 0 ? 'green' : amt ? 'red' : 'grey'}">${amt ? BSB.fmtAmt(amt / 100) : '.'}</td>`;
    html += `<td class="ar" data-id="${id}" data-name="${name}">${num || '.'}</td></tr>`;
  }
  return html + `</table></div>`;
}

e(document).on('click', '.add-bookc', function(){
  const cat = e(this).parent().attr('tr');
  let d, c;
  if (BSB.isInc(cat)) c = cat;
  else d = cat;
  addBookNew(d, c);
});
e(document).on('click', '.add-book2', function(){
  const d = e(this).parent().children(':first-child').next();
  addBookNew(d.text(), d.next().next().text());
});
e(document).on('click', '.add-book2-mob', function(){
  const d = e(this).parents('tr').children(':first-child').children(':first-child').next().next();
  addBookNew(d.text(), d.next().next().next().text());
});

function addBookNew(d, c) {
  addBookReset();
  e('.page').addClass('hide');
  e('#page-add').removeClass('hide');
  if (d) e('#debitBox .cat-select')[0].slim.setSelected(d);
  if (c) e('#creditBox .cat-select')[0].slim.setSelected(c);
  e('#add-title').text('Add a transaction');

  addHistory({d: d || c, c: c || d});
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function catHtmlKids(root) {
  const scope = root ? e(root) : e(document);
  scope.find('tr.tree[tr]').each(function () {
    const tr = e(this).attr('tr');
    if (!tr || tr.length <= 2) return;
    const p = tr.slice(0, -2);
    scope.find('tr.tree[tr="' + p + '"] td').first().addClass('b');
  });
}

e(document).on('click', 'tr.tree > td:first-child n', function(){
  const cat = e(this).parents('tr').attr('tr');
  e('#page-search').removeClass('hide');
  e('#page-cat').addClass('hide');
  e('#page-dashboard').addClass('hide');
  e('#search-cat').val(cat);
  searchKey({cat, cat2:''});
});

e('#cat-form').html(faIcons(`
  <n class="fr">
    <b class="btn bg-blue export-file" data-file="cat" title="Export categories to a local backup for later import"><i class="fa fa-download"></i><n class="hide-s"> Export</n></b>
    <b class="btn bg-gold show" data-src="#cat-bulk" title="Import categories from a local backup or sample data"><i class="fa fa-upload"></i><n class="hide-s"> Import</n></b>
    <b id="cat-add" class="btn bg-sand" title="Add a new category"><i class="fa fa-plus"></i><n class="hide-s"> Add</n></b>
  </n>
  <h2 class="gold pt-2"><i class="fa fa-folder"></i> Category</h2>
  <p class="clear"><hr>
    <n class="b-green badge ib"><i class="fa fa-find"></i> Search → Category</n>
    <n class="b-green badge ib"><i class="fa fa-plus"></i> Add → Amount</n>
    <n class="b-green badge ib"><i class="fa fa-pen"></i> Edit → Records</n>
  </p>
  <div id="cat-edit" class="hide pop"><div style="max-width:100%;width:600px"><div class="tab bg-sand">Account Category</div><div class="box bg line-s">
    <p class="cell-12 ac">ID can only be 1, 3, 5, 7 or 9 digits.</p>
    <input type="number" min="1" step="1" id="cat-id" class="cell-4" placeholder="ID">
    <input type="text" id="cat-name" class="cell-8" autocomplete="off" placeholder="Name">
    <hr class="cell-12">
    <p class="cell-12"><button id="cat-save" class="cell-4 bg-sand mr-1">Save</button>
    <button id="cat-del" class="hide cell-4 bg-red mr-1">Delete</button>
    <div id="cat-help" class="cell-12 hide">
      <p class="b-gold rc">⚠️ Changing a category ID may be irreversible</p>
      If the new ID already has records, those records will be merged with the old ID and cannot be separated again.
      <br>eg changing 30233 → 303 will merge records from both categories. If 303 has no records, the change can be reversed.
    </div>
  </div></div></div>
  <div id="cat-bulk" class="hide pop"><div style="max-width:100%;width:600px"><div class="tab bg-gold">Import sample or a local backup</div><div class="box bg">
    <p id="cat-sample"><b class="btn bg-gold">Blogger</b>
      <b class="btn bg">Handyman</b>
      <b class="btn bg">Personal</b>
      <b class="btn bg">Retail</b>
      <b class="btn bg">Solo</b>
    </p>
    <div>
      <textarea class="on">Content Creator: YouTubers, streamers, bloggers
-----------------------------------------------

1 Assets
100 Cash
101 Bank Accounts
10101 CBA
10102 HSBC
102 Camera/Equipment
103 Software Licenses

2 Liabilities
200 Credit Card Payable
201 Subscriptions Payable

3 Equity
300 Creator Capital

4 Revenue
400 Ad Revenue
401 Sponsorship Income
402 Affiliate Commissions
403 Merchandise Sales
404 Donations / Tips

5 Expenses
500 Equipment & Gear
501 Internet Services
502 Editing Software
503 Music Licenses
504 Freelance Support (editors, VAs)
505 Social Media Ads
506 Travel for Content</textarea>
      <textarea class="hide">Plumber, Agency, Tutor, service, agency
---------------------------------------

1 Assets
100 Cash on Hand
101 Bank Accounts
10101 CBA
10103 NAB
102 Accounts Receivable
103 Tools or Equipment

2 Liabilities
200 Accounts Payable
201 Tax Payable
202 Advance from Clients

3 Equity
300 Owner's Capital
301 Owner's Drawings

4 Revenue
400 Service Revenue
401 Consultation Fees
402 Subscription Revenue

5 Expenses
500 Labor Costs
501 Equipment Maintenance
502 Advertising
503 Office Expenses
504 Travel
505 Website Hosting
506 Bank Charges</textarea>
      <textarea class="hide">Personal / Individual User Chart of Accounts
--------------------------------------------

1 Assets
100 Cash on Hand
101 Bank – Checking
10101 CBA
10102 HSBC
102 Bank – Savings
103 E-Wallets (e.g., PayPal, Wise)
104 Investments – Stocks
105 Investments – Crypto
106 Property – Real Estate
107 Loan to Friends / Family

2 Liabilities
200 Credit Card Debt
201 Mortgage Loan
202 Student Loan
203 Car Loan
204 Utility Bills Payable
205 Rent Due
206 Taxes Payable

3 Equity
300 Net Worth – Start of Year
301 Annual Net Income
302 Unrealized Gains/Losses

4 Income
400 Salary Income
401 Bonus / Commission
402 Rental Income
403 Dividends
404 Interest Income
405 Freelance / Side Job Income
406 Gift or Inheritance Received

5 Expenses
500 Rent / Mortgage
501 Utilities (Water, Gas, Electricity)
502 Groceries
503 Eating Out / Delivery
504 Transportation (Gas, Ride-share)
505 Insurance (Health, Auto, Home)
506 Mobile & Internet
507 Subscriptions (Netflix, Spotify, etc.)
508 Education / Courses
509 Travel & Vacation
510 Medical / Health Expenses
511 Donations & Charity
512 Gifts Given
513 Shopping & Clothing
514 Childcare / School Fees
515 Credit Card Interest & Fees
516 Investment Fees & Charges</textarea>
      <textarea class="hide">Retail Business, Shops, stores, sellers
---------------------------------------

1 Assets
100 Cash
101 Bank Accounts
10101 CBA
10102 HSBC
102 Accounts Receivable
103 Inventory
104 POS Equipment

2 Liabilities
200 Accounts Payable
201 Sales Tax Payable
202 Short-term Loans

3 Equity
300 Owner's Capital
301 Retained Earnings

4 Revenue
400 Product Sales
401 Discounts Given
402 Shipping Income

5 Expenses
500 Cost of Goods Sold
501 Rent
502 Utilities
503 Inventory Purchases
504 Staff Wages
505 Credit Card Fees
506 Packaging
507 Marketing & Promotions</textarea>
      <textarea class="hide">Freelancers / Solo Entrepreneurs
--------------------------------

1 Assets
100 Cash
101 Bank Account
10101 CBA
10102 HSBC
102 Accounts Receivable
103 Equipment
104 Prepaid Expenses

2 Liabilities
200 Accounts Payable
201 Credit Card Payable
202 Taxes Payable

3 Equity
300 Owner's Capital
301 Owner's Draw

4 Revenue
400 Freelance Income
401 Reimbursed Expenses

5 Expenses
500 Software Subscriptions
501 Internet and Phone
502 Office Supplies
503 Advertising / Marketing
504 Travel & Meals
505 Education & Training
506 Bank & Payment Fees</textarea>
    </div>
    <hr class="cell-12">
    <p class="cell-12">
      <button id="cat-bulk-save" class="cell-5 bg-gold mr-1">Import above</button>
      <button class="cell-5 bg-red import-file show" data-src="#cat-bulk" data-file="cat">Load backup</button>
    </p>
  </div></div></div>
  <style>#cat-bulk textarea{width:100%;height:200px}</style>
`));

e('#cat-sample b').on('click', function () {
  const btn = e(this);
  const idx = btn.index();
  btn.parent().children('b').removeClass('bg-gold').addClass('bg');
  btn.removeClass('bg').addClass('bg-gold');
  const texts = btn.parent().next().children('textarea');
  texts.addClass('hide').removeClass('on');
  texts.eq(idx).removeClass('hide').addClass('on');
});

e('#cat-bulk-save').on('click', async function(){
  e('#cat-bulk').addClass('hide');
  const texts = e('#cat-bulk textarea.on').val();
  const cats = texts.split('\n')
    .map(line => line.trim().match(/^(\d+)\s*(?:,\s*|\s+)(.+)$/))
    .filter(Boolean)
    .map(m => [Number(m[1]), m[2].trim()]);
  const store = await getStore('cat', 'readwrite');
  for (const [id, name] of cats) store.put(name, id);
  alert('Bulk Category Uploaded - Please refresh page');
});

e('#cat-add').on('click', function(){
  e('#cat-edit').removeClass('hide');
  e('#cat-del').addClass('hide');
  e('#cat-help').addClass('hide');
  e('#cat-id').val('').data('id', '');
  e('#cat-name').val('');
});

e(document).on('click', '#cat-data table tr td:last-child', function(){
  e('#cat-edit').removeClass('hide');
  e('#cat-help').removeClass('hide');
  let el = e(this);
  let id = el.data('id');
  e('#cat-id').val(id).data('id', id);
  e('#cat-name').val(el.data('name'));
  if (el.text() === '.') e('#cat-del').removeClass('hide'); else e('#cat-del').addClass('hide');
});

e('#cat-del').on('click', function(){
  const id = e('#cat-id').data('id');
  const hasKids = Object.keys(app.cats).some(key => key.startsWith(id) && key != id);
  if (hasKids) alert('Error: can not delete this cat due to it has sub-cats');
  else {
    delete app.cats[id];
    e('tr[tr="'+ id +'"]').addClass('hide');
    e('#cat-edit').addClass('hide');
    setDB('cat', Number(id), 'DELETE');
    alert(`CAT #${id} deleted. You need click export to save to your local csv.`);
  }
});

e('#cat-save').on('click', function(){
  const id = e('#cat-id').data('id');
  let cat = e('#cat-id').val().trim();
  const name = e('#cat-name').val().trim();
  const regex = /^[1-9](\d{2}|\d{4}|\d{6})?$/;
  if (!regex.test(cat)) return alert('ID must be 1, 3, 5, 7 digits');
  if (id != cat && app.cats[cat]) return alert('ID already used');
  if (!name) return alert('Please input cat name');

  cur = String(cat);
  while (cur.length > 1) {
    cur = cur.slice(0, cur.length - 2);
    if (!app.cats[cur]) return alert(`Parent ID ${cur} not created yet`);
  }

  if (id && id != cat) catRename(id, cat);
  app.cats[cat] = name;
  setDB('cat', cat, name);
  e('#cat-edit').addClass('hide');
  location.reload();
});

async function catRename(oldId, newId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const oldPrefix = String(oldId);
    const newPrefix = String(newId);

    const tx = db.transaction(['cat', 'book'], 'readwrite');
    const len = oldPrefix.length;

    const cats = tx.objectStore('cat');
    cats.openCursor().onsuccess = ev => {
      const cursor = ev.target.result;
      if (!cursor) return;

      const key = String(cursor.key);
      if (key.startsWith(oldPrefix)) {
        cats.put(cursor.value, Number(newPrefix + key.slice(len)));
        cursor.delete();
      }
      cursor.continue();
    };

    tx.objectStore('book').openCursor().onsuccess = ev => {
      const cursor = ev.target.result;
      if (!cursor) return;

      const book = cursor.value;
      let changed = false;

      if (book.c && book.c.startsWith(oldPrefix)) {
        book.c = Number(newPrefix + book.c.slice(len));
        changed = true;
      }
      if (book.d && book.d.startsWith(oldPrefix)) {
        book.d = Number(newPrefix + book.d.slice(len));
        changed = true;
      }

      if (changed) cursor.update(book);
      cursor.continue();
    };

    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}