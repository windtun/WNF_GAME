/* 吹牛骰子（大話骰）：每人 5 顆骰子、3 條命。
   輪流喊「N 個 X」，下一個人要喊更大，或「開」。
   1 是萬用（算任何點數），但有人喊過「1」之後，這一輪 1 就不再萬用。
   點數大小：2 < 3 < 4 < 5 < 6 < 1。
   開了之後全部掀開數：夠就是喊的人贏、開的人扣命；不夠就是喊的人扣命。命扣光就出局，剩最後一個人贏。 */
(function (root) {
  const DICE = 5, LIVES = 3;
  function randInt(n) {
    try { const a = new Uint32Array(1), lim = Math.floor(0x100000000 / n) * n; let x; do { crypto.getRandomValues(a); x = a[0]; } while (x >= lim); return x % n; }
    catch (e) { return Math.floor(Math.random() * n); }
  }
  const RANK = f => (f === 1 ? 7 : f); // 1 最大
  const alive = S => S.lives.map((l, i) => (l > 0 ? i : -1)).filter(i => i >= 0);
  const nextAlive = (S, p) => { for (let k = 1; k <= S.n; k++) { const q = (p + k) % S.n; if (S.lives[q] > 0) return q; } return p; };
  const totalDice = S => alive(S).length * DICE;
  const minQ = S => Math.max(2, alive(S).length);

  function roll(S) {
    S.dice = S.lives.map(l => (l > 0 ? Array.from({ length: DICE }, () => randInt(6) + 1).sort((a, b) => a - b) : []));
    S.bid = null; S.ones = true; S.phase = 'bid'; S.bids = []; S.status = new Array(S.n).fill(null); S.reveal = null; S.round++;
  }
  function newGame(n) {
    const S = { n, lives: new Array(n).fill(LIVES), dice: [], bid: null, ones: true, phase: 'bid', bids: [], status: [], reveal: null,
      round: 0, turn: randInt(n), over: false, ver: 0, order: [], outOrder: [], last: null };
    roll(S);
    return S;
  }
  function validBid(S, q, f) {
    q = q | 0; f = f | 0;
    if (f < 1 || f > 6 || q < 1 || q > totalDice(S)) return '數量或點數不對';
    if (!S.bid) return q >= minQ(S) ? null : `第一口至少喊 ${minQ(S)} 個`;
    if (q > S.bid.q) return null;
    if (q === S.bid.q && RANK(f) > RANK(S.bid.f)) return null;
    return '要喊比上一個人大：數量更多，或同數量點數更大（1 最大）';
  }
  function bid(S, p, q, f) {
    if (S.over || S.phase !== 'bid' || S.turn !== p) return { err: '還沒輪到你' };
    const e = validBid(S, q, f); if (e) return { err: e };
    S.bid = { q: q | 0, f: f | 0, by: p }; if ((f | 0) === 1) S.ones = false;
    S.bids.push({ q: q | 0, f: f | 0, by: p });
    S.status[p] = `${q} 個 ${f}`;
    S.turn = nextAlive(S, p); S.ver++;
    return { ok: true };
  }
  function countOf(S, f, ones) { let c = 0; S.dice.forEach(d => d.forEach(v => { if (v === f || (ones && f !== 1 && v === 1)) c++; })); return c; }
  function challenge(S, p) {
    if (S.over || S.phase !== 'bid' || S.turn !== p) return { err: '還沒輪到你' };
    if (!S.bid) return { err: '還沒有人喊，不能開' };
    const b = S.bid, cnt = countOf(S, b.f, S.ones), ok = cnt >= b.q, loser = ok ? p : b.by;
    S.lives[loser]--;
    S.reveal = { by: p, bid: Object.assign({}, b), ones: S.ones, count: cnt, ok, loser, dice: S.dice.map(d => d.slice()) };
    S.status[p] = '開！';
    if (S.lives[loser] <= 0) S.outOrder.push(loser);
    S.phase = 'reveal'; S.last = loser; S.ver++;
    const al = alive(S);
    if (al.length <= 1) { S.over = true; S.order = al.concat(S.outOrder.slice().reverse()); }
    return { ok: true, loser, count: cnt, win: !ok };
  }
  // 掀完骰之後下一輪：輸的人先喊（出局就換下一個）
  function nextRound(S) {
    if (S.over || S.phase !== 'reveal') return;
    const st = S.lives[S.last] > 0 ? S.last : nextAlive(S, S.last);
    roll(S); S.turn = st; S.ver++;
  }

  /* ---------- 電腦 ---------- */
  // P(X >= k)，X ~ Bin(n, p)
  function tail(n, p, k) {
    if (k <= 0) return 1; if (k > n) return 0;
    let s = 0, c = 1, pk = Math.pow(1 - p, n);
    for (let i = 0; i <= n; i++) { if (i >= k) s += pk * c; c = c * (n - i) / (i + 1); pk = pk * p / (1 - p); }
    return Math.min(1, s);
  }
  // 從 p 的角度：這個喊價成立的機率
  function belief(S, p, q, f, ones, bonus) {
    const mine = S.dice[p].filter(v => v === f || (ones && f !== 1 && v === 1)).length;
    const unknown = totalDice(S) - S.dice[p].length;
    const pr = ones && f !== 1 ? 1 / 3 : 1 / 6;
    const extra = Math.round((bonus && bonus[f]) || 0);
    return tail(unknown, pr, q - mine - extra);
  }
  // 困難：別人喊過的點數，推測他手上有那種
  function hints(S, p) {
    const b = {}; S.bids.forEach(x => { if (x.by !== p) b[x.f] = (b[x.f] || 0) + 0.7; });
    Object.keys(b).forEach(k => { b[k] = Math.min(2, b[k]); }); return b;
  }
  function candidates(S) {
    const out = [], tot = totalDice(S), b = S.bid;
    const startQ = b ? b.q : minQ(S);
    for (let q = startQ; q <= Math.min(tot, startQ + 3); q++) for (let f = 1; f <= 6; f++) if (!validBid(S, q, f)) out.push({ q, f });
    return out;
  }
  function aiChoose(S, p, diff) {
    diff = diff || 'normal';
    const bonus = diff === 'hard' ? hints(S, p) : null;
    const noise = diff === 'easy' ? 0.4 : diff === 'hard' ? 0.04 : 0.1;
    const rnd = () => (Math.random() - 0.5) * 2 * noise;
    const cands = candidates(S);
    let best = null, bv = -1;
    cands.forEach(c => {
      const ones = S.ones && c.f !== 1;
      let v = belief(S, p, c.q, c.f, ones, bonus) + rnd();
      // 小小偏好：喊自己手上多的點數；數量跳太多扣一點
      if (S.bid) v -= (c.q - S.bid.q) * 0.04;
      if (v > bv) { bv = v; best = c; }
    });
    if (!S.bid) {
      if (!best) best = { q: minQ(S), f: 6 };
      // 唬人：偶爾喊自己沒有的
      if (diff !== 'easy' && Math.random() < 0.12) { const f = 2 + randInt(5); if (!validBid(S, minQ(S), f)) best = { q: minQ(S), f }; }
      return { t: 'bid', q: best.q, f: best.f };
    }
    const cur = belief(S, p, S.bid.q, S.bid.f, S.ones && S.bid.f !== 1, bonus);
    const openWin = 1 - cur + rnd();
    const thr = diff === 'easy' ? 0.05 : diff === 'hard' ? 0.02 : 0.03;
    if (!best || openWin > bv + thr) return { t: 'open' };
    return { t: 'bid', q: best.q, f: best.f };
  }

  const API = { newGame, validBid, bid, challenge, nextRound, aiChoose, alive, totalDice, minQ, countOf, RANK, DICE, LIVES, belief };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.Dice = API;
})(this);
