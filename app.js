"use strict";
/* ============================================================
   Настройки, данные, мелкие помощники
   ============================================================ */
const CFG = Object.assign({
  geocoderKey:"", geocodeMissing:false, searchBounds:[[55.55,37.75],[56.25,39.35]],
  tileUrl:"https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  tileAttribution:""
}, window.BUS_CONFIG||{});
const D = window.BUS_DATA;
const Q = new URLSearchParams(location.search);
const EDIT = Q.get("edit")==="1";
const ENT = D.enterprise, RC = "РЦ Кудиново";
const DESTS = [ENT, RC];
const SHORT = {[ENT]:"МПЗ", [RC]:"РЦ"};
const TO_LABEL = {[ENT]:"До завода", [RC]:"До РЦ"};
const stopByName = Object.fromEntries(D.stops.map(s=>[s.name,s]));
const STOP_IDX = Object.fromEntries(D.stops.map((s,i)=>[s.name,i]));
const lab=n=>String(n||"").replace(/\s*\((?:остановка\s+)?(?:"[^"]*"\s+)?(?:в сторону|со стороны)[^()]*\)/gi,"").replace(/\s+в сторону [^()]*\)/gi,")").trim();
const CITIES=["Ногинск","Электросталь","Электроугли","Кудиново","Монино","Лосино-Петровский"];
const tripHasCity=(t,c)=>t.stops.some(s=>lab(s.stop).replace(/\([^)]*\)/g,"").toLowerCase().includes(c.toLowerCase()));
const TW={};D.stops.forEach(s=>{if(s.twin!=null)(TW[s.twin]=TW[s.twin]||[]).push(s.name)});
const twinsOf=n=>{const s=stopByName[n];return s&&s.twin!=null?TW[s.twin]:[n]};
const ROUTES = [...new Set(D.trips.map(t=>t.route))].sort();
const KIND = {exact:"точное время", approx:"ориентировочно", rc:"для сотрудников РЦ", demand:"по требованию"};
const DOW = ["вс","пн","вт","ср","чт","пт","сб"];
const MON = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];

const ICONS = {
  map:'<path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/>',
  list:'<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M4 10h16M8 14h5"/>',
  clock:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  locate:'<circle cx="12" cy="12" r="3.4"/><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4"/>',
  route:'<circle cx="6" cy="18" r="2.4"/><circle cx="18" cy="6" r="2.4"/><path d="M8.4 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.6"/>',
  walk:'<circle cx="13" cy="4.5" r="1.8"/><path d="M11 21l1.6-6-2.6-2.4.9-4.4 3.3 2.2 2.3.8M9.9 9.2 7.2 11l-.5 3"/>',
  car:'<path d="M4 16v-4l2-5h12l2 5v4M3 16h18M7 16v2.5M17 16v2.5"/><circle cx="8" cy="13" r=".7"/><circle cx="16" cy="13" r=".7"/>',
  chev:'<path d="M6 9l6 6 6-6"/>',
  close:'<path d="M6 6l12 12M18 6 6 18"/>',
  search:'<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  theme:'<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  user:'<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>',
  bus:'<rect x="5" y="4" width="14" height="14" rx="3"/><path d="M5 12h14M8 21v-3M16 21v-3"/><circle cx="8.5" cy="15" r=".8"/><circle cx="15.5" cy="15" r=".8"/>',
  swap:'<path d="M7 7h11l-3-3M17 17H6l3 3"/>',
  flag:'<path d="M6 21V4M6 5h11l-2 4 2 4H6"/>',
  pin:'<path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/>',
  plane:'<path d="M21 3 3 10.5l7 2.5 2.5 7L21 3z"/><path d="M10 13 21 3"/>',
  back:'<path d="M15 5l-7 7 7 7"/>'
};
const svg = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`;

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pad = n => String(n).padStart(2,"0");
const toMin = t => { const [h,m]=t.split(":").map(Number); return h*60+m; };
const fmtMin = m => pad(Math.floor(m/60)%24)+":"+pad(m%60);
const NUM = Object.fromEntries(((window.BUS_DATA&&window.BUS_DATA.stops)||[]).filter(x=>x.num).map(x=>[x.name,x.num]));
const hasXY = s => s && typeof s.lat==="number" && typeof s.lon==="number";
const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const desktop = () => matchMedia("(min-width:860px)").matches;
function human(m){ if(m<60) return m+" мин"; const h=Math.floor(m/60), r=m%60; return h+" ч"+(r?" "+pad(r)+" мин":""); }
function fmtDist(m){ return m<1000 ? Math.round(m/10)*10+" м" : (m/1000).toFixed(1).replace(".",",")+" км"; }
function haversine(a,b){
  const R=6371000, rad=x=>x*Math.PI/180, dLat=rad(b.lat-a.lat), dLon=rad(b.lon-a.lon);
  const h=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
}
const store = {
  get(k,d){ try{ const v=localStorage.getItem(k); return v===null?d:JSON.parse(v);}catch(e){return d;} },
  set(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} }
};
function toast(msg,ms=4200){ const t=$("toast"); t.textContent=msg; t.hidden=false; clearTimeout(toast._t); toast._t=setTimeout(()=>t.hidden=true,ms); }

/* ============================================================
   Состояние
   ============================================================ */
const S = {
  tab:"map", dest:store.get("bus.dest",ENT), dir:"to", stop:store.get("bus.stop",null), stopManual:store.get("bus.stopManual",false),
  ride:null, view:"route", mode:store.get("bus.mode","walk"), user:null, locating:false, locErr:null, locWarn:null, picking:false,
  when:null, sheet:"half", theme:store.get("bus.theme","auto"),
  schedRoute:"all", schedDay:null, q:"", open:new Set(), editPick:null
};
if(!DESTS.includes(S.dest)) S.dest=ENT;
if(["auto","light","dark"].includes(Q.get("theme"))) S.theme=Q.get("theme");
if(S.stop && !stopByName[S.stop]) S.stop=null;

/* ---------- дата и время (с учётом запланированного) ---------- */
function realNow(){ const q=Q.get("now"); return q?new Date(q):new Date(); }
const dayOf = d => new Date(d.getFullYear(),d.getMonth(),d.getDate());
const ymd = d => d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const parseYmd = s => { const [y,m,d]=s.split("-").map(Number); return new Date(y,m-1,d); };
const sameDay = (a,b) => a.getTime()===b.getTime();
const dkOf = d => d.getDay()===6 ? "sat" : "work";
function ctx(){
  const rn=realNow(), today=dayOf(rn);
  if(S.when) return {date:parseYmd(S.when.date), min:toMin(S.when.time), planned:true, today};
  return {date:today, min:rn.getHours()*60+rn.getMinutes(), planned:false, today};
}
const dateLabel = d => DOW[d.getDay()]+", "+d.getDate()+" "+MON[d.getMonth()];
function dayWord(date,today){
  const diff=Math.round((date-today)/864e5);
  return diff===0?"сегодня":diff===1?"завтра":dateLabel(date);
}
function whenLabel(){
  const c=ctx(); if(!c.planned) return "Сейчас";
  const diff=Math.round((c.date-c.today)/864e5);
  const dl = diff===0?"Сегодня":diff===1?"Завтра":c.date.getDate()+" "+MON[c.date.getMonth()].slice(0,3);
  return dl+", "+fmtMin(c.min);
}

/* ============================================================
   Движок рейсов
   ============================================================ */
const tripsFor = dk => D.trips.filter(t => dk==="all" || t.days==="daily" || (dk==="sat" ? t.days==="sat" : t.days==="exceptSat"));

function legRides(from,to,dk){
  const out=[];
  for(const t of tripsFor(dk)){
    for(let i=0;i<t.stops.length;i++){
      if(t.stops[i].stop!==from) continue;
      let j=-1;
      for(let k=i+1;k<t.stops.length;k++){ if(t.stops[k].stop===to){ j=k; break; } if(t.stops[k].stop===from) break; }
      if(j<0) continue;
      const a=t.stops[i], b=t.stops[j];
      out.push({trip:t,i,j,dep:a.time,arr:b.time,kind:a.kind,note:a.note,key:a.time?toMin(a.time):toMin(t.start)});
      break; // одна посадка на рейс — первая
    }
  }
  return out;
}
/* рейсы между остановкой и объектом на день dk; для РЦ без прямого рейса — с пересадкой в МПЗ */
function planDay(stop,dir,dest,dk){
  const A = dir==="to"?stop:dest, B = dir==="to"?dest:stop;
  let rides = legRides(A,B,dk).map(r=>({legs:[r],dep:r.dep,arr:r.arr,key:r.key,kind:r.kind,note:r.note,trip:r.trip}));
  if(!rides.length && dest===RC && stop!==ENT){
    const l1 = dir==="to" ? legRides(stop,ENT,dk) : legRides(RC,ENT,dk);
    const l2 = dir==="to" ? legRides(ENT,RC,dk)   : legRides(ENT,stop,dk);
    for(const r1 of l1){
      if(!r1.arr) continue;
      const a=toMin(r1.arr);
      const r2=l2.filter(x=>x.dep && toMin(x.dep)>=a+5).sort((x,y)=>x.key-y.key)[0];
      if(r2) rides.push({legs:[r1,r2],dep:r1.dep,arr:r2.arr,key:r1.key,kind:r1.kind,note:r1.note,trip:r1.trip,xfer:ENT});
    }
  }
  return rides.sort((a,b)=>a.key-b.key);
}
const rideEnd = r => r.dep ? toMin(r.dep) : toMin(r.trip.end);

const SERVED = {};
(function(){
  for(const d of DESTS){
    SERVED[d]={to:new Set(),from:new Set()};
    for(const s of D.stops){
      if(s.name===d) continue;
      if(planDay(s.name,"to",d,"all").length) SERVED[d].to.add(s.name);
      if(planDay(s.name,"from",d,"all").length) SERVED[d].from.add(s.name);
    }
  }
})();
const ROUTES_AT = {};
for(const t of D.trips) for(const s of t.stops) (ROUTES_AT[s.stop]=ROUTES_AT[s.stop]||new Set()).add(t.route);

/* ближайшие рейсы с учётом выбранного времени; если сегодня их нет — ищем в ближайшие дни */
function pickRide(plan){
  if(!plan||!plan.rides.length) return {sel:null,idx:-1,auto:false};
  const n=plan.rides.length;
  if(S.ride!=null){ const i=Math.min(S.ride,n-1); return {sel:plan.rides[i],idx:i,auto:false}; }
  let i=0;
  if(S.dir==="to" && S.user && !plan.c.planned && plan.offset===0){
    const d=distToStop();
    if(d!=null){ const w=(S.mode==="walk"?walkMin(d):carMin(d))+1; const k=plan.rides.findIndex(r=>r.dep && toMin(r.dep)-w>=plan.c.min); if(k>0) i=k; }
  }
  return {sel:plan.rides[i],idx:i,auto:true};
}
function upcomingPlan(){
  if(!S.stop) return null;
  const c=ctx();
  for(let off=0;off<8;off++){
    const date=new Date(c.date.getFullYear(),c.date.getMonth(),c.date.getDate()+off);
    let rides=planDay(S.stop,S.dir,S.dest,dkOf(date));
    if(off===0) rides=rides.filter(r=>rideEnd(r)>=c.min);
    if(rides.length) return {rides,offset:off,date,c};
  }
  return {rides:[],offset:0,date:c.date,c};
}

/* ---------- расстояния и время в пути до остановки ---------- */
const walkMin = m => Math.max(1,Math.round(m*1.25/80));
const carMin  = m => Math.max(1,Math.round(m*1.35/450));
function distToStop(){ const s=S.stop&&stopByName[S.stop]; if(!(S.user&&hasXY(s))) return null; const d=haversine(S.user,s); return S.mode==="walk"?wm(S.stop,d).m:d; }
/* Пешеходный маршрутизатор (OSRM, профиль foot): настоящая длина пути до остановок. Если сервис недоступен — оценка по прямой. */
const WALK={key:"",m:{},busy:false};
const wKey=()=>S.user?S.user.lat.toFixed(4)+","+S.user.lon.toFixed(4):"";
function wm(n,d){ const w=WALK.key===wKey()?WALK.m[n]:null; return w?{min:Math.max(1,Math.ceil(w.s/60)),m:w.d}:{min:walkMin(d),m:d}; }
function walkCands(){
  if(!S.user) return [];
  const out=[]; for(const n of SERVED[S.dest][S.dir]){ const s=stopByName[n]; if(!hasXY(s)||DESTS.includes(n)) continue; out.push({name:n,d:haversine(S.user,s)}); }
  out.sort((a,b)=>a.d-b.d);
  const cand=out.filter(x=>x.d<=4000); return (cand.length>=3?cand:out.slice(0,3)).slice(0,12);
}
async function refineWalk(){
  if(!S.user||S.mode!=="walk"||WALK.busy||WALK.key===wKey()) return;
  const key=wKey(), cs=walkCands(); if(!cs.length) return; WALK.busy=true;
  const base=((window.BUS_CONFIG&&BUS_CONFIG.footRouter)||"https://routing.openstreetmap.de/routed-foot").replace(/\/$/,"");
  const pts=[[S.user.lon,S.user.lat],...cs.map(x=>{const t=stopByName[x.name]; return [t.lon,t.lat];})], m={};
  try{ const j=await(await fetch(`${base}/table/v1/foot/${pts.map(q=>q.join(",")).join(";")}?sources=0&annotations=duration,distance`)).json();
    if(j.code==="Ok") cs.forEach((x,i)=>{ const t=j.durations[0][i+1], d=j.distances&&j.distances[0][i+1]; if(t!=null) m[x.name]={s:t,d:d!=null?d:x.d}; }); }catch(e){}
  WALK.busy=false; if(key!==wKey()) return refineWalk();
  WALK.key=key; WALK.m=m; autoPickStop(); renderTop(); renderSheet(); drawMap({fit:null});
}
/* парные остановки (по разные стороны дороги): берём ту, у которой есть рейсы в нужную сторону */
function resolveStop(n){
  const g=twinsOf(n); if(g.length<2) return n;
  const c=g.filter(x=>SERVED[S.dest][S.dir].has(x));
  return !c.length||c.includes(n)?n:c[0];
}
function nearestStop(){
  if(!S.user) return null;
  let best=null;
  for(const n of SERVED[S.dest][S.dir]){
    const s=stopByName[n]; if(!hasXY(s)) continue;
    const d=haversine(S.user,s); if(!best||d<best.d) best={name:n,d};
  }
  return best;
}
/* Подбор остановки: среди остановок в пешей доступности берём ту, с которой быстрее доехать (с учётом ходьбы) */
function scoreStop(n,d){
  const c=ctx(), w=(S.mode==="walk"?wm(n,d).min:carMin(d))+1;
  for(let off=0;off<8;off++){
    const date=new Date(c.date.getFullYear(),c.date.getMonth(),c.date.getDate()+off);
    let rides=planDay(n,S.dir,S.dest,dkOf(date));
    if(off===0) rides=rides.filter(r=>rideEnd(r)>=c.min && (S.dir!=="to"||!r.dep||toMin(r.dep)-w>=c.min));
    if(rides.length){ const r=rides[0], a=r.arr?toMin(r.arr):(r.dep?toMin(r.dep)+30:toMin(r.trip.end));
      return off*1440+a+(S.dir==="to"?.35*w:w); }
  }
  return 1e9;
}
function bestStop(){
  let best=null; for(const x of walkCands()){ x.sc=scoreStop(x.name,x.d); if(!best||x.sc<best.sc) best=x; }
  return best;
}
function autoPickStop(){
  if(S.stopManual || !S.user || S.locWarn==="far") return;
  const n=bestStop();
  if(n && n.name!==S.stop){ S.stop=n.name; S.ride=null; store.set("bus.stop",S.stop); }
  refineWalk();
}
function plantNote(){
  const t=stopByName[S.dest]; if(!S.user||!hasXY(t)||S.locWarn==="far") return "";
  const d=haversine(S.user,t); return d<=1500?`<div class="notice"><b>${S.dest===ENT?"Завод":"РЦ"} рядом:</b> пешком ≈${walkMin(d)} мин (${fmtDist(d)}). Автобус не нужен.</div>`:"";
}

/* ============================================================
   Шторка
   ============================================================ */
function stopPill(name){ return name; }
function rideTag(r){ return r.dep ? KIND[r.kind] : "по требованию"; }

function nearbyList(){
  if(!S.user) return [];
  const seen=new Set(), raw=[];
  for(const n of SERVED[S.dest][S.dir]){ const t=stopByName[n]; if(!hasXY(t)||DESTS.includes(n)) continue; raw.push({name:n,h:haversine(S.user,t)}); }
  raw.sort((a,b)=>a.h-b.h);
  return raw.slice(0,14).map(x=>{ const w=wm(x.name,x.h); return {name:x.name,d:w.m,min:w.min}; }).sort((a,b)=>a.d-b.d)
    .filter(x=>{ const t=stopByName[x.name]; if(t.twin==null) return true; if(seen.has(t.twin)) return false; seen.add(t.twin); return true; }).slice(0,10);
}
let NEAR=[];
function renderNearby(head,body,foot){
  NEAR=nearbyList(); const best=bestStop();
  head.innerHTML=`<div class="titlebtn"><span class="t"><h2>Ближайшие остановки</h2><small>${S.pinMode?"Выберите место на карте и нажмите «Выбрать»":"Выберите, откуда поедете — тогда построим маршрут"}</small></span></div>`;
  body.innerHTML=`<ul class="stoplist near">${NEAR.map((x,i)=>`<li><button type="button" data-act="pick-near" data-i="${i}"><span class="n">${esc(lab(x.name))}${best&&best.name===x.name?`<em class="fast">ближайший рейс</em>`:""}</span><span class="d">${fmtDist(x.d)} · ${x.min} мин</span></button></li>`).join("")||'<li class="empty">Рядом нет остановок этого направления</li>'}</ul>`;
  foot.hidden=true; body.scrollTop=0;
}
function renderSheet(){
  const head=$("sheetHead"), body=$("sheetBody"), foot=$("sheetFoot");
  if(EDIT){ head.innerHTML=`<div class="titlebtn"><div class="t"><h2>Настройка карты</h2><small>Режим администратора</small></div></div>`; foot.hidden=true; renderEdit(); return; }
  foot.hidden=false;
  if(S.view==="nearby"&&S.user&&S.locWarn!=="far"){ renderNearby(head,body,foot); return; }
  const plan=upcomingPlan(), dist=distToStop();
  const pr=pickRide(plan), sel=pr.sel;
  /* --- заголовок --- */
  if(!S.stop){
    head.innerHTML=`<button class="titlebtn" type="button" data-act="pick-stop"><span class="t"><h2>Откуда поедете?</h2><small>Выберите остановку или определите, где вы</small></span>${svg("chev")}</button>`;
  }else{
    const near=nearestStop(), isNear=near&&near.name===S.stop;
    const sub = dist!=null ? `${isNear&&!S.stopManual?"Ближайшая остановка":S.stopManual?"Остановка":"Удобная остановка"} · ${fmtDist(dist)} от вас` : "Остановка";
    let peek="";
    if(sel){
      const cd = (!plan.c.planned && plan.offset===0 && sel.dep) ? " · через "+human(toMin(sel.dep)-plan.c.min) : "";
      peek=`<div class="peekline"><span>${sel.dep?sel.dep:"по требованию"}${plan.offset>0?" · "+dayWord(plan.date,plan.c.today):""}${esc(cd)}</span><span class="badge b${sel.trip.route}">${sel.trip.route}</span></div>`;
    }else peek=`<div class="peekline mute">Рейсов нет</div>`;
    head.innerHTML=`<div class="trow"><button class="backbtn" type="button" data-act="nearby" aria-label="К ближайшим остановкам" title="К ближайшим остановкам">${svg("back")}</button><button class="titlebtn" type="button" data-act="pick-stop"><span class="t"><h2>${esc(lab(S.stop))}</h2><small>${sub}</small></span></button></div>${peek}${plantNote()}`;
  }
  /* --- тело --- */
  let html="";
  if(S.locating && !S.user) html+=`<div class="notice"><b>Определяем местоположение…</b><span class="mute">Разрешите доступ, если появится запрос.</span></div>`;
  if(S.locErr){
    const msg={denied:"Нет доступа к местоположению. Разрешите его в настройках приложения или браузера — или укажите точку на карте.",
      timeout:"Не удалось определить местоположение вовремя. Выйдите на открытое место или укажите точку на карте.",
      unavailable:"Местоположение сейчас недоступно. Включите GPS или укажите точку на карте.",
      unsupported:"В этом приложении местоположение недоступно. Укажите точку на карте."}[S.locErr]||"Местоположение недоступно.";
    html+=`<div class="notice warn"><b>Не получилось определить, где вы</b><span>${msg}</span>
      <button class="btn" type="button" data-act="manual">${svg("pin")}Указать на карте</button></div>`;
  }
  if(S.user && S.locWarn){
    const far = S.locWarn==="far";
    html+=`<div class="notice warn"><b>${far?"Вы далеко от маршрутов":"Местоположение неточное"}</b>
      <span>${far?"Точка определена за пределами района рейсов. Если включён VPN, слабый GPS или Wi-Fi, местоположение могло определиться неверно. ":`Точность около ${fmtDist(S.user.acc)}. `}Укажите, где вы находитесь, на карте — расчёт будет точнее.</span>
      <button class="btn" type="button" data-act="manual">${svg("pin")}Указать на карте</button>
      <button class="btn sec" type="button" data-act="locate">${svg("locate")}Определить снова</button></div>`;
  }
  if(!S.stop){
    html+=`<div class="row2" style="margin-top:6px">
      <button class="btn" type="button" data-act="locate">${svg("locate")}Определить местоположение</button>
      <button class="btn sec" type="button" data-act="pick-stop">${svg("search")}Выбрать остановку</button>
      <button class="btn sec" type="button" data-act="manual">${svg("pin")}Указать на карте</button></div>`;
  }else{
    const near=nearestStop();
    if(S.user && near && near.name!==S.stop && S.locWarn!=="far")
      html+=`<button class="pill" type="button" data-act="nearest" style="margin:2px 0 6px">${svg("locate")}&nbsp;Ближайшая: ${esc(near.name)}, ${fmtDist(near.d)}</button>`;
    html+=timelineHTML(plan,pr,dist);
  }
  body.innerHTML=html;
  /* --- переключатель направления (как в примере: внизу шторки) --- */
  foot.innerHTML=""; foot.style.display="none";
}

function timelineHTML(plan,pr,dist){
  const sel=pr.sel, to=S.dir==="to", c=plan.c;
  const stopName=S.stop, destName=S.dest;
  let out="";
  /* нет рейсов */
  if(!sel){
    const other = DESTS.find(d=>d!==S.dest);
    const served = SERVED[S.dest][S.dir].has(S.stop);
    out+=`<div class="notice"><b>${served?"Рейсов в ближайшие дни нет":"Здесь нет рейсов "+(to?"до ":"от ")+(S.dest===ENT?"завода":"РЦ")}</b>
      <span>${served?"Проверьте выбранную дату.":"Выберите другую остановку или направление."}</span>
      <button class="btn" type="button" data-act="pick-stop">${svg("search")}Выбрать остановку</button>
      ${SERVED[other][S.dir].has(S.stop)?`<button class="btn sec" type="button" data-act="dest" data-v="${esc(other)}">Показать рейсы ${to?"до ":"от "}${SHORT[other]}</button>`:""}</div>`;
    return out;
  }
  const dayNote = plan.offset>0 ? `<div class="notice warn" style="margin:0 0 6px"><b>${c.planned?"На выбранное время рейсов больше нет":"Сегодня рейсов больше нет"}</b><span>Показываем рейсы: ${dayWord(plan.date,c.today)}.</span></div>` : "";
  const boardName = to ? stopName : destName;
  const alightName = to ? destName : stopName;
  const idx = pr.idx;
  const first = idx===0;

  /* карточка выбранного рейса */
  const live = !c.planned && plan.offset===0 && sel.dep;
  const cd = live ? (toMin(sel.dep)-c.min<=0 ? "сейчас" : "через "+human(toMin(sel.dep)-c.min)) : "";
  const leaveBy = (to && live && dist!=null)
    ? (()=>{ const w = S.mode==="walk"?walkMin(dist):carMin(dist), left=toMin(sel.dep)-c.min, lb=toMin(sel.dep)-w-1;
        return lb>=c.min ? `<div class="go">${svg(S.mode==="walk"?"walk":"car")}<span>Выйдите до ${fmtMin(lb)}</span></div>`
          : `<div class="go late">${svg("clock")}<span>Не успеете: до остановки ≈${w} мин, до отправления ${human(Math.max(0,left))}</span></div>`; })()
    : "";
  const tt = sel.trip;
  const rideCard = `<div class="ride">
    <div class="lbl">${first?"Ближайший автобус":(pr.auto?"Ближайший, на который успеете":"Выбранный рейс")}${plan.offset>0?" · "+dayWord(plan.date,c.today):""}</div>
    <div class="big"><span class="t">${sel.dep?(sel.kind==="approx"?"≈":"")+sel.dep:"по требованию"}</span><span class="badge b${tt.route}">${tt.route}</span>${cd?`<span class="cd">${cd}</span>`:""}</div>
    <div class="meta">${tt.part==="morning"?"Утренний":"Вечерний"} рейс ${tt.start}–${tt.end} · ${rideTag(sel)}${sel.note?" · "+esc(sel.note):""}${sel.xfer?" · с пересадкой":""}</div>
    ${leaveBy}</div>`;
  /* остальные рейсы мелко */
  const others = plan.rides.map((r,i)=>({r,i})).filter(x=>x.i!==idx);
  const chips = others.length ? `<div class="others"><div class="lbl">${others.length===1?"Ещё один рейс":"Другие рейсы"}</div><div class="chips">${others.map(({r,i})=>
    `<button type="button" class="rchip d${r.trip.route}${r.kind==="approx"?" ap":""}${r.dep?"":" dem"}" data-act="ride" data-i="${i}"><i class="dot"></i>${r.dep?r.dep:"по треб."}<span class="mute" style="font-weight:600">${r.trip.route}</span></button>`).join("")}</div></div>` : "";
  /* остановки в пути */
  const pathItems=[];
  sel.legs.forEach((leg,li)=>{
    if(li>0) pathItems.push(`<li><time></time><span class="dm">пересадка в ${esc(sel.xfer)}</span></li>`);
    for(let k=leg.i;k<=leg.j;k++){
      const s=leg.trip.stops[k];
      pathItems.push(`<li><time class="${s.kind==="approx"?"ap":""}">${s.time?(s.kind==="approx"?"≈":"")+s.time:"—"}</time><span>${esc(lab(s.stop))}${s.time?"":` <span class="dm">· по требованию</span>`}</span></li>`);
    }
  });
  const inBetween = sel.legs.reduce((n,l)=>n+(l.j-l.i-1),0);
  const pk=[S.stop,S.dir,S.dest,sel.legs.map(l=>l.trip.id).join("+"),sel.dep||""].join("|");
  const path = `<details class="path" data-pk="${esc(pk)}"${S.pathOpen===pk?" open":""}><summary>Остановки в пути${inBetween>0?` (${inBetween})`:""}</summary><ul class="pathlist">${pathItems.join("")}</ul></details>`;

  const boardNode = `<li class="node"><div class="rail"><div class="ico">${svg("bus")}</div></div><div>
      <h3>${esc(boardName)}</h3><div class="sub">${to?"Посадка":"Отправление от "+(destName===ENT?"завода":"РЦ")}</div>${dayNote}${rideCard}${chips}${path}</div></li>`;

  const dur = (sel.dep&&sel.arr) ? ` · в пути ${human(toMin(sel.arr)-toMin(sel.dep))}` : "";
  const alightNode = `<li class="node${to?"":" dash"}"><div class="rail"><div class="ico plain"></div></div><div>
      <h3>${esc(alightName)}</h3><div class="sub">${sel.arr?`Прибытие в ${sel.arr}${dur}`:"Время прибытия не указано"}</div></div></li>`;

  let xferNode="";
  if(sel.xfer){
    const l1=sel.legs[0], l2=sel.legs[1];
    const wait = (l1.arr&&l2.dep)?toMin(l2.dep)-toMin(l1.arr):null;
    xferNode=`<li class="node"><div class="rail"><div class="ico xfer">${svg("swap")}</div></div><div>
      <h3>Пересадка: ${esc(sel.xfer)}</h3><div class="sub">${l1.arr||"?"} → ${l2.dep||"?"}${wait!=null?` · ждать ${human(wait)}`:""} · автобус <span class="badge b${l2.trip.route}" style="height:20px;min-width:34px;font-size:12px">${l2.trip.route}</span></div></div></li>`;
  }

  /* «Моё местоположение» + пешком / на машине */
  let you="";
  if(S.user){
    const w=dist!=null?walkMin(dist):null, cm=dist!=null?carMin(dist):null;
    you=`<li class="node${to?" dash":""}"><div class="rail"><div class="ico you">${svg("user")}</div></div><div>
      <h3>Моё местоположение</h3><div class="sub">${S.user.manual?"указано вручную":"определено по датчикам телефона"}</div>
      ${dist!=null?`<div class="leg seg flat" role="group" aria-label="Как добираться до остановки" style="margin-top:10px">
        <button type="button" data-act="mode" data-v="walk" aria-pressed="${S.mode==="walk"}">${svg("walk")}≈${w} мин</button>
        <button type="button" data-act="mode" data-v="car" aria-pressed="${S.mode==="car"}">${svg("car")}≈${cm} мин</button></div>
        <div class="sub small" style="margin-top:6px">До остановки ${fmtDist(dist)}, время примерное</div>`:`<div class="sub">У остановки нет координат</div>`}</div></li>`;
  }else{
    you=`<li class="node${to?" dash":""}"><div class="rail"><div class="ico you">${svg("user")}</div></div><div>
      <h3>Где вы?</h3><div class="sub">Определим расстояние и время до остановки</div>
      <button class="btn" type="button" data-act="locate" style="margin-top:10px;min-height:46px;font-size:15px">${svg("locate")}Определить местоположение</button></div></li>`;
  }
  const nodes = to ? [you,boardNode,xferNode,alightNode] : [boardNode,xferNode,alightNode,you];
  return `<ol class="tl">${nodes.join("")}</ol>`;
}

/* ============================================================
   Верхняя панель, кнопки на карте, вкладки
   ============================================================ */
function renderTop(){
  const toP=S.dir==="to", plantName=S.dest===ENT?"Завод":S.dest;
  const meLbl=(S.user&&!S.stopManual)||!S.stop?"Моё местоположение":lab(S.stop);
  const me=`<button type="button" class="ep" data-act="pick-stop">${svg("user")}<span><small>${toP?"Откуда":"Куда"}</small>${esc(meLbl)}</span></button>`;
  const pl=`<button type="button" class="ep" data-act="toggle-dest" title="Сменить: завод / РЦ Кудиново">${svg("bus")}<span><small>${toP?"Куда":"Откуда"}</small>${esc(plantName)}</span></button>`;
  $("destSeg").innerHTML=(toP?me:pl)+`<button type="button" class="sw" data-act="swap" aria-label="Поменять местами" title="Поменять местами">${svg("swap")}</button>`+(toP?pl:me);
  const chip=$("whenChip");
  chip.innerHTML=svg("clock")+esc(whenLabel());
  chip.classList.toggle("on",!!S.when);
  $("fabs").innerHTML=`<button class="fab sm" type="button" data-act="zoom" data-v="1" aria-label="Приблизить">+</button>
    <button class="fab sm" type="button" data-act="zoom" data-v="-1" aria-label="Отдалить">−</button>
    <button class="fab${S.user&&!S.user.manual?" on":""}" type="button" data-act="locate" aria-label="Где я" title="Где я">${svg("plane")}</button>`;
  $("schedBtn").innerHTML=svg("list")+"Расписание";
  $("tabMap").innerHTML=svg("map")+"Карта";
  $("tabSched").innerHTML=svg("list")+"Расписание";
}

function setTab(t){
  S.tab=t;
  $("mapView").hidden = t!=="map";
  $("schedView").hidden = t!=="sched";
  $("tabMap").setAttribute("aria-selected",t==="map");
  $("tabSched").setAttribute("aria-selected",t==="sched");
  if(t==="map"){ setTimeout(()=>{ MAP.map&&MAP.map.invalidateSize(); setSheet(S.sheet); },30); }
  else renderSched();
}

/* ============================================================
   Расписание
   ============================================================ */
function schedDay(){ return S.schedDay || dkOf(ctx().date); }
function renderSchedHead(){
  const c=ctx(), dl=dateLabel(c.date);
  const chips = ["all",...CITIES].map(r=>`<button class="chip" type="button" data-act="sroute" data-v="${r}" aria-pressed="${(CITIES.includes(S.schedRoute)?S.schedRoute:"all")===r}">${r==="all"?"Все":r}</button>`).join("");
  const days = [[null,dl.replace(/^./,x=>x.toUpperCase())],["work","Будни, вс"],["sat","Суббота"]].map(([k,l])=>`<button class="chip" type="button" data-act="sday" data-v="${k||""}" aria-pressed="${S.schedDay===k}">${l}</button>`).join("");
  $("schedHead").innerHTML=`<div class="row"><button class="iconbtn" type="button" data-act="tab" data-v="map" aria-label="К карте" title="К карте">${svg("back")}</button><h1>Расписание</h1>
    <button class="whenchip${S.when?" on":""}" type="button" data-act="open-when">${svg("clock")}${esc(whenLabel())}</button>
    <button class="iconbtn" type="button" data-act="theme" aria-label="Тема оформления" title="Тема: ${({auto:"как в системе",light:"светлая",dark:"тёмная"})[S.theme]}">${svg("theme")}</button></div>
    <div class="hscroll" role="group" aria-label="Город">${chips}</div>
    <div class="hscroll" role="group" aria-label="День" style="padding-top:2px">${days}</div>
    <label class="search">${svg("search")}<input id="schedQ" type="search" placeholder="Найти остановку" value="${esc(S.q)}" autocomplete="off"></label>`;
}
function renderSchedList(){
  const dk=schedDay(), c=ctx(), q=S.q.trim().toLowerCase();
  const live = !S.schedDay && sameDay(c.date,c.today);
  let trips=tripsFor(dk).filter(t=>!CITIES.includes(S.schedRoute)||tripHasCity(t,S.schedRoute));
  if(q) trips=trips.filter(t=>t.stops.some(s=>s.stop.toLowerCase().includes(q)));
  const label = S.schedDay ? (dk==="sat"?"по субботам":"в будни и воскресенье") : dateLabel(c.date)+(dk==="sat"?" (суббота)":"");
  let html=`<div class="dayline">Рейсы ${esc(label)}</div>`;
  if(!trips.length) html+=`<div class="empty">Ничего не найдено. Измените маршрут, день или поиск.</div>`;
  {
    const ts=trips.slice().sort((a,b)=>toMin(a.start)-toMin(b.start));
    for(const t of ts){
      const open=S.open.has(t.id) || (q&&ts.length<=3);
      const past = live && toMin(t.end)<c.min;
      const n=t.stops.filter(s=>s.stop!==ENT).length;
      html+=`<div class="trip${open?" open":""}${past?" past":""}"><button type="button" data-act="trip" data-id="${t.id}" aria-expanded="${open}">
        <span><span class="tt">${t.start} – ${t.end}</span><span class="ts"><span>${t.part==="morning"?"Утро":"Вечер"}</span><span class="badge b${t.route}">${t.route}</span>${t.rc?`<span class="pill">для сотрудников РЦ</span>`:""}<span>${n} ${n===1?"остановка":n<5?"остановки":"остановок"}</span></span></span>
        <span class="chev">${svg("chev")}</span></button>`;
      if(open){
        html+=`<div class="tbody"><ol class="stline">${t.stops.map(s=>{
          const ent=DESTS.includes(s.stop), hit=q&&s.stop.toLowerCase().includes(q), dem=!s.time;
          const notes=[]; if(s.time&&s.kind==="exact") notes.push("точное время"); if(s.kind==="rc"&&s.time) notes.push("для сотрудников РЦ"); if(dem) notes.push("при наличии пассажиров"); if(s.note) notes.push(s.note);
          return `<li class="${ent?"ent ":""}${hit?"hit ":""}${dem?"dem":""}"><button type="button" data-act="goto-stop" data-si="${STOP_IDX[s.stop]}">
            <span class="tm ${s.kind==="approx"?"ap":""}${dem?" nn":""}">${dem?"по требо&shy;ванию":(s.kind==="approx"?"≈":"")+s.time}</span><span class="rl"><i></i></span>
            <span class="nm">${NUM[s.stop]?`<b class="sn">${NUM[s.stop]}</b>`:""}${esc(lab(s.stop))}${notes.length?`<em>${esc(notes.join(" · "))}</em>`:""}</span></button></li>`; }).join("")}</ol></div>`;
      }
      html+=`</div>`;
    }
  }
  $("schedList").innerHTML=html;
}
function renderSched(){ renderSchedHead(); renderSchedList(); }

/* ============================================================
   Модальные окна: «Когда поедете?» и выбор остановки
   ============================================================ */
const modalRoot=$("modalRoot");
function openModal(title,inner,onOpen){
  modalRoot.innerHTML=`<div class="modal" data-act="modal-bg"><div class="mcard" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="mhead"><h3>${esc(title)}</h3><button class="mclose" type="button" data-act="close-modal" aria-label="Закрыть">${svg("close")}</button></div>
    <div class="mbody">${inner}</div></div></div>`;
  onOpen&&onOpen();
}
const closeModal=()=>{ modalRoot.innerHTML=""; };

function openWhen(){
  const c=ctx(), rn=realNow();
  const today=ymd(c.today), tomorrow=ymd(new Date(c.today.getFullYear(),c.today.getMonth(),c.today.getDate()+1));
  const dv = S.when?S.when.date:ymd(c.date), tv=S.when?S.when.time:fmtMin(rn.getHours()*60+rn.getMinutes());
  openModal("Когда поедете?",`
    <div class="quick"><button class="chip" type="button" data-act="when-day" data-v="${today}">Сегодня</button><button class="chip" type="button" data-act="when-day" data-v="${tomorrow}">Завтра</button></div>
    <div class="field"><label for="wDate">Дата</label><input id="wDate" type="date" value="${dv}" min="${today}"></div>
    <div class="field"><label for="wTime">Время</label><input id="wTime" type="time" value="${tv}"></div>
    <div class="row2"><button class="btn" type="button" data-act="when-apply">Показать рейсы</button>
    <button class="btn sec" type="button" data-act="when-now">Сейчас</button></div>`);
}
function applyWhen(){
  const d=$("wDate").value, t=$("wTime").value;
  if(!d||!t){ toast("Выберите дату и время"); return; }
  S.when={date:d,time:t}; S.ride=null; closeModal(); refreshAll(true);
}

let PICK_LIST=[];
function openStopPicker(){
  openModal("Откуда вы едете?",`<div class="row2" style="margin:0 0 10px"><button class="btn" type="button" data-act="locate-close">${svg("plane")}Определить меня</button><button class="btn sec" type="button" data-act="manual-close">${svg("pin")}Выбрать на карте</button></div><label class="search" style="margin:0 0 4px;background:var(--raised)">${svg("search")}<input id="stopQ" type="search" placeholder="Название остановки" autocomplete="off"></label><ul class="stoplist" id="stopList"></ul>`,()=>{
    renderStopList(""); const i=$("stopQ"); i.addEventListener("input",()=>renderStopList(i.value)); if(!desktop()) setTimeout(()=>i.focus(),80);
  });
}
function renderStopList(q){
  q=q.trim().toLowerCase();
  let list=[...SERVED[S.dest][S.dir]].map(n=>({n,d:S.user&&hasXY(stopByName[n])?haversine(S.user,stopByName[n]):null}));
  if(q) list=list.filter(x=>x.n.toLowerCase().includes(q));
  { const seen=new Set(); list=list.filter(x=>{ const t=stopByName[x.n]; if(!t||t.twin==null) return true; if(seen.has(t.twin)) return false; seen.add(t.twin); return true; }); }
  list.sort((a,b)=> (a.d!=null&&b.d!=null) ? a.d-b.d : (a.d==null&&b.d!=null) ? 1 : (a.d!=null&&b.d==null) ? -1 : a.n.localeCompare(b.n,"ru"));
  PICK_LIST=list;
  $("stopList").innerHTML = list.length ? list.map((x,i)=>`<li><button type="button" data-act="pick" data-i="${i}">
    <span class="n">${esc(lab(x.n))}</span><span class="d">${x.d!=null&&!(S.locWarn==="far")?fmtDist(x.d):""}</span>
    <span class="r">${[...(ROUTES_AT[x.n]||[])].sort().map(r=>`<span class="badge b${r}">${r}</span>`).join("")}</span></button></li>`).join("") : `<li class="empty">Не найдено</li>`;
}

/* ============================================================
   Геолокация: только датчики устройства (GPS / Wi-Fi / сотовая сеть), без IP
   ============================================================ */
const LOC = {watch:null, lastT:0, lastP:null};
function regionCenter(){ const b=CFG.searchBounds; return {lat:(b[0][0]+b[1][0])/2, lon:(b[0][1]+b[1][1])/2}; }
function onPos(pos,first){
  if(S.user && S.user.manual) return;
  const u={lat:pos.coords.latitude, lon:pos.coords.longitude, acc:pos.coords.accuracy||0};
  const now=Date.now();
  if(!first && LOC.lastP && haversine(LOC.lastP,u)<8 && now-LOC.lastT<4000) return;
  LOC.lastP=u; LOC.lastT=now;
  const hadFix=!!S.user;
  S.locating=false; S.locErr=null; S.user=u;
  S.locWarn = haversine(u,regionCenter())>150000 ? "far" : (u.acc>1500 ? "coarse" : null);
  const before=S.stop; autoPickStop();
  renderTop(); renderSheet();
  drawMap({fit: (!hadFix || before!==S.stop) ? "local" : null});
}
function onErr(err){
  S.locating=false;
  S.locErr = err.code===1?"denied":err.code===3?"timeout":"unavailable";
  renderTop(); renderSheet();
}
function startLocate(){
  if(!navigator.geolocation){ S.locErr="unsupported"; renderSheet(); return; }
  if(S.user&&S.user.manual){ S.user=null; S.locWarn=null; }
  S.locating=true; S.locErr=null; S.picking=false; S.view="nearby"; S.stopManual=false; renderSheet();
  navigator.geolocation.getCurrentPosition(p=>onPos(p,true),onErr,{enableHighAccuracy:true,timeout:15000,maximumAge:0});
  stopWatch();
  LOC.watch=navigator.geolocation.watchPosition(p=>onPos(p,false),()=>{}, {enableHighAccuracy:true,maximumAge:10000,timeout:30000});
}
function stopWatch(){ if(LOC.watch!=null&&navigator.geolocation){ navigator.geolocation.clearWatch(LOC.watch); } LOC.watch=null; }
document.addEventListener("visibilitychange",()=>{
  if(document.hidden) stopWatch();
  else if(S.user && !S.user.manual && LOC.watch==null && navigator.geolocation)
    LOC.watch=navigator.geolocation.watchPosition(p=>onPos(p,false),()=>{}, {enableHighAccuracy:true,maximumAge:10000,timeout:30000});
});
/* пин стоит по центру карты: двигаете карту — двигается и точка «я здесь» */
function pinPoint(){ const q=MAP.pad(),sz=MAP.map.getSize(); return [(q.tl[0]+sz.x-q.br[0])/2,(q.tl[1]+sz.y-q.br[1])/2]; }
function placePin(){
  let pb=$("pinbar"); if(!pb&&S.pinMode){ pb=document.createElement("button"); pb.id="pinbar"; pb.type="button"; pb.className="pinbar"; pb.dataset.act="pin-done"; pb.textContent="Выбрать"; $("mapView").appendChild(pb); }
  if(pb) pb.hidden=!S.pinMode; $("mapView").classList.toggle("pinmode",!!S.pinMode);
  let cp=$("cpin"); if(!cp){ if(!S.pinMode||!MAP.ready) return; cp=document.createElement("div"); cp.id="cpin"; cp.className="cpin"; cp.innerHTML="<i></i>"; $("map").appendChild(cp); }
  cp.hidden=!S.pinMode; if(!S.pinMode||!MAP.ready) return;
  const [x,y]=pinPoint(); cp.style.left=x+"px"; cp.style.top=y+"px";
}
function pinSync(){ const ll=MAP.map.containerPointToLatLng(pinPoint()); setManual({lat:ll.lat,lng:ll.lng},true); }
function startManual(){
  stopWatch(); setTab("map"); setSheet("peek"); S.pinMode=false; S.view="nearby";
  const c=S.user?{lat:S.user.lat,lng:S.user.lon}:(MAP.ready?MAP.map.getCenter():{lat:regionCenter().lat,lng:regionCenter().lon});
  setManual({lat:c.lat,lng:c.lng},true);
  if(MAP.ready){ const q=MAP.pad(); MAP.map.setView([c.lat,c.lng],Math.max(MAP.map.getZoom(),16),{animate:false}); MAP.map.panBy([-(q.tl[0]-q.br[0])/2,-(q.tl[1]-q.br[1])/2],{animate:false}); }
  S.pinMode=true; placePin(); pinSync(); renderTop();
}
function setManual(ll,quiet){
  S.picking=false; S.user={lat:ll.lat,lon:ll.lng,acc:0,manual:true}; S.locWarn=null; S.locErr=null; S.locating=false;
  S.stopManual=false; autoPickStop(); store.set("bus.stopManual",S.stopManual);
  if(!quiet) setSheet("half");
  renderTop(); renderSheet(); drawMap({fit:quiet?null:"local"});
}

/* ============================================================
   Шторка: размеры и перетаскивание
   ============================================================ */
function autoH(){
  const sh=$("sheet"), prev=sh.dataset.state; if(prev==="peek") sh.dataset.state="half";
  const body=sh.querySelector(".body"), H=$("mapView").clientHeight||600; let h=0;
  for(const c of sh.children) h+= c===body ? body.scrollHeight : c.offsetHeight;
  sh.dataset.state=prev; return Math.max(260,Math.min(H-122,h+6));
}
function sheetHeights(){ const a=autoH(); return {peek:236, half:a, full:a}; }
function setSheet(state){
  if(desktop()) state="half";
  S.sheet=state; const el=$("sheet"); el.dataset.state=state;
  if(!desktop()){ $("mapView").style.setProperty("--sheet-h", sheetHeights()[state]+"px"); }
  else $("mapView").style.removeProperty("--sheet-h");
}
(function initDrag(){
  const drag=$("drag"), sheet=$("sheet"), mv=$("mapView");
  let sy=0, sh=0, active=false, moved=false, lastY=0, lastT=0, vel=0;
  const move=e=>{
    if(!active) return;
    const dy=sy-e.clientY;
    if(!moved && Math.abs(dy)>7){ moved=true; sheet.classList.add("dragging"); }
    if(!moved) return;
    const H=sheetHeights(), h=Math.max(H.peek-30,Math.min(H.full,sh+dy));
    mv.style.setProperty("--sheet-h",h+"px");
    const now=performance.now(); vel=(lastY-e.clientY)/Math.max(1,now-lastT); lastY=e.clientY; lastT=now;
  };
  const end=()=>{
    window.removeEventListener("pointermove",move); window.removeEventListener("pointerup",end); window.removeEventListener("pointercancel",end);
    if(!active) return; active=false;
    if(!moved) return;
    sheet.classList.remove("dragging");
    const H=sheetHeights(), cur=sheet.offsetHeight, proj=cur+Math.max(-600,Math.min(600,vel*180));
    let best="half", bd=1e9;
    for(const k of ["peek","half","full"]){ const d=Math.abs(H[k]-proj); if(d<bd){bd=d;best=k;} }
    setSheet(best); drawMapSoon();
    // после перетаскивания не считаем это нажатием на ручку
    const swallow=ev=>{ ev.stopPropagation(); ev.preventDefault(); };
    window.addEventListener("click",swallow,{capture:true,once:true});
    setTimeout(()=>window.removeEventListener("click",swallow,{capture:true}),350);
  };
  drag.addEventListener("pointerdown",e=>{
    if(desktop()||e.button>0) return;
    sy=lastY=e.clientY; sh=sheet.offsetHeight; moved=false; active=true; lastT=performance.now(); vel=0;
    window.addEventListener("pointermove",move); window.addEventListener("pointerup",end); window.addEventListener("pointercancel",end);
  });
  window.addEventListener("resize",()=>{ setSheet(S.sheet); MAP.map&&MAP.map.invalidateSize(); });
})();
let _dms; function drawMapSoon(){ clearTimeout(_dms); _dms=setTimeout(()=>{ MAP.map&&MAP.map.invalidateSize(); },280); }

/* ============================================================
   Карта (Leaflet + OpenStreetMap)
   ============================================================ */
const GEOM = Object.assign({}, D.geom||{}, EDIT ? store.get("bus.geom.v1",{}) : {});
const pairKey = (a,b) => a+"→"+b;
const MAP = {
  ready:false, map:null, g:{},
  load(){
    if(!window.L){ toast("Не удалось загрузить карту: нет папки vendor/leaflet",8000); return; }
    try{
      const map=this.map=L.map("map",{zoomControl:false,attributionControl:false,zoomSnap:.5,minZoom:8,maxZoom:18,inertia:true,inertiaDeceleration:1700,inertiaMaxSpeed:2800,easeLinearity:.18,wheelDebounceTime:30,wheelPxPerZoomLevel:100,bounceAtZoomLimits:false,
        maxBounds:L.latLngBounds(CFG.searchBounds).pad(.6),maxBoundsViscosity:.8}).setView([55.83,38.35],10);
      L.tileLayer(CFG.tileUrl,{maxZoom:19,detectRetina:true,updateWhenIdle:false,keepBuffer:4}).addTo(map);
      for(const k of ["route","stops","walk","pins","user"]) this.g[k]=L.layerGroup().addTo(map);
      this.ready=true;
      if(EDIT||CFG.geocodeMissing){ const c=store.get("bus.coords.v1",{}); for(const s of D.stops) if(!hasXY(s)&&c[s.name]) Object.assign(s,c[s.name]); }
      map.on("click",e=>{
        if(S.picking){ setManual(e.latlng); return; }
        if(EDIT&&S.editPick){ const s=stopByName[S.editPick]; if(s){ s.lat=e.latlng.lat; s.lon=e.latlng.lng; s.auto=false;
          const c=store.get("bus.coords.v1",{}); c[s.name]={lat:s.lat,lon:s.lon}; store.set("bus.coords.v1",c); toast(`«${s.name}» поставлена`,3000); S.editPick=null; renderEdit(); drawMap(); } }
      });
    }catch(e){ console.error(e); toast("Карта не запустилась: "+(e.message||e),8000); }
  },
  pad(){
    if(desktop()) return {tl:[464,96],br:[28,28]};
    const h=sheetHeights()[S.sheet];
    return {tl:[24,90],br:[24,h+24]};
  },
  fit(points,maxZoom=17){
    if(!this.ready||!points.length) return;
    const p=this.pad();
    if(points.length===1){ this.map.setView(points[0],Math.min(maxZoom,16),{animate:false}); this.map.panBy([0,Math.round((p.br[1]-p.tl[1])/2)],{animate:false}); return; }
    this.map.fitBounds(L.latLngBounds(points),{paddingTopLeft:p.tl,paddingBottomRight:p.br,maxZoom,animate:false});
  }
};
function ridePoints(r){
  const pts=[];
  r.legs.forEach(leg=>{
    for(let k=leg.i;k<leg.j;k++){
      const a=leg.trip.stops[k].stop, b=leg.trip.stops[k+1].stop; if(a===b) continue;
      const A=stopByName[a], B=stopByName[b]; if(!hasXY(A)||!hasXY(B)) continue;
      const g=GEOM[pairKey(a,b)];
      pts.push({pts:g||[[A.lat,A.lon],[B.lat,B.lon]],road:!!g});
    }
  });
  return pts;
}
function stopMarker(s,o){
  const acc=cssVar("--acc"), card=cssVar("--card"), ink=cssVar("--ink");
  let m;
  if(EDIT){
    m=L.marker([s.lat,s.lon],{draggable:true,icon:L.divIcon({className:"editdot",html:"<i></i>",iconSize:[22,22]}),title:s.name});
    m.on("dragend",()=>{ const c=m.getLatLng(); s.lat=c.lat; s.lon=c.lng; s.auto=false;
      const cache=store.get("bus.coords.v1",{}); cache[s.name]={lat:c.lat,lon:c.lng}; store.set("bus.coords.v1",cache); renderEdit(); });
  }else{
    m=L.circleMarker([s.lat,s.lon],o.sel?{radius:11,weight:4,color:card,fillColor:acc,fillOpacity:1}
       : o.path?{radius:5,weight:2,color:card,fillColor:acc,fillOpacity:1}
       : {radius:7,weight:3,color:acc,fillColor:card,fillOpacity:1});
    m.on("click",()=>selectStop(s.name,true));
  }
  m.bindTooltip(esc(lab(s.name)),{direction:"top",offset:[0,o.sel?-10:-6],permanent:!!o.sel,className:"lbl"});
  return m;
}
function drawMap(opts={}){
  if(!MAP.ready) return;
  if(!MAP._mv){ MAP._mv=1; MAP.map.on("moveend",()=>{ if(S.pinMode) pinSync(); }); window.addEventListener("resize",placePin); }
  placePin();
  Object.values(MAP.g).forEach(l=>l.clearLayers());
  const acc=cssVar("--acc"), casing=cssVar("--casing"), mute=cssVar("--mute"), you=cssVar("--you");
  const nb=!EDIT&&S.user&&(S.pinMode||S.view==="nearby"), NB=nb?new Set(nearbyList().map(x=>x.name)):null;
  const plan=(EDIT||nb)?null:upcomingPlan(), sel=plan?pickRide(plan).sel:null;
  const pathStops=new Set();
  let routePts=[];
  if(sel){
    const lines=sel.legs.length?ridePoints(sel):[];
    for(const ln of lines){
      MAP.g.route.addLayer(L.polyline(ln.pts,{color:casing,weight:10,opacity:.95,lineCap:"round",lineJoin:"round",interactive:false}));
      MAP.g.route.addLayer(L.polyline(ln.pts,{color:S.dest===RC?cssVar("--rc"):acc,weight:5,opacity:1,lineCap:"round",lineJoin:"round",dashArray:ln.road?null:"1 10",interactive:false}));
      routePts=routePts.concat(ln.pts);
    }
    sel.legs.forEach(leg=>{ for(let k=leg.i;k<=leg.j;k++) pathStops.add(leg.trip.stops[k].stop); });
  }
  /* остановки */
  const served=SERVED[S.dest][S.dir];
  for(const s of D.stops){
    if(!hasXY(s)) continue;
    if(!EDIT){ if(DESTS.includes(s.name)) continue; if(!served.has(s.name)&&s.name!==S.stop) continue; if(nb&&!NB.has(s.name)) continue; if(pathStops.size&&!pathStops.has(s.name)&&s.name!==S.stop) continue;
      if(s.twin!=null&&s.name!==S.stop){ const c=twinsOf(s.name).filter(x=>served.has(x)); if(c.length>1&&c[0]!==s.name) continue; } }
    MAP.g.stops.addLayer(stopMarker(s,{sel:s.name===S.stop,path:pathStops.has(s.name)}));
  }
  /* МПЗ и РЦ */
  if(!EDIT) for(const d of DESTS){
    const s=stopByName[d]; if(!hasXY(s)) continue;
    const mk=L.marker([s.lat,s.lon],{icon:L.divIcon({className:"pin"+(S.dest===d?" act":"")+(S.stop===d?" sel":""),html:`<span>${SHORT[d]}</span>`,iconSize:[S.dest===d?64:54,34],iconAnchor:[S.dest===d?32:27,17]}),zIndexOffset:1000,title:d});
    mk.on("click",()=>setDest(d)); MAP.g.pins.addLayer(mk);
  }
  /* я и путь пешком */
  const st=stopByName[S.stop];
  if(S.user){
    MAP.g.user.addLayer(L.circle([S.user.lat,S.user.lon],{radius:Math.max(8,Math.min(S.user.acc||0,800)),color:you,weight:1,opacity:.5,fillColor:you,fillOpacity:.12,interactive:false}));
    if(S.user.manual){ if(!S.pinMode) MAP.g.user.addLayer(L.marker([S.user.lat,S.user.lon],{icon:L.divIcon({className:"youpin",html:"<i></i>",iconSize:[26,26],iconAnchor:[13,36]}),interactive:false,zIndexOffset:2000})); }
    else MAP.g.user.addLayer(L.circleMarker([S.user.lat,S.user.lon],{radius:9,color:"#fff",weight:3,fillColor:you,fillOpacity:1,interactive:false}));
    if(!EDIT && !nb && hasXY(st) && S.locWarn!=="far") MAP.g.walk.addLayer(L.polyline([[S.user.lat,S.user.lon],[st.lat,st.lon]],{color:mute,weight:3,dashArray:"2 8",lineCap:"round",interactive:false}));
  }
  /* вид */
  if(opts.fit==="local"){
    const pts=[]; if(S.user&&S.locWarn!=="far") pts.push([S.user.lat,S.user.lon]); if(nb) nearbyList().slice(0,4).forEach(x=>{ const t=stopByName[x.name]; pts.push([t.lat,t.lon]); }); else if(hasXY(st)) pts.push([st.lat,st.lon]);
    if(!pts.length) DESTS.forEach(d=>hasXY(stopByName[d])&&pts.push([stopByName[d].lat,stopByName[d].lon]));
    MAP.fit(pts,17);
  }else if(opts.fit==="route"){
    const pts=routePts.slice(); if(S.user&&S.locWarn!=="far") pts.push([S.user.lat,S.user.lon]);
    if(opts.soft&&pts.length&&MAP.ready){ const q=MAP.pad(),sz=MAP.map.getSize();
      const vis=ll=>{ const c=MAP.map.latLngToContainerPoint(ll); return c.x>=q.tl[0]&&c.y>=q.tl[1]&&c.x<=sz.x-q.br[0]&&c.y<=sz.y-q.br[1]; };
      if(pts.every(vis)) return; }
    MAP.fit(pts.length?pts:[],opts.soft&&MAP.ready?Math.min(15,MAP.map.getZoom()):15);
  }else if(opts.fit==="all"){
    const pts=D.stops.filter(hasXY).map(s=>[s.lat,s.lon]); MAP.fit(pts,13);
  }
}

/* ============================================================
   Действия
   ============================================================ */
function refreshAll(fit){
  autoPickStop(); renderTop(); renderSheet(); if(S.tab==="sched") renderSched();
  drawMap(fit?{fit:"local"}:{});
}
function setDest(d){
  if(S.dest===d) return;
  S.dest=d; store.set("bus.dest",d); S.ride=null; if(S.stop&&!DESTS.includes(S.stop)) S.stop=resolveStop(S.stop);
  if(S.stop===d){ S.stop=null; S.stopManual=false; }
  autoPickStop(); renderTop(); renderSheet(); drawMap({fit:"local"});
}
function selectStop(name,fromMap){
  if(!stopByName[name]) return;
  if(DESTS.includes(name) && name===S.dest) return;
  name=resolveStop(name);
  S.view="route"; S.stop=name; S.stopManual=true; S.ride=null; store.set("bus.stop",name); store.set("bus.stopManual",true);
  if(fromMap && S.sheet==="peek") setSheet("half");
  renderSheet(); drawMap({fit:"local"}); $("sheetBody").scrollTop=0;
}

document.addEventListener("click",e=>{
  const el=e.target.closest("[data-act]"); if(!el) return;
  const act=el.dataset.act, v=el.dataset.v;
  if(act==="modal-bg"){ if(e.target===el) closeModal(); return; }
  switch(act){
    case "tab": setTab(v); break;
    case "dest": setDest(v); break;
    case "dir": case "swap": { const nv=act==="swap"?(S.dir==="to"?"from":"to"):v; if(S.dir!==nv){ S.dir=nv; S.ride=null; if(S.stop&&!DESTS.includes(S.stop)) S.stop=resolveStop(S.stop); if(S.stop&&!S.stopManual) autoPickStop(); renderTop(); renderSheet(); drawMap({fit:"local"}); } break; }
    case "pin-done": S.pinMode=false; S.view="nearby"; placePin(); if(!desktop()) setSheet("half"); renderTop(); renderSheet(); drawMap({}); break;
    case "nearby": if(S.user&&S.locWarn!=="far"){ S.view="nearby"; renderSheet(); drawMap({fit:"local"}); } else openStopPicker(); break;
    case "pick-near": { const x=NEAR[+el.dataset.i]; if(x){ selectStop(x.name); if(!desktop()&&S.sheet==="peek") setSheet("half"); } break; }
    case "toggle-dest": setDest(S.dest===ENT?RC:ENT); break;
    case "zoom": if(MAP.ready){ +v>0?MAP.map.zoomIn(1):MAP.map.zoomOut(1); } break;
    case "locate-close": closeModal(); setTab("map"); startLocate(); break;
    case "manual-close": closeModal(); startManual(); break;
    case "mode": S.mode=v; store.set("bus.mode",v); renderSheet(); break;
    case "ride": S.ride=+el.dataset.i; renderSheet(); drawMap({fit:"route",soft:true}); $("sheetBody").scrollTop=0; break;
    case "grab": if(!desktop()) setSheet(S.sheet==="peek"?"half":"peek"); break;
    case "pick-stop": openStopPicker(); break;
    case "pick": { const x=PICK_LIST[+el.dataset.i]; if(x){ closeModal(); selectStop(x.n); if(S.sheet==="peek") setSheet("half"); } break; }
    case "nearest": { const n=nearestStop(); if(n){ S.stopManual=false; store.set("bus.stopManual",false); S.stop=n.name; S.ride=null; store.set("bus.stop",n.name); renderSheet(); drawMap({fit:"local"}); } break; }
    case "locate": setTab("map"); startLocate(); break;
    case "manual": startManual(); break;
    case "open-when": openWhen(); break;
    case "when-day": $("wDate").value=v; break;
    case "when-apply": applyWhen(); break;
    case "when-now": S.when=null; S.ride=null; closeModal(); refreshAll(true); break;
    case "close-modal": closeModal(); break;
    case "theme": S.theme=S.theme==="auto"?"light":S.theme==="light"?"dark":"auto"; store.set("bus.theme",S.theme); applyTheme(); toast("Тема: "+({auto:"как в системе",light:"светлая",dark:"тёмная"})[S.theme],1800); break;
    case "sroute": S.schedRoute=v; renderSchedHead(); renderSchedList(); break;
    case "sday": S.schedDay=v||null; renderSchedHead(); renderSchedList(); break;
    case "trip": { const id=el.dataset.id; S.open.has(id)?S.open.delete(id):S.open.add(id); renderSchedList(); break; }
    case "goto-stop": {
      const name=D.stops[+el.dataset.si].name;
      if(name===S.dest) S.dest=DESTS.find(d=>d!==S.dest);
      store.set("bus.dest",S.dest); S.stop=name; S.stopManual=true; S.ride=null; store.set("bus.stop",name); store.set("bus.stopManual",true);
      setTab("map"); setSheet("half"); renderTop(); renderSheet(); setTimeout(()=>drawMap({fit:"local"}),60); break; }
    case "edit-pick": S.editPick=el.dataset.name; toast(`Нажмите на карте, где «${el.dataset.name}»`,5000); break;
  }
});
document.addEventListener("input",e=>{ if(e.target.id==="schedQ"){ S.q=e.target.value; renderSchedList(); } });

function applyTheme(){
  document.documentElement.dataset.theme=S.theme;
  if(MAP.ready) drawMap();
}
matchMedia("(prefers-color-scheme:dark)").addEventListener?.("change",()=>{ if(S.theme==="auto") drawMap(); });

/* ============================================================
   Режим администратора (index.html?edit=1)
   ============================================================ */
function simplify(pts,tolM){
  if(pts.length<3) return pts;
  const k=Math.cos(pts[0][0]*Math.PI/180), P=pts.map(p=>[p[1]*111320*k,p[0]*110540]);
  const keep=new Uint8Array(P.length); keep[0]=keep[P.length-1]=1; const st=[[0,P.length-1]];
  while(st.length){
    const [a,b]=st.pop(); let md=0,mi=-1; const dx=P[b][0]-P[a][0], dy=P[b][1]-P[a][1], l2=dx*dx+dy*dy;
    for(let i=a+1;i<b;i++){ let t=l2?((P[i][0]-P[a][0])*dx+(P[i][1]-P[a][1])*dy)/l2:0; t=Math.max(0,Math.min(1,t));
      const d=Math.hypot(P[i][0]-(P[a][0]+t*dx),P[i][1]-(P[a][1]+t*dy)); if(d>md){md=d;mi=i;} }
    if(md>tolM){ keep[mi]=1; st.push([a,mi],[mi,b]); }
  }
  return pts.filter((_,i)=>keep[i]);
}
async function geocodeOne(s){
  const b=CFG.searchBounds;
  if(CFG.geocoderKey){
    try{
      const url="https://geocode-maps.yandex.ru/1.x/?format=json&results=1&lang=ru_RU&rspn=0&apikey="+encodeURIComponent(CFG.geocoderKey)+"&geocode="+encodeURIComponent(s.query)+"&bbox="+b[0][1]+","+b[0][0]+"~"+b[1][1]+","+b[1][0];
      const r=await fetch(url); if(!r.ok) throw new Error("HTTP "+r.status);
      const m=(await r.json()).response.GeoObjectCollection.featureMember[0];
      if(m){ const [lon,lat]=m.GeoObject.Point.pos.split(" ").map(Number); return {lat,lon}; }
    }catch(e){ console.warn("Яндекс-геокодер:",e.message); }
  }
  await new Promise(r=>setTimeout(r,1100));
  const r=await fetch("https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=ru&q="+encodeURIComponent(s.query)+"&viewbox="+b[0][1]+","+b[1][0]+","+b[1][1]+","+b[0][0]);
  if(!r.ok) return null; const j=await r.json(); return j[0]?{lat:+j[0].lat,lon:+j[0].lon}:null;
}
async function geocodeMissing(cb){
  const cache=store.get("bus.coords.v1",{}), todo=D.stops.filter(s=>!hasXY(s)); let n=0;
  for(const s of todo){
    try{ const c=await geocodeOne(s); if(c&&c.lat>CFG.searchBounds[0][0]-1&&c.lat<CFG.searchBounds[1][0]+1&&c.lon>CFG.searchBounds[0][1]-2&&c.lon<CFG.searchBounds[1][1]+2){ s.lat=c.lat; s.lon=c.lon; s.auto=true; cache[s.name]={lat:c.lat,lon:c.lon}; } }
    catch(e){ console.warn("geocode",s.name,e); }
    cb&&cb(++n,todo.length); store.set("bus.coords.v1",cache);
  }
}
async function buildRoadGeometry(cb){
  const pairs=new Set();
  for(const t of D.trips) for(let i=0;i<t.stops.length-1;i++){ const a=t.stops[i].stop,b=t.stops[i+1].stop;
    if(a!==b&&hasXY(stopByName[a])&&hasXY(stopByName[b])&&!GEOM[pairKey(a,b)]) pairs.add(pairKey(a,b)); }
  const list=[...pairs]; let n=0, fail=0;
  for(const key of list){
    const [a,b]=key.split("→"), A=stopByName[a], B=stopByName[b];
    try{
      const j=await (await fetch(`https://router.project-osrm.org/route/v1/driving/${A.lon},${A.lat};${B.lon},${B.lat}?overview=full&geometries=geojson`)).json();
      if(j.code==="Ok") GEOM[key]=simplify(j.routes[0].geometry.coordinates.map(c=>[+c[1].toFixed(5),+c[0].toFixed(5)]),4); else fail++;
    }catch(e){ fail++; }
    cb&&cb(++n,list.length,fail); await new Promise(r=>setTimeout(r,400));
  }
  store.set("bus.geom.v1",GEOM); return {total:list.length,fail};
}
let EDIT_STATUS="";
function renderEdit(){
  const body=$("sheetBody"); if(!body) return;
  const miss=D.stops.filter(s=>!hasXY(s)), auto=D.stops.filter(s=>s.auto);
  body.innerHTML=`<p class="sub mute">Координаты: ${D.stops.length-miss.length} из ${D.stops.length}${auto.length?`, найдено автоматически (проверьте): ${auto.length}`:""}. Линий по дорогам: ${Object.keys(GEOM).length}.</p>
    <div class="row2" style="margin:10px 0">
      <button class="btn sec" type="button" id="geoBtn">1. Найти координаты</button>
      <button class="btn sec" type="button" id="roadBtn">3. Построить линии по дорогам</button>
      <button class="btn sec" type="button" id="copyBtn">4a. Копировать координаты</button>
      <button class="btn sec" type="button" id="copyGeoBtn">4b. Копировать линии</button></div>
    <p class="notice" id="editStatus" role="status">${esc(EDIT_STATUS||"Перетащите метки на карте, если они стоят неточно.")}</p>
    ${miss.length?`<div class="notice warn"><b>Без координат — нажмите и затем кликните по карте:</b>${miss.map(s=>`<button class="btn sec" type="button" data-act="edit-pick" data-name="${esc(s.name)}">${esc(s.name)}</button>`).join("")}</div>`:""}`;
  const st=t=>{ EDIT_STATUS=t; const e=$("editStatus"); if(e) e.textContent=t; };
  $("geoBtn").onclick=async()=>{ $("geoBtn").disabled=true; await geocodeMissing((i,n)=>st(`Ищу координаты: ${i} из ${n}`)); st("Готово. Проверьте метки на карте."); drawMap({fit:"all"}); renderEdit(); };
  $("roadBtn").onclick=async()=>{ $("roadBtn").disabled=true; const r=await buildRoadGeometry((i,n,f)=>st(`Строю линии: ${i} из ${n}${f?`, не удалось: ${f}`:""}`)); st(`Готово: ${r.total-r.fail} из ${r.total}.`); renderEdit(); };
  const copy=async(o,l)=>{ const t=JSON.stringify(o); try{ await navigator.clipboard.writeText(t); toast(l+" скопированы",4000); }catch(e){ prompt("Скопируйте текст целиком:",t); } };
  $("copyBtn").onclick=()=>{ const o={}; D.stops.filter(hasXY).forEach(s=>o[s.name]={lat:+s.lat.toFixed(6),lon:+s.lon.toFixed(6)}); copy(o,"Координаты"); };
  $("copyGeoBtn").onclick=()=>copy(GEOM,"Линии");
}

/* ============================================================
   Старт
   ============================================================ */
applyTheme();
renderTop();
MAP.load();
if(EDIT){ S.sheet="half"; }
setSheet(S.sheet);
renderSheet();
if(MAP.ready) drawMap({fit:EDIT?"all":"local"});
if(!EDIT && navigator.permissions && navigator.permissions.query){
  navigator.permissions.query({name:"geolocation"}).then(p=>{
    if(p.state==="granted") startLocate();
    else if(p.state==="denied"){ S.locErr="denied"; renderSheet(); }
  }).catch(()=>{});
}
["gesturestart","gesturechange"].forEach(t=>document.addEventListener(t,e=>e.preventDefault()));
{ const _rs=renderSheet; renderSheet=function(){ _rs.apply(this,arguments); if(!desktop()&&S.sheet!=="peek"&&!S.pinMode) setSheet(S.sheet); }; }
document.addEventListener("toggle",e=>{ const d=e.target; if(d&&d.matches&&d.matches("details.path")){ S.pathOpen=d.open?d.dataset.pk:null; if(!desktop()&&S.sheet!=="peek") setSheet(S.sheet); } },true);
function softRender(){
  const b=$("sheetBody"), top=b.scrollTop, det=b.querySelector("details.path"), wasOpen=det&&det.open;
  renderSheet(); b.scrollTop=top; const d2=b.querySelector("details.path"); if(d2&&wasOpen) d2.open=true;
}
setInterval(()=>{ if(S.tab==="map" && !S.when && !EDIT) softRender(); if(S.tab==="sched" && !S.when) renderSchedList(); renderTop(); },30000);
