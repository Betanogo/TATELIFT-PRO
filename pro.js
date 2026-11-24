// ══════════════════════════════════════════════════════════════
// TATELIFT PRO — RPE Detector inside the tracker
// swipe left → RPE Detector (rpe.html) as the page to the right → warm-up single
// → e1RM → today's SBD weights (top set + back-offs) → 적용하기
// Uses the tracker's own globals: blocks, lifts, calcWeight, getOrm,
// pushUndo, renderProgram, autoSave, showToast, findCurrentDayId, fmt.
// ══════════════════════════════════════════════════════════════
(function(){
const $=id=>document.getElementById(id);
const LIFT_NAME={SQ:'Squat',BP:'Bench Press',DL:'Deadlift'};
// which exercises count as squat / bench / deadlift (accessories and OHP never do)
const CAND={
  SQ:{inc:/squat|^sq\b/i, exc:/belt|split|bss|bulgarian|goblet|hack|jump|leg press|sissy|zercher|safety bar|ssb/i, main:/^(back\s*)?(comp\s*|pause(d)?\s*|tempo\s*|pin\s*)?(squat|sq)(\s*\(.*\))?$/i},
  BP:{inc:/bench|^bp\b|larson/i, exc:/dumbbell|\bdb\b|incline|decline|floor|spoto|board|pin|close/i, main:/^(comp\s*|pause(d)?\s*|tempo\s*|larson\s*|touch\s*and\s*go\s*)?(bench(\s*press)?|bp)(\s*\(.*\))?$/i},
  DL:{inc:/deadlift|^dl\b/i, exc:/romanian|\brdl\b|single\s*leg|stiff|trap|hex|deficit|block|rack|snatch/i, main:/^(comp\s*|pause(d)?\s*|tempo\s*|conventional\s*|sumo\s*)?(deadlift|dl)(\s*\(.*\))?$/i},
};
function liftOf(name){
  name=(name||'').trim(); if(!name) return null;
  for(const k of ['SQ','BP','DL']){ const c=CAND[k]; if(c.inc.test(name)&&!c.exc.test(name)) return {lift:k,main:c.main.test(name)}; }
  return null;
}

// 1RM lookup by name. Only the main squat / bench / deadlift (and their pause/tempo/Larson
// versions) and OHP have a 1RM — everything else (accessories, variations) gets no RPE weight,
// so it shows only what was typed in. (The old tracker fell back to the squat 1RM for everything.)
window.getOrm=function(workout){
  const m=liftOf(workout);
  if(m) return m.main&&lifts.current[m.lift]?lifts.current[m.lift]:null;
  if(/^\s*(ohp|overhead press|military press|strict press|press)\s*$/i.test(workout||'')) return lifts.current.OHP||null;
  return null;
};
renderProgram();

// ── days ──
function allDays(){
  const out=[];
  blocks.filter(b=>!b.archived).forEach(b=>b.weeks.forEach(w=>w.days.filter(d=>!d.archived).forEach(d=>out.push({b,w,d}))));
  return out;
}
function todayDay(){
  const today=new Date().toISOString().slice(0,10), days=allDays();
  const dated=days.find(x=>x.d.date===today); if(dated) return dated;
  const cur=findCurrentDayId(); return days.find(x=>x.d.id===cur)||days[0]||null;
}
const dayLabel=x=>x?`${x.w.label} · ${x.d.name.replace(/\s+/g,' ')}`:'';
const shownKg=ex=>ex.weightKg!=null?ex.weightKg:calcWeight(getOrm(ex.workout),ex.rpe,ex.reps,ex.tempo,ex.workout);
const rx=ex=>`${ex.sets||'?'}×${ex.reps||'?'}${ex.rpe?' @'+ex.rpe:''}${ex.tempo?' · '+ex.tempo:''}`;
function sbdOf(day){
  const by={};
  day.exercises.forEach(ex=>{ const m=liftOf(ex.workout); if(!m) return; (by[m.lift]=by[m.lift]||[]).push({ex,main:m.main}); });
  return by;
}

// ── RPE Detector as the page to the right: swipe left on the tracker to go there, swipe right to come back ──
let frame=null, ready=false, ctxDay=null, open=false, camMode='home';
function ensureFrame(){
  if(frame) return;
  frame=document.createElement('iframe'); frame.id='pro-frame'; frame.src='rpe.html?pro=1';
  frame.allow='fullscreen; screen-wake-lock';
  $('pro-cam').appendChild(frame);
}
function sendCtx(){
  if(!frame||!ready) return;
  const x=ctxDay||todayDay(); const by=x?sbdOf(x.d):{}; const lifts={};
  Object.entries(by).forEach(([k,arr])=>lifts[k]=arr.map(o=>({label:rx(o.ex),name:o.ex.workout})));
  const exs=x?x.d.exercises.filter(ex=>(ex.workout||'').trim()).map(ex=>({id:ex.id,name:ex.workout,rx:rx(ex),kg:shownKg(ex),sets:Math.max(1,parseInt(ex.sets)||1),lift:(liftOf(ex.workout)||{}).lift||null,clips:(ex.clips||[]).map(c=>({t:c.t,set:c.set||null}))})):[];
  frame.contentWindow.postMessage({type:'tlpro-ctx',day:dayLabel(x),lifts,exs},location.origin);
}
const paneW=()=>window.innerWidth;
// Both pages move together, side by side (like switching apps): the detector sits at x,
// the tracker (header + current page) sits one screen to its left.
const trkLayers=()=>[$('nav'),document.querySelector('.page.active')].filter(Boolean);
let clearT=null;
function setPane(x,anim){            // x = how far the detector is from the left edge (0 = fully shown)
  x=Math.max(0,Math.min(paneW(),x));
  const tr=anim?'transform .32s cubic-bezier(.2,.8,.2,1)':'none';
  const c=$('pro-cam'); c.style.transition=tr; c.style.transform=`translate3d(${x}px,0,0)`; c.style.visibility='visible';
  clearTimeout(clearT);
  trkLayers().forEach(el=>{ el.style.transition=tr; el.style.transform=`translate3d(${x-paneW()}px,0,0)`; });
  if(x>=paneW()){                    // fully back on the tracker: drop the transforms so fixed/sticky things behave normally
    clearT=setTimeout(()=>{ trkLayers().forEach(el=>{ el.style.transition=''; el.style.transform=''; }); if(!open) c.style.visibility='hidden'; },anim?340:0);
  }
}
function settle(){ updateDots(); }
function openCam(){
  ensureFrame(); ctxDay=todayDay(); sendCtx();
  setPane(0,true); document.body.classList.add('pro-cam-open');
  if(!open){ open=true; history.pushState({proCam:true},''); }
  settle();
}
function closeCam(fromPop){
  setPane(paneW(),true); document.body.classList.remove('pro-cam-open');
  if(open){ open=false; if(!fromPop&&history.state&&history.state.proCam){ swallowPop=true; history.back(); } }
  settle();
}
let swallowPop=false;   // our own history.back() when closing the detector/sheet: don't let the tracker treat it as 'back' (it would close the set detail)
addEventListener('popstate',e=>{
  if(swallowPop){ swallowPop=false; e.stopImmediatePropagation(); return; }
  if($('pro-sheet').classList.contains('open')){ closeSheet(true); return; }
  if(open){   // back while on the detector: let it step back first (result → home), and leave only from its home
    history.pushState({proCam:true},'');
    if(frame&&ready) frame.contentWindow.postMessage({type:'tlpro-back'},location.origin); else closeCam();
  }
});
addEventListener('resize',()=>setPane(open?0:paneW(),false));
addEventListener('message',e=>{
  if(e.origin!==location.origin||!e.data||!frame||e.source!==frame.contentWindow) return;
  const m=e.data;
  if(m.type==='tlpro-ready'){ ready=true; sendCtx(); }
  else if(m.type==='tlpro-close') closeCam();
  else if(m.type==='tlpro-mode'){ camMode=m.mode; updateDots(); }
  else if(m.type==='tlpro-drag'){ setPane(Math.max(0,m.dx),false); }
  else if(m.type==='tlpro-dragend'){ (m.dx>paneW()*0.28||(m.vx>0.45&&m.dx>40))?closeCam():openCam(); }
  else if(m.type==='tlpro-apply'){ closeCam(); setTimeout(()=>openSheet(m),open?0:60); }
  else if(m.type==='tlpro-attach') attachClip(m);
  else if(m.type==='tlpro-detach'){ detachClip(m.time); autoSave(); renderProgram(); sendCtx(); }
});
// tracker-side swipe (finger moving left reveals the detector)
function blocked(t){
  if(open||document.body.classList.contains('drawer-open')||$('pro-sheet').classList.contains('open')) return true;
  if($('ex-detail-overlay')?.classList.contains('open')) return true;
  if(!$('timer-overlay')?.classList.contains('hidden')) return true;
  if([...document.querySelectorAll('.modal-overlay,#note-modal')].some(m=>!m.classList.contains('hidden'))) return true;
  const ls=$('loading-screen'); if(ls&&ls.style.display!=='none'&&!ls.classList.contains('hide')) return true;
  for(let el=t;el&&el!==document.body;el=el.parentElement){
    if(/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)||el.isContentEditable) return true;
    if(el.scrollWidth>el.clientWidth+2){ const ox=getComputedStyle(el).overflowX; if(ox==='auto'||ox==='scroll') return true; }
  }
  return false;
}
{ let g=null;
  document.addEventListener('touchstart',e=>{ if(e.touches.length!==1||blocked(e.target)){ g=null; return; } const t=e.touches[0]; g={x:t.clientX,y:t.clientY,t:performance.now(),drag:false,dead:false}; ensureFrame(); },{passive:true});
  document.addEventListener('touchmove',e=>{
    if(!g||g.dead) return; const t=e.touches[0], dx=t.clientX-g.x, dy=t.clientY-g.y;
    if(!g.drag){   // decide the direction on the first few pixels and hold the page still from then on
      const ax=Math.abs(dx), ay=Math.abs(dy); if(ax<4&&ay<4) return;
      if(ay>=ax||dx>0){ g.dead=true; return; }
      e.preventDefault(); if(ax<10) return;
      g.drag=true; document.documentElement.classList.add('pro-hlock');
    }
    e.preventDefault(); g.dx=dx; g.vx=dx/Math.max(1,performance.now()-g.t); setPane(paneW()+Math.min(0,dx),false);
  },{passive:false});
  const end=()=>{ document.documentElement.classList.remove('pro-hlock'); if(g&&g.drag){ const dx=-(g.dx||0); (dx>paneW()*0.28||(-g.vx>0.45&&dx>40))?openCam():closeCam(true); } g=null; };
  document.addEventListener('touchend',end); document.addEventListener('touchcancel',end);
}
// two dots at the bottom: where you are, tap to switch
function updateDots(){
  const d=$('pro-dots'); if(!d) return;
  d.children[0].classList.toggle('on',!open); d.children[1].classList.toggle('on',open);
  d.classList.toggle('hide',open&&camMode!=='home'&&camMode!=='result');
}
setTimeout(ensureFrame,1800);   // load the detector in the background so the first swipe is instant

// ── set clips from the detector → the matching set of today's program ──
// the detector asks "어느 세트에 넣을까요?" and sends the choice here
function findClip(t){ for(const x of allDays()) for(const ex of x.d.exercises) if((ex.clips||[]).some(c=>c.t===t)) return {x,ex}; return null; }
function detachClip(t){ for(const x of allDays()) x.d.exercises.forEach(ex=>{ if(ex.clips&&ex.clips.some(c=>c.t===t)) ex.clips=ex.clips.filter(c=>c.t!==t); }); }
function attachClip(m){
  const x=ctxDay||todayDay(); if(!x) return;
  const ex=x.d.exercises.find(e=>e.id===m.exId); if(!ex) return;
  detachClip(m.time);
  ex.clips=(ex.clips||[]).filter(c=>!(m.set&&c.set===m.set));   // one clip per set
  ex.clips.push({t:m.time,kg:m.wkg?+(+m.wkg).toFixed(1):null,reps:m.reps||null,set:m.set||null});
  ex.clips.sort((a,b)=>(a.set||99)-(b.set||99)||a.t-b.t); ex.clips=ex.clips.slice(-12);
  autoSave(); renderProgram(); sendCtx();
}
const clipDB={ p:null,
  open(){ return this.p||(this.p=new Promise((res,rej)=>{ const r=indexedDB.open('tatelift',1); r.onupgradeneeded=()=>{ if(!r.result.objectStoreNames.contains('clips')) r.result.createObjectStore('clips'); }; r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); })); },
  async get(k){ const db=await this.open(); return new Promise(res=>{ try{ const q=db.transaction('clips','readonly').objectStore('clips').get(k); q.onsuccess=()=>res(q.result||null); q.onerror=()=>res(null); }catch(e){ res(null); } }); },
};
let detURL=null;
async function showDetClip(ex){
  const box=$('det-clip'), v=$('det-clip-v'), tabs=$('det-clip-tabs');
  if(detURL){ URL.revokeObjectURL(detURL); detURL=null; } v.removeAttribute('src'); v.controls=false;
  const list=(ex&&ex.clips)||[]; if(!list.length){ box.style.display='none'; tabs.innerHTML=''; return; }
  box.style.display='flex';
  const load=async i=>{
    tabs.innerHTML=list.length>1?list.map((c,j)=>`<button class="${j===i?'on':''}" data-j="${j}">${c.set?'S'+c.set:j+1}</button>`).join(''):'';
    tabs.querySelectorAll('button').forEach(b=>b.onclick=()=>load(+b.dataset.j));
    $('det-clip-del').onclick=()=>{
      confirmAction('영상 빼기','이 세트에서 영상을 뺄까요? 영상은 RPE Detector 기록에 남아 있어서 다시 넣을 수 있어요.',()=>{
        pushUndo(); ex.clips=list.filter((_,j)=>j!==i); autoSave(); renderProgram(); sendCtx(); showDetClip(ex);
      });
    };
    const c=list[i]; box.dataset.t=c.t; const blob=await clipDB.get('clip:'+c.t);
    if(currentDetailEx&&currentDetailEx.ex!==ex) return;
    if(detURL){ URL.revokeObjectURL(detURL); detURL=null; }
    const lbl=(c.set?`세트 ${c.set} · `:'')+(c.kg?fmtW(c.kg):'')+(c.reps?` × ${c.reps}`:'');
    if(!blob){ v.style.display='none'; $('det-clip-msg').textContent=lbl+' — 이 폰에 영상 없음'; return; }
    v.style.display='block'; $('det-clip-msg').textContent=lbl;
    detURL=URL.createObjectURL(blob); v.src=detURL; v.muted=true; v.loop=true; v.playsInline=true; v.play().catch(()=>{});
  };
  load(list.length-1);
}
const _openDet=openExDetail, _closeDet=closeExDetail;
window.openExDetail=function(ex,day){ _openDet(ex,day); showDetClip(ex); };
window.closeExDetail=function(){ try{ $('det-clip-v').pause(); }catch(e){} _closeDet(); };

// ── open on today's workout ──
let userMoved=false;
['touchstart','wheel','keydown'].forEach(t=>addEventListener(t,()=>{ userMoved=true; },{passive:true,once:true}));
function scrollToToday(force){
  if(userMoved&&!force) return;
  if(!$('page-program')?.classList.contains('active')) return;
  const x=todayDay(); if(!x) return;
  if(x.w.collapsed){ x.w.collapsed=false; renderProgram(); }
  const el=document.querySelector(`.day-card[data-did="${x.d.id}"]`); if(!el) return;
  const top=el.getBoundingClientRect().top+scrollY-($('nav')?.offsetHeight||54)-12;
  scrollTo({top:Math.max(0,top),behavior:force?'smooth':'auto'});
}
[200,900,2200].forEach(t=>setTimeout(()=>scrollToToday(false),t));
{ const ls=$('loading-screen'); if(ls) new MutationObserver(()=>{ if(ls.classList.contains('hide')) setTimeout(()=>scrollToToday(false),50); }).observe(ls,{attributes:true,attributeFilter:['class']}); }

// ── apply sheet ──
let sheetData=null;
function openSheet(m){
  sheetData={m,dayIdx:Math.max(0,allDays().findIndex(x=>x.d.id===(ctxDay||todayDay()||{d:{}}).d.id))};
  renderSheet(); $('pro-sheet').classList.add('open'); history.pushState({proSheet:true},'');
}
function closeSheet(fromPop){
  $('pro-sheet').classList.remove('open');
  if(!fromPop&&history.state&&history.state.proSheet){ swallowPop=true; history.back(); }
}
function renderSheet(){
  const {m}=sheetData, days=allDays(), x=days[sheetData.dayIdx];
  const e1=Math.round(m.e1rm/2.5)*2.5, cur=lifts.current[m.lift];
  let h=`<div class="ps-h">오늘 ${LIFT_NAME[m.lift]} 무게</div>
    <div class="ps-from">워밍업 ${m.wkg.toFixed(1)}kg × ${m.reps}${m.v?` · 바 속도 ${m.v.toFixed(2)} m/s`:''} → 1RM의 ${(m.pct*100).toFixed(1)}%${m.rpeLbl?` (≈ RPE ${m.rpeLbl})`:''} <span>${m.how?'· '+m.how:'· '+(m.src||'')}</span></div>
    <div class="ps-e1"><b>${fmtW(e1)}</b><span>오늘 e1RM</span>${cur?`<em>${e1>=cur?'+':''}${Math.round(toDisplay(e1-cur))} vs 프로필 1RM ${fmtW(cur)}</em>`:''}</div>
    <label class="ps-day">운동일 <select id="ps-day">${days.map((d,i)=>`<option value="${i}"${i===sheetData.dayIdx?' selected':''}>${d.b.name} · ${dayLabel(d)}</option>`).join('')}</select></label>`;
  const rows=x?(sbdOf(x.d)[m.lift]||[]):[];
  if(!rows.length) h+=`<div class="ps-empty">이 날엔 ${LIFT_NAME[m.lift]} 세트가 없어요. 위에서 다른 날을 고르세요.</div>`;
  else{
    h+='<div class="ps-list">';
    rows.forEach((o,i)=>{
      const ex=o.ex, old=shownKg(ex), nw=calcWeight(m.e1rm,ex.rpe,ex.reps,ex.tempo,ex.workout);
      const ok=nw!=null;
      h+=`<label class="ps-row${ok?'':' off'}"><input type="checkbox" data-i="${i}" ${ok&&o.main?'checked':''} ${ok?'':'disabled'}/>
        <div class="ps-n"><b>${escapeHtml(ex.workout)}</b><span>${rx(ex)}</span></div>
        <div class="ps-w">${ok?`<s>${old!=null?fmtW(old):'—'}</s><b>${fmtW(nw)}</b>`:'<span>RPE·렙 없음</span>'}</div></label>`;
    });
    h+='</div><div class="ps-note">템포·포즈 공식 적용, 2.5kg 반올림 · 체크한 세트만 바뀌어요 (↩ 되돌리기 가능)</div>';
  }
  h+=`<div class="ps-btns"><button class="modal-btn sec" id="ps-cancel">취소</button><button class="modal-btn primary" id="ps-apply" ${rows.some(o=>o.ex.rpe&&o.ex.reps)?'':'disabled'}>적용하기</button></div>`;
  $('pro-sheet-box').innerHTML=h;
  $('ps-day').onchange=e=>{ sheetData.dayIdx=+e.target.value; renderSheet(); };
  $('ps-cancel').onclick=()=>closeSheet();
  $('ps-apply').onclick=()=>{
    const picks=[...$('pro-sheet-box').querySelectorAll('.ps-row input:checked')].map(c=>rows[+c.dataset.i].ex);
    if(!picks.length){ showToast('적용할 세트를 체크하세요'); return; }
    pushUndo();
    picks.forEach(ex=>{ ex.weightKg=calcWeight(m.e1rm,ex.rpe,ex.reps,ex.tempo,ex.workout); });
    x.d.proE1rm=Object.assign(x.d.proE1rm||{},{[m.lift]:{e1rm:+m.e1rm.toFixed(1),from:`${m.wkg.toFixed(1)}x${m.reps}${m.v?' v'+m.v.toFixed(2):''}@${m.rpeLbl||m.rpe||''}`,at:Date.now()}});
    renderProgram(); autoSave(); closeSheet();
    showToast(`${LIFT_NAME[m.lift]} ${picks.length}세트 적용 ✓`,2800);
  };
}
const fmtW=kg=>{ if(kg==null||isNaN(kg)) return '—'; const v=toDisplay(kg); return (displayUnit==='kg'?(Math.round(v*2)/2).toString():Math.round(v).toString())+' '+displayUnit; };
const escapeHtml=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);

// ── install as an app (Android) ──
let installEvt=null;
addEventListener('beforeinstallprompt',e=>{ e.preventDefault(); installEvt=e; $('pro-install').style.display='flex'; });
addEventListener('appinstalled',()=>{ installEvt=null; $('pro-install').style.display='none'; showToast('TATELIFT PRO 설치 완료 ✓'); });

// ── markup ──
document.body.insertAdjacentHTML('beforeend',`
<div id="pro-cam"></div>
<div id="pro-dots"><button aria-label="Tracker"></button><button aria-label="RPE Detector"></button></div>
<div id="pro-sheet"><div id="pro-sheet-box"></div></div>
<button id="pro-install"><b>📲</b> 앱으로 설치</button>`);
$('pro-dots').children[0].onclick=()=>{ if(open) closeCam(); };
$('pro-dots').children[1].onclick=()=>{ if(!open) openCam(); };
updateDots();
$('pro-sheet').addEventListener('click',e=>{ if(e.target.id==='pro-sheet') closeSheet(); });
$('pro-install').onclick=async()=>{ if(!installEvt) return; installEvt.prompt(); try{ await installEvt.userChoice; }catch(e){} installEvt=null; $('pro-install').style.display='none'; };
// tap the video (or the link under it) → this set's full analysis in the RPE Detector; swipe back returns here
function showInDetector(){
  const t=+$('det-clip').dataset.t; if(!t) return;
  ensureFrame(); openCam();
  const go=()=>frame.contentWindow.postMessage({type:'tlpro-show',time:t},location.origin);
  if(ready) go(); else { const w=e=>{ if(e.data&&e.data.type==='tlpro-ready'){ removeEventListener('message',w); setTimeout(go,50); } }; addEventListener('message',w); }
}
$('det-clip-v').addEventListener('click',showInDetector);
$('det-clip-link').addEventListener('click',showInDetector);
// ☰ menu: a drawer that slides in from the left with every page + settings
{ const btn=$('btn-settings'), TITLE={program:'Program',stats:'PRs',rpe:'RPE Chart',log:'Log',calendar:'Calendar'};
  const isOpen=()=>document.body.classList.contains('drawer-open');
  const openDr=()=>{ if(isOpen()) return; document.body.classList.add('drawer-open'); $('drawer').setAttribute('aria-hidden','false'); history.pushState({drawer:true},''); };
  const closeDr=fromPop=>{ if(!isOpen()) return; document.body.classList.remove('drawer-open'); $('drawer').setAttribute('aria-hidden','true'); if(!fromPop&&history.state&&history.state.drawer) history.back(); };
  btn.addEventListener('click',e=>{ e.stopImmediatePropagation(); isOpen()?closeDr():openDr(); },true);
  $('drawer-bg').onclick=()=>closeDr();
  document.querySelectorAll('#subnav .nav-tab[data-page]').forEach(t=>t.addEventListener('click',()=>{ $('nav-title').textContent=TITLE[t.dataset.page]||''; closeDr(); }));
  $('dr-settings').onclick=()=>{
    document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    $('page-settings')?.classList.add('active'); $('dr-settings').classList.add('active'); $('nav-title').textContent='Settings'; closeDr();
  };
  $('dr-cam').onclick=()=>{
    if(history.state&&history.state.drawer){ addEventListener('popstate',()=>setTimeout(openCam,0),{once:true}); closeDr(); }
    else { closeDr(true); openCam(); }
  };
  addEventListener('popstate',()=>{ if(isOpen()) closeDr(true); });
  // swipe left on the drawer to close it
  let sx=null; $('drawer').addEventListener('touchstart',e=>{ sx=e.touches[0].clientX; },{passive:true});
  $('drawer').addEventListener('touchend',e=>{ if(sx!=null&&e.changedTouches[0].clientX-sx<-50) closeDr(); sx=null; });
}
window.TLPRO={liftOf,openCam,closeCam,openSheet,todayDay,attachClip,findClip,scrollToToday,isOpen:()=>open};   // for testing
})();
