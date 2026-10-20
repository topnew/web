class BSB {
  static catRoots(cat) {
    if (![1, 3, 5, 7].includes(cat.length)) return [];
    const cats = [];
    for (let len = cat.length; len >= 1; len -= 2) {
      cats.push(cat.slice(0, len));
    }
    return cats;
  }

  static cent2int(f) { return f ? Math.round(parseFloat(String(f).trim()) * 100) : 0; }

  static isExp(cat) { return app.acc.catExp?.includes(Number(String(cat).substring(0, 1))); }
  static isInc(cat) { return app.acc.catInc?.includes(Number(String(cat).substring(0, 1))); }

  static stat(stat, cat, amt) {
    for (const p of this.catRoots(cat)) {
      if (!stat[p]) stat[p] = [0, 0];
      stat[p][0] += 1;
      stat[p][1] += amt;
    }
  }

  static round(amt, isCent = false) {
    let value = parseFloat(amt);
    if (isNaN(value)) return 0;
    if (isCent) value /= 100;
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  static fmtAmt(amt) { return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amt); }
  static fmtInt(int) { return new Intl.NumberFormat('en-US').format(int); }

  static getAids() {
    const aids = localStorage.getItem('aids');
    return aids ? JSON.parse(aids) : [{ aid: 1000, name: "BSB TEST", code: "BSB" }];
  }
  static removeAid(aid) {
    const aids = this.getAids().filter(x => x.aid !== aid);
    localStorage.setItem('aids', JSON.stringify(aids));
  }
  static saveAid(aid, name, code) {
    const aids = this.getAids();
    const existing = aids.find(x => x.aid === aid);
    if (existing) {
      existing.name = name;
      existing.code = code;
    } else {
      aids.push({ aid, name, code });
    }
    localStorage.setItem('aids', JSON.stringify(aids));
  }

  static sameDate(a, b) {
    if (!a || !b) return false;
    if (typeof a === 'string' && typeof b === 'string') return a === b;
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  //static cat2Level(cat, level) { return String(cat ?? '').substring(0, level); }

  static date2Mode(ymd, mode) {
    if (/^\d{8}$/.test(ymd)) ymd = `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
    const d = new Date(ymd);
    if (isNaN(d)) return '';

    let y = d.getFullYear();
    let m = d.getMonth() + 1; // 1-12
    const fiscMon = this.fM();

    const fM = (m - fiscMon + 12) % 12; // 0-based fiscal month
    const qStart = Math.floor(fM / 3) * 3;
    const fyStartYear = m >= fiscMon ? y : y - 1;
    let qm0 = (fiscMon - 1) + qStart;

    switch (mode) {
      case 'Y': return this.fY(y, m);
      case 'Q': return `${this.fY(y, m)}Q${Math.floor(fM / 3) + 1}`;
      case 'M': return `${y}-${this.zpad(m)}`;
      case 'D': return `${y}-${this.zpad(m)}-${this.zpad(d.getDate())}`;
      case 'W':
        const w = d.getDay() || 7;
        d.setDate(d.getDate() + 4 - w);
        const week = Math.ceil(
            ((d - new Date(d.getFullYear(), 0, 1)) / 86400000 + 1) / 7
        );
        return `${d.getFullYear()}W${this.zpad(week)}`;
      case 'thisQ':
        return [fyStartYear + Math.floor(qm0 / 12), (qm0 % 12) + 1];
      case 'lastQ':
        qm0 -= 3;
        return [fyStartYear + Math.floor(qm0 / 12), ((qm0 % 12) + 12) % 12 + 1];
      case 'YTD':
        return [fyStartYear, fiscMon];
      default: return '';
    }
  }

  static mode2Dates(value, mode) {
    const fiscMon = this.fM();
    const endOfMonth = (y, m) => new Date(y, m, 0); // m = 1-12

    // Find the calendar year in which this fiscal year starts.
    // Reuses fY() so this stays consistent with date2Mode().
    const fiscalStartYear = (fy) => {
      fy = Number(fy);
      for (let y = fy - 1; y <= fy + 1; y++) {
        if (Number(this.fY(y, fiscMon)) === fy) return y;
      }
      return null;
    };

    switch (mode) {
      case 'M': {
        const match = /^(\d{4})-(\d{2})$/.exec(value);
        if (!match) return ['', ''];
        const y = Number(match[1]);
        const m = Number(match[2]);
        const first = `${y}-${this.zpad(m)}-01`;
        const last = new Date(y, m, 0);
        return [first, this.fmtYmd(last)];
      }
      case 'Y': {
        // 2026
        const fy = Number(value);
        if (!fy) return ['', ''];
        const startY = fiscalStartYear(fy);
        if (startY === null) return ['', ''];
        const first = new Date(startY, fiscMon - 1, 1);
        const last = new Date(startY + 1, fiscMon - 1, 0);
        return [this.fmtYmd(first), this.fmtYmd(last)];
      }
      case 'Q': {
        // 2026Q3
        const match = /^(\d{4})Q([1-4])$/.exec(value);
        if (!match) return ['', ''];
        const fy = Number(match[1]);
        const q = Number(match[2]);
        const startY = fiscalStartYear(fy);
        if (startY === null) return ['', ''];
        // Fiscal quarter start month, zero-based
        const month0 = (fiscMon - 1) + (q - 1) * 3;
        const first = new Date(startY, month0, 1);
        const last = new Date(startY, month0 + 3, 0);
        return [this.fmtYmd(first), this.fmtYmd(last)];
      }
      case 'W': {
        const match = /^(\d{4})W(\d{2})$/.exec(value);
        if (!match) return ['', ''];
        const y = Number(match[1]);
        const w = Number(match[2]);
        const jan4 = new Date(y, 0, 4); // ISO week 1 contains January 4.
        const day = jan4.getDay() || 7;
        const monday = new Date(jan4); // Monday of ISO week 1
        monday.setDate(jan4.getDate() - day + 1);
        monday.setDate(monday.getDate() + (w - 1) * 7); // Monday of requested week
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        return [this.fmtYmd(monday), this.fmtYmd(sunday)];
      }
      default: return [value, value];
    }
  }

  static grid(year, month) {
    const first  = new Date(year, month, 1);
    const offset = (first.getDay() + 6) % 7; // Mon=0 ... Sun=6
    const start  = new Date(year, month, 1 - offset);
    const cells  = [];
    const cur    = new Date(start);
    for (let i = 0; i < 42; i++) {
      cells.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return cells;
  }

  static fY(y, m) { const fM = this.fM(); return y + (fM > 1 && m >= fM ? 1 : 0); }
  static fM() { return Number(app.acc.finMon ?? 1); }
  static zpad(str, len = 2) { return String(str).padStart(len, '0'); }

  static fmtYmd(d = new Date()) {
    if (typeof d === 'string' && /^\d{8}$/.test(d)) {
      return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
    }
    return d.getFullYear() +'-'+ this.zpad(d.getMonth() + 1) +'-'+ this.zpad(d.getDate());
  }

  static getDateRange(type) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let fm = new Date(today);
    let to = new Date(today);
    let y = 0;
    let m = 0;
    switch (type) {
      case 'today': break;
      case 'yesterday':
        fm.setDate(fm.getDate() - 1);
        to.setDate(to.getDate() - 1);
        break;
      case 'last7D':
        fm.setDate(fm.getDate() - 6); // today + previous 6 days
        break;
      case 'last30D':
        fm.setDate(fm.getDate() - 29);
        break;
      case 'thisM':
        fm = new Date(today.getFullYear(), today.getMonth(), 1);
        to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        break;
      case 'lastM':
        fm = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        to = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
      case 'thisQ':
        [y, m] = this.date2Mode(today, 'thisQ');
        fm = new Date(y, m - 1, 1);
        to = new Date(y, m + 2, 0);
        break;
      case 'lastQ':
        [y, m] = this.date2Mode(today, 'lastQ');
        fm = new Date(y, m - 1, 1);
        to = new Date(y, m + 2, 0);
        break;
      case 'YTD':
        [y, m] = this.date2Mode(today, 'YTD');
        fm = new Date(y, m - 1, 1);
        break;
      case 'lastFY':
        [y, m] = this.date2Mode(today, 'YTD');
        fm = new Date(y - 1, m - 1, 1);
        to = new Date(y, m - 1, 0);
        break;
      default: return {};
    }
    return { fm: this.fmtYmd(fm), to: this.fmtYmd(to) };
  }
}