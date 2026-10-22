/* 排七規則引擎：純邏輯，前端與日後連線房主共用 */
(function (root) {
  const rk = id => id >> 2, su = id => id & 3;
  const nat = id => { const r = rk(id); return r <= 10 ? r + 3 : r === 11 ? 1 : 2; }; // A=1 … K=13
  const pts = id => nat(id);

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
      turn: randInt(n), // 隨機先出
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
  /* ---------- 電腦 ----------
     強化版思路：
     1. 出牌：優先出「後面接的是自己的牌」的那張，盡量不要幫別人開路；
        手上同花色牌多的 7 先出，同花色只有自己沒牌的 7 能拖就拖。
     2. 蓋牌：不只挑點數小的，還會挑「蓋了能卡死別人」的牌——
        蓋掉一張 6，其他人手上的 5、4、3… 就永遠接不上，只能一起蓋。 */
  function beyond(v, dir) { const out = []; if (dir < 0) for (let x = v - 1; x >= 1; x--) out.push(x); else for (let x = v + 1; x <= 13; x++) out.push(x); return out; }
  const W = { my: 3, myPts: 0.15, next: 3, opp: 0.6, oppPts: 0.08, dead: 2, seven: 4, block: 1 };
  /* 困難：蒙地卡羅模擬。只用自己看得到的資訊（自己的手牌、桌面、自己蓋的牌、別人剩幾張），
     把看不到的牌隨機分給對手很多次，每個候選出法都模擬打完整局，選平均名次最好、蓋牌點數最少的 */
  function aiHard(S, pi, rolls) {
    const hand = S.hands[pi], ps = playable(S, pi);
    let cands;
    if (ps.length) cands = ps.map(id => ({ play: id }));
    else {
      // 蓋牌候選：先用普通版的算法挑出最好的幾張
      cands = hand.slice().sort((a, b) => pts(a) - pts(b)).slice(0, 4).map(id => ({ cover: id }));
      const nc = aiChoose(S, pi, 'normal').cover; if (!cands.some(c => c.cover === nc)) cands.push({ cover: nc });
    }
    if (cands.length === 1) return cands[0];
    const known = new Set(hand.concat(S.covered[pi]));
    for (let s = 0; s < 4; s++) { const b = S.board[s]; if (b) for (let v = b.lo; v <= b.hi; v++) known.add(idOf(s, v)); }
    const unknown = []; for (let id = 0; id < 52; id++) if (!known.has(id)) unknown.push(id);
    const R = rolls || 40;
    // 每個候選用同一批隨機發牌來比（共同隨機數），比較才公平、雜訊小
    const deals = Array.from({ length: R }, () => shuffle(unknown.slice()));
    let best = null, bv = Infinity;
    for (const c of cands) {
      let tot = 0;
      for (let r = 0; r < R; r++) {
        const pool = deals[r].slice();
        const T = { n: S.n, hands: [], covered: [], board: S.board.map(b => (b ? { lo: b.lo, hi: b.hi } : null)), turn: pi, over: false, ver: 0, last: null, status: new Array(S.n).fill(null), order: [] };
        for (let q = 0; q < S.n; q++) {
          if (q === pi) { T.hands.push(hand.slice()); T.covered.push(S.covered[pi].slice()); continue; }
          T.hands.push(pool.splice(0, S.hands[q].length)); T.covered.push(pool.splice(0, S.covered[q].length));
        }
        if (c.play != null) play(T, pi, c.play); else cover(T, pi, c.cover);
        let guard = 0;
        while (!T.over && guard++ < 200) { const q = T.turn, m = aiChoose(T, q, 'normal'); if (m.play != null) play(T, q, m.play); else cover(T, q, m.cover); }
        const others = T.score.reduce((a2, v, q) => a2 + (q === pi ? 0 : v), 0) / Math.max(1, S.n - 1);
        tot += HARD_OBJ === 'rank' ? T.order.indexOf(pi) * 100 + T.score[pi] : HARD_OBJ === 'pts' ? T.score[pi] : T.score[pi] - others;
      }
      const v = tot / R;
      if (v < bv) { bv = v; best = c; }
    }
    return best;
  }
  let HARD_OBJ = 'rel';
  const idOf = (s, v) => (v <= 2 ? (v === 1 ? 11 : 12) : v - 3) * 4 + s;
  function aiChoose(S, pi, diff, w) {
    if (diff === 'hard') return aiHard(S, pi);
    w = w || W;
    const hand = S.hands[pi], ps = playable(S, pi);
    if (diff === 'easy') {
      if (!ps.length) return { cover: hand[Math.floor(Math.random() * hand.length)] };
      return { play: ps[Math.floor(Math.random() * ps.length)] };
    }
    const mine = (s, v) => hand.some(x => su(x) === s && nat(x) === v);
    const onBoard = (s, v) => { const b = S.board[s]; return b && v >= b.lo && v <= b.hi; };
    const myCov = S.covered[pi];
    // 還沒出現的牌（不在我手上、不在桌上、不是我蓋的）＝可能在別人手上
    const unseen = (s, v) => !mine(s, v) && !onBoard(s, v) && !myCov.some(x => su(x) === s && nat(x) === v);
    // 某個方向：我的牌各差幾步、別人可能有幾張
    function side(s, v, dir) {
      let myPts = 0, myN = 0, oppN = 0, oppPts = 0, gap = 0, firstMine = null;
      for (const x of beyond(v, dir)) {
        if (mine(s, x)) { myN++; myPts += x; if (firstMine == null) firstMine = gap; }
        else if (unseen(s, x)) { oppN++; oppPts += x; }
        gap++;
      }
      return { myN, myPts, oppN, oppPts, firstMine };
    }
    if (ps.length) {
      let best = null, bv = -Infinity;
      for (const id of ps) {
        const s = su(id), v = nat(id);
        const dirs = v === 7 ? [-1, 1] : [v < 7 ? -1 : 1];
        let val = 0;
        for (const d of dirs) {
          const sd = side(s, v, d);
          val += sd.myN * w.my + sd.myPts * w.myPts;          // 幫自己開路
          if (sd.firstMine === 0) val += w.next;              // 下一張就是自己的，可以連著出
          val -= sd.oppN * w.opp + sd.oppPts * w.oppPts;       // 幫別人開路要扣分
          if (sd.oppN === 0) val += w.dead;                   // 這條路沒人能接，出了不吃虧
        }
        if (v === 7 && dirs.every(d => side(s, v, d).myN === 0)) val -= w.seven; // 這門花色我沒牌，7 能拖就拖
        val += Math.random() * 0.3;
        if (val > bv) { bv = val; best = id; }
      }
      return { play: best };
    }
    // 蓋牌：挑「讓別人蓋最多、自己蓋最少」的那張
    //   自己要蓋的點數 ＝ 這張 ＋ 我手上被它卡死的牌（之後也只能蓋）
    //   別人要蓋的點數 ＝ 被它卡死、還沒出現的牌的點數 × 這些牌還在別人手上的機率
    //   （沒出現的牌也可能早就被別人蓋掉了，那些不會再多扣別人分數）
    const othersHand = S.hands.reduce((a, h, i) => a + (i === pi ? 0 : h.length), 0);
    const othersCov = S.covered.reduce((a, c, i) => a + (i === pi ? 0 : c.length), 0);
    const inHand = othersHand + othersCov ? othersHand / (othersHand + othersCov) : 0;
    const opps = Math.max(1, S.hands.filter((h, i) => i !== pi && h.length).length);
    let best = null, bc = Infinity;
    for (const id of hand) {
      const s = su(id), v = nat(id);
      const dirs = v === 7 ? [-1, 1] : [v < 7 ? -1 : 1];
      let mine = v, theirs = 0;
      for (const d of dirs) {
        const sd = side(s, v, d);
        mine += sd.myPts;
        theirs += sd.oppPts * inHand;
      }
      // 名次是跟每個對手一一比：卡人的點數會分攤到好幾個對手身上，自己蓋的點數卻是全扣在自己身上
      const score = mine * opps - theirs * w.block + Math.random() * 0.2;
      if (score < bc) { bc = score; best = id; }
    }
    return { cover: best };
  }
  // 舊版電腦（測試對照用）
  function aiOld(S, pi) {
    const hand = S.hands[pi], ps = playable(S, pi);
    if (!ps.length) return { cover: [...hand].sort((a, b) => pts(a) - pts(b) || a - b)[0] };
    let best = ps[0], bv = -Infinity;
    for (const id of ps) {
      const s = su(id), v = nat(id), same = hand.filter(x => su(x) === s && x !== id).map(nat);
      let val = v === 7 ? same.length * 2 - 3 : v < 7 ? same.filter(x => x < v).length * 2 + (same.includes(v - 1) ? 2 : 0) : same.filter(x => x > v).length * 2 + (same.includes(v + 1) ? 2 : 0);
      val += Math.random() * 0.5;
      if (val > bv) { bv = val; best = id; }
    }
    return { play: best };
  }


  const API = { setObj: o => { HARD_OBJ = o; }, W, nat, pts, newGame, canPlay, playable, play, cover, aiChoose, aiOld };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.Seven = API;
})(this);
