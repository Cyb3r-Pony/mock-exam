/* Mock exam trainer — application logic.
   Data lives in data/questions.js and data/cards.js; presentation in styles.css.
   Nothing here talks to the network. State persists to localStorage only. */
const CARDS = window.CARDS || [];
const QS = window.QS || [];
const BLUEPRINT = {"Digital Forensics":44,"Digital Evidence":27,"Procedures and Methodology":26,"Forensic Science":22,"Tools/Systems/Programs":16,"Regulations, Policies and Ethics":15};
const WEAK = ["Tools/Systems/Programs","Digital Evidence","Procedures and Methodology"];
const PASS_PCT = 72;

const LS="mock_exam_trainer";
const DEFAULTS={cards:{},qs:{},sessions:[],served:{},theme:null,v:2};
let S;
try{ S=Object.assign({},DEFAULTS,JSON.parse(localStorage.getItem(LS)||'{}')); }
catch(e){ S=Object.assign({},DEFAULTS); }
for(const k of ['cards','qs','served']) if(!S[k]||typeof S[k]!=='object')S[k]={};
if(!Array.isArray(S.sessions))S.sessions=[];
const save=()=>{ try{ if(S.sessions.length>200)S.sessions=S.sessions.slice(-200);
  localStorage.setItem(LS,JSON.stringify(S)); }catch(e){} };
const $=id=>document.getElementById(id);
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]]}return a};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ---------- theme ---------- */
function applyTheme(t){
  if(t) document.documentElement.setAttribute('data-theme',t);
  else document.documentElement.removeAttribute('data-theme');
  $('themeBtn').textContent = t==='light' ? '☾' : '◐';
}
applyTheme(S.theme);
$('themeBtn').onclick=()=>{
  const cur=S.theme||(window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');
  S.theme = cur==='light' ? 'dark' : 'light';
  applyTheme(S.theme); save();
};
if(!S.theme && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) applyTheme('light');

/* ---------- tabs ---------- */
function showTab(name){
  document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('on',x.dataset.t===name));
  ['drill','exam','stats'].forEach(s=>$(s).classList.toggle('hidden',s!==name));
  if(name==='stats')renderStats();
  if(name!=='exam') endExam(false);
  else if(!exam){
    $('examRun').classList.add('hidden'); $('foot').classList.add('hidden');
    // don't bury a results screen the user hasn't dismissed yet
    if($('examDone').classList.contains('hidden')) $('examSetup').classList.remove('hidden');
  }
}
document.querySelectorAll('.tab').forEach(t=>{
  t.onclick=()=>showTab(t.dataset.t);
  t.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();showTab(t.dataset.t)}};
});

/* ---------- flashcards ---------- */
/* Card progress is keyed by card FRONT, not by array position. build.py
   guarantees fronts are unique, and a front survives cards being added or
   reordered — an index does not, so index keys silently reassigned a user's
   progress to unrelated cards every time the deck grew. v1 state used indices;
   migrate it once through the current array, which is correct because cards
   have only ever been appended. */
if(S.v!==2){
  const old=S.cards||{},next={};
  for(const k of Object.keys(old)){
    const c=/^\d+$/.test(k)?CARDS[+k]:null;
    if(c&&c.front)next[c.front]=old[k];
    else if(!/^\d+$/.test(k))next[k]=old[k];
  }
  S.cards=next;S.v=2;
}
let deck=[],di=0,flipped=false;
const decks=[...new Set(CARDS.map(c=>c.deck))];
$('deckSel').innerHTML='<option value="">All decks ('+CARDS.length+')</option>'+
  decks.map(d=>`<option value="${esc(d)}">${esc(d)} (${CARDS.filter(c=>c.deck===d).length})</option>`).join('');
function buildDeck(){
  const f=$('deckSel').value;
  deck=shuffle(CARDS.filter(c=>!f||c.deck===f));
  di=0;showCard();
}
function showCard(){
  if(!deck.length){$('fcQ').textContent='No cards in this deck';$('fcA').classList.add('hidden');$('fcCount').textContent='0 / 0';return}
  if(di>=deck.length)di=0;
  if(di<0)di=deck.length-1;
  const c=deck[di];flipped=false;
  $('fcDeck').textContent=c.deck;
  $('fcQ').textContent=c.front;
  $('fcA').textContent=c.back;
  $('fcA').classList.add('hidden');
  $('fcHint').classList.remove('hidden');
  $('fcCount').textContent=(di+1)+' / '+deck.length;
  const known=deck.filter(x=>S.cards[x.front]==='g').length;
  $('fcBar').style.width=(100*known/deck.length)+'%';
}
function flip(){if(flipped)return;flipped=true;$('fcA').classList.remove('hidden');$('fcHint').classList.add('hidden')}
function nextCard(){di++;showCard()}
$('fcCard').onclick=flip;
/* stopPropagation matters: without it the keypress ALSO reached the global
   handler below, which saw flipped===true and silently marked the card known
   and advanced — so Space appeared to "skip" instead of revealing. */
$('fcCard').onkeydown=e=>{
  if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();flipped?nextCard():flip()}
};
$('deckSel').onchange=buildDeck;
$('shuf').onclick=buildDeck;
$('resetDeck').onclick=()=>{deck.forEach(c=>delete S.cards[c.front]);save();buildDeck()};
function mark(v){if(!deck.length)return;S.cards[deck[di].front]=v;save();nextCard()}
$('fcGood').onclick=()=>mark('g');
$('fcBad').onclick=()=>mark('b');

/* ---------- exam ---------- */
const sections=[...new Set(QS.map(q=>q.section))];
const modules=[...new Set(QS.map(q=>q.module))].sort((a,b)=>a-b);
$('mode').onchange=()=>{
  const m=$('mode').value,p=$('pick');
  p.classList.toggle('hidden',m!=='section'&&m!=='module');
  if(m==='section')p.innerHTML=sections.map(s=>`<option value="${esc(s)}">${esc(s)} (${QS.filter(q=>q.section===s).length})</option>`).join('');
  if(m==='module')p.innerHTML=modules.map(s=>`<option value="${s}">Module ${String(s).padStart(2,'0')} (${QS.filter(q=>q.module===s).length})</option>`).join('');
  updatePool();
};
$('pick').onchange=()=>updatePool();
function pool(){
  const m=$('mode').value;
  if(m==='section')return QS.filter(q=>q.section===$('pick').value);
  if(m==='module')return QS.filter(q=>q.module==+$('pick').value);
  if(m==='weak')return QS.filter(q=>WEAK.includes(q.section));
  if(m==='cases')return QS.filter(q=>q.caseId);
  if(m==='short')return QS.filter(q=>q.style==='short'&&q.source!=='official');
  if(m==='official')return QS.filter(q=>q.source==='official');
  if(m==='missed')return QS.filter(q=>S.qs[q.id]==='w');
  return QS;
}
// rotation: least-served first, random tie-break within each service tier
function rotSort(a){
  return a.map(q=>({q,n:S.served[q.id]||0,r:Math.random()}))
          .sort((x,y)=>x.n-y.n||x.r-y.r).map(x=>x.q);
}
const order=a=>$('rotate').checked?rotSort(a):shuffle(a);
function blueprintPick(n){
  const tot=Object.values(BLUEPRINT).reduce((a,b)=>a+b,0);
  const taken=new Set(); let out=[];
  for(const [sec,w] of Object.entries(BLUEPRINT)){
    const want=Math.round(n*w/tot);
    order(QS.filter(q=>q.section===sec)).slice(0,want).forEach(q=>{taken.add(q.id);out.push(q)});
  }
  if(out.length<n) order(QS.filter(q=>!taken.has(q.id))).slice(0,n-out.length).forEach(q=>out.push(q));
  return out.slice(0,n);
}
// keep multi-question cases whole and adjacent
function completeCases(sel){
  const ids=new Set(sel.map(q=>q.id));
  sel.slice().forEach(q=>{ if(!q.caseId)return;
    QS.filter(x=>x.caseId===q.caseId&&!ids.has(x.id)).forEach(x=>{ids.add(x.id);sel.push(x)}) });
  return sel;
}
function groupUnits(sel){
  const cases={},units=[];
  sel.forEach(q=>{ if(q.caseId){(cases[q.caseId]=cases[q.caseId]||[]).push(q)} else units.push([q]) });
  Object.values(cases).forEach(g=>units.push(g.sort((a,b)=>a.id.localeCompare(b.id))));
  return shuffle(units).flat();
}
let exam=null,timer=null;
document.querySelectorAll('button.preset').forEach(b=>b.onclick=()=>{
  $('qty').value=b.dataset.n;
  document.querySelectorAll('button.preset').forEach(x=>x.classList.toggle('on',x===b));
});
$('qty').oninput=()=>document.querySelectorAll('button.preset')
  .forEach(x=>x.classList.toggle('on',x.dataset.n===$('qty').value));
$('resetRot').onclick=()=>{if(confirm('Reset rotation? Every question becomes unseen again.')){S.served={};save();updatePool()}};
function updatePool(){
  const p=pool(), fresh=p.filter(q=>!S.served[q.id]).length;
  $('poolInfo').innerHTML=`Bank: <b>${QS.length}</b> questions · this filter: <b>${p.length}</b> available, <b>${fresh}</b> not yet served.`;
  $('startEx').disabled = p.length===0;
}
$('startEx').onclick=()=>{
  let n=parseInt($('qty').value,10); if(!isFinite(n)||n<1)n=50;
  const m=$('mode').value;
  let qs = m==='blueprint' ? blueprintPick(n) : order(pool()).slice(0,n);
  qs = groupUnits(completeCases(qs));
  if(!qs.length){alert('No questions match that filter.');return}
  exam={qs,i:0,ans:[],right:0,instant:$('instant').checked,t0:Date.now(),shown:false,pick:undefined,ord:null};
  $('examSetup').classList.add('hidden');$('examDone').classList.add('hidden');
  $('examRun').classList.remove('hidden');$('foot').classList.remove('hidden');
  if(timer)clearInterval(timer);
  timer=setInterval(()=>{ if(exam)$('exTime').textContent=fmt((Date.now()-exam.t0)/1000); else clearInterval(timer); },500);
  renderQ();
};
const fmt=s=>Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0');
// count the current question once it has been answered, so the bar reaches 100%
const setExBar=()=>{ if(!exam)return;
  $('exBar').style.width=(100*(exam.i+(exam.shown?1:0))/exam.qs.length)+'%' };
function renderQ(){
  const q=exam.qs[exam.i];exam.shown=false;exam.pick=undefined;
  $('exProg').textContent='Q '+(exam.i+1)+' / '+exam.qs.length;
  $('exSec').textContent=q.section;
  $('exScore').textContent=exam.right+' correct';
  setExBar();
  $('exMeta').textContent=(q.source==='official'?'★ OFFICIAL · ':'')+'Module '+String(q.module).padStart(2,'0')+' · '+q.topic+' · '+q.difficulty;
  if(q.caseId&&q.caseText){
    const sib=exam.qs.filter(x=>x.caseId===q.caseId);
    const pos=sib.findIndex(x=>x.id===q.id)+1;
    $('exCase').innerHTML=`<div class="case"><div class="ct">Case — part ${pos} of ${sib.length}</div><div class="cb">${esc(q.caseText)}</div></div>`;
  } else $('exCase').innerHTML='';
  $('exStem').textContent=q.stem;
  const ord=shuffle(q.options.map((o,i)=>i));
  exam.ord=ord;
  $('exOpts').innerHTML=ord.map((oi,n)=>
    `<div class="opt" data-o="${oi}" role="radio" aria-checked="false" tabindex="0"><span class="k"><span>${'ABCD'[n]}</span></span><span class="t">${esc(q.options[oi])}</span></div>`).join('');
  $('exFb').innerHTML='';
  $('exNext').innerHTML='Next <kbd>↵</kbd>';
  document.querySelectorAll('#exOpts .opt').forEach(el=>{
    el.onclick=()=>choose(+el.dataset.o);
    el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){
      e.preventDefault();e.stopPropagation();choose(+el.dataset.o)}};
  });
  try{window.scrollTo({top:0,behavior:'instant'})}catch(e){window.scrollTo(0,0)}
}
function choose(oi){
  if(!exam||exam.shown)return;
  document.querySelectorAll('#exOpts .opt').forEach(e=>{
    const on=+e.dataset.o===oi;
    e.classList.toggle('sel',on); e.setAttribute('aria-checked',on?'true':'false');
  });
  exam.pick=oi;
  if(exam.instant)reveal();
}
function reveal(){
  if(!exam||exam.shown||exam.pick===undefined)return;
  const q=exam.qs[exam.i];
  exam.shown=true;
  const ok=exam.pick===q.answer;
  if(ok)exam.right++;
  S.qs[q.id]=ok?'r':'w'; S.served[q.id]=(S.served[q.id]||0)+1; save();
  exam.ans.push({id:q.id,section:q.section,ok});
  document.querySelectorAll('#exOpts .opt').forEach(e=>{
    const o=+e.dataset.o; e.classList.add('done');
    if(o===q.answer)e.classList.add('right');
    else if(o===exam.pick)e.classList.add('wrong');
  });
  $('exFb').innerHTML=`<div class="expl"><b class="${ok?'ok':'bad'}">${ok?'Correct.':'Incorrect.'}</b> ${esc(q.explanation)}</div>`+
    (q.trap?`<div class="trap"><b>Watch for:</b> ${esc(q.trap)}</div>`:'');
  $('exScore').textContent=exam.right+' correct';
  setExBar();
  $('exNext').innerHTML=(exam.i===exam.qs.length-1?'Finish':'Next')+' <kbd>↵</kbd>';
}
$('exNext').onclick=()=>{
  if(!exam)return;
  if(!exam.shown){
    if(exam.pick===undefined){ $('exFb').innerHTML='<div class="trap"><b>Pick an answer first.</b></div>'; return }
    reveal(); return;                       // always let the explanation be read
  }
  if(exam.i>=exam.qs.length-1){finish();return}
  exam.i++;renderQ();
};
$('exQuit').onclick=()=>{
  if(!exam)return;
  if(!exam.ans.length){endExam();updatePool();return}   // nothing to score
  if(confirm('End this session?'))finish();
};
function endExam(showSetup){
  if(timer){clearInterval(timer);timer=null}
  exam=null;
  if(showSetup!==false){$('examRun').classList.add('hidden');$('examSetup').classList.remove('hidden')}
  $('foot').classList.add('hidden');
}
function finish(){
  if(!exam)return;
  const secs={},answered=exam.ans.length,right=exam.right,elapsed=(Date.now()-exam.t0)/1000;
  exam.ans.forEach(a=>{secs[a.section]=secs[a.section]||{n:0,r:0};secs[a.section].n++;if(a.ok)secs[a.section].r++});
  const pct=answered?Math.round(100*right/answered):0;
  if(answered)S.sessions.push({d:Date.now(),n:answered,r:right});
  save();
  const rows=Object.entries(secs).sort((a,b)=>a[1].r/a[1].n-b[1].r/b[1].n).map(([s,v])=>{
    const p=Math.round(100*v.r/v.n),c=p>=80?'ok':p>=70?'warn':'bad';
    return `<tr><td>${esc(s)}</td><td class="num">${v.r}/${v.n}</td><td class="num ${c==='warn'?'warnc':c}">${p}%</td>
      <td><div class="sbar"><i style="width:${p}%;background:var(--${c})"></i></div></td></tr>`}).join('');
  const R=52,C=2*Math.PI*R,col=pct>=PASS_PCT?'ok':'bad';
  $('examRun').classList.add('hidden');$('foot').classList.add('hidden');
  $('examDone').classList.remove('hidden');
  $('examDone').innerHTML=`<div class="card">
    <div class="ring">
      <svg width="124" height="124" viewBox="0 0 124 124" aria-hidden="true">
        <circle class="rbg" cx="62" cy="62" r="${R}" fill="none" stroke-width="11"></circle>
        <circle class="rfg" cx="62" cy="62" r="${R}" fill="none" stroke-width="11" stroke-linecap="round"
          stroke="var(--${col})" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C*(1-pct/100)).toFixed(1)}"></circle>
      </svg>
      <div>
        <div class="big ${col}">${pct}%</div>
        <div class="mini" style="margin-top:4px">${right} of ${answered} correct · ${fmt(elapsed)} · pass mark ${PASS_PCT}%</div>
        <div class="mini">${pct>=PASS_PCT?'Above the pass mark.':'Below the pass mark.'}</div>
      </div>
    </div>
    ${rows?`<div class="tw"><table><tr><th>Section</th><th class="num">Score</th><th class="num">%</th><th style="width:120px"></th></tr>${rows}</table></div>`:''}
    <div class="row" style="margin-top:18px">
      <button class="pri" id="againBtn">New session</button>
      <button id="missedBtn">Drill what I missed</button>
    </div></div>`;
  if(timer){clearInterval(timer);timer=null}
  exam=null;
  $('againBtn').onclick=()=>{$('examDone').classList.add('hidden');$('examSetup').classList.remove('hidden');updatePool()};
  $('missedBtn').onclick=()=>{$('mode').value='missed';$('mode').onchange();
    $('examDone').classList.add('hidden');$('examSetup').classList.remove('hidden')};
}

/* ---------- stats ---------- */
function renderStats(){
  const seen=Object.keys(S.qs).length, right=Object.values(S.qs).filter(v=>v==='r').length;
  const known=CARDS.filter(c=>S.cards[c.front]==='g').length;
  const bySec={};
  QS.forEach(q=>{const v=S.qs[q.id];if(!v)return;bySec[q.section]=bySec[q.section]||{n:0,r:0};bySec[q.section].n++;if(v==='r')bySec[q.section].r++});
  const rows=Object.entries(bySec).sort((a,b)=>a[1].r/a[1].n-b[1].r/b[1].n).map(([s,v])=>{
    const p=Math.round(100*v.r/v.n),c=p>=80?'ok':p>=70?'warn':'bad';
    return `<tr><td>${esc(s)}</td><td class="num">${v.r}/${v.n}</td><td class="num ${c==='warn'?'warnc':c}">${p}%</td>
    <td><div class="sbar"><i style="width:${p}%;background:var(--${c})"></i></div></td></tr>`}).join('');
  $('statsBody').innerHTML=`<b>This device</b>
    <div class="row" style="margin:12px 0">
      <span class="pill">Attempted <b>${seen}</b> / ${QS.length}</span>
      <span class="pill">Accuracy <b>${seen?Math.round(100*right/seen):0}%</b></span>
      <span class="pill">Cards known <b>${known}</b> / ${CARDS.length}</span>
      <span class="pill">Sessions <b>${S.sessions.length}</b></span>
      <span class="pill">Never served <b>${QS.filter(q=>!S.served[q.id]).length}</b> / ${QS.length}</span>
    </div>
    ${rows?`<div class="tw"><table><tr><th>Section</th><th class="num">Latest</th><th class="num">%</th><th style="width:120px"></th></tr>${rows}</table></div>`:'<div class="mini">Take a session to see a breakdown.</div>'}
    <div class="mini" style="margin-top:10px">Reflects your most recent answer to each question.</div>`;
}
$('wipe').onclick=()=>{if(confirm('Erase all saved progress?')){
  const th=S.theme; S=Object.assign({},DEFAULTS,{theme:th}); save();buildDeck();renderStats();updatePool()}};

/* ---------- touch: swipe flashcards, swipe to advance ---------- */
(function(){
  let x0=null,y0=null,t0=0;
  const start=e=>{const t=e.changedTouches[0];x0=t.clientX;y0=t.clientY;t0=Date.now()};
  const end=(e,onLeft,onRight)=>{
    if(x0===null)return; const t=e.changedTouches[0];
    const dx=t.clientX-x0, dy=t.clientY-y0, dt=Date.now()-t0;
    x0=null;
    if(dt>600||Math.abs(dx)<45||Math.abs(dy)>Math.abs(dx))return;
    (dx<0?onLeft:onRight)();
  };
  const fc=$('fcCard');
  fc.addEventListener('touchstart',start,{passive:true});
  fc.addEventListener('touchend',e=>end(e,()=>{di++;showCard()},()=>{di--;showCard()}),{passive:true});
  const ex=$('examRun');
  ex.addEventListener('touchstart',start,{passive:true});
  ex.addEventListener('touchend',e=>{
    if(window.getSelection && String(window.getSelection()))return;
    end(e,()=>{if(exam&&exam.shown)$('exNext').click()},()=>{});
  },{passive:true});
})();

/* ---------- keys ---------- */
document.onkeydown=e=>{
  const tag=e.target&&e.target.tagName;
  if(tag==='INPUT'||tag==='SELECT'||tag==='TEXTAREA')return;
  if(e.metaKey||e.ctrlKey||e.altKey)return;
  const onDrill=!$('drill').classList.contains('hidden');
  if(onDrill){
    /* Space reveals, then advances. It never marks — marking is 1 and 2 only,
       as the on-screen hint and the README both say. */
    if(e.code==='Space'){e.preventDefault();flipped?nextCard():flip()}
    else if(e.key==='1')mark('b'); else if(e.key==='2')mark('g');
    else if(e.key==='ArrowRight')nextCard(); else if(e.key==='ArrowLeft'){di--;showCard()}
  } else if(exam){
    const k=(e.key||'').toLowerCase();
    if('abcd'.includes(k)&&k.length===1){
      const n='abcd'.indexOf(k);
      if(exam.ord&&exam.ord[n]!==undefined)choose(exam.ord[n]);
    } else if(e.key==='Enter'){e.preventDefault();$('exNext').click()}
  }
};
buildDeck();$('mode').onchange();
