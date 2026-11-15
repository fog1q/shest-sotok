/* global window */
window.SOTOK_LOOP = (() => {
  "use strict";

  const D = () => window.SOTOK_DATA;
  let host = null;

  function attach(h) { host = h; }

  function fast() { return !!(D().TIMING && D().TIMING.fast); }
  function careMs(playKey, fastKey) {
    const c = D().CARE;
    return fast() ? c[fastKey] : c[playKey];
  }

  function emptyStats() {
    return { harvested: {}, sold: {}, collected: {}, crafted: {}, planted: {}, watered: 0, weeds: 0, pests: 0 };
  }

  function ensure(state) {
    if (!state) return state;
    if (!state.stats) state.stats = emptyStats();
    const st = state.stats;
    for (const k of ["harvested", "sold", "collected", "crafted", "planted"]) {
      if (!st[k] || typeof st[k] !== "object") st[k] = {};
    }
    for (const k of ["watered", "weeds", "pests"]) if (typeof st[k] !== "number") st[k] = 0;
    if (!Array.isArray(state.quests)) state.quests = [];
    if (!Array.isArray(state.orders)) state.orders = [];
    if (!state.tutorial) state.tutorial = { step: 0, done: false };
    if (!state.daily) state.daily = { streak: 0, lastClaim: "", lastSeen: "" };
    if (!state.stations) state.stations = { stove: [], barrel: [], separator: [], spinner: [] };
    for (const id of Object.keys(D().STATIONS)) {
      if (!Array.isArray(state.stations[id])) state.stations[id] = [];
    }
    if (typeof state.questGenAt !== "number") state.questGenAt = 0;
    if (typeof state.orderGenAt !== "number") state.orderGenAt = 0;
    if (!state.selectedTool) state.selectedTool = "";
    const plots = (state.plots || []).concat(state.greenhouse || []);
    for (const p of plots) {
      if (typeof p.weeds !== "boolean") p.weeds = false;
      if (!p.pest) p.pest = null;
      if (typeof p.thirsty !== "boolean") p.thirsty = false;
      if (typeof p.careAt !== "number") p.careAt = p.plantedAt || 0;
    }
    return state;
  }

  function bump(state, bucket, key, n) {
    ensure(state);
    if (!state.stats[bucket] || typeof state.stats[bucket] !== "object") {
      if (typeof state.stats[bucket] === "number") state.stats[bucket] += n;
      return;
    }
    state.stats[bucket][key] = (state.stats[bucket][key] || 0) + n;
  }

  function bumpCount(state, key, n) {
    ensure(state);
    state.stats[key] = (state.stats[key] || 0) + n;
  }

  function itemName(id) {
    const crop = D().CROPS[id];
    if (crop) return crop.name;
    const prod = D().PRODUCTS[id];
    if (prod) return prod.name;
    return id;
  }

  function sellPrice(id) {
    const crop = D().CROPS[id];
    if (crop) return crop.sellPrice;
    const prod = D().PRODUCTS[id];
    if (prod) return prod.sellPrice || 0;
    return 0;
  }

  /* ——— Care (thirst, weeds, pests) ——— */
  function tickCare(state, dt, ts, weather) {
    const thirstAfter = careMs("thirstAfterMs", "thirstAfterMsFast");
    const weedAfter = careMs("weedAfterMs", "weedAfterMsFast");
    const pestAfter = careMs("pestAfterMs", "pestAfterMsFast");
    const autoWater = !!(state.upgrades && state.upgrades.well) || weather.id === "rain";
    const plots = (state.plots || []).concat(state.greenhouse || []);
    for (const plot of plots) {
      if (!plot.unlocked || !plot.cropId || plot.withered) {
        plot.thirsty = false;
        continue;
      }
      if (autoWater) {
        const lasts = careMs("waterLastsMs", "waterLastsMsFast");
        plot.wateredUntil = Math.max(plot.wateredUntil || 0, ts + lasts);
        plot.thirsty = false;
      }
      if (plot.wateredUntil && plot.wateredUntil > ts) plot.thirsty = false;
      const planted = plot.careAt || plot.plantedAt || ts;
      const age = ts - planted;
      const seed = (state.worldSeed || 1);
      const hid = hashPlot(plot.id);
      if (!autoWater && !plot.thirsty && !(plot.wateredUntil && plot.wateredUntil > ts) && age > thirstAfter) {
        const roll = ((host && host.hash32) ? host.hash32(seed * 17 + hid * 3 + Math.floor(age / thirstAfter)) : age) % 100;
        if (roll < 55) plot.thirsty = true;
      }
      if (!plot.weeds && age > weedAfter && plot.kind !== "greenhouse") {
        const roll = ((host && host.hash32) ? host.hash32(seed * 29 + hid * 11 + Math.floor(age / weedAfter)) : age) % 100;
        if (roll < 40) plot.weeds = true;
      }
      if (!plot.pest && age > pestAfter && plot.kind !== "greenhouse") {
        const roll = ((host && host.hash32) ? host.hash32(seed * 43 + hid * 19 + Math.floor(age / pestAfter)) : age) % 100;
        const pestMul = (window.SOTOK_V6 && window.SOTOK_V6.pestChanceMul(state)) || 1;
        if (roll < 28 * pestMul) {
          const pests = D().PEST_ORDER;
          plot.pest = pests[Math.abs(hid + seed) % pests.length];
        }
      }
    }
  }

  function hashPlot(id) {
    const s = String(id);
    let h = 0;
    for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
    return h;
  }

  function water(state, plot, ts) {
    if (!plot || !plot.unlocked) return false;
    const lasts = careMs("waterLastsMs", "waterLastsMsFast");
    plot.wateredUntil = ts + lasts;
    plot.thirsty = false;
    bumpCount(state, "watered", 1);
    advanceTutorial(state, "water");
    progressQuests(state, "water", 1);
    return true;
  }

  function pullWeeds(state, plot) {
    if (!plot || !plot.weeds) return false;
    plot.weeds = false;
    plot.careAt = (host && host.now) ? host.now() : Date.now();
    bumpCount(state, "weeds", 1);
    progressQuests(state, "weed", 1);
    if (host && host.addXp) host.addXp(1);
    return true;
  }

  function clearPest(state, plot, tool) {
    if (!plot || !plot.pest) return false;
    const def = D().PESTS[plot.pest];
    if (tool && def && def.remedy && tool !== def.remedy && tool !== "hand") {
      // wrong remedy still works but toast later
    }
    if (tool === "dust" || tool === "ash") {
      if ((state.warehouse[tool] || 0) < 1) return "need-tool";
      state.warehouse[tool] -= 1;
    }
    plot.pest = null;
    plot.careAt = (host && host.now) ? host.now() : Date.now();
    bumpCount(state, "pests", 1);
    progressQuests(state, "pest", 1);
    if (host && host.addXp) host.addXp(1);
    return true;
  }

  function resetPlotCare(plot) {
    if (!plot) return;
    plot.weeds = false;
    plot.pest = null;
    plot.thirsty = false;
    plot.careAt = 0;
  }

  /* ——— Processing ——— */
  function stationOwned(state, stationId) {
    const st = D().STATIONS[stationId];
    if (!st) return false;
    return !!(state.upgrades && state.upgrades[st.upgrade]);
  }

  function recipeTime(rec) {
    return fast() ? rec.timeMsFast : rec.timeMs;
  }

  function canStartRecipe(state, recipeId) {
    const rec = D().RECIPES[recipeId];
    if (!rec) return "no-recipe";
    if (!stationOwned(state, rec.station)) return "no-station";
    const level = host && host.levelFromXp ? host.levelFromXp(state.xp) : 1;
    if (level < rec.unlockLevel) return "level";
    const q = state.stations[rec.station] || [];
    if (q.length >= (D().PROCESS_QUEUE || 2)) return "queue";
    for (const [id, n] of Object.entries(rec.inputs)) {
      if ((state.warehouse[id] || 0) < n) return "inputs";
    }
    return "";
  }

  function startRecipe(state, recipeId, ts) {
    const rec = D().RECIPES[recipeId];
    const err = canStartRecipe(state, recipeId);
    if (err) return err;
    for (const [id, n] of Object.entries(rec.inputs)) state.warehouse[id] -= n;
    if (!state.stations[rec.station]) state.stations[rec.station] = [];
    state.stations[rec.station].push({
      recipeId,
      startedAt: ts,
      doneAt: ts + recipeTime(rec),
    });
    return "";
  }

  function tickStations(state, ts) {
    let ready = 0;
    for (const sid of Object.keys(D().STATIONS)) {
      const q = state.stations[sid] || [];
      for (const job of q) {
        if (!job.ready && ts >= job.doneAt) {
          job.ready = true;
          ready += 1;
        }
      }
    }
    return ready;
  }

  function collectJob(state, stationId, index) {
    const q = state.stations[stationId] || [];
    const job = q[index];
    if (!job || !job.ready) return false;
    const rec = D().RECIPES[job.recipeId];
    if (!rec) { q.splice(index, 1); return false; }
    if (host && host.canStore && !host.canStore(rec.outputCount || 1)) return "full";
    state.warehouse[rec.output] = (state.warehouse[rec.output] || 0) + (rec.outputCount || 1);
    bump(state, "crafted", rec.id, rec.outputCount || 1);
    progressQuests(state, "craft", rec.outputCount || 1, rec.id);
    if (host && host.addXp) host.addXp(rec.xp || 0);
    q.splice(index, 1);
    return rec;
  }

  function readyJobs(state, ts) {
    tickStations(state, ts || (host && host.now && host.now()));
    let n = 0;
    for (const sid of Object.keys(state.stations || {})) {
      n += (state.stations[sid] || []).filter((j) => j.ready).length;
    }
    return n;
  }

  /* ——— Quests + tutorial ——— */
  function questRefreshMs() {
    return fast() ? D().QUEST_REFRESH_MS_FAST : D().QUEST_REFRESH_MS;
  }

  function makeQuest(template, ts, uid) {
    return {
      id: "q-" + uid,
      type: template.type,
      crop: template.crop || "",
      item: template.item || template.crop || template.recipe || "",
      recipe: template.recipe || "",
      count: template.count,
      progress: 0,
      coins: template.coins || 0,
      xp: template.xp || 0,
      title: template.title,
      text: template.text,
      claimed: false,
      expiresAt: ts + questRefreshMs(),
      tutorial: !!template.tutorial,
    };
  }

  function fillQuests(state, ts) {
    ensure(state);
    const tut = D().TUTORIAL;
    if (!state.tutorial.done) {
      const step = state.tutorial.step || 0;
      if (step < tut.length) {
        const has = state.quests.some((q) => q.tutorial && q.id === "tut-" + tut[step].id);
        if (!has) {
          const q = makeQuest({ ...tut[step], tutorial: true }, ts, "tut");
          q.id = "tut-" + tut[step].id;
          q.expiresAt = ts + 365 * 86400000;
          state.quests.unshift(q);
        }
      }
    }
    state.quests = state.quests.filter((q) => {
      if (q.tutorial && !q.claimed) return true;
      if (q.claimed) return false;
      if (q.expiresAt && ts > q.expiresAt) return false;
      return true;
    });
    const board = state.quests.filter((q) => !q.tutorial);
    const need = (D().MAX_ACTIVE_QUESTS || 3) - board.length;
    if (need <= 0) return;
    const used = new Set(board.map((q) => q.type + ":" + (q.item || q.crop || "")));
    const pool = D().QUEST_TEMPLATES.filter((t) => !used.has(t.type + ":" + (t.item || t.crop || t.recipe || "")));
    const seed = state.worldSeed || 1;
    for (let i = 0; i < need && pool.length; i += 1) {
      const idx = Math.abs((host && host.hash32 ? host.hash32(seed + ts + i * 97 + state.quests.length) : i) % pool.length);
      const tpl = pool.splice(idx, 1)[0];
      state.quests.push(makeQuest(tpl, ts, String(ts) + "-" + i));
    }
    state.questGenAt = ts;
  }

  function progressQuests(state, type, n, key) {
    ensure(state);
    for (const q of state.quests) {
      if (q.claimed || q.progress >= q.count) continue;
      if (q.type !== type) continue;
      if (q.crop && key && q.crop !== key) continue;
      if (q.item && key && q.item !== key && type !== "water" && type !== "weed" && type !== "pest") continue;
      if (q.recipe && key && q.recipe !== key) continue;
      q.progress = Math.min(q.count, (q.progress || 0) + n);
    }
  }

  function advanceTutorial(state, type, key) {
    if (!state.tutorial || state.tutorial.done) return;
    const step = state.tutorial.step || 0;
    const tut = D().TUTORIAL[step];
    if (!tut) { state.tutorial.done = true; return; }
    // progress is handled via the quest itself; claiming advances
    void type;
    void key;
  }

  function claimQuest(state, questId) {
    const q = (state.quests || []).find((x) => x.id === questId);
    if (!q || q.claimed || (q.progress || 0) < q.count) return false;
    q.claimed = true;
    state.coins += q.coins || 0;
    if (host && host.addXp && q.xp) host.addXp(q.xp);
    if (q.tutorial) {
      state.tutorial.step = (state.tutorial.step || 0) + 1;
      if (state.tutorial.step >= D().TUTORIAL.length) state.tutorial.done = true;
    }
    const ts = host && host.now ? host.now() : Date.now();
    state.quests = state.quests.filter((x) => x.id !== questId);
    fillQuests(state, ts);
    return q;
  }

  function unclaimedReady(state) {
    return (state.quests || []).filter((q) => !q.claimed && (q.progress || 0) >= q.count).length;
  }

  /* ——— Neighbor orders ——— */
  function orderTtl() { return fast() ? D().ORDER_TTL_MS_FAST : D().ORDER_TTL_MS; }
  function orderGap() { return fast() ? D().ORDER_GAP_MS_FAST : D().ORDER_GAP_MS; }

  function fillOrders(state, ts) {
    ensure(state);
    state.orders = (state.orders || []).filter((o) => !o.done && ts < o.expiresAt);
    if (state.orders.length >= (D().MAX_ORDERS || 2)) return;
    if (state.orderGenAt && ts - state.orderGenAt < orderGap() && state.orders.length) return;
    const usedN = new Set(state.orders.map((o) => o.neighbor));
    const neigh = D().NEIGHBOR_ORDER.filter((id) => !usedN.has(id));
    if (!neigh.length) return;
    const seed = state.worldSeed || 1;
    const nid = neigh[Math.abs((host && host.hash32 ? host.hash32(seed + Math.floor(ts / 1000)) : 0) % neigh.length)];
    const n = D().NEIGHBORS[nid];
    const wantId = n.wants[Math.abs((host && host.hash32 ? host.hash32(seed * 7 + Math.floor(ts / 500)) : 1) % n.wants.length)];
    const base = sellPrice(wantId) || 10;
    const count = base >= 40 ? 1 : 2;
    const mult = 1.6 + ((host && host.hash32 ? host.hash32(seed + ts) : 0) % 60) / 100;
    const reward = Math.round(base * count * mult);
    state.orders.push({
      id: "ord-" + ts + "-" + nid,
      neighbor: nid,
      item: wantId,
      count,
      reward,
      expiresAt: ts + orderTtl(),
      done: false,
    });
    state.orderGenAt = ts;
  }

  function fulfillOrder(state, orderId) {
    const o = (state.orders || []).find((x) => x.id === orderId);
    if (!o || o.done) return false;
    if ((state.warehouse[o.item] || 0) < o.count) return "need";
    state.warehouse[o.item] -= o.count;
    state.coins += o.reward;
    o.done = true;
    state.orders = state.orders.filter((x) => x.id !== orderId);
    if (host && host.addXp) host.addXp(6);
    return o;
  }

  /* ——— Daily bonus + fair ——— */
  function todayKey() {
    try {
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    } catch {
      return "1970-01-01";
    }
  }

  function yesterdayKey() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function dailyAvailable(state) {
    ensure(state);
    return state.daily.lastClaim !== todayKey();
  }

  function claimDaily(state) {
    ensure(state);
    const today = todayKey();
    if (state.daily.lastClaim === today) return false;
    let streak = state.daily.streak || 0;
    if (state.daily.lastClaim === yesterdayKey()) streak += 1;
    else streak = 1;
    if (streak > 7) streak = 1;
    state.daily.streak = streak;
    state.daily.lastClaim = today;
    const row = D().DAILY_BONUS[streak - 1] || D().DAILY_BONUS[0];
    state.coins += row.coins;
    if (row.items) {
      for (const [k, v] of Object.entries(row.items)) {
        state.warehouse[k] = (state.warehouse[k] || 0) + v;
      }
    }
    return row;
  }

  function fairMult(state, itemId, dayIndex) {
    const f = D().FAIR;
    const h = host && host.hash32 ? host.hash32((state.worldSeed || 1) * 13 + dayIndex * 91 + hashPlot(itemId)) : 0;
    const span = f.maxMult - f.minMult;
    let m = f.minMult + (Math.abs(h) % 1000) / 1000 * span;
    const specialRoll = (Math.abs(host && host.hash32 ? host.hash32((state.worldSeed || 1) + dayIndex * 7) : 0) % 1000) / 1000;
    const specialItemPool = (D().CROP_ORDER || []).concat(["egg", "milk", "wool", "jam"]);
    const specialItem = specialItemPool[Math.abs((state.worldSeed || 1) + dayIndex) % specialItemPool.length];
    if (specialRoll < f.specialChance && itemId === specialItem) {
      return { mult: f.specialMult, special: true };
    }
    return { mult: Math.round(m * 100) / 100, special: false };
  }

  function fairPrice(state, itemId, dayIndex) {
    const info = fairMult(state, itemId, dayIndex);
    return { price: Math.max(1, Math.round(sellPrice(itemId) * info.mult)), ...info };
  }

  /* ——— Badges / tips ——— */
  function badges(state, ts) {
    ensure(state);
    const plots = (state.plots || []).concat(state.greenhouse || []);
    const crops = D().CROPS;
    let ripe = 0, thirsty = 0, weeds = 0, pests = 0;
    for (const p of plots) {
      if (!p.unlocked || p.withered) continue;
      const c = p.cropId && crops[p.cropId];
      if (c && p.grownMs >= c.growMs) ripe += 1;
      if (p.thirsty) thirsty += 1;
      if (p.weeds) weeds += 1;
      if (p.pest) pests += 1;
    }
    let yard = 0;
    for (const a of state.animals || []) {
      const def = D().ANIMALS[a.kind];
      if (def && def.product && a.adult && a.productMs >= def.productTime) yard += 1;
      if (host && host.isHungryAt && ts && host.isHungryAt(a, ts)) yard += 1;
    }
    const quests = unclaimedReady(state) + (state.orders || []).length + (dailyAvailable(state) ? 1 : 0);
    const craft = readyJobs(state, ts);
    const farm = ripe + thirsty + weeds + pests;
    return { ripe, thirsty, weeds, pests, farm, yard, quests, craft, dela: quests };
  }

  function farmerTip(state, cal, weather, ts) {
    const b = badges(state, ts);
    if (b.thirsty) return "Пора полить грядки!";
    if (b.pests) return "Вредители на участке — не зевайте!";
    if (b.weeds) return "Сорняки лезут, прополите грядки.";
    if (b.ripe) return "Урожай просится в сарай. Не передержите.";
    if (b.craft) return "На кухне всё готово — заберите заготовки.";
    if (b.yard) return "Загляните во двор: кормить или собирать.";
    if (dailyAvailable(state)) return "Премия председателя ждёт в «Делах».";
    const tips = D().FARMER_TIPS;
    if (weather && tips[weather.id]) return tips[weather.id];
    if (cal && cal.seasonId === "winter") return tips.winter;
    const list = tips.default || ["Шесть соток — и целый мир, сосед."];
    const i = Math.abs((state.worldSeed || 1) + Math.floor((ts || 0) / 20000)) % list.length;
    return list[i];
  }

  function hookPlant(state, cropId) {
    bump(state, "planted", cropId, 1);
    progressQuests(state, "plant", 1, cropId);
    advanceTutorial(state, "plant", cropId);
  }

  function hookHarvest(state, cropId, qty) {
    bump(state, "harvested", cropId, qty);
    progressQuests(state, "harvest", qty, cropId);
    advanceTutorial(state, "harvest", cropId);
  }

  function hookSell(state, itemId, qty) {
    bump(state, "sold", itemId, qty);
    progressQuests(state, "sell", qty, itemId);
    advanceTutorial(state, "sell", itemId);
  }

  function hookCollect(state, itemId, qty) {
    bump(state, "collected", itemId, qty);
    progressQuests(state, "collect", qty, itemId);
  }

  function tick(state, dt, ts, weather, cal) {
    ensure(state);
    tickCare(state, dt, ts, weather);
    tickStations(state, ts);
    fillQuests(state, ts);
    fillOrders(state, ts);
    if (window.SOTOK_V6 && window.SOTOK_V6.tick) window.SOTOK_V6.tick(state, dt, ts, weather, cal);
  }

  function timeOfDay(cal) {
    const dayMs = (D().TIMING && D().TIMING.DAY_MS) || 15000;
    const into = cal && typeof cal.msIntoDay === "number"
      ? cal.msIntoDay
      : (cal && typeof cal.msToNextSeason === "number" ? 0 : 0);
    // fallback: host may pass ratio
    const ratio = cal && cal.dayRatio != null ? cal.dayRatio : (into / dayMs);
    if (ratio < 0.2) return "dawn";
    if (ratio < 0.45) return "day";
    if (ratio < 0.7) return "day";
    if (ratio < 0.85) return "dusk";
    return "night";
  }

  return {
    attach, ensure, tick,
    water, pullWeeds, clearPest, resetPlotCare,
    startRecipe, canStartRecipe, collectJob, tickStations, readyJobs, stationOwned, recipeTime,
    fillQuests, claimQuest, progressQuests, unclaimedReady,
    fillOrders, fulfillOrder,
    dailyAvailable, claimDaily, todayKey,
    fairMult, fairPrice, sellPrice, itemName,
    badges, farmerTip, timeOfDay,
    hookPlant, hookHarvest, hookSell, hookCollect,
    bump, bumpCount,
  };
})();
