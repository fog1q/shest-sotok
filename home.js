(() => {
  "use strict";

  const VER = (window.SOTOK_DATA && window.SOTOK_DATA.ASSET_VER) || "20261115d";
  const A = (path) => `assets/${path}.webp?v=${VER}`;
  const TRANSPORT = ["bike", "moped", "sedan"];

  // Horizon: % from the top of #home-art where the far edge of the yard
  // meets the distant tree line. Measured on each season background as
  // shown (object-fit: cover, object-position: center bottom) in a 390×780 stage.
  const HORIZON = {
    spring: 50,
    summer: 50,
    autumn: 50,
    winter: 51,
  };

  // How far below the horizon (in % of stage height) each depth row stands.
  // Back row sits just onto the grass; middle and front step down the yard.
  const DEPTH = {
    back: 5.5,
    mid: 18,
    front: 36,
  };

  // Crop slots over decor/garden-beds.webp, back row first, percentages of the sprite.
  const BED_SLOTS = [
    {
      "x": 18.9,
      "y": 0.0,
      "w": 17.45,
      "h": 16.0
    },
    {
      "x": 41.2,
      "y": 0.0,
      "w": 17.77,
      "h": 15.8
    },
    {
      "x": 63.73,
      "y": 0.0,
      "w": 18.01,
      "h": 16.0
    },
    {
      "x": 12.36,
      "y": 18.52,
      "w": 21.65,
      "h": 21.2
    },
    {
      "x": 39.26,
      "y": 18.67,
      "w": 21.57,
      "h": 21.2
    },
    {
      "x": 65.91,
      "y": 18.47,
      "w": 21.97,
      "h": 21.39
    },
    {
      "x": 4.12,
      "y": 43.29,
      "w": 27.14,
      "h": 30.26
    },
    {
      "x": 36.67,
      "y": 43.29,
      "w": 26.41,
      "h": 30.26
    },
    {
      "x": 68.66,
      "y": 43.29,
      "w": 27.38,
      "h": 30.26
    }
  ];

  // Per-object layout. `width` / attach values may be a number or a per-level array.
  // `left` / `right` are % of the stage. Optional `y` adds extra % below the depth line
  // (larger y = closer to the camera). `attach` items live inside a parent group.
  const LAYOUT = {
    house:      { depth: "back",  left: 4,  width: [44, 48, 50, 52], z: 3, y: 5 },
    antenna:    { attach: "house", width: [22, 20, 18, 18], left: [58, 52, 48, 50], bottom: [78, 76, 78, 82] },
    apple:      { depth: "back",  left: 38, width: 22, widthSeason: { winter: 28 }, z: 4, y: 1 },
    birdhouse:  { attach: "apple", left: 60, width: 24, bottom: 44 },
    bathhouse:  { depth: "back",  left: 48, width: 18, z: 3 },
    sarai:      { depth: "back",  left: 64, width: [32, 34, 36], z: 2, y: 4 },
    greenhouse: { depth: "mid",   left: 2,  width: 20, z: 5, y: -6 },
    plots:      { depth: "mid",   left: 12, width: 68, z: 5, y: 11.5 },
    well:       { depth: "mid",   left: 6,  width: 10, z: 5, y: 2 },
    pens:       { depth: "front", left: 54, width: 44, z: 8, y: -4 },
    fence:      { depth: "back",  left: 0,  width: 10, height: 14, z: 2, y: 3 },
    bench:      { depth: "front", left: 2,  width: 16, z: 8, y: -6 },
    transport:  { depth: "mid",   left: 0,  width: [20, 22, 26], z: 5, y: 2 },
    farmer:     { depth: "front", left: 2,  width: 38, z: 11, y: 3 },
    birdpole:   { depth: "back",  left: 42, width: 7, z: 4, y: 1 },
    kitchen:    { depth: "mid",   left: 0,  width: 16, z: 7, y: 8 },
    cellar:     { depth: "back",  left: 56, width: 14, z: 3, y: 2 },
    separator:  { attach: "kitchen", width: 28, left: 72, bottom: 8 },
    spinner:    { attach: "kitchen", width: 22, left: -6, bottom: 10 },
    currant:    { depth: "back",  left: 30, width: 11, z: 4, y: 2 },
    raspberry:  { depth: "back",  left: 52, width: 11, z: 4, y: 1 },
    cherry:     { depth: "back",  left: 58, width: 14, z: 3, y: 0 },
    beehive:    { depth: "mid",   left: 70, width: 15, z: 7, y: 5 },
    sharik:     { depth: "front", left: 46, width: 17, z: 12, y: 6 },
    holiday:    { depth: "front", left: 36, width: 16, z: 10, y: -8 },
  };

  const CAT_SPOTS = [
    { depth: "front", left: 3,  width: 13, z: 13, y: 6 },
    { depth: "front", left: 35, width: 11, z: 13, y: 6 },
    { depth: "front", left: 84, width: 12, z: 12, y: 5 },
    { depth: "front", left: 64, width: 10, z: 13, y: 7 },
    { depth: "mid",   left: 8,  width: 9,  z: 7,  y: 8 },
  ];

  function pick(value, level) {
    if (!Array.isArray(value)) return value;
    return value[Math.min(Math.max(0, level || 0), value.length - 1)];
  }

  function groundOf(spec, season) {
    const h = HORIZON[season] ?? HORIZON.summer;
    const d = DEPTH[spec.depth] ?? 0;
    return h + d + (spec.y || 0);
  }

  function placeStyle(spec, season, level) {
    const g = groundOf(spec, season);
    const w = (spec.widthSeason && spec.widthSeason[season] != null)
      ? spec.widthSeason[season]
      : pick(spec.width, level);
    const parts = [`--ground:${g}%`, `--w:${w}%`, `--z:${spec.z || 2}`];
    if (spec.height != null) parts.push(`--h:${pick(spec.height, level)}%`);
    if (spec.right != null) {
      parts.push("left:auto", `--right:${spec.right}%`);
    } else {
      parts.push(`--x:${pick(spec.left, level)}%`);
    }
    return parts.join(";");
  }

  function attachStyle(spec, level) {
    const parts = [`width:${pick(spec.width, level)}%`];
    if (spec.left != null) parts.push(`left:${pick(spec.left, level)}%`);
    if (spec.right != null) parts.push(`right:${pick(spec.right, level)}%`, "left:auto");
    if (spec.bottom != null) parts.push(`bottom:${pick(spec.bottom, level)}%`);
    if (spec.top != null) parts.push(`top:${pick(spec.top, level)}%`);
    return parts.join(";");
  }

  function prop(cls, src, style, extra, opts) {
    const shadow = !opts || opts.shadow !== false;
    const inner = (opts && opts.inner) || "";
    const sh = shadow ? `<span class="ground-shadow" aria-hidden="true"></span>` : "";
    const winter = opts && opts.winter;
    const skipDrift = opts && opts.noDrift;
    const drift = winter && shadow && !skipDrift
      ? `<span class="snow-drift" aria-hidden="true"><i></i><i></i><i></i></span>`
      : "";
    const cap = winter && opts.snowCap ? `<span class="snow-cap" aria-hidden="true"></span>` : "";
    const art = src
      ? `<img class="prop-art" src="${src}" alt="" draggable="false"${extra ? ` ${extra}` : ""}>`
      : "";
    const clsW = winter ? `${cls} winter` : cls;
    return `<div class="prop layer ${clsW}" style="${style}">${sh}${drift}${cap}${art}${inner}</div>`;
  }

  function appleSrc(season) {
    return A(`decor/apple-${season}`);
  }

  function soilSrc(season) {
    return season === "winter" ? A("stages/soil-winter") : A("stages/soil");
  }

  function plotsLayer(plots, season) {
    const winter = season === "winter";
    const cells = (plots || []).map((p, i) => {
      const slot = BED_SLOTS[i] || { x: 10, y: 10, w: 20, h: 20 };
      let crop = "";
      // Outdoors are dormant in winter: empty snow-capped beds, no growing crops.
      if (!winter && p.unlocked && p.cropId) {
        let src = A("stages/sprout");
        if (p.withered) src = A("stages/withered");
        else if (p.growReady) src = A(`crops/${p.cropId}`);
        else if (p.grownMs) src = A("stages/growing");
        crop = `<img class="plot-crop ${p.growReady && !p.withered ? "ripe" : ""}" src="${src}" alt="">`;
      }
      const marks = [];
      if (p.thirsty) marks.push("thirst");
      if (p.weeds) marks.push("weeds");
      if (p.pest) marks.push("pest");
      if (p.growReady) marks.push("ripe");
      const mark = (!winter && marks.length) ? `<span class="mini-care ${marks.join(" ")}"></span>` : "";
      const style = `left:${slot.x}%;top:${slot.y}%;width:${slot.w}%;height:${slot.h}%`;
      return `<div class="mini-plot ${p.unlocked ? "open" : "shut"} ${season === "winter" ? "winter" : ""}" data-plot="${i}" style="${style}">${crop}${mark}</div>`;
    }).join("");
    return prop("home-plots", null, placeStyle(LAYOUT.plots, season), "", {
      winter: season === "winter",
      inner: `<img class="plots-beds" src="${A(winter ? "decor/garden-beds-winter" : "decor/garden-beds")}" alt="">
        <div class="plots-crops">${cells}</div>
        <button type="button" class="hotspot" data-nav="farm" data-hotspot="plots" data-testid="hot-plots" aria-label="Участок">
          <span class="hs-label">Участок</span>
          <span class="hs-badge" data-badge="plots" hidden></span>
        </button>`,
    });
  }

  function pensLayer(pens, animals, season) {
    const count = Math.max(1, pens || 1);
    const list = (animals || []).slice(0, count).map((a) => {
      const file = a.adult ? a.kind : `${a.kind}-baby`;
      return `<img class="home-animal ${a.kind} ${a.adult ? "adult" : "baby"}" src="${A("animals/" + file)}" alt="">`;
    }).join("");
    return prop("home-pens", null, placeStyle(LAYOUT.pens, season), "", {
      winter: season === "winter",
      inner: `<img class="pen-frame" src="${A("decor/pen")}" alt=""><div class="home-animals">${list}</div>
        <button type="button" class="hotspot" data-nav="yard" data-hotspot="pens" data-testid="hot-pens" aria-label="Двор">
          <span class="hs-label">Двор</span>
          <span class="hs-badge" data-badge="pens" hidden></span>
        </button>`,
    });
  }


  function bushSrc(id, season) {
    if (id === "apple") return A("decor/apple-" + season);
    if (season === "winter") return A("decor/" + id + "-winter");
    return A("decor/" + id);
  }

  function wardrobeBodyId(outfit) {
    const top = String((outfit && outfit.top) || "top-shirt").replace(/^top-/, "");
    const bot = String((outfit && outfit.bottom) || "pants-green").replace(/^pants-/, "");
    return "body-" + top + "-" + bot;
  }

  function farmerProp(model, season) {
    const style = placeStyle(LAYOUT.farmer, season);
    const outfit = model.outfit;
    const useSeasonSprite = model.wardrobeAuto !== false && !(model.holiday && model.holiday.hand && outfit && outfit.hand === model.holiday.hand);
    if (!outfit || useSeasonSprite) {
      return prop("farmer", A("farmer/" + season), style, 'data-testid="farmer-art"', { winter: season === "winter" });
    }
    const layers = [
      `<img class="prop-art farmer-layer farmer-base" src="${A("wardrobe/" + wardrobeBodyId(outfit))}" alt="" draggable="false" data-testid="farmer-art">`,
      outfit.head ? `<img class="prop-art farmer-layer farmer-head" src="${A("wardrobe/" + outfit.head)}" alt="" draggable="false">` : "",
      outfit.hand ? `<img class="prop-art farmer-layer farmer-hand" src="${A("wardrobe/" + outfit.hand)}" alt="" draggable="false">` : "",
    ].join("");
    return prop("farmer layered", null, style, "", {
      winter: season === "winter",
      inner: `<div class="farmer-fit"><div class="farmer-stack">${layers}</div></div>`,
    });
  }

  function extraActors(model, season) {
    const bits = [];
    const per = model.perennials || {};
    const up = model.upgrades || {};
    if (per.currant && per.currant.owned) bits.push(prop("bush currant", bushSrc("currant", season), placeStyle(LAYOUT.currant, season), 'data-testid="home-currant"', { winter: season === "winter" }));
    if (per.raspberry && per.raspberry.owned) bits.push(prop("bush raspberry", bushSrc("raspberry", season), placeStyle(LAYOUT.raspberry, season), 'data-testid="home-raspberry"', { winter: season === "winter" }));
    if (per.cherry && per.cherry.owned) bits.push(prop("bush cherry", bushSrc("cherry", season), placeStyle(LAYOUT.cherry, season), 'data-testid="home-cherry"', { winter: season === "winter" }));
    if (up.beehive) bits.push(prop("beehive", A("buildings/beehive"), placeStyle(LAYOUT.beehive, season), 'data-testid="home-beehive"', { winter: season === "winter" }));
    if (model.dog && model.dog.owned) bits.push(prop("sharik", A("animals/sharik"), placeStyle(LAYOUT.sharik, season), 'data-testid="home-sharik"', { winter: season === "winter" }));
    if (model.holiday && model.holiday.decor) {
      bits.push(prop("holiday-decor", A("holiday/" + model.holiday.decor), placeStyle(LAYOUT.holiday, season), 'data-testid="home-holiday"', { shadow: false }));
    }
    (model.cats || []).forEach((id, i) => {
      const spot = CAT_SPOTS[i % CAT_SPOTS.length];
      bits.push(prop("home-cat cat-" + id, A("cats/" + id), placeStyle(spot, season), `data-testid="home-cat-${id}"`, { winter: season === "winter" }));
    });
    return bits.join("");
  }

  function render(model) {
    const {
      season = "spring",
      upgrades = {},
      plots = [],
      greenhouse = [],
      pens = 1,
      animals = [],
    } = model || {};
    const houseLv = upgrades.house || 0;
    const saraiLv = upgrades.sarai || 0;
    const fenceLv = upgrades.fence || 0;
    const transLv = upgrades.transport || 0;
    const ghOn = (greenhouse || []).some((p) => p.unlocked);

    const antenna = upgrades.antenna
      ? `<img class="attach antenna" src="${A("decor/antenna")}" alt="" draggable="false" style="${attachStyle(LAYOUT.antenna, houseLv)}">`
      : "";
    const birdOnTree = upgrades.apple && upgrades.birdhouse
      ? `<img class="attach birdhouse" src="${A("decor/birdhouse")}" alt="" draggable="false" style="${attachStyle(LAYOUT.birdhouse)}">`
      : "";
    const birdOnPole = !upgrades.apple && upgrades.birdhouse
      ? prop(
        "birdpole",
        null,
        placeStyle(LAYOUT.birdpole, season),
        "",
        { inner: `<span class="pole-stick" aria-hidden="true"></span><img class="attach birdhouse" src="${A("decor/birdhouse")}" alt="" draggable="false" style="left:0;width:100%;bottom:100%;">` },
      )
      : "";

    const W = { winter: season === "winter", snowCap: season === "winter" };
    const kitchenInner = `
      ${upgrades.separator ? `<img class="attach" src="${A("buildings/separator")}" alt="" style="${attachStyle(LAYOUT.separator)}">` : ""}
      ${upgrades.spinner ? `<img class="attach" src="${A("buildings/spinner")}" alt="" style="${attachStyle(LAYOUT.spinner)}">` : ""}
      <button type="button" class="hotspot" data-open-craft data-hotspot="craft" data-testid="hot-craft" aria-label="Переработка">
        <span class="hs-label">Кухня</span>
        <span class="hs-badge" data-badge="craft" hidden></span>
      </button>`;
    return `<div class="home-layers" data-testid="home-svg" data-horizon="${HORIZON[season] ?? HORIZON.summer}" data-season="${season}">
      <div class="home-stage" data-testid="home-stage">
      <img class="layer bg" src="${A("bg/" + season)}" alt="" draggable="false">
      <div class="tod-tint" aria-hidden="true"></div>
      <div class="home-ambient" aria-hidden="true">
        <span class="cloud c1"></span><span class="cloud c2"></span><span class="cloud c3"></span>
        <span class="bird b1"></span><span class="bird b2"></span>
        <span class="smoke s1"></span>
      </div>
      <div class="home-paths ${season}" aria-hidden="true"></div>
      ${prop(`house house-${houseLv}`, A("buildings/house-" + houseLv), placeStyle(LAYOUT.house, season, houseLv), "", { inner: antenna + `
        <span class="ground-tufts" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
        <button type="button" class="hotspot" data-dela data-dela-tab="quests" data-hotspot="house" data-testid="hot-dela" aria-label="Дела">
          <span class="hs-label">Дела</span>
          <span class="hs-badge" data-badge="dela" hidden></span>
        </button>`, ...W })}
      ${prop(`sarai sarai-${saraiLv}`, A("buildings/sarai-" + saraiLv), placeStyle(LAYOUT.sarai, season, saraiLv), "", { inner: `
        <span class="ground-tufts" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
        <button type="button" class="hotspot" data-nav="barn" data-hotspot="sarai" data-testid="hot-sarai" aria-label="Сарай">
          <span class="hs-label">Сарай</span>
        </button>`, ...W })}
      ${upgrades.bathhouse ? prop("bathhouse", A("buildings/bathhouse"), placeStyle(LAYOUT.bathhouse, season), "", W) : ""}
      ${upgrades.apple ? prop("apple sway", appleSrc(season), placeStyle(LAYOUT.apple, season), "", { inner: birdOnTree, winter: season === "winter" }) : ""}
      ${birdOnPole}
      ${ghOn ? prop("greenhouse", A("buildings/greenhouse"), placeStyle(LAYOUT.greenhouse, season), "", W) : ""}
      ${upgrades.well ? prop("well", A("buildings/well"), placeStyle(LAYOUT.well, season), "", { winter: season === "winter" }) : ""}
      ${upgrades.kitchen ? prop("kitchen", A("buildings/kitchen"), placeStyle(LAYOUT.kitchen, season), "", { inner: kitchenInner, ...W }) : ""}
      ${upgrades.cellar ? prop("cellar", A("buildings/cellar"), placeStyle(LAYOUT.cellar, season), "", { inner: `
        <button type="button" class="hotspot" data-open-craft data-hotspot="cellar" data-testid="hot-cellar" aria-label="Погреб">
          <span class="hs-label">Погреб</span>
        </button>`, ...W }) : ""}
      ${plotsLayer(plots, season)}
      ${pensLayer(pens, animals, season)}
      ${prop(`fence fence-${fenceLv}`, A("fence/fence-" + fenceLv), placeStyle(LAYOUT.fence, season), "", { winter: season === "winter", shadow: true, noDrift: true })}
      ${upgrades.bench ? prop("bench", A("decor/bench"), placeStyle(LAYOUT.bench, season), "", { winter: season === "winter" }) : ""}
      ${prop(`transport transport-${transLv}`, A("transport/" + TRANSPORT[transLv]), placeStyle(LAYOUT.transport, season, transLv), "", { winter: season === "winter" })}
      ${extraActors(model, season)}
      ${farmerProp(model, season)}
      </div>
    </div>`;
  }

  function preloadList() {
    const urls = [];
    for (const s of ["spring", "summer", "autumn", "winter"]) {
      urls.push(A("bg/" + s), A("farmer/" + s), A("decor/apple-" + s));
    }
    for (let i = 0; i < 4; i += 1) urls.push(A("buildings/house-" + i));
    for (let i = 0; i < 3; i += 1) {
      urls.push(A("buildings/sarai-" + i), A("fence/fence-" + i), A("transport/" + TRANSPORT[i]));
    }
    urls.push(
      A("buildings/greenhouse"), A("buildings/well"), A("buildings/bathhouse"),
      A("decor/bench"), A("decor/antenna"), A("decor/birdhouse"), A("decor/pen"), A("decor/garden-beds"), A("decor/garden-beds-winter"),
      A("stages/soil"), A("stages/soil-winter"), A("stages/sprout"), A("stages/growing"), A("stages/withered"),
      A("buildings/kitchen"), A("buildings/cellar"), A("buildings/stove"), A("buildings/separator"),
      A("buildings/spinner"), A("buildings/barrel"),
      A("buildings/beehive"), A("animals/sharik"), A("animals/goose"), A("animals/duck"),
      A("wardrobe/base"),
    );
    return urls;
  }

  window.SOTOK_HOME = { render, preloadList, asset: A, HORIZON, DEPTH, LAYOUT, BED_SLOTS };
})();
