(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const B = window.BUNNIE || {};
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const vnd = (n) => n.toLocaleString('vi-VN') + 'đ';
  const short = (n) => (n >= 1e6 ? (n / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 2 }) + 'tr' : Math.round(n / 1000) + 'k');
  const range = (a, b) => (a === b ? vnd(a) : `${vnd(a)} – ${vnd(b)}`);

  /* ---------- Bảo vệ ảnh: chặn chuột phải & kéo thả ---------- */
  document.addEventListener('contextmenu', (e) => { if (e.target.closest('img, video, .gallery, .strip, .lightbox')) e.preventDefault(); });
  document.addEventListener('dragstart', (e) => { if (e.target.closest('img, video')) e.preventDefault(); });

  /* ---------- Header ---------- */
  const header = $('[data-header]');
  const onScroll = () => header && header.classList.toggle('is-scrolled', scrollY > 8);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  const navBtn = $('[data-nav-toggle]'), navList = $('[data-nav-list]');
  if (navBtn) {
    navBtn.addEventListener('click', () => {
      const open = navBtn.getAttribute('aria-expanded') !== 'true';
      navBtn.setAttribute('aria-expanded', open); navList.classList.toggle('is-open', open);
    });
    navList.addEventListener('click', (e) => { if (e.target.closest('a')) { navBtn.setAttribute('aria-expanded', 'false'); navList.classList.remove('is-open'); } });
  }

  /* ---------- Video lười tải: chỉ phát khi trong khung nhìn ---------- */
  const vids = $$('video[data-autoplay]');
  const vio = new IntersectionObserver((ents) => ents.forEach((en) => {
    const v = en.target;
    if (en.isIntersecting) { if (!v.src) v.src = v.dataset.src; if (!reduce) v.play().catch(() => {}); }
    else v.pause();
  }), { rootMargin: '200px' });
  vids.forEach((v) => vio.observe(v));

  /* ---------- Màn LED đầu trang: luân phiên các clip ---------- */
  const led = $('[data-led]');
  if (led) {
    const clips = $$('.led-clip', led), dots = $$('.led-dots i', led);
    let i = 0;
    const play = (k) => {
      clips.forEach((c, j) => { c.classList.toggle('is-on', j === k); if (j !== k) c.pause(); });
      dots.forEach((d, j) => d.classList.toggle('on', j === k));
      const c = clips[k]; if (!c.src) c.src = c.dataset.src;
      c.currentTime = 0; if (!reduce) c.play().catch(() => {});
    };
    clips.forEach((c, j) => c.addEventListener('ended', () => { i = (j + 1) % clips.length; play(i); }));
    if (clips.length) {
      clips[0].src = clips[0].dataset.src;
      if (!reduce) setTimeout(() => play(0), 900);
      // Nếu clip quá dài: chuyển sau 9 giây
      setInterval(() => { if (!reduce && clips.length > 1) { i = (i + 1) % clips.length; play(i); } }, 9000);
    }
  }

  /* ---------- Trạng thái nhận đơn (theo lịch hôm nay) ---------- */
  let avail = { configured: false, days: {} };
  const availP = fetch('/api/availability').then((r) => r.json()).then((d) => (avail = d)).catch(() => avail);

  /* ---------- Popover "i" ---------- */
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-info]');
    if (!btn) return;
    const pop = btn.parentElement.querySelector('.info-pop');
    const open = btn.getAttribute('aria-expanded') !== 'true';
    btn.setAttribute('aria-expanded', open); pop.hidden = !open;
  });

  /* ---------- Bộ lọc sample ---------- */
  const filters = $('[data-filters]');
  if (filters) filters.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    $$('button', filters).forEach((x) => x.setAttribute('aria-selected', x === b));
    const f = b.dataset.filter;
    $$('.gallery-item').forEach((it) => (it.hidden = f !== 'all' && it.dataset.cat !== f));
  });

  /* ---------- Lightbox ---------- */
  const lb = $('[data-lb]'), stage = $('[data-lb-stage]');
  let lbIdx = 0, lastFocus = null;
  const items = () => $$('.gallery-item:not([hidden]) .gallery-btn');
  const show = (k) => {
    const list = items(); if (!list.length) return;
    lbIdx = (k + list.length) % list.length;
    const btn = list[lbIdx], img = $('img', btn), vid = $('video', btn), emb = $('[data-embed]', btn);
    stage.innerHTML = '';
    if (emb) { const f = document.createElement('iframe'); f.src = emb.dataset.embed; f.allow = 'autoplay; fullscreen'; f.allowFullscreen = true; f.title = 'Video sample'; f.className = 'lb-frame'; stage.append(f); }
    else if (img) { const im = new Image(); im.src = img.dataset.full; im.alt = img.alt; im.draggable = false; stage.append(im); }
    else { const v = document.createElement('video'); v.src = vid.dataset.src; v.controls = true; v.autoplay = !reduce; v.muted = true; v.loop = true; v.playsInline = true; v.setAttribute('controlsList', 'nodownload'); stage.append(v); }
  };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-lightbox]'); if (!b) return;
    lastFocus = b; lb.hidden = false; document.body.style.overflow = 'hidden';
    show(items().indexOf(b)); $('[data-lb-close]').focus();
  });
  const closeLb = () => { lb.hidden = true; stage.innerHTML = ''; document.body.style.overflow = ''; lastFocus && lastFocus.focus(); };
  if (lb) {
    $('[data-lb-close]').addEventListener('click', closeLb);
    $('[data-lb-prev]').addEventListener('click', () => show(lbIdx - 1));
    $('[data-lb-next]').addEventListener('click', () => show(lbIdx + 1));
    lb.addEventListener('click', (e) => { if (e.target === lb || e.target === stage) closeLb(); });
    document.addEventListener('keydown', (e) => {
      if (lb.hidden) return;
      if (e.key === 'Escape') closeLb(); if (e.key === 'ArrowLeft') show(lbIdx - 1); if (e.key === 'ArrowRight') show(lbIdx + 1);
    });
  }

  /* ---------- Tabs bảng giá ---------- */
  const tabs = $('[data-tabs]');
  const selectTab = (id, focus) => {
    $$('[data-tab]', tabs).forEach((t) => { const on = t.dataset.tab === id; t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1; if (on && focus) t.focus(); });
    $$('.price-panel').forEach((p) => (p.hidden = p.id !== 'panel-' + id));
  };
  if (tabs) {
    tabs.addEventListener('click', (e) => { const t = e.target.closest('[data-tab]'); if (t) selectTab(t.dataset.tab); });
    tabs.addEventListener('keydown', (e) => {
      const list = $$('[data-tab]', tabs), cur = list.findIndex((t) => t.getAttribute('aria-selected') === 'true');
      if (e.key === 'ArrowRight') selectTab(list[(cur + 1) % list.length].dataset.tab, true);
      if (e.key === 'ArrowLeft') selectTab(list[(cur - 1 + list.length) % list.length].dataset.tab, true);
    });
    document.addEventListener('click', (e) => { const a = e.target.closest('[data-goto-tab]'); if (a) selectTab(a.dataset.gotoTab); });
  }

  /* ---------- Báo giá tạm tính ---------- */
  const quote = new Map();
  const qList = $('[data-quote-list]'), qTotal = $('[data-quote-total]');
  const renderQuote = () => {
    if (!qList) return;
    qList.innerHTML = '';
    if (!quote.size) { qList.innerHTML = '<li class="quote-empty">Chưa có sản phẩm nào. Bấm <b>Thêm</b> ở bảng giá.</li>'; qTotal.textContent = '0đ'; }
    let a = 0, b = 0;
    quote.forEach((it, id) => {
      a += it.min * it.qty; b += it.max * it.qty;
      const li = document.createElement('li');
      li.innerHTML = `<span>${it.name}</span><span>×${it.qty}</span><button type="button" class="rm" aria-label="Bỏ ${it.name}">×</button>`;
      li.querySelector('.rm').onclick = () => { it.qty > 1 ? it.qty-- : quote.delete(id); syncAdd(); renderQuote(); };
      qList.append(li);
    });
    if (quote.size) qTotal.textContent = a === b ? vnd(a) : `${short(a)} – ${short(b)}`;
  };
  const syncAdd = () => $$('[data-add]').forEach((btn) => {
    const it = JSON.parse(btn.dataset.add), q = quote.get(it.id);
    btn.classList.toggle('is-added', !!q); btn.textContent = q ? `Đã thêm ×${q.qty}` : 'Thêm';
  });
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-add]'); if (!btn) return;
    const it = JSON.parse(btn.dataset.add), q = quote.get(it.id);
    q ? q.qty++ : quote.set(it.id, { ...it, qty: 1 });
    syncAdd(); renderQuote();
  });
  const quoteText = () => {
    if (!quote.size) return '';
    let a = 0, b = 0; const lines = [];
    quote.forEach((it) => { a += it.min * it.qty; b += it.max * it.qty; lines.push(`- ${it.name} ×${it.qty}`); });
    return `Báo giá tạm tính:\n${lines.join('\n')}\nTạm tính: ${range(a, b)}`;
  };

  /* ---------- Ước tính LED ---------- */
  const est = $('[data-est]');
  const ledRules = (B.pricing && B.pricing.ledEstimator && B.pricing.ledEstimator.videoSceneRules) || [];
  const ledItems = {};
  ((B.pricing && B.pricing.groups) || []).forEach((g) => g.items.forEach((it) => (ledItems[it.id] = it)));
  const BASE = { static: ledItems['led-static'], motion: ledItems['led-motion'] };
  const NAMES = { static: 'Banner tĩnh', motion: 'Motion banner', video: 'Video LED' };
  const sceneSuggest = { 10: 3, 15: 4, 20: 6, 30: 8, 60: 10 };
  let lanes = [[], []], target = 0;
  const blockPrice = (b) => {
    if (b.type !== 'video') return [BASE[b.type].min, BASE[b.type].max];
    const r = ledRules.find((x) => b.scenes >= x.minScenes && b.scenes <= x.maxScenes);
    return r ? [r.min, r.max] : null;
  };
  const renderEst = () => {
    if (!est) return;
    const fold = $('input[name=screen]:checked', est).value === 'fold';
    const wrap = $('[data-est-lanes]', est); wrap.innerHTML = '';
    const n = fold ? 2 : 1;
    let a = 0, b = 0, contact = false, count = 0;
    for (let L = 0; L < n; L++) {
      const box = document.createElement('div');
      if (fold) { const lab = document.createElement('p'); lab.className = 'lane-label'; lab.textContent = L === 0 ? 'Màn trái (bấm để chọn màn khi thêm khối)' : 'Màn phải'; box.append(lab); }
      const lane = document.createElement('div'); lane.className = 'lane' + (fold && target === L ? ' is-target' : '');
      lane.addEventListener('click', (e) => { if (fold && !e.target.closest('button,select')) { target = L; renderEst(); } });
      lanes[L].forEach((blk, k) => {
        count++;
        const p = blockPrice(blk); if (p) { a += p[0]; b += p[1]; } else contact = true;
        const el = document.createElement('div');
        el.className = `block block-${blk.type}`;
        if (blk.type === 'video') el.style.setProperty('--sc', Math.min(blk.scenes, 10));
        el.innerHTML = `<b>${NAMES[blk.type]}</b>` +
          (blk.type === 'video' ? `<label>Số scene <select aria-label="Số scene">${Array.from({ length: 11 }, (_, s) => s + 2).map((s) => `<option value="${s}"${s === blk.scenes ? ' selected' : ''}>${s > 10 ? 'Trên 10' : s}</option>`).join('')}</select></label>` : '') +
          `<span class="bp">${p ? `${short(p[0])} – ${short(p[1])}` : 'Liên hệ'}</span><button type="button" class="x" aria-label="Bỏ khối ${NAMES[blk.type]}">×</button>`;
        el.querySelector('.x').onclick = () => { lanes[L].splice(k, 1); renderEst(); };
        const sel = el.querySelector('select'); if (sel) sel.onchange = () => { blk.scenes = Number(sel.value); renderEst(); };
        lane.append(el);
      });
      box.append(lane); wrap.append(box);
    }
    $('[data-est-hint]', est).hidden = count > 0;
    const tot = $('[data-est-total]', est);
    tot.textContent = !count ? '0đ' : contact && !a ? 'Liên hệ' : `${short(a)} – ${short(b)}${contact ? ' + liên hệ' : ''}`;
  };
  const estText = () => {
    if (!est) return '';
    const fold = $('input[name=screen]:checked', est).value === 'fold';
    const dur = $('[data-est-duration]', est);
    const parts = (fold ? [0, 1] : [0]).map((L) => (fold ? (L ? 'Màn phải: ' : 'Màn trái: ') : '') + (lanes[L].map((x) => x.type === 'video' ? `Video LED (${x.scenes} scene)` : NAMES[x.type]).join(' + ') || '(trống)'));
    if (!lanes[0].length && !lanes[1].length) return '';
    return `Ước tính LED (${fold ? 'màn gập' : 'màn đơn'}, ${dur.options[dur.selectedIndex].text}):\n${parts.join('\n')}\nƯớc tính: ${$('[data-est-total]', est).textContent}`;
  };
  if (est) {
    $$('[data-est-add]', est).forEach((btn) => btn.addEventListener('click', () => {
      const fold = $('input[name=screen]:checked', est).value === 'fold';
      const blk = { type: btn.dataset.estAdd };
      if (blk.type === 'video') blk.scenes = sceneSuggest[$('[data-est-duration]', est).value] || 4;
      lanes[fold ? target : 0].push(blk); renderEst();
    }));
    $$('input[name=screen]', est).forEach((r) => r.addEventListener('change', () => { target = 0; renderEst(); }));
    $('[data-est-reset]', est).addEventListener('click', () => { lanes = [[], []]; target = 0; renderEst(); });
    renderEst();
  }

  /* ---------- Lịch trống ---------- */
  const cal = $('[data-cal]');
  let selDate = null;
  const pad = (n) => String(n).padStart(2, '0');
  const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let view = new Date(today.getFullYear(), today.getMonth(), 1);
  const stLabel = { open: 'Trống', limited: 'Còn ít', full: 'Kín' };
  const rushInfo = (d) => {
    const days = Math.round((d - today) / 864e5);
    if (days <= 1) return 'Final trong 24 giờ: phụ phí <b>+100%</b> tổng đơn.';
    if (days <= 4) return 'Final trong 2–4 ngày: phụ phí <b>+50%</b> tổng đơn. Riêng booth dưới 5 ngày: +50% đến 100%.';
    if (days < 5) return '';
    if (days < 14) return 'Ngày này khá gần, bạn nhắn Bunnie sớm để kiểm tra slot nhé.';
    return '';
  };
  const renderCal = () => {
    if (!cal) return;
    $('[data-cal-title]', cal).textContent = `Tháng ${view.getMonth() + 1}, ${view.getFullYear()}`;
    const g = $('[data-cal-days]', cal); g.innerHTML = '';
    ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].forEach((d) => { const s = document.createElement('div'); s.className = 'cal-dow'; s.textContent = d; g.append(s); });
    const first = (view.getDay() + 6) % 7, dim = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    for (let i = 0; i < first; i++) g.append(document.createElement('div'));
    for (let d = 1; d <= dim; d++) {
      const dt = new Date(view.getFullYear(), view.getMonth(), d), k = key(dt);
      const b = document.createElement('button'); b.type = 'button'; b.className = 'cal-day'; b.textContent = d;
      b.disabled = dt < today;
      if (avail.configured && !b.disabled) b.dataset.st = avail.days[k] || 'open';
      if (+dt === +today) b.classList.add('is-today');
      b.setAttribute('aria-pressed', selDate && +selDate === +dt);
      b.setAttribute('aria-label', `${d}/${view.getMonth() + 1}${b.dataset.st ? ', ' + stLabel[b.dataset.st] : ''}`);
      b.onclick = () => { selDate = dt; renderCal(); renderOut(); };
      g.append(b);
    }
    $('[data-cal-prev]', cal).disabled = view <= new Date(today.getFullYear(), today.getMonth(), 1);
  };
  const calText = () => (selDate ? `Ngày cần final: ${selDate.getDate()}/${selDate.getMonth() + 1}/${selDate.getFullYear()}` : '');
  const renderOut = () => {
    const out = $('[data-cal-out]', cal); if (!selDate) return;
    const st = avail.configured ? (avail.days[key(selDate)] || 'open') : null;
    const rush = rushInfo(selDate);
    const msg = !st ? 'Bunnie đang cập nhật lịch online. Nhắn Studio để kiểm tra ngày này nhé.'
      : st === 'full' ? 'Ngày này đã kín lịch. Nhắn Studio để hỏi lịch gần nhất nhé.'
      : st === 'limited' ? 'Ngày này còn ít slot, bạn giữ lịch sớm nhé.' : 'Ngày này còn trống.';
    out.innerHTML = `<p><b>${selDate.getDate()}/${selDate.getMonth() + 1}/${selDate.getFullYear()}</b>${st ? `, ${stLabel[st].toLowerCase()}` : ''}</p><p>${msg}</p>${rush ? `<p class="rush">${rush}</p>` : ''}<div class="actions"><a class="btn btn-primary" href="#gui-brief" data-cal-send>Giữ lịch ngày này</a><a class="btn btn-ghost" href="https://zalo.me/${B.contact.zalo}" target="_blank" rel="noopener">Hỏi qua Zalo</a></div>`;
  };
  if (cal) {
    $('[data-cal-prev]', cal).onclick = () => { view = new Date(view.getFullYear(), view.getMonth() - 1, 1); renderCal(); };
    $('[data-cal-next]', cal).onclick = () => { view = new Date(view.getFullYear(), view.getMonth() + 1, 1); renderCal(); };
    renderCal();
    availP.then(() => {
      renderCal();
    });
  }

  /* ---------- Quy trình: chạm để mở bước 4 ---------- */
  $$('.step-more').forEach((s) => {
    s.addEventListener('click', () => s.classList.toggle('is-open'));
    s.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); s.classList.toggle('is-open'); } });
  });

  /* ---------- FAQ dạng chat ---------- */
  const log = $('[data-chat-log]');
  document.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-q]'); if (!chip) return;
    const it = JSON.parse(chip.dataset.q);
    chip.classList.add('is-asked');
    const q = document.createElement('div'); q.className = 'bubble bubble-out'; q.textContent = it.q; log.append(q);
    setTimeout(() => {
      const a = document.createElement('div'); a.className = 'bubble bubble-in';
      const p = document.createElement('p'); p.textContent = it.a; a.append(p);
      const links = document.createElement('div'); links.className = 'bubble-links';
      (it.links || []).forEach((l) => {
        const x = document.createElement('a');
        if (l.type === 'section') { x.href = l.to; x.textContent = 'Xem chi tiết trên trang'; }
        else { x.href = '/blog/' + l.to; x.textContent = 'Đọc thêm trên blog'; }
        links.append(x);
      });
      if (it.contactCta) { const x = document.createElement('a'); x.href = 'https://zalo.me/' + B.contact.zalo; x.target = '_blank'; x.rel = 'noopener'; x.textContent = 'Nhắn Studio'; links.append(x); }
      if (links.children.length) a.append(links);
      log.append(a); log.scrollTop = log.scrollHeight;
    }, reduce ? 0 : 350);
    log.scrollTop = log.scrollHeight;
  });

  /* ---------- Form gửi brief ---------- */
  const form = $('[data-brief]');
  if (form) {
    const attached = $('[data-attached]'), attTxt = $('[data-attached-text]');
    const extras = { quote: '', est: '', cal: '' };
    const syncAttached = () => {
      const t = [extras.quote, extras.est, extras.cal].filter(Boolean).join('\n\n');
      attached.hidden = !t; attTxt.textContent = t;
    };
    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-quote-send]')) extras.quote = quoteText();
      if (e.target.closest('[data-est-send]')) extras.est = estText();
      if (e.target.closest('[data-cal-send]')) extras.cal = calText();
      if (e.target.closest('[data-quote-send],[data-est-send],[data-cal-send]')) syncAttached();
    });
    $('[data-attached-clear]').onclick = () => { extras.quote = extras.est = extras.cal = ''; syncAttached(); };

    $$('input[name=briefMode]', form).forEach((r) => r.addEventListener('change', () => {
      $('[data-mode=template]', form).hidden = r.value !== 'template' || !r.checked;
    }));

    const urlIn = $('[data-brief-url]'), urlErr = $('[data-brief-err]');
    let urlOk = true;
    const checkUrl = async () => {
      const v = urlIn.value.trim(); urlErr.hidden = true; urlOk = true;
      if (!v) return true;
      try {
        const r = await fetch('/api/check-link', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: v }) });
        const d = await r.json(); urlOk = d.ok;
        if (d.reason === 'invalid') { urlErr.textContent = 'Link chưa đúng định dạng, bạn kiểm tra lại giúp Bunnie nhé.'; }
        else urlErr.textContent = 'Link này chưa mở quyền truy cập, Bunnie chưa xem được brief. Bạn mở quyền giúp Bunnie rồi dán lại nhé.';
        urlErr.hidden = d.ok;
      } catch { urlOk = true; }
      return urlOk;
    };
    urlIn.addEventListener('change', checkUrl);

    const phone = $('[data-phone]'), phoneErr = $('[data-phone-err]'), msg = $('[data-brief-msg]'), submit = $('[data-brief-submit]');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const p = phone.value.replace(/[^\d+]/g, '');
      const okPhone = /^\+?\d{9,12}$/.test(p);
      phoneErr.hidden = okPhone; phone.setAttribute('aria-invalid', !okPhone);
      if (!okPhone) { phone.focus(); return; }
      if (!(await checkUrl())) { urlIn.focus(); return; }
      submit.disabled = true; submit.textContent = 'Đang gửi…';
      try {
        const r = await fetch('/api/contact', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: p, briefUrl: urlIn.value.trim(), summary: attTxt.textContent }) });
        if (!r.ok) throw 0;
        msg.className = 'form-msg'; msg.textContent = 'Bunnie đã nhận thông tin. Tụi mình sẽ liên hệ bạn sớm nhé!';
        form.reset(); extras.quote = extras.est = extras.cal = ''; syncAttached();
      } catch {
        msg.className = 'form-msg is-err'; msg.textContent = 'Chưa gửi được. Bạn thử lại, hoặc nhắn Zalo cho Bunnie nhé.';
      }
      msg.hidden = false; submit.disabled = false; submit.textContent = 'Gửi cho Bunnie';
    });
  }

  /* ---------- Nút liên hệ nổi ---------- */
  const fT = $('[data-float-toggle]'), fM = $('[data-float-menu]');
  if (fT) {
    fT.addEventListener('click', () => { const o = fT.getAttribute('aria-expanded') !== 'true'; fT.setAttribute('aria-expanded', o); fM.hidden = !o; });
    document.addEventListener('click', (e) => { if (!e.target.closest('[data-float]')) { fT.setAttribute('aria-expanded', 'false'); fM.hidden = true; } });
  }
})();
