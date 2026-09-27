'use strict';

const APP_VERSION = '0.8.0';
const MIN_TEX = 64;
const MAX_TEX = 1024;
const HISTORY_LIMIT = 80;
const DEFAULT_COLOR = '#7FD7FF';
const DPR_CAP = 2;

const $ = (id) => document.getElementById(id);
const els = {
  html: document.documentElement,
  editorCanvas: $('editorCanvas'),
  characterCanvas: $('characterCanvas'),
  miniPreviewCanvas: $('miniPreviewCanvas'),
  canvasWrap: $('stageWrap'),
  canvasPane: $('canvasPane'),
  characterPane: $('characterPane'),
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
  modeButtons: [...document.querySelectorAll('.mode-btn')],
  cameraSwitch: $('cameraSwitch'),
  cameraModeButtons: [...document.querySelectorAll('.camera-mode-btn')],
  characterFaceReadout: $('characterFaceReadout'),
  characterBadge: $('characterBadge'),
  characterModeLabel: $('characterModeLabel'),
  characterResolutionLabel: $('characterResolutionLabel'),
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
const charCtx = els.characterCanvas.getContext('2d', { alpha: false });
const miniCtx = els.miniPreviewCanvas.getContext('2d', { alpha: false });
editorCtx.imageSmoothingEnabled = false;
charCtx.imageSmoothingEnabled = false;
miniCtx.imageSmoothingEnabled = false;

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
  head: 'Head', body: 'Body', rightArm: 'Right Arm', leftArm: 'Left Arm', rightLeg: 'Right Leg', leftLeg: 'Left Leg'
};
const FACE_LABELS = { front: 'Front', back: 'Back', left: 'Left', right: 'Right', top: 'Top', bottom: 'Bottom' };
const FACE_ORDER = ['front', 'back', 'left', 'right', 'top', 'bottom'];

const state = {
  size: 64,
  model: 'classic',
  mode: '2d',
  cameraMode: 'paint',
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
    scale: 5.2,
    offsetX: 0,
    offsetY: 2,
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
  const armW=model==='slim'?3:4;
  return [
    standardRegion('head','top',8,0,8,8), standardRegion('head','bottom',16,0,8,8), standardRegion('head','left',0,8,8,8), standardRegion('head','front',8,8,8,8), standardRegion('head','right',16,8,8,8), standardRegion('head','back',24,8,8,8),
    standardRegion('body','top',20,16,8,4), standardRegion('body','bottom',28,16,8,4), standardRegion('body','left',16,20,4,12), standardRegion('body','front',20,20,8,12), standardRegion('body','right',28,20,4,12), standardRegion('body','back',32,20,8,12),
    standardRegion('rightArm','top',44,16,armW,4), standardRegion('rightArm','bottom',48,16,armW,4), standardRegion('rightArm','left',40,20,4,12), standardRegion('rightArm','front',44,20,armW,12), standardRegion('rightArm','right',48,20,4,12), standardRegion('rightArm','back',52,20,armW,12),
    standardRegion('leftArm','top',36,48,armW,4), standardRegion('leftArm','bottom',40,48,armW,4), standardRegion('leftArm','left',32,52,4,12), standardRegion('leftArm','front',36,52,armW,12), standardRegion('leftArm','right',40,52,4,12), standardRegion('leftArm','back',44,52,armW,12),
    standardRegion('rightLeg','top',4,16,4,4), standardRegion('rightLeg','bottom',8,16,4,4), standardRegion('rightLeg','left',0,20,4,12), standardRegion('rightLeg','front',4,20,4,12), standardRegion('rightLeg','right',8,20,4,12), standardRegion('rightLeg','back',12,20,4,12),
    standardRegion('leftLeg','top',20,48,4,4), standardRegion('leftLeg','bottom',24,48,4,4), standardRegion('leftLeg','left',16,52,4,12), standardRegion('leftLeg','front',20,52,4,12), standardRegion('leftLeg','right',24,52,4,12), standardRegion('leftLeg','back',28,52,4,12),
  ];
}

function outerMap(model='classic') {
  const armW=model==='slim'?3:4;
  return [
    standardRegion('head','top',40,0,8,8,'outer'), standardRegion('head','bottom',48,0,8,8,'outer'), standardRegion('head','left',32,8,8,8,'outer'), standardRegion('head','front',40,8,8,8,'outer'), standardRegion('head','right',48,8,8,8,'outer'), standardRegion('head','back',56,8,8,8,'outer'),
    standardRegion('body','top',20,32,8,4,'outer'), standardRegion('body','bottom',28,32,8,4,'outer'), standardRegion('body','left',16,36,4,12,'outer'), standardRegion('body','front',20,36,8,12,'outer'), standardRegion('body','right',28,36,4,12,'outer'), standardRegion('body','back',32,36,8,12,'outer'),
    standardRegion('rightArm','top',44,32,armW,4,'outer'), standardRegion('rightArm','bottom',48,32,armW,4,'outer'), standardRegion('rightArm','left',40,36,4,12,'outer'), standardRegion('rightArm','front',44,36,armW,12,'outer'), standardRegion('rightArm','right',48,36,4,12,'outer'), standardRegion('rightArm','back',52,36,armW,12,'outer'),
    standardRegion('leftArm','top',36,48,armW,4,'outer'), standardRegion('leftArm','bottom',40,48,armW,4,'outer'), standardRegion('leftArm','left',32,52,4,12,'outer'), standardRegion('leftArm','front',36,52,armW,12,'outer'), standardRegion('leftArm','right',40,52,4,12,'outer'), standardRegion('leftArm','back',44,52,armW,12,'outer'),
    standardRegion('rightLeg','top',4,32,4,4,'outer'), standardRegion('rightLeg','bottom',8,32,4,4,'outer'), standardRegion('rightLeg','left',0,36,4,12,'outer'), standardRegion('rightLeg','front',4,36,4,12,'outer'), standardRegion('rightLeg','right',8,36,4,12,'outer'), standardRegion('rightLeg','back',12,36,4,12,'outer'),
    standardRegion('leftLeg','top',20,48,4,4,'outer'), standardRegion('leftLeg','bottom',24,48,4,4,'outer'), standardRegion('leftLeg','left',16,52,4,12,'outer'), standardRegion('leftLeg','front',20,52,4,12,'outer'), standardRegion('leftLeg','right',24,52,4,12,'outer'), standardRegion('leftLeg','back',28,52,4,12,'outer'),
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
  const c=canvas===els.editorCanvas?editorCtx:canvas===els.characterCanvas?charCtx:miniCtx;
  c.imageSmoothingEnabled=false; c.setTransform(dpr,0,0,dpr,0,0);
  return {w:rect.width,h:rect.height,dpr};
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
function restoreSnapshot(snap){ if(!snap)return;state.size=snap.size;state.model=snap.model;state.pixels=new Uint8ClampedArray(snap.pixels); syncSelectors();rebuildTextureCanvas();fitEditorView();render3D(true);renderChecks(); }
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
  if(state.tool==='picker'){setColor('#'+rgbaToHex(...getPixel(x,y).slice(0,3))); state.tool='pencil';updateToolUI();return;}
  if(state.tool==='fill'){if(!state.drawing)beginStroke();floodFill(x,y);renderEditor();finishStroke();return;}
  if(state.tool==='replace'){if(!state.drawing)beginStroke();replaceColors(getPixel(x,y));renderEditor();finishStroke();return;}
  if(state.tool==='line'||state.tool==='rect'||state.tool==='circle'){ if(!state.shapeStart){state.shapeStart={x,y}; if(!state.drawing)beginStroke();} else { const sx=state.shapeStart.x,sy=state.shapeStart.y; drawPreviewShape(sx,sy,x,y); } return; }
  if(!state.drawing)beginStroke();
  stampBrush(x,y);renderEditor();syncMiniPreview();scheduleCharacterFrame();
}
function drawPreviewShape(x0,y0,x1,y1){
  if(!state.strokeSnapshot)return;state.pixels=new Uint8ClampedArray(state.strokeSnapshot.pixels);let pts=[];
  if(state.tool==='line')pts=linePoints(x0,y0,x1,y1);
  else if(state.tool==='rect'){for(let x=Math.min(x0,x1);x<=Math.max(x0,x1);x++){pts.push([x,y0],[x,y1]);}for(let y=Math.min(y0,y1);y<=Math.max(y0,y1);y++){pts.push([x0,y],[x1,y]);}}
  else pts=ellipsePoints(x0,y0,x1,y1);
  drawShapePoints(pts);state.tempShape={x0,y0,x1,y1};renderEditor();scheduleCharacterFrame();
}

function handleEditorPointerDown(ev){
  ev.preventDefault();
  const rect=els.editorCanvas.getBoundingClientRect();const pt={x:ev.clientX,y:ev.clientY};state.pointerMap.set(ev.pointerId,pt);els.editorCanvas.setPointerCapture(ev.pointerId);
  if(state.pointerMap.size>=2){
    cancelPendingSingle(); beginTouchGesture(); return;
  }
  if(ev.pointerType==='touch') state.pendingPointer={id:ev.pointerId,startedAt:now()};
  const tex=screenToTex(ev.clientX,ev.clientY); updateCursorReadout(tex.x,tex.y);paintAt(tex.x,tex.y);
}
function handleEditorPointerMove(ev){
  if(!state.pointerMap.has(ev.pointerId))return; state.pointerMap.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});
  if(state.gesture){updateTouchGesture();return;}
  const tex=screenToTex(ev.clientX,ev.clientY);updateCursorReadout(tex.x,tex.y);
  if(state.drawing && !['fill','replace','picker'].includes(state.tool)){
    if(state.shapeStart && ['line','rect','circle'].includes(state.tool)) drawPreviewShape(state.shapeStart.x,state.shapeStart.y,tex.x,tex.y);
    else { stampBrush(tex.x,tex.y);renderEditor();scheduleCharacterFrame(); }
  }
}
function handleEditorPointerUp(ev){ state.pointerMap.delete(ev.pointerId);try{els.editorCanvas.releasePointerCapture(ev.pointerId);}catch{} if(state.gesture){ if(state.pointerMap.size<2)state.gesture=null; return; } if(['line','rect','circle'].includes(state.tool)&&state.shapeStart){ finishStroke(); } else finishStroke(); state.pendingPointer=null; }
function handleEditorWheel(ev){ ev.preventDefault();const rect=els.editorCanvas.getBoundingClientRect();const cx=ev.clientX-rect.left,cy=ev.clientY-rect.top;setEditorZoom(editorView.pixelSize*(ev.deltaY<0?1.15:.87),cx,cy); }
function beginTouchGesture(){
  const pts=[...state.pointerMap.values()];if(pts.length<2)return;const a=pts[0],b=pts[1],m=midpoint(a,b);state.gesture={startMid:m,startDist:dist(a,b),startZoom:editorView.pixelSize,startX:editorView.x,startY:editorView.y,rect:els.editorCanvas.getBoundingClientRect()};
  if(state.drawing){state.pixels=state.strokeSnapshot?new Uint8ClampedArray(state.strokeSnapshot.pixels):state.pixels;state.drawing=false;state.strokeSnapshot=null;state.shapeStart=null;renderEditor();}
}
function updateTouchGesture(){const pts=[...state.pointerMap.values()];if(pts.length<2||!state.gesture)return;const a=pts[0],b=pts[1],m=midpoint(a,b),g=state.gesture;const scale=dist(a,b)/Math.max(1,g.startDist);const nextZoom=clamp(g.startZoom*scale,1,40);const localStartX=g.startMid.x-g.rect.left,localStartY=g.startMid.y-g.rect.top;const localNowX=m.x-g.rect.left,localNowY=m.y-g.rect.top;const tx=(localStartX-g.startX)/g.startZoom,ty=(localStartY-g.startY)/g.startZoom;editorView.pixelSize=nextZoom;editorView.x=localNowX-tx*nextZoom;editorView.y=localNowY-ty*nextZoom;renderEditor();}
function cancelPendingSingle(){state.pendingPointer=null;}

function focusOn(part,face,lock=false){
  const r=getFocusRegion(part,face,'both')||getFocusRegion(part,'front','both');if(!r)return;
  state.focus.part=part;state.focus.face=face||'front';state.focus.locked=lock;focusBounds=r;
  const rect=els.editorCanvas.getBoundingClientRect();const pad=80;const z=clamp(Math.floor(Math.min((rect.width-pad*2)/Math.max(1,r.w),(rect.height-pad*2)/Math.max(1,r.h))),2,40);editorView.pixelSize=z;const dw=state.size*z;editorView.x=(rect.width-dw)/2 - (r.x+r.w/2-state.size/2)*z;editorView.y=(rect.height-dw)/2 - (r.y+r.h/2-state.size/2)*z;
  els.focusStatus.textContent=`${PART_LABELS[part]} · ${FACE_LABELS[state.focus.face]}`;els.focusLockBtn.textContent=state.focus.locked?'🔒 Unlock':'🔓 Lock';els.focusMeta.hidden=false;els.focusMeta.textContent=`· ${PART_LABELS[part]} / ${FACE_LABELS[state.focus.face]}`;renderEditor();renderFocusModalState();
  // Align the 3D camera toward the selected face.
  setCameraForFace(face);
}
function toggleFocusLock(){if(!state.focus.part){toast('Choose a focus area first.');return;}state.focus.locked=!state.focus.locked;els.focusLockBtn.textContent=state.focus.locked?'🔒 Unlock':'🔓 Lock';toast(state.focus.locked?'Focus locked':'Focus unlocked');}
function renderFocusModal(){
  els.focusPartGrid.innerHTML=Object.entries(PART_LABELS).map(([key,label])=>`<button class="focus-part-btn" data-part="${key}">${label}</button>`).join('');els.focusPartGrid.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{state._focusPart=b.dataset.part;renderFocusModalState();}));
  els.focusFaceGrid.innerHTML=FACE_ORDER.map(face=>`<button class="focus-face-btn" data-face="${face}">${FACE_LABELS[face]}</button>`).join('');els.focusFaceGrid.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{if(!state._focusPart){toast('Choose a body part first.');return;}state._focusFace=b.dataset.face;renderFocusModalState();}));
}
function renderFocusModalState(){els.focusPartGrid.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.part===state._focusPart));els.focusFaceGrid.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.face===state._focusFace));els.focusModalStatus.textContent=state._focusPart&&state._focusFace?`${PART_LABELS[state._focusPart]} · ${FACE_LABELS[state._focusFace]}`:'Choose a part, then a face.';}
function openFocusModal(){state._focusPart=state.focus.part||'head';state._focusFace=state.focus.face||'front';renderFocusModalState();els.focusModal.hidden=false;}
function applyFocus(){if(state._focusPart&&state._focusFace){focusOn(state._focusPart,state._focusFace,state.focus.locked);els.focusModal.hidden=true;}}

function setMode(mode){state.mode=mode;els.modeButtons.forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));els.canvasPane.hidden=mode!=='2d';els.canvasPane.classList.toggle('active',mode==='2d');els.characterPane.hidden=mode!=='3d';els.characterPane.classList.toggle('active',mode==='3d');els.cameraSwitch.hidden=mode!=='3d';els.gestureHint.textContent=mode==='2d'?'1 finger paints · 2 fingers pan/zoom':(state.cameraMode==='paint'?'Tap/drag paints · 2 fingers camera':'Drag to orbit · 2 fingers pan/zoom');if(mode==='3d')render3D(true); else renderEditor();}
function setCameraMode(mode){state.cameraMode=mode;els.cameraModeButtons.forEach(b=>b.classList.toggle('active',b.dataset.cameraMode===mode));els.gestureHint.textContent=state.mode==='3d'?(mode==='paint'?'Tap/drag paints · 2 fingers camera':'Drag to orbit · 2 fingers pan/zoom'):'1 finger paints · 2 fingers pan/zoom';}
function setTool(tool){state.tool=tool;els.toolGrid.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===tool));const info=TOOL_INFO[tool];els.toolHelpTitle.textContent=info.name;els.toolHelpText.textContent=info.help;els.toolHelpTip.textContent=`Tip: ${info.tip}`;els.activeToolLabel.textContent=info.name; if(tool==='pencil'||tool==='eraser'||tool==='shade'||tool==='picker') els.brushSize.value='1';updateControlLabels();}
function setLayer(layer){state.layer=layer;els.layerGrid.querySelectorAll('[data-layer]').forEach(b=>b.classList.toggle('active',b.dataset.layer===layer));els.layerContext.textContent=layer==='both'?'Both layers':layer==='base'?'Base layer':'Outer layer';}
function toggleLock(layer){state.locks[layer]=!state.locks[layer];const b=layer==='base'?els.layerLockBase:els.layerLockOuter;b.textContent=state.locks[layer]?'🔒 '+(layer==='base'?'Base':'Outer'):'🔓 '+(layer==='base'?'Base':'Outer');}
function updateControlLabels(){els.brushSizeValue.textContent=`${els.brushSize.value} px`;els.brushOpacityValue.textContent=`${els.brushOpacity.value}%`;els.toleranceValue.textContent=els.replaceTolerance.value;els.referenceOpacityValue.textContent=`${els.referenceOpacity.value}%`;els.animSpeedValue.textContent=`${els.animSpeed.value}×`;}

function drawCheckerMini(ctx,w,h){ctx.fillStyle='#11151b';ctx.fillRect(0,0,w,h);ctx.fillStyle='#1b2028';for(let y=0;y<h;y+=12)for(let x=0;x<w;x+=12)if(((x/12)+(y/12))%2===0)ctx.fillRect(x,y,12,12);}

// ---------- 3D SOFTWARE RENDERER ----------
const V = (x,y,z)=>({x,y,z});
const add=(a,b)=>V(a.x+b.x,a.y+b.y,a.z+b.z);
const sub=(a,b)=>V(a.x-b.x,a.y-b.y,a.z-b.z);
const mul=(a,s)=>V(a.x*s,a.y*s,a.z*s);
function rotatePoint(p,pivot,rx,ry,rz=0){
  let x=p.x-pivot.x,y=p.y-pivot.y,z=p.z-pivot.z;
  const cx=Math.cos(rx),sx=Math.sin(rx),cy=Math.cos(ry),sy=Math.sin(ry),cz=Math.cos(rz),sz=Math.sin(rz);
  let y1=y*cx-z*sx,z1=y*sx+z*cx;y=y1;z=z1;
  let x1=x*cy+z*sy,z2=-x*sy+z*cy;x=x1;z=z2;
  let x2=x*cz-y*sz,y2=x*sz+y*cz;x=x2;y=y2;
  return V(x+pivot.x,y+pivot.y,z+pivot.z);
}
function partBox(name,minX,maxX,minY,maxY,minZ,maxZ,pivot,rotKey){
  return {name,minX,maxX,minY,maxY,minZ,maxZ,pivot,rotKey};
}
function buildParts(animT=0){
  const walk=state.preview.anim==='walk'&&!state.preview.animPaused;
  const phase=animT*state.preview.speed*0.004;
  const swing=walk?Math.sin(phase)*0.55:0;
  const body=partBox('body',-4,4,12,24,-2,2,V(0,12,0),'body');
  const head=partBox('head',-4,4,24,32,-4,4,V(0,24,0),'head');
  const armW=state.model==='slim'?3:4;
  const rightArm=partBox('rightArm',-4-armW,-4,12,24,-2,2,V(-4,24,0),'rightArm');
  const leftArm=partBox('leftArm',4,4+armW,12,24,-2,2,V(4,24,0),'leftArm');
  const rightLeg=partBox('rightLeg',-4,0,0,12,-2,2,V(-2,12,0),'rightLeg');
  const leftLeg=partBox('leftLeg',0,4,0,12,-2,2,V(2,12,0),'leftLeg');
  const rmap=state.preview.anim==='walk'&&!state.preview.animPaused? swing:0;
  return [
    {...head,rx:0},
    {...body,rx:0},
    {...rightArm,rx:rmap,rz:0},
    {...leftArm,rx:-rmap,rz:0},
    {...rightLeg,rx:-rmap,rz:0},
    {...leftLeg,rx:rmap,rz:0},
  ];
}
function transformLocal(part,p){return rotatePoint(p,part.pivot,part.rx||0,part.ry||0,part.rz||0);}
function project3D(p,w,h){
  const yaw=state.preview.yaw*Math.PI/180,pitch=state.preview.pitch*Math.PI/180;
  const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
  const x1=p.x*cy+p.z*sy;const z1=-p.x*sy+p.z*cy;const y1=p.y*cp-z1*sp;const z2=p.y*sp+z1*cp;
  const scale=state.preview.scale*(Math.min(w,h)/420);
  const persp=1/(1+z2/90);return {x:w/2+x1*scale*persp+state.preview.offsetX,y:h/2-y1*scale*persp+state.preview.offsetY,depth:z2};
}
function faceCorners(part,face,expand=0){
  const x0=part.minX-expand,x1=part.maxX+expand,y0=part.minY-expand,y1=part.maxY+expand,z0=part.minZ-expand,z1=part.maxZ+expand;
  let c;
  if(face==='front')c=[V(x0,y1,z1),V(x1,y1,z1),V(x1,y0,z1),V(x0,y0,z1)];
  else if(face==='back')c=[V(x1,y1,z0),V(x0,y1,z0),V(x0,y0,z0),V(x1,y0,z0)];
  else if(face==='left')c=[V(x0,y1,z0),V(x0,y1,z1),V(x0,y0,z1),V(x0,y0,z0)];
  else if(face==='right')c=[V(x1,y1,z1),V(x1,y1,z0),V(x1,y0,z0),V(x1,y0,z1)];
  else if(face==='top')c=[V(x0,y1,z0),V(x1,y1,z0),V(x1,y1,z1),V(x0,y1,z1)];
  else c=[V(x0,y0,z1),V(x1,y0,z1),V(x1,y0,z0),V(x0,y0,z0)];
  return c.map(p=>transformLocal(part,p));
}
function faceNormal(face){ const n={front:V(0,0,1),back:V(0,0,-1),left:V(-1,0,0),right:V(1,0,0),top:V(0,1,0),bottom:V(0,-1,0)}[face];return n; }
function uvRect(partName,face,layer='base'){
  const all=skinMap(state.model,state.size,layer);return all.find(r=>r.part===partName&&r.face===face)||null;
}
function sampleTextureRect(r,tx,ty){
  const x=clamp(Math.floor(tx),0,state.size-1),y=clamp(Math.floor(ty),0,state.size-1);return getPixel(x,y);}
function faceGridSteps(region){
  if(!region)return {cols:1,rows:1,stepX:1,stepY:1};
  const baseW=region.w/(state.size/64),baseH=region.h/(state.size/64); // logical face dimensions
  let pxStep=1;
  const scale=state.size/64;
  if(scale>2) pxStep=Math.ceil(scale/2);
  const cols=Math.ceil(region.w/pxStep),rows=Math.ceil(region.h/pxStep);
  return {cols,rows,stepX:pxStep,stepY:pxStep};
}
function bilerp(c,u,v){
  const a=add(mul(c[0],(1-u)*(1-v)),add(mul(c[1],u*(1-v)),add(mul(c[2],u*v),mul(c[3],(1-u)*v))));return a;
}
function avgDepth(points){return points.reduce((s,p)=>s+p.depth,0)/points.length;}
function faceVisible(projected){ const a=projected[0],b=projected[1],c=projected[2];return ((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x))>0; }
function faceShade(face,partName){ const yaw=state.preview.yaw*Math.PI/180; const f={front:0.98,back:.74,left:.88,right:1.0,top:1.08,bottom:.68}[face];const wobble=partName==='body'?1:1;return f*wobble; }
function renderFace(ctx,part,face,layer,expand,w,h,objects){
  if(layer==='outer'&&!state.outer)return;
  const region=uvRect(part.name,face,layer);if(!region)return;
  const corners=faceCorners(part,face,expand);const proj=corners.map(p=>project3D(p,w,h));
  if(!faceVisible(proj))return;
  const steps=faceGridSteps(region); const cols=steps.cols,rows=steps.rows; const texW=region.w,texH=region.h;
  for(let j=0;j<rows;j++){
    const v0=j/rows,v1=(j+1)/rows;
    for(let i=0;i<cols;i++){
      const u0=i/cols,u1=(i+1)/cols;
      const tx=region.x+u0*texW+(u1-u0)*texW*.5,ty=region.y+v0*texH+(v1-v0)*texH*.5;
      const px=sampleTextureRect(region,tx,ty);if(px[3]<6)continue;
      const p0=project3D(bilerp(corners,u0,v0),w,h),p1=project3D(bilerp(corners,u1,v0),w,h),p2=project3D(bilerp(corners,u1,v1),w,h),p3=project3D(bilerp(corners,u0,v1),w,h);
      const shade=faceShade(face,part.name);let a=px[3]/255;if(layer==='outer')a*=0.96;
      ctx.beginPath();ctx.moveTo(p0.x,p0.y);ctx.lineTo(p1.x,p1.y);ctx.lineTo(p2.x,p2.y);ctx.lineTo(p3.x,p3.y);ctx.closePath();ctx.fillStyle=`rgba(${clamp(Math.round(px[0]*shade),0,255)},${clamp(Math.round(px[1]*shade),0,255)},${clamp(Math.round(px[2]*shade),0,255)},${a})`;ctx.fill();
    }
  }
  objects.push({part,face,layer,corners,proj,depth:avgDepth(proj),region});
}
function draw3DScene(ctx,w,h,mini=false){
  ctx.clearRect(0,0,w,h);
  const g=ctx.createRadialGradient(w*.5,h*.32,10,w*.5,h*.32,Math.min(w,h)*.58);g.addColorStop(0,'rgba(127,215,255,.11)');g.addColorStop(1,'rgba(127,215,255,0)');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
  ctx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--preview-bg').trim()||'#0c0f14';ctx.fillRect(0,0,w,h);
  // floor shadow
  ctx.save();ctx.globalAlpha=.5;ctx.fillStyle='#000';ctx.beginPath();ctx.ellipse(w*.5,h*.83,Math.min(w,h)*.19,Math.min(w,h)*.035,0,0,Math.PI*2);ctx.fill();ctx.restore();
  const parts=buildParts(performance.now()); const faces=[]; const faceList=['back','left','bottom','right','top','front'];
  for(const part of parts){for(const face of faceList){renderFace(ctx,part,face,'base',0,w,h,faces);} if(state.outer){for(const face of faceList){renderFace(ctx,part,face,'outer',.45,w,h,faces);}}}
  // Larger camera-space depth is farther away in this projection; draw far → near.
  faces.sort((a,b)=>b.depth-a.depth);
  // Re-render in depth order because the individual pixel faces were emitted in part order.
  // Clear and replay sorted face entries using each face as a single mask/pixel grid pass.
  // For performance, use the sorted list and draw them again; this keeps the painter order deterministic.
  ctx.clearRect(0,0,w,h);ctx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--preview-bg').trim()||'#0c0f14';ctx.fillRect(0,0,w,h);ctx.fillStyle='rgba(127,215,255,.05)';ctx.beginPath();ctx.ellipse(w*.5,h*.35,Math.min(w,h)*.28,Math.min(w,h)*.35,0,0,Math.PI*2);ctx.fill();
  ctx.save();ctx.globalAlpha=.5;ctx.fillStyle='#000';ctx.beginPath();ctx.ellipse(w*.5,h*.84,Math.min(w,h)*.19,Math.min(w,h)*.035,0,0,Math.PI*2);ctx.fill();ctx.restore();
  // Actually render all faces in sorted order.
  for(const f of faces) renderFaceOrdered(ctx,f,w,h);
  if(selected3DFace){ctx.save();ctx.strokeStyle='rgba(127,215,255,.95)';ctx.lineWidth=2;ctx.setLineDash([7,5]);ctx.beginPath();const p=selected3DFace.proj;ctx.moveTo(p[0].x,p[0].y);for(let i=1;i<p.length;i++)ctx.lineTo(p[i].x,p[i].y);ctx.closePath();ctx.stroke();ctx.restore();}
}
function renderFaceOrdered(ctx,f,w,h){
  const {part,face,layer,proj,region}=f;const corners=faceCorners(part,face,layer==='outer'?.45:0);if(!region||!faceVisible(proj))return;const steps=faceGridSteps(region);const cols=steps.cols,rows=steps.rows;const texW=region.w,texH=region.h;for(let j=0;j<rows;j++){const v0=j/rows,v1=(j+1)/rows;for(let i=0;i<cols;i++){const u0=i/cols,u1=(i+1)/cols;const tx=region.x+u0*texW+(u1-u0)*texW*.5,ty=region.y+v0*texH+(v1-v0)*texH*.5;const p=sampleTextureRect(region,tx,ty);if(p[3]<6)continue;const a=layer==='outer'?(p[3]/255*.96):p[3]/255;const shade=faceShade(face,part.name);const q0=project3D(bilerp(corners,u0,v0),w,h),q1=project3D(bilerp(corners,u1,v0),w,h),q2=project3D(bilerp(corners,u1,v1),w,h),q3=project3D(bilerp(corners,u0,v1),w,h);ctx.beginPath();ctx.moveTo(q0.x,q0.y);ctx.lineTo(q1.x,q1.y);ctx.lineTo(q2.x,q2.y);ctx.lineTo(q3.x,q3.y);ctx.closePath();ctx.fillStyle=`rgba(${clamp(Math.round(p[0]*shade),0,255)},${clamp(Math.round(p[1]*shade),0,255)},${clamp(Math.round(p[2]*shade),0,255)},${a})`;ctx.fill();}}
}
function rayPickFace(x,y,canvas){
  const rect=canvas.getBoundingClientRect();const w=rect.width,h=rect.height;const parts=buildParts(performance.now());const hits=[];
  for(const part of parts){for(const layer of (state.outer?['base','outer']:['base'])){for(const face of ['front','back','left','right','top','bottom']){const region=uvRect(part.name,face,layer);if(!region)continue;const proj=faceCorners(part,face,layer==='outer'?.45:0).map(p=>project3D(p,w,h));if(!faceVisible(proj))continue;if(pointInQuad({x,y},proj)){hits.push({part,face,layer,proj,region,depth:avgDepth(proj)});}}}}
  // Smaller camera-space depth is closer to the viewer.
  hits.sort((a,b)=>a.depth-b.depth);return hits[0]||null;
}
function pointInQuad(pt,q){let sign=0;for(let i=0;i<4;i++){const a=q[i],b=q[(i+1)%4];const c=(b.x-a.x)*(pt.y-a.y)-(b.y-a.y)*(pt.x-a.x);if(Math.abs(c)<0.01)continue;if(sign===0)sign=Math.sign(c);else if(Math.sign(c)!==sign)return false;}return true;}
function quadUv(pt,q){ // inverse bilinear via two triangles
  const a=q[0],b=q[1],c=q[2],d=q[3];
  const tri=(p,p0,p1,p2)=>{const v0={x:p1.x-p0.x,y:p1.y-p0.y},v1={x:p2.x-p0.x,y:p2.y-p0.y},v2={x:p.x-p0.x,y:p.y-p0.y};const den=v0.x*v1.y-v1.x*v0.y;if(Math.abs(den)<1e-6)return null;const u=(v2.x*v1.y-v1.x*v2.y)/den,v=(v0.x*v2.y-v2.x*v0.y)/den;return {u,v};};
  let r=tri(pt,a,b,d);if(r&&r.u>=-0.001&&r.v>=-0.001&&r.u+r.v<=1.001)return {u:r.u,v:r.v};r=tri(pt,b,c,d);if(r&&r.u>=-0.001&&r.v>=-0.001&&r.u+r.v<=1.001)return {u:1-r.u,v:r.u};return null;
}
function pickTextureFromFace(hit,localX,localY){const inv=quadUv({x:localX,y:localY},hit.proj);if(!inv)return null;const x=Math.floor(hit.region.x+inv.u*hit.region.w);const y=Math.floor(hit.region.y+inv.v*hit.region.h);return {x:clamp(x,0,state.size-1),y:clamp(y,0,state.size-1),face:hit};}
function render3D(force=false){
  const r=resizeCanvas(els.characterCanvas);draw3DScene(charCtx,r.w,r.h);const m=resizeCanvas(els.miniPreviewCanvas);const saved={...state.preview,anim:'idle',animPaused:true};const current={...state.preview};state.preview.anim='idle';state.preview.animPaused=true;state.preview.scale=miniFitScale(m.w,m.h);state.preview.offsetX=0;state.preview.offsetY=0;draw3DScene(miniCtx,m.w,m.h,true);state.preview=current;
  els.previewStatus.textContent=state.preview.anim==='walk'&&!state.preview.animPaused?'WALKING':'LIVE';els.previewStatus.classList.toggle('warning',state.preview.anim==='walk'&&!state.preview.autoPerformance);
}
function miniFitScale(w,h){return Math.min(w,h)/38;}
function scheduleCharacterFrame(){if(state.mode==='3d'||!els.characterPane.hidden)render3D();else render3DMiniOnly();}
function render3DMiniOnly(){const m=resizeCanvas(els.miniPreviewCanvas);const current={...state.preview};state.preview.scale=miniFitScale(m.w,m.h);state.preview.offsetX=0;state.preview.offsetY=2;draw3DScene(miniCtx,m.w,m.h,true);state.preview=current;}
function animateLoop(ts){
  charFrameHandle=requestAnimationFrame(animateLoop);
  if(state.preview.anim!=='walk'||state.preview.animPaused)return;
  const minInterval=state.preview.autoPerformance?(navigator.hardwareConcurrency&&navigator.hardwareConcurrency<=4?1000/24:1000/30):1000/60;
  if(ts-lastAnimDraw<minInterval)return;lastAnimDraw=ts;
  render3D(false);
}
charFrameHandle=requestAnimationFrame(animateLoop);
function setAnimation(kind){state.preview.anim=kind;state.preview.animPaused=kind==='idle';els.idleBtn.classList.toggle('active',kind==='idle');els.walkBtn.classList.toggle('active',kind==='walk');els.pauseAnimBtn.textContent=state.preview.animPaused?'Resume':'Pause';els.walkToggleBtn.textContent=kind==='walk'&&!state.preview.animPaused?'⏸ Walk':'▶ Walk';render3D(true);}
function toggleWalk(){if(state.preview.anim==='walk'&&!state.preview.animPaused){state.preview.animPaused=true;}else{state.preview.anim='walk';state.preview.animPaused=false;}els.idleBtn.classList.toggle('active',state.preview.anim==='idle');els.walkBtn.classList.toggle('active',state.preview.anim==='walk');els.pauseAnimBtn.textContent=state.preview.animPaused?'Resume':'Pause';els.walkToggleBtn.textContent=state.preview.anim==='walk'&&!state.preview.animPaused?'⏸ Walk':'▶ Walk';}
function setCameraForFace(face){const angles={front:[0,-6],back:[180,-6],left:[-90,-6],right:[90,-6],top:[0,-62],bottom:[0,62]};const [yaw,pitch]=angles[face]||angles.front;state.preview.yaw=yaw;state.preview.pitch=pitch;render3D(true);}
function setPresetCamera(kind){const a={front:[0,-6],back:[180,-6],left:[-90,-6],right:[90,-6],top:[0,-62],reset:[-26,-10]}[kind];if(a){state.preview.yaw=a[0];state.preview.pitch=a[1];}render3D(true);}

function handleCharacterPointerDown(ev){ev.preventDefault();const rect=els.characterCanvas.getBoundingClientRect();const pt={x:ev.clientX-rect.left,y:ev.clientY-rect.top};state.pointerMap.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});els.characterCanvas.setPointerCapture(ev.pointerId);if(state.pointerMap.size>=2){state.gesture={startMid:midpoint(...[...state.pointerMap.values()].slice(0,2)),startDist:dist(...[...state.pointerMap.values()].slice(0,2)),startYaw:state.preview.yaw,startPitch:state.preview.pitch,startScale:state.preview.scale};return;}
  if(state.cameraMode==='paint'){const hit=rayPickFace(pt.x,pt.y,els.characterCanvas);selected3DFace=hit;if(hit){const picked=pickTextureFromFace(hit,pt.x,pt.y);if(picked){els.characterFaceReadout.textContent=`${PART_LABELS[hit.part.name]} · ${FACE_LABELS[hit.face]} · ${hit.layer}`;apply3DPaintAt(picked.x,picked.y);render3D(true);}}}
  else {state.gesture={startX:ev.clientX,startY:ev.clientY,startYaw:state.preview.yaw,startPitch:state.preview.pitch,startScale:state.preview.scale,startMid:{x:ev.clientX,y:ev.clientY},startDist:0};}
}
function handleCharacterPointerMove(ev){if(!state.pointerMap.has(ev.pointerId))return;state.pointerMap.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});if(state.pointerMap.size>=2){if(!state.gesture)return;const pts=[...state.pointerMap.values()];const a=pts[0],b=pts[1],m=midpoint(a,b);const d=dist(a,b);if(!state.gesture.startDist)state.gesture.startDist=d;state.preview.scale=clamp(state.gesture.startScale*(d/state.gesture.startDist),5,28);state.preview.yaw=state.gesture.startYaw+(m.x-state.gesture.startMid.x)*0.4;state.preview.pitch=clamp(state.gesture.startPitch+(m.y-state.gesture.startMid.y)*0.3,-80,80);render3D();return;}
  if(state.cameraMode==='camera'&&state.gesture){state.preview.yaw=state.gesture.startYaw+(ev.clientX-state.gesture.startX)*0.5;state.preview.pitch=clamp(state.gesture.startPitch+(ev.clientY-state.gesture.startY)*0.4,-80,80);render3D();}
  else if(state.cameraMode==='paint'){const rect=els.characterCanvas.getBoundingClientRect();const hit=rayPickFace(ev.clientX-rect.left,ev.clientY-rect.top,els.characterCanvas);if(hit){const picked=pickTextureFromFace(hit,ev.clientX-rect.left,ev.clientY-rect.top);if(picked){apply3DPaintAt(picked.x,picked.y);selected3DFace=hit;render3D();}}}
}
function handleCharacterPointerUp(ev){state.pointerMap.delete(ev.pointerId);try{els.characterCanvas.releasePointerCapture(ev.pointerId);}catch{}if(state.pointerMap.size===0)state.gesture=null;}
function handleCharacterWheel(ev){ev.preventDefault();state.preview.scale=clamp(state.preview.scale*(ev.deltaY<0?1.1:.9),5,28);render3D();}
function apply3DPaintAt(x,y){ if(state.tool==='picker'){setColor('#'+rgbaToHex(...getPixel(x,y).slice(0,3)));setTool('pencil');return;}if(state.tool==='fill'){beginStroke();floodFill(x,y);finishStroke();return;}if(state.tool==='replace'){beginStroke();replaceColors(getPixel(x,y));finishStroke();return;}if(!state.drawing)beginStroke();stampBrush(x,y);renderEditor();}

function updateModel(model){state.model=model;syncSelectors();pushHistory();renderAll();toast(`Model: ${model==='classic'?'Classic / Steve · 4px arms':'Slim / Alex · 3px arms'}`);}
function syncSelectors(){els.modelSelect.value=state.model;els.textureSizeSelect.value=[64,128].includes(state.size)?String(state.size):'custom';els.docSize.textContent=`${state.size}×${state.size}`;els.characterResolutionLabel.textContent=`${state.size}×${state.size}`;}
function changeTextureSize(size){size=Number(size);if(!Number.isFinite(size))return;const old=state.size;const oldPixels=state.pixels;const newPixels=new Uint8ClampedArray(size*size*4);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const sx=Math.floor(x/size*old),sy=Math.floor(y/size*old);const si=(sy*old+sx)*4,di=(y*size+x)*4;newPixels[di]=oldPixels[si];newPixels[di+1]=oldPixels[si+1];newPixels[di+2]=oldPixels[si+2];newPixels[di+3]=oldPixels[si+3];}state.size=size;state.pixels=newPixels;state.title=`${size}×${size} Skin`;pushHistory();syncSelectors();fitEditorView();renderAll();toast(`Texture changed to ${size}×${size}`);}

function loadImageAsSkin(file,allowCustom=true){
  const img=new Image();const url=URL.createObjectURL(file);img.onload=()=>{URL.revokeObjectURL(url);const size=img.naturalWidth;if(img.naturalWidth!==img.naturalHeight){toast('Skin texture must be square. Image kept as a reference instead.','warn');loadReferenceObject(img);return;}if(size<MIN_TEX||size>MAX_TEX){toast(`Texture size must be between ${MIN_TEX} and ${MAX_TEX}.`, 'warn');loadReferenceObject(img);return;}const c=document.createElement('canvas');c.width=size;c.height=size;const cx=c.getContext('2d',{willReadFrequently:true});cx.imageSmoothingEnabled=false;cx.drawImage(img,0,0);const data=cx.getImageData(0,0,size,size).data;state.size=size;state.pixels=new Uint8ClampedArray(data);state.title=file.name.replace(/\.[^.]+$/,'');state.reference=null;state.referenceVisible=false;syncSelectors();pushHistory();fitEditorView();renderAll();toast(`Loaded ${size}×${size} skin automatically.`);setMode('2d');};img.onerror=()=>{URL.revokeObjectURL(url);toast('Could not read that image.','warn');};img.src=url;}
function loadReferenceObject(img){state.reference=img;state.referenceVisible=true;els.referenceToggle.checked=true;els.referenceToggle.dispatchEvent(new Event('change'));}
function loadReference(file){const img=new Image();const url=URL.createObjectURL(file);img.onload=()=>{URL.revokeObjectURL(url);loadReferenceObject(img);toast('Reference image loaded. It will not alter the skin until you paint.');};img.onerror=()=>{URL.revokeObjectURL(url);toast('Reference image could not be read.','warn');};img.src=url;}
function createTextureDataFromFile(file,callback){const img=new Image();const url=URL.createObjectURL(file);img.onload=()=>{URL.revokeObjectURL(url);callback(img);};img.onerror=()=>{URL.revokeObjectURL(url);toast('Could not load image.','warn');};img.src=url;}

function exportPNG(){const c=document.createElement('canvas');c.width=state.size;c.height=state.size;const cctx=c.getContext('2d');cctx.putImageData(new ImageData(new Uint8ClampedArray(state.pixels),state.size,state.size),0,0);c.toBlob(blob=>{if(!blob)return;const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${state.title||'nova-skin'}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast('PNG exported.');},'image/png');}
function saveLibrary(){const key='nova-library-v2';let list=[];try{list=JSON.parse(localStorage.getItem(key)||'[]');}catch{}const thumb=document.createElement('canvas');thumb.width=64;thumb.height=64;const tc=thumb.getContext('2d');tc.imageSmoothingEnabled=false;tc.drawImage(imageCanvas,0,0,64,64);const item={id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),name:state.title||'Untitled skin',size:state.size,model:state.model,data:thumb.toDataURL('image/png'),pixels:Array.from(state.pixels)};list=[item,...list].slice(0,24);localStorage.setItem(key,JSON.stringify(list));renderLibrary();toast('Saved to My skins.');}
function renderLibrary(){let list=[];try{list=JSON.parse(localStorage.getItem('nova-library-v2')||'[]');}catch{}els.libraryList.innerHTML='';if(!list.length){els.libraryList.innerHTML='<div class="library-empty">No saved skins yet.</div>';return;}for(const item of list){const b=document.createElement('button');b.className='library-item';b.innerHTML=`<img src="${item.data}" alt=""><span>${escapeHtml(item.name)}</span><small>${item.size}×${item.size} · ${item.model}</small>`;b.addEventListener('click',()=>{state.size=item.size;state.model=item.model;state.pixels=new Uint8ClampedArray(item.pixels);state.title=item.name;syncSelectors();pushHistory();fitEditorView();renderAll();toast('Loaded from My skins.');});els.libraryList.appendChild(b);}}
function escapeHtml(s){return String(s).replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));}

function applyTemplate(kind){
  const src=kind==='classic'?'assets/complete-classic-template.png':kind==='slim'?'assets/complete-slim-template.png':'assets/demo-128.png';const img=new Image();img.onload=()=>{const size=img.naturalWidth;const c=document.createElement('canvas');c.width=size;c.height=size;c.getContext('2d').drawImage(img,0,0);state.size=size;state.pixels=new Uint8ClampedArray(c.getContext('2d').getImageData(0,0,size,size).data);state.model=kind==='slim'?'slim':'classic';state.title=kind==='classic'?'Complete Classic Starter':kind==='slim'?'Complete Slim Starter':'128×128 Demo';syncSelectors();pushHistory();fitEditorView();renderAll();els.templateModal.hidden=true;setMode('2d');toast('Starter template loaded.');};img.src=src;}

function renderChecks(){const standard=[64,128].includes(state.size);const custom=state.size>128;const textureOk=state.size>=64&&state.size<=1024&&state.size===Math.round(state.size)&&state.pixels.length===state.size*state.size*4;const items=[[standard,'Standard Bedrock texture size'],[custom,'Advanced custom texture size'],[textureOk,'Texture buffer valid'],[alphaPixels()>0,'Texture contains pixels'],[state.historyIndex>=0,'Undo history ready'],[state.mode==='3d','3D editor available']];els.checks.innerHTML=items.map(([ok,t])=>`<div class="check ${ok?'ok':'warn'}"><span class="check-icon">${ok?'✓':'!'}</span><span>${t}</span></div>`).join('');}
function renderAll(){renderSwatches();renderEditor();render3D(true);renderChecks();renderLibrary();updateHistoryButtons();updateControlLabels();syncSelectors();}

function setDocumentTitleStatus(msg){els.docStatus.textContent=msg;}

function persistAutosave(){try{const payload={size:state.size,model:state.model,mode:state.mode,tool:state.tool,layer:state.layer,title:state.title,pixels:Array.from(state.pixels),focus:state.focus,locks:state.locks};localStorage.setItem('nova-autosave-v3',JSON.stringify(payload));}catch(e){/* storage may be unavailable */}}
function loadAutosave(){try{const raw=localStorage.getItem('nova-autosave-v3');if(!raw)return false;const d=JSON.parse(raw);if(!d.pixels||!d.size)return false;state.size=d.size;state.model=d.model||'classic';state.pixels=new Uint8ClampedArray(d.pixels);state.title=d.title||'Recovered Skin';state.focus=d.focus||state.focus;state.locks=d.locks||state.locks;syncSelectors();pushHistory();fitEditorView();renderAll();toast('Recovered your last autosaved skin.');return true;}catch{return false;}}

function setupEvents(){
  let savedTheme='midnight'; try{savedTheme=localStorage.getItem('nova-theme')||'midnight';}catch{} els.themeSelect.value=savedTheme;themeSet(els.themeSelect.value);els.themeSelect.addEventListener('change',()=>{themeSet(els.themeSelect.value);render3D(true);});
  els.toolGrid.addEventListener('click',e=>{const b=e.target.closest('[data-tool]');if(b)setTool(b.dataset.tool);});
  els.layerGrid.addEventListener('click',e=>{const b=e.target.closest('[data-layer]');if(b)setLayer(b.dataset.layer);});
  els.modeButtons.forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
  els.cameraModeButtons.forEach(b=>b.addEventListener('click',()=>setCameraMode(b.dataset.cameraMode)));
  els.brushSize.addEventListener('input',updateControlLabels);els.brushOpacity.addEventListener('input',()=>{state.toolOpacity=Number(els.brushOpacity.value);updateControlLabels();});els.brushShape.addEventListener('change',()=>state.brushShape=els.brushShape.value);els.pixelPerfect.addEventListener('change',()=>state.pixelPerfect=els.pixelPerfect.checked);els.shadeMode.addEventListener('change',()=>state.shadeMode=els.shadeMode.value);els.replaceTolerance.addEventListener('input',()=>{state.replaceTolerance=Number(els.replaceTolerance.value);updateControlLabels();});els.mirrorToggle.addEventListener('change',()=>state.mirror=els.mirrorToggle.checked);
  els.gridToggle.addEventListener('change',()=>{state.grid=els.gridToggle.checked;renderEditor();});els.checkerToggle.addEventListener('change',()=>{state.checker=els.checkerToggle.checked;renderEditor();});els.outerToggle.addEventListener('change',()=>{state.outer=els.outerToggle.checked;render3D(true);});
  els.zoomInBtn.addEventListener('click',()=>setEditorZoom(editorView.pixelSize*1.25));els.zoomOutBtn.addEventListener('click',()=>setEditorZoom(editorView.pixelSize*.8));els.fitBtn.addEventListener('click',fitEditorView);els.centerBtn.addEventListener('click',centerEditorView);els.resetViewBtn.addEventListener('click',()=>{fitEditorView();toast('View reset.');});
  els.focusBtn.addEventListener('click',openFocusModal);els.focusLockBtn.addEventListener('click',toggleFocusLock);els.focusApplyBtn.addEventListener('click',applyFocus);
  els.layerLockBase.addEventListener('click',()=>toggleLock('base'));els.layerLockOuter.addEventListener('click',()=>toggleLock('outer'));
  els.colorInput.addEventListener('input',()=>setColor(els.colorInput.value));els.hexInput.addEventListener('change',()=>setColor(els.hexInput.value));els.clearRecentBtn.addEventListener('click',()=>{state.recentColors=[];renderSwatches();});
  els.undoBtn.addEventListener('click',undo);els.redoBtn.addEventListener('click',redo);window.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo();}});
  els.editorCanvas.addEventListener('pointerdown',handleEditorPointerDown);els.editorCanvas.addEventListener('pointermove',handleEditorPointerMove);els.editorCanvas.addEventListener('pointerup',handleEditorPointerUp);els.editorCanvas.addEventListener('pointercancel',handleEditorPointerUp);els.editorCanvas.addEventListener('wheel',handleEditorWheel,{passive:false});
  els.characterCanvas.addEventListener('pointerdown',handleCharacterPointerDown);els.characterCanvas.addEventListener('pointermove',handleCharacterPointerMove);els.characterCanvas.addEventListener('pointerup',handleCharacterPointerUp);els.characterCanvas.addEventListener('pointercancel',handleCharacterPointerUp);els.characterCanvas.addEventListener('wheel',handleCharacterWheel,{passive:false});
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
  window.addEventListener('resize',()=>{fitEditorView();render3D(true);});window.addEventListener('beforeunload',persistAutosave);setInterval(persistAutosave,5000);
}

function bootstrap(){
  state.toolOpacity=100;state.brushSize=1;els.brushOpacity.value=100;els.brushSize.value=1;els.brushShape.value='square';els.pixelPerfect.checked=true;
  renderFocusModal();createBlankTexture(64);state.history=[];state.historyIndex=-1;pushHistory();syncSelectors();fitEditorView();renderSwatches();render3D(true);renderChecks();renderLibrary();updateControlLabels();setTool('pencil');setLayer('both');
  const recovered=loadAutosave();
  if(!recovered){fitEditorView();renderAll();}
}

setupEvents();bootstrap();
