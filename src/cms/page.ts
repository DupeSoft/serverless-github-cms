export function renderCmsPage(): Response {
  const html = `<!doctype html><!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Advanced CMS Dashboard</title>
    <link rel="stylesheet" href="/cms/style.css">

    <style id="cms-font-guard">
      .cms-root, .cms-root * {
        font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial,
                     "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji";
        -webkit-font-smoothing: antialiased;
        text-rendering: optimizeLegibility;
      }
      /* Prevent icon fonts from hijacking plain <i> elements in the CMS chrome */
      .cms-root i:not(.fa):not(.fas):not(.far):not(.fal):not(.fab) {
        font-family: inherit !important;
        font-style: italic;
      }
    </style>
<style data-cms-fix="btn-prefix">.controls-area button::before,.controls-area .btn::before,.controls-area button::after,.controls-area .btn::after{content:none!important}</style></head>
<body class="cms-root">
    <div id="imageSelectModal" class="image-select-modal">
        <div class="image-select-content">
            <h3>Select an Image to Replace With</h3>
            <div id="imageSelectGrid" class="image-select-grid"></div>
            <div style="margin-top: 1rem; text-align: right;">
                <button onclick="closeImageSelector()" style="background: #6c757d;">Cancel</button>
            </div>
        </div>
    </div>

    <!-- Color Picker Modal -->
    <div id="colorPickerModal" class="color-picker-modal">
        <div class="color-picker-content">
            <div class="color-picker-header">
                <h3>🎨 CSS Color Editor</h3>
                <button onclick="closeColorPicker()" class="close-btn">×</button>
            </div>
            <div class="color-picker-body">
                <div class="color-search-section">
                    <label for="colorSearch">Search colors:</label>
                    <input type="text" id="colorSearch" placeholder="Type to filter colors..." oninput="filterColorVariables(this.value)">
                </div>
                <div id="colorVariablesList" class="color-variables-list">
                    <!-- Colors will be populated here -->
                </div>
                <div class="color-picker-actions">
                    <div class="color-picker-status" id="colorPickerStatus"></div>
                    <button onclick="stageColorChanges()" class="stage-colors-btn">Add Colors to Staged</button>
                    <button onclick="resetColorChanges()" class="reset-colors-btn">Reset Colors</button>
                </div>
            </div>
        </div>
    </div>

    <!-- CMS Main Page -->
    <div id="cms-page" class="page active">
        <button id="logout-btn" onclick="logout()" style="float:right; background: #888;">Logout</button>
        <h1>🍕 Advanced CMS Dashboard</h1>
        <div id="status"></div>

        <!-- Main Navigation -->
        <div class="main-nav"><button class="nav-btn" onclick="scrollToSection('file-editor')">📝 File Editor</button>
            <button class="nav-btn" onclick="scrollToSection('images-section')">🖼️ Images</button>
            <button class="nav-btn" onclick="scrollToSection('menu-section')">🍔 Menu</button>
        </div>

        <!-- File Editor Section -->
        <div id="file-editor" class="cms-panel">
            <label for="cms-filename-select">Edit Any File</label>
            <select id="cms-filename-select" onchange="loadFile()"></select>
            <button onclick="loadFile()">Load</button>
            <span id="cms-status"></span>
            <textarea id="cms-content" spellcheck="false" placeholder="File contents (plain text)"></textarea>
            <div>
                <button onclick="saveFile()">Save/Publish</button>
                <span id="cms-save-status"></span>
            </div>
        </div>

        <!-- Images Section -->
        <div id="images-section">
            <h2>Images (USERNAME-PLACEHOLDER/REPO-PLACEHOLDER/images/)</h2>
            <button style="float:right;" onclick="showImageUploader()">Upload Image</button>
            <input type="file" id="image-upload" accept="image/*" style="display:none">

            <div class="img-section-title" onclick="toggleImageSection('inuse')">
                Images in Use (linked from HTML/CSS/JS)
            </div>
            <div id="imglist-inuse-content" class="img-section-content">
                <div id="imglist-inuse" class="imglist"></div>
            </div>

            <div class="img-section-title" onclick="toggleImageSection('unused')">
                Unused Images (not referenced) <span style="font-size: 0.8em; color: #999;">(click to expand)</span>
            </div>
            <div id="imglist-unused-content" class="img-section-content collapsed">
                <div id="imglist-unused" class="imglist"></div>
            </div>
        </div>

        <!-- Menu Section -->
        <div id="menu-section">
            <h2>Add New Menu Item</h2>
            <form id="add-form">
                <div class="formrow">
                    <input required name="section" placeholder="Section">
                    <input required name="title" placeholder="Title">
                    <input required name="description" placeholder="Description" style="width: 220px;">
                    <input required name="price" placeholder="Price (e.g. 8.99)">
                    <input type="submit" value="Add Item">
                </div>
            </form>

            <h2>Menu Items (Click any cell to edit)</h2>
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Section</th>
                        <th>Title</th>
                        <th>Description</th>
                        <th>Price</th>
                        <th>Save</th>
                        <th>Delete</th>
                    </tr>
                </thead>
                <tbody id="menu-table"></tbody>
            </table>
        </div>
    </div>

    <!-- CSS Editor Page -->
    <div id="css-editor-page" class="page">
        <!-- Editor Sidebar -->
        <aside class="editor-sidebar">
            <div class="editor-header">
                <h1>🎨 CSS Live Editor</h1>
                <p>Click any part of your website to customize it 🎨</p>
            </div>
            <div class="click-hint" id="clickHint">
                Click anything in the preview to start editing
            </div>
            <div class="controls-area" id="controlsArea">
                <div class="welcome-message">
                    <div class="icon">🖱️</div>
                    <h3>Ready to customize!</h3>
                    <p>Click on any image, text, button, or section in your website preview to start editing its appearance.</p>
                </div>
            </div>
        </aside>

        <!-- Preview Area -->
        <section class="editor-preview">
            <div class="editor-preview-header">
                <span class="preview-title">📱</span><button class="color-picker-btn" onclick="openColorPicker()" title="Edit CSS Colors">🎨 Colors</button>
                <button class="save-all-btn" onclick="commitPendingChanges()" title="Commit all staged changes">💾 Save All</button>
                <button class="reset-btn" onclick="resetAllStyles()">🔄 Reset Everything</button>
            </div>
            <div class="iframe-container">
                <iframe id="previewFrame" class="preview-iframe"></iframe>
            </div>
        </section>
    </div>

    <!-- Text Editor Modal -->
    <div id="textEditorModal" class="text-editor-modal">
        <div class="text-editor-content">
            <div class="text-editor-header"><h3>Edit Text Content</h3><button class="text-editor-close" onclick="closeTextEditor()" aria-label="Close">×</button></div>
            <textarea id="textEditorTextarea" placeholder="Enter your text here..."></textarea>
            <div class="text-color-row" style="display:flex; gap:10px; align-items:center;">
                <label for="textColorPicker" style="min-width:90px;">Text color:</label>
                <input type="color" id="textColorPicker">
                <input type="text" id="textColorHex" placeholder="#EEEEEE" value="#EEEEEE">
            </div>
            <div>
                <button onclick="saveTextEdit()">Save Text</button>
                <button onclick="saveTextColor()" style="background:#28a745;margin-left:8px;" id="saveColorBtn">Save Color</button>
                <button onclick="closeTextEditor()" style="background: #6c757d;">Cancel</button>
            </div>
        </div>
    </div>

    

    <script src="/cms/script.js" defer></script>


<script>
(function(){
  var done = false;
  var loadedOnce = false;

  function markLoaded(){ loadedOnce = true; }

  function ensurePreview(){
    try {
      var frame = document.getElementById('previewFrame');
      if (!frame) return;
      var hasSrc = !!(frame.getAttribute('src') || frame.src);
      if (!hasSrc && !loadedOnce) {
        frame.addEventListener('load', markLoaded, { once: true });
        frame.src = '/proxy/index.html';
      }
    } catch(e){}
  }

  function tryInitEditor(){
    if (done) return true;
    try {
      if (typeof initializeEditor === 'function') {
        try { initializeEditor(); } catch(e){ console.warn('initializeEditor threw', e); }
        done = true;
        return true;
      }
    } catch(e){}
    return false;
  }

  function bootOnce(){
    if (done) return;
    var ok = tryInitEditor();
    ensurePreview();
  }

  function bootWithRetries(){
    var tries = 0;
    var timer = setInterval(function(){
      tries++;
      bootOnce();
      if (done || loadedOnce || tries > 100) {
        clearInterval(timer);
      }
    }, 100);
  }

  if (document.readyState !== 'loading') {
    setTimeout(bootOnce, 0);
    setTimeout(bootWithRetries, 50);
  } else {
    document.addEventListener('DOMContentLoaded', function(){
      bootOnce();
      bootWithRetries();
    });
  }
  window.addEventListener('load', bootOnce);

  try {
    var scrolled = false;
    function scrollEditor(){
      if (scrolled) return; scrolled = true;
      var target = document.getElementById('css-editor-page');
      if (target && target.scrollIntoView) {
        setTimeout(function(){ target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 120);
      }
    }
    if (document.readyState !== 'loading') setTimeout(scrollEditor, 200);
    else document.addEventListener('DOMContentLoaded', function(){ setTimeout(scrollEditor, 200); });
  } catch(e){}
})();
</script>


<!-- Preview Isolation: destroy/recreate iframe on fast view switches to prevent hangs -->
<script id="cms-preview-isolation">
(function(){
  if (window.__cmsPreviewIsolation) return; window.__cmsPreviewIsolation = true;

  function q(id){ return document.getElementById(id); }

  // Capture initial preview URL & attributes
  function snapshotPreviewTemplate(){
    var f = q('previewFrame');
    if (!f) return;
    try {
      window.__CMS_PREVIEW_URL = f.getAttribute('src') || f.src || window.__CMS_PREVIEW_URL || '';
      // save some attrs for re-create
      window.__CMS_PREVIEW_ATTRS = {
        id: 'previewFrame',
        class: f.getAttribute('class') || '',
        style: f.getAttribute('style') || '',
        allow: f.getAttribute('allow') || '',
        sandbox: f.getAttribute('sandbox') || '',
        referrerpolicy: f.getAttribute('referrerpolicy') || ''
      };
      // remember height to avoid layout jank
      window.__CMS_PREVIEW_H = (f.offsetHeight || 0);
    } catch(_) {}
  }

  function disconnectObservers(){
    try { window.__CMS_IFRAME_OBS && window.__CMS_IFRAME_OBS.disconnect && window.__CMS_IFRAME_OBS.disconnect(); } catch(_){}
    try { window.__cmsPreviewGuardObs && window.__cmsPreviewGuardObs.disconnect && window.__cmsPreviewGuardObs.disconnect(); } catch(_){}
  }

  function clearAllIntervals(){
    try {
      if (window.__cmsIntervals && window.__cmsIntervals.forEach) {
        window.__cmsIntervals.forEach(function(id){ try { clearInterval(id); } catch(_){ } });
        window.__cmsIntervals.clear && window.__cmsIntervals.clear();
      }
    } catch(_){}
  }

  function destroyPreviewFrame(){
    var f = q('previewFrame'); if (!f) return;
    var parent = f.parentNode; if (!parent) return;
    disconnectObservers();
    clearAllIntervals();
    // remove any guard styles living inside the iframe to fully stop work
    try {
      if (f.contentDocument) {
        var d = f.contentDocument;
        var t1 = d.getElementById('editor-header-guard'); if (t1) t1.remove();
        var t2 = d.getElementById('editor-root-colors'); // keep user overrides in DOM? leave it; just remove guards.
      }
    } catch(_){}
    var ph = document.createElement('div');
    ph.id = 'previewFramePlaceholder';
    ph.style.cssText = 'width:100%;' + (window.__CMS_PREVIEW_H ? ('height:'+window.__CMS_PREVIEW_H+'px;') : '');
    parent.replaceChild(ph, f);
  }

  function createPreviewFrame(){
    var ph = q('previewFramePlaceholder'); if (!ph) return;
    var a = window.__CMS_PREVIEW_ATTRS || { id:'previewFrame' };
    var url = window.__CMS_PREVIEW_URL || ph.getAttribute('data-src') || '';
    var f = document.createElement('iframe');
    f.id = a.id || 'previewFrame';
    if (a.class) f.setAttribute('class', a.class);
    f.setAttribute('src', url);
    if (a.style) f.setAttribute('style', a.style);
    if (a.allow) f.setAttribute('allow', a.allow);
    if (a.sandbox) f.setAttribute('sandbox', a.sandbox);
    if (a.referrerpolicy) f.setAttribute('referrerpolicy', a.referrerpolicy);
    // on load, let your existing code patch the iframe (we don't call anything ourselves)
    ph.parentNode.replaceChild(f, ph);
    // keep stored height updated
    setTimeout(function(){ try { window.__CMS_PREVIEW_H = f.offsetHeight || window.__CMS_PREVIEW_H; } catch(_){} }, 0);
  }

  function isBackButton(el){
    var btn = el && el.closest && el.closest('.back-btn, .back-to-cms, [data-action="back-to-cms"]');
    if (btn) return true;
    // heuristic: text-based fallback
    try { if ((el.textContent || '').toLowerCase().indexOf('back to cms') > -1) return true; } catch(_){}
    return false;
  }
  function isColorsButton(el){
    var btn = el && el.closest && el.closest('.color-picker-btn, [data-action="open-colors"], .open-colors');
    if (btn) return true;
    try {
      var t = (el.textContent || '').toLowerCase();
      if (t.indexOf('css editor')>-1 || t.indexOf('colors')>-1) return true;
    } catch(_){}
    return false;
  }

  // Snapshot once, after DOM is ready
  function init(){
    snapshotPreviewTemplate();
    // Debounced switch logic
    var lock = false;
    document.addEventListener('click', function(ev){
      var el = ev.target;
      if (isBackButton(el)) {
        if (lock) { ev.preventDefault(); ev.stopPropagation(); return false; }
        lock = true;
        destroyPreviewFrame();
        setTimeout(function(){ lock = false; }, 200);
      } else if (isColorsButton(el)) {
        if (lock) { ev.preventDefault(); ev.stopPropagation(); return false; }
        lock = true;
        // Recreate if missing
        if (!q('previewFrame')) createPreviewFrame();
        setTimeout(function(){ lock = false; }, 200);
      }
    }, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();
})();
</script>


<script id="cms-preview-guard">
(function(){
  if (window.__cmsPreviewGuard) return; window.__cmsPreviewGuard = true;

  function q(id){ return document.getElementById(id); }

  // --- Snapshot current iframe template so we can recreate it safely (prevents hangs) ---
  function snapshotPreviewTemplate(){
    var f = q('previewFrame');
    if (!f) return;
    try {
      window.__CMS_PREVIEW_URL = f.getAttribute('src') || f.src || window.__CMS_PREVIEW_URL || '';
      window.__CMS_PREVIEW_ATTRS = {
        id: 'previewFrame',
        class: f.getAttribute('class') || '',
        style: f.getAttribute('style') || '',
        allow: f.getAttribute('allow') || '',
        sandbox: f.getAttribute('sandbox') || '',
        referrerpolicy: f.getAttribute('referrerpolicy') || ''
      };
      window.__CMS_PREVIEW_H = f.offsetHeight || window.__CMS_PREVIEW_H || 0;
    } catch(_){}
  }

  function destroyPreviewFrame(){
    var f = q('previewFrame');
    if (!f) return;
    try {
      var ph = document.createElement('div');
      ph.id = 'previewFrame-placeholder';
      ph.style.width = '100%';
      ph.style.height = (window.__CMS_PREVIEW_H || f.offsetHeight || 480) + 'px';
      ph.style.background = '#f8f8f8';
      ph.style.borderRadius = '12px';
      f.parentNode && f.parentNode.replaceChild(ph, f);
    } catch(_){}
  }

  function createPreviewFrame(){
    var a = window.__CMS_PREVIEW_ATTRS || { id:'previewFrame', class:'preview-iframe' };
    var url = window.__CMS_PREVIEW_URL || '';
    var ph = q('previewFrame-placeholder');
    var f = document.createElement('iframe');
    f.setAttribute('id', a.id || 'previewFrame');
    f.setAttribute('class', a.class || 'preview-iframe');
    if (a.style) f.setAttribute('style', a.style);
    if (a.allow) f.setAttribute('allow', a.allow);
    if (a.sandbox) f.setAttribute('sandbox', a.sandbox);
    if (a.referrerpolicy) f.setAttribute('referrerpolicy', a.referrerpolicy);
    if (url) f.setAttribute('src', url);
    if (ph && ph.parentNode) { ph.parentNode.replaceChild(f, ph); }
    setTimeout(function(){ try { window.__CMS_PREVIEW_H = f.offsetHeight || window.__CMS_PREVIEW_H; } catch(_){ } }, 0);
    // Re-apply scroll mode after recreate
    try { applyScrollMode(); } catch(_){}
    // Arm a one-time load handler to snapshot attrs again
    try { f.addEventListener('load', function(){ setTimeout(snapshotPreviewTemplate,0); }, { once:true }); } catch(_){}
  }

  function recreatePreviewFrame(){
    destroyPreviewFrame();
    setTimeout(createPreviewFrame, 0);
  }

  // --- Stall watchdog: if iframe doesn't load in time after we set a new src, recreate it ---
  window.__CMS_PREVIEW_RELOAD_ON_STALL = function(timeoutMs){
    try {
      var f = q('previewFrame');
      if (!f) return;
      var done = false;
      try { f.addEventListener('load', function(){ done = true; }, { once:true }); } catch(_){}
      setTimeout(function(){
        if (!done) { try { recreatePreviewFrame(); } catch(_){} }
      }, Math.max(1000, timeoutMs|0 || 5000));
    } catch(_){}
  };

  // Snapshot once after DOM is ready
  if (document.readyState !== 'loading') setTimeout(snapshotPreviewTemplate, 0);
  else document.addEventListener('DOMContentLoaded', snapshotPreviewTemplate);
  window.addEventListener('load', snapshotPreviewTemplate);

  // --- Single-scroll vs Interact UX ---
  // Default to INTERACT so clicking/editing works immediately.
  window.__cmsScrollMode = window.__cmsScrollMode || 'interact'; // 'interact' or 'page'
  // Temporary override when holding Space (forces 'page' single-scroll while held)
  var __tempOverride = null; // 'page' while Space is down

  window.toggleScrollMode = function(){
    window.__cmsScrollMode = (window.__cmsScrollMode === 'page') ? 'interact' : 'page';
    applyScrollMode();
  };

  window.applyScrollMode = function(){
    var f = q('previewFrame');
    var btn = document.getElementById('scrollModeBtn');
    var effective = __tempOverride || window.__cmsScrollMode;
    if (f) {
      if (effective === 'page') {
        // Disable pointer events so the outer page scrolls with a single scrollbar
        f.style.pointerEvents = 'none';
      } else {
        // Enable full interaction with the preview
        f.style.pointerEvents = 'auto';
      }
    }
    if (btn) {
      var isInteract = (effective === 'interact');
      btn.textContent = isInteract ? '🖱️ Interact' : '🖱️ Scroll Page';
      btn.setAttribute('aria-pressed', isInteract ? 'true' : 'false');
      btn.title = 'E: toggle, hold Space: Scroll Page temporarily';
    }
  };

  // Keyboard shortcuts
  try {
    document.addEventListener('keydown', function(e){
      var k = (e.key || '').toLowerCase();
      if (k === 'e' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        window.toggleScrollMode();
      } else if (e.code === 'Space' && !e.repeat) {
        // While Space is held, temporarily force 'page' mode for single-scroll
        e.preventDefault();
        __tempOverride = 'page';
        applyScrollMode();
      }
    }, { passive: false });

    document.addEventListener('keyup', function(e){
      if (e.code === 'Space') {
        e.preventDefault();
        __tempOverride = null;
        applyScrollMode();
      }
    }, { passive: false });
  } catch(_){}

  // Apply initial mode after DOM ready
  if (document.readyState !== 'loading') setTimeout(window.applyScrollMode, 0);
  else document.addEventListener('DOMContentLoaded', function(){ setTimeout(window.applyScrollMode, 0); });

  // Best-effort: also capture wheel events on the iframe wrapper when in 'page' mode
  try {
    var _attachWheel = function(){
      var f = q('previewFrame');
      if (!f) return;
      f.addEventListener('wheel', function(ev){
        var effective = __tempOverride || window.__cmsScrollMode;
        if (effective === 'page') {
          try { ev.preventDefault(); } catch(_){}
          try { window.scrollBy({ top: ev.deltaY, left: ev.deltaX, behavior: 'auto' }); } catch(_){}
        }
      }, { passive: false });
    };
    if (document.readyState !== 'loading') setTimeout(_attachWheel, 0);
    else document.addEventListener('DOMContentLoaded', _attachWheel);
  } catch(_){}
})();
</script>


</body>
</html>`;
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-cache",
      "Content-Security-Policy": [
        "default-src 'self'",
        "connect-src 'self'",
        "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com",
        "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com",
        "font-src 'self' data: https://fonts.gstatic.com https://cdnjs.cloudflare.com",
        "img-src 'self' data: blob: https://raw.githubusercontent.com",
        "frame-src 'self' blob: https://www.instagram.com https://www.facebook.com",
        "worker-src 'self' blob:",
        "frame-ancestors 'self'",
        "base-uri 'none'",
        "object-src 'none'"
      ].join("; ")
    }
  });
}
