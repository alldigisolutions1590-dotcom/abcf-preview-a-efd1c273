/* ==========================================================================
   A Beautiful California Florist — catalogue adapter
   --------------------------------------------------------------------------
   The real catalogue lives in assets/data/client-catalogue.js
   (window.ABC_CATALOGUE): 17 verified products with the client's own names,
   prices and descriptions, plus the 18-category occasion taxonomy and the
   business record.

   This file invents no product data. It only:
     · normalises the occasion taxonomy into slugs,
     · maps each product to a licensed sample photograph whose composition
       matches the client's own description of the arrangement,
     · models the client's Standard / Deluxe / Premium tiers (the +$25 / +$50
       deltas are SAMPLE values and are flagged as such in the UI).
   ========================================================================== */
(function (global) {
  'use strict';

  var DATA = global.ABC_CATALOGUE;
  var IMG = 'assets/img/';
  var RESP = IMG + 'resp/';

  if (!DATA || !DATA.products) {
    global.AFH = null;
    return;
  }

  /* ---------------------------------------------------------------------
     Responsive image manifest — the pre-encoded variants in
     assets/img/resp/. Entry: [master width, master height, [webp widths]].
     The 3000px masters in assets/img/_master/ are the source files and are
     never served to the page. Every width listed here exists on disk: a
     srcset candidate that 404s would be a broken promise, so the set is
     declared per image rather than assumed.
     --------------------------------------------------------------------- */
  var IMAGES = {
    'blush-berries-bowls': [3000, 4000, [800, 1600, 2560, 3000]],
    'blush-roses-closeup': [3000, 2000, [800, 1600, 2560, 3000]],
    'blush-roses-white-wall': [3000, 4000, [800, 1600, 2560, 3000]],
    'burgundy-dahlia-dark': [1979, 3519, [800, 1600]],
    'coral-bouquet-white': [3000, 4000, [800, 1600, 2560, 3000]],
    'coral-ranunculus-held': [3000, 4500, [800, 1600, 2560, 3000]],
    'coral-ranunculus-white': [3000, 2000, [800, 1600, 2560, 3000]],
    'cream-peonies-wood': [3000, 4000, [800, 1600, 2560, 3000]],
    'crimson-ranunculus-field': [3000, 4500, [800, 1600, 2560, 3000]],
    'dark-still-life-glass': [3000, 4000, [800, 1600, 2560, 3000]],
    'dark-wrap-white-roses': [3000, 4500, [800, 1600, 2560, 3000]],
    'dried-branches-curtain': [3000, 4500, [800, 1600, 2560, 3000]],
    'dried-grasses-concrete': [3000, 4000, [800, 1600, 2560, 3000]],
    'dried-minimal-sprig': [3000, 4000, [800, 1600, 2560, 3000]],
    'dried-sprig-plate': [3000, 4000, [800, 1600, 2560, 3000]],
    'hero-blush-peonies-in-arms': [3000, 4000, [800, 1600, 2560, 3000]],
    'kraft-bundle-detail': [3000, 4500, [800, 1600, 2560, 3000]],
    'mauve-peony-macro': [1980, 3520, [800, 1600]],
    'minimal-dried-grasses-vase': [3000, 4500, [800, 1600, 2560, 3000]],
    'pink-cream-peonies-vase': [3000, 4000, [800, 1600, 2560, 3000]],
    'terracotta-bouquet-kraft': [3000, 4000, [800, 1600, 2560, 3000]],
    'white-bloom-dark-water': [3000, 2000, [800, 1600, 2560, 3000]],
    'white-hydrangea-wooden-bowl': [3000, 4000, [800, 1600, 2560, 3000]],
    'white-peonies-greenery': [3000, 4500, [800, 1600, 2560, 3000]],
    'white-ranunculus-dark': [3000, 2000, [800, 1600, 2560, 3000]],
    'white-stem-minimal-vase': [3000, 4500, [800, 1600, 2560, 3000]],
    'wrapped-bouquet-held': [3000, 4500, [800, 1600, 2560, 3000]]
  };

  var DEFAULT_SHOT = [3000, 4000, [800, 1600, 2560]];

  function shotInfo(name) {
    var key = String(name == null ? '' : name).replace(/\.(jpe?g|webp|png)$/i, '');
    var m = IMAGES[key];
    if (!m) return { name: key, w: DEFAULT_SHOT[0], h: DEFAULT_SHOT[1], widths: DEFAULT_SHOT[2] };
    return { name: key, w: m[0], h: m[1], widths: m[2] };
  }

  function escAttr(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* The widths a slot actually needs — no point shipping 3000px to a 74px
     thumbnail, and no point capping a full-bleed band at 1600. */
  function widthsFor(name, requested) {
    var have = shotInfo(name).widths;
    if (!requested || !requested.length) return have;
    var kept = have.filter(function (w) { return requested.indexOf(w) > -1; });
    return kept.length ? kept : have;
  }

  function webpSrcset(name, requested) {
    var key = shotInfo(name).name;
    return widthsFor(name, requested).map(function (w) {
      return RESP + key + '-' + w + '.webp ' + w + 'w';
    }).join(', ');
  }

  function jpegSrc(name, w) {
    return RESP + shotInfo(name).name + '-' + (w || 1600) + '.jpg';
  }

  /* <picture> wrapper: WebP with a JPEG fallback. The <img> stays the element
     every stylesheet rule and every bit of JS targets (picture is
     display:contents in CSS), so wrapping a photograph never moves layout.
     width/height are always written: they are what keeps CLS at zero. */
  function picture(name, opts) {
    var o = opts || {};
    var info = shotInfo(name);
    var sizes = o.sizes || '100vw';
    var loading = o.eager ? 'eager' : 'lazy';
    var img = '<img src="' + jpegSrc(name, o.jpeg || 1600) + '"' +
      ' width="' + info.w + '" height="' + info.h + '"' +
      (o.alt === undefined || o.alt === null ? '' : ' alt="' + escAttr(o.alt) + '"') +
      ' loading="' + loading + '" decoding="async"' +
      (o.eager ? ' fetchpriority="high"' : '') +
      (o.cls ? ' class="' + o.cls + '"' : '') +
      (o.attrs ? ' ' + o.attrs : '') +
      '>';
    return '<picture' + (o.picClass ? ' class="' + o.picClass + '"' : '') + '>' +
      '<source type="image/webp" srcset="' + webpSrcset(name, o.widths) + '" sizes="' + escAttr(sizes) + '">' +
      img +
      '</picture>';
  }

  /* ---------------------------------------------------------------------
     Occasion slugs — the client's own taxonomy, lowercased and hyphenated
     --------------------------------------------------------------------- */
  function slugify(s) {
    return String(s)
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /* Short, shopper-facing labels for the eighteen categories. */
  var LABELS = {
    'anniversary': 'Anniversary',
    'autumn': 'Autumn',
    'birthday': 'Birthday',
    'congrats': 'Congrats',
    'get-well': 'Get Well',
    'gift-sets': 'Gift Sets',
    'graduation': 'Graduation',
    'halloween': 'Halloween',
    "im-sorry": "I\u2019m Sorry",
    'just-because': 'Just Because',
    'love-and-romance': 'Love & Romance',
    'new-baby': 'New Baby',
    'prom': 'Prom',
    'sympathy-and-funeral': 'Sympathy',
    'thank-you': 'Thank You',
    'thanksgiving': 'Thanksgiving',
    'wedding': 'Wedding',
    'quinceanera': 'Quincea\u00f1era'
  };

  /* Keep the client's own ordering for the chips. */
  var TAXONOMY = (DATA.occasions || []).map(slugify);

  function occRank(id) {
    var i = TAXONOMY.indexOf(id);
    return i === -1 ? 99 : i;
  }

  /* ---------------------------------------------------------------------
     Sample photography. Licensed stock (Pexels — see
     assets/img/LICENSE-MANIFEST.json) picked to match the composition the
     client describes in her own copy. Flagged as temporary in the UI.
     --------------------------------------------------------------------- */
  var SHOTS = {
    'autumn-blaze': {
      primary: 'terracotta-bouquet-kraft.jpg',
      alt: 'Terracotta, apricot and peach blooms gathered in kraft paper',
      gallery: ['terracotta-bouquet-kraft.jpg', 'crimson-ranunculus-field.jpg', 'dried-grasses-concrete.jpg']
    },
    'belmont': {
      primary: 'pink-cream-peonies-vase.jpg',
      alt: 'Bright blush and cream blooms in a clear glass vase',
      gallery: ['pink-cream-peonies-vase.jpg', 'blush-roses-closeup.jpg', 'blush-roses-white-wall.jpg']
    },
    'artisan-wrapped-bouquet': {
      primary: 'wrapped-bouquet-held.jpg',
      alt: 'A mixed bouquet wrapped in paper and ribbon, held',
      gallery: ['wrapped-bouquet-held.jpg', 'kraft-bundle-detail.jpg', 'coral-bouquet-white.jpg']
    },
    'the-emma': {
      primary: 'blush-roses-closeup.jpg',
      alt: 'A dense cluster of blush and white roses',
      gallery: ['blush-roses-closeup.jpg', 'pink-cream-peonies-vase.jpg', 'coral-ranunculus-white.jpg']
    },
    'autumn-pumpkin': {
      primary: 'blush-berries-bowls.jpg',
      alt: 'Bowls of blush and amber seasonal berries and blooms',
      gallery: ['blush-berries-bowls.jpg', 'terracotta-bouquet-kraft.jpg', 'dried-grasses-concrete.jpg']
    },
    'lovely-you': {
      primary: 'blush-roses-white-wall.jpg',
      alt: 'A bouquet of pink roses held against a white wall',
      gallery: ['blush-roses-white-wall.jpg', 'coral-ranunculus-held.jpg', 'mauve-peony-macro.jpg']
    },
    'autumn-shades': {
      primary: 'burgundy-dahlia-dark.jpg',
      alt: 'A deep burgundy autumn bloom in a dark vase, low light',
      gallery: ['burgundy-dahlia-dark.jpg', 'dark-wrap-white-roses.jpg', 'dried-branches-curtain.jpg']
    },
    'box-of-autumn': {
      primary: 'kraft-bundle-detail.jpg',
      alt: 'A kraft-paper wrapped bundle, paper and twine detail',
      gallery: ['kraft-bundle-detail.jpg', 'terracotta-bouquet-kraft.jpg', 'dried-grasses-concrete.jpg']
    },
    'autumn-serenade': {
      primary: 'dark-wrap-white-roses.jpg',
      alt: 'Cream roses with dark foliage in a burgundy wrap',
      gallery: ['dark-wrap-white-roses.jpg', 'burgundy-dahlia-dark.jpg', 'dried-branches-curtain.jpg']
    },
    'lavender-bag-of-flowers': {
      primary: 'minimal-dried-grasses-vase.jpg',
      alt: 'Muted lavender-grey stems in a small ceramic vase',
      gallery: ['minimal-dried-grasses-vase.jpg', 'dried-minimal-sprig.jpg', 'dried-sprig-plate.jpg']
    },
    'long-beach-charms': {
      primary: 'coral-ranunculus-white.jpg',
      alt: 'Soft pink and coral blooms in a close bunch on white',
      gallery: ['coral-ranunculus-white.jpg', 'blush-roses-closeup.jpg', 'pink-cream-peonies-vase.jpg']
    },
    'premium-sunflowers-arrangement': {
      primary: 'coral-bouquet-white.jpg',
      alt: 'Warm coral and orange blooms against a white wall',
      gallery: ['coral-bouquet-white.jpg', 'terracotta-bouquet-kraft.jpg', 'wrapped-bouquet-held.jpg']
    },
    'wonderful-world': {
      primary: 'coral-ranunculus-held.jpg',
      alt: 'A bright coral bouquet held against soft white fabric',
      gallery: ['coral-ranunculus-held.jpg', 'coral-ranunculus-white.jpg', 'coral-bouquet-white.jpg']
    },
    'violets-in-blue': {
      primary: 'white-ranunculus-dark.jpg',
      alt: 'White blooms on a dark ground, low key',
      gallery: ['white-ranunculus-dark.jpg', 'white-peonies-greenery.jpg', 'white-bloom-dark-water.jpg']
    },
    'enchanting': {
      primary: 'crimson-ranunculus-field.jpg',
      alt: 'A saturated bunch of crimson blooms',
      gallery: ['crimson-ranunculus-field.jpg', 'burgundy-dahlia-dark.jpg', 'blush-roses-closeup.jpg']
    },
    'color-my-world': {
      primary: 'mauve-peony-macro.jpg',
      alt: 'A single mauve-pink peony, close detail',
      gallery: ['mauve-peony-macro.jpg', 'coral-ranunculus-held.jpg', 'blush-roses-closeup.jpg']
    },
    'lush-life': {
      primary: 'white-hydrangea-wooden-bowl.jpg',
      alt: 'White hydrangeas arranged low in a wooden bowl',
      gallery: ['white-hydrangea-wooden-bowl.jpg', 'white-peonies-greenery.jpg', 'white-bloom-dark-water.jpg']
    }
  };

  var FALLBACK = {
    primary: 'wrapped-bouquet-held.jpg',
    alt: 'A hand-wrapped bouquet',
    gallery: ['wrapped-bouquet-held.jpg']
  };

  /* Captions describe the photograph itself — they never claim to be the
     client's own product photography. */
  var CAPTIONS = {
    'terracotta-bouquet-kraft.jpg': 'Terracotta and peach roses in kraft paper',
    'crimson-ranunculus-field.jpg': 'A saturated bunch of crimson blooms',
    'dried-grasses-concrete.jpg': 'Dried grasses against concrete',
    'pink-cream-peonies-vase.jpg': 'Pink and cream blooms in a glass vase',
    'blush-roses-closeup.jpg': 'Blush and white roses, close cluster',
    'blush-roses-white-wall.jpg': 'Blush roses held against a white wall',
    'wrapped-bouquet-held.jpg': 'A wrapped bouquet, held',
    'kraft-bundle-detail.jpg': 'Kraft-wrapped bundle, paper texture',
    'coral-bouquet-white.jpg': 'Coral and orange blooms on white',
    'coral-ranunculus-white.jpg': 'Coral blooms in a close bunch on white',
    'blush-berries-bowls.jpg': 'Bowls of blush seasonal berries',
    'coral-ranunculus-held.jpg': 'Coral ranunculus held against soft fabric',
    'mauve-peony-macro.jpg': 'A single mauve-pink peony, macro',
    'burgundy-dahlia-dark.jpg': 'Deep burgundy bloom in a dark vase',
    'dark-wrap-white-roses.jpg': 'White roses and dark foliage in a wrap',
    'dried-branches-curtain.jpg': 'Dried branches by a linen curtain',
    'minimal-dried-grasses-vase.jpg': 'Dried grasses in a small ceramic vase',
    'dried-minimal-sprig.jpg': 'A sparse dried sprig in a small vase',
    'dried-sprig-plate.jpg': 'A dried sprig on a pale plate',
    'white-ranunculus-dark.jpg': 'White ranunculus on a dark ground',
    'white-peonies-greenery.jpg': 'White peonies with green stems',
    'white-bloom-dark-water.jpg': 'A white bloom floating in dark water',
    'white-hydrangea-wooden-bowl.jpg': 'White hydrangeas in a wooden bowl'
  };

  function captionFor(src) {
    return CAPTIONS[src] || 'Sample photograph';
  }

  /* ---------------------------------------------------------------------
     Sizes — the client's three tiers. Deltas are sample values.
     --------------------------------------------------------------------- */
  var SIZES = [
    { id: 'standard', label: 'Standard', note: 'As published', delta: 0 },
    { id: 'deluxe', label: 'Deluxe', note: '+$25 \u00b7 sample', delta: 25 },
    { id: 'premium', label: 'Premium', note: '+$50 \u00b7 sample', delta: 50 }
  ];

  var moneyFmt = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  function money(n) {
    return moneyFmt.format(Number(n) || 0);
  }

  function pad(n) {
    return n < 10 ? '0' + n : String(n);
  }

  /* ---------------------------------------------------------------------
     The sympathy edit — the client's own "Sympathy and Funeral" occasion.

     Her taxonomy (see ABC_CATALOGUE.occasions) carries the category, but the
     seventeen verified products were captured without a sympathy tag on most
     of them, so the category had nothing to filter. These three are surfaced
     under it on the strength of the shop's own published description of each
     arrangement. No product is renamed, repriced or re-described, and the
     Violets in Blue copy says it outright. The shop's own category listings
     still need confirming — the filter carries that note in the UI.
     --------------------------------------------------------------------- */
  var SYMPATHY = {
    'violets-in-blue': 'The description reads "perfect as a sympathy arrangement".',
    'lush-life': 'A low, quiet bowl of white and rose, hydrangea and succulents.',
    'lavender-bag-of-flowers': 'Soft lavender and white — described as a thoughtful gift.'
  };

  /* ---------------------------------------------------------------------
     Build the product list from the client's data
     --------------------------------------------------------------------- */
  var PRODUCTS = DATA.products.map(function (p, i) {
    var occ = (p.occasions || []).map(slugify);
    if (SYMPATHY[p.slug] && occ.indexOf('sympathy-and-funeral') === -1) {
      occ.push('sympathy-and-funeral');
    }
    occ = occ.sort(function (a, b) { return occRank(a) - occRank(b); });
    var shot = SHOTS[p.slug] || FALLBACK;
    var tags = p.tags || [];

    return {
      slug: p.slug,
      no: pad(i + 1),
      name: p.name,
      price: Number(p.price),
      currency: p.currency || 'USD',
      description: p.description || '',
      occasions: occ,
      occasionLabel: occ.map(function (o) { return LABELS[o] || o; }).join(' \u00b7 '),
      tag: tags.length ? tags[0].replace(/\b\w/g, function (c) { return c.toUpperCase(); }) : null,
      image: shot.primary,
      alt: shot.alt,
      gallery: shot.gallery.map(function (src) { return { src: src, caption: captionFor(src) }; })
    };
  });

  function findProduct(slug) {
    for (var i = 0; i < PRODUCTS.length; i++) {
      if (PRODUCTS[i].slug === slug) return PRODUCTS[i];
    }
    return null;
  }

  function findSize(id) {
    for (var i = 0; i < SIZES.length; i++) {
      if (SIZES[i].id === id) return SIZES[i];
    }
    return SIZES[0];
  }

  /* Unit price for one product at one of the three sample sizes. */
  function priceOf(product, sizeId) {
    var p = typeof product === 'string' ? findProduct(product) : product;
    if (!p) return 0;
    return p.price + findSize(sizeId).delta;
  }

  /* Front-page edit: the autumn campaign plus the shop's best sellers —
     twelve of the seventeen, so the homepage stays a curated selection. */
  var FRONT = [
    'autumn-blaze',
    'autumn-pumpkin',
    'box-of-autumn',
    'autumn-serenade',
    'belmont',
    'the-emma',
    'long-beach-charms',
    'lush-life'
  ].map(findProduct).filter(Boolean);

  /* ---------------------------------------------------------------------
     Chips — only the occasions that actually occur in the products shown
     --------------------------------------------------------------------- */
  function occasionsFor(list) {
    var counts = {};
    list.forEach(function (p) {
      p.occasions.forEach(function (o) { counts[o] = (counts[o] || 0) + 1; });
    });
    return Object.keys(counts)
      .sort(function (a, b) {
        if (counts[b] !== counts[a]) return counts[b] - counts[a];
        return occRank(a) - occRank(b);
      })
      .map(function (id) {
        return { id: id, label: LABELS[id] || id, count: counts[id] };
      });
  }

  global.AFH = {
    IMG: IMG,
    RESP: RESP,
    IMAGES: IMAGES,
    BUSINESS: DATA.business,
    TAXONOMY: DATA.occasions || [],
    LABELS: LABELS,
    PRODUCTS: PRODUCTS,
    FRONT: FRONT,
    SIZES: SIZES,
    SYMPATHY: SYMPATHY,
    findProduct: findProduct,
    findSize: findSize,
    priceOf: priceOf,
    occasionsFor: occasionsFor,
    money: money,
    shotInfo: shotInfo,
    widthsFor: widthsFor,
    webpSrcset: webpSrcset,
    jpegSrc: jpegSrc,
    picture: picture
  };
})(window);
