e(document).on('click', '.pop .x', function(){
  e(this).parents('.pop').addClass('hide');
});
e('.pop>div:first-child>div:first-child').prepend('<b class="x">&times;</b>');

e('#head n').on('click', async function(){
  if (!app.cats) await initApp();
  showPage(e(this).attr('page'));
});
e(window).on('hashchange', syncPage);

window.addEventListener('load', async () => {
  if (!localStorage.getItem('login')) return showPage('login');
  await initApp();
  syncPage();
});

e(document).on('click', '.show', function() {
  const id = e(this).data('src');
  const p = e(this).data('p');
  let el;
  if (id === 'next') {
    el = e(this).next();
  } else if (id) {
    el = e(id);
  } else if (p) {
    if (p === 'p') {
      el = e(this).parent();
    } else if (p === 'pp') {
      el = e(this).parent().parent();
    } else if (p === 'ppp') {
      el = e(this).parent().parent().parent();
    } else {
      el = e(this).parents(p);
    }
  } else {
    el = e(this).next();
  }
  el && el.toggleClass('hide');
});

e(document).on('click', '.tree > :first-child', function(){
  let me = e(this).parent();
  let src = me.attr('tr');
  let len = src.length;
  let on = me.toggleClass('on').hasClass('on');
  me.parent().find('.tree').each(function(){
    let row = e(this);
    let val = row.attr('tr');
    if (val === src) return; // skip self
    if (!on && val.substring(0, len) === src) {
      row.addClass('trHide on');
    }
    if (on && val.length === len + 2 && val.substring(0, len) === src) {
      row.removeClass('trHide on');
    }
  });
});

window.DatePicker = (function () {
  const today = new Date(); today.setHours(0,0,0,0);

  const pop = document.createElement('div');
  pop.className = 'dp-pop rc';
  document.body.appendChild(pop);

  let activeInput = null;
  let view        = new Date(today.getFullYear(), today.getMonth(), 1);
  let selected    = null;

  function render() {
    const y = view.getFullYear(), m = view.getMonth();
    const cells = BSB.grid(y, m);
    const label = view.toLocaleString(undefined, { month: 'short', year: 'numeric' });
    let html = `
      <div class="dp-head">
        <button type="button" data-act="prevY" title="Previous year">«</button>
        <button type="button" data-act="prevM" title="Previous month">‹</button>
        <span class="title" data-act="gotoToday" title="Jump to current month">${label}</span>
        <button type="button" data-act="nextM" title="Next month">›</button>
        <button type="button" data-act="nextY" title="Next year">»</button>
      </div>
      <table class="dp-table"><tr>
        ${['M','T','W','T','F','S','S'].map(d=>`<th>${d}</th>`).join('')}
      </tr>`;
    for (let w = 0; w < 6; w++) {
      html += '<tr>';
      for (let d = 0; d < 7; d++) {
        const cur = cells[w*7 + d];
        const inMonth = cur.getMonth() === m && cur.getFullYear() === y;
        const isToday = BSB.sameDate(cur, today);
        const isSel   = BSB.sameDate(cur, selected);
        // Ghost: same day-number in the CURRENT month, when selected is elsewhere.
        const isGhost = !isSel && selected && inMonth && cur.getDate() === selected.getDate();
        const cls = [
          inMonth ? '' : 'other',
          isToday ? 'today' : '',
          isSel   ? 'selected' : '',
          isGhost ? 'ghost' : ''
        ].filter(Boolean).join(' ');
        html += `<td class="${cls}" data-date="${BSB.fmtYmd(cur)}">${cur.getDate()}</td>`;
      }
      html += '</tr>';
    }
    html += '</table>';
    html += `
      <div class="dp-foot">
        <button type="button" data-act="clear">Clear</button>
        <button type="button" data-act="todayBtn">Today</button>
      </div>`;
    pop.innerHTML = html;
  }

  function open(input) {
    if (activeInput === input && pop.classList.contains('open')) return;
    activeInput = input;
    const v = input.value ? new Date(input.value.replaceAll('DUE: ', '') + 'T00:00:00') : null;
    selected = v && !isNaN(v) ? v : null;
    view = new Date(
      (selected || today).getFullYear(),
      (selected || today).getMonth(), 1
    );
    pop.classList.add('open');
    render();

    const r      = input.getBoundingClientRect();
    const popW   = pop.offsetWidth;
    const popH   = pop.offsetHeight;
    const margin = 8;
    // Horizontal: default = input's left edge; flip right-aligned if it overflows
    let left = r.left;
    if (left + popW > window.innerWidth - margin) left = r.right - popW;
    left = Math.max(margin, Math.min(left, window.innerWidth - popW - margin));
    // Vertical: default = below input; flip above if it overflows bottom
    let top = r.bottom + 4;
    if (top + popH > window.innerHeight - margin) top = r.top - popH - 4;
    if (top < margin) top = margin;

    pop.style.left = (left + window.scrollX) + 'px';
    pop.style.top  = (top  + window.scrollY) + 'px';
  }

  function close() {
    pop.classList.remove('open');
    activeInput = null;
  }

  function commit(d) {
    selected = d;
    if (activeInput) {
      activeInput.value = BSB.fmtYmd(d);
      activeInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
    close();
  }

  // Prevent buttons from stealing focus → avoids blur/focus churn on the input
  pop.addEventListener('mousedown', el => {
    if (el.target.closest('button') || el.target.closest('.title')) el.preventDefault();
  });

  pop.addEventListener('click', el => {
    // Header title (jump to current month)
    if (el.target.closest('.title')) {
      el.preventDefault();
      el.stopPropagation();
      view = new Date(today.getFullYear(), today.getMonth(), 1);
      render();
      return;
    }

    const btn = el.target.closest('button');
    if (btn) {
      el.preventDefault();
      el.stopPropagation();
      const a = btn.dataset.act;
      if (a === 'prevM')      view.setMonth(view.getMonth() - 1);
      else if (a === 'nextM') view.setMonth(view.getMonth() + 1);
      else if (a === 'prevY') view.setFullYear(view.getFullYear() - 1);
      else if (a === 'nextY') view.setFullYear(view.getFullYear() + 1);
      else if (a === 'clear') {
        selected = null;
        if (activeInput) {
          activeInput.value = '';
          activeInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
        close();
        return;
      } else if (a === 'todayBtn') {
        view = new Date(today.getFullYear(), today.getMonth(), 1);
        commit(new Date(today));
        return;
      }
      render(); // synchronous — no deferral, no skipping
      return;
    }

    const cell = el.target.closest('td[data-date]');
    if (cell) {
      const [Y,M,D] = cell.dataset.date.split('-').map(Number);
      commit(new Date(Y, M-1, D));
    }
  });

  document.addEventListener('click', el => {
    if (!pop.classList.contains('open')) return;
    if (pop.contains(el.target)) return;
    if (el.target.matches('input.date')) return;
    close();
  });

  document.querySelectorAll('input.date').forEach(inp => {
    inp.addEventListener('click', () => open(inp));
    inp.addEventListener('focus', () => open(inp));
  });

  return { open, close, set(inputEl, dateStr) {
    const d = dateStr ? new Date(dateStr + 'T00:00:00') : null;
    if (inputEl) {
      inputEl.value = d ? BSB.fmtYmd(d) : '';
      inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    }
    selected = d;
  }};
})();