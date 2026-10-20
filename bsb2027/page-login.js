pages.login = async function() {
  if (localStorage.getItem('login')) return showPage('dashboard');

  const passHash = localStorage.getItem('pass');
  e('#login-msg').html(passHash ? 'Enter your password to unlock the app.' : '<b>New user?</b> Create a password to protect your data.');
}

pages.logout = function() {
  e('#head').addClass('hide');
  localStorage.removeItem('login');
  showPage('login');
}

async function login() {
  const pass = e('#password').val();
  const passHash = localStorage.getItem('pass')
  const hash = await sha256(pass);
  if (!passHash) localStorage.setItem('pass', pass ? hash : '');
  else if (hash !== passHash) return alert('Incorrect password');
  localStorage.setItem('login', 1);

  const aids = BSB.getAids();
  localStorage.setItem('aids', JSON.stringify(aids));
  let aid = localStorage.getItem('aid');
  if (!aid || !aids.some(x => x.aid === aid)) {
    aid = aids[0]?.aid;
    localStorage.setItem('aid', aid);
  }
  initApp();
  showPage('dashboard');
}

e(document).on('click', '.com-list > div', function(){
  const aid = e(this).data('aid');
  localStorage.setItem('aid', aid);
  location.reload();
});
e('#head').html(faIcons(`
  <n page="dashboard" id="logo"><img src="app.png"><b>BSB</b></n>
  <m id="company" class="green"></m>
  <nav>
    <n page="add"><i class="fa fa-plus"></i><b>Add</b></n>
    <n page="search"><i class="fa fa-find"></i><b>Search</b></n>
    <n page="cat"><i class="fa fa-folder"></i><b class="x2">Category</b></n>
    <!--n page="export"><i class="fa fa-download"></i><b class="x2">Export</b></n-->
    <n page="setting"><i class="fa fa-gear"></i><b class="x1">Setting</b></n>
    <n page="logout"><i class="fa fa-logout"></i><b class="x1">Exit</b></n>
  </nav>
  <div id="com-list-pop" class="hide pop"><div style="max-width:500px;width:100%;min-width:300px"><div class="tab bg-sand">BSB Accounts</div><div class="box bg">
  </div></div></div>
`));

e('#page-login').html(`
  <img src="app.png" class="fl mr-4">
  <h1 class="pt-3">BSB Accounting</h1>
  <p id="login-msg" class="pt-4"></p>
  <form onsubmit="login(); return false;">
    <p><input id="password" type="password"></p>
    <p><button type="submit" class="cell-6 bg-gold">Unlock</button></p>
  </form>
  <br><hr>
  <h3>Important – Your Data</h3>
  <p>Your data is saved <b>locally in this browser on this device</b>.</p>
  <ul>
    <li><b>Download a backup regularly</b> to prevent data loss.</li>
    <li>Clearing browser data, changing browser/device, or moving the app folder may cause your data to be lost.</li>
    <li>Keep your device secure. Anyone with access to it may also access app data.</li>
  </ul>
  <p><b>You are responsible for keeping your data and backups safe.</b></p>
  <p><b>Sample Category CSV</b><br><n class="b-green">cat,name</n><br>1,Income<br>101,Salary</p>
  <p><b>Sample Transaction CSV</b> (amt in cents)<br><n class="b-green">ymd,id,d,c,amt,qty,rem</n><br>20270123,1,101,203,50067,0,Some notes</p>
`);