/* 金幣、積分段位、世界排行、每日任務、簽到、商店：資料都存在這支手機 */
(function (root) {
  const KEY = 'jk_prog';
  const START_RP = 800;

  /* ---------- 段位 ---------- */
  const TIERS = [
    { name: '青銅', min: 0, color: '#C98B5B' },
    { name: '白銀', min: 1000, color: '#9AA6B8' },
    { name: '黃金', min: 1300, color: '#E3AE2B' },
    { name: '白金', min: 1600, color: '#4CB8B0' },
    { name: '鑽石', min: 1900, color: '#5B8DEF' },
    { name: '大師', min: 2200, color: '#A15BE6' },
    { name: '宗師', min: 2600, color: '#E3456A' },
  ];
  function tierOf(rp) {
    let i = 0;
    while (i + 1 < TIERS.length && rp >= TIERS[i + 1].min) i++;
    const t = TIERS[i], next = TIERS[i + 1];
    return { i, name: t.name, color: t.color, min: t.min, next: next ? next.min : null, nextName: next ? next.name : null,
      pct: next ? Math.min(1, (rp - t.min) / (next.min - t.min)) : 1 };
  }

  /* ---------- 獎勵表 ---------- */
  const COINS = { 2: [40, 10], 3: [45, 20, 5], 4: [50, 25, 10, 5] };
  const RP = { 2: [24, -16], 3: [28, 2, -18], 4: [30, 10, -8, -20] };
  const streakMult = s => (s <= 1 ? 1 : Math.min(3, 1 + 0.5 * (s - 1)));

  /* ---------- 商店 ---------- */
  const SHOP = [
    { id: 'av_pup', cat: 'avatar', name: '熱血少年', price: 0, kind: 'pup' },
    { id: 'av_frog', cat: 'avatar', name: '元氣少女', price: 0, kind: 'frog' },
    { id: 'av_chick', cat: 'avatar', name: '眼鏡學霸', price: 0, kind: 'chick' },
    { id: 'av_panda', cat: 'avatar', name: '雙色偶像', price: 400, kind: 'panda' },
    { id: 'av_fox', cat: 'avatar', name: '狐耳巫女', price: 700, kind: 'fox' },
    { id: 'av_penguin', cat: 'avatar', name: '冰之王子', price: 1000, kind: 'penguin' },
    { id: 'av_tiger', cat: 'avatar', name: '龍角戰士', price: 2000, kind: 'tiger' },
    { id: 'tb_mint', cat: 'table', name: '薄荷牌桌', price: 0, theme: 'mint' },
    { id: 'tb_sakura', cat: 'table', name: '櫻花牌桌', price: 300, theme: 'sakura' },
    { id: 'tb_milktea', cat: 'table', name: '奶茶牌桌', price: 600, theme: 'milktea' },
    { id: 'tb_night', cat: 'table', name: '星空牌桌', price: 1500, theme: 'night' },
    { id: 'em_basic', cat: 'emo', name: '基本嘴砲', price: 0, lines: ['快點啦', '好牌！', '你完了', '等等我', '哈哈哈', '手氣好爛'] },
    { id: 'em_taiwan', cat: 'emo', name: '台味嘴砲', price: 300, lines: ['夭壽骨', '衝啥啦', '穩了穩了', '歹勢啦', '母湯喔', '你很會喔'] },
    { id: 'em_trash', cat: 'emo', name: '嗆聲嘴砲', price: 800, lines: ['就這？', '認輸吧', '我在等你喔', '這把我贏定', '看我的！', '太慢了啦'] },
    { id: 'fx_bubble', cat: 'fx', name: '漫畫對話框', price: 0, desc: '從頭像彈出大對話框' },
    { id: 'fx_danmaku', cat: 'fx', name: '彈幕刷屏', price: 300, desc: '整排字從畫面飛過' },
    { id: 'fx_hearts', cat: 'fx', name: '愛心泡泡', price: 400, desc: '愛心一顆顆往上飄' },
    { id: 'fx_boom', cat: 'fx', name: '爆炸字', price: 600, desc: '集中線＋爆炸字＋震動' },
    { id: 'fx_cutin', cat: 'fx', name: '動漫登場', price: 900, desc: '大頭像斜切登場' },
    { id: 'fx_neon', cat: 'fx', name: '霓虹燈', price: 1200, desc: '夜店霓虹閃爍字' },
    { id: 'fx_gold', cat: 'fx', name: '黃金降臨', price: 2500, desc: '金字＋金幣雨' },
    // 丟道具：點別人的頭像丟過去
    { id: 'th_tomato', cat: 'throw', name: '番茄', price: 0, icon: '🍅', desc: '啪！滿臉番茄醬' },
    { id: 'th_rose', cat: 'throw', name: '玫瑰', price: 0, icon: '🌹', desc: '送你一朵花' },
    { id: 'th_egg', cat: 'throw', name: '雞蛋', price: 200, icon: '🥚', desc: '蛋黃流下來' },
    { id: 'th_heart', cat: 'throw', name: '愛心', price: 300, icon: '💖', desc: '愛心爆開' },
    { id: 'th_slipper', cat: 'throw', name: '藍白拖', price: 400, icon: '🩴', desc: '啪一聲打下去' },
    { id: 'th_water', cat: 'throw', name: '潑水', price: 500, icon: '💦', desc: '冷靜一下' },
    { id: 'th_beer', cat: 'throw', name: '乾杯', price: 600, icon: '🍺', desc: '敬你一杯' },
    { id: 'th_bomb', cat: 'throw', name: '炸彈', price: 900, icon: '💣', desc: '轟！畫面震動' },
  ];
  /* ---------- 寶箱限定（商店買不到，只能開寶箱或用碎片換） ---------- */
  const RAR = { r: { name: '稀有', frag: 15, dup: 3 }, e: { name: '史詩', frag: 40, dup: 8 }, l: { name: '傳說', frag: 100, dup: 20 } };
  const CHEST_ITEMS = [
    { id: 'bk_classic', cat: 'back', name: '經典粉點', price: 0, look: 'classic' },
    { id: 'bk_navy', cat: 'back', name: '深藍格紋', rar: 'r', look: 'navy' },
    { id: 'bk_sakura', cat: 'back', name: '櫻花牌背', rar: 'r', look: 'sakura' },
    { id: 'bk_star', cat: 'back', name: '星空牌背', rar: 'e', look: 'star' },
    { id: 'bk_gold', cat: 'back', name: '黃金龍紋', rar: 'l', look: 'gold' },
    { id: 'fr_none', cat: 'frame', name: '沒有框', price: 0, look: 'none' },
    { id: 'fr_silver', cat: 'frame', name: '銀色框', rar: 'r', look: 'silver' },
    { id: 'fr_sakura', cat: 'frame', name: '櫻花框', rar: 'r', look: 'sakura' },
    { id: 'fr_fire', cat: 'frame', name: '火焰框', rar: 'e', look: 'fire' },
    { id: 'fr_neon', cat: 'frame', name: '霓虹框', rar: 'e', look: 'neon' },
    { id: 'fr_rainbow', cat: 'frame', name: '彩虹流光框', rar: 'l', look: 'rainbow' },
    { id: 'tt_none', cat: 'title', name: '不戴稱號', price: 0, text: '' },
    { id: 'tt_newbie', cat: 'title', name: '快樂牌友', rar: 'r', text: '快樂牌友' },
    { id: 'tt_night', cat: 'title', name: '夜貓子', rar: 'r', text: '夜貓子' },
    { id: 'tt_mouth', cat: 'title', name: '嘴砲王', rar: 'r', text: '嘴砲王' },
    { id: 'tt_bomb', cat: 'title', name: '炸彈魔', rar: 'e', text: '炸彈魔' },
    { id: 'tt_seven', cat: 'title', name: '排七大師', rar: 'e', text: '排七大師' },
    { id: 'tt_tsumo', cat: 'title', name: '自摸王', rar: 'e', text: '自摸王' },
    { id: 'tt_god', cat: 'title', name: '雀神', rar: 'l', text: '雀神' },
    { id: 'tt_king', cat: 'title', name: '牌桌之王', rar: 'l', text: '牌桌之王' },
    { id: 'ti_classic', cat: 'tiles', name: '經典麻將', price: 0, look: 'classic' },
    { id: 'ti_pink', cat: 'tiles', name: '粉嫩麻將', rar: 'r', look: 'pink' },
    { id: 'ti_jade', cat: 'tiles', name: '翡翠麻將', rar: 'e', look: 'jade' },
    { id: 'ti_black', cat: 'tiles', name: '黑金麻將', rar: 'l', look: 'black' },
  ];
  CHEST_ITEMS.forEach(x => { if (x.rar) { x.chest = true; x.frag = RAR[x.rar].frag; } SHOP.push(x); });
  // 寶箱：每種寶箱開出各稀有度的機率（%）。普通 = 金幣
  const CHESTS = {
    c: { name: '普通寶箱', price: 300, odds: { c: 60, r: 28, e: 10, l: 2 } },
    r: { name: '稀有寶箱', price: 900, odds: { c: 0, r: 70, e: 24, l: 6 } },
    e: { name: '史詩寶箱', price: null, odds: { c: 0, r: 0, e: 80, l: 20 } },
  };
  const PITY = 10; // 連開 10 個沒出史詩以上，第 10 個保底史詩
  const item = id => SHOP.find(x => x.id === id);

  /* ---------- 每日 ---------- */
  const CHECKIN = [50, 60, 80, 100, 120, 150, 300];
  // 難度 d：1 簡單 50、2 普通 100、3 困難 200；每天各抽一個
  const TASK_REWARD = { 1: 50, 2: 100, 3: 200 };
  const TASKS = [
    { id: 'play3', d: 1, text: '玩 3 局（任何遊戲）', goal: 3 },
    { id: 'online1', d: 1, text: '跟朋友連線玩 1 局', goal: 1 },
    { id: 'bkplay', d: 1, text: '玩 1 局 Blokus', goal: 1 },
    { id: 'rmplay', d: 1, text: '玩 1 局拉密', goal: 1 },
    { id: 'dcplay', d: 1, text: '玩 1 局吹牛骰子', goal: 1 },
    { id: 'dcwin', d: 2, text: '吹牛骰子拿第一名', goal: 1 },
    { id: 'ccplay', d: 1, text: '玩 1 局暗棋', goal: 1 },
    { id: 'prplay', d: 1, text: '玩 1 局撿紅點', goal: 1 },
    { id: 'ccwin', d: 2, text: '暗棋贏 1 局', goal: 1 },
    { id: 'prwin', d: 2, text: '撿紅點拿第一名', goal: 1 },
    { id: 'mjplay', d: 2, text: '打完 1 將麻將', goal: 1 },
    { id: 'win1', d: 2, text: '拿下 1 次第一名', goal: 1 },
    { id: 'big2win', d: 2, text: '大老二拿第一名', goal: 1 },
    { id: 'sevenlow', d: 2, text: '排七蓋牌 10 點以下', goal: 1 },
    { id: 'mjhu', d: 2, text: '麻將胡 2 把', goal: 2 },
    { id: 'bkwin', d: 2, text: 'Blokus 拿第一名', goal: 1 },
    { id: 'rm4', d: 2, text: '拉密一回合出 4 張以上', goal: 1 },
    { id: 'big2bomb', d: 3, text: '大老二打出 1 次炸彈', goal: 1 },
    { id: 'mjtsumo', d: 3, text: '麻將自摸 1 次', goal: 1 },
    { id: 'mjtai', d: 3, text: '麻將胡一把 3 台以上', goal: 1 },
    { id: 'streak2', d: 3, text: '連勝 2 場', goal: 1 },
    { id: 'bkall', d: 3, text: 'Blokus 21 塊全部放完', goal: 1 },
    { id: 'rmwin', d: 3, text: '拉密拿第一名', goal: 1 },
  ];
  TASKS.forEach(t => { t.reward = TASK_REWARD[t.d]; });
  const taskDef = id => TASKS.find(t => t.id === id);

  /* ---------- 成就（一次性，解鎖就送金幣） ---------- */
  const ACH = [
    { id: 'g1', name: '初登場', desc: '玩完第 1 局', cat: 'play', goal: 1, reward: 50, val: S => S.games },
    { id: 'g10', name: '十局小將', desc: '累積玩 10 局', cat: 'play', goal: 10, reward: 100, val: S => S.games },
    { id: 'g100', name: '百戰老將', desc: '累積玩 100 局', cat: 'play', goal: 100, reward: 500, val: S => S.games },
    { id: 'g1000', name: '千局傳說', desc: '累積玩 1000 局', cat: 'play', goal: 1000, reward: 2000, val: S => S.games },
    { id: 'w1', name: '首勝', desc: '第一次拿第一名', cat: 'win', goal: 1, reward: 50, val: S => S.wins },
    { id: 'w50', name: '常勝軍', desc: '累積拿 50 次第一', cat: 'win', goal: 50, reward: 500, val: S => S.wins },
    { id: 's3', name: '手感發燙', desc: '連勝 3 場', cat: 'win', goal: 3, reward: 100, val: S => S.best },
    { id: 's5', name: '勢不可擋', desc: '連勝 5 場', cat: 'win', goal: 5, reward: 300, val: S => S.best },
    { id: 's10', name: '十連霸', desc: '連勝 10 場', cat: 'win', goal: 10, reward: 1000, val: S => S.best },
    { id: 'all3', name: '全能雀神', desc: '三種遊戲都拿過第一', cat: 'win', goal: 3, reward: 300, val: S => ['big2', 'seven', 'mj'].filter(g => S.st.byGame[g].w > 0).length },
    { id: 'bomb10', name: '炸彈客', desc: '大老二打出 10 次炸彈', cat: 'big2', goal: 10, reward: 200, val: S => S.st.bombs },
    { id: 'clean', name: '完美排七', desc: '排七一張都沒蓋', cat: 'seven', goal: 1, reward: 200, val: S => S.st.sevenClean },
    { id: 'hu1', name: '開胡', desc: '麻將胡第 1 把', cat: 'mj', goal: 1, reward: 50, val: S => S.st.mjHu },
    { id: 'ts10', name: '自摸達人', desc: '麻將自摸 10 次', cat: 'mj', goal: 10, reward: 300, val: S => S.st.mjTsumo },
    { id: 'tai8', name: '大牌胡', desc: '麻將胡一把 8 台以上', cat: 'mj', goal: 8, reward: 300, val: S => S.st.mjMaxTai },
    { id: 'gold', name: '黃金之路', desc: '升上黃金段位', cat: 'rank', goal: 1300, reward: 200, val: S => S.st.peakRp },
    { id: 'dia', name: '鑽石之心', desc: '升上鑽石段位', cat: 'rank', goal: 1900, reward: 500, val: S => S.st.peakRp },
    { id: 'gm', name: '一代宗師', desc: '升上宗師段位', cat: 'rank', goal: 2600, reward: 2000, val: S => S.st.peakRp },
    { id: 'top100', name: '百大玩家', desc: '衝進全服前 100 名', cat: 'rank', goal: 1, reward: 300, val: S => (S.st.bestRank && S.st.bestRank <= 100 ? 1 : 0) },
    { id: 'top10', name: '十強', desc: '衝進全服前 10 名', cat: 'rank', goal: 1, reward: 1000, val: S => (S.st.bestRank && S.st.bestRank <= 10 ? 1 : 0) },
    { id: 'top1', name: '天下第一', desc: '拿下全服第一', cat: 'rank', goal: 1, reward: 3000, val: S => (S.st.bestRank === 1 ? 1 : 0) },
    { id: 'fr10', name: '揪咖王', desc: '跟朋友連線玩 10 局', cat: 'play', goal: 10, reward: 300, val: S => S.st.online },
  ];
  const newStats = () => ({ byGame: { big2: { g: 0, w: 0, places: [0, 0, 0, 0] }, seven: { g: 0, w: 0, places: [0, 0, 0, 0] }, mj: { g: 0, w: 0, places: [0, 0, 0, 0] }, bk: { g: 0, w: 0, places: [0, 0, 0, 0] }, rm: { g: 0, w: 0, places: [0, 0, 0, 0] }, dc: { g: 0, w: 0, places: [0, 0, 0, 0] }, cc: { g: 0, w: 0, places: [0, 0, 0, 0] }, pr: { g: 0, w: 0, places: [0, 0, 0, 0] } },
    coinsEarned: 0, peakRp: START_RP, bestRank: null, bombs: 0, sevenClean: 0, mjHu: 0, mjTsumo: 0, mjMaxTai: 0, mjBest: null, online: 0, rpHist: [START_RP], h2h: {}, firstDay: null, days: 0, lastDay: null });

  function rng(seed) {
    let a = seed >>> 0;
    return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const hashStr = s => { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  function dayKey(t) { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function dayDiff(a, b) { const pa = a.split('-').map(Number), pb = b.split('-').map(Number); return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 86400000); }

  /* ---------- 存檔 ---------- */
  function fresh(now) {
    return { v: 1, coins: 200, rp: START_RP, streak: 0, best: 0, games: 0, wins: 0, born: now, seed: Math.floor(Math.random() * 1e9),
      owned: ['av_pup', 'av_frog', 'av_chick', 'tb_mint', 'em_basic'], equip: { avatar: 'av_pup', table: 'tb_mint', emo: 'em_basic', fx: 'fx_bubble' },
      checkin: { last: null, day: 0 }, daily: null, lastRank: null, friends: {}, log: [] };
  }
  function migrate(P) {
    ['bk_classic', 'fr_none', 'tt_none', 'ti_classic', 'th_tomato', 'th_rose'].forEach(id => { if (!P.owned.includes(id)) P.owned.push(id); });
    P.equip.back = P.equip.back || 'bk_classic'; P.equip.frame = P.equip.frame || 'fr_none';
    P.equip.title = P.equip.title || 'tt_none'; P.equip.tiles = P.equip.tiles || 'ti_classic';
    if (!P.chests) { P.chests = { c: 1, r: 0, e: 0 }; P.pity = 0; P.frags = 0; P.chestLog = []; } // 送一個普通寶箱當見面禮
    if (P.peakTier == null) P.peakTier = tierOf(P.rp).i;
  }
  function create(storage, nowFn) {
    const now = nowFn || (() => Date.now());
    let P;
    try { P = JSON.parse(storage.getItem(KEY) || 'null'); } catch (e) { P = null; }
    if (!P || P.v !== 1) P = fresh(now());
    if (!P.st) {
      P.st = newStats(); P.st.peakRp = Math.max(START_RP, P.rp); P.st.rpHist = [P.rp];
      // 把舊版的各遊戲戰績搬過來
      try { [['big2', 'jk_stats'], ['seven', 'jk_stats7'], ['mj', 'jk_statsmj']].forEach(([g, k]) => {
        const old = JSON.parse(storage.getItem(k) || '{}'), B = P.st.byGame[g];
        Object.values(old).forEach(o => { B.g += o.games || 0; (o.places || []).forEach((v, i) => { B.places[i] += v || 0; }); });
        B.w = B.places[0];
      }); } catch (e) {}
    }
    if (!P.ach) P.ach = {};
    if (!P.owned.includes('fx_bubble')) P.owned.push('fx_bubble');
    if (!P.equip.fx) P.equip.fx = 'fx_bubble';
    migrate(P);
    ['bk', 'rm', 'dc', 'cc', 'pr'].forEach(g => { if (!P.st.byGame[g]) P.st.byGame[g] = { g: 0, w: 0, places: [0, 0, 0, 0] }; });
    const save = () => { try { storage.setItem(KEY, JSON.stringify(P)); } catch (e) {} };

    function daily() {
      const k = dayKey(now());
      if (!P.daily || P.daily.date !== k) {
        const r = rng(hashStr(k) ^ P.seed), pick = [1, 2, 3].map(d => { const pool = TASKS.filter(t => t.d === d); return pool[Math.floor(r() * pool.length)].id; });
        P.daily = { date: k, tasks: pick.map(id => ({ id, n: 0, claimed: false })), chest: false };
        save();
      }
      return P.daily;
    }
    function bumpTask(id, by) {
      const d = daily(), t = d.tasks.find(x => x.id === id && taskDef(x.id));
      if (!t || t.claimed) return;
      t.n = Math.min(taskDef(id).goal, t.n + (by || 1));
    }

    /* ---------- 假的世界排行 ---------- */
    const SURN = ['阿', '小', '老', '大', ''];
    const GIVEN = ['明', '華', '偉', '婷', '傑', '豪', '慧', '宏', '怡', '翔', '倫', '庭', '雯', '凱', '琪', '哲', '瑜', '安', '芸', '軒', '昇', '萱', '銘', '筑'];
    const NICK = ['牌神', '雀聖', '大老二之王', '排七仔', '自摸王', '胡牌機器', '鐵支哥', '同花順', '碰碰胡', '海底撈月', '炸彈客', '梅花三', '黑桃 A', '東風', '一條龍', '聽牌中', '天胡', '連莊仔', '槓上花', '嚦咕嚦咕',
      'Kevin', 'Amy', 'Jason', 'Vivian', 'Leo', 'Mia', 'Eric', 'Ivy', 'Tony', 'Cindy', 'Ray', 'Nina', 'Ben', 'Joy', 'Sam', 'Zoe'];
    const KINDS = ['pup', 'frog', 'chick', 'cat', 'bear', 'bunny', 'panda', 'fox', 'penguin', 'tiger'];
    let board = null;
    function fakePlayers() {
      if (board) return board;
      const r = rng(20261017), out = [], used = new Set();
      for (let i = 0; i < 300; i++) {
        let name;
        do {
          const u = r();
          if (u < 0.4) name = NICK[Math.floor(r() * NICK.length)] + (r() < 0.6 ? Math.floor(r() * 99 + 1) : '');
          else if (u < 0.8) name = SURN[Math.floor(r() * SURN.length)] + GIVEN[Math.floor(r() * GIVEN.length)] + (r() < 0.5 ? GIVEN[Math.floor(r() * GIVEN.length)] : '');
          else name = GIVEN[Math.floor(r() * GIVEN.length)] + GIVEN[Math.floor(r() * GIVEN.length)] + '_' + Math.floor(r() * 900 + 100);
        } while (used.has(name) || name.length < 2);
        used.add(name);
        const base = 600 + 2700 * Math.pow(r(), 2.4);
        out.push({ name, kind: KINDS[Math.floor(r() * KINDS.length)], base, rate: r() * 0.6, ph: r() * 6.28, per: 3 + r() * 5, wins: Math.floor(r() * 400 + base / 8) });
      }
      board = out;
      return out;
    }
    // 電腦玩家的分數會隨時間慢慢漲、小幅上下跳，不玩就會被超車
    function boardNow() {
      const h = (now() - P.born) / 3600000;
      const list = fakePlayers().map(p => ({ name: p.name, kind: p.kind, wins: p.wins, rp: Math.max(0, Math.round(p.base + p.rate * h + Math.sin(h / p.per + p.ph) * 14)) }));
      list.push({ name: null, me: true, rp: P.rp, wins: P.wins });
      list.sort((a, b) => b.rp - a.rp || (a.me ? -1 : b.me ? 1 : 0));
      return list;
    }
    function myRank() { return boardNow().findIndex(x => x.me) + 1; }

    /* ---------- 一局結束 ---------- */
    // e: {game, place, n, online, diff, bomb, sevenPts}
    function recordGame(e) {
      const n = Math.min(4, Math.max(2, e.n)), win = e.place === 0;
      const before = { rp: P.rp, tier: tierOf(P.rp), rank: myRank() };
      P.games++;
      if (win) { P.wins++; P.streak++; P.best = Math.max(P.best, P.streak); } else P.streak = 0;
      const base = (COINS[n][e.place] || 0);
      const mult = win ? streakMult(P.streak) : 1;
      const friendBonus = e.online ? 1.5 : 1;
      const easy = e.diff === 'easy' && !e.online ? 0.7 : e.diff === 'hard' ? 1.3 : 1;
      const coins = Math.round(base * mult * friendBonus * easy);
      let rpd = RP[n][e.place] || 0;
      if (win && P.streak > 1) rpd += Math.min(5, P.streak - 1) * 3;
      if (e.diff === 'easy' && !e.online) rpd = Math.round(rpd * (rpd > 0 ? 0.6 : 1));
      if (e.diff === 'hard' && rpd > 0) rpd = Math.round(rpd * 1.25);
      P.rp = Math.max(0, P.rp + rpd);
      P.coins += coins;
      // 任務
      bumpTask('play3');
      if (win) bumpTask('win1');
      if (win && e.game === 'big2') bumpTask('big2win');
      if (e.bomb) bumpTask('big2bomb');
      if (e.game === 'seven' && e.sevenPts != null && e.sevenPts <= 10) bumpTask('sevenlow');
      if (e.online) bumpTask('online1');
      if (P.streak >= 2) bumpTask('streak2');
      if (e.game === 'bk') { bumpTask('bkplay'); if (win) bumpTask('bkwin'); if (e.bkAll) bumpTask('bkall'); }
      if (e.game === 'rm') { bumpTask('rmplay'); if (win) bumpTask('rmwin'); }
      if (e.game === 'mj') bumpTask('mjplay');
      if (e.game === 'cc') { bumpTask('ccplay'); if (win) bumpTask('ccwin'); }
      if (e.game === 'pr') { bumpTask('prplay'); if (win) bumpTask('prwin'); }
      if (e.game === 'dc') { bumpTask('dcplay'); if (win) bumpTask('dcwin'); }
      if (e.rm4) bumpTask('rm4');
      // 寶箱：每連勝 3 場送稀有寶箱；第一次升到新段位送史詩寶箱
      const gotChests = [];
      if (win && P.streak > 0 && P.streak % 3 === 0) { P.chests.r++; gotChests.push({ t: 'r', why: `連勝 ${P.streak} 場` }); }
      const after = { rp: P.rp, tier: tierOf(P.rp), rank: myRank() };
      if (after.tier.i > P.peakTier) { P.peakTier = after.tier.i; P.chests.e++; gotChests.push({ t: 'e', why: `升上${after.tier.name}` }); }
      // 累積戰績
      const st = P.st, bg = st.byGame[e.game] || st.byGame.big2, dk = dayKey(now());
      bg.g++; bg.places[e.place] = (bg.places[e.place] || 0) + 1; if (win) bg.w++;
      st.coinsEarned += coins; st.peakRp = Math.max(st.peakRp, P.rp);
      st.bestRank = st.bestRank ? Math.min(st.bestRank, after.rank) : after.rank;
      st.bombs += e.bombs || 0;
      if (e.game === 'seven' && e.sevenPts === 0) st.sevenClean++;
      if (e.online) st.online++;
      st.rpHist.push(P.rp); st.rpHist = st.rpHist.slice(-40);
      if (st.lastDay !== dk) { st.days++; st.lastDay = dk; if (!st.firstDay) st.firstDay = dk; }
      (e.rivals || []).forEach(r => { const h = st.h2h[r.name] || (st.h2h[r.name] = { g: 0, above: 0, kind: r.kind }); h.g++; if (r.beat) h.above++; h.kind = r.kind || h.kind; h.t = now(); });
      const lines = [[`第 ${e.place + 1} 名`, base]];
      if (mult > 1) lines.push([`連勝 ${P.streak} 場 ×${mult}`, null]);
      if (friendBonus > 1) lines.push(['揪咖加成 ×1.5', null]);
      if (easy < 1) lines.push(['簡單電腦 ×0.7', null]);
      if (easy > 1) lines.push(['困難電腦 ×1.3', null]);
      const unlocked = checkAch();
      const res = { coins, lines, rpd, before, after, streak: P.streak, tierUp: after.tier.i > before.tier.i, tierDown: after.tier.i < before.tier.i, unlocked, chests: gotChests };
      P.lastRank = after.rank;
      P.log.unshift({ t: now(), game: e.game, place: e.place, n, coins, rpd }); P.log = P.log.slice(0, 30);
      save();
      return res;
    }
    // 麻將每胡一把另外給金幣
    function recordMjHand(e) {
      bumpTask('mjhu');
      if (e.self) bumpTask('mjtsumo');
      if (e.tai >= 3) bumpTask('mjtai');
      const coins = Math.round((15 + 5 * e.tai) * (e.online ? 1.5 : 1) * (e.diff === 'easy' && !e.online ? 0.7 : 1));
      P.coins += coins;
      const st = P.st; st.mjHu++; if (e.self) st.mjTsumo++; st.coinsEarned += coins;
      if (e.tai > st.mjMaxTai) { st.mjMaxTai = e.tai; st.mjBest = { tai: e.tai, names: (e.names || []).slice(0, 6), t: now() }; }
      const unlocked = checkAch();
      save();
      return { coins, unlocked };
    }

    /* ---------- 成就 ---------- */
    function achState() {
      const S = { games: P.games, wins: P.wins, best: P.best, st: P.st };
      return ACH.map(a => ({ id: a.id, name: a.name, desc: a.desc, cat: a.cat, reward: a.reward, goal: a.goal, n: Math.min(a.goal, a.val(S) || 0), got: P.ach[a.id] || null }));
    }
    function checkAch() {
      const out = [];
      achState().forEach(a => { if (!a.got && a.n >= a.goal) { P.ach[a.id] = now(); P.coins += a.reward; P.st.coinsEarned += a.reward; out.push(a); } });
      return out;
    }

    /* ---------- 簽到 / 任務領獎 ---------- */
    function checkinState() {
      const k = dayKey(now()), c = P.checkin;
      const done = c.last === k;
      const gap = c.last ? dayDiff(c.last, k) : 99;
      const day = done ? c.day : (gap === 1 ? c.day % 7 + 1 : 1);
      return { done, day, rewards: CHECKIN };
    }
    function doCheckin() {
      const s = checkinState();
      if (s.done) return null;
      P.checkin = { last: dayKey(now()), day: s.day };
      const coins = CHECKIN[s.day - 1];
      P.coins += coins; save();
      return { coins, day: s.day };
    }
    function tasks() {
      return daily().tasks.map(t => Object.assign({}, taskDef(t.id), t, { done: t.n >= taskDef(t.id).goal }));
    }
    function claimTask(id) {
      const t = daily().tasks.find(x => x.id === id);
      if (!t || t.claimed || t.n < taskDef(id).goal) return null;
      t.claimed = true; P.coins += taskDef(id).reward;
      const d = daily(); let chest = false;
      if (!d.chest && d.tasks.every(x => x.claimed)) { d.chest = true; P.chests.c++; chest = true; }
      save();
      return { coins: taskDef(id).reward, chest };
    }
    function hasClaimable() { return !checkinState().done || tasks().some(t => t.done && !t.claimed); }

    /* ---------- 寶箱 ---------- */
    const rand = () => { try { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] / 4294967296; } catch (e) { return Math.random(); } };
    function chestState() {
      return { chests: Object.assign({}, P.chests), pity: P.pity, pityMax: PITY, frags: P.frags,
        defs: CHESTS, rar: RAR, collection: CHEST_ITEMS.filter(x => x.chest).map(x => Object.assign({}, x, { owned: P.owned.includes(x.id) })) };
    }
    function buyChest(t) {
      const c = CHESTS[t]; if (!c || c.price == null) return { err: '這個寶箱買不到' };
      if (P.coins < c.price) return { err: `金幣不夠，還差 ${c.price - P.coins}` };
      P.coins -= c.price; P.chests[t]++; save(); return { ok: true };
    }
    function openChest(t) {
      const c = CHESTS[t]; if (!c || !(P.chests[t] > 0)) return { err: '沒有這種寶箱' };
      P.chests[t]--;
      let rar, x = rand() * 100;
      for (const k of ['l', 'e', 'r', 'c']) { if (x < c.odds[k]) { rar = k; break; } x -= c.odds[k]; }
      rar = rar || 'c';
      const pityHit = P.pity + 1 >= PITY && (rar === 'c' || rar === 'r');
      if (pityHit) rar = 'e';
      P.pity = (rar === 'e' || rar === 'l') ? 0 : P.pity + 1;
      const out = { chest: t, rar, pity: pityHit };
      if (rar === 'c') { out.coins = 30 + Math.floor(rand() * 13) * 10; P.coins += out.coins; P.st.coinsEarned += out.coins; }
      else {
        const pool = CHEST_ITEMS.filter(i => i.rar === rar), it = pool[Math.floor(rand() * pool.length)];
        out.item = { id: it.id, name: it.name, cat: it.cat };
        if (P.owned.includes(it.id)) { out.dup = true; out.frags = RAR[rar].dup; P.frags += out.frags; }
        else P.owned.push(it.id);
      }
      P.chestLog.unshift({ t: now(), chest: t, rar, id: out.item && out.item.id, coins: out.coins }); P.chestLog = P.chestLog.slice(0, 30);
      save(); return out;
    }
    function fragBuy(id) {
      const it = item(id); if (!it || !it.chest) return { err: '找不到這個東西' };
      if (P.owned.includes(id)) return { err: '已經有了' };
      if (P.frags < it.frag) return { err: `碎片不夠，還差 ${it.frag - P.frags}` };
      P.frags -= it.frag; P.owned.push(id); P.equip[it.cat] = id; save(); return { ok: true };
    }

    /* ---------- 商店 ---------- */
    function buy(id) {
      const it = item(id);
      if (!it) return { err: '找不到這個東西' };
      if (it.chest) return { err: '這是寶箱限定，只能開寶箱或用碎片換' };
      if (P.owned.includes(id)) return { err: '已經有了' };
      if (P.coins < it.price) return { err: `金幣不夠，還差 ${it.price - P.coins}` };
      P.coins -= it.price; P.owned.push(id); if (it.cat !== 'throw') P.equip[it.cat] = id; save();
      return { ok: true };
    }
    function equip(id) {
      const it = item(id);
      if (!it || !P.owned.includes(id)) return false;
      P.equip[it.cat] = id; save(); return true;
    }

    /* ---------- 備份碼 ---------- */
    const B64 = (str) => { const b = new TextEncoder().encode(str); let bin = ''; b.forEach(x => (bin += String.fromCharCode(x))); return btoa(bin); };
    const UNB64 = (b64) => { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new TextDecoder().decode(u); };
    function exportCode(nick) {
      const data = { p: P, nick: nick || '', at: now() };
      return 'JK1-' + B64(JSON.stringify(data));
    }
    function importCode(code) {
      try {
        const m = String(code || '').replace(/\s+/g, '').match(/JK1-([A-Za-z0-9+/=]+)/);
        if (!m) return { err: '這不是牌搭子的備份碼' };
        const d = JSON.parse(UNB64(m[1]));
        const np = d && d.p;
        if (!np || np.v !== 1 || typeof np.coins !== 'number' || typeof np.rp !== 'number' || !Array.isArray(np.owned)) return { err: '備份碼不完整，請整段重新複製' };
        P = np; if (!P.ach) P.ach = {}; if (!P.st) P.st = newStats(); migrate(P);
        P.lastBackup = now(); save();
        return { ok: true, nick: d.nick || '', at: d.at };
      } catch (e) { return { err: '備份碼讀不出來，請確認有整段複製' }; }
    }

    /* ---------- 朋友（連線時互相交換的真實資料） ---------- */
    function seeFriend(name, info) {
      if (!name || !info) return;
      P.friends[name] = { rp: Math.max(0, Math.round(+info.rp || 0)), kind: String(info.kind || 'pup'), wins: +info.wins || 0, seen: now() };
      save();
    }

    return {
      get state() { return P; }, save, tierOf, boardNow, myRank, recordGame, recordMjHand, achState,
      checkinState, doCheckin, tasks, claimTask, hasClaimable, buy, equip, seeFriend,
      avatarKind: () => (item(P.equip.avatar) || item('av_pup')).kind,
      theme: () => (item(P.equip.table) || item('tb_mint')).theme,
      emoLines: () => (item(P.equip.emo) || item('em_basic')).lines,
      fxId: () => (item(P.equip.fx) ? P.equip.fx : 'fx_bubble'),
      card: () => ({ rp: P.rp, kind: (item(P.equip.avatar) || item('av_pup')).kind, wins: P.wins, fr: (item(P.equip.frame) || {}).look || 'none', tt: (item(P.equip.title) || {}).text || '' }),
      backLook: () => (item(P.equip.back) || {}).look || 'classic', tilesLook: () => (item(P.equip.tiles) || {}).look || 'classic',
      frameLook: () => (item(P.equip.frame) || {}).look || 'none', titleText: () => (item(P.equip.title) || {}).text || '',
      chestState, buyChest, openChest, fragBuy, throws: () => SHOP.filter(x => x.cat === 'throw' && P.owned.includes(x.id)).map(x => ({ id: x.id, icon: x.icon, name: x.name })), chestCount: () => P.chests.c + P.chests.r + P.chests.e,
      exportCode, importCode, markBackup: () => { P.lastBackup = now(); save(); }, needBackup: () => P.games >= 3 && (!P.lastBackup || now() - P.lastBackup > 7 * 86400000),
    };
  }

  const API = { create, TIERS, tierOf, SHOP, TASKS, CHECKIN, ACH, streakMult, CHESTS, RAR, PITY };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.Progress = API;
})(this);
