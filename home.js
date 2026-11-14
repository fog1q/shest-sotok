(() => {
  "use strict";

  const VER = (window.SOTOK_DATA && window.SOTOK_DATA.ASSET_VER) || "20261114a";
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
    const art = src
      ? `<img class="prop-art" src="${src}" alt="" draggable="false"${extra ? ` ${extra}` : ""}>`
      : "";
    return `<div class="prop layer ${cls}" style="${style}">${sh}${art}${inner}</div>`;
  }

  function appleSrc(season) {
    return A(`decor/apple-${season}`);
  }

  function plotsLayer(plots, season) {
    const cells = (plots || []).map((p, i) => {
      let inner = `<img src="${A("stages/soil")}" alt="">`;
      if (p.unlocked && p.cropId) {
        let src = A("stages/sprout");
        if (p.withered) src = A("stages/withered");
        else if (p.growReady) src = A(`crops/${p.cropId}`);
        else if (p.grownMs) src = A("stages/growing");
        if (p.growReady && !p.withered) {
          inner = `<img class="bed" src="${A("stages/soil")}" alt=""><img class="ripe" src="${src}" alt="">`;
        } else {
          inner = `<img src="${src}" alt="">`;
        }
      } else if (!p.unlocked) {
        inner = `<img class="locked-bed" src="${A("stages/soil")}" alt="">`;
      }
      return `<div class="mini-plot ${p.unlocked ? "open" : "shut"}" data-plot="${i}">${inner}</div>`;
    }).join("");
    return prop("home-plots", null, placeStyle(LAYOUT.plots, season), "", {
      inner: `<div class="plots-grid">${cells}</div>`,
    });
  }

  function pensLayer(pens, animals, season) {
    const count = Math.max(1, pens || 1);
    const list = (animals || []).slice(0, count).map((a) => {
      const file = a.adult ? a.kind : `${a.kind}-baby`;
      return `<img class="home-animal ${a.kind} ${a.adult ? "adult" : "baby"}" src="${A("animals/" + file)}" alt="">`;
    }).join("");
    return prop("home-pens", null, placeStyle(LAYOUT.pens, season), "", {
      inner: `<img class="pen-frame" src="${A("decor/pen")}" alt=""><div class="home-animals">${list}</div>`,
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

    return `<div class="home-layers" data-testid="home-svg" data-horizon="${HORIZON[season] ?? HORIZON.summer}">
      <div class="home-stage" data-testid="home-stage">
      <img class="layer bg" src="${A("bg/" + season)}" alt="" draggable="false">
      ${prop(`house house-${houseLv}`, A("buildings/house-" + houseLv), placeStyle(LAYOUT.house, season, houseLv), "", { inner: antenna })}
      ${prop(`sarai sarai-${saraiLv}`, A("buildings/sarai-" + saraiLv), placeStyle(LAYOUT.sarai, season, saraiLv))}
      ${upgrades.bathhouse ? prop("bathhouse", A("buildings/bathhouse"), placeStyle(LAYOUT.bathhouse, season)) : ""}
      ${upgrades.apple ? prop("apple", appleSrc(season), placeStyle(LAYOUT.apple, season), "", { inner: birdOnTree }) : ""}
      ${birdOnPole}
      ${ghOn ? prop("greenhouse", A("buildings/greenhouse"), placeStyle(LAYOUT.greenhouse, season)) : ""}
      ${upgrades.well ? prop("well", A("buildings/well"), placeStyle(LAYOUT.well, season)) : ""}
      ${plotsLayer(plots, season)}
      ${pensLayer(pens, animals, season)}
      ${prop(`fence fence-${fenceLv}`, A("fence/fence-" + fenceLv), placeStyle(LAYOUT.fence, season))}
      ${upgrades.bench ? prop("bench", A("decor/bench"), placeStyle(LAYOUT.bench, season)) : ""}
      ${prop(`transport transport-${transLv}`, A("transport/" + TRANSPORT[transLv]), placeStyle(LAYOUT.transport, season, transLv))}
      ${prop("farmer", A("farmer/" + season), placeStyle(LAYOUT.farmer, season), 'data-testid="farmer-art"')}
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
      A("stages/soil"), A("stages/sprout"), A("stages/growing"), A("stages/withered"),
    );
    return urls;
  }

  window.SOTOK_HOME = { render, preloadList, asset: A, HORIZON, DEPTH, LAYOUT };
})();
