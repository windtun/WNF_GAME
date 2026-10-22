/* 方塊佔地（Blokus 玩法）規則引擎：純邏輯，房主手機上跑 */
(function (root) {
  // 21 塊方塊，座標 [x,y]
  const SHAPES = [
    [[0,0]],
    [[0,0],[1,0]],
    [[0,0],[1,0],[2,0]], [[0,0],[1,0],[0,1]],
    [[0,0],[1,0],[2,0],[3,0]], [[0,0],[0,1],[0,2],[1,2]], [[0,0],[1,0],[2,0],[1,1]], [[0,0],[1,0],[0,1],[1,1]], [[1,0],[2,0],[0,1],[1,1]],
    [[1,0],[2,0],[0,1],[1,1],[1,2]], [[0,0],[1,0],[2,0],[3,0],[4,0]], [[0,0],[0,1],[0,2],[0,3],[1,3]], [[0,0],[0,1],[1,1],[1,2],[1,3]],
    [[0,0],[1,0],[0,1],[1,1],[0,2]], [[0,0],[1,0],[2,0],[1,1],[1,2]], [[0,0],[2,0],[0,1],[1,1],[2,1]], [[0,0],[0,1],[0,2],[1,2],[2,2]],
    [[0,0],[0,1],[1,1],[1,2],[2,2]], [[1,0],[0,1],[1,1],[2,1],[1,2]], [[0,1],[1,0],[1,1],[1,2],[1,3]], [[0,0],[1,0],[1,1],[1,2],[2,2]],
  ];
  const SIZE = SHAPES.map(s => s.length);
  const norm = cs => { const mx = Math.min(...cs.map(c => c[0])), my = Math.min(...cs.map(c => c[1])); return cs.map(([x, y]) => [x - mx, y - my]).sort((a, b) => a[1] - b[1] || a[0] - b[0]); };
  const keyOf = cs => cs.map(c => c[0] + ',' + c[1]).join(';');
  // 每塊的所有方向（旋轉 4 種 × 翻面 2 種，去掉重複）
  const ORIENTS = SHAPES.map(s => {
    const out = [], seen = new Set();
    let cur = s;
    for (let f = 0; f < 2; f++) {
      for (let r = 0; r < 4; r++) {
        const n = norm(cur), k = keyOf(n);
        if (!seen.has(k)) { seen.add(k); out.push(n); }
        cur = cur.map(([x, y]) => [y, -x]);
      }
      cur = s.map(([x, y]) => [-x, y]);
    }
    return out;
  });
  // 介面用：旋轉 / 翻面
  const rotate = cs => norm(cs.map(([x, y]) => [-y, x]));
  const flip = cs => norm(cs.map(([x, y]) => [-x, y]));

  function newGame(n) {
    const duo = n === 2, N = duo ? 14 : 20;
    const starts = duo ? [[4, 4], [9, 9]] : [[0, 0], [N - 1, 0], [N - 1, N - 1], [0, N - 1]].slice(0, n);
    return {
      n, N, duo, starts, board: new Array(N * N).fill(-1),
      left: Array.from({ length: n }, () => SHAPES.map((_, i) => i)), out: new Array(n).fill(false),
      first: new Array(n).fill(true), lastMono: new Array(n).fill(false),
      turn: 0, over: false, ver: 0, last: null, order: [], score: null, status: new Array(n).fill(null),
    };
  }
  const at = (S, x, y) => (x < 0 || y < 0 || x >= S.N || y >= S.N ? -2 : S.board[y * S.N + x]);
  const ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]], DIAG = [[1, 1], [-1, 1], [1, -1], [-1, -1]];

  // 能下子的「角」：空格、跟自己斜角相接、不跟自己的邊相接
  function anchors(S, p) {
    if (S.first[p]) { const [x, y] = S.starts[p]; return at(S, x, y) === -1 ? [[x, y]] : []; }
    const out = [];
    for (let y = 0; y < S.N; y++) for (let x = 0; x < S.N; x++) {
      if (at(S, x, y) !== -1) continue;
      if (ORTH.some(([dx, dy]) => at(S, x + dx, y + dy) === p)) continue;
      if (DIAG.some(([dx, dy]) => at(S, x + dx, y + dy) === p)) out.push([x, y]);
    }
    return out;
  }
  function fits(S, p, cells) {
    for (const [x, y] of cells) {
      if (at(S, x, y) !== -1) return false;
      for (const [dx, dy] of ORTH) if (at(S, x + dx, y + dy) === p) return false;
    }
    return true;
  }
  function legalMoves(S, p, limit) {
    const out = [], seen = new Set(), anc = anchors(S, p);
    if (!anc.length) return out;
    for (const pc of S.left[p]) {
      for (const o of ORIENTS[pc]) {
        for (const [ax, ay] of anc) {
          for (const [cx, cy] of o) {
            const cells = o.map(([x, y]) => [x - cx + ax, y - cy + ay]);
            if (!fits(S, p, cells)) continue;
            const k = pc + '|' + keyOf([...cells].sort((a, b) => a[1] - b[1] || a[0] - b[0]));
            if (seen.has(k)) continue;
            seen.add(k); out.push({ piece: pc, cells });
            if (limit && out.length >= limit) return out;
          }
        }
      }
    }
    return out;
  }
  const hasMove = (S, p) => legalMoves(S, p, 1).length > 0;

  function validate(S, p, piece, cells) {
    if (S.over) return '遊戲已經結束了';
    if (S.turn !== p) return '還沒輪到你';
    if (!S.left[p].includes(piece)) return '這塊已經用過了';
    if (!Array.isArray(cells) || cells.length !== SIZE[piece]) return '形狀不對';
    const k = keyOf(norm(cells.map(c => [c[0] | 0, c[1] | 0])));
    if (!ORIENTS[piece].some(o => keyOf(o) === k)) return '形狀不對';
    if (!fits(S, p, cells)) return cells.some(([x, y]) => at(S, x, y) !== -1) ? '這裡放不下' : '不能跟自己的方塊邊貼邊';
    if (S.first[p]) { const [sx, sy] = S.starts[p]; if (!cells.some(([x, y]) => x === sx && y === sy)) return '第一塊要蓋住起點'; }
    else if (!cells.some(([x, y]) => DIAG.some(([dx, dy]) => at(S, x + dx, y + dy) === p))) return '要跟自己的方塊角對角相接';
    return null;
  }

  function advance(S) {
    for (let k = 1; k <= S.n; k++) {
      const q = (S.turn + k) % S.n;
      if (S.out[q]) continue;
      if (!S.left[q].length || !hasMove(S, q)) { S.out[q] = true; S.status[q] = S.left[q].length ? '沒地方放了' : '全部放完'; continue; }
      S.turn = q; return;
    }
    finish(S);
  }
  function finish(S) {
    S.over = true;
    S.score = S.left.map((l, p) => {
      if (!l.length) return 15 + (S.lastMono[p] ? 5 : 0);
      return -l.reduce((a, pc) => a + SIZE[pc], 0);
    });
    S.order = [...Array(S.n).keys()].sort((a, b) => S.score[b] - S.score[a] || a - b);
  }
  function place(S, p, piece, cells) {
    const err = validate(S, p, piece, cells);
    if (err) return { err };
    cells.forEach(([x, y]) => (S.board[y * S.N + x] = p));
    S.left[p] = S.left[p].filter(x => x !== piece);
    S.first[p] = false; S.lastMono[p] = piece === 0;
    S.last = { by: p, piece, cells: cells.map(c => [c[0], c[1]]) }; S.ver++;
    if (!S.left[p].length) { S.out[p] = true; S.status[p] = '全部放完'; }
    advance(S);
    return { ok: true, size: SIZE[piece] };
  }
  // 開局時第一個人一定有地方放；之後由 advance 自動跳過沒步可走的人
  function pass(S, p) {
    if (S.turn !== p || S.over) return { err: '還沒輪到你' };
    if (hasMove(S, p)) return { err: '還有地方可以放' };
    S.out[p] = true; S.status[p] = '沒地方放了'; S.ver++; advance(S);
    return { ok: true };
  }

  /* ---------- 電腦 ----------
     普通：先放大塊、多開自己的角、搶別人的角、早期往中間擴張 */
  function aiChoose(S, p, diff) {
    let moves = legalMoves(S, p);
    if (!moves.length) return null;
    if (diff === 'easy') {
      const big = Math.max(...moves.map(m => SIZE[m.piece]));
      const pool = moves.filter(m => SIZE[m.piece] >= big - 1);
      return pool[Math.floor(Math.random() * pool.length)];
    }
    const maxSize = Math.max(...moves.map(m => SIZE[m.piece]));
    const remain = S.left[p].length;
    if (moves.length > 600) moves = moves.filter(m => SIZE[m.piece] >= maxSize - (remain > 12 ? 0 : 1));
    const oppAnchors = new Map();
    for (let q = 0; q < S.n; q++) if (q !== p && !S.out[q]) anchors(S, q).forEach(([x, y]) => oppAnchors.set(y * S.N + x, (oppAnchors.get(y * S.N + x) || 0) + 1));
    const c = (S.N - 1) / 2, early = 21 - remain;
    let best = null, bv = -Infinity;
    for (const m of moves) {
      const set = new Set(m.cells.map(([x, y]) => y * S.N + x));
      let newCorners = 0;
      for (const [x, y] of m.cells) for (const [dx, dy] of DIAG) {
        const nx = x + dx, ny = y + dy;
        if (at(S, nx, ny) !== -1 || set.has(ny * S.N + nx)) continue;
        if (ORTH.some(([ex, ey]) => at(S, nx + ex, ny + ey) === p || set.has((ny + ey) * S.N + nx + ex))) continue;
        newCorners++;
      }
      let block = 0;
      for (const [x, y] of m.cells) { block += oppAnchors.get(y * S.N + x) || 0; for (const [dx, dy] of ORTH) block += (oppAnchors.get((y + dy) * S.N + x + dx) || 0) * 0.5; }
      const dist = Math.min(...m.cells.map(([x, y]) => Math.abs(x - c) + Math.abs(y - c)));
      let v = SIZE[m.piece] * 6 + newCorners * 1.6 + block * 2.2 + Math.random() * 0.5;
      if (early < 6) v -= dist * 1.4;
      if (m.piece === 0 && remain > 2) v -= 6; // 單格留到最後
      if (v > bv) { bv = v; best = m; }
    }
    return best;
  }

  const API = { SHAPES, SIZE, ORIENTS, rotate, flip, norm, newGame, anchors, legalMoves, hasMove, validate, place, pass, aiChoose };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.Blokus = API;
})(this);
