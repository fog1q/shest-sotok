(() => {
  "use strict";

  const VER = (window.SOTOK_DATA && window.SOTOK_DATA.ASSET_VER) || "20261114d";
  const A = (path) => `assets/${path}.webp?v=${VER}`;
  const TRANSPORT = ["bike", "moped", "sedan"];

  // Horizon: % from the top of #home-art where the far edge of the yard
  // meets the distant tree line. Measured on each season background as
  // shown (object-fit: cover, object-position: center bottom) in a 390×780 stage.
  const HORIZON = {
    spring: 54,
    summer: 54,
    autumn: 53.5,
    winter: 55.5,
  };

  // How far below the horizon (in % of stage height) each depth row stands.
  // Back row sits just onto the grass; middle and front step down the yard.
  const DEPTH = {
    back: 5.5,
    mid: 18.5,
    front: 27,
  };

  // Per-object layout. `width` / attach values may be a number or a per-level array.
  // `left` / `right` are % of the stage. Optional `y` adds extra % below the depth line
  // (larger y = closer to the camera). `attach` items live inside a parent group.
  const LAYOUT = {
    house:      { depth: "back",  left: 1,  width: [44, 47, 50, 52], z: 3 },
    antenna:    { attach: "house", width: [30, 26, 24, 24], left: [58, 50, 46, 48], bottom: [80, 78, 80, 84] },
    apple:      { depth: "back",  left: 36, width: 24, widthSeason: { winter: 30 }, z: 4 },
    birdhouse:  { attach: "apple", left: 60, width: 24, bottom: 44 },
    bathhouse:  { depth: "back",  left: 52, width: 21, z: 3 },
    sarai:      { depth: "back",  left: 66, width: [25, 26, 26], z: 2 },
    greenhouse: { depth: "mid",   left: 1,  width: 24, z: 5 },
    plots:      { depth: "mid",   left: 25, width: 28, z: 5, y: 1 },
    well:       { depth: "mid",   left: 45, width: 12, z: 5, y: 2 },
    pens:       { depth: "mid",   left: 54, width: 28, z: 6 },
    fence:      { depth: "front", left: 10, width: 56, height: 11, z: 7 },
    bench:      { depth: "front", left: 24, width: 20, z: 8, y: 1 },
    transport:  { depth: "front", left: 0,  width: [46, 40, 44], z: 8, y: 6 },
    farmer:     { depth: "front", right: 0, width: 30, z: 9, y: 8 },
    // Standalone birdhouse on a pole, used only when the apple tree is absent.
    birdpole:   { depth: "back",  left: 42, width: 7, z: 4, y: 1 },
    kitchen:    { depth: "front", left: 2,  width: 18, z: 8, y: -3 },
    cellar:     { depth: "front", left: 62, width: 16, z: 8, y: -5 },
    separator:  { attach: "kitchen", width: 28, left: 72, bottom: 8 },
    spinner:    { attach: "kitchen", width: 22, left: -6, bottom: 10 },
  };

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
    const soil = soilSrc(season);
    const cells = (plots || []).map((p, i) => {
      let inner = `<img src="${soil}" alt="">`;
      if (p.unlocked && p.cropId) {
        let src = A("stages/sprout");
        if (p.withered) src = A("stages/withered");
        else if (p.growReady) src = A(`crops/${p.cropId}`);
        else if (p.grownMs) src = A("stages/growing");
        if (p.growReady && !p.withered) {
          inner = `<img class="bed" src="${soil}" alt=""><img class="ripe" src="${src}" alt="">`;
        } else {
          inner = `<img class="bed" src="${soil}" alt=""><img src="${src}" alt="">`;
        }
      } else if (!p.unlocked) {
        inner = `<img class="locked-bed" src="${soil}" alt="">`;
      }
      const marks = [];
      if (p.thirsty) marks.push("thirst");
      if (p.weeds) marks.push("weeds");
      if (p.pest) marks.push("pest");
      if (p.growReady) marks.push("ripe");
      const mark = marks.length ? `<span class="mini-care ${marks.join(" ")}"></span>` : "";
      return `<div class="mini-plot ${p.unlocked ? "open" : "shut"} ${season === "winter" ? "winter" : ""}" data-plot="${i}">${inner}${mark}</div>`;
    }).join("");
    return prop("home-plots", null, placeStyle(LAYOUT.plots, season), "", {
      winter: season === "winter",
      inner: `<div class="plots-grid">${cells}</div>
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
        <button type="button" class="hotspot" data-dela data-dela-tab="quests" data-hotspot="house" data-testid="hot-dela" aria-label="Дела">
          <span class="hs-label">Дела</span>
          <span class="hs-badge" data-badge="dela" hidden></span>
        </button>`, ...W })}
      ${prop(`sarai sarai-${saraiLv}`, A("buildings/sarai-" + saraiLv), placeStyle(LAYOUT.sarai, season, saraiLv), "", { inner: `
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
      ${prop("farmer", A("farmer/" + season), placeStyle(LAYOUT.farmer, season), 'data-testid="farmer-art"', { winter: season === "winter" })}
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
      A("decor/bench"), A("decor/antenna"), A("decor/birdhouse"), A("decor/pen"),
      A("stages/soil"), A("stages/soil-winter"), A("stages/sprout"), A("stages/growing"), A("stages/withered"),
      A("buildings/kitchen"), A("buildings/cellar"), A("buildings/stove"), A("buildings/separator"),
      A("buildings/spinner"), A("buildings/barrel"),
    );
    return urls;
  }

  window.SOTOK_HOME = { render, preloadList, asset: A, HORIZON, DEPTH, LAYOUT };
})();
