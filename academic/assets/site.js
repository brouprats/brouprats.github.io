(function () {
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(pointer: fine)').matches;

  /* reveal: only elements that start below the fold get hidden, so the first frame is complete */
  var rvObs = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('rv-in'); e.target.classList.remove('rv-pending'); rvObs.unobserve(e.target); }
    });
  }, { threshold: 0.12 }) : null;
  if (!reduced && rvObs) {
    document.querySelectorAll('.rv').forEach(function (el) {
      if (el.getBoundingClientRect().top > window.innerHeight) { el.classList.add('rv-pending'); rvObs.observe(el); }
    });
  }

  /* animated bars */
  var barObs = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); barObs.unobserve(e.target); } });
  }, { threshold: 0.3 }) : null;
  if (!reduced && barObs) {
    document.querySelectorAll('.bars').forEach(function (el) {
      if (el.getBoundingClientRect().top > window.innerHeight) { el.classList.add('bars-anim'); barObs.observe(el); }
    });
  }

  /* hover preview that follows the cursor on the project list */
  var pv = document.querySelector('.preview');
  if (pv && fine && !reduced) {
    var x = 0, y = 0, tx = 0, ty = 0, raf = null;
    var tick = function () {
      x += (tx - x) * 0.18; y += (ty - y) * 0.18;
      pv.style.transform = 'translate3d(' + (x + 28) + 'px,' + (y - 110) + 'px,0) scale(' + (pv.classList.contains('on') ? 1 : .92) + ')';
      raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.3 ? requestAnimationFrame(tick) : null;
    };
    document.querySelectorAll('[data-preview]').forEach(function (row) {
      row.addEventListener('pointerenter', function (e) {
        var id = row.getAttribute('data-preview');
        pv.querySelectorAll('[data-pv]').forEach(function (n) { n.classList.toggle('on', n.getAttribute('data-pv') === id); });
        if (!pv.classList.contains('on')) { x = tx = e.clientX; y = ty = e.clientY; }
        pv.classList.add('on'); if (!raf) raf = requestAnimationFrame(tick);
      });
      row.addEventListener('pointermove', function (e) { tx = e.clientX; ty = e.clientY; if (!raf) raf = requestAnimationFrame(tick); });
      row.addEventListener('pointerleave', function () { pv.classList.remove('on'); if (!raf) raf = requestAnimationFrame(tick); });
    });
  }

  /* copy e-mail */
  document.querySelectorAll('[data-copy]').forEach(function (b) {
    b.addEventListener('click', function () {
      var t = b.getAttribute('data-copy');
      var done = function () { var o = b.textContent; b.textContent = 'Copied'; setTimeout(function () { b.textContent = o; }, 1400); };
      try {
        navigator.clipboard.writeText(t).then(done, function () { selectText(b.previousElementSibling); });
      } catch (err) { selectText(b.previousElementSibling); }
    });
  });
  function selectText(el) { if (!el) return; var r = document.createRange(); r.selectNodeContents(el); var s = getSelection(); s.removeAllRanges(); s.addRange(r); }

  /* equity charts from real exported data */
  var NS = 'http://www.w3.org/2000/svg';
  function mk(tag, attrs, parent) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
  function pct(v) { return (v * 100).toFixed(1) + '%'; }

  document.querySelectorAll('[data-chart]').forEach(function (box) {
    fetch(box.getAttribute('data-chart')).then(function (r) { return r.json(); }).then(function (data) { draw(box, data); })
      .catch(function () { box.innerHTML = '<p class="note">Chart data could not be loaded.</p>'; });
  });

  /* forecast chart: actual vs ARIMA (95% band) vs LSTMs, with toggles */
  document.querySelectorAll('[data-forecast]').forEach(function (box) {
    fetch(box.getAttribute('data-forecast')).then(function (r) { return r.json(); }).then(function (data) { forecast(box, data); })
      .catch(function () { box.innerHTML = '<p class="note">Chart data could not be loaded.</p>'; });
  });

  function forecast(box, data) {
    var W = 1000, H = 420, L = 52, R = 12, T = 10, B = 30;
    var n = data.d.length;
    var keys = ['actual', 'arima', 'lstm_uni_1', 'lstm_uni_3', 'lstm_uni_6'];
    var names = { actual: 'Actual', arima: 'ARIMA(1,1,1)', lstm_uni_1: 'LSTM, 1 month', lstm_uni_3: 'LSTM, 3 months', lstm_uni_6: 'LSTM, 6 months' };
    var all = [].concat(data.actual, data.arima_lo95, data.arima_hi95, data.lstm_uni_1, data.lstm_uni_3, data.lstm_uni_6);
    var lo = Math.floor(Math.min.apply(null, all) / 500) * 500, hi = Math.ceil(Math.max.apply(null, all) / 500) * 500;
    var X = function (i) { return L + i / (n - 1) * (W - L - R); };
    var Y = function (v) { return T + (hi - v) / (hi - lo) * (H - T - B); };
    var line = function (arr) { return arr.map(function (v, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1); }).join(''); };

    var svg = mk('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'S&P 500 monthly level from January 2018 to December 2023, actual against ARIMA forecast with 95% interval and three univariate LSTM forecasts' });
    for (var v = lo; v <= hi; v += 500) {
      mk('line', { class: 'grid-l', x1: L, x2: W - R, y1: Y(v), y2: Y(v) }, svg);
      mk('text', { class: 'axis', x: L - 8, y: Y(v) + 4, 'text-anchor': 'end' }, svg).textContent = v.toLocaleString('en-US');
    }
    data.d.forEach(function (d, i) {
      if (d.slice(5, 7) === '01') {
        mk('line', { class: 'grid-l', x1: X(i), x2: X(i), y1: T, y2: H - B }, svg);
        mk('text', { class: 'axis', x: X(i), y: H - 8, 'text-anchor': 'middle' }, svg).textContent = d.slice(0, 4);
      }
    });
    var band = 'M' + data.arima_hi95.map(function (v, i) { return X(i).toFixed(1) + ' ' + Y(v).toFixed(1); }).join('L') +
      'L' + data.arima_lo95.map(function (v, i) { return [i, v]; }).reverse().map(function (p) { return X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1); }).join('L') + 'Z';
    var layers = {};
    layers.arima = mk('g', {}, svg);
    mk('path', { class: 'band', d: band }, layers.arima);
    ['lstm_uni_1', 'lstm_uni_3', 'lstm_uni_6'].forEach(function (k) { layers[k] = mk('g', {}, svg); mk('path', { class: 'fl ' + k, d: line(data[k]) }, layers[k]); });
    mk('path', { class: 'fl arima', d: line(data.arima) }, layers.arima);
    layers.actual = mk('g', {}, svg); mk('path', { class: 'fl actual', d: line(data.actual) }, layers.actual);
    var xh = mk('line', { class: 'xh', x1: 0, x2: 0, y1: T, y2: H - B, opacity: 0 }, svg);
    box.appendChild(svg);
    var tip = document.createElement('div'); tip.className = 'tip'; box.appendChild(tip);

    var legend = document.querySelector('[data-legend-for="' + box.id + '"]');
    if (legend) legend.querySelectorAll('button[data-k]').forEach(function (b) {
      b.addEventListener('click', function () {
        var on = b.getAttribute('aria-pressed') !== 'true';
        b.setAttribute('aria-pressed', on); layers[b.getAttribute('data-k')].style.display = on ? '' : 'none';
      });
    });

    box.addEventListener('pointermove', function (e) {
      var r = box.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width * W;
      var i = Math.max(0, Math.min(n - 1, Math.round((px - L) / (W - L - R) * (n - 1))));
      xh.setAttribute('x1', X(i)); xh.setAttribute('x2', X(i)); xh.setAttribute('opacity', 1);
      var rows = keys.filter(function (k) { return layers[k].style.display !== 'none'; }).map(function (k) {
        return '<div' + (k === 'actual' ? '' : ' class="muted"') + '>' + names[k] + ' <b>' + Math.round(data[k][i]).toLocaleString('en-US') + '</b></div>';
      }).join('');
      tip.innerHTML = '<div>' + data.d[i].slice(0, 7) + '</div>' + rows;
      var left = X(i) / W * r.width;
      tip.style.left = (left + 12 + tip.offsetWidth > r.width ? Math.max(left - tip.offsetWidth - 12, 0) : left + 12) + 'px';
      tip.classList.add('on');
    });
    box.addEventListener('pointerleave', function () { xh.setAttribute('opacity', 0); tip.classList.remove('on'); });
  }

  function draw(box, data) {
    var W = 1000, H = 420, L = 44, R = 12, T = 8, mainH = 290, gap = 26, ddH = 70;
    var n = data.d.length;
    var t0 = Date.parse(data.d[0]), t1 = Date.parse(data.d[n - 1]);
    var X = function (i) { return L + (Date.parse(data.d[i]) - t0) / (t1 - t0) * (W - L - R); };
    var vmax = Math.max(Math.max.apply(null, data.s), Math.max.apply(null, data.b));
    var top = Math.ceil(vmax);
    var Y = function (v) { return T + mainH - (v - 0) / top * mainH; };
    var dd = function (arr) { var m = -Infinity; return arr.map(function (v) { m = Math.max(m, v); return v / m - 1; }); };
    var ds = dd(data.s), db = dd(data.b);
    var ddMin = Math.min(Math.min.apply(null, ds), Math.min.apply(null, db));
    var ddFloor = Math.floor(ddMin * 10) / 10;
    var dy0 = T + mainH + gap;
    var DY = function (v) { return dy0 + (v / ddFloor) * ddH; };

    var svg = mk('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': data.labels[0] + ' versus ' + data.labels[1] + ', growth of 1 and drawdown' });
    var step = top <= 3 ? 0.5 : top <= 6 ? 1 : 2;
    for (var v = step; v <= top + 1e-9; v += step) {
      mk('line', { class: 'grid-l', x1: L, x2: W - R, y1: Y(v), y2: Y(v), 'vector-effect': 'non-scaling-stroke' }, svg);
      mk('text', { class: 'axis', x: L - 8, y: Y(v) + 4, 'text-anchor': 'end' }, svg).textContent = (v % 1 ? v.toFixed(1) : v) + '×';
    }
    mk('line', { class: 'grid-l', x1: L, x2: W - R, y1: Y(1), y2: Y(1), 'vector-effect': 'non-scaling-stroke' }, svg);
    var y0 = new Date(t0).getFullYear(), y1 = new Date(t1).getFullYear();
    for (var yr = Math.ceil(y0 / 4) * 4; yr <= y1; yr += 4) {
      var tx = L + (Date.parse(yr + '-01-01') - t0) / (t1 - t0) * (W - L - R);
      if (tx < L + 10) continue;
      mk('line', { class: 'grid-l', x1: tx, x2: tx, y1: T, y2: dy0 + ddH, 'vector-effect': 'non-scaling-stroke' }, svg);
      mk('text', { class: 'axis', x: tx, y: H - 4, 'text-anchor': 'middle' }, svg).textContent = yr;
    }
    // drawdown panel
    mk('text', { class: 'axis', x: L - 8, y: dy0 + 4, 'text-anchor': 'end' }, svg).textContent = '0%';
    mk('text', { class: 'axis', x: L - 8, y: dy0 + ddH + 4, 'text-anchor': 'end' }, svg).textContent = Math.round(ddFloor * 100) + '%';
    var areaB = 'M' + X(0) + ' ' + dy0 + db.map(function (v, i) { return 'L' + X(i).toFixed(1) + ' ' + DY(v).toFixed(1); }).join('') + 'L' + X(n - 1) + ' ' + dy0 + 'Z';
    mk('path', { class: 'dd', d: areaB }, svg);
    mk('path', { class: 'dds', d: ds.map(function (v, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + DY(v).toFixed(1); }).join(''), 'vector-effect': 'non-scaling-stroke' }, svg);
    var g = mk('g', {}, svg);
    var pb = mk('path', { class: 'lb', d: data.b.map(function (v, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1); }).join(''), pathLength: 1000 }, g);
    var ps = mk('path', { class: 'ls', d: data.s.map(function (v, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1); }).join(''), pathLength: 1000 }, g);
    var xh = mk('line', { class: 'xh', x1: 0, x2: 0, y1: T, y2: dy0 + ddH, opacity: 0, 'vector-effect': 'non-scaling-stroke' }, svg);
    var dS = mk('circle', { class: 'xd', r: 4, cx: 0, cy: 0, opacity: 0 }, svg);
    box.appendChild(svg);

    var tip = document.createElement('div'); tip.className = 'tip'; box.appendChild(tip);

    if (!reduced && 'IntersectionObserver' in window && box.getBoundingClientRect().top > window.innerHeight) {
      g.style.setProperty('--len', 1000); g.classList.add('draw');
      var o = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { requestAnimationFrame(function () { g.classList.add('drawn'); }); o.disconnect(); } }, { threshold: 0.3 });
      o.observe(box);
    }

    box.addEventListener('pointermove', function (e) {
      var r = box.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width * W;
      var t = t0 + (px - L) / (W - L - R) * (t1 - t0);
      var lo = 0, hi = n - 1;
      while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (Date.parse(data.d[mid]) < t) lo = mid; else hi = mid; }
      var i = Math.abs(Date.parse(data.d[lo]) - t) < Math.abs(Date.parse(data.d[hi]) - t) ? lo : hi;
      var cx = X(i);
      xh.setAttribute('x1', cx); xh.setAttribute('x2', cx); xh.setAttribute('opacity', 1);
      dS.setAttribute('cx', cx); dS.setAttribute('cy', Y(data.s[i])); dS.setAttribute('opacity', 1);
      tip.innerHTML = '<div>' + data.d[i] + '</div><div>' + data.labels[0] + ' <b>' + data.s[i].toFixed(2) + '×</b> · dd ' + pct(ds[i]) + '</div><div class="muted">' + data.labels[1] + ' ' + data.b[i].toFixed(2) + '× · dd ' + pct(db[i]) + '</div>';
      var left = cx / W * r.width;
      tip.style.left = Math.min(Math.max(left + 12, 0), r.width - tip.offsetWidth) + 'px';
      if (left + 12 + tip.offsetWidth > r.width) tip.style.left = Math.max(left - tip.offsetWidth - 12, 0) + 'px';
      tip.classList.add('on');
    });
    box.addEventListener('pointerleave', function () { xh.setAttribute('opacity', 0); dS.setAttribute('opacity', 0); tip.classList.remove('on'); });
  }
})();
