const SIZE = 64;
const HISTORY_LIMIT = 80;
const DEFAULT_COLOR = '#7FD7FF';

const els = {
  canvas: document.querySelector('#editorCanvas'),
  wrap: document.querySelector('#canvasWrap'),
  previewCanvas: document.querySelector('#previewCanvas'),
  colorInput: document.querySelector('#colorInput'),
  hexInput: document.querySelector('#hexInput'),
  swatches: document.querySelector('#swatches'),
  quickColors: document.querySelector('#quickColors'),
  gridToggle: document.querySelector('#gridToggle'),
  checkerToggle: document.querySelector('#checkerToggle'),
  mirrorToggle: document.querySelector('#mirrorToggle'),
  outerToggle: document.querySelector('#outerToggle'),
  activeToolLabel: document.querySelector('#activeToolLabel'),
  cursorReadout: document.querySelector('#cursorReadout'),
  zoomReadout: document.querySelector('#zoomReadout'),
  checks: document.querySelector('#checks'),
  toastRegion: document.querySelector('#toastRegion'),
  fileInput: document.querySelector('#fileInput'),
  docStatus: document.querySelector('#docStatus'),
  modelSelect: document.querySelector('#modelSelect'),
  guideModal: document.querySelector('#guideModal'),
  guideCanvas: document.querySelector('#guideCanvas'),
};

const ctx = els.canvas.getContext('2d', { alpha: true, willReadFrequently: false });
ctx.imageSmoothingEnabled = false;

const state = {
  pixels: new Uint8ClampedArray(SIZE * SIZE * 4),
  tool: 'pencil',
  color: DEFAULT_COLOR,
  grid: true,
  checker: true,
  mirror: false,
  outer: true,
  drawing: false,
  strokeChanged: false,
  history: [],
  historyIndex: -1,
  recentColors: [DEFAULT_COLOR, '#FFFFFF', '#16191F', '#FF6B7A', '#FFCC66', '#9AF0CF', '#7D8BFF', '#B68CFF', '#6CE0D5', '#F28BA8', '#A6B7C7', '#5B6673', '#7B4E3A', '#C98E5B', '#3B6D8C'],
  title: 'Complete Starter Template',
  model: 'classic',
};

const editorLayer = document.createElement('canvas');
editorLayer.width = SIZE;
editorLayer.height = SIZE;
const layerCtx = editorLayer.getContext('2d', { willReadFrequently: false });
layerCtx.imageSmoothingEnabled = false;

let renderFrame = 0;
let preview = null;

function hexToRgba(hex, alpha = 255) {
  const clean = String(hex).replace('#', '').trim();
  const value = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return null;
  const n = Number.parseInt(value, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, alpha];
}

function rgbaToHex(r, g, b) {
  return [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function setColor(hex, addRecent = true) {
  const rgba = hexToRgba(hex);
  if (!rgba) return;
  const normalized = '#' + rgbaToHex(rgba[0], rgba[1], rgba[2]);
  state.color = normalized;
  els.colorInput.value = normalized;
  els.hexInput.value = normalized.slice(1);
  if (addRecent) {
    state.recentColors = [normalized, ...state.recentColors.filter(c => c !== normalized)].slice(0, 16);
    renderPalettes();
  }
}

function indexFor(x, y) { return (y * SIZE + x) * 4; }
function getPixel(x, y) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return [0, 0, 0, 0];
  const i = indexFor(x, y);
  return [state.pixels[i], state.pixels[i + 1], state.pixels[i + 2], state.pixels[i + 3]];
}
function setPixel(x, y, rgba) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return false;
  const i = indexFor(x, y);
  const changed = state.pixels[i] !== rgba[0] || state.pixels[i + 1] !== rgba[1] || state.pixels[i + 2] !== rgba[2] || state.pixels[i + 3] !== rgba[3];
  if (!changed) return false;
  state.pixels[i] = rgba[0];
  state.pixels[i + 1] = rgba[1];
  state.pixels[i + 2] = rgba[2];
  state.pixels[i + 3] = rgba[3];
  return true;
}
function paintRect(x, y, w, h, hex, alpha = 255) {
  const rgba = hexToRgba(hex, alpha);
  if (!rgba) return;
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) setPixel(xx, yy, rgba);
}
function clearPixels() { state.pixels.fill(0); }

function paintRegion(region, hex, alpha = 255) {
  if (!region) return;
  paintRect(region.x, region.y, region.w, region.h, hex, alpha);
}

function layout(model = state.model) {
  const slim = model === 'slim';
  const armFrontW = slim ? 3 : 4;
  const armTotalW = slim ? 14 : 16;
  const limbDepth = 4;

  const part = (name, x, y, w, h, d, regions) => ({ name, x, y, w, h, d, regions });
  const r = (x, y, w, h) => ({ x, y, w, h });

  return {
    head: part('Head', 0, 0, 8, 8, 8, {
      top: r(8, 0, 8, 8), bottom: r(16, 0, 8, 8), left: r(0, 8, 8, 8), front: r(8, 8, 8, 8), right: r(16, 8, 8, 8), back: r(24, 8, 8, 8),
    }),
    body: part('Body', 16, 16, 8, 12, 4, {
      top: r(20, 16, 8, 4), bottom: r(28, 16, 8, 4), left: r(16, 20, 4, 12), front: r(20, 20, 8, 12), right: r(28, 20, 4, 12), back: r(32, 20, 8, 12),
    }),
    rightLeg: part('Right Leg', 0, 16, 4, 12, 4, {
      top: r(4, 16, 4, 4), bottom: r(8, 16, 4, 4), left: r(0, 20, 4, 12), front: r(4, 20, 4, 12), right: r(8, 20, 4, 12), back: r(12, 20, 4, 12),
    }),
    rightArm: part('Right Arm', 40, 16, armFrontW, 12, limbDepth, {
      top: r(44, 16, armFrontW, 4), bottom: r(44 + armFrontW, 16, armFrontW, 4), left: r(40, 20, 4, 12), front: r(44, 20, armFrontW, 12), right: r(44 + armFrontW, 20, 4, 12), back: r(48 + armFrontW, 20, armFrontW, 12),
    }),
    leftLeg: part('Left Leg', 16, 48, 4, 12, 4, {
      top: r(20, 48, 4, 4), bottom: r(24, 48, 4, 4), left: r(16, 52, 4, 12), front: r(20, 52, 4, 12), right: r(24, 52, 4, 12), back: r(28, 52, 4, 12),
    }),
    leftArm: part('Left Arm', 32, 48, armFrontW, 12, limbDepth, {
      top: r(36, 48, armFrontW, 4), bottom: r(36 + armFrontW, 48, armFrontW, 4), left: r(32, 52, 4, 12), front: r(36, 52, armFrontW, 12), right: r(36 + armFrontW, 52, 4, 12), back: r(40 + armFrontW, 52, armFrontW, 12),
    }),
    outerHead: part('Head Outer', 32, 0, 8, 8, 8, {
      top: r(40, 0, 8, 8), bottom: r(48, 0, 8, 8), left: r(32, 8, 8, 8), front: r(40, 8, 8, 8), right: r(48, 8, 8, 8), back: r(56, 8, 8, 8),
    }),
    outerBody: part('Body Outer', 16, 32, 8, 12, 4, {
      top: r(20, 32, 8, 4), bottom: r(28, 32, 8, 4), left: r(16, 36, 4, 12), front: r(20, 36, 8, 12), right: r(28, 36, 4, 12), back: r(32, 36, 8, 12),
    }),
    outerRightLeg: part('Right Leg Outer', 0, 32, 4, 12, 4, {
      top: r(4, 32, 4, 4), bottom: r(8, 32, 4, 4), left: r(0, 36, 4, 12), front: r(4, 36, 4, 12), right: r(8, 36, 4, 12), back: r(12, 36, 4, 12),
    }),
    outerRightArm: part('Right Arm Outer', 40, 32, armFrontW, 12, limbDepth, {
      top: r(44, 32, armFrontW, 4), bottom: r(44 + armFrontW, 32, armFrontW, 4), left: r(40, 36, 4, 12), front: r(44, 36, armFrontW, 12), right: r(44 + armFrontW, 36, 4, 12), back: r(48 + armFrontW, 36, armFrontW, 12),
    }),
    outerLeftLeg: part('Left Leg Outer', 0, 48, 4, 12, 4, {
      top: r(4, 48, 4, 4), bottom: r(8, 48, 4, 4), left: r(0, 52, 4, 12), front: r(4, 52, 4, 12), right: r(8, 52, 4, 12), back: r(12, 52, 4, 12),
    }),
    outerLeftArm: part('Left Arm Outer', 48, 48, armFrontW, 12, limbDepth, {
      top: r(52, 48, armFrontW, 4), bottom: r(52 + armFrontW, 48, armFrontW, 4), left: r(48, 52, 4, 12), front: r(52, 52, armFrontW, 12), right: r(52 + armFrontW, 52, 4, 12), back: r(56 + armFrontW, 52, armFrontW, 12),
    }),
    armFrontW,
    armTotalW,
  };
}

function starterTemplate(model = state.model) {
  clearPixels();
  const L = layout(model);

  // Base skin: complete, editable, deliberately simple pixel-art starter.
  const skin = '#D9A47A';
  const shadow = '#B87955';
  const hair = '#3A2418';
  const hairHi = '#5A3828';
  const shirt = '#3F76B5';
  const shirtHi = '#5D95D0';
  const pants = '#33404D';
  const pantsHi = '#4D5C6B';
  const shoes = '#20252B';

  // Head: skin, hair cap/back, tiny face details.
  paintRegion(L.head.regions.front, skin);
  paintRegion(L.head.regions.left, shadow);
  paintRegion(L.head.regions.right, skin);
  paintRegion(L.head.regions.back, hair);
  paintRegion(L.head.regions.top, hair);
  paintRegion(L.head.regions.bottom, shadow);
  paintRect(10, 11, 1, 2, '#2C2220');
  paintRect(13, 11, 1, 2, '#2C2220');
  paintRect(11, 13, 2, 1, '#A95F55');

  // Body and arms.
  for (const key of ['front','right','back']) paintRegion(L.body.regions[key], shirt);
  paintRegion(L.body.regions.left, shirtHi);
  paintRegion(L.body.regions.top, shirtHi);
  paintRegion(L.body.regions.bottom, shirt);

  for (const armKey of ['rightArm','leftArm']) {
    const arm = L[armKey];
    paintRegion(arm.regions.front, shirt);
    paintRegion(arm.regions.back, shirt);
    paintRegion(arm.regions.left, skin);
    paintRegion(arm.regions.right, shadow);
    paintRegion(arm.regions.top, shirtHi);
    paintRegion(arm.regions.bottom, shadow);
  }

  // Legs: pants with shoes at the bottom.
  for (const legKey of ['rightLeg','leftLeg']) {
    const leg = L[legKey];
    for (const face of ['front','back','left','right','top','bottom']) paintRegion(leg.regions[face], pants);
    const front = leg.regions.front;
    const shoeHeight = 3;
    paintRect(front.x, front.y + front.h - shoeHeight, front.w, shoeHeight, shoes);
    paintRect(leg.regions.left.x, leg.regions.left.y + leg.regions.left.h - shoeHeight, leg.regions.left.w, shoeHeight, shoes);
  }

  // A restrained outer layer: hair on the head, jacket panels, cuffs and shoes.
  const outerHair = '#2B1A13';
  for (const key of ['top','back','left','right']) paintRegion(L.outerHead.regions[key], outerHair, 255);
  paintRegion(L.outerHead.regions.front, outerHair, 0);
  paintRegion(L.outerBody.regions.front, '#1F4E78', 220);
  paintRegion(L.outerBody.regions.left, '#1A415F', 220);
  paintRegion(L.outerBody.regions.right, '#183950', 220);
  for (const armKey of ['outerRightArm','outerLeftArm']) {
    paintRegion(L[armKey].regions.front, '#244F72', 200);
    paintRegion(L[armKey].regions.top, '#5D95D0', 200);
  }
  for (const legKey of ['outerRightLeg','outerLeftLeg']) {
    paintRegion(L[legKey].regions.front, shoes, 220);
  }

  state.title = model === 'slim' ? 'Complete Slim Starter Template' : 'Complete Starter Template';
  els.docStatus.textContent = state.title;
  state.history = [];
  state.historyIndex = -1;
  saveHistory();
}

function pixelsToImageData() { return new ImageData(new Uint8ClampedArray(state.pixels), SIZE, SIZE); }

function renderEditor() {
  const rect = els.canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const size = Math.max(128, Math.round(Math.min(rect.width, rect.height) * dpr));
  if (els.canvas.width !== size || els.canvas.height !== size) {
    els.canvas.width = size;
    els.canvas.height = size;
  }

  ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
  if (state.checker) drawChecker(ctx, els.canvas.width, els.canvas.height, 14);
  else { ctx.fillStyle = '#11151c'; ctx.fillRect(0, 0, els.canvas.width, els.canvas.height); }

  layerCtx.putImageData(pixelsToImageData(), 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(layerCtx.canvas, 0, 0, els.canvas.width, els.canvas.height);

  if (state.grid) {
    const scale = els.canvas.width / SIZE;
    ctx.save();
    ctx.globalAlpha = scale >= 7 ? .22 : .09;
    ctx.strokeStyle = '#8591A0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= SIZE; x++) { const px = Math.round(x * scale) + .5; ctx.moveTo(px, 0); ctx.lineTo(px, els.canvas.height); }
    for (let y = 0; y <= SIZE; y++) { const py = Math.round(y * scale) + .5; ctx.moveTo(0, py); ctx.lineTo(els.canvas.width, py); }
    ctx.stroke();
    ctx.restore();
  }
  ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.13)'; ctx.strokeRect(.5, .5, els.canvas.width - 1, els.canvas.height - 1); ctx.restore();
  els.zoomReadout.textContent = `${Math.round((els.canvas.width / SIZE) * 100)}%`;
}

function drawChecker(target, width, height, cell) {
  target.fillStyle = '#10141a'; target.fillRect(0, 0, width, height);
  target.fillStyle = '#171c23';
  for (let y = 0; y < height; y += cell) for (let x = 0; x < width; x += cell) if (((x / cell) + (y / cell)) % 2 === 0) target.fillRect(x, y, cell, cell);
}

function countAlpha() { let n = 0; for (let i = 3; i < state.pixels.length; i += 4) if (state.pixels[i] > 0) n++; return n; }

function renderChecks() {
  const alphaPixels = countAlpha();
  const items = [
    [true, '64×64 Bedrock texture'],
    [alphaPixels > 0, 'Texture contains skin pixels'],
    [preview?.ready === true, preview?.slim ? '3D slim model mapped' : '3D classic model mapped'],
    [state.historyIndex >= 0, 'Undo history ready'],
  ];
  els.checks.innerHTML = items.map(([ok, label]) => `<div class="check ${ok ? 'ok' : 'warn'}"><span class="check-icon">${ok ? '✓' : '!'}</span><span>${label}</span></div>`).join('');
}

function renderPalettes() {
  const colors = state.recentColors;
  els.swatches.innerHTML = colors.map(c => `<button class="swatch" style="background:${c}" data-color="${c}" title="${c}"></button>`).join('');
  els.quickColors.innerHTML = colors.slice(0, 8).map(c => `<button class="swatch" style="background:${c}" data-color="${c}" title="${c}"></button>`).join('');
  document.querySelectorAll('.swatch').forEach(btn => btn.addEventListener('click', () => setColor(btn.dataset.color)));
}

function saveHistory() {
  const snapshot = new Uint8ClampedArray(state.pixels);
  if (state.historyIndex < state.history.length - 1) state.history = state.history.slice(0, state.historyIndex + 1);
  state.history.push(snapshot);
  if (state.history.length > HISTORY_LIMIT) state.history.shift();
  state.historyIndex = state.history.length - 1;
}
function restoreHistory(index) {
  if (index < 0 || index >= state.history.length) return;
  state.pixels.set(state.history[index]);
  state.historyIndex = index;
  scheduleRender();
}
function undo() { if (state.historyIndex > 0) restoreHistory(state.historyIndex - 1); }
function redo() { if (state.historyIndex < state.history.length - 1) restoreHistory(state.historyIndex + 1); }

function fillRegion(startX, startY, target, replacement) {
  if (target.every((v, i) => v === replacement[i])) return false;
  const q = [[startX, startY]];
  const seen = new Uint8Array(SIZE * SIZE);
  let changed = false;
  while (q.length) {
    const [x, y] = q.pop();
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) continue;
    const k = y * SIZE + x;
    if (seen[k]) continue;
    seen[k] = 1;
    const p = getPixel(x, y);
    if (p[0] !== target[0] || p[1] !== target[1] || p[2] !== target[2] || p[3] !== target[3]) continue;
    if (setPixel(x, y, replacement)) changed = true;
    q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  return changed;
}

function linePixels(x0, y0, x1, y1) {
  const out = [];
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  while (true) {
    out.push([x0, y0]);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
  return out;
}

function applyAt(x, y) {
  let changed = false;
  const color = state.tool === 'eraser' ? [0, 0, 0, 0] : hexToRgba(state.color);
  if (state.tool === 'picker') {
    const p = getPixel(x, y);
    setColor('#' + rgbaToHex(p[0], p[1], p[2]));
    return false;
  }
  if (state.tool === 'fill') {
    changed = fillRegion(x, y, getPixel(x, y), color);
  } else if (state.tool === 'pencil' || state.tool === 'eraser') {
    changed = setPixel(x, y, color);
    if (state.mirror && state.tool !== 'picker') changed = setPixel(SIZE - 1 - x, y, color) || changed;
  }
  return changed;
}

function applyShape(x0, y0, x1, y1) {
  const color = state.tool === 'eraser' ? [0, 0, 0, 0] : hexToRgba(state.color);
  if (state.tool === 'line') return linePixels(x0, y0, x1, y1).some(([x, y]) => setPixel(x, y, color) || (state.mirror && setPixel(SIZE - 1 - x, y, color)));
  const minX = Math.min(x0, x1), maxX = Math.max(x0, x1), minY = Math.min(y0, y1), maxY = Math.max(y0, y1);
  let changed = false;
  for (let x = minX; x <= maxX; x++) {
    changed = setPixel(x, minY, color) || changed;
    changed = setPixel(x, maxY, color) || changed;
    if (state.mirror) { changed = setPixel(SIZE - 1 - x, minY, color) || changed; changed = setPixel(SIZE - 1 - x, maxY, color) || changed; }
  }
  for (let y = minY; y <= maxY; y++) {
    changed = setPixel(minX, y, color) || changed;
    changed = setPixel(maxX, y, color) || changed;
    if (state.mirror) { changed = setPixel(SIZE - 1 - minX, y, color) || changed; changed = setPixel(SIZE - 1 - maxX, y, color) || changed; }
  }
  return changed;
}

function canvasPoint(event) {
  const rect = els.canvas.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(SIZE - 1, Math.floor(((event.clientX - rect.left) / rect.width) * SIZE))),
    y: Math.max(0, Math.min(SIZE - 1, Math.floor(((event.clientY - rect.top) / rect.height) * SIZE))),
  };
}

function pointerDown(event) {
  event.preventDefault();
  els.canvas.setPointerCapture?.(event.pointerId);
  const { x, y } = canvasPoint(event);
  els.cursorReadout.textContent = `X: ${x}  Y: ${y}`;
  state.drawing = true;
  state.strokeChanged = false;
  state.dragStart = { x, y };
  if (event.button === 2) state.tool = 'picker';
  if (state.tool === 'line' || state.tool === 'rect') return;
  if (applyAt(x, y)) state.strokeChanged = true;
  scheduleRender();
}
function pointerMove(event) {
  const { x, y } = canvasPoint(event);
  els.cursorReadout.textContent = `X: ${x}  Y: ${y}`;
  if (!state.drawing) return;
  if (state.tool === 'pencil' || state.tool === 'eraser') {
    const from = state.dragStart || { x, y };
    const pts = linePixels(from.x, from.y, x, y);
    for (const [px, py] of pts) if (applyAt(px, py)) state.strokeChanged = true;
  } else if (state.tool === 'fill') {
    state.drawing = false;
  }
  state.dragStart = { x, y };
  scheduleRender();
}
function pointerUp(event) {
  if (!state.drawing) return;
  const { x, y } = canvasPoint(event);
  if (state.tool === 'line' || state.tool === 'rect') state.strokeChanged = applyShape(state.dragStart.x, state.dragStart.y, x, y) || state.strokeChanged;
  state.drawing = false;
  state.dragStart = null;
  if (state.strokeChanged) saveHistory();
  scheduleRender();
}

function setTool(tool) {
  state.tool = tool;
  const labels = { pencil: 'Pencil', eraser: 'Eraser', fill: 'Fill', picker: 'Eyedropper', line: 'Line', rect: 'Rectangle' };
  els.activeToolLabel.textContent = labels[tool] || tool;
  document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tool === tool));
}

function exportPng() {
  const out = document.createElement('canvas'); out.width = SIZE; out.height = SIZE;
  out.getContext('2d').putImageData(pixelsToImageData(), 0, 0);
  const a = document.createElement('a'); a.download = `${slugify(state.title || 'minecraft-skin')}.png`; a.href = out.toDataURL('image/png'); a.click();
  toast('PNG exported.');
}

function exportPixelsPng(pixels, filename) {
  const out = document.createElement('canvas'); out.width = SIZE; out.height = SIZE;
  out.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(pixels), SIZE, SIZE), 0, 0);
  const a = document.createElement('a'); a.download = filename; a.href = out.toDataURL('image/png'); a.click();
}

function downloadStarterTemplate() {
  const currentPixels = new Uint8ClampedArray(state.pixels);
  const currentHistory = state.history.map(s => new Uint8ClampedArray(s));
  const currentIndex = state.historyIndex;
  const currentTitle = state.title;
  starterTemplate(state.model);
  const template = new Uint8ClampedArray(state.pixels);
  state.pixels.set(currentPixels);
  state.history = currentHistory;
  state.historyIndex = currentIndex;
  state.title = currentTitle;
  els.docStatus.textContent = currentTitle;
  exportPixelsPng(template, `${state.model === 'slim' ? 'complete-slim-template' : 'complete-classic-template'}.png`);
  scheduleRender();
  toast('Game-ready starter template exported.');
}

function importPng(file) {
  if (!file) return;
  const img = new Image();
  img.onload = () => {
    if (img.width !== 64 || img.height !== 64) { toast(`This editor expects 64×64 PNG skins. Received ${img.width}×${img.height}.`); return; }
    const source = document.createElement('canvas'); source.width = 64; source.height = 64;
    const sctx = source.getContext('2d', { willReadFrequently: true });
    sctx.imageSmoothingEnabled = false; sctx.clearRect(0, 0, 64, 64); sctx.drawImage(img, 0, 0);
    const data = sctx.getImageData(0, 0, 64, 64).data;
    state.pixels.set(data);
    state.title = file.name.replace(/\.png$/i, '') || 'Imported skin';
    state.history = []; state.historyIndex = -1; saveHistory();
    els.docStatus.textContent = state.title;
    renderAll();
    toast('Skin imported.');
    URL.revokeObjectURL(img.src);
  };
  img.src = URL.createObjectURL(file);
}

function slugify(value) { return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'minecraft-skin'; }
function toast(message) {
  const el = document.createElement('div'); el.className = 'toast'; el.textContent = message; els.toastRegion.appendChild(el);
  setTimeout(() => el.remove(), 2400);
}

function scheduleRender() {
  if (renderFrame) return;
  renderFrame = requestAnimationFrame(() => { renderFrame = 0; renderAll(); });
}
function renderAll() { renderEditor(); renderPalettes(); renderChecks(); preview?.update(state.pixels, state.outer); }

// ---------- lightweight WebGL Bedrock model preview ----------
function mat4Identity() { return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]); }
function mat4Multiply(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c*4+r] = a[r] * b[c*4] + a[4+r] * b[c*4+1] + a[8+r] * b[c*4+2] + a[12+r] * b[c*4+3];
  return o;
}
function mat4Perspective(fov, aspect, near, far) {
  const f = 1 / Math.tan(fov / 2), nf = 1 / (near - far);
  const o = new Float32Array(16);
  o[0] = f / aspect; o[5] = f; o[10] = (far + near) * nf; o[11] = -1; o[14] = 2 * far * near * nf;
  return o;
}
function mat4LookAt(eye, center, up) {
  let zx = eye[0]-center[0], zy = eye[1]-center[1], zz = eye[2]-center[2];
  let len = Math.hypot(zx,zy,zz); zx/=len; zy/=len; zz/=len;
  let xx = up[1]*zz-up[2]*zy, xy = up[2]*zx-up[0]*zz, xz = up[0]*zy-up[1]*zx;
  len = Math.hypot(xx,xy,xz); xx/=len; xy/=len; xz/=len;
  const yx = zy*xz-zz*xy, yy = zz*xx-zx*xz, yz = zx*xy-zy*xx;
  return new Float32Array([
    xx,yx,zx,0, xy,yy,zy,0, xz,yz,zz,0,
    -(xx*eye[0]+xy*eye[1]+xz*eye[2]),
    -(yx*eye[0]+yy*eye[1]+yz*eye[2]),
    -(zx*eye[0]+zy*eye[1]+zz*eye[2]), 1,
  ]);
}
function mat4RotateY(a) {
  const c = Math.cos(a), s = Math.sin(a);
  return new Float32Array([c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]);
}

function createShader(gl, type, source) {
  const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
  return shader;
}

function createProgram(gl) {
  const vs = createShader(gl, gl.VERTEX_SHADER, `attribute vec3 aPosition; attribute vec2 aUV; attribute vec3 aNormal; uniform mat4 uMatrix; varying vec2 vUV; varying vec3 vNormal; void main(){ vUV=aUV; vNormal=aNormal; gl_Position=uMatrix*vec4(aPosition,1.0); }`);
  const fs = createShader(gl, gl.FRAGMENT_SHADER, `precision mediump float; uniform sampler2D uTexture; varying vec2 vUV; varying vec3 vNormal; void main(){ vec4 c=texture2D(uTexture,vUV); if(c.a<0.02) discard; vec3 l=normalize(vec3(0.35,0.8,0.55)); float shade=0.78+0.22*max(dot(normalize(vNormal),l),0.0); gl_FragColor=vec4(c.rgb*shade,c.a); }`);
  const p=gl.createProgram(); gl.attachShader(p,vs); gl.attachShader(p,fs); gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  return p;
}

function addFace(data, p0,p1,p2,p3, uv, normal) {
  const base = data.positions.length / 3;
  for (const p of [p0,p1,p2,p3]) data.positions.push(...p);
  const [u0,v0,u1,v1] = uv;
  data.uvs.push(u0,v1, u1,v1, u1,v0, u0,v0);
  for(let i=0;i<4;i++) data.normals.push(...normal);
  data.indices.push(base,base+1,base+2, base,base+2,base+3);
}

function uvRect(region) {
  return [region.x/64, (64-region.y)/64, (region.x+region.w)/64, (64-region.y-region.h)/64];
}

function cubeVertices(part, layer = 0) {
  const x=part.position[0], y=part.position[1], z=part.position[2];
  const w=part.size[0] + layer*1.0, h=part.size[1] + layer*1.0, d=part.size[2] + layer*1.0;
  const hx=w/2, hy=h/2, hz=d/2;
  const px=x, py=y, pz=z;
  const data={positions:[],uvs:[],normals:[],indices:[]};
  const r=part.uvs;
  // front (+Z), back (-Z), right (+X), left (-X), top (+Y), bottom (-Y)
  addFace(data, [px-hx,py-hy,pz+hz],[px+hx,py-hy,pz+hz],[px+hx,py+hy,pz+hz],[px-hx,py+hy,pz+hz], uvRect(r.front), [0,0,1]);
  addFace(data, [px+hx,py-hy,pz-hz],[px-hx,py-hy,pz-hz],[px-hx,py+hy,pz-hz],[px+hx,py+hy,pz-hz], uvRect(r.back), [0,0,-1]);
  addFace(data, [px+hx,py-hy,pz+hz],[px+hx,py-hy,pz-hz],[px+hx,py+hy,pz-hz],[px+hx,py+hy,pz+hz], uvRect(r.right), [1,0,0]);
  addFace(data, [px-hx,py-hy,pz-hz],[px-hx,py-hy,pz+hz],[px-hx,py+hy,pz+hz],[px-hx,py+hy,pz-hz], uvRect(r.left), [-1,0,0]);
  addFace(data, [px-hx,py+hy,pz+hz],[px+hx,py+hy,pz+hz],[px+hx,py+hy,pz-hz],[px-hx,py+hy,pz-hz], uvRect(r.top), [0,1,0]);
  addFace(data, [px-hx,py-hy,pz-hz],[px+hx,py-hy,pz-hz],[px+hx,py-hy,pz+hz],[px-hx,py-hy,pz+hz], uvRect(r.bottom), [0,-1,0]);
  return data;
}

function mergeGeometry(parts) {
  const result={positions:[],uvs:[],normals:[],indices:[]}; let offset=0;
  for(const p of parts){
    for(const v of p.positions) result.positions.push(v);
    for(const v of p.uvs) result.uvs.push(v);
    for(const v of p.normals) result.normals.push(v);
    for(const i of p.indices) result.indices.push(i+offset);
    offset += p.positions.length/3;
  }
  return result;
}

function makePreview() {
  const gl = els.previewCanvas.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'low-power', preserveDrawingBuffer: false });
  if (!gl) return { ready:false, update() {}, slim:false };

  let program;
  try { program=createProgram(gl); } catch(e) { console.error(e); return {ready:false,update(){},slim:false}; }
  const posLoc=gl.getAttribLocation(program,'aPosition'), uvLoc=gl.getAttribLocation(program,'aUV'), nrmLoc=gl.getAttribLocation(program,'aNormal'), matrixLoc=gl.getUniformLocation(program,'uMatrix');
  const texture=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,texture); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
  const skinCanvas=document.createElement('canvas'); skinCanvas.width=64; skinCanvas.height=64; const skinCtx=skinCanvas.getContext('2d'); skinCtx.imageSmoothingEnabled=false;
  const state3d={ ready:true, slim:false, rotY:0.5, zoom:1, update, modelNeedsRebuild:true };
  const buffers={};

  function build(model){
    const L=layout(model);
    const parts=[];
    const place={
      head:{position:[0,12,0],size:[8,8,8],uvs:L.head.regions}, body:{position:[0,2,0],size:[8,12,4],uvs:L.body.regions}, rightLeg:{position:[-2,-10,0],size:[4,12,4],uvs:L.rightLeg.regions}, leftLeg:{position:[2,-10,0],size:[4,12,4],uvs:L.leftLeg.regions}, rightArm:{position:[-6,2,0],size:[L.armFrontW,12,4],uvs:L.rightArm.regions}, leftArm:{position:[6,2,0],size:[L.armFrontW,12,4],uvs:L.leftArm.regions},
    };
    for(const part of Object.values(place)) parts.push(cubeVertices(part,0));
    const base=mergeGeometry(parts);
    const outerParts=[];
    for(const key of ['head','body','rightLeg','rightArm','leftLeg','leftArm']){
      const basePart=place[key]; const outerKey='outer'+key[0].toUpperCase()+key.slice(1); const uvPart=L[outerKey]; outerParts.push(cubeVertices({position:basePart.position,size:basePart.size,uvs:uvPart.regions},0.5));
    }
    const outer=mergeGeometry(outerParts);
    upload('base',base); upload('outer',outer);
    state3d.slim=model==='slim'; state3d.modelNeedsRebuild=false; render();
  }

  function upload(name,data){
    const b=buffers[name]||{};
    b.pos=b.pos||gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,b.pos); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data.positions),gl.STATIC_DRAW);
    b.uv=b.uv||gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,b.uv); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data.uvs),gl.STATIC_DRAW);
    b.nrm=b.nrm||gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,b.nrm); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data.normals),gl.STATIC_DRAW);
    b.idx=b.idx||gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,b.idx); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(data.indices),gl.STATIC_DRAW); b.count=data.indices.length;
    buffers[name]=b;
  }

  function update(pixels,showOuter){
    skinCtx.putImageData(new ImageData(new Uint8ClampedArray(pixels),64,64),0,0);
    gl.bindTexture(gl.TEXTURE_2D,texture); gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,skinCanvas);
    resize(); render(showOuter);
  }

  function resize(){
    const dpr=Math.min(window.devicePixelRatio||1,1.5); const w=Math.max(220,Math.round(els.previewCanvas.clientWidth*dpr)); const h=Math.max(220,Math.round(els.previewCanvas.clientHeight*dpr)); if(els.previewCanvas.width!==w||els.previewCanvas.height!==h){els.previewCanvas.width=w;els.previewCanvas.height=h;gl.viewport(0,0,w,h);} }
  function render(showOuter=state.outer){
    resize();
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA); gl.clearColor(0.047,0.059,0.078,1); gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.useProgram(program); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,texture); gl.uniform1i(gl.getUniformLocation(program,'uTexture'),0);
    const aspect=els.previewCanvas.width/els.previewCanvas.height; const proj=mat4Perspective(34*Math.PI/180,aspect,0.1,200); const dist=46/state3d.zoom; const eye=[Math.sin(state3d.rotY)*dist,18,Math.cos(state3d.rotY)*dist]; const view=mat4LookAt(eye,[0,0,0],[0,1,0]); const modelM=mat4RotateY(-state3d.rotY); const mvp=mat4Multiply(proj,mat4Multiply(view,modelM)); gl.uniformMatrix4fv(matrixLoc,false,mvp);
    draw('base'); if(showOuter) draw('outer');
  }
  function draw(name){ const b=buffers[name]; if(!b) return; gl.bindBuffer(gl.ARRAY_BUFFER,b.pos); gl.enableVertexAttribArray(posLoc); gl.vertexAttribPointer(posLoc,3,gl.FLOAT,false,0,0); gl.bindBuffer(gl.ARRAY_BUFFER,b.uv); gl.enableVertexAttribArray(uvLoc); gl.vertexAttribPointer(uvLoc,2,gl.FLOAT,false,0,0); gl.bindBuffer(gl.ARRAY_BUFFER,b.nrm); gl.enableVertexAttribArray(nrmLoc); gl.vertexAttribPointer(nrmLoc,3,gl.FLOAT,false,0,0); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,b.idx); gl.drawElements(gl.TRIANGLES,b.count,gl.UNSIGNED_SHORT,0); }

  build(state.model);
  els.previewCanvas.addEventListener('pointerdown', e=>{ els.previewCanvas.setPointerCapture?.(e.pointerId); state3d.dragging=true; state3d.lastX=e.clientX; });
  els.previewCanvas.addEventListener('pointermove', e=>{ if(!state3d.dragging)return; state3d.rotY+=(e.clientX-state3d.lastX)*0.012; state3d.lastX=e.clientX; render(); });
  els.previewCanvas.addEventListener('pointerup',()=>state3d.dragging=false); els.previewCanvas.addEventListener('pointercancel',()=>state3d.dragging=false);
  els.previewCanvas.addEventListener('wheel',e=>{e.preventDefault(); state3d.zoom=Math.max(.75,Math.min(1.35,state3d.zoom+(e.deltaY>0?-0.05:0.05))); render();},{passive:false});

  return { ready:true, get slim(){return state3d.slim;}, update, setModel(model){build(model);}, front(){state3d.rotY=0;render();}, back(){state3d.rotY=Math.PI;render();}, reset(){state3d.rotY=0.5;state3d.zoom=1;render();} };
}

function drawGuide() {
  const c=els.guideCanvas; const g=c.getContext('2d'); const scale=Math.min(c.width,c.height)/64; g.clearRect(0,0,c.width,c.height); g.fillStyle='#0d1117'; g.fillRect(0,0,c.width,c.height); g.imageSmoothingEnabled=false;
  const boxes=[]; const L=layout(state.model);
  const addPart=(name,part,color)=>{ for(const [face,rect] of Object.entries(part.regions)) boxes.push({name:`${name} • ${face}`,rect,color}); };
  addPart('Head',L.head,'#78d5ff'); addPart('Body',L.body,'#9af0cf'); addPart('R. Leg',L.rightLeg,'#ffbf7b'); addPart('R. Arm',L.rightArm,'#b896ff'); addPart('L. Leg',L.leftLeg,'#ff7da0'); addPart('L. Arm',L.leftArm,'#ffe37a');
  for(const b of boxes){ g.fillStyle=b.color+'22'; g.strokeStyle=b.color; g.lineWidth=Math.max(1,scale*.18); g.fillRect(b.rect.x*scale,b.rect.y*scale,b.rect.w*scale,b.rect.h*scale); g.strokeRect(b.rect.x*scale+.5,b.rect.y*scale+.5,b.rect.w*scale-1,b.rect.h*scale-1); }
  g.fillStyle='#dfe6ef'; g.font=`${Math.max(8,scale*1.7)}px ui-monospace`; g.textAlign='center'; g.textBaseline='middle';
  for(const b of boxes){ const r=b.rect; const label=b.name.split(' • ')[1]; if(r.w*r.h>=32) g.fillText(label.toUpperCase(),(r.x+r.w/2)*scale,(r.y+r.h/2)*scale); }
}

function openGuide(){ drawGuide(); els.guideModal.hidden=false; }
function closeGuide(){ els.guideModal.hidden=true; }

function bind() {
  document.querySelectorAll('.tool-btn').forEach(btn=>btn.addEventListener('click',()=>setTool(btn.dataset.tool)));
  els.gridToggle.addEventListener('change',()=>{state.grid=els.gridToggle.checked; scheduleRender();});
  els.checkerToggle.addEventListener('change',()=>{state.checker=els.checkerToggle.checked;scheduleRender();});
  els.mirrorToggle.addEventListener('change',()=>state.mirror=els.mirrorToggle.checked);
  els.outerToggle?.addEventListener('change',()=>{state.outer=els.outerToggle.checked; preview?.update(state.pixels,state.outer);});
  els.colorInput.addEventListener('input',e=>setColor(e.target.value));
  els.hexInput.addEventListener('change',e=>setColor('#'+e.target.value));
  document.querySelector('#undoBtn').addEventListener('click',undo); document.querySelector('#redoBtn').addEventListener('click',redo);
  document.querySelector('#newSkinBtn').addEventListener('click',()=>{if(confirm('Load a fresh complete starter template? Your current skin will be replaced.')){starterTemplate(state.model);scheduleRender();toast('Starter template loaded.');}});
  document.querySelector('#templateBtn')?.addEventListener('click',()=>{starterTemplate(state.model);scheduleRender();toast('Complete editable template loaded.');});
  document.querySelector('#guideBtn')?.addEventListener('click',openGuide); document.querySelector('#closeGuideBtn')?.addEventListener('click',closeGuide);
  els.guideModal?.addEventListener('click',e=>{if(e.target===els.guideModal)closeGuide();});
  document.querySelector('#importBtn').addEventListener('click',()=>els.fileInput.click());
  els.fileInput.addEventListener('change',e=>{importPng(e.target.files?.[0]);e.target.value='';});
  document.querySelector('#exportBtn').addEventListener('click',exportPng);
  document.querySelector('#downloadTemplateBtn')?.addEventListener('click',downloadStarterTemplate);
  document.querySelector('#checkerBtn').addEventListener('click',()=>{els.checkerToggle.checked=!els.checkerToggle.checked;state.checker=els.checkerToggle.checked;scheduleRender();});
  document.querySelector('#gridBtn').addEventListener('click',()=>{els.gridToggle.checked=!els.gridToggle.checked;state.grid=els.gridToggle.checked;scheduleRender();});
  document.querySelector('#zoomInBtn').addEventListener('click',()=>toast('The editor stays pixel-perfect at every display scale; browser zoom can be used for more working room.'));
  document.querySelector('#zoomOutBtn').addEventListener('click',()=>toast('The editor stays pixel-perfect at every display scale; browser zoom can be used for more working room.'));
  document.querySelector('#fitBtn').addEventListener('click',()=>renderEditor());
  document.querySelector('#frontBtn').addEventListener('click',()=>preview?.front()); document.querySelector('#backBtn').addEventListener('click',()=>preview?.back()); document.querySelector('#resetViewBtn').addEventListener('click',()=>preview?.reset());
  els.modelSelect?.addEventListener('change',()=>{state.model=els.modelSelect.value; preview?.setModel(state.model); drawGuide(); renderChecks();});
  document.querySelector('#clearHistoryBtn').addEventListener('click',()=>{state.recentColors=[DEFAULT_COLOR];renderPalettes();});
  els.canvas.addEventListener('pointerdown',pointerDown); els.canvas.addEventListener('pointermove',pointerMove); els.canvas.addEventListener('pointerup',pointerUp); els.canvas.addEventListener('pointercancel',pointerUp); els.canvas.addEventListener('contextmenu',e=>e.preventDefault());
  window.addEventListener('resize',()=>{renderEditor();preview?.update(state.pixels,state.outer);});
  window.addEventListener('keydown',e=>{
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();undo();}
    else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo();}
    else if(['1','2','3','4','5','6'].includes(e.key)){setTool(['pencil','eraser','fill','picker','line','rect'][Number(e.key)-1]);}
    else if(e.key==='Escape')closeGuide();
  });
}

setColor(DEFAULT_COLOR,false);
preview = makePreview();
bind();
starterTemplate(state.model);
renderAll();
