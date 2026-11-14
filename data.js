/* global window */
window.SOTOK_DATA = (() => {
  "use strict";

  const ASSET_VER = "20261114b";

  /* One-time owner gift: only the SHA-256 of the secret code is stored here. */
  const GIFT = {
    id: "premiya-1",
    coins: 1_000_000,
    hash: "470acd16bbb80c46be2244974ada1be8c065dc40239fa385a758426e711f71a6",
  };

  const TIMING = {
    // Live play: one season lasts this many real-world days (12 in-game days).
    SEASON_REAL_DAYS: 3,
    DAYS_PER_SEASON: 12,
    FAST_DAY_MS: 15_000,
    // Pre-v4 saves used 15-second days; used only to rebase the calendar.
    LEGACY_DAY_MS: 15_000,
    DAY_MS: 15_000,
    fast: false,
  };

  const PLAY_CROP_GROW_MS = {
    radish: 8 * 60_000,
    dill: 10 * 60_000,
    peas: 20 * 60_000,
    garlic: 30 * 60_000,
    tulip: 18 * 60_000,
    narcissus: 22 * 60_000,
    cucumber: 25 * 60_000,
    tomato: 45 * 60_000,
    zucchini: 40 * 60_000,
    strawberry: 70 * 60_000,
    cornflower: 25 * 60_000,
    peony: 90 * 60_000,
    potato: 80 * 60_000,
    cabbage: 100 * 60_000,
    pumpkin: 3 * 60 * 60_000,
    aster: 40 * 60_000,
    gladiolus: 50 * 60_000,
    chrysanthemum: 55 * 60_000,
  };

  const PLAY_ANIMAL_TIMES = {
    chicken: { growMs: 40 * 60_000, feedEveryMs: 3 * 60 * 60_000, productTime: 2 * 60 * 60_000 },
    rabbit:  { growMs: 50 * 60_000, feedEveryMs: 4 * 60 * 60_000, productTime: 3 * 60 * 60_000 },
    goat:    { growMs: 70 * 60_000, feedEveryMs: 5 * 60 * 60_000, productTime: 4 * 60 * 60_000 },
    pig:     { growMs: 90 * 60_000, feedEveryMs: 5 * 60 * 60_000, productTime: 0 },
    sheep:   { growMs: 80 * 60_000, feedEveryMs: 5 * 60 * 60_000, productTime: 6 * 60 * 60_000 },
    cow:     { growMs: 2 * 60 * 60_000, feedEveryMs: 6 * 60 * 60_000, productTime: 6 * 60 * 60_000 },
  };

  const SEASONS = ["spring", "summer", "autumn", "winter"];
  const SEASON_NAME = {
    spring: "Весна",
    summer: "Лето",
    autumn: "Осень",
    winter: "Зима",
  };
  const SEASON_PREP = {
    spring: "весны",
    summer: "лета",
    autumn: "осени",
    winter: "зимы",
  };
  const SEASON_TO = {
    spring: "до лета",
    summer: "до осени",
    autumn: "до зимы",
    winter: "до весны",
  };

  const WEATHER_TABLE = {
    spring: [
      { id: "sun", w: 30, name: "Ясно", temp: 16, growth: 1.15, line: "Грядки греются" },
      { id: "cloudy", w: 25, name: "Облачно", temp: 12, growth: 1, line: "Без осадков" },
      { id: "rain", w: 30, name: "Дождь", temp: 10, growth: 1.5, line: "Рост быстрее" },
      { id: "storm", w: 15, name: "Гроза", temp: 9, growth: 1.2, damage: 0.22, line: "Возможен побитый урожай" },
    ],
    summer: [
      { id: "sun", w: 28, name: "Ясно", temp: 26, growth: 1.15, line: "Тепло и сухо" },
      { id: "heat", w: 25, name: "Жара", temp: 32, growth: 0.5, needsWater: true, line: "Без полива рост слабый" },
      { id: "cloudy", w: 15, name: "Облачно", temp: 22, growth: 1, line: "Без осадков" },
      { id: "rain", w: 22, name: "Дождь", temp: 20, growth: 1.5, line: "Рост быстрее" },
      { id: "storm", w: 10, name: "Град", temp: 18, growth: 0.9, damage: 0.32, line: "Берегите грядки" },
    ],
    autumn: [
      { id: "cloudy", w: 30, name: "Пасмурно", temp: 8, growth: 1, line: "Без осадков" },
      { id: "rain", w: 30, name: "Дождь", temp: 6, growth: 1.4, line: "Рост быстрее" },
      { id: "sun", w: 25, name: "Прояснения", temp: 12, growth: 1.1, line: "Тихо и ясно" },
      { id: "storm", w: 15, name: "Шторм", temp: 5, growth: 1.05, damage: 0.2, line: "Возможен побитый урожай" },
    ],
    winter: [
      { id: "snow", w: 45, name: "Снег", temp: -8, growth: 0, haltOutdoor: true, line: "На улице рост стоит" },
      { id: "cloudy", w: 30, name: "Пасмурно", temp: -4, growth: 0, haltOutdoor: true, line: "Морозно" },
      { id: "sun", w: 20, name: "Мороз", temp: -10, growth: 0, haltOutdoor: true, line: "Крепкий мороз" },
      { id: "storm", w: 5, name: "Метель", temp: -14, growth: 0, haltOutdoor: true, damage: 0.12, line: "Проверьте теплицу" },
    ],
  };

  const CROPS = {
    radish: { id: "radish", name: "Редис", type: "crop", seasons: ["spring"], greenhouse: true, seedCost: 5, sellPrice: 9, growMs: 12_000, xp: 3, unlockLevel: 1, flavor: "Спеет быстро, в теплице растёт и зимой.", feed: 0 },
    dill: { id: "dill", name: "Укроп", type: "crop", seasons: ["spring"], greenhouse: true, seedCost: 6, sellPrice: 11, growMs: 14_000, xp: 3, unlockLevel: 1, flavor: "Пахучая зелень к столу и в теплицу.", feed: 0 },
    peas: { id: "peas", name: "Горох", type: "crop", seasons: ["spring"], greenhouse: false, seedCost: 10, sellPrice: 20, growMs: 22_000, xp: 6, unlockLevel: 1, flavor: "Вьётся по тычинам, из него выходит корм.", feed: 2 },
    garlic: { id: "garlic", name: "Чеснок", type: "crop", seasons: ["spring", "autumn"], greenhouse: false, seedCost: 12, sellPrice: 24, growMs: 25_000, xp: 7, unlockLevel: 2, flavor: "Сажают и весной, и под осень.", feed: 0 },
    tulip: { id: "tulip", name: "Тюльпаны", type: "flower", seasons: ["spring"], greenhouse: false, seedCost: 18, sellPrice: 48, growMs: 20_000, xp: 8, unlockLevel: 1, flavor: "Первые цветы участка, ценятся дорого." },
    narcissus: { id: "narcissus", name: "Нарциссы", type: "flower", seasons: ["spring"], greenhouse: false, seedCost: 20, sellPrice: 54, growMs: 22_000, xp: 9, unlockLevel: 2, flavor: "Белая чашечка к майским праздникам." },

    cucumber: { id: "cucumber", name: "Огурцы", type: "crop", seasons: ["summer"], greenhouse: true, seedCost: 14, sellPrice: 28, growMs: 24_000, xp: 8, unlockLevel: 1, flavor: "На солнце и в теплице дают хороший сбор.", feed: 2 },
    tomato: { id: "tomato", name: "Томаты", type: "crop", seasons: ["summer"], greenhouse: false, seedCost: 16, sellPrice: 32, growMs: 28_000, xp: 10, unlockLevel: 2, flavor: "Наливаются на жарких грядках." },
    zucchini: { id: "zucchini", name: "Кабачки", type: "crop", seasons: ["summer"], greenhouse: false, seedCost: 15, sellPrice: 30, growMs: 26_000, xp: 9, unlockLevel: 2, flavor: "Один куст кормит весь стол. Идёт в корм.", feed: 2 },
    strawberry: { id: "strawberry", name: "Клубника", type: "crop", seasons: ["summer"], greenhouse: false, seedCost: 22, sellPrice: 48, growMs: 30_000, xp: 12, unlockLevel: 3, flavor: "Ягоды к чаю на веранде." },
    cornflower: { id: "cornflower", name: "Васильки", type: "flower", seasons: ["summer"], greenhouse: false, seedCost: 24, sellPrice: 68, growMs: 22_000, xp: 11, unlockLevel: 2, flavor: "Синие головки вдоль дорожки." },
    peony: { id: "peony", name: "Пионы", type: "flower", seasons: ["summer"], greenhouse: false, seedCost: 28, sellPrice: 80, growMs: 28_000, xp: 14, unlockLevel: 3, flavor: "Пышный букет, хорошая цена." },

    potato: { id: "potato", name: "Картошка", type: "crop", seasons: ["autumn"], greenhouse: false, seedCost: 12, sellPrice: 26, growMs: 28_000, xp: 10, unlockLevel: 1, flavor: "Основа запаса. Две штуки — порция корма.", feed: 2 },
    cabbage: { id: "cabbage", name: "Капуста", type: "crop", seasons: ["autumn"], greenhouse: false, seedCost: 14, sellPrice: 30, growMs: 30_000, xp: 11, unlockLevel: 2, flavor: "Крепкий кочан, годится и на корм.", feed: 2 },
    pumpkin: { id: "pumpkin", name: "Тыква", type: "crop", seasons: ["autumn"], greenhouse: false, seedCost: 20, sellPrice: 44, growMs: 36_000, xp: 15, unlockLevel: 3, flavor: "Лежит до зимы и красит грядку." },
    aster: { id: "aster", name: "Астры", type: "flower", seasons: ["autumn"], greenhouse: false, seedCost: 22, sellPrice: 64, growMs: 24_000, xp: 12, unlockLevel: 2, flavor: "Школьный букет с дачной клумбы." },
    gladiolus: { id: "gladiolus", name: "Гладиолусы", type: "flower", seasons: ["autumn"], greenhouse: false, seedCost: 24, sellPrice: 70, growMs: 25_000, xp: 13, unlockLevel: 3, flavor: "Высокий стебель к концу сезона." },
    chrysanthemum: { id: "chrysanthemum", name: "Хризантемы", type: "flower", seasons: ["autumn"], greenhouse: false, seedCost: 26, sellPrice: 76, growMs: 26_000, xp: 14, unlockLevel: 3, flavor: "Последние цветы тёплой осени." },
  };

  const CROP_ORDER = [
    "radish", "dill", "peas", "garlic", "tulip", "narcissus",
    "cucumber", "tomato", "zucchini", "strawberry", "cornflower", "peony",
    "potato", "cabbage", "pumpkin", "aster", "gladiolus", "chrysanthemum",
  ];

  const PRODUCTS = {
    egg: { id: "egg", name: "Яйца", sellPrice: 8 },
    down: { id: "down", name: "Пух", sellPrice: 14 },
    milk: { id: "milk", name: "Молоко", sellPrice: 12 },
    wool: { id: "wool", name: "Шерсть", sellPrice: 18 },
    feed: { id: "feed", name: "Комбикорм", sellPrice: 4 },
    fertilizer: { id: "fertilizer", name: "Удобрение", sellPrice: 0 },
  };

  const FEED_BUY_PRICE = 8;
  const FEED_RECIPES = [
    { cropId: "peas", count: 2 },
    { cropId: "potato", count: 2 },
    { cropId: "cabbage", count: 2 },
    { cropId: "zucchini", count: 2 },
    { cropId: "cucumber", count: 2 },
  ];

  const ANIMALS = {
    chicken: {
      id: "chicken",
      babyName: "Цыплёнок",
      adultName: "Курица",
      unlockLevel: 1,
      buyPrice: 40,
      sellBaby: 16,
      sellAdult: 32,
      growMs: 22_000,
      feedEveryMs: 18_000,
      product: "egg",
      productTime: 14_000,
      productXp: 2,
    },
    rabbit: {
      id: "rabbit",
      babyName: "Крольчонок",
      adultName: "Кролик",
      unlockLevel: 2,
      buyPrice: 70,
      sellBaby: 28,
      sellAdult: 55,
      growMs: 26_000,
      feedEveryMs: 18_000,
      product: "down",
      productTime: 16_000,
      productXp: 3,
    },
    goat: {
      id: "goat",
      babyName: "Козлёнок",
      adultName: "Коза",
      unlockLevel: 3,
      buyPrice: 110,
      sellBaby: 44,
      sellAdult: 85,
      growMs: 30_000,
      feedEveryMs: 20_000,
      product: "milk",
      productTime: 18_000,
      productXp: 4,
    },
    pig: {
      id: "pig",
      babyName: "Поросёнок",
      adultName: "Свинья",
      unlockLevel: 3,
      buyPrice: 120,
      sellBaby: 48,
      sellAdult: 220,
      growMs: 36_000,
      feedEveryMs: 16_000,
      product: null,
      productTime: 0,
      productXp: 0,
    },
    sheep: {
      id: "sheep",
      babyName: "Ягнёнок",
      adultName: "Овца",
      unlockLevel: 4,
      buyPrice: 150,
      sellBaby: 60,
      sellAdult: 110,
      growMs: 32_000,
      feedEveryMs: 20_000,
      product: "wool",
      productTime: 20_000,
      productXp: 5,
    },
    cow: {
      id: "cow",
      babyName: "Телёнок",
      adultName: "Корова",
      unlockLevel: 5,
      buyPrice: 220,
      sellBaby: 80,
      sellAdult: 160,
      growMs: 40_000,
      feedEveryMs: 16_000,
      product: "milk",
      productTime: 16_000,
      productXp: 6,
      productBonus: 1,
    },
  };

  const ANIMAL_ORDER = ["chicken", "rabbit", "goat", "pig", "sheep", "cow"];

  const PLOT_PRICE = [0, 0, 45, 0, 80, 140, 220, 320, 450];
  const START_UNLOCKED = [0, 1, 3];
  const GREENHOUSE_PRICE = [100, 180];
  const PEN_PRICE = [0, 80, 150, 240, 350, 500];
  const MAX_PENS = 6;
  const START_PENS = 1;
  const XP_TABLE = [0, 30, 80, 160, 280, 450, 680, 1000, 1400];
  const WINTER_FEED_FACTOR = 0.65;
  const GH_WINTER_GROWTH = 0.85;
  // Fraction of remaining grow time filled by one bag of «удобрение».
  const FERTILIZER_BOOST = 0.5;

  /* Награды за новый разряд. seedPacks — бесплатные пакетики семян текущего сезона
     (включая только что открытые культуры). decor — подарок-улучшение. */
  const LEVEL_REWARDS = {
    2: { coins: 40, seedPacks: 2, feed: 2 },
    3: { coins: 70, seedPacks: 3, feed: 3, fertilizer: 1 },
    4: { coins: 110, seedPacks: 3, feed: 4, fertilizer: 1 },
    5: { coins: 160, seedPacks: 4, feed: 5, fertilizer: 2, freePlot: true },
    6: { coins: 220, seedPacks: 4, feed: 6, fertilizer: 2, decor: "birdhouse" },
    7: { coins: 280, seedPacks: 5, feed: 8, fertilizer: 3, freePen: true },
    8: { coins: 360, seedPacks: 5, feed: 8, fertilizer: 3, decor: "bench" },
    9: { coins: 500, seedPacks: 6, feed: 10, fertilizer: 4, decor: "antenna", freePlot: true },
  };

  const DECOR_NAME = {
    birdhouse: "Скворечник",
    bench: "Скамейка",
    antenna: "Антенна",
    apple: "Яблоня",
  };

  /* Улучшения участка: level-цепочки (0 — старт) и отдельные постройки. */
  const UPGRADES = {
    house: {
      id: "house",
      name: "Дом",
      type: "levels",
      levels: [
        { name: "Бытовка", price: 0, unlockLevel: 1 },
        { name: "Деревянный домик", price: 80, unlockLevel: 1, flavor: "Тёплые стены и крылечко." },
        { name: "Дом с мансардой", price: 220, unlockLevel: 3, flavor: "Появится этаж под крышей." },
        { name: "Кирпичный дом", price: 500, unlockLevel: 5, flavor: "Капитальный дом на зависть соседям." },
      ],
    },
    fence: {
      id: "fence",
      name: "Забор",
      type: "levels",
      levels: [
        { name: "Сетка-рабица", price: 0, unlockLevel: 1 },
        { name: "Штакетник", price: 50, unlockLevel: 1, flavor: "Деревянные штакетины по меже." },
        { name: "Крашеный забор", price: 140, unlockLevel: 2, flavor: "Зелёная краска, как у всех на улице." },
      ],
    },
    transport: {
      id: "transport",
      name: "Транспорт",
      type: "levels",
      levels: [
        { name: "Велосипед", price: 0, unlockLevel: 1 },
        { name: "Мопед", price: 90, unlockLevel: 2, flavor: "До сельпо — за пять минут." },
        { name: "Седан", price: 300, unlockLevel: 4, flavor: "Свой седан у калитки, без чужих шильдиков." },
      ],
    },
    sarai: {
      id: "sarai",
      name: "Сарай",
      type: "levels",
      levels: [
        { name: "Сарайчик", price: 0, unlockLevel: 1, bonus: { storage: 30 } },
        { name: "Сарай с навесом", price: 80, unlockLevel: 2, bonus: { storage: 50 }, flavor: "Больше места под урожай." },
        { name: "Просторный сарай", price: 200, unlockLevel: 4, bonus: { storage: 90 }, flavor: "Запасы больше не теснятся." },
      ],
    },
    well: {
      id: "well",
      name: "Колодец",
      type: "toggle",
      price: 120,
      unlockLevel: 2,
      bonus: { autoWater: true },
      flavor: "В жару грядки поливаются сами.",
    },
    bathhouse: {
      id: "bathhouse",
      name: "Баня",
      type: "toggle",
      price: 180,
      unlockLevel: 3,
      bonus: { harvestXp: 1 },
      flavor: "После баньки работа спорится: +1 опыт за сбор.",
    },
    apple: {
      id: "apple",
      name: "Яблоня",
      type: "toggle",
      price: 45,
      unlockLevel: 1,
      flavor: "Тень у дома и белый цвет весной.",
    },
    bench: {
      id: "bench",
      name: "Скамейка",
      type: "toggle",
      price: 30,
      unlockLevel: 1,
      flavor: "Посидеть у калитки вечером.",
    },
    antenna: {
      id: "antenna",
      name: "Телевизионная антенна",
      type: "toggle",
      price: 70,
      unlockLevel: 2,
      flavor: "На крыше — чтобы программу ловило.",
    },
    birdhouse: {
      id: "birdhouse",
      name: "Скворечник",
      type: "toggle",
      price: 20,
      unlockLevel: 1,
      flavor: "Для скворцов на яблоне или у дома.",
    },
  };

  const UPGRADE_ORDER = [
    "house", "fence", "transport", "sarai",
    "well", "bathhouse", "apple", "bench", "antenna", "birdhouse",
  ];

  const FARMER_TIPS = {
    heat: "Ну и жара. Без лейки грядки завянут.",
    rain: "Дождичек — самое то. Пусть наливается.",
    storm: "Прячьтесь и глядите за посадками: сегодня может побить.",
    snow: "На улице делу конец. Кто не в теплице — тот отдыхает.",
    ready: "Урожай просится в сарай. Не передержите.",
    hungry: "Животные смотрят голодными глазами. Загляните во двор.",
    season: "Сезон на исходе. Соберите, что не переживёт смену.",
    storage: "Сарай трещит по швам. Сдайте лишнее или расширьте его.",
    winter: "Валенки сухие, ватник застегнут. Главное — колодец не заморозить.",
    default: [
      "Шесть соток — и целый мир, сосед.",
      "Тише едешь — урожайнее будешь.",
      "После работы хорошо на скамейке посидеть.",
      "Не откладывайте на осень то, что поспело сегодня.",
      "Порядок на участке — порядок в голове.",
    ],
  };

  function isFastMode() {
    try {
      const loc = (typeof location !== "undefined" && location)
        || (typeof window !== "undefined" && window.location);
      if (!loc || loc.search == null) return false;
      const q = String(loc.search);
      if (/(?:^|[?&])fast=1(?:&|$)/.test(q)) return true;
      if (/(?:^|[?&])fast=0(?:&|$)/.test(q)) return false;
    } catch { /* not in a browser */ }
    return false;
  }

  function snapshotFastTimes() {
    for (const id of CROP_ORDER) {
      if (CROPS[id].growMsFast == null) CROPS[id].growMsFast = CROPS[id].growMs;
    }
    for (const id of ANIMAL_ORDER) {
      const a = ANIMALS[id];
      if (a.growMsFast == null) {
        a.growMsFast = a.growMs;
        a.feedEveryMsFast = a.feedEveryMs;
        a.productTimeFast = a.productTime;
      }
    }
  }

  function applyTiming(fast) {
    snapshotFastTimes();
    const days = TIMING.DAYS_PER_SEASON;
    TIMING.fast = !!fast;
    TIMING.DAY_MS = fast
      ? TIMING.FAST_DAY_MS
      : Math.floor(TIMING.SEASON_REAL_DAYS * 24 * 60 * 60 * 1000 / days);
    for (const id of CROP_ORDER) {
      CROPS[id].growMs = fast
        ? CROPS[id].growMsFast
        : (PLAY_CROP_GROW_MS[id] || CROPS[id].growMsFast);
    }
    for (const id of ANIMAL_ORDER) {
      const a = ANIMALS[id];
      const play = PLAY_ANIMAL_TIMES[id] || {};
      a.growMs = fast ? a.growMsFast : (play.growMs || a.growMsFast);
      a.feedEveryMs = fast ? a.feedEveryMsFast : (play.feedEveryMs || a.feedEveryMsFast);
      a.productTime = fast ? a.productTimeFast : (play.productTime != null ? play.productTime : a.productTimeFast);
    }
    return { DAY_MS: TIMING.DAY_MS, DAYS_PER_SEASON: days, fast: TIMING.fast };
  }

  // Apply as soon as the script loads so game.js sees the right growMs.
  applyTiming(isFastMode());

  function defaultUpgrades() {
    return {
      house: 0,
      fence: 0,
      transport: 0,
      sarai: 0,
      well: false,
      bathhouse: false,
      apple: false,
      bench: false,
      antenna: false,
      birdhouse: false,
    };
  }

  return {
    ASSET_VER, TIMING, SEASONS, SEASON_NAME, SEASON_PREP, SEASON_TO, WEATHER_TABLE,
    CROPS, CROP_ORDER, PRODUCTS, FEED_BUY_PRICE, FEED_RECIPES,
    ANIMALS, ANIMAL_ORDER, PLOT_PRICE, START_UNLOCKED, GREENHOUSE_PRICE,
    PEN_PRICE, MAX_PENS, START_PENS, XP_TABLE, WINTER_FEED_FACTOR, GH_WINTER_GROWTH,
    FERTILIZER_BOOST, LEVEL_REWARDS, DECOR_NAME, PLAY_CROP_GROW_MS, PLAY_ANIMAL_TIMES,
    UPGRADES, UPGRADE_ORDER, FARMER_TIPS, defaultUpgrades,
    isFastMode, applyTiming, GIFT,
  };
})();
