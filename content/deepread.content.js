// deepread.content.js
const DR_ATTR = { WRAP:"data-dr-wrap", KEY:"data-dr-key", LOGIC:"data-dr-logic" };
let SETTINGS = null;
let CURRENT_ON = false;
let STOPWORDS = null;
let mo = null;
let ticking = false;
let restored = false;
let autoScrollTimer = null;


// ---- Status Bar (lightweight) ----
let STATUS_TIMER = null;
function ensureStatusBar(){
  let bar = document.getElementById('dr-status');
  if (!bar){
    bar = document.createElement('div');
    bar.id = 'dr-status';
    document.documentElement.appendChild(bar);
  }
  return bar;
}
function showStatus(msg, kind=''){
  const bar = ensureStatusBar();
  bar.textContent = msg || '';
  bar.classList.remove('ok','warn','err','show');
  if (kind) bar.classList.add(kind);
  requestAnimationFrame(()=>{
    bar.classList.add('show');
  });
  clearTimeout(STATUS_TIMER);
  STATUS_TIMER = setTimeout(()=>{ bar.classList.remove('show'); }, 1600);
}
// AI cache per refresh
let AI_RESULT = null;
const PAGE_KEY = location.href + "@" + performance.timeOrigin;
const AI_DONE_KEY = "DR_AI_DONE::" + PAGE_KEY;
const AI_CACHE_KEY = "DR_AI_CACHE::" + PAGE_KEY;

(async function boot() {
  const cfg = await chrome.storage.sync.get("settings");
  SETTINGS = cfg.settings || {};
  STOPWORDS = await fetchStopwords();

  // 按“默认开启沉浸阅读”初始化
  CURRENT_ON = !!SETTINGS.enabledByDefault;
  if (CURRENT_ON) { enableImmersive(); try{ showStatus('默认开启：沉浸阅读', 'ok'); } catch(e){ try{ showStatus('处理失败', 'err'); }catch(_){} }
}

  // 暴露给面板
  window.DeepReadingAPI = {
getSettings: () => ({ ...SETTINGS }),
    setSettings: (delta) => {
      Object.assign(SETTINGS, delta||{});

      // 互斥：普通模式与 AI 模式不能同时开
      if (SETTINGS.aiEnabled) {
        SETTINGS.mode = "ai";
        if (!CURRENT_ON) CURRENT_ON = true;
      } else {
        SETTINGS.mode = "normal";
      }

      applyGlobalClasses(true);
      applyAutoScroll(); // 即时根据最新设置调整/停止滚动
    },
    enable: () => { CURRENT_ON = true; enableImmersive(); },
    disable: () => { CURRENT_ON = false; disableImmersive(); },
    reset: () => { CURRENT_ON = false; restorePage(true); },
    state: () => ({ enabled: CURRENT_ON, aiCached: !!AI_RESULT || !!sessionStorage.getItem(AI_CACHE_KEY) }),
    rerenderFromCache: () => { if (AI_RESULT) applyAIResult(AI_RESULT); },
    forceRefresh: () => { try { AI_RESULT = null; sessionStorage.removeItem(AI_CACHE_KEY); sessionStorage.removeItem(AI_DONE_KEY); runAIEnhanceOnce(true); } catch(e){ try{ showStatus('处理失败', 'err'); }catch(_){} }
},
    update: () => { try { if (!AI_RESULT || force) { const cached = sessionStorage.getItem(AI_CACHE_KEY); if (cached) AI_RESULT = JSON.parse(cached); } if (AI_RESULT) applyAIResult(AI_RESULT); } catch(e){ try{ showStatus('处理失败', 'err'); }catch(_){} }
}
};

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "DEEPREAD_ENABLE") { CURRENT_ON = true; enableImmersive(); }
    if (msg?.type === "DEEPREAD_DISABLE") { CURRENT_ON = false; disableImmersive(); }
    if (msg?.type === "DEEPREAD_RESET") { CURRENT_ON = false; restorePage(true); }
    if (msg?.type === "DEEPREAD_APPLY_SETTINGS") {
      Object.assign(SETTINGS, msg.payload||{});
      applyGlobalClasses(true);
      applyAutoScroll();
    }
  });
})();

async function fetchStopwords() {
  try {
    const res = await fetch(chrome.runtime.getURL("content/stopwords-zh.txt"));
    const txt = await res.text();
    return new Set(txt.split(/\r?\n/).map(s => s.trim()).filter(Boolean));
  } catch { return new Set(["的","了","和","是","在","对","与","及","或","之","着","过","跟","从","向","把","被","且"]); }
}

function enableImmersive() {
  restored = false;
  applyGlobalClasses(true);
  observe();
  processOnce();
  applyAutoScroll();
}
function disableImmersive() {
  unobserve();
  restorePage(false);
  clearAutoScroll();
}
function observe() {
  if (mo) mo.disconnect();
  mo = new MutationObserver(() => { tick(); });
  mo.observe(document.body, { childList:true, subtree:true });
}
function unobserve(){ if (mo){ mo.disconnect(); mo=null; } }
function tick(){
  if (ticking) return;
  ticking = true;
  setTimeout(async ()=>{ await processOnce(); ticking=false; }, 180);
}
async function processOnce(){
  if (!CURRENT_ON || restored) return;
  if (SETTINGS.aiEnabled && SETTINGS.apiEndpoint) await runAIEnhanceOnce();
  else if (!AI_RESULT) await runLocalEnhance();
}

function applyGlobalClasses(on) {
  const html=document.documentElement;
  html.classList.toggle("deepread-immersive", !!on);
  html.style.setProperty("--dr-lineHeight", SETTINGS.lineHeight || 1.8);
  // 主题只有普通/深色
  html.classList.toggle("deepread-theme-dark", SETTINGS.immersiveTheme==="dark");

  html.classList.toggle("deepread-focus", !!SETTINGS.focusMode);
  html.classList.toggle("deepread-2col", !!SETTINGS.twoColumn);

  html.classList.toggle("dr-ai-main", SETTINGS.aiHighlightMain !== false);
  html.classList.toggle("dr-ai-topic", SETTINGS.aiMarkParagraphTopics !== false);
  html.classList.toggle("dr-ai-keyword", SETTINGS.aiHighlightKeywords !== false);
  if (SETTINGS.fontSizeStep && SETTINGS.fontSizeStep>0) html.style.fontSize = `calc(100% + ${SETTINGS.fontSizeStep}px)`; else html.style.fontSize="";
}

function restorePage(full){
  document.querySelectorAll(`[${DR_ATTR.WRAP}]`).forEach(w=>{
    const parent=w.parentNode; if(!parent) return;
    const frag=document.createDocumentFragment();
    Array.from(w.childNodes).forEach(n=>frag.appendChild(n));
    parent.replaceChild(frag, w);
  });
  document.querySelectorAll(".dr-key,.dr-logic,.dr-bionic,.dr-main,.dr-topic,.dr-keyword,.dr-underline").forEach(el=>{
    el.classList.remove("dr-key","dr-logic","dr-bionic","dr-main","dr-topic","dr-keyword","dr-underline","dr-on");
  });
  if (full) {
    const html=document.documentElement;
    html.classList.remove("deepread-immersive","deepread-focus","deepread-theme-dark","deepread-2col","dr-ai-main","dr-ai-topic","dr-ai-keyword");
    html.style.fontSize="";
  }
  restored = true;
}

/* Local heuristic */
function queryParagraphs(){
  const paras=[];
  document.body.querySelectorAll("p,li,blockquote,section,article,h1,h2,h3").forEach(p=>{
    if (!shouldSkip(p)) paras.push(p);
  });
  return paras;
}
function shouldSkip(el){
  if (el.closest("[contenteditable], [data-dr-wrap]")) return true;
  if (el.classList.contains("notranslate")) return true;
  return false;
}
function safeText(el){ return (el.innerText||"").replace(/\s+/g," ").trim(); }
function tokenize(text){ return text.match(/[\u4e00-\u9fa5]{1,4}|[A-Za-z]+(?:['-][A-Za-z]+)?|\d+(?:\.\d+)?%?|（[^）]{1,16}）|「[^」]{1,16}」|“[^”]{1,30}”/g)||[]; }
function totalChars(units){ return units.reduce((n,u)=>n+u.text.length,0); }
function rankLocal(units, limit){
  const df=new Map(), scored=[]; const N=units.length;
  units.forEach((u,idx)=>{
    const cand=new Map();
    u.tokens.forEach(t=>{ const k=t.toLowerCase(); if(STOPWORDS.has(k)) return; cand.set(t,(cand.get(t)||0)+1); df.set(k,(df.get(k)||1)+1); });
    const isHeading=/^H[1-3]$/.test(u.el.tagName); const isFirst=idx<Math.max(3,N*0.1), isLast=idx>N*0.9;
    cand.forEach((tf,term)=>{ const idf=Math.log(1+N/(1+(df.get(term.toLowerCase())||1))); let s=tf*idf; if(isHeading)s*=2; if(isFirst||isLast)s*=1.25; if(/^（.+）$|^「.+」$|^“.+”$/.test(term))s*=1.35; if(/^\d/.test(term))s*=1.15; scored.push({term,score:s,para:u}); });
  });
  scored.sort((a,b)=>b.score-a.score);
  const out=[], seen=new Set();
  for(const s of scored){ const norm=s.term.toLowerCase(); if(seen.has(norm)) continue; const same=out.filter(p=>p.para.el===s.para.el); if(same.length>=3) continue; out.push(s); seen.add(norm); if(out.length>=limit) break; }
  return out;
}
async function runLocalEnhance(){
  const paras=queryParagraphs();
  const units=paras.map(p=>({el:p,text:safeText(p),tokens:tokenize(safeText(p))})).filter(u=>u.text.length>=8);
  if (!units.length) return;
  const maxK=Math.max(6, Math.round(((SETTINGS.maxHighlightsPerK||24)*totalChars(units))/1000));
  const picked=rankLocal(units,maxK);
  renderEnhance(picked, units);
  if (!SETTINGS.silentMode) activateUnderline();
}
function renderEnhance(picked, units){
  const byPara=new Map();
  picked.forEach(p=>{ if(!byPara.has(p.para.el)) byPara.set(p.para.el,new Set()); byPara.get(p.para.el).add(p.term); });
  for(const u of units) wrapParagraph(u.el, byPara.get(u.el)||new Set());
  markLogic();
  if (typeof markKeySentenceBlocks==='function') markKeySentenceBlocks();
  try { if (SETTINGS.aiMarkParagraphTopics !== false) markLocalParagraphTopics(units, byPara); } catch(_){}
  try { if (SETTINGS.aiHighlightMain !== false) markLocalMainIdea(units, byPara); } catch(_){}
}
function wrapParagraph(el, terms){
  if (el.hasAttribute(DR_ATTR.WRAP)) return;
  const walker=document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode:(n)=>n.nodeValue.trim()?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT });
  const tns=[]; while(walker.nextNode()) tns.push(walker.currentNode);
  const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  const pats=Array.from(terms).sort((a,b)=>b.length-a.length).map(esc);
  const re=pats.length?new RegExp(`(${pats.join("|")})`,"g"):null;
  for(const tn of tns){
    const raw=tn.nodeValue; let html;
    if (re) html=raw.replace(re,(m)=>`<span class="dr-keyword" ${DR_ATTR.WRAP}="1">${m}</span>`);
    else html=raw;
    const span=document.createElement("span"); span.className="dr-wrap"; span.setAttribute(DR_ATTR.WRAP,"1"); span.innerHTML=html;
    tn.parentNode.replaceChild(span, tn);
  }
}
function markLogic(){
  const LOGIC=["因此","所以","因为","然而","但是","同时","此外","首先","其次","最后","综上"];
  const esc=s=>s.replace(/[.*+?^${}()|[\\]\\]/g,"\\$&");
  const re=new RegExp(`(${LOGIC.map(esc).join("|")})`,"g");
  document.querySelectorAll(".dr-wrap").forEach(w=>{ w.innerHTML=w.innerHTML.replace(re, `<span class="dr-logic">$1</span>`); });
}
function activateUnderline(){
  document.querySelectorAll(".dr-wrap").forEach(w=>{
    if (!w.innerText || w.innerText.length<12) return;
    const html=w.innerHTML.replace(/(.{12,})/g, `<span class="dr-underline">$1</span>`);
    if (html!==w.innerHTML) w.innerHTML=html;
  });
  document.querySelectorAll(".dr-underline").forEach(n=>requestAnimationFrame(()=>n.classList.add("dr-on")));
}

/* AI once */
async function runAIEnhanceOnce(force){
  if (!AI_RESULT || force) {
    const cached = sessionStorage.getItem(AI_CACHE_KEY);
    if (cached) { try { AI_RESULT = JSON.parse(cached); } catch {} }
  }
  if (AI_RESULT) { applyAIResult(AI_RESULT); return; }
  if (sessionStorage.getItem(AI_DONE_KEY)) return;
  sessionStorage.setItem(AI_DONE_KEY, "1");
  const text = collectDocText();
  if (!text || text.length < 50) return;
  try {
    const res = await fetch(SETTINGS.apiEndpoint.replace(/\/$/,"") + "/api/analyze", {
      method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ text })
    });
    if (!res.ok) return;
    AI_RESULT = await res.json();
    showStatus('渲染完成', 'ok');
    try { sessionStorage.setItem(AI_CACHE_KEY, JSON.stringify(AI_RESULT)); } catch {}
    applyAIResult(AI_RESULT);
  } catch(e){ try{ showStatus('处理失败', 'err'); }catch(_){} }
}
function collectDocText(){
  const clone=document.body.cloneNode(true);
  clone.querySelectorAll("script,style,noscript,iframe,nav,header,footer,aside").forEach(n=>n.remove());
  const candidates=["article","main","[role='main']", ".post,.article,.content,.entry,.post-content,.article-content","#content,#main,#article"];
  let node=null;
  for(const sel of candidates){ const el=clone.querySelector(sel); if(el && el.textContent && el.textContent.trim().length>200){ node=el; break; } }
  if (!node) node = clone;
  const text=(node.textContent||"").replace(/\u00A0/g," ").replace(/[ \t]+\n/g,"\n").replace(/\n{3,}/g,"\n\n").trim();
  return text;
}
function applyAIResult(data){
  const paras=queryParagraphs();
  if (SETTINGS.aiHighlightMain && data.main_sentence) highlightSentenceGlobal(data.main_sentence, "dr-main");
  if (SETTINGS.aiMarkParagraphTopics && Array.isArray(data.paragraph_topic_sentences)){
    data.paragraph_topic_sentences.forEach((s, idx)=>{ if(!s) return; const el=paras[idx]; if(!el) return; wrapSentenceInElement(el, s, "dr-topic"); });
  }
  if (SETTINGS.aiHighlightKeywords && Array.isArray(data.refined_keywords)){
    const kws=data.refined_keywords.map(k=>typeof k==="string"?k:(k.keyword||"")).filter(Boolean);
    highlightKeywordsGlobal(kws);
  }
}

function wrapSentenceInElement(el, sentence, cls){
  const text = (el.textContent||"");
  const i = text.indexOf(sentence);
  if (i < 0) return false;
  // Create a Range spanning the sentence across text nodes
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
  let startNode=null, startOffset=0, endNode=null, endOffset=0;
  let pos = 0;
  while (walker.nextNode()){
    const n = walker.currentNode;
    const len = n.nodeValue.length;
    if (!startNode && i >= pos && i < pos+len){ startNode = n; startOffset = i - pos; }
    if (startNode && (i + sentence.length) <= (pos + len)){ endNode = n; endOffset = (i + sentence.length) - pos; break; }
    pos += len;
  }
  if (!startNode) return false;
  if (!endNode){ endNode = startNode; endOffset = sentence.length + startOffset; }
  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  const wrap = document.createElement('span');
  wrap.className = cls;
  wrap.setAttribute(DR_ATTR.WRAP, "1");
  range.surroundContents(wrap);
  return true;
}
function highlightSentenceGlobal(sentence, cls){
  const paras=queryParagraphs();
  for(const p of paras){ if (wrapSentenceInElement(p, sentence, cls)) break; }
}
function highlightKeywordsGlobal(kws){
  if(!kws||!kws.length) return;
  const esc=s=>s.replace(/[.*+?^${}()|[\\]\\]/g,"\\$&");
  const re=new RegExp(`(${kws.map(esc).sort((a,b)=>b.length-a.length).join("|")})`,"g");
  queryParagraphs().forEach(p=>{
    const walker=document.createTreeWalker(p, NodeFilter.SHOW_TEXT, { acceptNode:(n)=>n.nodeValue.trim()?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT });
    const tns=[]; while(walker.nextNode()) tns.push(walker.currentNode);
    for(const tn of tns){
      const raw=tn.nodeValue;
      const html=raw.replace(re, `<span class="dr-keyword" ${DR_ATTR.WRAP}="1">$1</span>`);
      if(html!==raw){ const span=document.createElement("span"); span.className="dr-wrap"; span.setAttribute(DR_ATTR.WRAP,"1"); span.innerHTML=html; tn.parentNode.replaceChild(span, tn); 
  markKeySentenceBlocks();
}

function markKeySentenceBlocks(){
  const blocks = document.body.querySelectorAll("p,li,blockquote,section,article,h1,h2,h3");
  blocks.forEach(b=>{
    if (b.querySelector('.dr-keyword')) b.classList.add('dr-key-sent');
  });
}



function sentencesOf(text){
  return text.split(/(?<=[。！？!?；;])/).map(s=>s.trim()).filter(Boolean);
}
function markLocalParagraphTopics(units, byPara){
  try{
    if (!Array.isArray(units)) return;
    units.forEach(u=>{
      const termSet = byPara.get(u.el) || new Set();
      if (!termSet.size) return;
      const sents = sentencesOf(u.text);
      let best = ""; let bestScore = 0;
      sents.forEach(s=>{
        let score = 0;
        termSet.forEach(t=>{ if (s.includes(t)) score += t.length; });
        if (score > bestScore){ bestScore = score; best = s; }
      });
      if (best) wrapSentenceInElement(u.el, best, "dr-topic");
    });
  }catch(_){}
}
function markLocalMainIdea(units, byPara){
  try{
    const global = new Map();
    byPara.forEach(set=>set.forEach(t=> global.set(t, (global.get(t)||0)+1)));
    const topTerms = Array.from(global.entries()).sort((a,b)=>b[1]-a[1]).slice(0,12).map(([t])=>t);
    let best = {s:"", score: 0, el:null};
    units.forEach(u=>{
      const sents = sentencesOf(u.text);
      sents.forEach(s=>{
        let sc = 0; topTerms.forEach(t=>{ if (s.includes(t)) sc += t.length; });
        if (sc > best.score){ best = {s, score: sc, el:u.el}; }
      });
    });
    if (best.el && best.s) wrapSentenceInElement(best.el, best.s, "dr-main");
  }catch(_){}
}
    }
  });
}

/* === 关键改动：无声阅读开关决定是否滚动 === */
function applyAutoScroll(){
  clearAutoScroll();

  // 仅在“开启沉浸阅读”且“无声阅读=开”时，根据速度滚动
  if (!CURRENT_ON) return;
  if (!SETTINGS.silentMode) return;

  const wpm = Math.max(0, Number(SETTINGS.wpm||0));
  if (!wpm) return;

  const sample=document.querySelector("article p, main p, .content p, p");
  let pxPerChar=0.4;
  if(sample){
    const chars=(sample.innerText||"").length;
    const h=Math.max(1, sample.getBoundingClientRect().height);
    const lineH=parseFloat(getComputedStyle(sample).lineHeight)||22;
    const lines=Math.max(1, h/lineH);
    const charsPerLine=Math.max(1, chars/lines);
    pxPerChar=lineH/charsPerLine; if(!isFinite(pxPerChar)||pxPerChar<=0) pxPerChar=0.4;
  }
  const pxPerMin=wpm*pxPerChar, pxPerSec=pxPerMin/60;
  const step=Math.max(1, Math.round(pxPerSec/10));
  autoScrollTimer=setInterval(()=>window.scrollBy(0, step), 100);
}
function clearAutoScroll(){ if(autoScrollTimer){ clearInterval(autoScrollTimer); autoScrollTimer=null; } }


// --- Safety: ensure update/forceRefresh exist on API ---
try{
  if (window.DeepReadingAPI && !window.DeepReadingAPI.update){
    window.DeepReadingAPI.update = ()=>{
      try{
        if (!AI_RESULT) {
          const cached = sessionStorage.getItem(AI_CACHE_KEY);
          if (cached) AI_RESULT = JSON.parse(cached);
        }
        if (AI_RESULT) applyAIResult(AI_RESULT);
      }catch(e){ try{ showStatus('处理失败','err'); }catch(_){} }
    };
  }
  if (window.DeepReadingAPI && !window.DeepReadingAPI.forceRefresh){
    window.DeepReadingAPI.forceRefresh = ()=>{
      try {
        AI_RESULT = null;
        sessionStorage.removeItem(AI_CACHE_KEY);
        sessionStorage.removeItem(AI_DONE_KEY);
        runAIEnhanceOnce(true);
      } catch(e){ try{ showStatus('处理失败','err'); }catch(_){} }
    };
  }
}catch(_){}
