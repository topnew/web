pages.setting = async function() {
  settingForm();
}

async function settingForm() {
  const acc = await getDB('acc');
  let html = `
  <n class="fr">
    <b class="btn bg-blue export-file" data-file="acc" title="Export account settings to a local backup for later import"><i class="fa fa-download"></i><n class="hide-s"> Export</n></b>
    <b class="btn bg-gold import-file" data-file="acc" title="Import account settings from a local backup"><i class="fa fa-upload"></i><n class="hide-s"> Import</n></b>
  </n>
  <h2 class="gold pt-2"><i class="fa fa-gear"></i><n class="hide-s"> Account</n> Settings</h2>
  <hr>
  <div class="line-m" style="max-width:674px">
    <b class="cell-4 py-2">Account ID</b>
    <div class="cell-8 line-s">
      <input class="cell-3 red" id="setting-aid" value="${app.aid}" type="number" min="1" step="1">
      <n class="cell-9 py-2 pl-2">Change ID will open a new A/C</n>
    </div>
    <b class="cell-4 py-2">Account Name</b>
    <input class="cell-8" type="text" value="${acc.name ?? ''}" id="setting-name">
    <b class="cell-4 py-2">Account Code</b>
    <input class="cell-8" type="text" value="${acc.code ?? ''}" id="setting-code">
    <b class="cell-4 py-2">Language</b>
    <select class="cell-8" id="setting-lang"></select>
    <b class="cell-4 py-2">Currency</b>
    <div class="cell-8" id="setting-ccy"></div>
    <b class="cell-4 py-2">Fiscal Month</b>
    <select class="cell-8" id="setting-finMon"></select>
    <b class="cell-4"></b>
    <label class="cell-8"><input type="checkbox" id="setting-incPos"${acc.incPos ? ' checked' : ''}> Show Income as positive in reporting</label>
    <b class="cell-4 py-2">Cat Income</b>
    <div class="cell-8" id="setting-catInc"></div>
    <b class="cell-4 py-2">Cat Expense</b>
    <div class="cell-8" id="setting-catExp"></div>
    <b class="cell-4 py-2">Cat GST</b>
    <div class="cell-8" id="setting-catGst"></div>
    <b class="cell-4 py-2">GST Rate %</b>
    <input class="cell-8" id="setting-gstRate" value="${acc.gstRate ?? 10}">
    <b class="cell-4"></b>
    <b class="cell-4 btn bg-gold my-2" id="setting-save"><div style="margin-top:-12px">Save</div></b>
  </div>
  <br><hr><h3>Has problem, want to reset DB?</h3>
  <p>Please download all your files before clicking on the following DB to reset.</p><p>
  `;
  const aids = BSB.getAids();
  for (const com of aids) html += `<b class="btn b-red resetDB" data-aid="${com.aid}">${com.aid} - ${com.name || com.code}</b> `;
  e('#page-setting').html(faIcons(html +'</p>'));

  html = '';
  ['AUD','CAD','CNY','EUR','GBP','HKD','JPY','NZD','SGD','USD'].forEach(ccy => {
    html += `<label style="width:80px"><input type="radio" name="ccy" value="${ccy}"${app.acc.ccy === ccy ? ' checked' : ''}>${ccy}</label>`;
  });
  e('#setting-ccy').html(html);

  const months = {1:'JAN', 2:'FEB', 3:'MAR', 4:'APR', 5:'MAY', 6:'JUN', 7:'JUL', 8:'AUG', 9:'SEP', 10:'OCT', 11:'NOV', 12:'DEC'};
  let options = Object.entries(months)
    .map(([m, label]) => `<option value="${m}"${acc.finMon === Number(m) ? ' selected' : ''}>${label}</option>`)
    .join('');
  e('#setting-finMon').html(options);

  settingCatBox('#setting-catInc', acc.catInc ?? []);
  settingCatBox('#setting-catExp', acc.catExp ?? []);
  settingCatBox('#setting-catGst', acc.catGst ?? []);
}

function settingCatBox(el, selected) {
  const options = Object.entries(app.cats)
    .filter(([id]) => Number(id) < 10)
    .map(([id, name]) => `<label class="mr-2"><input type="checkbox" value="${id}"${selected.includes(Number(id)) ? 'checked' : ''}>${name}</label>`)
    .join('');
  e(el).html(options);
}

e(document).on('click', '.resetDB', async function(){
  const aid = e(this).data('aid');
  if (confirm(`Are you sure to reset DB of A/C *** ${aid} *** ?\nHave you downloaed all the files yet?\n\nAll your data in DB will be deleted.`)) {
    await resetDB(aid);
  }
})

e(document).on('click', '#setting-save', async function(){
  const aid = Number(e('#setting-aid').val());
  const name = e('#setting-name').val();
  const code = e('#setting-code').val();
  if (aid && aid != app.aid) {
    app.aid = aid;
    db = await openDB(); // refresh DB
    localStorage.setItem('aid', aid); // refresh cur aid
  }

  BSB.saveAid(aid, name, code);
  await setDB('acc', 'name', name);
  await setDB('acc', 'code', code);
  await setDB('acc', 'finMon', Number(e('#setting-finMon').val()));
  await setDB('acc', 'gstRate', Number(e('#setting-gstRate').val()));
  const incPos = e('#setting-incPos').is(':checked') ? 1 : 0;
  await setDB('acc', 'incPos', incPos);

  const ccy = e('#setting-ccy input[type="radio"]:checked')?.val();
  setDB('acc', 'ccy', ccy);

  ['Inc', 'Exp', 'Gst'].forEach(type => {
    const cat = Array.from(
      e(`#setting-cat${type} input[type="checkbox"]:checked`)
    ).map(el => Number(el.value));
    setDB('acc', `cat${type}`, cat);
  });

  location.reload();
})