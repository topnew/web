const app = {};
const pages = {};
let db = null;

async function initApp() {
  e('#head').removeClass('hide');
  app.aid = localStorage.getItem('aid');
  app.acc = await getDB('acc');
  app.cats = await getDB('cat');
  app.book = await getBook();
  if (app.cats) refreshCat();

  const aids = BSB.getAids();
  let html = `<div class="com-list">`;
  for (const com of aids) html += `<div data-aid="${com.aid}">${com.aid} - ${com.name || com.code}</div>`;
  html += '</div>';
  const html1 = `<n class="show" data-src="#com-list-pop">${app.aid} <n class="com-code">${app.acc.code ?? '-'}</n><n class="com-name">${app.acc.name ?? '--'}</n></n>`;
  e('#company').html(html1 + html);
  e('#com-list-pop div.box').html(html);
}

function refreshCat() {
  const cats = Object.entries(app.cats).sort((a, b) => a[0].localeCompare(b[0]));
  const html = cats.map(([id, name]) => `<option value="${id}">${id} - ${name}</option>`).join('');
  e('.cat-select').each(el => {
    const first = el.options?.[0]?.outerHTML || '';
    el.innerHTML = first + html;
    new SlimSelect({ select: el });
  });
}

function showPage(page) {
  page = page in pages ? page : 'login';
  e('.page').addClass('hide');
  e('#page-' + page).removeClass('hide');
  (location.hash !== '#' + page) && (location.hash = page);
  pages[page]();
}

function syncPage() { showPage(location.hash.slice(1) || 'dashboard') }

function faIcons(html) {
  const temp = document.createElement('div');
  temp.innerHTML = html;
  temp.querySelectorAll('.fa').forEach(el => {
    const iconClass = [...el.classList].find(c => c.startsWith('fa-'));
    if (!iconClass) return;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', el.className);
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', `#${iconClass}`);
    svg.appendChild(use);
    el.replaceWith(svg);
  });
  return temp.innerHTML;
}

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('BSB' + app.aid, 2027);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (app.aid) {
        db.createObjectStore('acc');
        db.createObjectStore('cat');
        const book = db.createObjectStore('book', { autoIncrement: true });
        book.createIndex('ymd', ['ymd', 'id'], { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function resetDB(aid) {
  const req = indexedDB.deleteDatabase('BSB' + aid);
  BSB.removeAid(aid);
  req.onsuccess = () => location.reload();
  req.onblocked = () => console.log('Delete blocked');
}

async function getStore(storeName, mode = 'readonly') {
  db ??= await openDB();
  return db.transaction(storeName, mode).objectStore(storeName);
}

async function getDB(storeName, key) {
  const store = await getStore(storeName);
  return new Promise((resolve, reject) => {
    if (key !== null && key !== undefined) {
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      return;
    }
    const result = {};
    const req = store.openCursor();
    req.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        result[cursor.key] = cursor.value;
        cursor.continue(); // Move to the next item
      } else resolve(result); // No more items, return the object
    };
    req.onerror = () => reject(req.error);
  });
}

async function setDB(storeName, key, val) {
  const store = await getStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = val === 'DELETE' ? store.delete(key) : store.put(val, key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getBook() {
  const store = await getStore('book');
  return new Promise((resolve, reject) => {
    const out = [];
    const req = store.index('ymd').openCursor();
    req.onsuccess = (ev) => {
      const cur = ev.target.result;
      if (cur) { out.push(cur.value); cur.continue(); }
      else resolve(out);
    };
    req.onerror = () => reject(req.error);
  });
}

function downloadFile(file, data, ext) {
  const blob = new Blob([data], { type: ext === '.csv' ? 'text/csv;charset=utf-8' : 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file + ext;
  a.click();
  URL.revokeObjectURL(url);
}

async function sha256(text) {
  //sha256 only works for offline html and https. lets do silly:
  return sillyHash(text);

  //const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function sillyHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return (h >>> 0).toString(16);
}