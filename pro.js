// ══════════════════════════════════════════════════════════════
// TATELIFT PRO — RPE Detector inside the tracker
// 📷 button → RPE Detector (rpe.html) full screen → warm-up single
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

// the tracker looked up "Bench Press" as BENCH (not a key) and fell back to the squat 1RM; map names to lifts properly
const _getOrm=getOrm;
window.getOrm=function(workout){
  const m=liftOf(workout); if(m&&lifts.current[m.lift]) return lifts.current[m.lift];
  if(/\bohp\b|overhead|military|strict press/i.test(workout||'')&&lifts.current.OHP) return lifts.current.OHP;
  return _getOrm(workout);
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

// ── overlay with the detector ──
let frame=null, ready=false, ctxDay=null, open=false;
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
  frame.contentWindow.postMessage({type:'tlpro-ctx',day:dayLabel(x),lifts},location.origin);
}
function openCam(){
  if(open) return; open=true; ctxDay=todayDay();
  ensureFrame(); $('pro-cam').classList.add('open'); document.body.classList.add('pro-cam-open');
  history.pushState({proCam:true},''); sendCtx();
}
function closeCam(fromPop){
  if(!open) return; open=false;
  $('pro-cam').classList.remove('open'); document.body.classList.remove('pro-cam-open');
  if(!fromPop&&history.state&&history.state.proCam) history.back();
}
addEventListener('popstate',()=>{
  if($('pro-sheet').classList.contains('open')){ closeSheet(true); return; }
  if(open) closeCam(true);
});
addEventListener('message',e=>{
  if(e.origin!==location.origin||!e.data||!frame||e.source!==frame.contentWindow) return;
  if(e.data.type==='tlpro-ready'){ ready=true; sendCtx(); }
  else if(e.data.type==='tlpro-close') closeCam();
  else if(e.data.type==='tlpro-apply'){ closeCam(); setTimeout(()=>openSheet(e.data),open?0:60); }
});

// ── apply sheet ──
let sheetData=null;
function openSheet(m){
  sheetData={m,dayIdx:Math.max(0,allDays().findIndex(x=>x.d.id===(ctxDay||todayDay()||{d:{}}).d.id))};
  renderSheet(); $('pro-sheet').classList.add('open'); history.pushState({proSheet:true},'');
}
function closeSheet(fromPop){
  $('pro-sheet').classList.remove('open');
  if(!fromPop&&history.state&&history.state.proSheet) history.back();
}
function renderSheet(){
  const {m}=sheetData, days=allDays(), x=days[sheetData.dayIdx];
  const e1=Math.round(m.e1rm/2.5)*2.5, cur=lifts.current[m.lift];
  let h=`<div class="ps-h">오늘 ${LIFT_NAME[m.lift]} 무게</div>
    <div class="ps-from">워밍업 ${m.wkg.toFixed(1)}kg × ${m.reps} @RPE ${(+m.rpe).toFixed(1)} <span>(${m.src})</span> → 1RM의 ${(m.pct*100).toFixed(1)}%</div>
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
    x.d.proE1rm=Object.assign(x.d.proE1rm||{},{[m.lift]:{e1rm:+m.e1rm.toFixed(1),from:`${m.wkg.toFixed(1)}x${m.reps}@${m.rpe}`,at:Date.now()}});
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
<button id="pro-fab" aria-label="RPE Detector"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></button>
<div id="pro-cam"><button id="pro-cam-close" aria-label="닫기">✕</button></div>
<div id="pro-sheet"><div id="pro-sheet-box"></div></div>
<button id="pro-install"><b>📲</b> 앱으로 설치</button>`);
$('pro-fab').onclick=openCam;
$('pro-cam-close').onclick=()=>closeCam();
$('pro-sheet').addEventListener('click',e=>{ if(e.target.id==='pro-sheet') closeSheet(); });
$('pro-install').onclick=async()=>{ if(!installEvt) return; installEvt.prompt(); try{ await installEvt.userChoice; }catch(e){} installEvt=null; $('pro-install').style.display='none'; };
window.TLPRO={liftOf,openCam,openSheet,todayDay};   // for testing
})();
