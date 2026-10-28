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
  pin:'<path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z"/>',
  eye:'<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.8"/>',
  edit:'<path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"/>'
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
  ride:null, mode:store.get("bus.mode","walk"), user:null, locating:false, locErr:null, locWarn:null, picking:false,
  when:null, sheet:"half", theme:store.get("bus.theme","auto"),
  schedCity:"all", schedDay:null, q:"", open:new Set(), editPick:null, showAll:false
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

/* Соседние остановки (другая сторона дороги, ≤130 м): рейсы с них тоже предлагаем, с учётом перехода дороги */
const CROSS_M = 130;
const SIBLINGS = {};
for(const a of D.stops){
  if(!hasXY(a)||DESTS.includes(a.name)) continue;
  SIBLINGS[a.name]=D.stops.filter(b=>b!==a&&hasXY(b)&&!DESTS.includes(b.name)&&haversine(a,b)<=CROSS_M)
    .map(b=>{ const d=haversine(a,b); return {name:b.name,d,min:Math.max(2,Math.ceil(d*1.25/80)+1)}; }).sort((x,y)=>x.d-y.d);
}
function planCluster(stop,dir,dest,dk){
  const cands=[{name:stop,min:0,d:0},...(SIBLINGS[stop]||[])], best=new Map();
  for(const c of cands) for(const r of planDay(c.name,dir,dest,dk)){
    best.set(r.trip.id+"|"+c.name,{...r,board:c.name,cross:c.min,crossD:c.d});
  }
  return [...best.values()].sort((a,b)=>a.key-b.key||a.cross-b.cross);
}
/* во сколько доберёмся: до завода — прибытие, обратно — прибытие + переход дороги */
const effArr = (r,dir) => r.arr ? toMin(r.arr)+(dir==="from"?r.cross:0) : 1e9;

const SERVED = {};
(function(){
  for(const d of DESTS){
    SERVED[d]={to:new Set(),from:new Set()};
    for(const s of D.stops){
      if(s.name===d) continue;
      if(planCluster(s.name,"to",d,"all").length) SERVED[d].to.add(s.name);
      if(planCluster(s.name,"from",d,"all").length) SERVED[d].from.add(s.name);
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
  let i=0, why=null;
  const live=!plan.c.planned && plan.offset===0, d=distToStop();
  const w = d!=null ? (S.mode==="walk"?walkMin(d):carMin(d))+1 : 0;
  const reach = r => S.dir!=="to" || !live || d==null || !r.dep || toMin(r.dep)-w-r.cross>=plan.c.min;
  const cand = plan.rides.map((r,k)=>k).filter(k=>reach(plan.rides[k]));
  if(cand.length){
    const len = r => (r.dep&&r.arr) ? toMin(r.arr)-toMin(r.dep) : 1e9;
    i=cand[0]; if(i>0) why="reach";
    for(const k of cand.slice(1)){
      const a=plan.rides[k], b=plan.rides[i];
      if(effArr(a,S.dir)+5<=effArr(b,S.dir)){ i=k; why="fast"; }
      else if(a.trip.id===b.trip.id && a.board!==b.board && effArr(a,S.dir)<=effArr(b,S.dir)+1 && len(a)+5<=len(b)){ i=k; why="short"; }   // тот же автобус, но без лишней поездки
    }
  }
  return {sel:plan.rides[i],idx:i,auto:true,why};
}
function upcomingPlan(){
  if(!S.stop) return null;
  const c=ctx();
  for(let off=0;off<8;off++){
    const date=new Date(c.date.getFullYear(),c.date.getMonth(),c.date.getDate()+off);
    let rides=planCluster(S.stop,S.dir,S.dest,dkOf(date));
    if(off===0) rides=rides.filter(r=>rideEnd(r)>=c.min);
    if(rides.length) return {rides,offset:off,date,c};
  }
  return {rides:[],offset:0,date:c.date,c};
}

/* ---------- расстояния и время в пути до остановки ---------- */
const walkMin = m => Math.max(1,Math.round(m*1.25/80));
const carMin  = m => Math.max(1,Math.round(m*1.35/450));
function distToStop(){ const s=S.stop&&stopByName[S.stop]; return (S.user&&hasXY(s)) ? haversine(S.user,s) : null; }
function nearestStop(){
  if(!S.user) return null;
  let best=null;
  for(const n of SERVED[S.dest][S.dir]){
    const s=stopByName[n]; if(!hasXY(s)) continue;
    const d=haversine(S.user,s); if(!best||d<best.d) best={name:n,d};
  }
  return best;
}
function autoPickStop(){
  if(S.stopManual || !S.user || S.locWarn==="far") return;
  const n=nearestStop();
  if(n && n.name!==S.stop){ S.stop=n.name; S.ride=null; store.set("bus.stop",S.stop); }
}

/* ============================================================
   Шторка
   ============================================================ */
function stopPill(name){ return name; }
function rideTag(r){ return r.dep ? KIND[r.kind] : "по требованию"; }

function renderSheet(){
  const head=$("sheetHead"), body=$("sheetBody"), foot=$("sheetFoot");
  if(EDIT){ head.innerHTML=`<div class="titlebtn"><div class="t"><h2>Настройка карты</h2><small>Режим администратора</small></div></div>`; foot.hidden=true; renderEdit(); return; }
  foot.hidden=false;
  const plan=upcomingPlan(), dist=distToStop();
  const pr=pickRide(plan), sel=pr.sel;
  /* --- заголовок --- */
  if(!S.stop){
    head.innerHTML=`<button class="titlebtn" type="button" data-act="pick-stop"><span class="t"><h2>Откуда поедете?</h2><small>Выберите остановку, адрес или определите, где вы</small></span><span class="chg">${svg("edit")}Выбрать</span></button>`;
  }else{
    const near=nearestStop(), isNear=near&&near.name===S.stop;
    const sub = dist!=null ? `${isNear&&!S.stopManual?"Ближайшая остановка":"Остановка"} · ${fmtDist(dist)} от вас` : "Остановка";
    let peek="";
    if(sel){
      const cd = (!plan.c.planned && plan.offset===0 && sel.dep) ? " · через "+human(toMin(sel.dep)-plan.c.min) : "";
      peek=`<div class="peekline"><span class="badge b${sel.trip.route}">${sel.trip.route}</span><span>${sel.dep?sel.dep:"по требованию"}${plan.offset>0?" · "+dayWord(plan.date,plan.c.today):""}${esc(cd)}</span></div>`;
    }else peek=`<div class="peekline mute">Рейсов нет</div>`;
    head.innerHTML=`<button class="titlebtn" type="button" data-act="pick-stop"><span class="t"><small class="lab">${S.dir==="to"?"Откуда":"Куда"}</small><h2>${esc(S.stop)}</h2><small>${sub}</small></span><span class="chg">${svg("edit")}Изменить</span></button>${peek}`;
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
  foot.innerHTML=`<div class="seg" role="group" aria-label="Направление">
    <button type="button" data-act="dir" data-v="to" aria-pressed="${S.dir==="to"}">${TO_LABEL[S.dest]}</button>
    <button type="button" data-act="dir" data-v="from" aria-pressed="${S.dir==="from"}">Обратно</button></div>`;
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
  const boardName = to ? sel.board : destName;
  const alightName = to ? destName : sel.board;
  const crossing = sel.board!==stopName;
  const crossTxt = crossing ? `<div class="cross">${svg("swap")}<span>${to?`Перейдите дорогу на остановку «${esc(sel.board)}»`:`Выйдите на «${esc(sel.board)}» и перейдите дорогу к «${esc(stopName)}»`}: ≈${sel.cross} мин, ${fmtDist(sel.crossD)}</span></div>` : "";
  const idx = pr.idx;
  const first = idx===0 && !crossing && !pr.why;

  /* карточка выбранного рейса */
  const live = !c.planned && plan.offset===0 && sel.dep;
  const cd = live ? (toMin(sel.dep)-c.min<=0 ? "сейчас" : "через "+human(toMin(sel.dep)-c.min)) : "";
  const leaveBy = (to && live && dist!=null)
    ? (()=>{ const w0 = S.mode==="walk"?walkMin(dist):carMin(dist), w = w0+sel.cross, left=toMin(sel.dep)-c.min, lb=toMin(sel.dep)-w-1;
        return lb>=c.min ? `<div class="go">${svg(S.mode==="walk"?"walk":"car")}<span>Выйдите до ${fmtMin(lb)}</span></div>`
          : `<div class="go late">${svg("clock")}<span>Не успеете: до остановки ≈${w} мин${sel.cross?" с переходом дороги":""}, до отправления ${human(Math.max(0,left))}</span></div>`; })()
    : "";
  const tt = sel.trip;
  const rideCard = `<div class="ride">
    <div class="lbl">${pr.auto?(pr.why==="short"?"Лучше перейти дорогу — без лишней поездки":pr.why==="fast"?"Быстрее всего доберётесь":first?"Ближайший автобус":pr.why==="reach"?"Ближайший, на который успеете":"Ближайший автобус"):"Выбранный рейс"}${plan.offset>0?" · "+dayWord(plan.date,c.today):""}</div>
    <div class="big"><span class="t">${sel.dep?(sel.kind==="approx"?"≈":"")+sel.dep:"по требованию"}</span><span class="badge b${tt.route}">${tt.route}</span>${cd?`<span class="cd">${cd}</span>`:""}</div>
    <div class="meta">${tt.part==="morning"?"Утренний":"Вечерний"} рейс ${tt.start}–${tt.end} · ${rideTag(sel)}${sel.note?" · "+esc(sel.note):""}${sel.xfer?" · с пересадкой":""}</div>
    ${leaveBy}</div>`;
  /* остальные рейсы мелко */
  const others = plan.rides.map((r,i)=>({r,i})).filter(x=>x.i!==idx);
  const chips = others.length ? `<div class="others"><div class="lbl">${others.length===1?"Ещё один рейс":"Другие рейсы"}</div><div class="chips">${others.map(({r,i})=>
    `<button type="button" class="rchip d${r.trip.route}${r.kind==="approx"?" ap":""}${r.dep?"":" dem"}" data-act="ride" data-i="${i}"><i class="dot"></i>${r.dep?r.dep:"по треб."}${r.board!==stopName?`<span class="x" title="С другой стороны дороги">⇄</span>`:""}<span class="mute" style="font-weight:600">${r.trip.route}</span></button>`).join("")}</div></div>` : "";
  /* остановки в пути */
  const pathItems=[];
  sel.legs.forEach((leg,li)=>{
    if(li>0) pathItems.push(`<li><time></time><span class="dm">пересадка в ${esc(sel.xfer)}</span></li>`);
    for(let k=leg.i;k<=leg.j;k++){
      const s=leg.trip.stops[k];
      pathItems.push(`<li><time class="${s.kind==="approx"?"ap":""}">${s.time?(s.kind==="approx"?"≈":"")+s.time:"—"}</time><span>${esc(s.stop)}${s.time?"":` <span class="dm">· по требованию</span>`}</span></li>`);
    }
  });
  const inBetween = sel.legs.reduce((n,l)=>n+(l.j-l.i-1),0);
  const path = `<details class="path"><summary>Остановки в пути${inBetween>0?` (${inBetween})`:""}</summary><ul class="pathlist">${pathItems.join("")}</ul></details>`;

  const boardNode = `<li class="node"><div class="rail"><div class="ico">${svg("bus")}</div></div><div>
      <h3>${esc(boardName)}</h3><div class="sub">${to?"Посадка":"Отправление от "+(destName===ENT?"завода":"РЦ")}</div>${crossTxt&&to?crossTxt:""}${dayNote}${rideCard}${chips}${path}</div></li>`;

  const dur = (sel.dep&&sel.arr) ? ` · в пути ${human(toMin(sel.arr)-toMin(sel.dep))}` : "";
  const alightNode = `<li class="node${to?"":" dash"}"><div class="rail"><div class="ico plain"></div></div><div>
      <h3>${esc(alightName)}</h3><div class="sub">${sel.arr?`Прибытие в ${sel.arr}${dur}`:"Время прибытия не указано"}</div>${crossTxt&&!to?crossTxt:""}</div></li>`;

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
      <h3>Моё местоположение</h3><div class="sub">${S.user.manual?"указано вручную · точку на карте можно перетащить":"определено по датчикам телефона"}</div>
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
  $("destSeg").innerHTML = DESTS.map(d=>`<button type="button" data-act="dest" data-v="${esc(d)}" aria-pressed="${S.dest===d}">${esc(d)}</button>`).join("");
  const chip=$("whenChip");
  chip.innerHTML=svg("clock")+esc(whenLabel());
  chip.classList.toggle("on",!!S.when);
  $("fabs").innerHTML=`<button class="fab${S.showAll?" on":""}" type="button" data-act="show-all" aria-pressed="${S.showAll}" aria-label="Показать все остановки" title="Все остановки">${svg("eye")}</button>
    <button class="fab" type="button" data-act="fit-route" aria-label="Показать весь маршрут" title="Весь маршрут">${svg("route")}</button>
    <button class="fab${S.user&&!S.user.manual?" on":""}" type="button" data-act="locate" aria-label="Где я" title="Где я">${svg("locate")}</button>`;
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
const CITIES = [["Ногинск",/Ногинск/],["Электросталь",/Электросталь/],["Электроугли",/Электроугли/],["Лосино-Петровский",/Лосино-Петровский/],["Монино",/пос\. Монино/],["Свердловский",/Свердловский/]]
  .filter(([,re])=>D.trips.some(t=>t.stops.some(s=>re.test(s.stop))));
const CITY_RE = Object.fromEntries(CITIES);
function schedInfo(){
  const c=ctx();
  if(S.schedDay==="tom"){ const d=new Date(c.today.getFullYear(),c.today.getMonth(),c.today.getDate()+1); return {dk:dkOf(d),live:false,label:"завтра, "+dateLabel(d)+(dkOf(d)==="sat"?" (суббота)":"")}; }
  if(S.schedDay==="sat") return {dk:"sat",live:false,label:"по субботам"};
  if(S.schedDay==="work") return {dk:"work",live:false,label:"в будни и воскресенье"};
  return {dk:dkOf(c.date),live:sameDay(c.date,c.today),label:dateLabel(c.date)+(dkOf(c.date)==="sat"?" (суббота)":"")};
}
function renderSchedHead(){
  const c=ctx();
  const cities = [["all","Все города"],...CITIES.map(([n])=>[n,n])].map(([k,l])=>`<button class="chip" type="button" data-act="scity" data-v="${esc(k)}" aria-pressed="${S.schedCity===k}">${esc(l)}</button>`).join("");
  const first = S.when ? dateLabel(c.date).replace(/^./,x=>x.toUpperCase()) : "Сегодня";
  const days = [[null,first],["tom","Завтра"],["work","Будни и воскресенье"],["sat","Суббота"]].map(([k,l])=>`<button class="chip" type="button" data-act="sday" data-v="${k||""}" aria-pressed="${S.schedDay===k}">${l}</button>`).join("")
    + `<button class="chip when${S.when?" on":""}" type="button" data-act="open-when">${svg("clock")}${esc(whenLabel())}</button>`;
  $("schedHead").innerHTML=`<div class="row"><h1>Расписание</h1>
    <button class="iconbtn" type="button" data-act="theme" aria-label="Тема оформления" title="Тема: ${({auto:"как в системе",light:"светлая",dark:"тёмная"})[S.theme]}">${svg("theme")}</button></div>
    <div class="hscroll" role="group" aria-label="Город">${cities}</div>
    <div class="hscroll" role="group" aria-label="День и время" style="padding-top:2px">${days}</div>
    <label class="search">${svg("search")}<input id="schedQ" type="search" placeholder="Найти остановку" value="${esc(S.q)}" autocomplete="off"></label>`;
}
function renderSchedList(){
  const {dk,live,label}=schedInfo(), c=ctx(), q=S.q.trim().toLowerCase(), cre=CITY_RE[S.schedCity]||null;
  let trips=tripsFor(dk);
  if(cre) trips=trips.filter(t=>t.stops.some(s=>cre.test(s.stop)));
  if(q) trips=trips.filter(t=>t.stops.some(s=>s.stop.toLowerCase().includes(q)));
  let html=`<div class="dayline">Рейсы ${esc(label)}${cre?" · "+esc(S.schedCity):""}</div>`;
  if(!trips.length) html+=`<div class="empty">Ничего не найдено. Измените город, день или поиск.</div>`;
  const routes=[...new Set(trips.map(t=>t.route))];
  for(const r of routes){
    const ts=trips.filter(t=>t.route===r).sort((a,b)=>toMin(a.start)-toMin(b.start));
    html+=`<div class="rgroup"><span class="badge b${r}">${r}</span><span>${ts.length} ${ts.length===1?"рейс":ts.length<5?"рейса":"рейсов"}</span></div>`;
    for(const t of ts){
      const open=S.open.has(t.id) || (q&&ts.length<=3);
      const past = live && toMin(t.end)<c.min;
      const n=t.stops.filter(s=>s.stop!==ENT).length;
      html+=`<div class="trip${open?" open":""}${past?" past":""}"><button type="button" data-act="trip" data-id="${t.id}" aria-expanded="${open}">
        <span><span class="tt">${t.start} – ${t.end}</span><span class="ts"><span>${t.part==="morning"?"Утро":"Вечер"}</span>${t.rc?`<span class="pill">для сотрудников РЦ</span>`:""}<span>${n} ${n===1?"остановка":n<5?"остановки":"остановок"}</span></span></span>
        <span class="chev">${svg("chev")}</span></button>`;
      if(open){
        html+=`<div class="tbody"><ol class="stline">${t.stops.map(s=>{
          const ent=DESTS.includes(s.stop), hit=(q&&s.stop.toLowerCase().includes(q))||(!q&&cre&&cre.test(s.stop)), dem=!s.time;
          const notes=[]; if(s.time&&s.kind==="exact") notes.push("точное время"); if(s.kind==="rc"&&s.time) notes.push("для сотрудников РЦ"); if(dem) notes.push("при наличии пассажиров"); if(s.note) notes.push(s.note);
          return `<li class="${ent?"ent ":""}${hit?"hit ":""}${dem?"dem":""}"><button type="button" data-act="goto-stop" data-si="${STOP_IDX[s.stop]}">
            <span class="tm ${s.kind==="approx"?"ap":""}${dem?" nn":""}">${dem?"по требо&shy;ванию":(s.kind==="approx"?"≈":"")+s.time}</span><span class="rl"><i></i></span>
            <span class="nm">${NUM[s.stop]?`<b class="sn">${NUM[s.stop]}</b>`:""}${esc(s.stop)}${notes.length?`<em>${esc(notes.join(" · "))}</em>`:""}</span></button></li>`; }).join("")}</ol></div>`;
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
function openModal(title,inner,onOpen,cls=""){
  modalRoot.innerHTML=`<div class="modal ${cls}" data-act="modal-bg"><div class="mcard" role="dialog" aria-modal="true" aria-label="${esc(title)}">
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
  S.when={date:d,time:t}; S.ride=null; S.schedDay=null; closeModal(); refreshAll(true);
}

let PICK_LIST=[], ADDR_RES=[];
function openStopPicker(){
  const to=S.dir==="to";
  openModal(to?"Откуда поедете?":"Куда поедете?",`
    <label class="search" style="margin:0 0 10px;background:var(--raised)">${svg("search")}<input id="stopQ" type="search" placeholder="Остановка или адрес" enterkeyhint="search" autocomplete="off"></label>
    <div class="row2 pickact">
      <button class="btn" type="button" data-act="pick-locate">${svg("locate")}Где я</button>
      <button class="btn sec" type="button" data-act="pick-manual">${svg("pin")}Точка на карте</button></div>
    <div id="addrBox"></div>
    <div class="lbl2" id="stopHint"></div>
    <ul class="stoplist" id="stopList"></ul>`,()=>{
    renderStopList(""); const i=$("stopQ");
    i.addEventListener("input",()=>renderStopList(i.value));
    i.addEventListener("keydown",e=>{ if(e.key==="Enter"){ e.preventDefault(); searchAddress(i.value); } });
    if(desktop()) setTimeout(()=>i.focus(),80);
  },"drawer");
}
function renderStopList(q){
  q=q.trim().toLowerCase();
  let list=[...SERVED[S.dest][S.dir]].map(n=>({n,d:S.user&&hasXY(stopByName[n])?haversine(S.user,stopByName[n]):null}));
  if(q) list=list.filter(x=>x.n.toLowerCase().includes(q));
  list.sort((a,b)=> (a.d!=null&&b.d!=null) ? a.d-b.d : (a.d==null&&b.d!=null) ? 1 : (a.d!=null&&b.d==null) ? -1 : a.n.localeCompare(b.n,"ru"));
  PICK_LIST=list;
  const near = S.user && S.locWarn!=="far";
  $("stopHint").textContent = q ? (list.length?"Остановки":"Остановки не найдены") : (near?"Ближайшие остановки":"Все остановки");
  const addrBtn = q.length>=3 ? `<li><button type="button" class="addrrow" data-act="addr-search">${svg("search")}<span>Найти адрес «${esc(q)}»</span></button></li>` : "";
  $("stopList").innerHTML = addrBtn + (list.length ? list.map((x,i)=>`<li><button type="button" data-act="pick" data-i="${i}">
    <span class="n">${esc(x.n)}</span><span class="d">${x.d!=null&&!(S.locWarn==="far")?fmtDist(x.d):""}</span>
    <span class="r">${[...(ROUTES_AT[x.n]||[])].sort().map(r=>`<span class="badge b${r}">${r}</span>`).join("")}</span></button></li>`).join("") : (q.length<3?`<li class="empty">Не найдено</li>`:""));
}
async function searchAddress(q){
  q=(q||"").trim(); if(q.length<3){ toast("Введите адрес подробнее"); return; }
  const box=$("addrBox"); if(!box) return;
  box.innerHTML=`<div class="notice"><b>Ищем адрес…</b></div>`;
  try{
    const b=CFG.searchBounds;
    const r=await fetch("https://nominatim.openstreetmap.org/search?format=json&limit=6&accept-language=ru&bounded=1&q="+encodeURIComponent(q)+"&viewbox="+b[0][1]+","+b[1][0]+","+b[1][1]+","+b[0][0]);
    if(!r.ok) throw new Error("HTTP "+r.status);
    ADDR_RES=(await r.json()).map(x=>({lat:+x.lat,lon:+x.lon,name:x.display_name.split(", ").slice(0,3).join(", ")}));
    box.innerHTML = ADDR_RES.length
      ? `<div class="lbl2">Адреса</div><ul class="stoplist">${ADDR_RES.map((a,i)=>`<li><button type="button" class="addrrow" data-act="addr-pick" data-i="${i}">${svg("pin")}<span>${esc(a.name)}</span></button></li>`).join("")}</ul>`
      : `<div class="notice warn"><b>Адрес не найден</b><span>Уточните запрос (улица, дом, город) или укажите точку на карте.</span></div>`;
  }catch(e){
    box.innerHTML=`<div class="notice warn"><b>Не удалось найти адрес</b><span>Проверьте подключение или укажите точку на карте.</span></div>`;
  }
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
  S.locating=true; S.locErr=null; S.picking=false; renderSheet();
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
function startManual(){
  S.picking=true; stopWatch(); setTab("map"); setSheet("peek");
  toast("Нажмите на карте там, где вы находитесь",6000);
}
function setManual(ll){
  S.picking=false; S.user={lat:ll.lat,lon:ll.lng,acc:0,manual:true}; S.locWarn=null; S.locErr=null; S.locating=false;
  S.stopManual=false; const before=S.stop; autoPickStop(); store.set("bus.stopManual",S.stopManual);
  setSheet("half"); renderTop(); renderSheet(); drawMap({fit:"local"});
  if(before===S.stop) {}
}

/* ============================================================
   Шторка: размеры и перетаскивание
   ============================================================ */
function sheetHeights(){ const H=$("mapView").clientHeight||600; return {peek:204, half:Math.round(H*.52), full:H-122}; }
function setSheet(state){
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
      const map=this.map=L.map("map",{zoomControl:false,attributionControl:false,zoomSnap:.5,minZoom:8,maxZoom:18,
        maxBounds:L.latLngBounds(CFG.searchBounds).pad(.6),maxBoundsViscosity:.8}).setView([55.83,38.35],10);
      L.control.zoom({position:"topleft",zoomInTitle:"Приблизить",zoomOutTitle:"Отдалить"}).addTo(map);
      L.tileLayer(CFG.tileUrl,{maxZoom:19,detectRetina:true}).addTo(map);
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
  m.bindTooltip(esc(s.name),{direction:"top",offset:[0,o.sel?-10:-6],permanent:!!o.sel,className:"lbl"});
  return m;
}
function drawMap(opts={}){
  if(!MAP.ready) return;
  Object.values(MAP.g).forEach(l=>l.clearLayers());
  const acc=cssVar("--acc"), casing=cssVar("--casing"), mute=cssVar("--mute"), you=cssVar("--you");
  const plan=EDIT?null:upcomingPlan(), sel=plan?pickRide(plan).sel:null;
  const pathStops=new Set();
  let routePts=[];
  if(sel){
    const lines=sel.legs.length?ridePoints(sel):[];
    for(const ln of lines){
      MAP.g.route.addLayer(L.polyline(ln.pts,{color:casing,weight:10,opacity:.95,lineCap:"round",lineJoin:"round",interactive:false}));
      MAP.g.route.addLayer(L.polyline(ln.pts,{color:acc,weight:5,opacity:1,lineCap:"round",lineJoin:"round",dashArray:ln.road?null:"1 10",interactive:false}));
      routePts=routePts.concat(ln.pts);
    }
    sel.legs.forEach(leg=>{ for(let k=leg.i;k<=leg.j;k++) pathStops.add(leg.trip.stops[k].stop); });
  }
  /* остановки */
  const served=SERVED[S.dest][S.dir], focus=!EDIT && !!sel && !S.showAll;
  for(const s of D.stops){
    if(!hasXY(s)) continue;
    if(!EDIT){ if(DESTS.includes(s.name)) continue; if(!served.has(s.name)&&s.name!==S.stop) continue;
      if(focus && !pathStops.has(s.name) && s.name!==S.stop) continue; }
    MAP.g.stops.addLayer(stopMarker(s,{sel:s.name===S.stop,path:pathStops.has(s.name)}));
  }
  /* МПЗ и РЦ */
  if(!EDIT) for(const d of DESTS){
    const s=stopByName[d]; if(!hasXY(s)) continue;
    if(focus && d!==S.dest && !pathStops.has(d)) continue;
    const mk=L.marker([s.lat,s.lon],{icon:L.divIcon({className:"pin"+(S.dest===d?" act":"")+(S.stop===d?" sel":""),html:`<span>${SHORT[d]}</span>`,iconSize:[S.dest===d?64:54,34],iconAnchor:[S.dest===d?32:27,17]}),zIndexOffset:1000,title:d});
    mk.on("click",()=>setDest(d)); MAP.g.pins.addLayer(mk);
  }
  /* я и путь пешком */
  const st=stopByName[S.stop];
  if(S.user){
    if(S.user.manual){
      const um=L.marker([S.user.lat,S.user.lon],{draggable:true,zIndexOffset:900,title:"Перетащите, чтобы уточнить место",icon:L.divIcon({className:"youpin",html:"<i></i>",iconSize:[34,34],iconAnchor:[17,17]})});
      um.on("dragend",()=>{ const ll=um.getLatLng(); S.user={lat:ll.lat,lon:ll.lng,acc:0,manual:true}; S.locWarn=null; const before=S.stop; autoPickStop(); renderTop(); renderSheet(); drawMap(before!==S.stop?{fit:"local"}:{}); });
      MAP.g.user.addLayer(um);
    }else{
      MAP.g.user.addLayer(L.circle([S.user.lat,S.user.lon],{radius:Math.max(8,Math.min(S.user.acc||0,800)),color:you,weight:1,opacity:.5,fillColor:you,fillOpacity:.12,interactive:false}));
      MAP.g.user.addLayer(L.circleMarker([S.user.lat,S.user.lon],{radius:9,color:"#fff",weight:3,fillColor:you,fillOpacity:1,interactive:false}));
    }
    if(!EDIT && hasXY(st) && S.locWarn!=="far") MAP.g.walk.addLayer(L.polyline([[S.user.lat,S.user.lon],[st.lat,st.lon]],{color:mute,weight:3,dashArray:"2 8",lineCap:"round",interactive:false}));
  }
  /* переход дороги к соседней остановке */
  if(!EDIT && sel && sel.board!==S.stop){
    const bs=stopByName[sel.board];
    if(hasXY(st)&&hasXY(bs)) MAP.g.walk.addLayer(L.polyline([[st.lat,st.lon],[bs.lat,bs.lon]],{color:mute,weight:4,dashArray:"2 7",lineCap:"round",interactive:false}));
  }
  /* вид */
  if(opts.fit==="local"){
    const pts=[]; if(S.user&&S.locWarn!=="far") pts.push([S.user.lat,S.user.lon]); if(hasXY(st)) pts.push([st.lat,st.lon]);
    if(!pts.length) DESTS.forEach(d=>hasXY(stopByName[d])&&pts.push([stopByName[d].lat,stopByName[d].lon]));
    MAP.fit(pts,17);
  }else if(opts.fit==="route"){
    const pts=routePts.slice(); if(S.user&&S.locWarn!=="far") pts.push([S.user.lat,S.user.lon]);
    MAP.fit(pts.length?pts:[],15);
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
  S.dest=d; store.set("bus.dest",d); S.ride=null;
  if(S.stop===d){ S.stop=null; S.stopManual=false; }
  autoPickStop(); renderTop(); renderSheet(); drawMap({fit:"local"});
}
function selectStop(name,fromMap){
  if(!stopByName[name]) return;
  if(DESTS.includes(name) && name===S.dest) return;
  S.stop=name; S.stopManual=true; S.ride=null; store.set("bus.stop",name); store.set("bus.stopManual",true);
  S.showAll=false; renderTop();
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
    case "dir": if(S.dir!==v){ S.dir=v; S.ride=null; if(S.stop&&!S.stopManual) autoPickStop(); renderSheet(); drawMap({fit:"local"}); } break;
    case "mode": S.mode=v; store.set("bus.mode",v); renderSheet(); break;
    case "ride": S.ride=+el.dataset.i; renderSheet(); drawMap({fit:"route"}); $("sheetBody").scrollTop=0; break;
    case "grab": if(!desktop()) setSheet(S.sheet==="peek"?"half":S.sheet==="half"?"full":"half"); break;
    case "pick-stop": openStopPicker(); break;
    case "pick-locate": closeModal(); S.stopManual=false; store.set("bus.stopManual",false); setTab("map"); startLocate(); break;
    case "pick-manual": closeModal(); startManual(); break;
    case "addr-search": searchAddress($("stopQ").value); break;
    case "addr-pick": { const a=ADDR_RES[+el.dataset.i]; if(a){ closeModal(); setTab("map"); setManual({lat:a.lat,lng:a.lon}); } break; }
    case "pick": { const x=PICK_LIST[+el.dataset.i]; if(x){ closeModal(); selectStop(x.n); if(S.sheet==="peek") setSheet("half"); } break; }
    case "nearest": { const n=nearestStop(); if(n){ S.stopManual=false; store.set("bus.stopManual",false); S.stop=n.name; S.ride=null; store.set("bus.stop",n.name); renderSheet(); drawMap({fit:"local"}); } break; }
    case "locate": setTab("map"); startLocate(); break;
    case "manual": startManual(); break;
    case "fit-route": drawMap({fit:"route"}); break;
    case "show-all": S.showAll=!S.showAll; renderTop(); drawMap(); toast(S.showAll?"Показаны все остановки":"Показан только маршрут",1600); break;
    case "open-when": openWhen(); break;
    case "when-day": $("wDate").value=v; break;
    case "when-apply": applyWhen(); break;
    case "when-now": S.when=null; S.ride=null; S.schedDay=null; closeModal(); refreshAll(true); break;
    case "close-modal": closeModal(); break;
    case "theme": S.theme=S.theme==="auto"?"light":S.theme==="light"?"dark":"auto"; store.set("bus.theme",S.theme); applyTheme(); toast("Тема: "+({auto:"как в системе",light:"светлая",dark:"тёмная"})[S.theme],1800); break;
    case "scity": S.schedCity=v; renderSchedHead(); renderSchedList(); break;
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
function softRender(){
  const b=$("sheetBody"), top=b.scrollTop, det=b.querySelector("details.path"), wasOpen=det&&det.open;
  renderSheet(); b.scrollTop=top; const d2=b.querySelector("details.path"); if(d2&&wasOpen) d2.open=true;
}
setInterval(()=>{ if(S.tab==="map" && !S.when && !EDIT) softRender(); if(S.tab==="sched" && !S.when) renderSchedList(); renderTop(); },30000);
