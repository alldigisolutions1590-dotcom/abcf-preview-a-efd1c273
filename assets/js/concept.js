/* ==========================================================================
   A Beautiful California Florist — concept interactions
   Vanilla JS. Cart (localStorage) · product modal + zoom · filters ·
   simulated checkout · focus-trapped overlays. Motion — reveals, the hero
   entrance and the parallax drift — comes from the shared abc-motion.js.
   All product names, prices and descriptions come from window.AFH, which is
   built from the client's own catalogue in assets/data/client-catalogue.js.
   ========================================================================== */
(function () {
  'use strict';

  var AFH = window.AFH;
  if (!AFH) return;

  var M = window.Motion || null;
  var d = document;
  var $ = function (sel, ctx) { return (ctx || d).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || d).querySelectorAll(sel)); };
  var mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var reduce = mqReduce.matches;

  var EASE = [0.22, 1, 0.36, 1];
  var CART_KEY = 'abcf.cart.v1';
  var PREFS_KEY = 'abcf.prefs.v1';

  /* ---------------------------------------------------------------------
     State
     --------------------------------------------------------------------- */
  var store = { v: 1, items: [], gift: '' };
  var prefs = { sizes: {} };

  function readStore(key) {
    try {
      var raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (err) { return null; }
  }

  function saveStore() {
    try { window.localStorage.setItem(CART_KEY, JSON.stringify(store)); } catch (err) {}
  }

  function savePrefs() {
    try { window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (err) {}
  }

  function loadState() {
    var c = readStore(CART_KEY);
    if (c && c.v === 1 && Array.isArray(c.items)) {
      store.items = c.items.filter(function (it) {
        return AFH.findProduct(it.slug) && it.qty > 0;
      }).map(function (it) {
        return { slug: it.slug, size: AFH.findSize(it.size).id, qty: Math.min(9, Math.max(1, it.qty | 0)) };
      });
      store.gift = typeof c.gift === 'string' ? c.gift : '';
    }
    var p = readStore(PREFS_KEY);
    if (p && p.sizes) {
      Object.keys(p.sizes).forEach(function (slug) {
        if (AFH.findProduct(slug) && AFH.findSize(p.sizes[slug])) prefs.sizes[slug] = p.sizes[slug];
      });
    }
  }

  function sizeOf(slug) {
    return AFH.findSize(prefs.sizes[slug] || 'standard');
  }

  function cartCount() {
    return store.items.reduce(function (n, it) { return n + it.qty; }, 0);
  }

  function cartSubtotal() {
    return store.items.reduce(function (n, it) {
      return n + AFH.priceOf(it.slug, it.size) * it.qty;
    }, 0);
  }

  /* ---------------------------------------------------------------------
     Motion helpers (with graceful degradation)
     --------------------------------------------------------------------- */
  /* The only thing left on Motion.dev is the cart badge's one-shot pulse.
     Kept pruned so a long session cannot accumulate stopped animations. */
  var liveAnims = [];

  function track(anim, el) {
    if (!anim || typeof anim.stop !== 'function') return anim;
    var now = performance.now();
    liveAnims = liveAnims.filter(function (e) { return now - e.t < 3200; });
    liveAnims.push({ anim: anim, el: el, t: now });
    return anim;
  }

  function animate(el, frames, opts) {
    if (!el || el.nodeType !== 1) return null;
    if (reduce || !M || typeof M.animate !== 'function') {
      return null;
    }
    var o = opts || {};
    if (!o.easing) o.easing = EASE;
    return track(M.animate(el, frames, o), el);
  }

  /* ---------------------------------------------------------------------
     Overlay manager — shared scrim, focus trap, Esc, scroll lock
     --------------------------------------------------------------------- */
  var scrim = $('[data-scrim]');
  var stack = [];
  var lastFocus = null;
  var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function focusables(root) {
    return $$(FOCUSABLE, root).filter(function (el) {
      return el.offsetWidth > 0 || el.offsetHeight > 0 || el === d.activeElement;
    });
  }

  function lockPage() {
    d.body.classList.add('is-locked');
    ['main', '.site-header', '.site-footer'].forEach(function (sel) {
      var el = $(sel);
      if (el) { try { el.inert = true; } catch (err) {} }
    });
  }

  function unlockPage() {
    if (stack.length) return;
    d.body.classList.remove('is-locked');
    ['main', '.site-header', '.site-footer'].forEach(function (sel) {
      var el = $(sel);
      if (el) { try { el.inert = false; } catch (err) {} }
    });
  }

  function openOverlay(el, initialFocus, returnFocus) {
    if (!el || stack.indexOf(el) > -1) return;
    if (!stack.length) lastFocus = returnFocus || d.activeElement;
    el.hidden = false;
    el.setAttribute('aria-hidden', 'false');
    if (scrim && scrim.hidden) { scrim.hidden = false; }
    void el.offsetHeight;
    var revealed = false;
    function reveal() {
      if (revealed) return;
      revealed = true;
      el.classList.add('is-open');
      if (scrim) scrim.classList.add('is-open');
    }
    requestAnimationFrame(reveal);
    /* rAF is throttled in background tabs and some embedded views; an overlay
       must never end up open-but-invisible. */
    window.setTimeout(reveal, 32);
    stack.push(el);
    lockPage();
    var target = initialFocus || focusables(el)[0] || el;
    if (target && target.focus) {
      window.setTimeout(function () { try { target.focus({ preventScroll: true }); } catch (e) { target.focus(); } }, 60);
    }
  }

  function closeOverlay(el) {
    var i = stack.indexOf(el);
    if (i === -1) return;
    stack.splice(i, 1);
    el.classList.remove('is-open');
    el.setAttribute('aria-hidden', 'true');
    var finish = function () {
      if (stack.indexOf(el) === -1) el.hidden = true;
      if (!stack.length && scrim) {
        scrim.classList.remove('is-open');
        window.setTimeout(function () { if (!stack.length) scrim.hidden = true; }, 460);
      }
      unlockPage();
      if (!stack.length && lastFocus && lastFocus.focus) {
        try { lastFocus.focus({ preventScroll: true }); } catch (e) { lastFocus.focus(); }
        lastFocus = null;
      }
    };
    if (reduce) { finish(); } else { window.setTimeout(finish, 640); }
  }

  function topOverlay() { return stack[stack.length - 1] || null; }

  if (scrim) {
    scrim.addEventListener('click', function () {
      var top = topOverlay();
      if (!top) return;
      if (top.hasAttribute('data-product-modal')) closeProduct();
      else if (top.hasAttribute('data-checkout')) closeCheckout();
      else if (top.hasAttribute('data-cart-drawer')) closeCart();
      else if (top.hasAttribute('data-menu-panel')) closeMenu();
      else closeOverlay(top);
    });
  }

  d.addEventListener('keydown', function (e) {
    var top = topOverlay();
    if (!top) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      if (top.hasAttribute('data-product-modal') && zoomOn) { setZoom(false); return; }
      if (top.hasAttribute('data-product-modal')) closeProduct();
      else if (top.hasAttribute('data-checkout')) closeCheckout();
      else if (top.hasAttribute('data-cart-drawer')) closeCart();
      else if (top.hasAttribute('data-menu-panel')) closeMenu();
      else closeOverlay(top);
      return;
    }

    if (e.key === 'Tab') {
      var list = focusables(top);
      if (!list.length) { e.preventDefault(); return; }
      var first = list[0], last = list[list.length - 1];
      if (e.shiftKey && (d.activeElement === first || d.activeElement === top)) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && d.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    }
  });

  /* ---------------------------------------------------------------------
     Header
     --------------------------------------------------------------------- */
  var header = $('[data-header]');
  var lastY = window.pageYOffset;
  var ticking = false;

  function onScrollHeader() {
    var y = window.pageYOffset;
    if (header) {
      header.classList.toggle('is-stuck', y > 8);
      /* hysteresis: a 1px scroll event must not flip the condensed state, or
         the header height change and the resulting scroll adjustment fight. */
      var dy = y - lastY;
      if (y < 140) header.classList.remove('is-condensed');
      else if (dy > 6) header.classList.add('is-condensed');
      else if (dy < -6) header.classList.remove('is-condensed');
    }
    lastY = y;
    ticking = false;
  }

  function requestScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(onScrollHeader);
  }
  window.addEventListener('scroll', requestScroll, { passive: true });

  /* ---------------------------------------------------------------------
     Product grid + FLIP filter
     --------------------------------------------------------------------- */
  var grid = $('[data-product-grid]');
  var gridLive = $('[data-grid-live]');
  var activeFilter = 'all';

  /* Escape text that comes from the catalogue before it enters markup. */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* The page asks for a slice of the catalogue: the homepage shows the
     autumn campaign plus the best sellers, the catalogue page shows all
     seventeen. Everything — name, price, occasion, photograph — comes from
     the data, so no price is ever typed into markup. */
  function pageProducts() {
    if (!grid) return AFH.PRODUCTS;
    var scope = grid.getAttribute('data-products');
    return scope === 'all' ? AFH.PRODUCTS : AFH.FRONT;
  }

  /* Card photograph: WebP 800/1600/2560 with a JPEG fallback. The card image
     is 620 CSS px at the widest two-column breakpoint, so 1600w covers DPR2
     there and 2560w covers it on a phone at 3x. */
  var CARD_SIZES = '(max-width: 700px) 92vw, 620px';

  function cardHTML(p, i) {
    var size = sizeOf(p.slug);
    var price = AFH.money(AFH.priceOf(p, size.id));
    return '' +
      '<article class="card" data-card data-slug="' + p.slug + '" data-occasions="' + p.occasions.join(' ') + '" data-delay="' + (i % 2 ? '0.08' : '0.00') + '">' +
        '<a class="card-media" href="?demo=product&amp;p=' + p.slug + '" data-open-product="' + p.slug + '" aria-label="View ' + esc(p.name) + ' — ' + size.label + ', ' + price + '">' +
          AFH.picture(p.image, { alt: p.alt, sizes: CARD_SIZES, widths: [800, 1600, 2560] }) +
          (p.tag ? '<span class="card-tag">' + esc(p.tag) + '</span>' : '') +
          '<span class="card-quick" aria-hidden="true">View details</span>' +
        '</a>' +
        '<div class="card-meta">' +
          '<div class="card-row">' +
            '<span class="card-no">' + p.no + '</span>' +
            '<h3 class="card-name"><a href="?demo=product&amp;p=' + p.slug + '" data-open-product="' + p.slug + '">' + esc(p.name) + '</a></h3>' +
            '<p class="card-price"><span data-card-amount>' + price + '</span><span class="sz" data-card-size>' + size.label + '</span></p>' +
          '</div>' +
          '<p class="card-occ">' + esc(p.occasionLabel) + '</p>' +
        '</div>' +
      '</article>';
  }

  /* Chips are the occasions that actually occur in the products on screen. */
  function renderChips(list) {
    var host = $('[data-filters]');
    if (!host) return;
    var occ = AFH.occasionsFor(list);
    var html = '<div class="chips">' +
      '<button class="chip" type="button" data-filter="all" aria-pressed="true">All' +
      '<span class="chip-n" data-filter-count>' + list.length + '</span></button>';
    occ.forEach(function (o) {
      html += '<button class="chip" type="button" data-filter="' + o.id + '" aria-pressed="false">' +
        esc(o.label) + '<span class="chip-n" data-filter-count>' + o.count + '</span></button>';
    });
    html += '</div>';
    html += '<p class="filters-note" data-filter-note hidden></p>';
    html += '<p class="filters-meta"><span data-grid-live aria-live="polite">Showing ' +
      list.length + ' of ' + AFH.PRODUCTS.length + '</span></p>';
    host.innerHTML = html;
    gridLive = $('[data-grid-live]');
  }

  function renderGrid() {
    if (!grid) return;
    var list = pageProducts();
    renderChips(list);
    grid.innerHTML = list.map(cardHTML).join('');
    syncOffsets();
  }

  function visibleCards() {
    return $$('[data-card]', grid).filter(function (c) { return !c.classList.contains('is-filtered'); });
  }

  function syncOffsets() {
    visibleCards().forEach(function (c, i) {
      c.classList.toggle('is-offset', i % 2 === 1);
    });
  }

  /* A filter change fades the grid out, re-flows it and fades it back in.
     240ms all told, transform + opacity only, and the cards never visibly
     jump: the re-flow happens while the grid is at zero opacity. */
  var swapTimer = null;

  function applyFilter(id, opts) {
    opts = opts || {};
    var chipList = $$('[data-filter]');
    if (!chipList.some(function (c) { return c.getAttribute('data-filter') === id; })) id = 'all';
    activeFilter = id;

    chipList.forEach(function (c) {
      c.setAttribute('aria-pressed', String(c.getAttribute('data-filter') === id));
    });

    if (!grid) return;
    var cards = $$('[data-card]', grid);

    function commit() {
      cards.forEach(function (c, i) {
        var occ = (c.getAttribute('data-occasions') || '').split(/\s+/);
        var show = id === 'all' || occ.indexOf(id) > -1;
        c.classList.toggle('is-filtered', !show);
        if (!show) { c.setAttribute('aria-hidden', 'true'); } else { c.removeAttribute('aria-hidden'); }
        c.style.setProperty('--card-i', String(i % 6));
      });

      syncOffsets();

      grid.classList.remove('is-swapping');
      void grid.offsetWidth;
      grid.classList.add('is-entering');
      window.clearTimeout(swapTimer);
      swapTimer = window.setTimeout(function () { grid.classList.remove('is-entering'); }, 620);

      var shown = visibleCards().length;
      if (gridLive) {
        var label = id === 'all' ? 'all occasions' : (chipList.filter(function (c) { return c.getAttribute('data-filter') === id; })[0] || {}).textContent;
        gridLive.textContent = 'Showing ' + shown + ' of ' + cards.length + (id === 'all' ? '' : ' — ' + String(label).replace(/\d+$/, '').trim());
      }

      /* The sympathy edit is sourced from the shop's own taxonomy but was not
         pre-tagged in the catalogue we verified, so say so where it shows. */
      var note = $('[data-filter-note]');
      if (note) {
        if (id === 'sympathy-and-funeral') {
          note.textContent = 'Sympathy — the shop\u2019s own \u201cSympathy and Funeral\u201d occasion. Three arrangements carry it in the full catalogue, chosen on their published descriptions (Violets in Blue names sympathy outright); the shop\u2019s own category listings are still to be confirmed.';
          note.hidden = false;
        } else {
          note.textContent = '';
          note.hidden = true;
        }
      }

      if (opts.scroll) scrollToCollection();
      if (opts.updateHash) {
        try {
          history.replaceState(null, '', id === 'all' ? location.pathname + location.search : '?filter=' + id);
        } catch (err) {}
      }
    }

    if (reduce || opts.instant) { grid.classList.remove('is-swapping'); commit(); return; }
    grid.classList.add('is-swapping');
    window.setTimeout(commit, 110);
  }

  function scrollToCollection() {
    var target = $('#collection') || grid;
    if (!target) return;
    var top = target.getBoundingClientRect().top + window.pageYOffset - (header ? header.offsetHeight : 0) - 8;
    window.scrollTo({ top: top, behavior: reduce ? 'auto' : 'smooth' });
  }

  var filtersHost = $('[data-filters]');
  if (filtersHost) {
    filtersHost.addEventListener('click', function (e) {
      var chip = e.target.closest('[data-filter]');
      if (!chip) return;
      applyFilter(chip.getAttribute('data-filter'), { updateHash: true });
    });
  }

  if (grid) {
    grid.addEventListener('click', function (e) {
      var trigger = e.target.closest('[data-open-product]');
      if (!trigger) return;
      e.preventDefault();
      openProduct(trigger.getAttribute('data-open-product'));
    });
  }

  /* ---------------------------------------------------------------------
     Cart
     --------------------------------------------------------------------- */
  var cartBtnLabel = $('[data-cart-count]');
  var drawer = $('[data-cart-drawer]');
  var cartBody = $('[data-cart-body]');
  var subtotalEl = $('[data-subtotal]');
  var countLabel = $('[data-cart-count-label]');
  var giftEl = $('[data-gift]');
  var cartLive = $('[data-cart-live]');
  var checkoutStart = $('[data-checkout-start]');

  function announce(msg) {
    if (!cartLive) return;
    cartLive.textContent = '';
    window.setTimeout(function () { cartLive.textContent = msg; }, 40);
  }

  function pulseBadge() {
    if (!cartBtnLabel) return;
    animate(cartBtnLabel, {
      transform: ['scale(1)', 'scale(1.34)', 'scale(1)']
    }, { duration: 0.62, easing: [0.34, 1.56, 0.64, 1] });
  }

  function lineHTML(it, index) {
    var p = AFH.findProduct(it.slug);
    var s = AFH.findSize(it.size);
    var unit = AFH.priceOf(p, s.id);
    return '' +
      '<div class="cart-line" data-line="' + index + '">' +
        AFH.picture(p.image, { alt: p.name + ', ' + s.label, sizes: '74px', widths: [800], cls: 'line-thumb' }) +
        '<div class="line-main">' +
          '<p class="line-name">' + p.name + '</p>' +
          '<p class="line-sz">' + s.label + ' <span class="lp">· ' + AFH.money(unit) + '</span></p>' +
          '<div class="qty" role="group" aria-label="Quantity for ' + p.name + ' ' + s.label + '">' +
            '<button type="button" data-qty="-1" data-index="' + index + '" aria-label="Decrease quantity of ' + p.name + ' ' + s.label + '">−</button>' +
            '<span class="q" aria-live="off">' + it.qty + '</span>' +
            '<button type="button" data-qty="1" data-index="' + index + '" aria-label="Increase quantity of ' + p.name + ' ' + s.label + '">+</button>' +
          '</div>' +
        '</div>' +
        '<div class="line-end">' +
          '<p class="line-total">' + AFH.money(unit * it.qty) + '</p>' +
          '<button type="button" class="line-remove" data-remove="' + index + '" aria-label="Remove ' + p.name + ' ' + s.label + ' from cart">' +
            '<span class="lr-x" aria-hidden="true">×</span><span class="lr-label">Remove</span>' +
          '</button>' +
        '</div>' +
      '</div>';
  }

  function renderCart() {
    var count = cartCount();
    if (cartBody) {
      if (!store.items.length) {
        cartBody.innerHTML = '' +
          '<div class="cart-empty">' +
            '<p class="ce-title">Nothing in the cart yet.</p>' +
            '<p>Choose an arrangement and one of the three sizes — it will be kept here while you look around.</p>' +
            '<a class="btn" href="#collection" data-cart-empty-link><span>Browse the collection</span><span class="arw" aria-hidden="true">→</span></a>' +
          '</div>';
      } else {
        cartBody.innerHTML = store.items.map(lineHTML).join('');
      }
    }
    if (subtotalEl) subtotalEl.textContent = AFH.money(cartSubtotal());
    if (countLabel) {
      countLabel.textContent = count === 0 ? 'Empty' : count + (count === 1 ? ' arrangement' : ' arrangements');
    }
    if (cartBtnLabel) {
      cartBtnLabel.textContent = String(count);
      cartBtnLabel.setAttribute('data-empty', count === 0 ? 'true' : 'false');
    }
    if (checkoutStart) checkoutStart.disabled = count === 0;
    if (giftEl && giftEl.value !== store.gift) giftEl.value = store.gift;
  }

  function addToCart(slug, sizeId, qty) {
    var p = AFH.findProduct(slug);
    if (!p) return;
    var q = Math.max(1, parseInt(qty, 10) || 1);
    var size = AFH.findSize(sizeId);
    var existing = null;
    store.items.forEach(function (it) { if (it.slug === slug && it.size === size.id) existing = it; });
    if (existing) {
      existing.qty = Math.min(9, existing.qty + q);
    } else {
      store.items.push({ slug: slug, size: size.id, qty: q });
    }
    saveStore();
    renderCart();
    pulseBadge();
    announce(p.name + ', ' + size.label + ', added to cart. ' + cartCount() + ' in cart.');
    openCart();
  }

  function openCart() {
    if (!drawer) return;
    renderCart();
    openOverlay(drawer, $('[data-cart-close]', drawer));
  }

  function closeCart() {
    if (!drawer) return;
    closeOverlay(drawer);
  }

  $$('[data-cart-open]').forEach(function (btn) {
    btn.addEventListener('click', function (e) { e.preventDefault(); openCart(); });
  });
  $$('[data-cart-close]').forEach(function (btn) {
    btn.addEventListener('click', function () { closeCart(); });
  });
  if (drawer) {
    drawer.addEventListener('click', function (e) { if (e.target === drawer) closeCart(); });
  }

  if (cartBody) {
    cartBody.addEventListener('click', function (e) {
      var remove = e.target.closest('[data-remove]');
      if (remove) {
        var ri = parseInt(remove.getAttribute('data-remove'), 10);
        var removed = store.items[ri];
        if (removed) {
          var rp = AFH.findProduct(removed.slug);
          store.items.splice(ri, 1);
          saveStore();
          renderCart();
          announce(rp.name + ' removed from cart.');
        }
        return;
      }
      var qbtn = e.target.closest('[data-qty]');
      if (qbtn) {
        var i = parseInt(qbtn.getAttribute('data-index'), 10);
        var delta = parseInt(qbtn.getAttribute('data-qty'), 10);
        var it = store.items[i];
        if (!it) return;
        it.qty = Math.min(9, it.qty + delta);
        var prod = AFH.findProduct(it.slug);
        if (it.qty <= 0) {
          store.items.splice(i, 1);
          announce(prod.name + ' removed from cart.');
        } else {
          announce(prod.name + ' quantity ' + it.qty + '.');
        }
        saveStore();
        renderCart();
        return;
      }
      var emptyLink = e.target.closest('[data-cart-empty-link]');
      if (emptyLink) {
        e.preventDefault();
        closeCart();
        window.setTimeout(scrollToCollection, reduce ? 0 : 380);
      }
    });
  }

  if (giftEl) {
    var giftTimer = null;
    giftEl.addEventListener('input', function () {
      var wrap = giftEl.closest('[data-gift-wrap]');
      if (wrap) {
        wrap.classList.remove('has-error');
        var err = $('[data-error]', wrap);
        if (err) err.textContent = '';
      }
      /* state first — a re-render between keystroke and debounce must not
         resurrect the old (empty) message. Only the storage write is deferred. */
      store.gift = giftEl.value;
      window.clearTimeout(giftTimer);
      giftTimer = window.setTimeout(function () { saveStore(); }, 240);
    });
  }

  /* ---------------------------------------------------------------------
     Product modal
     --------------------------------------------------------------------- */
  var modal = $('[data-product-modal]');
  var pmStage = $('[data-pm-stage]');
  var pmImage = $('[data-pm-image]');
  var pmSource = $('[data-pm-source]');
  var pmThumbs = $('[data-pm-thumbs]');

  function stem(src) { return String(src || '').replace(/\.(jpe?g|webp|png)$/i, ''); }
  var pm = {
    title: $('[data-pm-title]'),
    occasion: $('[data-pm-occasion]'),
    no: $('[data-pm-no]'),
    eyebrow: $('[data-pm-eyebrow]'),
    price: $('[data-pm-price]'),
    priceNote: $('[data-pm-price-note]'),
    blurb: $('[data-pm-blurb]'),
    occasions: $('[data-pm-occasions]'),
    sizesNote: $('[data-pm-sizes-note]'),
    addPrice: $('[data-pm-add-price]'),
    sizeList: $('[data-size-list]')
  };
  var pmState = { slug: null, size: 'standard', index: 0 };
  var zoomOn = false;
  var zoomOrigin = { x: 50, y: 50 };
  var pmReturnFocus = null;

  function currentProduct() { return pmState.slug ? AFH.findProduct(pmState.slug) : null; }

  function renderThumbs(p) {
    if (!pmThumbs) return;
    pmThumbs.innerHTML = p.gallery.map(function (g, i) {
      return '<button class="pm-thumb" type="button" data-thumb="' + i + '" aria-pressed="' + (i === 0 ? 'true' : 'false') + '" ' +
        'aria-label="Show image ' + (i + 1) + ' of ' + p.gallery.length + ': ' + g.caption + '">' +
        AFH.picture(stem(g.src), { alt: '', sizes: '62px', widths: [800] }) + '</button>';
    }).join('');
  }

  /* The stage is the one place the zoom can out-resolve the file: at 2.15x on
     a DPR2 screen the image needs roughly 2,750 device pixels, so the stage
     asks for 3000w where the master has it. */
  var STAGE_SIZES = '(min-width: 900px) 46vw, 92vw';

  function setMainImage(i, fromThumb) {
    var p = currentProduct();
    if (!p || !pmImage) return;
    var clamped = ((i % p.gallery.length) + p.gallery.length) % p.gallery.length;
    pmState.index = clamped;
    var g = p.gallery[clamped];
    var name = stem(g.src);
    var info = AFH.shotInfo(name);
    var swap = function () {
      if (pmSource) pmSource.srcset = AFH.webpSrcset(name, [800, 1600, 2560, 3000]);
      pmImage.src = AFH.jpegSrc(name, 1600);
      pmImage.setAttribute('width', String(info.w));
      pmImage.setAttribute('height', String(info.h));
      pmImage.alt = p.name + ' — ' + g.caption;
    };
    if (fromThumb && !reduce) {
      /* cross-fade rather than snap: the CSS owns the timing */
      pmImage.classList.add('is-swapping');
      var reveal = function () { pmImage.classList.remove('is-swapping'); };
      pmImage.addEventListener('load', reveal, { once: true });
      window.setTimeout(reveal, 260);
    }
    swap();
    if (pmThumbs) {
      $$('[data-thumb]', pmThumbs).forEach(function (b) {
        b.setAttribute('aria-pressed', String(parseInt(b.getAttribute('data-thumb'), 10) === clamped));
      });
    }
    setZoom(false);
  }

  function renderSizes(p) {
    if (!pm.sizeList) return;
    pm.sizeList.innerHTML = AFH.SIZES.map(function (s) {
      return '<label class="size-opt">' +
        '<input type="radio" name="pm-size" value="' + s.id + '"' + (s.id === pmState.size ? ' checked' : '') + '>' +
        '<span class="dot" aria-hidden="true"></span>' +
        '<span class="s-name">' + s.label + '<small>' + s.note + '</small></span>' +
        '<span class="s-price">' + AFH.money(AFH.priceOf(p, s.id)) + '</span>' +
        '</label>';
    }).join('');
  }

  function syncPrice() {
    var p = currentProduct();
    if (!p) return;
    var s = AFH.findSize(pmState.size);
    var price = AFH.priceOf(p, s.id);
    if (pm.price) pm.price.textContent = AFH.money(price);
    if (pm.priceNote) pm.priceNote.textContent = s.label + ' · ' + s.note;
    if (pm.addPrice) pm.addPrice.textContent = ' — ' + AFH.money(price);
    var card = grid ? $('[data-slug="' + p.slug + '"]', grid) : null;
    if (card) {
      var amt = $('[data-card-amount]', card);
      var sz = $('[data-card-size]', card);
      if (amt) amt.textContent = AFH.money(price);
      if (sz) sz.textContent = s.label;
      var link = $('.card-media', card);
      if (link) link.setAttribute('aria-label', 'View ' + p.name + ' — ' + s.label + ', ' + AFH.money(price));
    }
  }

  function openProduct(slug, opts) {
    var p = AFH.findProduct(slug);
    if (!p || !modal) return;
    opts = opts || {};
    pmReturnFocus = d.activeElement;

    pmState.slug = slug;
    pmState.size = prefs.sizes[slug] || 'standard';
    pmState.index = 0;

    if (pm.title) pm.title.textContent = p.name;
    if (pm.occasion) pm.occasion.textContent = p.occasionLabel;
    if (pm.no) pm.no.textContent = p.no + ' / ' + AFH.PRODUCTS.length;
    if (pm.eyebrow) pm.eyebrow.textContent = 'Arrangement ' + p.no + ' · ' + p.occasionLabel;
    if (pm.blurb) pm.blurb.textContent = p.description;
    if (pm.occasions) pm.occasions.textContent = p.occasionLabel;
    if (pm.sizesNote) pm.sizesNote.textContent = 'Standard, Deluxe, Premium — Deluxe +$25 and Premium +$50 over the published Standard price (sample deltas, client to confirm).';

    renderThumbs(p);
    renderSizes(p);
    syncPrice();
    setMainImage(0);
    syncPrice();

    openOverlay(modal, $('[data-modal-close]', modal));
    if (!opts.silent) {
      try { history.replaceState(null, '', '?demo=product&p=' + slug); } catch (err) {}
    }
  }

  function closeProduct() {
    if (!modal) return;
    setZoom(false);
    closeOverlay(modal);
    try {
      if (location.search.indexOf('demo=product') > -1) {
        history.replaceState(null, '', location.pathname);
      }
    } catch (err) {}
  }

  $$('[data-modal-close]').forEach(function (b) {
    b.addEventListener('click', closeProduct);
  });
  if (modal) {
    modal.addEventListener('click', function (e) { if (e.target === modal) closeProduct(); });
  }

  if (pm.sizeList) {
    pm.sizeList.addEventListener('change', function (e) {
      var input = e.target.closest('input[name="pm-size"]');
      if (!input) return;
      pmState.size = input.value;
      prefs.sizes[pmState.slug] = input.value;
      savePrefs();
      syncPrice();
    });
  }

  if (pmThumbs) {
    pmThumbs.addEventListener('click', function (e) {
      var b = e.target.closest('[data-thumb]');
      if (!b) return;
      setMainImage(parseInt(b.getAttribute('data-thumb'), 10), true);
    });
    pmThumbs.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      var list = $$('[data-thumb]', pmThumbs);
      var idx = list.indexOf(d.activeElement);
      if (idx === -1) return;
      e.preventDefault();
      var next = list[(idx + (e.key === 'ArrowRight' ? 1 : list.length - 1)) % list.length];
      next.focus();
      next.click();
    });
  }

  var addBtn = $('[data-add-to-cart]');
  if (addBtn) {
    addBtn.addEventListener('click', function () {
      var slug = pmState.slug;
      closeProduct();
      window.setTimeout(function () { addToCart(slug, pmState.size, 1); }, reduce ? 0 : 220);
    });
  }

  var enquire = $('[data-pm-enquire]');
  if (enquire) {
    enquire.addEventListener('click', function () {
      closeProduct();
      window.setTimeout(function () {
        var target = $('#visit');
        if (target) target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
        window.setTimeout(function () {
          var name = $('#enq-name');
          if (name) name.focus({ preventScroll: true });
        }, reduce ? 0 : 700);
      }, reduce ? 0 : 260);
    });
  }

  /* ---------------- zoom ---------------- */
  var zoomBtn = $('[data-zoom-toggle]');
  var zoomLabel = $('[data-zoom-label]');

  function applyZoomOrigin() {
    if (!pmImage) return;
    pmImage.style.transformOrigin = zoomOrigin.x + '% ' + zoomOrigin.y + '%';
  }

  function setZoom(on) {
    if (!pmStage) return;
    zoomOn = !!on;
    pmStage.classList.toggle('is-zoomed', zoomOn);
    if (zoomBtn) {
      zoomBtn.setAttribute('aria-pressed', String(zoomOn));
      zoomBtn.setAttribute('aria-label', zoomOn ? 'Reset zoom' : 'Zoom image');
    }
    if (zoomLabel) zoomLabel.textContent = zoomOn ? 'Reset' : 'Zoom';
    if (zoomOn) applyZoomOrigin();
  }

  if (pmStage) {
    pmStage.addEventListener('click', function (e) {
      if (e.target.closest('.zoom-btn')) return;
      setZoom(!zoomOn);
      if (zoomOn) {
        var r = pmStage.getBoundingClientRect();
        zoomOrigin = {
          x: Math.min(90, Math.max(10, ((e.clientX - r.left) / r.width) * 100)),
          y: Math.min(90, Math.max(10, ((e.clientY - r.top) / r.height) * 100))
        };
        applyZoomOrigin();
      }
    });
    pmStage.addEventListener('pointermove', function (e) {
      if (!zoomOn) return;
      var r = pmStage.getBoundingClientRect();
      zoomOrigin = {
        x: Math.min(92, Math.max(8, ((e.clientX - r.left) / r.width) * 100)),
        y: Math.min(92, Math.max(8, ((e.clientY - r.top) / r.height) * 100))
      };
      applyZoomOrigin();
    });
    pmStage.setAttribute('tabindex', '0');
    pmStage.addEventListener('keydown', function (e) {
      var step = 8;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setZoom(!zoomOn);
        return;
      }
      if (!zoomOn) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); zoomOrigin.x = Math.max(8, zoomOrigin.x - step); applyZoomOrigin(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); zoomOrigin.x = Math.min(92, zoomOrigin.x + step); applyZoomOrigin(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); zoomOrigin.y = Math.max(8, zoomOrigin.y - step); applyZoomOrigin(); }
      if (e.key === 'ArrowDown') { e.preventDefault(); zoomOrigin.y = Math.min(92, zoomOrigin.y + step); applyZoomOrigin(); }
    });
  }
  if (zoomBtn) {
    zoomBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      setZoom(!zoomOn);
    });
  }

  /* ---------------------------------------------------------------------
     Simulated checkout
     --------------------------------------------------------------------- */
  var checkout = $('[data-checkout]');
  var coPanels = $$('[data-co-panel]');
  var coSteps = $$('[data-co-step], .co-step');
  var coNext = $('[data-co-next]');
  var coNextLabel = $('[data-co-next-label]');
  var coBack = $('[data-co-back]');
  var coSummary = $('[data-co-summary]');
  var coGift = $('[data-co-gift]');
  var coSubtotal = $('[data-co-subtotal]');
  var coTotal = $('[data-co-total]');
  var coOrderNo = $('[data-co-order-no]');
  var coSuccessCopy = $('[data-co-success-copy]');
  var coConfirm = $('[data-co-confirm]');
  var coAddressBlock = $('[data-co-address-block]');
  var coPickupNote = $('[data-co-pickup-note]');
  var coDateLabel = $('[data-co-date-label]');
  var ORDER = ['details', 'delivery', 'review', 'success'];
  var coState = { step: 0, data: {}, fulfilment: 'delivery', placed: null };

  /* ---------------- delivery or pick-up ---------------- */
  /* The client's site offers both a delivery service and an in-store pick-up
     counter, so the demo asks which, and then only demands an address when
     there is going to be one. */
  function fulfilment() {
    var checked = $('input[name="fulfilment"]:checked');
    return checked && checked.value === 'pickup' ? 'pickup' : 'delivery';
  }

  function syncFulfilment(opts) {
    var mode = fulfilment();
    coState.fulfilment = mode;
    var pickup = mode === 'pickup';

    if (coAddressBlock) {
      coAddressBlock.hidden = pickup;
      $$('input, select, textarea', coAddressBlock).forEach(function (i) {
        if (pickup) {
          i.removeAttribute('required');
          i.removeAttribute('aria-required');
          clearFieldError(i);
        } else if (i.hasAttribute('data-required-when-delivery')) {
          i.setAttribute('required', '');
        }
      });
    }
    if (coPickupNote) coPickupNote.hidden = !pickup;
    if (coDateLabel) coDateLabel.textContent = pickup ? 'Pick-up date' : 'Preferred delivery date';
    var windowField = $('#co-window');
    if (windowField) {
      var wLabel = $('label[for="co-window"]');
      if (wLabel) wLabel.textContent = pickup ? 'Collection window' : 'Delivery window';
    }
    if (opts && opts.announce) {
      announce(pickup
        ? 'Pick-up chosen. Collection from 611 E Carson St Ste B.'
        : 'Delivery chosen. A street address is needed.');
    }
  }

  function stepIndex(name) { return ORDER.indexOf(name); }

  function setStep(n) {
    coState.step = Math.max(0, Math.min(ORDER.length - 1, n));
    var name = ORDER[coState.step];

    coPanels.forEach(function (p) {
      var active = p.getAttribute('data-co-panel') === name;
      p.classList.toggle('is-active', active);
    });

    coSteps.forEach(function (s, i) {
      var state = 'todo';
      if (i < coState.step) state = 'done';
      if (i === coState.step) state = 'current';
      s.setAttribute('data-state', state);
    });

    if (coBack) coBack.hidden = coState.step === 0 || coState.step === 3;
    if (coNextLabel) {
      /* The confirmation's own action lives in the always-visible foot, so the
         way back into the shop never depends on scrolling the panel. */
      coNextLabel.textContent = name === 'review' ? 'Place demo order' : (name === 'success' ? 'Continue shopping' : 'Continue');
    }
    if (coNext) {
      coNext.hidden = false;
      coNext.disabled = false;
    }

    var body = $('.co-body', checkout);
    if (body) body.scrollTop = 0;

    if (name === 'review') buildReview();
    if (name === 'delivery') syncFulfilment();

    var demoLine = $('.co-demo', checkout);
    if (demoLine) {
      demoLine.textContent = name === 'success'
        ? 'Demo order — simulated. No payment was taken and nothing is being delivered.'
        : 'Demo checkout — no payment is taken, no order is placed.';
    }

    var focusTarget = null;
    if (name === 'success') focusTarget = $('.co-success h3', checkout);
    else {
      var panel = coPanels.filter(function (p) { return p.getAttribute('data-co-panel') === name; })[0];
      if (panel) focusTarget = $('input, select, textarea', panel);
    }
    if (focusTarget && focusTarget.focus) {
      window.setTimeout(function () { try { focusTarget.focus({ preventScroll: true }); } catch (e) {} }, 120);
    }
  }

  function fieldWrap(input) { return input.closest('[data-field]'); }

  function setFieldError(input, msg) {
    var wrap = fieldWrap(input);
    if (!wrap) return;
    wrap.classList.toggle('has-error', !!msg);
    var err = $('[data-error]', wrap);
    if (err) err.textContent = msg || '';
    if (msg) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }

  function clearFieldError(input) { setFieldError(input, ''); }

  var validators = {
    'co-name': function (v) { return v.trim().length >= 2 ? '' : 'Please add a name we can ask for at the door.'; },
    'co-email': function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'Please add a valid email address.'; },
    'co-phone': function (v) { return (v.replace(/\D/g, '').length >= 7) ? '' : 'Please add a phone number for the rider.'; },
    'co-address': function (v) { return v.trim().length >= 4 ? '' : 'Please add a street address.'; },
    'co-city': function (v) { return v.trim().length >= 2 ? '' : 'Please add a city.'; },
    'co-zip': function (v) { return /^\d{5}(-\d{4})?$/.test(v.trim()) ? '' : 'Please add a 5-digit ZIP.'; },
    'co-date': function (v) {
      if (!v) return 'Choose a delivery date.';
      var today = new Date(); today.setHours(0, 0, 0, 0);
      var picked = new Date(v + 'T00:00:00');
      return picked >= today ? '' : 'Choose today or a later date.';
    },
    'co-window': function (v) { return v ? '' : 'Choose a delivery window.'; }
  };

  function validateFields(panelName) {
    var panel = coPanels.filter(function (p) { return p.getAttribute('data-co-panel') === panelName; })[0];
    if (!panel) return { ok: true, firstInvalid: null };
    var inputs = $$('input, select, textarea', panel).filter(function (i) { return i.type !== 'hidden'; });
    var firstInvalid = null;
    inputs.forEach(function (input) {
      var v = input.value || '';
      var test = validators[input.id];
      var msg = '';
      if (input.hasAttribute('required') && !v.trim()) {
        msg = 'This field is needed.';
        if (test) msg = test(v);
      } else if (!v.trim() && !input.hasAttribute('required')) {
        /* An optional field that is left empty is not an error — and a field
           switched off by the pick-up choice must not be validated at all. */
        msg = '';
      } else if (test) {
        msg = test(v);
      }
      setFieldError(input, msg);
      if (msg && !firstInvalid) firstInvalid = input;
    });
    return { ok: !firstInvalid, firstInvalid: firstInvalid };
  }

  function collectData() {
    var data = {};
    coPanels.forEach(function (panel) {
      $$('input, select, textarea', panel).forEach(function (i) {
        if (i.id) data[i.id] = i.value;
      });
    });
    return data;
  }

  function fmtDate(iso) {
    if (!iso) return '';
    var parts = String(iso).split('-');
    if (parts.length !== 3) return iso;
    var d2 = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    if (isNaN(d2.getTime())) return iso;
    return d2.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  /* One description of how the flowers get there, used by the review step and
     again on the confirmation, so the two can never disagree. */
  function fulfilmentBlock(dl, mode) {
    var pickup = mode === 'pickup';
    var shop = (AFH.BUSINESS && AFH.BUSINESS.address) || '611 E Carson St Ste B, Long Beach, CA 90807';
    var where = pickup
      ? 'Pick up at the shop<br>' + shop + '<br>Mon–Fri 9–5 · Sat 9–3 · Sun closed'
      : (dl['co-name'] || '') + '<br>' + (dl['co-address'] || '') + ', ' + (dl['co-city'] || '') + ' ' + (dl['co-zip'] || '');
    return '<div class="cl-fulfil">' +
      '<p class="cl-meta">' + (pickup ? 'Pick-up' : 'Delivery') + '</p>' +
      '<p class="cl-where">' + where + '</p>' +
      '<p class="cl-when">' + (fmtDate(dl['co-date']) || 'Date to confirm') +
        (dl['co-window'] ? ' · ' + esc(dl['co-window']) : '') + '</p>' +
      (dl['co-notes'] && !pickup ? '<p class="cl-note">For the driver: ' + esc(dl['co-notes']) + '</p>' : '') +
      '</div>';
  }

  function buildReview() {
    coState.data = collectData();
    var mode = fulfilment();
    coState.fulfilment = mode;
    var subtotal = cartSubtotal();
    if (coSubtotal) coSubtotal.textContent = AFH.money(subtotal);
    if (coTotal) coTotal.textContent = AFH.money(subtotal);

    if (coSummary) {
      var rows = store.items.map(function (it) {
        var p = AFH.findProduct(it.slug);
        var s = AFH.findSize(it.size);
        return '<div class="co-line">' +
          AFH.picture(p.image, { alt: '', sizes: '44px', widths: [800] }) +
          '<div><p class="cl-name">' + p.name + '</p><p class="cl-meta">' + s.label + ' · Qty ' + it.qty + '</p></div>' +
          '<p class="cl-price">' + AFH.money(AFH.priceOf(p, s.id) * it.qty) + '</p>' +
          '</div>';
      }).join('');

      rows += fulfilmentBlock(coState.data, mode);
      coSummary.innerHTML = rows;
    }

    if (coGift) {
      var g = (giftEl ? giftEl.value : store.gift || '').trim();
      coGift.innerHTML = g
        ? '<p class="cg-label">Gift message</p><p class="cg-text">“' + g.replace(/</g, '&lt;') + '”</p>'
        : '<p class="cg-label">Gift message</p><p class="cg-empty">None added. You can write one in the cart before placing the order.</p>';
    }
  }

  function openCheckout(opts) {
    opts = opts || {};
    if (!checkout) return;
    if (!store.items.length) { openCart(); return; }
    var returnTo = $('[data-cart-open]');
    var dateInput = $('#co-date');
    if (dateInput) {
      var today = new Date();
      var iso = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
      dateInput.min = iso;
      if (!dateInput.value) dateInput.value = iso;
    }
    openOverlay(checkout, $('[data-checkout-close]', checkout), returnTo);
    setStep(opts.step || 0);
    syncFulfilment();
  }

  function closeCheckout() {
    if (!checkout) return;
    closeOverlay(checkout);
    try {
      if (location.search.indexOf('demo=checkout') > -1) history.replaceState(null, '', location.pathname);
    } catch (err) {}
  }

  if (checkoutStart) {
  checkoutStart.addEventListener('click', function () {
    closeCart();
    window.setTimeout(function () { openCheckout({ step: 0 }); }, reduce ? 0 : 300);
  });
  }
  $$('[data-checkout-close]').forEach(function (b) { b.addEventListener('click', closeCheckout); });
  $$('input[name="fulfilment"]').forEach(function (radio) {
    radio.addEventListener('change', function () { syncFulfilment({ announce: true }); });
  });
  if (checkout) {
    checkout.addEventListener('click', function (e) { if (e.target === checkout) closeCheckout(); });
  }

  $$('[data-field] input, [data-field] select, [data-field] textarea').forEach(function (input) {
    input.addEventListener('input', function () {
      var wrap = fieldWrap(input);
      if (wrap && wrap.classList.contains('has-error')) {
        var test = validators[input.id];
        var msg = test ? test(input.value) : '';
        setFieldError(input, msg);
      }
    });
    input.addEventListener('blur', function () {
      if (!input.hasAttribute('required') && !validators[input.id]) return;
      var test = validators[input.id];
      if (!test) return;
      if (!input.value.trim()) return;
      setFieldError(input, test(input.value));
    });
  });

  if (coNext) {
    coNext.addEventListener('click', function () {
      var name = ORDER[coState.step];
      if (name === 'success') { continueShopping(); return; }

      if (name === 'details' || name === 'delivery') {
        var res = validateFields(name);
        if (!res.ok) {
          if (res.firstInvalid && res.firstInvalid.focus) res.firstInvalid.focus();
          return;
        }
      }
      if (name === 'review') { placeOrder(); return; }
      setStep(coState.step + 1);
    });
  }

  if (coBack) {
    coBack.addEventListener('click', function () { setStep(coState.step - 1); });
  }

  /* The confirmation step. It re-prints what was ordered, where it was going
     and the reference number, then offers the way back into the shop — the
     cart is already empty, so "continue shopping" cannot resurrect it. */
  function buildConfirmation(ref) {
    if (!coConfirm) return;
    var snapshot = coState.placed;
    if (!snapshot) return;
    var lines = snapshot.items.map(function (it) {
      return '<div class="cc-line">' +
        '<span class="cc-name">' + esc(it.name) + '<small>' + esc(it.size) + ' · Qty ' + it.qty + '</small></span>' +
        '<span class="cc-price">' + AFH.money(it.line) + '</span>' +
        '</div>';
    }).join('');

    coConfirm.innerHTML =
      '<div class="cc-block">' +
        '<p class="cc-label">In this demo order</p>' +
        lines +
        '<div class="cc-line cc-line--total"><span class="cc-name">Total</span><span class="cc-price">' + AFH.money(snapshot.total) + '</span></div>' +
      '</div>' +
      '<div class="cc-block">' +
        '<p class="cc-label">' + (snapshot.mode === 'pickup' ? 'Collection' : 'Delivery') + '</p>' +
        '<p class="cc-where">' + snapshot.where + '</p>' +
        '<p class="cc-when">' + snapshot.when + '</p>' +
        (snapshot.gift ? '<p class="cc-gift">Gift message: “' + esc(snapshot.gift) + '”</p>' : '') +
      '</div>' +
      '';
  }

  function placeOrder() {
    buildReview();
    var mode = fulfilment();
    var ref = 'ABCF-' + String(Math.floor(1000 + Math.random() * 9000));
    var dl = coState.data;
    var shop = (AFH.BUSINESS && AFH.BUSINESS.address) || '611 E Carson St Ste B, Long Beach, CA 90807';
    var gift = (giftEl ? giftEl.value : store.gift || '').trim();

    /* Freeze the order before the cart is emptied — the confirmation has to
       describe what was in it, not what is left. */
    coState.placed = {
      mode: mode,
      items: store.items.map(function (it) {
        var p = AFH.findProduct(it.slug);
        var s = AFH.findSize(it.size);
        return { name: p.name, size: s.label, qty: it.qty, line: AFH.priceOf(p, s.id) * it.qty };
      }),
      total: cartSubtotal(),
      gift: gift,
      where: mode === 'pickup'
        ? shop
        : (dl['co-address'] ? dl['co-address'] + ', ' + (dl['co-city'] || '') + ' ' + (dl['co-zip'] || '') : shop),
      when: (fmtDate(dl['co-date']) || 'Date to confirm') + (dl['co-window'] ? ' · ' + dl['co-window'] : '')
    };

    if (coOrderNo) coOrderNo.textContent = ref;
    if (coSuccessCopy) {
      coSuccessCopy.textContent = 'Thank you — this is where a real order would be confirmed. Nothing has been charged, no flowers are on their way and no details have left this browser. ' +
        (mode === 'pickup'
          ? 'In a live shop the arrangement would be waiting at the counter for collection on ' + (fmtDate(dl['co-date']) || 'the chosen date') + '.'
          : 'In a live shop a confirmation would go to ' + (dl['co-email'] || 'your email') + ' for delivery on ' + (fmtDate(dl['co-date']) || 'the chosen date') + '.');
    }
    buildConfirmation(ref);

    store.items = [];
    store.gift = '';
    saveStore();
    if (giftEl) giftEl.value = '';
    renderCart();
    setStep(3);
    announce('Demo order ' + ref + ' confirmed. Cart cleared.');
  }

  /* Continue shopping: close the overlay, drop back to the first checkout
     step so a second order starts clean, and put the shopper back on the
     collection they came from. The cart stays empty until they add again. */
  function continueShopping() {
    setStep(0);
    closeCheckout();
    /* A second order starts clean: delivery is the default again, so the
       address block comes back and the pick-up choice is not silently reused. */
    var first = $('input[name="fulfilment"][value="delivery"]');
    if (first) first.checked = true;
    syncFulfilment();
    var target = $('#collection') || $('#catalogue') || $('#main');
    window.setTimeout(function () {
      if (target) {
        var top = target.getBoundingClientRect().top + window.pageYOffset - (header ? header.offsetHeight : 0) - 8;
        window.scrollTo({ top: top, behavior: reduce ? 'auto' : 'smooth' });
      }
      announce('Back at the collection. Your cart is empty — the demo order is complete.');
    }, reduce ? 0 : 260);
  }

  $$('[data-continue-shopping]').forEach(function (b) {
    b.addEventListener('click', function (e) { e.preventDefault(); continueShopping(); });
  });

  /* ---------------------------------------------------------------------
     Mobile menu
     --------------------------------------------------------------------- */
  var menuPanel = $('[data-menu-panel]');
  var menuTrigger = $('[data-menu-open]');

  function openMenu() {
    if (!menuPanel) return;
    openOverlay(menuPanel, $('[data-menu-close]', menuPanel));
    if (menuTrigger) menuTrigger.setAttribute('aria-expanded', 'true');
  }

  function closeMenu() {
    if (!menuPanel) return;
    closeOverlay(menuPanel);
    if (menuTrigger) menuTrigger.setAttribute('aria-expanded', 'false');
  }

  if (menuTrigger) menuTrigger.addEventListener('click', openMenu);
  $$('[data-menu-close]').forEach(function (b) { b.addEventListener('click', closeMenu); });

  $$('[data-menu-link]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var href = a.getAttribute('href');
      if (!href || href.charAt(0) !== '#') return;
      e.preventDefault();
      closeMenu();
      window.setTimeout(function () {
        var target = d.getElementById(href.slice(1));
        if (target) {
          var top = target.getBoundingClientRect().top + window.pageYOffset - (header ? header.offsetHeight : 0) - 10;
          window.scrollTo({ top: top, behavior: reduce ? 'auto' : 'smooth' });
          if (target.getAttribute('tabindex') === null) target.setAttribute('tabindex', '-1');
          window.setTimeout(function () { target.focus({ preventScroll: true }); }, reduce ? 0 : 700);
        }
      }, reduce ? 0 : 300);
    });
  });

  /* ---------------------------------------------------------------------
     Section CTAs / footer filters
     --------------------------------------------------------------------- */
  $$('[data-shop-cta]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      applyFilter('all');
      scrollToCollection();
    });
  });

  $$('[data-footer-filter]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      applyFilter(a.getAttribute('data-footer-filter'), { scroll: true });
    });
  });

  /* Header index: the client's real occasions, filtering the collection. */
  $$('[data-nav-filter]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      closeMenu();
      applyFilter(a.getAttribute('data-nav-filter'), { scroll: true, updateHash: true });
    });
  });

  /* ---------------------------------------------------------------------
     Enquiry form (demo, client-side only)
     --------------------------------------------------------------------- */
  var enquiry = $('[data-enquiry-form]');
  if (enquiry) {
    var status = $('[data-form-status]', enquiry);
    enquiry.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = $('#enq-name', enquiry);
      var email = $('#enq-email', enquiry);
      var ok = true;

      function setErr(input, msg) {
        var wrap = input.closest('[data-field]');
        if (!wrap) return;
        wrap.classList.toggle('has-error', !!msg);
        var err = $('[data-error]', wrap);
        if (err) err.textContent = msg;
        if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
      }

      setErr(name, name.value.trim().length >= 2 ? '' : 'Please add a name.');
      if (name.value.trim().length < 2) ok = false;
      setErr(email, /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim()) ? '' : 'Please add a valid email address.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim())) ok = false;

      if (!ok) {
        if (status) status.textContent = 'Please check the fields above.';
        (name.value.trim().length < 2 ? name : email).focus();
        return;
      }
      if (status) {
        status.textContent = 'Thank you, ' + name.value.trim().split(' ')[0] + '. In a live shop we would reply to ' + email.value.trim() + ' within a day. Nothing was sent — this form is a demo.';
      }
      enquiry.reset();
    });
  }

  /* ---------------------------------------------------------------------
     Motion — it all lives in the shared layer (assets/js/abc-motion.js)
     ---------------------------------------------------------------------
     The hero entrance, the scroll reveals, the cascade stagger and the
     parallax drift are declared in CSS and armed by that one file: one
     IntersectionObserver, one scroll listener, one rAF loop, and its own
     reduced-motion handling. Nothing below adds a scroll listener of its own.

     Concept-side behaviour (filters, gallery) re-registers through
     ABCMotion.onReinit() so a re-init — the Shopify Theme Editor re-rendering a
     section, or the QA driver calling reinit() twice — never double-binds. */

  function afterReinit() {
    if (grid) applyFilter(activeFilter, { instant: true });
    if (pmImage && pmStage && zoomOn) applyZoomOrigin();
  }

  if (window.ABCMotion && typeof window.ABCMotion.onReinit === 'function') {
    window.ABCMotion.onReinit(afterReinit);
  }

  /* ---------------------------------------------------------------------
     Deep links (?demo=cart|product|checkout|menu, ?filter=)
     --------------------------------------------------------------------- */
  function seedCart() {
    if (store.items.length) return;
    store.items = [
      { slug: 'belmont', size: 'deluxe', qty: 1 },
      { slug: 'autumn-pumpkin', size: 'standard', qty: 1 }
    ];
    store.gift = 'For the table on Sunday — with love, A.';
    saveStore();
    renderCart();
  }

  function handleDeepLink() {
    var params = new URLSearchParams(location.search);
    var demo = params.get('demo');
    var hash = (location.hash || '').replace(/^#\/?/, '');
    if (!demo && hash) {
      if (hash === 'cart') demo = 'cart';
      else if (hash === 'checkout') demo = 'checkout';
      else if (hash.indexOf('product') === 0) { demo = 'product'; params.set('p', hash.split('/')[1] || hash.split('=')[1] || ''); }
      else if (hash === 'menu') demo = 'menu';
    }
    if (!demo) return;
    if (demo === 'cart') {
      seedCart();
      window.setTimeout(openCart, 120);
    } else if (demo === 'product') {
      var slug = params.get('p') || 'belmont';
      window.setTimeout(function () { openProduct(slug, { silent: true }); }, 120);
    } else if (demo === 'checkout') {
      seedCart();
      window.setTimeout(function () {
        openCheckout({ step: params.get('step') === 'review' ? 2 : (params.get('step') === 'delivery' ? 1 : 0) });
      }, 160);
    } else if (demo === 'menu') {
      window.setTimeout(openMenu, 120);
    } else if (demo === 'zoom') {
      window.setTimeout(function () { openProduct('belmont', { silent: true }); setZoom(true); }, 160);
    }
  }

  /* ---------------------------------------------------------------------
     Boot
     --------------------------------------------------------------------- */
  function boot() {
    loadState();
    renderGrid();
    renderCart();
    applyFilter(new URLSearchParams(location.search).get('filter') || 'all', { instant: true });

    onScrollHeader();
    handleDeepLink();

    // deep-link to a hash section on load (file:// friendly)
    if (location.hash && location.hash.length > 1 && !/^#\/(cart|checkout|product|menu)/.test(location.hash)) {
      var target = d.getElementById(location.hash.slice(1));
      if (target) {
        window.setTimeout(function () {
          var top = target.getBoundingClientRect().top + window.pageYOffset - (header ? header.offsetHeight : 0) - 10;
          window.scrollTo({ top: top, behavior: 'auto' });
        }, 60);
      }
    }
  }

  if (d.readyState === 'loading') {
    d.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  if (mqReduce.addEventListener) {
    mqReduce.addEventListener('change', function (e) { reduce = e.matches; });
  }

  // Test hook for the QA driver (harmless in production).
  window.AFHApp = {
    applyFilter: applyFilter,
    openProduct: openProduct,
    closeProduct: closeProduct,
    openCart: openCart,
    closeCart: closeCart,
    openCheckout: openCheckout,
    openMenu: openMenu,
    addToCart: addToCart,
    getCart: function () { return JSON.parse(JSON.stringify(store)); },
    setZoom: setZoom,
    state: function () { return { filter: activeFilter, cart: cartCount(), subtotal: cartSubtotal(), step: coState.step }; }
  };
})();
