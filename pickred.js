/* 撿紅點：2～4 人，52 張。2 人每人 12 張、3 人 8 張、4 人 6 張，桌上翻開 4 張，其他當牌堆。
   輪到你：出一張手牌，跟桌上的牌湊對就撿走（A～9 兩張加起來 10；10、J、Q、K 要同點數），湊不到就放到桌上。
   接著翻牌堆最上面一張，能湊對也撿走，不能就留在桌上。
   計分只算紅色（♥♦）：A 20 分、2～9 照點數、10 J Q K 各 10 分，黑色 0 分。手牌出完結束，分數高的贏。
   牌的編號跟大老二一樣：id>>2 是點數（0=3 … 10=K, 11=A, 12=2），id&3 是花色（1、2 是紅色）。 */
(function (root) {
  const DEAL = { 2: 12, 3: 8, 4: 6 };
  function randInt(n) {
    try { const a = new Uint32Array(1), lim = Math.floor(0x100000000 / n) * n; let x; do { crypto.getRandomValues(a); x = a[0]; } while (x >= lim); return x % n; }
    catch (e) { return Math.floor(Math.random() * n); }
  }
  const nat = id => { const r = id >> 2; return r <= 10 ? r + 3 : r === 11 ? 1 : 2; }; // A=1 … K=13
  const red = id => { const s = id & 3; return s === 1 || s === 2; };
  const pts = id => (!red(id) ? 0 : nat(id) === 1 ? 20 : nat(id) >= 10 ? 10 : nat(id));
  const pairs = (a, b) => { const x = nat(a), y = nat(b); return x >= 10 ? x === y : y < 10 && x + y === 10; };
  const NAMES = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

  function newGame(n) {
    const deck = Array.from({ length: 52 }, (_, i) => i);
    for (let i = 51; i > 0; i--) { const j = randInt(i + 1); [deck[i], deck[j]] = [deck[j], deck[i]]; }
    const k = DEAL[n] || 6, hands = [];
    for (let p = 0; p < n; p++) hands.push(deck.splice(0, k).sort((a, b) => nat(a) - nat(b) || a - b));
    const table = deck.splice(0, 4);
    return { n, hands, table, pile: deck, taken: hands.map(() => []), turn: randInt(n), over: false, ver: 0, order: [], last: null, score: null, status: new Array(n).fill(null) };
  }
  const matches = (S, id) => S.table.filter(t => pairs(id, t));
  const bestOf = list => list.slice().sort((a, b) => pts(b) - pts(a) || a - b)[0];
  const scoreOf = (S, p) => S.taken[p].reduce((a, id) => a + pts(id), 0);
  function play(S, p, card, target) {
    if (S.over || S.turn !== p) return { err: '還沒輪到你' };
    card = card | 0;
    const h = S.hands[p], hi = h.indexOf(card); if (hi < 0) return { err: '你沒有這張牌' };
    const ms = matches(S, card);
    let took = null;
    if (ms.length) {
      const t = target != null && ms.includes(target | 0) ? target | 0 : bestOf(ms);
      h.splice(hi, 1); S.table.splice(S.table.indexOf(t), 1); S.taken[p].push(card, t); took = t;
    } else { h.splice(hi, 1); S.table.push(card); }
    // 翻牌堆
    let flip = null, ftook = null;
    if (S.pile.length) {
      flip = S.pile.shift();
      const fm = matches(S, flip);
      if (fm.length) { ftook = bestOf(fm); S.table.splice(S.table.indexOf(ftook), 1); S.taken[p].push(flip, ftook); }
      else S.table.push(flip);
    }
    const gain = (took != null ? pts(card) + pts(took) : 0) + (ftook != null ? pts(flip) + pts(ftook) : 0);
    S.last = { by: p, card, took, flip, ftook, gain };
    S.status[p] = gain ? `+${gain}` : (took != null || ftook != null ? '撿到黑牌' : '沒撿到');
    S.turn = (p + 1) % S.n; S.ver++;
    if (S.hands.every(x => !x.length)) {
      S.over = true; S.score = S.taken.map((_, i) => scoreOf(S, i));
      S.order = S.taken.map((_, i) => i).sort((a, b) => S.score[b] - S.score[a] || S.taken[b].length - S.taken[a].length || a - b);
    }
    return { ok: true, gain };
  }

  /* ---------- 電腦 ---------- */
  // 還沒看過的牌（別人的手牌＋牌堆），從 p 的角度
  function unseen(S, p) {
    const seen = new Set(S.hands[p].concat(S.table)); S.taken.forEach(t => t.forEach(x => seen.add(x)));
    const out = []; for (let i = 0; i < 52; i++) if (!seen.has(i)) out.push(i); return out;
  }
  function aiChoose(S, p, diff) {
    diff = diff || 'normal';
    const h = S.hands[p]; if (!h.length) return null;
    const un = unseen(S, p), U = un.length || 1;
    // 某張牌留在桌上，被別人撿走的風險（還有幾張搭檔沒出現）
    const partnersLeft = id => un.filter(x => pairs(id, x)).length;
    const opps = S.n - 1;
    const risk = id => { const pl = partnersLeft(id); return pl ? Math.min(1, pl * (opps * 3 + 2) / U) : 0; };
    let best = null, bv = -Infinity;
    h.forEach(c => {
      const ms = matches(S, c);
      if (ms.length) ms.forEach(t => {
        let v = 1 + pts(c) + pts(t) * 1.05;
        if (diff === 'hard') {
          // 撿走之後，桌上剩下的紅牌還會不會被下家撿
          const left = S.table.filter(x => x !== t);
          v -= left.reduce((a, x) => a + pts(x) * risk(x) * 0.25, 0);
          v += pts(t) * risk(t) * 0.3; // 搶先撿走別人可能要的
        }
        if (v > bv) { bv = v; best = { card: c, target: t }; }
      });
      else {
        let v = -(pts(c) * (diff === 'easy' ? 0.5 : 1) * risk(c)) - (diff === 'hard' ? 0.6 * risk(c) : 0.2 * risk(c));
        // 留著能撿桌上紅牌的牌，先丟用不到的
        if (diff !== 'easy') { const futureUse = un.filter(x => pairs(c, x)).reduce((a, x) => a + pts(x), 0) / U; v -= futureUse * 0.3; }
        if (v > bv) { bv = v; best = { card: c, target: null }; }
      }
    });
    if (diff === 'easy' && Math.random() < 0.25) { const c = h[randInt(h.length)]; const ms = matches(S, c); return { card: c, target: ms.length ? ms[randInt(ms.length)] : null }; }
    return best;
  }

  const API = { DEAL, newGame, play, matches, pairs, pts, nat, red, aiChoose, scoreOf, NAMES };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.PickRed = API;
})(this);
