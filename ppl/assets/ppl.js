(function () {
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* reveal figures that start below the fold */
  if (!reduced && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('rv-in'); e.target.classList.remove('rv-pending'); io.unobserve(e.target); }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -5% 0px' });
    document.querySelectorAll('.rv').forEach(function (el) {
      if (el.getBoundingClientRect().top > window.innerHeight) { el.classList.add('rv-pending'); io.observe(el); }
    });
  }

  /* cover loop: only with motion allowed and no data saver; the poster stays otherwise */
  var cv = document.querySelector('.cover video');
  var conn = navigator.connection || {};
  if (cv && !reduced && !conn.saveData) {
    cv.addEventListener('playing', function () { cv.classList.add('on'); }, { once: true });
    cv.preload = 'auto';
    var p = cv.play();
    if (p && p.catch) p.catch(function () {});
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        if (es[0].isIntersecting) { var q = cv.play(); if (q && q.catch) q.catch(function () {}); } else cv.pause();
      }).observe(cv);
    }
  }

  /* lightbox for every photo on the page */
  var buttons = Array.prototype.slice.call(document.querySelectorAll('[data-full]'));
  if (!buttons.length) return;
  var lb = document.createElement('div');
  lb.className = 'lb'; lb.hidden = true;
  lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true'); lb.setAttribute('aria-label', 'Photo viewer');
  lb.innerHTML = '<div class="bar"><span class="count"></span><button type="button" class="close">Close</button></div>' +
    '<div class="stage"><img alt=""></div><p class="cap"></p>' +
    '<button type="button" class="prev" aria-label="Previous photo">←</button><button type="button" class="nextb" aria-label="Next photo">→</button>';
  document.body.appendChild(lb);
  var img = lb.querySelector('img'), cap = lb.querySelector('.cap'), count = lb.querySelector('.count');
  var i = 0, last = null;

  function show(n) {
    i = (n + buttons.length) % buttons.length;
    var b = buttons[i];
    img.src = b.getAttribute('data-full');
    img.alt = b.querySelector('img').alt;
    img.style.animation = 'none'; void img.offsetWidth; img.style.animation = '';
    cap.textContent = b.getAttribute('data-cap') || '';
    count.textContent = (i + 1) + ' / ' + buttons.length;
    /* preload the neighbours so next/previous is instant */
    [i + 1, i - 1].forEach(function (k) {
      new Image().src = buttons[(k + buttons.length) % buttons.length].getAttribute('data-full');
    });
  }
  function open(n) { last = document.activeElement; show(n); lb.hidden = false; document.body.style.overflow = 'hidden'; lb.querySelector('.close').focus(); }
  function close() { lb.hidden = true; document.body.style.overflow = ''; if (last) last.focus(); }

  buttons.forEach(function (b, n) { b.addEventListener('click', function () { open(n); }); });
  lb.querySelector('.close').addEventListener('click', close);
  lb.querySelector('.prev').addEventListener('click', function () { show(i - 1); });
  lb.querySelector('.nextb').addEventListener('click', function () { show(i + 1); });
  lb.querySelector('.stage').addEventListener('click', function (e) { if (e.target === e.currentTarget) close(); });
  /* on document so keys still work after a click on the photo moves focus to the page */
  document.addEventListener('keydown', function (e) {
    if (lb.hidden) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'Tab') {
      /* keep focus inside the viewer: Close, Previous, Next */
      var f = lb.querySelectorAll('button'), first = f[0], end = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || !lb.contains(document.activeElement))) { e.preventDefault(); end.focus(); }
      else if (!e.shiftKey && (document.activeElement === end || !lb.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
    }
    else if (e.key === 'ArrowRight') show(i + 1);
    else if (e.key === 'ArrowLeft') show(i - 1);
  });
  var sx = null;
  lb.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', function (e) {
    if (sx === null) return;
    var dx = e.changedTouches[0].clientX - sx;
    if (Math.abs(dx) > 50) show(i + (dx < 0 ? 1 : -1));
    sx = null;
  });
})();
