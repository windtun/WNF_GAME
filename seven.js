/* 排七規則引擎：純邏輯，前端與日後連線房主共用 */
(function (root) {
  const rk = id => id >> 2, su = id => id & 3;
  const nat = id => { const r = rk(id); return r <= 10 ? r + 3 : r === 11 ? 1 : 2; }; // A=1 … K=13
  const pts = id => nat(id);

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  // 52 張全部發完；除不盡時，多的牌隨機給幾個人
  function newGame(n) {
    const d = shuffle(Array.from({ length: 52 }, (_, i) => i));
    const hands = Array.from({ length: n }, () => []);
    const extra = shuffle([...Array(n).keys()]);
    const per = Math.floor(52 / n);
    let k = 0;
    for (let p = 0; p < n; p++) hands[p] = d.slice(k, (k += per));
    for (let i = 0; k < 52; i++) hands[extra[i]].push(d[k++]);
    hands.forEach(h => h.sort((a, b) => a - b));
    return {
      n, hands, covered: Array.from({ length: n }, () => []),
      board: [null, null, null, null], // 每個花色 {lo, hi}（自然點數）
      turn: Math.floor(Math.random() * n), // 隨機先出
      over: false, ver: 0, last: null, status: Array(n).fill(null), order: [],
    };
  }

  function canPlay(S, id) {
    const b = S.board[su(id)], v = nat(id);
    if (!b) return v === 7;
    return v === b.lo - 1 || v === b.hi + 1;
  }
  const playable = (S, pi) => S.hands[pi].filter(id => canPlay(S, id));

  function nextTurn(S) {
    if (S.hands.every(h => !h.length)) { finishGame(S); return; }
    for (let k = 1; k <= S.n; k++) {
      const j = (S.turn + k) % S.n;
      if (S.hands[j].length) { S.turn = j; return; }
    }
  }

  function finishGame(S) {
    S.over = true;
    const score = S.covered.map(c => c.reduce((s, id) => s + pts(id), 0));
    S.score = score;
    S.order = [...Array(S.n).keys()].sort((a, b) => score[a] - score[b] || S.covered[a].length - S.covered[b].length || a - b);
  }

  function play(S, pi, id) {
    if (S.over || pi !== S.turn) return { err: '還沒輪到你' };
    if (!S.hands[pi].includes(id)) return { err: '牌不在手上' };
    if (!canPlay(S, id)) return { err: '這張還接不上' };
    S.hands[pi] = S.hands[pi].filter(x => x !== id);
    const s = su(id), v = nat(id);
    const b = S.board[s];
    if (!b) S.board[s] = { lo: 7, hi: 7 };
    else if (v < b.lo) b.lo = v; else b.hi = v;
    S.last = { by: pi, id, cover: false }; S.status[pi] = null; S.ver++;
    nextTurn(S);
    return { id };
  }

  // 能接就一定要出，完全接不上才可以蓋牌
  function cover(S, pi, id) {
    if (S.over || pi !== S.turn) return { err: '還沒輪到你' };
    if (!S.hands[pi].includes(id)) return { err: '牌不在手上' };
    if (playable(S, pi).length) return { err: '有牌可以接，一定要出' };
    S.hands[pi] = S.hands[pi].filter(x => x !== id);
    S.covered[pi].push(id);
    S.last = { by: pi, id: null, cover: true }; S.status[pi] = '蓋牌'; S.ver++;
    nextTurn(S);
    return { cover: true };
  }

  // 電腦：普通會優先打出「後面還有自己的牌」的那張，蓋牌時蓋點數最小的
  function aiChoose(S, pi, diff) {
    const hand = S.hands[pi], ps = playable(S, pi);
    if (!ps.length) {
      const sorted = [...hand].sort((a, b) => pts(a) - pts(b) || a - b);
      return { cover: diff === 'easy' ? hand[Math.floor(Math.random() * hand.length)] : sorted[0] };
    }
    if (diff === 'easy') return { play: ps[Math.floor(Math.random() * ps.length)] };
    let best = ps[0], bv = -Infinity;
    for (const id of ps) {
      const s = su(id), v = nat(id), same = hand.filter(x => su(x) === s && x !== id).map(nat);
      let val;
      if (v === 7) val = same.length * 2 - 3;
      else if (v < 7) val = same.filter(x => x < v).length * 2 + (same.includes(v - 1) ? 2 : 0);
      else val = same.filter(x => x > v).length * 2 + (same.includes(v + 1) ? 2 : 0);
      val += Math.random() * 0.5;
      if (val > bv) { bv = val; best = id; }
    }
    return { play: best };
  }

  const API = { nat, pts, newGame, canPlay, playable, play, cover, aiChoose };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.Seven = API;
})(this);
