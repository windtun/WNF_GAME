/* 台灣十六張麻將規則引擎：純邏輯，房主手機上跑 */
(function (root) {
  // 牌：0-8 萬、9-17 筒、18-26 條、27-30 東南西北、31-33 中發白；34-41 花（春夏秋冬梅蘭竹菊）
  // 牌 id：0-135 為 kind*4+copy，136-143 為花
  const kind = id => (id < 136 ? id >> 2 : 34 + (id - 136));
  const isFlower = id => id >= 136;
  const isHonor = k => k >= 27 && k < 34;
  const suitOf = k => (k < 27 ? Math.floor(k / 9) : 3);
  const CN = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
  const HON = ['東', '南', '西', '北', '中', '發', '白'];
  const FLO = ['春', '夏', '秋', '冬', '梅', '蘭', '竹', '菊'];
  const WIND = ['東', '南', '西', '北'];
  function tileName(k) {
    if (k < 27) return CN[k % 9] + ['萬', '筒', '條'][suitOf(k)];
    if (k < 34) return HON[k - 27];
    return FLO[k - 34];
  }
  const LEFT_END = 16; // 留 16 張（八墩）

  // 洗牌：Fisher-Yates，亂數來自瀏覽器的密碼學等級亂數（crypto.getRandomValues），沒有偏差
  function randInt(n) {
    const c = (typeof crypto !== 'undefined' && crypto.getRandomValues) ? crypto : null;
    if (!c) return Math.floor(Math.random() * n);
    const lim = Math.floor(4294967296 / n) * n, buf = new Uint32Array(1);
    let x; do { c.getRandomValues(buf); x = buf[0]; } while (x >= lim);
    return x % n;
  }
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = randInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  const counts = ids => { const c = new Array(34).fill(0); ids.forEach(i => { if (!isFlower(i)) c[kind(i)]++; }); return c; };

  /* ---------- 胡牌判斷 ---------- */
  function setsOK(c, need, i = 0) {
    while (i < 34 && !c[i]) i++;
    if (i === 34) return need === 0;
    if (need <= 0) return false;
    if (c[i] >= 3) { c[i] -= 3; const ok = setsOK(c, need - 1, i); c[i] += 3; if (ok) return true; }
    if (i < 27 && i % 9 <= 6 && c[i + 1] && c[i + 2]) {
      c[i]--; c[i + 1]--; c[i + 2]--; const ok = setsOK(c, need - 1, i); c[i]++; c[i + 1]++; c[i + 2]++; if (ok) return true;
    }
    return false;
  }
  function isStdWin(c, need) {
    for (let k = 0; k < 34; k++) if (c[k] >= 2) { c[k] -= 2; const ok = setsOK(c, need); c[k] += 2; if (ok) return true; }
    return false;
  }
  // 嚦咕嚦咕：門清，七對加一刻
  function isLiguLigu(c, nMelds) {
    if (nMelds) return false;
    let pairs = 0, trip = 0;
    for (const v of c) { if (v === 2) pairs++; else if (v === 3) trip++; else if (v === 4) pairs += 2; else if (v) return false; }
    return pairs === 7 && trip === 1;
  }
  function canWin(handIds, melds) {
    const c = counts(handIds), need = 5 - melds.length;
    if (handIds.length !== need * 3 + 2) return false;
    return isStdWin(c, need) || isLiguLigu(c, melds.length);
  }
  function waits(handIds, melds) {
    const c = counts(handIds), need = 5 - melds.length, used = counts(handIds.concat(...melds.map(m => m.tiles))), out = [];
    for (let k = 0; k < 34; k++) {
      if (used[k] >= 4) continue;
      c[k]++;
      if (isStdWin(c, need) || isLiguLigu(c, melds.length)) out.push(k);
      c[k]--;
    }
    return out;
  }

  /* ---------- 向聽數（電腦用） ---------- */
  // 每個花色分開算出所有可能的（面子、搭子、雀頭）組合，再合起來，速度快很多
  function prune(list) {
    const seen = new Map();
    list.forEach(x => seen.set(x.join(), x));
    const arr = [...seen.values()];
    return arr.filter(x => !arr.some(y => y !== x && y[0] >= x[0] && y[1] >= x[1] && y[2] >= x[2]));
  }
  const memo = new Map();
  function solveSuit(c, i, len, seq) {
    while (i < len && !c[i]) i++;
    if (i >= len) return [[0, 0, 0]];
    const key = (seq ? 's' : 'h') + c.join('');
    const hit = memo.get(key); if (hit) return hit;
    let out = [];
    const add = (sub, dm, dt, dp) => { for (const [m, t, p] of sub) if (p + dp <= 1) out.push([m + dm, t + dt, p + dp]); };
    if (c[i] >= 3) { c[i] -= 3; add(solveSuit(c, i, len, seq), 1, 0, 0); c[i] += 3; }
    if (seq && i <= len - 3 && c[i + 1] && c[i + 2]) { c[i]--; c[i + 1]--; c[i + 2]--; add(solveSuit(c, i, len, seq), 1, 0, 0); c[i]++; c[i + 1]++; c[i + 2]++; }
    if (c[i] >= 2) { c[i] -= 2; const sub = solveSuit(c, i, len, seq); add(sub, 0, 0, 1); add(sub, 0, 1, 0); c[i] += 2; }
    if (seq && i <= len - 2 && c[i + 1]) { c[i]--; c[i + 1]--; add(solveSuit(c, i, len, seq), 0, 1, 0); c[i]++; c[i + 1]++; }
    if (seq && i <= len - 3 && c[i + 2]) { c[i]--; c[i + 2]--; add(solveSuit(c, i, len, seq), 0, 1, 0); c[i]++; c[i + 2]++; }
    c[i]--; add(solveSuit(c, i, len, seq), 0, 0, 0); c[i]++;
    out = prune(out);
    memo.set(key, out);
    return out;
  }
  function shanten(c, N) {
    let states = [[0, 0, 0]];
    const comps = [c.slice(0, 9), c.slice(9, 18), c.slice(18, 27)].map(a => solveSuit(a, 0, 9, true));
    for (let k = 27; k < 34; k++) if (c[k]) comps.push(solveSuit([c[k]], 0, 1, false));
    for (const comp of comps) {
      const next = [];
      for (const [m, t, p] of states) for (const [m2, t2, p2] of comp) if (p + p2 <= 1) next.push([Math.min(N, m + m2), t + t2, p + p2]);
      states = prune(next);
    }
    let best = 99;
    for (const [m, t, p] of states) { const s = 2 * (N - m) - Math.min(t, N - m) - p; if (s < best) best = s; }
    return best;
  }

  /* ---------- 一場（多局） ---------- */
  function newMatch(length) {
    const M = { length: length || 'round', scores: [0, 0, 0, 0], dealer: randInt(4), wind: 0, streak: 0, hands: 0, over: false, history: [] };
    M.firstDealer = M.dealer;
    return newHand(M);
  }

  function newHand(M) {
    const wall = shuffle(Array.from({ length: 144 }, (_, i) => i));
    const S = {
      n: 4, M, wall, hands: [[], [], [], []], melds: [[], [], [], []], flowers: [[], [], [], []], discards: [],
      dealer: M.dealer, wind: M.wind, turn: M.dealer, phase: 'discard', drawn: null, justKong: false,
      claim: null, result: null, ver: 0, last: null, firstRound: true, over: false, order: [],
    };
    for (let r = 0; r < 16; r++) for (let k = 0; k < 4; k++) S.hands[(M.dealer + k) % 4].push(S.wall.shift());
    for (let k = 0; k < 4; k++) replaceFlowers(S, (M.dealer + k) % 4);
    drawFor(S, M.dealer, false);
    return S;
  }
  const seatWind = (S, p) => (p - S.dealer + 4) % 4;

  function replaceFlowers(S, p) {
    let f;
    while ((f = S.hands[p].find(isFlower)) !== undefined) {
      S.hands[p] = S.hands[p].filter(x => x !== f); S.flowers[p].push(f);
      S.hands[p].push(S.wall.pop());
    }
  }
  // 摸牌（含補花）；牌牆剩 16 張時流局
  function drawFor(S, p, fromBack) {
    for (;;) {
      if (S.wall.length <= LEFT_END) { endDraw(S); return false; }
      const t = fromBack ? S.wall.pop() : S.wall.shift();
      if (isFlower(t)) { S.flowers[p].push(t); fromBack = true; continue; }
      S.hands[p].push(t); S.drawn = t; S.turn = p; S.phase = 'discard';
      return true;
    }
  }

  /* ---------- 輪到自己（摸牌後或吃碰後）可以做的事 ---------- */
  function selfOptions(S, p) {
    if (S.phase !== 'discard' || S.turn !== p) return null;
    const h = S.hands[p], c = counts(h), o = { discard: true, tsumo: false, ankong: [], addkong: [] };
    if (S.drawn != null && canWin(h, S.melds[p])) o.tsumo = true;
    if (S.wall.length > LEFT_END) {
      for (let k = 0; k < 34; k++) if (c[k] === 4) o.ankong.push(k);
      S.melds[p].forEach(m => { if (m.type === 'pung' && c[m.kind] >= 1) o.addkong.push(m.kind); });
    }
    return o;
  }

  function nextOf(p) { return (p + 1) % 4; }

  function act(S, p, a) {
    if (S.phase === 'over') return { err: '這局結束了' };
    if (S.phase === 'claim') return respond(S, p, a);
    if (S.turn !== p) return { err: '還沒輪到你' };
    const h = S.hands[p], opt = selfOptions(S, p);
    if (a.t === 'tsumo') {
      if (!opt.tsumo) return { err: '還不能胡' };
      win(S, p, null, S.drawn, { self: true, kongFlower: S.justKong, last: S.wall.length <= LEFT_END });
      return { ok: 'tsumo' };
    }
    if (a.t === 'ankong') {
      if (!opt.ankong.includes(a.kind)) return { err: '不能暗槓' };
      const ts = h.filter(i => kind(i) === a.kind);
      S.hands[p] = h.filter(i => kind(i) !== a.kind);
      S.melds[p].push({ type: 'ckong', kind: a.kind, tiles: ts, from: p });
      S.last = { by: p, t: 'ankong' }; S.ver++; S.firstRound = false;
      S.justKong = true; drawFor(S, p, true);
      return { ok: 'ankong' };
    }
    if (a.t === 'addkong') {
      if (!opt.addkong.includes(a.kind)) return { err: '不能加槓' };
      const tile = h.find(i => kind(i) === a.kind);
      // 搶槓：別人可以胡這張
      const opts = {};
      for (let q = 0; q < 4; q++) if (q !== p && canWin(S.hands[q].concat(tile), S.melds[q])) opts[q] = ['hu'];
      if (Object.keys(opts).length) {
        S.phase = 'claim'; S.claim = { tile, from: p, rob: true, opts, resp: {} }; S.ver++;
        return { ok: 'addkong-wait' };
      }
      doAddKong(S, p, tile);
      return { ok: 'addkong' };
    }
    if (a.t === 'discard') {
      if (!h.includes(a.id)) return { err: '牌不在手上' };
      S.hands[p] = h.filter(i => i !== a.id);
      S.discards.push({ id: a.id, by: p });
      S.last = { by: p, t: 'discard', id: a.id }; S.drawn = null; S.justKong = false; S.ver++;
      openClaims(S, p, a.id);
      return { ok: 'discard' };
    }
    return { err: '不明的動作' };
  }

  function doAddKong(S, p, tile) {
    const m = S.melds[p].find(x => x.type === 'pung' && x.kind === kind(tile));
    S.hands[p] = S.hands[p].filter(i => i !== tile);
    m.type = 'kong'; m.tiles.push(tile);
    S.last = { by: p, t: 'addkong' }; S.ver++;
    S.justKong = true; drawFor(S, p, true);
  }

  function chowOptions(hand, k) {
    if (k >= 27) return [];
    const n = k % 9, out = [], find = kk => hand.find(i => kind(i) === kk);
    const tryPair = (a, b) => { const x = find(a), y = find(b); if (x != null && y != null) out.push([x, y]); };
    if (n >= 2) tryPair(k - 2, k - 1);
    if (n >= 1 && n <= 7) tryPair(k - 1, k + 1);
    if (n <= 6) tryPair(k + 1, k + 2);
    return out;
  }

  function openClaims(S, from, tile) {
    const k = kind(tile), opts = {};
    for (let q = 0; q < 4; q++) {
      if (q === from) continue;
      const h = S.hands[q], cnt = h.filter(i => kind(i) === k).length, o = [];
      if (canWin(h.concat(tile), S.melds[q])) o.push('hu');
      if (S.wall.length > LEFT_END) {
        if (cnt >= 2) o.push('pung');
        if (cnt >= 3) o.push('kong');
        if (q === nextOf(from) && chowOptions(h, k).length) o.push('chow');
      }
      if (o.length) opts[q] = o;
    }
    if (!Object.keys(opts).length) { advance(S, from); return; }
    S.phase = 'claim'; S.claim = { tile, from, rob: false, opts, resp: {} };
  }

  function advance(S, from) {
    S.claim = null;
    drawFor(S, nextOf(from), false);
  }

  function pending(S) {
    if (S.phase !== 'claim') return [];
    return Object.keys(S.claim.opts).map(Number).filter(q => !(q in S.claim.resp));
  }

  function respond(S, q, a) {
    const cl = S.claim;
    if (!cl.opts[q]) return { err: '你沒有可以喊的' };
    if (q in cl.resp) return { err: '已經回覆了' };
    const c = a.t === 'claim' ? a.c : 'pass';
    if (c !== 'pass' && !cl.opts[q].includes(c)) return { err: '不能這樣喊' };
    if (c === 'chow') {
      const ok = chowOptions(S.hands[q], kind(cl.tile)).some(pr => a.with && pr.every(x => a.with.includes(x)) && a.with.length === 2);
      if (!ok) return { err: '這樣吃不行' };
    }
    cl.resp[q] = { c, with: a.with };
    if (pending(S).length) {
      // 胡最優先：已有人選胡、且排在他前面的人都回覆了，就可以提早結算
      return { ok: 'wait' };
    }
    resolve(S);
    return { ok: 'resolved' };
  }

  function resolve(S) {
    const cl = S.claim, order = [1, 2, 3].map(d => (cl.from + d) % 4);
    const hu = order.find(q => cl.resp[q] && cl.resp[q].c === 'hu');
    if (hu != null) {
      S.claim = null;
      if (cl.rob) S.hands[cl.from] = S.hands[cl.from].filter(i => i !== cl.tile);
      else S.discards.pop();
      const last = S.wall.length <= LEFT_END;
      win(S, hu, cl.from, cl.tile, { self: false, rob: cl.rob, lastDiscard: last });
      return;
    }
    if (cl.rob) { S.phase = 'discard'; S.claim = null; doAddKong(S, cl.from, cl.tile); return; }
    const pk = order.find(q => cl.resp[q] && (cl.resp[q].c === 'pung' || cl.resp[q].c === 'kong'));
    const ch = order.find(q => cl.resp[q] && cl.resp[q].c === 'chow');
    const take = pk != null ? pk : ch;
    if (take == null) { advance(S, cl.from); S.ver++; return; }
    const r = cl.resp[take], k = kind(cl.tile);
    S.discards.pop();
    S.claim = null; S.firstRound = false;
    if (r.c === 'chow') {
      S.hands[take] = S.hands[take].filter(i => !r.with.includes(i));
      const tiles = r.with.concat(cl.tile).sort((a, b) => kind(a) - kind(b));
      S.melds[take].push({ type: 'chow', kind: kind(tiles[0]), tiles, from: cl.from, got: cl.tile });
      S.turn = take; S.phase = 'discard'; S.drawn = null; S.last = { by: take, t: 'chow' };
    } else {
      const need = r.c === 'kong' ? 3 : 2;
      const mine = S.hands[take].filter(i => kind(i) === k).slice(0, need);
      S.hands[take] = S.hands[take].filter(i => !mine.includes(i));
      S.melds[take].push({ type: r.c === 'kong' ? 'kong' : 'pung', kind: k, tiles: mine.concat(cl.tile), from: cl.from, got: cl.tile });
      S.turn = take; S.phase = 'discard'; S.drawn = null; S.last = { by: take, t: r.c };
      if (r.c === 'kong') { S.justKong = true; drawFor(S, take, true); }
    }
    S.ver++;
  }

  /* ---------- 計台 ---------- */
  function decomps(c, need) {
    const out = [];
    const rec = (i, sets) => {
      while (i < 34 && !c[i]) i++;
      if (i === 34) { if (sets.length === need) out.push(sets.slice()); return; }
      if (c[i] >= 3) { c[i] -= 3; sets.push({ t: 'pung', k: i }); rec(i, sets); sets.pop(); c[i] += 3; }
      if (i < 27 && i % 9 <= 6 && c[i + 1] && c[i + 2]) { c[i]--; c[i + 1]--; c[i + 2]--; sets.push({ t: 'chow', k: i }); rec(i, sets); sets.pop(); c[i]++; c[i + 1]++; c[i + 2]++; }
    };
    for (let k = 0; k < 34; k++) if (c[k] >= 2) {
      c[k] -= 2; const before = out.length; rec(0, []);
      for (let j = before; j < out.length; j++) out[j].pair = k;
      c[k] += 2;
    }
    return out;
  }

  function scoreHand(S, p, winTile, ctx) {
    const hand = S.hands[p], melds = S.melds[p], c = counts(hand), wk = kind(winTile);
    const sw = seatWind(S, p), rw = S.wind, fl = S.flowers[p].map(kind);
    const exposed = melds.filter(m => m.type !== 'ckong');
    const menqing = exposed.length === 0;
    const base = [];
    // 花
    let flowerTai = [];
    const seasons = [34, 35, 36, 37].filter(k => fl.includes(k)), plants = [38, 39, 40, 41].filter(k => fl.includes(k));
    if (seasons.length === 4) flowerTai.push(['花槓（春夏秋冬）', 2]); else if (fl.includes(34 + sw)) flowerTai.push(['正花 ' + FLO[sw], 1]);
    if (plants.length === 4) flowerTai.push(['花槓（梅蘭竹菊）', 2]); else if (fl.includes(38 + sw)) flowerTai.push(['正花 ' + FLO[4 + sw], 1]);

    const common = [];
    if (ctx.self && menqing) common.push(['門清一摸三', 3]);
    else { if (ctx.self) common.push(['自摸', 1]); if (menqing) common.push(['門清', 1]); }
    if (ctx.kongFlower) common.push(['槓上開花', 1]);
    if (ctx.self && ctx.last) common.push(['海底撈月', 1]);
    if (!ctx.self && ctx.lastDiscard) common.push(['河底撈魚', 1]);
    if (ctx.rob) common.push(['搶槓', 1]);
    // 獨聽
    const before = hand.filter(i => i !== winTile);
    if (before.length === hand.length - 1 && waits(before, melds).length === 1) common.push(['獨聽', 1]);

    // 嚦咕嚦咕
    let best = null;
    if (isLiguLigu(c, melds.length)) best = { list: [['嚦咕嚦咕', 8]], sum: 8 };

    const ds = decomps(c, 5 - melds.length);
    for (const d of ds) {
      const list = [];
      const sets = d.map(s => ({ t: s.t, k: s.k, concealed: !(s.t === 'pung' && !ctx.self && s.k === wk && !d.some(o => o !== s && o.t === 'chow' && wk >= o.k && wk <= o.k + 2)) }))
        .concat(melds.map(m => ({ t: m.type === 'chow' ? 'chow' : 'pung', k: m.kind, concealed: m.type === 'ckong' })));
      const pair = d.pair;
      const pungs = sets.filter(s => s.t === 'pung'), chows = sets.filter(s => s.t === 'chow');
      const allK = sets.map(s => s.k).concat(pair);
      const dragonsP = pungs.filter(s => s.k >= 31).length, windsP = pungs.filter(s => s.k >= 27 && s.k <= 30).length;
      // 三元
      if (dragonsP === 3) list.push(['大三元', 8]);
      else if (dragonsP === 2 && pair >= 31) list.push(['小三元', 4]);
      else pungs.filter(s => s.k >= 31).forEach(s => list.push(['三元牌 ' + HON[s.k - 27], 1]));
      // 四喜
      if (windsP === 4) list.push(['大四喜', 16]);
      else if (windsP === 3 && pair >= 27 && pair <= 30) list.push(['小四喜', 8]);
      else pungs.filter(s => s.k >= 27 && s.k <= 30).forEach(s => {
        if (s.k - 27 === rw) list.push(['圈風 ' + WIND[rw], 1]);
        if (s.k - 27 === sw) list.push(['門風 ' + WIND[sw], 1]);
      });
      // 花色
      const suits = new Set(allK.filter(k => k < 27).map(suitOf)), hasHonor = allK.some(isHonor);
      if (!suits.size) list.push(['字一色', 16]);
      else if (suits.size === 1 && !hasHonor) list.push(['清一色', 8]);
      else if (suits.size === 1) list.push(['混一色', 4]);
      if (!chows.length) list.push(['碰碰胡', 4]);
      if (chows.length === 5 && !hasHonor && !S.flowers[p].length && !ctx.self) list.push(['平胡', 2]);
      const an = pungs.filter(s => s.concealed).length;
      if (an >= 5) list.push(['五暗刻', 8]); else if (an === 4) list.push(['四暗刻', 5]); else if (an === 3) list.push(['三暗刻', 2]);
      if (exposed.length === 5 && !ctx.self) list.push(['全求人', 2]);
      const sum = list.reduce((a, x) => a + x[1], 0);
      if (!best || sum > best.sum) best = { list, sum };
    }
    const list = common.concat(flowerTai, best ? best.list : []);
    return list;
  }

  const BASE = 2;
  function win(S, p, from, tile, ctx) {
    if (!ctx.self) S.hands[p].push(tile);
    const tai = scoreHand(S, p, tile, ctx);
    const total = tai.reduce((a, x) => a + x[1], 0);
    const M = S.M, pay = [0, 0, 0, 0];
    const dealerBonus = 1 + 2 * M.streak;
    const payers = ctx.self ? [0, 1, 2, 3].filter(q => q !== p) : [from];
    payers.forEach(q => {
      const extra = (p === S.dealer || q === S.dealer) ? dealerBonus : 0;
      const amt = BASE + total + extra;
      pay[q] -= amt; pay[p] += amt;
    });
    S.result = { type: 'win', winner: p, loser: ctx.self ? null : from, self: !!ctx.self, tile, tai, total, pay,
      dealerLine: M.streak ? `莊家 1 台＋連${M.streak}拉${M.streak} ${2 * M.streak} 台` : '莊家 1 台', dealer: S.dealer };
    finishHand(S, p === S.dealer);
  }
  function endDraw(S) {
    S.result = { type: 'draw', pay: [0, 0, 0, 0] };
    finishHand(S, true);
  }
  function finishHand(S, dealerStays) {
    const M = S.M;
    S.phase = 'over'; S.claim = null; S.ver++;
    S.result.pay.forEach((v, i) => (M.scores[i] += v));
    S.result.scores = M.scores.slice();
    M.hands++;
    M.history.push({ type: S.result.type, winner: S.result.winner, total: S.result.total });
    if (dealerStays) M.streak++;
    else {
      M.streak = 0; M.dealer = (M.dealer + 1) % 4;
      if (M.dealer === M.firstDealer) M.wind++;
    }
    if (M.length === 'one' || (M.length === 'round' && M.wind >= 1) || M.wind >= 4) M.over = true;
    S.over = M.over;
    if (M.over) S.order = [0, 1, 2, 3].sort((a, b) => M.scores[b] - M.scores[a] || a - b);
  }
  function nextHand(S) { return S.M.over ? null : newHand(S.M); }

  /* ---------- 電腦 ---------- */
  function bestDiscard(hand, melds, diff) {
    const N = 5 - melds.length, ks = [...new Set(hand.map(kind))];
    const c = counts(hand);
    let best = null, bs = 99, bv = -1;
    for (const k of ks) {
      c[k]--;
      const s = shanten(c, N);
      let v = 0;
      if (diff !== 'easy' && s <= bs) {
        for (let x = 0; x < 34; x++) { if (c[x] >= 4) continue; c[x]++; if (shanten(c, N) < s) v += 4 - c[x] + 1; c[x]--; }
      } else v = Math.random();
      c[k]++;
      const iso = isHonor(k) ? 0.5 : (k % 9 === 0 || k % 9 === 8) ? 0.3 : 0;
      if (s < bs || (s === bs && v + iso > bv)) { bs = s; bv = v + iso; best = k; }
    }
    return hand.slice().reverse().find(i => kind(i) === best);
  }

  function aiSelf(S, p, diff) {
    const o = selfOptions(S, p);
    if (o.tsumo) return { t: 'tsumo' };
    const h = S.hands[p], N = 5 - S.melds[p].length;
    if (o.addkong.length) return { t: 'addkong', kind: o.addkong[0] };
    for (const k of o.ankong) {
      const c = counts(h), s0 = shanten(c, N); c[k] -= 4;
      if (diff === 'easy' || shanten(c, N - 1) <= s0) return { t: 'ankong', kind: k };
    }
    return { t: 'discard', id: bestDiscard(h, S.melds[p], diff) };
  }

  function aiClaim(S, q, diff) {
    const cl = S.claim, o = cl.opts[q];
    if (o.includes('hu')) return { t: 'claim', c: 'hu' };
    const h = S.hands[q], N = 5 - S.melds[q].length, k = kind(cl.tile), c = counts(h);
    const s0 = shanten(c, N);
    const sw = seatWind(S, q);
    const after = (removeKinds) => {
      const cc = c.slice(); removeKinds.forEach(x => cc[x]--);
      let m = 99;
      for (let x = 0; x < 34; x++) if (cc[x]) { cc[x]--; m = Math.min(m, shanten(cc, N - 1)); cc[x]++; }
      return m;
    };
    if (o.includes('kong') && (diff === 'easy' || after([k, k, k]) <= s0)) return { t: 'claim', c: 'kong' };
    if (o.includes('pung')) {
      const valuable = k >= 31 || k - 27 === sw || k - 27 === S.wind;
      if (valuable || after([k, k]) < s0 || (diff === 'easy' && Math.random() < .5)) return { t: 'claim', c: 'pung' };
    }
    if (o.includes('chow') && diff !== 'easy') {
      for (const pr of chowOptions(h, k)) if (after(pr.map(kind)) < s0 && s0 <= 3) return { t: 'claim', c: 'chow', with: pr };
    }
    return { t: 'claim', c: 'pass' };
  }

  const API = { _score: scoreHand, kind, isFlower, tileName, WIND, FLO, HON, LEFT_END, newMatch, nextHand, selfOptions, act, pending, chowOptions, canWin, waits, shanten, counts, aiSelf, aiClaim, seatWind, bestDiscard };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.MJ = API;
})(this);
