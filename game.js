(() => {
  "use strict";

  const D = window.SOTOK_DATA;
  const {
    SEASONS, SEASON_NAME, SEASON_PREP, SEASON_TO, WEATHER_TABLE,
    CROPS, CROP_ORDER, PRODUCTS, FEED_BUY_PRICE, FEED_RECIPES,
    ANIMALS, ANIMAL_ORDER, PLOT_PRICE, START_UNLOCKED, GREENHOUSE_PRICE,
    PEN_PRICE, MAX_PENS, START_PENS, XP_TABLE, WINTER_FEED_FACTOR, GH_WINTER_GROWTH,
    FERTILIZER_BOOST, LEVEL_REWARDS, DECOR_NAME, GIFT,
    UPGRADES, UPGRADE_ORDER, FARMER_TIPS,
  } = D;
  const defaultUpgrades = D.defaultUpgrades;

  let DAY_MS = D.TIMING.DAY_MS;
  let DAYS_PER_SEASON = D.TIMING.DAYS_PER_SEASON;
  const seasonMs = () => DAY_MS * DAYS_PER_SEASON;

  const SAVE_KEY = "shest-sotok-v4";
  const SAVE_KEYS_OLD = ["shest-sotok-v3", "shest-sotok-v2", "shest-sotok-v1"];
  const ASSET_VER = D.ASSET_VER || "20261114b";
  const TICK_MS = 250;
  const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;

  let timeOffset = 0;
  let state = null;
  let currentView = "home";
  let tickTimer = null;
  let warnedSeasonIndex = -1;

  const now = () => Date.now() + timeOffset;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  function emptyWarehouse() {
    const w = { feed: 0, fertilizer: 0 };
    for (const id of CROP_ORDER) w[id] = 0;
    for (const id of Object.keys(PRODUCTS)) w[id] = 0;
    return w;
  }

  function emptySeeds() {
    const s = {};
    for (const id of CROP_ORDER) s[id] = 0;
    s.radish = 3;
    s.dill = 2;
    s.tulip = 1;
    return s;
  }

  function defaultPlot(i) {
    return {
      id: i,
      kind: "soil",
      unlocked: START_UNLOCKED.includes(i),
      cropId: null,
      plantedAt: null,
      grownMs: 0,
      wateredUntil: 0,
      withered: false,
      fertilized: false,
    };
  }

  function defaultGreenhouse(i) {
    return {
      id: `gh-${i}`,
      kind: "greenhouse",
      unlocked: false,
      cropId: null,
      plantedAt: null,
      grownMs: 0,
      wateredUntil: 0,
      withered: false,
      fertilized: false,
    };
  }

  function defaultState() {
    const t = now();
    return {
      version: 4,
      coins: 80,
      xp: 0,
      claimedLevel: 1,
      seeds: emptySeeds(),
      warehouse: emptyWarehouse(),
      plots: Array.from({ length: 9 }, (_, i) => defaultPlot(i)),
      greenhouse: [defaultGreenhouse(0), defaultGreenhouse(1)],
      pens: START_PENS,
      animals: [],
      nextAnimalId: 1,
      upgrades: defaultUpgrades(),
      worldStartedAt: t,
      worldSeed: (Math.floor(Math.random() * 9000) + 1) | 0,
      lastSimAt: t,
      lastStormDay: -1,
      savedAt: t,
      timingVersion: 4,
      timingMode: D.TIMING.fast ? "fast" : "play",
      redeemedGifts: [],
    };
  }

  function allPlots() {
    return state.plots.concat(state.greenhouse);
  }

  function storageCap() {
    const lv = (state.upgrades && state.upgrades.sarai) || 0;
    const row = UPGRADES.sarai.levels[lv] || UPGRADES.sarai.levels[0];
    return (row.bonus && row.bonus.storage) || 30;
  }

  function warehouseUsed() {
    return Object.entries(state.warehouse || {}).reduce((s, [k, n]) => {
      if (k === "fertilizer") return s;
      return s + (Number(n) || 0);
    }, 0);
  }

  function canStore(n = 1) {
    return warehouseUsed() + n <= storageCap();
  }

  function nextUpgradeLevel(id) {
    const def = UPGRADES[id];
    if (!def) return null;
    if (def.type === "toggle") return state.upgrades[id] ? null : def;
    const cur = state.upgrades[id] || 0;
    return def.levels[cur + 1] || null;
  }

  function buyUpgrade(id) {
    sync();
    const def = UPGRADES[id];
    const level = levelFromXp(state.xp);
    if (!def) return false;
    if (def.type === "toggle") {
      if (state.upgrades[id]) return false;
      if (level < def.unlockLevel) { toast("Недостаточный разряд"); return false; }
      if (state.coins < def.price) { toast("Не хватает рублей"); return false; }
      state.coins -= def.price;
      state.upgrades[id] = true;
      save(); haptic("medium"); toast(`Купили: ${def.name}`); renderAll();
      return true;
    }
    const next = nextUpgradeLevel(id);
    if (!next) { toast("Уже максимальный уровень"); return false; }
    if (level < next.unlockLevel) { toast("Недостаточный разряд"); return false; }
    if (state.coins < next.price) { toast("Не хватает рублей"); return false; }
    state.coins -= next.price;
    state.upgrades[id] = (state.upgrades[id] || 0) + 1;
    save(); haptic("medium"); toast(`Теперь: ${next.name}`); renderAll();
    return true;
  }

  /* ——— Time / calendar / weather ——— */
  function calendarAt(ts = now()) {
    const elapsed = Math.max(0, ts - state.worldStartedAt);
    const dayIndex = Math.floor(elapsed / DAY_MS);
    const seasonIndex = Math.floor(dayIndex / DAYS_PER_SEASON);
    const seasonId = SEASONS[seasonIndex % 4];
    const dayInSeason = (dayIndex % DAYS_PER_SEASON) + 1;
    const msIntoSeason = elapsed % seasonMs();
    const msToNextSeason = seasonMs() - msIntoSeason;
    const msIntoDay = elapsed % DAY_MS;
    return { elapsed, dayIndex, seasonIndex, seasonId, dayInSeason, msToNextSeason, msIntoDay, year: Math.floor(seasonIndex / 4) + 1 };
  }

  function hash32(n) {
    n = (n ^ 0x9e3779b9) >>> 0;
    n = Math.imul(n ^ (n >>> 16), 0x85ebca6b);
    n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35);
    return (n ^ (n >>> 16)) >>> 0;
  }

  function pickWeather(dayIndex, seasonId) {
    const table = WEATHER_TABLE[seasonId] || WEATHER_TABLE.spring;
    const total = table.reduce((s, x) => s + x.w, 0);
    let r = hash32(dayIndex * 1021 + (state.worldSeed || 1) * 17) % total;
    for (const item of table) {
      if (r < item.w) return item;
      r -= item.w;
    }
    return table[0];
  }

  function weatherAt(ts = now()) {
    const cal = calendarAt(ts);
    return pickWeather(cal.dayIndex, cal.seasonId);
  }

  /* ——— Progression helpers ——— */
  function levelFromXp(xp) {
    let level = 1;
    for (let i = 1; i < XP_TABLE.length; i += 1) {
      if (xp >= XP_TABLE[i]) level = i + 1;
      else break;
    }
    return level;
  }

  function xpBounds(xp) {
    const level = levelFromXp(xp);
    const current = XP_TABLE[level - 1] ?? 0;
    const next = XP_TABLE[level] ?? XP_TABLE[XP_TABLE.length - 1];
    const maxed = level >= XP_TABLE.length;
    return { level, current, next, maxed, into: xp - current, need: next - current };
  }

  function formatTime(ms) {
    if (!Number.isFinite(ms)) return "—";
    const total = Math.max(0, Math.ceil(ms / 1000));
    const d = Math.floor(total / 86400);
    const h = Math.floor((total % 86400) / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (d > 0) return h ? `${d} д ${h} ч` : `${d} д`;
    if (h > 0) return m ? `${h} ч ${m} мин` : `${h} ч`;
    if (m >= 10) return `${m} мин`;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function rub(n) {
    const abs = Math.abs(n);
    const mod10 = abs % 10;
    const mod100 = abs % 100;
    let word = "рублей";
    if (mod100 < 11 || mod100 > 14) {
      if (mod10 === 1) word = "рубль";
      else if (mod10 >= 2 && mod10 <= 4) word = "рубля";
    }
    return `${n} ${word}`;
  }

  function seasonLabelList(seasons) {
    return seasons.map((s) => SEASON_NAME[s]).join(", ");
  }

  function cropAllowedNow(crop, plot, seasonId) {
    if (!crop) return false;
    if (plot && plot.kind === "greenhouse" && crop.greenhouse) return true;
    return crop.seasons.includes(seasonId);
  }

  function willWitherInSeason(plot, seasonId) {
    if (!plot.cropId || plot.withered) return false;
    const crop = CROPS[plot.cropId];
    return !cropAllowedNow(crop, plot, seasonId);
  }

  /* ——— Simulation ——— */
  function growthRate(plot, weather, ts) {
    if (!plot.unlocked || !plot.cropId || plot.withered) return 0;
    const crop = CROPS[plot.cropId];
    if (!crop) return 0;
    if (plot.grownMs >= crop.growMs) return 0;
    const inGh = plot.kind === "greenhouse";
    if (weather.haltOutdoor && !inGh) return 0;
    let rate = weather.growth;
    if (inGh && weather.haltOutdoor) rate = GH_WINTER_GROWTH;
    if (weather.needsWater && !inGh) {
      const auto = state.upgrades && state.upgrades.well;
      const watered = auto || (plot.wateredUntil && plot.wateredUntil > ts);
      rate = watered ? 1.05 : weather.growth;
    }
    return rate;
  }

  function applyStorm(dayIndex, weather) {
    if (!weather.damage || state.lastStormDay === dayIndex) return;
    state.lastStormDay = dayIndex;
    let hit = 0;
    for (const plot of allPlots()) {
      if (!plot.cropId || plot.withered) continue;
      if (plot.kind === "greenhouse" && weather.id !== "storm") continue;
      const roll = (hash32(dayIndex * 333 + hashId(plot.id) * 71 + state.worldSeed) % 1000) / 1000;
      const chance = plot.kind === "greenhouse" ? weather.damage * 0.35 : weather.damage;
      if (roll < chance) {
        plot.withered = true;
        hit += 1;
      }
    }
    if (hit) toast(`Непогода побила урожай: ${hit} ${hit === 1 ? "грядка" : "грядки"}`);
  }

  function hashId(id) {
    const s = String(id);
    let h = 0;
    for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
    return h;
  }

  function witherOffSeason(seasonId) {
    let n = 0;
    for (const plot of allPlots()) {
      if (willWitherInSeason(plot, seasonId)) {
        plot.withered = true;
        n += 1;
      }
    }
    if (n) toast(`Сезон сменился: ${n} ${n === 1 ? "посадка завяла" : "посадки завяли"}`);
  }

  function feedInterval(kind, seasonId) {
    const def = ANIMALS[kind];
    if (!def) return 1;
    return def.feedEveryMs * (seasonId === "winter" ? WINTER_FEED_FACTOR : 1);
  }

  function isHungryAt(animal, ts, seasonId) {
    return ts - animal.lastFedAt > feedInterval(animal.kind, seasonId);
  }

  function applyAnimals(dt, ts, seasonId) {
    for (const animal of state.animals) {
      const def = ANIMALS[animal.kind];
      if (!def) continue;
      const hungry = isHungryAt(animal, ts, seasonId);
      if (hungry) continue;
      if (!animal.adult) {
        animal.grownMs += dt;
        if (animal.grownMs >= def.growMs) animal.adult = true;
      } else if (def.product) {
        animal.productMs += dt;
      }
    }
  }

  function applyGrowth(dt, weather, ts) {
    for (const plot of allPlots()) {
      const rate = growthRate(plot, weather, ts);
      if (rate > 0) {
        const crop = CROPS[plot.cropId];
        plot.grownMs = Math.min(crop.growMs, plot.grownMs + dt * rate);
      }
    }
  }

  function simulateTo(targetTs) {
    if (!state) return;
    let cursor = state.lastSimAt || state.worldStartedAt;
    if (targetTs <= cursor) {
      state.lastSimAt = Math.max(state.lastSimAt || 0, targetTs);
      return;
    }
    const maxSteps = 20000;
    let steps = 0;
    while (cursor < targetTs && steps < maxSteps) {
      steps += 1;
      const cal = calendarAt(cursor);
      const dayStart = state.worldStartedAt + cal.dayIndex * DAY_MS;
      const nextDay = dayStart + DAY_MS;
      const weather = pickWeather(cal.dayIndex, cal.seasonId);
      if (weather.damage && cursor <= dayStart && targetTs > dayStart) {
        applyStorm(cal.dayIndex, weather);
      }
      const chunkEnd = Math.min(targetTs, nextDay);
      const dt = chunkEnd - cursor;
      if (dt > 0) {
        applyGrowth(dt, weather, cursor);
        applyAnimals(dt, cursor, cal.seasonId);
      }
      if (chunkEnd === nextDay && chunkEnd <= targetTs) {
        const before = cal.seasonId;
        const after = calendarAt(chunkEnd);
        if (after.seasonId !== before) witherOffSeason(after.seasonId);
      }
      cursor = chunkEnd;
    }
    state.lastSimAt = targetTs;
  }

  function sync(ts = now()) {
    simulateTo(ts);
    return calendarAt(ts);
  }

  /* ——— Telegram / storage ——— */
  function haptic(type = "light") {
    try {
      if (tg && tg.HapticFeedback) {
        if (type === "success" && tg.HapticFeedback.notificationOccurred) {
          tg.HapticFeedback.notificationOccurred("success");
        } else if (tg.HapticFeedback.impactOccurred) {
          tg.HapticFeedback.impactOccurred(type);
        }
      }
    } catch (_) { /* ignore */ }
  }

  function toast(text) {
    const box = $("#toasts");
    if (!box) return;
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = text;
    box.appendChild(el);
    setTimeout(() => el.remove(), 2400);
  }

  function initTelegram() {
    const greet = $("#greet");
    let name = "сосед";
    if (tg) {
      try {
        tg.ready();
        if (typeof tg.expand === "function") tg.expand();
        if (typeof tg.setHeaderColor === "function") tg.setHeaderColor("#8b1e18");
        if (typeof tg.setBackgroundColor === "function") tg.setBackgroundColor("#5c6140");
        if (tg.disableVerticalSwipes) {
          try { tg.disableVerticalSwipes(); } catch (_) { /* optional */ }
        }
        if (typeof tg.requestFullscreen === "function") {
          try { tg.requestFullscreen(); } catch (_) { /* optional */ }
        }
        const applySafe = () => {
          try {
            const sa = tg.safeAreaInset || {};
            const csa = tg.contentSafeAreaInset || {};
            const root = document.documentElement.style;
            root.setProperty("--sat", `${(sa.top || 0) + (csa.top || 0)}px`);
            root.setProperty("--sab", `${(sa.bottom || 0) + (csa.bottom || 0)}px`);
          } catch (_) { /* ignore */ }
        };
        applySafe();
        if (typeof tg.onEvent === "function") {
          tg.onEvent("viewportChanged", () => {
            try { if (typeof tg.expand === "function") tg.expand(); } catch (_) { /* ignore */ }
            applySafe();
          });
          tg.onEvent("safeAreaChanged", applySafe);
          tg.onEvent("contentSafeAreaChanged", applySafe);
        }
        const user = tg.initDataUnsafe && tg.initDataUnsafe.user;
        if (user && user.first_name) name = user.first_name;
      } catch (err) {
        console.warn("Telegram WebApp init skipped:", err);
      }
    }
    if (greet) greet.textContent = `Здравствуйте, ${name}!`;
    const homeGreet = $("#home-greet");
    if (homeGreet) homeGreet.textContent = `Здравствуйте, ${name}!`;
  }

  let persistEnabled = true;
  function persistLocal() {
    if (!persistEnabled) return;
    state.savedAt = now();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ ...state, _timeOffsetIgnored: true })); }
    catch (err) { console.warn("localStorage save failed", err); }
  }

  function persistCloud() {
    if (!tg || !tg.CloudStorage || typeof tg.CloudStorage.setItem !== "function") return;
    try {
      tg.CloudStorage.setItem(SAVE_KEY, JSON.stringify(state), (err) => {
        if (err) console.warn("CloudStorage save failed", err);
      });
    } catch (err) { console.warn("CloudStorage unavailable", err); }
  }

  function save() {
    persistLocal();
    persistCloud();
  }

  function normalizeUpgrades(raw) {
    const u = { ...defaultUpgrades(), ...(raw || {}) };
    for (const key of ["house", "fence", "transport", "sarai"]) {
      u[key] = Math.max(0, Math.min(Number(u[key]) || 0, (UPGRADES[key].levels.length - 1)));
    }
    for (const key of ["well", "bathhouse", "apple", "bench", "antenna", "birdhouse"]) {
      u[key] = Boolean(u[key]);
    }
    return u;
  }

  function migrateFromV2(data, base) {
    const seeds = { ...emptySeeds(), ...(data.seeds || {}) };
    for (const id of CROP_ORDER) if (typeof seeds[id] !== "number") seeds[id] = 0;
    return {
      ...base,
      ...data,
      version: 4,
      seeds,
      warehouse: { ...emptyWarehouse(), ...(data.warehouse || {}) },
      plots: base.plots.map((p, i) => ({ ...p, ...(data.plots && data.plots[i] || {}) })),
      greenhouse: base.greenhouse.map((p, i) => ({ ...p, ...((data.greenhouse || [])[i] || {}) })),
      animals: Array.isArray(data.animals) ? data.animals : [],
      pens: data.pens || START_PENS,
      nextAnimalId: data.nextAnimalId || 1,
      upgrades: normalizeUpgrades(data.upgrades),
      migratedFrom: data.version,
    };
  }

  function scaleGrowth(plot, fromFast) {
    if (!plot || !plot.cropId) return plot;
    const crop = CROPS[plot.cropId];
    if (!crop) return plot;
    const oldG = fromFast ? (crop.growMsFast || crop.growMs) : crop.growMs;
    const newG = crop.growMs;
    if (!oldG) return plot;
    if (plot.grownMs >= oldG) plot.grownMs = newG;
    else plot.grownMs = plot.grownMs * (newG / oldG);
    return plot;
  }

  function scaleAnimal(animal, fromFast) {
    if (!animal) return animal;
    const def = ANIMALS[animal.kind];
    if (!def) return animal;
    const oldG = fromFast ? (def.growMsFast || def.growMs) : def.growMs;
    const newG = def.growMs;
    if (oldG && animal.grownMs) {
      if (animal.grownMs >= oldG) animal.grownMs = newG;
      else animal.grownMs = animal.grownMs * (newG / oldG);
    }
    const oldP = fromFast ? (def.productTimeFast || def.productTime) : def.productTime;
    const newP = def.productTime;
    if (oldP && animal.productMs) {
      if (animal.productMs >= oldP) animal.productMs = newP;
      else animal.productMs = animal.productMs * (newP / oldP);
    }
    return animal;
  }

  function rebaseCalendar(next, raw, oldDayMs) {
    const ts = now();
    const started = typeof raw.worldStartedAt === "number" ? raw.worldStartedAt : ts;
    const last = typeof raw.lastSimAt === "number" ? raw.lastSimAt : ts;
    const elapsedOld = Math.max(0, last - started);
    const oldDay = oldDayMs || D.TIMING.LEGACY_DAY_MS;
    next.worldStartedAt = ts - (elapsedOld / oldDay) * DAY_MS;
    next.lastSimAt = ts;
  }

  function migrateToV4(data, base) {
    const next = migrateFromV2(data, base);
    next.version = 4;
    next.warehouse = { ...emptyWarehouse(), ...(next.warehouse || {}) };
    if (typeof next.warehouse.fertilizer !== "number") next.warehouse.fertilizer = 0;
    next.claimedLevel = typeof data.claimedLevel === "number"
      ? data.claimedLevel
      : levelFromXp(typeof data.xp === "number" ? data.xp : 0);
    next.plots = (next.plots || []).map((p) => ({ fertilized: false, ...p }));
    next.greenhouse = (next.greenhouse || []).map((p) => ({ fertilized: false, ...p }));
    const alreadyV4 = data.version === 4 && data.timingVersion === 4;
    const currentMode = D.TIMING.fast ? "fast" : "play";
    if (!alreadyV4) {
      rebaseCalendar(next, data, D.TIMING.LEGACY_DAY_MS);
      const fromFast = true;
      next.plots.forEach((p) => scaleGrowth(p, fromFast));
      next.greenhouse.forEach((p) => scaleGrowth(p, fromFast));
      next.animals = (next.animals || []).map((a) => scaleAnimal({ ...a }, fromFast));
    } else if (data.timingMode && data.timingMode !== currentMode) {
      const fromFast = data.timingMode === "fast";
      next.plots.forEach((p) => scaleGrowth(p, fromFast));
      next.greenhouse.forEach((p) => scaleGrowth(p, fromFast));
      next.animals = (next.animals || []).map((a) => scaleAnimal({ ...a }, fromFast));
      rebaseCalendar(next, data, fromFast ? D.TIMING.FAST_DAY_MS : Math.floor(D.TIMING.SEASON_REAL_DAYS * 86400000 / D.TIMING.DAYS_PER_SEASON));
    }
    next.timingVersion = 4;
    next.timingMode = currentMode;
    next.redeemedGifts = Array.isArray(data.redeemedGifts)
      ? data.redeemedGifts.filter((id) => typeof id === "string")
      : [];
    return next;
  }

  function migrate(raw) {
    if (!raw) return null;
    let data;
    try { data = typeof raw === "string" ? JSON.parse(raw) : raw; } catch { return null; }
    if (!data || typeof data !== "object") return null;
    const base = defaultState();
    if ((data.version === 4 || data.version === 3 || data.version === 2) && Array.isArray(data.plots)) {
      return migrateToV4(data, base);
    }
    if (data.version === 1) {
      const next = defaultState();
      next.coins = typeof data.coins === "number" ? data.coins : next.coins;
      next.xp = typeof data.xp === "number" ? data.xp : 0;
      next.claimedLevel = levelFromXp(next.xp);
      next.plots = next.plots.map((p, i) => ({
        ...p,
        unlocked: Boolean(data.plots && data.plots[i] && data.plots[i].unlocked) || p.unlocked,
      }));
      next.migratedFrom = 1;
      return next;
    }
    return null;
  }

  function loadLocal() {
    try {
      const fresh = migrate(localStorage.getItem(SAVE_KEY));
      if (fresh) { state = fresh; return true; }
      for (const key of SAVE_KEYS_OLD) {
        const old = migrate(localStorage.getItem(key));
        if (old) { state = old; return true; }
      }
    } catch { /* ignore */ }
    return false;
  }

  function loadCloudThen(cb) {
    if (!tg || !tg.CloudStorage || typeof tg.CloudStorage.getItem !== "function") { cb(); return; }
    try {
      const tryKeys = [SAVE_KEY, ...SAVE_KEYS_OLD];
      const readNext = (i) => {
        if (i >= tryKeys.length) { cb(); return; }
        tg.CloudStorage.getItem(tryKeys[i], (err, value) => {
          if (!err && value) {
            const cloud = migrate(value);
            if (cloud && (cloud.savedAt || 0) >= (state.savedAt || 0)) {
              state = cloud;
              cb();
              return;
            }
          }
          readNext(i + 1);
        });
      };
      readNext(0);
    } catch { cb(); }
  }

  /* ——— Crop progress ——— */
  function cropProgress(plot, ts = now()) {
    if (!plot.cropId) return null;
    const crop = CROPS[plot.cropId];
    if (!crop) return null;
    const ratio = Math.min(1, plot.grownMs / crop.growMs);
    const ready = !plot.withered && plot.grownMs >= crop.growMs;
    let stage = 1;
    if (plot.withered) stage = 0;
    else if (ratio >= 1) stage = 4;
    else if (ratio >= 0.66) stage = 3;
    else if (ratio >= 0.33) stage = 2;
    const weather = weatherAt(ts);
    const rate = growthRate(plot, weather, ts);
    const remainMs = ready || plot.withered ? 0 : (rate > 0 ? (crop.growMs - plot.grownMs) / rate : Infinity);
    return { crop, ratio, ready, stage, remainMs, rate, weather };
  }

  /* ——— Art ——— */
  function art(path) {
    return `assets/${path}.webp?v=${ASSET_VER}`;
  }

  function cropIcon(cropId) {
    return `<img class="icon-art" src="${art("crops/" + cropId)}" alt="">`;
  }

  function productIcon(id) {
    return `<img class="icon-art" src="${art("products/" + id)}" alt="">`;
  }

  function plantMarkup(cropId, stage, asIcon) {
    const st = `plant ${cropId || ""} stage-${stage}`;
    if (asIcon || stage >= 4) {
      return `<div class="${st} icon-only">${cropIcon(cropId)}</div>`;
    }
    if (stage <= 0) {
      return `<div class="${st} withered"><img class="plot-stage" src="${art("stages/withered")}" alt=""></div>`;
    }
    if (stage === 1) {
      return `<div class="${st}"><img class="plot-stage" src="${art("stages/sprout")}" alt=""></div>`;
    }
    return `<div class="${st}"><img class="plot-stage" src="${art("stages/growing")}" alt=""></div>`;
  }

  function animalMarkup(animal) {
    const def = ANIMALS[animal.kind];
    const age = animal.adult ? "adult" : "baby";
    const file = animal.adult ? animal.kind : `${animal.kind}-baby`;
    return `<div class="critter ${animal.kind} ${age}" title="${animal.adult ? def.adultName : def.babyName}">
      <img src="${art("animals/" + file)}" alt="">
    </div>`;
  }

  function upgradeThumbSrc(id, level) {
    if (id === "house") return art("buildings/house-" + level);
    if (id === "fence") return art("fence/fence-" + level);
    if (id === "transport") return art("transport/" + ["bike", "moped", "sedan"][level]);
    if (id === "sarai") return art("buildings/sarai-" + level);
    if (id === "well") return art("buildings/well");
    if (id === "bathhouse") return art("buildings/bathhouse");
    if (id === "apple") return art("decor/apple-summer");
    if (id === "bench") return art("decor/bench");
    if (id === "antenna") return art("decor/antenna");
    if (id === "birdhouse") return art("decor/birdhouse");
    return "";
  }

  function preloadAssets() {
    const urls = new Set();
    if (window.SOTOK_HOME && window.SOTOK_HOME.preloadList) {
      window.SOTOK_HOME.preloadList().forEach((u) => urls.add(u));
    }
    CROP_ORDER.forEach((id) => urls.add(art("crops/" + id)));
    ANIMAL_ORDER.forEach((id) => {
      urls.add(art("animals/" + id));
      urls.add(art("animals/" + id + "-baby"));
    });
    Object.keys(PRODUCTS).forEach((id) => urls.add(art("products/" + id)));
    urls.forEach((src) => { const im = new Image(); im.src = src; });
  }

  /* ——— Render ——— */
  function renderAtmosphere() {
    const ts = now();
    const cal = calendarAt(ts);
    const today = pickWeather(cal.dayIndex, cal.seasonId);
    const tomorrowCalDay = cal.dayIndex + 1;
    const tomorrowSeason = SEASONS[Math.floor(tomorrowCalDay / DAYS_PER_SEASON) % 4];
    const tomorrow = pickWeather(tomorrowCalDay, tomorrowSeason);
    const app = document.getElementById("app");
    if (app) {
      app.dataset.season = cal.seasonId;
      app.dataset.weather = today.id;
    }
    const dayEl = $("#cal-day");
    const monthEl = $("#cal-month");
    const seasonEl = $("#cal-season");
    const etaEl = $("#cal-eta");
    if (dayEl) dayEl.textContent = String(cal.dayInSeason);
    if (monthEl) monthEl.textContent = `день из ${DAYS_PER_SEASON}`;
    if (seasonEl) seasonEl.textContent = SEASON_NAME[cal.seasonId];
    if (etaEl) etaEl.textContent = `${SEASON_TO[cal.seasonId]} ${formatTime(cal.msToNextSeason)}`;
    const todayEl = $("#weather-today");
    const tomEl = $("#weather-tomorrow");
    const temp = (t) => `${t.temp > 0 ? "+" : ""}${t.temp}°`;
    if (todayEl) todayEl.textContent = `Сегодня: ${today.name.toLowerCase()}, ${temp(today)}. ${today.line}.`;
    if (tomEl) tomEl.textContent = `Завтра: ${tomorrow.name.toLowerCase()}, ${temp(tomorrow)}. ${tomorrow.line}.`;
    renderSeasonWarn(cal, ts);
    renderWeatherLayer(today.id);
  }

  function capitalize(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }

  function renderSeasonWarn(cal, ts) {
    const box = $("#season-warn");
    if (!box) return;
    const lastDays = cal.dayInSeason >= DAYS_PER_SEASON - 1 || cal.msToNextSeason <= DAY_MS;
    const nextSeason = SEASONS[(cal.seasonIndex + 1) % 4];
    const names = [];
    for (const plot of allPlots()) {
      if (willWitherInSeason(plot, nextSeason) && !names.includes(CROPS[plot.cropId].name)) {
        names.push(CROPS[plot.cropId].name);
      }
    }
    if (lastDays && names.length) {
      box.textContent = `Скоро ${SEASON_PREP[nextSeason]} конец: соберите ${names.join(", ")} — иначе завянут.`;
      box.classList.remove("hidden");
      if (warnedSeasonIndex !== cal.seasonIndex) {
        warnedSeasonIndex = cal.seasonIndex;
        toast(`Скоро смена сезона. Соберите: ${names.join(", ")}`);
      }
    } else {
      box.classList.add("hidden");
    }
    void ts;
  }

  function fillWeatherLayer(layer, id) {
    if (!layer) return;
    const need = id === "rain" || id === "storm" ? "drops" : id === "snow" ? "flakes" : "";
    if (layer.dataset.kind === need) return;
    layer.dataset.kind = need;
    layer.innerHTML = "";
    if (need === "drops") {
      for (let i = 0; i < 18; i += 1) {
        const d = document.createElement("span");
        d.className = "drop";
        d.style.left = `${(i * 17 + 5) % 100}%`;
        d.style.animationDelay = `${(i * 0.13) % 1.4}s`;
        d.style.animationDuration = `${0.7 + (i % 5) * 0.12}s`;
        layer.appendChild(d);
      }
    } else if (need === "flakes") {
      for (let i = 0; i < 16; i += 1) {
        const d = document.createElement("span");
        d.className = "flake";
        d.style.left = `${(i * 19 + 3) % 100}%`;
        d.style.animationDelay = `${(i * 0.3) % 3}s`;
        d.style.animationDuration = `${2.4 + (i % 4) * 0.4}s`;
        layer.appendChild(d);
      }
    }
  }

  function renderWeatherLayer(id) {
    fillWeatherLayer($("#weather-layer"), id);
    fillWeatherLayer($("#home-weather-layer"), id);
  }

  function renderStatus() {
    const { level, into, need, maxed } = xpBounds(state.xp);
    const coins = $("#stat-coins .value");
    if (coins) coins.textContent = String(state.coins);
    const lvl = $("#stat-level");
    if (lvl) lvl.textContent = String(level);
    const badge = $("#badge-level");
    if (badge) badge.textContent = String(level);
    const nextAt = maxed ? state.xp : (XP_TABLE[level] || state.xp);
    const xpEl = $("#stat-xp");
    if (xpEl) xpEl.textContent = maxed ? "макс." : `${state.xp} / ${nextAt}`;
    const pct = maxed ? 100 : Math.max(0, Math.min(100, (into / need) * 100));
    const fill = $("#xp-fill");
    if (fill) fill.style.width = `${pct}%`;
  }

  function plotButton(plot, testId) {
    const ts = now();
    if (!plot.unlocked) {
      const price = plot.kind === "greenhouse"
        ? GREENHOUSE_PRICE[Number(String(plot.id).split("-")[1]) || 0]
        : PLOT_PRICE[plot.id];
      const label = plot.kind === "greenhouse" ? "Купить теплицу" : "Купить грядку";
      return `<button type="button" class="plot locked ${plot.kind}" data-plot="${plot.id}" data-testid="${testId}">
        <span class="padlock" aria-hidden="true"></span>
        <span class="price"><span class="coin-icon" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:2px"></span>${price}</span>
        <span class="lock-label">${label}</span>
      </button>`;
    }
    if (plot.withered && plot.cropId) {
      return `<button type="button" class="plot withered ${plot.kind}" data-plot="${plot.id}" data-testid="${testId}" aria-label="Завяло">
        ${plantMarkup(plot.cropId, 0)}
        <span class="timer">Завяло</span>
      </button>`;
    }
    const prog = cropProgress(plot, ts);
    if (!prog) {
      return `<button type="button" class="plot empty ${plot.kind}" data-plot="${plot.id}" data-testid="${testId}" aria-label="Пустая грядка">
        <img class="plot-stage" src="${art("stages/soil")}" alt="">
      </button>`;
    }
    const cls = prog.ready ? "plot ready" : "plot growing";
    let timer = "Готово!";
    if (!prog.ready) {
      timer = prog.remainMs === Infinity ? "Стоп" : formatTime(prog.remainMs);
    }
    return `<button type="button" class="${cls} ${plot.kind}" data-plot="${plot.id}" data-testid="${testId}">
      ${plantMarkup(prog.crop.id, prog.stage)}
      <span class="timer">${timer}</span>
      <span class="progress-pip"><i style="width:${Math.round(prog.ratio * 100)}%"></i></span>
    </button>`;
  }

  function renderField() {
    const field = $("#field");
    if (field) {
      field.innerHTML = state.plots.map((p, i) => plotButton(p, `plot-${i}`)).join("");
    }
    const gh = $("#greenhouse");
    if (gh) {
      gh.innerHTML = state.greenhouse.map((p, i) => plotButton(p, `gh-${i}`)).join("");
    }
    const hint = $("#farm-hint");
    if (hint) {
      const cal = calendarAt();
      const w = weatherAt();
      if (cal.seasonId === "winter") {
        hint.textContent = w.haltOutdoor
          ? "На улице рост стоит. Сажайте в теплице."
          : "Нажмите на грядку, чтобы посадить семена";
      } else if (w.needsWater) {
        hint.textContent = "Жара: полейте грядки, иначе рост замедлится";
      } else if (w.id === "rain") {
        hint.textContent = "Дождь ускоряет рост. Нажмите на грядку, чтобы посадить";
      } else {
        hint.textContent = "Нажмите на грядку, чтобы посадить семена";
      }
    }
  }

  function renderShop() {
    const level = levelFromXp(state.xp);
    const cal = calendarAt();
    const list = $("#shop-list");
    if (list) {
      const items = CROP_ORDER.map((id) => CROPS[id]);
      items.sort((a, b) => {
        const ao = cropAllowedNow(a, { kind: "soil" }, cal.seasonId) || (cal.seasonId === "winter" && a.greenhouse) ? 0 : 1;
        const bo = cropAllowedNow(b, { kind: "soil" }, cal.seasonId) || (cal.seasonId === "winter" && b.greenhouse) ? 0 : 1;
        if (ao !== bo) return ao - bo;
        return CROP_ORDER.indexOf(a.id) - CROP_ORDER.indexOf(b.id);
      });
      list.innerHTML = items.map((crop) => {
        const inSeason = cropAllowedNow(crop, { kind: "soil" }, cal.seasonId)
          || (cal.seasonId === "winter" && crop.greenhouse);
        const lockedLvl = level < crop.unlockLevel;
        const locked = !inSeason || lockedLvl;
        const canBuy = !locked && state.coins >= crop.seedCost;
        const count = state.seeds[crop.id] || 0;
        const kindLabel = crop.type === "flower" ? "цветы" : "овощи";
        const seasonTag = inSeason
          ? (crop.greenhouse && cal.seasonId === "winter" ? "теплица" : "в сезоне")
          : seasonLabelList(crop.seasons);
        const reason = !inSeason
          ? `Сезон: ${seasonLabelList(crop.seasons)}`
          : lockedLvl
            ? `Нужен ${crop.unlockLevel} разряд`
            : crop.flavor;
        return `<article class="card ${inSeason ? "" : "locked-crop"} ${crop.type}" data-testid="shop-${crop.id}">
          <div class="thumb">${cropIcon(crop.id)}</div>
          <div>
            <h3>${crop.name}</h3>
            <p class="meta">${formatTime(crop.growMs)} · +${crop.xp} опыта · продажа ${crop.sellPrice} · ${kindLabel}
              · ${seasonTag}</p>
            <p class="stock">Семена: ${count}. ${reason}</p>
          </div>
          <button type="button" class="btn primary" data-buy="${crop.id}" data-testid="buy-${crop.id}" ${canBuy ? "" : "disabled"}>
            ${!inSeason ? seasonLabelList(crop.seasons) : lockedLvl ? crop.unlockLevel + " разр." : crop.seedCost + " р."}
          </button>
        </article>`;
      }).join("");
    }
    const feedBox = $("#shop-feed");
    if (feedBox) {
      const can = state.coins >= FEED_BUY_PRICE;
      feedBox.innerHTML = `<article class="card" data-testid="shop-feed-card">
        <div class="thumb">${productIcon("feed")}</div>
        <div>
          <h3>Комбикорм</h3>
          <p class="meta">Для птицы и скота. Зимой животные просят чаще.</p>
          <p class="stock">В запасе: ${state.warehouse.feed || 0}</p>
        </div>
        <button type="button" class="btn primary" data-buy-feed="1" data-testid="buy-feed" ${can ? "" : "disabled"}>${FEED_BUY_PRICE} р.</button>
      </article>`;
    }
  }

  function renderBarn() {
    const list = $("#barn-list");
    const sellAll = $("#btn-sell-all");
    if (!list) return;
    const capHint = document.querySelector("#view-barn .hint");
    if (capHint) capHint.textContent = `Занято ${warehouseUsed()} из ${storageCap()}. Семена из мешочка сажаются бесплатно.`;
    const blocks = [];
    const seedItems = CROP_ORDER.filter((id) => (state.seeds[id] || 0) > 0);
    if (seedItems.length) {
      const rows = seedItems.map((id) => {
        const crop = CROPS[id];
        const n = state.seeds[id];
        return `<div class="seed-stock" data-testid="barn-seed-${id}">
          <div class="thumb">${cropIcon(id)}</div>
          <div><b>${crop.name}</b><span>${n} пак. · посадка бесплатно</span></div>
        </div>`;
      }).join("");
      blocks.push(`<article class="card pouch-card" data-testid="barn-seeds">
        <div class="thumb">${cropIcon(seedItems[0])}</div>
        <div>
          <h3>Мешочек семян</h3>
          <p class="meta">Хранится в сарае. На грядке семена сажаются без платы.</p>
          <div class="seed-stock-list">${rows}</div>
        </div>
      </article>`);
    }
    const fertN = state.warehouse.fertilizer || 0;
    blocks.push(`<article class="card" data-testid="barn-fertilizer">
      <div class="thumb">${productIcon("fertilizer")}</div>
      <div>
        <h3>Удобрение</h3>
        <p class="meta">В запасе: ${fertN}. Внесите на растущую грядку — ускорит оставшийся рост вдвое.</p>
      </div>
    </article>`);
    const cropItems = CROP_ORDER.filter((id) => (state.warehouse[id] || 0) > 0);
    for (const id of cropItems) {
      const crop = CROPS[id];
      const count = state.warehouse[id];
      const total = count * crop.sellPrice;
      blocks.push(`<article class="card" data-testid="barn-${id}">
        <div class="thumb">${cropIcon(id)}</div>
        <div>
          <h3>${crop.name}</h3>
          <p class="meta">${count} шт. · ${crop.sellPrice} за штуку · ${crop.type === "flower" ? "цветы" : "урожай"}</p>
          <p class="stock">Итого: ${rub(total)}</p>
        </div>
        <button type="button" class="btn good" data-sell="${id}" data-testid="sell-${id}">Сдать</button>
      </article>`);
    }
    for (const pid of ["egg", "down", "milk", "wool"]) {
      const count = state.warehouse[pid] || 0;
      if (!count) continue;
      const prod = PRODUCTS[pid];
      const total = count * prod.sellPrice;
      blocks.push(`<article class="card" data-testid="barn-${pid}">
        <div class="thumb">${productIcon(pid)}</div>
        <div>
          <h3>${prod.name}</h3>
          <p class="meta">${count} шт. · ${prod.sellPrice} за штуку</p>
          <p class="stock">Итого: ${rub(total)}</p>
        </div>
        <button type="button" class="btn good" data-sell="${pid}" data-testid="sell-${pid}">Сдать</button>
      </article>`);
    }
    const craftRows = FEED_RECIPES.map((r) => {
      const have = state.warehouse[r.cropId] || 0;
      const crop = CROPS[r.cropId];
      const can = have >= r.count;
      return `<button type="button" class="btn ${can ? "" : ""}" data-craft="${r.cropId}" data-testid="craft-${r.cropId}" ${can ? "" : "disabled"}>
        ${crop.name} ${r.count} шт. → 1 корм (есть ${have})
      </button>`;
    }).join("");
    blocks.push(`<article class="card craft-card" data-testid="barn-feed">
      <div class="thumb">${productIcon("feed")}</div>
      <div>
        <h3>Комбикорм</h3>
        <p class="meta">В запасе: ${state.warehouse.feed || 0}. Можно сделать из урожая.</p>
        <div class="craft-list">${craftRows}</div>
      </div>
    </article>`);
    if (!cropItems.length && !["egg", "down", "milk", "wool"].some((id) => state.warehouse[id]) && !seedItems.length && !fertN) {
      list.innerHTML = `<div class="empty-barn" data-testid="barn-empty">Сарай пока пуст. Соберите урожай или продукцию двора.</div>` + blocks.join("");
    } else {
      list.innerHTML = blocks.join("");
    }
    const sellable = cropItems.length || ["egg", "down", "milk", "wool"].some((id) => state.warehouse[id]);
    sellAll.classList.toggle("hidden", !sellable);
  }

  function renderYard() {
    const cal = calendarAt();
    const info = $("#pens-info");
    if (info) {
      const used = state.animals.length;
      const next = state.pens < MAX_PENS ? PEN_PRICE[state.pens] : null;
      info.innerHTML = `<span>Загоны: ${used} / ${state.pens}</span>` +
        (next != null
          ? ` <button type="button" class="btn primary btn-inline" data-buy-pen="1" data-testid="buy-pen" ${state.coins >= next ? "" : "disabled"}>Ещё загон · ${next} р.</button>`
          : "");
    }
    const grid = $("#pens-grid");
    if (grid) {
      const cells = [];
      for (let i = 0; i < state.pens; i += 1) {
        const animal = state.animals[i];
        if (!animal) {
          cells.push(`<div class="pen empty-pen" data-testid="pen-${i}"><span>Пустой загон</span></div>`);
          continue;
        }
        const def = ANIMALS[animal.kind];
        const hungry = isHungryAt(animal, now(), cal.seasonId);
        const name = animal.adult ? def.adultName : def.babyName;
        let status;
        if (hungry) status = "Голодает, продукции нет";
        else if (!animal.adult) {
          const left = Math.max(0, def.growMs - animal.grownMs);
          status = `Растёт · ${formatTime(left)}`;
        } else if (def.product) {
          const ready = animal.productMs >= def.productTime;
          status = ready ? `${PRODUCTS[def.product].name}: можно собирать` : `Продукция ${formatTime(def.productTime - animal.productMs)}`;
        } else {
          status = "На откорме. Можно продать";
        }
        const canCollect = animal.adult && def.product && animal.productMs >= def.productTime && !hungry;
        const sell = animal.adult ? def.sellAdult : def.sellBaby;
        cells.push(`<div class="pen ${hungry ? "hungry" : ""}" data-testid="pen-${i}">
          <div class="paddock">
            <img class="paddock-frame" src="${art("decor/pen")}" alt="">
            <div class="paddock-inner">${animalMarkup(animal)}</div>
          </div>
          <div class="pen-info">
            <b>${name}</b>
            <span>${status}</span>
          </div>
          <div class="pen-actions">
            <button type="button" class="btn" data-feed="${animal.id}" data-testid="feed-${animal.id}" ${(state.warehouse.feed || 0) > 0 ? "" : "disabled"}>Кормить</button>
            ${def.product ? `<button type="button" class="btn good" data-collect="${animal.id}" data-testid="collect-${animal.id}" ${canCollect ? "" : "disabled"}>Собрать</button>` : ""}
            <button type="button" class="btn" data-sell-animal="${animal.id}" data-testid="sell-animal-${animal.id}">Продать ${sell} р.</button>
          </div>
        </div>`);
      }
      grid.innerHTML = cells.join("") || `<div class="empty-barn">Купите загон на ярмарке ниже</div>`;
    }
    const shop = $("#animal-shop");
    if (shop) {
      const level = levelFromXp(state.xp);
      shop.innerHTML = ANIMAL_ORDER.map((id) => {
        const def = ANIMALS[id];
        const locked = level < def.unlockLevel;
        const noPen = state.animals.length >= state.pens;
        const can = !locked && !noPen && state.coins >= def.buyPrice;
        const prod = def.product ? PRODUCTS[def.product].name : "на откорм";
        return `<article class="card ${locked ? "locked-crop" : ""}" data-testid="buy-animal-card-${id}">
          <div class="thumb">${animalMarkup({ kind: id, adult: true })}</div>
          <div>
            <h3>${def.babyName} → ${def.adultName}</h3>
            <p class="meta">Продукция: ${prod}. Кормить нужно регулярно${/* */""}.</p>
          </div>
          <button type="button" class="btn primary" data-buy-animal="${id}" data-testid="buy-animal-${id}" ${can ? "" : "disabled"}>
            ${locked ? def.unlockLevel + " разр." : noPen ? "нет места" : def.buyPrice + " р."}
          </button>
        </article>`;
      }).join("");
    }
  }


  function homeNotes(cal, ts) {
    const notes = [];
    if (allPlots().some((p) => {
      const pr = cropProgress(p, ts);
      return pr && pr.ready;
    })) notes.push({ id: "ready", text: "Урожай созрел" });
    if (state.animals.some((a) => isHungryAt(a, ts, cal.seasonId))) {
      notes.push({ id: "hungry", text: "Животные голодны" });
    }
    const lastDays = cal.dayInSeason >= DAYS_PER_SEASON - 1 || cal.msToNextSeason <= DAY_MS;
    const nextSeason = SEASONS[(cal.seasonIndex + 1) % 4];
    if (lastDays && allPlots().some((p) => willWitherInSeason(p, nextSeason))) {
      notes.push({ id: "season", text: "Скоро смена сезона" });
    }
    if (warehouseUsed() >= storageCap()) notes.push({ id: "storage", text: "Сарай полон" });
    else if (warehouseUsed() >= storageCap() - 4) notes.push({ id: "storage", text: "Сарай почти полон" });
    return notes;
  }

  function talkToFarmer() {
    sync();
    const ts = now();
    const cal = calendarAt(ts);
    const weather = weatherAt(ts);
    const notes = homeNotes(cal, ts);
    let text;
    if (notes.find((n) => n.id === "ready")) text = FARMER_TIPS.ready;
    else if (notes.find((n) => n.id === "hungry")) text = FARMER_TIPS.hungry;
    else if (notes.find((n) => n.id === "season")) text = FARMER_TIPS.season;
    else if (notes.find((n) => n.id === "storage")) text = FARMER_TIPS.storage;
    else if (FARMER_TIPS[weather.id]) text = FARMER_TIPS[weather.id];
    else if (cal.seasonId === "winter") text = FARMER_TIPS.winter;
    else {
      const list = FARMER_TIPS.default;
      text = list[Math.floor(Math.random() * list.length)];
    }
    const el = $("#farmer-speech");
    if (!el) return;
    el.textContent = text;
    el.classList.remove("hidden");
    clearTimeout(talkToFarmer._t);
    talkToFarmer._t = setTimeout(() => el.classList.add("hidden"), 3200);
    haptic("light");
  }

  function renderHome() {
    const ts = now();
    const cal = calendarAt(ts);
    const weather = weatherAt(ts);
    const art = $("#home-art");
    if (art && window.SOTOK_HOME) {
      const plots = state.plots.map((p) => {
        const crop = p.cropId ? CROPS[p.cropId] : null;
        return {
          ...p,
          growReady: crop ? p.grownMs >= crop.growMs && !p.withered : false,
        };
      });
      art.innerHTML = window.SOTOK_HOME.render({
        season: cal.seasonId,
        weather: weather.id,
        upgrades: state.upgrades,
        plots,
        greenhouse: state.greenhouse,
        pens: state.pens,
        animals: state.animals,
      });
    }
    const { level, into, need, maxed } = xpBounds(state.xp);
    const coins = $("#home-coins-value");
    if (coins) coins.textContent = String(state.coins);
    const lvl = $("#home-level");
    if (lvl) lvl.textContent = String(level);
    const nextAt = maxed ? state.xp : (XP_TABLE[level] || state.xp);
    const xpEl = $("#home-xp");
    if (xpEl) xpEl.textContent = maxed ? "макс." : `${state.xp} / ${nextAt}`;
    const fill = $("#home-xp-fill");
    if (fill) fill.style.width = `${maxed ? 100 : Math.max(0, Math.min(100, (into / need) * 100))}%`;
    const day = $("#home-cal-day");
    if (day) day.textContent = `День ${cal.dayInSeason}`;
    const seasonEl = $("#home-cal-season");
    if (seasonEl) seasonEl.textContent = SEASON_NAME[cal.seasonId];
    const eta = $("#home-cal-eta");
    if (eta) eta.textContent = `${SEASON_TO[cal.seasonId]} ${formatTime(cal.msToNextSeason)}`;
    const temp = (w) => `${w.temp > 0 ? "+" : ""}${w.temp}°`;
    const tomorrowCalDay = cal.dayIndex + 1;
    const tomorrowSeason = SEASONS[Math.floor(tomorrowCalDay / DAYS_PER_SEASON) % 4];
    const tomorrow = pickWeather(tomorrowCalDay, tomorrowSeason);
    const tw = $("#home-weather-today");
    const tm = $("#home-weather-tomorrow");
    if (tw) tw.textContent = `Сегодня: ${weather.name.toLowerCase()}, ${temp(weather)}. ${weather.line}.`;
    if (tm) tm.textContent = `Завтра: ${tomorrow.name.toLowerCase()}, ${temp(tomorrow)}. ${tomorrow.line}.`;
    const notes = homeNotes(cal, ts);
    const box = $("#home-notes");
    if (box) {
      box.innerHTML = notes.length
        ? notes.map((n) => `<span class="note" data-note="${n.id}">${n.text}</span>`).join("")
        : "";
      box.classList.toggle("empty", !notes.length);
    }
  }

  function renderUpgrades() {
    const list = $("#upgrade-list");
    if (!list) return;
    const level = levelFromXp(state.xp);
    list.innerHTML = UPGRADE_ORDER.map((id) => {
      const def = UPGRADES[id];
      if (def.type === "toggle") {
        const owned = !!state.upgrades[id];
        const locked = !owned && level < def.unlockLevel;
        const can = !owned && !locked && state.coins >= def.price;
        const bonus = def.bonus && def.bonus.autoWater
          ? "Бонус: автополив в жару"
          : def.bonus && def.bonus.harvestXp
            ? "Бонус: +1 опыт за сбор"
            : (def.flavor || "");
        const thumb = upgradeThumbSrc(id, 0);
        return `<article class="card ${owned ? "owned-upgrade" : ""} ${locked ? "locked-crop" : ""}" data-testid="upgrade-${id}">
          <div class="thumb">${thumb ? `<img class="icon-art" src="${thumb}" alt="">` : ""}</div>
          <div>
            <h3>${def.name}</h3>
            <p class="meta">${bonus}</p>
            <p class="stock">${owned ? "Уже стоит на участке" : (locked ? "Нужен " + def.unlockLevel + " разряд" : "Ещё не куплено")}</p>
          </div>
          <button type="button" class="btn primary" data-buy-upgrade="${id}" data-testid="buy-upgrade-${id}" ${can ? "" : "disabled"}>
            ${owned ? "Есть" : locked ? def.unlockLevel + " разр." : def.price + " р."}
          </button>
        </article>`;
      }
      const cur = state.upgrades[id] || 0;
      const current = def.levels[cur];
      const next = def.levels[cur + 1];
      const locked = next && level < next.unlockLevel;
      const can = next && !locked && state.coins >= next.price;
      const bonus = current && current.bonus && current.bonus.storage
        ? `Вместимость сарая: ${current.bonus.storage}`
        : (next && next.flavor) || "";
      const nextBonus = next && next.bonus && next.bonus.storage ? ` → ${next.bonus.storage}` : "";
      const showLv = next ? cur + 1 : cur;
      const thumb = upgradeThumbSrc(id, showLv);
      return `<article class="card ${!next ? "owned-upgrade" : ""} ${locked ? "locked-crop" : ""}" data-testid="upgrade-${id}">
        <div class="thumb">${thumb ? `<img class="icon-art" src="${thumb}" alt="">` : ""}</div>
        <div>
          <h3>${def.name}</h3>
          <p class="meta">Сейчас: ${current.name}. ${bonus}${nextBonus}</p>
          <p class="stock">${next ? "Далее: " + next.name + (locked ? " · нужен " + next.unlockLevel + " разряд" : "") : "Максимум"}</p>
        </div>
        <button type="button" class="btn primary" data-buy-upgrade="${id}" data-testid="buy-upgrade-${id}" ${can ? "" : "disabled"}>
          ${!next ? "Макс." : locked ? next.unlockLevel + " разр." : next.price + " р."}
        </button>
      </article>`;
    }).join("");
  }

  function renderAll() {
    sync();
    renderStatus();
    renderAtmosphere();
    if (currentView === "home") renderHome();
    if (currentView === "upgrades") renderUpgrades();
    if (currentView === "farm") renderField();
    if (currentView === "shop") renderShop();
    if (currentView === "yard") renderYard();
    if (currentView === "barn") renderBarn();
  }

  function showView(name) {
    currentView = name;
    const app = document.getElementById("app");
    if (app) app.dataset.view = name;
    $$(".view").forEach((el) => el.classList.toggle("hidden", el.dataset.view !== name));
    $$(".dock-btn").forEach((el) => el.classList.toggle("active", el.dataset.nav === name));
    renderAll();
  }

  /* ——— Sheets / actions ——— */
  function openSheet(html) {
    $("#sheet-content").innerHTML = html;
    $("#sheet").classList.remove("hidden");
  }
  function closeSheet() {
    $("#sheet").classList.add("hidden");
    $("#sheet-content").innerHTML = "";
  }

  function findPlot(id) {
    if (typeof id === "string" && String(id).startsWith("gh-")) {
      return state.greenhouse[Number(String(id).split("-")[1])];
    }
    const n = Number(id);
    return state.plots[n];
  }

  function unlockPrice(plot) {
    if (!plot) return 0;
    if (plot.kind === "greenhouse") {
      const idx = Number(String(plot.id).split("-")[1]) || 0;
      return GREENHOUSE_PRICE[idx];
    }
    return PLOT_PRICE[plot.id];
  }

  function openPlotSheet(id) {
    sync();
    const plot = findPlot(id);
    if (!plot) return;
    const cal = calendarAt();
    if (!plot.unlocked) {
      const price = unlockPrice(plot);
      const can = state.coins >= price;
      const title = plot.kind === "greenhouse" ? "Теплица" : "Новая грядка";
      const text = plot.kind === "greenhouse"
        ? `Поставьте теплицу за ${rub(price)}. Зимой только здесь растут редис, укроп и огурцы.`
        : `Расчистите ещё одну грядку за ${rub(price)}.`;
      openSheet(`<h3>${title}</h3><p>${text}</p>
        <div class="sheet-actions">
          <button type="button" class="btn" data-close-sheet>Позже</button>
          <button type="button" class="btn primary" data-unlock="${plot.id}" data-testid="confirm-unlock" ${can ? "" : "disabled"}>Купить</button>
        </div>`);
      return;
    }
    if (plot.withered) {
      openSheet(`<h3>Посадка завяла</h3>
        <p>Сезон или непогода погубили урожай. Очистите грядку.</p>
        <div class="sheet-actions">
          <button type="button" class="btn" data-close-sheet>Закрыть</button>
          <button type="button" class="btn primary" data-clear="${plot.id}" data-testid="confirm-clear">Убрать</button>
        </div>`);
      return;
    }
    const prog = cropProgress(plot);
    const weather = weatherAt();
    if (prog && prog.ready) {
      openSheet(`<h3>Урожай готов</h3>
        <p>${prog.crop.name}: уберите в сарай и получите +${prog.crop.xp} опыта.</p>
        <div class="sheet-actions">
          <button type="button" class="btn" data-close-sheet>Подождать</button>
          <button type="button" class="btn good" data-harvest="${plot.id}" data-testid="confirm-harvest">Собрать</button>
        </div>`);
      return;
    }
    if (prog) {
      const heat = weather.needsWater && plot.kind !== "greenhouse";
      const watered = plot.wateredUntil > now();
      let extra = "";
      if (prog.remainMs === Infinity) extra = " На улице рост сейчас стоит — ждите тепла или сажайте в теплице.";
      else if (heat && !watered) extra = " Жара: полейте грядку, чтобы не терять время.";
      else if (weather.id === "rain") extra = " Дождь ускоряет рост.";
      const canFert = (state.warehouse.fertilizer || 0) > 0 && !plot.fertilized && prog.remainMs !== Infinity && prog.remainMs > 0;
      openSheet(`<h3>${prog.crop.name}</h3>
        <p>${prog.remainMs === Infinity ? "Рост остановился." : `Ещё растёт. Осталось ${formatTime(prog.remainMs)}.`}${extra}${plot.fertilized ? " Удобрение уже внесено." : ""}</p>
        <div class="sheet-actions">
          <button type="button" class="btn primary" data-close-sheet>Понятно</button>
          ${heat && !watered ? `<button type="button" class="btn good" data-water="${plot.id}" data-testid="confirm-water">Полить</button>` : ""}
          ${canFert ? `<button type="button" class="btn good" data-fertilize="${plot.id}" data-testid="confirm-fertilize">Удобрить (${state.warehouse.fertilizer})</button>` : ""}
        </div>`);
      return;
    }
    if (cal.seasonId === "winter" && plot.kind !== "greenhouse") {
      openSheet(`<h3>Зима на участке</h3>
        <p>На открытых грядках сейчас ничего не растёт. Купите теплицу или дождитесь весны.</p>
        <div class="sheet-actions"><button type="button" class="btn primary" data-close-sheet>Понятно</button></div>`);
      return;
    }
    const level = levelFromXp(state.xp);
    const options = CROP_ORDER.map((id) => CROPS[id]).filter((c) => level >= c.unlockLevel && cropAllowedNow(c, plot, cal.seasonId));
    const rows = options.map((crop) => {
      const have = state.seeds[crop.id] || 0;
      return `<button type="button" class="seed-row" data-plant="${plot.id}" data-crop="${crop.id}" data-testid="plant-${crop.id}" ${have ? "" : "disabled"}>
        <div class="thumb">${cropIcon(crop.id)}</div>
        <div style="flex:1"><b>${crop.name}</b><span>В мешочке: ${have} · посадка бесплатно · ${crop.type === "flower" ? "цветы" : "овощи"} · ${formatTime(crop.growMs)}</span></div>
      </button>`;
    }).join("");
    const any = options.some((c) => (state.seeds[c.id] || 0) > 0);
    openSheet(`<h3>${plot.kind === "greenhouse" ? "Что посадим в теплице?" : "Что посадим?"}</h3>
      <p>${any ? "Семена из сарая сажаются бесплатно. Только культуры текущего сезона (в теплице — ещё и зимние)." : "Нет подходящих семян — сходите в сельпо."}</p>
      <div class="seed-list">${rows || "<p>Для этого места сейчас нет доступных культур.</p>"}</div>
      <div class="sheet-actions">
        <button type="button" class="btn" data-close-sheet>Закрыть</button>
        ${any ? "" : '<button type="button" class="btn primary" data-goto="shop">В сельпо</button>'}
      </div>`);
  }

  function buySeed(id) {
    sync();
    const crop = CROPS[id];
    const cal = calendarAt();
    const level = levelFromXp(state.xp);
    if (!crop) return;
    const inSeason = cropAllowedNow(crop, { kind: "soil" }, cal.seasonId) || (cal.seasonId === "winter" && crop.greenhouse);
    if (!inSeason || level < crop.unlockLevel) return;
    if (state.coins < crop.seedCost) { toast("Не хватает рублей"); return; }
    state.coins -= crop.seedCost;
    state.seeds[id] = (state.seeds[id] || 0) + 1;
    save(); haptic("light"); toast(`Куплено: ${crop.name}`); renderAll();
  }

  function buyFeed() {
    sync();
    if (state.coins < FEED_BUY_PRICE) { toast("Не хватает рублей"); return; }
    state.coins -= FEED_BUY_PRICE;
    state.warehouse.feed = (state.warehouse.feed || 0) + 1;
    save(); haptic("light"); toast("Купили комбикорм"); renderAll();
  }

  function craftFeed(cropId) {
    sync();
    const rec = FEED_RECIPES.find((r) => r.cropId === cropId);
    if (!rec) return;
    if ((state.warehouse[cropId] || 0) < rec.count) { toast("Не хватает урожая"); return; }
    state.warehouse[cropId] -= rec.count;
    state.warehouse.feed = (state.warehouse.feed || 0) + 1;
    save(); haptic("light"); toast("Сделали комбикорм"); renderAll();
  }

  function plant(plotId, cropId) {
    sync();
    const plot = findPlot(plotId);
    const crop = CROPS[cropId];
    const cal = calendarAt();
    if (!plot || !plot.unlocked || plot.cropId || !crop) return;
    if (levelFromXp(state.xp) < crop.unlockLevel) return;
    if (!cropAllowedNow(crop, plot, cal.seasonId)) { toast("Сейчас не сезон"); return; }
    if ((state.seeds[cropId] || 0) < 1) { toast("Нет семян"); return; }
    state.seeds[cropId] -= 1;
    plot.cropId = cropId;
    plot.plantedAt = now();
    plot.grownMs = 0;
    plot.withered = false;
    plot.fertilized = false;
    save(); haptic("medium"); closeSheet(); toast(`Посадили: ${crop.name}`); renderAll();
  }

  function harvest(plotId) {
    sync();
    const plot = findPlot(plotId);
    if (!plot) return;
    const prog = cropProgress(plot);
    if (!prog || !prog.ready) return;
    if (!canStore(1)) { toast("Сарай полон. Сдайте урожай или улучшите его."); return; }
    state.warehouse[prog.crop.id] = (state.warehouse[prog.crop.id] || 0) + 1;
    const xpGain = prog.crop.xp + (state.upgrades.bathhouse ? 1 : 0);
    plot.cropId = null;
    plot.plantedAt = null;
    plot.grownMs = 0;
    plot.withered = false;
    plot.fertilized = false;
    addXp(xpGain);
    save(); haptic("success"); closeSheet();
    toast(`Собрано: ${prog.crop.name}  ·  +${xpGain} опыта`);
    renderAll();
  }

  function clearPlot(plotId) {
    const plot = findPlot(plotId);
    if (!plot) return;
    plot.cropId = null;
    plot.plantedAt = null;
    plot.grownMs = 0;
    plot.withered = false;
    plot.fertilized = false;
    save(); closeSheet(); toast("Грядка очищена"); renderAll();
  }

  function waterPlot(plotId) {
    sync();
    const plot = findPlot(plotId);
    if (!plot || !plot.cropId) return;
    const cal = calendarAt();
    const dayEnd = state.worldStartedAt + (cal.dayIndex + 1) * DAY_MS;
    plot.wateredUntil = dayEnd;
    save(); haptic("light"); closeSheet(); toast("Полили грядку"); renderAll();
  }

  function unlockPlot(id) {
    sync();
    const plot = findPlot(id);
    if (!plot || plot.unlocked) return;
    const price = unlockPrice(plot);
    if (state.coins < price) { toast("Не хватает рублей"); return; }
    state.coins -= price;
    plot.unlocked = true;
    save(); haptic("medium"); closeSheet();
    toast(plot.kind === "greenhouse" ? "Теплица готова!" : "Грядка открыта!");
    renderAll();
  }

  function sellItem(id) {
    sync();
    const crop = CROPS[id];
    const prod = PRODUCTS[id];
    if (id === "feed" || id === "fertilizer") return;
    const count = state.warehouse[id] || 0;
    if (count < 1) return;
    const price = crop ? crop.sellPrice : (prod ? prod.sellPrice : 0);
    const gain = count * price;
    state.warehouse[id] = 0;
    state.coins += gain;
    const name = crop ? crop.name : (prod ? prod.name : id);
    save(); haptic("success"); toast(`Сдано ${name}: +${rub(gain)}`); renderAll();
  }

  function sellAll() {
    sync();
    let gain = 0;
    for (const id of CROP_ORDER) {
      const n = state.warehouse[id] || 0;
      if (n) { gain += n * CROPS[id].sellPrice; state.warehouse[id] = 0; }
    }
    for (const id of ["egg", "down", "milk", "wool"]) {
      const n = state.warehouse[id] || 0;
      if (n) { gain += n * PRODUCTS[id].sellPrice; state.warehouse[id] = 0; }
    }
    if (!gain) return;
    state.coins += gain;
    save(); haptic("success"); toast(`Всё сдано: +${rub(gain)}`); renderAll();
  }

  function buyPen() {
    sync();
    if (state.pens >= MAX_PENS) return;
    const price = PEN_PRICE[state.pens];
    if (state.coins < price) { toast("Не хватает рублей"); return; }
    state.coins -= price;
    state.pens += 1;
    save(); haptic("medium"); toast("Новый загон готов"); renderAll();
  }

  function buyAnimal(kind) {
    sync();
    const def = ANIMALS[kind];
    const level = levelFromXp(state.xp);
    if (!def || level < def.unlockLevel) return;
    if (state.animals.length >= state.pens) { toast("Нет свободного загона"); return; }
    if (state.coins < def.buyPrice) { toast("Не хватает рублей"); return; }
    state.coins -= def.buyPrice;
    if (!state.nextAnimalId) state.nextAnimalId = 1;
    const animalId = state.nextAnimalId++;
    state.animals.push({
      id: animalId,
      kind,
      adult: false,
      grownMs: 0,
      productMs: 0,
      lastFedAt: now(),
    });
    save(); haptic("medium"); toast(`Купили: ${def.babyName}`); renderAll();
  }

  function feedAnimal(id) {
    sync();
    const animal = state.animals.find((a) => a.id === Number(id));
    if (!animal) return;
    if ((state.warehouse.feed || 0) < 1) { toast("Нет комбикорма"); return; }
    state.warehouse.feed -= 1;
    animal.lastFedAt = now();
    save(); haptic("light"); toast("Покормили"); renderAll();
  }

  function collectAnimal(id) {
    sync();
    const animal = state.animals.find((a) => a.id === Number(id));
    if (!animal || !animal.adult) return;
    const def = ANIMALS[animal.kind];
    const cal = calendarAt();
    if (!def.product || isHungryAt(animal, now(), cal.seasonId)) return;
    if (animal.productMs < def.productTime) return;
    const amount = 1 + (def.productBonus || 0);
    if (!canStore(amount)) { toast("Сарай полон. Сдайте продукцию или улучшите сарай."); return; }
    state.warehouse[def.product] = (state.warehouse[def.product] || 0) + amount;
    animal.productMs = 0;
    addXp(def.productXp);
    save(); haptic("success");
    toast(`Собрали: ${PRODUCTS[def.product].name}  ·  +${def.productXp} опыта`);
    renderAll();
  }

  function sellAnimal(id) {
    sync();
    const idx = state.animals.findIndex((a) => a.id === Number(id));
    if (idx < 0) return;
    const animal = state.animals[idx];
    const def = ANIMALS[animal.kind];
    const price = animal.adult ? def.sellAdult : def.sellBaby;
    state.coins += price;
    state.animals.splice(idx, 1);
    save(); haptic("success"); toast(`Продали ${animal.adult ? def.adultName : def.babyName}: +${rub(price)}`); renderAll();
  }

  function cropInSeason(crop, seasonId) {
    if (!crop) return false;
    if (crop.seasons && crop.seasons.includes(seasonId)) return true;
    if (seasonId === "winter" && crop.greenhouse) return true;
    return false;
  }

  function pickSeasonalSeedPacks(level, packs, seasonId) {
    const bag = {};
    if (!packs) return bag;
    const unlockedNow = CROP_ORDER.filter((id) => {
      const c = CROPS[id];
      return c.unlockLevel === level && cropInSeason(c, seasonId);
    });
    const seasonal = CROP_ORDER.filter((id) => {
      const c = CROPS[id];
      return c.unlockLevel <= level && cropInSeason(c, seasonId);
    });
    let left = packs;
    for (const id of unlockedNow) {
      if (left <= 0) break;
      bag[id] = (bag[id] || 0) + 1;
      left -= 1;
    }
    const pool = seasonal.length ? seasonal : CROP_ORDER.filter((id) => CROPS[id].unlockLevel <= level);
    let i = 0;
    while (left > 0 && pool.length) {
      const id = pool[i % pool.length];
      bag[id] = (bag[id] || 0) + 1;
      left -= 1;
      i += 1;
    }
    return bag;
  }

  function describeReward(granted) {
    const lines = [];
    if (granted.coins) lines.push(`${rub(granted.coins)}`);
    if (granted.seeds) {
      const parts = Object.entries(granted.seeds).map(([id, n]) => `${CROPS[id] ? CROPS[id].name : id} × ${n}`);
      if (parts.length) lines.push(`Семена: ${parts.join(", ")}`);
    }
    if (granted.feed) lines.push(`Комбикорм: ${granted.feed} меш.`);
    if (granted.fertilizer) lines.push(`Удобрение: ${granted.fertilizer}`);
    if (granted.freePlot) lines.push(granted.freePlotName || "Новая грядка");
    if (granted.freePen) lines.push("Новый загон");
    if (granted.decor) lines.push(DECOR_NAME[granted.decor] || granted.decor);
    if (granted.bonusCoins) lines.push(`Ещё ${rub(granted.bonusCoins)} взамен уже имеющегося подарка`);
    return lines;
  }

  function applyLevelReward(level, seasonId) {
    const def = LEVEL_REWARDS[level];
    if (!def) return null;
    const granted = { level };
    if (def.coins) {
      state.coins += def.coins;
      granted.coins = def.coins;
    }
    if (def.seedPacks) {
      const bag = pickSeasonalSeedPacks(level, def.seedPacks, seasonId);
      for (const [id, n] of Object.entries(bag)) state.seeds[id] = (state.seeds[id] || 0) + n;
      granted.seeds = bag;
    }
    if (def.feed) {
      state.warehouse.feed = (state.warehouse.feed || 0) + def.feed;
      granted.feed = def.feed;
    }
    if (def.fertilizer) {
      state.warehouse.fertilizer = (state.warehouse.fertilizer || 0) + def.fertilizer;
      granted.fertilizer = def.fertilizer;
    }
    if (def.freePlot) {
      const plot = state.plots.find((p) => !p.unlocked);
      if (plot) {
        plot.unlocked = true;
        granted.freePlot = true;
        granted.freePlotName = "Новая грядка";
      } else {
        const gh = state.greenhouse.find((p) => !p.unlocked);
        if (gh) {
          gh.unlocked = true;
          granted.freePlot = true;
          granted.freePlotName = "Теплица";
        } else {
          state.coins += 50;
          granted.bonusCoins = (granted.bonusCoins || 0) + 50;
        }
      }
    }
    if (def.freePen) {
      if (state.pens < MAX_PENS) {
        state.pens += 1;
        granted.freePen = true;
      } else {
        state.coins += 50;
        granted.bonusCoins = (granted.bonusCoins || 0) + 50;
      }
    }
    if (def.decor && UPGRADES[def.decor]) {
      if (!state.upgrades[def.decor]) {
        state.upgrades[def.decor] = true;
        granted.decor = def.decor;
      } else {
        state.coins += 50;
        granted.bonusCoins = (granted.bonusCoins || 0) + 50;
      }
    }
    granted.lines = describeReward(granted);
    return granted;
  }

  function rewardPreview(level, seasonId) {
    const def = LEVEL_REWARDS[level];
    if (!def) return null;
    const fake = {
      coins: def.coins,
      seeds: pickSeasonalSeedPacks(level, def.seedPacks || 0, seasonId),
      feed: def.feed,
      fertilizer: def.fertilizer,
      freePlot: def.freePlot,
      freePlotName: def.freePlot ? "Новая грядка" : null,
      freePen: def.freePen,
      decor: def.decor,
    };
    fake.lines = describeReward(fake);
    fake.level = level;
    return fake;
  }

  function closeGramota() {
    const el = $("#gramota");
    if (el) el.classList.add("hidden");
  }

  function showGramota(granted) {
    const box = $("#gramota-content");
    const root = $("#gramota");
    if (!box || !root) return;
    const lines = (granted.lines || []).map((l) => `<li>${l}</li>`).join("");
    box.innerHTML = `
      <p class="gramota-org">Садовое товарищество «Шесть соток»</p>
      <h2 class="gramota-title" id="gramota-title">Почётная грамота</h2>
      <p class="gramota-lead">Приказом правления вам присвоен <b>${granted.level}-й разряд</b> дачника.</p>
      <p class="gramota-sub">В ознаменование трудовых успехов выдаётся:</p>
      <ul class="gramota-list" data-testid="gramota-rewards">${lines || "<li>Открыты новые семена и товары в сельпо.</li>"}</ul>
      <div class="gramota-stamp" aria-hidden="true">Шесть<br>соток</div>
      <div class="sheet-actions">
        <button type="button" class="btn primary" data-close-gramota data-testid="gramota-close">С благодарностью принять</button>
      </div>`;
    root.classList.remove("hidden");
    haptic("success");
  }

  function closeXpPreview() {
    const el = $("#xp-preview");
    if (el) el.classList.add("hidden");
  }

  function showXpPreview() {
    const box = $("#xp-preview-content");
    const root = $("#xp-preview");
    if (!box || !root) return;
    const b = xpBounds(state.xp);
    const cal = calendarAt();
    const nextLv = b.level + 1;
    const preview = !b.maxed ? rewardPreview(nextLv, cal.seasonId) : null;
    const lines = preview && preview.lines
      ? preview.lines.map((l) => `<li>${l}</li>`).join("")
      : "";
    const progress = b.maxed ? "Высший разряд" : `${b.into} / ${b.need} опыта до ${nextLv}-го разряда`;
    box.innerHTML = `
      <h3>Разряд ${b.level}</h3>
      <p class="meta">${progress}</p>
      ${preview ? `<p class="gramota-sub">За ${nextLv}-й разряд:</p><ul class="gramota-list" data-testid="xp-next-rewards">${lines}</ul>` : "<p>Все разряды уже получены.</p>"}
      <div class="sheet-actions">
        <button type="button" class="btn primary" data-close-xp-preview data-testid="xp-preview-close">Понятно</button>
      </div>`;
    root.classList.remove("hidden");
  }

  function addXp(amount, { celebrate } = { celebrate: true }) {
    const n = Number(amount) || 0;
    if (!n) return [];
    if (typeof state.claimedLevel !== "number") state.claimedLevel = levelFromXp(state.xp);
    state.xp += n;
    const next = levelFromXp(state.xp);
    const start = Math.max(state.claimedLevel, 1);
    if (next <= start) return [];
    const granted = [];
    const seasonId = calendarAt().seasonId;
    for (let lv = start + 1; lv <= next; lv += 1) {
      const g = applyLevelReward(lv, seasonId);
      if (g) granted.push(g);
      state.claimedLevel = lv;
    }
    if (celebrate && granted.length) showGramota(granted[granted.length - 1]);
    return granted;
  }

  function applyFertilizer(plotId) {
    sync();
    const plot = findPlot(plotId);
    if (!plot || !plot.cropId || plot.withered) return;
    if (plot.fertilized) { toast("Удобрение уже внесено"); return; }
    if ((state.warehouse.fertilizer || 0) < 1) { toast("Нет удобрения"); return; }
    const crop = CROPS[plot.cropId];
    if (!crop || plot.grownMs >= crop.growMs) return;
    state.warehouse.fertilizer -= 1;
    plot.fertilized = true;
    const remain = crop.growMs - plot.grownMs;
    const boost = (D.FERTILIZER_BOOST != null ? D.FERTILIZER_BOOST : 0.5);
    plot.grownMs += remain * boost;
    save(); haptic("medium"); closeSheet();
    toast("Внесли удобрение");
    renderAll();
  }

  function onLevelUp(level) {
    const g = { level, lines: ["Открываются новые семена, цветы или животные в сельпо и на ярмарке."] };
    showGramota(g);
  }

  function onTap(e) {
    const t = e.target.closest("[data-nav], [data-plot], [data-buy], [data-sell], [data-plant], [data-harvest], [data-unlock], [data-goto], [data-close-sheet], [data-clear], [data-water], [data-buy-feed], [data-craft], [data-buy-pen], [data-buy-animal], [data-feed], [data-collect], [data-sell-animal], [data-buy-upgrade], [data-farmer], [data-xp-preview], [data-close-gramota], [data-close-xp-preview], [data-fertilize], #btn-sell-all");
    if (!t) return;
    if (t.hasAttribute("data-close-gramota")) { closeGramota(); return; }
    if (t.hasAttribute("data-close-xp-preview")) { closeXpPreview(); return; }
    if (t.hasAttribute("data-xp-preview")) { showXpPreview(); return; }
    if (t.dataset.nav) { showView(t.dataset.nav); return; }
    if (t.hasAttribute("data-close-sheet")) { closeSheet(); return; }
    if (t.dataset.goto) { closeSheet(); showView(t.dataset.goto); return; }
    if (t.dataset.plot !== undefined) { openPlotSheet(t.dataset.plot); return; }
    if (t.dataset.buy) { buySeed(t.dataset.buy); return; }
    if (t.dataset.sell) { sellItem(t.dataset.sell); return; }
    if (t.id === "btn-sell-all") { sellAll(); return; }
    if (t.dataset.plant !== undefined) { plant(t.dataset.plant, t.dataset.crop); return; }
    if (t.dataset.harvest !== undefined) { harvest(t.dataset.harvest); return; }
    if (t.dataset.unlock !== undefined) { unlockPlot(t.dataset.unlock); return; }
    if (t.dataset.clear !== undefined) { clearPlot(t.dataset.clear); return; }
    if (t.dataset.water !== undefined) { waterPlot(t.dataset.water); return; }
    if (t.dataset.buyFeed) { buyFeed(); return; }
    if (t.dataset.craft) { craftFeed(t.dataset.craft); return; }
    if (t.dataset.buyPen) { buyPen(); return; }
    if (t.dataset.buyAnimal) { buyAnimal(t.dataset.buyAnimal); return; }
    if (t.dataset.feed) { feedAnimal(t.dataset.feed); return; }
    if (t.dataset.collect) { collectAnimal(t.dataset.collect); return; }
    if (t.dataset.sellAnimal) { sellAnimal(t.dataset.sellAnimal); return; }
    if (t.dataset.buyUpgrade) { buyUpgrade(t.dataset.buyUpgrade); return; }
    if (t.dataset.fertilize !== undefined) { applyFertilizer(t.dataset.fertilize); return; }
    if (t.hasAttribute("data-farmer")) { talkToFarmer(); }
  }

  function tick() {
    sync();
    renderAtmosphere();
    if (currentView === "farm") renderField();
    if (currentView === "yard") renderYard();
    if (currentView === "home") renderHome();
    renderStatus();
  }

  /* ——— Test hooks ——— */
  function findSeedForWeather(dayIndex, seasonId, wantId) {
    const saved = state.worldSeed;
    for (let seed = 1; seed < 8000; seed += 1) {
      state.worldSeed = seed;
      if (pickWeather(dayIndex, seasonId).id === wantId) return seed;
    }
    state.worldSeed = saved;
    return saved;
  }

  window.__khutor = {
    getState: () => state,
    now,
    calendarAt,
    weatherAt,
    pickWeather,
    reset() {
      timeOffset = 0;
      warnedSeasonIndex = -1;
      state = defaultState();
      save();
      closeSheet();
      closeGramota();
      closeXpPreview();
      renderAll();
    },
    advanceMs(ms) {
      sync();
      timeOffset += Number(ms) || 0;
      sync();
      renderAll();
    },
    setTiming({ dayMs, daysPerSeason } = {}) {
      if (dayMs) DAY_MS = dayMs;
      if (daysPerSeason) DAYS_PER_SEASON = daysPerSeason;
      renderAll();
    },
    setCalendar({ season = "spring", dayInSeason = 1, weather, keepProgress = false } = {}) {
      sync();
      const sIndex = Math.max(0, SEASONS.indexOf(season));
      const dayIndex = sIndex * DAYS_PER_SEASON + Math.max(0, dayInSeason - 1);
      const t = now();
      if (!keepProgress) {
        const coins = state.coins;
        const xp = state.xp;
        const seeds = { ...state.seeds };
        const warehouse = { ...state.warehouse };
        const pens = state.pens;
        const animals = state.animals;
        const upgrades = { ...state.upgrades };
        const gh = state.greenhouse.map((p) => ({ ...p }));
        const plots = state.plots.map((p) => ({ ...p }));
        state.worldStartedAt = t - dayIndex * DAY_MS - 800;
        state.lastSimAt = state.worldStartedAt;
        state.lastStormDay = -1;
        state.coins = coins;
        state.xp = xp;
        state.seeds = seeds;
        state.warehouse = warehouse;
        state.pens = pens;
        state.animals = animals;
        state.upgrades = upgrades;
        state.greenhouse = gh;
        state.plots = plots;
      } else {
        const grown = allPlots().map((p) => ({ id: p.id, grownMs: p.grownMs, cropId: p.cropId, withered: p.withered }));
        void grown;
        state.worldStartedAt = t - dayIndex * DAY_MS - 800;
        state.lastSimAt = t - 800;
      }
      if (weather) state.worldSeed = findSeedForWeather(dayIndex, season, weather);
      sync();
      renderAll();
    },
    give({ coins, feed, fertilizer, xp, seeds, products, upgrades } = {}) {
      if (coins) state.coins += coins;
      if (feed) state.warehouse.feed = (state.warehouse.feed || 0) + feed;
      if (fertilizer) state.warehouse.fertilizer = (state.warehouse.fertilizer || 0) + fertilizer;
      if (xp) state.xp += xp;
      if (seeds) for (const [k, v] of Object.entries(seeds)) state.seeds[k] = (state.seeds[k] || 0) + v;
      if (products) for (const [k, v] of Object.entries(products)) state.warehouse[k] = (state.warehouse[k] || 0) + v;
      if (upgrades) state.upgrades = normalizeUpgrades({ ...state.upgrades, ...upgrades });
      save();
      renderAll();
    },
    grantXp(n) { const g = addXp(n, { celebrate: true }); save(); renderAll(); return g; },
    applyFertilizer,
    rewardPreview: (level, season) => rewardPreview(level, season || calendarAt().seasonId),
    levelRewards: LEVEL_REWARDS,
    redeemGift,
    isFast: () => !!D.TIMING.fast,
    timing: () => ({ DAY_MS, DAYS_PER_SEASON, fast: !!D.TIMING.fast }),
    suspendSave() { persistEnabled = false; },
    resumeSave() { persistEnabled = true; },
    buyUpgrade,
    storageCap,
    warehouseUsed,
    hasWell: () => !!(state.upgrades && state.upgrades.well),
  };

  function readGiftCode() {
    try {
      const q = new URLSearchParams(location.search);
      const fromQuery = q.get("gift");
      if (fromQuery) return String(fromQuery).trim();
    } catch { /* ignore */ }
    try {
      let param = tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param;
      if (param) {
        param = String(param).trim();
        if (param.startsWith("gift_")) param = param.slice(5);
        return param;
      }
    } catch { /* ignore */ }
    return "";
  }

  async function sha256hex(text) {
    const bytes = new TextEncoder().encode(String(text));
    if (!globalThis.crypto || !crypto.subtle) return "";
    const buf = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  async function redeemGift() {
    const def = GIFT || D.GIFT;
    if (!def || !def.hash || !state) return false;
    const code = readGiftCode();
    if (!code) return false;
    const digest = await sha256hex(code);
    if (!digest || digest !== String(def.hash).toLowerCase()) return false;
    if (!Array.isArray(state.redeemedGifts)) state.redeemedGifts = [];
    if (state.redeemedGifts.includes(def.id)) return false;
    const amount = Number(def.coins) || 1_000_000;
    state.coins += amount;
    state.redeemedGifts.push(def.id);
    save();
    haptic("success");
    toast("Премия: +1 000 000 руб.");
    renderAll();
    return true;
  }

  function boot() {
    preloadAssets();
    state = defaultState();
    initTelegram();
    loadLocal();
    loadCloudThen(() => {
      sync();
      redeemGift().then(() => { renderAll(); });
    });
    const app = document.getElementById("app");
    if (app) app.dataset.view = currentView;
    sync();
    renderAll();
    document.addEventListener("click", onTap);
    tickTimer = setInterval(tick, TICK_MS);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) { sync(); save(); renderAll(); }
    });
    window.addEventListener("beforeunload", () => { sync(); persistLocal(); });
  }

  boot();
})();
