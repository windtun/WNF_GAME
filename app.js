/* 揪咖打牌：畫面 + 房主（遊戲邏輯在房主手機上跑）+ 連線 */
(function(){
const B = window.BigTwo, X = window.Seven;
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
function toast(msg, ms=1700){ const t=$('toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(tt); tt=setTimeout(()=>t.classList.remove('show'),ms); }
function fx(text, soft){
  const f=$('fx'); f.innerHTML=`<div class="boom ${soft?'':'pink'}">${esc(text)}</div>`;
  f.classList.remove('on'); void f.offsetWidth;
  if(!soft){ f.classList.add('on'); const t=$('table'); t.classList.remove('shake'); void t.offsetWidth; t.classList.add('shake'); }
  clearTimeout(fx._t); fx._t=setTimeout(()=>{ f.innerHTML=''; f.classList.remove('on'); },1150);
}

/* ---------- 設定 ---------- */
const GNAME={big2:'大老二', seven:'排七', mj:'麻將'}, SKEY={big2:'jk_stats', seven:'jk_stats7', mj:'jk_statsmj'};
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
function wrap(send, close){ const w={send, close, _d:null, _c:null, onData(f){w._d=f;}, onClose(f){w._c=f;}}; return w; }
const PeerNet = {
  host(code, h){
    const peer = new window.Peer(PFX+code, {debug:0});
    peer.on('open', ()=>h.ready());
    peer.on('error', e=>h.error(e.type||'error'));
    peer.on('disconnected', ()=>{ try{ peer.reconnect(); }catch(e){} });
    peer.on('connection', c=>{
      c.on('open', ()=>{ let closed=false; const w=wrap(o=>{ try{c.send(o);}catch(e){} }, ()=>{ try{c.close();}catch(e){} });
        c.on('data', d=>w._d&&w._d(d)); const cl=()=>{ if(closed) return; closed=true; w._c&&w._c(); };
        c.on('close', cl); c.on('error', cl); h.conn(w); });
    });
    return { close(){ try{ peer.destroy(); }catch(e){} } };
  },
  join(code, h){
    const peer = new window.Peer({debug:0}); let opened=false;
    peer.on('open', ()=>{
      const c = peer.connect(PFX+code, {reliable:true});
      c.on('open', ()=>{ opened=true; let closed=false; const w=wrap(o=>{ try{c.send(o);}catch(e){} }, ()=>{ try{c.close();}catch(e){} });
        c.on('data', d=>w._d&&w._d(d)); const cl=()=>{ if(closed) return; closed=true; w._c&&w._c(); };
        c.on('close', cl); c.on('error', cl); h.open(w); });
    });
    peer.on('error', e=>h.error(e.type||'error', opened));
    setTimeout(()=>{ if(!opened) h.error('timeout', false); }, 12000);
    return { close(){ try{ peer.destroy(); }catch(e){} } };
  }
};
const MockNet = {
  host(code, h){
    const bc=new BroadcastChannel('jk-mock-'+code), conns={};
    bc.onmessage=e=>{ const m=e.data; if(m.to!=='host') return;
      if(m.k==='hello'){ const w=wrap(o=>bc.postMessage({to:m.from,k:'d',d:o}), ()=>bc.postMessage({to:m.from,k:'bye'})); conns[m.from]=w; bc.postMessage({to:m.from,k:'ok'}); h.conn(w); }
      else if(m.k==='d') conns[m.from]&&conns[m.from]._d&&conns[m.from]._d(m.d);
      else if(m.k==='bye'){ const w=conns[m.from]; delete conns[m.from]; w&&w._c&&w._c(); } };
    setTimeout(()=>h.ready(), 50);
    return { close(){ Object.keys(conns).forEach(k=>bc.postMessage({to:k,k:'bye'})); bc.close(); } };
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
function hostInit(online){
  H = { online, code:null, net:null, conns:new Map(), started:false, timer:null, deadline:0, gid:0, ev:{seq:0},
        type:prefs.game, n:prefs.n, diff:prefs.diff, mjLen:prefs.mjLen, S:null,
        seats:[{name:nick(), cid:myCid, human:true, online:true, card:Prog.card()}] };
}
const humans = () => H.seats.filter(s=>s.human);

function hostOpen(){
  H.code = String(1000 + Math.floor(Math.random()*9000));
  H.net = Net.host(H.code, {
    ready(){ if(!H) return; broadcastLobby(); },
    error(t){ if(!H) return;
      if(t==='unavailable-id'){ H.net.close(); hostOpen(); return; }
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
    else if(m.t==='emo'){ const si=H.seats.findIndex(s=>s.cid===cid); if(si>=0) hostEmo(si, m.e); }
    else if(m.t==='leave'){ hostDrop(cid, w, true); }
  });
  w.onClose(()=>{ if(cid) hostDrop(cid, w, false); });
}

function hostJoin(w, m){
  const name = String(m.name||'朋友').slice(0,8);
  const card = m.card && typeof m.card==='object' ? {rp:Math.max(0,Math.min(9999,+m.card.rp||0)), kind:String(m.card.kind||'pup').slice(0,10), wins:+m.card.wins||0} : null;
  const ex = H.seats.findIndex(s=>s.cid===m.cid);
  if(H.started){
    if(ex<0){ w.send({t:'err', msg:'這局已經開始，等下一局再加入', fatal:true}); return; }
    H.seats[ex].online=true; H.conns.set(m.cid, w);
    toast(`${H.seats[ex].name} 回來了`); Snd.join();
    broadcastState(); hostSchedule(); return;
  }
  if(ex<0){
    if(humans().length>=4){ w.send({t:'err', msg:'房間已經滿了', fatal:true}); return; }
    H.seats.push({name, cid:m.cid, human:true, online:true, card});
    toast(`${name} 進房了`); Snd.join();
  } else { H.seats[ex].name=name; H.seats[ex].online=true; if(card) H.seats[ex].card=card; }
  H.conns.set(m.cid, w);
  if(H.n < humans().length) H.n = humans().length;
  broadcastLobby();
}

function hostDrop(cid, w, left){
  if(!H || H.conns.get(cid)!==w) return;
  H.conns.delete(cid);
  const si=H.seats.findIndex(s=>s.cid===cid); if(si<0) return;
  if(!H.started){ H.seats.splice(si,1); broadcastLobby(); return; }
  H.seats[si].online=false;
  toast(`${H.seats[si].name} ${left?'離開了':'斷線了'}，先由電腦代打`);
  broadcastState();
  if(!H.S.over && H.S.turn===si) hostSchedule();
}

function lobbyInfo(){
  return { code:H.code, type:H.type, n:H.type==='mj'?4:H.n, diff:H.diff, mjLen:H.mjLen,
    seats: H.seats.map((s,i)=>({name:s.name, kind:(s.card&&PAL[s.card.kind])?s.card.kind:HUMAN_KINDS[i], rp:s.card?s.card.rp:null, wins:s.card?s.card.wins:0, host:i===0})) };
}
function broadcastLobby(){
  const L = lobbyInfo();
  H.conns.forEach(w=>w.send({t:'lobby', L}));
  if(C && C.mode==='host') showLobby(L);
}

function hostStart(){
  const hs = H.seats.filter(s=>s.human && (s.online || s.cid===myCid));
  const n = H.type==='mj' ? 4 : Math.max(H.n, hs.length);
  H.seats = hs.map((s,i)=>({...s, kind:(s.card&&PAL[s.card.kind])?s.card.kind:HUMAN_KINDS[i]}))
    .concat(BOTS.slice(0, n-hs.length).map(([name,kind])=>({name, kind, human:false, online:true})));
  H.S = H.type==='mj' ? MJ.newMatch(H.mjLen) : H.type==='seven' ? X.newGame(n) : B.newGame(n);
  H.lastKey = null;
  H.started = true; H.gid++; H.ev = {seq:0};
  hostSchedule(true);
  broadcastState();
}

function hostBackToRoom(){
  clearTimeout(H.timer); H.deadline=0;
  H.started=false; H.S=null;
  H.seats = H.seats.filter(s=>s.human && (s.online || s.cid===myCid));
  if(H.n < H.seats.length) H.n = H.seats.length;
  broadcastLobby();
}

function viewFor(si){
  const S=H.S;
  const V = { type:H.type, gid:H.gid, n:S.n, me:si, turn:S.turn, over:S.over, ver:S.ver, ev:H.ev,
    players: H.seats.map(s=>({name:s.name, kind:s.kind, bot:!s.human, online:s.online, rp:s.card?s.card.rp:null})),
    hand: S.hands[si].slice(), counts: S.hands.map(h=>h.length), order: S.order.slice(),
    timed: !!H.deadline, left: H.deadline ? Math.max(0, H.deadline-Date.now()) : 0, online: H.online };
  if(H.type==='mj') Object.assign(V, mjView(si));
  else if(H.type==='big2') Object.assign(V, {table:S.table, first:S.first, done:S.done.slice(), status:S.status.slice()});
  else Object.assign(V, {board:S.board, covN:S.covered.map(c=>c.length), myCov:S.covered[si].slice(), last:S.last, score:S.score||null});
  return JSON.parse(JSON.stringify(V));
}
function broadcastState(){
  H.seats.forEach((s,i)=>{
    if(!s.human) return;
    if(s.cid===myCid){ applyView(viewFor(i)); return; }
    const w=H.conns.get(s.cid); if(w && s.online) w.send({t:'state', V:viewFor(i)});
  });
}

function hostSchedule(first){
  clearTimeout(H.timer); H.deadline=0;
  if(H.type==='mj'){ mjSchedule(first); return; }
  const S=H.S; if(!S || S.over) return;
  const s=H.seats[S.turn], gid=H.gid, ver=S.ver, turn=S.turn;
  const guard = ()=> H && H.gid===gid && H.S.ver===ver && H.S.turn===turn && !H.S.over;
  if(!s.human || !s.online){
    H.timer=setTimeout(()=>{ if(guard()) botMove(false); }, (first?1300:0) + (s.human?1000:650+Math.random()*500));
  } else if(H.online && humans().length>1){
    H.deadline = Date.now() + TURN_MS + (first?1500:0);
    H.timer=setTimeout(()=>{ if(guard()) botMove(true); }, TURN_MS + (first?1500:0));
  }
}

function botMove(timeout){
  const S=H.S, si=S.turn, diff = H.seats[si].human ? 'normal' : H.diff;
  if(H.type==='seven'){
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
  if(H.type==='big2'){
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
function hostEmo(si, e){
  const m={t:'emo', by:si, e:String(e).slice(0,12)};
  H.conns.forEach(w=>w.send(m)); showEmo(si, m.e);
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
  if(fresh){ showGame(); Snd.deal(); C.handNo=V.handNo; C.bombs=0;
    V.players.forEach((p,i)=>{ if(i!==V.me && !p.bot && p.rp!=null) Prog.seeFriend(p.name, p); }); }
  if(V.type==='mj' && C.handNo!==V.handNo){ C.handNo=V.handNo; C.sel=[]; }
  if(V.ev && V.ev.seq!==C.lastSeq){
    if(!fresh && V.ev.seq) playEv(V.ev);
    C.lastSeq=V.ev.seq;
    if(V.ev.by===V.me){ C.sel=[]; C.hint=-1; C.qt=null; }
  }
  if(!fresh && V.turn===V.me && prevTurn!==V.me && !V.over) Snd.turn();
  if(!fresh && V.type==='mj' && V.claim && V.claim.mine && !V.claim.answered && !(C.claimSeen===V.claim.tile+'|'+V.ver)){ C.claimSeen=V.claim.tile+'|'+V.ver; Snd.turn(); }
  if(V.type==='mj'){
    if(V.phase==='over' && V.result && V.result.type==='win' && V.result.winner===V.me){
      const hk=V.gid+'|'+V.handNo+'|'+(C.code||'local');
      if(C.mjHandKey!==hk){ C.mjHandKey=hk; const r=Prog.recordMjHand({self:V.result.self, tai:V.result.total, names:V.result.tai.map(x=>x[0]), online:onlineWithFriends(), diff:C.mode==='host'?H.diff:'normal'}); C.mjHandCoins=r.coins; announceAch(r.unlocked); }
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
  document.body.className='g-'+V.type;
  $('ttl').textContent = GNAME[V.type] + (C.mode==='guest' || (H&&H.online) ? ` · 房號 ${C.code||H.code}` : '');
  $('btnPlay').textContent = V.type==='seven' ? '蓋牌' : '出牌';
  t.querySelectorAll('.seat').forEach(e=>e.remove());
  for(let d=1; d<V.n; d++){ const el=document.createElement('div'); el.className='seat '+POS[V.n][d]; el.id='seat'+d; t.appendChild(el); }
  $('meAv').innerHTML = avatar(V.players[V.me].kind);
  $('meName').textContent = V.players[V.me].name;
  $('emoBar').innerHTML = Prog.emoLines().map(l=>`<button>${esc(l)}</button>`).join('');
  $('emoBar').hidden = !(C.mode==='guest' || (H&&H.online));
  $('menu').hidden=true; $('lobby').hidden=true; $('game').hidden=false;
  keepAwake();
}

function seatTail(V, pi){
  const p=V.players[pi];
  let s='';
  if(!p.online) s+='<span class="off">斷線·代打</span>';
  if(V.turn===pi && !V.over && V.timed) s+='<span class="tleft"></span>';
  return s;
}

function render(first){
  const V=C.V;
  if(V.type==='mj'){ renderMJ(); tick(); return; }
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
    el.innerHTML = `${bub}<div class="av">${avatar(p.kind)}</div><div><div class="pname">${esc(p.name)}</div>
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
const fakeS = () => { const V=C.V, h={}; h[V.me]=V.hand; return {hands:h, board:V.board, table:V.table, first:V.first, over:V.over, turn:V.turn}; };
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
    el.innerHTML = `${bub}<div class="av">${avatar(p.kind)}</div><div style="text-align:center"><div class="pname">${esc(p.name)}</div>
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
  else if(myTurn){ tag.innerHTML = (X.playable(S,V.me).length ? '輪到你，點發亮的牌' : '沒牌可接，選一張蓋') + (V.timed?' <span class="tleft"></span>':''); tag.className='go'; }
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
  const cw=Math.max(44, Math.min(64, Math.floor(W/7.2))), ch=Math.round(cw*1.42);
  hand.style.setProperty('--cw',cw+'px'); hand.style.setProperty('--ch',ch+'px');
  const rows = h.length>13 ? 2 : 1, per=Math.ceil(h.length/rows);
  const seven=V.type==='seven', can = seven && V.turn===V.me && !V.over ? X.playable(fakeS(), V.me) : [];
  let html='';
  for(let r=0;r<rows;r++){
    const part=h.slice(r*per,(r+1)*per), m=part.length;
    let gaps=0; const gi=part.map((c,i)=>(i&&c.g!==part[i-1].g)?++gaps:gaps);
    const gap = sort==='rank' ? 0 : Math.min(10, gaps? (W*0.18)/gaps : 0);
    const stepX = m>1 ? Math.min(cw+4, (W-cw-gaps*gap)/(m-1)) : 0;
    const total = (m-1)*stepX+gaps*gap+cw, off=Math.max(0,(W-total)/2);
    html += `<div class="row" style="height:${ch}px;margin-top:${r?0:14}px">` + part.map((c,i)=>
      cardHTML(c.id, C.sel.includes(c.id)?'sel': can.includes(c.id)?'can': (can.length?'dim':''))
        .replace('class="card','style="left:'+(off+i*stepX+gi[i]*gap).toFixed(1)+'px;animation-delay:'+((r*per+i)*35)+'ms" class="card')).join('') + '</div>';
  }
  if(!h.length) html=`<div style="height:${ch+14}px;display:grid;place-items:center;color:var(--ink-soft)">${seven?'你出完了，等其他人出完':'你出完了，等其他人比完名次'}</div>`;
  hand.innerHTML=html;
  hand.classList.toggle('deal', !!first);
}

function updateButtons(){
  const V=C.V, sort=curSort();
  if(V.type==='seven'){
    const my=V.turn===V.me && !V.over, noPlay = my && !X.playable(fakeS(),V.me).length;
    $('btnPlay').disabled = !noPlay || C.sel.length!==1;
    $('btnHint').disabled = !my;
    $('btnSort').textContent = sort==='suit' ? '排大小' : '排花色';
    const pts=V.myCov.reduce((a,id)=>a+X.pts(id),0);
    $('selInfo').textContent = `已蓋 ${V.myCov.length} 張 · ${pts} 點`;
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
const QTYPES=[['sflush','同花順',1],['four','鐵支',1],['fullhouse','葫蘆'],['flush','同花'],['straight','順子'],['pair','對子']];
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

$('hand').addEventListener('click', e=>{
  const c=e.target.closest('.card'); if(!c||!C||!C.V) return;
  const id=+c.dataset.id, V=C.V;
  if(V.type==='seven'){
    if(V.turn!==V.me||V.over) return;
    const S=fakeS();
    if(X.canPlay(S,id)){ sendAct({k:'play7', id}); return; }
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
  if(V.type==='seven'){ if(C.sel.length===1) sendAct({k:'cover', id:C.sel[0]}); return; }
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
    if(c.play!=null){ C.sel=[c.play]; toast('建議出這張，點它就出'); } else { C.sel=[c.cover]; toast('建議蓋這張，按「蓋牌」'); }
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
  const b=e.target.closest('button'); if(!b||!C||!C.V) return;
  const t=b.textContent; Snd.tap();
  if(C.mode==='guest'){ C.conn && C.conn.send({t:'emo', e:t}); }
  else if(H) hostEmo(C.me, t);
});
function showEmo(pi, text){
  if(!C||!C.V) return;
  const el = pi===C.V.me ? $('me').querySelector('.meinfo') : $('seat'+D(pi));
  if(!el) return;
  const b=document.createElement('div'); b.className='bubble emo'; b.textContent=text;
  el.appendChild(b); setTimeout(()=>b.remove(), 2200);
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
        return `<div class="rk p${k+1} ${pi===C.V.me?'me':''}"><span class="no">${k+1}</span><div class="av">${avatar(p.kind)}</div><span class="nm">${esc(p.name)}</span>${C.V.type==='mj'?`<span class="stat">${C.V.scores[pi]>0?'+':''}${C.V.scores[pi]} 分</span>`:''}${C.V.type==='seven'&&C.V.score?`<span class="stat">蓋 ${C.V.covN[pi]} 張 · ${C.V.score[pi]} 點</span>`:''}</div>`; }).join('');
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
    const s=H.seats[S.turn];
    if(!s.human || !s.online){
      H.timer=setTimeout(()=>{ if(!guard()) return; MJ.act(S, S.turn, MJ.aiSelf(S, S.turn, diffOf(S.turn))); mjAfter(); }, (first?1600:0) + (s.human?900:650+Math.random()*450));
    } else if(mjTimed()){
      H.deadline=Date.now()+MJ_TURN_MS+(first?1500:0);
      H.timer=setTimeout(()=>{ if(!guard()) return; MJ.act(S, S.turn, MJ.aiSelf(S, S.turn, 'normal')); mjAfter(); }, MJ_TURN_MS+(first?1500:0));
    }
  } else if(S.phase==='claim'){
    const pend=MJ.pending(S), auto=pend.filter(q=>!H.seats[q].human || !H.seats[q].online);
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
      <div class="mjoh"><div class="av">${avatar(p.kind)}</div><div class="mjon"><div class="pname">${esc(p.name)}</div>
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
  $('mjMeInfo').innerHTML = `<div class="av">${avatar(V.players[me].kind)}</div><span class="nm">${esc(V.players[me].name)}</span><span class="wind ${me===V.dealer?'dealer':''}">${MJ.WIND[windOf(V,me)]}${me===V.dealer?'莊':''}</span><span class="sc">${V.scores[me]>0?'+':''}${V.scores[me]} 分</span>${tag}`;
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
function applyTheme(){ try{ document.documentElement.dataset.table = Prog.theme(); }catch(e){} }

function renderProfile(){
  const P=Prog.state, t=Prog.tierOf(P.rp), rank=Prog.myRank();
  $('pfAv').innerHTML = avatar(Prog.avatarKind()); $('pfAv').style.setProperty('--tc', t.color);
  $('pfName').textContent = ($('nick').value.trim()||'我').slice(0,8);
  $('pfTier').innerHTML = `${tierPill(P.rp)}<span class="rp">${fmt(P.rp)} 分</span>`;
  $('pfBar').style.width = (t.pct*100).toFixed(1)+'%';
  $('pfNext').textContent = t.next ? `再 ${t.next-P.rp} 分升${t.nextName}` : '最高段位';
  $('pfCoins').innerHTML = coinIcon+fmt(P.coins);
  $('pfRank').innerHTML = `全服 <b>#${rank}</b>`;
  $('pfStreak').innerHTML = P.streak>1 ? `連勝 <b>${P.streak}</b>` : '';
  $('pfStreak').hidden = P.streak<2;
  $('dotDaily').hidden = !Prog.hasClaimable();
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
  $('taskList').innerHTML = Prog.tasks().map(t=>`<div class="task ${t.claimed?'claimed':''}"><div class="tt"><span>${esc(t.text)}</span>
    <div class="tbar"><i style="width:${(t.n/t.goal*100).toFixed(0)}%"></i></div><small>${t.n}/${t.goal}</small></div>
    <button class="candy ${t.done&&!t.claimed?'':'plain'}" data-task="${t.id}" ${t.done&&!t.claimed?'':'disabled'}>${t.claimed?'已領':coinIcon+t.reward}</button></div>`).join('');
}
$('btnDaily').addEventListener('click', ()=>{ Snd.init(); Snd.tap(); renderDaily(); $('ovDaily').hidden=false; });
$('btnCheckin').addEventListener('click', ()=>{ const r=Prog.doCheckin(); if(!r) return; Snd.win(); coinPop(r.coins); renderDaily(); renderProfile(); });
$('taskList').addEventListener('click', e=>{ const b=e.target.closest('[data-task]'); if(!b) return; const r=Prog.claimTask(b.dataset.task); if(!r) return; Snd.win(); coinPop(r.coins); renderDaily(); renderProfile(); });

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
    else pv=`<div class="spv emo">${it.lines.slice(0,4).map(l=>`<span>${esc(l)}</span>`).join('')}</div>`;
    const btn = on ? '<button class="candy plain" disabled>使用中</button>' : own ? `<button class="candy sun" data-eq="${it.id}">使用</button>`
      : `<button class="candy" data-buy="${it.id}" ${P.coins<it.price?'disabled':''}>${coinIcon}${fmt(it.price)}</button>`;
    return `<div class="sitem ${on?'on':''}">${pv}<b>${esc(it.name)}</b>${btn}</div>`;
  }).join('');
}
$('btnShop').addEventListener('click', ()=>{ Snd.init(); Snd.tap(); renderShop(); $('ovShop').hidden=false; });
$('shopTabs').addEventListener('click', e=>{ const b=e.target.closest('.chip'); if(!b) return; shopTab=b.dataset.t; Snd.tap(); renderShop(); });
$('shopGrid').addEventListener('click', e=>{
  const b=e.target.closest('button'); if(!b) return;
  if(b.dataset.buy){ const r=Prog.buy(b.dataset.buy); if(r.err){ toast(r.err); Snd.err(); return; } Snd.win(); toast('買到了，已經換上'); }
  else if(b.dataset.eq){ Prog.equip(b.dataset.eq); Snd.tap(); toast('換好了'); }
  applyTheme(); renderShop(); renderProfile();
});
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click', ()=>{ b.closest('.overlay').hidden=true; renderProfile(); }));

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
  C.reward = Prog.recordGame({game:V.type, place, n:V.n, online:onlineWithFriends(), diff: C.mode==='host' ? H.diff : 'normal', bomb:(C.bombs||0)>0, bombs:C.bombs||0, sevenPts:pts, rivals});
  C.bombs=0;
  announceAch(C.reward.unlocked);
  return C.reward;
}
function rewardHTML(R){
  if(!R) return '';
  const rk = R.before.rank - R.after.rank;
  return `<div class="rw">
    <div class="rwc">${coinIcon}<b class="count" data-to="${R.coins}">+0</b><span>金幣</span></div>
    <div class="rwl">${R.lines.map(([t,v])=>`<span>${esc(t)}${v!=null?' '+v:''}</span>`).join('')}${(R.unlocked||[]).map(a=>`<span class="achline">成就「${esc(a.name)}」+${a.reward}</span>`).join('')}</div>
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
const GLABEL={big2:'大老二', seven:'排七', mj:'麻將'};
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
  const G=st.byGame, tg=G.big2.g+G.seven.g+G.mj.g, tw=G.big2.w+G.seven.w+G.mj.w, wr = tg ? Math.round(tw/tg*100) : 0;
  const pct=(a,b)=>b?Math.round(a/b*100)+'%':'—';
  const A=Prog.achState().sort((x,y)=>(!!y.got-!!x.got) || (y.n/y.goal - x.n/x.goal)), got=A.filter(a=>a.got).length;
  let h = `<div class="sthero">
    <div class="pfav" style="--tc:${t.color}">${avatar(Prog.avatarKind())}</div>
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
  <div class="stgames">${['big2','seven','mj'].map(g=>{ const b=G[g], tot=b.places.reduce((a,c)=>a+c,0)||1;
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
  const P=Prog.state, st=P.st, t=Prog.tierOf(P.rp), G=st.byGame, tg=G.big2.g+G.seven.g+G.mj.g, tw=G.big2.w+G.seven.w+G.mj.w;
  const name=($('nick').value.trim()||'我');
  const link = location.protocol.startsWith('http') && !location.hostname.endsWith('claude.ai') && !location.hostname.endsWith('claudeusercontent.com') ? '\n'+location.origin+location.pathname : '';
  return `【揪咖打牌】${name} 的戰績\n段位：${t.name} ${P.rp} 分（全服 #${Prog.myRank()}）\n總場數 ${tg}，勝率 ${tg?Math.round(tw/tg*100):0}%，最高連勝 ${P.best}\n麻將最大一把 ${st.mjMaxTai} 台，成就 ${Prog.achState().filter(a=>a.got).length} 個\n敢來挑戰我嗎？${link}`;
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

/* ================= 大廳 / 房間 ================= */
function syncChips(){
  document.querySelectorAll('#nChips .chip').forEach(b=>b.setAttribute('aria-pressed', +b.dataset.n===prefs.n));
  document.querySelectorAll('#dChips .chip').forEach(b=>b.setAttribute('aria-pressed', b.dataset.d===prefs.diff));
  $('gBig2').setAttribute('aria-pressed', prefs.game==='big2'); $('gSeven').setAttribute('aria-pressed', prefs.game==='seven'); $('gMJ').setAttribute('aria-pressed', prefs.game==='mj');
  document.querySelectorAll('#nChips .chip').forEach(b=>{ b.disabled = prefs.game==='mj'; if(prefs.game==='mj') b.setAttribute('aria-pressed', b.dataset.n==='4'); });
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
      html += `<div class="lseat"><div class="av">${avatar(s.kind)}</div><span class="nm">${esc(s.name)}${s.rp!=null?`<br>${tierPill(s.rp)}`:''}</span>${s.host?'<span class="pill">房主</span>':''}</div>`; }
    else { const b=BOTS[i-hs.length]; html += `<div class="lseat bot"><div class="av">${avatar(b[1])}</div><span class="nm">${b[0]}</span><span class="pill">電腦</span></div>`; }
  }
  $('lobbySeats').innerHTML = html;
  $('lobbyCtl').hidden=false;
  document.querySelectorAll('#lgChips .chip').forEach(b=>{ b.setAttribute('aria-pressed', b.dataset.g===L.type); b.disabled=!isHost; });
  document.querySelectorAll('#lnChips .chip').forEach(b=>{ b.setAttribute('aria-pressed', +b.dataset.n===n); b.disabled=!isHost || +b.dataset.n<hs.length || L.type==='mj'; });
  document.querySelectorAll('#llChips .chip').forEach(b=>{ b.setAttribute('aria-pressed', b.dataset.l===L.mjLen); b.disabled=!isHost; });
  $('llField').hidden = L.type!=='mj';
  document.querySelectorAll('#ldChips .chip').forEach(b=>{ b.setAttribute('aria-pressed', b.dataset.d===L.diff); b.disabled=!isHost; });
  $('btnGo').hidden = !isHost;
  $('lobbyNote').textContent = isHost
    ? `把房號 ${L.code} 或邀請連結傳給朋友。人不夠的座位由電腦補。房主請保持這個畫面開著，切到別的 App 可能會讓整桌斷線。`
    : '等房主開始遊戲…';
  $('btnCopy').hidden = !isHost;
}
function inviteLink(){ return location.origin + location.pathname + '?r=' + (C.code||''); }

$('lgChips').addEventListener('click', e=>{ const b=e.target.closest('.chip'); if(!b||!H||H.started) return; H.type=b.dataset.g; prefs.game=H.type; Snd.tap(); broadcastLobby(); });
$('lnChips').addEventListener('click', e=>{ const b=e.target.closest('.chip'); if(!b||!H||H.started||b.disabled) return; H.n=+b.dataset.n; prefs.n=H.n; Snd.tap(); broadcastLobby(); });
$('llChips').addEventListener('click', e=>{ const b=e.target.closest('.chip'); if(!b||!H||H.started) return; H.mjLen=b.dataset.l; prefs.mjLen=H.mjLen; Snd.tap(); broadcastLobby(); });
$('ldChips').addEventListener('click', e=>{ const b=e.target.closest('.chip'); if(!b||!H||H.started) return; H.diff=b.dataset.d; prefs.diff=H.diff; Snd.tap(); broadcastLobby(); });
$('btnGo').addEventListener('click', ()=>{ if(!H) return; store.set('jk_prefs',prefs); Snd.init(); hostStart(); });
$('btnCopy').addEventListener('click', ()=>{
  const link=inviteLink(), t=`來玩${GNAME[H?H.type:prefs.game]}！房號 ${C.code}\n${link}`;
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
      my.conn=w; my.lost=false; my.ever=true;
      w.onData(m=>{ if(C!==my||!m) return;
        if(m.t==='lobby') showLobby(m.L);
        else if(m.t==='state') applyView(m.V);
        else if(m.t==='emo') showEmo(m.by, m.e);
        else if(m.t==='err'){ toast(m.msg); Snd.err(); if(m.fatal){ my.leaving=true; exitToMenu(); } }
        else if(m.t==='closed'){ my.leaving=true; toast('房主關掉房間了'); exitToMenu(); }
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
  if(my.tries>6){ toast('連不回房間了'); my.leaving=true; exitToMenu(); return; }
  toast('跟房主斷線了，重新連線中…', 2500);
  setTimeout(()=>{ if(C===my && !my.leaving){ my.lost=false; guestConnect(my.tries); } }, 2500);
}

function exitToMenu(){
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
$('mlChips').addEventListener('click', e=>{ const b=e.target.closest('.chip'); if(!b) return; prefs.mjLen=b.dataset.l; syncChips(); Snd.init(); Snd.tap(); });
['btnSound1','btnSound2'].forEach(id=>$(id).addEventListener('click',()=>{ Snd.on=!Snd.on; store.set('jk_sound',Snd.on); Snd.init(); soundLabel(); Snd.tap(); }));
$('btnRules').addEventListener('click',()=>{ const g=C&&C.V?C.V.type:prefs.game; $('rulesTitle').textContent=GNAME[g]+'規則'; $('rules2').hidden=g!=='big2'; $('rules7').hidden=g!=='seven'; $('rulesMJ').hidden=g!=='mj'; $('rules').hidden=false; });
$('btnRulesOk').addEventListener('click',()=>$('rules').hidden=true);
syncChips(); soundLabel(); applyTheme(); renderProfile(); tickerNext();

if(!P2P){
  $('btnHost').disabled=true; $('btnJoin').disabled=true; $('joinCode').disabled=true;
  $('netNote').textContent='這裡不能連線。請從 GitHub Pages 上的網址打開，就能開房跟朋友玩。';
}
const inv = (QS.get('r')||'').replace(/\D/g,'').slice(0,4);
if(inv){ $('joinCode').value=inv; $('netPanel').classList.add('invited'); $('netNote').textContent = P2P ? `朋友邀你進房 ${inv}，輸入暱稱後按「加入」` : $('netNote').textContent; }

let wake=null;
async function keepAwake(){ try{ if(navigator.wakeLock && !wake){ wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release',()=>wake=null); } }catch(e){} }
document.addEventListener('visibilitychange',()=>{ if(!document.hidden && C) keepAwake(); });
window.addEventListener('beforeunload', ()=>{ if(H&&H.net) H.conns.forEach(w=>w.send({t:'closed'})); });

/* 測試用 */
window.__jk = { get C(){return C;}, get H(){return H;} };
})();
