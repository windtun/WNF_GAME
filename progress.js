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
  ];
  const item = id => SHOP.find(x => x.id === id);

  /* ---------- 每日 ---------- */
  const CHECKIN = [50, 60, 80, 100, 120, 150, 300];
  const TASKS = [
    { id: 'play3', text: '玩 3 局（任何遊戲）', goal: 3, reward: 80 },
    { id: 'win1', text: '拿下 1 次第一名', goal: 1, reward: 100 },
    { id: 'big2win', text: '大老二拿第一名', goal: 1, reward: 100 },
    { id: 'big2bomb', text: '大老二打出 1 次炸彈', goal: 1, reward: 120 },
    { id: 'sevenlow', text: '排七蓋牌 10 點以下', goal: 1, reward: 100 },
    { id: 'mjhu', text: '麻將胡 2 把', goal: 2, reward: 120 },
    { id: 'mjtsumo', text: '麻將自摸 1 次', goal: 1, reward: 150 },
    { id: 'mjtai', text: '麻將胡一把 3 台以上', goal: 1, reward: 150 },
    { id: 'online1', text: '跟朋友連線玩 1 局', goal: 1, reward: 150 },
    { id: 'streak2', text: '連勝 2 場', goal: 1, reward: 150 },
  ];
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
  const newStats = () => ({ byGame: { big2: { g: 0, w: 0, places: [0, 0, 0, 0] }, seven: { g: 0, w: 0, places: [0, 0, 0, 0] }, mj: { g: 0, w: 0, places: [0, 0, 0, 0] } },
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
      owned: ['av_pup', 'av_frog', 'av_chick', 'tb_mint', 'em_basic'], equip: { avatar: 'av_pup', table: 'tb_mint', emo: 'em_basic' },
      checkin: { last: null, day: 0 }, daily: null, lastRank: null, friends: {}, log: [] };
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
    const save = () => { try { storage.setItem(KEY, JSON.stringify(P)); } catch (e) {} };

    function daily() {
      const k = dayKey(now());
      if (!P.daily || P.daily.date !== k) {
        const r = rng(hashStr(k) ^ P.seed), pool = TASKS.map(t => t.id), pick = [];
        while (pick.length < 3) { const i = Math.floor(r() * pool.length); pick.push(pool.splice(i, 1)[0]); }
        P.daily = { date: k, tasks: pick.map(id => ({ id, n: 0, claimed: false })) };
        save();
      }
      return P.daily;
    }
    function bumpTask(id, by) {
      const d = daily(), t = d.tasks.find(x => x.id === id);
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
      const easy = e.diff === 'easy' && !e.online ? 0.7 : 1;
      const coins = Math.round(base * mult * friendBonus * easy);
      let rpd = RP[n][e.place] || 0;
      if (win && P.streak > 1) rpd += Math.min(5, P.streak - 1) * 3;
      if (e.diff === 'easy' && !e.online) rpd = Math.round(rpd * (rpd > 0 ? 0.6 : 1));
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
      const after = { rp: P.rp, tier: tierOf(P.rp), rank: myRank() };
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
      const unlocked = checkAch();
      const res = { coins, lines, rpd, before, after, streak: P.streak, tierUp: after.tier.i > before.tier.i, tierDown: after.tier.i < before.tier.i, unlocked };
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
      t.claimed = true; P.coins += taskDef(id).reward; save();
      return { coins: taskDef(id).reward };
    }
    function hasClaimable() { return !checkinState().done || tasks().some(t => t.done && !t.claimed); }

    /* ---------- 商店 ---------- */
    function buy(id) {
      const it = item(id);
      if (!it) return { err: '找不到這個東西' };
      if (P.owned.includes(id)) return { err: '已經有了' };
      if (P.coins < it.price) return { err: `金幣不夠，還差 ${it.price - P.coins}` };
      P.coins -= it.price; P.owned.push(id); P.equip[it.cat] = id; save();
      return { ok: true };
    }
    function equip(id) {
      const it = item(id);
      if (!it || !P.owned.includes(id)) return false;
      P.equip[it.cat] = id; save(); return true;
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
      card: () => ({ rp: P.rp, kind: (item(P.equip.avatar) || item('av_pup')).kind, wins: P.wins }),
    };
  }

  const API = { create, TIERS, tierOf, SHOP, TASKS, CHECKIN, ACH, streakMult };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.Progress = API;
})(this);
