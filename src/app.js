'use strict';

const APP_VERSION = '0.9.1';
const MIN_TEX = 64;
const MAX_TEX = 1024;
const HISTORY_LIMIT = 80;
const DEFAULT_COLOR = '#7FD7FF';
const DPR_CAP = 2;

const $ = (id) => document.getElementById(id);
const els = {
  html: document.documentElement,
  editorCanvas: $('editorCanvas'),
  miniPreviewCanvas: $('miniPreviewCanvas'),
  canvasWrap: $('stageWrap'),
  canvasPane: $('canvasPane'),
  toolGrid: $('toolGrid'),
  layerGrid: $('layerGrid'),
  colorInput: $('colorInput'),
  hexInput: $('hexInput'),
  swatches: $('swatches'),
  gridToggle: $('gridToggle'),
  checkerToggle: $('checkerToggle'),
  mirrorToggle: $('mirrorToggle'),
  pixelPerfect: $('pixelPerfect'),
  brushSize: $('brushSize'),
  brushSizeValue: $('brushSizeValue'),
  brushOpacity: $('brushOpacity'),
  brushOpacityValue: $('brushOpacityValue'),
  brushShape: $('brushShape'),
  shadeMode: $('shadeMode'),
  replaceTolerance: $('replaceTolerance'),
  toleranceValue: $('toleranceValue'),
  zoomOutBtn: $('zoomOutBtn'),
  zoomInBtn: $('zoomInBtn'),
  fitBtn: $('fitBtn'),
  centerBtn: $('centerBtn'),
  resetViewBtn: $('resetViewBtn'),
  zoomReadout: $('zoomReadout'),
  cursorReadout: $('cursorReadout'),
  activeToolLabel: $('activeToolLabel'),
  layerContext: $('layerContext'),
  gestureHint: $('gestureHint'),
  docStatus: $('docStatus'),
  docSize: $('docSize'),
  focusMeta: $('focusMeta'),
  focusStatus: $('focusStatus'),
  focusBtn: $('focusBtn'),
  focusLockBtn: $('focusLockBtn'),
  focusModal: $('focusModal'),
  focusPartGrid: $('focusPartGrid'),
  focusFaceGrid: $('focusFaceGrid'),
  focusModalStatus: $('focusModalStatus'),
  focusApplyBtn: $('focusApplyBtn'),
  canvasFocusIndicator: $('canvasFocusIndicator'),
  themeSelect: $('themeSelect'),
  modelSelect: $('modelSelect'),
  textureSizeSelect: $('textureSizeSelect'),
  newModel: $('newModel'),
  newSize: $('newSize'),
  newModal: $('newModal'),
  confirmNewBtn: $('confirmNewBtn'),
  templateModal: $('templateModal'),
  heroUploadBtn: $('heroUploadBtn'),
  heroTemplateBtn: $('heroTemplateBtn'),
  skinFileInput: $('skinFileInput'),
  customTextureBtn: $('customTextureBtn'),
  customTextureInput: $('customTextureInput'),
  referenceBtn: $('referenceBtn'),
  referenceFileInput: $('referenceFileInput'),
  referenceToggle: $('referenceToggle'),
  referenceOpacity: $('referenceOpacity'),
  referenceOpacityValue: $('referenceOpacityValue'),
  clearReferenceBtn: $('clearReferenceBtn'),
  geometryBtn: $('geometryBtn'),
  geometryFileInput: $('geometryFileInput'),
  geometryStatus: $('geometryStatus'),
  outerToggle: $('outerToggle'),
  previewStatus: $('previewStatus'),
  checks: $('checks'),
  idleBtn: $('idleBtn'),
  walkBtn: $('walkBtn'),
  pauseAnimBtn: $('pauseAnimBtn'),
  animSpeed: $('animSpeed'),
  animSpeedValue: $('animSpeedValue'),
  autoPerformance: $('autoPerformance'),
  walkToggleBtn: $('walkToggleBtn'),
  previewCameraButtons: [...document.querySelectorAll('[data-camera]')],
  undoBtn: $('undoBtn'),
  redoBtn: $('redoBtn'),
  clearRecentBtn: $('clearRecentBtn'),
  libraryList: $('libraryList'),
  saveLibraryBtn: $('saveLibraryBtn'),
  toolHelpTitle: $('toolHelpTitle'),
  toolHelpText: $('toolHelpText'),
  toolHelpTip: $('toolHelpTip'),
  guideModal: $('guideModal'),
  newBtn: $('newBtn'),
  templateBtn: $('templateBtn'),
  importBtn: $('importBtn'),
  exportBtn: $('exportBtn'),
  guideBtn: $('guideBtn'),
  gridBtn: $('gridBtn'),
  checkerBtn: $('checkerBtn'),
  toastRegion: $('toastRegion'),
  layerLockBase: $('baseLockBtn'),
  layerLockOuter: $('outerLockBtn'),
  templateCards: [...document.querySelectorAll('.template-card')],
};

const editorCtx = els.editorCanvas.getContext('2d', { alpha: true });
const miniGL = els.miniPreviewCanvas.getContext('webgl', { alpha: true, antialias: false, depth: true, stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: false }) || null;
const miniCtx = miniGL ? null : els.miniPreviewCanvas.getContext('2d', { alpha: true, willReadFrequently: false });
editorCtx.imageSmoothingEnabled = false;
if (miniCtx) miniCtx.imageSmoothingEnabled = false;

const TOOL_INFO = {
  pencil: { name: 'Pencil', help: 'Draw one clean texture pixel. Drag to make pixel lines.', tip: 'Best for eyes, hair strands, seams and tiny details.' },
  brush: { name: 'Brush', help: 'Paint several pixels at once with an adjustable size.', tip: 'Turn Pixel perfect on to keep hard Minecraft edges.' },
  eraser: { name: 'Eraser', help: 'Remove pixels and make parts transparent.', tip: 'Use a small size around faces and accessories.' },
  fill: { name: 'Fill', help: 'Fill a connected area with the current color.', tip: 'Choose the right layer before filling.' },
  picker: { name: 'Pick', help: 'Sample a color from the skin, then keep painting.', tip: 'On 3D, tap the exact face you want to sample.' },
  line: { name: 'Line', help: 'Draw a straight pixel line from start to end.', tip: 'Release to place the line.' },
  rect: { name: 'Rect', help: 'Draw a pixel-perfect rectangle.', tip: 'Drag from one corner to the opposite corner.' },
  circle: { name: 'Circle', help: 'Draw a pixel-art circle or ellipse outline.', tip: 'Hold and drag to set the bounds.' },
  shade: { name: 'Light / Dark', help: 'Lighten or darken the pixels you paint over.', tip: 'Use low opacity for subtle clothing folds and depth.' },
  replace: { name: 'Replace Color', help: 'Replace pixels close to the picked target color.', tip: 'Increase tolerance when shades are slightly different.' },
};

const PART_LABELS = {
  head: 'Head', body: 'Body', rightArm: 'Right Arm / Hand', leftArm: 'Left Arm / Hand', rightLeg: 'Right Leg', leftLeg: 'Left Leg'
};
const FACE_LABELS = { front: 'Front', back: 'Back', left: 'Left', right: 'Right', top: 'Top', bottom: 'Bottom' };
const FACE_ORDER = ['front', 'back', 'left', 'right', 'top', 'bottom'];

const state = {
  size: 64,
  model: 'classic',
  mode: '2d',
  tool: 'pencil',
  layer: 'both',
  locks: { base: false, outer: false },
  color: DEFAULT_COLOR,
  recentColors: [DEFAULT_COLOR, '#FFFFFF', '#1B1E24', '#F06E82', '#F4C56A', '#9AF0CF', '#7D8BFF', '#B68CFF', '#6CE0D5', '#F2A0BB', '#A6B7C7', '#5B6673', '#7B4E3A', '#C98E5B', '#3B6D8C', '#283541'],
  pixels: new Uint8ClampedArray(64 * 64 * 4),
  title: 'Classic Starter',
  toolOpacity: 100,
  brushSize: 1,
  brushShape: 'square',
  pixelPerfect: true,
  shadeMode: 'darken',
  replaceTolerance: 0,
  grid: true,
  checker: true,
  outer: true,
  mirror: false,
  reference: null,
  referenceVisible: false,
  referenceOpacity: 0.35,
  history: [],
  historyIndex: -1,
  focus: { part: null, face: null, locked: false },
  customGeometry: null,
  preview: {
    yaw: -26,
    pitch: -10,
    zoom: 0.95,
    offsetX: 0,
    offsetY: 0,
    targetY: 0,
    anim: 'idle',
    animPaused: true,
    speed: 1,
    autoPerformance: true,
  },
  drawing: false,
  lastTexel: null,
  strokeSnapshot: null,
  pointerMap: new Map(),
  gesture: null,
  pendingPointer: null,
  shapeStart: null,
  tempShape: null,
  geometryBytes: 0,
};

let editorView = { x: 0, y: 0, pixelSize: 8 };
let imageCanvas = document.createElement('canvas');
let imageCtx = imageCanvas.getContext('2d', { willReadFrequently: false });
let charFrameHandle = 0;
let lastAnimDraw = 0;
let focusBounds = null;
let selected3DFace = null;

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function lerp(a,b,t) { return a + (b-a)*t; }
function dist(a,b) { return Math.hypot(a.x-b.x, a.y-b.y); }
function midpoint(a,b) { return { x:(a.x+b.x)/2, y:(a.y+b.y)/2 }; }
function now() { return performance.now(); }
function alphaPixels() { let n=0; for(let i=3;i<state.pixels.length;i+=4) if(state.pixels[i]>0) n++; return n; }
function idx(x,y) { return (y*state.size+x)*4; }
function inside(x,y) { return x>=0 && y>=0 && x<state.size && y<state.size; }
function getPixel(x,y) { if(!inside(x,y)) return [0,0,0,0]; const i=idx(x,y); return [state.pixels[i],state.pixels[i+1],state.pixels[i+2],state.pixels[i+3]]; }
function setPixel(x,y,p) { if(!inside(x,y)) return; const i=idx(x,y); state.pixels[i]=p[0];state.pixels[i+1]=p[1];state.pixels[i+2]=p[2];state.pixels[i+3]=p[3]; }
function samePixel(a,b) { return a[0]===b[0]&&a[1]===b[1]&&a[2]===b[2]&&a[3]===b[3]; }
function clonePixels() { return new Uint8ClampedArray(state.pixels); }
function hexToRgba(hex, alpha=255) {
  let v=(hex||'').replace('#','').trim();
  if(v.length===3) v=v.split('').map(c=>c+c).join('');
  if(!/^[0-9a-fA-F]{6}$/.test(v)) return null;
  const n=parseInt(v,16); return [(n>>16)&255,(n>>8)&255,n&255,alpha];
}
function rgbaToHex(r,g,b) { return [r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('').toUpperCase(); }
function mixColor(a,b,t) { return [Math.round(lerp(a[0],b[0],t)), Math.round(lerp(a[1],b[1],t)), Math.round(lerp(a[2],b[2],t)), Math.round(lerp(a[3],b[3],t))]; }
function themeSet(name) { els.html.dataset.theme=name; try{localStorage.setItem('nova-theme',name);}catch{} }
function toast(msg, tone='normal') {
  const el=document.createElement('div'); el.className=`toast ${tone}`; el.textContent=msg; els.toastRegion.appendChild(el); setTimeout(()=>el.remove(),2600);
}

function setColor(hex, addRecent=true) {
  const p=hexToRgba(hex); if(!p) return false;
  state.color='#'+rgbaToHex(p[0],p[1],p[2]);
  els.colorInput.value=state.color; els.hexInput.value=state.color.slice(1);
  if(addRecent) { state.recentColors=[state.color,...state.recentColors.filter(c=>c!==state.color)].slice(0,16); renderSwatches(); }
  return true;
}

function renderSwatches() {
  els.swatches.innerHTML='';
  state.recentColors.forEach(c=>{
    const b=document.createElement('button'); b.className='swatch'; b.style.background=c; b.title=c; b.addEventListener('click',()=>setColor(c)); els.swatches.appendChild(b);
  });
}

function createBlankTexture(size=64) {
  state.size=size; state.pixels=new Uint8ClampedArray(size*size*4);
  // A complete, visible starter with clean flat regions. It is intentionally simple so users can repaint it.
  const parts = skinMap('classic', size, 'base');
  fillRectTexture(parts.find(f=>f.part==='head'&&f.face==='front'), '#E6B98C');
  fillRectTexture(parts.find(f=>f.part==='head'&&f.face==='back'), '#3A281C');
  fillRectTexture(parts.find(f=>f.part==='head'&&f.face==='top'), '#4A3425');
  fillRectTexture(parts.find(f=>f.part==='body'&&f.face==='front'), '#2C3138');
  fillRectTexture(parts.find(f=>f.part==='body'&&f.face==='back'), '#20242A');
  fillRectTexture(parts.find(f=>f.part==='rightLeg'&&f.face==='front'), '#344A63');
  fillRectTexture(parts.find(f=>f.part==='leftLeg'&&f.face==='front'), '#344A63');
  fillRectTexture(parts.find(f=>f.part==='rightArm'&&f.face==='front'), '#56616E');
  fillRectTexture(parts.find(f=>f.part==='leftArm'&&f.face==='front'), '#56616E');
  // tiny face details on front head
  const s=size/64;
  for(const [dx,dy,w,h,color] of [[2,3,1,1,'#2C3138'],[5,3,1,1,'#2C3138'],[3,5,2,1,'#A45B5B']]) {
    fillLogicalRect(8+dx,8+dy,w,h,color,s);
  }
  if(size!==64) nearestScaleLogicalBase(size);
}

function fillLogicalRect(lx,ly,lw,lh,hex,s=state.size/64) {
  const p=hexToRgba(hex); if(!p) return;
  const x0=Math.round(lx*s), y0=Math.round(ly*s), x1=Math.round((lx+lw)*s), y1=Math.round((ly+lh)*s);
  for(let y=y0;y<y1;y++) for(let x=x0;x<x1;x++) setPixel(x,y,p);
}
function fillRectTexture(region, hex) {
  if(!region) return; const p=hexToRgba(hex); if(!p) return;
  for(let y=region.y;y<region.y+region.h;y++) for(let x=region.x;x<region.x+region.w;x++) setPixel(x,y,p);
}
function nearestScaleLogicalBase(size) {
  // createBlankTexture already painted using scaled regions, so this is only a guard hook for future generators.
  return size;
}

function standardRegion(part, face, x,y,w,h,layer='base') { return {part,face,x,y,w,h,layer}; }
function logicalMap(model='classic') {
  const slim=model==='slim';
  const rw=slim?3:4;
  return [
    standardRegion('head','top',8,0,8,8), standardRegion('head','bottom',16,0,8,8), standardRegion('head','right',0,8,8,8), standardRegion('head','front',8,8,8,8), standardRegion('head','left',16,8,8,8), standardRegion('head','back',24,8,8,8),
    standardRegion('body','top',20,16,8,4), standardRegion('body','bottom',28,16,8,4), standardRegion('body','right',16,20,4,12), standardRegion('body','front',20,20,8,12), standardRegion('body','left',28,20,4,12), standardRegion('body','back',32,20,8,12),
    standardRegion('rightArm','top',44,16,rw,4), standardRegion('rightArm','bottom',slim?47:48,16,rw,4), standardRegion('rightArm','right',40,20,4,12), standardRegion('rightArm','front',44,20,rw,12), standardRegion('rightArm','left',slim?47:48,20,4,12), standardRegion('rightArm','back',slim?51:52,20,rw,12),
    standardRegion('leftArm','top',36,48,rw,4), standardRegion('leftArm','bottom',slim?39:40,48,rw,4), standardRegion('leftArm','right',32,52,4,12), standardRegion('leftArm','front',36,52,rw,12), standardRegion('leftArm','left',slim?39:40,52,4,12), standardRegion('leftArm','back',slim?43:44,52,rw,12),
    standardRegion('rightLeg','top',4,16,4,4), standardRegion('rightLeg','bottom',8,16,4,4), standardRegion('rightLeg','right',0,20,4,12), standardRegion('rightLeg','front',4,20,4,12), standardRegion('rightLeg','left',8,20,4,12), standardRegion('rightLeg','back',12,20,4,12),
    standardRegion('leftLeg','top',20,48,4,4), standardRegion('leftLeg','bottom',24,48,4,4), standardRegion('leftLeg','right',16,52,4,12), standardRegion('leftLeg','front',20,52,4,12), standardRegion('leftLeg','left',24,52,4,12), standardRegion('leftLeg','back',28,52,4,12),
  ];
}

function outerMap(model='classic') {
  const slim=model==='slim';
  const rw=slim?3:4;
  return [
    standardRegion('head','top',40,0,8,8,'outer'), standardRegion('head','bottom',48,0,8,8,'outer'), standardRegion('head','right',32,8,8,8,'outer'), standardRegion('head','front',40,8,8,8,'outer'), standardRegion('head','left',48,8,8,8,'outer'), standardRegion('head','back',56,8,8,8,'outer'),
    standardRegion('body','top',20,32,8,4,'outer'), standardRegion('body','bottom',28,32,8,4,'outer'), standardRegion('body','right',16,36,4,12,'outer'), standardRegion('body','front',20,36,8,12,'outer'), standardRegion('body','left',28,36,4,12,'outer'), standardRegion('body','back',32,36,8,12,'outer'),
    standardRegion('rightArm','top',44,32,rw,4,'outer'), standardRegion('rightArm','bottom',slim?47:48,32,rw,4,'outer'), standardRegion('rightArm','right',40,36,4,12,'outer'), standardRegion('rightArm','front',44,36,rw,12,'outer'), standardRegion('rightArm','left',slim?47:48,36,4,12,'outer'), standardRegion('rightArm','back',slim?51:52,36,rw,12,'outer'),
    standardRegion('leftArm','top',slim?52:52,48,rw,4,'outer'), standardRegion('leftArm','bottom',slim?55:56,48,rw,4,'outer'), standardRegion('leftArm','right',48,52,4,12,'outer'), standardRegion('leftArm','front',52,52,rw,12,'outer'), standardRegion('leftArm','left',slim?55:56,52,4,12,'outer'), standardRegion('leftArm','back',slim?59:60,52,rw,12,'outer'),
    standardRegion('rightLeg','top',4,32,4,4,'outer'), standardRegion('rightLeg','bottom',8,32,4,4,'outer'), standardRegion('rightLeg','right',0,36,4,12,'outer'), standardRegion('rightLeg','front',4,36,4,12,'outer'), standardRegion('rightLeg','left',8,36,4,12,'outer'), standardRegion('rightLeg','back',12,36,4,12,'outer'),
    standardRegion('leftLeg','top',4,48,4,4,'outer'), standardRegion('leftLeg','bottom',8,48,4,4,'outer'), standardRegion('leftLeg','right',0,52,4,12,'outer'), standardRegion('leftLeg','front',4,52,4,12,'outer'), standardRegion('leftLeg','left',8,52,4,12,'outer'), standardRegion('leftLeg','back',12,52,4,12,'outer'),
  ];
}

function scaledMap(map) {
  const s=state.size/64;
  return map.map(r=>({ ...r, x:Math.round(r.x*s), y:Math.round(r.y*s), w:Math.max(1,Math.round(r.w*s)), h:Math.max(1,Math.round(r.h*s)) }));
}
function skinMap(model=state.model,size=state.size,layer='both') {
  const base=logicalMap(model); const outer=outerMap(model); const all=[];
  if(layer==='both'||layer==='base') all.push(...scaledMapWithSize(base,size));
  if(layer==='both'||layer==='outer') all.push(...scaledMapWithSize(outer,size));
  return all;
}
function scaledMapWithSize(map,size){ const s=size/64; return map.map(r=>({...r,x:Math.round(r.x*s),y:Math.round(r.y*s),w:Math.max(1,Math.round(r.w*s)),h:Math.max(1,Math.round(r.h*s))})); }
function regionAt(x,y,layer='both') {
  const maps=skinMap(state.model,state.size,layer);
  for(let i=maps.length-1;i>=0;i--){ const r=maps[i]; if(x>=r.x&&y>=r.y&&x<r.x+r.w&&y<r.y+r.h) return r; }
  return null;
}
function layerAt(x,y) {
  const out=regionAt(x,y,'outer'); if(out) return 'outer';
  const base=regionAt(x,y,'base'); if(base) return 'base';
  return null;
}

// Editing on the unfolded canvas needs the selected layer to block unrelated texture pixels.
function canEditPixel(x,y) {
  const layer=layerAt(x,y);
  if(!layer) return true;
  if(layer==='base' && state.locks.base) return false;
  if(layer==='outer' && state.locks.outer) return false;
  if(state.focus.locked && focusBounds){
    if(x < focusBounds.x || y < focusBounds.y || x >= focusBounds.x + focusBounds.w || y >= focusBounds.y + focusBounds.h) return false;
  }
  if(state.layer==='both') return true;
  return state.layer===layer;
}

function getFocusRegion(part,face,layer='base') {
  const maps=skinMap(state.model,state.size,layer);
  return maps.find(r=>r.part===part&&r.face===face) || maps.find(r=>r.part===part&&r.face==='front') || null;
}

function createTextureCanvas() {
  imageCanvas.width=state.size; imageCanvas.height=state.size;
  const img=new ImageData(new Uint8ClampedArray(state.pixels),state.size,state.size);
  imageCtx.putImageData(img,0,0);
}

function checkerPattern(ctx,w,h,cell=16) {
  ctx.fillStyle='#0d1016';ctx.fillRect(0,0,w,h);ctx.fillStyle='#171c23';
  for(let y=0;y<h;y+=cell) for(let x=0;x<w;x+=cell) if(((x/cell)+(y/cell))%2===0) ctx.fillRect(x,y,cell,cell);
}

function resizeCanvas(canvas) {
  const rect=canvas.getBoundingClientRect(); const dpr=Math.min(devicePixelRatio||1,DPR_CAP); const w=Math.max(1,Math.round(rect.width*dpr)),h=Math.max(1,Math.round(rect.height*dpr));
  if(canvas.width!==w||canvas.height!==h){ canvas.width=w;canvas.height=h; }
  const c=canvas===els.editorCanvas?editorCtx:miniCtx;
  if(c){ c.imageSmoothingEnabled=false; c.setTransform(dpr,0,0,dpr,0,0); }
  return {w:rect.width,h:rect.height,dpr};
}

function resizePreviewCanvas(){
  const rect=els.miniPreviewCanvas.getBoundingClientRect();
  const dpr=Math.min(devicePixelRatio||1,2);
  const w=Math.max(220,Math.round(rect.width*dpr)), h=Math.max(180,Math.round(rect.height*dpr));
  if(els.miniPreviewCanvas.width!==w || els.miniPreviewCanvas.height!==h){
    els.miniPreviewCanvas.width=w; els.miniPreviewCanvas.height=h;
    if(miniGL) miniGL.viewport(0,0,w,h);
  }
  return {w,h,dpr,cssW:rect.width,cssH:rect.height};
}

function fitEditorView() {
  const rect=els.editorCanvas.getBoundingClientRect();
  const pad=Math.min(rect.width,rect.height)*0.07;
  editorView.pixelSize=Math.max(2,Math.min(32,Math.floor((Math.min(rect.width,rect.height)-pad*2)/state.size)));
  const drawn=state.size*editorView.pixelSize;
  editorView.x=(rect.width-drawn)/2; editorView.y=(rect.height-drawn)/2;
  renderEditor();
}
function centerEditorView() { const rect=els.editorCanvas.getBoundingClientRect(); const drawn=state.size*editorView.pixelSize; editorView.x=(rect.width-drawn)/2;editorView.y=(rect.height-drawn)/2;renderEditor(); }
function setEditorZoom(newSize,cx=null,cy=null) {
  const rect=els.editorCanvas.getBoundingClientRect(); const old=editorView.pixelSize; const next=clamp(newSize,1,40);
  if(cx==null){cx=rect.width/2;cy=rect.height/2;}
  const tx=(cx-editorView.x)/old, ty=(cy-editorView.y)/old;
  editorView.pixelSize=next; editorView.x=cx-tx*next; editorView.y=cy-ty*next;
  renderEditor();
}
function screenToTex(clientX,clientY) {
  const rect=els.editorCanvas.getBoundingClientRect(); const x=(clientX-rect.left-editorView.x)/editorView.pixelSize; const y=(clientY-rect.top-editorView.y)/editorView.pixelSize;
  return {x:Math.floor(x),y:Math.floor(y)};
}
function texToScreen(x,y) { const rect=els.editorCanvas.getBoundingClientRect();return {x:rect.left+editorView.x+x*editorView.pixelSize,y:rect.top+editorView.y+y*editorView.pixelSize}; }

function renderEditor() {
  const {w,h}=resizeCanvas(els.editorCanvas); createTextureCanvas();
  editorCtx.clearRect(0,0,w,h);
  if(state.checker) checkerPattern(editorCtx,w,h,Math.max(12,Math.round(editorView.pixelSize*2)));
  else { editorCtx.fillStyle='var(--canvas-bg)'; editorCtx.fillRect(0,0,w,h); }
  if(state.referenceVisible&&state.reference) {
    editorCtx.save();editorCtx.globalAlpha=state.referenceOpacity;editorCtx.imageSmoothingEnabled=false;
    const scale=Math.min(w/state.reference.width,h/state.reference.height)*0.75;
    const rw=state.reference.width*scale,rh=state.reference.height*scale;
    editorCtx.drawImage(state.reference,(w-rw)/2,(h-rh)/2,rw,rh);editorCtx.restore();
  }
  const drawW=state.size*editorView.pixelSize,drawH=drawW;
  editorCtx.imageSmoothingEnabled=false; editorCtx.drawImage(imageCanvas,editorView.x,editorView.y,drawW,drawH);
  if(state.grid&&editorView.pixelSize>=4){
    editorCtx.save();editorCtx.strokeStyle='rgba(130,145,160,.20)';editorCtx.lineWidth=1;editorCtx.beginPath();
    for(let i=0;i<=state.size;i++){const x=Math.round(editorView.x+i*editorView.pixelSize)+.5;editorCtx.moveTo(x,editorView.y);editorCtx.lineTo(x,editorView.y+drawH);} 
    for(let i=0;i<=state.size;i++){const y=Math.round(editorView.y+i*editorView.pixelSize)+.5;editorCtx.moveTo(editorView.x,y);editorCtx.lineTo(editorView.x+drawW,y);} editorCtx.stroke();editorCtx.restore();
  }
  if(focusBounds){
    const r=focusBounds; const sx=editorView.x+r.x*editorView.pixelSize, sy=editorView.y+r.y*editorView.pixelSize, sw=r.w*editorView.pixelSize, sh=r.h*editorView.pixelSize;
    editorCtx.save(); editorCtx.strokeStyle='rgba(127,215,255,.95)';editorCtx.lineWidth=Math.max(1,Math.min(3,editorView.pixelSize/2));editorCtx.setLineDash([6,4]);editorCtx.strokeRect(sx+.5,sy+.5,sw,sh);editorCtx.fillStyle='rgba(127,215,255,.06)';editorCtx.fillRect(sx,sy,sw,sh);editorCtx.restore();
  }
  editorCtx.save();editorCtx.strokeStyle='rgba(255,255,255,.14)';editorCtx.strokeRect(.5,.5,w-1,h-1);editorCtx.restore();
  els.zoomReadout.textContent=`${Math.round(editorView.pixelSize*100)}%`;
}

function updateCursorReadout(x,y){
  const r=regionAt(x,y,'both'); const layer=layerAt(x,y); els.cursorReadout.textContent=inside(x,y)?`Pixel ${x},${y}${r?` · ${PART_LABELS[r.part]} ${FACE_LABELS[r.face]}`:''}${layer?` · ${layer}`:''}`:'Pixel —';
}

function captureState(){ return {pixels:clonePixels(),size:state.size,model:state.model}; }
function pushHistory(){
  const snap=captureState();
  if(state.historyIndex<state.history.length-1) state.history=state.history.slice(0,state.historyIndex+1);
  const prev=state.history[state.history.length-1];
  if(prev&&prev.size===snap.size&&prev.model===snap.model&&prev.pixels.every((v,i)=>v===snap.pixels[i])) return;
  state.history.push(snap);if(state.history.length>HISTORY_LIMIT)state.history.shift();state.historyIndex=state.history.length-1;updateHistoryButtons();
}
function restoreSnapshot(snap){ if(!snap)return;state.size=snap.size;state.model=snap.model;state.pixels=new Uint8ClampedArray(snap.pixels); syncSelectors();createTextureCanvas();focusBounds=state.focus.part&&state.focus.face?getFocusRegion(state.focus.part,state.focus.face,'base'):null;previewRenderer.setModel();previewRenderer.setTexture();fitEditorView();render3D();renderChecks(); }
function undo(){ if(state.historyIndex<=0)return; state.historyIndex--;restoreSnapshot(state.history[state.historyIndex]);toast('Undo'); }
function redo(){ if(state.historyIndex>=state.history.length-1)return; state.historyIndex++;restoreSnapshot(state.history[state.historyIndex]);toast('Redo'); }
function updateHistoryButtons(){ els.undoBtn.disabled=state.historyIndex<=0;els.redoBtn.disabled=state.historyIndex>=state.history.length-1; }

function rgbaFromColor() { const p=hexToRgba(state.color,Math.round(255*state.toolOpacity/100)); return p||[127,215,255,255]; }
function applyPixelColor(x,y) {
  if(!inside(x,y)||!canEditPixel(x,y)) return false;
  const rgba=rgbaFromColor(); const cur=getPixel(x,y); let next=rgba;
  if(state.tool==='eraser'){ next=[0,0,0,0]; }
  else if(state.tool==='shade'){
    const factor=state.shadeMode==='lighten'?1.18:0.82; next=[clamp(Math.round(cur[0]*factor),0,255),clamp(Math.round(cur[1]*factor),0,255),clamp(Math.round(cur[2]*factor),0,255),cur[3]||rgba[3]];
  }
  if(samePixel(cur,next)) return false; setPixel(x,y,next);
  if(state.mirror){ const mx=state.size-1-x; if(mx!==x&&canEditPixel(mx,y)) setPixel(mx,y,next); }
  return true;
}
function stampBrush(x,y){
  const size=state.tool==='pencil'||state.tool==='eraser'||state.tool==='shade'||state.tool==='picker'?1:state.brushSize;
  const r=Math.floor(size/2); let changed=false;
  for(let dy=-r;dy<=r;dy++) for(let dx=-r;dx<=r;dx++){
    if(state.brushShape==='circle' && dx*dx+dy*dy>r*r) continue;
    changed=applyPixelColor(x+dx,y+dy)||changed;
  }
  return changed;
}
function linePoints(x0,y0,x1,y1){ const pts=[];let dx=Math.abs(x1-x0),sx=x0<x1?1:-1,dy=-Math.abs(y1-y0),sy=y0<y1?1:-1,err=dx+dy; while(true){pts.push([x0,y0]);if(x0===x1&&y0===y1)break;const e2=2*err;if(e2>=dy){err+=dy;x0+=sx;}if(e2<=dx){err+=dx;y0+=sy;}}return pts; }
function ellipsePoints(x0,y0,x1,y1){ const pts=[];const cx=(x0+x1)/2,cy=(y0+y1)/2,rx=Math.abs(x1-x0)/2,ry=Math.abs(y1-y0)/2; const steps=Math.max(12,Math.ceil(Math.PI*2*Math.max(rx,ry)));let last='';for(let i=0;i<=steps;i++){const t=i/steps*Math.PI*2;const x=Math.round(cx+Math.cos(t)*rx),y=Math.round(cy+Math.sin(t)*ry);const key=x+','+y;if(key!==last){pts.push([x,y]);last=key;}}return pts; }
function drawShapePoints(points){ let changed=false;for(const [x,y] of points) changed=stampBrush(x,y)||changed;return changed; }

function floodFill(x,y){
  if(!inside(x,y)||!canEditPixel(x,y)) return false; const target=getPixel(x,y), repl=rgbaFromColor(); if(samePixel(target,repl))return false;
  const q=[[x,y]],seen=new Uint8Array(state.size*state.size);seen[y*state.size+x]=1;let changed=false;
  while(q.length){const [cx,cy]=q.pop();if(!samePixel(getPixel(cx,cy),target))continue;if(!canEditPixel(cx,cy))continue;setPixel(cx,cy,repl);changed=true;for(const [nx,ny] of [[cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]]){if(inside(nx,ny)&&!seen[ny*state.size+nx]){seen[ny*state.size+nx]=1;q.push([nx,ny]);}}}
  return changed;
}
function replaceColors(target){
  const t=target||[0,0,0,0], tol=state.replaceTolerance; const lim=tol*tol*3; let changed=false;
  for(let y=0;y<state.size;y++)for(let x=0;x<state.size;x++){if(!canEditPixel(x,y))continue;const p=getPixel(x,y);const d=(p[0]-t[0])**2+(p[1]-t[1])**2+(p[2]-t[2])**2+(p[3]-t[3])**2;if(d<=lim)setPixel(x,y,rgbaFromColor()),changed=true;}
  return changed;
}

function beginStroke() { state.strokeSnapshot=captureState();state.drawing=true; }
function finishStroke(){ if(state.drawing){state.drawing=false;state.shapeStart=null;state.tempShape=null;if(state.strokeSnapshot){ const before=state.strokeSnapshot.pixels; let changed=false;if(before.length===state.pixels.length){for(let i=0;i<before.length;i++)if(before[i]!==state.pixels[i]){changed=true;break;}}else changed=true;if(changed)pushHistory();}state.strokeSnapshot=null;renderChecks(); } }

function paintAt(x,y){
  updateCursorReadout(x,y); if(!inside(x,y))return;
  if(state.tool==='picker'){setColor('#'+rgbaToHex(...getPixel(x,y).slice(0,3))); setTool('pencil');return;}
  if(state.tool==='fill'){if(!state.drawing)beginStroke();floodFill(x,y);renderEditor();finishStroke();return;}
  if(state.tool==='replace'){if(!state.drawing)beginStroke();replaceColors(getPixel(x,y));renderEditor();finishStroke();return;}
  if(state.tool==='line'||state.tool==='rect'||state.tool==='circle'){ if(!state.shapeStart){state.shapeStart={x,y}; if(!state.drawing)beginStroke();} else { const sx=state.shapeStart.x,sy=state.shapeStart.y; drawPreviewShape(sx,sy,x,y); } return; }
  if(!state.drawing)beginStroke();
  stampBrush(x,y);renderEditor();scheduleCharacterFrame();
}
function drawPreviewShape(x0,y0,x1,y1){
  if(!state.strokeSnapshot)return;state.pixels=new Uint8ClampedArray(state.strokeSnapshot.pixels);let pts=[];
  if(state.tool==='line')pts=linePoints(x0,y0,x1,y1);
  else if(state.tool==='rect'){for(let x=Math.min(x0,x1);x<=Math.max(x0,x1);x++){pts.push([x,y0],[x,y1]);}for(let y=Math.min(y0,y1);y<=Math.max(y0,y1);y++){pts.push([x0,y],[x1,y]);}}
  else pts=ellipsePoints(x0,y0,x1,y1);
  drawShapePoints(pts);state.tempShape={x0,y0,x1,y1};renderEditor();scheduleCharacterFrame();
}

function activatePendingSingle(){
  const p=state.pendingPointer; if(!p||state.pointerMap.size!==1)return;
  const pt=state.pointerMap.get(p.id); if(!pt)return;
  state.pendingPointer=null;
  const tex=screenToTex(pt.x,pt.y); updateCursorReadout(tex.x,tex.y); paintAt(tex.x,tex.y);
  if(state.drawing)state._touchPaintActivated=true;
}
function handleEditorPointerDown(ev){
  ev.preventDefault();
  const pt={x:ev.clientX,y:ev.clientY};state.pointerMap.set(ev.pointerId,pt);els.editorCanvas.setPointerCapture(ev.pointerId);
  if(state.pointerMap.size>=2){ cancelPendingSingle(); beginTouchGesture(); return; }
  if(ev.pointerType==='touch'){
    state.pendingPointer={id:ev.pointerId,startX:ev.clientX,startY:ev.clientY,timer:setTimeout(activatePendingSingle,75)};
    const tex=screenToTex(ev.clientX,ev.clientY);updateCursorReadout(tex.x,tex.y);return;
  }
  const tex=screenToTex(ev.clientX,ev.clientY); updateCursorReadout(tex.x,tex.y);paintAt(tex.x,tex.y);
}

function handleEditorPointerMove(ev){
  if(!state.pointerMap.has(ev.pointerId))return; state.pointerMap.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});
  if(state.gesture){updateTouchGesture();return;}
  if(state.pendingPointer&&state.pendingPointer.id===ev.pointerId){
    const moved=Math.hypot(ev.clientX-state.pendingPointer.startX,ev.clientY-state.pendingPointer.startY);
    if(moved>=4){clearTimeout(state.pendingPointer.timer);activatePendingSingle();}
    else return;
  }
  const tex=screenToTex(ev.clientX,ev.clientY);updateCursorReadout(tex.x,tex.y);
  if(state.drawing && !['fill','replace','picker'].includes(state.tool)){
    if(state.shapeStart && ['line','rect','circle'].includes(state.tool)) drawPreviewShape(state.shapeStart.x,state.shapeStart.y,tex.x,tex.y);
    else { stampBrush(tex.x,tex.y);renderEditor();scheduleCharacterFrame(); }
  }
}
function handleEditorPointerUp(ev){
  if(state.pendingPointer&&state.pendingPointer.id===ev.pointerId){clearTimeout(state.pendingPointer.timer);state.pendingPointer=null;}
  state.pointerMap.delete(ev.pointerId);try{els.editorCanvas.releasePointerCapture(ev.pointerId);}catch{}
  if(state.gesture){ if(state.pointerMap.size<2)state.gesture=null; return; }
  finishStroke();state.pendingPointer=null;
}
function handleEditorWheel(ev){ ev.preventDefault();const rect=els.editorCanvas.getBoundingClientRect();const cx=ev.clientX-rect.left,cy=ev.clientY-rect.top;setEditorZoom(editorView.pixelSize*(ev.deltaY<0?1.15:.87),cx,cy); }
function beginTouchGesture(){
  const pts=[...state.pointerMap.values()];if(pts.length<2)return;const a=pts[0],b=pts[1],m=midpoint(a,b);state.gesture={startMid:m,startDist:dist(a,b),startZoom:editorView.pixelSize,startX:editorView.x,startY:editorView.y,rect:els.editorCanvas.getBoundingClientRect()};
  if(state.drawing){state.pixels=state.strokeSnapshot?new Uint8ClampedArray(state.strokeSnapshot.pixels):state.pixels;state.drawing=false;state.strokeSnapshot=null;state.shapeStart=null;renderEditor();}
}
function updateTouchGesture(){const pts=[...state.pointerMap.values()];if(pts.length<2||!state.gesture)return;const a=pts[0],b=pts[1],m=midpoint(a,b),g=state.gesture;const scale=dist(a,b)/Math.max(1,g.startDist);const nextZoom=clamp(g.startZoom*scale,1,40);const localStartX=g.startMid.x-g.rect.left,localStartY=g.startMid.y-g.rect.top;const localNowX=m.x-g.rect.left,localNowY=m.y-g.rect.top;const tx=(localStartX-g.startX)/g.startZoom,ty=(localStartY-g.startY)/g.startZoom;editorView.pixelSize=nextZoom;editorView.x=localNowX-tx*nextZoom;editorView.y=localNowY-ty*nextZoom;renderEditor();}
function cancelPendingSingle(){if(state.pendingPointer?.timer)clearTimeout(state.pendingPointer.timer);state.pendingPointer=null;}

function focusOn(part,face,lock=false){
  const r=getFocusRegion(part,face,'base')||getFocusRegion(part,face,'both')||getFocusRegion(part,'front','base');if(!r)return;
  state.focus.part=part;state.focus.face=face||'front';state.focus.locked=lock;focusBounds={...r};
  const rect=els.editorCanvas.getBoundingClientRect();
  const maxZoomByW=Math.max(1,(rect.width*0.72)/Math.max(1,r.w));
  const maxZoomByH=Math.max(1,(rect.height*0.72)/Math.max(1,r.h));
  const z=clamp(Math.floor(Math.min(maxZoomByW,maxZoomByH)),2,40);
  const targetX=r.x+r.w/2,targetY=r.y+r.h/2;
  editorView.pixelSize=z;
  editorView.x=rect.width/2-targetX*z;
  editorView.y=rect.height/2-targetY*z;
  els.focusStatus.textContent=`${PART_LABELS[part]} · ${FACE_LABELS[state.focus.face]}`;
  els.focusLockBtn.textContent=state.focus.locked?'🔒 Unlock':'🔓 Lock';
  els.focusMeta.hidden=false;els.focusMeta.textContent=`· ${PART_LABELS[part]} / ${FACE_LABELS[state.focus.face]}`;
  renderEditor();renderFocusModalState();
}
function toggleFocusLock(){if(!state.focus.part){toast('Choose a focus area first.');return;}state.focus.locked=!state.focus.locked;els.focusLockBtn.textContent=state.focus.locked?'🔒 Unlock':'🔓 Lock';renderEditor();toast(state.focus.locked?'Focus locked: painting is limited to the highlighted region.':'Focus unlocked');}
function renderFocusModal(){
  els.focusPartGrid.innerHTML=Object.entries(PART_LABELS).map(([key,label])=>`<button class="focus-part-btn" data-part="${key}">${label}</button>`).join('');els.focusPartGrid.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{state._focusPart=b.dataset.part;renderFocusModalState();}));
  els.focusFaceGrid.innerHTML=FACE_ORDER.map(face=>`<button class="focus-face-btn" data-face="${face}">${FACE_LABELS[face]}</button>`).join('');els.focusFaceGrid.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{if(!state._focusPart){toast('Choose a body part first.');return;}state._focusFace=b.dataset.face;renderFocusModalState();}));
}
function renderFocusModalState(){els.focusPartGrid.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.part===state._focusPart));els.focusFaceGrid.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.face===state._focusFace));els.focusModalStatus.textContent=state._focusPart&&state._focusFace?`${PART_LABELS[state._focusPart]} · ${FACE_LABELS[state._focusFace]}`:'Choose a part, then a face.';}
function openFocusModal(){state._focusPart=state.focus.part||'head';state._focusFace=state.focus.face||'front';renderFocusModalState();els.focusModal.hidden=false;}
function applyFocus(){if(state._focusPart&&state._focusFace){focusOn(state._focusPart,state._focusFace,state.focus.locked);els.focusModal.hidden=true;}}

function setMode(mode){ state.mode='2d'; renderEditor(); }
function setTool(tool){state.tool=tool;els.toolGrid.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===tool));const info=TOOL_INFO[tool];els.toolHelpTitle.textContent=info.name;els.toolHelpText.textContent=info.help;els.toolHelpTip.textContent=`Tip: ${info.tip}`;els.activeToolLabel.textContent=info.name; if(tool==='pencil'||tool==='eraser'||tool==='shade'||tool==='picker') els.brushSize.value='1';updateControlLabels();}
function setLayer(layer){state.layer=layer;els.layerGrid.querySelectorAll('[data-layer]').forEach(b=>b.classList.toggle('active',b.dataset.layer===layer));els.layerContext.textContent=layer==='both'?'Both layers':layer==='base'?'Base layer':'Outer layer';}
function toggleLock(layer){state.locks[layer]=!state.locks[layer];const b=layer==='base'?els.layerLockBase:els.layerLockOuter;b.textContent=state.locks[layer]?'🔒 '+(layer==='base'?'Base':'Outer'):'🔓 '+(layer==='base'?'Base':'Outer');}
function updateControlLabels(){els.brushSizeValue.textContent=`${els.brushSize.value} px`;els.brushOpacityValue.textContent=`${els.brushOpacity.value}%`;els.toleranceValue.textContent=els.replaceTolerance.value;els.referenceOpacityValue.textContent=`${els.referenceOpacity.value}%`;els.animSpeedValue.textContent=`${els.animSpeed.value}×`;}

function drawCheckerMini(ctx,w,h){ctx.fillStyle='#11151b';ctx.fillRect(0,0,w,h);ctx.fillStyle='#1b2028';for(let y=0;y<h;y+=12)for(let x=0;x<w;x+=12)if(((x/12)+(y/12))%2===0)ctx.fillRect(x,y,12,12);}

// ---------- 3D PREVIEW (read-only, hardware accelerated with safe canvas fallback) ----------
// The preview is deliberately read-only. All actual editing happens on the 2D skin canvas.
// Standard skin UV coordinates are defined once in logicalMap()/outerMap() and scale by texture density.
function mat4Identity(){return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);}
function mat4Multiply(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return o;}
function mat4Translate(x,y,z){const m=mat4Identity();m[12]=x;m[13]=y;m[14]=z;return m;}
function mat4Scale(x,y,z){const m=mat4Identity();m[0]=x;m[5]=y;m[10]=z;return m;}
function mat4RotateX(a){const c=Math.cos(a),s=Math.sin(a);return new Float32Array([1,0,0,0,0,c,s,0,0,-s,c,0,0,0,0,1]);}
function mat4RotateY(a){const c=Math.cos(a),s=Math.sin(a);return new Float32Array([c,0,-s,0,0,1,0,0,s,0,c,0,0,0,0,1]);}
function mat4Perspective(fov,aspect,near,far){const f=1/Math.tan(fov/2),nf=1/(near-far),m=new Float32Array(16);m[0]=f/aspect;m[5]=f;m[10]=(far+near)*nf;m[11]=-1;m[14]=2*far*near*nf;return m;}
function mat4LookAt(eye,center,up){let zx=eye[0]-center[0],zy=eye[1]-center[1],zz=eye[2]-center[2],len=Math.hypot(zx,zy,zz)||1;zx/=len;zy/=len;zz/=len;let xx=up[1]*zz-up[2]*zy,xy=up[2]*zx-up[0]*zz,xz=up[0]*zy-up[1]*zx;len=Math.hypot(xx,xy,xz)||1;xx/=len;xy/=len;xz/=len;const yx=zy*xz-zz*xy,yy=zz*xx-zx*xz,yz=zx*xy-zy*xx;return new Float32Array([xx,yx,zx,0,xy,yy,zy,0,xz,yz,zz,0,-(xx*eye[0]+xy*eye[1]+xz*eye[2]),-(yx*eye[0]+yy*eye[1]+yz*eye[2]),-(zx*eye[0]+zy*eye[1]+zz*eye[2]),1]);}
function previewUV(region,size=state.size){const sx=region.x/64,sy=region.y/64,sw=region.w/64,sh=region.h/64;return [sx,1-(sy+sh),sx+sw,1-sy];}
function createPreviewShader(gl,type,src){const sh=gl.createShader(type);gl.shaderSource(sh,src);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(sh)||'Shader compile error');return sh;}
function createPreviewProgram(gl){
  const vs=createPreviewShader(gl,gl.VERTEX_SHADER,`attribute vec3 aPosition;attribute vec2 aUV;attribute vec3 aNormal;uniform mat4 uMVP;uniform mat4 uModel;varying vec2 vUV;varying vec3 vNormal;void main(){vUV=aUV;vNormal=(uModel*vec4(aNormal,0.0)).xyz;gl_Position=uMVP*uModel*vec4(aPosition,1.0);}`);
  const fs=createPreviewShader(gl,gl.FRAGMENT_SHADER,`precision mediump float;uniform sampler2D uTexture;varying vec2 vUV;varying vec3 vNormal;void main(){vec4 c=texture2D(uTexture,vUV);if(c.a<0.02)discard;vec3 l=normalize(vec3(-0.35,0.8,0.55));float ndl=max(dot(normalize(vNormal),l),0.0);float shade=0.68+ndl*0.32;gl_FragColor=vec4(c.rgb*shade,c.a);}`);
  const p=gl.createProgram();gl.attachShader(p,vs);gl.attachShader(p,fs);gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p)||'Program link error');return p;
}
function addPreviewFace(data,p0,p1,p2,p3,region,normal){
  const base=data.positions.length/3;for(const p of [p0,p1,p2,p3])data.positions.push(...p);const [u0,v0,u1,v1]=previewUV(region);data.uvs.push(u0,v0,u1,v0,u1,v1,u0,v1);for(let i=0;i<4;i++)data.normals.push(...normal);data.indices.push(base,base+1,base+2,base,base+2,base+3);
}
function buildCubeGeometry(name,size,pivotOffset,inflate,regions){
  const w=size[0]+inflate,h=size[1]+inflate,d=size[2]+inflate,hx=w/2,hy=h/2,hz=d/2,px=0,py=0,pz=0;const data={positions:[],uvs:[],normals:[],indices:[]};
  addPreviewFace(data,[-hx,-hy,hz],[hx,-hy,hz],[hx,hy,hz],[-hx,hy,hz],regions.front,[0,0,1]);
  addPreviewFace(data,[hx,-hy,-hz],[-hx,-hy,-hz],[-hx,hy,-hz],[hx,hy,-hz],regions.back,[0,0,-1]);
  addPreviewFace(data,[hx,-hy,hz],[hx,-hy,-hz],[hx,hy,-hz],[hx,hy,hz],regions.right,[1,0,0]);
  addPreviewFace(data,[-hx,-hy,-hz],[-hx,-hy,hz],[-hx,hy,hz],[-hx,hy,-hz],regions.left,[-1,0,0]);
  addPreviewFace(data,[-hx,hy,hz],[hx,hy,hz],[hx,hy,-hz],[-hx,hy,-hz],regions.top,[0,1,0]);
  addPreviewFace(data,[-hx,-hy,-hz],[hx,-hy,-hz],[hx,-hy,hz],[-hx,-hy,hz],regions.bottom,[0,-1,0]);
  return {name,size,pivotOffset,inflate,data};
}
function buildPreviewParts(){
  const armW=state.model==='slim'?3:4;const armX=4+armW/2;const base=logicalMap(state.model),outer=outerMap(state.model);const pick=(map,part,face)=>map.find(r=>r.part===part&&r.face===face);const regionsFor=(map,part)=>({front:pick(map,part,'front'),back:pick(map,part,'back'),right:pick(map,part,'right'),left:pick(map,part,'left'),top:pick(map,part,'top'),bottom:pick(map,part,'bottom')});
  const parts=[
    {name:'head',center:[0,12,0],size:[8,8,8],pivotOffset:[0,0,0],swingAxis:'none'},
    {name:'body',center:[0,2,0],size:[8,12,4],pivotOffset:[0,0,0],swingAxis:'none'},
    {name:'rightArm',center:[-armX,2,0],size:[armW,12,4],pivotOffset:[0,6,0],swingAxis:'arm'},
    {name:'leftArm',center:[armX,2,0],size:[armW,12,4],pivotOffset:[0,6,0],swingAxis:'arm'},
    {name:'rightLeg',center:[-2,-10,0],size:[4,12,4],pivotOffset:[0,6,0],swingAxis:'leg'},
    {name:'leftLeg',center:[2,-10,0],size:[4,12,4],pivotOffset:[0,6,0],swingAxis:'leg'},
  ];
  for(const p of parts){p.base=buildCubeGeometry(p.name,p.size,p.pivotOffset,0,regionsFor(base,p.name));p.outer=buildCubeGeometry(p.name,p.size,p.pivotOffset,0.5,regionsFor(outer,p.name));}
  return parts;
}
function createPreviewBuffer(gl,data){const b={pos:gl.createBuffer(),uv:gl.createBuffer(),nrm:gl.createBuffer(),idx:gl.createBuffer(),count:data.indices.length};gl.bindBuffer(gl.ARRAY_BUFFER,b.pos);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data.positions),gl.STATIC_DRAW);gl.bindBuffer(gl.ARRAY_BUFFER,b.uv);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data.uvs),gl.STATIC_DRAW);gl.bindBuffer(gl.ARRAY_BUFFER,b.nrm);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data.normals),gl.STATIC_DRAW);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,b.idx);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(data.indices),gl.STATIC_DRAW);return b;}
function previewThemeColor(){const css=getComputedStyle(document.documentElement);const hex=css.getPropertyValue('--preview-bg').trim()||'#0c1016';const m=hex.match(/^#([0-9a-f]{6})$/i);if(!m)return [0.047,0.063,0.086];const n=parseInt(m[1],16);return [((n>>16)&255)/255,((n>>8)&255)/255,(n&255)/255];}
function svAdd(a,b){return {x:a.x+b.x,y:a.y+b.y,z:a.z+b.z};}
function svSub(a,b){return {x:a.x-b.x,y:a.y-b.y,z:a.z-b.z};}
function svMul(a,s){return {x:a.x*s,y:a.y*s,z:a.z*s};}
function svDot(a,b){return a.x*b.x+a.y*b.y+a.z*b.z;}
function svCross(a,b){return {x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x};}
function svNorm(a){const l=Math.hypot(a.x,a.y,a.z)||1;return {x:a.x/l,y:a.y/l,z:a.z/l};}
function svRotateX(p,a){const c=Math.cos(a),s=Math.sin(a);return {x:p.x,y:p.y*c-p.z*s,z:p.y*s+p.z*c};}
function softwareFaceCorners(part,face,inflate=0){
  const w=part.size[0]+inflate,h=part.size[1]+inflate,d=part.size[2]+inflate,hx=w/2,hy=h/2,hz=d/2;
  const c={};
  const faceVerts={
    front:[[-hx,hy,hz],[hx,hy,hz],[hx,-hy,hz],[-hx,-hy,hz]],
    back:[[hx,hy,-hz],[-hx,hy,-hz],[-hx,-hy,-hz],[hx,-hy,-hz]],
    right:[[hx,hy,hz],[hx,hy,-hz],[hx,-hy,-hz],[hx,-hy,hz]],
    left:[[-hx,hy,-hz],[-hx,hy,hz],[-hx,-hy,hz],[-hx,-hy,-hz]],
    top:[[-hx,hy,hz],[hx,hy,hz],[hx,hy,-hz],[-hx,hy,-hz]],
    bottom:[[-hx,-hy,-hz],[hx,-hy,-hz],[hx,-hy,hz],[-hx,-hy,hz]],
  }[face]||[];
  const rx=part.swingAxis==='arm'?(part.name==='rightArm'?Math.sin(performance.now()*0.0045*state.preview.speed)*0.48: -Math.sin(performance.now()*0.0045*state.preview.speed)*0.48):part.swingAxis==='leg'?(part.name==='rightLeg'?-Math.sin(performance.now()*0.0045*state.preview.speed)*0.48:Math.sin(performance.now()*0.0045*state.preview.speed)*0.48):0;
  const walking=state.preview.anim==='walk'&&!state.preview.animPaused; const angle=walking?rx:0;
  return faceVerts.map(v=>{let p={x:v[0],y:v[1],z:v[2]};p=svSub(p,{x:part.pivotOffset[0],y:part.pivotOffset[1],z:part.pivotOffset[2]});p=svRotateX(p,angle);p=svAdd(p,{x:part.pivotOffset[0]+part.center[0],y:part.pivotOffset[1]+part.center[1],z:part.pivotOffset[2]+part.center[2]});return p;});
}
function softwareNormal(part,face){const n={front:{x:0,y:0,z:1},back:{x:0,y:0,z:-1},right:{x:1,y:0,z:0},left:{x:-1,y:0,z:0},top:{x:0,y:1,z:0},bottom:{x:0,y:-1,z:0}}[face]||{x:0,y:0,z:1};const walking=state.preview.anim==='walk'&&!state.preview.animPaused;let angle=0;if(walking){const swing=Math.sin(performance.now()*0.0045*state.preview.speed)*0.48;if(part.swingAxis==='arm')angle=part.name==='rightArm'?swing:-swing;if(part.swingAxis==='leg')angle=part.name==='rightLeg'?-swing:swing;}return svNorm(svRotateX(n,angle));}
function softwareProject(p,w,h){const yaw=state.preview.yaw*Math.PI/180,pitch=clamp(state.preview.pitch,-86,86)*Math.PI/180,target={x:0,y:state.preview.targetY||0,z:0};const distCam=60/Math.max(.65,state.preview.zoom),cp=Math.cos(pitch),sp=Math.sin(pitch);const camera={x:Math.sin(yaw)*cp*distCam,y:target.y+sp*distCam,z:Math.cos(yaw)*cp*distCam};const forward=svNorm(svSub(target,camera));let right=svNorm(svCross(forward,{x:0,y:1,z:0}));if(!Number.isFinite(right.x))right={x:1,y:0,z:0};const up=svNorm(svCross(right,forward));const rel=svSub(p,target);const scale=Math.min(w,h)/34*state.preview.zoom;return {x:w/2+svDot(rel,right)*scale+state.preview.offsetX,y:h/2-svDot(rel,up)*scale+state.preview.offsetY,depth:svDot(svSub(p,camera),forward),camera,up,right,forward};}
function drawSoftwareTexturedFace(ctx,info,w,h){const q=info.corners.map(p=>softwareProject(p,w,h));const toCamera=svNorm(svSub(q[0].camera,info.center));if(svDot(info.normal,toCamera)<=0.01)return null;const baseR=info.region;const ds=state.size/64;const r={...baseR,x:Math.round(baseR.x*ds),y:Math.round(baseR.y*ds),w:Math.max(1,Math.round(baseR.w*ds)),h:Math.max(1,Math.round(baseR.h*ds))};const tl=q[3],tr=q[2],bl=q[0],br=q[1];const a=(tr.x-tl.x)/r.w,b=(tr.y-tl.y)/r.w,c=(bl.x-tl.x)/r.h,d=(bl.y-tl.y)/r.h;ctx.save();ctx.beginPath();ctx.moveTo(q[0].x,q[0].y);ctx.lineTo(q[1].x,q[1].y);ctx.lineTo(q[2].x,q[2].y);ctx.lineTo(q[3].x,q[3].y);ctx.closePath();ctx.clip();ctx.imageSmoothingEnabled=false;ctx.setTransform(a,b,c,d,tl.x,tl.y);ctx.drawImage(imageCanvas,r.x,r.y,r.w,r.h,0,0,r.w,r.h);ctx.setTransform(1,0,0,1,0,0);const light={x:-.35,y:.8,z:.55};const n=svNorm(light);const ndl=Math.max(0,svDot(info.normal,n));const shade=.68+ndl*.32;ctx.fillStyle=`rgba(0,0,0,${Math.max(0,1-shade)})`;ctx.fillRect(-10,-10,r.w+20,r.h+20);ctx.restore();return {depth:q[0].depth};}
function drawSoftwarePreview(ctx,w,h){
  const bg=previewThemeColor();ctx.save();ctx.clearRect(0,0,w,h);ctx.fillStyle=`rgb(${Math.round(bg[0]*255)},${Math.round(bg[1]*255)},${Math.round(bg[2]*255)})`;ctx.fillRect(0,0,w,h);ctx.imageSmoothingEnabled=false;createTextureCanvas();const parts=buildPreviewParts();const faces=[];for(const part of parts){for(const face of ['back','left','bottom','right','top','front']){const base=part.base.data;faces.push({part,face,layer:'base',region:baseFaceRegion(part.name,face),corners:softwareFaceCorners(part,face,0),normal:softwareNormal(part,face),center:{x:part.center[0],y:part.center[1],z:part.center[2]}});if(state.outer){faces.push({part,face,layer:'outer',region:part.outer.data?baseFaceRegion(part.name,face,true):null,corners:softwareFaceCorners(part,face,.5),normal:softwareNormal(part,face),center:{x:part.center[0],y:part.center[1],z:part.center[2]}});}}
  }
  const valid=faces.filter(f=>f.region).map(f=>{const pr=softwareProject(f.center,w,h);return {...f,sortDepth:pr.depth};});valid.sort((a,b)=>b.sortDepth-a.sortDepth);for(const f of valid)drawSoftwareTexturedFace(ctx,f,w,h);ctx.restore();
}
function baseFaceRegion(name,face,outer=false){const map=outer?outerMap(state.model):logicalMap(state.model);return map.find(r=>r.part===name&&r.face===face)||null;}
function makePreviewRenderer(){
  const gl=miniGL;
  if(!gl){return {ready:!!miniCtx,webgl:false,setModel(){},setTexture(){},setOuter(){},render(){if(miniCtx){const s=resizeCanvas(els.miniPreviewCanvas);drawSoftwarePreview(miniCtx,s.w,s.h);}},fit(){const r=els.miniPreviewCanvas.getBoundingClientRect();state.preview.zoom=clamp(Math.min(r.width,r.height)/270,.72,1.15);state.preview.offsetX=0;state.preview.offsetY=0;this.render();},setCamera(kind){const presets={front:{yaw:0,pitch:0,targetY:0},back:{yaw:180,pitch:0,targetY:0},left:{yaw:-90,pitch:0,targetY:0},right:{yaw:90,pitch:0,targetY:0},top:{yaw:0,pitch:70,targetY:8},bottom:{yaw:0,pitch:-70,targetY:-9},reset:{yaw:-22,pitch:10,targetY:0}};if(kind==='fit'){this.fit();return;}const q=presets[kind]||presets.reset;Object.assign(state.preview,q);state.preview.offsetX=0;state.preview.offsetY=0;this.render();},start(){},stop(){}};}
  let program;try{program=createPreviewProgram(gl);}catch(err){console.warn('Preview shader failed',err);return {ready:false,webgl:false,setModel(){},setTexture(){},setOuter(){},render(){},fit(){},setCamera(){},start(){},stop(){}};}
  const posLoc=gl.getAttribLocation(program,'aPosition'),uvLoc=gl.getAttribLocation(program,'aUV'),nrmLoc=gl.getAttribLocation(program,'aNormal'),mvpLoc=gl.getUniformLocation(program,'uMVP'),modelLoc=gl.getUniformLocation(program,'uModel'),texLoc=gl.getUniformLocation(program,'uTexture');
  const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
  let parts=[];let textureDirty=true;let showOuter=true;let fitted=false;
  function rebuild(){parts=buildPreviewParts();for(const p of parts){p.baseBuffer=createPreviewBuffer(gl,p.base.data);p.outerBuffer=createPreviewBuffer(gl,p.outer.data);}fitted=false;}
  function uploadTexture(){gl.bindTexture(gl.TEXTURE_2D,texture);const arr=new Uint8Array(state.pixels);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,state.size,state.size,0,gl.RGBA,gl.UNSIGNED_BYTE,arr);textureDirty=false;}
  function resize(){return resizePreviewCanvas();}
  function render(){const r=resize();const {w,h}=r;gl.viewport(0,0,w,h);const bg=previewThemeColor();gl.clearColor(bg[0],bg[1],bg[2],0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);if(textureDirty)uploadTexture();if(!parts.length)rebuild();const fov=34*Math.PI/180,aspect=w/Math.max(1,h),proj=mat4Perspective(fov,aspect,0.1,200);const yaw=state.preview.yaw*Math.PI/180,pitch=clamp(state.preview.pitch,-86,86)*Math.PI/180;const target=[0,state.preview.targetY||0,0];const distCam=60/Math.max(.65,state.preview.zoom);const cp=Math.cos(pitch),sp=Math.sin(pitch);const camera=[Math.sin(yaw)*cp*distCam,target[1]+sp*distCam,Math.cos(yaw)*cp*distCam];const view=mat4LookAt(camera,target,[0,1,0]);const pv=mat4Multiply(proj,view);gl.useProgram(program);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.uniform1i(texLoc,0);gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(true);const t=performance.now();const walking=state.preview.anim==='walk'&&!state.preview.animPaused;const phase=t*0.0045*Math.max(.15,state.preview.speed);const swing=walking?Math.sin(phase)*0.48:0;
    for(const p of parts){let rx=0;if(p.swingAxis==='arm')rx=p.name==='rightArm'?swing:-swing;if(p.swingAxis==='leg')rx=p.name==='rightLeg'?-swing:swing;const T=mat4Translate(p.center[0],p.center[1],p.center[2]);const R1=mat4Translate(p.pivotOffset[0],p.pivotOffset[1],p.pivotOffset[2]);const R=mat4RotateX(rx);const R2=mat4Translate(-p.pivotOffset[0],-p.pivotOffset[1],-p.pivotOffset[2]);const model=mat4Multiply(T,mat4Multiply(R1,mat4Multiply(R,R2)));drawBuffer(p.baseBuffer,p.base,model,pv);if(showOuter)drawBuffer(p.outerBuffer,p.outer,model,pv);}
  }
  function drawBuffer(buffer,geom,model,pv){if(!buffer)return;gl.uniformMatrix4fv(mvpLoc,false,pv);gl.uniformMatrix4fv(modelLoc,false,model);gl.bindBuffer(gl.ARRAY_BUFFER,buffer.pos);gl.enableVertexAttribArray(posLoc);gl.vertexAttribPointer(posLoc,3,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ARRAY_BUFFER,buffer.uv);gl.enableVertexAttribArray(uvLoc);gl.vertexAttribPointer(uvLoc,2,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ARRAY_BUFFER,buffer.nrm);gl.enableVertexAttribArray(nrmLoc);gl.vertexAttribPointer(nrmLoc,3,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,buffer.idx);gl.drawElements(gl.TRIANGLES,buffer.count,gl.UNSIGNED_SHORT,0);}
  function setModel(){rebuild();render();}
  function setTexture(){textureDirty=true;}
  function setOuter(v){showOuter=v;render();}
  function fit(){const r=resize();state.preview.zoom=clamp(Math.min(r.cssW,r.cssH)/270,.72,1.15);state.preview.offsetX=0;state.preview.offsetY=0;render();}
  function setCamera(kind){const presets={front:{yaw:0,pitch:0,targetY:0},back:{yaw:180,pitch:0,targetY:0},left:{yaw:-90,pitch:0,targetY:0},right:{yaw:90,pitch:0,targetY:0},top:{yaw:0,pitch:70,targetY:8},bottom:{yaw:0,pitch:-70,targetY:-9},reset:{yaw:-22,pitch:10,targetY:0}};if(kind==='fit'){fit();return;}const p=presets[kind]||presets.reset;state.preview.yaw=p.yaw;state.preview.pitch=p.pitch;state.preview.targetY=p.targetY;state.preview.offsetX=0;state.preview.offsetY=0;render();}
  rebuild();
  return {ready:true,webgl:true,setModel,setTexture,setOuter,render,fit,setCamera};
}
const previewRenderer=makePreviewRenderer();
function scheduleCharacterFrame(){previewRenderer.setTexture();previewRenderer.render();}
function render3D(){previewRenderer.render();const walking=state.preview.anim==='walk'&&!state.preview.animPaused;els.previewStatus.textContent=walking?'WALKING':'LIVE';els.previewStatus.classList.toggle('warning',walking&&state.preview.autoPerformance);}
function stopAnimationLoop(){if(charFrameHandle){cancelAnimationFrame(charFrameHandle);charFrameHandle=0;}}
function startAnimationLoop(){if(charFrameHandle)return;lastAnimDraw=0;charFrameHandle=requestAnimationFrame(animateLoop);}
function animateLoop(ts){if(state.preview.anim!=='walk'||state.preview.animPaused){charFrameHandle=0;render3D();return;}charFrameHandle=requestAnimationFrame(animateLoop);const targetFps=state.preview.autoPerformance?(navigator.hardwareConcurrency&&navigator.hardwareConcurrency<=4?24:30):60;const interval=1000/targetFps;if(ts-lastAnimDraw<interval)return;lastAnimDraw=ts;previewRenderer.render();}
function setAnimation(kind){state.preview.anim=kind;state.preview.animPaused=kind==='idle';els.idleBtn.classList.toggle('active',kind==='idle');els.walkBtn.classList.toggle('active',kind==='walk');els.pauseAnimBtn.textContent=state.preview.animPaused?'Resume':'Pause';els.walkToggleBtn.textContent=kind==='walk'&&!state.preview.animPaused?'⏸ Walk':'▶ Walk';if(kind==='walk'&&!state.preview.animPaused)startAnimationLoop();else stopAnimationLoop();previewRenderer.render();}
function toggleWalk(){if(state.preview.anim==='walk'&&!state.preview.animPaused){state.preview.animPaused=true;stopAnimationLoop();}else{state.preview.anim='walk';state.preview.animPaused=false;startAnimationLoop();}els.idleBtn.classList.toggle('active',state.preview.anim==='idle');els.walkBtn.classList.toggle('active',state.preview.anim==='walk');els.pauseAnimBtn.textContent=state.preview.anim==='idle'?'Paused':(state.preview.animPaused?'Resume':'Pause');els.pauseAnimBtn.disabled=state.preview.anim==='idle';els.walkToggleBtn.textContent=state.preview.anim==='walk'&&!state.preview.animPaused?'⏸ Walk':'▶ Walk';previewRenderer.render();}
function setPresetCamera(kind){previewRenderer.setCamera(kind);}
const previewPointers=new Map();let previewGesture=null;
function bindPreviewCameraGestures(){if(!els.miniPreviewCanvas)return;els.miniPreviewCanvas.addEventListener('pointerdown',e=>{e.preventDefault();previewPointers.set(e.pointerId,{x:e.clientX,y:e.clientY});els.miniPreviewCanvas.setPointerCapture?.(e.pointerId);const pts=[...previewPointers.values()];if(pts.length>=2){const a=pts[0],b=pts[1];previewGesture={mode:'pinch',startMid:midpoint(a,b),startDist:dist(a,b),startYaw:state.preview.yaw,startPitch:state.preview.pitch,startScale:state.preview.zoom};}else previewGesture={mode:'orbit',startX:e.clientX,startY:e.clientY,startYaw:state.preview.yaw,startPitch:state.preview.pitch};},{passive:false});els.miniPreviewCanvas.addEventListener('pointermove',e=>{if(!previewPointers.has(e.pointerId))return;e.preventDefault();previewPointers.set(e.pointerId,{x:e.clientX,y:e.clientY});const pts=[...previewPointers.values()];if(pts.length>=2){const a=pts[0],b=pts[1],g=previewGesture||{};const m=midpoint(a,b),d=dist(a,b);if(g.mode!=='pinch'){previewGesture={mode:'pinch',startMid:m,startDist:d,startYaw:state.preview.yaw,startPitch:state.preview.pitch,startScale:state.preview.zoom};return;}state.preview.zoom=clamp(g.startScale*(d/Math.max(1,g.startDist)),.65,1.8);state.preview.yaw=g.startYaw+(m.x-g.startMid.x)*.55;state.preview.pitch=clamp(g.startPitch+(m.y-g.startMid.y)*.42,-82,82);previewRenderer.render();return;}if(!previewGesture||previewGesture.mode!=='orbit')return;state.preview.yaw=previewGesture.startYaw+(e.clientX-previewGesture.startX)*.55;state.preview.pitch=clamp(previewGesture.startPitch+(e.clientY-previewGesture.startY)*.42,-82,82);previewRenderer.render();},{passive:false});const end=e=>{previewPointers.delete(e.pointerId);if(previewPointers.size===0)previewGesture=null;try{els.miniPreviewCanvas.releasePointerCapture?.(e.pointerId);}catch{}};els.miniPreviewCanvas.addEventListener('pointerup',end);els.miniPreviewCanvas.addEventListener('pointercancel',end);els.miniPreviewCanvas.addEventListener('wheel',e=>{e.preventDefault();state.preview.zoom=clamp(state.preview.zoom*(e.deltaY<0?1.1:.9),.65,1.8);previewRenderer.render();},{passive:false});els.miniPreviewCanvas.addEventListener('dblclick',()=>setPresetCamera('reset'));}
function updateModel(model){state.model=model;previewRenderer.setModel();syncSelectors();pushHistory();renderAll();toast(`Model: ${model==='classic'?'Classic / Steve · 4px arms':'Slim / Alex · 3px arms'}`);}
function syncSelectors(){els.modelSelect.value=state.model;els.textureSizeSelect.value=[64,128].includes(state.size)?String(state.size):'custom';els.docSize.textContent=`${state.size}×${state.size}`;els.canvasResolutionLabel && (els.canvasResolutionLabel.textContent=`${state.size}×${state.size}`);}
function changeTextureSize(size){size=Number(size);if(!Number.isFinite(size))return;const old=state.size;const oldPixels=state.pixels;const newPixels=new Uint8ClampedArray(size*size*4);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const sx=Math.floor(x/size*old),sy=Math.floor(y/size*old);const si=(sy*old+sx)*4,di=(y*size+x)*4;newPixels[di]=oldPixels[si];newPixels[di+1]=oldPixels[si+1];newPixels[di+2]=oldPixels[si+2];newPixels[di+3]=oldPixels[si+3];}state.size=size;state.pixels=newPixels;state.title=`${size}×${size} Skin`;pushHistory();syncSelectors();fitEditorView();renderAll();toast(`Texture changed to ${size}×${size}`);}

function loadImageAsSkin(file,allowCustom=true){
  const img=new Image();const url=URL.createObjectURL(file);img.onload=()=>{URL.revokeObjectURL(url);const size=img.naturalWidth;if(img.naturalWidth!==img.naturalHeight){toast('Skin texture must be square. Image kept as a reference instead.','warn');loadReferenceObject(img);return;}if(size<MIN_TEX||size>MAX_TEX){toast(`Texture size must be between ${MIN_TEX} and ${MAX_TEX}.`, 'warn');loadReferenceObject(img);return;}const c=document.createElement('canvas');c.width=size;c.height=size;const cx=c.getContext('2d',{willReadFrequently:true});cx.imageSmoothingEnabled=false;cx.drawImage(img,0,0);const data=cx.getImageData(0,0,size,size).data;state.size=size;state.pixels=new Uint8ClampedArray(data);state.title=file.name.replace(/\.[^.]+$/,'');state.reference=null;state.referenceVisible=false;syncSelectors();pushHistory();fitEditorView();previewRenderer.setTexture();renderAll();toast(`Loaded ${size}×${size} skin automatically.`);};img.onerror=()=>{URL.revokeObjectURL(url);toast('Could not read that image.','warn');};img.src=url;}
function loadReferenceObject(img){state.reference=img;state.referenceVisible=true;els.referenceToggle.checked=true;els.referenceToggle.dispatchEvent(new Event('change'));}
function loadReference(file){const img=new Image();const url=URL.createObjectURL(file);img.onload=()=>{URL.revokeObjectURL(url);loadReferenceObject(img);toast('Reference image loaded. It will not alter the skin until you paint.');};img.onerror=()=>{URL.revokeObjectURL(url);toast('Reference image could not be read.','warn');};img.src=url;}
function createTextureDataFromFile(file,callback){const img=new Image();const url=URL.createObjectURL(file);img.onload=()=>{URL.revokeObjectURL(url);callback(img);};img.onerror=()=>{URL.revokeObjectURL(url);toast('Could not load image.','warn');};img.src=url;}

function exportPNG(){const c=document.createElement('canvas');c.width=state.size;c.height=state.size;const cctx=c.getContext('2d');cctx.putImageData(new ImageData(new Uint8ClampedArray(state.pixels),state.size,state.size),0,0);c.toBlob(blob=>{if(!blob)return;const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${state.title||'nova-skin'}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast('PNG exported.');},'image/png');}
function saveLibrary(){const key='nova-library-v2';let list=[];try{list=JSON.parse(localStorage.getItem(key)||'[]');}catch{}const thumb=document.createElement('canvas');thumb.width=64;thumb.height=64;const tc=thumb.getContext('2d');tc.imageSmoothingEnabled=false;tc.drawImage(imageCanvas,0,0,64,64);const item={id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),name:state.title||'Untitled skin',size:state.size,model:state.model,data:thumb.toDataURL('image/png'),pixels:Array.from(state.pixels)};list=[item,...list].slice(0,24);localStorage.setItem(key,JSON.stringify(list));renderLibrary();toast('Saved to My skins.');}
function renderLibrary(){let list=[];try{list=JSON.parse(localStorage.getItem('nova-library-v2')||'[]');}catch{}els.libraryList.innerHTML='';if(!list.length){els.libraryList.innerHTML='<div class="library-empty">No saved skins yet.</div>';return;}for(const item of list){const b=document.createElement('button');b.className='library-item';b.innerHTML=`<img src="${item.data}" alt=""><span>${escapeHtml(item.name)}</span><small>${item.size}×${item.size} · ${item.model}</small>`;b.addEventListener('click',()=>{state.size=item.size;state.model=item.model;state.pixels=new Uint8ClampedArray(item.pixels);state.title=item.name;previewRenderer.setModel();previewRenderer.setTexture();syncSelectors();pushHistory();fitEditorView();renderAll();toast('Loaded from My skins.');});els.libraryList.appendChild(b);}}
function escapeHtml(s){return String(s).replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));}

function applyTemplate(kind){
  const src=kind==='classic'?'assets/complete-classic-template.png':kind==='slim'?'assets/complete-slim-template.png':'assets/demo-128.png';const img=new Image();img.onload=()=>{const size=img.naturalWidth;const c=document.createElement('canvas');c.width=size;c.height=size;c.getContext('2d').drawImage(img,0,0);state.size=size;state.pixels=new Uint8ClampedArray(c.getContext('2d').getImageData(0,0,size,size).data);state.model=kind==='slim'?'slim':'classic';state.title=kind==='classic'?'Complete Classic Starter':kind==='slim'?'Complete Slim Starter':'128×128 Demo';syncSelectors();pushHistory();fitEditorView();previewRenderer.setModel();previewRenderer.setTexture();renderAll();els.templateModal.hidden=true;toast('Starter template loaded.');};img.src=src;}

function renderChecks(){const standard=[64,128].includes(state.size);const custom=state.size>128;const textureOk=state.size>=64&&state.size<=1024&&state.size===Math.round(state.size)&&state.pixels.length===state.size*state.size*4;const previewOk=!!previewRenderer?.ready;const items=[[standard,'Standard Bedrock texture size'],[custom,'Advanced custom texture size'],[textureOk,'Texture buffer valid'],[alphaPixels()>0,'Texture contains pixels'],[state.historyIndex>=0,'Undo history ready'],[previewOk,'Character preview renderer ready']];els.checks.innerHTML=items.map(([ok,t])=>`<div class="check ${ok?'ok':'warn'}"><span class="check-icon">${ok?'✓':'!'}</span><span>${t}</span></div>`).join('');}
function renderAll(){renderSwatches();renderEditor();previewRenderer.setTexture();previewRenderer.setOuter(state.outer);render3D();renderChecks();renderLibrary();updateHistoryButtons();updateControlLabels();syncSelectors();}

function setDocumentTitleStatus(msg){els.docStatus.textContent=msg;}

function persistAutosave(){try{const payload={version:APP_VERSION,size:state.size,model:state.model,tool:state.tool,layer:state.layer,title:state.title,pixels:Array.from(state.pixels),focus:state.focus,locks:state.locks};localStorage.setItem('nova-autosave-v3',JSON.stringify(payload));}catch(e){/* storage may be unavailable */}}
function loadAutosave(){try{const raw=localStorage.getItem('nova-autosave-v3');if(!raw)return false;const d=JSON.parse(raw);if(!d.pixels||!d.size)return false;state.size=d.size;state.model=d.model||'classic';state.pixels=new Uint8ClampedArray(d.pixels);state.title=d.title||'Recovered Skin';state.focus=d.focus||state.focus;state.locks={...state.locks,...(d.locks||{})};focusBounds=state.focus.part&&state.focus.face?getFocusRegion(state.focus.part,state.focus.face,'base'):null;syncSelectors();els.focusLockBtn.textContent=state.focus.locked?'🔒 Unlock':'🔓 Lock';els.focusMeta.hidden=!state.focus.part;if(state.focus.part&&state.focus.face)els.focusStatus.textContent=`${PART_LABELS[state.focus.part]} · ${FACE_LABELS[state.focus.face]}`;pushHistory();fitEditorView();previewRenderer.setModel();previewRenderer.setTexture();renderAll();toast('Recovered your last autosaved skin.');return true;}catch{return false;}}

function setupEvents(){
  let savedTheme='midnight'; try{savedTheme=localStorage.getItem('nova-theme')||'midnight';}catch{} els.themeSelect.value=savedTheme;themeSet(els.themeSelect.value);els.themeSelect.addEventListener('change',()=>{themeSet(els.themeSelect.value);previewRenderer.render();});
  els.toolGrid.addEventListener('click',e=>{const b=e.target.closest('[data-tool]');if(b)setTool(b.dataset.tool);});
  els.layerGrid.addEventListener('click',e=>{const b=e.target.closest('[data-layer]');if(b)setLayer(b.dataset.layer);});
  els.brushSize.addEventListener('input',updateControlLabels);els.brushOpacity.addEventListener('input',()=>{state.toolOpacity=Number(els.brushOpacity.value);updateControlLabels();});els.brushShape.addEventListener('change',()=>state.brushShape=els.brushShape.value);els.pixelPerfect.addEventListener('change',()=>state.pixelPerfect=els.pixelPerfect.checked);els.shadeMode.addEventListener('change',()=>state.shadeMode=els.shadeMode.value);els.replaceTolerance.addEventListener('input',()=>{state.replaceTolerance=Number(els.replaceTolerance.value);updateControlLabels();});els.mirrorToggle.addEventListener('change',()=>state.mirror=els.mirrorToggle.checked);
  els.gridToggle.addEventListener('change',()=>{state.grid=els.gridToggle.checked;renderEditor();});els.checkerToggle.addEventListener('change',()=>{state.checker=els.checkerToggle.checked;renderEditor();});els.outerToggle.addEventListener('change',()=>{state.outer=els.outerToggle.checked;previewRenderer.setOuter(state.outer);});
  els.zoomInBtn.addEventListener('click',()=>setEditorZoom(editorView.pixelSize*1.25));els.zoomOutBtn.addEventListener('click',()=>setEditorZoom(editorView.pixelSize*.8));els.fitBtn.addEventListener('click',fitEditorView);els.centerBtn.addEventListener('click',centerEditorView);els.resetViewBtn.addEventListener('click',()=>{fitEditorView();toast('View reset.');});
  els.focusBtn.addEventListener('click',openFocusModal);els.focusLockBtn.addEventListener('click',toggleFocusLock);els.focusApplyBtn.addEventListener('click',applyFocus);
  els.layerLockBase.addEventListener('click',()=>toggleLock('base'));els.layerLockOuter.addEventListener('click',()=>toggleLock('outer'));
  els.colorInput.addEventListener('input',()=>setColor(els.colorInput.value));els.hexInput.addEventListener('change',()=>setColor(els.hexInput.value));els.clearRecentBtn.addEventListener('click',()=>{state.recentColors=[];renderSwatches();});
  els.undoBtn.addEventListener('click',undo);els.redoBtn.addEventListener('click',redo);window.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo();}});
  els.editorCanvas.addEventListener('pointerdown',handleEditorPointerDown);els.editorCanvas.addEventListener('pointermove',handleEditorPointerMove);els.editorCanvas.addEventListener('pointerup',handleEditorPointerUp);els.editorCanvas.addEventListener('pointercancel',handleEditorPointerUp);els.editorCanvas.addEventListener('wheel',handleEditorWheel,{passive:false});
  els.skinFileInput.addEventListener('change',e=>{const f=e.target.files?.[0];if(f)loadImageAsSkin(f,true);e.target.value='';});els.importBtn.addEventListener('click',()=>els.skinFileInput.click());els.heroUploadBtn.addEventListener('click',()=>els.skinFileInput.click());
  els.customTextureBtn.addEventListener('click',()=>els.customTextureInput.click());els.customTextureInput.addEventListener('change',e=>{const f=e.target.files?.[0];if(f)loadImageAsSkin(f,true);e.target.value='';});
  els.referenceBtn.addEventListener('click',()=>els.referenceFileInput.click());els.referenceFileInput.addEventListener('change',e=>{const f=e.target.files?.[0];if(f)loadReference(f);e.target.value='';});els.referenceToggle.addEventListener('change',()=>{state.referenceVisible=els.referenceToggle.checked;renderEditor();});els.referenceOpacity.addEventListener('input',()=>{state.referenceOpacity=Number(els.referenceOpacity.value)/100;updateControlLabels();renderEditor();});els.clearReferenceBtn.addEventListener('click',()=>{state.reference=null;state.referenceVisible=false;els.referenceToggle.checked=false;renderEditor();});
  els.geometryBtn.addEventListener('click',()=>els.geometryFileInput.click());els.geometryFileInput.addEventListener('change',e=>{const f=e.target.files?.[0];if(!f)return;const reader=new FileReader();reader.onload=()=>{try{state.customGeometry=JSON.parse(reader.result);state.geometryBytes=f.size;els.geometryStatus.textContent=`Geometry loaded: ${f.name} · ${f.size.toLocaleString()} bytes. Preview remains experimental.`;toast('Geometry JSON loaded.');}catch{toast('That geometry file is not valid JSON.','warn');}};reader.readAsText(f);e.target.value='';});
  els.modelSelect.addEventListener('change',()=>updateModel(els.modelSelect.value));els.textureSizeSelect.addEventListener('change',()=>{if(els.textureSizeSelect.value==='custom'){toast('Use Upload custom texture for advanced resolutions.','warn');els.textureSizeSelect.value=String([64,128].includes(state.size)?state.size:'custom');return;}changeTextureSize(Number(els.textureSizeSelect.value));});
  els.previewCameraButtons.forEach(b=>b.addEventListener('click',()=>setPresetCamera(b.dataset.camera)));els.walkToggleBtn.addEventListener('click',toggleWalk);els.idleBtn.addEventListener('click',()=>setAnimation('idle'));els.walkBtn.addEventListener('click',()=>setAnimation('walk'));els.pauseAnimBtn.addEventListener('click',()=>{state.preview.animPaused=!state.preview.animPaused;setAnimation(state.preview.anim);});els.animSpeed.addEventListener('input',()=>{state.preview.speed=Number(els.animSpeed.value);updateControlLabels();});els.autoPerformance.addEventListener('change',()=>state.preview.autoPerformance=els.autoPerformance.checked);
  els.newBtn.addEventListener('click',()=>els.newModal.hidden=false);els.confirmNewBtn.addEventListener('click',()=>{createBlankTexture(Number(els.newSize.value));state.model=els.newModel.value;state.title='Untitled Skin';state.history=[];state.historyIndex=-1;pushHistory();syncSelectors();fitEditorView();renderAll();els.newModal.hidden=true;toast('New skin created.');});
  els.templateBtn.addEventListener('click',()=>els.templateModal.hidden=false);els.heroTemplateBtn.addEventListener('click',()=>els.templateModal.hidden=false);els.templateCards.forEach(b=>b.addEventListener('click',()=>applyTemplate(b.dataset.template)));
  els.exportBtn.addEventListener('click',exportPNG);els.saveLibraryBtn.addEventListener('click',saveLibrary);
  els.guideBtn.addEventListener('click',()=>els.guideModal.hidden=false);document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.close).hidden=true));document.querySelectorAll('.modal-backdrop').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)m.hidden=true;}));
  els.gridBtn.addEventListener('click',()=>{state.grid=!state.grid;els.gridToggle.checked=state.grid;renderEditor();});els.checkerBtn.addEventListener('click',()=>{state.checker=!state.checker;els.checkerToggle.checked=state.checker;renderEditor();});
  window.addEventListener('resize',()=>{fitEditorView();previewRenderer.fit();});
  bindPreviewCameraGestures();window.addEventListener('beforeunload',persistAutosave);setInterval(persistAutosave,5000);
}

function bootstrap(){
  state.mode='2d';state.toolOpacity=100;state.brushSize=1;els.brushOpacity.value=100;els.brushSize.value=1;els.brushShape.value='square';els.pixelPerfect.checked=true;
  renderFocusModal();createBlankTexture(64);state.history=[];state.historyIndex=-1;pushHistory();syncSelectors();fitEditorView();previewRenderer.fit();renderSwatches();renderChecks();renderLibrary();updateControlLabels();setTool('pencil');setLayer('both');
  const recovered=loadAutosave();
  if(!recovered){fitEditorView();renderAll();}
}

setupEvents();bootstrap();
