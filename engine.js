/* 大老二規則引擎：純邏輯，前端與日後連線房主共用 */
(function (root) {
  const RL = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
  const SU = ['♣︎', '♦︎', '♥︎', '♠︎']; // ♣ ♦ ♥ ♠ 由小到大
  const rk = id => id >> 2, su = id => id & 3;
  const nat = r => (r <= 10 ? r + 3 : r === 11 ? 1 : 2); // 自然點數：A=1、2=2
  const CAT = { single: 0, pair: 0, triple: 0, straight: 1, flush: 2, fullhouse: 3, four: 4, sflush: 5 };
  const NAME = { single: '單張', pair: '對子', triple: '三條', straight: '順子', flush: '同花', fullhouse: '葫蘆', four: '鐵支', sflush: '同花順' };
  const CLUB3 = 0;

  // 順子：A2345 最小，34567…10JQKA，23456 最大；不能繞。同樣的順子比第一張的花色
  function straightInfo(ids) {
    const ns = ids.map(i => nat(rk(i))).sort((a, b) => a - b);
    const k = ns.join(',');
    let first, order;
    if (k === '1,2,3,4,5') { first = 1; order = 0; }
    else if (k === '2,3,4,5,6') { first = 2; order = 11; }
    else if (k === '1,10,11,12,13') { first = 10; order = 10; }
    else {
      for (let i = 1; i < 5; i++) if (ns[i] !== ns[0] + i) return null;
      if (ns[0] < 3 || ns[0] > 9) return null;
      first = ns[0]; order = ns[0];
    }
    const fc = ids.find(i => nat(rk(i)) === first);
    return { order, firstSuit: su(fc) };
  }

  function mk(type, cards, key) {
    return { type, cards, key, size: cards.length, cat: CAT[type], bomb: type === 'four' || type === 'sflush', name: NAME[type] };
  }

  function analyze(ids) {
    const c = [...ids].sort((a, b) => a - b), n = c.length;
    if (!n) return null;
    const cnt = {};
    c.forEach(i => (cnt[rk(i)] = (cnt[rk(i)] || 0) + 1));
    const g = Object.entries(cnt).map(([r, k]) => [+r, k]).sort((a, b) => b[1] - a[1] || b[0] - a[0]);
    if (n === 1) return mk('single', c, [c[0]]);
    if (n === 2) return g.length === 1 ? mk('pair', c, [c[1]]) : null;
        if (n !== 5) return null;
    const flush = c.every(i => su(i) === su(c[0]));
    const st = g.length === 5 ? straightInfo(c) : null;
    if (st && flush) return mk('sflush', c, [st.order, st.firstSuit]);
    if (g[0][1] === 4) return mk('four', c, [g[0][0]]);
    if (g[0][1] === 3 && g[1][1] === 2) return mk('fullhouse', c, [g[0][0]]);
    // 這裡的玩法沒有同花：五張同花色但不是順子，不算牌型
    if (st) return mk('straight', c, [st.order, st.firstSuit]);
    return null;
  }

  function cmpKey(a, b) {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const d = (a[i] ?? -1) - (b[i] ?? -1);
      if (d) return d;
    }
    return 0;
  }

  // 鐵支、同花順是炸彈，可以壓任何牌型；同花順 > 鐵支
  function beats(a, b) {
    if (!a) return false;
    if (!b) return true;
    if (a.bomb && !b.bomb) return true;
    if (b.bomb && !a.bomb) return false;
    if (a.bomb && b.bomb) return a.cat !== b.cat ? a.cat > b.cat : cmpKey(a.key, b.key) > 0;
    if (a.size !== b.size) return false;
    if (a.size === 5 && a.cat !== b.cat) return false; // 順子、同花、葫蘆只能壓同一種牌型
    return cmpKey(a.key, b.key) > 0;
  }

  function kComb(arr, k) {
    const out = [];
    const rec = (s, cur) => {
      if (cur.length === k) { out.push(cur.slice()); return; }
      for (let i = s; i <= arr.length - (k - cur.length); i++) { cur.push(arr[i]); rec(i + 1, cur); cur.pop(); }
    };
    rec(0, []);
    return out;
  }

  function genCombos(hand) {
    const h = [...hand].sort((a, b) => a - b), seen = new Set(), out = [];
    const add = ids => {
      const s = [...ids].sort((a, b) => a - b), k = s.join(',');
      if (seen.has(k)) return;
      const info = analyze(s);
      if (!info) return;
      seen.add(k); out.push(info);
    };
    const byR = {};
    h.forEach(i => (byR[rk(i)] = byR[rk(i)] || []).push(i));
    h.forEach(i => add([i]));
    const pairs = [], trips = [];
    for (const r in byR) {
      const g = byR[r];
      kComb(g, 2).forEach(p => { pairs.push(p); add(p); });
      kComb(g, 3).forEach(t => trips.push(t)); // 三條不能單獨出，只拿來組葫蘆
      if (g.length === 4) h.forEach(k => { if (rk(k) !== +r) add([...g, k]); });
    }
    trips.forEach(t => pairs.forEach(p => { if (rk(p[0]) !== rk(t[0])) add([...t, ...p]); }));
    const byN = {};
    h.forEach(i => (byN[nat(rk(i))] = byN[nat(rk(i))] || []).push(i));
    const pats = [[1, 2, 3, 4, 5], [2, 3, 4, 5, 6], [10, 11, 12, 13, 1]];
    for (let a = 3; a <= 9; a++) pats.push([a, a + 1, a + 2, a + 3, a + 4]);
    pats.forEach(p => {
      if (!p.every(x => byN[x])) return;
      const rec = (i, cur) => {
        if (i === 5) { add(cur); return; }
        byN[p[i]].forEach(c => { cur.push(c); rec(i + 1, cur); cur.pop(); });
      };
      rec(0, []);
    });
    return out;
  }

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

  // 2 人各 26 張；3 人各 17 張，多的 1 張給拿梅花 3 的人；4 人各 13 張
  function deal(n) {
    const d = shuffle(Array.from({ length: 52 }, (_, i) => i));
    const per = Math.floor(52 / n);
    const hands = Array.from({ length: n }, (_, p) => d.slice(p * per, (p + 1) * per));
    const rest = d.slice(n * per);
    if (rest.length) {
      let h = hands.findIndex(x => x.includes(CLUB3));
      if (h < 0) h = Math.floor(Math.random() * n);
      hands[h].push(...rest);
    }
    return hands.map(x => x.sort((a, b) => a - b));
  }

  function newGame(n) {
    const hands = deal(n);
    return {
      n, hands, done: Array(n).fill(false), turn: hands.findIndex(h => h.includes(CLUB3)),
      table: null, lastBy: -1, passes: 0, first: true, order: [], status: Array(n).fill(null), over: false, ver: 0,
    };
  }

  const active = S => [...Array(S.n).keys()].filter(i => !S.done[i]);
  function nextActive(S, i) {
    for (let k = 1; k <= S.n; k++) { const j = (i + k) % S.n; if (!S.done[j]) return j; }
    return -1;
  }

  function validate(S, pi, ids) {
    if (S.over) return '這局已經結束了';
    if (pi !== S.turn) return '還沒輪到你';
    if (!ids.length) return '先點選要出的牌';
    if (!ids.every(i => S.hands[pi].includes(i))) return '牌不在手上';
    const info = analyze(ids);
    if (!info) return '這不是合法牌型';
    if (S.first && !ids.includes(CLUB3)) return '第一手要包含梅花 3';
    if (S.table && !beats(info, S.table.info)) {
      const t = S.table.info;
      if (t.bomb && !info.bomb) return '對方是炸彈，只有更大的炸彈壓得過';
      if (t.size !== info.size && !info.bomb) return `要出 ${t.size} 張的牌型`;
      if (t.size === 5 && t.type !== info.type) return `要用${t.name}壓（或炸彈）`;
      return '壓不過喔';
    }
    return null;
  }

  function advance(S) {
    const act = active(S);
    const needed = act.length - (S.done[S.lastBy] ? 0 : 1);
    if (S.table && S.passes >= needed) {
      S.table = null; S.passes = 0; S.status = S.status.map(() => null);
      S.turn = S.done[S.lastBy] ? nextActive(S, S.lastBy) : S.lastBy;
      S.ver++;
    } else S.turn = nextActive(S, S.turn);
  }

  function play(S, pi, ids) {
    const err = validate(S, pi, ids);
    if (err) return { err };
    const info = analyze(ids);
    S.hands[pi] = S.hands[pi].filter(i => !ids.includes(i));
    S.table = { info, by: pi }; S.lastBy = pi; S.passes = 0; S.first = false; S.status[pi] = null; S.ver++;
    const ev = { info, last: S.hands[pi].length === 1, finished: false };
    if (!S.hands[pi].length) { S.done[pi] = true; S.order.push(pi); ev.finished = true; }
    const act = active(S);
    if (act.length <= 1) { act.forEach(i => { S.done[i] = true; S.order.push(i); }); S.over = true; return ev; }
    advance(S);
    return ev;
  }

  function pass(S, pi) {
    if (S.over || pi !== S.turn) return { err: '還沒輪到你' };
    if (!S.table) return { err: '輪到你先出，不能過' };
    S.passes++; S.status[pi] = '過';
    advance(S);
    return {};
  }

  function legal(S, pi) {
    const t = S.table ? S.table.info : null;
    let cs = genCombos(S.hands[pi]).filter(c => beats(c, t));
    if (S.first) cs = cs.filter(c => c.cards.includes(CLUB3));
    return cs;
  }

  const baseStrength = c =>
    c.size === 5 ? 60 + c.cat * 14 + (c.type === 'flush' ? c.key[0] / 4 : c.key[0]) : c.type === 'triple' ? c.key[0] * 4 : c.key[0];

  // 電腦出牌。easy：能壓就出最小的；normal：會留 2 和炸彈、少拆對子，有人快沒牌時改打大的
  /* 困難：先把整手牌規劃成「最少手數」的組合（五張牌型、對子、單張），
     出牌盡量照規劃走，不亂拆牌；最後幾手才用大牌搶回出牌權 */
  function planHand(hand) {
    const fives = genCombos(hand).filter(c => c.size === 5).sort((a, b) => baseStrength(a) - baseStrength(b));
    let best = null;
    const rest = (h) => {
      const byR = {}; h.forEach(i => (byR[rk(i)] = byR[rk(i)] || []).push(i));
      const out = [];
      Object.values(byR).forEach(g => { g.sort((a, b) => a - b);
        if (g.length >= 2) { out.push(analyze(g.slice(-2))); if (g.length === 3) out.push(analyze([g[0]])); if (g.length === 4) out.push(analyze(g.slice(0, 2))); }
        else out.push(analyze(g)); });
      return out;
    };
    const score = combos => combos.length * 10 + combos.filter(c => c.size === 1 && c.key[0] < 32).length * 2;
    let nodes = 0;
    const rec = (start, used, chosen) => {
      if (++nodes > 400) return;
      const left = hand.filter(i => !used.has(i));
      const combos = chosen.concat(rest(left));
      const sc = score(combos);
      if (!best || sc < best.sc) best = { sc, combos };
      if (chosen.length >= 3) return;
      for (let k = start; k < fives.length; k++) {
        const f = fives[k]; if (f.cards.some(i => used.has(i))) continue;
        f.cards.forEach(i => used.add(i)); chosen.push(f); rec(k + 1, used, chosen); chosen.pop(); f.cards.forEach(i => used.delete(i));
      }
    };
    rec(0, new Set(), []);
    return best.combos;
  }
  const isControl = c => c.bomb || c.cards.some(i => rk(i) === 12) || (c.size === 1 && c.key[0] >= 44);
  function aiHard(S, pi) {
    const hand = S.hands[pi], cs = legal(S, pi);
    if (!cs.length) return null;
    const fin = cs.find(c => c.size === hand.length); if (fin) return fin.cards;
    const plan = planHand(hand), key = c => [...c.cards].sort((a, b) => a - b).join();
    const planKeys = new Set(plan.map(key));
    const opp = active(S).filter(i => i !== pi), oppMin = Math.min(...opp.map(i => S.hands[i].length));
    const inPlan = cs.filter(c => planKeys.has(key(c))).sort((a, b) => baseStrength(a) - baseStrength(b));
    if (!S.table) {
      // 剩兩手且其中一手是大牌：先出大牌搶回來，再出另一手
      if (plan.length === 2) { const ctl = plan.find(isControl); if (ctl && inPlan.some(c => key(c) === key(ctl))) return ctl.cards; }
      let pool = inPlan.filter(c => !isControl(c));
      if (!pool.length) pool = inPlan;
      if (oppMin === 1) { const multi = pool.filter(c => c.size > 1); if (multi.length) pool = multi; else return pool[pool.length - 1].cards; }
      // 先清掉五張、對子這些「一次走多張」的牌，同樣大小時出小的
      pool.sort((a, b) => (baseStrength(a) - a.size * 8) - (baseStrength(b) - b.size * 8));
      return (pool[0] || cs[0]).cards;
    }
    if (inPlan.length) {
      const pick = inPlan.find(c => !isControl(c)) || inPlan[0];
      if (!isControl(pick) || plan.length <= 3 || oppMin <= 3) return pick.cards;
    }
    if (oppMin <= 2 || active(S).length === 2) return aiChoose(S, pi, 'normal');
    return null;
  }
  function aiChoose(S, pi, diff) {
    if (diff === 'hard') return aiHard(S, pi);
    const hand = S.hands[pi];
    const cs = legal(S, pi);
    if (!cs.length) return null;
    const fin = cs.find(c => c.size === hand.length);
    if (fin) return fin.cards;
    const leading = !S.table;
    const oppMin = Math.min(...active(S).filter(i => i !== pi).map(i => S.hands[i].length));
    const danger = oppMin <= 2;
    const byR = {};
    hand.forEach(i => (byR[rk(i)] = (byR[rk(i)] || 0) + 1));
    const low = Math.min(...hand);
    let best = null, bestV = Infinity, bestPen = 0;
    for (const c of cs) {
      let v = baseStrength(c), pen = 0;
      if (diff === 'easy') v += Math.random() * 10;
      else {
        const used = {};
        c.cards.forEach(i => (used[rk(i)] = (used[rk(i)] || 0) + 1));
        for (const r in used) if (used[r] < byR[r]) pen += c.size < 5 ? 10 : 4;
        if (!danger) { pen += c.cards.filter(i => rk(i) === 12).length * 25; if (c.bomb) pen += 70; }
        if (leading) {
          v -= c.size * 6;
          if (!c.cards.includes(low)) v += 18;
          if (danger && c.size === 1) v = 140 - c.key[0];
        } else if (danger && oppMin === 1 && c.size === 1) v = 60 - c.key[0];
      }
      if (v + pen < bestV) { bestV = v + pen; best = c; bestPen = pen; }
    }
    if (diff !== 'easy' && !leading && !danger && bestPen >= 25 && hand.length > 5) return null;
    return best.cards;
  }

  const API = { planHand, RL, SU, rk, su, nat, CLUB3, analyze, beats, genCombos, deal, newGame, validate, play, pass, legal, aiChoose, nextActive, baseStrength };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.BigTwo = API;
})(this);
