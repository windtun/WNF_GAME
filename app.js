/* 牌搭子：畫面 + 房主（遊戲邏輯在房主手機上跑）+ 連線 */
(function(){
const B = window.BigTwo, X = window.Seven, K = window.Blokus, R = window.Rummi, DC = window.Dice, CC = window.DarkChess, PR = window.PickRed;
const $ = id => document.getElementById(id);
const store = {
  get(k, d){ try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; }catch(e){ return d; } },
  set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
};
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ---------- 音效（程式合成，不用外部檔案） ---------- */
const Snd = {
  ctx:null, on: store.get('jk_sound', true),
  init(){ try{ if(!this.ctx) this.ctx = new (window.AudioContext||window.webkitAudioContext)(); if(this.ctx.state==='suspended') this.ctx.resume(); }catch(e){} },
  tone(f, d, o={}){ if(!this.on||!this.ctx) return; const c=this.ctx, t=c.currentTime+(o.at||0);
    const os=c.createOscillator(), g=c.createGain(); os.type=o.type||'sine'; os.frequency.setValueAtTime(f,t);
    if(o.to) os.frequency.exponentialRampToValueAtTime(o.to,t+d);
    g.gain.setValueAtTime(.0001,t); g.gain.exponentialRampToValueAtTime(o.vol||.15,t+.012); g.gain.exponentialRampToValueAtTime(.0001,t+d);
    os.connect(g).connect(c.destination); os.start(t); os.stop(t+d+.03); },
  noise(d, o={}){ if(!this.on||!this.ctx) return; const c=this.ctx, t=c.currentTime+(o.at||0);
    const buf=c.createBuffer(1, Math.ceil(c.sampleRate*d), c.sampleRate), ch=buf.getChannelData(0);
    for(let i=0;i<ch.length;i++) ch[i]=Math.random()*2-1;
    const src=c.createBufferSource(), f=c.createBiquadFilter(), g=c.createGain();
    src.buffer=buf; f.type='bandpass'; f.frequency.value=o.freq||2000; f.Q.value=o.q||.8;
    g.gain.setValueAtTime(o.vol||.2,t); g.gain.exponentialRampToValueAtTime(.0001,t+d);
    src.connect(f).connect(g).connect(c.destination); src.start(t); },
  tap(){ this.tone(1300,.05,{type:'triangle',vol:.07}); },
  play(){ this.noise(.13,{freq:2600,vol:.28}); this.tone(560,.08,{type:'triangle',vol:.08,at:.05}); },
  pass(){ this.tone(330,.09,{type:'square',vol:.04}); this.tone(247,.12,{type:'square',vol:.04,at:.1}); },
  turn(){ this.tone(880,.12,{vol:.12}); this.tone(1320,.2,{vol:.1,at:.1}); },
  deal(){ for(let i=0;i<12;i++) this.noise(.05,{freq:3200,vol:.14,at:i*.055}); },
  bomb(){ this.tone(170,.7,{type:'sawtooth',vol:.14,to:40}); this.noise(.55,{freq:500,vol:.45}); },
  last(){ [660,880,660,880].forEach((f,i)=>this.tone(f,.09,{type:'square',vol:.05,at:i*.1})); },
  tile(){ this.tone(1900,.03,{type:'square',vol:.04}); this.noise(.07,{freq:1400,vol:.3,q:2}); },
  emo(){ this.tone(520,.09,{type:'triangle',vol:.12,to:880}); this.tone(990,.12,{type:'triangle',vol:.1,at:.09,to:1320}); },
  join(){ [660,990].forEach((f,i)=>this.tone(f,.14,{type:'triangle',vol:.1,at:i*.09})); },
  win(){ [523,659,784,1047,1319].forEach((f,i)=>this.tone(f,.24,{type:'triangle',vol:.13,at:i*.11})); },
  lose(){ [440,370,311,262].forEach((f,i)=>this.tone(f,.26,{type:'triangle',vol:.11,at:i*.17})); },
  err(){ this.tone(210,.12,{type:'square',vol:.05}); }
};

/* ---------- 頭像 ---------- */
/* ---------- 頭像：原創 Q 版動漫角色 ---------- */
const PAL = {
  pup:    {hair:'#F0453A', dark:'#A8231F', eye:'#F0453A', style:'spiky', shirt:'#1F3A93', mouth:'grin'},
  frog:   {hair:'#FF9D2E', dark:'#D06A0A', eye:'#22A2F2', style:'twin',  shirt:'#FF4F8B', mouth:'open', acc:'star'},
  chick:  {hair:'#3B5BDB', dark:'#22358F', eye:'#3B5BDB', style:'short', shirt:'#F2F4FF', mouth:'smile', acc:'glasses'},
  cat:    {hair:'#FF7EB8', dark:'#D2508C', eye:'#9B3CE0', style:'bob',   shirt:'#FFFFFF', mouth:'cat', acc:'catears'},
  bear:   {hair:'#2B2645', dark:'#120F22', eye:'#E33A4F', style:'cool',  shirt:'#3C3A52', mouth:'line'},
  bunny:  {hair:'#E9ECF7', dark:'#A9AFCA', eye:'#E33A4F', style:'long',  shirt:'#5C6BC0', mouth:'smile', acc:'bunny'},
  panda:  {hair:'#2B2645', dark:'#120F22', hair2:'#FFFFFF', eye:'#13B987', style:'twin2', shirt:'#13B987', mouth:'open', acc:'mic'},
  fox:    {hair:'#F6B23B', dark:'#C77A10', eye:'#E0531F', style:'long',  shirt:'#FFFFFF', mouth:'smile', acc:'foxears', ribbon:'#E33A4F'},
  penguin:{hair:'#8FE3FF', dark:'#3BA9D6', eye:'#2E7FD9', style:'cool',  shirt:'#E9F6FF', mouth:'line', acc:'crown'},
  tiger:  {hair:'#FFD23F', dark:'#D89B08', eye:'#FF8A1F', style:'spiky', shirt:'#2B2645', mouth:'grin', acc:'horns'},
};
const AV_INK = '#1B1B3A', AV_SKIN = '#FFE4D2';
function avatar(k){
  const c = PAL[k] || PAL.pup, I = AV_INK, st = `stroke="${I}" stroke-width="2.2" stroke-linejoin="round"`;
  let back='', top='', front='', acc='', over0='';
  // 後面的頭髮
  if(c.style==='long') back = `<path d="M15 38 Q12 70 22 76 L58 76 Q68 70 65 38 Z" fill="${c.dark}" ${st}/>`;
  if(c.style==='bob')  back = `<path d="M14 40 Q12 64 24 66 L56 66 Q68 64 66 40 Z" fill="${c.dark}" ${st}/>`;
  if(c.style==='twin') back = `<path d="M17 30 Q2 44 8 66 Q14 58 16 48Z" fill="${c.hair}" ${st}/><path d="M63 30 Q78 44 72 66 Q66 58 64 48Z" fill="${c.hair}" ${st}/>`;
  if(c.style==='twin2') back = `<path d="M17 30 Q2 44 8 66 Q14 58 16 48Z" fill="${c.hair}" ${st}/><path d="M63 30 Q78 44 72 66 Q66 58 64 48Z" fill="${c.hair2}" ${st}/>`;
  // 耳朵類配件（頭的後面）
  if(c.acc==='catears') acc += `<path d="M18 26 L16 6 L33 17Z" fill="${c.hair}" ${st}/><path d="M62 26 L64 6 L47 17Z" fill="${c.hair}" ${st}/><path d="M20 20 L19 11 L27 16Z" fill="#FFC2DC"/><path d="M60 20 L61 11 L53 16Z" fill="#FFC2DC"/>`;
  if(c.acc==='foxears') acc += `<path d="M17 28 L12 3 L34 17Z" fill="${c.hair}" ${st}/><path d="M63 28 L68 3 L46 17Z" fill="${c.hair}" ${st}/><path d="M18 20 L16 9 L26 15Z" fill="#FFF4E0"/><path d="M62 20 L64 9 L54 15Z" fill="#FFF4E0"/>`;
  if(c.acc==='bunny') acc += `<ellipse cx="29" cy="10" rx="6" ry="13" fill="#FFFFFF" ${st} transform="rotate(-14 29 10)"/><ellipse cx="51" cy="10" rx="6" ry="13" fill="#FFFFFF" ${st} transform="rotate(14 51 10)"/><ellipse cx="29" cy="11" rx="2.6" ry="8" fill="#FFC2DC" transform="rotate(-14 29 11)"/><ellipse cx="51" cy="11" rx="2.6" ry="8" fill="#FFC2DC" transform="rotate(14 51 11)"/>`;
  if(c.acc==='horns') over0 += `<path d="M24 22 Q14 10 18 2 Q24 12 31 17Z" fill="#FFF4E0" ${st}/><path d="M56 22 Q66 10 62 2 Q56 12 49 17Z" fill="#FFF4E0" ${st}/>`;
  // 頭髮頂部（尖刺）
  if(c.style==='spiky') top = `<path d="M16 32 L10 18 L22 20 L20 6 L32 14 L38 2 L44 13 L56 5 L56 19 L70 16 L64 32 Z" fill="${c.hair}" ${st}/>`;
  // 臉、身體
  const body = `<path d="M14 80 Q16 66 40 66 Q64 66 66 80 Z" fill="${c.shirt}" ${st}/><path d="M34 62 L34 68 Q40 72 46 68 L46 62Z" fill="${AV_SKIN}" ${st}/>`;
  const face = `<path d="M18 38 Q18 62 40 64 Q62 62 62 38 Q62 18 40 18 Q18 18 18 38Z" fill="${AV_SKIN}" ${st}/>`;
  // 瀏海
  if(c.style==='cool') front = `<path d="M16 42 Q12 14 40 12 Q66 12 64 40 L60 30 Q52 34 42 24 Q40 34 30 30 Q26 36 22 34 Z" fill="${c.hair}" ${st}/>`;
  else if(c.style==='short') front = `<path d="M16 40 Q13 13 40 12 Q67 13 64 40 L58 28 L52 33 L46 24 L40 31 L33 24 L27 33 L21 28 Z" fill="${c.hair}" ${st}/>`;
  else if(c.style==='twin2') front = `<path d="M16 40 Q14 14 40 12 L40 30 L33 24 L27 33 L21 28 Z" fill="${c.hair}" ${st}/><path d="M40 12 Q66 14 64 40 L59 28 L53 33 L47 24 L40 30 Z" fill="${c.hair2}" ${st}/>`;
  else front = `<path d="M16 40 Q14 14 40 12 Q66 14 64 40 L58 29 L54 36 L48 25 L42 34 L36 24 L30 35 L25 27 Z" fill="${c.hair}" ${st}/>`;
  // 大眼睛
  const eye = (x, flip) => `<g>
    <ellipse cx="${x}" cy="45" rx="5.4" ry="7" fill="#FFFFFF"/>
    <ellipse cx="${x}" cy="46" rx="4.5" ry="6" fill="${c.eye}"/>
    <ellipse cx="${x}" cy="48" rx="3" ry="3.6" fill="${I}" opacity=".55"/>
    <circle cx="${x-1.6}" cy="43" r="1.9" fill="#FFFFFF"/><circle cx="${x+1.8}" cy="49.5" r="0.9" fill="#FFFFFF"/>
    <path d="M${x-6} ${flip?41:40} Q${x} 36 ${x+6} ${flip?40:41}" stroke="${I}" stroke-width="2.6" fill="none" stroke-linecap="round"/></g>`;
  const brows = c.style==='cool' ? `<path d="M26 35 L35 37 M54 35 L45 37" stroke="${I}" stroke-width="1.8" stroke-linecap="round"/>` : '';
  const M = { grin:`<path d="M34 55 Q40 61 46 55 Z" fill="#B2283A" ${st}/>`, open:`<path d="M36 55 Q40 60 44 55 Z" fill="#B2283A" stroke="${I}" stroke-width="1.6"/>`,
    smile:`<path d="M36 56 Q40 59 44 56" stroke="${I}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`, line:`<path d="M37 57 L43 56" stroke="${I}" stroke-width="1.8" stroke-linecap="round"/>`,
    cat:`<path d="M35 55 Q37.5 58 40 55 Q42.5 58 45 55" stroke="${I}" stroke-width="1.8" fill="none" stroke-linecap="round"/>` }[c.mouth];
  const blush = `<ellipse cx="25" cy="53" rx="4" ry="2.2" fill="#FF7FA0" opacity=".55"/><ellipse cx="55" cy="53" rx="4" ry="2.2" fill="#FF7FA0" opacity=".55"/>`;
  let over='';
  if(c.acc==='glasses') over += `<rect x="24" y="39" width="13" height="11" rx="3.5" fill="none" stroke="${I}" stroke-width="2"/><rect x="43" y="39" width="13" height="11" rx="3.5" fill="none" stroke="${I}" stroke-width="2"/><path d="M37 44 L43 44" stroke="${I}" stroke-width="2"/>`;
  if(c.acc==='star') over += `<path d="M58 18 L60 23 L65 23 L61 26 L63 31 L58 28 L53 31 L55 26 L51 23 L56 23Z" fill="#FFD23F" stroke="${I}" stroke-width="1.6"/>`;
  if(c.acc==='mic') over += `<path d="M18 30 Q20 18 30 14" stroke="${I}" stroke-width="1.8" fill="none"/><circle cx="18" cy="33" r="3" fill="${I}"/><path d="M60 16 L62 21 L67 21 L63 24 L65 29 L60 26 L55 29 L57 24 L53 21 L58 21Z" fill="#FF4F8B" stroke="${I}" stroke-width="1.6"/>`;
  if(c.acc==='crown') over += `<path d="M28 15 L30 4 L36 11 L40 2 L44 11 L50 4 L52 15 Z" fill="#FFD23F" stroke="${I}" stroke-width="2" stroke-linejoin="round"/>`;
  if(c.ribbon) over += `<path d="M52 18 L62 12 L62 24Z M52 18 L44 12 L46 24Z" fill="${c.ribbon}" stroke="${I}" stroke-width="1.6" stroke-linejoin="round"/><circle cx="52" cy="18" r="2.4" fill="${c.ribbon}" stroke="${I}" stroke-width="1.4"/>`;
  return `<svg viewBox="0 0 80 80" aria-hidden="true">${back}${acc}${top}${body}${face}${brows}${eye(31,false)}${eye(49,true)}${blush}${M}${front}${over0}${over}</svg>`;
}
const HUMAN_KINDS = ['pup','frog','chick','cat'];
const BOTS = [['喵子','cat'],['阿龍','bear'],['雪兔','bunny']];

function cardHTML(id, cls=''){
  const r=B.rk(id), s=B.su(id), red = s===1||s===2;
  return `<div class="card ${red?'red':''} ${cls}" data-id="${id}"><span class="cr">${B.RL[r]}</span><span class="cs">${B.SU[s]}</span><span class="cb">${B.SU[s]}</span></div>`;
}

let tt;
// iPhone：擋掉點兩下放大、雙指縮放
// （點兩下放大靠 CSS 的 touch-action:manipulation 擋掉，不攔 touchend，才不會吃掉連點）
(()=>{
  document.addEventListener('dblclick', e=>e.preventDefault(), {passive:false});
  ['gesturestart','gesturechange'].forEach(t=>document.addEventListener(t, e=>e.preventDefault(), {passive:false}));
})();
function toast(msg, ms=1700){ const t=$('toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(tt); tt=setTimeout(()=>t.classList.remove('show'),ms); }
function fx(text, soft){
  const f=$('fx'); f.innerHTML=`<div class="boom ${soft?'':'pink'}">${esc(text)}</div>`;
  f.classList.remove('on'); void f.offsetWidth;
  if(!soft){ f.classList.add('on'); const t=$('table'); t.classList.remove('shake'); void t.offsetWidth; t.classList.add('shake'); }
  clearTimeout(fx._t); fx._t=setTimeout(()=>{ f.innerHTML=''; f.classList.remove('on'); },1150);
}

/* ---------- 設定 ---------- */
const GNAME={big2:'大老二', seven:'排七', mj:'麻將', bk:'Blokus', rm:'拉密', dc:'吹牛骰子', cc:'暗棋', pr:'撿紅點'}, SKEY={big2:'jk_stats', seven:'jk_stats7', mj:'jk_statsmj', bk:'jk_statsbk', rm:'jk_statsrm', dc:'jk_statsdc', cc:'jk_statscc', pr:'jk_statspr'};
const MJLEN={one:'單局', round:'東風圈', full:'一將'};
const QS = new URLSearchParams(location.search);
const MOCK = QS.has('mock');
const TURN_MS = MOCK && QS.has('fast') ? 4000 : 30000;
let framed=false; try{ framed = window.self!==window.top; }catch(e){ framed=true; }
const P2P = MOCK || (!framed && typeof RTCPeerConnection!=='undefined' && !!window.Peer);
// 每個分頁一個身分（重新整理仍保留），斷線重連時用來找回座位
const myCid = (()=>{ try{ let c=sessionStorage.getItem('jk_cid'); if(!c){ c='u'+Math.random().toString(36).slice(2,10); sessionStorage.setItem('jk_cid',c); } return c; }catch(e){ return 'u'+Math.random().toString(36).slice(2,10); } })();
const prefs = Object.assign({n:4, diff:'normal', game:'big2', mjLen:'round'}, store.get('jk_prefs', {}));
const nick = () => { const v=($('nick').value.trim()||'我').slice(0,8); store.set('jk_nick',v); return v; };

/* ================= 連線層（PeerJS；?mock=1 時用本機模擬） ================= */
const PFX = 'jiuka-tw-';
// 測試用：?ps=主機:埠 改連自架的 PeerJS 伺服器
const PEER_OPT = (()=>{ const v=QS.get('ps'); if(!v) return {debug:0}; const [host,port]=v.split(':'); return {debug:0, host, port:+port||9000, path:'/', secure:false}; })();
function wrap(send, close){ const w={send, close, _d:null, _c:null, onData(f){w._d=f;}, onClose(f){w._c=f;}}; return w; }
const PeerNet = {
  host(code, h){
    const peer = new window.Peer(PFX+code, PEER_OPT);
    peer.on('open', ()=>h.ready());
    peer.on('error', e=>h.error(e.type||'error'));
    peer.on('disconnected', ()=>{ try{ peer.reconnect(); }catch(e){} });
    peer.on('connection', c=>{
      c.on('open', ()=>{ let closed=false; const w=wrap(o=>{ try{c.send(o);}catch(e){} }, ()=>{ try{c.close();}catch(e){} }); w.pid=c.peer;
        c.on('data', d=>w._d&&w._d(d)); const cl=()=>{ if(closed) return; closed=true; w._c&&w._c(); };
        c.on('close', cl); c.on('error', cl); h.conn(w); });
    });
    return { peer, close(){ try{ peer.destroy(); }catch(e){} } };
  },
  join(code, h){
    const peer = new window.Peer(PEER_OPT); let opened=false;
    peer.on('open', ()=>{
      const c = peer.connect(PFX+code, {reliable:true});
      c.on('open', ()=>{ opened=true; let closed=false; const w=wrap(o=>{ try{c.send(o);}catch(e){} }, ()=>{ try{c.close();}catch(e){} });
        c.on('data', d=>w._d&&w._d(d)); const cl=()=>{ if(closed) return; closed=true; w._c&&w._c(); };
        c.on('close', cl); c.on('error', cl); h.open(w); });
    });
    peer.on('error', e=>h.error(e.type||'error', opened));
    setTimeout(()=>{ if(!opened) h.error('timeout', false); }, 12000);
    return { peer, close(){ try{ peer.destroy(); }catch(e){} } };
  }
};
const MockNet = {
  host(code, h){
    const bc=new BroadcastChannel('jk-mock-'+code), conns={};
    bc.onmessage=e=>{ const m=e.data; if(m.to!=='host') return;
      if(m.k==='hello'){ const w=wrap(o=>{ try{ bc.postMessage({to:m.from,k:'d',d:o}); }catch(e){} }, ()=>{ try{ bc.postMessage({to:m.from,k:'bye'}); }catch(e){} }); conns[m.from]=w; bc.postMessage({to:m.from,k:'ok'}); h.conn(w); }
      else if(m.k==='d') conns[m.from]&&conns[m.from]._d&&conns[m.from]._d(m.d);
      else if(m.k==='bye'){ const w=conns[m.from]; delete conns[m.from]; w&&w._c&&w._c(); } };
    setTimeout(()=>h.ready(), 50);
    window.addEventListener('pagehide', ()=>{ try{ Object.keys(conns).forEach(k=>bc.postMessage({to:k,k:'bye'})); }catch(e){} });
    return { close(){ try{ Object.keys(conns).forEach(k=>bc.postMessage({to:k,k:'bye'})); bc.close(); }catch(e){} } };
  },
  join(code, h){
    const bc=new BroadcastChannel('jk-mock-'+code), id='c'+Math.random().toString(36).slice(2); let w=null;
    bc.onmessage=e=>{ const m=e.data; if(m.to!==id) return;
      if(m.k==='ok'){ w=wrap(o=>bc.postMessage({to:'host',from:id,k:'d',d:o}), ()=>bc.postMessage({to:'host',from:id,k:'bye'})); h.open(w); }
      else if(m.k==='d') w&&w._d&&w._d(m.d);
      else if(m.k==='bye') w&&w._c&&w._c(); };
    window.addEventListener('pagehide', ()=>{ if(w) bc.postMessage({to:'host',from:id,k:'bye'}); });
    bc.postMessage({to:'host',from:id,k:'hello'});
    setTimeout(()=>{ if(!w) h.error('peer-unavailable', false); }, 1500);
    return { close(){ if(w) bc.postMessage({to:'host',from:id,k:'bye'}); setTimeout(()=>bc.close(),50); } };
  }
};
const Net = MOCK ? MockNet : PeerNet;

/* ================= 房主：牌局真正在這裡跑 ================= */
let H = null;
// 公平亂數（crypto，拒絕取樣避免偏差）
function rnd(n){ try{ const a=new Uint32Array(1), lim=Math.floor(0x100000000/n)*n; let x; do{ crypto.getRandomValues(a); x=a[0]; }while(x>=lim); return x%n; }catch(e){ return Math.floor(Math.random()*n); } }
function hostInit(online){
  H = { online, code:null, net:null, conns:new Map(), started:false, timer:null, deadline:0, gid:0, ev:{seq:0},
        type:prefs.game, n:prefs.n, diff:prefs.diff, mjLen:prefs.mjLen, S:null,
        jn:0, seats:[{name:nick(), cid:myCid, human:true, online:true, card:Prog.card(), jn:0}] };
}
const humans = () => H.seats.filter(s=>s.human);

function hostOpen(fixed, tries){
  H.code = fixed || String(1000 + Math.floor(Math.random()*9000));
  H.net = Net.host(H.code, {
    ready(){ if(!H) return; if(fixed){ toast('房間重新開好了，等朋友連回來', 2600); hostRoster(); if(H.started){ broadcastState(); } } else broadcastLobby(); },
    error(t){ if(!H) return;
      if(t==='unavailable-id'){ H.net.close();
        // 回到原本的房號：伺服器可能還記著舊連線，等一下再試
        if(fixed){ if((tries||0)>25){ toast('原本的房號拿不回來，只能重開房間'); return; } if(!tries) toast('正在拿回原本的房號…', 2500); setTimeout(()=>{ if(H) hostOpen(fixed, (tries||0)+1); }, 2500); return; }
        hostOpen(); return; }
      if(t==='network'||t==='server-error'||t==='socket-error'){ toast('連線伺服器出問題，請稍後再試'); }
      else toast('開房失敗（'+t+'）'); },
    conn(w){ hostConn(w); }
  });
}

function hostConn(w){
  let cid=null;
  w.onData(m=>{
    if(!H || !m) return;
    if(m.t==='join'){ cid=String(m.cid||''); hostJoin(w, m); }
    else if(m.t==='act'){ const si=H.seats.findIndex(s=>s.cid===cid); if(si<0||!H.started) return;
      const err = hostAct(si, m.a); if(err) w.send({t:'err', msg:err}); }
    else if(m.t==='emo'){ const si=H.seats.findIndex(s=>s.cid===cid); if(si>=0) hostEmo(si, m.e, m.fx); }
    else if(m.t==='peek'){ const si=H.seats.findIndex(s=>s.cid===cid); if(si>=0) hostPeek(si, m.p); }
    else if(m.t==='chat'){ hostChat(cid, m.x); }
    else if(m.t==='throw'){ const si=H.seats.findIndex(s=>s.cid===cid); if(si>=0) hostThrow(si, m.to, m.it); }
    else if(m.t==='voice'){ const s=H.seats.find(s=>s.cid===cid); if(s){ s.vo=!!m.on; hostRoster(); } }
    else if(m.t==='leave'){ hostDrop(cid, w, true); }
  });
  w.onClose(()=>{ if(cid) hostDrop(cid, w, false); });
}

function hostJoin(w, m){
  const name = String(m.name||'朋友').slice(0,8);
  const card = m.card && typeof m.card==='object' ? {rp:Math.max(0,Math.min(9999,+m.card.rp||0)), kind:String(m.card.kind||'pup').slice(0,10), wins:+m.card.wins||0,
    fr: FR_OK.test(String(m.card.fr)) ? String(m.card.fr) : 'none', tt: String(m.card.tt||'').slice(0,6)} : null;
  const ex = H.seats.findIndex(s=>s.cid===m.cid);
  if(H.started){
    let ex2=ex;
    // 重新整理過的朋友：用暱稱找回原本斷線的座位
    if(ex2<0) ex2=H.seats.findIndex(s=>s.human && !s.online && s.name===name && s.cid!==myCid);
    if(ex2<0){ w.send({t:'err', msg:'這局已經開始，等下一局再加入', fatal:true}); return; }
    if(H.seats[ex2].cid!==m.cid){ H.conns.delete(H.seats[ex2].cid); H.seats[ex2].cid=m.cid; }
    const st=H.seats[ex2];
    st.online=true; st.offAt=0; H.conns.set(m.cid, w); st.pid=w.pid; st.vo=false; if(card) st.card=card;
    toast(`${st.name} 回來了`); Snd.join();
    broadcastState(); hostSchedule(); return;
  }
  if(ex<0){
    if(humans().length>=4){ w.send({t:'err', msg:'房間已經滿了', fatal:true}); return; }
    H.seats.push({name, cid:m.cid, human:true, online:true, card, jn:++H.jn, pid:w.pid});
    toast(`${name} 進房了`); Snd.join();
  } else { H.seats[ex].name=name; H.seats[ex].online=true; if(card) H.seats[ex].card=card; H.seats[ex].pid=w.pid; H.seats[ex].vo=false; }
  H.conns.set(m.cid, w);
  if(H.n < humans().length) H.n = humans().length;
  broadcastLobby();
}

function hostDrop(cid, w, left){
  if(!H || H.conns.get(cid)!==w) return;
  H.conns.delete(cid);
  const si=H.seats.findIndex(s=>s.cid===cid); if(si<0) return;
  if(!H.started){ H.seats.splice(si,1); broadcastLobby(); return; }
  H.seats[si].online=false; H.seats[si].vo=false; H.seats[si].offAt = left ? 0 : Date.now(); hostRoster();
  toast(left ? `${H.seats[si].name} 離開了，先由電腦代打` : `${H.seats[si].name} 斷線了，等他 ${GRACE_MS/1000} 秒`);
  broadcastState();
  if(!H.S.over && H.S.turn===si) hostSchedule();
}

function lobbyInfo(){
  return { code:H.code, type:H.type, n:H.type==='mj'?4:H.type==='cc'?2:H.n, diff:H.diff, mjLen:H.mjLen,
    seats: H.seats.map((s,i)=>({name:s.name, kind:(s.card&&PAL[s.card.kind])?s.card.kind:HUMAN_KINDS[i], rp:s.card?s.card.rp:null, wins:s.card?s.card.wins:0, host:i===0, fr:s.card?s.card.fr:'none', tt:s.card?s.card.tt:''})) };
}
function broadcastLobby(){
  const L = lobbyInfo();
  H.conns.forEach(w=>w.send({t:'lobby', L}));
  if(C && C.mode==='host') showLobby(L);
  hostRoster();
}

function hostStart(){
  H.seats.forEach(s=>{ if(s.cid===myCid) s.card=Prog.card(); });
  const hs = H.seats.filter(s=>s.human && (s.online || s.cid===myCid));
  const n = H.type==='mj' ? 4 : H.type==='cc' ? 2 : Math.max(H.n, hs.length);
  H.seats = hs.map((s,i)=>({...s, kind:(s.card&&PAL[s.card.kind])?s.card.kind:HUMAN_KINDS[i]}))
    .concat(BOTS.slice(0, n-hs.length).map(([name,kind])=>({name, kind, human:false, online:true})));
  // 每局重新抽座位：誰先、坐哪、Blokus 拿什麼顏色、麻將誰坐東都不固定
  for(let i=H.seats.length-1;i>0;i--){ const j=rnd(i+1); [H.seats[i],H.seats[j]]=[H.seats[j],H.seats[i]]; }
  H.S = H.type==='mj' ? MJ.newMatch(H.mjLen) : H.type==='bk' ? K.newGame(n) : H.type==='rm' ? R.newGame(n) : H.type==='dc' ? DC.newGame(n) : H.type==='cc' ? CC.newGame() : H.type==='pr' ? PR.newGame(n) : H.type==='seven' ? X.newGame(n) : B.newGame(n);
  H.lastKey = null;
  H.started = true; H.gid++; H.ev = {seq:0};
  hostSchedule(true);
  broadcastState();
  hostRoster();
}

function hostBackToRoom(){
  clearTimeout(H.timer); H.deadline=0;
  H.started=false; H.S=null;
  H.seats = H.seats.filter(s=>s.human && (s.online || s.cid===myCid)).sort((a,b)=>(a.jn||0)-(b.jn||0));
  if(H.n < H.seats.length) H.n = H.seats.length;
  broadcastLobby();
}

function viewFor(si){
  const S=H.S;
  const V = { type:H.type, gid:H.gid, n:S.n, me:si, turn:S.turn, over:S.over, ver:S.ver, ev:H.ev,
    players: H.seats.map(s=>({name:s.name, kind:s.kind, bot:!s.human, online:s.online, wait:graceLeft(s)>0, rp:s.card?s.card.rp:null, fr:s.card?s.card.fr:'none', tt:s.card?s.card.tt:''})),
    hand: (H.type==='bk'||H.type==='cc') ? [] : (H.type==='rm' ? S.racks : H.type==='dc' ? S.dice : S.hands)[si].slice(),
    counts: H.type==='bk' ? S.left.map(l=>l.reduce((a,pc)=>a+K.SIZE[pc],0)) : H.type==='cc' ? [0,1].map(i=>S.color[i]==null?16:CC.remaining(S,S.color[i])) : (H.type==='rm' ? S.racks : H.type==='dc' ? S.dice : S.hands).map(h=>h.length), order: S.order.slice(),
    timed: !!H.deadline, left: H.deadline ? Math.max(0, H.deadline-Date.now()) : 0, online: H.online };
  if(H.type==='mj') Object.assign(V, mjView(si));
  else if(H.type==='bk') Object.assign(V, {N:S.N, duo:S.duo, starts:S.starts, board:S.board, pieces:S.left, first:S.first, out:S.out, last:S.last, score:S.score, status:S.status});
  else if(H.type==='cc') Object.assign(V, {board:S.board.map(x=>x?(x.up?{t:x.t,c:x.c,up:true}:{up:false}):null), color:S.color.slice(), last:S.last, idle:S.idle, captured:S.captured, status:S.status.slice(), reason:S.reason});
  else if(H.type==='pr') Object.assign(V, {table:S.table.slice(), pile:S.pile.length, taken:S.taken.map(t=>t.length), pts:S.taken.map((_,i)=>PR.scoreOf(S,i)), takenAll:S.taken, last:S.last, status:S.status.slice(), score:S.score});
  else if(H.type==='dc') Object.assign(V, {lives:S.lives.slice(), bid:S.bid, ones:S.ones, phase:S.phase, status:S.status.slice(), round:S.round,
    reveal: S.reveal, minQ:DC.minQ(S), total:DC.totalDice(S), bids:S.bids.slice(-8)});
  else if(H.type==='rm') Object.assign(V, {table:S.table, pool:S.pool.length, melded:S.melded, last:S.last, score:S.score, status:S.status, racksAll: S.over ? S.racks : null});
  else if(H.type==='big2') Object.assign(V, {table:S.table, first:S.first, done:S.done.slice(), status:S.status.slice()});
  else Object.assign(V, {board:S.board, covN:S.covered.map(c=>c.length), myCov:S.covered[si].slice(), last:S.last, score:S.score||null, covAll: S.over ? S.covered.map(c=>c.slice()) : null});
  return JSON.parse(JSON.stringify(V));
}
function broadcastState(){
  hostSave();
  H.seats.forEach((s,i)=>{
    if(!s.human) return;
    if(s.cid===myCid){ applyView(viewFor(i)); return; }
    const w=H.conns.get(s.cid); if(w && s.online) w.send({t:'state', V:viewFor(i)});
  });
}

// 朋友斷線時先等一下，不要馬上讓電腦代打
const GRACE_MS = MOCK && QS.has('fast') ? 3000 : 20000;
const graceLeft = s => (s && s.human && !s.online && s.offAt) ? Math.max(0, GRACE_MS-(Date.now()-s.offAt)) : 0;
function hostSchedule(first){
  clearTimeout(H.timer); H.deadline=0;
  if(H.type==='mj'){ mjSchedule(first); return; }
  const S=H.S; if(!S || S.over) return;
  if(H.type==='dc' && S.phase==='reveal'){ const gid=H.gid, ver=S.ver;
    H.timer=setTimeout(()=>{ if(H && H.gid===gid && H.S.ver===ver && H.S.phase==='reveal'){ DC.nextRound(H.S); H.ev={seq:H.ev.seq+1, k:'round', by:-1}; broadcastState(); hostSchedule(); } }, MOCK&&QS.has('fast')?1500:4800); return; }
  const s=H.seats[S.turn], gid=H.gid, ver=S.ver, turn=S.turn;
  const guard = ()=> H && H.gid===gid && H.S.ver===ver && H.S.turn===turn && !H.S.over;
  const gl=graceLeft(s);
  if(gl>0){ H.deadline=Date.now()+gl; H.timer=setTimeout(()=>{ if(guard()) hostSchedule(); }, gl+60); return; }
  if(!s.human || !s.online){
    H.timer=setTimeout(()=>{ if(guard()) botMove(false); }, (first?1300:0) + (s.human?1000:(H.type==='bk'||H.type==='rm')?350+Math.random()*350:650+Math.random()*500));
  } else if(H.online && humans().length>1){
    const ms = (H.type==='rm' ? 60000 : TURN_MS) + (first?1500:0);
    H.deadline = Date.now() + ms;
    H.timer=setTimeout(()=>{ if(guard()) botMove(true); }, ms);
  }
}

function botMove(timeout){
  const S=H.S, si=S.turn, diff = H.seats[si].human ? 'normal' : H.diff;
  const gid=H.gid, ver=S.ver, later=(ms, f)=>{ H.timer=setTimeout(()=>{ if(H && H.gid===gid && H.S.ver===ver && H.S.turn===si && !H.S.over) f(); }, ms); };
  if(H.type==='bk'){
    const m=K.aiChoose(S, si, diff);
    if(!m){ applyAct(si, {k:'pass'}); return; }
    // 先讓大家看到方塊滑到位置，再放下
    const dx=m.cells[0][0] < S.N/2 ? 2 : -2, dy=m.cells[0][1] < S.N/2 ? 2 : -2;
    hostPeek(si, {cells:m.cells.map(([x,y])=>[x+dx,y+dy]), pc:m.piece});
    later(260, ()=>{ hostPeek(si, {cells:m.cells.map(([x,y])=>[x+(dx>>1),y+(dy>>1)]), pc:m.piece});
      later(260, ()=>{ hostPeek(si, {cells:m.cells, pc:m.piece}); later(480, ()=>applyAct(si, {k:'place', piece:m.piece, cells:m.cells})); }); });
  } else if(H.type==='rm'){
    const m = timeout ? {t:'draw'} : R.aiChoose(S, si, diff);
    if(m.t==='draw'){ applyAct(si, {k:'draw'}); return; }
    hostPeek(si, {table:m.table, drag:null});
    later(1100, ()=>applyAct(si, {k:'commit', table:m.table}));
  } else if(H.type==='cc'){
    const m=CC.aiChoose(S, si, diff); if(m) applyAct(si, {k:'cc', m});
  } else if(H.type==='pr'){
    const m=PR.aiChoose(S, si, diff); if(m) applyAct(si, {k:'pr', card:m.card, target:m.target});
  } else if(H.type==='dc'){
    const m=DC.aiChoose(S, si, diff);
    applyAct(si, m.t==='open' ? {k:'open'} : {k:'bid', q:m.q, f:m.f});
  } else if(H.type==='seven'){
    const c=X.aiChoose(S, si, diff);
    applyAct(si, c.play!=null ? {k:'play7', id:c.play} : {k:'cover', id:c.cover});
  } else {
    const pick = (timeout && S.table) ? null : B.aiChoose(S, si, diff);
    applyAct(si, pick ? {k:'play', ids:pick} : {k:'pass'});
  }
}

function hostAct(si, a){
  if(!H.S || H.S.over) return '這局已經結束了';
  if(H.type!=='mj' && si!==H.S.turn) return '還沒輪到你';
  return applyAct(si, a);
}
function applyAct(si, a){
  const S=H.S; let r; const ev={by:si};
  if(H.type==='mj'){ r=MJ.act(S, si, a.a||{}); if(r.err) return r.err; mjAfter(); return null; }
  if(H.type==='bk'){
    if(a.k==='pass'){ r=K.pass(S,si); ev.k='pass'; }
    else { r=K.place(S, si, a.piece|0, (a.cells||[]).map(c=>[c[0]|0,c[1]|0])); ev.k='place'; ev.size=r.size; }
  } else if(H.type==='rm'){
    if(a.k==='draw'){ r=R.draw(S,si); ev.k='draw'; }
    else { r=R.commit(S, si, a.table); ev.k='play'; ev.n=r.n; ev.win=r.win; }
  } else if(H.type==='cc'){
    const m=a.m||{}; const mm = m.k==='flip' ? {k:'flip', i:m.i|0} : {k:'move', from:m.from|0, to:m.to|0};
    r=CC.act(S, si, mm); if(!r.err){ ev.k = mm.k==='flip' ? 'flip' : r.info.cap ? 'cap' : 'move'; ev.info=r.info; }
  } else if(H.type==='pr'){
    r=PR.play(S, si, a.card|0, a.target==null?null:a.target|0); ev.k='pr'; ev.gain=r.gain||0;
  } else if(H.type==='dc'){
    if(a.k==='open'){ r=DC.challenge(S, si); ev.k='open'; ev.loser=r.loser; ev.cnt=r.count; }
    else { r=DC.bid(S, si, a.q|0, a.f|0); ev.k='bid'; ev.q=a.q|0; ev.f=a.f|0; }
  } else if(H.type==='big2'){
    if(a.k==='pass'){ r=B.pass(S,si); ev.k='pass'; }
    else { r=B.play(S, si, (a.ids||[]).map(Number)); ev.k='play';
      if(r.info){ ev.name=r.info.name; ev.bomb=r.info.bomb; ev.big=r.info.size===5 && r.info.type!=='straight'; ev.last=r.last; } }
  } else {
    if(a.k==='cover'){ r=X.cover(S, si, Number(a.id)); ev.k='cover'; }
    else { r=X.play(S, si, Number(a.id)); ev.k='play'; ev.last = S.hands[si].length===1; }
  }
  if(r.err) return r.err;
  ev.seq = H.ev.seq+1; H.ev = ev;
  hostSchedule();
  broadcastState();
  return null;
}
/* 即時動作：輪到的人正在拖的方塊／正在擺的牌，傳給其他人看 */
function hostPeek(si, p){
  const S=H&&H.S; if(!H||!H.started||!S||S.over||S.turn!==si||!p||typeof p!=='object') return;
  let q=null;
  if(H.type==='bk'){
    const cells = Array.isArray(p.cells) ? p.cells.slice(0,5).map(c=>[c[0]|0, c[1]|0]).filter(c=>c[0]>=-6&&c[1]>=-6&&c[0]<S.N+6&&c[1]<S.N+6) : null;
    q={cells: cells&&cells.length?cells:null, pc: p.pc==null?null:(p.pc|0)};
  } else if(H.type==='rm'){
    if(!Array.isArray(p.table)) return;
    const ok=new Set(S.table.flat().concat(S.racks[si])), seen=new Set(), table=[];
    for(const set of p.table.slice(0,60)){ if(!Array.isArray(set)) return; const t=[];
      for(const x of set){ const id=x|0; if(!ok.has(id)||seen.has(id)) return; seen.add(id); t.push(id); } if(t.length) table.push(t); }
    let drag=null;
    if(p.drag && Array.isArray(p.drag.ids)){ const ids=p.drag.ids.slice(0,14).map(x=>x|0).filter(x=>ok.has(x));
      if(ids.length) drag={ids, x:Math.max(0,Math.min(1,+p.drag.x||0)), y:Math.max(0,Math.min(1,+p.drag.y||0))}; }
    q={table, drag};
  } else return;
  const m={t:'peek', by:si, ver:S.ver, p:q}, sc=H.seats[si].cid;
  H.conns.forEach((w,cid)=>{ if(cid!==sc) w.send(m); });
  if(sc!==myCid) onPeek(m);
}
function onPeek(m){
  if(!C||!C.V||m.ver!==C.V.ver) return;
  C.peek={by:m.by, ver:m.ver, p:m.p, at:Date.now()};
  if(C.peekRaf) return;
  C.peekRaf=requestAnimationFrame(()=>{ C.peekRaf=0; if(!C||!C.V) return; if(C.V.type==='bk') renderBK(); else if(C.V.type==='rm') renderRM(); });
}
function livePeek(){
  const k=C&&C.peek, V=C&&C.V;
  return (k && V && k.ver===V.ver && k.by===V.turn && k.by!==V.me && !V.over && Date.now()-k.at<15000) ? k : null;
}
let peekLast='', peekTimer=null, peekPending=null, peekAt=0;
function peekSend(p){
  if(!C||!C.V) return;
  if(!(C.mode==='guest' || (H && H.online && H.conns.size))) return;
  const j=C.V.ver+'|'+JSON.stringify(p); if(j===peekLast) return; peekLast=j; peekPending=p;
  if(peekTimer) return;
  peekTimer=setTimeout(()=>{ peekTimer=null; peekAt=Date.now(); const q=peekPending; peekPending=null; if(!C||!C.V||!q) return;
    if(C.mode==='guest'){ C.conn && C.conn.send({t:'peek', p:q}); } else if(H) hostPeek(C.me, q); }, Math.max(0, 110-(Date.now()-peekAt)));
}
function turnBanner(){
  const el=document.createElement('div'); el.className='turnban'; el.innerHTML='<b>輪到你了！</b>';
  $('emoFx').appendChild(el); setTimeout(()=>el.remove(), 1500);
  try{ navigator.vibrate && navigator.vibrate([40,60,40]); }catch(e){}
}
/* ================= 房主存檔：App 被關掉也能接著打 ================= */
const RESUME_KEY='jk_resume';
let saveT=null;
function hostDone(){ return !H || !H.S || (H.type==='mj' ? H.S.phase==='over' && H.S.M && H.S.M.over : H.S.over); }
function hostSave(){ if(!H || !H.started) return; clearTimeout(saveT); saveT=setTimeout(hostSaveNow, 250); }
function hostSaveNow(){
  clearTimeout(saveT); if(!H || !H.started || !H.S) return;
  if(hostDone()){ hostClear(); return; }
  try{
    const seats=H.seats.map(s=>({name:s.name, cid:s.cid, human:s.human, card:s.card, jn:s.jn, kind:s.kind, me:s.cid===myCid}));
    localStorage.setItem(RESUME_KEY, JSON.stringify({v:1, at:Date.now(), online:H.online, code:H.code, type:H.type, n:H.n, diff:H.diff, mjLen:H.mjLen, gid:H.gid, jn:H.jn, ev:H.ev, seats, S:H.S}));
  }catch(e){}
}
function hostClear(){ clearTimeout(saveT); try{ localStorage.removeItem(RESUME_KEY); }catch(e){} }
function resumeData(){ try{ const d=JSON.parse(localStorage.getItem(RESUME_KEY)||'null'); if(!d || d.v!==1 || Date.now()-d.at > 3*3600000) return null; return d; }catch(e){ return null; } }
function resumeGame(d){
  Snd.init(); newC('host'); hostInit(d.online);
  Object.assign(H, {type:d.type, n:d.n, diff:d.diff, mjLen:d.mjLen, gid:d.gid, jn:d.jn||0, ev:d.ev||{seq:0}, S:d.S, started:true});
  const now=Date.now();
  H.seats=d.seats.map(s=>Object.assign({}, s, s.me ? {cid:myCid, online:true, card:Prog.card()} : {online:!s.human, offAt: s.human ? now : 0}));
  H.seats.forEach(s=>delete s.me);
  C.code=d.code;
  if(d.online){ hostOpen(d.code); }
  hostSchedule(); broadcastState();
  toast(d.online ? '回到上一局了，正在重開房間讓朋友連回來' : '回到上一局了', 2600);
}
function resumePrompt(){
  const d=resumeData(), el=$('resumeTip'); if(!el) return;
  if(!d){ el.hidden=true; return; }
  const mins=Math.max(1, Math.round((Date.now()-d.at)/60000));
  el.innerHTML=`<span>⏯ 上一局<b>${esc(GNAME[d.type]||'')}</b>還沒打完（${mins} 分鐘前${d.online?'，跟朋友連線中':''}）</span><button class="candy sun" id="btnResume">繼續打</button><button class="ix" id="btnResumeX" aria-label="放棄">✕</button>`;
  el.hidden=false;
}
document.addEventListener('click', e=>{
  if(e.target.closest('#btnResume')){ const d=resumeData(); $('resumeTip').hidden=true; if(d) resumeGame(d); return; }
  if(e.target.closest('#btnResumeX')){ hostClear(); $('resumeTip').hidden=true; toast('已放棄上一局'); }
});
// 房主從背景回來：連線伺服器斷了就重新接上
document.addEventListener('visibilitychange', ()=>{
  if(document.hidden){ if(H) hostSaveNow(); return; }
  const p = H && H.net && H.net.peer; if(!p || !H.online) return;
  if(p.destroyed){ hostOpen(H.code); }
  else if(p.disconnected){ try{ p.reconnect(); }catch(e){} }
});

/* ================= 聊天 ================= */
const isLineApp = () => /\bLine\//i.test(navigator.userAgent);
function hostChat(cid, x){
  if(!H) return;
  x=String(x||'').replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,30); if(!x) return;
  const si=H.seats.findIndex(s=>s.cid===cid); if(si<0) return;
  const s=H.seats[si], now=Date.now(); if(now-(s.chatAt||0)<800) return; s.chatAt=now;
  const m={t:'chat', n:s.name, k:s.kind||(s.card&&s.card.kind)||'pup', x, seat:si, g:!!H.started, ts:now};
  H.conns.forEach(w=>w.send(m)); onChat(m);
}
function sendChat(x){
  x=String(x||'').trim().slice(0,30); if(!x||!C) return;
  if(C.mode==='guest'){ C.conn && C.conn.send({t:'chat', x}); } else hostChat(myCid, x);
}
const TK = { log:[], unread:0, muted:new Set() };
function chatReset(){ TK.log=[]; TK.unread=0; $('chatSheet').hidden=true; talkUI(); }
function onChat(m){
  if(!m || TK.muted.has(m.n)) return;
  TK.log.push(m); if(TK.log.length>60) TK.log.shift();
  const mine = !!C && (m.g && C.V ? m.seat===C.V.me : m.n===nick());
  if($('chatSheet').hidden){ if(!mine) TK.unread++; } else renderChat();
  talkUI();
  const inGame = C && C.V && !$('game').hidden && m.g;
  if(inGame) chatBubble(m.seat, m.n, m.x);
  else if($('chatSheet').hidden && !mine) toast(`${m.n}：${m.x}`, 2600);
  if(!mine){ try{ Snd.tone(1320,.06,{type:'sine',vol:.05}); Snd.tone(1760,.06,{type:'sine',vol:.04,at:.07}); }catch(e){} }
}
function chatBubble(seat, name, text){
  const at=seatRect(seat), d=fxNode('chatb', `<b>${esc(name)}</b>${esc(text)}`, 4200);
  const w=Math.min(innerWidth*0.62, 240); d.style.maxWidth=w+'px';
  const x=Math.max(8, Math.min(innerWidth-w-8, at.x-24)), below = at.y < innerHeight*0.45;
  d.style.left=x+'px'; d.style.top = below ? (at.y+26)+'px' : ''; d.style.bottom = below ? '' : (innerHeight-at.y+26)+'px';
  d.classList.add(below?'down':'up'); d.style.setProperty('--tx', Math.max(10, Math.min(w-20, at.x-x-6))+'px');
}
function talkBtns(){ return `<button class="tk tk-chat" aria-label="聊天">💬<i class="tkb" hidden></i></button><button class="tk tk-mic" aria-label="麥克風">🎙<span>關</span></button>`; }
/* ================= 丟道具 ================= */
const TH = { tomato:{n:'番茄'}, rose:{n:'玫瑰'}, egg:{n:'雞蛋'}, heart:{n:'愛心'}, slipper:{n:'藍白拖'}, water:{n:'潑水'}, beer:{n:'乾杯'}, bomb:{n:'炸彈'} };
const TH_ICON = { tomato:'🍅', rose:'🌹', egg:'🥚', heart:'💖', slipper:'🩴', water:'💦', beer:'🍺', bomb:'💣' };
function hostThrow(si, to, it){
  if(!H || !H.started || !H.S) return;
  to=to|0; it=String(it||'').replace(/^th_/,'');
  if(!TH[it] || to<0 || to>=H.seats.length || to===si) return;
  const s=H.seats[si], now=Date.now(); if(now-(s.thAt||0)<1200) return; s.thAt=now;
  const m={t:'throw', by:si, to, it}; H.conns.forEach(w=>w.send(m)); playThrow(si, to, it);
  // 電腦被丟了，有時候會丟回來
  const tg=H.seats[to];
  if(!tg.human && Math.random()<0.4){ const back=['tomato','egg','slipper','rose','water'][Math.floor(Math.random()*5)], gid=H.gid;
    setTimeout(()=>{ if(H && H.gid===gid && H.started){ H.seats[to].thAt=0; hostThrow(to, si, back); } }, 1300+Math.random()*900); }
}
function sendThrow(to, it){
  if(!C || !C.V) return;
  const now=Date.now(); if(now-(C.thAt||0)<1200){ toast('手痠了，等一下再丟'); return; } C.thAt=now;
  if(C.mode==='guest'){ C.conn && C.conn.send({t:'throw', to, it}); } else hostThrow(C.me, to, it);
}
function playThrow(by, to, it){
  if(!C || !C.V || $('game').hidden || !TH[it]) return;
  const P=C.V.players; if(!P[by] || !P[to]) return;
  if(TK.muted.has(P[by].name)) return;
  const a=seatRect(by), b=seatRect(to), d=document.createElement('div');
  d.className='efx proj'; d.textContent=TH_ICON[it]; d.style.left=a.x+'px'; d.style.top=a.y+'px'; $('emoFx').appendChild(d);
  const dx=b.x-a.x, dy=b.y-a.y, hgt=Math.min(160, 60+Math.hypot(dx,dy)*0.35), spin=it==='slipper'||it==='bomb'?720:it==='rose'||it==='heart'?0:420;
  const kf=[]; for(let k=0;k<=10;k++){ const t=k/10; kf.push({transform:`translate(-50%,-50%) translate(${dx*t}px, ${dy*t-hgt*4*t*(1-t)}px) rotate(${spin*t}deg) scale(${1+0.5*Math.sin(Math.PI*t)})`}); }
  try{ Snd.tone(500,.25,{type:'sine',vol:.05,to:1100}); }catch(e){}
  const done=()=>{ d.remove(); thImpact(it, b, by, to); };
  if(d.animate){ const an=d.animate(kf, {duration:620, easing:'linear', fill:'forwards'}); an.onfinish=done; } else setTimeout(done, 620);
}
function thImpact(it, at, by, to){
  const V=C&&C.V; if(!V) return;
  const box=(cls, html, ms)=>{ const e=fxNode(cls, html, ms); e.style.left=at.x+'px'; e.style.top=at.y+'px'; return e; };
  const burst=(ch, n, spread)=>{ for(let i=0;i<n;i++){ const e=box('thp', ch, 1100), ang=Math.random()*Math.PI*2, r=spread*(0.5+Math.random()*0.6);
    e.style.setProperty('--px', Math.cos(ang)*r+'px'); e.style.setProperty('--py', (Math.sin(ang)*r - (ch==='💖'||ch==='💕'?40:0))+'px'); e.style.animationDelay=(i*25)+'ms'; } };
  const shakeAv=()=>{ const el=thTargetEl(to); if(el){ el.classList.remove('hitshake'); void el.offsetWidth; el.classList.add('hitshake'); } };
  const word=(t, cls='')=>box('thw '+cls, t, 1000);
  switch(it){
    case 'tomato': box('splat red','',2800); word('啪！'); shakeAv(); Snd.noise(.18,{freq:700,vol:.3}); Snd.tone(160,.12,{type:'square',vol:.06,to:80}); break;
    case 'egg': box('splat egg','<i></i>',2800); word('啪嘰'); shakeAv(); Snd.noise(.15,{freq:1200,vol:.25}); break;
    case 'rose': burst('🌸', 8, 55); word('送你～','pink'); [988,1319,1568].forEach((f,k)=>Snd.tone(f,.18,{type:'triangle',vol:.06,at:k*.07})); break;
    case 'heart': burst('💕', 9, 60); word('愛你！','pink'); [784,1047,1319].forEach((f,k)=>Snd.tone(f,.16,{type:'sine',vol:.07,at:k*.06})); break;
    case 'slipper': word('啪！！','big'); shakeAv(); Snd.noise(.09,{freq:2500,vol:.5}); Snd.tone(220,.08,{type:'square',vol:.08}); break;
    case 'water': box('splat water','',2400); burst('💧', 8, 50); word('嘩啦'); Snd.noise(.45,{freq:3000,vol:.25}); break;
    case 'beer': burst('🍻', 4, 45); word('乾杯！','gold'); [1568,2093].forEach((f,k)=>Snd.tone(f,.12,{type:'triangle',vol:.08,at:k*.09})); break;
    case 'bomb': box('thboom','💥',900); word('轟！','big'); shakeAv(); Snd.bomb(); { const g=$('game'); g.classList.remove('shake'); void g.offsetWidth; g.classList.add('shake'); } break;
  }
  if(to===V.me){ try{ navigator.vibrate && navigator.vibrate(it==='bomb'?[80,40,80]:40); }catch(e){}
    toast(`${V.players[by].name} 對你丟了${TH[it].n} ${TH_ICON[it]}`, 1800); }
}
function thTargetEl(pi){
  const V=C.V; if(pi===V.me) return V.type==='mj' ? $('mjMeInfo').querySelector('.av') : (['bk','rm','dc','cc','pr'].includes(V.type)) ? $(V.type+'Players').children[pi] : $('meAv');
  if(V.type==='mj'){ const e=$('mjo'+pi); return e && (e.querySelector('.av')||e); }
  if(['bk','rm','dc','cc','pr'].includes(V.type)) return $(V.type+'Players').children[pi];
  const e=$('seat'+D(pi)); return e && (e.querySelector('.av')||e);
}
// 點別人的頭像 → 選要丟什麼
function seatFromEl(el){
  const V=C&&C.V; if(!V||!el) return -1;
  const st=el.closest('.seat'); if(st && /^seat\d+$/.test(st.id)) return (V.me + +st.id.slice(4)) % V.n;
  const mo=el.closest('[id^=mjo]'); if(mo && /^mjo\d+$/.test(mo.id)) return +mo.id.slice(3);
  const ch=el.closest('#bkPlayers .bkp, #rmPlayers .bkp, #dcPlayers .bkp, #ccPlayers .bkp, #prPlayers .bkp'); if(ch) return [...ch.parentNode.children].indexOf(ch);
  return -1;
}
function openThrowPick(pi){
  const V=C.V, pk=$('throwPick'), r=seatRect(pi), list=Prog.throws();
  pk.innerHTML = `<div class="tph">丟給 <b>${esc(V.players[pi].name)}</b></div><div class="tpl">${list.map(t=>`<button data-th="${t.id.slice(3)}" aria-label="${esc(t.name)}">${t.icon}</button>`).join('')}</div><button class="tpshop">更多道具在商店</button>`;
  pk.dataset.to=pi; pk.hidden=false;
  const w=pk.offsetWidth, h=pk.offsetHeight;
  pk.style.left=Math.max(6, Math.min(innerWidth-w-6, r.x-w/2))+'px';
  pk.style.top=(r.y+34+h < innerHeight-6 ? r.y+34 : Math.max(6, r.y-34-h))+'px';
  document.body.classList.remove('aiming'); Snd.tap();
}
$('game').addEventListener('click', e=>{
  if(!C||!C.V) return;
  if(e.target.closest('.tk-throw')){ document.body.classList.toggle('aiming'); if(document.body.classList.contains('aiming')) toast('點一個人的頭像丟過去'); return; }
  const pi=seatFromEl(e.target);
  if(pi<0 || pi===C.V.me){ document.body.classList.remove('aiming'); return; }
  if(C.V.type==='bk' && e.target.closest('#bkBoard')) return;
  openThrowPick(pi);
});
$('throwPick').addEventListener('click', e=>{
  const b=e.target.closest('[data-th]');
  if(b){ sendThrow(+$('throwPick').dataset.to, b.dataset.th); $('throwPick').hidden=true; return; }
  if(e.target.closest('.tpshop')){ $('throwPick').hidden=true; toast('回大廳後到「商店 → 道具」買'); }
});
document.addEventListener('pointerdown', e=>{ const pk=$('throwPick'); if(!pk.hidden && !e.target.closest('#throwPick') && seatFromEl(e.target)<0) pk.hidden=true; }, true);
function talkUI(){
  document.querySelectorAll('.tk-chat .tkb').forEach(b=>{ b.textContent=TK.unread>9?'9+':TK.unread; b.hidden=!TK.unread; });
  document.querySelectorAll('.tk-mic').forEach(b=>{ b.classList.toggle('on', VC.on); b.querySelector('span').textContent = VC.on?'開':'關'; });
}
function roomPeople(){
  if(C && C.V) return C.V.players.map((p,i)=>({name:p.name, bot:p.bot, me:i===C.V.me}));
  return (C && C.L ? C.L.seats.map(s=>({name:s.name, bot:false, me:s.name===nick()})) : []);
}
function renderChat(){
  const box=$('chatLog');
  box.innerHTML = TK.log.length ? TK.log.map(m=>`<div class="cmsg"><span class="cav">${avatar(m.k)}</span><div><b>${esc(m.n)}</b><p>${esc(m.x)}</p></div></div>`).join('') : '<p class="note">還沒有人說話，打個招呼吧！</p>';
  box.scrollTop=box.scrollHeight;
  const ppl=roomPeople().filter(p=>!p.bot && !p.me);
  $('chatPeople').innerHTML = ppl.length ? ppl.map(p=>`<button class="chip ${TK.muted.has(p.name)?'muted':''}" data-mute="${esc(p.name)}">${TK.muted.has(p.name)?'🔇':'🔊'} ${esc(p.name)}</button>`).join('') + '<span class="note">點一下可以把他靜音（文字＋語音）</span>' : '';
  TK.unread=0; talkUI();
}
function openChat(){ Snd.tap(); $('chatSheet').hidden=false; renderChat(); }
document.addEventListener('click', e=>{
  const c=e.target.closest('.tk-chat'); if(c){ e.stopPropagation(); if($('chatSheet').hidden) openChat(); else $('chatSheet').hidden=true; return; }
  const mic=e.target.closest('.tk-mic'); if(mic){ e.stopPropagation(); Snd.init(); vcToggle(); return; }
}, true);
$('chatClose').addEventListener('click', ()=>{ $('chatSheet').hidden=true; });
$('chatForm').addEventListener('submit', e=>{ e.preventDefault(); const v=$('chatIn').value; if(!v.trim()) return; sendChat(v); $('chatIn').value=''; });
$('chatQuick').addEventListener('click', e=>{ const b=e.target.closest('button'); if(!b) return; sendChat(b.textContent); });
$('chatPeople').addEventListener('click', e=>{ const b=e.target.closest('[data-mute]'); if(!b) return; const n=b.dataset.mute;
  if(TK.muted.has(n)){ TK.muted.delete(n); toast(`取消靜音 ${n}`); } else { TK.muted.add(n); toast(`已靜音 ${n}，看不到他的訊息、聽不到他的聲音`); }
  vcApplyMute(); renderChat(); });

/* ================= 語音（PeerJS 直接通話，房主轉發名單） ================= */
const VC = { on:false, stream:null, out:new Map(), ins:new Map(), roster:[], ctx:null, meter:null, local:null, needTap:false };
function vcPeer(){ const n = C && (C.mode==='host' ? (H && H.net) : C.net); return n && n.peer; }
function hostRoster(){
  if(!H || !H.net) return;
  const pid0 = H.net.peer && H.net.peer.id;
  const list = H.seats.map((s,i)=>({s,i})).filter(({s})=>s.human && s.online).map(({s,i})=>({pid: s.cid===myCid ? pid0 : s.pid, n:s.name, vo:!!(s.cid===myCid ? VC.on : s.vo), seat:i})).filter(r=>r.pid);
  const m={t:'vroster', list}; H.conns.forEach(w=>w.send(m)); vcRoster(list);
}
function vcRoster(list){ VC.roster = Array.isArray(list) ? list : []; vcListen(); vcSync(); vcRings(); }
function vcListen(){
  const peer=vcPeer(); if(!peer || peer._vc) return; peer._vc=true;
  peer.on('call', call=>{
    if(!VC.roster.some(r=>r.pid===call.peer)){ try{ call.close(); }catch(e){} return; }
    call.answer(); // 只聽不傳（自己開麥時另外打給對方）
    call.on('stream', st=>vcAttach(call.peer, st, call));
    const done=()=>vcDetach(call.peer, call); call.on('close', done); call.on('error', done);
  });
}
function vcAttach(pid, st, call){
  vcDetach(pid);
  const a=document.createElement('audio'); a.autoplay=true; a.setAttribute('playsinline',''); a.srcObject=st; $('vcAudio').appendChild(a);
  const r=VC.roster.find(x=>x.pid===pid); a.muted = !!(r && TK.muted.has(r.n));
  const pr=a.play(); if(pr && pr.catch) pr.catch(()=>{ VC.needTap=true; vcTapPrompt(); });
  let an=null; try{ const ctx=vcCtx(); const src=ctx.createMediaStreamSource(st); an=ctx.createAnalyser(); an.fftSize=256; src.connect(an); }catch(e){}
  VC.ins.set(pid, {a, an, call}); vcMeterOn();
}
function vcDetach(pid, call){ const x=VC.ins.get(pid); if(!x || (call && x.call!==call)) return; try{ x.a.srcObject=null; x.a.remove(); }catch(e){} VC.ins.delete(pid); }
function vcTapPrompt(){ toast('點一下畫面就能聽到朋友的聲音', 3000); const f=()=>{ VC.ins.forEach(x=>{ try{ x.a.play(); }catch(e){} }); VC.needTap=false; document.removeEventListener('pointerdown', f, true); }; document.addEventListener('pointerdown', f, true); }
function vcCtx(){ if(!VC.ctx){ const AC=window.AudioContext||window.webkitAudioContext; VC.ctx=new AC(); } if(VC.ctx.state==='suspended') VC.ctx.resume(); return VC.ctx; }
function vcApplyMute(){ VC.ins.forEach((x,pid)=>{ const r=VC.roster.find(y=>y.pid===pid); x.a.muted = !!(r && TK.muted.has(r.n)); }); }
async function vcToggle(){ if(VC.on) vcStop(); else await vcStart(); }
async function vcStart(){
  if(MOCK){ toast('測試模式不支援語音'); return; }
  if(!C || !(C.mode==='guest' || (H && H.online))){ toast('跟朋友連線時才能語音'); return; }
  if(isLineApp()){ toast('LINE 裡面不能用麥克風，請改用 Safari 或 Chrome 開'); return; }
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){ toast('這個瀏覽器不能用麥克風，請用 Safari 或 Chrome 開'); return; }
  try{ VC.stream = await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true, noiseSuppression:true, autoGainControl:true}, video:false}); }
  catch(e){ toast(e && e.name==='NotAllowedError' ? '沒有麥克風權限：到手機設定允許瀏覽器使用麥克風' : '開不了麥克風'); return; }
  VC.on=true;
  try{ const ctx=vcCtx(), src=ctx.createMediaStreamSource(VC.stream); VC.local=ctx.createAnalyser(); VC.local.fftSize=256; src.connect(VC.local); }catch(e){ VC.local=null; }
  vcMeterOn(); vcTell(true); vcSync(); talkUI(); toast('麥克風開了，大家聽得到你；建議戴耳機比較不會有回音', 2600);
}
function vcStop(silent){
  const was=VC.on; VC.on=false;
  if(VC.stream) VC.stream.getTracks().forEach(t=>{ try{ t.stop(); }catch(e){} }); VC.stream=null; VC.local=null;
  VC.out.forEach(c=>{ try{ c.close(); }catch(e){} }); VC.out.clear();
  if(was && !silent) vcTell(false);
  talkUI(); vcRings();
}
function vcTell(on){ if(!C) return; if(C.mode==='guest'){ C.conn && C.conn.send({t:'voice', on}); } else hostRoster(); }
function vcSync(){
  const peer=vcPeer(), me=peer && peer.id;
  VC.out.forEach((c,pid)=>{ if(!VC.on || !VC.roster.some(r=>r.pid===pid)){ try{ c.close(); }catch(e){} VC.out.delete(pid); } });
  if(!VC.on || !peer || !VC.stream) return;
  VC.roster.forEach(r=>{ if(r.pid===me || VC.out.has(r.pid)) return;
    try{ const c=peer.call(r.pid, VC.stream); if(!c) return; VC.out.set(r.pid, c);
      const done=()=>{ if(VC.out.get(r.pid)===c) VC.out.delete(r.pid); }; c.on('close', done); c.on('error', done); }catch(e){} });
}
function vcTeardown(){ vcStop(true); VC.ins.forEach((x,pid)=>vcDetach(pid)); VC.roster=[]; clearInterval(VC.meter); VC.meter=null; $('vcRings').innerHTML=''; }
function vcLevel(an){ if(!an) return 0; const d=new Uint8Array(an.fftSize); an.getByteTimeDomainData(d); let s=0; for(let i=0;i<d.length;i++){ const v=(d[i]-128)/128; s+=v*v; } return Math.sqrt(s/d.length); }
function vcMeterOn(){ if(VC.meter) return; VC.meter=setInterval(vcRings, 160); }
// 有開麥的人頭像上顯示麥克風，講話時發綠光
function vcRings(){
  const box=$('vcRings'); if(!box) return;
  const peer=vcPeer(), me=peer && peer.id, inGame = C && C.V && !$('game').hidden;
  let h='';
  VC.roster.forEach(r=>{
    const isMe=r.pid===me, on = isMe ? VC.on : r.vo; if(!on) return;
    const lv = isMe ? vcLevel(VC.local) : (VC.ins.get(r.pid) ? vcLevel(VC.ins.get(r.pid).an) : 0);
    const muted = !isMe && TK.muted.has(r.n);
    let at=null;
    if(inGame) at=seatRect(r.seat);
    else { const el=document.querySelectorAll('#lobbySeats .lseat .av')[r.seat]; if(el){ const b=el.getBoundingClientRect(); if(b.width) at={x:b.left+b.width/2, y:b.top+b.height/2}; } }
    if(!at) return;
    h+=`<span class="vring ${lv>0.035&&!muted?'talk':''} ${muted?'muted':''}" style="left:${at.x}px;top:${at.y}px"><i>${muted?'🔇':'🎙'}</i></span>`;
  });
  box.innerHTML=h;
}
function hostEmo(si, e, fx){
  const m={t:'emo', by:si, e:String(e).slice(0,12), fx: FX_IDS.includes(fx) ? fx : 'fx_bubble'};
  H.conns.forEach(w=>w.send(m)); showEmo(si, m.e, true, m.fx);
}

/* ================= 每個玩家的畫面（房主自己也是） ================= */
let C = null;
function newC(mode){ C = { mode, V:null, me:0, sel:[], hint:-1, qt:null, lastSeq:0, dl:0, recorded:-1, shownVer:-1, conn:null, net:null, code:null }; }

function sendAct(a){
  if(C.mode==='guest'){ if(C.conn) C.conn.send({t:'act', a}); else toast('連線中斷，重新連線中'); }
  else { const err=hostAct(C.me, a); if(err){ toast(err); Snd.err(); } }
}

function applyView(V){
  const fresh = !C.V || C.V.gid!==V.gid || $('game').hidden;
  const prevTurn = C.V ? C.V.turn : -1;
  if(fresh){ C.sel=[]; C.hint=-1; C.qt=null; C.shownVer=-1; }
  C.V=V; C.me=V.me;
  C.dl = V.timed ? Date.now()+V.left : 0;
  C.sel = C.sel.filter(id=>V.hand.includes(id));
  if(fresh){ showGame(); Snd.deal(); C.handNo=V.handNo; C.bombs=0; setTimeout(()=>announceSeats(V), 500);
    V.players.forEach((p,i)=>{ if(i!==V.me && !p.bot && p.rp!=null) Prog.seeFriend(p.name, p); }); }
  if(V.type==='mj' && C.handNo!==V.handNo){ C.handNo=V.handNo; C.sel=[]; }
  if(V.ev && V.ev.seq!==C.lastSeq){
    if(!fresh && V.ev.seq) playEv(V.ev);
    C.lastSeq=V.ev.seq;
    if(V.ev.by===V.me){ C.sel=[]; C.hint=-1; C.qt=null; }
  }
  if(!fresh && V.turn===V.me && prevTurn!==V.me && !V.over && !(V.type==='dc' && V.phase!=='bid')){ Snd.turn(); if(V.type==='bk'||V.type==='rm') turnBanner(); if(V.type==='dc'||V.type==='cc'||V.type==='pr'){ try{ navigator.vibrate&&navigator.vibrate(30); }catch(e){} } }
  if(!fresh && V.type==='mj' && V.claim && V.claim.mine && !V.claim.answered && !(C.claimSeen===V.claim.tile+'|'+V.ver)){ C.claimSeen=V.claim.tile+'|'+V.ver; Snd.turn(); }
  if(V.type==='mj'){
    if(V.phase==='over' && V.result && V.result.type==='win' && V.result.winner===V.me){
      const hk=V.gid+'|'+V.handNo+'|'+(C.code||'local');
      if(C.mjHandKey!==hk){ C.mjHandKey=hk; const r=Prog.recordMjHand({self:V.result.self, tai:V.result.total, names:V.result.tai.map(x=>x[0]), online:onlineWithFriends(), diff:C.mode==='host'?H.diff:(C.diff||'normal')}); C.mjHandCoins=r.coins; announceAch(r.unlocked); }
    }
    if(V.over) recordEnd(V);
    render(fresh);
    return;
  }
  render(fresh);
  if(V.over) finish(); else $('result').hidden=true;
}
function playEv(ev){
  if(C.V && C.V.type==='mj'){ mjEv(ev); return; }
  if(C.V && C.V.type==='dc'){ dcEv(ev); return; }
  if(C.V && C.V.type==='cc'){ ccEv(ev); return; }
  if(C.V && C.V.type==='pr'){ prEv(ev); return; }
  if(C.V && (C.V.type==='bk' || C.V.type==='rm')){
    if(ev.k==='pass'||ev.k==='draw'){ Snd.pass(); return; }
    Snd.play();
    if(ev.k==='place' && ev.size===5 && ev.by===C.V.me) Snd.tap();
    if(ev.k==='play' && ev.n>=4){ fx(`一口氣 ${ev.n} 張！`, true); if(ev.by===C.V.me) C.rm4=true; }
    return;
  }
  if(ev.bomb && C.V && ev.by===C.V.me) C.bombs=(C.bombs||0)+1;
  if(ev.k==='pass'||ev.k==='cover'){ Snd.pass(); return; }
  Snd.play();
  if(ev.bomb){ fx(ev.name+'！'); setTimeout(()=>Snd.bomb(),60); }
  else if(ev.big) fx(ev.name+'！', true);
  if(ev.last) setTimeout(()=>Snd.last(),250);
}

const POS = {2:['me','top'], 3:['me','right','left'], 4:['me','right','top','left']};
const FROM = {top:['0px','-140px'], left:['-140px','0px'], right:['140px','0px'], me:['0px','160px']};
const D = pi => (pi - C.V.me + C.V.n) % C.V.n;

function showGame(){
  const V=C.V, t=$('table');
  t.className='table n'+V.n+(V.type==='seven'?' seven':'');
  $('mjRes').hidden=true; $('mjRes').dataset.k='';
  if(V.type==='bk') bkBuild();
  $('q7').hidden=true;
  if(V.type==='rm') C.rm=null;
  document.body.className='g-'+V.type;
  $('ttl').textContent = GNAME[V.type] + (C.mode==='guest' || (H&&H.online) ? ` · 房號 ${C.code||H.code}` : '');
  $('btnPlay').textContent = V.type==='seven' ? '蓋牌' : '出牌';
  t.querySelectorAll('.seat').forEach(e=>e.remove());
  for(let d=1; d<V.n; d++){ const el=document.createElement('div'); el.className='seat '+POS[V.n][d]; el.id='seat'+d; t.appendChild(el); }
  $('meAv').innerHTML = avatar(V.players[V.me].kind); $('meAv').className='av'+frC(V.players[V.me]);
  $('meName').textContent = V.players[V.me].name;
  $('emoBar').innerHTML = talkBtns() + '<button class="tk tk-throw" aria-label="丟道具">🍅</button>' + Prog.emoLines().map(l=>`<button>${esc(l)}</button>`).join('');
  $('emoBar').hidden = !(C.mode==='guest' || (H&&H.online));
  $('menu').hidden=true; $('lobby').hidden=true; $('game').hidden=false;
  keepAwake();
}

function announceSeats(V){
  const nm=i=> i===V.me ? '你' : V.players[i].name;
  let msg='';
  if(V.type==='bk'){ const col=['藍','黃','紅','綠']; msg='抽順序：'+[...Array(V.n).keys()].map(i=>`${nm(i)}(${col[i]})`).join(' → '); }
  else if(V.type==='mj'){ const order=[0,1,2,3].map(k=>(V.dealer+k)%4); msg='抓位：'+order.map((i,k)=>`${'東南西北'[k]} ${nm(i)}`).join('、')+`，${nm(V.dealer)}當莊`; }
  else if(V.type==='rm'){ msg=`抽順序：${nm(V.turn)} 先出`; }
  else if(V.type==='dc'){ msg=`抽到 ${nm(V.turn)} 先喊`; }
  else if(V.type==='cc'){ msg=`抽到 ${nm(V.turn)} 先翻，翻到什麼顏色就是那一方`; }
  else if(V.type==='pr'){ msg=`抽到 ${nm(V.turn)} 先出`; }
  if(msg) toast(msg, 3200);
}
function seatTail(V, pi){
  const p=V.players[pi];
  let s='';
  if(!p.online) s+= p.wait ? '<span class="off">斷線·等他回來</span>' : '<span class="off">斷線·代打</span>';
  if(V.turn===pi && !V.over && V.timed) s+='<span class="tleft"></span>';
  return s;
}

function render(first){
  const V=C.V;
  if(V.type==='mj'){ renderMJ(); tick(); return; }
  if(V.type==='bk'){ renderBK(); tick(); return; }
  if(V.type==='rm'){ renderRM(); tick(); return; }
  if(V.type==='dc'){ renderDC(); tick(); return; }
  if(V.type==='cc'){ renderCC(); tick(); return; }
  if(V.type==='pr'){ renderPR(); tick(); return; }
  if(V.type==='seven') render7(); else render2();
  renderHand(first);
  updateButtons();
  tick();
}

function render2(){
  const V=C.V;
  for(let pi=0; pi<V.n; pi++){
    if(pi===V.me) continue;
    const p=V.players[pi], el=$('seat'+D(pi)), cnt=V.counts[pi];
    el.classList.toggle('turn', V.turn===pi && !V.over);
    el.classList.toggle('done', V.done[pi]);
    const place = V.done[pi] ? V.order.indexOf(pi)+1 : 0;
    let bub='';
    if(cnt===1 && !V.done[pi]) bub='<div class="bubble hot">報牌！</div>';
    else if(V.status[pi]) bub=`<div class="bubble">${V.status[pi]}</div>`;
    el.innerHTML = `${bub}<div class="av${frC(p)}">${avatar(p.kind)}</div><div><div class="pname">${esc(p.name)}${ttB(p)}</div>
      <div class="cnt">${place?`<span class="place">第 ${place} 名</span>`:`<span class="mini"></span>${cnt}`}${seatTail(V,pi)}</div></div>`;
  }
  const lab=$('tableLabel'), tc=$('tableCards');
  if(V.table){
    lab.textContent = `${V.players[V.table.by].name} 出了`;
    $('tableKind').textContent = V.table.info.name;
    if(C.shownVer!==V.ver){
      tc.innerHTML = V.table.info.cards.map(id=>cardHTML(id)).join('');
      const [fx_,fy]=FROM[POS[V.n][D(V.table.by)]];
      tc.style.setProperty('--fx',fx_); tc.style.setProperty('--fy',fy);
      tc.classList.remove('enter'); void tc.offsetWidth; tc.classList.add('enter');
    }
  } else {
    tc.innerHTML=''; $('tableKind').textContent='';
    const who = V.players[V.turn] ? V.players[V.turn].name : '';
    lab.textContent = V.over ? '這局結束' : V.first ? `${who} 拿到梅花 3，先出` : `換 ${who} 自由出牌`;
  }
  C.shownVer=V.ver;
  const myTurn = V.turn===V.me && !V.over && !V.done[V.me];
  $('me').classList.toggle('turn', myTurn);
  const tag=$('meTag');
  if(V.done[V.me]){ tag.textContent=`第 ${V.order.indexOf(V.me)+1} 名`; tag.className=''; }
  else if(myTurn){ tag.innerHTML = (V.table ? '輪到你了' : '輪到你先出') + (V.timed?' <span class="tleft"></span>':''); tag.className='go'; }
  else if(V.status[V.me]){ tag.textContent=V.status[V.me]; tag.className=''; }
  else { tag.textContent=''; tag.className=''; }
}

const BOARD_SUITS=[3,2,1,0];
// 給提示／檢查用的「只看得到自己手牌」的牌局：別人的手牌只有張數，不會偷看
const fakeS = () => { const V=C.V, hands=(V.counts||[]).map((n,i)=> i===V.me ? V.hand : new Array(n).fill(-1));
  return {hands, board:V.board, table:V.table, first:V.first, over:V.over, turn:V.turn,
    covered: hands.map((_,i)=> i===V.me ? (V.myCov||[]) : [])}; };
function render7(){
  const V=C.V;
  for(let pi=0; pi<V.n; pi++){
    if(pi===V.me) continue;
    const p=V.players[pi], el=$('seat'+D(pi)), cnt=V.counts[pi];
    el.classList.toggle('turn', V.turn===pi && !V.over);
    el.classList.toggle('done', !cnt);
    let bub='';
    if(V.last && V.last.by===pi && V.last.cover) bub='<div class="bubble">蓋牌</div>';
    else if(cnt===1) bub='<div class="bubble hot">剩一張！</div>';
    el.innerHTML = `${bub}<div class="av${frC(p)}">${avatar(p.kind)}</div><div style="text-align:center"><div class="pname">${esc(p.name)}${ttB(p)}</div>
      <div class="cnt" style="justify-content:center">${cnt?`<span class="mini"></span>${cnt}`:'出完'} <span style="font-size:12px;color:var(--ink-soft)">蓋 ${V.covN[pi]}</span>${seatTail(V,pi)}</div></div>`;
  }
  const lastId = V.last && !V.last.cover ? V.last.id : -1;
  const S=fakeS(), myTurn = V.turn===V.me && !V.over;
  $('board').innerHTML = BOARD_SUITS.map(su=>{
    const b=V.board[su], red=su===1||su===2;
    let cells='';
    for(let v=1; v<=13; v++){
      const id = (v<=2 ? (v===1?11:12) : v-3)*4+su;
      const on = b && v>=b.lo && v<=b.hi;
      const edge = myTurn && !on && X.canPlay(S,id) && V.hand.includes(id);
      const lab = v===1?'A':v===11?'J':v===12?'Q':v===13?'K':v;
      cells += `<div class="cell ${red?'red':''} ${on?'on':''} ${v===7&&!on?'seven':''} ${id===lastId&&C.shownVer!==V.ver?'new':''} ${edge?'edge':''}">${on||v===7?lab:''}</div>`;
    }
    return `<div class="brow"><span class="bs ${red?'red':''}">${B.SU[su]}</span>${cells}</div>`;
  }).join('');
  const lab=$('tableLabel');
  if(V.over) lab.textContent='這局結束';
  else if(!V.last) lab.textContent=`抽到 ${V.players[V.turn].name} 先出`;
  else { const w=V.players[V.last.by].name;
    lab.innerHTML = V.last.cover ? `${esc(w)} 蓋了一張牌` : `${esc(w)} 出了 <b style="color:${(B.su(V.last.id)===1||B.su(V.last.id)===2)?'var(--red)':'var(--ink)'}">${B.SU[B.su(V.last.id)]}${B.RL[B.rk(V.last.id)]}</b>`; }
  C.shownVer=V.ver;
  $('me').classList.toggle('turn', myTurn && V.hand.length>0);
  const tag=$('meTag');
  if(!V.hand.length && !V.over){ tag.textContent='你出完了'; tag.className=''; }
  else if(myTurn){ tag.innerHTML = (X.playable(S,V.me).length ? '輪到你，點上面「可以出」的牌' : '沒牌可接，選一張蓋') + (V.timed?' <span class="tleft"></span>':''); tag.className='go'; }
  else { tag.textContent=''; tag.className=''; }
}

function sortKey(){ return C.V.type==='seven' ? 'jk_sort7' : 'jk_sort'; }
function curSort(){ return store.get(sortKey(), C.V.type==='seven'?'suit':'rank'); }
function sortedHand(){
  const V=C.V, h=[...V.hand], sort=curSort();
  if(V.type==='seven'){
    const nv=X.nat;
    if(sort==='suit') return h.sort((a,b)=>B.su(b)-B.su(a)||nv(a)-nv(b)).map(id=>({id,g:B.su(id)}));
    return h.sort((a,b)=>nv(a)-nv(b)||B.su(b)-B.su(a)).map(id=>({id,g:0}));
  }
  if(sort==='rank') return h.sort((a,b)=>a-b).map(id=>({id,g:0}));
  if(sort==='suit') return h.sort((a,b)=>B.su(a)-B.su(b)||a-b).map(id=>({id,g:B.su(id)}));
  const byR={}; h.forEach(id=>(byR[B.rk(id)]=byR[B.rk(id)]||[]).push(id));
  const groups=Object.values(byR).sort((a,b)=>b.length-a.length || a[0]-b[0]);
  const out=[]; groups.forEach((g,k)=>g.sort((a,b)=>a-b).forEach(id=>out.push({id,g:k}))); return out;
}
function renderHand(first){
  const V=C.V, hand=$('hand'), h=sortedHand(), W=hand.clientWidth||340, sort=curSort();
  const land = innerWidth>innerHeight && innerHeight<560;
  const cw = land ? Math.max(38, Math.min(54, Math.floor(innerHeight*0.135))) : Math.max(44, Math.min(64, Math.floor(W/7.2))), ch=Math.round(cw*1.42);
  hand.style.setProperty('--cw',cw+'px'); hand.style.setProperty('--ch',ch+'px');
  const rows = h.length>(land?20:13) ? 2 : 1, per=Math.ceil(h.length/rows);
  const seven=V.type==='seven', can = seven && V.turn===V.me && !V.over ? X.playable(fakeS(), V.me) : [];
  let html='';
  for(let r=0;r<rows;r++){
    const part=h.slice(r*per,(r+1)*per), m=part.length;
    let gaps=0; const gi=part.map((c,i)=>(i&&c.g!==part[i-1].g)?++gaps:gaps);
    const gap = sort==='rank' ? 0 : Math.min(10, gaps? (W*0.18)/gaps : 0);
    const stepX = m>1 ? Math.min(cw+4, (W-cw-gaps*gap)/(m-1)) : 0;
    const total = (m-1)*stepX+gaps*gap+cw, off=Math.max(0,(W-total)/2);
    html += `<div class="row" style="height:${ch}px;margin-top:${r?0:14}px">` + part.map((c,i)=>
      cardHTML(c.id, C.sel.includes(c.id)?('sel'+(can.includes(c.id)?' can':'')): can.includes(c.id)?'can': (can.length?'dim':''))
        .replace('class="card','style="left:'+(off+i*stepX+gi[i]*gap).toFixed(1)+'px;animation-delay:'+((r*per+i)*35)+'ms" class="card')).join('') + '</div>';
  }
  if(!h.length) html=`<div style="height:${ch+14}px;display:grid;place-items:center;color:var(--ink-soft)">${seven?'你出完了，等其他人出完':'你出完了，等其他人比完名次'}</div>`;
  hand.innerHTML=html;
  hand.classList.toggle('deal', !!first);
}

function updateButtons(){
  const V=C.V, sort=curSort();
  if(V.type==='seven'){
    const my=V.turn===V.me && !V.over, ps = my ? X.playable(fakeS(),V.me) : [], noPlay = my && !ps.length;
    const selPlay = my && C.sel.length===1 && ps.includes(C.sel[0]);
    $('btnPlay').textContent = selPlay ? '出這張' : '蓋牌';
    $('btnPlay').disabled = !(selPlay || (noPlay && C.sel.length===1));
    // 能出的牌另外排成一排大按鈕，不會因為手牌重疊而按錯
    const q=$('q7');
    if(my && ps.length){
      q.hidden=false;
      q.innerHTML = `<span class="q7l">可以出</span>` + [...ps].sort((a,b)=>B.su(b)-B.su(a)||X.nat(a)-X.nat(b)).map(id=>cardHTML(id,'q7c'+(C.sel[0]===id?' sel':''))).join('');
    } else { q.hidden=true; q.innerHTML=''; }
    $('btnHint').disabled = !my;
    $('btnSort').textContent = sort==='suit' ? '排大小' : '排花色';
    const pts=V.myCov.reduce((a,id)=>a+X.pts(id),0);
    $('selInfo').textContent = `已蓋 ${V.myCov.length} 張 · ${pts} 點`;
    renderMyCov();
    return;
  }
  const myTurn=V.turn===V.me && !V.over && !V.done[V.me];
  $('btnPlay').disabled = !myTurn || !C.sel.length;
  $('btnPass').disabled = !myTurn || !V.table;
  $('btnHint').disabled = !myTurn;
  $('btnSort').textContent = {rank:'排花色',suit:'依牌型',group:'排大小'}[sort];
  renderQuick();
  const si=$('selInfo');
  if(!C.sel.length) si.textContent='';
  else { const info=B.analyze(C.sel); si.textContent = info ? `已選：${info.name}` : `已選 ${C.sel.length} 張`; }
}

/* 快速選牌 */
const QTYPES=[['sflush','同花順',1],['four','鐵支',1],['fullhouse','葫蘆'],['straight','順子'],['pair','對子']];
let qCache={key:'',list:[]};
function quickCombos(){
  const V=C.V, mine=V.turn===V.me && !V.over && !V.done[V.me];
  const key=V.hand.join(',')+'|'+V.gid+'|'+V.ver+'|'+mine;
  if(qCache.key!==key){
    const cs = mine ? B.legal(fakeS(), V.me) : B.genCombos(V.hand);
    qCache={key, list:cs.sort((a,b)=>B.baseStrength(a)-B.baseStrength(b))};
  }
  return {mine, list:qCache.list};
}
function renderQuick(){
  const q=$('quick'), V=C.V;
  if(V.done[V.me]||V.over){ q.innerHTML=''; return; }
  const {mine,list}=quickCombos();
  let html=QTYPES.map(([t,name,bomb])=>{ const n=list.filter(c=>c.type===t).length; if(!n) return '';
    return `<button class="qc ${bomb?'bomb':''} ${C.qt&&C.qt.t===t?'on':''}" data-t="${t}">${name}<i>${n}</i></button>`; }).join('');
  if(!html){ const t=V.table&&V.table.info;
    html = `<span class="qnone">${mine&&t ? (t.size===1?'桌上是單張，直接點牌出':'沒有組合壓得過，可以按「過」') : '手上沒有對子以上的組合'}</span>`; }
  q.innerHTML=html;
}
$('quick').addEventListener('click', e=>{
  const b=e.target.closest('.qc'); if(!b||!C||!C.V) return;
  const t=b.dataset.t, cs=quickCombos().list.filter(c=>c.type===t);
  if(!cs.length) return;
  const idx = C.qt&&C.qt.t===t ? (C.qt.i+1)%cs.length : 0;
  C.qt={t,i:idx}; C.sel=cs[idx].cards.slice(); C.hint=-1; Snd.tap();
  renderHand(); updateButtons();
});

$('q7').addEventListener('click', e=>{
  const c=e.target.closest('.card'); const V=C&&C.V; if(!c||!V||V.turn!==V.me||V.over) return;
  const id=+c.dataset.id; if(!X.canPlay(fakeS(),id)) return;
  C.sel=[]; sendAct({k:'play7', id});
});
$('hand').addEventListener('click', e=>{
  const c=e.target.closest('.card'); if(!c||!C||!C.V) return;
  const id=+c.dataset.id, V=C.V;
  if(V.type==='seven'){
    if(V.turn!==V.me||V.over) return;
    const S=fakeS();
    if(X.canPlay(S,id)){
      if(C.sel[0]===id){ C.sel=[]; sendAct({k:'play7', id}); return; }   // 第二下才出，避免牌太擠按錯
      C.sel=[id]; Snd.tap(); renderHand(); updateButtons(); return;
    }
    if(X.playable(S,V.me).length){ toast('先出發亮的牌，有牌能接就要出'); Snd.err(); return; }
    C.sel = C.sel[0]===id ? [] : [id]; Snd.tap(); renderHand(); updateButtons(); return;
  }
  C.sel = C.sel.includes(id) ? C.sel.filter(x=>x!==id) : C.sel.concat(id);
  C.hint=-1; C.qt=null; Snd.tap();
  c.classList.toggle('sel', C.sel.includes(id));
  updateButtons();
});
$('btnPlay').addEventListener('click', ()=>{
  const V=C&&C.V; if(!V || V.turn!==V.me) return;
  if(V.type==='seven'){ if(C.sel.length!==1) return;
    const id=C.sel[0]; C.sel=[];
    sendAct(X.canPlay(fakeS(), id) ? {k:'play7', id} : {k:'cover', id}); return; }
  const err = B.validate(Object.assign(fakeS(), {}), V.me, C.sel);
  if(err){ toast(err); Snd.err(); return; }
  sendAct({k:'play', ids:C.sel.slice()});
});
$('btnPass').addEventListener('click', ()=>{ const V=C&&C.V; if(V && V.turn===V.me){ C.sel=[]; sendAct({k:'pass'}); } });
$('btnSort').addEventListener('click', ()=>{
  if(!C||!C.V) return;
  const s=curSort();
  store.set(sortKey(), C.V.type==='seven' ? (s==='suit'?'rank':'suit') : ({rank:'suit',suit:'group',group:'rank'}[s]));
  Snd.tap(); renderHand(); updateButtons();
});
$('btnHint').addEventListener('click', ()=>{
  const V=C&&C.V; if(!V || V.turn!==V.me) return;
  if(V.type==='seven'){ const c=X.aiChoose(fakeS(), V.me, 'normal');
    if(c.play!=null){ C.sel=[c.play]; toast('建議出這張，再點一下或按「出這張」'); } else { C.sel=[c.cover]; toast('建議蓋這張，按「蓋牌」'); }
    Snd.tap(); renderHand(); updateButtons(); return; }
  const cs=B.legal(fakeS(), V.me).sort((a,b)=>B.baseStrength(a)-B.baseStrength(b) || a.size-b.size);
  if(!cs.length){ toast('沒有牌壓得過，按「過」'); Snd.err(); return; }
  C.hint=(C.hint+1)%cs.length; C.qt=null; C.sel=cs[C.hint].cards.slice(); Snd.tap(); renderHand(); updateButtons();
});
window.addEventListener('resize', ()=>{ if(C && C.V && !$('game').hidden){ if(C.V.type==='mj') renderMJ(); else renderHand(); } });

/* 倒數 */
function tick(){
  if(!C || !C.dl) { document.querySelectorAll('.tleft').forEach(e=>e.textContent=''); return; }
  const s=Math.max(0, Math.ceil((C.dl-Date.now())/1000));
  document.querySelectorAll('.tleft').forEach(e=>{ e.textContent=s; e.classList.toggle('hurry', s<=5); });
}
setInterval(tick, 500);

/* 表情 */
$('emoBar').addEventListener('click', e=>{
  const b=e.target.closest('button'); if(!b||!C||!C.V||b.closest('.tk')) return;
  const now=Date.now(); if(now-(C.emoAt||0)<1500) return; C.emoAt=now;
  $('emoBar').classList.add('cool'); setTimeout(()=>$('emoBar').classList.remove('cool'),1500);
  const t=b.textContent; Snd.tap();
  if(C.mode==='guest'){ C.conn && C.conn.send({t:'emo', e:t, fx:Prog.fxId()}); }
  else if(H) hostEmo(C.me, t, Prog.fxId());
});
const FX_IDS=['fx_bubble','fx_danmaku','fx_hearts','fx_boom','fx_cutin','fx_neon','fx_gold'];
// 找說話的人在畫面上的位置（頭像）
function seatRect(pi){
  const V=C&&C.V; let el=null;
  if(V){
    const me=pi===V.me;
    if(V.type==='mj') el = me ? ($('mjMeInfo').querySelector('.av')||$('mjMeInfo')) : $('mjo'+pi);
    else if(V.type==='bk') el = $('bkPlayers').children[pi];
    else if(V.type==='rm') el = $('rmPlayers').children[pi];
    else if(V.type==='dc'||V.type==='cc'||V.type==='pr') el = $(V.type+'Players').children[pi];
    else el = me ? $('me').querySelector('.meinfo .av') : $('seat'+D(pi));
    if(el && el.querySelector && !me && el.querySelector('.av')) el = el.querySelector('.av') || el;
  }
  const r = el && el.getBoundingClientRect ? el.getBoundingClientRect() : null;
  return r && r.width ? {x:r.left+r.width/2, y:r.top+r.height/2} : {x:innerWidth/2, y:innerHeight*0.3};
}
function fxNode(cls, html, ms){ const d=document.createElement('div'); d.className='efx '+cls; d.innerHTML=html; $('emoFx').appendChild(d); setTimeout(()=>d.remove(), ms); return d; }
function playEmoFx(fx, pi, text, who, kind){
  if(!FX_IDS.includes(fx)) fx='fx_bubble';
  const p={x:0,y:0}, at = pi==null ? {x:innerWidth/2, y:innerHeight*0.32} : seatRect(pi), av=avatar(kind||'pup'), t=esc(text), w=esc(who);
  const W=innerWidth, H=innerHeight;
  if(fx==='fx_bubble'){
    // 對話框放在頭像旁邊、往畫面中間偏
    const bx=Math.min(W-130, Math.max(130, at.x + (W/2-at.x)*0.35)), by=Math.min(H-120, Math.max(110, at.y + (at.y<H/2 ? 95 : -95)));
    const d=fxNode('ebubble', `<div class="eb ${at.y<H/2?'down':'up'}"><span class="ebav">${av}</span><span class="ebt"><small>${w}</small><b>${t}</b></span></div>`, 2700);
    d.style.left=bx+'px'; d.style.top=by+'px';
    d.style.setProperty('--tx', Math.max(-80,Math.min(80,(at.x-bx)))+'px');
    Snd.emo();
  } else if(fx==='fx_danmaku'){
    const cols=['#FF4F8B','#2EC5FF','#FFD23F','#22B35A','#A15BE6','#fff'];
    for(let k=0;k<7;k++){ const d=fxNode('edan', `${k%3===0?`<i>${w}：</i>`:''}${t}`, 3600);
      d.style.top=(12+k*11+Math.random()*4)+'%'; d.style.color=cols[k%cols.length]; d.style.fontSize=(20+Math.random()*16)+'px'; d.style.animationDelay=(k*0.18+Math.random()*0.2)+'s'; d.style.animationDuration=(2.2+Math.random()*1)+'s'; }
    [0,1,2].forEach(k=>Snd.tone(900+k*220,.06,{type:'square',vol:.04,at:k*.08}));
  } else if(fx==='fx_hearts'){
    const d=fxNode('ehtxt', `<b>${t}</b>`, 2800); d.style.left=Math.min(W-120,Math.max(120,at.x))+'px'; d.style.top=Math.max(90, at.y-40)+'px';
    for(let k=0;k<14;k++){ const h=fxNode('eheart', '♥', 2600); h.style.left=(at.x+(Math.random()-.5)*120)+'px'; h.style.top=(at.y+10)+'px';
      h.style.animationDelay=(Math.random()*0.8)+'s'; h.style.fontSize=(16+Math.random()*22)+'px'; h.style.setProperty('--dx',((Math.random()-.5)*80)+'px'); h.style.color=['#FF4F8B','#FF7FA0','#E8433F','#FFB3C7'][k%4]; }
    [784,988,1175].forEach((f,k)=>Snd.tone(f,.18,{type:'triangle',vol:.08,at:k*.09}));
  } else if(fx==='fx_boom'){
    fx_boomText(t, w);
  } else if(fx==='fx_cutin'){
    fxNode('ecut', `<div class="ecband"><span class="ecav">${av}</span><span class="ectx"><small>${w}</small><b>${t}</b></span></div>`, 2600);
    Snd.noise(.35,{freq:900,vol:.25}); Snd.tone(220,.25,{type:'sawtooth',vol:.08,to:660,at:.05}); Snd.tone(1320,.12,{type:'triangle',vol:.1,at:.32});
  } else if(fx==='fx_neon'){
    fxNode('eneon', `<small>${w}</small><b data-t="${t}">${t}</b>`, 2900);
    [0,.25,.5].forEach(a=>Snd.tone(110,.12,{type:'sawtooth',vol:.05,at:a}));
  } else if(fx==='fx_gold'){
    fxNode('egold', `<small>${w}</small><b>${t}</b>`, 3200);
    for(let k=0;k<26;k++){ const c=fxNode('ecoin', '', 3000); c.style.left=(Math.random()*100)+'%'; c.style.animationDelay=(Math.random()*1.2)+'s'; c.style.animationDuration=(1.4+Math.random()*1)+'s'; c.style.setProperty('--r',(Math.random()*720-360)+'deg'); }
    Snd.win();
  }
}
function fx_boomText(t, w){
  const f=$('fx'); f.innerHTML=`<div class="boom pink"><small class="bw">${w}</small>${t}</div>`;
  f.classList.remove('on'); void f.offsetWidth; f.classList.add('on');
  const tb=$('table'); tb.classList.remove('shake'); void tb.offsetWidth; tb.classList.add('shake');
  clearTimeout(fx._t); fx._t=setTimeout(()=>{ f.innerHTML=''; f.classList.remove('on'); },1300);
  Snd.bomb();
}
function showEmo(pi, text, banner, fxId){
  if(!C||!C.V) return;
  const V=C.V, mj=V.type==='mj', me=pi===V.me;
  if(banner){ const p=V.players[pi]; playEmoFx(fxId||'fx_bubble', pi, text, me?'我':p.name, p.kind); return; }
  // 碰、吃這類小提示：頭像上的小泡泡
  const el = mj ? (me ? $('mjMeInfo') : $('mjo'+pi)) : (me ? $('me').querySelector('.meinfo') : $('seat'+D(pi)));
  if(el){
    el.querySelectorAll('.bubble.emo').forEach(x=>x.remove());
    const b=document.createElement('div'); b.className='bubble emo';
    b.innerHTML=`<span class="ein">${esc(text)}</span>`;
    el.appendChild(b); setTimeout(()=>b.remove(), 2200);
  }
}

/* 備份 / 還原 */
function openBackup(){
  $('bkCode').value = Prog.exportCode(($('nick').value.trim()||''));
  $('bkPaste').value=''; $('btnRestore').dataset.arm=''; $('btnRestore').textContent='還原';
  $('ovBackup').hidden=false;
}
$('btnBackup').addEventListener('click', ()=>{ Snd.init(); Snd.tap(); openBackup(); });
$('btnBkCopy').addEventListener('click', ()=>{
  const t=$('bkCode').value;
  const ok=()=>{ Prog.markBackup(); toast('已複製。貼到 LINE 的 Keep 或傳給自己存著'); renderProfile(); };
  const fb=()=>{ $('bkCode').focus(); $('bkCode').select(); toast('請長按上面的文字，全選後複製'); };
  try{ navigator.clipboard.writeText(t).then(ok, fb); }catch(e){ fb(); }
});
$('btnRestore').addEventListener('click', ()=>{
  const b=$('btnRestore'), code=$('bkPaste').value.trim();
  if(!code){ toast('先把備份碼貼到框框裡'); Snd.err(); return; }
  if(!b.dataset.arm){ b.dataset.arm='1'; b.textContent='確定覆蓋目前的資料？再按一次'; return; }
  const r=Prog.importCode(code);
  b.dataset.arm=''; b.textContent='還原';
  if(r.err){ toast(r.err); Snd.err(); return; }
  if(r.nick){ $('nick').value=r.nick; store.set('jk_nick', r.nick); }
  Snd.win(); toast('還原成功，戰績都回來了'); applyTheme(); renderProfile(); $('ovBackup').hidden=true;
});

/* 在 LINE 裡開啟時提醒改用瀏覽器 */
(function lineGuard(){
  const inLine = /\bLine\//i.test(navigator.userAgent);
  if(!inLine) return;
  const u = new URL(location.href); u.searchParams.set('openExternalBrowser','1');
  $('lineWarn').hidden=false; $('lineOpen').href = u.toString();
})();
try{ navigator.storage && navigator.storage.persist && navigator.storage.persist(); }catch(e){}

/* 排七：自己蓋的牌 */
function covCards(ids){ return [...ids].sort((a,b)=>B.su(b)-B.su(a)||X.nat(a)-X.nat(b)).map(id=>cardHTML(id,'mc')).join(''); }
function renderMyCov(){
  const V=C.V, el=$('myCov');
  if(!V || V.type!=='seven' || !V.myCov.length){ el.hidden=true; el.innerHTML=''; return; }
  el.hidden=false;
  el.innerHTML = `<span class="mclbl">我蓋的牌</span><div class="mcs">${covCards(V.myCov)}</div>`;
}

/* 結算 */
function finish(){
  const V=C.V, place=V.order.indexOf(V.me);
  if(C.recorded!==V.gid+'|'+(C.code||'local')){
    C.recorded=V.gid+'|'+(C.code||'local');
    const stats=store.get(SKEY[V.type],{}), nm=V.players[V.me].name;
    const st=stats[nm]||{games:0, places:[0,0,0,0]};
    st.games++; st.places[place]++; stats[nm]=st; store.set(SKEY[V.type],stats);
    const RW=recordEnd(V);
    const gidNow=V.gid;
    setTimeout(()=>{
      if(!C||!C.V||C.V.gid!==gidNow||!C.V.over) return;
      $('resTitle').textContent = place===0 ? '你是第一名！' : place===V.n-1 ? '下一局扳回來' : `你是第 ${place+1} 名`;
      const st2=store.get(SKEY[V.type],{})[nm];
      $('resSub').textContent = st2 ? `${GNAME[V.type]}累計 ${st2.games} 局，第一名 ${st2.places[0]} 次` : '';
      $('resList').innerHTML = C.V.order.map((pi,k)=>{ const p=C.V.players[pi];
        return `<div class="rk p${k+1} ${pi===C.V.me?'me':''}"><span class="no">${k+1}</span><div class="av${frC(p)}">${avatar(p.kind)}</div><span class="nm">${esc(p.name)}${ttB(p)}</span>${C.V.type==='mj'?`<span class="stat">${C.V.scores[pi]>0?'+':''}${C.V.scores[pi]} 分</span>`:''}${C.V.type==='bk'&&C.V.score?`<span class="stat">${C.V.score[pi]>0?'+':''}${C.V.score[pi]} 分 · 剩 ${C.V.pieces[pi].length} 塊</span>`:''}${C.V.type==='rm'&&C.V.score?`<span class="stat">剩 ${C.V.counts[pi]} 張 · ${C.V.score[pi]} 點</span>`:''}${C.V.type==='pr'&&C.V.score?`<span class="stat">${C.V.score[pi]} 分 · 撿 ${C.V.taken[pi]} 張</span>`:''}${C.V.type==='cc'?`<span class="stat">剩 ${C.V.counts[pi]} 子</span>`:''}${C.V.type==='dc'?`<span class="stat">${C.V.lives[pi]>0?'❤'.repeat(C.V.lives[pi]):'出局'}</span>`:''}${C.V.type==='seven'&&C.V.score?`<span class="stat">蓋 ${C.V.covN[pi]} 張 · ${C.V.score[pi]} 點</span>`:''}</div>${C.V.type==='seven'&&C.V.covAll&&C.V.covAll[pi].length?`<div class="rcov">${covCards(C.V.covAll[pi])}</div>`:''}`; }).join('');
      const isHost = C.mode==='host', online = isHost ? H.online : true;
      $('btnAgain').hidden = !isHost; $('btnRoom').hidden = !(isHost && online);
      $('btnHome').textContent = online ? '離開房間' : '回大廳';
      $('resWait').hidden = isHost;
      $('resReward').innerHTML = rewardHTML(RW);
      $('result').hidden=false;
      animateCount($('resReward')); celebrate(RW);
      place===0 ? Snd.win() : place===V.n-1 ? Snd.lose() : Snd.turn();
    }, 1100);
  }
}

/* ================= 麻將 ================= */
const MJ = window.MJ;
const MJ_TURN_MS = MOCK && QS.has('fast') ? 3000 : 20000, MJ_CLAIM_MS = MOCK && QS.has('fast') ? 2000 : 8000;
const MJ_CN = ['一','二','三','四','五','六','七','八','九'];
const mjTimed = () => H.online && humans().length>1;

function mjView(si){
  const S=H.S, M=S.M, mine = S.turn===si && S.phase==='discard', reveal = S.phase==='over';
  return {
    hand: S.hands[si].slice().sort((a,b)=>MJ.kind(a)-MJ.kind(b)||a-b),
    drawn: mine ? S.drawn : null,
    melds: S.melds.map((ms,p)=>ms.map(m=>({type:m.type, kind:m.kind, tiles:(m.type==='ckong'&&p!==si&&!reveal)?null:m.tiles.slice(), from:m.from}))),
    flowers: S.flowers.map(f=>f.slice()),
    discards: S.discards.map(d=>({id:d.id, by:d.by})),
    wall: Math.max(0, S.wall.length - MJ.LEFT_END),
    dealer:S.dealer, wind:S.wind, streak:M.streak, scores:M.scores.slice(), handNo: M.hands + (S.phase==='over'?0:1), length:M.length,
    phase:S.phase, last:S.last,
    self: mine ? MJ.selfOptions(S,si) : null,
    claim: S.claim ? { tile:S.claim.tile, from:S.claim.from, rob:S.claim.rob, mine:S.claim.opts[si]||null, answered: si in S.claim.resp,
      chows: (S.claim.opts[si]||[]).includes('chow') ? MJ.chowOptions(S.hands[si], MJ.kind(S.claim.tile)) : [] } : null,
    result: S.result ? Object.assign({}, S.result, { hands:S.hands.map(h=>h.slice()), meldsAll:S.melds.map(ms=>ms.map(m=>({type:m.type, kind:m.kind, tiles:m.tiles.slice()}))) }) : null,
  };
}

function mjAfter(){
  const S=H.S, key = JSON.stringify([S.last, S.phase, S.M.hands]);
  if(key!==H.lastKey){
    H.lastKey=key;
    const ev={seq:H.ev.seq+1, by:S.last?S.last.by:-1, t:S.last?S.last.t:null, id:S.last?S.last.id:null};
    if(S.phase==='over'){ ev.res = S.result.type==='draw' ? 'draw' : (S.result.self?'tsumo':'hu'); ev.by = S.result.winner; }
    H.ev=ev;
  }
  hostSchedule();
  broadcastState();
}

function mjSchedule(first){
  const S=H.S; if(!S || S.phase==='over') return;
  const gid=H.gid, ver=S.ver, hn=S.M.hands, ph=S.phase;
  const guard = ()=> H && H.gid===gid && H.S===S && S.ver===ver && S.M.hands===hn && S.phase===ph;
  const diffOf = q => H.seats[q].human ? 'normal' : H.diff;
  if(S.phase==='discard'){
    const s=H.seats[S.turn], gl=graceLeft(s);
    if(gl>0){ H.deadline=Date.now()+gl; H.timer=setTimeout(()=>{ if(guard()) mjSchedule(); }, gl+60); return; }
    if(!s.human || !s.online){
      H.timer=setTimeout(()=>{ if(!guard()) return; MJ.act(S, S.turn, MJ.aiSelf(S, S.turn, diffOf(S.turn))); mjAfter(); }, (first?1600:0) + (s.human?900:650+Math.random()*450));
    } else if(mjTimed()){
      H.deadline=Date.now()+MJ_TURN_MS+(first?1500:0);
      H.timer=setTimeout(()=>{ if(!guard()) return; MJ.act(S, S.turn, MJ.aiSelf(S, S.turn, 'normal')); mjAfter(); }, MJ_TURN_MS+(first?1500:0));
    }
  } else if(S.phase==='claim'){
    const pend=MJ.pending(S), auto=pend.filter(q=>!H.seats[q].human || !H.seats[q].online);
    const wait=Math.max(0, ...pend.map(q=>graceLeft(H.seats[q])));
    if(wait>0){ H.deadline=Date.now()+wait; H.timer=setTimeout(()=>{ if(guard()) mjSchedule(); }, wait+60); return; }
    if(auto.length){
      H.timer=setTimeout(()=>{ if(!guard()) return;
        for(const q of auto){ if(S.phase!=='claim') break; if(MJ.pending(S).includes(q)) MJ.act(S, q, MJ.aiClaim(S, q, diffOf(q))); }
        mjAfter(); }, 550+Math.random()*300);
    } else if(mjTimed()){
      H.deadline=Date.now()+MJ_CLAIM_MS;
      H.timer=setTimeout(()=>{ if(!guard()) return;
        for(const q of MJ.pending(S)){ if(S.phase!=='claim') break; MJ.act(S, q, {t:'claim', c:'pass'}); }
        mjAfter(); }, MJ_CLAIM_MS);
    }
  }
}

function mjNext(){
  if(!H || H.type!=='mj' || !H.S || H.S.phase!=='over' || H.S.M.over) return;
  H.S = MJ.nextHand(H.S); H.lastKey=null;
  H.ev = {seq:H.ev.seq+1, t:'deal', by:-1};
  hostSchedule(true);
  broadcastState();
}

function mjTile(id, cls='', k){
  if(id==null) return `<span class="tile back ${cls}"></span>`;
  if(k==null) k=MJ.kind(id);
  let face, sc;
  if(k<27){ const n=k%9, s=Math.floor(k/9); sc='s'+s; face=`<b>${s===0?MJ_CN[n]:n+1}</b><i>${['萬','筒','條'][s]}</i>`; }
  else if(k<34){ const h=k-27; sc='h'+h; face = h===6 ? '<b class="bai"></b>' : `<b>${MJ.HON[h]}</b>`; }
  else { const f=k-34; sc='fl'; face=`<b>${MJ.FLO[f]}</b><i>${f%4+1}</i>`; }
  return `<span class="tile ${sc} ${cls}" data-id="${id}" aria-label="${MJ.tileName(k)}">${face}</span>`;
}
function mjMeld(m, mine){
  if(!m.tiles) return `<span class="meld">${[0,1,2,3].map(()=>mjTile(null)).join('')}</span>`;
  const ts = m.type==='ckong' ? m.tiles.map((id,i)=> (i===0||i===3) ? mjTile(null) : mjTile(id)) : m.tiles.map(id=>mjTile(id));
  return `<span class="meld">${ts.join('')}</span>`;
}
const myMelds = () => C.V.melds[C.V.me].map(m=>({tiles:m.tiles||[]}));
const windOf = (V,pi) => (pi-V.dealer+4)%4;
const tingList = ks => ks.map(k=>mjTile(-1,'xs',k)).join('');

function renderMJ(){
  const V=C.V, me=V.me, myTurn = V.turn===me && V.phase==='discard';
  $('mjInfo').innerHTML = `<span>${MJ.WIND[V.wind]}風圈</span><span>${esc(V.players[V.dealer].name)} 莊${V.streak?' 連'+V.streak:''}</span><span>第 ${V.handNo} 局</span><span>剩 <b>${V.wall}</b> 張</span>`;
  $('mjOpps').innerHTML = [3,2,1].map(d=>(me+d)%4).map(pi=>{
    const p=V.players[pi], turn = V.turn===pi && V.phase==='discard';
    const claimMark = V.claim && V.claim.from===pi;
    return `<div class="mjopp ${turn||claimMark?'turn':''}" id="mjo${pi}">
      <div class="mjoh"><div class="av${frC(p)}">${avatar(p.kind)}</div><div class="mjon"><div class="pname">${esc(p.name)}${ttB(p)}</div>
      <div class="mjtags"><span class="wind ${pi===V.dealer?'dealer':''}">${MJ.WIND[windOf(V,pi)]}${pi===V.dealer?'莊':''}</span><span class="mini"></span>${V.counts[pi]}${V.flowers[pi].length?`<span class="fl">花${V.flowers[pi].length}</span>`:''}${seatTail(V,pi)}</div>
      <div class="sc">${V.scores[pi]>0?'+':''}${V.scores[pi]} 分</div></div></div>
      <div class="mjm">${V.melds[pi].map(m=>mjMeld(m)).join('')}</div></div>`;
  }).join('');
  // 牌河
  const ld = V.discards.length ? V.discards[V.discards.length-1] : null;
  let lastHTML='';
  if(V.claim) lastHTML = `${esc(V.players[V.claim.from].name)} ${V.claim.rob?'要加槓':'打出'} ${mjTile(V.claim.tile,'big')}`;
  else if(V.last && V.last.t==='discard' && ld && ld.by===V.last.by) lastHTML = `${esc(V.players[ld.by].name)} 打出 ${mjTile(ld.id,'big')}`;
  else if(V.phase==='discard') lastHTML = V.turn===me ? '輪到你打牌' : `輪到 ${esc(V.players[V.turn].name)}`;
  $('mjLast').innerHTML = lastHTML;
  $('mjPool').innerHTML = V.discards.map((d,i)=>mjTile(d.id, 'p'+((d.by-me+4)%4)+(i===V.discards.length-1?' new':''))).join('') || '<span class="mjempty">還沒有人打牌</span>';
  const pool=$('mjRiver'); pool.scrollTop = pool.scrollHeight;
  // 自己
  let tag='';
  if(myTurn) tag = `<span class="go">輪到你 <span class="tleft"></span></span>`;
  $('mjMeInfo').innerHTML = `<div class="av${frC(V.players[me])}">${avatar(V.players[me].kind)}</div><span class="nm">${esc(V.players[me].name)}</span><span class="wind ${me===V.dealer?'dealer':''}">${MJ.WIND[windOf(V,me)]}${me===V.dealer?'莊':''}</span><span class="sc">${V.scores[me]>0?'+':''}${V.scores[me]} 分</span>${tag}`;
  $('mjMelds').innerHTML = V.melds[me].map(m=>mjMeld(m,true)).join('') + (V.flowers[me].length?`<span class="meld">${V.flowers[me].map(f=>mjTile(f)).join('')}</span>`:'');
  // 手牌
  const box=$('mjHand'), W=box.clientWidth||340, drawn=V.drawn;
  const tiles = V.hand.filter(id=>id!==drawn); if(drawn!=null) tiles.push(drawn);
  // 一排放得下（每張至少 30px）就一排，放不下才分兩排；矮螢幕再把牌縮小
  const gap=3, total=tiles.length, cap = window.innerHeight < 720 ? 36 : 42;
  const oneRow = (W-(total-1)*gap-10)/total;
  const two = oneRow < 30, per = two ? Math.ceil(total/2) : total;
  const tw=Math.floor(Math.min(cap, two ? (W-(per-1)*gap)/per : oneRow));
  box.style.setProperty('--tw', tw+'px');
  const one = id => mjTile(id, (C.sel[0]===id?'sel ':'') + (id===drawn?'drawn ':'') + (myTurn?'tap':''));
  box.innerHTML = two ? `<div class="hrow">${tiles.slice(0,per).map(one).join('')}</div><div class="hrow">${tiles.slice(per).map(one).join('')}</div>` : `<div class="hrow">${tiles.map(one).join('')}</div>`;
  // 聽牌提示
  let ting='';
  if(myTurn && C.sel.length){ const w=MJ.waits(V.hand.filter(x=>x!==C.sel[0]), myMelds()); ting = w.length ? `打這張就聽 ${tingList(w)}` : '打這張還沒聽牌'; }
  else if(!myTurn && V.phase!=='over'){ const w=MJ.waits(V.hand, myMelds()); if(w.length) ting=`聽牌中 ${tingList(w)}`; }
  $('mjTing').innerHTML = ting;
  // 吃碰槓胡
  const cb=$('mjClaim');
  if(V.phase==='claim' && V.claim && V.claim.mine && !V.claim.answered){
    const NAMES={hu:'胡',pung:'碰',kong:'槓',chow:'吃'};
    let btns;
    if(C.chowPick) btns = V.claim.chows.map((pr,i)=>`<button class="candy plain chow" data-ch="${i}">${pr.concat(V.claim.tile).sort((a,b)=>MJ.kind(a)-MJ.kind(b)).map(id=>mjTile(id,'xs')).join('')}</button>`).join('') + '<button class="candy plain" data-c="back">返回</button>';
    else btns = ['hu','kong','pung','chow'].filter(c=>V.claim.mine.includes(c)).map(c=>`<button class="candy ${c==='hu'?'':'sun'}" data-c="${c}">${NAMES[c]}</button>`).join('') + '<button class="candy plain" data-c="pass">過</button>';
    cb.innerHTML = `<div class="cbt">${V.claim.rob?'可以搶槓胡':'要這張嗎'} ${mjTile(V.claim.tile,'sm')} <span class="tleft"></span></div><div class="cbb">${btns}</div>`;
    cb.hidden=false;
  } else if(V.phase==='claim' && V.claim && V.claim.mine){ cb.innerHTML='<div class="cbt">等其他人決定…</div>'; cb.hidden=false; C.chowPick=false; }
  else { cb.hidden=true; C.chowPick=false; }
  // 自己回合的按鈕
  const acts=$('mjActs');
  if(myTurn && V.self){
    const s=V.self; let h='';
    if(s.tsumo) h+=`<button class="candy" data-a="tsumo">自摸</button>`;
    s.ankong.forEach(k=>h+=`<button class="candy sun" data-a="ankong" data-k="${k}">暗槓 ${mjTile(-1,'xs',k)}</button>`);
    s.addkong.forEach(k=>h+=`<button class="candy sun" data-a="addkong" data-k="${k}">加槓 ${mjTile(-1,'xs',k)}</button>`);
    h+=`<button class="candy plain" data-a="hint">提示</button><button class="candy" data-a="discard" ${C.sel.length?'':'disabled'}>打出</button>`;
    acts.innerHTML=h;
  } else acts.innerHTML = V.phase==='over' ? '' : `<span class="mjwait">${V.phase==='claim'?'等大家決定要不要這張…':'等 '+esc(V.players[V.turn].name)+' 打牌…'}</span>`;
  $('me').classList.toggle('turn', myTurn);
  if(V.phase==='over' && V.result) showMjRes(); else $('mjRes').hidden=true;
  // 螢幕不夠高時，輪到自己或要決定吃碰時自動捲到手牌
  const need = myTurn || !cb.hidden, g=$('game');
  if(need && g.scrollHeight > g.clientHeight + 4) g.scrollTop = g.scrollHeight;
}

function showMjRes(){
  const V=C.V, R=V.result, me=V.me, isHost=C.mode==='host';
  let title, sub='', body='';
  if(R.type==='draw'){ title='流局'; sub='牌摸完了沒人胡，莊家連莊'; }
  else {
    const w=V.players[R.winner].name;
    title = R.self ? `${w} 自摸！` : `${w} 胡了`;
    sub = R.self ? '三家都要付' : `${V.players[R.loser].name} 放槍`;
    const hand=R.hands[R.winner].slice().sort((a,b)=>MJ.kind(a)-MJ.kind(b));
    body += `<div class="reshand">${R.meldsAll[R.winner].map(m=>`<span class="meld">${m.tiles.map(id=>mjTile(id,'xs')).join('')}</span>`).join('')}<span class="meld">${hand.map(id=>mjTile(id,'xs'+(id===R.tile?' win':''))).join('')}</span></div>`;
    body += `<div class="tai">${R.tai.map(([n,v])=>`<div><span>${esc(n)}</span><b>${v} 台</b></div>`).join('') || '<div><span>沒有台</span><b>0 台</b></div>'}
      <div class="tot"><span>合計</span><b>${R.total} 台</b></div></div>
      <p class="note">每家付：底 2＋${R.total} 台${(R.winner===R.dealer||R.loser===R.dealer||R.self)?`；跟莊家有關的另加 ${esc(R.dealerLine)}`:''}</p>`;
  }
  const hk=V.gid+'|'+V.handNo+'|'+(C.code||'local');
  if(R.type==='win' && R.winner===me && C.mjHandKey===hk) body += `<div class="rw small"><div class="rwc">${coinIcon}<b>+${C.mjHandCoins}</b><span>胡牌金幣（15＋每台 5）</span></div></div>`;
  body += `<div class="pays">${[0,1,2,3].map(pi=>`<div class="${pi===me?'me':''}"><span>${esc(V.players[pi].name)}</span><b class="${R.pay[pi]>0?'up':R.pay[pi]<0?'down':''}">${R.pay[pi]>0?'+':''}${R.pay[pi]}</b><i>總 ${V.scores[pi]}</i></div>`).join('')}</div>`;
  let btns='';
  if(V.over) btns = `<button class="candy" id="mjRank">看總排名</button>`;
  else if(isHost) btns = `<button class="candy" id="mjNextBtn">下一局</button>`;
  else btns = `<p class="note" style="text-align:center">等房主開下一局…</p>`;
  const key=V.handNo+'|'+V.gid;
  if($('mjRes').dataset.k!==key || $('mjRes').hidden){
    $('mjRes').dataset.k=key;
    $('mjResBox').innerHTML = `<h2>${esc(title)}</h2><p class="sub">${esc(sub)}</p>${body}<div class="rbtns">${btns}</div>`;
    setTimeout(()=>{ if(C&&C.V&&C.V.phase==='over') $('mjRes').hidden=false; }, R.type==='draw'?600:1300);
  }
}
$('mjResBox').addEventListener('click', e=>{
  if(e.target.closest('#mjNextBtn')){ $('mjRes').hidden=true; Snd.init(); mjNext(); }
  if(e.target.closest('#mjRank')){ $('mjRes').hidden=true; finish(); }
});

function mjEv(ev){
  if(ev.t==='deal'){ Snd.deal(); return; }
  if(ev.res){
    if(ev.res==='draw'){ fx('流局', true); Snd.pass(); return; }
    fx(ev.res==='tsumo'?'自摸！':'胡了！'); setTimeout(()=>Snd.win(),100); return;
  }
  const N={pung:'碰！', kong:'槓！', chow:'吃！', ankong:'暗槓！', addkong:'槓！'};
  if(N[ev.t]){ fx(N[ev.t], true); Snd.play(); showEmo(ev.by, N[ev.t].replace('！','')); return; }
  if(ev.t==='discard') Snd.tile();
}

$('mjHand').addEventListener('click', e=>{
  const t=e.target.closest('.tile'); const V=C&&C.V; if(!t||!V) return;
  if(!(V.turn===V.me && V.phase==='discard')) return;
  const id=+t.dataset.id;
  if(C.sel[0]===id){ sendAct({k:'mj', a:{t:'discard', id}}); return; }
  C.sel=[id]; Snd.tap(); renderMJ();
});
$('mjActs').addEventListener('click', e=>{
  const b=e.target.closest('button'); const V=C&&C.V; if(!b||!V) return;
  const a=b.dataset.a;
  if(a==='hint'){ C.sel=[MJ.bestDiscard(V.hand, myMelds(), 'normal')]; Snd.tap(); renderMJ(); toast('建議打這張，再點一次就打出'); return; }
  if(a==='discard'){ if(C.sel.length) sendAct({k:'mj', a:{t:'discard', id:C.sel[0]}}); return; }
  if(a==='tsumo') sendAct({k:'mj', a:{t:'tsumo'}});
  if(a==='ankong'||a==='addkong') sendAct({k:'mj', a:{t:a, kind:+b.dataset.k}});
});
$('mjClaim').addEventListener('click', e=>{
  const b=e.target.closest('button'); const V=C&&C.V; if(!b||!V||!V.claim) return;
  if(b.dataset.ch!=null){ sendAct({k:'mj', a:{t:'claim', c:'chow', with:V.claim.chows[+b.dataset.ch]}}); C.chowPick=false; return; }
  const c=b.dataset.c;
  if(c==='back'){ C.chowPick=false; renderMJ(); return; }
  if(c==='chow' && V.claim.chows.length>1){ C.chowPick=true; renderMJ(); return; }
  sendAct({k:'mj', a:{t:'claim', c, with: c==='chow' ? V.claim.chows[0] : undefined}});
});

/* ================= 金幣・排行・每日・商店 ================= */
const Prog = window.Progress.create((()=>{ try{ return localStorage; }catch(e){ const m={}; return {getItem:k=>m[k]||null, setItem:(k,v)=>{m[k]=v;}}; } })());
const fmt = n => Number(n).toLocaleString('en-US');
const coinIcon = '<i class="coin" aria-hidden="true"></i>';
function tierPill(rp){ const t=Prog.tierOf(rp); return `<span class="tier" style="--tc:${t.color}">${t.name}</span>`; }
function applyTheme(){ try{ const d=document.documentElement.dataset; d.table = Prog.theme(); d.back = Prog.backLook(); d.tiles = Prog.tilesLook(); }catch(e){} }
const FR_OK = /^(none|silver|sakura|fire|neon|rainbow)$/;
const frC = p => (p && p.fr && p.fr!=='none' && FR_OK.test(p.fr)) ? ' fr-'+p.fr : '';
const ttB = p => (p && p.tt) ? `<span class="ttb">${esc(p.tt)}</span>` : '';
const myP = () => { const c=Prog.card(); return {fr:c.fr, tt:c.tt}; };

function renderProfile(){
  const P=Prog.state, t=Prog.tierOf(P.rp), rank=Prog.myRank();
  $('pfAv').innerHTML = avatar(Prog.avatarKind()); $('pfAv').style.setProperty('--tc', t.color); $('pfAv').className='pfav'+frC(myP());
  $('pfName').innerHTML = esc(($('nick').value.trim()||'我').slice(0,8)) + ttB(myP());
  const cc=Prog.chestCount(); $('chestCnt').textContent=cc; $('chestCnt').hidden=!cc;
  $('pfTier').innerHTML = `${tierPill(P.rp)}<span class="rp">${fmt(P.rp)} 分</span>`;
  $('pfBar').style.width = (t.pct*100).toFixed(1)+'%';
  $('pfNext').textContent = t.next ? `再 ${t.next-P.rp} 分升${t.nextName}` : '最高段位';
  $('pfCoins').innerHTML = coinIcon+fmt(P.coins);
  $('pfRank').innerHTML = `全服 <b>#${rank}</b>`;
  $('pfStreak').innerHTML = P.streak>1 ? `連勝 <b>${P.streak}</b>` : '';
  $('pfStreak').hidden = P.streak<2;
  $('dotDaily').hidden = !Prog.hasClaimable();
  $('dotStats').hidden = !Prog.needBackup();
}

/* 跑馬燈：其他玩家的動態 */
const TICK_EV = [p=>`${p} 剛剛連勝 ${3+Math.floor(Math.random()*5)} 場`, p=>`${p} 升上${['黃金','白金','鑽石','大師'][Math.floor(Math.random()*4)]}`, p=>`${p} 麻將自摸 ${4+Math.floor(Math.random()*9)} 台`,
  p=>`${p} 大老二打出同花順`, p=>`${p} 排七一張都沒蓋`, p=>`${p} 衝上全服第 ${1+Math.floor(Math.random()*20)} 名`, p=>`${p} 簽到第 7 天`, p=>`${p} 買了星空牌桌`];
function tickerNext(){
  if($('menu').hidden) return;
  const b=Prog.boardNow().filter(x=>!x.me), p=b[Math.floor(Math.random()*Math.min(120,b.length))];
  const el=$('ticker'); el.classList.remove('in'); void el.offsetWidth;
  el.innerHTML = `<span class="tav">${avatar(p.kind)}</span>${esc(TICK_EV[Math.floor(Math.random()*TICK_EV.length)](p.name))}`;
  el.classList.add('in');
}
setInterval(tickerNext, 4200);

/* 排行榜 */
let rankTab='world', rankTimer=null;
function rowHTML(x, i){
  const me=!!x.me, name = me ? ($('nick').value.trim()||'我') : x.name, kind = me ? Prog.avatarKind() : x.kind;
  return `<div class="rrow ${me?'me':''} ${i<3?'top'+(i+1):''}"><span class="rno">${i+1}</span><span class="rav">${avatar(kind)}</span>
    <span class="rnm">${esc(name)}${me?' <em>你</em>':''}</span>${tierPill(x.rp)}<span class="rrp">${fmt(x.rp)}</span></div>`;
}
function renderRank(){
  document.querySelectorAll('#rankTabs .chip').forEach(b=>b.setAttribute('aria-pressed', b.dataset.t===rankTab));
  const box=$('rankList');
  if(rankTab==='world'){
    const L=Prog.boardNow(), mi=L.findIndex(x=>x.me);
    let h=L.slice(0,10).map(rowHTML).join('');
    if(mi>=10){ h+='<div class="rgap">⋯</div>'; for(let i=Math.max(10,mi-3); i<=Math.min(L.length-1,mi+3); i++) h+=rowHTML(L[i],i); }
    box.innerHTML=h;
    const above=L[mi-1];
    $('rankHead').innerHTML = above ? `你是全服第 <b>${mi+1}</b> 名，再 <b>${above.rp-L[mi].rp+1}</b> 分就能超過 ${esc(above.name)}` : '你是全服第一！大家都在追你';
  } else {
    const F=Prog.state.friends, me={me:true, rp:Prog.state.rp};
    const L=Object.entries(F).map(([name,f])=>({name, kind:f.kind, rp:f.rp})).concat(me).sort((a,b)=>b.rp-a.rp);
    box.innerHTML = L.length>1 ? L.map(rowHTML).join('') : '<p class="note" style="text-align:center;padding:24px 0">跟朋友連線玩過一局，他們就會出現在這裡。</p>';
    $('rankHead').textContent = L.length>1 ? '朋友的分數是最後一起玩時的紀錄' : '';
  }
}
$('btnRank').addEventListener('click', ()=>{ Snd.init(); Snd.tap(); renderRank(); $('ovRank').hidden=false; clearInterval(rankTimer); rankTimer=setInterval(()=>{ if(!$('ovRank').hidden) renderRank(); }, 8000); });
$('rankTabs').addEventListener('click', e=>{ const b=e.target.closest('.chip'); if(!b) return; rankTab=b.dataset.t; Snd.tap(); renderRank(); });

/* 每日 */
function renderDaily(){
  const c=Prog.checkinState();
  $('ciGrid').innerHTML = c.rewards.map((v,i)=>{ const d=i+1, got = c.done ? d<=c.day : d<c.day, today = !c.done && d===c.day;
    return `<div class="ci ${got?'got':''} ${today?'today':''} ${d===7?'big':''}"><span>第 ${d} 天</span>${coinIcon}<b>${v}</b></div>`; }).join('');
  $('btnCheckin').disabled = c.done; $('btnCheckin').textContent = c.done ? '今天簽到過了，明天再來' : `簽到領 ${c.rewards[c.day-1]} 金幣`;
  const ts=Prog.tasks(), left=ts.filter(t=>!t.claimed).length;
  $('taskChest').innerHTML = left ? `<i class="minichest c"></i><span>三個任務都領完，再送一個<b>普通寶箱</b>（還差 ${left} 個）</span>` : `<i class="minichest c"></i><span>今天任務全清，普通寶箱已送出！</span>`;
  $('taskChest').classList.toggle('done', !left);
  $('taskList').innerHTML = ts.map(t=>`<div class="task ${t.claimed?'claimed':''}"><div class="tt"><span><em class="tdiff d${t.d}">${'★'.repeat(t.d)}${['','簡單','普通','困難'][t.d]}</em>${esc(t.text)}</span>
    <div class="tbar"><i style="width:${(t.n/t.goal*100).toFixed(0)}%"></i></div><small>${t.n}/${t.goal}</small></div>
    <button class="candy ${t.done&&!t.claimed?'':'plain'}" data-task="${t.id}" ${t.done&&!t.claimed?'':'disabled'}>${t.claimed?'已領':coinIcon+t.reward}</button></div>`).join('');
}
$('btnDaily').addEventListener('click', ()=>{ Snd.init(); Snd.tap(); renderDaily(); $('ovDaily').hidden=false; });
$('btnCheckin').addEventListener('click', ()=>{ const r=Prog.doCheckin(); if(!r) return; Snd.win(); coinPop(r.coins); renderDaily(); renderProfile(); });
$('taskList').addEventListener('click', e=>{ const b=e.target.closest('[data-task]'); if(!b) return; const r=Prog.claimTask(b.dataset.task); if(!r) return; Snd.win(); coinPop(r.coins); renderDaily(); renderProfile();
  if(r.chest) setTimeout(()=>{ toast('任務全清！獲得普通寶箱，去「寶箱」打開吧', 2800); Snd.win(); }, 700); });

/* 商店 */
let shopTab='avatar';
function renderShop(){
  const P=Prog.state;
  document.querySelectorAll('#shopTabs .chip').forEach(b=>b.setAttribute('aria-pressed', b.dataset.t===shopTab));
  $('shopCoins').innerHTML = coinIcon+fmt(P.coins);
  $('shopGrid').innerHTML = window.Progress.SHOP.filter(x=>x.cat===shopTab).map(it=>{
    const own=P.owned.includes(it.id), on=P.equip[it.cat]===it.id;
    let pv='';
    if(it.cat==='avatar') pv=`<div class="spv av">${avatar(it.kind)}</div>`;
    else if(it.cat==='table') pv=`<div class="spv felt" data-th="${it.theme}"><i></i><i></i><i></i></div>`;
    else if(it.cat==='fx') pv=`<div class="spv fxpv fx-${it.id.slice(3)}"><span>${esc(it.desc)}</span></div>`;
    else if(it.cat==='throw') pv=`<div class="spv thpv"><span>${it.icon}</span><small>${esc(it.desc)}</small></div>`;
    else pv=`<div class="spv emo">${it.lines.slice(0,4).map(l=>`<span>${esc(l)}</span>`).join('')}</div>`;
    const btn = (it.cat==='throw' && own) ? '<button class="candy plain" disabled>已擁有</button>' : on ? '<button class="candy plain" disabled>使用中</button>' : own ? `<button class="candy sun" data-eq="${it.id}">使用</button>`
      : `<button class="candy" data-buy="${it.id}" ${P.coins<it.price?'disabled':''}>${coinIcon}${fmt(it.price)}</button>`;
    const tryBtn = it.cat==='fx' ? `<button class="candy plain try" data-try="${it.id}">試看</button>` : '';
    return `<div class="sitem ${on?'on':''}">${pv}<b>${esc(it.name)}</b>${tryBtn}${btn}</div>`;
  }).join('');
}
$('btnShop').addEventListener('click', ()=>{ Snd.init(); Snd.tap(); renderShop(); $('ovShop').hidden=false; });
$('shopTabs').addEventListener('click', e=>{ const b=e.target.closest('.chip'); if(!b) return; shopTab=b.dataset.t; Snd.tap(); renderShop(); });
$('shopGrid').addEventListener('click', e=>{
  const b=e.target.closest('button'); if(!b) return;
  if(b.dataset.try){ Snd.init(); playEmoFx(b.dataset.try, null, ['快點啦','你完了','好牌！','就這？'][Math.floor(Math.random()*4)], '我', Prog.avatarKind()); return; }
  if(b.dataset.buy){ const r=Prog.buy(b.dataset.buy); if(r.err){ toast(r.err); Snd.err(); return; } Snd.win(); toast(shopTab==='throw' ? '買到了，牌桌上點別人頭像就能丟' : '買到了，已經換上'); }
  else if(b.dataset.eq){ Prog.equip(b.dataset.eq); Snd.tap(); toast('換好了'); }
  applyTheme(); renderShop(); renderProfile();
});
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click', ()=>{ b.closest('.overlay').hidden=true; renderProfile(); }));

/* ================= 寶箱 ================= */
const RAR_NAME={c:'普通',r:'稀有',e:'史詩',l:'傳說'};
const COL_CATS=[['back','牌背'],['frame','頭像框'],['title','稱號'],['tiles','麻將牌']];
let colTab='frame';
function chestBox(t, cls=''){ return `<div class="cbox t-${t} ${cls}"><i class="lid"></i><i class="body"></i><i class="lock"></i></div>`; }
function colPreview(it){
  if(it.cat==='back') return `<div class="spv backpv" data-back="${it.look}"><i class="mini"></i><i class="mini"></i><i class="mini"></i></div>`;
  if(it.cat==='frame') return `<div class="spv"><div class="av fr-${it.look}">${avatar(Prog.avatarKind())}</div></div>`;
  if(it.cat==='title') return `<div class="spv"><span class="ttb big">${esc(it.text||'（不顯示）')}</span></div>`;
  return `<div class="spv tilepv" data-tiles="${it.look}">${mjTile(0)}${mjTile(52)}${mjTile(124)}</div>`;
}
function renderChest(){
  const S=Prog.chestState(), P=Prog.state;
  $('chestCoins').innerHTML = coinIcon+fmt(P.coins) + ` <span class="frag">◆ ${S.frags}</span>`;
  $('chestRow').innerHTML = ['c','r','e'].map(t=>{ const d=S.defs[t], n=S.chests[t];
    const odds=['c','r','e','l'].filter(k=>d.odds[k]).map(k=>`<span class="rr-${k}">${k==='c'?'金幣':RAR_NAME[k]} ${d.odds[k]}%</span>`).join('');
    return `<div class="chest t-${t}">${chestBox(t, n?'has':'')}<b>${d.name}</b><span class="ccount">× ${n}</span>
      <button class="candy ${n?'sun':'plain'}" data-open="${t}" ${n?'':'disabled'}>打開</button>
      ${d.price!=null?`<button class="candy plain small" data-cbuy="${t}" ${P.coins<d.price?'disabled':''}>${coinIcon}${fmt(d.price)} 買</button>`:'<span class="note">升段位送</span>'}
      <div class="odds">${odds}</div></div>`; }).join('');
  $('pityBar').innerHTML = `保底：再開 <b>${S.pityMax-S.pity}</b> 個必出史詩以上 <span class="pbar"><i style="width:${(S.pity/S.pityMax*100).toFixed(0)}%"></i></span>`;
  document.querySelectorAll('#colTabs .chip').forEach(b=>b.setAttribute('aria-pressed', b.dataset.t===colTab));
  const items = window.Progress.SHOP.filter(x=>x.cat===colTab);
  const got = items.filter(x=>P.owned.includes(x.id)).length;
  $('fragCnt').textContent = `已收集 ${got}/${items.length}`;
  $('colGrid').innerHTML = items.map(it=>{
    const own=P.owned.includes(it.id), on=P.equip[it.cat]===it.id;
    const btn = on ? '<button class="candy plain" disabled>使用中</button>' : own ? `<button class="candy sun" data-ceq="${it.id}">使用</button>`
      : `<button class="candy plain" data-frag="${it.id}" ${S.frags<it.frag?'disabled':''}>◆ ${it.frag} 換</button>`;
    return `<div class="sitem col ${on?'on':''} ${own?'':'locked'} ${it.rar?'rr-'+it.rar:''}">${it.rar?`<span class="rtag rr-${it.rar}">${RAR_NAME[it.rar]}</span>`:''}${colPreview(it)}<b>${esc(it.name)}</b>${btn}</div>`;
  }).join('');
}
function openChestFx(t){
  const r=Prog.openChest(t); if(r.err){ toast(r.err); return; }
  const ov=$('ovOpen'), st=$('opStage'); ov.hidden=false; ov.dataset.rar=r.rar;
  st.innerHTML = `<div class="opbox">${chestBox(t,'shake')}</div><p class="optip">點一下打開！</p>`;
  Snd.init(); [0,1,2].forEach(k=>Snd.tone(300+k*80,.08,{type:'square',vol:.05,at:k*.22}));
  let shown=false;
  const show=()=>{ if(shown) return; shown=true;
    let body;
    if(r.coins) body=`<div class="oprw">${coinIcon}<b>+${fmt(r.coins)}</b><span>金幣</span></div>`;
    else { const it=window.Progress.SHOP.find(x=>x.id===r.item.id), cat=COL_CATS.find(c=>c[0]===it.cat)[1];
      body=`<div class="oprw item">${colPreview(it)}<b>${esc(it.name)}</b><span>${cat}</span>${r.dup?`<em>已經有了 → 換成 ◆${r.frags} 碎片</em>`:'<em class="new">新收藏！已放進收藏</em>'}</div>`; }
    const more=Prog.chestState().chests[t];
    st.innerHTML = `<div class="burst"></div><div class="opcard"><span class="rtag big rr-${r.rar}">${r.rar==='c'?'普通':RAR_NAME[r.rar]}${r.pity?'・保底':''}</span>${body}
      <div class="opbtns">${more?`<button class="candy sun" data-again="${t}">再開一個（剩 ${more}）</button>`:''}<button class="candy" data-opclose>收下</button></div></div>`;
    if(r.rar==='l'){ Snd.win(); setTimeout(()=>Snd.win(),300); fx('傳說！'); }
    else if(r.rar==='e'){ Snd.win(); }
    else { [784,988,1175].forEach((f,k)=>Snd.tone(f,.15,{type:'triangle',vol:.08,at:k*.08})); }
    try{ navigator.vibrate && navigator.vibrate(r.rar==='l'?[60,40,60,40,120]:r.rar==='e'?[50,40,80]:30); }catch(e){}
    renderChest(); renderProfile();
  };
  st.onclick=e=>{ if(!shown){ show(); return; }
    const a=e.target.closest('[data-again]'); if(a){ openChestFx(a.dataset.again); return; }
    if(e.target.closest('[data-opclose]')){ ov.hidden=true; } };
  setTimeout(show, 1500);
}
$('btnChest').addEventListener('click', ()=>{ Snd.init(); Snd.tap(); renderChest(); $('ovChest').hidden=false; });
$('colTabs').addEventListener('click', e=>{ const b=e.target.closest('.chip'); if(!b) return; colTab=b.dataset.t; Snd.tap(); renderChest(); });
$('ovChest').addEventListener('click', e=>{
  const b=e.target.closest('button'); if(!b) return;
  if(b.dataset.open){ openChestFx(b.dataset.open); return; }
  if(b.dataset.cbuy){ const r=Prog.buyChest(b.dataset.cbuy); if(r.err){ toast(r.err); Snd.err(); return; } Snd.win(); toast('買到了'); renderChest(); renderProfile(); return; }
  if(b.dataset.ceq){ Prog.equip(b.dataset.ceq); Snd.tap(); toast('換好了'); applyTheme(); renderChest(); renderProfile(); return; }
  if(b.dataset.frag){ const r=Prog.fragBuy(b.dataset.frag); if(r.err){ toast(r.err); Snd.err(); return; } Snd.win(); toast('換到了，已經戴上'); applyTheme(); renderChest(); renderProfile(); }
});
function coinPop(n){
  const el=document.createElement('div'); el.className='coinpop'; el.innerHTML=`${coinIcon}+${fmt(n)}`;
  document.body.appendChild(el); setTimeout(()=>el.remove(), 1400);
}

/* 結算獎勵 */
function onlineWithFriends(){ return C.mode==='guest' || (H && H.online && humans().length>1); }
function recordEnd(V){
  const key=V.gid+'|'+(C.code||'local');
  if(C.rewarded===key) return C.reward;
  C.rewarded=key;
  const place=V.order.indexOf(V.me);
  const pts = V.type==='seven' ? V.myCov.reduce((a,id)=>a+X.pts(id),0) : null;
  const rivals = V.players.map((p,i)=>({p,i})).filter(x=>x.i!==V.me && !x.p.bot).map(x=>({name:x.p.name, kind:x.p.kind, beat: V.order.indexOf(x.i) > place}));
  C.reward = Prog.recordGame({game:V.type, place, n:V.n, online:onlineWithFriends(), diff: C.mode==='host' ? H.diff : (C.diff||'normal'), bomb:(C.bombs||0)>0, bombs:C.bombs||0, sevenPts:pts, rivals,
    bkAll: V.type==='bk' && V.pieces && V.pieces[V.me].length===0, rm4: !!C.rm4});
  C.bombs=0; C.rm4=false;
  announceAch(C.reward.unlocked);
  (C.reward.chests||[]).forEach((c,i)=>setTimeout(()=>{ toast(`${c.why}！獲得${window.Progress.CHESTS[c.t].name}`, 2600); Snd.win(); }, 900+i*2600));
  return C.reward;
}
function rewardHTML(R){
  if(!R) return '';
  const rk = R.before.rank - R.after.rank;
  return `<div class="rw">
    <div class="rwc">${coinIcon}<b class="count" data-to="${R.coins}">+0</b><span>金幣</span></div>
    <div class="rwl">${R.lines.map(([t,v])=>`<span>${esc(t)}${v!=null?' '+v:''}</span>`).join('')}${(R.unlocked||[]).map(a=>`<span class="achline">成就「${esc(a.name)}」+${a.reward}</span>`).join('')}${(R.chests||[]).map(c=>`<span class="achline chestline">${esc(c.why)} → ${window.Progress.CHESTS[c.t].name}</span>`).join('')}</div>
    <div class="rwr"><span>${tierPill(R.after.rp)} ${fmt(R.after.rp)} 分 <em class="${R.rpd>=0?'up':'down'}">${R.rpd>=0?'+':''}${R.rpd}</em></span>
      <span>全服 #${R.after.rank} ${rk>0?`<em class="up">↑${rk}</em>`:rk<0?`<em class="down">↓${-rk}</em>`:''}</span></div>
    <div class="pbar"><i style="width:${(R.after.tier.pct*100).toFixed(1)}%;--tc:${R.after.tier.color}"></i></div>
  </div>`;
}
function animateCount(root){
  root.querySelectorAll('.count').forEach(el=>{ const to=+el.dataset.to, t0=performance.now();
    const f=t=>{ const k=Math.min(1,(t-t0)/700); el.textContent='+'+fmt(Math.round(to*k)); if(k<1) requestAnimationFrame(f); }; requestAnimationFrame(f); });
}
function celebrate(R){
  if(!R) return;
  if(R.tierUp) setTimeout(()=>{ fx(`升上${R.after.tier.name}！`); Snd.win(); }, 500);
  else if(R.streak>=3) setTimeout(()=>fx(`${R.streak} 連勝！`, true), 400);
}

/* 我的戰績 */
const GLABEL={big2:'大老二', seven:'排七', mj:'麻將', bk:'Blokus', rm:'拉密'};
function agoText(t){ const m=Math.max(0,(Date.now()-t)/60000); if(m<1) return '剛剛'; if(m<60) return Math.floor(m)+' 分鐘前'; if(m<1440) return Math.floor(m/60)+' 小時前'; return Math.floor(m/1440)+' 天前'; }
function sparkSVG(h){
  if(h.length<2) return '<p class="note" style="text-align:center">再玩一局就會畫出走勢</p>';
  const W=320, Hh=86, pad=8, mn=Math.min(...h), mx=Math.max(...h), span=Math.max(20, mx-mn);
  const x=i=>pad+i*(W-2*pad)/(h.length-1), y=v=>Hh-pad-(v-mn)/span*(Hh-2*pad-14);
  const pts=h.map((v,i)=>`${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const last=h[h.length-1], peak=h.indexOf(mx);
  return `<svg viewBox="0 0 ${W} ${Hh}" class="spark" role="img" aria-label="最近 ${h.length} 局積分走勢，從 ${h[0]} 到 ${last}">
    <polygon points="${x(0)},${Hh-pad} ${pts} ${x(h.length-1)},${Hh-pad}" fill="var(--pink)" opacity=".14"/>
    <polyline points="${pts}" fill="none" stroke="var(--pink)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${x(peak)}" cy="${y(mx)}" r="3.5" fill="var(--sun)" stroke="var(--ink)" stroke-width="1.5"/>
    <text x="${Math.min(W-30,Math.max(30,x(peak)))}" y="${y(mx)-8}" text-anchor="middle" font-size="11" font-weight="700" fill="var(--ink)">最高 ${mx}</text>
    <circle cx="${x(h.length-1)}" cy="${y(last)}" r="5" fill="var(--pink)" stroke="var(--ink)" stroke-width="2"/></svg>`;
}
function renderStats(){
  const P=Prog.state, st=P.st, t=Prog.tierOf(P.rp), name=($('nick').value.trim()||'我').slice(0,8);
  const G=st.byGame, tg=Object.values(G).reduce((a,b)=>a+b.g,0), tw=Object.values(G).reduce((a,b)=>a+b.w,0), wr = tg ? Math.round(tw/tg*100) : 0;
  const pct=(a,b)=>b?Math.round(a/b*100)+'%':'—';
  const A=Prog.achState().sort((x,y)=>(!!y.got-!!x.got) || (y.n/y.goal - x.n/x.goal)), got=A.filter(a=>a.got).length;
  let h = `<div class="sthero">
    <div class="pfav${frC(myP())}" style="--tc:${t.color}">${avatar(Prog.avatarKind())}</div>
    <div class="sthn"><b>${esc(name)}</b><span>${tierPill(P.rp)} ${fmt(P.rp)} 分 · 最高 ${fmt(st.peakRp)}</span><small>玩了 ${st.days||0} 天${st.firstDay?` · 從 ${st.firstDay.slice(5).replace('-','/')} 開始`:''}</small></div>
  </div>
  <div class="stbig">
    <div><b>${fmt(tg)}</b><span>總場數</span></div>
    <div class="hl"><b>${wr}<small>%</small></b><span>勝率</span></div>
    <div><b>${P.best}</b><span>最高連勝</span></div>
    <div><b>${st.bestRank?'#'+st.bestRank:'—'}</b><span>最佳排名</span></div>
  </div>
  <span class="lbl">積分走勢（最近 ${st.rpHist.length} 局）</span>
  <div class="stcard">${sparkSVG(st.rpHist)}</div>
  <span class="lbl">各遊戲</span>
  <div class="stgames">${['big2','seven','mj','bk','rm','dc','cc','pr'].map(g=>{ const b=G[g]||{g:0,w:0,places:[0,0,0,0]}, tot=b.places.reduce((a,c)=>a+c,0)||1;
    return `<div class="stg"><b>${GLABEL[g]}</b><span class="wr">${pct(b.w,b.g)}</span><small>${b.g} 局 · ${b.w} 勝</small>
      <div class="plbar">${b.places.map((v,i)=>v?`<i class="p${i}" style="flex:${v}" title="第 ${i+1} 名 ${v} 次"></i>`:'').join('')||'<i class="p9" style="flex:1"></i>'}</div></div>`; }).join('')}</div>
  <div class="pllegend"><span><i class="p0"></i>第 1</span><span><i class="p1"></i>第 2</span><span><i class="p2"></i>第 3</span><span><i class="p3"></i>第 4</span></div>
  <span class="lbl">高光紀錄</span>
  <div class="sthl">
    <div><b>${st.mjMaxTai||0}<small>台</small></b><span>麻將最大一把</span>${st.mjBest&&st.mjBest.names.length?`<em>${esc(st.mjBest.names.slice(0,3).join('、'))}</em>`:''}</div>
    <div><b>${st.mjTsumo}</b><span>自摸次數</span></div>
    <div><b>${st.bombs}</b><span>大老二炸彈</span></div>
    <div><b>${st.sevenClean}</b><span>完美排七</span></div>
    <div><b>${fmt(st.coinsEarned)}</b><span>累積賺到金幣</span></div>
    <div><b>${st.online}</b><span>跟朋友連線</span></div>
  </div>`;
  const R=Object.entries(st.h2h).sort((a,b)=>b[1].g-a[1].g).slice(0,6);
  h += `<span class="lbl">宿敵</span>` + (R.length ? `<div class="rivals">${R.map(([n,r])=>{ const p=Math.round(r.above/r.g*100);
      return `<div class="rv"><span class="rav">${avatar(r.kind||'pup')}</span><span class="rnm">${esc(n)}<small>同桌 ${r.g} 局</small></span>
        <div class="vs"><i style="width:${p}%"></i></div><b class="${p>=50?'up':'down'}">${p>=50?'贏':'輸'} ${p>=50?p:100-p}%</b></div>`; }).join('')}</div>`
    : `<p class="note">跟朋友連線玩，這裡會記錄你跟每位朋友的勝負，看誰才是真正的宿敵。</p>`);
  h += `<span class="lbl">成就 ${got}/${A.length}</span><div class="achs">${A.map(a=>`<div class="ach ${a.got?'got':''}" title="${esc(a.desc)}">
      <i class="badge c-${a.cat}">${a.got?'★':Math.floor(a.n/a.goal*100)+'%'}</i><b>${esc(a.name)}</b><small>${esc(a.desc)}</small>
      ${a.got?'':`<div class="tbar"><i style="width:${(a.n/a.goal*100).toFixed(0)}%"></i></div>`}<em>${coinIcon}${fmt(a.reward)}</em></div>`).join('')}</div>`;
  h += `<span class="lbl">最近對局</span>` + (P.log.length ? `<div class="recent">${P.log.slice(0,10).map(l=>`<div class="rc"><span class="rg">${GLABEL[l.game]||''}</span><span class="rp p${l.place}">第 ${l.place+1}</span><span class="rt">${agoText(l.t)}</span><span class="rcn">${coinIcon}+${l.coins}</span><span class="${l.rpd>=0?'up':'down'}">${l.rpd>=0?'+':''}${l.rpd}</span></div>`).join('')}</div>` : '<p class="note">還沒有對局紀錄</p>');
  $('statsBody').innerHTML = h;
}
function bragText(){
  const P=Prog.state, st=P.st, t=Prog.tierOf(P.rp), G=st.byGame, tg=Object.values(G).reduce((a,b)=>a+b.g,0), tw=Object.values(G).reduce((a,b)=>a+b.w,0);
  const name=($('nick').value.trim()||'我');
  const link = location.protocol.startsWith('http') && !location.hostname.endsWith('claude.ai') && !location.hostname.endsWith('claudeusercontent.com') ? '\n'+location.origin+location.pathname+'?openExternalBrowser=1' : '';
  return `【牌搭子】${name} 的戰績\n段位：${t.name} ${P.rp} 分（全服 #${Prog.myRank()}）\n總場數 ${tg}，勝率 ${tg?Math.round(tw/tg*100):0}%，最高連勝 ${P.best}\n麻將最大一把 ${st.mjMaxTai} 台，成就 ${Prog.achState().filter(a=>a.got).length} 個\n敢來挑戰我嗎？${link}`;
}
$('btnStats').addEventListener('click', ()=>{ Snd.init(); Snd.tap(); renderStats(); $('ovStats').hidden=false; $('statsBody').scrollTop=0; });
$('pfAv').addEventListener('click', ()=>$('btnStats').click());
$('btnBrag').addEventListener('click', ()=>{
  const t=bragText();
  const fallback=()=>{ $('bragText').textContent=t; $('bragText').hidden=false; toast('請長按下面的文字複製'); };
  try{ navigator.clipboard.writeText(t).then(()=>toast('已複製，貼到 LINE 炫耀一下'), fallback); }catch(e){ fallback(); }
});
function announceAch(list){
  (list||[]).forEach((a,i)=>setTimeout(()=>{ toast(`解鎖成就「${a.name}」＋${a.reward} 金幣`, 2200); Snd.join(); }, 1600+i*2300));
}

/* ================= 方塊佔地 ================= */
const BK_COL = ['#3B82F6','#F5B700','#EF4444','#22B35A'];
function bkLocal(){ const V=C.V; return {n:V.n, N:V.N, starts:V.starts, board:V.board, left:V.pieces, first:V.first, out:V.out, turn:V.turn, over:V.over}; }
function bkPivot(shape){ const cx=shape.reduce((a,c)=>a+c[0],0)/shape.length, cy=shape.reduce((a,c)=>a+c[1],0)/shape.length;
  let best=shape[0], bd=1e9; shape.forEach(c=>{ const d=(c[0]-cx)**2+(c[1]-cy)**2; if(d<bd){bd=d;best=c;} }); return best; }
const bkShapeKey = sh => K.norm(sh).map(c=>c.join(',')).join(';');
function bkCellsAt(shape, at){ const pv=bkPivot(shape); return shape.map(([x,y])=>[x-pv[0]+at[0], y-pv[1]+at[1]]); }
function bkCanPrep(){ const V=C&&C.V; return !!V && V.type==='bk' && !V.over && !V.out[V.me] && V.pieces[V.me].length>0; }
function bkCells(){ const b=C.bk; return (b && b.piece!=null && b.at) ? bkCellsAt(b.shape, b.at) : null; }
function pieceSVG(shape, color, u){
  u=u||9; const w=Math.max(...shape.map(c=>c[0]))+1, h=Math.max(...shape.map(c=>c[1]))+1, r=u*0.22;
  return `<svg viewBox="-1 -1 ${w*u+2} ${h*u+3}" width="${w*u+2}" height="${h*u+3}" aria-hidden="true">${shape.map(([x,y])=>
    `<rect x="${x*u}" y="${y*u+1}" width="${u}" height="${u}" rx="${r}" fill="#1B1B3A" opacity=".35"/><rect x="${x*u}" y="${y*u}" width="${u}" height="${u}" rx="${r}" fill="${color}" stroke="#1B1B3A" stroke-width="1.1"/><rect x="${x*u+u*.18}" y="${y*u+u*.14}" width="${u*.5}" height="${u*.2}" rx="${u*.1}" fill="#fff" opacity=".45"/>`).join('')}</svg>`;
}
function bkBuild(){
  const V=C.V, g=$('bkBoard'); g.style.setProperty('--n', V.N);
  let h=''; for(let i=0;i<V.N*V.N;i++) h+=`<i data-i="${i}"></i>`;
  g.innerHTML=h;
  C.bk={piece:null, shape:null, at:null, ver:-1, moves:null, drop:null, prevBoard:null};
}
function bkMoves(){
  const V=C.V;
  if(C.bk.ver!==V.ver){ C.bk.ver=V.ver; C.bk.moves = (V.turn===V.me && !V.over) ? K.legalMoves(bkLocal(), V.me) : []; }
  return C.bk.moves;
}
// 目前選的方塊、目前方向，所有能放的位置（以樞紐格表示）
function bkSpots(){
  const b=C.bk; if(b.piece==null) return new Map();
  const key=bkShapeKey(b.shape), pv=bkPivot(b.shape), out=new Map(), N=C.V.N;
  bkMoves().forEach(m=>{ if(m.piece!==b.piece || bkShapeKey(m.cells)!==key) return;
    const mx=Math.min(...m.cells.map(c=>c[0])), my=Math.min(...m.cells.map(c=>c[1]));
    out.set((pv[1]+my)*N+pv[0]+mx, [pv[0]+mx, pv[1]+my]); });
  return out;
}
// 吸附：手指附近 2 格內有能放的位置就自動對準
function bkSnap(at){
  const spots=bkSpots(), N=C.V.N; if(spots.has(at[1]*N+at[0])) return {at, snapped:false};
  let best=null, bd=5.1;
  spots.forEach(p=>{ const d=(p[0]-at[0])**2+(p[1]-at[1])**2; if(d<bd){bd=d;best=p;} });
  return best ? {at:best, snapped:true} : {at, snapped:false};
}
function bkRenderBoard(){
  const V=C.V, me=V.me, myTurn=V.turn===me && !V.over;
  const cells=$('bkBoard').children, ghost=bkCells(), gset=new Set();
  let legal=false;
  if(ghost){ if(myTurn) legal = !K.validate(bkLocal(), me, C.bk.piece, ghost); ghost.forEach(([x,y])=>{ if(x>=0&&y>=0&&x<V.N&&y<V.N) gset.add(y*V.N+x); }); }
  C.bk.legal=legal;
  // 別人正在移動的方塊（即時看到）
  const pk=livePeek(), pset=new Set();
  if(pk && pk.p.cells) pk.p.cells.forEach(([x,y])=>{ if(x>=0&&y>=0&&x<V.N&&y<V.N) pset.add(y*V.N+x); });
  $('bkBoard').style.setProperty('--pk', pk ? BK_COL[pk.by] : '');
  const spots = myTurn && C.bk.piece!=null ? bkSpots() : new Map();
  const anc = myTurn && C.bk.piece==null ? new Set(K.anchors(bkLocal(), me).map(([x,y])=>y*V.N+x)) : new Set();
  const last = V.last ? new Set(V.last.cells.map(([x,y])=>y*V.N+x)) : new Set();
  const starts = new Map(V.starts.map(([x,y],i)=>[y*V.N+x,i]));
  const prev=C.bk.prevBoard;
  for(let i=0;i<cells.length;i++){
    const o=V.board[i], el=cells[i];
    el.style.setProperty('--c', o>=0 ? BK_COL[o] : '');
    let cls = o>=0 ? 'f' : '';
    if(o>=0 && prev && prev[i]<0) cls+=' drop';
    if(last.has(i)) cls+=' last';
    if(o<0 && anc.has(i)) cls+=' anc';
    if(o<0 && spots.has(i)) cls+=' spot';
    if(o<0 && starts.has(i) && V.first[starts.get(i)]) { cls+=' st'; el.style.setProperty('--sc', BK_COL[starts.get(i)]); }
    if(gset.has(i)) cls+= !myTurn ? ' gh pre' : legal ? ' gh ok' : ' gh bad';
    else if(pset.has(i)) cls+= o>=0 ? ' pk over' : ' pk';
    if(el.className!==cls) el.className=cls;
  }
  if(prev && cells.length){ [...cells].forEach((el,i)=>{ if(el.classList.contains('drop')) el.style.animationDelay=((i%7)*25)+'ms'; }); }
  C.bk.prevBoard=V.board.slice();
  if(myTurn) peekSend({cells: ghost || null, pc: C.bk.piece});
  // 浮動操作列：貼在預覽方塊旁邊
  const fb=$('bkFloat');
  if(ghost && !C.bk.dragging){
    const N=V.N, minY=Math.min(...ghost.map(c=>c[1])), maxY=Math.max(...ghost.map(c=>c[1])), cx=ghost.reduce((a,c)=>a+c[0],0)/ghost.length;
    const up = minY > N*0.35, W=$('bkBoard').getBoundingClientRect().width;
    fb.hidden=false;
    const half=(fb.offsetWidth||170)/2, px=(cx+0.5)/N*W;
    fb.style.left=Math.min(W-half-2, Math.max(half+2, px))+'px';
    fb.style.top = up ? (minY/N*100)+'%' : ((maxY+1)/N*100)+'%';
    fb.className = up ? 'up' : 'down';
    $('bkfOk').disabled=!legal || !myTurn;
  } else fb.hidden=true;
}
function renderBK(){
  const V=C.V, me=V.me, myTurn=V.turn===me && !V.over;
  if(!$('bkBoard').children.length || $('bkBoard').children.length!==V.N*V.N) bkBuild();
  if(!bkCanPrep() && C.bk.piece!=null){ C.bk.piece=null; C.bk.at=null; }
  // 剛輪到自己：先擺好的方塊自動對準最近能放的位置
  if(myTurn && !C.bk.wasMy && C.bk.piece!=null && C.bk.at){ const r=bkSnap(C.bk.at); if(r.snapped) C.bk.at=r.at; }
  C.bk.wasMy=myTurn;
  $('game').classList.toggle('myturn', myTurn); $('game').classList.toggle('waiting', !myTurn && !V.over);
  $('bkBoard').style.setProperty('--me', BK_COL[me]); $('bkFloat').style.setProperty('--me', BK_COL[me]);
  $('bkPlayers').innerHTML = V.players.map((p,i)=>`<div class="bkp ${V.turn===i&&!V.over?'turn':''} ${V.out[i]?'out':''} ${i===me?'me':''}" style="--pc:${BK_COL[i]}">
    <span class="bkav">${avatar(p.kind)}</span><span class="bkn">${esc(i===me?'我':p.name)}</span>
    <span class="bkc">${V.counts[i]}格</span>${V.status[i]?`<em>${esc(V.status[i])}</em>`:''}${seatTail(V,i)}</div>`).join('');
  bkRenderBoard();
  const moves = bkMoves(), can = new Set(moves.map(m=>m.piece));
  $('bkTray').innerHTML = V.pieces[me].slice().sort((a,b)=>K.SIZE[b]-K.SIZE[a]||a-b).map(pc=>
    `<button class="bkpc ${C.bk.piece===pc?'on':''} ${myTurn&&!can.has(pc)?'no':''}" data-pc="${pc}" aria-label="${K.SIZE[pc]} 格方塊">${pieceSVG(C.bk.piece===pc?C.bk.shape:K.SHAPES[pc], BK_COL[me], 9)}</button>`).join('')
    || '<span class="note">全部放完了！</span>';
  const ghost=bkCells();
  const pk=livePeek();
  const tag = V.over ? '這局結束' : myTurn ? (C.bk.piece==null ? '把下面的方塊拖到棋盤上，或點一下選起來' : ghost ? (C.bk.legal ? '可以放！按 ✓ 確定' : '這裡不能放，拖到亮點的位置') : '亮點是這塊能放的位置，點一下或拖過去')
    : (pk ? `<b class="pkname" style="--pc:${BK_COL[V.turn]}">${esc(V.players[V.turn].name)}</b> 正在移動方塊…` : `等 ${esc(V.players[V.turn].name)} 放方塊…`)
      + (bkCanPrep() ? (C.bk.piece!=null ? ' · <span class="prep">先擺好，輪到你再按 ✓</span>' : ' · <span class="prep">可以先選方塊、先擺位置</span>') : '');
  $('bkTag').innerHTML = tag + (myTurn&&V.timed?' <span class="tleft"></span>':'');
  $('bkPlace').disabled = !myTurn || !ghost || !C.bk.legal;
  $('bkPlace').classList.toggle('ready', myTurn && !!ghost && C.bk.legal);
  ['bkRot','bkFlip'].forEach(id=>$(id).disabled = C.bk.piece==null);
  $('bkHint').disabled = !myTurn;
  $('bkSel').innerHTML = C.bk.piece!=null ? pieceSVG(C.bk.shape, BK_COL[me], 12) : '<span>選中的方塊</span>';
}
function bkSelect(pc){ C.bk.piece=pc; C.bk.shape=K.norm(K.SHAPES[pc]); C.bk.at=null; }
function bkTransform(fn){
  if(C.bk.piece==null) return;
  C.bk.shape=fn(C.bk.shape);
  if(C.bk.at){ const r=bkSnap(C.bk.at); if(r.snapped && Math.abs(r.at[0]-C.bk.at[0])+Math.abs(r.at[1]-C.bk.at[1])<=2) C.bk.at=r.at; }
  Snd.tap(); renderBK();
}
function bkPlaceNow(){
  const cells=bkCells(); if(!cells || !C.bk.legal) return;
  const pc=C.bk.piece; C.bk.piece=null; C.bk.at=null; C.bk.shape=null;
  try{ navigator.vibrate && navigator.vibrate(15); }catch(e){}
  sendAct({k:'place', piece:pc, cells});
}
function bkCellFromPoint(x, y){
  const g=$('bkBoard'), r=g.getBoundingClientRect(), N=C.V.N;
  if(x<r.left||y<r.top||x>r.right||y>r.bottom) return null;
  return [Math.min(N-1,Math.floor((x-r.left)/r.width*N)), Math.min(N-1,Math.floor((y-r.top)/r.height*N))];
}
/* 拖拉：從方塊盤往上拖、或拖動棋盤上的預覽 */
const DRAG_LIFT = 64;
let bkDrag=null;
function bkDragStart(e, fromBoard){
  if(!bkCanPrep()) return;
  bkDrag={id:e.pointerId, x0:e.clientX, y0:e.clientY, started:fromBoard, fromBoard};
  if(fromBoard) bkDragBegin(e);
}
function bkDragBegin(e){
  bkDrag.started=true; C.bk.dragging=true;
  const cs=$('bkBoard').getBoundingClientRect().width/C.V.N, el=$('bkDragEl');
  el.innerHTML=pieceSVG(C.bk.shape, BK_COL[C.V.me], Math.max(14,cs*1.05)); el.hidden=false;
  bkDragMove(e); Snd.tap();
}
function bkDragMove(e){
  if(!bkDrag||e.pointerId!==bkDrag.id) return;
  if(!bkDrag.started){
    const dx=e.clientX-bkDrag.x0, dy=e.clientY-bkDrag.y0;
    if(dy<-10 && Math.abs(dy)>Math.abs(dx)) bkDragBegin(e); else { if(Math.abs(dx)>12) bkDrag=null; return; }
  }
  e.preventDefault();
  const el=$('bkDragEl'), lift=bkDrag.fromBoard?0:DRAG_LIFT, px=e.clientX, py=e.clientY-lift;
  const pv=bkPivot(C.bk.shape), cs=$('bkBoard').getBoundingClientRect().width/C.V.N, u=Math.max(14,cs*1.05);
  el.style.transform=`translate(${px-(pv[0]+0.5)*u}px, ${py-(pv[1]+0.5)*u}px) scale(1.08)`;
  const cell=bkCellFromPoint(px, py);
  if(cell){ const r=bkSnap(cell); const changed=!C.bk.at||C.bk.at[0]!==r.at[0]||C.bk.at[1]!==r.at[1]; C.bk.at=r.at;
    if(changed){ bkRenderBoard(); if(r.snapped||bkSpots().has(r.at[1]*C.V.N+r.at[0])){ try{ navigator.vibrate && navigator.vibrate(5); }catch(err){} } } }
  el.classList.toggle('over', !!cell);
}
function bkDragEnd(e){
  if(!bkDrag||e.pointerId!==bkDrag.id) return;
  const was=bkDrag.started; bkDrag=null; C.bk.dragging=false; $('bkDragEl').hidden=true;
  if(was){ renderBK(); if(C.bk.at && C.bk.legal) Snd.play(); }
}
$('bkTray').addEventListener('pointerdown', e=>{
  const b=e.target.closest('.bkpc'); if(!b||!bkCanPrep()) return;
  const pc=+b.dataset.pc; if(C.bk.piece!==pc){ bkSelect(pc); renderBK(); }
  bkDragStart(e, false);
});
$('bkBoard').addEventListener('pointerdown', e=>{
  const V=C&&C.V; if(!bkCanPrep()||C.bk.piece==null) return;
  const c=e.target.closest('i'); if(!c) return;
  const i=+c.dataset.i, ghost=bkCells();
  if(ghost && ghost.some(([x,y])=>y*V.N+x===i)){ e.preventDefault(); bkDragStart(e, true); }
});
window.addEventListener('pointermove', bkDragMove, {passive:false});
window.addEventListener('pointerup', bkDragEnd);
window.addEventListener('pointercancel', bkDragEnd);
$('bkTray').addEventListener('click', e=>{
  const b=e.target.closest('.bkpc'); if(!b||!bkCanPrep()) return;
  const pc=+b.dataset.pc; if(C.bk.piece===pc && !C.bk.at) return;
  if(C.bk.piece!==pc){ bkSelect(pc); Snd.tap(); renderBK(); }
});
$('bkBoard').addEventListener('click', e=>{
  const c=e.target.closest('i'); const V=C&&C.V; if(!c||!bkCanPrep()) return;
  if(C.bk.piece==null){ if(V.turn===V.me) toast('先選下面的一塊方塊'); return; }
  const i=+c.dataset.i, ghost=bkCells();
  if(ghost && ghost.some(([x,y])=>y*V.N+x===i)) return; // 點在預覽上不移動（避免拖完又被當成點擊）
  C.bk.at=bkSnap([i%V.N, Math.floor(i/V.N)]).at; Snd.tap(); renderBK();
});
$('bkSel').addEventListener('click', ()=>bkTransform(K.rotate));
$('bkRot').addEventListener('click', ()=>bkTransform(K.rotate));
$('bkFlip').addEventListener('click', ()=>bkTransform(K.flip));
$('bkfRot').addEventListener('click', ()=>bkTransform(K.rotate));
$('bkfFlip').addEventListener('click', ()=>bkTransform(K.flip));
$('bkfOk').addEventListener('click', bkPlaceNow);
$('bkfNo').addEventListener('click', ()=>{ C.bk.at=null; Snd.tap(); renderBK(); });
$('bkHint').addEventListener('click', ()=>{
  const V=C.V; const m=K.aiChoose(bkLocal(), V.me, 'hard'); if(!m){ toast('沒地方放了'); return; }
  C.bk.piece=m.piece; C.bk.shape=K.norm(m.cells); const pv=bkPivot(C.bk.shape);
  const mx=Math.min(...m.cells.map(c=>c[0])), my=Math.min(...m.cells.map(c=>c[1]));
  C.bk.at=[pv[0]+mx, pv[1]+my]; Snd.tap(); renderBK(); toast('建議放這裡，按 ✓ 確定');
});
$('bkPlace').addEventListener('click', bkPlaceNow);

/* ================= 數字組牌 ================= */
const RM_COL=['#E8433F','#2B66CF','#E58A00','#1B1B3A'];
function rmTile(id, cls=''){
  if(R.isJ(id)) return `<span class="rt j ${cls}" data-id="${id}"><b>鬼</b><i>★</i></span>`;
  return `<span class="rt ${cls}" data-id="${id}" style="--rc:${RM_COL[R.col(id)]}"><b>${R.num(id)}</b><i>●</i></span>`;
}
const RM_CN=['紅','藍','橘','黑'];
// 這一組為什麼不成立（給玩家看的白話）
function rmWhy(set){
  if(set.length<3) return `只有 ${set.length} 張，一組至少 3 張`;
  const t=set.filter(x=>!R.isJ(x)); if(!t.length) return '';
  const nums=t.map(R.num), cols=t.map(R.col);
  if(nums.every(n=>n===nums[0])){
    if(set.length>4) return '同數字最多 4 張（四種顏色各一）';
    const dup=cols.find((c,i)=>cols.indexOf(c)!==i); if(dup!=null) return `同數字不能有兩張${RM_CN[dup]}色`;
    return '這組排不起來';
  }
  if(cols.every(c=>c===cols[0])){
    const ns=nums.slice().sort((a,b)=>a-b);
    const d=ns.find((n,i)=>i&&n===ns[i-1]); if(d!=null) return `同顏色連號不能有兩張 ${d}`;
    const gaps=ns[ns.length-1]-ns[0]+1-ns.length, jk=set.length-t.length;
    if(gaps>jk){ const miss=[]; for(let n=ns[0];n<=ns[ns.length-1];n++) if(!ns.includes(n)) miss.push(n); return `同顏色要連號，中間少了 ${miss.slice(0,3).join('、')}`; }
    if(set.length>13) return '連號最多 13 張';
    return '連號超出 1～13 的範圍';
  }
  return '要「同數字、不同顏色」或「同顏色、連號」，不能混';
}
// 為什麼還不能按完成；可以就回傳 null
function rmBlock(){
  const V=C.V, me=V.me, st=new Set(C.rm.start), sets=C.rm.table.filter(s=>s.length);
  const bad=sets.map((s,i)=>[s,i]).filter(([s])=>!R.valid(s));
  if(!rmAdded().length) return {msg: sets.length && JSON.stringify(sets)!==JSON.stringify(V.table) ? '只移動了桌上的牌，還要從手上出至少一張' : '還沒從手上出牌（不想出就按「摸牌」）'};
  if(bad.length) return {msg: `紅框的組不成立：${rmWhy(bad[0][0])}` + (bad.length>1?`（共 ${bad.length} 組有問題）`:''), bad:true};
  if(!V.melded[me]){
    const v=sets.filter(s=>s.every(x=>!st.has(x))).reduce((a,s)=>{ const z=R.analyze(s); return a+(z?z.value:0); },0);
    if(v<30) return {msg:`第一次出牌要湊到 30 點，現在 ${v} 點，還差 ${30-v} 點`};
  }
  return null;
}
function rmReset(){ const V=C.V; C.rm={ver:V.ver, gid:V.gid, table:V.table.map(s=>s.slice()), rack:V.hand.slice(), sel:[], start:V.table.flat()}; }
function rmSorted(r){ const m=store.get('jk_rmsort','col');
  return r.slice().sort(m==='col' ? (a,b)=>(R.col(a)-R.col(b))||(R.num(a)-R.num(b))||a-b : (a,b)=>(R.num(a)-R.num(b))||(R.col(a)-R.col(b))||a-b); }
function rmAdded(){ const st=new Set(C.rm.start); return C.rm.table.flat().filter(x=>!st.has(x)); }
function renderRM(){
  const V=C.V, me=V.me, myTurn=V.turn===me && !V.over;
  // 自己這回合的擺法只存在自己手機；牌局一有變動（別人出牌、回合換人）就重新對齊
  if(!C.rm || C.rm.ver!==V.ver || C.rm.gid!==V.gid) rmReset();
  $('rmPlayers').innerHTML = V.players.map((p,i)=>`<div class="bkp ${V.turn===i&&!V.over?'turn':''} ${i===me?'me':''}">
    <span class="bkav">${avatar(p.kind)}</span><span class="bkn">${esc(i===me?'我':p.name)}</span>
    <span class="bkc">${V.counts[i]} 張${V.melded[i]?'':' · 未開門'}</span>${V.status[i]&&V.turn!==i?`<em>${esc(V.status[i])}</em>`:''}${seatTail(V,i)}</div>`).join('');
  $('game').classList.toggle('myturn', myTurn); $('game').classList.toggle('waiting', !myTurn && !V.over);
  const sel=new Set(C.rm.sel), st=new Set(C.rm.start);
  const pk = !myTurn ? livePeek() : null;
  const sets = pk ? pk.p.table : C.rm.table;
  const nTiles = sets.reduce((a,s)=>a+s.length,0);
  $('rmTable').classList.toggle('dense', nTiles>36); $('rmTable').classList.toggle('xdense', nTiles>64);
  $('rmTable').classList.toggle('peeking', !!pk);
  const dragIds = pk && pk.p.drag ? new Set(pk.p.drag.ids) : null;
  $('rmTable').innerHTML = (myTurn ? `<button class="rnew rtop" ${sel.size?'':'data-off="1"'}>＋ 開新組（選好牌點這裡，或拖過來）</button>` : '') + (sets.length ? sets.map((s,i)=>{ if(!s.length) return ''; const info=R.analyze(s);
      return `<div class="rset ${info?'':'bad'}" data-set="${i}" ${!info&&myTurn?`data-why="${esc(rmWhy(s))}"`:''}>${(info?info.order:s).map(id=>rmTile(id,(sel.has(id)?'sel ':'')+(!st.has(id)?'new ':'')+(dragIds&&dragIds.has(id)?'ghost':''))).join('')}${myTurn?`<button class="radd" data-add="${i}" aria-label="加到這組">＋</button>`:''}</div>`; }).join('')
    : '') + (myTurn && sets.some(s=>s.length) ? `<button class="rnew" ${sel.size?'':'data-off="1"'}>＋ 用選的牌開新組</button>` : '') +
    (!sets.some(s=>s.length) && !myTurn ? '<p class="rmempty">桌上還沒有牌</p>' : '') +
    (pk && pk.p.drag ? `<div class="rmpkdrag" style="left:${(pk.p.drag.x*100).toFixed(1)}%;top:${(pk.p.drag.y*100).toFixed(1)}%">${pk.p.drag.ids.map(id=>rmTile(id)).join('')}<span class="pkhand">👆</span></div>` : '');
  if(myTurn && !rmDrag) peekSend({table:C.rm.table, drag:null});
  $('rmRack').innerHTML = rmSorted(C.rm.rack).map(id=>rmTile(id, sel.has(id)?'sel':'')).join('') || '<span class="note">手上沒牌了</span>';
  const added=rmAdded();
  let info = `牌堆剩 ${V.pool} 張`;
  if(myTurn && !V.melded[me]){
    const fresh=sets.filter(s=>s.length && s.every(x=>!st.has(x)));
    const v=fresh.reduce((a,s)=>{ const z=R.analyze(s); return a+(z?z.value:0); },0);
    info = `首次出牌：<b class="${v>=30?'up':'down'}">${v}</b> / 30 點 · ` + info;
  }
  $('rmInfo').innerHTML = info;
  const blk = myTurn ? rmBlock() : null;
  const tag = V.over ? '這局結束' : myTurn ? (added.length ? (blk ? `<span class="rmwhy">⚠ ${esc(blk.msg)}</span>` : `已放 ${added.length} 張，可以按「完成」了！`) : '把牌拖到某一組加進去，或拖到桌上空白處開新組') : pk ? `<b class="pkname">${esc(V.players[V.turn].name)}</b> 正在擺牌…（黃色是新放的）` : `等 ${esc(V.players[V.turn].name)} 出牌…`;
  $('rmTag').innerHTML = tag + (myTurn&&V.timed?' <span class="tleft"></span>':'');
  // 「完成」在自己回合都可以按；還不行時按下去會說原因
  $('rmDone').disabled = !myTurn;
  $('rmDone').classList.toggle('notyet', myTurn && !!blk);
  $('rmDraw').disabled = !myTurn;
  $('rmUndo').disabled = !myTurn || (!added.length && !sel.size && JSON.stringify(sets)===JSON.stringify(V.table));
  $('rmHint').disabled = !myTurn;
  $('rmSort').textContent = store.get('jk_rmsort','col')==='col' ? '排數字' : '排顏色';
}
function rmMoveSel(target, tiles){
  const sel=tiles||C.rm.sel; if(!sel.length) return;
  if(target==='rack'){
    const st=new Set(C.rm.start);
    if(sel.some(x=>st.has(x))){ toast('桌上原本的牌不能拿回手上'); Snd.err(); return; }
    C.rm.table=C.rm.table.map(s=>s.filter(x=>!sel.includes(x))).filter(s=>s.length);
    sel.forEach(x=>{ if(!C.rm.rack.includes(x)) C.rm.rack.push(x); });
    C.rm.sel=[]; Snd.tap(); renderRM(); return;
  }
  const V=C.V, st=new Set(C.rm.start);
  if(!V.melded[V.me] && sel.some(x=>st.has(x))){ toast('第一次出牌只能用自己手上的牌'); Snd.err(); return; }
  if(!V.melded[V.me] && target!=null && C.rm.table[target] && C.rm.table[target].some(x=>st.has(x))){ toast('第一次出牌只能自己開新組，不能接桌上的牌'); Snd.err(); renderRM(); return; }
  C.rm.rack=C.rm.rack.filter(x=>!sel.includes(x));
  C.rm.table=C.rm.table.map(s=>s.filter(x=>!sel.includes(x)));
  if(target==null) C.rm.table.push(sel.slice());
  else if(!C.rm.table[target]) return;
  else { const s=C.rm.table[target].concat(sel); const z=R.analyze(s); C.rm.table[target]= z ? z.order : s; }
  C.rm.table=C.rm.table.filter(s=>s.length);
  C.rm.sel=[]; Snd.play(); renderRM();
}
$('rmRack').addEventListener('click', e=>{
  const t=e.target.closest('.rt'); const V=C&&C.V; if(!t||!V||V.turn!==V.me||V.over) return;
  if(C.rm.justDragged && Date.now()-C.rm.justDragged<350) return;
  const id=+t.dataset.id; C.rm.sel = C.rm.sel.includes(id) ? C.rm.sel.filter(x=>x!==id) : C.rm.sel.concat(id); Snd.tap(); renderRM();
});
$('rmTable').addEventListener('click', e=>{
  const V=C&&C.V; if(!V||V.turn!==V.me||V.over) return;
  if(C.rm.justDragged && Date.now()-C.rm.justDragged<350) return;
  const add=e.target.closest('[data-add]'); if(add){ rmMoveSel(+add.dataset.add); return; }
  if(e.target.closest('.rnew')){ if(!C.rm.sel.length){ toast('先選手上的牌，或直接把牌拖到這裡'); return; } rmMoveSel(null); return; }
  const t=e.target.closest('.rt'); if(!t) return;
  const id=+t.dataset.id, st=new Set(C.rm.start);
  if(st.has(id) && !V.melded[V.me]){ toast('第一次出牌不能動桌上的牌'); Snd.err(); return; }
  // 點自己這回合剛放上去的牌：直接收回手上
  if(!st.has(id) && !C.rm.sel.length){ C.rm.table=C.rm.table.map(s=>s.filter(x=>x!==id)).filter(s=>s.length); C.rm.rack.push(id); Snd.tap(); renderRM(); return; }
  C.rm.sel = C.rm.sel.includes(id) ? C.rm.sel.filter(x=>x!==id) : C.rm.sel.concat(id); Snd.tap(); renderRM();
});
/* 拉密拖拉：按住一張牌拖到某一組（加進去）、拖到桌面空白處（開新組）、拖回手牌（收回） */
let rmDrag=null;
function rmDropTarget(x, y){
  const el=document.elementFromPoint(x, y); if(!el) return null;
  const nw=el.closest('.rnew'); if(nw) return {kind:'new', el:nw};
  const set=el.closest('.rset'); if(set) return {kind:'set', i:+set.dataset.set, el:set};
  if(el.closest('#rmRack')) return {kind:'rack', el:$('rmRack')};
  if(el.closest('#rmTable')) return {kind:'new', el:$('rmTable')};
  return null;
}
function rmClearDrop(){ document.querySelectorAll('.rdrop').forEach(e=>e.classList.remove('rdrop')); }
document.addEventListener('pointerdown', e=>{
  const t=e.target.closest('#rmRack .rt, #rmTable .rt'); const V=C&&C.V;
  if(!t||!V||V.type!=='rm'||V.turn!==V.me||V.over) return;
  rmDrag={id:+t.dataset.id, pid:e.pointerId, x0:e.clientX, y0:e.clientY, started:false, fromTable:!!t.closest('#rmTable')};
});
document.addEventListener('pointermove', e=>{
  if(!rmDrag||e.pointerId!==rmDrag.pid) return;
  if(!rmDrag.started){
    if(Math.hypot(e.clientX-rmDrag.x0, e.clientY-rmDrag.y0) < 10) return;
    const V=C.V, st=new Set(C.rm.start);
    if(rmDrag.fromTable && st.has(rmDrag.id) && !V.melded[V.me]){ rmDrag=null; toast('第一次出牌不能動桌上的牌'); Snd.err(); return; }
    rmDrag.tiles = C.rm.sel.includes(rmDrag.id) ? C.rm.sel.slice() : [rmDrag.id];
    rmDrag.started=true;
    const g=$('rmDragEl'); g.innerHTML=rmDrag.tiles.map(id=>rmTile(id)).join(''); g.hidden=false;
    document.querySelectorAll('#rmRack .rt, #rmTable .rt').forEach(el=>{ if(rmDrag.tiles.includes(+el.dataset.id)) el.classList.add('ghost'); });
    Snd.tap();
  }
  e.preventDefault();
  const g=$('rmDragEl'); g.style.transform=`translate(${e.clientX-20}px, ${e.clientY-70}px) rotate(-4deg)`;
  rmClearDrop(); const tg=rmDropTarget(e.clientX, e.clientY-46);
  if(tg){ tg.el.classList.add('rdrop'); if(tg.kind==='set'){ const z=R.analyze(C.rm.table[tg.i].concat(rmDrag.tiles)); tg.el.classList.toggle('rok', !!z); } }
  rmDrag.target=tg;
  const tr=$('rmTable').getBoundingClientRect();
  peekSend({table:C.rm.table.map(s=>s.filter(x=>!rmDrag.tiles.includes(x))).filter(s=>s.length), drag:{ids:rmDrag.tiles, x:(e.clientX-tr.left)/tr.width, y:(e.clientY-46-tr.top)/tr.height}});
}, {passive:false});
function rmDragEnd(e){
  if(!rmDrag||e.pointerId!==rmDrag.pid) return;
  const d=rmDrag; rmDrag=null; rmClearDrop(); $('rmDragEl').hidden=true;
  document.querySelectorAll('.rt.ghost').forEach(el=>el.classList.remove('ghost'));
  if(!d.started) return;
  C.rm.justDragged=Date.now();
  const tg=d.target;
  if(!tg) { renderRM(); return; }
  if(tg.kind==='rack'){ if(d.fromTable) rmMoveSel('rack', d.tiles); else renderRM(); return; }
  rmMoveSel(tg.kind==='set' ? tg.i : null, d.tiles);
}
document.addEventListener('pointerup', rmDragEnd);
document.addEventListener('pointercancel', rmDragEnd);
$('rmUndo').addEventListener('click', ()=>{ rmReset(); Snd.tap(); renderRM(); });
$('rmSort').addEventListener('click', ()=>{ store.set('jk_rmsort', store.get('jk_rmsort','col')==='col'?'num':'col'); Snd.tap(); renderRM(); });
$('rmDraw').addEventListener('click', ()=>{ rmReset(); sendAct({k:'draw'}); });
$('rmDone').addEventListener('click', ()=>{
  const b=rmBlock();
  if(b){ toast(b.msg, 2600); Snd.err(); try{ navigator.vibrate && navigator.vibrate(60); }catch(e){}
    document.querySelectorAll('#rmTable .rset.bad').forEach(el=>{ el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); el.scrollIntoView({block:'nearest', behavior:'smooth'}); });
    return; }
  sendAct({k:'commit', table:C.rm.table.filter(s=>s.length)}); });
$('rmHint').addEventListener('click', ()=>{
  const V=C.V;
  const S={racks:{}, table:V.table.map(s=>s.slice()), melded:V.melded}; S.racks[V.me]=V.hand.slice();
  const m=R.aiChoose(S, V.me, 'hard');
  if(m.t==='draw'){ rmReset(); renderRM(); toast(V.melded[V.me]?'沒有牌可以出，建議摸牌':'湊不到 30 點，建議摸牌'); return; }
  const onTable=new Set(m.table.flat());
  C.rm.table=m.table.map(s=>s.slice()); C.rm.rack=V.hand.filter(x=>!onTable.has(x)); C.rm.sel=[];
  Snd.tap(); renderRM(); toast('照建議擺好了，按「完成」');
});

/* ================= 吹牛骰子 ================= */
const PIPS={1:[[50,50]],2:[[28,28],[72,72]],3:[[27,27],[50,50],[73,73]],4:[[28,28],[72,28],[28,72],[72,72]],5:[[27,27],[73,27],[50,50],[27,73],[73,73]],6:[[28,24],[72,24],[28,50],[72,50],[28,76],[72,76]]};
function die(v, cls=''){
  if(!v) return `<span class="die q ${cls}"><b>?</b></span>`;
  const red=v===1||v===4;
  return `<span class="die ${cls}" data-v="${v}"><svg viewBox="0 0 100 100" aria-label="${v} 點">${PIPS[v].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="${v===1?16:9.5}" fill="${red?'#E8433F':'#1B1B3A'}"/>`).join('')}</svg></span>`;
}
const isMatch=(v, f, ones)=> v===f || (ones && f!==1 && v===1);
function dcMinFor(V, f){ if(!V.bid) return V.minQ; return DC.RANK(f)>DC.RANK(V.bid.f) ? V.bid.q : V.bid.q+1; }
function dcDefault(V){
  const mine=V.hand, cnt=f=>mine.filter(v=>isMatch(v,f,V.ones)).length;
  if(!V.bid){ let best=6, bc=-1; for(let f=2;f<=6;f++){ if(cnt(f)>bc){ bc=cnt(f); best=f; } } return {q:V.minQ, f:best}; }
  return {q:V.bid.q+1, f:V.bid.f};
}
function dcVS(){ return {bid:C.V.bid, ones:C.V.ones, lives:C.V.lives, n:C.V.n, phase:'bid'}; }
function dcValid(V, q, f){ if(f<1||f>6||q<1||q>V.total) return false; if(!V.bid) return q>=V.minQ; return q>V.bid.q || (q===V.bid.q && DC.RANK(f)>DC.RANK(V.bid.f)); }
function renderDC(){
  const V=C.V, me=V.me, myTurn=V.turn===me && !V.over && V.phase==='bid' && V.lives[me]>0;
  $('game').classList.toggle('myturn', myTurn); $('game').classList.toggle('waiting', !myTurn && !V.over);
  const key=V.round+'|'+(V.bid?V.bid.q+'-'+V.bid.f:'')+'|'+V.turn;
  if(!C.dc || C.dc.key!==key){ const d=dcDefault(V); C.dc={key, q:d.q, f:d.f, round:C.dc?C.dc.round:-1}; }
  const newRound = C.dc.round!==V.round; C.dc.round=V.round;
  $('dcPlayers').innerHTML = V.players.map((p,i)=>`<div class="bkp ${V.turn===i&&!V.over&&V.phase==='bid'?'turn':''} ${V.lives[i]<=0?'out':''} ${i===me?'me':''}" style="--pc:${['#3B82F6','#F5B700','#EF4444','#22B35A'][i]}">
    <span class="bkav">${avatar(p.kind)}</span><span class="bkn">${esc(i===me?'我':p.name)}</span>
    <span class="bkc">${V.lives[i]>0?'❤'.repeat(V.lives[i])+'<i class="lost">'+'❤'.repeat(DC.LIVES-V.lives[i])+'</i>':'出局'}</span>${V.status[i]&&V.phase==='bid'?`<em>${esc(V.status[i])}</em>`:''}${seatTail(V,i)}</div>`).join('');
  // 中間：目前喊價 / 掀骰結果
  let mid='';
  const wild = V.ones ? '<span class="wild on">1 是萬用</span>' : '<span class="wild off">有人喊過 1，這輪 1 不萬用</span>';
  if(V.phase==='reveal' && V.reveal){
    const R=V.reveal, f=R.bid.f;
    mid = `<div class="dcres ${R.ok?'ok':'bad'}"><div class="dcrh">${esc(V.players[R.by].name)} 開 <b>${esc(V.players[R.bid.by].name)}</b> 喊的 ${R.bid.q} 個 ${die(f,'sm')}</div>
      <div class="dcall">${R.dice.map((d,pi)=>d.length?`<div class="dcrow"><span>${esc(pi===me?'我':V.players[pi].name)}</span>${d.map((v,k)=>die(v, (isMatch(v,f,R.ones)?'hit':'dim')+' flip" style="animation-delay:'+(pi*120+k*60)+'ms')).join('')}</div>`:'').join('')}</div>
      <div class="dcsum">共 <b>${R.count}</b> 個${R.ones&&f!==1?'（含 1）':''} → ${R.ok?'喊的人說對了！':'不夠，喊的人吹牛！'} <b>${esc(V.players[R.loser].name)}</b> 扣一條命 💔</div>
      ${V.over?'':'<div class="note">下一輪馬上開始…</div>'}</div>`;
  } else if(V.bid){
    mid = `<div class="dcbid"><span class="who">${esc(V.players[V.bid.by].name)} 喊</span><div class="big"><b>${V.bid.q}</b><span>個</span>${die(V.bid.f,'lg')}</div>${wild}
      <div class="dclog">${V.bids.slice(-6,-1).reverse().map(b=>`<span>${esc(V.players[b.by].name)} ${b.q}個${die(b.f,'xs')}</span>`).join('')}</div></div>`;
  } else mid = `<div class="dcbid"><span class="who">第 ${V.round} 輪 · 全場共 ${V.total} 顆骰子</span><div class="big empty">${esc(V.players[V.turn].name)} 先喊</div>${wild}</div>`;
  $('dcTable').innerHTML = mid;
  // 我的骰子
  const f=C.dc.f, myHits=V.hand.filter(v=>isMatch(v,f,V.ones)).length;
  $('dcMine').innerHTML = V.lives[me]>0 ? `<div class="cup ${newRound?'roll':''}">${V.hand.map((v,k)=>die(v, isMatch(v,f,V.ones)?'mine hit':'mine')).join('')}</div><span class="dchint">你手上有 <b>${myHits}</b> 個 ${die(f,'xs')}${V.ones&&f!==1?'（含 1）':''} · 其他人共 ${V.total-V.hand.length} 顆</span>`
    : '<span class="note">你出局了，看大家吹吧</span>';
  if(newRound && V.phase==='bid' && V.round>1){ try{ Snd.noise(.35,{freq:2200,vol:.18}); Snd.noise(.2,{freq:1500,vol:.14,at:.2}); }catch(e){} }
  // 控制
  const q=C.dc.q, ok=myTurn && dcValid(V,q,f);
  $('dcQ').textContent=q;
  $('dcFaces').innerHTML=[2,3,4,5,6,1].map(v=>`<button class="dcfb ${v===f?'on':''}" data-f="${v}" aria-label="${v} 點">${die(v,'sm')}</button>`).join('');
  $('dcMinus').disabled = !myTurn || q<=dcMinFor(V,f);
  $('dcPlus').disabled = !myTurn || q>=V.total;
  $('dcBidBtn').innerHTML = `喊 <b>${q}</b> 個 ${die(f,'xs')}`; $('dcBidBtn').disabled=!ok;
  $('dcOpen').disabled = !myTurn || !V.bid;
  $('dcHint').disabled = !myTurn;
  $('dcCtl').classList.toggle('off', !myTurn);
  const tag = V.over ? '這局結束' : V.phase==='reveal' ? '掀骰子！' : myTurn ? (V.bid ? '要喊更大，還是「開」他？' : '你先喊：選數量和點數') : `等 ${esc(V.players[V.turn].name)} 喊…`;
  $('dcTag').innerHTML = tag + (myTurn&&V.timed?' <span class="tleft"></span>':'');
}
function dcEv(ev){
  const V=C.V;
  if(ev.k==='bid'){ try{ Snd.tone(660+ev.q*30,.08,{type:'triangle',vol:.07}); }catch(e){} if(ev.by!==V.me) chatBubble(ev.by, V.players[ev.by].name, `${ev.q} 個 ${ev.f}`); }
  else if(ev.k==='open'){ fx('開！'); Snd.bomb(); setTimeout(()=>{ if(ev.loser===V.me){ Snd.lose(); try{ navigator.vibrate&&navigator.vibrate([60,40,60]); }catch(e){} } else Snd.win(); }, 1300); }
}
$('dcFaces').addEventListener('click', e=>{ const b=e.target.closest('[data-f]'); if(!b||!C||!C.V) return; const V=C.V, f=+b.dataset.f;
  C.dc.f=f; if(!dcValid(V, C.dc.q, f) || C.dc.q<dcMinFor(V,f)) C.dc.q=Math.max(dcMinFor(V,f), Math.min(C.dc.q, V.total)); if(!dcValid(V,C.dc.q,f)) C.dc.q=dcMinFor(V,f);
  Snd.tap(); renderDC(); });
$('dcMinus').addEventListener('click', ()=>{ C.dc.q=Math.max(dcMinFor(C.V,C.dc.f), C.dc.q-1); Snd.tap(); renderDC(); });
$('dcPlus').addEventListener('click', ()=>{ C.dc.q=Math.min(C.V.total, C.dc.q+1); Snd.tap(); renderDC(); });
$('dcBidBtn').addEventListener('click', ()=>{ const V=C.V; if(!dcValid(V,C.dc.q,C.dc.f)) return; sendAct({k:'bid', q:C.dc.q, f:C.dc.f}); });
$('dcOpen').addEventListener('click', ()=>{ if(!C.V.bid) return; sendAct({k:'open'}); });
$('dcHint').addEventListener('click', ()=>{
  const V=C.V, S={n:V.n, lives:V.lives, dice:V.players.map((_,i)=>i===V.me?V.hand.slice():new Array(V.counts[i]).fill(0)), bid:V.bid, ones:V.ones, phase:'bid', bids:V.bids||[], turn:V.me};
  const m=DC.aiChoose(S, V.me, 'hard');
  if(m.t==='open'){ toast('建議：開他！機率站在你這邊'); return; }
  C.dc.q=m.q; C.dc.f=m.f; Snd.tap(); renderDC(); toast(`建議喊 ${m.q} 個 ${m.f}`);
});

/* ================= 暗棋 ================= */
const CC_COLN=['紅方','黑方'];
function ccPiece(x, cls=''){
  if(!x) return '';
  if(!x.up) return `<span class="ccp down ${cls}"><i></i></span>`;
  return `<span class="ccp ${x.c?'blk':'red'} ${cls}"><b>${CC.NAME[x.c][x.t]}</b></span>`;
}
function ccLocal(){ const V=C.V; return {board:V.board.map(x=>x&&(x.up?{t:x.t,c:x.c,up:true}:{t:'P',c:0,up:false})), color:V.color}; }
function ccTargets(from){ const V=C.V, col=V.color[V.me]; if(col==null) return []; return CC.movesFor(ccLocal(), col).filter(m=>m.k==='move' && m.from===from); }
function renderCC(){
  const V=C.V, me=V.me, myTurn=V.turn===me && !V.over;
  $('game').classList.toggle('myturn', myTurn); $('game').classList.toggle('waiting', !myTurn && !V.over);
  if(!C.cc || C.cc.ver!==V.ver) C.cc={ver:V.ver, sel: C.cc && C.cc.ver===V.ver ? C.cc.sel : null};
  if(!myTurn) C.cc.sel=null;
  $('ccPlayers').innerHTML = V.players.map((p,i)=>{ const col=V.color[i];
    return `<div class="bkp ${V.turn===i&&!V.over?'turn':''} ${i===me?'me':''}" style="--pc:${col==null?'#9AA1AE':col?'#1B1B3A':'#E8433F'}">
    <span class="bkav">${avatar(p.kind)}</span><span class="bkn">${esc(i===me?'我':p.name)}</span>
    <span class="bkc">${col==null?'還沒翻':CC_COLN[col]+' · 剩 '+V.counts[i]+' 子'}</span>${V.status[i]?`<em>${esc(V.status[i])}</em>`:''}${seatTail(V,i)}</div>`; }).join('');
  const tg = C.cc.sel!=null ? ccTargets(C.cc.sel) : [], tset=new Map(tg.map(m=>[m.to,m]));
  const L=V.last, mark=new Set(L ? (L.k==='flip'?[L.i]:[L.from,L.to]) : []);
  const myCol=V.color[me];
  let h='';
  for(let i=0;i<32;i++){ const x=V.board[i], r=Math.floor(i/4), c=i%4;
    const can = myTurn && x && (!x.up || (myCol!=null && x.c===myCol));
    h+=`<div class="cc ${mark.has(i)?'last':''} ${C.cc.sel===i?'sel':''} ${tset.has(i)?(tset.get(i).cap?'tcap':'tgo'):''} ${can?'can':''}" data-i="${i}" style="--r:${r};--c:${c}">${ccPiece(x, L&&L.to===i&&L.k==='move'?'moved':L&&L.k==='flip'&&L.i===i?'flipped':'')}</div>`; }
  $('ccBoard').innerHTML=h;
  const capRow = pi => (V.captured[pi]||[]).map(x=>ccPiece(Object.assign({up:true},x),'cm')).join('');
  $('ccCaps').innerHTML = `<div><span class="cl">我吃掉</span>${capRow(me)||'<i class="note">還沒有</i>'}</div><div><span class="cl">被吃掉</span>${capRow(1-me)||'<i class="note">還沒有</i>'}</div>`;
  const tag = V.over ? (V.reason||'這局結束') : myTurn ? (myCol==null ? '點一顆蓋著的棋翻開，翻到的顏色就是你的' : C.cc.sel!=null ? (tg.length?'點亮起來的格子走過去，或點別顆':'這顆現在不能走，換一顆') : `你是${CC_COLN[myCol]}：翻一顆，或點自己的棋移動`) : `等 ${esc(V.players[V.turn].name)}…`;
  $('ccTag').innerHTML = tag + (V.idle>=30&&!V.over?` · <span class="prep">${CC.IDLE_MAX-V.idle} 步內沒翻沒吃就比子力</span>`:'') + (myTurn&&V.timed?' <span class="tleft"></span>':'');
  $('ccHint').disabled=!myTurn;
}
$('ccBoard').addEventListener('click', e=>{
  const cell=e.target.closest('.cc'); const V=C&&C.V; if(!cell||!V||V.turn!==V.me||V.over) return;
  const i=+cell.dataset.i, x=V.board[i], myCol=V.color[V.me];
  if(C.cc.sel!=null){ const m=ccTargets(C.cc.sel).find(t=>t.to===i); if(m){ sendAct({k:'cc', m:{k:'move', from:m.from, to:m.to}}); C.cc.sel=null; return; } }
  if(x && !x.up){ C.cc.sel=null; sendAct({k:'cc', m:{k:'flip', i}}); return; }
  if(x && x.up && myCol!=null && x.c===myCol){ C.cc.sel = C.cc.sel===i ? null : i; Snd.tap(); renderCC(); return; }
  if(x && x.up && myCol!=null && x.c!==myCol){ toast(C.cc.sel!=null?'吃不到這顆（比牠小，或炮沒隔一顆）':'先點自己的棋'); return; }
  C.cc.sel=null; renderCC();
});
$('ccHint').addEventListener('click', ()=>{
  const V=C.V, S={n:2, board:V.board.map(x=>x&&(x.up?{t:x.t,c:x.c,up:true}:null)), color:V.color, turn:V.me, idle:V.idle, moves:1};
  // 蓋著的棋：用剩下沒出現的棋隨機補上，讓電腦算期望值
  const seen={}; V.board.forEach(x=>{ if(x&&x.up){ const k=x.c+x.t; seen[k]=(seen[k]||0)+1; } }); V.captured.forEach(cs=>cs.forEach(x=>{ const k=x.c+x.t; seen[k]=(seen[k]||0)+1; }));
  const bag=[]; [0,1].forEach(c=>CC.TYPES.forEach(t=>{ for(let k=(seen[c+t]||0);k<CC.COUNT[t];k++) bag.push({t,c}); }));
  V.board.forEach((x,i)=>{ if(x&&!x.up){ const b=bag.splice(Math.floor(Math.random()*bag.length),1)[0]||{t:'P',c:0}; S.board[i]={t:b.t,c:b.c,up:false}; } });
  const m=CC.aiChoose(S, V.me, 'hard'); if(!m) return;
  if(m.k==='flip'){ toast('建議：翻開亮起來的那顆'); flashCell(m.i); }
  else { C.cc.sel=m.from; renderCC(); toast('建議走亮起來的這步'); flashCell(m.to); }
});
function flashCell(i){ const el=$('ccBoard').children[i]; if(el){ el.classList.remove('hint'); void el.offsetWidth; el.classList.add('hint'); } }
function ccEv(ev){
  if(ev.k==='flip'){ try{ Snd.tone(520,.06,{type:'square',vol:.05}); Snd.tone(880,.08,{type:'triangle',vol:.06,at:.06}); }catch(e){} }
  else if(ev.k==='cap'){ Snd.play(); const x=ev.info.cap; if(x && (x.t==='K')) fx(`${CC.NAME[x.c][x.t]}被吃了！`); else if(x && VAL_CC(x)>=18) fx(`吃${CC.NAME[x.c][x.t]}！`, true); }
  else Snd.tap();
}
const VAL_CC = x => CC.VAL[x.t];

/* ================= 撿紅點 ================= */
function renderPR(){
  const V=C.V, me=V.me, myTurn=V.turn===me && !V.over;
  $('game').classList.toggle('myturn', myTurn); $('game').classList.toggle('waiting', !myTurn && !V.over);
  if(!C.pr || C.pr.ver!==V.ver) C.pr={ver:V.ver, sel:null};
  if(C.pr.sel!=null && !V.hand.includes(C.pr.sel)) C.pr.sel=null;
  $('prPlayers').innerHTML = V.players.map((p,i)=>`<div class="bkp ${V.turn===i&&!V.over?'turn':''} ${i===me?'me':''}" style="--pc:${['#3B82F6','#F5B700','#EF4444','#22B35A'][i]}">
    <span class="bkav">${avatar(p.kind)}</span><span class="bkn">${esc(i===me?'我':p.name)}</span>
    <span class="bkc"><b class="prpt">${V.pts[i]}</b> 分 · 手 ${V.counts[i]}</span>${V.status[i]?`<em>${esc(V.status[i])}</em>`:''}${seatTail(V,i)}</div>`).join('');
  const sel=C.pr.sel, ms = sel!=null ? V.table.filter(t=>PR.pairs(sel,t)) : [];
  const L=V.last;
  let lastTxt='';
  if(L){ const nm=L.by===me?'我':V.players[L.by].name;
    lastTxt = `<div class="prlast"><b>${esc(nm)}</b> 出 ${cardHTML(L.card,'mc xs')}${L.took!=null?` 撿 ${cardHTML(L.took,'mc xs')}`:' 放桌上'}${L.flip!=null?` · 翻到 ${cardHTML(L.flip,'mc xs')}${L.ftook!=null?` 撿 ${cardHTML(L.ftook,'mc xs')}`:''}`:''}${L.gain?` <em>+${L.gain}</em>`:''}</div>`; }
  $('prTable').innerHTML = `<div class="prpile"><div class="card back"></div><span>牌堆 ${V.pile}</span></div><div class="prcards">${V.table.map(id=>cardHTML(id, 'mc tb '+(ms.includes(id)?'match':'')+(PR.pts(id)?' pt':''))).join('') || '<span class="note">桌上沒牌</span>'}</div>${lastTxt}`;
  const hand=V.hand.slice().sort((a,b)=>PR.nat(a)-PR.nat(b)||a-b);
  const canPair = id => V.table.some(t=>PR.pairs(id,t));
  $('prHand').innerHTML = hand.map(id=>cardHTML(id, 'mc hd '+(id===sel?'sel ':'')+(myTurn&&canPair(id)?'can':''))).join('') || '<span class="note">手牌出完了</span>';
  $('prPlay').disabled = !myTurn || sel==null;
  $('prPlay').textContent = sel==null ? '先選一張牌' : ms.length ? (ms.length>1?'撿（或點桌上要撿的）':'撿這張') : '丟到桌上';
  $('prHint').disabled = !myTurn;
  const tag = V.over ? '這局結束' : myTurn ? (sel==null ? '選一張手牌：加起來 10，或 10JQK 同點數就能撿' : ms.length ? (ms.length>1?'點桌上亮起來的牌選要撿哪張':'按「撿這張」，或點桌上亮起來的牌') : '沒得撿，只能丟到桌上') : `等 ${esc(V.players[V.turn].name)} 出牌…`;
  $('prTag').innerHTML = tag + (myTurn&&V.timed?' <span class="tleft"></span>':'');
}
$('prHand').addEventListener('click', e=>{ const c=e.target.closest('.card'); const V=C&&C.V; if(!c||!V||V.turn!==V.me||V.over) return;
  const id=+c.dataset.id;
  if(C.pr.sel===id){ prSend(id, null); return; }
  C.pr.sel=id; Snd.tap(); renderPR(); });
$('prTable').addEventListener('click', e=>{ const c=e.target.closest('.card.tb'); const V=C&&C.V; if(!c||!V||V.turn!==V.me||V.over||C.pr.sel==null) return;
  const t=+c.dataset.id; if(!PR.pairs(C.pr.sel, t)){ toast('這兩張湊不起來'); return; } prSend(C.pr.sel, t); });
$('prPlay').addEventListener('click', ()=>{ if(C.pr.sel!=null) prSend(C.pr.sel, null); });
$('prHint').addEventListener('click', ()=>{ const V=C.V;
  const S={n:V.n, hands:V.players.map((_,i)=>i===V.me?V.hand.slice():[]), table:V.table.slice(), pile:[], taken:V.takenAll, turn:V.me};
  const m=PR.aiChoose(S, V.me, 'hard'); if(!m) return; C.pr.sel=m.card; renderPR(); toast(m.target!=null?'建議用這張撿桌上亮起來的牌':'建議丟這張（比較不會被別人撿走紅牌）'); });
function prSend(card, target){ C.pr.sel=null; sendAct({k:'pr', card, target}); }
function prEv(ev){
  const V=C.V;
  if(ev.gain){ Snd.play(); if(ev.by===V.me) fx(`+${ev.gain} 分`, true); else chatBubble(ev.by, V.players[ev.by].name, `撿 +${ev.gain}`); if(ev.gain>=30) setTimeout(()=>Snd.win(),150); }
  else Snd.tap();
}

/* ================= 大廳 / 房間 ================= */
function syncChips(){
  document.querySelectorAll('#nChips .chip').forEach(b=>b.setAttribute('aria-pressed', +b.dataset.n===prefs.n));
  document.querySelectorAll('#dChips .chip').forEach(b=>b.setAttribute('aria-pressed', b.dataset.d===prefs.diff));
  $('gBig2').setAttribute('aria-pressed', prefs.game==='big2'); $('gSeven').setAttribute('aria-pressed', prefs.game==='seven'); $('gMJ').setAttribute('aria-pressed', prefs.game==='mj'); $('gBK').setAttribute('aria-pressed', prefs.game==='bk'); $('gRM').setAttribute('aria-pressed', prefs.game==='rm'); $('gDC').setAttribute('aria-pressed', prefs.game==='dc'); $('gCC').setAttribute('aria-pressed', prefs.game==='cc'); $('gPR').setAttribute('aria-pressed', prefs.game==='pr');
  document.querySelectorAll('#nChips .chip').forEach(b=>{ b.disabled = prefs.game==='mj'||prefs.game==='cc'; if(prefs.game==='mj') b.setAttribute('aria-pressed', b.dataset.n==='4'); if(prefs.game==='cc') b.setAttribute('aria-pressed', b.dataset.n==='2'); });
  document.querySelectorAll('#mlChips .chip').forEach(b=>b.setAttribute('aria-pressed', b.dataset.l===prefs.mjLen));
  $('mlField').hidden = prefs.game!=='mj';
  statLine();
}
function statLine(){
  const nm = $('nick').value.trim();
  const st = store.get(SKEY[prefs.game], {})[nm];
  $('statLine').textContent = nm && st ? `${GNAME[prefs.game]}戰績：${st.games} 局，第一名 ${st.places[0]} 次` : '';
}
function soundLabel(){ const t='音效：'+(Snd.on?'開':'關'); $('btnSound1').textContent=t; $('btnSound2').textContent=t; }

function showLobby(L){
  const isHost = C.mode==='host';
  if(L){ C.diff = L.diff; C.L = L; }
  $('lobbyTalk').innerHTML = talkBtns().replace('💬','💬 聊天').replace('🎙<span>','🎙 語音<span>'); talkUI();
  $('menu').hidden=true; $('game').hidden=true; $('lobby').hidden=false; $('result').hidden=true;
  document.body.className='';
  $('roomCode').textContent = L ? L.code : '····';
  if(!L){ $('lobbySeats').innerHTML='<p class="note">連線中，請稍候…</p>'; $('lobbyCtl').hidden=true; return; }
  C.code = L.code;
  const hs=L.seats, n=Math.max(L.n, hs.length);
  let html='';
  for(let i=0;i<n;i++){
    const s=hs[i];
    if(s){ if(s.rp!=null && s.name!==nick()) Prog.seeFriend(s.name, s);
      html += `<div class="lseat"><div class="av${frC(s)}">${avatar(s.kind)}</div><span class="nm">${esc(s.name)}${ttB(s)}${s.rp!=null?`<br>${tierPill(s.rp)}`:''}</span>${s.host?'<span class="pill">房主</span>':''}</div>`; }
    else { const b=BOTS[i-hs.length]; html += `<div class="lseat bot"><div class="av">${avatar(b[1])}</div><span class="nm">${b[0]}</span><span class="pill">電腦</span></div>`; }
  }
  $('lobbySeats').innerHTML = html;
  $('lobbyCtl').hidden=false;
  document.querySelectorAll('#lgChips .chip').forEach(b=>{ b.setAttribute('aria-pressed', b.dataset.g===L.type); b.disabled=!isHost; });
  document.querySelectorAll('#lnChips .chip').forEach(b=>{ b.setAttribute('aria-pressed', +b.dataset.n===n); b.disabled=!isHost || +b.dataset.n<hs.length || L.type==='mj' || L.type==='cc'; });
  document.querySelectorAll('#llChips .chip').forEach(b=>{ b.setAttribute('aria-pressed', b.dataset.l===L.mjLen); b.disabled=!isHost; });
  $('llField').hidden = L.type!=='mj';
  document.querySelectorAll('#ldChips .chip').forEach(b=>{ b.setAttribute('aria-pressed', b.dataset.d===L.diff); b.disabled=!isHost; });
  $('btnGo').hidden = !isHost;
  $('lobbyNote').textContent = isHost
    ? `把房號 ${L.code} 或邀請連結傳給朋友。人不夠的座位由電腦補。房主請保持這個畫面開著，切到別的 App 可能會讓整桌斷線。`
    : '等房主開始遊戲…';
  $('btnCopy').hidden = !isHost;
}
// openExternalBrowser=1：從 LINE 點連結會直接用手機瀏覽器開，戰績才不會存在 LINE 裡
function inviteLink(){ return location.origin + location.pathname + '?r=' + (C.code||'') + '&openExternalBrowser=1'; }

$('lgChips').addEventListener('click', e=>{ const b=e.target.closest('.chip'); if(!b||!H||H.started) return; H.type=b.dataset.g; prefs.game=H.type; Snd.tap(); broadcastLobby(); });
$('lnChips').addEventListener('click', e=>{ const b=e.target.closest('.chip'); if(!b||!H||H.started||b.disabled) return; H.n=+b.dataset.n; prefs.n=H.n; Snd.tap(); broadcastLobby(); });
$('llChips').addEventListener('click', e=>{ const b=e.target.closest('.chip'); if(!b||!H||H.started) return; H.mjLen=b.dataset.l; prefs.mjLen=H.mjLen; Snd.tap(); broadcastLobby(); });
$('ldChips').addEventListener('click', e=>{ const b=e.target.closest('.chip'); if(!b||!H||H.started) return; H.diff=b.dataset.d; prefs.diff=H.diff; Snd.tap(); broadcastLobby(); });
$('btnGo').addEventListener('click', ()=>{ if(!H) return;
  if(H.type==='cc' && humans().length>2){ toast('暗棋只能 2 個人玩，房間裡人太多了，換別的遊戲吧'); Snd.err(); return; } store.set('jk_prefs',prefs); Snd.init(); hostStart(); });
$('btnCopy').addEventListener('click', ()=>{
  const link=inviteLink(), t=`【牌搭子】來玩${GNAME[H?H.type:prefs.game]}！房號 ${C.code}\n點連結直接進房：${link}`;
  navigator.clipboard && navigator.clipboard.writeText(t).then(()=>toast('已複製邀請，貼到 LINE 就好'), ()=>{ $('linkText').textContent=link; toast('請長按下面的連結複製'); });
  if(!navigator.clipboard){ $('linkText').textContent=link; }
});

/* 單機 / 開房 / 加入 */
$('btnStart').addEventListener('click', ()=>{ Snd.init(); store.set('jk_prefs',prefs); newC('host'); hostInit(false); hostStart(); });
$('btnHost').addEventListener('click', ()=>{
  if(!P2P) return; Snd.init(); store.set('jk_prefs',prefs);
  newC('host'); hostInit(true); showLobby(null); hostOpen();
});
$('btnJoin').addEventListener('click', ()=>{
  const code=$('joinCode').value.replace(/\D/g,'');
  if(code.length!==4){ toast('房號是 4 位數字'); Snd.err(); return; }
  if(!P2P) return; Snd.init(); nick();
  newC('guest'); C.code=code; showLobby(null); $('roomCode').textContent=code; guestConnect(0);
});
$('joinCode').addEventListener('keydown', e=>{ if(e.key==='Enter') $('btnJoin').click(); });

function guestConnect(attempt){
  const my=C; if(!my || my.mode!=='guest') return;
  my.net = Net.join(my.code, {
    open(w){
      if(C!==my){ w.close(); return; }
      my.conn=w; my.lost=false; my.ever=true; if(my.lostAt){ my.lostAt=0; my.tries=0; my.hostAway=false; hostWait(false); toast('連回房間了！'); }
      w.onData(m=>{ if(C!==my||!m) return;
        if(m.t==='lobby') showLobby(m.L);
        else if(m.t==='state') applyView(m.V);
        else if(m.t==='emo') showEmo(m.by, m.e, true, m.fx);
        else if(m.t==='peek') onPeek(m);
        else if(m.t==='chat') onChat(m);
        else if(m.t==='throw') playThrow(m.by, m.to, m.it);
        else if(m.t==='vroster') vcRoster(m.list);
        else if(m.t==='err'){ toast(m.msg); Snd.err(); if(m.fatal){ my.leaving=true; exitToMenu(); } }
        else if(m.t==='closed'){ my.leaving=true; toast('房主關掉房間了'); exitToMenu(); }
        else if(m.t==='hostaway'){ my.hostAway=true; }
      });
      w.onClose(()=>{ if(C===my && !my.leaving) guestLost(); });
      w.send({t:'join', name:nick(), cid:myCid, card:Prog.card()});
      if(attempt) toast('重新連上了');
    },
    error(t){
      if(C!==my || my.leaving) return;
      if(!my.ever && (t==='peer-unavailable' || t==='timeout')){ toast(t==='timeout'?'連不上房主，請確認房號或稍後再試':'找不到這個房號'); my.leaving=true; exitToMenu(); return; }
      guestLost();
    }
  });
}
function guestLost(){
  const my=C; if(!my||my.lost) return; my.lost=true; my.conn=null;
  try{ my.net && my.net.close(); }catch(e){}
  my.tries=(my.tries||0)+1;
  if(!my.lostAt) my.lostAt=Date.now();
  // 牌局中最多等 3 分鐘讓房主回來；大廳裡等 30 秒
  const limit = (my.V && !my.V.over) ? 180000 : 30000;
  if(Date.now()-my.lostAt > limit){ hostWait(false); toast('等不到房主，回大廳了'); my.leaving=true; exitToMenu(); return; }
  hostWait(true);
  setTimeout(()=>{ if(C===my && !my.leaving){ my.lost=false; guestConnect(my.tries); } }, Math.min(5000, 1500+my.tries*400));
}
let hostWaitTimer=null;
function hostWait(on){
  const el=$('hostWait'); if(!el) return;
  clearInterval(hostWaitTimer);
  if(!on){ el.hidden=true; return; }
  el.hidden=false;
  const upd=()=>{ if(!C||!C.lostAt){ el.hidden=true; clearInterval(hostWaitTimer); return; } const s=Math.floor((Date.now()-C.lostAt)/1000);
    $('hwText').textContent = `${C.hostAway?'房主的 App 被關掉或重新整理了':'跟房主斷線了'}，等他回來…（已等 ${s} 秒）`; };
  upd(); hostWaitTimer=setInterval(upd, 1000);
}

function exitToMenu(){
  vcTeardown(); chatReset(); hostWait(false); if(H) hostClear();
  try{ if(new URLSearchParams(location.search).has('r')){ const u=new URL(location.href); u.searchParams.delete('r'); history.replaceState(null,'',u.pathname+(u.search||'')+u.hash); } }catch(e){}
  if(C && C.mode==='guest'){ C.leaving=true; try{ C.conn && C.conn.send({t:'leave'}); }catch(e){} const n=C.net; setTimeout(()=>{ try{ n&&n.close(); }catch(e){} }, 200); }
  if(H){ clearTimeout(H.timer); if(H.net){ H.conns.forEach(w=>w.send({t:'closed'})); const n=H.net; setTimeout(()=>n.close(), 300); } H=null; }
  C=null;
  $('result').hidden=true; $('game').hidden=true; $('lobby').hidden=true; $('menu').hidden=false;
  document.body.className=''; statLine(); renderProfile();
}
$('btnBack').addEventListener('click', ()=>{ if(C && (C.mode==='guest' || (H&&H.online))){ $('leaveAsk').hidden=false; } else exitToMenu(); });
$('btnLeaveYes').addEventListener('click', ()=>{ $('leaveAsk').hidden=true; exitToMenu(); });
$('btnLeaveNo').addEventListener('click', ()=>{ $('leaveAsk').hidden=true; });
$('btnLeave').addEventListener('click', ()=>exitToMenu());
$('hwLeave').addEventListener('click', ()=>{ if(C) C.leaving=true; hostWait(false); exitToMenu(); });
$('btnHome').addEventListener('click', ()=>exitToMenu());
$('btnAgain').addEventListener('click', ()=>{ if(!H) return; $('result').hidden=true; Snd.init(); hostStart(); });
$('btnRoom').addEventListener('click', ()=>{ if(!H) return; $('result').hidden=true; hostBackToRoom(); });

/* 大廳設定 */
$('nick').value = store.get('jk_nick','');
$('nick').addEventListener('input', ()=>{ statLine(); renderProfile(); });
$('nChips').addEventListener('click', e=>{ const b=e.target.closest('.chip'); if(!b) return; prefs.n=+b.dataset.n; syncChips(); Snd.init(); Snd.tap(); });
$('dChips').addEventListener('click', e=>{ const b=e.target.closest('.chip'); if(!b) return; prefs.diff=b.dataset.d; syncChips(); Snd.init(); Snd.tap(); });
$('gBig2').addEventListener('click',()=>{ prefs.game='big2'; syncChips(); Snd.init(); Snd.tap(); });
$('gSeven').addEventListener('click',()=>{ prefs.game='seven'; syncChips(); Snd.init(); Snd.tap(); });
$('gMJ').addEventListener('click',()=>{ prefs.game='mj'; syncChips(); Snd.init(); Snd.tap(); });
$('gBK').addEventListener('click',()=>{ prefs.game='bk'; syncChips(); Snd.init(); Snd.tap(); });
$('gRM').addEventListener('click',()=>{ prefs.game='rm'; syncChips(); Snd.init(); Snd.tap(); });
$('gDC').addEventListener('click',()=>{ prefs.game='dc'; syncChips(); Snd.init(); Snd.tap(); });
$('gCC').addEventListener('click',()=>{ prefs.game='cc'; syncChips(); Snd.init(); Snd.tap(); });
$('gPR').addEventListener('click',()=>{ prefs.game='pr'; syncChips(); Snd.init(); Snd.tap(); });
$('mlChips').addEventListener('click', e=>{ const b=e.target.closest('.chip'); if(!b) return; prefs.mjLen=b.dataset.l; syncChips(); Snd.init(); Snd.tap(); });
['btnSound1','btnSound2'].forEach(id=>$(id).addEventListener('click',()=>{ Snd.on=!Snd.on; store.set('jk_sound',Snd.on); Snd.init(); soundLabel(); Snd.tap(); }));
$('btnRules').addEventListener('click',()=>{ const g=C&&C.V?C.V.type:prefs.game; $('rulesTitle').textContent=GNAME[g]+'規則'; $('rules2').hidden=g!=='big2'; $('rules7').hidden=g!=='seven'; $('rulesMJ').hidden=g!=='mj'; $('rulesBK').hidden=g!=='bk'; $('rulesRM').hidden=g!=='rm'; $('rulesDC').hidden=g!=='dc'; $('rulesCC').hidden=g!=='cc'; $('rulesPR').hidden=g!=='pr'; $('rules').hidden=false; });
$('btnRulesOk').addEventListener('click',()=>$('rules').hidden=true);
syncChips(); soundLabel(); applyTheme(); renderProfile(); tickerNext(); resumePrompt();

if(!P2P){
  $('btnHost').disabled=true; $('btnJoin').disabled=true; $('joinCode').disabled=true;
  $('netNote').textContent='這裡不能連線。請從 GitHub Pages 上的網址打開，就能開房跟朋友玩。';
}
// 從邀請連結進來：有暱稱就直接進房；沒有暱稱先跳出輸入框，填完馬上進房
const inv = (QS.get('r')||'').replace(/\D/g,'').slice(0,4);
if(inv){
  $('joinCode').value=inv; $('netPanel').classList.add('invited');
  $('netNote').textContent = P2P ? `朋友邀你進房 ${inv}` : $('netNote').textContent;
  if(P2P){
    const saved = (store.get('jk_nick','')||'').trim();
    if(saved){ setTimeout(()=>{ if(!C) $('btnJoin').click(); }, 250); }
    else { $('invCode').textContent=inv; $('ovInvite').hidden=false; setTimeout(()=>{ try{ $('invNick').focus(); }catch(e){} }, 200); }
  }
}
$('btnInvGo').addEventListener('click', ()=>{
  const v=$('invNick').value.trim().slice(0,8);
  if(!v){ toast('先取個暱稱'); Snd.err(); return; }
  $('nick').value=v; store.set('jk_nick', v); $('ovInvite').hidden=true; renderProfile(); $('btnJoin').click();
});
$('invNick').addEventListener('keydown', e=>{ if(e.key==='Enter') $('btnInvGo').click(); });

let wake=null;
async function keepAwake(){ try{ if(navigator.wakeLock && !wake){ wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release',()=>wake=null); } }catch(e){} }
document.addEventListener('visibilitychange',()=>{ if(!document.hidden && C) keepAwake(); });
window.addEventListener('beforeunload', ()=>{ if(H&&H.net){ const mid = H.started && H.S && !hostDone(); H.conns.forEach(w=>w.send(mid?{t:'hostaway'}:{t:'closed'})); } if(H) hostSaveNow(); });
window.addEventListener('pagehide', ()=>{ if(H) hostSaveNow(); });

/* 測試用 */
window.__jk = { get C(){return C;}, get H(){return H;} };
/* ================= 加到主畫面（PWA） ================= */
const STANDALONE = (()=>{ try{ return matchMedia('(display-mode: standalone)').matches || navigator.standalone===true; }catch(e){ return false; } })();
if(STANDALONE) document.documentElement.classList.add('standalone');
if('serviceWorker' in navigator && !framed && (location.protocol==='https:' || location.hostname==='localhost') && !MOCK){
  window.addEventListener('load', ()=>{ navigator.serviceWorker.register('sw.js').catch(()=>{}); });
}
let installEvt=null;
window.addEventListener('beforeinstallprompt', e=>{ e.preventDefault(); installEvt=e; installTip(); });
function installTip(){
  const el=$('installTip'); if(!el) return;
  const ios=/iPhone|iPad|iPod/.test(navigator.userAgent), line=/\bLine\//i.test(navigator.userAgent);
  if(STANDALONE || framed || line || store.get('jk_inst_x', 0) > Date.now()){ el.hidden=true; return; }
  if(installEvt){ el.innerHTML = `<span>📲 安裝成 App：全螢幕、沒網路也能跟電腦打</span><button class="candy sun" id="btnInstall">安裝</button><button class="ix" aria-label="關閉">✕</button>`; el.hidden=false; }
  else if(ios){ el.innerHTML = `<span>📲 點下面的 <b>分享 ⬆️</b> → <b>加入主畫面</b>，變成全螢幕 App，畫面更大、資料更不容易被清掉</span><button class="ix" aria-label="關閉">✕</button>`; el.hidden=false; }
  else el.hidden=true;
}
document.addEventListener('click', e=>{
  if(e.target.closest('#btnInstall') && installEvt){ installEvt.prompt(); installEvt.userChoice.finally(()=>{ installEvt=null; installTip(); }); return; }
  if(e.target.closest('#installTip .ix')){ store.set('jk_inst_x', Date.now()+7*86400000); $('installTip').hidden=true; }
  if(e.target.closest('#moveTip .ix')){ store.set('jk_move_seen', 1); $('moveTip').hidden=true; }
  if(e.target.closest('#moveTip .mv')){ store.set('jk_move_seen', 1); $('moveTip').hidden=true; openBackup(); }
});
installTip();
// iPhone 的主畫面 App 跟 Safari 資料是分開的：第一次從主畫面打開，提醒用備份碼搬過來
(()=>{ const el=$('moveTip'); if(!el) return;
  if(STANDALONE && /iPhone|iPad|iPod/.test(navigator.userAgent) && !store.get('jk_move_seen', 0) && Prog.state.games===0){
    el.innerHTML = `<span>👋 iPhone 的主畫面 App 跟 Safari 的資料是分開的。之前在 Safari 玩過的話：在 Safari 打開「戰績 → 備份／還原」複製備份碼，再到這裡貼上還原。</span><button class="candy sun mv">貼上備份碼</button><button class="ix" aria-label="關閉">✕</button>`;
    el.hidden=false;
  } })();
})();
