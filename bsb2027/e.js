class E {
  constructor(sel) {
    if (!sel) this.els = [];
    else if (sel === window) this.els = [window];
    else if (typeof sel === 'string') this.els = Array.from(document.querySelectorAll(sel));
    else if (sel instanceof Node) this.els = [sel];
    else if (sel instanceof NodeList || Array.isArray(sel)) this.els = Array.from(sel);
    else this.els = [];
    this.els.forEach((el, i) => {
      this[i] = el;
    });
  }

  addClass(c) {
    const classes = c.trim().split(/\s+/);
    this.els.forEach(el => classes.forEach(cls => el.classList?.add(cls)));
    return this;
  }

  after(content) {
    this.els.forEach(el => {
      if (content instanceof E) {
        content.els.forEach(node => {
          // Move the actual node, don't clone
          el.parentNode.insertBefore(node, el.nextSibling);
        });
      } else if (content instanceof HTMLElement) el.parentNode.insertBefore(content, el.nextSibling);
      else if (typeof content === 'string') el.insertAdjacentHTML('afterend', content);
    });
    return this;
  }

  append(content) {
    if (!content) return this;
    this.els.forEach(el => {
      if (content instanceof E) content.els.forEach(cEl => el.appendChild(cEl.cloneNode(true)));
      else if (content instanceof Node) el.appendChild(content.cloneNode(true));
      else if (typeof content === 'string') el.insertAdjacentHTML('beforeend', content);
    });
    return this;
  }

  attr(name, val) {
    if (val === undefined) return this.els[0]?.getAttribute(name);
    if (val === null || val === false) this.els.forEach(el => el.removeAttribute(name));
    else this.els.forEach(el => el.setAttribute(name, val === true ? '' : val));
    return this;
  }

  children(sel = null) {
    const result = [];
    this.els.forEach(parent => {
      if (!parent.children) return;
      let children = Array.from(parent.children);

      if (sel === ':odd') children = children.filter((_, i) => i % 2 === 1);
      else if (sel === ':even') children = children.filter((_, i) => i % 2 === 0);
      else if (sel) {
        try {
          children = children.filter(child => child.matches(sel));
        } catch (err) {
          console.warn('Invalid selector in children(): ' + sel, err);
          children = [];
        }
      }
      result.push(...children);
    });
    return new E(result);
  }

  clone() {
    const clones = this.els.map(el => el.cloneNode(true)); // true = deep clone
    return new E(clones);
  }

  css(prop, val) {
    if (val === undefined) {
      // Get first element's computed style
      if (this.els[0]) return getComputedStyle(this.els[0])[prop];
      return undefined;
    } else {
      // Set style for all
      this.els.forEach(el => (el.style[prop] = val));
      return this;
    }
  }

  data(key, val) {
    if (val === undefined) {
      if (this.els.length === 0) return undefined;
      const val = this.els[0].getAttribute('data-' + key);
      if (val === null) return undefined;
      if (val === 'true') return true;
      if (val === 'false') return false;
      if (val === 'null') return null;
      if (val !== '' && !isNaN(Number(val))) return Number(val);
      return val;
    } else {
      this.els.forEach(el => {
        if (val === null || val === false) el.removeAttribute('data-' + key);
        else el.setAttribute('data-' + key, val === true ? '' : val);
      });
      return this;
    }
  }

  each(fn) {
    this.els.forEach((el, i) => fn.call(el, el, i));
    return this;
  }

  eq(idx) {
    return new E([this.els[idx]]);
  }

  find(sel) {
    const found = [];
    this.els.forEach(el => {
      found.push(...el.querySelectorAll(sel));
    });
    return new E(found);
  }

  first() {
    return new E(this.els[0] ? [this.els[0]] : []);
  }

  get length() {
    return this.els.length;
  }

  hasClass(c) {
    return this.els.some(el => el.classList.contains(c));
  }

  hide() {
    this.els.forEach(el => {
      el.style.display = 'none';
    });
    return this;
  }

  html(val) {
    if (val === undefined) return this.els[0]?.innerHTML;
    this.els.forEach(el => (el.innerHTML = val));
    return this;
  }

  index() {
    const el = this.els[0];
    return el ? [...el.parentElement.children].indexOf(el) : -1;
  }

  is(sel) {
    return this.els.some(el => el.matches(sel));
  }

  last() {
    return new E(this.els.length ? [this.els[this.els.length - 1]] : []);
  }

  map(fn) {
    const result = [];
    this.els.forEach((el, i) => {
      const val = fn.call(el, i, el);
      if (val !== null && val !== undefined) result.push(val);
    });
    return result;
  }

  next() {
    let found = [];
    this.els.forEach(el => {
      if (el.nextElementSibling) found.push(el.nextElementSibling);
    });
    return new E(found);
  }

  not(sel) {
    const filtered = this.els.filter(el => !el.matches(sel));
    return new E(filtered);
  }

  off(event, fn) {
    this.els.forEach(el => el.removeEventListener(event, fn));
    return this;
  }

  on(event, selectorOrFn, fn) {
    if (typeof selectorOrFn === 'function') {
      // Direct event binding: e('.show').on('click', handler)
      this.els.forEach(el => el.addEventListener(event, selectorOrFn));
    } else {
      // Delegated event binding: e(document).on('click', '.show', handler)
      const selector = selectorOrFn;
      this.els.forEach(parentEl => {
        parentEl.addEventListener(event, evt => {
          let target = evt.target;
          while (target && target !== parentEl) {
            if (target.matches(selector)) {
              fn.call(target, evt);
              break;
            }
            target = target.parentElement;
          }
        });
      });
    }
    return this;
  }

  parent() {
    const parents = [];
    this.els.forEach(el => {
      if (el.parentElement && !parents.includes(el.parentElement)) parents.push(el.parentElement);
    });
    return new E(parents);
  }

  parents(sel) {
    const result = new Set();
    this.els.forEach(el => {
      let p = el.parentElement;
      while (p) {
        if (!sel || p.matches(sel)) result.add(p);
        p = p.parentElement;
      }
    });
    return new E([...result]);
  }

  prepend(content) {
    this.els.forEach(el => {
      if (content instanceof E) {
        content.els.slice().reverse().forEach(cEl => el.insertBefore(cEl.cloneNode(true), el.firstChild));
      } else if (content instanceof Node) {
        el.insertBefore(content.cloneNode(true), el.firstChild);
      } else if (typeof content === 'string') {
        el.insertAdjacentHTML('afterbegin', content);
      }
    });
    return this;
  }

  prev() {
    const prevEls = this.els
      .map(el => el.previousElementSibling)
      .filter(el => el !== null); // remove nulls (if no previous sibling)
    return new E(prevEls);
  }

  prevAll() {
    const result = this.els.map(el => {
      const siblings = [];
      let current = el.previousElementSibling;
      while (current) {
        siblings.unshift(current); // maintain original DOM order
        current = current.previousElementSibling;
      }
      return siblings;
    });
    return new E(result.flat());
  }

  prop(name, val) {
    if (typeof val === 'undefined') return this.els.length ? this.els[0][name] : undefined;
    this.els.forEach(el => {
      el[name] = val;
      // Sync boolean attribute for known props
      if (['readOnly', 'checked', 'disabled', 'selected'].includes(name)) {
        if (val) el.setAttribute(name.toLowerCase(), '');
        else el.removeAttribute(name.toLowerCase());
      }
    });
    return this;
  }

  remove() {
    this.els.forEach(el => el.remove());
    this.els = [];
    return this;
  }

  removeAttr(name) {
    this.els.forEach(el => el.removeAttribute(name));
    return this;
  }

  removeClass(c) {
    const classes = c.trim().split(/\s+/);
    this.els.forEach(el => {
      classes.forEach(cls => el.classList.remove(cls));
    });
    return this;
  }

  show() {
    this.els.forEach(el => {
      el.style.display = '';
    });
    return this;
  }

  siblings() {
    let sibs = [];
    this.els.forEach(el => {
      if (!el.parentElement) return;
      sibs = sibs.concat(
        Array.from(el.parentElement.children).filter(child => child !== el)
      );
    });
    return new E(sibs);
  }

  submit() {
    this.els.forEach(el => {
      if (typeof el.requestSubmit === 'function') el.requestSubmit();
      else if (typeof el.submit === 'function') el.submit();
    });
    return this;
  }

  text(val) {
    if (val === undefined) return this.els[0]?.textContent;
    this.els.forEach(el => (el.textContent = val));
    return this;
  }

  toggle() {
    this.els.forEach(el => {
      if (getComputedStyle(el).display === 'none') el.style.display = '';
      else el.style.display = 'none';
    });
    return this;
  }

  toggleClass(c) {
    const classes = c.trim().split(/\s+/);
    this.els.forEach(el => {
      classes.forEach(cls => el.classList.toggle(cls));
    });
    return this;
  }

  val(val) {
    if (val === undefined) {
      const first = this.els[0];
      if (!first) return undefined;
      if (first.type === 'radio') {
        const checked = this.els.find(el => el.checked);
        return checked?.value;
      }
      if (first.type === 'checkbox') {
        const checkedValues = [];
        this.els.forEach(el => {
          if (el.checked) checkedValues.push(el.value);
        });
        return checkedValues.length === 1 ? checkedValues[0] : checkedValues;
      }
      return first.value;
    } else {
      this.els.forEach(el => {
        if (el.type === 'radio' || el.type === 'checkbox') el.checked = el.value == val;
        else el.value = val;
      });
      return this;
    }
  }

  static ajax(url, { method = 'GET', data = null, headers = {}, } = {}) {
    const options = { method, headers };
    if (data) {
      if (data instanceof FormData) options.body = data;
      else {
        options.body = JSON.stringify(data);
        options.headers['Content-Type'] = 'application/json';
      }
    }
    return fetch(url, options).then(async res => {
      if (!res.ok) throw new Error('HTTP ' + res.status);

      const raw = await res.text();
      try {
        return JSON.parse(raw);  // Try parse JSON first
      } catch {
        // Fallback to raw text if not JSON
        return raw;
      }
    });
  }

  // Convenience wrappers
  static get(url, data = null, headers = {}) {
    if (data) {
      const queryString = new URLSearchParams(data).toString();
      url += (url.includes('?') ? '&' : '?') + queryString;
    }
    return E.ajax(url, { method: 'GET', headers });
  }

  static post(url, data = null, headers = {}) {
    return E.ajax(url, { method: 'POST', data, headers });
  }

  static isNumeric(val) {
    return !isNaN(parseFloat(val)) && isFinite(val);
  }
}

function e(sel) {
  if (typeof sel === 'function') {
    if (document.readyState !== 'loading') sel();
    else document.addEventListener('DOMContentLoaded', sel);
    return;// new E([]); // empty wrapper for chaining if needed
  }
  return new E(sel);
}

e.ajax = E.ajax;
e.get = E.get;
e.post = E.post;

e.number_format = function (number, decimals = 0, dec_point = '.', thousands_sep = ',') {
  number = parseFloat(number);
  if (!isFinite(number)) return '0';
  const fixed = number.toFixed(decimals);
  const parts = fixed.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousands_sep);
  return parts.join(dec_point);
};