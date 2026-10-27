/* abc-motion.js — shared motion layer for the A Beautiful California Florist demos.
 *
 * One file, copied verbatim into both local previews and both Shopify themes, so the motion
 * behaviour can never drift between the demo and the Liquid implementation.
 *
 * Vanilla ES5-compatible. No dependencies. Idempotent. Theme-editor safe. Reduced-motion aware.
 *
 * Markup contract (all optional, all additive):
 *   [data-reveal]              fade/rise in when scrolled into view  -> gets .is-inview
 *   [data-reveal][data-delay]  per-element delay in ms               -> sets --reveal-delay
 *   [data-cascade]             container; its [data-reveal] children stagger by --cascade-step (default 90ms)
 *   [data-parallax="0.15"]     slow translate3d drift while scrolling (apply to an inner media element)
 *   [data-hero]                hero root; gets .is-loaded on the next frame to start entrance
 *   [data-hero-item]           children of a hero; get --item-index for staggered entrances
 *   [data-marquee]             duplicate content once for a seamless loop (clone is aria-hidden)
 *
 * Everything initialised gets data-motion-ready="<role>" and everything is guarded against
 * double-init, so shopify:section:load can safely re-run init().
 */
(function (w, d) {
  'use strict';

  var mq = w.matchMedia ? w.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var ready = new WeakMap();          // element -> role, guards double init
  var revealIO = null;
  var parallaxEls = [];               // [{ el, speed, media }]
  var rafPending = false;
  var reinitCbs = [];
  var reducedCleanups = [];

  function reduced() { return !!(mq && mq.matches); }
  function each(list, fn) { Array.prototype.forEach.call(list, fn); }

  /* ---------------------------------------------------------------- reveal */
  function getIO() {
    if (revealIO || !('IntersectionObserver' in w)) return revealIO;
    revealIO = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        if (!e.isIntersecting) continue;
        e.target.classList.add('is-inview');
        revealIO.unobserve(e.target);
      }
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });
    return revealIO;
  }

  function initReveals(root) {
    var els = root.querySelectorAll('[data-reveal]');
    if (!els.length) return 0;
    var io = getIO();
    var n = 0;
    each(els, function (el) {
      if (ready.has(el)) return;
      ready.set(el, 'reveal');
      el.setAttribute('data-motion-ready', 'reveal');
      n++;

      var delay = parseInt(el.getAttribute('data-delay') || '', 10);
      if (isNaN(delay)) {
        var host = el.closest ? el.closest('[data-cascade]') : null;
        if (host) {
          var step = parseInt(host.getAttribute('data-cascade-step') || '90', 10);
          var idx = Array.prototype.indexOf.call(host.querySelectorAll('[data-reveal]'), el);
          delay = Math.max(0, idx) * step;
        }
      }
      if (delay) el.style.setProperty('--reveal-delay', delay + 'ms');

      if (reduced() || !io) el.classList.add('is-inview');   // never hide content from reduced-motion users
      else io.observe(el);
    });
    return n;
  }

  /* ------------------------------------------------------------- parallax */
  function collectParallax(root) {
    each(root.querySelectorAll('[data-parallax]'), function (el) {
      if (ready.has(el)) return;
      ready.set(el, 'parallax');
      el.setAttribute('data-motion-ready', 'parallax');
      if (reduced()) return;
      var speed = parseFloat(el.getAttribute('data-parallax')) || 0.12;
      // drift the media layer, never the layout box
      var media = el.querySelector('[data-parallax-media], img, video') || el;
      parallaxEls.push({ el: el, media: media, speed: speed });
    });
  }

  function paintParallax() {
    rafPending = false;
    if (!parallaxEls.length) return;
    var vh = w.innerHeight;
    for (var i = parallaxEls.length - 1; i >= 0; i--) {
      var rec = parallaxEls[i];
      if (!rec.el.isConnected) { parallaxEls.splice(i, 1); continue; }
      var r = rec.el.getBoundingClientRect();
      if (r.bottom < -240 || r.top > vh + 240) continue;
      var mid = r.top + r.height / 2 - vh / 2;
      var y = (-mid * rec.speed);
      if (y > 160) y = 160; if (y < -160) y = -160;
      rec.media.style.transform = 'translate3d(0,' + y.toFixed(2) + 'px,0)';
    }
  }

  function queueParallax() {
    if (rafPending || reduced()) return;
    rafPending = true;
    w.requestAnimationFrame(paintParallax);
  }

  /* ----------------------------------------------------------------- hero */
  function initHero(root) {
    each(root.querySelectorAll('[data-hero]'), function (hero) {
      if (ready.has(hero)) return;
      ready.set(hero, 'hero');
      hero.setAttribute('data-motion-ready', 'hero');
      each(hero.querySelectorAll('[data-hero-item]'), function (item, i) {
        item.style.setProperty('--item-index', i);
        item.setAttribute('data-motion-ready', 'hero-item');
      });
      if (reduced()) { hero.classList.add('is-loaded'); return; }
      w.requestAnimationFrame(function () {
        w.requestAnimationFrame(function () { hero.classList.add('is-loaded'); });
      });
    });
  }

  /* -------------------------------------------------------------- marquee */
  function initMarquee(root) {
    each(root.querySelectorAll('[data-marquee]'), function (el) {
      if (ready.has(el)) return;
      ready.set(el, 'marquee');
      el.setAttribute('data-motion-ready', 'marquee');
      // a reinit must never stack clones: drop any from a previous pass before cloning again
      each(el.querySelectorAll('[data-marquee-clone]'), function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
      var track = el.firstElementChild;
      if (!track || track.getAttribute('data-marquee-clone')) return;
      var clone = track.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      clone.setAttribute('data-marquee-clone', '');
      each(clone.querySelectorAll('[id]'), function (n) { n.removeAttribute('id'); });
      el.appendChild(clone);
      el.classList.add('is-marquee-ready');
    });
  }

  /* ------------------------------------------------------------ lifecycle */
  function initAll(root) {
    var n = 0;
    n += initReveals(root);
    initHero(root);
    initMarquee(root);
    collectParallax(root);
    return n;
  }

  function cleanup(root) {
    each(root.querySelectorAll('[data-motion-ready]'), function (el) {
      ready.delete(el);
      el.removeAttribute('data-motion-ready');
    });
    parallaxEls = parallaxEls.filter(function (r) { return !root.contains(r.el); });
  }

  function reinit(root) {
    root = root || d;
    cleanup(root);
    initAll(root);
    for (var i = 0; i < reinitCbs.length; i++) {
      try { reinitCbs[i](root); } catch (e) { /* a broken callback must not stop the page */ }
    }
    queueParallax();
  }

  /* reduced-motion can flip at runtime */
  if (mq) {
    var onMq = function () {
      if (reduced()) {
        each(d.querySelectorAll('[data-reveal]'), function (el) { el.classList.add('is-inview'); });
        each(d.querySelectorAll('[data-hero]'), function (el) { el.classList.add('is-loaded'); });
        parallaxEls.forEach(function (r) { r.media.style.transform = ''; });
      } else {
        queueParallax();
      }
    };
    if (mq.addEventListener) mq.addEventListener('change', onMq);
    else if (mq.addListener) mq.addListener(onMq);
    reducedCleanups.push(function () { if (mq.removeEventListener) mq.removeEventListener('change', onMq); });
  }

  w.addEventListener('scroll', queueParallax, { passive: true });
  w.addEventListener('resize', queueParallax, { passive: true });

  // Shopify theme editor: sections load/unload without a page refresh, so re-arm on load and
  // drop observers for anything removed.
  d.addEventListener('shopify:section:load', function (e) { reinit(e.target); });
  d.addEventListener('shopify:section:unload', function (e) { cleanup(e.target); });
  d.addEventListener('shopify:block:select', function (e) { reinit(e.target); });

  w.ABCMotion = {
    init: function (root) { return initAll(root || d); },
    reinit: reinit,
    refresh: queueParallax,
    reduced: reduced,
    onReinit: function (cb) { if (typeof cb === 'function') reinitCbs.push(cb); },
    version: '1.0.0'
  };

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', function () { initAll(d); queueParallax(); });
  else { initAll(d); queueParallax(); }
}(window, document));
