(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(pointer: fine)').matches;

  // header
  const hdr = $('.hdr');
  const onScroll = () => hdr.classList.toggle('is-scrolled', scrollY > 40);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  // mobile menu
  const burger = $('.burger');
  burger?.addEventListener('click', () => {
    const open = document.body.classList.toggle('menu-open');
    burger.setAttribute('aria-expanded', open);
  });
  $$('.nav a').forEach(a => a.addEventListener('click', () => {
    document.body.classList.remove('menu-open'); burger?.setAttribute('aria-expanded', false);
  }));

  // reveal
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { rootMargin: '0px 0px -12% 0px' });
  $$('[data-reveal]').forEach(el => io.observe(el));

  // hero slideshow (non-active slides load lazily after LCP)
  const slides = $$('.hero__media img'), dots = $$('.hero__dots button');
  if (slides.length > 1) {
    let i = 0, t;
    const go = n => {
      slides[i].classList.remove('is-active'); dots[i]?.setAttribute('aria-current', 'false');
      i = (n + slides.length) % slides.length;
      slides[i].classList.add('is-active'); dots[i]?.setAttribute('aria-current', 'true');
    };
    const play = () => { if (!reduce) t = setInterval(() => go(i + 1), 6500); };
    dots.forEach((d, n) => d.addEventListener('click', () => { clearInterval(t); go(n); play(); }));
    addEventListener('load', () => setTimeout(play, 1500));
  }

  // sticky story
  const imgs = $$('.story__media img'), steps = $$('.step');
  if (steps.length) {
    const so = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      const n = +e.target.dataset.step;
      steps.forEach(s => s.classList.toggle('is-active', s === e.target));
      imgs.forEach((im, k) => im.classList.toggle('is-active', k === n));
    }), { rootMargin: '-45% 0px -45% 0px' });
    steps.forEach(s => so.observe(s));
  }

  if (fine && !reduce) {
    // cursor glow
    const g = document.createElement('div'); g.className = 'glow'; g.setAttribute('aria-hidden', 'true');
    document.body.append(g);
    let x = 0, y = 0, cx = 0, cy = 0, raf;
    const loop = () => { cx += (x - cx) * .12; cy += (y - cy) * .12; g.style.transform = `translate(${cx}px,${cy}px)`; raf = requestAnimationFrame(loop); };
    addEventListener('pointermove', e => { x = e.clientX; y = e.clientY; if (!raf) { g.classList.add('on'); loop(); } }, { passive: true });

    // magnetic buttons
    $$('.btn').forEach(b => {
      b.addEventListener('pointermove', e => {
        const r = b.getBoundingClientRect();
        b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .18}px,${(e.clientY - r.top - r.height / 2) * .25}px)`;
      });
      b.addEventListener('pointerleave', () => { b.style.transform = ''; });
    });
  }
})();

// map sheet
(() => {
  const d = document.getElementById('mapsheet'), btn = document.querySelector('.fab--map');
  if (!d || !btn) return;
  const ifr = d.querySelector('iframe');
  const open = () => { if (!ifr.src) ifr.src = ifr.dataset.src; d.showModal(); document.documentElement.style.overflow = 'hidden'; };
  const close = () => { d.classList.add('closing'); setTimeout(() => { d.classList.remove('closing'); d.close(); }, 280); };
  btn.addEventListener('click', open);
  d.querySelector('.mapsheet__x').addEventListener('click', close);
  d.addEventListener('click', e => { if (e.target === d) close(); });
  d.addEventListener('cancel', e => { e.preventDefault(); close(); });
  d.addEventListener('close', () => { document.documentElement.style.overflow = ''; btn.focus(); });
})();

// ---- قياس التفاعل: واتساب، الخريطة، الاتصال ----
// ترسل أحداثاً إلى GA4 إن كان الوسم مركّباً، وتبقى صامتة تماماً إن لم يكن.
(() => {
  const send = (name, params) => {
    if (typeof window.gtag !== 'function') return;
    window.gtag('event', name, params);
  };

  // مصدر النقرة: اسم القسم الأقرب أو الزر العائم
  const where = el => {
    if (el.closest('.fab')) return 'fab';
    const s = el.closest('section[id]');
    return (s && s.id) || 'page';
  };

  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if (a) {
      const href = a.getAttribute('href') || '';
      if (href.includes('wa.me')) {
        // رقم الحجز 962796892705 مقابل رقم الخدمة المنزلية 962790690117
        const home = href.includes('962790690117');
        send('whatsapp_click', {
          link_url: href.split('?')[0],
          wa_number: home ? 'home_service' : 'booking',
          location: where(a),
          page_path: location.pathname
        });
        return;
      }
      if (/google\.[a-z.]+\/maps|maps\.app\.goo\.gl|maps\.google\./.test(href)) {
        send('location_click', {
          link_url: href.split('?')[0],
          method: href.includes('dir/?api=1') ? 'directions' : 'map',
          location: where(a),
          page_path: location.pathname
        });
        return;
      }
      if (href.startsWith('tel:')) {
        send('phone_click', { phone: href.replace('tel:', ''), location: where(a), page_path: location.pathname });
        return;
      }
    }
    // الزر العائم للخريطة يفتح نافذة لا رابطاً
    if (e.target.closest('.fab--map')) {
      send('location_click', { method: 'map_sheet', location: 'fab', page_path: location.pathname });
    }
  }, { capture: true });
})();
