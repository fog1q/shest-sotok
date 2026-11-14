/* global window */
window.SOTOK_DATA = (() => {
  "use strict";

  const ASSET_VER = "20261114c";

  /* One-time owner gift: only the SHA-256 of the secret code is stored here. */
  const GIFT = {
    id: "premiya-1",
    coins: 1_000_000,
    hash: "470acd16bbb80c46be2244974ada1be8c065dc40239fa385a758426e711f71a6",
  };

  const TIMING = {
    // Live play: one season lasts this many real-world hours (12 in-game days).
    SEASON_REAL_HOURS: 2,
    DAYS_PER_SEASON: 12,
    FAST_DAY_MS: 15_000,
    // Pre-v4 saves used 15-second days; used only to rebase the calendar.
    LEGACY_DAY_MS: 15_000,
    // v4 play used 6-hour days (3 real days per season).
    LEGACY_V4_PLAY_DAY_MS: 6 * 60 * 60 * 1000,
    DAY_MS: 15_000,
    fast: false,
  };

  const LEGACY_V4_PLAY_CROP_GROW_MS = {
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

  // v5 play: first crops ~30s, the long pumpkin ~30 min.
  const PLAY_CROP_GROW_MS = {
    radish: 30_000,
    dill: 40_000,
    peas: 70_000,
    garlic: 90_000,
    tulip: 60_000,
    narcissus: 75_000,
    cucumber: 2 * 60_000,
    tomato: 3 * 60_000,
    zucchini: 150_000,
    strawberry: 4 * 60_000,
    cornflower: 2 * 60_000,
    peony: 5 * 60_000,
    potato: 5 * 60_000,
    cabbage: 6 * 60_000,
    pumpkin: 30 * 60_000,
    aster: 3 * 60_000,
    gladiolus: 4 * 60_000,
    chrysanthemum: 5 * 60_000,
  };

  const LEGACY_V4_PLAY_ANIMAL_TIMES = {
    chicken: { growMs: 40 * 60_000, feedEveryMs: 3 * 60 * 60_000, productTime: 2 * 60 * 60_000 },
    rabbit:  { growMs: 50 * 60_000, feedEveryMs: 4 * 60 * 60_000, productTime: 3 * 60 * 60_000 },
    goat:    { growMs: 70 * 60_000, feedEveryMs: 5 * 60 * 60_000, productTime: 4 * 60 * 60_000 },
    pig:     { growMs: 90 * 60_000, feedEveryMs: 5 * 60 * 60_000, productTime: 0 },
    sheep:   { growMs: 80 * 60_000, feedEveryMs: 5 * 60 * 60_000, productTime: 6 * 60 * 60_000 },
    cow:     { growMs: 2 * 60 * 60_000, feedEveryMs: 6 * 60 * 60_000, productTime: 6 * 60 * 60_000 },
  };

  // v5 play: products in 1–10 minutes, feed and growth stay proportional.
  const PLAY_ANIMAL_TIMES = {
    chicken: { growMs: 2 * 60_000, feedEveryMs: 8 * 60_000, productTime: 1 * 60_000 },
    rabbit:  { growMs: 3 * 60_000, feedEveryMs: 10 * 60_000, productTime: 3 * 60_000 },
    goat:    { growMs: 5 * 60_000, feedEveryMs: 12 * 60_000, productTime: 6 * 60_000 },
    pig:     { growMs: 6 * 60_000, feedEveryMs: 12 * 60_000, productTime: 0 },
    sheep:   { growMs: 5 * 60_000, feedEveryMs: 12 * 60_000, productTime: 8 * 60_000 },
    cow:     { growMs: 8 * 60_000, feedEveryMs: 15 * 60_000, productTime: 10 * 60_000 },
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
    dust: { id: "dust", name: "Дуст", sellPrice: 0, buyPrice: 12, tool: true },
    ash: { id: "ash", name: "Зола", sellPrice: 0, buyPrice: 8, tool: true },
    jam: { id: "jam", name: "Варенье", sellPrice: 90, craft: true },
    smetana: { id: "smetana", name: "Сметана", sellPrice: 40, craft: true },
    tvorog: { id: "tvorog", name: "Творог", sellPrice: 55, craft: true },
    pickles: { id: "pickles", name: "Соленья", sellPrice: 78, craft: true },
    sauerkraut: { id: "sauerkraut", name: "Квашеная капуста", sellPrice: 72, craft: true },
    socks: { id: "socks", name: "Шерстяные носки", sellPrice: 60, craft: true },
  };

  const TOOL_IDS = ["fertilizer", "dust", "ash"];
  const CRAFT_IDS = ["jam", "smetana", "tvorog", "pickles", "sauerkraut", "socks"];

  const WATER_BONUS = 1.25;
  const WEED_PENALTY = 0.7;
  const PEST_YIELD = 0.5;

  const CARE = {
    thirstAfterMs: 90_000,
    thirstAfterMsFast: 4_000,
    waterLastsMs: 180_000,
    waterLastsMsFast: 10_000,
    weedAfterMs: 100_000,
    weedAfterMsFast: 5_000,
    pestAfterMs: 140_000,
    pestAfterMsFast: 6_000,
  };

  const PESTS = {
    beetle: { id: "beetle", name: "Колорадский жук", icon: "pests/beetle", remedy: "dust" },
    aphid: { id: "aphid", name: "Тля", icon: "pests/aphid", remedy: "ash" },
    slug: { id: "slug", name: "Слизень", icon: "pests/slug", remedy: "ash" },
  };
  const PEST_ORDER = ["beetle", "aphid", "slug"];

  const STATIONS = {
    stove: { id: "stove", name: "Плита", upgrade: "kitchen", icon: "buildings/stove" },
    barrel: { id: "barrel", name: "Бочка", upgrade: "cellar", icon: "buildings/barrel" },
    separator: { id: "separator", name: "Сепаратор", upgrade: "separator", icon: "buildings/separator" },
    spinner: { id: "spinner", name: "Прялка", upgrade: "spinner", icon: "buildings/spinner" },
  };

  const RECIPES = {
    jam: { id: "jam", name: "Варенье", station: "stove", inputs: { strawberry: 2 }, timeMs: 40_000, timeMsFast: 6_000, output: "jam", outputCount: 1, xp: 8, unlockLevel: 2 },
    smetana: { id: "smetana", name: "Сметана", station: "separator", inputs: { milk: 2 }, timeMs: 50_000, timeMsFast: 7_000, output: "smetana", outputCount: 1, xp: 6, unlockLevel: 3 },
    tvorog: { id: "tvorog", name: "Творог", station: "separator", inputs: { milk: 3 }, timeMs: 70_000, timeMsFast: 8_000, output: "tvorog", outputCount: 1, xp: 8, unlockLevel: 3 },
    pickles: { id: "pickles", name: "Соленья", station: "barrel", inputs: { cucumber: 3 }, timeMs: 80_000, timeMsFast: 8_000, output: "pickles", outputCount: 1, xp: 8, unlockLevel: 2 },
    sauerkraut: { id: "sauerkraut", name: "Квашеная капуста", station: "barrel", inputs: { cabbage: 2 }, timeMs: 80_000, timeMsFast: 8_000, output: "sauerkraut", outputCount: 1, xp: 8, unlockLevel: 2 },
    socks: { id: "socks", name: "Носки", station: "spinner", inputs: { wool: 2 }, timeMs: 90_000, timeMsFast: 8_000, output: "socks", outputCount: 1, xp: 10, unlockLevel: 4 },
  };
  const RECIPE_ORDER = ["jam", "smetana", "tvorog", "pickles", "sauerkraut", "socks"];

  const QUEST_TEMPLATES = [
    { type: "harvest", crop: "radish", count: 2, coins: 16, xp: 6, title: "Редис к столу", text: "Соберите 2 редиса" },
    { type: "harvest", crop: "dill", count: 2, coins: 18, xp: 6, title: "Укроп на суп", text: "Соберите 2 пучка укропа" },
    { type: "harvest", crop: "cucumber", count: 2, coins: 24, xp: 8, title: "Огурцы председателю", text: "Соберите 2 огурца" },
    { type: "harvest", crop: "potato", count: 3, coins: 28, xp: 10, title: "Картошка в закрома", text: "Соберите 3 картошки" },
    { type: "harvest", crop: "strawberry", count: 2, coins: 32, xp: 10, title: "Ягоды к чаю", text: "Соберите 2 клубники" },
    { type: "collect", item: "egg", count: 3, coins: 20, xp: 8, title: "Яиц в лукошко", text: "Соберите 3 яйца" },
    { type: "collect", item: "milk", count: 2, coins: 24, xp: 8, title: "Молоко с двора", text: "Соберите 2 молока" },
    { type: "collect", item: "wool", count: 1, coins: 22, xp: 8, title: "Шерсть на носки", text: "Соберите шерсть" },
    { type: "sell", item: "radish", count: 2, coins: 14, xp: 5, title: "Сдать редис в сельпо", text: "Продайте 2 редиса" },
    { type: "sell", item: "egg", count: 2, coins: 16, xp: 5, title: "Яйца в сельпо", text: "Продайте 2 яйца" },
    { type: "craft", recipe: "jam", count: 1, coins: 36, xp: 12, title: "Банка варенья", text: "Сварите варенье" },
    { type: "craft", recipe: "pickles", count: 1, coins: 32, xp: 10, title: "Бочка солений", text: "Засолите огурцы" },
    { type: "water", count: 3, coins: 12, xp: 5, title: "Полить грядки", text: "Полейте 3 грядки" },
    { type: "weed", count: 2, coins: 14, xp: 6, title: "Прополоть", text: "Выдерните сорняки на 2 грядках" },
    { type: "pest", count: 1, coins: 16, xp: 6, title: "Прогнать вредителей", text: "Избавьтесь от вредителей на грядке" },
  ];

  const TUTORIAL = [
    { id: "plant-radish", type: "plant", crop: "radish", count: 1, coins: 0, xp: 2, title: "Первая посадка", text: "Посадите редис на грядке" },
    { id: "harvest-radish", type: "harvest", crop: "radish", count: 1, coins: 0, xp: 2, title: "Первый сбор", text: "Соберите поспевший редис" },
    { id: "sell-radish", type: "sell", item: "radish", count: 1, coins: 8, xp: 2, title: "В сельпо", text: "Продайте редис в сельпо" },
    { id: "water-once", type: "water", count: 1, coins: 6, xp: 2, title: "Лейка в руки", text: "Полейте любую грядку" },
  ];

  const QUEST_REFRESH_MS = 20 * 60_000;
  const QUEST_REFRESH_MS_FAST = 25_000;
  const MAX_ACTIVE_QUESTS = 3;

  const NEIGHBORS = {
    nyura: { id: "nyura", name: "Баба Нюра", portrait: "npc/nyura", wants: ["jam", "strawberry", "tulip", "peony", "narcissus"] },
    kolya: { id: "kolya", name: "Дядя Коля", portrait: "npc/kolya", wants: ["potato", "pickles", "milk", "egg", "cabbage"] },
    tanka: { id: "tanka", name: "Танька из сельпо", portrait: "npc/tanka", wants: ["tulip", "aster", "egg", "smetana", "cornflower"] },
  };
  const NEIGHBOR_ORDER = ["nyura", "kolya", "tanka"];
  const ORDER_TTL_MS = 15 * 60_000;
  const ORDER_TTL_MS_FAST = 20_000;
  const ORDER_GAP_MS = 8 * 60_000;
  const ORDER_GAP_MS_FAST = 12_000;
  const MAX_ORDERS = 2;

  const DAILY_BONUS = [
    { day: 1, coins: 20 },
    { day: 2, coins: 30 },
    { day: 3, coins: 45, items: { feed: 1 } },
    { day: 4, coins: 60 },
    { day: 5, coins: 80, items: { ash: 1 } },
    { day: 6, coins: 120, items: { dust: 1 } },
    { day: 7, coins: 300, items: { fertilizer: 1, feed: 2 } },
  ];

  const FAIR = {
    minMult: 0.8,
    maxMult: 2.0,
    specialChance: 0.12,
    specialMult: 2.2,
  };

  const PROCESS_QUEUE = 2;

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
    kitchen: {
      id: "kitchen",
      name: "Летняя кухня",
      type: "toggle",
      price: 100,
      unlockLevel: 2,
      bonus: { station: "stove" },
      flavor: "Плита для варенья на летней кухне.",
    },
    cellar: {
      id: "cellar",
      name: "Погреб",
      type: "toggle",
      price: 90,
      unlockLevel: 2,
      bonus: { station: "barrel" },
      flavor: "Бочка для солений и капусты.",
    },
    separator: {
      id: "separator",
      name: "Сепаратор",
      type: "toggle",
      price: 140,
      unlockLevel: 3,
      bonus: { station: "separator" },
      flavor: "Из молока — сметана и творог.",
    },
    spinner: {
      id: "spinner",
      name: "Прялка",
      type: "toggle",
      price: 160,
      unlockLevel: 4,
      bonus: { station: "spinner" },
      flavor: "Из шерсти вяжутся носки.",
    },
  };

  const UPGRADE_ORDER = [
    "house", "fence", "transport", "sarai",
    "well", "bathhouse", "apple", "bench", "antenna", "birdhouse",
    "kitchen", "cellar", "separator", "spinner",
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
      : Math.floor(TIMING.SEASON_REAL_HOURS * 60 * 60 * 1000 / days);
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
      kitchen: false,
      cellar: false,
      separator: false,
      spinner: false,
    };
  }

  return {
    ASSET_VER, TIMING, SEASONS, SEASON_NAME, SEASON_PREP, SEASON_TO, WEATHER_TABLE,
    CROPS, CROP_ORDER, PRODUCTS, FEED_BUY_PRICE, FEED_RECIPES, TOOL_IDS, CRAFT_IDS,
    ANIMALS, ANIMAL_ORDER, PLOT_PRICE, START_UNLOCKED, GREENHOUSE_PRICE,
    PEN_PRICE, MAX_PENS, START_PENS, XP_TABLE, WINTER_FEED_FACTOR, GH_WINTER_GROWTH,
    FERTILIZER_BOOST, WATER_BONUS, WEED_PENALTY, PEST_YIELD, CARE, PESTS, PEST_ORDER,
    LEVEL_REWARDS, DECOR_NAME, PLAY_CROP_GROW_MS, PLAY_ANIMAL_TIMES,
    LEGACY_V4_PLAY_CROP_GROW_MS, LEGACY_V4_PLAY_ANIMAL_TIMES,
    STATIONS, RECIPES, RECIPE_ORDER, QUEST_TEMPLATES, TUTORIAL,
    QUEST_REFRESH_MS, QUEST_REFRESH_MS_FAST, MAX_ACTIVE_QUESTS,
    NEIGHBORS, NEIGHBOR_ORDER, ORDER_TTL_MS, ORDER_TTL_MS_FAST, ORDER_GAP_MS, ORDER_GAP_MS_FAST, MAX_ORDERS,
    DAILY_BONUS, FAIR, PROCESS_QUEUE,
    UPGRADES, UPGRADE_ORDER, FARMER_TIPS, defaultUpgrades,
    isFastMode, applyTiming, GIFT,
  };
})();
