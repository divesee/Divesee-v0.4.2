// deepread.panel.js
(function(){
  const ready = ()=> new Promise(r => {
    const t = setInterval(()=>{ if (window.DeepReadingAPI) { clearInterval(t); r(); } }, 50);
  });
  ready().then(init);

  function init(){
    const api = window.DeepReadingAPI;
    const S = api.getSettings();

    // Root + Shadow
    const root = document.createElement('div');
    root.id = 'dr-overlay-root';
    root.style.position = 'fixed';
    root.style.zIndex = 2147483646;
    root.style.inset = 'auto auto 24px 24px'; // default 左下角
    document.documentElement.appendChild(root);
    const shadow = root.attachShadow({ mode: 'open' });

    const create = (html)=>{
      const el = document.createElement('div');
      el.innerHTML = html.trim();
      return el.firstElementChild;
    };

    // Floating Button（玻璃拟态）
    const fab = create(`<button title="潜读控制台">D</button>`);
    Object.assign(fab.style, {
      position:'fixed', width:'48px', height:'48px',
      left:'24px', bottom:'24px',
      borderRadius:'50%', border:'1px solid rgba(15,23,42,.08)',
      cursor:'pointer', fontWeight:'700', fontSize:'18px',
      boxShadow:'0 8px 24px rgba(0,0,0,.25)',
      backdropFilter:'saturate(160%) blur(12px)', WebkitBackdropFilter:'saturate(160%) blur(12px)'
    });
    shadow.appendChild(fab);

    // Panel container（玻璃拟态）
    const panel = create(`<div id="panel" style="display:none"></div>`);
    Object.assign(panel.style, {
      position:'fixed', minWidth:'340px', maxWidth:'380px', maxHeight:'70vh', overflow:'auto',
      borderRadius:'16px', padding:'12px 12px 14px 12px',
      boxShadow:'0 16px 40px rgba(0,0,0,.32)'
    });

    panel.innerHTML = `
      <style>
        :host{ all: initial; font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "PingFang SC","Microsoft YaHei","Noto Sans CJK SC", sans-serif; }
        #panel{ border:1px solid transparent; backdrop-filter:saturate(160%) blur(14px); -webkit-backdrop-filter:saturate(160%) blur(14px); }
        /* 主题：玻璃拟态（浅/深） */
        #panel[data-theme="light"]{ background:rgba(248,250,252,.55); color:#0f172a; border-color:rgba(15,23,42,.08); }
        #panel[data-theme="dark"]{  background:rgba(11,18,32,.55);  color:#e5edff; border-color:rgba(255,255,255,.12); }

        .row{display:flex;align-items:center;justify-content:space-between;margin:8px 0;gap:10px}
        .group{margin-top:10px;padding-top:10px}
        .title{font-weight:700;margin-bottom:6px}
        .hint{font-size:11px;opacity:.7}
        .divider{height:1px;margin:10px -12px}
        #panel[data-theme="light"] .divider{background:rgba(15,23,42,.08)}
        #panel[data-theme="dark"]  .divider{background:rgba(255,255,255,.10)}

        /* Toggle switch */
        .switch{display:flex;align-items:center;gap:10px;cursor:pointer;user-select:none}
        .switch input{appearance:none;width:42px;height:24px;border-radius:999px;position:relative;outline:none;transition:.2s;}
        #panel[data-theme="light"] .switch input{background:#cbd5e1;}
        #panel[data-theme="dark"]  .switch input{background:#334155;}
        #panel[data-theme="light"] .switch input:checked{background:#2563eb;}
        #panel[data-theme="dark"]  .switch input:checked{background:#2563eb;}
        .switch input::after{content:"";position:absolute;top:3px;left:3px;width:18px;height:18px;background:#fff;border-radius:50%;transition:.2s;}
        .switch input:checked::after{left:21px;}

        .kv{display:flex;align-items:center;gap:8px}
        .range{flex:1}
        input[type="range"]{width:180px}
        button{background:#2563eb;color:#fff;border:0;border-radius:10px;padding:6px 12px;cursor:pointer}
        button.muted{background:#64748b}
        details{border-radius:12px; padding:8px 10px}
        #panel[data-theme="light"] details{border:1px solid rgba(15,23,42,.08); background:rgba(255,255,255,.35)}
        #panel[data-theme="dark"]  details{border:1px solid rgba(255,255,255,.12); background:rgba(13,21,36,.35)}
        details > summary{cursor:pointer; list-style:none; outline:none}
        details > summary::-webkit-details-marker{display:none}
        input[type="text"]{width:100%;border-radius:8px;padding:6px 8px}
        #panel[data-theme="light"] input[type="text"]{background:rgba(255,255,255,.65);color:#0f172a;border:1px solid rgba(15,23,42,.08)}
        #panel[data-theme="dark"]  input[type="text"]{background:#0e1626;color:#e5edff;border:1px solid rgba(255,255,255,.12)}

        a{color:#2563eb;text-decoration:underline}

        /* About modal */
        .modal{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.45);}
        .modal .card{border-radius:14px;padding:16px 18px;min-width:300px;max-width:90vw;text-align:center}
        #panel[data-theme="light"] .modal .card{background:rgba(248,250,252,.9); color:#0f172a; border:1px solid rgba(15,23,42,.08)}
        #panel[data-theme="dark"]  .modal .card{background:rgba(11,18,32,.92); color:#e5edff; border:1px solid rgba(255,255,255,.12)}
        .close{position:absolute;top:10px;right:12px;background:transparent;border:0;font-size:18px;cursor:pointer}
        .badge{padding:2px 8px;border-radius:999px;font-size:12px;margin-left:6px;opacity:.8;border:1px solid currentColor}
      </style>

      <div class="title">Divesee潜读<span class="badge">v0.4.2</span></div>

      <div class="row">
        <label class="switch"><input id="modeImmersive" type="checkbox"><span class="lab">沉浸阅读</span></label>
        <label class="switch"><input id="modeAI" type="checkbox"><span class="lab">AI沉浸阅读</span></label>
      </div>

      <div class="row">
        <label class="switch"><input id="enabledByDefault" type="checkbox"><span class="lab">默认开启沉浸阅读</span></label>
      </div>

      <div class="divider"></div>

      <div class="group">
        <div class="row kv"><span>字号</span><input id="fontSizeStep" class="range" type="range" min="0" max="8"><span id="fontSizeVal">px</span></div>
        <div class="row kv"><span>行距</span><input id="lineHeight" class="range" type="range" min="1.2" max="2.4" step="0.1"><span id="lineHeightVal">1.8</span></div>
        <div class="row">
          <label class="switch"><input id="darkTheme" type="checkbox"><span class="lab">深色主题</span></label>
          <label class="switch"><input id="twoColumn" type="checkbox"><span class="lab">双栏阅读</span></label>
        </div>
        <div class="row">
          <label class="switch"><input id="focusMode" type="checkbox"><span class="lab">专注模式</span></label>
          <label class="switch"><input id="silentMode" type="checkbox"><span class="lab">无声阅读</span></label>
        </div>
        <div class="row kv" id="wpmRow"><span>速度（字/分）</span><input id="wpm" class="range" type="range" min="0" max="1500" step="10"><span id="wpmVal">0</span></div>
      </div>

      <div class="divider"></div>

      <div class="group">
        <div class="row"><span>阅读设置</span></div>
        <div class="row">
          <label class="switch"><input id="aiHighlightMain" type="checkbox"><span class="lab">高亮全文主旨</span></label>
          <label class="switch"><input id="aiMarkParagraphTopics" type="checkbox"><span class="lab">标记段落主题</span></label>
        </div>
        <div class="row">
          <label class="switch"><input id="aiHighlightKeywords" type="checkbox"><span class="lab">高亮关键词</span></label>
        </div>
        <div class="hint">提示：AI 模式仅在刷新本页或强制刷新调用；如还原无反应则请手动刷新清屏（测试：无声阅读）。</div>
      </div>

      <div class="divider"></div>

      <details id="advanced">
        <summary>设置</summary>
        <div class="row">
          <span class="hint">API 端点</span>
        </div>
        <div class="row">
          <input id="apiEndpoint" type="text" placeholder="https://api.divesee.com:9443">
        </div>
        <div class="row" style="font-size:12px;opacity:.8">
          © Divesee Team · Demo <a id="aboutLink" href="javascript:void(0)">About</a>
        </div>
      </details>

      <div class="row" style="justify-content:flex-end;margin-top:12px">
  <button id="force" class="">强制刷新</button>
  <button id="apply">更新</button>
  <button id="reset" class="muted">还原</button>
</div>

      <div class="modal" id="aboutModal" aria-hidden="true">
        <div class="card" role="dialog" aria-modal="true">
          <button class="close" id="aboutClose">×</button>
          <h3>About Us</h3>
          <p>DiveSee Team · All Rights Reserved</p>
          <p><a target="_blank" rel="noopener" href="https://www.divesee.com/About">www.divesee.com/About</a></p>
          <p>6 students team</p>
          <p>v0.4.2</p>
        </div>
      </div>
    `;
    shadow.appendChild(panel);

    // ========= State & Binding =========
    const state = api.state();
    const modeAI = panel.querySelector('#modeAI');
    const modeImm = panel.querySelector('#modeImmersive');

    if (state.enabled && S.aiEnabled) {
      modeAI.checked = true; modeImm.checked = false;
    } else if (state.enabled) {
      modeImm.checked = true; modeAI.checked = false;
    }

    panel.querySelector('#enabledByDefault').checked = !!S.enabledByDefault;
    panel.querySelector('#aiHighlightMain').checked = S.aiHighlightMain !== false;
    panel.querySelector('#aiMarkParagraphTopics').checked = S.aiMarkParagraphTopics !== false;
    panel.querySelector('#aiHighlightKeywords').checked = S.aiHighlightKeywords !== false;
    panel.querySelector('#apiEndpoint').value = S.apiEndpoint || "";
    panel.querySelector('#darkTheme').checked = (S.immersiveTheme || "normal")==="dark";
    panel.querySelector('#fontSizeStep').value = S.fontSizeStep || 0;
    panel.querySelector('#lineHeight').value = S.lineHeight || 1.8;
    panel.querySelector('#twoColumn').checked = !!S.twoColumn;
    panel.querySelector('#focusMode').checked = !!S.focusMode;
    panel.querySelector('#silentMode').checked = !!S.silentMode;
    panel.querySelector('#wpm').value = S.wpm || 0;
    panel.querySelector('#fontSizeVal').textContent = (S.fontSizeStep||0) + "px";
    panel.querySelector('#lineHeightVal').textContent = (S.lineHeight||1.8).toString();
    panel.querySelector('#wpmVal').textContent = (S.wpm||0).toString();

    // 主题联动：面板玻璃/按钮玻璃
    const setPanelTheme = (theme)=>{ panel.setAttribute('data-theme', theme==='dark' ? 'dark':'light'); applyFabTheme(); };
    const applyFabTheme = ()=>{
      const dark = panel.getAttribute('data-theme') === 'dark';
      if (dark){
        fab.style.background = 'rgba(15,23,42,.50)';
        fab.style.color = '#e5edff';
        fab.style.border = '1px solid rgba(255,255,255,.12)';
      } else {
        fab.style.background = 'rgba(255,255,255,.55)';
        fab.style.color = '#0f172a';
        fab.style.border = '1px solid rgba(15,23,42,.08)';
      }
    };
    setPanelTheme((S.immersiveTheme || 'normal'));

    const save = async (payload)=>{
      const { settings } = await chrome.storage.sync.get("settings");
      await chrome.storage.sync.set({ settings: { ...(settings||{}), ...payload } });
      api.setSettings(payload);
    };

    // 总开关互斥
    modeImm.onchange = async (e)=>{
      if (e.target.checked) {
        modeAI.checked = false;
        await save({ aiEnabled:false, mode:"normal" });
        api.enable();
      } else {
        api.disable();
      }
    };
    modeAI.onchange = async (e)=>{
      if (e.target.checked) {
        modeImm.checked = false;
        await save({ aiEnabled:true, mode:"ai" });
        api.enable();
        api.rerenderFromCache();
      } else {
        await save({ aiEnabled:false, mode:"normal" });
        api.disable();
      }
    };

    // 即调即用：range 与开关
    const range = (id, key)=>{
      const el=panel.querySelector(id), out=panel.querySelector(id+'Val');
      el.addEventListener('input', async ()=>{
        const v = (key==="fontSizeStep" ? Math.round(+el.value) : +el.value);
        if (out) out.textContent = key==="fontSizeStep" ? `${v}px` : `${v}`;
        const patch = {}; patch[key]=v;
        await save(patch);
      });
    };
    range('#fontSizeStep','fontSizeStep');
    range('#lineHeight','lineHeight');
    range('#wpm','wpm');

    const bindSwitch = (sel, key)=>{
      const el = panel.querySelector(sel);
      el.onchange = async ()=>{
        const patch={}; patch[key]=el.checked;
        await save(patch);
        if (key.startsWith("ai")) api.rerenderFromCache();
        if (key === 'silentMode') syncWpmDisabled();
      };
    };
    bindSwitch('#enabledByDefault', 'enabledByDefault');
    bindSwitch('#twoColumn', 'twoColumn');
    bindSwitch('#focusMode', 'focusMode');
    bindSwitch('#aiHighlightMain', 'aiHighlightMain');
    bindSwitch('#aiMarkParagraphTopics', 'aiMarkParagraphTopics');
    bindSwitch('#aiHighlightKeywords', 'aiHighlightKeywords');

    // 主题切换：联动玻璃风格
    panel.querySelector('#darkTheme').addEventListener('change', async (e)=>{
      const theme = e.target.checked ? 'dark' : 'normal';
      await save({ immersiveTheme: theme });
      setPanelTheme(theme);
    });

    // API endpoint（隐藏在设置里）
    panel.querySelector('#apiEndpoint').addEventListener('change', async (e)=>{
      await save({ apiEndpoint: e.target.value.trim() });
    });

    // 应用 / 还原
    panel.querySelector('#apply').onclick = ()=> api.update();
    panel.querySelector('#force').onclick = ()=> api.forceRefresh();
    panel.querySelector('#reset').onclick = ()=> api.reset();

    // About modal
    const modal = panel.querySelector('#aboutModal');
    const openAbout = ()=>{ modal.style.display='flex'; modal.setAttribute('aria-hidden','false'); };
    const closeAbout = ()=>{ modal.style.display='none'; modal.setAttribute('aria-hidden','true'); };
    panel.querySelector('#aboutLink').onclick = openAbout;
    panel.querySelector('#aboutClose').onclick = closeAbout;

    // 显隐
    const togglePanel = ()=>{
      const isOpen = panel.style.display!=='none';
      panel.style.display = isOpen ? 'none' : 'block';
      if (!isOpen) placePanelByCorner();
    };
    fab.addEventListener('click', (e)=>{
      e.stopPropagation();
      togglePanel();
    });
    document.addEventListener('mousedown', (e)=>{
      const path = e.composedPath();
      if (panel.style.display!=='none' && !path.includes(root)) panel.style.display = 'none';
    }, true);

    // 拖拽 + 吸附 + 展开方向
    let drag = null;
    const startDrag = (ev)=>{
      if (ev.button !== 0) return;
      ev.preventDefault();
      ev.stopPropagation();
      const rect = fab.getBoundingClientRect();
      drag = { sx:rect.left, sy:rect.top, x:ev.clientX, y:ev.clientY };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', endDrag);
    };
    const onMove = (e)=>{
      if (!drag) return;
      const nx = drag.sx + (e.clientX - drag.x);
      const ny = drag.sy + (e.clientY - drag.y);
      fab.style.left = clamp(nx, 8, window.innerWidth-56) + 'px';
      fab.style.top  = clamp(ny, 8, window.innerHeight-56) + 'px';
      fab.style.bottom = 'auto'; fab.style.right='auto';
    };
    const endDrag = ()=>{
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', endDrag);
      drag = null;
      snapToCorner();
      placePanelByCorner();
    };
    fab.addEventListener('mousedown', startDrag);
    function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

    let corner = "BL"; // 默认左下（向右上展开）
    function detectCorner(){
      const r = fab.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top + r.height/2;
      const left = cx < window.innerWidth/2;
      const top = cy < window.innerHeight/2;
      return (top && left) ? "TL" : (top && !left) ? "TR" : (!top && left) ? "BL" : "BR";
    }
    function snapToCorner(){
      corner = detectCorner();
      const pad = 24;
      if (corner==="BL"){ fab.style.left = pad+'px'; fab.style.bottom = pad+'px'; fab.style.top='auto'; fab.style.right='auto'; }
      if (corner==="TL"){ fab.style.left = pad+'px'; fab.style.top = pad+'px'; fab.style.bottom='auto'; fab.style.right='auto'; }
      if (corner==="BR"){ fab.style.right = pad+'px'; fab.style.bottom = pad+'px'; fab.style.left='auto'; fab.style.top='auto'; }
      if (corner==="TR"){ fab.style.right = pad+'px'; fab.style.top = pad+'px'; fab.style.left='auto'; fab.style.bottom='auto'; }
    }
    function placePanelByCorner(){
      const r = fab.getBoundingClientRect();
      panel.style.left = panel.style.right = panel.style.top = panel.style.bottom = 'auto';
      const gap = 12;
      if (corner==="BL"){ // 向右上展开
        panel.style.left = r.left + 'px';
        panel.style.bottom = (window.innerHeight - r.top + gap) + 'px';
      }
      if (corner==="TL"){ // 向右下展开
        panel.style.left = r.left + 'px';
        panel.style.top = (r.bottom + gap) + 'px';
      }
      if (corner==="BR"){ // 向左上展开
        panel.style.right = (window.innerWidth - r.right) + 'px';
        panel.style.bottom = (window.innerHeight - r.top + gap) + 'px';
      }
      if (corner==="TR"){ // 向左下展开
        panel.style.right = (window.innerWidth - r.right) + 'px';
        panel.style.top = (r.bottom + gap) + 'px';
      }
    }
    snapToCorner();

    // Esc 关闭
    document.addEventListener('keydown', (e)=>{
      if (e.key === 'Escape' && panel.style.display!=='none') panel.style.display='none';
    });

    // “无声阅读”未开启时，速度条置灰（但仍可调，不滚动）
    function syncWpmDisabled(){
      const on = panel.querySelector('#silentMode').checked;
      const wpm = panel.querySelector('#wpm');
      const val = panel.querySelector('#wpmVal');
      const row = panel.querySelector('#wpmRow');
      /* pointer events always enabled so user can set speed anytime */ wpm.style.pointerEvents='';
      wpm.style.opacity = on ? '1' : '.5';
      val.style.opacity = on ? '1' : '.6';
      row.title = on ? '' : '开启“无声阅读”后速度才会滚动';
    }
    syncWpmDisabled();
  }
})();