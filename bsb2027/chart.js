/*
 * chart.js
 * Tiny dependency-free SVG charts.
 *
 * Canonical HTML data format:
 *
 * <div class="chart" data-chart="bar">
 * Month,Tom,Sam;
 * Jan,12,18;
 * Feb,16,13
 * </div>
 *
 * First row: headings
 * First column: category / x-axis label
 * Remaining columns: series
 *
 * Supported charts:
 *   bar     grouped/single bar
 *   stack   stacked bar
 *   barV    alias for stack
 *   barS    stacked bar sorted by series total (compatibility alias)
 *   line
 *   pie
 *   donut   pie with centre hole
 *
 * Main API:
 *   Chart.renderAll()
 *   Chart.render(elementOrSelector)
 *   Chart.svg(csvText, options)
 */

class Chart {
  static uid = 0;
  static defaults = {
    chart: 'bar',
    w: 480,
    h: 250,
    title: '',
    titleAlign: 2,
    xTitle: '',
    xTitleAlign: 2,
    yTitle: '',
    yTitleAlign: 2,
    yUnit: '',
    legend: '',
    legendW: 80,
    xSkip: 0,
    xSkipMax: 12,
    xAngle: 0,
    ySum: 0,
    pieArc: 0,
    pieStripe: 0,
    piePct: 0,
    pieDonut: 0,
    valAngle: 0,
    valShow: 0,
    colorBar: 0,
    gapT: 0,
    gapR: 0,
    gapB: 0,
    gapL: 0,
    groupWidth: 0.78,
    xFormat: '',
    yFormat: '',
    sort: '',
    color: '',
    colorDel: '',
    colorAdd: '',
    style: '',
    sepCol: ',',
    sepRow: '\n'
  };
  static gradientPairs = [
    ['ff5722', 'bf360c'],
    ['FFCA28', 'FF8F00'],
    ['4FC3F7', '0288D1'],
    ['81C784', '2E7D32'],
    ['F06292', 'AD1457'],
    ['1976D2', '0D47A1'],
    ['FF7043', 'D84315'],
    ['DCE775', '9E9D24'],
    ['9575CD', '512DA8'],
    ['00BCD4', '006064'],
    ['E57373', 'C62828']
  ];
  static solidColors = [
    '#f0ad4e', '#d9534f', '#5bc0de', '#5cb85c', '#337ab7',
    '#f26522', '#754c24', '#d9ce00', '#0e2e42', '#ce1797', '#672d8b'
  ];

  // ---------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------

  static svg(data, init = {}) {
    const opt = this.normalizeInit(init);
    const model = this.parse(data, opt);
    if (!model || !model.labels.length || !model.series.length) return '';

    const chart = this.normalizeChartName(opt.chart);
    opt.chart = chart;
    if (opt.ySum) this.applyCumulative(model);

    if (chart === 'barS') model.series.sort((a, b) =>
      b.values.reduce((n, v) => n + v, 0) -
      a.values.reduce((n, v) => n + v, 0)
    );

    if (chart === 'pie' || chart === 'donut') return this.drawPie(model, opt);
    if (chart === 'line') return this.drawCartesian(model, opt, 'line');
    if (chart === 'stack') return this.drawCartesian(model, opt, 'stack');
    if (chart === 'barS') return this.drawCartesian(model, opt, 'barS');
    return this.drawCartesian(model, opt, 'bar');
  }

  static render(el) {
    if (typeof el === 'string') el = document.querySelector(el);
    if (!el) return;
    if (el._chartSource === undefined) el._chartSource = el.textContent.trim();

    const init = this.readInit(el);
    el.innerHTML = this.svg(el._chartSource, init);
  }

  static renderAll(selector = '.chart') { document.querySelectorAll(selector).forEach(el => this.render(el)); }
  static refresh(selector = '.chart') { this.renderAll(selector); }

  // ---------------------------------------------------------------------
  // HTML data-* options
  // ---------------------------------------------------------------------

  static readInit(el) {
    const d = el.dataset;
    const out = {};
    const strKeys = [
      'chart', 'title', 'xTitle', 'yTitle', 'yUnit',
      'legend', 'xFormat', 'yFormat', 'sort',
      'color', 'colorDel', 'colorAdd', 'style',
      'sepCol', 'sepRow'
    ];
    const numKeys = [
      'w', 'h',
      'gapT', 'gapR', 'gapB', 'gapL',
      'legendW',
      'titleAlign', 'xTitleAlign', 'yTitleAlign',
      'xSkip', 'xSkipMax', 'xAngle',
      'ySum',
      'pieArc', 'pieStripe', 'piePct', 'pieDonut',
      'valAngle', 'valShow', 'colorBar',
      'groupWidth'
    ];
    strKeys.forEach(k => {
      if (d[k] !== undefined) out[k] = d[k];
    });
    numKeys.forEach(k => {
      if (d[k] !== undefined) out[k] = Number(d[k]);
    });
    return out;
  }

  static normalizeInit(init) {
    const out = { ...this.defaults, ...(init || {}) };
    [
      'w', 'h',
      'gapT', 'gapR', 'gapB', 'gapL',
      'legendW',
      'titleAlign', 'xTitleAlign', 'yTitleAlign',
      'xSkip', 'xSkipMax', 'xAngle',
      'ySum',
      'pieArc', 'pieStripe', 'piePct', 'pieDonut',
      'valAngle', 'valShow', 'colorBar',
      'groupWidth'
    ].forEach(k => {
      out[k] = Number(out[k]) || 0;
    });
    if (!out.w) out.w = 480;
    if (!out.h) out.h = 250;
    if (!out.legendW) out.legendW = 80;
    if (!out.groupWidth) out.groupWidth = 0.78;
    out.groupWidth = Math.max(0.05, Math.min(1, out.groupWidth));
    return out;
  }

  static normalizeChartName(name) {
    name = String(name || 'bar').trim();
    if (name === 'barV') return 'stack';
    if (name === 'stacked') return 'stack';
    if (name === 'barS') return 'barS';
    if (name === 'line') return 'line';
    if (name === 'pie') return 'pie';
    if (name === 'donut') return 'donut';
    return 'bar';
  }

  // ---------------------------------------------------------------------
  // Canonical data parser
  // ---------------------------------------------------------------------

  static parse(data, init = {}) {
    if (Array.isArray(data)) return this.parseRows(data);
    if (typeof data !== 'string') return null;

    const sepCol = init.sepCol || ',';
    const sepRow = init.sepRow || '\n';
    const rows = data
      .trim()
      .split(sepRow)
      .map(row => row.trim())
      .filter(Boolean)
      .map(row => row.split(sepCol).map(v => v.trim()));
    return this.parseRows(rows);
  }

  static parseRows(rows) {
    if (!Array.isArray(rows) || rows.length < 2) return null;

    const clean = rows
      .map(r => Array.isArray(r) ? r.map(v => String(v).trim()) : [])
      .filter(r => r.length);
    if (clean.length < 2 || clean[0].length < 2) return null;

    const head = clean[0];
    const labels = [];
    const series = head.slice(1).map(name => ({
      name, values: []
    }));

    clean.slice(1).forEach(row => {
      labels.push(row[0] ?? '');
      series.forEach((s, i) => {
        s.values.push(this.toNumber(row[i + 1]));
      });
    });

    return { xName: head[0] || '', labels, series };
  }

  static toNumber(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

    const str = String(value ?? '').trim();
    if (!str) return 0;

    // Deliberately permissive for ordinary chart numbers.
    const n = Number(str.replace(/,/g, ''));
    return Number.isFinite(n) ? n : 0;
  }

  static applyCumulative(model) {
    model.series.forEach(series => {
      let total = 0;
      series.values = series.values.map(v => (total += v));
    });
  }

  // ---------------------------------------------------------------------
  // Cartesian charts: bar, stack, line
  // ---------------------------------------------------------------------

  static drawCartesian(model, init, mode) {
    const id = ++this.uid;
    const palette = this.buildPalette(id, init);
    const layout = this.cartesianLayout(model, init, mode);
    const {
      w, h,
      plotX, plotY, plotW, plotH,
      legend,
      scale,
      y,
      zeroY
    } = layout;

    let svg = this.svgOpen(w, h);
    svg += this.defs(id);
    svg += this.css(init.style);
    svg += this.drawTitle(init, w);
    svg += this.drawYAxis(init, layout);
    svg += this.drawXAxis(model, init, layout, mode);
    svg += this.drawAxisTitles(init, layout);

    if (mode === 'line') {
      svg += this.drawLines(model, init, layout, palette);
    } else if (mode === 'stack') {
      svg += this.drawStackedBars(model, init, layout, palette);
    } else if (mode === 'barS') {
      svg += this.drawBarS(model, init, layout, palette);
    } else {
      svg += this.drawGroupedBars(model, init, layout, palette);
    }

    // zero axis should stay visible above the bars/grid.
    if (scale.min < 0 && scale.max > 0) {
      svg += `<line class="chart-axis chart-zero" x1="${plotX}" x2="${plotX + plotW}" y1="${this.round(zeroY)}" y2="${this.round(zeroY)}"/>`;
    }

    svg += this.drawLegend(model, init, legend, palette);
    svg += '</svg>';
    return svg;
  }

  static drawBarS(model, init, layout, palette) {
    const { plotX, slotW, y, zeroY } = layout;
    const barW = slotW * init.groupWidth;
    const barPad = (slotW - barW) / 2;
    let out = '<g class="chart-bars chart-bars-overlap">';
    model.series.forEach((series, s) => {
      series.values.forEach((value, i) => {
        const x = plotX + i * slotW + barPad;
        const valueY = y(value);
        const rectY = value >= 0 ? valueY : zeroY;
        const rectH = Math.abs(valueY - zeroY);
        out += `
<g class="bar-item">
<rect
  x="${this.round(x)}"
  y="${this.round(rectY)}"
  width="${this.round(barW)}"
  height="${this.round(rectH)}"
  fill="${palette[s % palette.length]}"
  opacity=".8">
<title>${this.escape(series.name)} : ${this.escape(this.formatAxis(value, init.yFormat))}</title>
</rect>`;

        if (init.valShow && value !== 0) {
          out += this.drawValueLabel(
            value,
            x + barW / 2,
            value >= 0 ? valueY - 6 : valueY + 14,
            init
          );
        }
        out += '</g>';
      });
    });
    out += '</g>';
    return out;
  }

  static cartesianLayout(model, init, mode) {
    const w = init.w;
    const h = init.h;
    let gapT = 9 + init.gapT + (init.title ? 18 : 0);
    let gapR = 9 + init.gapR;
    let gapB = 9 + init.gapB + 24 + (init.xTitle ? 18 : 0);
    let gapL = 9 + init.gapL + 54 + (init.yTitle ? 18 : 0);

    const legend = this.resolveLegend(model, init, mode);
    if (legend.pos === 'T') gapT += 22;
    if (legend.pos === 'B') gapB += 24;
    if (legend.pos === 'L') gapL += legend.width;
    if (legend.pos === 'R') gapR += legend.width;

    const plotX = Math.max(0, gapL);
    const plotY = Math.max(0, gapT);
    const plotW = Math.max(1, w - gapL - gapR);
    const plotH = Math.max(1, h - gapT - gapB);

    let values;
    if (mode === 'stack') {
      values = [];
      for (let i = 0; i < model.labels.length; i++) {
        let pos = 0;
        let neg = 0;
        model.series.forEach(s => {
          const v = s.values[i] || 0;
          if (v >= 0) pos += v;
          else neg += v;
        });
        values.push(pos, neg);
      }
    } else values = model.series.flatMap(s => s.values);

    let min = Math.min(0, ...values);
    let max = Math.max(0, ...values);
    const scale = this.niceScale(min, max, 6);
    min = scale.min;
    max = scale.max;

    const range = max - min || 1;
    const y = value => plotY + (max - value) / range * plotH;
    const zeroY = y(0);
    const slotW = mode === 'line'
      ? (model.labels.length > 1 ? plotW / (model.labels.length - 1) : plotW)
      : plotW / model.labels.length;

    legend.plotX = plotX;
    legend.plotY = plotY;
    legend.plotW = plotW;
    legend.plotH = plotH;

    return {
      w, h,
      plotX, plotY, plotW, plotH,
      legend,
      scale,
      y,
      zeroY,
      slotW
    };
  }

  static resolveLegend(model, init, mode) {
    let pos = String(init.legend ?? '').toUpperCase();
    if (!pos) pos = model.series.length > 1 ? 'R' : '0';
    if (!['0', 'T', 'B', 'L', 'R'].includes(pos)) pos = 'R';
    if (model.series.length < 2 && mode !== 'pie') pos = '0';
    return { pos, width: Math.max(40, init.legendW || 80) };
  }

  static drawYAxis(init, layout) {
    const { plotX, plotY, plotW, scale, y } = layout;
    let out = '<g class="chart-tick axisY">';
    scale.ticks.forEach(v => {
      const yy = y(v);
      out += `
<line x1="${plotX}" x2="${plotX + plotW}" y1="${this.round(yy)}" y2="${this.round(yy)}"/>
<text x="${plotX - 5}" y="${this.round(yy + 4)}">${this.escape(this.formatAxis(v, init.yFormat) + (init.yUnit ? ' ' + init.yUnit : ''))}</text>`;
    });
    out += '</g>';
    return out;
  }

  static drawXAxis(model, init, layout, mode) {
    const { plotX, plotY, plotW, plotH, slotW } = layout;
    const n = model.labels.length;
    let out = '<g class="chart-tick axisX">';
    const skip = this.resolveXSkip(n, init);
    for (let i = 0; i < n; i++) {
      const show = skip <= 0 || i % (skip + 1) === 0 || i === n - 1;
      if (!show) continue;

      let center;
      if (mode === 'line') {
        center = n > 1 ? plotX + i * slotW : plotX + plotW / 2;
        out += `<line x1="${this.round(center)}" x2="${this.round(center)}" y1="${plotY}" y2="${plotY + plotH}"/>`;
      } else {
        center = plotX + i * slotW + slotW / 2;
        // Category separator is between groups, not through the bars.
        if (i > 0) {
          const sepX = plotX + i * slotW;
          out += `<line class="chart-separator" x1="${this.round(sepX)}" x2="${this.round(sepX)}" y1="${plotY}" y2="${plotY + plotH}"/>`;
        }
      }
      const label = this.escape(this.formatAxis(model.labels[i], init.xFormat));
      const labelY = plotY + plotH + 18;
      if (init.xAngle) {
        out += `<g transform="translate(${this.round(center)},${this.round(labelY)}) rotate(${init.xAngle})"><text class="x-angle">${label}</text></g>`;
      } else {
        out += `<text x="${this.round(center)}" y="${this.round(labelY)}">${label}</text>`;
      }
    }
    out += '</g>';
    return out;
  }

  static resolveXSkip(count, init) {
    if (init.xSkip) return Math.max(0, Math.floor(init.xSkip));
    if (init.xSkipMax > 0 && count > init.xSkipMax) return Math.floor(count / init.xSkipMax);
    return 0;
  }

  static drawGroupedBars(model, init, layout, palette) {
    const { plotX, plotW, plotY, plotH, slotW, y, zeroY } = layout;
    const nSeries = model.series.length;
    const groupW = slotW * init.groupWidth;
    const groupPad = (slotW - groupW) / 2;
    const barW = groupW / nSeries;

    let out = '<g class="chart-bars">';
    model.series.forEach((series, s) => {
      series.values.forEach((value, i) => {
        const x = plotX + i * slotW + groupPad + s * barW;
        const valueY = y(value);
        const rectY = value >= 0 ? valueY : zeroY;
        const rectH = Math.abs(valueY - zeroY);
        const fill = init.colorBar && model.series.length === 1
          ? palette[i % palette.length]
          : palette[s % palette.length];
          out += `
<g class="bar-item">
<rect x="${this.round(x)}" y="${this.round(rectY)}" width="${this.round(barW)}" height="${this.round(rectH)}" fill="${fill}">
<title>${this.escape(series.name)} : ${this.escape(this.formatAxis(value, init.yFormat))}</title>
</rect>`;
        if (init.valShow && value !== 0) out += this.drawValueLabel(
          value,
          x + barW / 2,
          value >= 0 ? valueY - 6 : valueY + 14,
          init
        );
        out += '</g>';
      });
    });
    out += '</g>';
    return out;
  }

  static drawStackedBars(model, init, layout, palette) {
    const { plotX, slotW, y, zeroY } = layout;
    const groupW = slotW * init.groupWidth;
    const groupPad = (slotW - groupW) / 2;
    let out = '<g class="chart-bars chart-stacked">';
    for (let i = 0; i < model.labels.length; i++) {
      let pos = 0;
      let neg = 0;
      model.series.forEach((series, s) => {
        const value = series.values[i] || 0;
        const x = plotX + i * slotW + groupPad;
        let from, to;
        if (value >= 0) {
          from = pos;
          to = pos + value;
          pos = to;
        } else {
          from = neg;
          to = neg + value;
          neg = to;
        }
        const y1 = y(from);
        const y2 = y(to);
        const rectY = Math.min(y1, y2);
        const rectH = Math.abs(y2 - y1);
        out += `
<g class="bar-item">
<rect x="${this.round(x)}" y="${this.round(rectY)}" width="${this.round(groupW)}" height="${this.round(rectH)}" fill="${palette[s % palette.length]}" opacity=".88">
<title>${this.escape(series.name)} : ${this.escape(this.formatAxis(value, init.yFormat))}</title>
</rect>`;
        if (init.valShow && value !== 0 && rectH > 10) {
          out += this.drawValueLabel(
            value,
            x + groupW / 2,
            rectY + rectH / 2 + 4,
            init
          );
        }
        out += '</g>';
      });
    }
    out += '</g>';
    return out;
  }

  static drawLines(model, init, layout, palette) {
    const { plotX, plotW, slotW, y } = layout;
    const n = model.labels.length;
    let out = '<g class="chart-lines">';
    model.series.forEach((series, s) => {
        const points = series.values.map((value, i) => {
        const x = n > 1 ? plotX + i * slotW : plotX + plotW / 2;
        return [x, y(value), value];
      });
      if (points.length) {
        const d = points
          .map((p, i) => `${i ? 'L' : 'M'}${this.round(p[0])},${this.round(p[1])}`)
          .join(' ');
        out += `<path class="line" d="${d}" stroke="${palette[s % palette.length]}"/>`;
        points.forEach(([x, yy, value]) => {
          out += `<circle cx="${this.round(x)}" cy="${this.round(yy)}" r="3" fill="${palette[s % palette.length]}"><title>${this.escape(series.name)} : ${this.escape(this.formatAxis(value, init.yFormat))}</title></circle>`;
          if (init.valShow && value !== 0) out += this.drawValueLabel(value, x, yy - 10, init);
        });
      }
    });
    out += '</g>';
    return out;
  }

  // ---------------------------------------------------------------------
  // Pie / donut
  // ---------------------------------------------------------------------

  static drawPie(model, init) {
    const id = ++this.uid;
    const palette = this.buildPalette(id, init);
    // Pie intentionally uses the first numeric series only.
    const series = model.series[0];
    const rows = model.labels
      .map((label, i) => ({ label, value: series.values[i] || 0 }))
      .filter(row => row.value > 0);
    if (init.sort === 'y') rows.sort((a, b) => b.value - a.value);
    if (!rows.length) return '';

    const donut = init.chart === 'donut' || init.pieDonut;
    const w = init.w;
    const titleSpace = init.title ? 24 : 0;
    const xTitleSpace = init.xTitle ? 20 : 0;
    const legend = this.resolvePieLegend(init, rows.length);
    let gapT = 9 + init.gapT + titleSpace + (legend.pos === 'T' ? 22 : 0);
    let gapB = 9 + init.gapB + xTitleSpace + (legend.pos === 'B' ? 22 : 0);
    let gapL = 9 + init.gapL + (legend.pos === 'L' ? legend.width : 0);
    let gapR = 9 + init.gapR + (legend.pos === 'R' ? legend.width : 0);
    const plotW = Math.max(1, w - gapL - gapR);
    const plotHBase = Math.max(1, init.h - gapT - gapB);
    const diameter = Math.min(plotW, plotHBase);
    const h = Math.max(init.h, gapT + diameter + gapB);
    const cx = gapL + plotW / 2;
    const cy = gapT + diameter / 2;
    const r = diameter / 2;
    const total = rows.reduce((n, row) => n + row.value, 0);
    let svg = this.svgOpen(w, h);
    svg += this.defs(id);
    svg += this.css(init.style);
    svg += this.drawTitle(init, w);
    let angle = Number(init.pieArc) || -90;
    svg += '<g class="pie">';
    rows.forEach((row, i) => {
      const portion = row.value / total;
      const sweep = portion * 360;
      const start = angle;
      const end = angle + sweep;
      const fill = palette[i % palette.length];
      if (sweep >= 359.999) {
        svg += `<circle cx="${this.round(cx)}" cy="${this.round(cy)}" r="${this.round(r)}" fill="${fill}"><title>${this.escape(row.label)} : ${this.escape(this.formatAxis(row.value, init.yFormat))} (100%)</title></circle>`;
      } else {
        const path = this.piePath(cx, cy, r, start, end);
        svg += `<path d="${path}" fill="${fill}" stroke="#fff" stroke-width="1"><title>${this.escape(row.label)} : ${this.escape(this.formatAxis(row.value, init.yFormat))} (${Math.round(portion * 100)}%)</title></path>`;
      }
      if (init.valShow || init.piePct) {
        const mid = (start + end) / 2;
        const p = this.polar(cx, cy, r * 0.62, mid);
        let text = '';
        if (init.valShow) text += this.formatAxis(row.value, init.yFormat);
        if (init.piePct) {
          const pct = `${Math.round(portion * 100)}%`;
          text += text ? ` (${pct})` : pct;
        }
        svg += `<text class="pie-value" x="${this.round(p.x)}" y="${this.round(p.y + 4)}">${this.escape(text)}</text>`;
      }
      angle = end;
    });

    if (init.pieStripe) {
      [0.73, 0.36].forEach(scale => {
        svg += `<circle cx="${this.round(cx)}" cy="${this.round(cy)}" r="${this.round(r * scale)}" class="pie-stripe"/>`;
      });
      svg += `<circle cx="${this.round(cx)}" cy="${this.round(cy)}" r="${this.round(r * 0.09)}" class="pie-stripe-core"/>`;
    }
    if (donut) svg += `<circle cx="${this.round(cx)}" cy="${this.round(cy)}" r="${this.round(r * 0.45)}" class="pie-hole"/>`;
    svg += '</g>';
    if (init.xTitle) svg += `<text class="chart-title-x" x="${this.round(w / 2)}" y="${this.round(h - 5)}">${this.escape(init.xTitle)}</text>`;

    svg += this.drawPieLegend(rows, legend, palette, {
      w, h, gapL, gapR, gapT, gapB, cx, cy, r
    });
    svg += '</svg>';
    return svg;
  }

  static resolvePieLegend(init, count) {
    let pos = String(init.legend ?? '').toUpperCase();
    if (!pos) pos = 'R';
    if (!['0', 'T', 'B', 'L', 'R'].includes(pos)) pos = 'R';
    return { pos, width: Math.max(60, init.legendW || 80) };
  }

  static drawPieLegend(rows, legend, palette, box) {
    if (legend.pos === '0') return '';
    let out = '<g class="chart-legend">';
    if (legend.pos === 'T' || legend.pos === 'B') {
      const y = legend.pos === 'T' ? 26 : box.h - 12;
      const itemW = box.w / Math.max(1, rows.length);
      rows.forEach((row, i) => {
        const x = i * itemW + 8;
        out += `<circle cx="${this.round(x + 5)}" cy="${this.round(y - 4)}" r="5" fill="${palette[i % palette.length]}"/><text x="${this.round(x + 14)}" y="${this.round(y)}">${this.escape(row.label)}</text>`;
      });
    } else {
      const x = legend.pos === 'L' ? 10 : box.w - legend.width + 8;
      let y = box.gapT + 10;
      rows.forEach((row, i) => {
        out += `<circle cx="${this.round(x + 5)}" cy="${this.round(y - 4)}" r="5" fill="${palette[i % palette.length]}"/><text x="${this.round(x + 14)}" y="${this.round(y)}">${this.escape(row.label)}</text>`;
        y += 18;
      });
    }
    out += '</g>';
    return out;
  }

  static piePath(cx, cy, r, startDeg, endDeg) {
    const p1 = this.polar(cx, cy, r, startDeg);
    const p2 = this.polar(cx, cy, r, endDeg);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return [
      `M${this.round(cx)},${this.round(cy)}`,
      `L${this.round(p1.x)},${this.round(p1.y)}`,
      `A${this.round(r)},${this.round(r)} 0 ${large},1 ${this.round(p2.x)},${this.round(p2.y)}`,
      'Z'
    ].join(' ');
  }

  static polar(cx, cy, r, deg) {
    const rad = deg * Math.PI / 180;
    return { x: cx + Math.cos(rad) * r, y: cy + Math.sin(rad) * r };
  }

  // ---------------------------------------------------------------------
  // Shared labels / legend
  // ---------------------------------------------------------------------

  static drawTitle(init, w) {
    if (!init.title) return '';

    let x = w / 2;
    let anchor = 'middle';
    if (init.titleAlign === 1) {
      x = 5;
      anchor = 'start';
    } else if (init.titleAlign === 3) {
      x = w - 5;
      anchor = 'end';
    }
    return `<text class="chart-title-main" x="${this.round(x)}" y="16" text-anchor="${anchor}">${this.escape(init.title)}</text>`;
  }

  static drawAxisTitles(init, layout) {
    let out = '';
    const { w, h, plotX, plotY, plotW, plotH } = layout;
    if (init.xTitle) {
      let x = w / 2;
      let anchor = 'middle';
      if (init.xTitleAlign === 1) {
        x = 5;
        anchor = 'start';
      } else if (init.xTitleAlign === 3) {
        x = w - 5;
        anchor = 'end';
      }
      out += `<text class="chart-title-x" x="${this.round(x)}" y="${this.round(h - 5)}" text-anchor="${anchor}">${this.escape(init.xTitle)}</text>`;
    }
    if (init.yTitle) {
      let yy = plotY + plotH / 2;
      let anchor = 'middle';
      if (init.yTitleAlign === 1) {
        yy = plotY + plotH;
        anchor = 'start';
      } else if (init.yTitleAlign === 3) {
        yy = plotY;
        anchor = 'end';
      }
      out += `<g transform="translate(15,${this.round(yy)}) rotate(-90)"><text text-anchor="${anchor}">${this.escape(init.yTitle)}</text></g>`;
    }
    return out;
  }

  static drawLegend(model, init, legend, palette) {
    if (legend.pos === '0' || model.series.length < 2) return '';

    const { plotX, plotY, plotW, plotH } = legend;
    let out = '<g class="chart-legend">';
    if (legend.pos === 'T' || legend.pos === 'B') {
      const y = legend.pos === 'T' ? plotY - 10 : plotY + plotH + 42;
      let x = plotX;
      model.series.forEach((s, i) => {
        out += `<circle cx="${this.round(x + 5)}" cy="${this.round(y - 4)}" r="5" fill="${palette[i % palette.length]}"/><text x="${this.round(x + 14)}" y="${this.round(y)}">${this.escape(s.name)}</text>`;
        x += 28 + s.name.length * 7;
      });
    } else {
      const x = legend.pos === 'L' ? Math.max(8, plotX - legend.width + 8) : plotX + plotW + 10;
      let y = plotY + 10;
      model.series.forEach((s, i) => {
        out += `<circle cx="${this.round(x + 5)}" cy="${this.round(y - 4)}" r="5" fill="${palette[i % palette.length]}"/><text x="${this.round(x + 14)}" y="${this.round(y)}">${this.escape(s.name)}</text>`;
        y += 18;
      });
    }
    out += '</g>';
    return out;
  }

  static drawValueLabel(value, x, y, init) {
    const text = this.escape(this.formatAxis(value, init.yFormat));
    if (!init.valAngle) return `<text class="chart-value" x="${this.round(x)}" y="${this.round(y)}">${text}</text>`;
    return `<g transform="translate(${this.round(x)},${this.round(y)}) rotate(${init.valAngle})"><text class="chart-value angled">${text}</text></g>`;
  }

  // ---------------------------------------------------------------------
  // Scale / format
  // ---------------------------------------------------------------------

  static niceScale(min, max, maxTicks = 6) {
    if (!Number.isFinite(min)) min = 0;
    if (!Number.isFinite(max)) max = 1;
    if (min === max) {
      if (min === 0) {
        max = 1;
      } else if (min > 0) {
        min = 0;
        max *= 1.1;
      } else {
        max = 0;
        min *= 1.1;
      }
    }
    const range = this.niceNumber(max - min, false);
    const step = this.niceNumber(range / Math.max(1, maxTicks - 1), true);
    const niceMin = Math.floor(min / step) * step;
    const niceMax = Math.ceil(max / step) * step;
    const ticks = [];
    for (let v = niceMin; v <= niceMax + step / 2; v += step) ticks.push(this.round(v));
    return { min: niceMin, max: niceMax, step, ticks };
  }

  static niceNumber(range, round) {
    if (!range || !Number.isFinite(range)) return 1;

    const exponent = Math.floor(Math.log10(Math.abs(range)));
    const fraction = range / Math.pow(10, exponent);
    let niceFraction;
    if (round) {
      if (fraction < 1.5) niceFraction = 1;
      else if (fraction < 3) niceFraction = 2;
      else if (fraction < 7) niceFraction = 5;
      else niceFraction = 10;
    } else {
      if (fraction <= 1) niceFraction = 1;
      else if (fraction <= 2) niceFraction = 2;
      else if (fraction <= 5) niceFraction = 5;
      else niceFraction = 10;
    }
    return niceFraction * Math.pow(10, exponent);
  }

  static formatAxis(value, format) {
    if (!format) return String(value);

    const parts = String(format).split('|');
    const type = parts[0];
    if (type === 'format') {
      const digits = Math.max(0, Math.ceil(Number(parts[1] || 0)));
      const decimal = parts[2] !== undefined ? parts[2] : '.';
      const thousand = parts[3] !== undefined ? parts[3] : ',';
      const n = Number(value);
      if (!Number.isFinite(n)) return String(value);

      const fixed = n.toFixed(digits);
      let [a, b] = fixed.split('.');
      a = a.replace(/\B(?=(\d{3})+(?!\d))/g, thousand);
      return b !== undefined && digits ? a + decimal + b : a;
    }
    if (type === 'substr') {
      const start = Math.ceil(Number(parts[1] || 0));
      const len = parts[2] !== undefined ? Math.ceil(Number(parts[2])) : undefined;
      return len === undefined ? String(value).substring(start) : String(value).substr(start, len);
    }
    if (type === 'date') {
      const d = this.parseDate(value);
      if (!d) return String(value);
      return this.formatDate(d, parts[1] || 'Y-m-d');
    }
    return String(value);
  }

  static parseDate(value) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // Small PHP-date-format compatibility subset.
  static formatDate(date, fmt) {
    const pad = n => String(n).padStart(2, '0');
    const map = {
      Y: date.getFullYear(),
      y: String(date.getFullYear()).slice(-2),
      m: pad(date.getMonth() + 1),
      n: date.getMonth() + 1,
      d: pad(date.getDate()),
      j: date.getDate(),
      H: pad(date.getHours()),
      G: date.getHours(),
      i: pad(date.getMinutes())
    };
    return String(fmt).replace(/[YymndjHGi]/g, token => map[token]);
  }

  // ---------------------------------------------------------------------
  // Palette
  // ---------------------------------------------------------------------

  static buildPalette(id, init) {
    const palette = this.gradientPairs.map((_, i) => `url(#chart-${id}-grad-${i})`);
    this.solidColors.forEach(c => palette.push(c));
    const customFront = this.parseColorList(init.color);
    const customBack = this.parseColorList(init.colorAdd);
    let result = [...customFront, ...palette];
    const del = String(init.colorDel || '')
      .split(',')
      .map(v => Number(v.trim()))
      .filter(Number.isInteger)
      .sort((a, b) => b - a);
    del.forEach(index => {
      if (index >= 0 && index < result.length) result.splice(index, 1);
    });
    result.push(...customBack);
    return result.length ? result : ['#777'];
  }

  static parseColorList(value) {
    if (!value) return [];
    return String(value)
      .split(',')
      .map(v => v.trim())
      .filter(Boolean)
      .map(v => {
        if (v.startsWith('#') || v.startsWith('url(') || v.startsWith('rgb') || v.startsWith('hsl')) return v;
        return '#' + v.replace(/^#/, '').slice(0, 6);
      });
  }

  static defs(id) {
    let out = '<defs>';
    this.gradientPairs.forEach((c, i) => {
      out += `<linearGradient id="chart-${id}-grad-${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#${c[0]}"/><stop offset="100%" stop-color="#${c[1]}"/></linearGradient>`;
    });
    out += '</defs>';
    return out;
  }

  // ---------------------------------------------------------------------
  // SVG / CSS / helpers
  // ---------------------------------------------------------------------

  static svgOpen(w, h) {
    return `<svg class="chart-svg" viewBox="0 0 ${w} ${h}" width="100%" xmlns="http://www.w3.org/2000/svg" role="img">`;
  }

  static css(extra = '') {
    return `<style>
.chart-svg{display:block;overflow:visible}
.chart-svg text{font-family:Helvetica,Arial,Verdana,sans-serif;font-size:12px;fill:#666}
.chart-tick line{stroke:#ddd;stroke-width:1;stroke-dasharray:5 5}
.axisY text{text-anchor:end}
.axisX text{text-anchor:middle}
.axisX .x-angle{text-anchor:start}
.chart-separator{stroke:#f0f0f0;stroke-width:1;stroke-dasharray:5 5}
.chart-axis{stroke:#aaa;stroke-width:1}
.chart-zero{stroke:#aaa;stroke-width:1}
.chart-svg .line{fill:none;stroke-width:2}
.chart-svg circle{stroke:#eee;stroke-width:1.5}
.chart-title-main{font-size:14px;font-weight:bold}
.chart-title-x{text-anchor:middle}
.chart-value{text-anchor:middle;font-size:10px;fill:#765}
.chart-value.angled{text-anchor:start}
.chart-legend text{font-size:11px}
.pie-value{text-anchor:middle;font-size:11px;fill:#fff;stroke-width:.5}
.pie .pie-value{fill:#fff}
.pie-stripe{fill:none;stroke:#fff;stroke-width:8;opacity:.2}
.pie-stripe-core{fill:#fff;stroke:none;opacity:.2}
.pie-hole{fill:#eee;stroke:none}
.bar-item rect{transition:opacity .12s ease}
.bar-item:hover rect{opacity:.72}
.axisY line{stroke:#e8e8e8;stroke-width:.6}
${extra || ''}
</style>`;
  }

  static round(v) { return Math.round(Number(v) * 1000) / 1000; }

  static escape(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }
}

// Browser auto-render.
if (typeof window !== 'undefined') {
  window.Chart = Chart;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Chart.renderAll());
  } else {
    Chart.renderAll();
  }
}