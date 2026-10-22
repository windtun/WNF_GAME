/* 拉密規則引擎：純邏輯，房主手機上跑
   牌：1～13 四種顏色各兩副（104 張）＋ 2 張鬼牌，共 106 張
   id：0～103 為 copy*52 + color*13 + (數字-1)；104、105 為鬼牌 */
(function (root) {
  const JOKER_PTS = 30, MELD_MIN = 30;
  const isJ = id => id >= 104;
  const col = id => (isJ(id) ? -1 : Math.floor((id % 52) / 13));
  const num = id => (isJ(id) ? 0 : (id % 13) + 1);
  const pts = id => (isJ(id) ? JOKER_PTS : num(id));

  function randInt(n) {
    const c = (typeof crypto !== 'undefined' && crypto.getRandomValues) ? crypto : null;
    if (!c) return Math.floor(Math.random() * n);
    const lim = Math.floor(4294967296 / n) * n, buf = new Uint32Array(1);
    let x; do { c.getRandomValues(buf); x = buf[0]; } while (x >= lim);
    return x % n;
  }
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = randInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  /* ---------- 牌組判斷：組（同數字不同色 3～4 張）或 順（同色連號 3 張以上），鬼牌可代替任一張 ---------- */
  function analyze(ids) {
    if (!ids || ids.length < 3) return null;
    const J = ids.filter(isJ), R = ids.filter(x => !isJ(x));
    let best = null;
    // 組
    if (ids.length <= 4 && R.length && R.every(x => num(x) === num(R[0])) && new Set(R.map(col)).size === R.length) {
      const order = [...R].sort((a, b) => col(a) - col(b)).concat(J);
      best = { type: 'group', value: num(R[0]) * ids.length, order };
    }
    if (!R.length) best = { type: 'group', value: 0, order: [...J] };
    // 順
    if (R.length && R.every(x => col(x) === col(R[0])) && new Set(R.map(num)).size === R.length && ids.length <= 13) {
      const ns = R.map(num).sort((a, b) => a - b), lo = ns[0], hi = ns[ns.length - 1];
      const gaps = hi - lo + 1 - R.length;
      if (gaps <= J.length) {
        let extra = J.length - gaps, top = Math.min(13, hi + extra); extra -= top - hi;
        const start = lo - extra;
        if (start >= 1) {
          const byNum = new Map(R.map(x => [num(x), x])), js = [...J], order = [];
          let value = 0;
          for (let v = start; v <= top; v++) { order.push(byNum.has(v) ? byNum.get(v) : js.shift()); value += v; }
          if (!best || value > best.value) best = { type: 'run', value, order, start };
        }
      }
    }
    return best;
  }
  const valid = ids => !!analyze(ids);

  function newGame(n) {
    const pool = shuffle(Array.from({ length: 106 }, (_, i) => i));
    const racks = Array.from({ length: n }, () => pool.splice(0, 14));
    return { n, pool, racks, table: [], melded: new Array(n).fill(false), turn: randInt(n), over: false, ver: 0,
      last: null, order: [], score: null, drawsInRow: 0, status: new Array(n).fill(null) };
  }
  const rackPts = r => r.reduce((a, x) => a + pts(x), 0);
  function finishGame(S, winner) {
    S.over = true;
    S.score = S.racks.map(rackPts);
    S.order = [...Array(S.n).keys()].sort((a, b) => (a === winner ? -1 : b === winner ? 1 : 0) || S.score[a] - S.score[b] || S.racks[a].length - S.racks[b].length || a - b);
  }
  function next(S) { S.turn = (S.turn + 1) % S.n; }

  const sameSet = (a, b) => a.length === b.length && [...a].sort((x, y) => x - y).join() === [...b].sort((x, y) => x - y).join();

  // 一回合結束時送出整個桌面：檢查只多了自己手上的牌、每組都成立、首次出牌滿 30 點
  function commit(S, p, table) {
    if (S.over) return { err: '這局已經結束了' };
    if (S.turn !== p) return { err: '還沒輪到你' };
    if (!Array.isArray(table) || table.some(s => !Array.isArray(s))) return { err: '桌面資料不對' };
    const flat = table.flat().map(x => x | 0);
    if (new Set(flat).size !== flat.length || flat.some(x => x < 0 || x > 105)) return { err: '桌面資料不對' };
    const old = S.table.flat(), oldSet = new Set(old);
    if (old.some(x => !flat.includes(x))) return { err: '桌上原本的牌不能收回手上' };
    const added = flat.filter(x => !oldSet.has(x));
    const rack = new Set(S.racks[p]);
    if (added.some(x => !rack.has(x))) return { err: '有牌不在你手上' };
    if (!added.length) return { err: '至少要出一張牌，不然就摸牌' };
    const sets = table.filter(s => s.length);
    for (const s of sets) if (!valid(s)) return { err: '桌上有組不成立的牌（紅框）' };
    if (!S.melded[p]) {
      const untouched = S.table.every(o => sets.some(s => sameSet(s, o)));
      const fresh = sets.filter(s => !S.table.some(o => sameSet(s, o)));
      if (!untouched || fresh.some(s => s.some(x => oldSet.has(x)))) return { err: '第一次出牌只能用自己手上的牌，不能動桌上的' };
      const v = fresh.reduce((a, s) => a + analyze(s).value, 0);
      if (v < MELD_MIN) return { err: `第一次出牌要滿 ${MELD_MIN} 點，現在 ${v} 點` };
    }
    S.table = sets.map(s => analyze(s).order);
    S.racks[p] = S.racks[p].filter(x => !added.includes(x));
    S.melded[p] = true; S.drawsInRow = 0; S.status[p] = null;
    S.last = { by: p, t: 'play', n: added.length, added }; S.ver++;
    if (!S.racks[p].length) { finishGame(S, p); return { ok: true, win: true }; }
    next(S);
    return { ok: true, n: added.length };
  }
  function draw(S, p) {
    if (S.over) return { err: '這局已經結束了' };
    if (S.turn !== p) return { err: '還沒輪到你' };
    let got = null;
    if (S.pool.length) { got = S.pool.pop(); S.racks[p].push(got); S.drawsInRow = 0; }
    else S.drawsInRow++;
    S.last = { by: p, t: 'draw' }; S.status[p] = '摸牌'; S.ver++;
    if (!S.pool.length && S.drawsInRow >= S.n) { finishGame(S, -1); return { ok: true, end: true }; }
    next(S);
    return { ok: true, got };
  }

  /* ---------- 電腦 ---------- */
  function candidates(rack) {
    const J = rack.filter(isJ), R = rack.filter(x => !isJ(x)), out = [];
    // 組
    for (let v = 1; v <= 13; v++) {
      const byC = [0, 1, 2, 3].map(c => R.find(x => num(x) === v && col(x) === c)).filter(x => x != null);
      const combos = [];
      const rec = (i, cur) => { if (i === byC.length) { if (cur.length) combos.push(cur.slice()); return; } rec(i + 1, cur); cur.push(byC[i]); rec(i + 1, cur); cur.pop(); };
      rec(0, []);
      for (const c of combos) for (let j = 0; j <= J.length; j++) { const s = c.concat(J.slice(0, j)); if (s.length >= 3 && s.length <= 4 && j < c.length + 1 && valid(s)) out.push(s); }
    }
    // 順
    for (let c = 0; c < 4; c++) {
      const byN = new Map(); R.filter(x => col(x) === c).forEach(x => { if (!byN.has(num(x))) byN.set(num(x), x); });
      for (let a = 1; a <= 11; a++) for (let b = a + 2; b <= Math.min(13, a + 8); b++) {
        const have = [], miss = [];
        for (let v = a; v <= b; v++) (byN.has(v) ? have : miss).push(byN.get(v));
        if (miss.length > J.length || have.length < 1 || miss.length > have.length) continue;
        out.push(have.concat(J.slice(0, miss.length)));
      }
    }
    return out;
  }
  // 從手牌挑出不重疊的牌組，讓出的張數（首次出牌時看點數）最多
  function bestSets(rack, byValue) {
    const cs = candidates(rack).sort((a, b) => b.length - a.length);
    let best = { sets: [], score: 0 }, nodes = 0;
    const used = new Set();
    const rec = (i, sets, score) => {
      if (++nodes > 25000) return;
      if (score > best.score) best = { sets: sets.slice(), score };
      for (let k = i; k < cs.length; k++) {
        const s = cs[k];
        if (s.some(x => used.has(x))) continue;
        s.forEach(x => used.add(x)); sets.push(s);
        rec(k + 1, sets, score + (byValue ? analyze(s).value : s.length * 100 - s.filter(isJ).length * 30 + analyze(s).value / 100));
        sets.pop(); s.forEach(x => used.delete(x));
      }
    };
    rec(0, [], 0);
    return best.sets;
  }
  /* 困難：把「桌上全部的牌＋自己手牌」重新拆組。桌上每一張都要用到，
     在這個前提下讓手上的牌出得越多越好（真人高手最常用的招） */
  function rearrange(table, rack, limit) {
    const JK = 52, kindOf = id => (isJ(id) ? JK : col(id) * 13 + num(id) - 1);
    const need = new Array(53).fill(0), have = new Array(53).fill(0);
    table.flat().forEach(id => need[kindOf(id)]++);
    rack.forEach(id => have[kindOf(id)]++);
    let nodes = 0, best = null;
    const chosen = [];
    const avail = k => need[k] + have[k];
    const take = ks => { const src = []; ks.forEach(k => { if (need[k] > 0) { need[k]--; src.push(0); } else { have[k]--; src.push(1); } }); return src; };
    const give = (ks, src) => ks.forEach((k, i) => (src[i] ? have[k]++ : need[k]++));
    const usedFromRack = () => chosen.reduce((a, c) => a + c.src.reduce((x, y) => x + y, 0), 0);
    function setsWith(t) {
      const out = [];
      if (t === JK) return out;
      const c = Math.floor(t / 13), n = t % 13;
      // 組：同數字不同色
      const others = [0, 1, 2, 3].filter(x => x !== c);
      for (let mask = 0; mask < 8; mask++) {
        const ks = [t]; others.forEach((x, i) => { if (mask & (1 << i)) ks.push(x * 13 + n); });
        if (ks.slice(1).some(k => avail(k) < 1)) continue;
        for (let j = 0; j <= 2; j++) { if (ks.length + j < 3 || ks.length + j > 4) continue; if (j > avail(JK)) continue; out.push(ks.concat(new Array(j).fill(JK))); }
      }
      // 順：同色連號，包含 t
      for (let a = Math.max(0, n - 6); a <= n; a++) for (let b = Math.max(n, a + 2); b <= Math.min(12, a + 6); b++) {
        const ks = []; let miss = 0, okk = true;
        for (let v = a; v <= b; v++) { const k = c * 13 + v; if (v === n || avail(k) > 0) ks.push(k); else { miss++; ks.push(JK); } }
        if (miss > avail(JK)) okk = false;
        if (okk) out.push(ks);
      }
      return out;
    }
    function rec() {
      if (++nodes > limit) return;
      let t = -1;
      for (let k = 0; k < 52; k++) if (need[k] > 0) { t = k; break; }
      if (t === -1) {
        if (need[JK] > 0) return; // 桌上的鬼牌也要放進某組（簡化：交給上一層）
        const sc = usedFromRack();
        if (!best || sc > best.sc) best = { sc, sets: chosen.map(c => c.ks.slice()) };
        return;
      }
      for (const ks of setsWith(t)) {
        if (ks.filter(k => k === JK).length > avail(JK)) continue;
        const src = take(ks); chosen.push({ ks, src });
        rec();
        chosen.pop(); give(ks, src);
        if (nodes > limit) return;
      }
    }
    rec();
    if (!best) return null;
    // 把種類換回實際的牌
    const poolT = table.flat().slice(), poolR = rack.slice();
    const pick = k => { let i = poolT.findIndex(id => kindOf(id) === k); if (i >= 0) return poolT.splice(i, 1)[0]; i = poolR.findIndex(id => kindOf(id) === k); return i >= 0 ? poolR.splice(i, 1)[0] : null; };
    const sets = best.sets.map(ks => ks.map(pick));
    if (sets.some(s => s.includes(null) || !valid(s)) || poolT.length) return null;
    // 剩下的手牌再自己組新組
    const extra = bestSets(poolR, false);
    extra.forEach(s => { sets.push(s.slice()); s.forEach(x => poolR.splice(poolR.indexOf(x), 1)); });
    return { table: sets.map(s => analyze(s).order), used: rack.length - poolR.length };
  }
  function aiChoose(S, p, diff) {
    if (diff === 'hard' && S.melded[p]) {
      const base = aiChoose(S, p, 'normal');
      const baseUsed = base.t === 'commit' ? base.table.flat().length - S.table.flat().length : 0;
      const r = rearrange(S.table, S.racks[p], 20000);
      if (r && r.used > baseUsed) return { t: 'commit', table: r.table };
      return base;
    }
    if (diff === 'hard') diff = 'normal';
    const rack = S.racks[p];
    let table = S.table.map(s => s.slice());
    let played = new Set();
    if (!S.melded[p]) {
      const sets = bestSets(rack, true);
      const v = sets.reduce((a, s) => a + analyze(s).value, 0);
      if (v < MELD_MIN) return { t: 'draw' };
      const use = diff === 'easy' ? sets : sets;
      use.forEach(s => { table.push(s.slice()); s.forEach(x => played.add(x)); });
      return { t: 'commit', table };
    }
    let left = rack.slice();
    const sets = bestSets(left, false);
    const playSets = diff === 'easy' ? sets.slice(0, 1) : sets;
    playSets.forEach(s => { table.push(s.slice()); s.forEach(x => played.add(x)); });
    left = left.filter(x => !played.has(x));
    if (diff !== 'easy') {
      // 把單張接到桌上的組
      let changed = true;
      while (changed) {
        changed = false;
        for (const t of left.slice()) {
          for (let i = 0; i < table.length; i++) {
            if (valid(table[i].concat(t))) { table[i] = analyze(table[i].concat(t)).order; left = left.filter(x => x !== t); played.add(t); changed = true; break; }
          }
        }
      }
      // 插進長順的中間把它拆成兩段（例如 3-4-5-6-7 加一張 5 → 3-4-5 和 5-6-7）
      for (const t of left.slice()) {
        if (isJ(t)) continue;
        for (let i = 0; i < table.length; i++) {
          const info = analyze(table[i]); if (!info || info.type !== 'run' || table[i].length < 5) continue;
          const k = info.order.findIndex(x => !isJ(x) && col(x) === col(t) && num(x) === num(t));
          if (k < 2 || k > info.order.length - 3) continue;
          const A = info.order.slice(0, k + 1), Bp = [t].concat(info.order.slice(k + 1));
          if (valid(A) && valid(Bp)) { table[i] = analyze(A).order; table.push(analyze(Bp).order); left = left.filter(x => x !== t); played.add(t); break; }
        }
      }
      // 從桌上「借」一張（長順的頭尾、四張的組）跟手上兩張湊成新組
      let tries = 0;
      outer: for (let a = 0; a < left.length; a++) for (let b = a + 1; b < left.length; b++) {
        if (++tries > 400) break outer;
        for (let i = 0; i < table.length; i++) {
          const s = table[i]; if (s.length < 4) continue;
          const info = analyze(s); const cand = info.type === 'run' ? [s[0], s[s.length - 1]] : s.slice();
          for (const t of cand) {
            const rest = s.filter(x => x !== t);
            if (!valid(rest)) continue;
            const ns = [left[a], left[b], t];
            if (valid(ns)) {
              table[i] = analyze(rest).order; table.push(analyze(ns).order);
              played.add(left[a]); played.add(left[b]);
              left = left.filter(x => x !== ns[0] && x !== ns[1]);
              a = -1; break;
            }
          }
          if (a === -1) break;
        }
        if (a === -1) { a = -1; b = left.length; }
      }
    }
    if (!played.size) return { t: 'draw' };
    return { t: 'commit', table };
  }

  const API = { rearrange, JOKER_PTS, MELD_MIN, isJ, col, num, pts, analyze, valid, newGame, commit, draw, rackPts, aiChoose, bestSets };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.Rummi = API;
})(this);
