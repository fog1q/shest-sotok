/* v6 systems: visits, Sharik, overripening, perennials, holidays, bees, cats, wardrobe */
(function (global) {
  const {
    CROPS, PRODUCTS, CROP_ORDER, NEIGHBORS, SEASONS,
    RIPEN, VISIT, SHARIK, PERENNIALS, PERENNIAL_ORDER, BEES,
    CATS, CAT_ORDER, HOLIDAYS, WARDROBE, WARDROBE_FREE,
    isFastMode, TIMING,
  } = global.SOTOK_DATA;

  function clone(x) {
    return JSON.parse(JSON.stringify(x));
  }

  function levelOf(state) {
    const XP = (global.SOTOK_DATA && global.SOTOK_DATA.XP_TABLE) || [0, 30, 80, 160, 280, 450, 680, 1000, 1400];
    const xp = state.xp || 0;
    let level = 1;
    for (let i = 1; i < XP.length; i += 1) {
      if (xp >= XP[i]) level = i + 1;
      else break;
    }
    return level;
  }

  function emptyPlot(id) {
    return {
      id,
      unlocked: true,
      cropId: null,
      plantedAt: 0,
      grownMs: 0,
      wateredUntil: 0,
      lastWaterAt: 0,
      weeds: 0,
      lastWeedAt: 0,
      pest: null,
      pestSince: 0,
      greenhouse: false,
      withered: false,
      readyAt: 0,
    };
  }

  function neighborCrops(nid, seasonId) {
    const style = (NEIGHBORS[nid] && NEIGHBORS[nid].style) || [];
    const pool = CROP_ORDER.filter((id) => {
      const c = CROPS[id];
      if (!c) return false;
      if (seasonId === "winter") return false;
      if (c.seasons && !c.seasons.includes(seasonId)) return false;
      if (style.includes("flower") && c.type === "flower") return true;
      if (style.includes("berry") && (c.type === "berry" || id === "strawberry")) return true;
      if (style.includes("staple") && (c.type === "veg" || c.type === "root")) return true;
      if (style.includes("shop") && (c.type === "flower" || c.type === "veg")) return true;
      return !style.length;
    });
    const fallback = CROP_ORDER.filter((id) => {
      const c = CROPS[id];
      return c && (!c.seasons || c.seasons.includes(seasonId)) && seasonId !== "winter";
    });
    return pool.length ? pool : fallback;
  }

  function seedPlot(plot, cropId, ts, readyFrac) {
    const crop = CROPS[cropId];
    if (!crop) return plot;
    plot.cropId = cropId;
    plot.plantedAt = ts - Math.floor(crop.growMs * readyFrac);
    plot.grownMs = Math.min(crop.growMs, Math.floor(crop.growMs * readyFrac));
    plot.withered = false;
    plot.weeds = readyFrac < 0.9 && Math.random() < 0.35 ? 1 : 0;
    plot.pest = readyFrac < 0.9 && Math.random() < 0.18 ? (["beetle", "aphid", "slug"][Math.floor(Math.random() * 3)]) : null;
    plot.pestSince = plot.pest ? ts : 0;
    plot.wateredUntil = Math.random() < 0.45 ? ts + 60_000 : 0;
    plot.readyAt = plot.grownMs >= crop.growMs ? ts - Math.floor((readyFrac - 1) * crop.growMs) : 0;
    return plot;
  }

  function genNeighborFarm(nid, ts, cal) {
    const plots = [];
    const pool = neighborCrops(nid, cal.seasonId);
    for (let i = 0; i < VISIT.plots; i++) {
      const p = emptyPlot(i);
      if (cal.seasonId !== "winter" && pool.length && Math.random() < 0.85) {
        const cropId = pool[i % pool.length];
        const frac = [0.25, 0.5, 0.75, 1.05, 1.2, 0.4][i] || 0.6;
        seedPlot(p, cropId, ts, frac);
      }
      plots.push(p);
    }
    const dogHours = isFastMode() ? VISIT.dogFeedMsFast : VISIT.dogFeedHours * 3600_000;
    return {
      plots,
      dogFedUntil: Math.random() < 0.55 ? ts + dogHours : 0,
      stolen: {},
      genKey: seasonKey(cal),
    };
  }

  function seasonKey(cal) {
    return `${cal.year}-${cal.seasonId}-${cal.dayInSeason}`;
  }

  function seasonOnlyKey(cal) {
    return `${cal.year}-${cal.seasonId}`;
  }

  function ensureVisitDay(state, cal) {
    const key = seasonKey(cal);
    if (!state.visitDay || state.visitDay.key !== key) {
      state.visitDay = { key, helps: 0, raids: 0 };
    }
    return state.visitDay;
  }

  function ensure(state, ts, cal) {
    if (!state.visits) state.visits = {};
    Object.keys(NEIGHBORS).forEach((nid) => {
      const farm = state.visits[nid];
      if (!farm || farm.genKey !== seasonKey(cal)) {
        state.visits[nid] = genNeighborFarm(nid, ts, cal);
      }
    });
    ensureVisitDay(state, cal);
    if (!state.dog) state.dog = { owned: false, fedUntil: 0, boughtAt: 0 };
    if (!state.notices) state.notices = [];
    if (!state.perennials) state.perennials = {};
    PERENNIAL_ORDER.forEach((id) => {
      if (!state.perennials[id]) state.perennials[id] = { owned: false, harvestedSeason: "" };
    });
    if (state.upgrades) {
      if (state.upgrades.apple) state.perennials.apple.owned = true;
      ["currant", "raspberry", "cherry", "beehive"].forEach((id) => {
        if (state.upgrades[id] && state.perennials[id]) state.perennials[id].owned = true;
      });
    }
    if (!state.bees) state.bees = { productMs: 0, ready: 0 };
    if (!state.cats) state.cats = { owned: [] };
    if (!Array.isArray(state.cats.owned)) state.cats.owned = [];
    if (!state.wardrobe) {
      state.wardrobe = { autoSeason: true, head: "", top: "", bottom: "", hand: "", owned: WARDROBE_FREE.slice() };
    }
    if (!Array.isArray(state.wardrobe.owned)) state.wardrobe.owned = WARDROBE_FREE.slice();
    WARDROBE_FREE.forEach((id) => {
      if (!state.wardrobe.owned.includes(id)) state.wardrobe.owned.push(id);
    });
    if (!state.overripeStock) state.overripeStock = {};
    if (!state.npcRaidDay) state.npcRaidDay = { key: "", count: 0 };
    if (state.lastNpcRaidAt == null) state.lastNpcRaidAt = ts;
    if (!state.holidayDone) state.holidayDone = {};
    return state;
  }

  function ripenTimes() {
    return isFastMode()
      ? { over: RIPEN.overripeAfterMsFast, spoil: RIPEN.spoilAfterMsFast }
      : { over: RIPEN.overripeAfterMs, spoil: RIPEN.spoilAfterMs };
  }

  function plotRipeness(plot, ts) {
    if (!plot || !plot.cropId || plot.withered) return { stage: "growing", ready: false, overripe: false, spoiled: false };
    const crop = CROPS[plot.cropId];
    if (!crop) return { stage: "growing", ready: false, overripe: false, spoiled: false };
    const ready = plot.grownMs >= crop.growMs;
    if (!ready) return { stage: "growing", ready: false, overripe: false, spoiled: false, readyAt: 0 };
    const readyAt = plot.readyAt || ts;
    const age = Math.max(0, ts - readyAt);
    const t = ripenTimes();
    if (age >= t.spoil) return { stage: "spoiled", ready: true, overripe: true, spoiled: true, readyAt, age };
    if (age >= t.over) return { stage: "overripe", ready: true, overripe: true, spoiled: false, readyAt, age };
    return { stage: "ripe", ready: true, overripe: false, spoiled: false, readyAt, age };
  }

  function markReady(plot, ts) {
    if (!plot || !plot.cropId) return;
    const crop = CROPS[plot.cropId];
    if (!crop) return;
    if (plot.grownMs >= crop.growMs && !plot.readyAt) plot.readyAt = ts;
    if (plot.grownMs < crop.growMs) plot.readyAt = 0;
  }

  function harvestYield(plot, ts) {
    const rip = plotRipeness(plot, ts);
    const crop = CROPS[plot.cropId];
    if (!crop || !rip.ready || rip.spoiled) return { ok: false, spoiled: !!rip.spoiled, yield: 0, priceMult: 0, overripe: false };
    const y = crop.yield || 1;
    if (rip.overripe) return { ok: true, spoiled: false, yield: Math.max(1, Math.floor(y * RIPEN.overripeYield)), priceMult: RIPEN.overripePriceMult, overripe: true };
    return { ok: true, spoiled: false, yield: y, priceMult: 1, overripe: false };
  }

  function currentHoliday(cal) {
    return HOLIDAYS.find((h) => h.season === cal.seasonId && h.days.includes(cal.dayInSeason)) || null;
  }

  function holidayKey(h, cal) {
    return `${cal.year}-${h.id}`;
  }

  function wardrobeOwned(state, id) {
    return !!(state.wardrobe && state.wardrobe.owned && state.wardrobe.owned.includes(id));
  }

  function grantWardrobe(state, id) {
    if (!state.wardrobe) return;
    if (!state.wardrobe.owned.includes(id)) state.wardrobe.owned.push(id);
  }

  function resolvedOutfit(state, cal) {
    const w = state.wardrobe || { autoSeason: true };
    const seasonLook = WARDROBE.seasonal[cal.seasonId] || WARDROBE.seasonal.spring;
    const holiday = currentHoliday(cal);
    const out = { ...seasonLook };
    if (w.autoSeason) {
      if (holiday && holiday.hand && wardrobeOwned(state, holiday.hand)) out.hand = holiday.hand;
      return out;
    }
    WARDROBE.slots.forEach((slot) => {
      const chosen = w[slot];
      if (chosen && WARDROBE.items[chosen] && wardrobeOwned(state, chosen)) out[slot] = chosen;
    });
    return out;
  }

  function canBuyWardrobe(state, id) {
    const item = WARDROBE.items[id];
    if (!item) return { ok: false, reason: "нет такой вещи" };
    if (wardrobeOwned(state, id)) return { ok: false, reason: "уже есть" };
    const level = levelOf(state);
    if (item.unlockLevel && level < item.unlockLevel) return { ok: false, reason: `нужен ${item.unlockLevel} разряд` };
    if (item.holiday) {
      const done = state.holidayDone && Object.keys(state.holidayDone).some((k) => k.endsWith("-" + item.holiday) && state.holidayDone[k]);
      const cal = { seasonId: "spring", dayInSeason: 1, year: 1 };
      // holiday unlock: owned after the holiday was celebrated at least once, or currently on that holiday
      if (!done && !(state._holidayNow && state._holidayNow.id === item.holiday)) {
        return { ok: false, reason: "открывается в праздник" };
      }
    }
    if ((item.price || 0) > (state.coins || 0)) return { ok: false, reason: "не хватает рублей" };
    return { ok: true, item };
  }

  function buyWardrobe(state, id) {
    const check = canBuyWardrobe(state, id);
    if (!check.ok) return check;
    state.coins -= check.item.price || 0;
    grantWardrobe(state, id);
    return { ok: true, item: check.item };
  }

  function setOutfitSlot(state, slot, id) {
    if (!WARDROBE.slots.includes(slot)) return { ok: false, reason: "нет такого слота" };
    if (id && !wardrobeOwned(state, id)) return { ok: false, reason: "сначала купите" };
    if (id && WARDROBE.items[id] && WARDROBE.items[id].slot !== slot) return { ok: false, reason: "не подходит" };
    state.wardrobe.autoSeason = false;
    state.wardrobe[slot] = id || "";
    return { ok: true };
  }

  function helpable(plot, ts) {
    if (!plot || !plot.cropId || plot.withered) return null;
    if (plot.pest) return "pest";
    if (plot.weeds) return "weed";
    if ((plot.wateredUntil || 0) < ts) return "water";
    return null;
  }

  function helpVisit(state, nid, plotId, ts, cal) {
    ensure(state, ts, cal);
    const day = ensureVisitDay(state, cal);
    if (day.helps >= VISIT.dailyHelp) return { ok: false, reason: "на сегодня хватит помощи" };
    const farm = state.visits[nid];
    if (!farm) return { ok: false, reason: "двор не найден" };
    const plot = farm.plots[plotId];
    const kind = helpable(plot, ts);
    if (!kind) return { ok: false, reason: "здесь уже порядок" };
    if (kind === "water") plot.wateredUntil = ts + 8 * 60_000;
    if (kind === "weed") plot.weeds = 0;
    if (kind === "pest") { plot.pest = null; plot.pestSince = 0; }
    day.helps += 1;
    return { ok: true, kind, coins: VISIT.helpCoins, xp: VISIT.helpXp, helpsLeft: VISIT.dailyHelp - day.helps };
  }

  function ripeStealable(farm, plot, ts) {
    if (!plot || !plot.cropId || plot.withered) return false;
    const rip = plotRipeness(plot, ts);
    if (!rip.ready || rip.spoiled) return false;
    const key = `${plot.id}-${plot.plantedAt || 0}`;
    if (farm.stolen && farm.stolen[key]) return false;
    return true;
  }

  function raidVisit(state, nid, plotId, ts, cal, rng) {
    ensure(state, ts, cal);
    const day = ensureVisitDay(state, cal);
    if (day.raids >= VISIT.dailyRaid) return { ok: false, reason: "на сегодня хватит вылазок" };
    const farm = state.visits[nid];
    if (!farm) return { ok: false, reason: "двор не найден" };
    const plot = farm.plots[plotId];
    if (!ripeStealable(farm, plot, ts)) return { ok: false, reason: "тут нечего брать" };
    const rand = rng || Math.random;
    const dogFed = (farm.dogFedUntil || 0) > ts;
    const catchChance = dogFed ? VISIT.catchChanceFed : VISIT.catchChanceHungry;
    day.raids += 1;
    if (rand() < catchChance) {
      const fine = VISIT.catchFine;
      state.coins = Math.max(0, (state.coins || 0) - fine);
      return { ok: false, caught: true, dog: NEIGHBORS[nid].dog, fine, reason: `${NEIGHBORS[nid].dog} поймал за руку` };
    }
    const rip = harvestYield(plot, ts);
    const count = Math.min(rip.yield, VISIT.stealMin + Math.floor(rand() * (VISIT.stealMax - VISIT.stealMin + 1)));
    const cropId = plot.cropId;
    const key = `${plot.id}-${plot.plantedAt || 0}`;
    farm.stolen[key] = true;
    plot.cropId = null;
    plot.grownMs = 0;
    plot.plantedAt = 0;
    plot.readyAt = 0;
    plot.withered = false;
    plot.pest = null;
    plot.weeds = 0;
    return { ok: true, caught: false, cropId, count, overripe: rip.overripe, raidsLeft: VISIT.dailyRaid - day.raids };
  }

  function flowerNearby(state) {
    return (state.plots || []).some((p) => {
      if (!p.cropId || p.withered) return false;
      const c = CROPS[p.cropId];
      return c && (c.type === "flower" || (BEES.flowerTypes || []).includes(c.type));
    });
  }

  function pushNotice(state, text, kind) {
    state.notices = state.notices || [];
    state.notices.unshift({ id: "n" + Date.now() + Math.floor(Math.random() * 999), text, kind: kind || "info", at: Date.now(), read: false });
    if (state.notices.length > 20) state.notices.length = 20;
  }

  function unreadNotices(state) {
    return (state.notices || []).filter((n) => !n.read).length;
  }

  function markNoticesRead(state) {
    (state.notices || []).forEach((n) => { n.read = true; });
  }

  function maybeNpcRaid(state, ts, cal, rng) {
    const rand = rng || Math.random;
    if (!state.plots) return null;
    const dayKey = seasonKey(cal);
    if (!state.npcRaidDay || state.npcRaidDay.key !== dayKey) state.npcRaidDay = { key: dayKey, count: 0 };
    if (state.npcRaidDay.count >= SHARIK.maxRaidsPerDay) return null;
    const every = isFastMode() ? SHARIK.raidEveryMsFast : SHARIK.raidEveryMs;
    if (ts - (state.lastNpcRaidAt || 0) < every) return null;
    state.lastNpcRaidAt = ts;
    if (rand() > SHARIK.raidChance) return null;
    const ripe = state.plots.filter((p) => {
      if (!p.cropId || p.withered) return false;
      const rip = plotRipeness(p, ts);
      return rip.ready && !rip.spoiled;
    });
    if (!ripe.length) return null;
    const dogOwned = !!(state.dog && state.dog.owned);
    const dogFed = dogOwned && (state.dog.fedUntil || 0) > ts;
    const catchChance = !dogOwned ? SHARIK.catchNone : (dogFed ? SHARIK.catchFed : SHARIK.catchHungry);
    const thiefIds = Object.keys(NEIGHBORS);
    const thief = NEIGHBORS[thiefIds[Math.floor(rand() * thiefIds.length)]];
    state.npcRaidDay.count += 1;
    if (rand() < catchChance) {
      pushNotice(state, `Шарик отогнал гостя (${thief.name}) — урожай цел.`, "dog");
      return { caught: true, thief: thief.id };
    }
    const plot = ripe[Math.floor(rand() * ripe.length)];
    const cropId = plot.cropId;
    const name = (CROPS[cropId] && CROPS[cropId].name) || cropId;
    plot.cropId = null;
    plot.grownMs = 0;
    plot.plantedAt = 0;
    plot.readyAt = 0;
    plot.withered = false;
    plot.pest = null;
    plot.weeds = 0;
    pushNotice(state, `${thief.name} стащил${thief.id === "tanka" ? "а" : ""} ${name.toLowerCase()} с грядки, пока вас не было.`, "raid");
    return { caught: false, thief: thief.id, cropId, plotId: plot.id };
  }

  function tickNeighborFarms(state, dt, ts, cal) {
    Object.values(state.visits || {}).forEach((farm) => {
      (farm.plots || []).forEach((plot) => {
        if (!plot.cropId || plot.withered) return;
        const crop = CROPS[plot.cropId];
        if (!crop) return;
        if (plot.grownMs < crop.growMs) {
          plot.grownMs = Math.min(crop.growMs, plot.grownMs + dt);
          if (plot.grownMs >= crop.growMs && !plot.readyAt) plot.readyAt = ts;
        }
      });
    });
  }

  function tickPerennials(state) {
    if (!state.upgrades) return;
    PERENNIAL_ORDER.forEach((id) => {
      if (state.upgrades[id] || (id === "apple" && state.upgrades.apple)) {
        if (!state.perennials[id]) state.perennials[id] = { owned: false, harvestedSeason: "" };
        state.perennials[id].owned = true;
      }
    });
  }

  function canPickPerennial(state, id, cal) {
    const def = PERENNIALS[id];
    const rec = state.perennials && state.perennials[id];
    if (!def || !rec || !rec.owned) return { ok: false, reason: "ещё не посажено" };
    if (cal.seasonId === "winter" || !(def.seasons || []).includes(cal.seasonId)) {
      return { ok: false, reason: "сейчас спит", dormant: true };
    }
    if (rec.harvestedSeason === seasonOnlyKey(cal)) return { ok: false, reason: "уже собирали в этом сезоне" };
    return { ok: true, def };
  }

  function pickPerennial(state, id, cal) {
    const check = canPickPerennial(state, id, cal);
    if (!check.ok) return check;
    const def = check.def;
    state.perennials[id].harvestedSeason = seasonOnlyKey(cal);
    return { ok: true, product: def.product, count: def.count, xp: def.xp };
  }

  function tickBees(state, dt) {
    if (!state.upgrades || !state.upgrades.beehive) return;
    if (!state.bees) state.bees = { productMs: 0, ready: 0 };
    if (!flowerNearby(state)) return;
    const need = isFastMode() ? BEES.timeMsFast : BEES.timeMs;
    state.bees.productMs += dt;
    if (state.bees.productMs >= need) {
      const n = Math.floor(state.bees.productMs / need);
      state.bees.ready = (state.bees.ready || 0) + n;
      state.bees.productMs -= n * need;
    }
  }

  function collectHoney(state) {
    const n = (state.bees && state.bees.ready) || 0;
    if (n <= 0) return { ok: false, reason: "мёд ещё не готов" };
    state.bees.ready = 0;
    return { ok: true, product: BEES.product, count: n, xp: BEES.xp * n };
  }

  function pestChanceMul(state) {
    const n = (state.cats && state.cats.owned && state.cats.owned.length) || 0;
    if (!n) return 1;
    return Math.max(0.35, 1 - n * 0.12);
  }

  function buyCat(state, id) {
    const cat = CATS[id];
    if (!cat) return { ok: false, reason: "нет такого кота" };
    if (state.cats.owned.includes(id)) return { ok: false, reason: "уже живёт у вас" };
    if (levelOf(state) < cat.unlockLevel) return { ok: false, reason: `нужен ${cat.unlockLevel} разряд` };
    if ((state.coins || 0) < cat.price) return { ok: false, reason: "не хватает рублей" };
    state.coins -= cat.price;
    state.cats.owned.push(id);
    return { ok: true, cat };
  }

  function buyDog(state, ts) {
    if (state.dog && state.dog.owned) return { ok: false, reason: "Шарик уже ваш" };
    if (levelOf(state) < SHARIK.unlockLevel) return { ok: false, reason: `нужен ${SHARIK.unlockLevel} разряд` };
    if ((state.coins || 0) < SHARIK.buyPrice) return { ok: false, reason: "не хватает рублей" };
    state.coins -= SHARIK.buyPrice;
    state.dog = { owned: true, fedUntil: 0, boughtAt: ts };
    return { ok: true };
  }

  function feedDog(state, ts) {
    if (!state.dog || !state.dog.owned) return { ok: false, reason: "сначала заведите Шарика" };
    if (!state.warehouse) state.warehouse = {};
    const have = state.warehouse.bone || 0;
    if (have < 1) return { ok: false, reason: "нужна кость" };
    state.warehouse.bone -= 1;
    const lasts = isFastMode() ? SHARIK.feedLastsMsFast : SHARIK.feedLastsMs;
    state.dog.fedUntil = Math.max(state.dog.fedUntil || 0, ts) + lasts;
    return { ok: true, fedUntil: state.dog.fedUntil };
  }

  function tickHolidays(state, cal) {
    const h = currentHoliday(cal);
    state._holidayNow = h;
    if (!h) return null;
    const key = holidayKey(h, cal);
    if (h.reward && h.reward.wardrobe) grantWardrobe(state, h.reward.wardrobe);
    if (h.hand) grantWardrobe(state, h.hand);
    return h;
  }

  function claimHoliday(state, cal) {
    const h = currentHoliday(cal);
    if (!h) return { ok: false, reason: "сейчас не праздник" };
    const key = holidayKey(h, cal);
    if (state.holidayDone[key]) return { ok: false, reason: "уже отметили" };
    state.holidayDone[key] = true;
    if (h.reward && h.reward.wardrobe) grantWardrobe(state, h.reward.wardrobe);
    if (h.hand) grantWardrobe(state, h.hand);
    return { ok: true, holiday: h, coins: (h.reward && h.reward.coins) || 0, items: (h.reward && h.reward.items) || {}, xp: 8 };
  }

  function tick(state, dt, ts, weather, cal) {
    ensure(state, ts, cal);
    tickNeighborFarms(state, dt, ts, cal);
    tickPerennials(state);
    tickBees(state, dt);
    tickHolidays(state, cal);
    maybeNpcRaid(state, ts, cal);
    (state.plots || []).forEach((p) => markReady(p, ts));
  }

  global.SOTOK_V6 = {
    ensure, tick, seasonKey, seasonOnlyKey,
    plotRipeness, markReady, harvestYield, ripenTimes,
    genNeighborFarm, helpVisit, raidVisit, helpable, ripeStealable,
    maybeNpcRaid, pushNotice, unreadNotices, markNoticesRead,
    canPickPerennial, pickPerennial, flowerNearby, collectHoney,
    pestChanceMul, buyCat, buyDog, feedDog,
    currentHoliday, claimHoliday, holidayKey,
    resolvedOutfit, buyWardrobe, canBuyWardrobe, setOutfitSlot, grantWardrobe, wardrobeOwned,
  };
})(typeof window !== "undefined" ? window : globalThis);
