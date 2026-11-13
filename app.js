(function(){
"use strict";
const $=(s)=>document.querySelector(s);
const Cap=window.Capacitor||null;
const P=(Cap&&Cap.Plugins)||{};
const NATIVE=!!(Cap&&Cap.isNativePlatform&&Cap.isNativePlatform());
const KEY="mazda.jobs.v1";

/* ---------- model ---------- */
const STAGES=[
  {id:"todo",label:"De aplicat",color:"#8E8E93"},
  {id:"applied",label:"Aplicat",color:"#0A84FF"},
  {id:"screen",label:"Interviu HR",color:"#64D2FF"},
  {id:"interview",label:"Interviu",color:"#FF9F0A"},
  {id:"offer",label:"Ofertă",color:"#30D158"},
  {id:"rejected",label:"Respins",color:"#FF453A"},
  {id:"withdrawn",label:"Retras",color:"#636366"}
];
const ST=Object.fromEntries(STAGES.map(s=>[s.id,s]));
const ACTIVE=["applied","screen","interview","offer"];
const CRIT=[
  {id:"direction",label:"Potrivire cu direcția",w:30},
  {id:"experience",label:"Experiență transferabilă",w:20},
  {id:"growth",label:"Creștere",w:15},
  {id:"location",label:"Locație și mod de lucru",w:15},
  {id:"eligibility",label:"Eligibilitate",w:10},
  {id:"pay",label:"Salariu",w:10}
];
const AV_COLORS=[["#0A84FF","#5E5CE6"],["#FF375F","#B5192C"],["#30D158","#0FA3A3"],["#FF9F0A","#FF453A"],["#BF5AF2","#5E5CE6"],["#64D2FF","#0A84FF"],["#FFD60A","#FF9F0A"]];
const TARGETS=[
  ["Raiffeisen Bank România","Product Owner Junior, Squad Open Banking","București","https://cariere.raiffeisen.ro","A"],
  ["UniCredit Bank România","Internship: Project Portfolio Manager / Business Analyst","București","https://unicredit.ro/en/institutional/careers/UniCredit-internships.html","A"],
  ["ING Bank România","Internship: Operations, Wholesale, Sustainability","București, hibrid","","A"],
  ["BCR","Learn@BCR (risc, operațiuni, strategie)","București; Brașov","https://www.bcr.ro/ro/cariere/programe-pentru-tineri","A"],
  ["BRD – Groupe Société Générale","Internship@BRD / Junior Banker","București; Brașov","https://careers.societegenerale.com","B"],
  ["Société Générale GSC","Program absolvenți 6 luni","București, hibrid","https://careers.societegenerale.com","B"],
  ["Banca Transilvania","Stagii pentru studenți","Național","https://www.bancatransilvania.ro","C"],
  ["CEC Bank","Internship (cerere prin email)","București; Brașov","","C"],
  ["Worldline","Project management (plăți)","Brașov","","C"]
];

let state={apps:[],notif:false,scanSeen:[],lastScan:null,module:"career",auth:null,syncAt:null,syncErr:""};
const MODULES={career:{label:"Carieră",cv:"Business"},design:{label:"Design",cv:"Design"}};
/* Live (not deleted) applications of the current module. Deleted ones stay as tombstones so the deletion syncs. */
const live=()=>state.apps.filter(a=>!a.deleted);
const mine=()=>state.apps.filter(a=>!a.deleted&&a.track===state.module);
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const now=()=>Date.now();
const ymd=(d)=>{ const x=new Date(d); return x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0")+"-"+String(x.getDate()).padStart(2,"0"); };
const today=()=>ymd(Date.now());
const fmtD=new Intl.DateTimeFormat("ro-RO",{day:"numeric",month:"short"});
const fmtDL=new Intl.DateTimeFormat("ro-RO",{weekday:"long",day:"numeric",month:"long"});
const dateOf=(s)=>new Date(s+"T12:00:00");
function dayLabel(s){ if(!s) return ""; const t=today(); const tm=ymd(Date.now()+864e5);
  if(s===t) return "Azi"; if(s===tm) return "Mâine"; if(s<t){ const d=Math.round((dateOf(t)-dateOf(s))/864e5); return d===1?"Ieri":"Acum "+d+" zile"; } return fmtD.format(dateOf(s)); }
function daysSince(ts){ if(!ts) return ""; const d=Math.floor((Date.now()-ts)/864e5); return d<=0?"azi":d===1?"ieri":d+" zile"; }
function score(a){ const fb=(typeof a.scanScore==="number")?a.scanScore:null; if(!a.score) return fb; let s=0,any=false; for(const c of CRIT){ const v=a.score[c.id]; if(typeof v==="number"){ any=true; s+=v/10*c.w; } } return any?Math.round(s):fb; }
function scoreColor(s){ return s>=70?"#30D158":s>=50?"#FF9F0A":"#FF453A"; }
function hash(s){ let h=0; for(const c of String(s)) h=(h*31+c.charCodeAt(0))|0; return Math.abs(h); }
function avatar(name,cls){ const e=document.createElement("div"); e.className=cls||"av"; const [a,b]=AV_COLORS[hash(name)%AV_COLORS.length]; e.style.background="linear-gradient(140deg,"+a+","+b+")"; e.textContent=(String(name||"?").trim()[0]||"?").toUpperCase(); return e; }
function el(tag,cls,text){ const e=document.createElement(tag); if(cls) e.className=cls; if(text!=null) e.textContent=text; return e; }
function pill(stage){ const s=ST[stage]||ST.todo; const p=el("span","pill",s.label); p.style.color=s.color; p.style.background=s.color+"26"; return p; }
function safeUrl(u){ try{ const x=new URL(String(u||"").trim()); return x.protocol==="https:"&&!x.username&&!x.password?x.href:""; }catch(e){ return ""; } }
const KNOWN_HOSTS=["careers.ing.com","ing.ro","brd.ro","careers.societegenerale.com","societegenerale.com","cariere.raiffeisen.ro","raiffeisen.ro","unicredit.ro","bcr.ro","bancatransilvania.ro","cec.ro","worldline.com","ejobs.ro","bestjobs.eu","hipo.ro"];
function hostOf(u){ try{ return new URL(u).hostname.replace(/^www\./,""); }catch(e){ return ""; } }
function knownHost(h){ return KNOWN_HOSTS.some(k=>h===k||h.endsWith("."+k)); }
const str=(v,n)=>(typeof v==="string"?v:v==null?"":String(v)).slice(0,n);
const dstr=(v)=>(typeof v==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(v))?v:"";
const tnum=(v)=>(typeof v==="number"&&isFinite(v)&&v>0&&v<4102444800000)?v:undefined;
/* Whitelist every field of an application coming from outside (backup import, scan feed). */
function sanitizeApp(x){
  if(!x||typeof x!=="object") return null;
  const company=str(x.company,120).trim(); if(!company) return null;
  const sc={}; if(x.score&&typeof x.score==="object") for(const c of CRIT){ const v=x.score[c.id]; if(typeof v==="number"&&v>=0&&v<=10) sc[c.id]=Math.round(v); }
  const hist=Array.isArray(x.history)?x.history.slice(-100).map(h=>h&&ST[h.stage]?{stage:h.stage,at:tnum(h.at)||Date.now(),note:str(h.note,200)}:null).filter(Boolean):[];
  return { id:(typeof x.id==="string"&&/^[a-z0-9]{4,40}$/i.test(x.id))?x.id:uid(), company, role:str(x.role,160), link:safeUrl(x.link), location:str(x.location,120),
    mode:["onsite","hybrid","remote"].includes(x.mode)?x.mode:"hybrid", source:str(x.source,80), cv:x.cv==="Design"?"Design":"Business", salary:str(x.salary,80),
    priority:["A","B","C"].includes(x.priority)?x.priority:"B", stage:ST[x.stage]?x.stage:"todo", deadline:dstr(x.deadline), nextStep:str(x.nextStep,160), nextDate:dstr(x.nextDate),
    contact:str(x.contact,160), notes:str(x.notes,4000), score:sc, scanScore:(typeof x.scanScore==="number"&&x.scanScore>=0&&x.scanScore<=100)?Math.round(x.scanScore):undefined,
    history:hist, appliedAt:tnum(x.appliedAt), createdAt:tnum(x.createdAt)||Date.now(), updatedAt:tnum(x.updatedAt)||Date.now(),
    track:x.track==="design"?"design":"career", scanKey:(typeof x.scanKey==="string"&&x.scanKey.length<=120)?x.scanKey:undefined, deleted:x.deleted===true?true:undefined };
}

/* ---------- storage ---------- */
function cleanAuth(x){ if(!x||typeof x!=="object") return null; const ok=(v,n)=>typeof v==="string"&&v.length>0&&v.length<=n;
  if(!ok(x.at,4096)||!ok(x.rt,512)||!ok(x.uid,64)) return null; return {at:x.at,rt:x.rt,uid:x.uid,email:str(x.email,200),exp:tnum(x.exp)||0}; }
async function load(){
  let raw=null;
  try{ if(P.Preferences){ const r=await P.Preferences.get({key:KEY}); raw=r&&r.value; } }catch(e){}
  if(raw==null){ try{ raw=localStorage.getItem(KEY); }catch(e){} }
  if(raw){ try{ const d=JSON.parse(raw); if(d&&Array.isArray(d.apps)) state={apps:d.apps.map(sanitizeApp).filter(Boolean),notif:d.notif===true,scanSeen:Array.isArray(d.scanSeen)?d.scanSeen.filter(k=>typeof k==="string").slice(-500):[],lastScan:d.lastScan&&typeof d.lastScan==="object"?{date:dstr(d.lastScan.date),label:str(d.lastScan.label,80),found:Number(d.lastScan.found)||0,closed:Array.isArray(d.lastScan.closed)?d.lastScan.closed.slice(0,8).map(t=>str(t,300)):[]}:null,feedCheckedAt:tnum(d.feedCheckedAt),module:d.module==="design"?"design":"career",auth:cleanAuth(d.auth),syncAt:tnum(d.syncAt),syncErr:""}; }catch(e){} }
}
let saveT=null;
function save(){
  clearTimeout(saveT);
  saveT=setTimeout(async()=>{ const raw=JSON.stringify(state);
    try{ localStorage.setItem(KEY,raw); }catch(e){}
    try{ if(P.Preferences) await P.Preferences.set({key:KEY,value:raw}); }catch(e){} },150);
}
/* Every user change goes through touch(): it saves locally and schedules a sync. */
function touch(){ save(); scheduleSync(); }
function haptic(kind){ try{ if(P.Haptics){ kind==="success"?P.Haptics.notification({type:"SUCCESS"}):P.Haptics.impact({style:kind==="heavy"?"MEDIUM":"LIGHT"}); } }catch(e){} }
function toast(msg){ const t=$("#toast"); t.textContent=msg; t.classList.add("on"); clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove("on"),2200); }

/* ---------- notifications ---------- */
const nid=(id)=>(hash(id)%2000000000)+1;
async function ensureChannel(){ try{ if(P.LocalNotifications&&P.LocalNotifications.createChannel) await P.LocalNotifications.createChannel({id:"mazda-jobs",name:"Remindere aplicări",description:"Pași următori și termene",importance:3,visibility:0}); }catch(e){} }
async function syncNotifs(){
  const LN=P.LocalNotifications; if(!LN||!state.notif) return;
  try{ await ensureChannel();
    const pend=await LN.getPending(); if(pend&&pend.notifications&&pend.notifications.length) await LN.cancel({notifications:pend.notifications.map(n=>({id:n.id}))});
    const list=[]; const t=today();
    for(const a of live()){ if(!a.nextDate||a.nextDate<t||!["todo",...ACTIVE].includes(a.stage)) continue;
      const at=new Date(a.nextDate+"T09:00:00"); if(at.getTime()<Date.now()) at.setTime(Date.now()+60000);
      list.push({id:nid(a.id),title:a.company+" · "+(a.nextStep||"Pas următor"),body:a.role||"MAZDA Jobs",schedule:{at,allowWhileIdle:true}}); }
    for(const a of live()){ if(!a.deadline||a.deadline<t||a.stage!=="todo") continue;
      const at=new Date(a.deadline+"T09:00:00"); at.setDate(at.getDate()-2); if(at.getTime()<Date.now()) continue;
      list.push({id:nid(a.id+"dl"),title:"Termen în 2 zile: "+a.company,body:a.role||"Aplică până pe "+fmtD.format(dateOf(a.deadline)),schedule:{at,allowWhileIdle:true}}); }
    if(list.length) await LN.schedule({notifications:list.slice(0,60).map(n=>Object.assign(n,{channelId:"mazda-jobs"}))});
  }catch(e){}
}
async function enableNotifs(){
  const LN=P.LocalNotifications;
  if(!LN){ toast("Notificările merg doar în aplicația instalată."); return; }
  try{ await ensureChannel(); let p=await LN.checkPermissions(); if(p.display!=="granted") p=await LN.requestPermissions();
    if(p.display==="granted"){ state.notif=true; save(); await syncNotifs(); toast("Remindere activate"); haptic("success"); }
    else toast("Permisiunea pentru notificări a fost refuzată");
  }catch(e){ toast("Nu am putut activa notificările"); }
  renderSettings();
}

/* ---------- navigation ---------- */
const TITLES={home:"Acasă",list:"Aplicări",agenda:"Agendă",settings:"Setări"};
let tab="home";
function go(t){ tab=t; for(const k of Object.keys(TITLES)) $("#v-"+k).hidden=k!==t;
  document.querySelectorAll(".tab").forEach(b=>b.setAttribute("aria-current",b.dataset.tab===t?"page":"false"));
  $("#navTitle").textContent=TITLES[t]; window.scrollTo(0,0); onScroll(); render(); haptic(); }
document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>go(b.dataset.tab)));
document.querySelectorAll("[data-goto]").forEach(b=>b.addEventListener("click",()=>go(b.dataset.goto)));
function onScroll(){ $("#navbar").classList.toggle("scrolled",window.scrollY>34); }
window.addEventListener("scroll",onScroll,{passive:true});
$("#addBtn").addEventListener("click",()=>openEdit(null));

/* ---------- render ---------- */
function render(){ renderHome(); renderScan(); renderList(); renderAgenda(); renderSettings(); }
function counts(){ const c={}; for(const s of STAGES) c[s.id]=0; for(const a of mine()) c[a.stage]=(c[a.stage]||0)+1; return c; }
function renderHome(){
  $("#today").textContent=fmtDL.format(new Date());
  const c=counts(); const apps=mine();
  const sent=apps.filter(a=>a.stage!=="todo"&&a.stage!=="withdrawn").length;
  const responded=apps.filter(a=>["screen","interview","offer","rejected"].includes(a.stage)).length;
  const rate=sent?Math.round(responded/sent*100):0;
  $("#respRate").textContent=rate+"%";
  $("#ringFg").style.strokeDashoffset=String(314.16*(1-rate/100));
  $("#stTotal").textContent=apps.length; $("#stActive").textContent=apps.filter(a=>ACTIVE.includes(a.stage)).length;
  $("#stInterview").textContent=c.screen+c.interview; $("#stOffer").textContent=c.offer;
  const f=$("#funnel"); f.textContent=""; const lg=$("#legend"); lg.textContent="";
  for(const s of STAGES){ if(!c[s.id]) continue; const i=el("i"); i.style.flexGrow=c[s.id]; i.style.background=s.color; f.append(i);
    const sp=el("span"); const dot=el("i"); dot.style.background=s.color; sp.append(dot,document.createTextNode(s.label+" "),el("b",null,String(c[s.id]))); lg.append(sp); }
  if(!apps.length){ lg.append(el("p","empty",state.module==="design"?"Nicio aplicare de design încă. Apasă + ca să adaugi una.":"Nicio aplicare încă. Apasă + sau importă țintele din Setări.")); }
  $("#pipeSub").textContent=sent?sent+" trimise":"";
  const nx=$("#homeNext"); nx.textContent=""; const items=upcoming().slice(0,4);
  if(!items.length) nx.append(el("p","empty","Niciun pas programat."));
  for(const it of items) nx.append(liFor(it));
  const rc=$("#recent"); rc.textContent="";
  const ev=[]; for(const a of apps) for(const h of (a.history||[])) ev.push({a,h});
  ev.sort((x,y)=>y.h.at-x.h.at);
  if(!ev.length) rc.append(el("p","empty","Nimic încă."));
  for(const {a,h} of ev.slice(0,5)){ const b=el("button","li"); b.append(avatar(a.company)); const m=el("div","m"); m.append(el("b",null,a.company),el("span",null,(ST[h.stage]?ST[h.stage].label:"Actualizat")+(h.note?" · "+h.note:""))); b.append(m,el("span","when",dayLabel(ymd(h.at)))); b.addEventListener("click",()=>openDetail(a.id)); rc.append(b); }
}
function upcoming(){
  const out=[];
  for(const a of mine()){
    if(a.nextDate&&a.stage!=="rejected"&&a.stage!=="withdrawn") out.push({a,date:a.nextDate,text:a.nextStep||"Pas următor"});
    if(a.deadline&&a.stage==="todo") out.push({a,date:a.deadline,text:"Termen aplicare"});
  }
  out.sort((x,y)=>x.date<y.date?-1:1); return out;
}
function liFor(it){ const b=el("button","li"); b.append(avatar(it.a.company)); const m=el("div","m"); m.append(el("b",null,it.text),el("span",null,it.a.company+(it.a.role?" · "+it.a.role:"")));
  const t=today(); const w=el("span","when"+(it.date<t?" late":it.date===t?" today":""),dayLabel(it.date)); b.append(m,w); b.addEventListener("click",()=>openDetail(it.a.id)); return b; }

let filter="all";
function renderList(){
  const c=counts(); const seg=$("#segments"); seg.textContent="";
  const mk=(id,label,n)=>{ const b=el("button","seg"); b.setAttribute("role","tab"); b.setAttribute("aria-selected",String(filter===id)); b.append(document.createTextNode(label)); if(n!=null) b.append(el("small",null,String(n))); b.addEventListener("click",()=>{ filter=id; haptic(); renderList(); }); seg.append(b); };
  const M=mine(); mk("all","Toate",M.length); mk("active","Active",M.filter(a=>ACTIVE.includes(a.stage)).length);
  for(const s of STAGES) if(c[s.id]) mk(s.id,s.label,c[s.id]);
  const q=($("#search").value||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
  const norm=(x)=>String(x||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
  let list=M.filter(a=>filter==="all"||(filter==="active"?ACTIVE.includes(a.stage):a.stage===filter));
  if(q) list=list.filter(a=>norm(a.company+" "+a.role+" "+a.location).includes(q));
  const order=Object.fromEntries(STAGES.map((s,i)=>[s.id,i]));
  list.sort((a,b)=>{ const ra=["rejected","withdrawn"].includes(a.stage)?1:0, rb=["rejected","withdrawn"].includes(b.stage)?1:0; if(ra!==rb) return ra-rb; return (b.updatedAt||0)-(a.updatedAt||0); });
  const box=$("#appList"); box.textContent="";
  $("#listCount").textContent=MODULES[state.module].label+" · "+(M.length?M.length+(M.length===1?" aplicare":" aplicări"):"gol");
  if(!list.length){ const p=el("p","empty",M.length?"Nimic pentru acest filtru.":"Nicio aplicare. Apasă + ca să adaugi prima."); p.style.padding="22px 16px"; box.append(p); return; }
  for(const a of list){ const r=el("button","row"); r.append(avatar(a.company)); const m=el("div","m"); m.append(el("b",null,a.company),el("span",null,[a.role,a.location].filter(Boolean).join(" · ")));
    const rt=el("div","r"); rt.append(pill(a.stage)); const sc=score(a); const small=el("small",null,(sc!=null?"Scor "+sc+" · ":"")+(a.appliedAt?daysSince(a.appliedAt):"")); rt.append(small);
    r.append(m,rt); r.addEventListener("click",()=>openDetail(a.id)); box.append(r); }
}
$("#search").addEventListener("input",renderList);
function renderAgenda(){
  const box=$("#agendaList"); box.textContent=""; const items=upcoming();
  if(!items.length){ const g=el("div","glass card"); g.append(el("p","empty","Niciun pas programat. Adaugă un „pas următor” cu dată pe o aplicare și apare aici.")); box.append(g); return; }
  const t=today(); const groups=new Map();
  for(const it of items){ const k=it.date<t?"late":it.date; if(!groups.has(k)) groups.set(k,[]); groups.get(k).push(it); }
  for(const [k,arr] of groups){ const h=el("p","day-h"+(k==="late"?" late":""),k==="late"?"Întârziate":k===t?"Azi":k===ymd(Date.now()+864e5)?"Mâine":fmtDL.format(dateOf(k))); box.append(h);
    const g=el("div","glass card"); g.style.padding="6px 16px"; for(const it of arr) g.append(liFor(it)); box.append(g); }
}
function renderSettings(){
  const ss=$("#syncState"); if(ss) ss.textContent=!CFG.sbUrl?"Neconfigurată în această versiune":!state.auth?"Oprită · atinge ca să te conectezi":
    (state.syncErr?"Eroare: "+state.syncErr:(state.auth.email||"Conectat")+(state.syncAt?" · "+new Intl.DateTimeFormat("ro-RO",{hour:"2-digit",minute:"2-digit"}).format(new Date(state.syncAt)):""));
  const ft=$("#footTxt"); if(ft) ft.textContent=state.auth?"Datele sunt sincronizate între telefon și Mac prin contul tău.":"Datele rămân doar pe acest dispozitiv. Conectează sincronizarea sau fă un backup din când în când.";
  $("#notifState").textContent=state.notif?"Active · ora 9:00 în ziua pasului":"Oprite · atinge ca să le activezi";
  const f=$("#feedState"); if(f) f.textContent=(state.lastScan?state.lastScan.label+" · ":"")+(state.feedCheckedAt?"verificat "+new Intl.DateTimeFormat("ro-RO",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(state.feedCheckedAt)):"se verifică la fiecare deschidere"); }

/* ---------- sheet ---------- */
let sheetOpen=false;
function openSheet(build){ const b=$("#sheetBody"); b.textContent=""; build(b); $("#scrim").hidden=false; const s=$("#sheet"); s.hidden=false; s.classList.remove("closing"); sheetOpen=true; document.body.style.overflow="hidden"; b.scrollTop=0; }
function closeSheet(){ if(!sheetOpen) return; const s=$("#sheet"); s.classList.add("closing"); $("#scrim").hidden=true; sheetOpen=false; document.body.style.overflow=""; setTimeout(()=>{ if(!sheetOpen){ s.hidden=true; s.classList.remove("closing"); } },240); }
$("#scrim").addEventListener("click",closeSheet);
(function(){ let y0=null; const g=$("#grabber"), s=$("#sheet");
  const start=(e)=>{ y0=(e.touches?e.touches[0]:e).clientY; };
  const move=(e)=>{ if(y0==null) return; const dy=(e.touches?e.touches[0]:e).clientY-y0; if(dy>0) s.style.transform="translateY("+dy+"px)"; };
  const end=(e)=>{ if(y0==null) return; const dy=((e.changedTouches?e.changedTouches[0]:e).clientY)-y0; s.style.transform=""; y0=null; if(dy>110) closeSheet(); };
  g.addEventListener("touchstart",start,{passive:true}); g.addEventListener("touchmove",move,{passive:true}); g.addEventListener("touchend",end);
})();
function head(parent,title,left,right){ const h=el("div","sh-head"); const l=el("button",null,left?left.label:""); if(left) l.addEventListener("click",left.fn); else l.style.visibility="hidden";
  const r=el("button","right",right?right.label:""); if(right) r.addEventListener("click",right.fn); else r.style.visibility="hidden";
  h.append(l,el("h2",null,title),r); parent.append(h); return r; }

/* ---------- edit ---------- */
function field(parent,label,type,value,opts){ const f=el("div","field"+(type==="textarea"?" ta":"")); const id="f"+uid(); const l=el("label",null,label); l.htmlFor=id;
  let i; if(type==="select"){ i=el("select"); for(const [v,t] of opts) { const o=el("option",null,t); o.value=v; if(v===value) o.selected=true; i.append(o); } }
  else if(type==="textarea"){ i=el("textarea"); i.value=value||""; i.rows=4; }
  else { i=el("input"); i.type=type; i.value=value||""; if(opts&&opts.placeholder) i.placeholder=opts.placeholder; if(type==="url") i.inputMode="url"; }
  if(type==="textarea") i.maxLength=4000; else if(type==="text"||type==="url") i.maxLength=type==="url"?600:160;
  i.id=id; f.append(l,i); parent.append(f); return i; }
function openEdit(id){
  const ex=id?state.apps.find(a=>a.id===id):null;
  const a=ex?JSON.parse(JSON.stringify(ex)):{id:uid(),track:state.module,company:"",role:"",link:"",location:"",mode:"hybrid",source:"",cv:MODULES[state.module].cv,salary:"",priority:"B",stage:"todo",deadline:"",nextStep:"",nextDate:"",contact:"",notes:"",score:{},history:[]};
  openSheet((b)=>{
    const saveBtn=head(b,ex?"Editează":"Aplicare nouă",{label:"Anulează",fn:closeSheet},{label:"Salvează",fn:()=>doSave()});
    const g1=el("div","fgroup"); b.append(g1);
    const fCo=field(g1,"Companie","text",a.company,{placeholder:"ex. ING Bank"});
    const fRole=field(g1,"Rol","text",a.role,{placeholder:"ex. Business Analyst"});
    const fLink=field(g1,"Link","url",a.link,{placeholder:"https://"});
    const fLoc=field(g1,"Locație","text",a.location,{placeholder:"Brașov"});
    const fMode=field(g1,"Mod","select",a.mode,[["onsite","La birou"],["hybrid","Hibrid"],["remote","Remote"]]);
    const g2=el("div","fgroup"); b.append(g2);
    const fTrack=field(g2,"Modul","select",a.track||"career",[["career","Carieră"],["design","Design"]]);
    const fStage=field(g2,"Etapă","select",a.stage,STAGES.map(s=>[s.id,s.label]));
    const fPrio=field(g2,"Prioritate","select",a.priority,[["A","A"],["B","B"],["C","C"]]);
    const fCv=field(g2,"CV","select",a.cv,[["Business","Business"],["Design","Design"]]);
    const fDl=field(g2,"Termen","date",a.deadline);
    const fSal=field(g2,"Salariu","text",a.salary,{placeholder:"ex. 6.500 RON net"});
    const fSrc=field(g2,"Sursă","text",a.source,{placeholder:"site, eJobs, recomandare"});
    b.append(el("p","fgroup-h","Pas următor"));
    const g3=el("div","fgroup"); b.append(g3);
    const fNs=field(g3,"Ce","text",a.nextStep,{placeholder:"ex. Follow-up email"});
    const fNd=field(g3,"Când","date",a.nextDate);
    const fCt=field(g3,"Contact","text",a.contact,{placeholder:"nume, email"});
    b.append(el("p","fgroup-h","Scor pe grila ta"));
    const g4=el("div","fgroup"); b.append(g4);
    const sb=el("div","scorebig"); const sv=el("b"); sb.append(el("span",null,"Scor total"),sv); g4.append(sb);
    const vals=Object.assign({},a.score||{});
    const upd=()=>{ const s=score({score:vals}); sv.textContent=s==null?"–":String(s); sv.style.color=s==null?"":scoreColor(s); };
    for(const c of CRIT){ const sl=el("div","slider"); const top=el("div","top"); const vb=el("b"); top.append(el("span",null,c.label+" · "+c.w+"%"),vb);
      const r=el("input"); r.type="range"; r.min="0"; r.max="10"; r.step="1"; r.value=String(typeof vals[c.id]==="number"?vals[c.id]:5); r.setAttribute("aria-label",c.label);
      const setv=()=>{ vb.textContent=r.value+"/10"; };
      r.addEventListener("input",()=>{ vals[c.id]=Number(r.value); setv(); upd(); });
      if(typeof vals[c.id]!=="number") vb.textContent="–"; else setv();
      sl.append(top,r); g4.append(sl); }
    upd();
    b.append(el("p","fgroup-h","Note"));
    const g5=el("div","fgroup"); b.append(g5); const fNotes=field(g5,"Note","textarea",a.notes);
    function doSave(){
      const company=fCo.value.trim(); if(!company){ toast("Adaugă numele companiei"); fCo.focus(); return; }
      const link=fLink.value.trim(); if(link&&!safeUrl(link)){ toast("Linkul trebuie să înceapă cu https://"); fLink.focus(); return; }
      const prevStage=ex?ex.stage:null; const stage=fStage.value;
      Object.assign(a,{track:fTrack.value==="design"?"design":"career",company,role:fRole.value.trim(),link,location:fLoc.value.trim(),mode:fMode.value,stage,priority:fPrio.value,cv:fCv.value,deadline:fDl.value,salary:fSal.value.trim(),source:fSrc.value.trim(),nextStep:fNs.value.trim(),nextDate:fNd.value,contact:fCt.value.trim(),notes:fNotes.value,score:vals,updatedAt:now()});
      if(!ex){ a.createdAt=now(); a.history=[{stage,at:now(),note:"Adăugat"}]; if(stage!=="todo") a.appliedAt=now(); state.apps.push(a); }
      else { if(prevStage!==stage){ a.history=(a.history||[]).concat([{stage,at:now()}]); if(stage==="applied"&&!a.appliedAt) a.appliedAt=now(); }
        const i=state.apps.findIndex(x=>x.id===a.id); state.apps[i]=a; }
      touch(); syncNotifs(); haptic("success"); closeSheet(); if(a.track!==state.module) setModule(a.track); else render(); toast(ex?"Salvat":"Aplicare adăugată");
    }
    if(!ex) setTimeout(()=>fCo.focus(),350);
  });
}

/* ---------- detail ---------- */
function openDetail(id){
  const a=state.apps.find(x=>x.id===id&&!x.deleted); if(!a) return;
  openSheet((b)=>{
    head(b,"",{label:"Închide",fn:closeSheet},{label:"Editează",fn:()=>{ closeSheet(); setTimeout(()=>openEdit(a.id),260); }});
    const dh=el("div","dhead"); dh.append(avatar(a.company)); const tx=el("div"); tx.append(el("h3",null,a.company),el("p",null,a.role||"Rol nespecificat")); dh.append(tx); b.append(dh);
    const stp=el("div","stepper");
    for(const s of STAGES){ const x=el("button","step",s.label); x.setAttribute("aria-pressed",String(a.stage===s.id)); if(a.stage===s.id){ x.style.background=s.color; }
      x.addEventListener("click",()=>{ if(a.stage===s.id) return; a.stage=s.id; a.updatedAt=now(); a.history=(a.history||[]).concat([{stage:s.id,at:now()}]); if(s.id==="applied"&&!a.appliedAt) a.appliedAt=now();
        touch(); syncNotifs(); haptic("success"); render(); toast("Mutat la „"+s.label+"”"); openDetail(a.id); });
      stp.append(x); }
    b.append(stp);
    const br=el("div","btnrow"); const u=safeUrl(a.link);
    if(u){ const o=el("button","bigbtn"); o.append(icon("i-link"),document.createTextNode("Deschide anunțul")); o.addEventListener("click",()=>openUrl(u)); br.append(o); }
    if(br.children.length){ b.append(br); const h=hostOf(u); const n=el("span","ext"+(knownHost(h)?"":" warn"),knownHost(h)?"Se deschide: "+h:"Atenție: domeniu necunoscut ("+h+"). Verifică linkul înainte să introduci date."); b.append(n); }
    const sc=score(a);
    const g=el("div","fgroup"); b.append(g);
    const kv=(k,v,color)=>{ if(v==null||v==="") return; const r=el("div","kv"); r.append(el("span",null,k)); const vb=el("b",null,String(v)); if(color) vb.style.color=color; r.append(vb); g.append(r); };
    kv("Scor",sc!=null?sc+" / 100":"",sc!=null?scoreColor(sc):null);
    kv("Prioritate",a.priority); kv("Locație",a.location); kv("Mod",{onsite:"La birou",hybrid:"Hibrid",remote:"Remote"}[a.mode]);
    kv("CV",a.cv); kv("Salariu",a.salary); kv("Sursă",a.source); kv("Contact",a.contact);
    kv("Termen",a.deadline?fmtDL.format(dateOf(a.deadline)):""); kv("Aplicat",a.appliedAt?fmtD.format(new Date(a.appliedAt))+" ("+daysSince(a.appliedAt)+")":"");
    if(a.nextStep||a.nextDate){ b.append(el("p","fgroup-h","Pas următor")); const g2=el("div","fgroup"); const r=el("div","kv"); r.append(el("span",null,a.nextStep||"Pas următor"),el("b",null,a.nextDate?dayLabel(a.nextDate):"fără dată")); g2.append(r); b.append(g2); }
    if(a.notes){ b.append(el("p","fgroup-h","Note")); const g3=el("div","fgroup"); g3.append(el("div","notes",a.notes)); b.append(g3); }
    if((a.history||[]).length){ b.append(el("p","fgroup-h","Istoric")); const g4=el("div","fgroup"); const tl=el("div","tl");
      for(const h of a.history.slice().reverse()){ const i=el("div","tl-i"); const dot=el("i"); dot.style.background=(ST[h.stage]||ST.todo).color; const d=el("div"); d.append(el("b",null,(ST[h.stage]||{label:"Actualizat"}).label),el("span",null,new Intl.DateTimeFormat("ro-RO",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(h.at))+(h.note?" · "+h.note:""))); i.append(dot,d); tl.append(i); }
      g4.append(tl); b.append(g4); }
    const del=el("button","bigbtn danger","Șterge aplicarea"); del.addEventListener("click",()=>{
      if(!del.classList.contains("armed")){ del.classList.add("armed"); del.textContent="Apasă din nou ca să ștergi"; haptic("heavy"); setTimeout(()=>{ del.classList.remove("armed"); del.textContent="Șterge aplicarea"; },3500); return; }
      tombstone(a); touch(); syncNotifs(); closeSheet(); render(); toast("Șters"); });
    const dr=el("div","btnrow"); dr.style.marginTop="8px"; dr.append(del); b.append(dr);
  });
}
/* A deleted application keeps only its id, module and scan key, so the deletion can sync and the scan does not re-add it. */
function tombstone(a){ const i=state.apps.findIndex(x=>x.id===a.id); if(i<0) return;
  state.apps[i]={id:a.id,company:a.company,track:a.track,scanKey:a.scanKey,link:a.link,deleted:true,stage:"todo",history:[],score:{},createdAt:a.createdAt||now(),updatedAt:now()}; }
function openUrl(u){ u=safeUrl(u); if(!u) return; try{ if(P.Browser){ P.Browser.open({url:u}); return; } }catch(e){} window.open(u,"_blank","noopener,noreferrer"); }
function icon(id){ const NS="http://www.w3.org/2000/svg"; const s=document.createElementNS(NS,"svg"); const u=document.createElementNS(NS,"use"); u.setAttribute("href","#"+id); s.append(u); return s; }

/* ---------- settings actions ---------- */
$("#feedBtn").addEventListener("click",()=>loadScan(true));
$("#seedBtn").addEventListener("click",()=>{
  let added=0; const have=new Set(live().filter(a=>a.track==="career").map(a=>a.company.toLowerCase()));
  for(const [company,role,location,link,priority] of TARGETS){ if(have.has(company.toLowerCase())) continue;
    state.apps.push({id:uid(),track:"career",company,role,link,location,mode:/hibrid/i.test(location)?"hybrid":"onsite",source:"Ținte MAZDA",cv:"Business",salary:"",priority,stage:"todo",deadline:"",nextStep:"",nextDate:"",contact:"",notes:"",score:{},history:[{stage:"todo",at:now(),note:"Importat din MAZDA"}],createdAt:now(),updatedAt:now()}); added++; }
  touch(); if(state.module!=="career") setModule("career"); else render(); haptic("success"); toast(added?added+" ținte importate în Carieră":"Țintele sunt deja în listă");
});
$("#exportBtn").addEventListener("click",async()=>{
  const raw=JSON.stringify({app:"mazda-jobs",v:2,exported:new Date().toISOString(),apps:live()},null,1);
  try{ if(P.Clipboard) await P.Clipboard.write({string:raw}); else await navigator.clipboard.writeText(raw); toast("Backup copiat. Lipește-l într-o notă sau email."); haptic("success"); }
  catch(e){ openSheet((b)=>{ head(b,"Backup",{label:"Închide",fn:closeSheet}); const g=el("div","fgroup"); const t=el("textarea"); t.value=raw; t.readOnly=true; t.style.cssText="width:100%;min-height:300px;background:none;border:0;padding:12px;color:inherit;font-size:13px"; g.append(t); b.append(el("p","fgroup-h","Selectează tot și copiază")); b.append(g); }); }
});
$("#importBtn").addEventListener("click",()=>{
  openSheet((b)=>{
    let ta;
    head(b,"Importă backup",{label:"Anulează",fn:closeSheet},{label:"Importă",fn:()=>{
      try{ const d=JSON.parse(ta.value); const apps=Array.isArray(d)?d:d.apps; if(!Array.isArray(apps)) throw 0;
        if(ta.value.length>2000000) throw 0; const clean=apps.slice(0,2000).map(sanitizeApp).filter(Boolean);
        const ids=new Set(state.apps.map(a=>a.id)); let n=0; for(const x of clean){ if(ids.has(x.id)) continue; state.apps.push(x); n++; }
        touch(); syncNotifs(); render(); closeSheet(); toast(n+" aplicări importate"); haptic("success");
      }catch(e){ toast("Textul nu e un backup valid"); } }});
    b.append(el("p","fgroup-h","Lipește backup-ul (JSON). Aplicările existente rămân."));
    const g=el("div","fgroup"); ta=el("textarea"); ta.style.cssText="width:100%;min-height:260px;background:none;border:0;outline:none;padding:12px;color:inherit;font-size:14px"; g.append(ta); b.append(g);
  });
});
$("#notifBtn").addEventListener("click",async()=>{
  if(state.notif){ state.notif=false; save(); try{ const LN=P.LocalNotifications; if(LN){ const p=await LN.getPending(); if(p.notifications.length) await LN.cancel({notifications:p.notifications.map(n=>({id:n.id}))}); } }catch(e){} renderSettings(); toast("Remindere oprite"); return; }
  enableNotifs();
});
$("#wipeBtn").addEventListener("click",(e)=>{ const b=e.currentTarget;
  if(!b.classList.contains("armed")){ b.classList.add("armed"); b.querySelector("small").textContent="Apasă din nou pentru confirmare"; haptic("heavy"); setTimeout(()=>{ b.classList.remove("armed"); b.querySelector("small").textContent="Apasă de două ori"; },3500); return; }
  for(const a of live()) tombstone(a); touch(); syncNotifs(); render(); b.classList.remove("armed"); toast(state.auth?"Toate datele au fost șterse, pe toate dispozitivele":"Toate datele au fost șterse"); });

/* ---------- config ---------- */
async function fetchJson(url){ const r=await fetch(url,{cache:"no-store",credentials:"omit"}); if(!r.ok) throw new Error("HTTP "+r.status); return r.json(); }
let CFG={scanUrl:"",sbUrl:"",sbKey:""};
async function getConfig(){
  let c={}; try{ c=await fetchJson("config.json")||{}; }catch(e){}
  const sbUrl=(typeof c.supabaseUrl==="string"&&/^https:\/\/[a-z0-9-]{3,63}\.supabase\.co$/.test(c.supabaseUrl))?c.supabaseUrl:"";
  const sbKey=(typeof c.supabaseKey==="string"&&/^[A-Za-z0-9._-]{20,2000}$/.test(c.supabaseKey))?c.supabaseKey:"";
  CFG={scanUrl:(typeof c.scanUrl==="string"&&c.scanUrl.startsWith("https://"))?c.scanUrl:"", sbUrl:sbUrl&&sbKey?sbUrl:"", sbKey:sbUrl&&sbKey?sbKey:""};
}

/* ---------- modules ---------- */
function setModule(m){ state.module=m==="design"?"design":"career"; document.body.dataset.mod=state.module; filter="all";
  document.querySelectorAll("#modsw button").forEach(b=>b.setAttribute("aria-selected",String(b.dataset.mod===state.module)));
  save(); render(); }
document.querySelectorAll("#modsw button").forEach(b=>b.addEventListener("click",()=>{ if(b.dataset.mod!==state.module){ haptic(); setModule(b.dataset.mod); } }));

/* ---------- MAZDA scan feed ---------- */
/* Scan items get an id derived from their key, so the phone and the Mac create the same id and sync merges them. */
const scanId=(key)=>"sc"+(hash(key)>>>0).toString(36)+(hash("mazda:"+key)>>>0).toString(36);
let scanBusy=false;
async function loadScan(manual){
  if(scanBusy) return; scanBusy=true;
  let feed=null, remote=false;
  try{
    if(CFG.sbUrl&&state.auth){ try{ const r=await sbRest("jobs_feed?id=eq.main&select=data"); if(Array.isArray(r)&&r[0]&&r[0].data&&typeof r[0].data==="object"){ feed=r[0].data; remote=true; } }catch(e){} }
    if(!feed&&CFG.scanUrl){ try{ feed=await fetchJson(CFG.scanUrl+"?t="+Date.now()); remote=true; }catch(e){} }
    if(remote) state.feedCheckedAt=now();
    if(!feed){ try{ feed=await fetchJson("scan.json"); }catch(e){} }
  } finally { scanBusy=false; }
  if(manual) toast(remote?"Scanarea a fost verificată":"Nu am putut citi scanarea online; folosesc datele din aplicație");
  if(!feed||!Array.isArray(feed.items)||!dstr(feed.scannedAt)){ renderSettings(); return; }
  if(state.lastScan&&state.lastScan.date&&feed.scannedAt<state.lastScan.date){ renderSettings(); return; }
  const seen=new Set(state.scanSeen||[]); for(const a of state.apps) if(a.scanKey) seen.add(a.scanKey);
  const links=new Set(state.apps.map(a=>a.link).filter(Boolean)); const ids=new Set(state.apps.map(a=>a.id));
  const label=str(feed.label,80)||"Scanarea MAZDA"; const added={career:0,design:0};
  for(const it of feed.items.slice(0,100)){
    if(!it||typeof it!=="object") continue;
    const key=str(it.key,120); if(!key||seen.has(key)) continue; seen.add(key);
    const id=scanId(key); if(ids.has(id)) continue;
    const a=sanitizeApp({id,scanKey:key,track:it.track,company:it.company,role:it.role,link:it.link,location:it.location,mode:it.mode,cv:it.cv,notes:it.notes,scanScore:it.score,
      source:"Scanare MAZDA",priority:typeof it.score==="number"&&it.score>=60?"A":"B",stage:"todo",history:[{stage:"todo",at:now(),note:"Din "+label.toLowerCase()}]});
    if(!a) continue; if(a.link&&links.has(a.link)) continue;
    state.apps.push(a); ids.add(id); added[a.track]++;
  }
  /* Postings MAZDA found closed: remove them everywhere, but only if Mihnea never touched them
     (still "De aplicat", no stage change). Matched by scan key or by link (older imports have no key). */
  let removedN=0;
  if(Array.isArray(feed.removed)){
    const gone=new Set(feed.removed.slice(0,300).map(x=>str(x,600)).filter(Boolean));
    for(const a of state.apps.slice()){
      if(a.deleted||a.source!=="Scanare MAZDA"||a.stage!=="todo"||(a.history||[]).length>1) continue;
      if((a.scanKey&&gone.has(a.scanKey))||(a.link&&gone.has(a.link))){ tombstone(a); removedN++; }
    }
  }
  const updN=applyUpdates(feed.updates);
  state.scanSeen=[...seen].slice(-500);
  if(!state.lastScan||state.lastScan.date!==feed.scannedAt) state.lastScan={date:dstr(feed.scannedAt),label:label,found:Math.min(feed.items.length,100),closed:Array.isArray(feed.closed)?feed.closed.slice(0,8).map(t=>str(t,300)):[]};
  const n=added.career+added.design;
  if(n||removedN||updN) touch(); else save(); render();
  if(removedN) setTimeout(()=>toast(removedN+(removedN===1?" anunț închis a fost scos":" anunțuri închise au fost scoase")+" din listă"),n?2400:0);
  if(updN) setTimeout(()=>toast(updN===1?"O aplicare și-a schimbat etapa":updN+" aplicări și-au schimbat etapa"),(n||removedN)?4800:0);
  if(n){ const parts=[]; if(added.career) parts.push(added.career+" în Carieră"); if(added.design) parts.push(added.design+" în Design"); toast("Din scanarea MAZDA: "+parts.join(", ")); }
}
/* Stage updates MAZDA records after it submits an application or reads an employer's email (ADR-0006).
   Each update moves one application to a new stage, unless Mihnea changed it later himself:
   an update applies only when the stage differs and it is newer than every non-"De aplicat" history entry,
   so applying the same feed again changes nothing. */
function updTime(at){ const s=str(at,40); if(!s) return 0; const d=Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(s)?s+"T12:00:00":s); return isNaN(d)?0:d; }
function applyUpdates(list){
  if(!Array.isArray(list)) return 0; let changed=0;
  const sorted=list.slice(0,300).filter(u=>u&&typeof u==="object"&&ST[u.stage]).map(u=>({u,t:updTime(u.at)})).filter(x=>x.t).sort((x,y)=>x.t-y.t);
  for(const {u,t} of sorted){
    const key=str(u.key,120), link=str(u.link,600);
    let a=state.apps.find(x=>!x.deleted&&((key&&x.scanKey===key)||(link&&x.link===link)));
    if(!a){
      const company=str(u.company,120); if(!company||!(key||link)) continue;
      const id=scanId("upd:"+(key||link)); if(state.apps.some(x=>x.id===id)) continue;
      a=sanitizeApp({id,scanKey:key||undefined,track:u.track,company,role:u.role,link,source:"Scanare MAZDA",stage:"todo",history:[{stage:"todo",at:t-1,note:"Adăugat de MAZDA"}]});
      if(!a) continue; state.apps.push(a);
    }
    /* "De aplicat" entries come from imports, so only a later real stage change by Mihnea blocks the update. */
    const last=(a.history||[]).reduce((m,h)=>h.stage!=="todo"?Math.max(m,h.at||0):m,0);
    if(a.stage===u.stage||t<=last) continue;
    a.stage=u.stage; a.history=(a.history||[]).concat([{stage:u.stage,at:t,note:str(u.note,200)||"Actualizat de MAZDA"}]);
    if(u.stage==="applied"&&!a.appliedAt) a.appliedAt=t;
    a.updatedAt=now(); changed++;
  }
  return changed;
}
function renderScan(){
  const c=$("#scanCard"); if(!c) return; const ls=state.lastScan; c.hidden=!ls; if(!ls) return;
  $("#scanSub").textContent=fmtD.format(dateOf(ls.date));
  const box=$("#scanBody"); box.textContent="";
  const list=mine().filter(a=>a.source==="Scanare MAZDA"&&a.stage==="todo").sort((x,y)=>(score(y)||0)-(score(x)||0));
  if(list.length){ for(const a of list.slice(0,4)){ const b=el("button","li"); b.append(avatar(a.company)); const m=el("div","m"); m.append(el("b",null,a.role||a.company),el("span",null,a.company)); const sc=score(a);
      const w=el("span","when",sc!=null?String(sc):"verifică"); if(sc!=null) w.style.color=scoreColor(sc); b.append(m,w); b.addEventListener("click",()=>openDetail(a.id)); box.append(b); }
    if(list.length>4){ const more=el("button","txtbtn","Încă "+(list.length-4)+" în Aplicări"); more.style.marginTop="6px"; more.addEventListener("click",()=>{ filter="todo"; go("list"); }); box.append(more); } }
  else box.append(el("p","empty",state.module==="design"?"Niciun anunț de design nou din scanare.":"Toate anunțurile din scanare au fost procesate."));
  if(state.module==="career"&&ls.closed&&ls.closed.length){ const d=el("details","closed"); const sm=el("summary",null,"Programe închise acum ("+ls.closed.length+")"); d.append(sm); for(const t of ls.closed) d.append(el("p",null,t)); box.append(d); }
}

/* ---------- sync (Supabase, ADR-0005) ---------- */
/* The phone and the Mac each keep a full local copy. Sync = pull all rows, keep the newer version of each
   application (last write wins on updatedAt), push what is newer locally. Deletions travel as tombstones. */
let syncT=null, syncing=false, syncAgain=false, refreshP=null;
function scheduleSync(){ if(!state.auth||!CFG.sbUrl) return; clearTimeout(syncT); syncT=setTimeout(()=>syncNow(false),1500); }
function sbHeaders(tok){ const h={"apikey":CFG.sbKey,"Content-Type":"application/json"}; if(tok) h.Authorization="Bearer "+tok; return h; }
async function sbAuth(path,body,tok){
  const r=await fetch(CFG.sbUrl+"/auth/v1/"+path,{method:"POST",headers:sbHeaders(tok||null),body:JSON.stringify(body||{}),cache:"no-store",credentials:"omit"});
  let j=null; try{ j=await r.json(); }catch(e){}
  if(!r.ok){ const e=new Error(str(j&&(j.msg||j.error_description||j.message),160)||("HTTP "+r.status)); e.status=r.status; throw e; }
  return j;
}
function setSession(j){
  if(!j||typeof j.access_token!=="string"||typeof j.refresh_token!=="string"||!j.user||typeof j.user.id!=="string") throw new Error("Răspuns de autentificare invalid");
  const au=cleanAuth({at:j.access_token,rt:j.refresh_token,uid:j.user.id,email:j.user.email||"",exp:Date.now()+(Number(j.expires_in)||3600)*1000});
  if(!au) throw new Error("Sesiune invalidă"); state.auth=au; save();
}
async function token(){
  if(!state.auth) throw new Error("Neconectat");
  if(state.auth.exp-60000>Date.now()) return state.auth.at;
  if(!refreshP) refreshP=(async()=>{ try{ setSession(await sbAuth("token?grant_type=refresh_token",{refresh_token:state.auth.rt})); }
    catch(e){ if(e.status===400||e.status===401||e.status===403){ state.auth=null; state.syncErr="Sesiunea a expirat; conectează-te din nou"; save(); renderSettings(); } throw e; }
    finally{ refreshP=null; } })();
  await refreshP; return state.auth.at;
}
async function sbRest(path,opts){
  opts=opts||{};
  const r=await fetch(CFG.sbUrl+"/rest/v1/"+path,{method:opts.method||"GET",headers:Object.assign(sbHeaders(await token()),opts.headers||{}),body:opts.body,cache:"no-store",credentials:"omit"});
  if(!r.ok){ const e=new Error("Serverul a răspuns "+r.status); e.status=r.status; throw e; }
  if(opts.noBody||r.status===204) return null; const t=await r.text(); return t?JSON.parse(t):null;
}
async function syncNow(manual){
  if(!CFG.sbUrl||!state.auth){ if(manual) toast("Conectează-te mai întâi"); return false; }
  if(syncing){ syncAgain=true; return false; } syncing=true;
  try{
    const rows=await sbRest("jobs_apps?select=id,data,updated_at,deleted&limit=5000");
    const remote=new Map(); let changed=false;
    for(const r of Array.isArray(rows)?rows:[]){
      if(!r||typeof r.id!=="string") continue; const ua=Number(r.updated_at)||0; remote.set(r.id,ua);
      const i=state.apps.findIndex(a=>a.id===r.id); if(i>=0&&(state.apps[i].updatedAt||0)>=ua) continue;
      const d=(r.data&&typeof r.data==="object")?r.data:{};
      const x=sanitizeApp(Object.assign({},d,{id:r.id,updatedAt:ua,deleted:r.deleted===true,company:d.company||"(șters)"}));
      if(!x) continue; if(i>=0) state.apps[i]=x; else state.apps.push(x); changed=true;
    }
    const push=state.apps.filter(a=>!remote.has(a.id)||(a.updatedAt||0)>remote.get(a.id));
    for(let k=0;k<push.length;k+=200){
      const body=JSON.stringify(push.slice(k,k+200).map(a=>({user_id:state.auth.uid,id:a.id,data:a,updated_at:a.updatedAt||now(),deleted:a.deleted===true})));
      await sbRest("jobs_apps?on_conflict=user_id,id",{method:"POST",headers:{"Prefer":"resolution=merge-duplicates,return=minimal"},body,noBody:true});
    }
    state.syncAt=now(); state.syncErr=""; save();
    if(changed){ render(); syncNotifs(); } else renderSettings();
    if(manual){ toast("Sincronizat"); haptic("success"); }
    return true;
  }catch(e){ state.syncErr=str(e&&e.message,160)||"eroare"; renderSettings(); if(manual) toast("Sincronizarea a eșuat: "+state.syncErr); return false; }
  finally{ syncing=false; if(syncAgain){ syncAgain=false; scheduleSync(); } }
}
function openSync(){
  openSheet((b)=>{
    if(!CFG.sbUrl){ head(b,"Sincronizare",{label:"Închide",fn:closeSheet});
      b.append(el("p","fgroup-h","Sincronizarea nu e configurată în această versiune a aplicației. După configurarea Supabase, instalează versiunea nouă.")); return; }
    if(state.auth){
      head(b,"Sincronizare",{label:"Închide",fn:closeSheet});
      const g=el("div","fgroup"); b.append(g);
      const kv=(k,v)=>{ const r=el("div","kv"); r.append(el("span",null,k),el("b",null,v)); g.append(r); };
      kv("Cont",state.auth.email||"conectat");
      kv("Ultima sincronizare",state.syncAt?new Intl.DateTimeFormat("ro-RO",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(state.syncAt)):"încă nu");
      if(state.syncErr) kv("Ultima eroare",state.syncErr);
      const br=el("div","btnrow"); const go1=el("button","bigbtn","Sincronizează acum"); go1.addEventListener("click",async()=>{ go1.disabled=true; await syncNow(true); await loadScan(false); go1.disabled=false; closeSheet(); }); br.append(go1); b.append(br);
      const out=el("button","bigbtn danger","Deconectează acest dispozitiv"); out.addEventListener("click",async()=>{
        if(!out.classList.contains("armed")){ out.classList.add("armed"); out.textContent="Apasă din nou ca să te deconectezi"; haptic("heavy"); setTimeout(()=>{ out.classList.remove("armed"); out.textContent="Deconectează acest dispozitiv"; },3500); return; }
        try{ await sbAuth("logout",{},state.auth.at); }catch(e){}
        state.auth=null; state.syncAt=null; state.syncErr=""; save(); closeSheet(); renderSettings(); toast("Deconectat. Datele rămân pe acest dispozitiv."); });
      const br2=el("div","btnrow"); br2.style.marginTop="8px"; br2.append(out); b.append(br2);
      b.append(el("p","fgroup-h","Aceleași aplicări apar pe telefon și pe Mac. Modificările se trimit automat, în câteva secunde."));
      return;
    }
    head(b,"Conectează-te",{label:"Anulează",fn:closeSheet});
    b.append(el("p","fgroup-h","Primești un cod pe email. Folosește același email pe telefon și pe Mac."));
    const g=el("div","fgroup"); b.append(g);
    const fE=field(g,"Email","email","",{placeholder:"nume@exemplu.ro"}); fE.autocomplete="email"; fE.maxLength=200;
    const fC=field(g,"Cod","text","",{placeholder:"codul din email"}); fC.inputMode="numeric"; fC.autocomplete="one-time-code"; fC.maxLength=12; fC.parentNode.hidden=true;
    const br=el("div","btnrow"); const btn=el("button","bigbtn","Trimite codul"); br.append(btn); b.append(br);
    let step=0;
    btn.addEventListener("click",async()=>{
      if(btn.disabled) return; const email=fE.value.trim().toLowerCase();
      if(!/^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/.test(email)){ toast("Email invalid"); fE.focus(); return; }
      btn.disabled=true;
      try{
        if(step===0){ await sbAuth("otp",{email,create_user:true}); step=1; fC.parentNode.hidden=false; fE.readOnly=true; btn.textContent="Verifică codul"; toast("Codul a fost trimis pe email"); fC.focus(); }
        else { const code=fC.value.replace(/\s/g,""); if(!/^\d{6,10}$/.test(code)){ toast("Codul are 6–10 cifre"); return; }
          setSession(await sbAuth("verify",{type:"email",email,token:code})); closeSheet(); haptic("success"); toast("Conectat. Sincronizez…");
          await syncNow(true); await loadScan(false); }
      }catch(e){ toast(step===0?"Nu am putut trimite codul: "+e.message:"Cod greșit sau expirat"); }
      finally{ btn.disabled=false; }
    });
    setTimeout(()=>fE.focus(),350);
  });
}
$("#syncBtn").addEventListener("click",openSync);

/* ---------- native glue ---------- */
async function native(){
  try{ if(P.StatusBar){ await P.StatusBar.setStyle({style:"DARK"}); await P.StatusBar.setOverlaysWebView({overlay:true}); } }catch(e){}
  try{ if(P.App) P.App.addListener("resume",async()=>{ await syncNow(false); loadScan(false); }); }catch(e){}
  try{ if(P.App) P.App.addListener("backButton",()=>{ if(sheetOpen) closeSheet(); else if(tab!=="home") go("home"); else P.App.exitApp(); }); }catch(e){}
  try{ if(P.LocalNotifications) P.LocalNotifications.addListener("localNotificationActionPerformed",(ev)=>{ const n=ev&&ev.notification; if(!n) return; const a=live().find(x=>nid(x.id)===n.id||nid(x.id+"dl")===n.id); if(a){ if(a.track!==state.module) setModule(a.track); openDetail(a.id); } }); }catch(e){}
}

/* ---------- boot ---------- */
(async()=>{
  await load(); await getConfig(); setModule(state.module); go("home"); native();
  if(state.auth) await syncNow(false);
  await loadScan(); if(state.notif) syncNotifs();
  if(!NATIVE){
    document.addEventListener("visibilitychange",async()=>{ if(document.visibilityState==="visible"){ await syncNow(false); loadScan(false); } });
    setInterval(()=>{ if(document.visibilityState==="visible") syncNow(false); },60000);
    if("serviceWorker" in navigator&&location.protocol==="https:") navigator.serviceWorker.register("sw.js").catch(()=>{});
  }
})();
if(!NATIVE) window.__mazdaJobs={state:()=>state};
})();
