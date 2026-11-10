(() => {
'use strict';
const $ = s => document.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const ed = $('#editor'), sheet = $('#sheet'), stage = $('#stage'), deco = $('#pageDeco'), KEY = 'kidbyte-doc-v7';
let saved = null, selObj = null, zoom = 1, fit = true, orient = 'portrait', mar = 96, pw = 794, ph = 1123, t1, t2, t3;
let pageColor = '#ffffff', border = 'none', hHeader = '', hFooter = '', hPageNum = false;
let painter = null, cropMode = false, cropRect = null;
const esc = s => s.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const maxObjW = () => pw - 2 * mar;

const html = () => {
  const c = ed.cloneNode(true);
  $$('.auto-pb,#imgHandles,#moveGrip,#objDel', c).forEach(n => n.remove());
  $$('.sel', c).forEach(n => { n.classList.remove('sel'); if (!n.className) n.removeAttribute('class'); });
  return c.innerHTML;
};

function toast(m) {
  const t = $('#toast'); t.textContent = m; t.classList.add('show');
  clearTimeout(t1); t1 = setTimeout(() => t.classList.remove('show'), 2600);
}
function clean(h) {
  const d = new DOMParser().parseFromString(h, 'text/html');
  $$('script,iframe,object,embed,link,style', d).forEach(n => n.remove());
  $$('*', d).forEach(n => [...n.attributes].forEach(a => {
    if (/^on/i.test(a.name) || /^\s*javascript:/i.test(a.value)) n.removeAttribute(a.name);
  }));
  return d.body.innerHTML;
}

/* ---------- selection helpers ---------- */
document.addEventListener('selectionchange', () => {
  const s = getSelection();
  if (s.rangeCount && ed.contains(s.anchorNode)) { saved = s.getRangeAt(0).cloneRange(); state(); cur(); }
});
function restore() {
  ed.focus();
  if (saved) { const s = getSelection(); s.removeAllRanges(); s.addRange(saved); }
}
function run(c, v = null) {
  restore();
  document.execCommand('styleWithCSS', false, true);
  document.execCommand(c, false, v);
  after();
}
function setSize(px) {
  restore();
  document.execCommand('styleWithCSS', false, false);
  document.execCommand('fontSize', false, '7');
  $$('font[size="7"]', ed).forEach(f => { f.removeAttribute('size'); f.style.fontSize = px + 'px'; });
  after();
}
function blocks() {
  restore();
  const r = getSelection().getRangeAt(0);
  return [...ed.children].filter(c => r.intersectsNode(c));
}
function state() {
  $$('button[data-cmd]').forEach(b => {
    let on = false;
    try { on = document.queryCommandState(b.dataset.cmd); } catch (e) {}
    b.classList.toggle('on', !!on);
  });
}

/* ---------- floating objects with strict margin constraints ---------- */
const handleBox = document.createElement('div');
handleBox.id = 'imgHandles'; handleBox.className = 'imgHandles';
['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].forEach(d => {
  const h = document.createElement('span'); h.className = 'imgHandle h-' + d; h.dataset.dir = d;
  handleBox.appendChild(h);
});
const moveGrip = document.createElement('div'); moveGrip.id = 'moveGrip'; moveGrip.textContent = '⠿'; moveGrip.title = 'Drag to move';
const delBtn = document.createElement('button'); delBtn.id = 'objDel'; delBtn.textContent = '✕'; delBtn.title = 'Delete';
function mountChrome() { ed.appendChild(handleBox); ed.appendChild(moveGrip); ed.appendChild(delBtn); }
mountChrome();

const cropBar = document.createElement('div'); cropBar.className = 'ctxBar';
cropBar.innerHTML = '<button id="cropBtn">✂ Crop</button><button id="cropApply" style="display:none">✔ Apply</button><button id="cropCancel" style="display:none">✕ Cancel</button>';
sheet.appendChild(cropBar);
const cropOverlay = document.createElement('div'); cropOverlay.className = 'cropOverlay';
sheet.appendChild(cropOverlay);

function updateHandles() {
  if (!selObj || cropMode) {
    handleBox.style.display = 'none'; moveGrip.style.display = 'none'; delBtn.style.display = 'none';
    if (!cropMode) cropBar.style.display = 'none';
    return;
  }
  const L = selObj.offsetLeft, T = selObj.offsetTop, W = selObj.offsetWidth, H = selObj.offsetHeight;
  handleBox.style.display = 'block'; handleBox.style.left = L + 'px'; handleBox.style.top = T + 'px';
  handleBox.style.width = W + 'px'; handleBox.style.height = H + 'px';
  delBtn.style.display = 'flex'; delBtn.style.left = (L + W - 10) + 'px'; delBtn.style.top = (T - 10) + 'px';
  if (selObj.tagName !== 'IMG') { moveGrip.style.display = 'flex'; moveGrip.style.left = (L - 11) + 'px'; moveGrip.style.top = (T - 11) + 'px'; }
  else moveGrip.style.display = 'none';
  if (selObj.tagName === 'IMG') {
    cropBar.style.display = 'flex'; cropBar.style.left = L + 'px'; cropBar.style.top = Math.max(0, T - 40) + 'px';
  } else cropBar.style.display = 'none';
}
function selectObj(el) {
  $$('.sel', ed).forEach(i => i.classList.remove('sel'));
  selObj = el || null;
  if (selObj) selObj.classList.add('sel');
  updateHandles();
}
delBtn.onclick = () => { if (selObj) { selObj.remove(); selectObj(null); after(); } };
document.addEventListener('keydown', e => {
  if ((e.key === 'Delete' || e.key === 'Backspace') && selObj && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName) && !document.activeElement.isContentEditable) {
    e.preventDefault();
    selObj.remove(); selectObj(null); after();
  }
});

let rz = null;
handleBox.addEventListener('mousedown', e => {
  const h = e.target.closest('.imgHandle'); if (!h || !selObj) return;
  e.preventDefault();
  const z = parseFloat(sheet.style.zoom) || 1;
  rz = {
    dir: h.dataset.dir, x: e.clientX, y: e.clientY, z,
    w: selObj.offsetWidth, h: selObj.offsetHeight,
    ar: selObj.offsetWidth / selObj.offsetHeight,
    scale: parseFloat(selObj.dataset.scale || 1), design: parseInt(selObj.dataset.design || 320)
  };
  document.addEventListener('mousemove', onResizeMove);
  document.addEventListener('mouseup', onResizeUp);
});
function onResizeMove(e) {
  if (!rz || !selObj) return;
  const dx = (e.clientX - rz.x) / rz.z, dy = (e.clientY - rz.y) / rz.z, d = rz.dir;
  const maxW = maxObjW();
  if (selObj.classList.contains('chart')) {
    const factor = 1 + (dx + dy) / 220;
    const scale = Math.max(0.4, Math.min(2.5, rz.scale * factor));
    const desW = rz.design * scale;
    if (desW > maxW) return;
    const stg = selObj.querySelector('.chartStage');
    if (stg) stg.style.transform = 'scale(' + scale + ')';
    selObj.style.width = desW + 'px';
    selObj.style.height = (selObj.dataset.designH ? (+selObj.dataset.designH * scale) : desW) + 'px';
    selObj.dataset.scale = scale;
  } else if (selObj.tagName === 'IMG') {
    let w = rz.w, h = rz.h;
    if (d.includes('e')) w = rz.w + dx;
    if (d.includes('w')) w = rz.w - dx;
    if (d === 'n' || d === 's') { h = d === 's' ? rz.h + dy : rz.h - dy; w = rz.w; }
    else h = w / rz.ar;
    w = Math.max(20, Math.min(maxW, w)); h = Math.max(20, h);
    selObj.style.width = w + 'px';
    selObj.style.height = h + 'px';
  } else {
    let w = rz.w, h = rz.h;
    if (d.includes('e')) w = rz.w + dx;
    if (d.includes('w')) w = rz.w - dx;
    if (d.includes('s')) h = rz.h + dy;
    if (d.includes('n')) h = rz.h - dy;
    selObj.style.width = Math.max(80, Math.min(maxW, w)) + 'px';
    selObj.style.height = Math.max(40, h) + 'px';
  }
  updateHandles();
}
function onResizeUp() { rz = null; document.removeEventListener('mousemove', onResizeMove); document.removeEventListener('mouseup', onResizeUp); after(); }

let mv = null;
ed.addEventListener('mousedown', e => {
  const obj = e.target.closest('.kb-obj') || (e.target.tagName === 'IMG' ? e.target : null);
  if (!obj) return;
  const z = parseFloat(sheet.style.zoom) || 1;
  mv = { img: obj, x: e.clientX, y: e.clientY, moved: false, left: obj.offsetLeft, top: obj.offsetTop, z };
});
moveGrip.addEventListener('mousedown', e => {
  if (!selObj) return; e.preventDefault();
  const z = parseFloat(sheet.style.zoom) || 1;
  mv = { img: selObj, x: e.clientX, y: e.clientY, moved: false, left: selObj.offsetLeft, top: selObj.offsetTop, z, direct: true };
});
document.addEventListener('mousemove', e => {
  if (!mv) return;
  const dx = e.clientX - mv.x, dy = e.clientY - mv.y;
  if (!mv.moved && !mv.direct && Math.hypot(dx, dy) < 4) return;
  mv.moved = true;
  const el = mv.img;
  if (el.style.position !== 'absolute') {
    el.style.position = 'absolute'; el.style.float = 'none'; el.style.margin = '0';
    el.style.left = mv.left + 'px'; el.style.top = mv.top + 'px';
  }
  const maxW = maxObjW() - el.offsetWidth;
  const newL = Math.max(0, Math.min(maxW, mv.left + dx / mv.z));
  el.style.left = newL + 'px';
  el.style.top = (mv.top + dy / mv.z) + 'px';
  if (selObj === el) updateHandles();
});
document.addEventListener('mouseup', () => {
  if (mv && mv.moved) { selectObj(mv.img); after(); }
  mv = null;
});
ed.addEventListener('click', e => {
  const obj = e.target.closest('.kb-obj');
  if (e.target.tagName === 'IMG') selectObj(e.target);
  else if (obj) selectObj(obj);
  else if (e.target === ed) selectObj(null);
});

/* crop */
function endCrop() { cropMode = false; cropOverlay.style.display = 'none'; updateHandles(); }
cropBar.querySelector('#cropBtn').onclick = () => {
  if (!selObj || selObj.tagName !== 'IMG') return;
  cropMode = true;
  const iw = selObj.offsetWidth, ih = selObj.offsetHeight;
  cropRect = { x: iw * 0.1, y: ih * 0.1, w: iw * 0.8, h: ih * 0.8 };
  cropOverlay.style.display = 'block';
  cropOverlay.style.left = selObj.offsetLeft + 'px'; cropOverlay.style.top = selObj.offsetTop + 'px';
  cropOverlay.style.width = iw + 'px'; cropOverlay.style.height = ih + 'px';
  cropOverlay.innerHTML = '<div class="cropMask"></div><div class="cropRect"><span class="ch nw"></span><span class="ch ne"></span><span class="ch sw"></span><span class="ch se"></span></div>';
  positionCropRect();
  handleBox.style.display = 'none'; moveGrip.style.display = 'none'; delBtn.style.display = 'none';
  cropBar.querySelector('#cropBtn').style.display = 'none';
  cropBar.querySelector('#cropApply').style.display = 'inline-flex';
  cropBar.querySelector('#cropCancel').style.display = 'inline-flex';
};
function positionCropRect() {
  const r = cropOverlay.querySelector('.cropRect'), m = cropOverlay.querySelector('.cropMask');
  r.style.left = cropRect.x + 'px'; r.style.top = cropRect.y + 'px'; r.style.width = cropRect.w + 'px'; r.style.height = cropRect.h + 'px';
  m.style.left = cropRect.x + 'px'; m.style.top = cropRect.y + 'px'; m.style.width = cropRect.w + 'px'; m.style.height = cropRect.h + 'px';
  m.style.boxShadow = '0 0 0 2000px rgba(0,0,0,.45)';
}
cropOverlay.addEventListener('mousedown', e => {
  const h = e.target.closest('.ch'); if (!h) return;
  e.preventDefault();
  const dir = [...h.classList].find(c => c !== 'ch');
  const z = parseFloat(sheet.style.zoom) || 1, start = { x: e.clientX, y: e.clientY, r: { ...cropRect } };
  function mv2(e2) {
    const dx = (e2.clientX - start.x) / z, dy = (e2.clientY - start.y) / z;
    let { x, y, w, h: hh } = start.r;
    if (dir.includes('e')) w = start.r.w + dx;
    if (dir.includes('w')) { x = start.r.x + dx; w = start.r.w - dx; }
    if (dir.includes('s')) hh = start.r.h + dy;
    if (dir.includes('n')) { y = start.r.y + dy; hh = start.r.h - dy; }
    x = Math.max(0, Math.min(x, selObj.offsetWidth - 24));
    y = Math.max(0, Math.min(y, selObj.offsetHeight - 24));
    w = Math.max(24, Math.min(w, selObj.offsetWidth - x));
    hh = Math.max(24, Math.min(hh, selObj.offsetHeight - y));
    cropRect = { x, y, w, h: hh };
    positionCropRect();
  }
  function up() { document.removeEventListener('mousemove', mv2); document.removeEventListener('mouseup', up); }
  document.addEventListener('mousemove', mv2); document.addEventListener('mouseup', up);
});
cropBar.querySelector('#cropApply').onclick = () => {
  const scaleF = selObj.naturalWidth / selObj.offsetWidth;
  const sx = cropRect.x * scaleF, sy = cropRect.y * scaleF, sw = cropRect.w * scaleF, sh = cropRect.h * scaleF;
  const c = document.createElement('canvas'); c.width = sw; c.height = sh;
  const g = c.getContext('2d'), tmp = new Image(); tmp.crossOrigin = 'anonymous';
  tmp.onload = () => {
    try {
      g.drawImage(tmp, sx, sy, sw, sh, 0, 0, sw, sh);
      selObj.src = c.toDataURL();
      selObj.style.width = cropRect.w + 'px'; selObj.style.height = cropRect.h + 'px';
    } catch (err) { toast('This picture can\u2019t be cropped.'); }
    endCrop(); after();
  };
  tmp.onerror = () => { toast('Could not crop this picture.'); endCrop(); };
  tmp.src = selObj.src;
};
cropBar.querySelector('#cropCancel').onclick = endCrop;

/* ---------- pagination ---------- */
function paginate() {
  $$('.auto-pb', ed).forEach(n => n.remove());
  ed.normalize();
  const contentH = Math.max(60, ph - 2 * mar), gap = 2 * mar;
  const k = (ed.getBoundingClientRect().width / ed.offsetWidth) || 1;
  const rel = y => (y - ed.getBoundingClientRect().top) / k;
  const box = el => { const r = el.getBoundingClientRect(); return { top: rel(r.top), bottom: rel(r.bottom), height: r.height / k }; };
  let bottom = ph - mar, pages = 1;
  const advance = () => { bottom += ph; pages++; };
  const isFloat = el => el === handleBox || el === moveGrip || el === delBtn || getComputedStyle(el).position === 'absolute';
  const isAtomic = el => /^(IMG|SVG|CANVAS|HR|INPUT|SELECT|TEXTAREA|BUTTON|VIDEO|IFRAME)$/.test(el.tagName.toUpperCase()) || el.classList.contains('kb-obj');
  const hasBlock = el => [...el.children].some(c => !(isFloat(c) || isAtomic(c) || c.classList.contains('auto-pb')) && !/^(inline|contents|none)/.test(getComputedStyle(c).display));
  const blockish = el => !/^(inline|contents|none)/.test(getComputedStyle(el).display) || hasBlock(el);

  const makeSpacer = parent => {
    const t = parent.tagName;
    let sp;
    if (t === 'UL' || t === 'OL') sp = document.createElement('li');
    else if (/^(TABLE|TBODY|THEAD|TFOOT)$/.test(t)) {
      sp = document.createElement('tr');
      const td = sp.appendChild(document.createElement('td'));
      const first = parent.closest('table').rows[0];
      td.colSpan = first ? [...first.cells].reduce((a, c) => a + c.colSpan, 0) || 1 : 1;
    } else sp = document.createElement('span');
    sp.className = 'auto-pb'; sp.contentEditable = 'false';
    return sp;
  };
  const setH = (sp, h) => { (sp.tagName === 'TR' ? sp.firstChild : sp).style.height = h + 'px'; };
  const place = sp => {
    setH(sp, 1);
    const top = rel(sp.getBoundingClientRect().top);
    setH(sp, Math.max(0, bottom + gap - top));
    advance();
  };
  const pushBefore = el => { const sp = makeSpacer(el.parentNode); el.parentNode.insertBefore(sp, el); place(sp); };
  const overflow = b => { while (bottom < b.bottom - 0.5) advance(); };

  const leaves = (n, out) => {
    for (const c of n.childNodes) {
      if (c.nodeType === 3) { if (c.data.trim()) out.push(c); }
      else if (c.nodeType === 1 && !c.classList.contains('auto-pb') && !isFloat(c)) {
        if (isAtomic(c)) out.push(c); else if (c.tagName !== 'BR') leaves(c, out);
      }
    }
    return out;
  };
  const rg = document.createRange();
  const charBottom = (n, o) => {
    for (let i = o; i < Math.min(n.length, o + 8); i++) {
      rg.setStart(n, i); rg.setEnd(n, i + 1);
      for (const r of rg.getClientRects()) if (r.height > 0) return rel(r.bottom);
    }
    return -1e9;
  };
  const splitIn = list => {
    for (let i = 0; i < list.length; i++) {
      const n = list[i];
      let off = 0;
      if (n.nodeType === 3) {
        rg.selectNodeContents(n);
        if (rel(rg.getBoundingClientRect().bottom) <= bottom + 0.5) continue;
        let lo = 0, hi = n.length - 1;
        while (lo < hi) { const mid = (lo + hi) >> 1; if (charBottom(n, mid) > bottom + 0.5) hi = mid; else lo = mid + 1; }
        off = lo;
        if (charBottom(n, off) <= bottom + 0.5) continue;
      } else if (box(n).bottom <= bottom + 0.5) continue;
      if (i === 0 && off === 0) return false;
      const r = document.createRange();
      if (n.nodeType === 3) r.setStart(n, off); else r.setStartBefore(n);
      r.collapse(true);
      const sp = makeSpacer(n.parentNode);
      r.insertNode(sp);
      place(sp);
      return true;
    }
    return false;
  };
  const splitInline = el => splitIn(leaves(el, []));

  const handleRun = (first, end) => {
    for (let guard = 0; guard < 300; guard++) {
      const list = [];
      for (let n = first; n && n !== end; n = n.nextSibling) {
        if (n.nodeType === 3) { if (n.data.trim()) list.push(n); }
        else if (n.nodeType === 1 && !n.classList.contains('auto-pb') && !isFloat(n)) {
          if (isAtomic(n)) list.push(n); else if (n.tagName !== 'BR') leaves(n, list);
        }
      }
      if (!list.length) return;
      rg.setStartBefore(list[0]); rg.setEndAfter(list[list.length - 1]);
      const rb = rg.getBoundingClientRect(), b = { top: rel(rb.top), bottom: rel(rb.bottom) };
      if (b.bottom <= bottom + 0.5) return;
      if (splitIn(list)) continue;
      if (b.top <= bottom - contentH + 3 && b.top < bottom - 0.5) { overflow(b); return; }
      pushBefore(first);
    }
  };

  const handle = el => {
    for (let guard = 0; guard < 300; guard++) {
      const b = box(el);
      if (b.bottom <= bottom + 0.5 || b.height === 0) return;
      const tag = el.tagName, atTop = b.top <= bottom - contentH + 3;
      if (tag === 'TD' || tag === 'TH') {
        if (hasBlock(el)) { walk(el); return; }
        if (!splitInline(el)) return;
        continue;
      }
      if (isAtomic(el) || b.top >= bottom - 0.5 || (tag === 'TR' && b.height <= contentH)) {
        if (atTop && b.top < bottom - 0.5) { overflow(b); return; }
        pushBefore(el); continue;
      }
      if (hasBlock(el) || /^(TABLE|TBODY|THEAD|TFOOT|TR)$/.test(tag)) { walk(el); return; }
      if (!splitInline(el)) { if (atTop) { overflow(b); return; } pushBefore(el); continue; }
    }
  };
  function walk(parent) {
    let first = null;
    const flush = end => { if (first) { handleRun(first, end); first = null; } };
    for (const node of [...parent.childNodes]) {
      if (node.nodeType === 1 && (isFloat(node) || node.classList.contains('auto-pb'))) continue;
      if (node.nodeType === 3 || (node.nodeType === 1 && !blockish(node))) { if (!first) first = node; continue; }
      if (node.nodeType !== 1) continue;
      flush(node);
      if (node.classList.contains('pb')) {
        setH(node, 1);
        const top = rel(node.getBoundingClientRect().top);
        node.style.height = Math.max(0, bottom + gap - top) + 'px';
        advance();
      } else handle(node);
    }
    flush(null);
  }
  walk(ed);
  ed.style.minHeight = pages * ph + 'px';
  return pages;
}
function decorate(pages) {
  deco.innerHTML = '';
  deco.style.height = pages * ph + 'px';
  for (let i = 0; i < pages; i++) {
    const top = i * ph;
    if (i > 0) { const ln = document.createElement('div'); ln.className = 'pgband'; ln.style.top = (top - 10) + 'px'; deco.appendChild(ln); }
    if (border !== 'none') {
      const r = document.createElement('div'); r.className = 'pgrect ' + border;
      r.style.top = (top + 4) + 'px'; r.style.height = (ph - 8) + 'px'; deco.appendChild(r);
    }
    if (hHeader) {
      const h = document.createElement('div'); h.className = 'pghead';
      h.style.top = (top + mar * 0.32) + 'px'; h.textContent = hHeader; deco.appendChild(h);
    }
    if (hFooter || hPageNum) {
      const f = document.createElement('div'); f.className = 'pgfoot';
      f.style.top = (top + ph - mar * 0.55) + 'px';
      f.textContent = [hFooter, hPageNum ? ('Page ' + (i + 1) + ' of ' + pages) : ''].filter(Boolean).join('   ·   ');
      deco.appendChild(f);
    }
  }
}

function layout() {
  [pw, ph] = orient === 'portrait' ? [794, 1123] : [1123, 794];
  sheet.style.setProperty('--pw', pw + 'px');
  sheet.style.setProperty('--ph', ph + 'px');
  sheet.style.setProperty('--m', mar + 'px');
  sheet.style.setProperty('--pc', pageColor);
  $('#pg').textContent = `@page{size:A4 ${orient};margin:${(mar * 0.2646).toFixed(1)}mm}`;
  const pages = paginate();
  decorate(pages);
  if (fit) zoom = Math.min(1, (stage.clientWidth - 20) / pw);
  sheet.style.zoom = zoom;
  $('#zoom2').value = Math.round(zoom * 100);
  $('#zoomPct').textContent = Math.round(zoom * 100) + '%';
  updateHandles();
  return pages;
}
function stats() {
  const n = layout(), t = ed.innerText || '', w = t.trim() ? t.trim().split(/\s+/).length : 0;
  $('#sPages').textContent = n;
  $('#sWords').textContent = w;
  $('#sChars').textContent = t.replace(/\n/g, '').length;
  cur();
}
function cur() {
  let p = 1;
  const s = getSelection();
  if (s.rangeCount && ed.contains(s.anchorNode)) {
    let r = s.getRangeAt(0).getBoundingClientRect();
    if (!r.height) { const e = s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement; r = e.getBoundingClientRect(); }
    p = Math.floor((r.top - ed.getBoundingClientRect().top) / (ph * zoom)) + 1;
  }
  $('#sPage').textContent = Math.min(Math.max(1, p), +$('#sPages').textContent);
}
function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      t: $('#docTitle').value, h: html(), o: orient, m: mar,
      pc: pageColor, bd: border, hh: hHeader, hf: hFooter, hn: hPageNum
    }));
  } catch (e) { toast('Too big to auto-save.'); }
}
function after() { 
  stats(); 
  clearTimeout(t2); t2 = setTimeout(persist, 600); 
}

/* ---------- images & objects ---------- */
function insImg(src) {
  const i = document.createElement('img'); i.src = src; i.alt = 'image'; i.className = 'kb-obj'; 
  i.style.maxWidth = '100%';
  i.style.width = Math.min(300, maxObjW()) + 'px';
  run('insertHTML', i.outerHTML);
}
function fileImg(f) {
  if (!f || !f.type.startsWith('image/')) return toast('Please choose an image file.');
  const r = new FileReader();
  r.onload = () => {
    const im = new Image();
    im.onload = () => {
      const k = Math.min(1, 1600 / im.width), c = document.createElement('canvas');
      c.width = im.width * k; c.height = im.height * k;
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      insImg(f.type === 'image/png' ? c.toDataURL() : c.toDataURL('image/jpeg', 0.88));
    };
    im.src = r.result;
  };
  r.readAsDataURL(f);
}

function cell() {
  restore();
  const n = getSelection().anchorNode;
  return n && (n.nodeType === 1 ? n : n.parentElement).closest('td');
}

/* ---------- shapes / icons / stickers ---------- */
const SHAPES = {
  'Rectangle': '<rect x="6" y="10" width="108" height="80" rx="4" fill="#efedff" stroke="#6558f5" stroke-width="4"/>',
  'Circle': '<circle cx="60" cy="50" r="44" fill="#efedff" stroke="#6558f5" stroke-width="4"/>',
  'Triangle': '<polygon points="60,8 112,92 8,92" fill="#efedff" stroke="#6558f5" stroke-width="4"/>',
  'Star': '<polygon points="60,4 73,40 112,40 80,63 92,100 60,78 28,100 40,63 8,40 47,40" fill="#fff176" stroke="#e0a800" stroke-width="3"/>',
  'Arrow': '<polygon points="4,36 70,36 70,14 116,50 70,86 70,64 4,64" fill="#d9f8e7" stroke="#2e9e5b" stroke-width="4"/>',
  'Heart': '<path d="M60 92 14 52a24 24 0 0 1 34-34l12 12 12-12a24 24 0 0 1 34 34z" fill="#ffd3e0" stroke="#d6336c" stroke-width="4"/>',
  'Speech bubble': '<path d="M10 10h100v60H54l-16 18V70H10z" fill="#e7f0ff" stroke="#2b6cb0" stroke-width="4"/>',
  'Diamond': '<polygon points="60,6 114,50 60,94 6,50" fill="#ffe7cf" stroke="#d07d1d" stroke-width="4"/>',
  'Pentagon': '<polygon points="60,6 112,42 92,96 28,96 8,42" fill="#e4f8d9" stroke="#5a9c2b" stroke-width="4"/>',
  'Line': '<line x1="6" y1="50" x2="114" y2="50" stroke="#555" stroke-width="6"/>'
};
function shapeUrl(name) {
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 100">${SHAPES[name]}</svg>`);
}
function stickerImg(ch, px) {
  const c = document.createElement('canvas'); c.width = c.height = px;
  const g = c.getContext('2d'); g.font = (px * 0.78) + 'px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(ch, px / 2, px / 2 + px * 0.06);
  return c.toDataURL();
}
const ICONS = ['🏠','⭐','❤️','✅','📌','📁','📄','⚙️','🔍','➡️','⬅️','⬆️','⬇️','🔔','💬','📷','🎵','🔒','🖊️','🏆','📎','🗂️','📊','💡'];
const STICKERS = ['🎉','🚀','🌟','🦄','🐶','🐱','🌈','🔥','🎈','🍀','😀','😂','👍','🥳','🧠','🎨','⚽','📚','🌞','🍕','🍦','🏅','🎵','🐸'];

/* ---------- charts & diagrams ---------- */
const THEMES = {
  purple: { node: '#efedff', text: '#3b2f91', line: '#6558f5' },
  ocean: { node: '#e3f2fd', text: '#0b4a6f', line: '#2b8fd1' },
  forest: { node: '#e6f7e9', text: '#1f5e32', line: '#3fa95c' },
  sunset: { node: '#fff0e0', text: '#8a3d06', line: '#e8842b' },
  candy: { node: '#ffe3ef', text: '#8a1550', line: '#e85f9e' },
  mono: { node: '#f0f0f3', text: '#333333', line: '#777777' }
};
function nodeStyle(theme) { return `background:${theme.node};color:${theme.text};border-radius:14px;display:flex;align-items:center;justify-content:center;text-align:center;font-weight:800;font-size:12px;padding:6px;box-shadow:0 3px 10px rgba(0,0,0,.12);outline-offset:2px`; }
function cycleChart(labels, theme) {
  const n = labels.length, design = Math.min(320, maxObjW()), R = 110, C = 160;
  const pos = labels.map((_, i) => { const a = (Math.PI * 2 * i) / n - Math.PI / 2; return [C + R * Math.cos(a), C + R * Math.sin(a)]; });
  let nodes = '', lines = '', defs = '';
  pos.forEach(([x, y], i) => { nodes += `<div contenteditable="true" style="position:absolute;left:${x - 52}px;top:${y - 30}px;width:104px;min-height:60px;${nodeStyle(theme)}">${labels[i]}</div>`; });
  pos.forEach(([x1, y1], i) => {
    const [x2, y2] = pos[(i + 1) % n];
    defs += `<marker id="ar${i}" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0L0,6L8,3z" fill="${theme.line}"/></marker>`;
    lines += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${theme.line}" stroke-width="3" marker-end="url(#ar${i})"/>`;
  });
  const svg = `<svg width="${design}" height="${design}" viewBox="0 0 ${design} ${design}" style="position:absolute;left:0;top:0;pointer-events:none"><defs>${defs}</defs>${lines}</svg>`;
  return `<div class="kb-obj chart" contenteditable="false" data-scale="1" data-design="${design}" data-designh="${design}" style="position:relative;width:${design}px;height:${design}px;display:inline-block;margin:14px auto;vertical-align:top"><div class="chartStage" style="position:absolute;left:0;top:0;width:${design}px;height:${design}px;transform-origin:top left">${svg}${nodes}</div></div>`;
}
function processChart(labels, theme) {
  const n = labels.length, boxW = 100, gap = 30, designH = 140, design = Math.min(n * boxW + (n - 1) * gap + 24, maxObjW());
  let inner = `<div style="position:absolute;left:12px;top:30px;display:flex;align-items:center;gap:${gap}px">`;
  labels.forEach((l, i) => {
    inner += `<div contenteditable="true" style="width:${boxW}px;min-height:72px;${nodeStyle(theme)}">${l}</div>`;
    if (i < n - 1) inner += `<div style="font-size:22px;color:${theme.line};font-weight:900">→</div>`;
  });
  inner += '</div>';
  return `<div class="kb-obj chart" contenteditable="false" data-scale="1" data-design="${design}" data-designh="${designH}" style="position:relative;width:${design}px;height:${designH}px;display:inline-block;margin:14px auto"><div class="chartStage" style="position:absolute;left:0;top:0;width:${design}px;height:${designH}px;transform-origin:top left">${inner}</div></div>`;
}
function pyramidChart(labels, theme) {
  const n = labels.length, design = Math.min(280, maxObjW()), levelH = 64, designH = n * levelH + 16;
  let inner = '<div style="position:absolute;left:0;top:10px;width:100%">';
  labels.forEach((l, i) => {
    const w = design - i * (design / n) * 0.5;
    inner += `<div contenteditable="true" style="width:${w}px;margin:4px auto;min-height:${levelH - 12}px;${nodeStyle(theme)}">${l}</div>`;
  });
  inner += '</div>';
  return `<div class="kb-obj chart" contenteditable="false" data-scale="1" data-design="${design}" data-designh="${designH}" style="position:relative;width:${design}px;height:${designH}px;display:inline-block;margin:14px auto"><div class="chartStage" style="position:absolute;left:0;top:0;width:${design}px;height:${designH}px;transform-origin:top left">${inner}</div></div>`;
}
function comparisonChart(a, b, theme) {
  const design = Math.min(360, maxObjW()), designH = 160;
  const inner = `<div style="position:absolute;left:0;top:0;width:100%;height:100%;display:flex;gap:18px;align-items:center;justify-content:center">
    <div contenteditable="true" style="flex:1;min-height:120px;${nodeStyle(theme)}">${a}</div>
    <div style="font-weight:900;color:${theme.line};font-size:16px">VS</div>
    <div contenteditable="true" style="flex:1;min-height:120px;${nodeStyle(theme)}">${b}</div></div>`;
  return `<div class="kb-obj chart" contenteditable="false" data-scale="1" data-design="${design}" data-designh="${designH}" style="position:relative;width:${design}px;height:${designH}px;display:inline-block;margin:14px auto"><div class="chartStage" style="position:absolute;left:0;top:0;width:${design}px;height:${designH}px;transform-origin:top left">${inner}</div></div>`;
}
const CHART_DEFS = [
  { label: '🔄 Cycle chart · 3 steps', build: th => cycleChart(['Step 1', 'Step 2', 'Step 3'], th) },
  { label: '🔄 Cycle chart · 4 steps', build: th => cycleChart(['Evaporation', 'Condensation', 'Precipitation', 'Collection'], th) },
  { label: '➡️ Process flow · 3 steps', build: th => processChart(['Step 1', 'Step 2', 'Step 3'], th) },
  { label: '🔺 Pyramid · 3 levels', build: th => pyramidChart(['Top', 'Middle', 'Base'], th) },
  { label: '⚖️ Comparison · 2 sides', build: th => comparisonChart('Option A', 'Option B', th) }
];

const pickerBack = $('#pickerBack'), picker = $('#picker'), pickerGrid = $('#pickerGrid'), pickerTitle = $('#pickerTitle');
function closePicker() { picker.classList.remove('show'); pickerBack.classList.remove('show'); }
function openPicker(title, kind) {
  restore();
  pickerTitle.textContent = title;
  pickerGrid.innerHTML = ''; pickerGrid.classList.toggle('list', kind === 'charts');
  if (kind === 'shapes') {
    Object.keys(SHAPES).forEach(name => {
      const b = document.createElement('button'); b.title = name;
      b.innerHTML = `<img src="${shapeUrl(name)}" alt="${name}">`;
      b.onclick = () => { insImg(shapeUrl(name)); closePicker(); toast('Shape added within margins.'); };
      pickerGrid.appendChild(b);
    });
  } else if (kind === 'charts') {
    const theme = THEMES[$('#chartTheme').value] || THEMES.purple;
    CHART_DEFS.forEach(cd => {
      const b = document.createElement('button'); b.className = 'chartOpt'; b.textContent = cd.label;
      b.onclick = () => { run('insertHTML', cd.build(theme) + '<p><br></p>'); closePicker(); toast('Chart added within margins.'); };
      pickerGrid.appendChild(b);
    });
  } else {
    const list = kind === 'icons' ? ICONS : STICKERS, px = kind === 'icons' ? 64 : 96;
    list.forEach(ch => {
      const b = document.createElement('button'); b.textContent = ch;
      b.onclick = () => { insImg(stickerImg(ch, px)); closePicker(); toast('Added within margins.'); };
      pickerGrid.appendChild(b);
    });
  }
  picker.classList.add('show'); pickerBack.classList.add('show');
}
$('#pickerClose').onclick = closePicker;
pickerBack.onclick = closePicker;

/* ---------- header / footer modal ---------- */
const hfModal = $('#hfModal'), modalBack = $('#modalBack');
function openHF() {
  $('#hfHeader').value = hHeader; $('#hfFooter').value = hFooter; $('#hfPageNum').checked = hPageNum;
  hfModal.classList.add('show'); modalBack.classList.add('show');
}
function closeHF() { hfModal.classList.remove('show'); modalBack.classList.remove('show'); }
$('#hfCancel').onclick = closeHF;
modalBack.onclick = closeHF;
$('#hfOk').onclick = () => {
  hHeader = $('#hfHeader').value.trim(); hFooter = $('#hfFooter').value.trim(); hPageNum = $('#hfPageNum').checked;
  closeHF(); after(); toast('Header & footer updated.');
};

/* ---------- Robust Multi-Page A4 Standalone Export ---------- */
function exportHtml() {
  const t = $('#docTitle').value || 'document';
  const mm = (mar * 0.2646).toFixed(1);
  const rawContent = html();
  
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(t)}</title>
<style>
@page{size:A4 ${orient};margin:${mm}mm}
*{box-sizing:border-box}
html,body{margin:0;background:#eef0fb;font-family:"Trebuchet MS",Arial,sans-serif;color:#242541}
.page{position:relative;margin:20px auto;width:${pw}px;height:${ph}px;padding:${mar}px;background:${pageColor};box-shadow:0 6px 30px rgba(48,50,100,.18);overflow:hidden;page-break-after:always;break-after:page}
.page-content{position:relative;width:100%;height:100%;overflow:hidden}
.page img{max-width:100%;vertical-align:middle}
.page table{border-collapse:collapse;width:100%;margin:0 0 10px}
.page td{border:1px solid #999;padding:6px;vertical-align:top}
.page h1{font-size:2em;margin:.5em 0 .3em}
.page h2{font-size:1.5em;margin:.5em 0 .3em}
.page h3{font-size:1.2em;margin:.5em 0 .3em}
.page blockquote{border-left:4px solid #6558f5;padding:6px 14px;color:#555;background:#f7f6ff;margin:0 0 10px}
.page pre{background:#f3f3f8;padding:10px;border-radius:6px;font-family:Consolas,monospace;white-space:pre-wrap}
.kb-obj.textbox{border:2px dashed #cfc9fb;border-radius:10px;padding:12px;background:#fff}
.kb-obj.chart{display:inline-block;margin:14px auto}
.pgrect{position:absolute;left:6px;right:6px;top:4px;height:${ph-8}px;box-sizing:border-box;pointer-events:none}
.pgrect.simple{border:2px solid #4b4b66}
.pgrect.rounded{border:3px solid #6558f5;border-radius:16px}
.pgrect.double{border:3px double #333;outline:2px solid #333;outline-offset:-7px}
.pgrect.shadow{box-shadow:inset 0 0 0 10px rgba(101,88,245,.08)}
.pghead{position:absolute;left:${mar}px;right:${mar}px;top:${mar*0.32}px;text-align:center;font-size:12px;color:#9496ad;font-weight:700;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.pgfoot{position:absolute;left:${mar}px;right:${mar}px;top:${ph - mar*0.55}px;text-align:center;font-size:12px;color:#aaacc2;font-weight:600;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
@media print{
  html,body{background:#fff}
  .page{box-shadow:none;margin:0;page-break-after:always;break-after:page}
}
</style>
<script>
window.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('exportContainer');
  const temp = document.createElement('div');
  temp.style.cssText = 'position:absolute;visibility:hidden;width:${pw - 2*mar}px;font:16px/1.6 Arial,sans-serif;padding:0;margin:0;';
  temp.innerHTML = \`${rawContent}\`;
  document.body.appendChild(temp);

  // Simple client-side pagination reconstruction for standalone view
  const contentH = ${ph - 2 * mar};
  const children = [...temp.childNodes];
  container.innerHTML = '';
  
  let curPage = createPage(1);
  let curBody = curPage.querySelector('.page-content');
  let currentH = 0;

  children.forEach(node => {
    const clone = node.cloneNode(true);
    curBody.appendChild(clone);
    const h = clone.offsetHeight || 24;
    if (currentH + h > contentH && curBody.children.length > 1) {
      curBody.removeChild(clone);
      updateFooters();
      curPage = createPage(container.children.length + 1);
      curBody = curPage.querySelector('.page-content');
      curBody.appendChild(clone);
      currentH = h;
    } else {
      currentH += h;
    }
  });
  updateFooters();
  temp.remove();

  function createPage(pageNum) {
    const p = document.createElement('div');
    p.className = 'page';
    let decoHTML = '';
    if ('${border}' !== 'none') decoHTML += '<div class="pgrect ${border}"></div>';
    if ('${hHeader}') decoHTML += '<div class="pghead">${hHeader}</div>';
    if ('${hFooter}' || ${hPageNum}) {
      const footText = ['${hFooter}', ${hPageNum} ? ('Page ' + pageNum + ' of _TOTAL_') : ''].filter(Boolean).join('   ·   ');
      decoHTML += '<div class="pgfoot" data-foot="' + pageNum + '">' + footText + '</div>';
    }
    p.innerHTML = decoHTML + '<div class="page-content"></div>';
    container.appendChild(p);
    return p;
  }
  function updateFooters() {
    const total = container.children.length;
    container.querySelectorAll('.pgfoot').forEach(f => {
      f.textContent = f.textContent.replace(/Page \\d+ of _TOTAL_/, 'Page ' + f.dataset.foot + ' of ' + total);
    });
  }
});
<\/script>
</head><body><div id="exportContainer"></div></body></html>`;
}

/* ---------- actions ---------- */
const A = {
  new() { if (confirm('Start a new document? Unsaved changes will be lost.')) { ed.innerHTML = '<p><br></p>'; mountChrome(); $('#docTitle').value = 'Untitled document'; after(); } },
  open() { $('#fileIn').click(); },
  save() {
    const t = $('#docTitle').value || 'document';
    const b = new Blob([exportHtml()], { type: 'text/html' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = t + '.html'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('Saved ✅ — file opens as a complete formatted A4 document ready for printing!');
  },
  print() { window.print(); },
  img() { $('#imgIn').click(); },
  imgSearch() {
    const q = prompt('What picture are you looking for?');
    if (q) { 
      window.open('https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(q), '_blank', 'noopener'); 
      toast('Right-click picture → Copy image, then press Ctrl+V in your editor.'); 
    }
  },
  shapes() { openPicker('Shapes', 'shapes'); },
  icons() { openPicker('Icons', 'icons'); },
  stickers() { openPicker('Stickers', 'stickers'); },
  charts() { openPicker('Charts & Diagrams', 'charts'); },
  textbox() {
    restore();
    const w = Math.min(240, maxObjW());
    document.execCommand('insertHTML', false,
      `<div class="kb-obj textbox" contenteditable="true" style="position:relative;display:inline-block;width:${w}px;min-height:90px;margin:10px;padding:12px;background:#fff;vertical-align:top">Type here…</div><p><br></p>`);
    after();
    const boxes = $$('.kb-obj.textbox', ed); const last = boxes[boxes.length - 1];
    if (last) selectObj(last);
    toast('Text box added within margins.');
  },
  hf() { openHF(); },
  table() {
    const r = +prompt('How many rows?', '3'), c = +prompt('How many columns?', '3');
    if (!r || !c) return;
    run('insertHTML', '<table><tbody>' + ('<tr>' + '<td><br></td>'.repeat(c) + '</tr>').repeat(r) + '</tbody></table><p><br></p>');
  },
  row() { const c = cell(); if (!c) return toast('Click inside a table cell first.'); const n = c.parentElement.cloneNode(true); $$('td', n).forEach(x => x.innerHTML = '<br>'); c.parentElement.after(n); after(); },
  col() { const c = cell(); if (!c) return toast('Click inside a table cell first.'); const i = c.cellIndex; $$('tr', c.closest('table')).forEach(tr => { const d = document.createElement('td'); d.innerHTML = '<br>'; tr.cells[i].after(d); }); after(); },
  delTable() { const c = cell(); if (!c) return toast('Click inside a table first.'); c.closest('table').remove(); after(); },
  link() { const u = prompt('Link address:', 'https://'); if (u && u !== 'https://') run('createLink', u); },
  hr() { run('insertHorizontalRule'); },
  pb() { run('insertHTML', '<div class="pb" contenteditable="false"></div><p><br></p>'); },
  date() { run('insertText', new Date().toLocaleString()); },
  find() { const f = $('#findBar'); f.classList.toggle('show'); if (f.classList.contains('show')) $('#fIn').focus(); },
  paint() {
    restore();
    const s = getSelection();
    if (!painter) {
      if (!s.rangeCount || s.isCollapsed) return toast('Select text first, then click paintbrush.');
      const n = s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement;
      const cs = getComputedStyle(n);
      painter = { fw: cs.fontWeight, fs: cs.fontStyle, td: cs.textDecorationLine, ff: cs.fontFamily, sz: cs.fontSize, col: cs.color };
      toast('Formatting copied — select text and click paintbrush again.');
      return;
    }
    if (s.isCollapsed) { painter = null; return; }
    const span = document.createElement('span');
    span.style.fontWeight = painter.fw; span.style.fontStyle = painter.fs; span.style.textDecoration = painter.td;
    span.style.fontFamily = painter.ff; span.style.fontSize = painter.sz; span.style.color = painter.col;
    const r = s.getRangeAt(0); span.appendChild(r.extractContents()); r.insertNode(span);
    painter = null; after(); toast('Formatting applied.');
  }
};

/* ---------- wiring ---------- */
$('.ribbon').addEventListener('mousedown', e => { if (!e.target.closest('select,input')) e.preventDefault(); });
$$('button[data-cmd]').forEach(b => b.addEventListener('click', () => run(b.dataset.cmd)));
$$('[data-act]').forEach(b => b.addEventListener('click', () => A[b.dataset.act]()));
$$('.tab').forEach(t => t.addEventListener('click', () => {
  $$('.tab').forEach(x => x.classList.toggle('on', x === t));
  $$('.panel').forEach(p => p.classList.toggle('on', p.id === 'p-' + t.dataset.tab));
}));
$('#fontName').onchange = e => run('fontName', e.target.value);
$('#fontSize').onchange = e => setSize(e.target.value);
$('#block').onchange = e => run('formatBlock', '<' + e.target.value + '>');
$('#fore').oninput = e => run('foreColor', e.target.value);
$('#back').oninput = e => run('hiliteColor', e.target.value);
$('#lh').onchange = e => { if (e.target.value) blocks().forEach(b => b.style.lineHeight = e.target.value); e.target.selectedIndex = 0; after(); };
$('#sym').onchange = e => { if (e.target.selectedIndex) run('insertText', e.target.value); e.target.selectedIndex = 0; };
$('#margin').onchange = e => { mar = +e.target.value; after(); };
$('#orient').onchange = e => { orient = e.target.value; after(); };
$('#pageColor').oninput = e => { pageColor = e.target.value; after(); };
$('#border').onchange = e => { border = e.target.value; after(); };
$('#imgIn').onchange = e => { fileImg(e.target.files[0]); e.target.value = ''; };
$('#imgW').onchange = e => { 
  if (!selObj || selObj.tagName !== 'IMG') toast('Click a picture first.'); 
  else { 
    const pct = parseInt(e.target.value) / 100;
    const maxW = maxObjW();
    selObj.style.width = Math.min(maxW, maxW * pct) + 'px'; 
    selObj.style.height = 'auto'; 
    after(); 
  } 
  e.target.selectedIndex = 0; 
};
$('#imgWrap').onchange = e => {
  if (!selObj || selObj.tagName !== 'IMG') toast('Click a picture first.');
  else {
    const v = e.target.value;
    selObj.style.position = ''; selObj.style.left = ''; selObj.style.top = '';
    selObj.style.float = v === 'none' ? '' : v;
    selObj.style.margin = v === 'none' ? '' : '4px 12px';
    after();
  }
  e.target.selectedIndex = 0;
};
$('#fileIn').onchange = e => {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    ed.innerHTML = /\.html?$/i.test(f.name) ? clean(r.result) : '<p>' + esc(r.result).replace(/\n/g, '</p><p>') + '</p>';
    if (!ed.innerHTML.trim()) ed.innerHTML = '<p><br></p>';
    mountChrome();
    $('#docTitle').value = f.name.replace(/\.\w+$/, ''); after();
  };
  r.readAsText(f); e.target.value = '';
};
$('#docTitle').oninput = () => { clearTimeout(t3); t3 = setTimeout(persist, 600); };

/* zoom bar */
function setZoom(z) {
  fit = false; zoom = Math.min(2, Math.max(0.5, z));
  sheet.style.zoom = zoom; $('#zoom2').value = Math.round(zoom * 100); $('#zoomPct').textContent = Math.round(zoom * 100) + '%';
  updateHandles(); cur();
}
$('#zoom2').oninput = e => setZoom(e.target.value / 100);
$('#zOut').onclick = () => setZoom(zoom - 0.1);
$('#zIn').onclick = () => setZoom(zoom + 0.1);
$('#zFit').onclick = () => { fit = true; stats(); toast('Fit to screen'); };

/* find & replace */
$('#fNext').onclick = () => { ed.focus(); if (!window.find($('#fIn').value, false, false, true)) toast('Not found.'); };
$('#fRep').onclick = () => {
  const f = $('#fIn').value, s = getSelection().toString();
  if (f && s.toLowerCase() === f.toLowerCase()) run('insertText', $('#rIn').value);
  $('#fNext').click();
};
$('#fAll').onclick = () => {
  const f = $('#fIn').value, r = $('#rIn').value; if (!f) return;
  const re = new RegExp(f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'); let n = 0;
  const w = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT), list = [];
  while (w.nextNode()) list.push(w.currentNode);
  list.forEach(t => { const v = t.nodeValue.replace(re, () => (n++, r)); if (v !== t.nodeValue) t.nodeValue = v; });
  toast(n + ' replaced'); after();
};

/* editor events with debounced pagination for zero lag */
ed.addEventListener('input', () => {
  clearTimeout(t2);
  t2 = setTimeout(after, 150);
});
ed.addEventListener('paste', e => {
  const f = [...e.clipboardData.files].find(x => x.type.startsWith('image/'));
  if (f) { e.preventDefault(); fileImg(f); }
});
ed.addEventListener('drop', e => {
  const f = [...e.dataTransfer.files].find(x => x.type.startsWith('image/'));
  if (f) { e.preventDefault(); fileImg(f); }
});
ed.addEventListener('keydown', e => {
  if (e.key === 'Tab') { e.preventDefault(); e.shiftKey ? run('outdent') : run('insertHTML', '&emsp;'); }
});
document.addEventListener('keydown', e => {
  if (!(e.ctrlKey || e.metaKey)) return;
  const k = e.key.toLowerCase();
  if (k === 's') { e.preventDefault(); A.save(); }
  else if (k === 'k') { e.preventDefault(); A.link(); }
  else if (k === 'h') { e.preventDefault(); A.find(); }
});
window.addEventListener('resize', stats);

/* start */
try {
  const d = JSON.parse(localStorage.getItem(KEY));
  if (d) {
    ed.innerHTML = clean(d.h); mountChrome(); $('#docTitle').value = d.t || 'Untitled document';
    orient = d.o || 'portrait'; mar = d.m || 96;
    pageColor = d.pc || '#ffffff'; border = d.bd || 'none';
    hHeader = d.hh || ''; hFooter = d.hf || ''; hPageNum = !!d.hn;
    $('#orient').value = orient; $('#margin').value = mar; $('#pageColor').value = pageColor; $('#border').value = border;
  }
} catch (e) {}
if (!ed.innerHTML.trim()) { ed.innerHTML = '<p><br></p>'; mountChrome(); }
document.execCommand('defaultParagraphSeparator', false, 'p');
stats();
window.addEventListener('load', stats);
})();