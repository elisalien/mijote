"use strict";
/* Mijote — logique de l'app : état, rendu des vues, sync foyer.
   Données statiques (saisons, recettes…) : js/data.js */

const APP_VERSION="1.3.0";

/* ============================ UTILS ============================ */
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const DAYS=["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"];
const DAYS_SHORT=["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
const MEALS=[["midi","Midi","sun"],["soir","Soir","moon"]];
const ESC_MAP={"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"};
const _normCache=new Map();

// minuscules sans accents, mémoïsé (appelé des milliers de fois par rendu)
function norm(s){
  s=s==null?"":String(s);
  let v=_normCache.get(s);
  if(v===undefined){
    v=s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();
    if(_normCache.size<20000)_normCache.set(s,v);
  }
  return v;
}
function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,c=>ESC_MAP[c]); }
function icon(id,cls){ return `<svg class="i${cls?" "+cls:""}" aria-hidden="true"><use href="#i-${id}"/></svg>`; }
function plural(n,word){ return `${n} ${word}${n>1?"s":""}`; }
function uid(){ return "u"+Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
function debounce(fn,ms){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; }
function shuffle(a){ a=a.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
function safeUrl(u){ return /^https?:\/\//i.test(String(u||""))?u:""; }
function toast(m){
  const t=$("#toast"); t.textContent=m; t.classList.add("show");
  clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove("show"),2400);
}

/* ============================ STOCKAGE & ÉTAT ============================ */
function load(k,d){ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):d; }catch(e){ return d; } }
const _savedJson={};
// n'écrit que les clés modifiées (la base de recettes pèse ~170 Ko)
function save(k,v){
  try{
    const s=JSON.stringify(v);
    if(_savedJson[k]===s)return;
    localStorage.setItem(k,s); _savedJson[k]=s;
  }catch(e){}
}

// [champ d'état, clé localStorage, valeur par défaut]
const STORE=[
  ["recipes","mijote_recipes",null],
  ["fridge","mijote_fridge",[]],        // [{id,name,openedTs,keepDays}]
  ["plan","mijote_plan",{}],            // {0:{midi:[],soir:[]}} ; "L:<id>" = restes
  ["dislikes","mijote_dislikes",DEFAULT_DISLIKES],
  ["vegan","mijote_vegan",false],
  ["shopChecked","mijote_shop",{}],
  ["jars","mijote_jars",[]],            // [{id,recipeId,name,start,readyHours,bestHours,keepDays}]
  ["vegOnly","mijote_vegonly",true],
  ["validated","mijote_validated",null],// clé du lundi de la semaine validée
  ["people","mijote_people",1],
  ["restes","mijote_restes",true],
  ["members","mijote_members",null],    // null = solo ; sinon [{id,name,dislikes,active}]
  ["householdId","mijote_household_id",null],
  ["householdCode","mijote_household_code",null],
  ["syncRev","mijote_sync_rev",0],
  ["memberId","mijote_member_id",null]
];
const LS_MIG="mijote_mig";
const state={};
STORE.forEach(([k,key,d])=>{ state[k]=load(key,d==null?d:JSON.parse(JSON.stringify(d))); });
if(!Array.isArray(state.recipes))state.recipes=SEED.map(r=>({...r}));
state.people=Math.max(1,state.people|0||1);
state.syncRev=state.syncRev|0;

function saveField(k){ const e=STORE.find(x=>x[0]===k); if(e)save(e[1],state[k]); }
function persist(opts){
  syncMemberDislikesFromState();
  STORE.forEach(([k,key])=>save(key,state[k]));
  if(!(opts&&opts.skipSync))schedulePush();
  updateSyncPills();
}

/* ---- migrations des bases déjà enregistrées ---- */
const seedNum=s=>parseInt((s.id||"").slice(1),10);
const SEED_MIGRATIONS=[
  ["eggpickles2",s=>/^r3[1-9]|^r4[0-2]/.test(s.id)],
  ["quick1",s=>!!s.quick],
  ["world1",s=>seedNum(s)>=53],
  ["simple2",s=>seedNum(s)>=121],
  ["simple3",s=>seedNum(s)>=161],
  ["tartines1",s=>seedNum(s)>=191],
  ["favoris1",s=>seedNum(s)>=205],
  ["euroveg1",s=>seedNum(s)>=245]
];
// recettes en double retirées de la base en 1.3.0 → recette conservée
const DUPLICATE_IDS={r211:"r169",r279:"r124"};

function runMigrations(){
  const done=load(LS_MIG,[]); let changed=false;
  const mark=name=>{ done.push(name); changed=true; };
  if(!done.includes("concombre")){
    if(!state.dislikes.some(d=>norm(d).includes("concombre")))state.dislikes.push("concombre");
    mark("concombre");
  }
  SEED_MIGRATIONS.forEach(([name,test])=>{
    if(done.includes(name))return;
    const have=new Set(state.recipes.map(r=>r.id));
    SEED.forEach(s=>{ if(test(s)&&!have.has(s.id))state.recipes.push({...s}); });
    mark(name);
  });
  // frigo unifié : anciens noms (strings) → objets, fusion du tracker « aliments ouverts »
  if(!done.includes("unifridge1")){
    normalizeFridge();
    load("mijote_opened",[]).forEach(o=>state.fridge.push({id:o.id||uid(),name:o.name,openedTs:o.openedTs||Date.now(),keepDays:o.keepDays||4}));
    mark("unifridge1");
  }
  try{ localStorage.removeItem("mijote_opened"); }catch(e){}
  if(!done.includes("dedupe130")){
    state.recipes=state.recipes.filter(r=>!(DUPLICATE_IDS[r.id]&&!r.custom));
    const exists=id=>state.recipes.some(r=>r.id===id);
    const remap=id=>{
      if(typeof id!=="string")return id;
      const b=baseId(id), to=DUPLICATE_IDS[b];
      if(!to||exists(b)||!exists(to))return id;
      return isLeftover(id)?LEFT_PREFIX+to:to;
    };
    Object.values(state.plan||{}).forEach(p=>{
      if(p&&typeof p==="object")["midi","soir"].forEach(k=>{ if(Array.isArray(p[k]))p[k]=p[k].map(remap); });
    });
    (state.jars||[]).forEach(j=>{ j.recipeId=remap(j.recipeId); });
    mark("dedupe130");
  }
  if(changed){ save(LS_MIG,done); persist(); }
}

/* ============================ NATIF (Capacitor) ============================ */
const isNative=!!(window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform());
const CapPlugins=(window.Capacitor&&window.Capacitor.Plugins)||{};
if(isNative)document.documentElement.classList.add("is-native");

async function copyText(txt){
  try{ if(CapPlugins.Clipboard&&CapPlugins.Clipboard.write){ await CapPlugins.Clipboard.write({string:txt}); return true; } }catch(e){}
  try{ if(navigator.clipboard&&navigator.clipboard.writeText){ await navigator.clipboard.writeText(txt); return true; } }catch(e){}
  try{
    const ta=document.createElement("textarea");
    ta.value=txt; ta.setAttribute("readonly",""); ta.style.cssText="position:fixed;left:-9999px";
    document.body.appendChild(ta); ta.select();
    const ok=document.execCommand("copy");
    ta.remove();
    return !!ok;
  }catch(e){ return false; }
}
async function shareOrCopy(text,copyLabel){
  if(isNative&&CapPlugins.Share){
    try{ await CapPlugins.Share.share({title:"Mijote",text,dialogTitle:"Partager"}); return; }catch(e){}
  }
  toast(await copyText(text)?`${copyLabel} copié`:"Copie impossible");
}
async function exportJsonFile(dataStr,filename){
  if(isNative&&CapPlugins.Share){
    try{
      if(CapPlugins.Filesystem&&CapPlugins.Filesystem.writeFile){
        await CapPlugins.Filesystem.writeFile({path:filename,data:dataStr,directory:"CACHE",encoding:"utf8"});
        const {uri}=await CapPlugins.Filesystem.getUri({path:filename,directory:"CACHE"});
        await CapPlugins.Share.share({title:"Export Mijote",url:uri,dialogTitle:"Exporter la sauvegarde"});
      }else{
        await CapPlugins.Share.share({title:"Export Mijote",text:dataStr,dialogTitle:"Exporter la sauvegarde"});
      }
      return true;
    }catch(e){ /* repli navigateur */ }
  }
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([dataStr],{type:"application/json"}));
  a.download=filename; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),2000);
  return true;
}

/* ============================ FEUILLES & DIALOGUES ============================ */
function syncScrollLock(){
  document.documentElement.classList.toggle("sheet-open",$$(".modal-bg.open,.dlg-bg.open").length>0);
}
function openSheet(bg,box,html){
  const el=$(box); el.innerHTML=html; el.scrollTop=0;
  $(bg).classList.add("open"); syncScrollLock();
}
function closeModal(){ $("#modalBg").classList.remove("open"); syncScrollLock(); }
function closePick(){ $("#pickBg").classList.remove("open"); syncScrollLock(); }
const closeBtn=act=>`<button type="button" class="icon-btn sheet-close" data-act="${act}" aria-label="Fermer">${icon("x")}</button>`;

let dlgCancel=null;
function closeDlg(){
  $("#dlgBg").classList.remove("open"); $("#dlg").innerHTML=""; syncScrollLock();
  const cancel=dlgCancel; dlgCancel=null; if(cancel)cancel();
}
// confirm (sans input → true/false) ou prompt (input → texte/null)
function showDialog({title,message,input,okLabel="OK",cancelLabel="Annuler",danger=false}){
  return new Promise(resolve=>{
    const hasInput=input!==undefined, cancelValue=hasInput?null:false;
    $("#dlg").innerHTML=`${title?`<h2 class="dlg-title">${esc(title)}</h2>`:""}<p class="dlg-msg">${esc(message)}</p>
      <form class="dlg-form" id="dlgForm">
        ${hasInput?`<input id="dlgInput" type="text" value="${esc(input)}" autocomplete="off" enterkeyhint="done" aria-label="${esc(title||message)}">`:""}
        <div class="dlg-actions">
          <button type="button" class="btn" id="dlgCancel">${esc(cancelLabel)}</button>
          <button type="submit" class="btn ${danger?"danger-solid":"primary"}">${esc(okLabel)}</button>
        </div>
      </form>`;
    $("#dlgBg").classList.add("open"); syncScrollLock();
    dlgCancel=()=>resolve(cancelValue);
    const finish=v=>{ dlgCancel=null; closeDlg(); resolve(v); };
    $("#dlgCancel").onclick=()=>finish(cancelValue);
    $("#dlgForm").onsubmit=e=>{ e.preventDefault(); finish(hasInput?$("#dlgInput").value:true); };
    const focusEl=hasInput?$("#dlgInput"):$("#dlgForm [type=submit]");
    setTimeout(()=>{ focusEl.focus(); if(hasInput)focusEl.select(); },50);
  });
}
const showConfirm=(message,opts={})=>showDialog({...opts,message,title:opts.title||"Confirmation"});
const showPrompt=(message,opts={})=>showDialog({...opts,message,input:opts.defaultValue==null?"":String(opts.defaultValue)});

const OVERLAYS=[["#dlgBg",closeDlg],["#pickBg",closePick],["#modalBg",closeModal]];
function closeTopOverlay(){
  for(const [sel,close] of OVERLAYS){ if($(sel).classList.contains("open")){ close(); return true; } }
  return false;
}
OVERLAYS.forEach(([sel,close])=>$(sel).addEventListener("click",e=>{ if(e.target===e.currentTarget)close(); }));

/* ============================ PORTIONS & RESTES ============================ */
const LEFT_PREFIX="L:";
function isLeftover(id){ return typeof id==="string"&&id.startsWith(LEFT_PREFIX); }
function baseId(id){ return isLeftover(id)?id.slice(LEFT_PREFIX.length):id; }
function recipeOf(id){ const b=baseId(id); return state.recipes.find(x=>x.id===b); }
const UNICODE_FRAC={"½":.5,"⅓":1/3,"⅔":2/3,"¼":.25,"¾":.75,"⅕":.2,"⅖":.4,"⅗":.6,"⅘":.8,"⅙":1/6,"⅛":.125,"⅜":.375,"⅝":.625,"⅞":.875};
// valeur numérique d'une quantité texte ("2", "1/2", "½", "2-3", "1,5") ; null si non numérique
function parseQty(str){
  if(str==null)return null;
  let s=String(str).trim(); if(!s)return null;
  for(const [g,v] of Object.entries(UNICODE_FRAC)){
    if(s.includes(g)){ const b=parseFloat(s.replace(g,"").replace(",",".").trim()); return (isNaN(b)?0:b)+v; }
  }
  s=s.replace(",",".");
  let m=s.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/); if(m)return parseFloat(m[1])/parseFloat(m[2]);
  m=s.match(/^(\d+(?:\.\d+)?)\s*[-àa]\s*(\d+(?:\.\d+)?)/); if(m)return (parseFloat(m[1])+parseFloat(m[2]))/2;
  m=s.match(/^(\d+(?:\.\d+)?)/); if(m)return parseFloat(m[1]);
  return null;
}
// arrondi lisible pour l'affichage
function fmtQty(n){
  if(n==null||isNaN(n))return "";
  if(n>=100)return String(Math.round(n/5)*5);
  if(n>=10)return String(Math.round(n));
  const r=n>=1?Math.round(n*2)/2:Math.round(n*4)/4;
  return String(r).replace(".",",");
}
function scaleFactor(r){ return state.people/((r&&r.servings)||1); }

/* ============================ PROFILS & GOÛTS ============================ */
function inHousehold(){ return !!(state.householdId&&state.householdCode); }
function currentMember(){
  if(!state.members||!state.members.length)return null;
  return state.members.find(m=>m.id===state.memberId)||state.members[0];
}
function findMember(id){ return (state.members||[]).find(m=>m.id===id); }
// solo : mes goûts ; foyer : union des profils actifs
function effectiveDislikes(){
  if(!(inHousehold()&&state.members&&state.members.length))return state.dislikes||[];
  const out=[], seen=new Set();
  state.members.filter(m=>m&&m.active!==false).forEach(m=>(m.dislikes||[]).forEach(d=>{
    const k=norm(d); if(k&&!seen.has(k)){ seen.add(k); out.push(d); }
  }));
  return out;
}
function syncMemberDislikesFromState(){
  if(!inHousehold())return;
  const m=currentMember(); if(m)m.dislikes=(state.dislikes||[]).slice();
}
function applyMemberDislikesToState(){
  const m=currentMember(); if(m)state.dislikes=(m.dislikes||[]).slice();
}
function ensureMembersFromSolo(name){
  const id=uid();
  state.members=[{id,name:(name||"").trim()||"Moi",dislikes:(state.dislikes||[]).slice(),active:true}];
  state.memberId=id;
}

// cache : goûts normalisés + ingrédients « non aimés » par recette
let _disKey=null, _disList=[], _disHits=new WeakMap();
function dislikeMatchers(){
  const list=effectiveDislikes(), key=list.join("");
  if(key!==_disKey){ _disKey=key; _disList=list.map(d=>[d,norm(d)]).filter(x=>x[1]); _disHits=new WeakMap(); }
  return _disList;
}
function invalidateRecipeCache(){ _disKey=null; }
function dislikeHit(text,matchers){
  const n=norm(text);
  for(const [d,dn] of matchers){
    // "olives" ne doit pas matcher "huile d'olive"
    if(dn==="olives"||dn==="olive"){ if(/\bolives?\b/.test(n)&&!/huile/.test(n))return d; continue; }
    if(dn==="tomates crues"){ if(/tomate/.test(n)&&!/cuit|concass|sauce|mijot/.test(n))return d; continue; }
    if(dn==="oignons crus"){ if(/oignon/.test(n)&&!/cuit|fondu|revenu|caram|vert|nouveau|cive|ciboul/.test(n))return d; continue; }
    // yaourt : accepté cuit dans un plat, exclu seulement nature
    if(dn==="yaourt"){ if(/yaourt/.test(n)&&!/coco|soja|vegetal|a cuire|cuire/.test(n)&&/nature|grec|brass|au petit|petit.?dej|seul|bol de/.test(n))return d; continue; }
    if(n.includes(dn))return d;
  }
  return null;
}
function recipeDislikes(r){
  const matchers=dislikeMatchers();
  let hits=_disHits.get(r);
  if(!hits){
    const s=new Set();
    (r.ing||[]).forEach(i=>{ const h=dislikeHit(i[2],matchers); if(h)s.add(h); });
    hits=[...s]; _disHits.set(r,hits);
  }
  return hits;
}

/* ---- régime & saison ---- */
function isVeganView(r){ return r.vegan||(state.vegan&&r.veganSwap); }
function dietOf(r){ return r.diet||(r.vegan?"vegan":(r.veganSwap?"veganizable":"vegetarien")); }
function isVegMe(r){ const d=dietOf(r); return d!=="poisson"&&d!=="viande"; }
function dietBadgeClass(r){ const d=dietOf(r); return d==="poisson"?"fish":(d==="viande"?"meat":"veg"); }
function dietLabel(r){
  const d=dietOf(r);
  return d==="vegan"?"Vegan":d==="veganizable"?"Vegan possible":d==="poisson"?"Poisson":d==="viande"?"Viande":"Végétarien";
}
function currentMonth(){ return new Date().getMonth()+1; }
function inSeason(r){ return !r.season||!r.season.length||r.season.includes(currentMonth()); }
function seasonalTag(r){ return r.season&&r.season.length&&r.season.length<12&&r.season.includes(currentMonth()); }
// filtres communs : régime de l'appareil, vegan, goûts du foyer
function allowedRecipe(r){ return (!state.vegOnly||isVegMe(r))&&(!state.vegan||isVeganView(r))&&!recipeDislikes(r).length; }

/* ============================ NAVIGATION ============================ */
let currentView="accueil";
const VIEW_RENDER={
  accueil:()=>renderHome(),
  frigo:()=>{ renderFridge(); renderFridgeResults(); renderJars(); },
  recettes:()=>renderRecipes(),
  semaine:()=>renderWeek(),
  courses:()=>renderShop(),
  reglages:()=>{ renderDislikes(); updateSharedUi(); }
};
function refreshView(){ (VIEW_RENDER[currentView]||(()=>{}))(); }
function activateView(v){
  if(!$("#v-"+v))return;
  currentView=v;
  $$(".view").forEach(x=>x.classList.toggle("active",x.id==="v-"+v));
  $$("#tabs [data-v],#bottomNav [data-v],.h-actions [data-v]").forEach(x=>{
    const on=x.dataset.v===v;
    x.classList.toggle("active",on);
    if(on)x.setAttribute("aria-current","page"); else x.removeAttribute("aria-current");
  });
  refreshView();
}
function gotoTab(v){ activateView(v); window.scrollTo(0,0); }

// actions déclenchées par data-act (délégation : aucun onclick inline)
const ACTIONS={
  "open-recipe":el=>openRecipe(el.dataset.id),
  "close-modal":()=>closeModal(),
  "close-pick":()=>closePick(),
  "add-recipe":()=>startAddRecipe(),
  "edit-recipe":el=>editRecipe(el.dataset.id),
  "delete-recipe":el=>deleteRecipe(el.dataset.id),
  "plan-recipe":el=>{ closeModal(); openPicker(null,el.dataset.id); },
  "copy-shop":()=>copyShop()
};
document.addEventListener("click",e=>{
  const a=e.target.closest("[data-act]");
  if(a&&ACTIONS[a.dataset.act]){ e.preventDefault(); ACTIONS[a.dataset.act](a,e); return; }
  const v=e.target.closest("[data-v]");
  if(v){ e.preventDefault(); gotoTab(v.dataset.v); }
});
document.addEventListener("keydown",e=>{
  if(e.key==="Escape"&&closeTopOverlay()){ e.preventDefault(); return; }
  if((e.key==="Enter"||e.key===" ")&&e.target.matches("[role=button][data-act]")){ e.preventDefault(); e.target.click(); }
});

/* ============================ FRIGO ============================ */
function normalizeFridge(){
  state.fridge=(state.fridge||[]).map(f=>typeof f==="string"
    ?{id:uid(),name:f,openedTs:null,keepDays:null}
    :{id:f&&f.id||uid(),name:f&&f.name,openedTs:f&&f.openedTs||null,keepDays:f&&f.keepDays||null}
  ).filter(f=>f.name);
}
function fridgeNames(){ return state.fridge.map(f=>norm(f.name)).filter(Boolean); }
function matchesAny(n,names){ return !!n&&names.some(h=>n.includes(h)||h.includes(n)); }
function inFridge(name,names){ return matchesAny(norm(name),names||fridgeNames()); }
function openedStatus(o){
  const elapsed=(Date.now()-o.openedTs)/86400000, left=o.keepDays-elapsed;
  const pct=Math.max(3,Math.min(100,Math.round(elapsed/o.keepDays*100)));
  return {left,pct,cls:left<0?"late":(left<=2?"soon":"ok")};
}
function fridgeExpiry(f){ return (f.openedTs&&f.keepDays)?openedStatus(f):null; }
// aliments datés à ≤ 2 j (ou périmés), du plus urgent au moins urgent
function fridgeSoon(){
  return state.fridge.map(f=>({f,s:fridgeExpiry(f)})).filter(x=>x.s&&x.s.left<=2).sort((a,b)=>a.s.left-b.s.left);
}
function shortLeft(left){ return left<0?"périmé":(left<1?"auj.":Math.floor(left)+" j"); }
function leftLabel(left){
  if(left<0)return `Périmé depuis ${Math.ceil(-left)} j`;
  if(left<1)return "À manger aujourd'hui";
  return `Encore ${Math.floor(left)} j`;
}

function renderFridge(){
  const wrap=$("#fridgeChips"), n=state.fridge.length;
  $("#fridgeInvCount").textContent=n?plural(n,"aliment"):"";
  if(!n){
    wrap.innerHTML=`<p class="empty">Rien pour l'instant. Ajoute ce qu'il y a dans ton frigo ou ton placard.</p>`;
  }else{
    wrap.innerHTML=state.fridge.map(f=>({f,t:fridgeExpiry(f)})).sort((a,b)=>{
      if(!!a.t!==!!b.t)return a.t?-1:1;
      if(a.t&&b.t)return a.t.left-b.t.left;
      return norm(a.f.name).localeCompare(norm(b.f.name));
    }).map(({f,t})=>{
      const name=esc(f.name);
      return `<span class="fr-chip${t?" "+t.cls:""}" data-id="${esc(f.id)}"><span class="nm">${name}</span>${t?`<span class="dleft">${shortLeft(t.left)}</span>`:""}`+
        `<button type="button" class="chip-btn" data-fr="expiry" aria-label="${t?"Modifier la date":"Ajouter une date"} : ${name}">${icon("clock")}</button>`+
        `<button type="button" class="chip-btn" data-fr="remove" aria-label="Retirer ${name}">${icon("x")}</button></span>`;
    }).join("");
  }
  const have=new Set(fridgeNames());
  const sugg=SEASON[currentMonth()].filter(s=>!have.has(norm(s))).slice(0,8);
  $("#fridgeSugg").innerHTML=sugg.length?`<span class="sugg-lbl">De saison :</span>`+sugg.map(s=>`<button type="button" class="sugg-btn" data-add="${esc(s)}">+ ${esc(s)}</button>`).join(""):"";
}
function fridgeChanged(){ persist(); renderFridge(); renderFridgeResults(); }
function addFridge(value,days){
  const names=String(value||"").split(",").map(x=>x.trim()).filter(Boolean);
  if(!names.length)return;
  names.forEach(x=>{
    const ex=state.fridge.find(f=>norm(f.name)===norm(x));
    if(ex){ if(days){ ex.openedTs=Date.now(); ex.keepDays=Math.max(1,days); } }
    else state.fridge.push({id:uid(),name:x,openedTs:days?Date.now():null,keepDays:days?Math.max(1,days):null});
  });
  fridgeChanged();
}
async function setFridgeExpiry(f){
  const cur=f.openedTs&&f.keepDays?Math.max(0,Math.ceil((f.openedTs+f.keepDays*86400000-Date.now())/86400000)):"";
  const v=await showPrompt(`Dans combien de jours « ${f.name} » sera périmé ?\nLaisse vide pour retirer la date.`,{title:"Date de péremption",defaultValue:cur,okLabel:"Enregistrer"});
  if(v===null)return;
  const d=parseInt(v,10);
  if(!String(v).trim()||isNaN(d)){ f.openedTs=null; f.keepDays=null; }
  else{ f.openedTs=Date.now(); f.keepDays=Math.max(1,d); }
  fridgeChanged();
}
$("#fridgeChips").addEventListener("click",e=>{
  const b=e.target.closest("[data-fr]"); if(!b)return;
  const id=b.closest("[data-id]").dataset.id, f=state.fridge.find(x=>x.id===id); if(!f)return;
  if(b.dataset.fr==="expiry")setFridgeExpiry(f);
  else{ state.fridge=state.fridge.filter(x=>x!==f); fridgeChanged(); }
});
$("#fridgeSugg").addEventListener("click",e=>{ const b=e.target.closest("[data-add]"); if(b)addFridge(b.dataset.add); });
$("#fridgeAdd").onclick=()=>{
  const d=parseInt($("#fridgeDays").value,10);
  addFridge($("#fridgeInput").value,isNaN(d)?0:d);
  $("#fridgeInput").value=""; $("#fridgeDays").value="";
};
["#fridgeInput","#fridgeDays"].forEach(s=>$(s).addEventListener("keydown",e=>{ if(e.key==="Enter")$("#fridgeAdd").click(); }));
$("#fridgeDaysToggle").onclick=()=>{
  const f=$("#fridgeDays"), open=f.hidden;
  f.hidden=!open;
  $("#fridgeDaysToggle").setAttribute("aria-expanded",String(open));
  if(open)f.focus(); else f.value="";
};
function renderOpenedPresets(){
  $("#openedPresets").innerHTML=OPENED_PRESETS.map(p=>`<button type="button" data-n="${esc(p.n)}" data-d="${p.d}">${esc(p.n)} <span class="muted">${p.d} j</span></button>`).join("");
}
$("#openedPresets").addEventListener("click",e=>{
  const b=e.target.closest("[data-n]"); if(!b)return;
  addFridge(b.dataset.n,+b.dataset.d); toast(`${b.dataset.n} ajouté au frigo`);
});

function matchScore(r,have){
  let hit=0;
  r.ing.forEach(i=>{ if(matchesAny(norm(i[2]),have))hit++; });
  const total=r.ing.length;
  return {hit,total,pct:total?hit/total:0};
}
function renderFridgeResults(){
  const box=$("#fridgeResults"), have=fridgeNames();
  if(!have.length){
    $("#fridgeCount").textContent="";
    box.innerHTML=`<p class="empty">Ajoute des aliments à ton inventaire : les recettes possibles s'afficheront ici.</p>`;
    return;
  }
  const seasonOnly=$("#seasonOnly").checked;
  const list=state.recipes.filter(r=>allowedRecipe(r)&&(!seasonOnly||inSeason(r)))
    .map(r=>({r,s:matchScore(r,have)})).filter(x=>x.s.hit>0)
    .sort((a,b)=>b.s.pct-a.s.pct||b.s.hit-a.s.hit);
  $("#fridgeCount").textContent=list.length?plural(list.length,"recette"):"";
  box.innerHTML=list.length
    ?list.map(x=>recipeCardHtml(x.r,x.s)).join("")
    :`<p class="empty">Aucune recette ne colle à ton inventaire. Ajoute d'autres aliments ou retire le filtre « De saison ».</p>`;
}
$("#seasonOnly").onchange=renderFridgeResults;
$("#veganGlobal").onchange=()=>{ state.vegan=$("#veganGlobal").checked; persist(); renderFridgeResults(); };

/* ============================ BOCAUX ============================ */
function fmtDur(h){
  if(h<=0)return "0 h"; if(h<1)return "moins d'1 h";
  const d=Math.floor(h/24), r=Math.round(h%24);
  return d>0?(r?`${d} j ${r} h`:`${d} j`):`${Math.round(h)} h`;
}
function fmtDate(ts){ return new Date(ts).toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}); }
function jarStatus(j){
  const elapsedH=(Date.now()-j.start)/3600000, ready=elapsedH>=j.readyHours;
  const best=j.bestHours||j.readyHours, expired=j.keepDays&&elapsedH>=j.keepDays*24;
  const pct=ready?100:Math.max(4,Math.min(100,Math.round(elapsedH/j.readyHours*100)));
  if(expired)return {cls:"expired",pct,status:"À jeter ou vérifier",sub:`Dépasse la durée de conservation (${j.keepDays} j).`};
  if(ready)return {cls:"ready",pct,status:"Prêt à manger",sub:elapsedH<best?`Encore meilleur dans ${fmtDur(best-elapsedH)}.`:`À manger avant le ${fmtDate(j.start+j.keepDays*86400000)}.`};
  return {cls:"waiting",pct,status:`Prêt dans ${fmtDur(j.readyHours-elapsedH)}`,sub:`Lancé le ${fmtDate(j.start)}.`};
}
function renderJars(){
  const box=$("#jarList");
  if(!state.jars.length){ box.innerHTML=`<p class="empty">Aucun bocal en cours. Lance-en un quand tu prépares des pickles ou des œufs marinés.</p>`; return; }
  box.innerHTML=[...state.jars].sort((a,b)=>b.start-a.start).map(j=>{
    const s=jarStatus(j);
    return `<div class="card jar ${s.cls}">
      <div class="jar-top"><b>${esc(j.name)}</b><button type="button" class="btn sm danger" data-rm="${esc(j.id)}">Retirer</button></div>
      <div class="bar"><i style="width:${s.pct}%"></i></div>
      <p class="status">${s.status}</p>
      <p class="hint">${s.sub}</p>
      <p class="hint">Prêt après ${fmtDur(j.readyHours)} · idéal à ${fmtDur(j.bestHours||j.readyHours)} · se garde ${j.keepDays} j</p>
    </div>`;
  }).join("");
}
$("#jarList").addEventListener("click",async e=>{
  const b=e.target.closest("[data-rm]"); if(!b)return;
  if(await showConfirm("Retirer ce bocal du suivi ?",{title:"Retirer le bocal",okLabel:"Retirer",danger:true})){
    state.jars=state.jars.filter(x=>x.id!==b.dataset.rm); persist(); renderJars();
  }
});
$("#jarNew").onclick=()=>{
  const recs=state.recipes.filter(r=>r.tracker&&r.readyHours);
  if(!recs.length){ toast("Aucune recette de bocal dans ta base"); return; }
  openSheet("#pickBg","#pickModal",`<header class="sheet-head"><p class="sheet-eyebrow">Bocaux</p><h2 class="sheet-title">Quel bocal lances-tu ?</h2>${closeBtn("close-pick")}</header>
    <div class="sheet-body"><div class="pick-list" id="jarPick">${recs.map(r=>`<button type="button" class="pick-row" data-id="${esc(r.id)}"><span class="nm">${esc(r.name)}</span><span class="sub">prêt après ${fmtDur(r.readyHours)}</span></button>`).join("")}</div></div>`);
  $("#jarPick").onclick=e=>{
    const b=e.target.closest("[data-id]"); if(!b)return;
    const r=state.recipes.find(x=>x.id===b.dataset.id); if(!r)return;
    state.jars.push({id:uid(),recipeId:r.id,name:r.name,start:Date.now(),readyHours:r.readyHours,bestHours:r.bestHours||r.readyHours,keepDays:r.keepDays||14});
    persist(); closePick(); renderJars(); toast("Bocal lancé");
  };
};

/* ============================ RECETTES ============================ */
function recipeCardHtml(r,score,dim){
  const meta=[`<span class="diet diet-${dietBadgeClass(r)}">${dietLabel(r)}</span>`,`<span>${esc(r.cuisine)}</span>`,`<span>${r.time|0} min</span>`];
  if(r.quick)meta.push(`<span>rapide</span>`);
  if(seasonalTag(r))meta.push(`<span class="tag-season">de saison</span>`);
  const match=score?`<div class="match" aria-hidden="true"><i style="width:${Math.round(score.pct*100)}%"></i></div><p class="match-lbl">${score.hit}/${score.total} ingrédients déjà là</p>`:"";
  return `<article class="recipe${dim?" dim":""}" role="button" tabindex="0" data-act="open-recipe" data-id="${esc(r.id)}"><h3 class="recipe-title">${esc(r.name)}</h3><p class="recipe-meta">${meta.join("")}</p>${match}</article>`;
}
function openRecipe(id){
  const r=state.recipes.find(x=>x.id===id); if(!r)return;
  const veganOn=isVeganView(r), dis=recipeDislikes(r), f=scaleFactor(r), have=fridgeNames();
  const ingHtml=r.ing.map(i=>{
    const name=i[2], owned=inFridge(name,have), unit=(i[1]||"").trim(), base=parseQty(i[0]);
    let swap="";
    if(veganOn&&!r.vegan){
      const key=Object.keys(VEGAN_SWAPS).find(k=>norm(name).includes(norm(k)));
      if(key)swap=`<span class="swap">vegan : ${esc(VEGAN_SWAPS[key])}</span>`;
    }
    const q=(base!=null?[fmtQty(base*f),unit]:[i[0],unit]).filter(Boolean).join(" ");
    return `<li${owned?` class="have"`:""}><span class="ing-name">${owned?icon("check","have-ic"):""}${esc(name)}${swap}</span><span class="ing-q">${esc(q)}</span></li>`;
  }).join("");
  const src=safeUrl(r.source);
  openSheet("#modalBg","#modal",`
    <header class="sheet-head">
      <p class="sheet-eyebrow">${esc(r.cuisine)} · ${r.time|0} min · ${dietLabel(r)}</p>
      <h2 class="sheet-title">${esc(r.name)}</h2>
      ${closeBtn("close-modal")}
    </header>
    <div class="sheet-body">
      ${dis.length?`<p class="notice warn"><b>Contient :</b> ${esc(dis.join(", "))}</p>`:""}
      ${!r.vegan&&r.veganSwap?`<label class="switch"><input type="checkbox" role="switch" id="mdVegan"${veganOn?" checked":""}><span class="switch-ui"></span>Version vegan</label>`:""}
      <h3 class="h-sub">Ingrédients<span class="h-sub-note">Pour ${plural(state.people,"personne")}${state.people!==r.servings?` · recette de base pour ${r.servings}`:""}</span></h3>
      <ul class="ing">${ingHtml}</ul>
      ${r.steps.length?`<h3 class="h-sub">Préparation</h3><ol class="steps">${r.steps.map(s=>`<li><span>${esc(s)}</span></li>`).join("")}</ol>`:""}
      ${r.notes?`<p class="hint">${esc(r.notes)}</p>`:""}
      ${src?`<p class="hint"><a href="${esc(src)}" target="_blank" rel="noopener">Voir la recette d'origine</a></p>`:""}
    </div>
    <footer class="sheet-foot">
      <button type="button" class="btn danger" data-act="delete-recipe" data-id="${esc(r.id)}">Supprimer</button>
      <button type="button" class="btn" data-act="edit-recipe" data-id="${esc(r.id)}">Modifier</button>
      <button type="button" class="btn primary" data-act="plan-recipe" data-id="${esc(r.id)}">${icon("cal")} Ajouter à ma semaine</button>
    </footer>`);
  const t=$("#mdVegan");
  if(t)t.onchange=()=>{ state.vegan=t.checked; $("#veganGlobal").checked=state.vegan; persist(); openRecipe(id); refreshView(); };
}
async function deleteRecipe(id){
  if(!(await showConfirm("Supprimer cette recette de ta base ?",{title:"Supprimer la recette",okLabel:"Supprimer",danger:true})))return;
  state.recipes=state.recipes.filter(r=>r.id!==id);
  Object.values(state.plan).forEach(p=>{ if(p)["midi","soir"].forEach(k=>{ if(Array.isArray(p[k]))p[k]=p[k].filter(x=>baseId(x)!==id); }); });
  persist(); closeModal(); refreshView(); toast("Recette supprimée");
}

let _cuisineKey="";
function fillCuisineFilter(){
  const sel=$("#cuisineFilter");
  const cuis=[...new Set(state.recipes.map(r=>r.cuisine).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"fr"));
  const key=cuis.join("|"); if(key===_cuisineKey)return;
  _cuisineKey=key;
  const cur=sel.value; // conserve le choix : la liste est reconstruite quand la base change
  sel.innerHTML=`<option value="">Toutes les cuisines</option>`+cuis.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join("");
  sel.value=cuis.includes(cur)?cur:"";
}
function renderRecipes(){
  fillCuisineFilter();
  const q=norm($("#recipeSearch").value), cf=$("#cuisineFilter").value, df=$("#dietFilter").value;
  const quick=$("#quickFilter").checked, season=$("#recipeSeason").checked;
  const list=state.recipes.filter(r=>{
    const d=dietOf(r);
    if(q&&!norm(r.name).includes(q)&&!r.ing.some(i=>norm(i[2]).includes(q)))return false;
    if(cf&&r.cuisine!==cf)return false;
    if(quick&&!r.quick)return false;
    if(season&&!seasonalTag(r))return false;
    // « masquer viande et poisson », sauf si on filtre explicitement dessus
    if(state.vegOnly&&!isVegMe(r)&&df!=="poisson"&&df!=="viande")return false;
    if(df==="vegan")return d==="vegan";
    if(df==="vegetarien")return isVegMe(r);
    if(df==="veganizable")return !!(r.vegan||r.veganSwap);
    if(df==="poisson"||df==="viande")return d===df;
    return true;
  });
  $("#recipeCount").textContent=`${plural(list.length,"recette")}${list.length!==state.recipes.length?` sur ${state.recipes.length}`:" dans ta base"}`;
  $("#recipeList").innerHTML=list.length
    ?list.map(r=>recipeCardHtml(r,null,recipeDislikes(r).length>0)).join("")
    :`<p class="empty">Aucune recette pour ces filtres.</p>`;
}
$("#recipeSearch").addEventListener("input",debounce(renderRecipes,120));
["#cuisineFilter","#dietFilter","#quickFilter","#recipeSeason"].forEach(s=>$(s).addEventListener("change",renderRecipes));

/* ============================ SEMAINE ============================ */
// normalise le plan d'un jour vers {midi:[],soir:[]} (gère l'ancien format tableau)
function ensureMeals(i){
  let p=state.plan[i];
  if(Array.isArray(p))p={midi:p.slice(),soir:[]};
  if(!p||typeof p!=="object")p={midi:[],soir:[]};
  if(!Array.isArray(p.midi))p.midi=[];
  if(!Array.isArray(p.soir))p.soir=[];
  return (state.plan[i]=p);
}
function allPlannedIds(){ const ids=[]; for(let i=0;i<7;i++){ const m=ensureMeals(i); ids.push(...m.midi,...m.soir); } return ids.filter(Boolean); }
function hasPlannedMeals(){ return allPlannedIds().length>0; }
function mondayKey(d){
  d=new Date(d); d.setHours(0,0,0,0); d.setDate(d.getDate()-(d.getDay()+6)%7);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function currentWeekKey(){ return mondayKey(new Date()); }
function todayIndex(){ return (new Date().getDay()+6)%7; }
function isValidated(){ return state.validated===currentWeekKey(); }
// un menu validé d'une semaine passée est remis à zéro
function checkWeekReset(){
  if(state.validated&&state.validated!==currentWeekKey()){
    state.validated=null; state.plan={}; state.shopChecked={}; persist();
  }
}
function isBatchable(r){ return r&&!r.quick&&!r.tracker&&(r.time||0)>=25; }

function renderWeek(){
  syncCtrlBar();
  const ti=todayIndex();
  $("#week").innerHTML=DAYS.map((d,i)=>{
    const meals=ensureMeals(i);
    const sections=MEALS.map(([key,lbl,ic])=>{
      const slots=meals[key].map((id,si)=>{
        const r=recipeOf(id), lo=isLeftover(id), name=r?esc(r.name):"Recette supprimée";
        const loBtn=!lo&&r&&state.restes&&isBatchable(r)
          ?`<button type="button" class="slot-btn" data-wk="leftover" data-s="${si}" title="Prévoir les restes" aria-label="Prévoir les restes de ${name} un autre jour">${icon("recycle")}</button>`:"";
        const label=r
          ?`<button type="button" class="slot-name" data-act="open-recipe" data-id="${esc(r.id)}">${lo?`<span class="lo-tag">Restes</span>`:""}${name}</button>`
          :`<span class="slot-name muted">${name}</span>`;
        return `<div class="slot${lo?" leftover":""}">${label}${loBtn}<button type="button" class="slot-btn" data-wk="remove" data-s="${si}" aria-label="Retirer ${name}">${icon("x")}</button></div>`;
      }).join("");
      return `<div class="meal" data-k="${key}"><p class="meal-lbl">${icon(ic)}${lbl}</p>${slots}<button type="button" class="add-slot" data-wk="add" aria-label="Ajouter un plat : ${d} ${lbl.toLowerCase()}">${icon("plus")} Ajouter</button></div>`;
    }).join("");
    return `<section class="day${i===ti?" today":""}" data-day="${i}"><h2 class="day-name">${d}${i===ti?`<span class="day-tag">aujourd'hui</span>`:""}</h2>${sections}</section>`;
  }).join("");
  $("#weekValidInfo").innerHTML=isValidated()
    ?`<div class="notice ok">${icon("check")}<span>Menu validé pour cette semaine. Tu peux encore le modifier.</span><button type="button" class="btn sm ghost" id="weekUnvalidate">Annuler la validation</button></div>`:"";
}
$("#week").addEventListener("click",e=>{
  const b=e.target.closest("[data-wk]"); if(!b)return;
  const d=+b.closest("[data-day]").dataset.day, k=b.closest("[data-k]").dataset.k, s=+b.dataset.s;
  if(b.dataset.wk==="add")openPicker(d,null,k);
  else if(b.dataset.wk==="remove"){ ensureMeals(d)[k].splice(s,1); persist(); renderWeek(); }
  else addLeftover(d,k,s);
});
$("#weekValidInfo").addEventListener("click",e=>{
  if(e.target.closest("#weekUnvalidate")){ state.validated=null; persist(); renderWeek(); }
});
// place « Restes » de ce plat sur le premier créneau libre d'un jour suivant
function addLeftover(d,k,s){
  const id=ensureMeals(d)[k][s]; if(!id||isLeftover(id))return;
  const r=recipeOf(id); if(!r)return;
  for(let dd=d+1;dd<7;dd++){
    const m=ensureMeals(dd);
    for(const key of ["midi","soir"]){
      if(!m[key].length){
        m[key].push(LEFT_PREFIX+baseId(id)); persist(); renderWeek();
        toast(`Restes de « ${r.name} » prévus ${DAYS[dd].toLowerCase()} ${key}`);
        return;
      }
    }
  }
  toast("Aucun créneau libre les jours suivants");
}
function syncCtrlBar(){ $("#peopleCount").textContent=state.people; $("#restesToggle").checked=!!state.restes; }
function changePeople(delta){
  const next=Math.max(1,Math.min(20,state.people+delta));
  if(next===state.people)return;
  state.people=next; persist(); renderWeek();
  toast(`Quantités pour ${plural(state.people,"personne")}`);
}
$("#peopleMinus").onclick=()=>changePeople(-1);
$("#peoplePlus").onclick=()=>changePeople(1);
$("#restesToggle").onchange=()=>{ state.restes=$("#restesToggle").checked; persist(); renderWeek(); };
$("#weekValidate").onclick=()=>{
  if(!hasPlannedMeals()){ toast("Ajoute d'abord des repas à ta semaine"); return; }
  state.validated=currentWeekKey(); persist();
  gotoTab("accueil"); toast("Menu validé");
};
$("#weekClear").onclick=async()=>{
  if(await showConfirm("Retirer tous les repas de la semaine ?",{title:"Vider la semaine",okLabel:"Vider",danger:true})){
    state.plan={}; state.validated=null; persist(); renderWeek();
  }
};
$("#weekRandom").onclick=async()=>{
  const pool=state.recipes.filter(allowedRecipe);
  if(pool.length<2){ toast("Ajoute d'abord quelques recettes"); return; }
  if(hasPlannedMeals()&&!(await showConfirm("Remplacer la semaine par des plats tirés au hasard ?",{title:"Au hasard",okLabel:"Remplacer"})))return;
  let bag=[]; const draw=()=>{ if(!bag.length)bag=shuffle(pool.map(r=>r.id)); return bag.pop(); };
  state.plan={};
  for(let i=0;i<7;i++)state.plan[i]={midi:[draw()],soir:[draw()]};
  persist(); renderWeek(); toast("Semaine tirée au hasard");
};

/* ---- menu anti-gâchis : frigo d'abord, puis ingrédients partagés ---- */
const STAPLES=["sel","poivre","huile","eau","sucre"]; // toujours dans le placard
function recipeIngSet(r){
  const S=new Set();
  r.ing.forEach(i=>{ const n=norm(i[2]); if(n&&!STAPLES.some(s=>n.includes(s)))S.add(n); });
  return S;
}
function countFridgeHits(recipes,names){
  if(!names.length)return 0;
  const hit=new Set();
  recipes.forEach(r=>recipeIngSet(r).forEach(x=>{ if(matchesAny(x,names))hit.add(x); }));
  return hit.size;
}
// contexte partagé par les deux variantes : pool filtré, score, sélection gloutonne
function optimContext(){
  const filtered=state.recipes.filter(allowedRecipe);
  if(filtered.length<2)return null;
  const pool=shuffle(filtered), quickPool=pool.filter(r=>r.quick);
  const sets=new Map(pool.map(r=>[r.id,recipeIngSet(r)]));
  const fridge=fridgeNames(), soon=fridgeSoon().map(x=>norm(x.f.name)).filter(Boolean);
  const pantry=new Set(fridge), used=new Set();
  // périme bientôt > au frigo > déjà acheté cette semaine > nouvel achat
  const score=r=>{
    let s=r.season&&r.season.includes(currentMonth())?.5:0;
    sets.get(r.id).forEach(x=>{
      if(matchesAny(x,soon))s+=4; else if(matchesAny(x,fridge))s+=3; else if(pantry.has(x))s+=2; else s-=1;
    });
    return s;
  };
  const pick=(cands,allowRepeat)=>{
    let best=null, bs=-Infinity;
    for(const r of cands){ if(!allowRepeat&&used.has(r.id))continue; const sc=score(r); if(sc>bs){ bs=sc; best=r; } }
    return best;
  };
  const best=cands=>pick(cands,false)||pick(cands,true);
  const take=r=>{ if(r){ used.add(r.id); sets.get(r.id).forEach(x=>pantry.add(x)); } return r; };
  const seedPool=quickPool.length?quickPool:pool;
  const top=seedPool.slice().sort((a,b)=>score(b)-score(a)||sets.get(b.id).size-sets.get(a.id).size).slice(0,6);
  return {pool,quickPool,best,take,firstQuick:top[Math.floor(Math.random()*top.length)]};
}
function weekOptimized(){
  const c=optimContext(); if(!c)return null;
  const plan={};
  for(let i=0;i<7;i++){
    // un plat rapide par jour, l'autre maximise frigo + réemploi
    const q=c.take(i===0?c.firstQuick:c.best(c.quickPool.length?c.quickPool:c.pool));
    const o=c.take(c.best(c.pool));
    const [midi,soir]=Math.random()<.5?[q,o]:[o,q];
    plan[i]={midi:[midi.id],soir:[soir.id]};
  }
  return plan;
}
// mode restes : moins de plats cuisinés, chacun mangé une 2e fois un jour suivant
function weekOptimizedRestes(){
  const c=optimContext(); if(!c)return null;
  const plan={}, pending=[];
  for(let i=0;i<7;i++)plan[i]={midi:[],soir:[]};
  let idx=0;
  for(let day=0;day<7;day++){
    for(const meal of ["midi","soir"]){
      const li=pending.findIndex(p=>p.day<day);
      if(li>=0){ plan[day][meal].push(LEFT_PREFIX+pending.splice(li,1)[0].id); idx++; continue; }
      const r=c.take(idx===0?c.firstQuick:(idx%4===0&&c.quickPool.length?c.best(c.quickPool):c.best(c.pool)));
      plan[day][meal].push(r.id);
      if(isBatchable(r))pending.push({id:r.id,day});
      idx++;
    }
  }
  return plan;
}
$("#weekOptim").onclick=async()=>{
  const hint=state.fridge.length?" en partant de ton frigo":"";
  if(hasPlannedMeals()&&!(await showConfirm(`Remplacer la semaine par un menu anti-gâchis${hint} ?`,{title:"Menu anti-gâchis",okLabel:"Remplacer"})))return;
  const plan=state.restes?weekOptimizedRestes():weekOptimized();
  if(!plan){ toast("Ajoute d'abord quelques recettes"); return; }
  state.plan=plan; persist(); renderWeek();
  const ids=allPlannedIds(), cooked=ids.filter(id=>!isLeftover(id)).map(recipeOf).filter(Boolean);
  const frHits=countFridgeHits(cooked,fridgeNames()), fr=frHits?` · ${frHits} du frigo`:"";
  if(state.restes){ toast(`Menu prêt : ${cooked.length} plats, ${ids.length-cooked.length} restes${fr}`); return; }
  const counts={};
  cooked.forEach(r=>recipeIngSet(r).forEach(x=>{ counts[x]=(counts[x]||0)+1; }));
  const shared=Object.values(counts).filter(n=>n>=2).length;
  toast(`Menu prêt : ${Object.keys(counts).length} ingrédients dont ${shared} partagés${fr}`);
};

// choisir une recette pour (jour, repas), ou un (jour, repas) pour une recette
function openPicker(dayIndex,recipeId,meal){
  if(dayIndex!=null){
    const mealLbl=(MEALS.find(x=>x[0]===meal)||[0,"Repas"])[1];
    const opts=state.recipes.filter(allowedRecipe).sort((a,b)=>a.name.localeCompare(b.name,"fr"));
    openSheet("#pickBg","#pickModal",`<header class="sheet-head"><p class="sheet-eyebrow">Choisir un plat</p><h2 class="sheet-title">${DAYS[dayIndex]} · ${mealLbl.toLowerCase()}</h2>${closeBtn("close-pick")}</header>
      <div class="sheet-body">
        <div class="search">${icon("search")}<input id="pickSearch" type="search" placeholder="Filtrer…" aria-label="Filtrer les recettes" autocomplete="off"></div>
        <div class="pick-list" id="pickList">${opts.map(r=>`<button type="button" class="pick-row" data-id="${esc(r.id)}" data-q="${esc(norm(r.name+" "+r.cuisine))}"><span class="nm">${esc(r.name)}</span><span class="sub">${esc(r.cuisine)} · ${r.time|0} min</span></button>`).join("")}</div>
      </div>`);
    $("#pickSearch").oninput=()=>{ const q=norm($("#pickSearch").value); $$("#pickList .pick-row").forEach(b=>{ b.hidden=!b.dataset.q.includes(q); }); };
    $("#pickList").onclick=e=>{
      const b=e.target.closest(".pick-row"); if(!b)return;
      ensureMeals(dayIndex)[meal].push(b.dataset.id); persist(); closePick(); renderWeek();
      toast(`Ajouté : ${DAYS[dayIndex].toLowerCase()} ${meal}`);
    };
    return;
  }
  const r=recipeOf(recipeId), ti=todayIndex();
  const rows=DAYS.map((d,i)=>{
    const mm=ensureMeals(i);
    const btn=([k,lbl,ic])=>`<button type="button" class="btn sm" data-day="${i}" data-meal="${k}">${icon(ic)} ${lbl}${mm[k].length?` <span class="n">${mm[k].length}</span>`:""}</button>`;
    return `<div class="pick-day${i===ti?" today":""}"><span class="pick-day-name">${d}</span>${MEALS.map(btn).join("")}</div>`;
  }).join("");
  openSheet("#pickBg","#pickModal",`<header class="sheet-head"><p class="sheet-eyebrow">${esc(r?r.name:"")}</p><h2 class="sheet-title">Quel jour ?</h2>${closeBtn("close-pick")}</header><div class="sheet-body" id="pickDays">${rows}</div>`);
  $("#pickDays").onclick=e=>{
    const b=e.target.closest("[data-day]"); if(!b)return;
    ensureMeals(+b.dataset.day)[b.dataset.meal].push(recipeId); persist(); closePick();
    if(currentView==="semaine")renderWeek();
    toast(`Ajouté : ${DAYS[+b.dataset.day].toLowerCase()} ${b.dataset.meal}`);
  };
}

/* ============================ COURSES ============================ */
// ingrédients de la semaine (× portions), moins ce qui est au frigo, groupés par rayon
function shopGroups(){
  const agg={}, have=fridgeNames();
  allPlannedIds().forEach(id=>{
    const r=recipeOf(id); if(!r)return;
    const f=scaleFactor(r); // 2 créneaux d'une même recette = double quantité
    r.ing.forEach(i=>{
      const name=i[2], unit=(i[1]||"").trim(), key=norm(name);
      if(!key||inFridge(name,have))return;
      const it=agg[key]||(agg[key]={k:key,name,cat:i[3]||"autres",units:{},extras:new Set()});
      const base=parseQty(i[0]);
      if(base!=null)it.units[unit]=(it.units[unit]||0)+base*f;
      else{ const raw=[i[0],unit].filter(Boolean).join(" "); if(raw)it.extras.add(raw); }
    });
  });
  const cats={};
  Object.values(agg).forEach(it=>{
    const bits=Object.entries(it.units).map(([u,sum])=>[fmtQty(sum),u].filter(Boolean).join(" ")).filter(Boolean);
    it.qty=bits.concat([...it.extras]).join(" + ");
    (cats[it.cat]=cats[it.cat]||[]).push(it);
  });
  return SHOP_ORDER.concat(Object.keys(cats).filter(c=>!SHOP_ORDER.includes(c)))
    .filter(c=>cats[c]).map(c=>[c,cats[c].sort((a,b)=>a.name.localeCompare(b.name,"fr"))]);
}
function buildShopText(){
  return shopGroups().map(([c,items])=>"— "+c.toUpperCase()+"\n"+items.map(it=>"• "+it.name+(it.qty?` (${it.qty})`:"")).join("\n")).join("\n");
}
async function copyShop(){
  const txt=buildShopText();
  if(!txt){ toast("Liste vide : planifie d'abord ta semaine"); return; }
  toast(await copyText(txt)?"Liste de courses copiée":"Copie impossible");
}
function shopSummary(){
  const boxes=$$("#shopList input[data-k]"), done=boxes.filter(b=>b.checked).length;
  return `${done}/${boxes.length} cochés · pour ${plural(state.people,"personne")}${state.restes?" · mode restes":""}`;
}
function renderShop(){
  const groups=shopGroups(), box=$("#shopList");
  if(!groups.length){
    box.innerHTML=`<p class="empty">Liste vide. Ajoute des repas dans « Ma semaine » : leurs ingrédients arriveront ici.</p><div class="empty-cta"><button type="button" class="btn primary" data-v="semaine">${icon("cal")} Planifier ma semaine</button></div>`;
    return;
  }
  box.innerHTML=`<p class="shop-summary" id="shopSummary"></p>`+groups.map(([c,items])=>
    `<section class="shop-cat"><h2 class="shop-cat-name">${esc(c)}</h2>${items.map(it=>{
      const on=!!state.shopChecked[it.k];
      return `<label class="shop-item${on?" done":""}"><input type="checkbox" data-k="${esc(it.k)}"${on?" checked":""}><span class="shop-name">${esc(it.name)}</span><span class="shop-q">${esc(it.qty)}</span></label>`;
    }).join("")}</section>`).join("");
  $("#shopSummary").textContent=shopSummary();
}
$("#shopList").addEventListener("change",e=>{
  const cb=e.target.closest("input[data-k]"); if(!cb)return;
  state.shopChecked[cb.dataset.k]=cb.checked; persist();
  cb.closest(".shop-item").classList.toggle("done",cb.checked);
  $("#shopSummary").textContent=shopSummary();
});
$("#shopReset").onclick=()=>{ state.shopChecked={}; persist(); renderShop(); };
$("#shopCopy").onclick=copyShop;

/* ============================ ACCUEIL ============================ */
function renderHome(){
  const m=currentMonth(), ti=todayIndex(), validated=isValidated(), today=ensureMeals(ti);
  const dish=id=>{
    const r=recipeOf(id);
    return r?`<button type="button" class="dish" data-act="open-recipe" data-id="${esc(r.id)}">${isLeftover(id)?`<span class="lo-tag">Restes</span>`:""}${esc(r.name)}</button>`:"";
  };
  const cta=validated
    ?`<button type="button" class="btn primary" data-act="copy-shop">${icon("copy")} Copier les courses</button><button type="button" class="btn" data-v="courses">${icon("cart")} Voir la liste</button>`
    :`<button type="button" class="btn primary" data-v="semaine">${icon("cal")} ${hasPlannedMeals()?"Continuer ma semaine":"Planifier ma semaine"}</button><button type="button" class="btn" data-v="frigo">${icon("fridge")} Cuisiner avec le frigo</button>`;
  const todayHtml=MEALS.map(([k,lbl,ic])=>{
    const dishes=today[k].map(dish).join("");
    return `<div class="today-meal"><p class="meal-lbl">${icon(ic)}${lbl}</p>${dishes||`<p class="today-none">Rien de prévu</p>`}</div>`;
  }).join("");

  const watch=fridgeSoon().map(({f,s})=>
    `<li class="mini ${s.cls}"><div class="mini-top"><b>${esc(f.name)}</b><span class="st">${leftLabel(s.left)}</span></div><div class="bar"><i style="width:${s.pct}%"></i></div></li>`
  ).concat([...state.jars].sort((a,b)=>b.start-a.start).map(j=>{
    const s=jarStatus(j);
    return `<li class="mini ${s.cls}"><div class="mini-top"><b>${esc(j.name)}</b><span class="st">${s.status}</span></div><div class="bar"><i style="width:${s.pct}%"></i></div></li>`;
  }));

  const names=(mm,k)=>mm[k].map(id=>{ const r=recipeOf(id); return r?(isLeftover(id)?"Restes : ":"")+esc(r.name):""; }).filter(Boolean).join(", ")||`<span class="muted">—</span>`;
  const weekHtml=validated?`<section class="home-block">
      <div class="section-head"><h2 class="h-sec">Menu de la semaine</h2><button type="button" class="lnk" data-v="semaine">Modifier</button></div>
      <ol class="wk-list">${DAYS.map((d,i)=>{ const mm=ensureMeals(i); return `<li class="wk-row${i===ti?" today":""}"><span class="wk-day">${DAYS_SHORT[i]}</span><span class="wk-meal">${names(mm,"midi")}</span><span class="wk-meal">${names(mm,"soir")}</span></li>`; }).join("")}</ol>
    </section>`:"";

  $("#homeContent").innerHTML=`
    <header class="mast">
      <p class="mast-eyebrow">De saison à Lyon</p>
      <h1 class="mast-month">${MONTHS_FULL[m-1]}</h1>
      <ul class="produce" aria-label="Produits de saison">${SEASON[m].map(p=>`<li>${esc(p)}</li>`).join("")}</ul>
      <div class="mast-cta">${cta}</div>
    </header>
    <div class="home-grid">
      <section class="home-block">
        <div class="section-head"><h2 class="h-sec">Aujourd'hui<span class="h-sec-note">${DAYS[ti].toLowerCase()}</span></h2>${validated?`<span class="badge-ok">${icon("check")} menu validé</span>`:`<button type="button" class="lnk" data-v="semaine">Ma semaine</button>`}</div>
        <div class="today-meals">${todayHtml}</div>
      </section>
      <section class="home-block">
        <div class="section-head"><h2 class="h-sec">À surveiller</h2><button type="button" class="lnk" data-v="frigo">Mon frigo</button></div>
        ${watch.length?`<ul class="mini-list">${watch.join("")}</ul>`:`<p class="empty left">Rien ne presse. Ajoute une date à un aliment ou lance un bocal pour le suivre ici.</p>`}
      </section>
    </div>
    ${weekHtml}`;
}

/* ============================ CONVERTISSEUR ============================ */
const fmtNum=n=>String(Math.round(n*10)/10).replace(".",",");
function initConvert(){
  $("#convIng").innerHTML=Object.keys(DENSITY).map(k=>`<option>${esc(k)}</option>`).join("");
  $("#convPresets").innerHTML=CONTAINERS.map(c=>`<button type="button" data-cl="${c.cl}">${esc(c.n)} · ${fmtNum(c.cl)} cl</button>`).join("");
  $("#convPresets").addEventListener("click",e=>{
    const b=e.target.closest("[data-cl]"); if(!b)return;
    $("#convVol").value=b.dataset.cl; $("#convWeight").value="";
    $$("#convPresets button").forEach(x=>x.classList.toggle("active",x===b));
    convFromVol();
  });
  $("#convIng").onchange=()=>{ if($("#convVol").value)convFromVol(); else if($("#convWeight").value)convFromWeight(); };
  $("#convVol").addEventListener("input",convFromVol);
  $("#convWeight").addEventListener("input",convFromWeight);
  $("#convQuick").innerHTML=QUICK.map(q=>`<div class="quick-card"><span>${esc(q.n)}</span><b>≈ ${Math.round(q.cl*10*DENSITY[q.ing])} g</b></div>`).join("");
  convFromVol();
}
function convSetup(){
  const ing=$("#convIng").value, d=DENSITY[ing];
  $("#convDensity").textContent=`Densité ≈ ${fmtNum(d)} g/ml`;
  return {ing:ing.toLowerCase(),d};
}
function convFromVol(){
  const {ing,d}=convSetup(), cl=parseFloat($("#convVol").value);
  if(isNaN(cl)){ $("#convOut").textContent="—"; return; }
  const g=cl*10*d;
  $("#convWeight").value=Math.round(g*10)/10;
  $("#convLabel").textContent=`${fmtNum(cl)} cl de ${ing}`;
  $("#convOut").textContent=`${Math.round(g)} g`;
}
function convFromWeight(){
  const {ing,d}=convSetup(), g=parseFloat($("#convWeight").value);
  if(isNaN(g)){ $("#convOut").textContent="—"; return; }
  const cl=g/d/10;
  $("#convVol").value=Math.round(cl*10)/10;
  $("#convLabel").textContent=`${fmtNum(g)} g de ${ing} · ≈ ${fmtNum(cl/25)} écocup`;
  $("#convOut").textContent=`${fmtNum(cl)} cl`;
}

/* ============================ AJOUT / IMPORT ============================ */
const UNITS=["g","kg","ml","cl","l","c.à.s","c.à.c","c.à s","c.à c","cuillère","cuillères","càs","càc","pincée","gousse","gousses","boîte","sachet","tranche","tranches","portion","portions","verre","feuille","feuilles","cm"];
const UNITS_NORM=new Set(UNITS.map(norm));
// "200 g lentilles corail" → ["200","g","lentilles corail",rayon]
function parseIngLine(line){
  line=String(line).trim(); if(!line)return null;
  const m=line.match(/^([\d.,/½⅓⅔¼¾]+)\s*([a-zàéèêç.]+)?\s+(.*)$/i);
  if(m){
    const unit=m[2]||"";
    if(unit&&!UNITS_NORM.has(norm(unit))){ const name=(unit+" "+m[3]).trim(); return [m[1],"",name,guessCat(name)]; }
    return [m[1],unit,m[3].trim(),guessCat(m[3])];
  }
  return ["","",line,guessCat(line)];
}
function guessCat(name){
  const n=norm(name);
  if(/lentille|pois chiche|haricot|feve|legumineuse/.test(n))return "légumineuses";
  if(/riz|pate|nouille|farine|gnocchi|semoule|polenta|pain|quinoa|boulgour|tortilla|macaroni|spaghetti|soba|pita/.test(n))return "féculents";
  if(/poulet|boeuf|porc|agneau|veau|jambon|lardon|saucisse|merguez|dinde|canard|chorizo|viande|guanciale|pancetta|kofte|bacon/.test(n))return "viande";
  if(/poisson|saumon|thon|cabillaud|crevette|morue|colin|maquereau|sardine|fruits de mer|moule|calmar|gambas|hareng|anchois/.test(n))return "poisson";
  if(/lait|creme|fromage|beurre|oeuf|yaourt|tofu|paneer|mozzar|parmesan|gruyere|reblochon|feta|cheddar|ricotta/.test(n))return "frais";
  if(/sel|poivre|curcuma|cumin|curry|masala|epice|piment|cannelle|muscade|paprika|gochu/.test(n))return "épices";
  if(/persil|coriandre|basilic|thym|menthe|romarin|herbe|ciboulette/.test(n))return "herbes";
  if(/carotte|courgette|aubergine|poivron|tomate|oignon|ail|epinard|chou|patate|pomme de terre|poireau|champignon|legume|brocoli|salade|concombre|banane|plantain|courge|celeri/.test(n))return "légumes";
  return "épicerie";
}
function saveRecipe(r){ state.recipes.unshift(r); invalidateRecipeCache(); persist(); }

let editingId=null;
function resetRecipeForm(){
  editingId=null;
  ["#mName","#mCuisine","#mIng","#mSteps"].forEach(s=>{ $(s).value=""; });
  $("#mServings").value=4; $("#mTime").value=30; $("#mVegan").checked=false;
  $("#mSave").textContent="Enregistrer la recette";
  $("#addTitle").textContent="Nouvelle recette";
}
function startAddRecipe(){ resetRecipeForm(); gotoTab("ajouter"); }
function editRecipe(id){
  const r=state.recipes.find(x=>x.id===id); if(!r)return;
  closeModal();
  editingId=id;
  $("#mName").value=r.name||"";
  $("#mCuisine").value=r.cuisine||"";
  $("#mServings").value=r.servings||4;
  $("#mTime").value=r.time||30;
  $("#mIng").value=(r.ing||[]).map(i=>[i[0],i[1],i[2]].filter(Boolean).join(" ")).join("\n");
  $("#mSteps").value=(r.steps||[]).join("\n");
  $("#mVegan").checked=!!r.vegan;
  $("#mSave").textContent="Enregistrer les modifications";
  $("#addTitle").textContent="Modifier la recette";
  gotoTab("ajouter");
}
$("#mSave").onclick=()=>{
  const name=$("#mName").value.trim();
  if(!name){ toast("Donne un nom à la recette"); $("#mName").focus(); return; }
  const vegan=$("#mVegan").checked;
  const base={
    name, cuisine:$("#mCuisine").value.trim()||"perso", vegan,
    time:+$("#mTime").value||30, servings:+$("#mServings").value||4,
    ing:$("#mIng").value.split("\n").map(parseIngLine).filter(Boolean),
    steps:$("#mSteps").value.split("\n").map(s=>s.trim()).filter(Boolean)
  };
  const prev=editingId&&state.recipes.find(x=>x.id===editingId);
  if(prev){
    const diet=vegan?"vegan":(prev.diet==="vegan"?"vegetarien":prev.diet);
    Object.assign(prev,base,{veganSwap:vegan?prev.veganSwap:true,diet,custom:true});
    invalidateRecipeCache(); persist(); toast("Recette modifiée");
  }else{
    saveRecipe({id:uid(),...base,veganSwap:!vegan,season:[],custom:true});
    toast("Recette enregistrée");
  }
  resetRecipeForm();
  gotoTab("recettes");
};

// "PT1H20M" → 80
function isoMinutes(s){
  const m=String(s||"").match(/PT(?:(\d+)H)?(?:(\d+)M)?/i);
  return m?((+m[1]||0)*60+(+m[2]||0)):0;
}
function fromPlainText(txt){
  const lines=txt.split("\n").map(l=>l.trim()).filter(Boolean);
  if(!lines.length)return null;
  return {id:uid(),name:lines[0],cuisine:"perso",vegan:false,veganSwap:true,time:30,servings:4,season:[],ing:lines.slice(1).map(parseIngLine).filter(Boolean),steps:[],custom:true};
}
// objet schema.org Recipe (ou @graph, ou format du bookmarklet)
function fromJsonLd(j){
  let rec=j;
  if(Array.isArray(j))rec=j.find(x=>String(x&&x["@type"]).includes("Recipe"))||j[0];
  else if(j["@graph"])rec=j["@graph"].find(x=>String(x&&x["@type"]).includes("Recipe"))||j;
  if(j.recipe)rec=j.recipe;
  if(!rec||typeof rec!=="object")return null;
  const ingArr=rec.recipeIngredient||rec.ingredients||[];
  const ri=rec.recipeInstructions||rec.instructions||rec.steps||[];
  let steps=[];
  if(Array.isArray(ri))steps=ri.flatMap(s=>typeof s==="string"?[s]:(s.itemListElement||[s]).map(x=>x.text||x.name||"")).filter(Boolean);
  else if(typeof ri==="string")steps=ri.split(/\n|\. /).map(s=>s.trim()).filter(Boolean);
  return {
    id:uid(), name:String(rec.name||rec.title||"Recette importée"),
    cuisine:String(rec.recipeCuisine||"perso").toLowerCase(), vegan:false, veganSwap:true,
    time:isoMinutes(rec.totalTime||rec.cookTime)||30, servings:parseInt(rec.recipeYield,10)||4, season:[],
    ing:(Array.isArray(ingArr)?ingArr:[]).map(s=>parseIngLine(String(s))).filter(Boolean),
    steps:steps.map(String), source:safeUrl(rec.url), custom:true
  };
}
function openImportPreview(r){
  const dis=recipeDislikes(r);
  openSheet("#pickBg","#pickModal",`<header class="sheet-head"><p class="sheet-eyebrow">Import</p><h2 class="sheet-title">Vérifier avant d'ajouter</h2>${closeBtn("close-pick")}</header>
    <div class="sheet-body">
      <div><label class="fld" for="ipName">Nom</label><input id="ipName" value="${esc(r.name)}"></div>
      <div><label class="fld" for="ipCuisine">Cuisine</label><input id="ipCuisine" value="${esc(r.cuisine)}"></div>
      <div><p class="fld">${plural(r.ing.length,"ingrédient")}</p><p class="hint">${esc(r.ing.map(i=>[i[0],i[1],i[2]].filter(Boolean).join(" ")).join(" · "))||"—"}</p></div>
      <div><p class="fld">${plural(r.steps.length,"étape")}</p><p class="hint">${esc(r.steps.slice(0,3).join(" "))||"—"}</p></div>
      ${dis.length?`<p class="notice warn"><b>Contient :</b> ${esc(dis.join(", "))}. Tu pourras modifier la recette après l'import.</p>`:""}
    </div>
    <footer class="sheet-foot"><button type="button" class="btn" data-act="close-pick">Annuler</button><button type="button" class="btn primary" id="ipSave">Ajouter à ma base</button></footer>`);
  $("#ipSave").onclick=()=>{
    r.name=$("#ipName").value.trim()||r.name;
    r.cuisine=$("#ipCuisine").value.trim()||"perso";
    saveRecipe(r); closePick(); $("#pasteInput").value="";
    toast("Recette ajoutée");
  };
}
$("#pasteImport").onclick=()=>{
  const raw=$("#pasteInput").value.trim();
  if(!raw){ toast("Colle d'abord un texte"); return; }
  let r=null;
  try{ r=fromJsonLd(JSON.parse(raw)); }catch(e){ r=fromPlainText(raw); }
  if(r)openImportPreview(r); else toast("Texte illisible : vérifie le format");
};
// import par lien : proxies CORS publics, puis lecture du JSON-LD de la page
$("#urlImport").onclick=async()=>{
  const url=$("#urlInput").value.trim(), st=$("#urlStatus");
  if(!safeUrl(url)){ toast("Colle un lien qui commence par https://"); return; }
  st.textContent="Récupération de la page…";
  const proxies=[u=>"https://r.jina.ai/"+u,u=>"https://api.allorigins.win/raw?url="+encodeURIComponent(u)];
  let html=null;
  for(const p of proxies){
    try{ const res=await fetch(p(url)); if(res.ok){ html=await res.text(); if(html&&html.length>200)break; } }catch(e){}
  }
  if(!html){ st.textContent="Page inaccessible depuis l'app. Utilise le bookmarklet ou colle le texte de la recette."; return; }
  let recipe=null;
  const re=/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi; let mm;
  while((mm=re.exec(html))){ try{ const r=fromJsonLd(JSON.parse(mm[1].trim())); if(r&&r.ing.length){ recipe=r; break; } }catch(e){} }
  if(recipe){ st.textContent="Recette trouvée."; }
  else{
    const t=(html.match(/<title>([^<]+)<\/title>/i)||[])[1]||"Recette importée";
    st.textContent="Pas de données de recette sur cette page : seul le titre est importé.";
    recipe={id:uid(),name:t.trim(),cuisine:"perso",vegan:false,veganSwap:true,time:30,servings:4,season:[],ing:[],steps:[],custom:true};
  }
  recipe.source=url;
  openImportPreview(recipe);
};
// bookmarklet : copie le JSON-LD de la page courante dans le presse-papier
function initBookmarklet(){
  const code=`(function(){try{var R=null;var S=document.querySelectorAll('script[type="application/ld+json"]');for(var i=0;i<S.length;i++){try{var j=JSON.parse(S[i].textContent);var arr=j['@graph']||(Array.isArray(j)?j:[j]);for(var k=0;k<arr.length;k++){var t=(arr[k]['@type']||'')+'';if(t.indexOf('Recipe')>-1){R=arr[k];break}}if(R)break}catch(e){}}if(!R){R={name:document.title,recipeIngredient:[],recipeInstructions:[]}}R.url=R.url||location.href;var out=JSON.stringify({recipe:R});function cp(txt){var ta=document.createElement('textarea');ta.value=txt;document.body.appendChild(ta);ta.select();try{document.execCommand('copy')}catch(e){}document.body.removeChild(ta)}var ok=function(){alert('Recette copiée. Colle-la dans Mijote.')};if(navigator.clipboard){navigator.clipboard.writeText(out).then(ok,function(){cp(out);ok()})}else{cp(out);ok()}}catch(e){alert('Erreur : '+e.message)}})();`;
  const bm="javascript:"+encodeURIComponent(code);
  $("#bmLink").href=bm;
  $("#bmLink").onclick=e=>{ e.preventDefault(); toast("Glisse ce bouton dans ta barre de favoris"); };
  $("#bmCode").textContent=bm;
  $("#bmCopy").onclick=async()=>toast(await copyText(bm)?"Code copié":"Copie impossible");
}

/* ============================ INSTANTANÉ (export & sync) ============================ */
function cleanRecipes(list){
  if(!Array.isArray(list))return null;
  return list.filter(r=>r&&typeof r==="object"&&r.id&&r.name).map(r=>({
    ...r, id:String(r.id), name:String(r.name), cuisine:String(r.cuisine||"perso"),
    time:+r.time||0, servings:+r.servings||1,
    season:Array.isArray(r.season)?r.season:[],
    ing:Array.isArray(r.ing)?r.ing.filter(i=>Array.isArray(i)&&i[2]):[],
    steps:Array.isArray(r.steps)?r.steps.map(String):[]
  }));
}
function cleanMembers(list){
  return list.filter(m=>m&&typeof m==="object").map(m=>({
    id:String(m.id||uid()), name:String(m.name||"Moi"),
    dislikes:Array.isArray(m.dislikes)?m.dislikes.map(String):[], active:m.active!==false
  }));
}
function snapshot(){
  syncMemberDislikesFromState();
  return {
    version:3, recipes:state.recipes, plan:state.plan, fridge:state.fridge, jars:state.jars,
    shopChecked:state.shopChecked, people:state.people, validated:state.validated, restes:state.restes,
    members:state.members&&state.members.length?state.members:[{id:state.memberId||uid(),name:"Moi",dislikes:(state.dislikes||[]).slice(),active:true}],
    dislikes:state.dislikes
  };
}
// applique un instantané (fichier importé ou foyer distant)
function applySnapshot(p,remote){
  if(!p||typeof p!=="object")return false;
  syncApplyingRemote=!!remote;
  try{
    const recipes=cleanRecipes(p.recipes); if(recipes)state.recipes=recipes;
    if(p.plan&&typeof p.plan==="object")state.plan=p.plan;
    if(Array.isArray(p.fridge))state.fridge=p.fridge;
    if(Array.isArray(p.jars))state.jars=p.jars.filter(j=>j&&j.id&&j.start);
    if(p.shopChecked&&typeof p.shopChecked==="object")state.shopChecked=p.shopChecked;
    if(p.people!=null)state.people=Math.max(1,p.people|0||1);
    if("validated" in p)state.validated=p.validated;
    if(p.restes!=null)state.restes=!!p.restes;
    const members=Array.isArray(p.members)?cleanMembers(p.members):[];
    if(members.length){
      state.members=members;
      if(!findMember(state.memberId))state.memberId=members[0].id;
      applyMemberDislikesToState();
    }else if(Array.isArray(p.dislikes)){
      state.dislikes=p.dislikes.map(String);
    }
    normalizeFridge();
    invalidateRecipeCache();
    persist({skipSync:!!remote});
  }finally{ syncApplyingRemote=false; }
  return true;
}

/* ============================ SYNC FOYER (Supabase) ============================ */
const SYNC_CFG_LS="mijote_sync_cfg";
const SYNC_CODE_ALPH="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
let syncPushTimer=null, syncPushing=false, syncPending=false, syncApplyingRemote=false, syncPollTimer=null;
let syncStatus="off"; // off | on | pending | err

function normalizeSyncCfg(c){
  if(!c||!c.url||!c.anonKey)return null;
  const url=String(c.url).trim().replace(/\/$/,""), anonKey=String(c.anonKey).trim();
  if(url.includes("YOUR_PROJECT")||anonKey.includes("YOUR_SUPABASE"))return null;
  if(!/^https:\/\//i.test(url)||anonKey.length<20)return null;
  return {url,anonKey};
}
function readStoredSyncCfg(){ return normalizeSyncCfg(load(SYNC_CFG_LS,null)); }
// priorité : config saisie dans l'app, puis sync.config.js
function getSyncConfig(){ return readStoredSyncCfg()||normalizeSyncCfg(window.MIJOTE_SYNC); }
function syncConfigured(){ return !!getSyncConfig(); }

async function syncRpc(fn,params){
  const cfg=getSyncConfig();
  if(!cfg)throw new Error("Sync non configurée");
  const res=await fetch(`${cfg.url}/rest/v1/rpc/${fn}`,{
    method:"POST",
    headers:{apikey:cfg.anonKey,Authorization:"Bearer "+cfg.anonKey,"Content-Type":"application/json",Accept:"application/json"},
    body:JSON.stringify(params||{})
  });
  const text=await res.text();
  let data=null; try{ data=text?JSON.parse(text):null; }catch(e){}
  if(!res.ok){ const err=new Error((data&&data.message)||text||"HTTP "+res.status); err.status=res.status; throw err; }
  return Array.isArray(data)?data[0]:data;
}
// récupère le foyer distant et l'applique s'il est plus récent
async function pullHousehold(){
  const row=await syncRpc("join_household",{p_code:state.householdCode});
  if(row&&(row.rev|0)>(state.syncRev|0)){
    state.syncRev=row.rev|0;
    applySnapshot(row.payload,true);
    renderAll();
    return true;
  }
  return false;
}
function genHouseholdCode(){
  let s=""; for(let i=0;i<6;i++)s+=SYNC_CODE_ALPH[Math.floor(Math.random()*SYNC_CODE_ALPH.length)];
  return "MIJOTE-"+s;
}
function setSyncStatus(s){ syncStatus=s; updateSharedUi(); }
function syncSuffix(){ return syncStatus==="pending"?" · synchro…":syncStatus==="err"?" · hors ligne":""; }
function updateSyncPills(){
  const on=inHousehold(), m=currentMember();
  $$("#syncPillWeek,#syncPillShop").forEach(p=>{
    p.classList.toggle("on",on);
    p.classList.toggle("pending",syncStatus==="pending");
    p.classList.toggle("err",syncStatus==="err");
    p.querySelector(".lbl").textContent=on?`Foyer ${state.householdCode}${m?" · "+m.name:""}${syncSuffix()}`:"";
  });
}
function schedulePush(){
  if(!inHousehold()||syncApplyingRemote)return;
  syncPending=true;
  if(syncStatus!=="pending")setSyncStatus("pending");
  clearTimeout(syncPushTimer);
  syncPushTimer=setTimeout(flushPush,450);
}
async function flushPush(){
  if(!inHousehold()||syncPushing||syncApplyingRemote)return;
  if(!syncConfigured()){ setSyncStatus("err"); return; }
  syncPushing=true; syncPending=false;
  try{
    const baseRev=state.syncRev|0;
    const row=await syncRpc("push_household",{p_code:state.householdCode,p_payload:snapshot(),p_base_rev:baseRev});
    if(!row)throw new Error("empty push");
    const rev=row.rev|0;
    if(rev===baseRev+1){ state.syncRev=rev; saveField("syncRev"); }
    else if(rev>baseRev){ state.syncRev=rev; applySnapshot(row.payload,true); renderAll(); toast("Mis à jour depuis le foyer"); }
    setSyncStatus("on");
  }catch(e){
    console.warn("push failed",e);
    setSyncStatus("err"); syncPending=true;
  }finally{
    syncPushing=false;
    if(syncPending)schedulePush();
  }
}
function stopSyncPoll(){ if(syncPollTimer){ clearInterval(syncPollTimer); syncPollTimer=null; } }
function startSyncPoll(){
  stopSyncPoll();
  if(!inHousehold()||!syncConfigured())return;
  syncPollTimer=setInterval(async()=>{
    if(document.hidden||syncPushing)return;
    try{ if(await pullHousehold())setSyncStatus("on"); }catch(e){}
  },4000);
}
async function connectHousehold(){
  setSyncStatus("pending");
  startSyncPoll();
  try{ await pullHousehold(); setSyncStatus("on"); return true; }
  catch(e){ setSyncStatus("err"); return false; }
}

async function createHouseholdFlow(){
  if(!syncConfigured()){ toast("Configure d'abord la synchronisation"); $("#sharedConfigPanel").open=true; return; }
  const name=await showPrompt("Ton nom de profil dans le foyer :",{title:"Créer un foyer",okLabel:"Créer"});
  if(name==null)return;
  if(!name.trim()){ toast("Entre un nom de profil"); return; }
  ensureMembersFromSolo(name);
  setSyncStatus("pending");
  try{
    const row=await syncRpc("create_household",{p_code:genHouseholdCode(),p_payload:snapshot()});
    if(!row||!row.id)throw new Error("réponse du serveur invalide");
    state.householdId=row.id; state.householdCode=row.code; state.syncRev=row.rev|0;
    persist({skipSync:true});
    startSyncPoll(); setSyncStatus("on"); renderAll();
    toast("Foyer créé : "+row.code);
    if(isNative)shareHouseholdCode();
  }catch(e){
    console.warn(e);
    state.householdId=null; state.householdCode=null; state.syncRev=0;
    setSyncStatus("err");
    toast("Création impossible : "+(e.message||"vérifie ta connexion"));
  }
}
async function joinHouseholdFlow(){
  if(!syncConfigured()){ toast("Configure d'abord la synchronisation"); $("#sharedConfigPanel").open=true; return; }
  const codeRaw=await showPrompt("Code du foyer (ex. MIJOTE-AB12CD) :",{title:"Rejoindre un foyer",okLabel:"Rejoindre"});
  if(codeRaw==null)return;
  const code=codeRaw.trim().toUpperCase().replace(/\s+/g,"");
  if(!code){ toast("Entre un code de foyer"); return; }
  setSyncStatus("pending");
  try{
    const row=await syncRpc("join_household",{p_code:code});
    if(!row||!row.id)throw new Error("Code introuvable");
    state.householdId=row.id; state.householdCode=row.code; state.syncRev=row.rev|0;
    applySnapshot(row.payload,true);
    const profil=await showPrompt("Ton profil dans ce foyer (un profil existant ou un nouveau nom) :",{title:"Qui es-tu ?",okLabel:"Valider"});
    const pname=(profil||"").trim();
    if(pname){
      const existing=(state.members||[]).find(m=>norm(m.name)===norm(pname));
      if(existing)state.memberId=existing.id;
      else{
        const id=uid();
        state.members=(state.members||[]).concat({id,name:pname,dislikes:(state.dislikes||[]).slice(),active:true});
        state.memberId=id;
      }
      applyMemberDislikesToState();
    }else if(!(state.members&&state.members.length)){
      ensureMembersFromSolo("Moi");
    }
    persist();
    startSyncPoll(); setSyncStatus("on"); renderAll();
    toast("Foyer rejoint : "+row.code);
  }catch(e){
    console.warn(e);
    setSyncStatus("err");
    toast(/HOUSEHOLD|introuvable/i.test(e.message||"")?"Code introuvable":"Connexion impossible : "+(e.message||"réseau"));
  }
}
async function leaveHouseholdFlow(){
  if(!(await showConfirm("Les données restent sur cet appareil, la synchronisation s'arrête.",{title:"Quitter le foyer",okLabel:"Quitter",danger:true})))return;
  stopSyncPoll();
  syncMemberDislikesFromState();
  state.householdId=null; state.householdCode=null; state.syncRev=0;
  persist({skipSync:true});
  setSyncStatus("off");
  toast("Foyer quitté");
}
function shareHouseholdCode(){
  if(state.householdCode)shareOrCopy("Rejoins mon foyer Mijote : "+state.householdCode,"Code");
}

function renderMembers(){
  const list=$("#memberList");
  const members=state.members||[];
  list.innerHTML=members.map(m=>{
    const cur=m.id===state.memberId, n=(m.dislikes||[]).length, name=esc(m.name);
    return `<div class="member-row${cur?" current":""}" data-member="${esc(m.id)}">
      <label class="switch" title="Inclure dans le filtre des goûts"><input type="checkbox" role="switch" data-member-active="${esc(m.id)}"${m.active!==false?" checked":""} aria-label="Inclure ${name} dans le filtre"><span class="switch-ui"></span></label>
      <button type="button" class="member-main"><span class="m-name">${name}${cur?` <span class="muted">(toi)</span>`:""}</span><span class="m-meta">${plural(n,"aliment")} à éviter</span></button>
    </div>`;
  }).join("");
}
$("#memberList").addEventListener("change",e=>{
  const cb=e.target.closest("input[data-member-active]"); if(!cb)return;
  const m=findMember(cb.dataset.memberActive);
  if(m){ m.active=cb.checked; persist(); }
});
$("#memberList").addEventListener("click",e=>{
  if(e.target.closest(".switch"))return;
  const row=e.target.closest("[data-member]"); if(!row)return;
  const m=findMember(row.dataset.member); if(!m)return;
  syncMemberDislikesFromState();
  state.memberId=m.id;
  applyMemberDislikesToState();
  persist({skipSync:true});
  renderDislikes(); renderMembers(); updateSyncPills();
  toast("Profil : "+m.name);
});

function updateSharedUi(){
  const cfg=syncConfigured(), inside=inHousehold();
  const src=readStoredSyncCfg()||normalizeSyncCfg(window.MIJOTE_SYNC);
  $("#apkDownloadHint").hidden=isNative;
  if(src&&!$("#syncUrlInput").dataset.dirty){ $("#syncUrlInput").value=src.url; $("#syncKeyInput").value=src.anonKey; }
  $("#sharedConfigHint").hidden=cfg;
  if(!cfg)$("#sharedConfigPanel").open=true;
  $("#sharedSolo").hidden=inside;
  $("#sharedPanel").hidden=!inside;
  if(inside){
    const label=syncStatus==="pending"?"synchro…":syncStatus==="err"?"hors ligne":"connecté";
    $("#sharedStatus").textContent=`Foyer ${state.householdCode} · ${label}`;
    renderMembers();
  }else{
    $("#sharedStatus").textContent=cfg?"Données locales. Crée ou rejoins un foyer pour synchroniser web et APK.":"Données sur cet appareil uniquement.";
  }
  updateSyncPills();
}

/* ============================ RÉGLAGES ============================ */
function renderDislikes(){
  const m=inHousehold()?currentMember():null;
  $("#dislikesLead").textContent=m
    ?`Aliments évités par « ${m.name} ». Le filtre combine tous les profils actifs du foyer.`
    :"Les recettes qui contiennent ces aliments sont masquées ou signalées. « olives » exclut les olives, pas l'huile d'olive.";
  const list=state.dislikes||[];
  $("#dislikeChips").innerHTML=list.length
    ?list.map((d,i)=>`<button type="button" class="chip-rm" data-i="${i}" aria-label="Retirer ${esc(d)}">${esc(d)}${icon("x")}</button>`).join("")
    :`<p class="hint">Aucun aliment évité.</p>`;
}
function dislikesChanged(){ persist(); renderDislikes(); if(inHousehold())renderMembers(); }
$("#dislikeChips").addEventListener("click",e=>{
  const b=e.target.closest("[data-i]"); if(!b)return;
  state.dislikes.splice(+b.dataset.i,1); dislikesChanged();
});
$("#dislikeAdd").onclick=()=>{
  const v=$("#dislikeInput").value.trim(); if(!v)return;
  if(!state.dislikes.some(d=>norm(d)===norm(v)))state.dislikes.push(v);
  $("#dislikeInput").value=""; dislikesChanged();
};
$("#dislikeInput").addEventListener("keydown",e=>{ if(e.key==="Enter")$("#dislikeAdd").click(); });
$("#vegOnlyToggle").onchange=()=>{
  state.vegOnly=$("#vegOnlyToggle").checked; persist();
  toast(state.vegOnly?"Viande et poisson masqués":"Toutes les recettes affichées");
};

$("#sharedCreateBtn").onclick=createHouseholdFlow;
$("#sharedJoinBtn").onclick=joinHouseholdFlow;
$("#sharedLeaveBtn").onclick=leaveHouseholdFlow;
$("#sharedShareCodeBtn").onclick=shareHouseholdCode;
$("#sharedCopyCodeBtn").onclick=async()=>{ if(state.householdCode)toast(await copyText(state.householdCode)?"Code copié":"Copie impossible"); };
["#syncUrlInput","#syncKeyInput"].forEach(s=>$(s).addEventListener("input",e=>{ e.target.dataset.dirty="1"; }));
$("#syncSaveCfgBtn").onclick=async()=>{
  const cfg=normalizeSyncCfg({url:$("#syncUrlInput").value,anonKey:$("#syncKeyInput").value});
  if(!cfg){ toast("URL https://….supabase.co et clé anon requises"); return; }
  save(SYNC_CFG_LS,cfg);
  delete $("#syncUrlInput").dataset.dirty; delete $("#syncKeyInput").dataset.dirty;
  toast("Synchronisation configurée");
  if(inHousehold()&&!(await connectHousehold()))toast("Configuration enregistrée, mais foyer injoignable");
  renderAll();
};
$("#syncClearCfgBtn").onclick=()=>{
  try{ localStorage.removeItem(SYNC_CFG_LS); }catch(e){}
  delete _savedJson[SYNC_CFG_LS];
  ["#syncUrlInput","#syncKeyInput"].forEach(s=>{ $(s).value=""; delete $(s).dataset.dirty; });
  if(inHousehold()){ stopSyncPoll(); setSyncStatus("err"); } else setSyncStatus("off");
  toast("Configuration effacée, données locales conservées");
};
$("#memberAddBtn").onclick=()=>{
  if(!inHousehold()){ toast("Crée ou rejoins d'abord un foyer"); return; }
  const v=$("#memberNameInput").value.trim();
  if(!v){ toast("Entre un nom de profil"); return; }
  syncMemberDislikesFromState();
  const id=uid();
  state.members=(state.members||[]).concat({id,name:v,dislikes:[],active:true});
  state.memberId=id; state.dislikes=[];
  $("#memberNameInput").value="";
  persist(); renderDislikes(); renderMembers();
  toast(`Profil « ${v} » ajouté`);
};
$("#memberNameInput").addEventListener("keydown",e=>{ if(e.key==="Enter")$("#memberAddBtn").click(); });

$("#exportBtn").onclick=async()=>{
  const data={...snapshot(),members:state.members,householdCode:state.householdCode||undefined};
  const ok=await exportJsonFile(JSON.stringify(data,null,2),"mijote-sauvegarde.json");
  toast(ok?(isNative?"Sauvegarde partagée":"Sauvegarde téléchargée"):"Export impossible");
};
$("#importFile").onchange=e=>{
  const file=e.target.files[0]; if(!file)return;
  const rd=new FileReader();
  rd.onload=()=>{
    try{
      if(!applySnapshot(JSON.parse(rd.result),false))throw new Error("format");
      renderAll(); toast("Sauvegarde importée");
    }catch(err){ toast("Fichier invalide : choisis un export JSON de Mijote"); }
    e.target.value="";
  };
  rd.readAsText(file);
};
$("#resetBtn").onclick=async()=>{
  if(await showConfirm("La base de recettes d'origine remplace la tienne. Tes recettes perso et ta semaine seront perdues.",{title:"Réinitialiser les recettes",okLabel:"Réinitialiser",danger:true})){
    state.recipes=SEED.map(r=>({...r})); state.plan={}; state.validated=null;
    invalidateRecipeCache(); persist(); renderAll(); toast("Base réinitialisée");
  }
};

/* ============================ INIT ============================ */
const darkMq=window.matchMedia?window.matchMedia("(prefers-color-scheme: dark)"):null;
function renderSeason(){
  const [light,dark]=SEASON_COLORS[currentMonth()-1], s=document.documentElement.style;
  s.setProperty("--season-l",light); s.setProperty("--season-d",dark);
}
function renderAll(){
  renderSeason();
  $("#veganGlobal").checked=!!state.vegan;
  $("#vegOnlyToggle").checked=!!state.vegOnly;
  syncCtrlBar();
  refreshView();
  updateSharedUi();
  $("#appVersion").textContent=`Mijote ${isNative?"Android":"web"} ${APP_VERSION} · sync ${syncConfigured()?"configurée":"non configurée"}`;
}
async function paintStatusBar(){
  if(!CapPlugins.StatusBar)return;
  const dark=!!(darkMq&&darkMq.matches);
  try{
    await CapPlugins.StatusBar.setStyle({style:dark?"DARK":"LIGHT"});
    await CapPlugins.StatusBar.setBackgroundColor({color:dark?"#121513":"#F3F4EE"});
  }catch(e){}
}
function initNative(){
  if(!isNative)return;
  paintStatusBar();
  if(darkMq&&darkMq.addEventListener)darkMq.addEventListener("change",paintStatusBar);
  try{
    // retour Android : ferme la feuille ouverte, puis revient à l'accueil, puis quitte
    CapPlugins.App&&CapPlugins.App.addListener("backButton",()=>{
      if(closeTopOverlay())return;
      if(currentView==="ajouter"){ gotoTab("recettes"); return; }
      if(currentView!=="accueil"){ gotoTab("accueil"); return; }
      CapPlugins.App.exitApp&&CapPlugins.App.exitApp();
    });
  }catch(e){}
}
function init(){
  normalizeFridge();
  runMigrations();
  checkWeekReset();
  if(state.members&&state.members.length)applyMemberDislikesToState();
  renderOpenedPresets(); initConvert(); initBookmarklet();
  renderAll();
  initNative();
  if(inHousehold()&&syncConfigured())connectHousehold();
  else setSyncStatus(inHousehold()?"err":"off");
  window.addEventListener("online",()=>{ if(inHousehold()){ schedulePush(); startSyncPoll(); } });
  // retour dans l'app : nouveau jour ou nouvelle semaine possibles
  document.addEventListener("visibilitychange",()=>{
    if(document.hidden)return;
    checkWeekReset(); renderSeason();
    if(currentView==="accueil"||currentView==="semaine")refreshView();
  });
}
init();
