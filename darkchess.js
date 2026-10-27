/* 暗棋（象棋翻翻棋）：2 人，4×8 棋盤，32 顆棋子全部蓋著洗亂。
   輪到你：翻一顆，或移動自己翻開的棋子一格（上下左右）去空位或吃子。
   第一個翻棋的人，翻到什麼顏色就是那一方。
   大小：帥將 > 仕士 > 相象 > 俥車 > 傌馬 > 炮包 > 兵卒；大吃小、同級可吃；兵卒可以吃帥將，帥將不能吃兵卒。
   炮包：走一格，但吃子要隔一顆棋（不論翻開與否）跳過去吃，距離不限，任何棋都能吃。
   吃光對方或對方沒棋可走就贏。連續 50 步沒有翻棋也沒有吃子，就比剩下的子力。 */
(function (root) {
  const W = 4, H = 8, N = 32;
  const TYPES = ['K', 'A', 'E', 'R', 'H', 'C', 'P']; // 帥 仕 相 俥 傌 炮 兵
  const RANK = { K: 7, A: 6, E: 5, R: 4, H: 3, C: 2, P: 1 };
  const COUNT = { K: 1, A: 2, E: 2, R: 2, H: 2, C: 2, P: 5 };
  const NAME = [{ K: '帥', A: '仕', E: '相', R: '俥', H: '傌', C: '炮', P: '兵' }, { K: '將', A: '士', E: '象', R: '車', H: '馬', C: '包', P: '卒' }];
  const VAL = { K: 50, A: 30, E: 18, R: 12, H: 8, C: 16, P: 5 };
  const IDLE_MAX = 50;
  function randInt(n) {
    try { const a = new Uint32Array(1), lim = Math.floor(0x100000000 / n) * n; let x; do { crypto.getRandomValues(a); x = a[0]; } while (x >= lim); return x % n; }
    catch (e) { return Math.floor(Math.random() * n); }
  }
  function newGame() {
    const bag = [];
    for (let c = 0; c < 2; c++) TYPES.forEach(t => { for (let k = 0; k < COUNT[t]; k++) bag.push({ t, c, up: false }); });
    for (let i = bag.length - 1; i > 0; i--) { const j = randInt(i + 1); [bag[i], bag[j]] = [bag[j], bag[i]]; }
    return { n: 2, board: bag, color: [null, null], turn: randInt(2), over: false, ver: 0, order: [], last: null, idle: 0, moves: 0,
      captured: [[], []], status: [null, null], reason: null };
  }
  const rc = i => [Math.floor(i / W), i % W];
  const idx = (r, c) => (r < 0 || c < 0 || r >= H || c >= W) ? -1 : r * W + c;
  const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  function canEat(a, b) { // a 吃 b（不含炮）
    if (a.t === 'K' && b.t === 'P') return false;
    if (a.t === 'P' && b.t === 'K') return true;
    return RANK[a.t] >= RANK[b.t];
  }
  // 某顏色所有合法步：{k:'flip', i} | {k:'move', from, to, cap}
  function movesFor(S, col) {
    const out = [], B = S.board;
    for (let i = 0; i < N; i++) {
      const p = B[i]; if (!p) continue;
      if (!p.up) { out.push({ k: 'flip', i }); continue; }
      if (col == null || p.c !== col) continue;
      const [r, c] = rc(i);
      DIRS.forEach(([dr, dc]) => {
        const j = idx(r + dr, c + dc); if (j < 0) return;
        const q = B[j];
        if (!q) out.push({ k: 'move', from: i, to: j, cap: false });
        else if (q.up && q.c !== col && p.t !== 'C' && canEat(p, q)) out.push({ k: 'move', from: i, to: j, cap: true });
      });
      if (p.t === 'C') DIRS.forEach(([dr, dc]) => {
        let rr = r + dr, cc = c + dc, jumped = false;
        while (idx(rr, cc) >= 0) {
          const q = B[idx(rr, cc)];
          if (q) { if (!jumped) jumped = true; else { if (q.up && q.c !== col) out.push({ k: 'move', from: i, to: idx(rr, cc), cap: true }); break; } }
          rr += dr; cc += dc;
        }
      });
    }
    return out;
  }
  const colorOf = (S, p) => S.color[p];
  function legal(S, p) { return movesFor(S, colorOf(S, p)); }
  function same(a, b) { return a.k === b.k && (a.k === 'flip' ? a.i === b.i : a.from === b.from && a.to === b.to); }
  function remaining(S, col) { return S.board.filter(x => x && x.c === col).length; }
  function material(S, col) { return S.board.reduce((a, x) => a + (x && x.c === col ? VAL[x.t] : 0), 0); }
  function act(S, p, m) {
    if (S.over || S.turn !== p) return { err: '還沒輪到你' };
    if (!m || !legal(S, p).some(x => same(x, m))) return { err: '不能這樣走' };
    const B = S.board; let info = {};
    if (m.k === 'flip') {
      const pc = B[m.i]; pc.up = true;
      if (S.color[p] == null) { S.color[p] = pc.c; S.color[1 - p] = 1 - pc.c; }
      S.idle = 0; info = { flip: m.i, piece: { t: pc.t, c: pc.c } };
      S.status[p] = `翻出${NAME[pc.c][pc.t]}`;
    } else {
      const a = B[m.from], b = B[m.to];
      if (b) { S.captured[p].push({ t: b.t, c: b.c }); S.idle = 0; info = { cap: { t: b.t, c: b.c } }; S.status[p] = `${NAME[a.c][a.t]}吃${NAME[b.c][b.t]}`; }
      else { S.idle++; S.status[p] = `${NAME[a.c][a.t]}走一步`; }
      B[m.to] = a; B[m.from] = null;
    }
    S.last = Object.assign({ by: p }, m, info); S.moves++;
    S.turn = 1 - p; S.ver++;
    checkEnd(S);
    return { ok: true, info };
  }
  function checkEnd(S) {
    const q = S.turn, cq = S.color[q];
    if (cq == null) return;
    const finish = (winner, reason) => { S.over = true; S.order = [winner, 1 - winner]; S.reason = reason; };
    if (remaining(S, cq) === 0) return finish(1 - q, '吃光了對方的棋');
    if (legal(S, q).length === 0) return finish(1 - q, '對方沒有棋可以走');
    if (S.idle >= IDLE_MAX) {
      const m0 = material(S, S.color[0]), m1 = material(S, S.color[1]);
      const r0 = remaining(S, S.color[0]), r1 = remaining(S, S.color[1]);
      const w = m0 !== m1 ? (m0 > m1 ? 0 : 1) : r0 !== r1 ? (r0 > r1 ? 0 : 1) : 1 - S.last.by;
      return finish(w, `連續 ${IDLE_MAX} 步沒進展，比剩下的子力`);
    }
  }

  /* ---------- 電腦：搜尋（普通 2 層、困難 3 層），翻棋用期望值（還沒翻的棋子機率） ---------- */
  function clone(S) { return { n: 2, board: S.board.map(x => x && { t: x.t, c: x.c, up: x.up }), color: S.color.slice(), turn: S.turn, idle: S.idle }; }
  function unknownPool(S) { const m = {}; let tot = 0; S.board.forEach(x => { if (x && !x.up) { const k = x.c + x.t; m[k] = (m[k] || 0) + 1; tot++; } }); return { m, tot }; }
  const dist = (a, b) => { const [r1, c1] = rc(a), [r2, c2] = rc(b); return Math.abs(r1 - r2) + Math.abs(c1 - c2); };
  // 盤面評估（col 的角度）：子力 + 追得到的獵物 − 會被追的危險
  function evalPos(T, col) {
    let s = 0; const B = T.board, mine = [], his = [];
    for (let i = 0; i < N; i++) { const x = B[i]; if (!x || !x.up) continue; if (x.c === col) { s += VAL[x.t]; mine.push(i); } else { s -= VAL[x.t]; his.push(i); } }
    mine.forEach(a => { const x = B[a]; his.forEach(b => { const y = B[b], d = dist(a, b);
      if (x.t !== 'C' && canEat(x, y)) s += VAL[y.t] * 0.06 / d;
      if (y.t !== 'C' && canEat(y, x)) s -= VAL[x.t] * 0.06 / d; }); });
    return s;
  }
  function search(T, col, depth, alpha, beta) {
    const stand = evalPos(T, col);
    if (depth === 0) return stand;
    let best = stand; // 也可以選擇翻棋，當作盤面不變
    if (best > alpha) alpha = best;
    if (alpha >= beta) return best;
    const ms = movesFor(T, col).filter(m => m.k === 'move');
    ms.sort((a, b) => (b.cap ? VAL[T.board[b.to].t] : 0) - (a.cap ? VAL[T.board[a.to].t] : 0));
    for (const m of ms) {
      const cap = T.board[m.to]; T.board[m.to] = T.board[m.from]; T.board[m.from] = null;
      const v = -search(T, 1 - col, depth - 1, -beta, -alpha);
      T.board[m.from] = T.board[m.to]; T.board[m.to] = cap;
      if (v > best) best = v;
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    return best;
  }
  function scoreMove(S, p, m, depth) {
    const col = S.color[p];
    if (m.k === 'flip') {
      const { m: pool, tot } = unknownPool(S); let ev = 0;
      Object.keys(pool).forEach(k => {
        const c = +k[0], t = k[1], pr = pool[k] / tot;
        const T = clone(S); const x = T.board[m.i]; x.t = t; x.c = c; x.up = true;
        const myCol = col == null ? c : col;
        ev += pr * -search(T, 1 - myCol, depth - 1, -Infinity, Infinity);
      });
      return ev;
    }
    const T = clone(S); T.board[m.to] = T.board[m.from]; T.board[m.from] = null;
    return -search(T, 1 - col, depth - 1, -Infinity, Infinity);
  }
  function aiChoose(S, p, diff) {
    diff = diff || 'normal';
    const ms = legal(S, p); if (!ms.length) return null;
    if (S.color[p] == null) { const pref = [9, 10, 13, 14, 17, 18, 21, 22].filter(i => S.board[i] && !S.board[i].up); const f = pref.length ? pref : ms.map(m => m.i); return { k: 'flip', i: f[randInt(f.length)] }; }
    if (diff === 'easy' && Math.random() < 0.3) { const fl = ms.filter(m => m.k === 'flip'); const pool = fl.length && Math.random() < 0.7 ? fl : ms; return pool[randInt(pool.length)]; }
    const depth = diff === 'hard' ? 3 : diff === 'easy' ? 1 : 2, noise = diff === 'easy' ? 4 : diff === 'hard' ? 0.3 : 1.5;
    let best = null, bv = -Infinity;
    ms.forEach(m => {
      let v = scoreMove(S, p, m, depth);
      v += (Math.random() - 0.5) * 2 * noise;
      if (v > bv) { bv = v; best = m; }
    });
    return best;
  }

  const API = { W, H, N, NAME, RANK, VAL, TYPES, COUNT, IDLE_MAX, newGame, legal, act, aiChoose, movesFor, remaining };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.DarkChess = API;
})(this);
