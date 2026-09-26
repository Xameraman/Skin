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
  activeToolLabel: document.querySelector('#activeToolLabel'),
  cursorReadout: document.querySelector('#cursorReadout'),
  zoomReadout: document.querySelector('#zoomReadout'),
  checks: document.querySelector('#checks'),
  toastRegion: document.querySelector('#toastRegion'),
  fileInput: document.querySelector('#fileInput'),
  docStatus: document.querySelector('#docStatus'),
  pixelTip: document.querySelector('#pixelTip'),
};

const ctx = els.canvas.getContext('2d', { alpha: true });
const pctx = els.previewCanvas.getContext('2d', { alpha: false });
ctx.imageSmoothingEnabled = false;
pctx.imageSmoothingEnabled = false;

const state = {
  pixels: new Uint8ClampedArray(SIZE * SIZE * 4),
  tool: 'pencil',
  color: DEFAULT_COLOR,
  zoom: 10,
  grid: true,
  checker: true,
  mirror: false,
  drawing: false,
  strokeBefore: null,
  history: [],
  historyIndex: -1,
  recentColors: [DEFAULT_COLOR, '#FFFFFF', '#16191F', '#FF6B7A', '#FFCC66', '#9AF0CF', '#7D8BFF', '#B68CFF', '#6CE0D5', '#F28BA8', '#A6B7C7', '#5B6673', '#7B4E3A', '#C98E5B', '#3B6D8C', '#283541'],
  title: 'Untitled skin',
  dragStart: null,
  previewRotY: 28,
};

let view = { offsetX: 0, offsetY: 0, pixelSize: 10 };
let previewState = { dragging: false, startX: 0, startRot: 0 };

function hexToRgba(hex) {
  const clean = hex.replace('#','').trim();
  const value = clean.length === 3 ? clean.split('').map(c => c+c).join('') : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return null;
  const n = Number.parseInt(value, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
}

function rgbaToHex(r,g,b) {
  return [r,g,b].map(v => v.toString(16).padStart(2,'0')).join('').toUpperCase();
}

function setColor(hex, addRecent = true) {
  const rgba = hexToRgba(hex);
  if (!rgba) return;
  const normalized = '#' + rgbaToHex(rgba[0],rgba[1],rgba[2]);
  state.color = normalized;
  els.colorInput.value = normalized;
  els.hexInput.value = normalized.slice(1);
  if (addRecent) {
    state.recentColors = [normalized, ...state.recentColors.filter(c => c !== normalized)].slice(0, 16);
    renderPalettes();
  }
}

function clearPixels() {
  state.pixels.fill(0);
  // Use fully transparent skin initially. Minecraft will read transparent pixels.
}

function createBlankSkin() {
  clearPixels();
  // Give the blank editor a subtle starter face/body so it's visually useful, while still being a true texture.
  paintRect(8, 8, 8, 8, '#E6B98C');
  paintRect(8, 0, 8, 8, '#3A281C');
  paintRect(40, 8, 8, 8, '#E6B98C');
  paintRect(20, 20, 8, 12, '#2C3138');
  paintRect(36, 20, 8, 12, '#2C3138');
  paintRect(44, 20, 4, 12, '#2C3138');
  paintRect(52, 20, 4, 12, '#2C3138');
  paintRect(4, 20, 4, 12, '#58616E');
  paintRect(8, 20, 4, 12, '#58616E');
  saveHistory();
}

function indexFor(x,y){ return (y * SIZE + x) * 4; }
function getPixel(x,y) {
  const i = indexFor(x,y);
  return [state.pixels[i], state.pixels[i+1], state.pixels[i+2], state.pixels[i+3]];
}
function setPixel(x,y,rgba) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
  const i = indexFor(x,y);
  state.pixels[i]=rgba[0]; state.pixels[i+1]=rgba[1]; state.pixels[i+2]=rgba[2]; state.pixels[i+3]=rgba[3];
}
function paintRect(x,y,w,h,hex){
  const rgba=hexToRgba(hex);
  if(!rgba) return;
  for(let yy=y; yy<y+h; yy++) for(let xx=x; xx<x+w; xx++) setPixel(xx,yy,rgba);
}

function pixelsToImageData() {
  return new ImageData(new Uint8ClampedArray(state.pixels), SIZE, SIZE);
}

function renderEditor() {
  const rect = els.canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const size = Math.max(128, Math.round(Math.min(rect.width, rect.height) * dpr));
  if (els.canvas.width !== size || els.canvas.height !== size) {
    els.canvas.width = size;
    els.canvas.height = size;
    ctx.imageSmoothingEnabled = false;
  }

  ctx.clearRect(0,0,els.canvas.width,els.canvas.height);
  if (state.checker) drawChecker(ctx, els.canvas.width, els.canvas.height, 14);
  else { ctx.fillStyle='#11151c'; ctx.fillRect(0,0,els.canvas.width,els.canvas.height); }

  const scale = els.canvas.width / SIZE;
  const image = pixelsToImageData();
  const temp = document.createElement('canvas');
  temp.width=SIZE; temp.height=SIZE;
  const tctx=temp.getContext('2d', {willReadFrequently:false});
  tctx.putImageData(image,0,0);
  ctx.imageSmoothingEnabled=false;
  ctx.drawImage(temp,0,0,SIZE*scale,SIZE*scale);

  if(state.grid) {
    ctx.save();
    ctx.globalAlpha = scale >= 7 ? .22 : .1;
    ctx.strokeStyle='#8591A0';
    ctx.lineWidth=1;
    ctx.beginPath();
    for(let x=0;x<=SIZE;x++) { const px=Math.round(x*scale)+.5; ctx.moveTo(px,0);ctx.lineTo(px,els.canvas.height); }
    for(let y=0;y<=SIZE;y++) { const py=Math.round(y*scale)+.5; ctx.moveTo(0,py);ctx.lineTo(els.canvas.width,py); }
    ctx.stroke();
    ctx.restore();
  }

  // A subtle border makes transparent areas distinguishable.
  ctx.save(); ctx.strokeStyle='rgba(255,255,255,.12)'; ctx.lineWidth=1; ctx.strokeRect(.5,.5,els.canvas.width-1,els.canvas.height-1); ctx.restore();
  els.zoomReadout.textContent = `${Math.round(scale * 100)}%`;
}

function drawChecker(target, width, height, cell) {
  target.fillStyle='#10141a'; target.fillRect(0,0,width,height);
  target.fillStyle='#171c23';
  for(let y=0; y<height; y+=cell) for(let x=0; x<width; x+=cell) if(((x/cell)+(y/cell))%2===0) target.fillRect(x,y,cell,cell);
}

function renderPreview() {
  const w=els.previewCanvas.width, h=els.previewCanvas.height;
  pctx.clearRect(0,0,w,h);
  pctx.fillStyle='#0c0f14'; pctx.fillRect(0,0,w,h);
  const g=pctx.createRadialGradient(w*.5,h*.34,10,w*.5,h*.34,w*.58);
  g.addColorStop(0,'rgba(119,215,255,.07)'); g.addColorStop(1,'rgba(119,215,255,0)');
  pctx.fillStyle=g; pctx.fillRect(0,0,w,h);

  const body = { x:w*.5-58, y:h*.51-10, head:58, bodyW:66, bodyH:90, limbW:28, limbH:88 };
  const sx=Math.cos(state.previewRotY*Math.PI/180), z=Math.sin(state.previewRotY*Math.PI/180);
  // Stylized low-poly preview. It is a performance-safe foundation for true UV-mapped 3D in the next stage.
  drawPreviewShadow(pctx,w*.5,h*.84,88,16);
  const offset = z*12;
  drawPart(pctx, body.x-offset-31, body.y+83, body.limbW, body.limbH, skinRegionColor(4,20,4,12), 'left');
  drawPart(pctx, body.x+body.bodyW+offset+3, body.y+83, body.limbW, body.limbH, skinRegionColor(36,20,4,12), 'right');
  drawPart(pctx, body.x, body.y+81, body.bodyW, body.bodyH, skinRegionColor(20,20,8,12), 'body');
  drawPart(pctx, body.x+body.bodyW+14+offset*.15, body.y+81, body.limbW, body.limbH, skinRegionColor(36,36,4,12), 'legR');
  drawPart(pctx, body.x+18-offset*.15, body.y+81, body.limbW, body.limbH, skinRegionColor(20,36,4,12), 'legL');
  const hx=body.x+4+offset*.22, hy=body.y+4;
  drawHead(pctx,hx,hy,body.head, state.previewRotY);
  renderPreviewHighlight();
}

function avgRegion(x,y,w,h){
  let r=0,g=0,b=0,a=0,count=0;
  for(let yy=y;yy<y+h;yy++) for(let xx=x;xx<x+w;xx++) { const p=getPixel(xx,yy); r+=p[0];g+=p[1];b+=p[2];a+=p[3];count++; }
  if(!count) return [180,180,180,255];
  a/=count; if(a<10) return [70,78,90,255];
  return [Math.round(r/count),Math.round(g/count),Math.round(b/count),255];
}
function skinRegionColor(x,y,w,h){return avgRegion(x,y,w,h)}
function rgbaCss(p,alpha=1){return `rgba(${p[0]},${p[1]},${p[2]},${alpha})`;}
function shade(p, factor){return [Math.max(0,Math.min(255,Math.round(p[0]*factor))),Math.max(0,Math.min(255,Math.round(p[1]*factor))),Math.max(0,Math.min(255,Math.round(p[2]*factor))),255];}
function drawPart(c,x,y,w,h,col,side){
  c.fillStyle=rgbaCss(shade(col, .8)); c.fillRect(x,y,w,h);
  c.fillStyle=rgbaCss(col); c.fillRect(x+4,y+4,w-8,h-8);
  c.fillStyle=rgbaCss(shade(col,1.08),.8); c.fillRect(x+4,y+4,w-8,Math.max(5,h*.08));
  c.fillStyle=rgbaCss(shade(col,.65),.55); c.fillRect(x,y,w*.13,h);
}
function drawHead(c,x,y,size,rot){
  const front=avgRegion(8,8,8,8), side=avgRegion(16,8,8,8), top=avgRegion(8,0,8,8);
  const skew=Math.sin(rot*Math.PI/180)*9;
  c.save();
  c.fillStyle=rgbaCss(shade(side,.72)); c.fillRect(x+size*.12+skew,y+size*.08,size*.22,size*.84);
  c.fillStyle=rgbaCss(front); c.fillRect(x+size*.25+skew,y,size*.68,size*.82);
  c.fillStyle=rgbaCss(shade(front,.84)); c.fillRect(x+size*.25+skew,y+size*.58,size*.68,size*.24);
  c.fillStyle=rgbaCss(shade(top,1.05)); c.fillRect(x+size*.25+skew,y,size*.68,size*.12);
  c.restore();
}
function drawPreviewShadow(c,x,y,rx,ry){ const g=c.createRadialGradient(x,y,1,x,y,rx); g.addColorStop(0,'rgba(0,0,0,.48)');g.addColorStop(1,'rgba(0,0,0,0)'); c.fillStyle=g;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill(); }
function renderPreviewHighlight(){ }

function renderAll(){ renderEditor(); renderPreview(); renderChecks(); renderPalettes(); }

function renderChecks(){
  const alphaPixels = countAlpha();
  const opaque = alphaPixels > 0;
  const is64 = SIZE===64;
  const items = [
    [is64,'64×64 texture size'],
    [opaque,'Texture contains skin pixels'],
    [state.pixels.length === SIZE*SIZE*4,'Pixel buffer intact'],
    [state.historyIndex >= 0,'Undo history ready'],
  ];
  els.checks.innerHTML = items.map(([ok,label]) => `<div class="check ${ok?'ok':'warn'}"><span class="check-icon">${ok?'✓':'!'}</span><span>${label}</span></div>`).join('');
}
function countAlpha(){ let n=0; for(let i=3;i<state.pixels.length;i+=4) if(state.pixels[i]>0)n++; return n; }

function renderPalettes(){
  const colors=state.recentColors.slice(0,16);
  els.swatches.innerHTML='';
  els.quickColors.innerHTML='';
  colors.forEach((c,i)=>{
    const b=document.createElement('button'); b.className='swatch'; b.style.background=c; b.title=c; b.dataset.color=c; b.setAttribute('aria-label',`Use ${c}`); b.addEventListener('click',()=>setColor(c,true)); els.swatches.appendChild(b);
    if(i<8){ const q=b.cloneNode(true); q.addEventListener('click',()=>setColor(c,true)); els.quickColors.appendChild(q); }
  });
}

function saveHistory(){
  const snap = new Uint8ClampedArray(state.pixels);
  if(state.historyIndex < state.history.length-1) state.history = state.history.slice(0,state.historyIndex+1);
  state.history.push(snap);
  if(state.history.length > HISTORY_LIMIT) state.history.shift();
  state.historyIndex = state.history.length-1;
}
function restoreSnapshot(snap){ state.pixels = new Uint8ClampedArray(snap); renderAll(); }
function undo(){ if(state.historyIndex<=0)return; state.historyIndex--; restoreSnapshot(state.history[state.historyIndex]); }
function redo(){ if(state.historyIndex>=state.history.length-1)return; state.historyIndex++; restoreSnapshot(state.history[state.historyIndex]); }

function eventToPixel(e){
  const r=els.canvas.getBoundingClientRect();
  let x=Math.floor(((e.clientX-r.left)/r.width)*SIZE);
  let y=Math.floor(((e.clientY-r.top)/r.height)*SIZE);
  x=Math.max(0,Math.min(SIZE-1,x)); y=Math.max(0,Math.min(SIZE-1,y));
  return [x,y];
}
function paintAt(x,y,erase=false){
  if(state.mirror){
    const pairs=[[x,y],[SIZE-1-x,y]];
    pairs.forEach(([px,py])=>setPixel(px,py,erase?[0,0,0,0]:hexToRgba(state.color)));
  } else setPixel(x,y,erase?[0,0,0,0]:hexToRgba(state.color));
}

function floodFill(sx,sy,newColor){
  const target=getPixel(sx,sy);
  if(target[0]===newColor[0]&&target[1]===newColor[1]&&target[2]===newColor[2]&&target[3]===newColor[3]) return false;
  const q=[[sx,sy]], seen=new Uint8Array(SIZE*SIZE); let changed=false;
  while(q.length){
    const [x,y]=q.pop(); if(x<0||y<0||x>=SIZE||y>=SIZE)continue;
    const id=y*SIZE+x; if(seen[id])continue; seen[id]=1;
    const p=getPixel(x,y);
    if(p[0]!==target[0]||p[1]!==target[1]||p[2]!==target[2]||p[3]!==target[3])continue;
    setPixel(x,y,newColor); changed=true;
    q.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);
  }
  return changed;
}

function linePixels(x0,y0,x1,y1){
  const points=[]; let dx=Math.abs(x1-x0), sx=x0<x1?1:-1, dy=-Math.abs(y1-y0), sy=y0<y1?1:-1, err=dx+dy;
  while(true){points.push([x0,y0]); if(x0===x1&&y0===y1)break; const e2=2*err; if(e2>=dy){err+=dy;x0+=sx;} if(e2<=dx){err+=dx;y0+=sy;} }
  return points;
}
function drawShapePreview(){ renderEditor(); }

function pointerDown(e){
  if(e.button===2){ const [x,y]=eventToPixel(e); const p=getPixel(x,y); if(p[3]>0) setColor('#'+rgbaToHex(p[0],p[1],p[2])); return; }
  if(e.pointerType==='mouse' && e.button!==0) return;
  els.canvas.setPointerCapture?.(e.pointerId);
  const [x,y]=eventToPixel(e); state.drawing=true; state.dragStart=[x,y]; state.strokeBefore=new Uint8ClampedArray(state.pixels);
  if(state.tool==='picker'){const p=getPixel(x,y); setColor(p[3] ? '#'+rgbaToHex(p[0],p[1],p[2]) : '#000000'); state.drawing=false; return;}
  if(state.tool==='fill'){ const did=floodFill(x,y,hexToRgba(state.color)); if(did){ if(state.mirror) floodFill(SIZE-1-x,y,hexToRgba(state.color)); saveHistory(); renderAll(); } state.drawing=false; return; }
  if(state.tool==='pencil') paintAt(x,y,false);
  if(state.tool==='eraser') paintAt(x,y,true);
  renderEditor(); renderPreview();
}
function pointerMove(e){
  const [x,y]=eventToPixel(e); els.cursorReadout.textContent=`X: ${x}  Y: ${y}`;
  if(!state.drawing)return;
  if(state.tool==='pencil'||state.tool==='eraser') { paintAt(x,y,state.tool==='eraser'); renderEditor(); renderPreview(); return; }
}
function pointerUp(e){
  if(!state.drawing)return;
  const [x1,y1]=eventToPixel(e);
  if(state.tool==='line'||state.tool==='rect'){
    state.pixels = new Uint8ClampedArray(state.strokeBefore);
    const [x0,y0]=state.dragStart;
    if(state.tool==='line') linePixels(x0,y0,x1,y1).forEach(([x,y])=>paintAt(x,y,false));
    else {
      const minX=Math.min(x0,x1), maxX=Math.max(x0,x1), minY=Math.min(y0,y1), maxY=Math.max(y0,y1);
      for(let x=minX;x<=maxX;x++){paintAt(x,minY,false);paintAt(x,maxY,false)}
      for(let y=minY;y<=maxY;y++){paintAt(minX,y,false);paintAt(maxX,y,false)}
    }
  }
  const changed=!arraysEqual(state.strokeBefore,state.pixels);
  if(changed) saveHistory();
  state.drawing=false; state.strokeBefore=null; renderAll();
}
function arraysEqual(a,b){ if(!a||a.length!==b.length)return false; for(let i=0;i<a.length;i++)if(a[i]!==b[i])return false; return true; }

function setTool(tool){
  state.tool=tool;
  document.querySelectorAll('.tool-btn').forEach(b=>b.classList.toggle('active',b.dataset.tool===tool));
  els.activeToolLabel.textContent=tool[0].toUpperCase()+tool.slice(1);
}

function downloadSkin(){
  const out=document.createElement('canvas'); out.width=SIZE;out.height=SIZE;
  const octx=out.getContext('2d'); octx.imageSmoothingEnabled=false; octx.putImageData(pixelsToImageData(),0,0);
  out.toBlob(blob=>{
    const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=(state.title||'nova-skin').toLowerCase().replace(/[^a-z0-9-_]+/g,'-')+'.png'; a.click(); URL.revokeObjectURL(url); toast('PNG skin exported.');
  },'image/png');
}

async function importSkin(file){
  if(!file)return;
  if(file.type!=='image/png'){toast('Please choose a PNG skin.');return;}
  const url=URL.createObjectURL(file); const img=new Image();
  img.onload=()=>{
    if(img.width!==64 || img.height!==64){ toast(`This PNG is ${img.width}×${img.height}. The first build targets 64×64 skins.`); URL.revokeObjectURL(url); return; }
    const c=document.createElement('canvas'); c.width=SIZE;c.height=SIZE; const cctx=c.getContext('2d'); cctx.imageSmoothingEnabled=false; cctx.clearRect(0,0,SIZE,SIZE); cctx.drawImage(img,0,0);
    state.pixels = new Uint8ClampedArray(cctx.getImageData(0,0,SIZE,SIZE).data); state.title=file.name.replace(/\.png$/i,''); state.history=[];state.historyIndex=-1;saveHistory();els.docStatus.textContent=state.title;renderAll();toast('Skin imported.'); URL.revokeObjectURL(url);
  };
  img.onerror=()=>{toast('Could not read that image.');URL.revokeObjectURL(url)};
  img.src=url;
}

function zoomBy(dir){ state.zoom=Math.max(1,Math.min(32,state.zoom+dir)); renderEditor(); }
function resetZoom(){ state.zoom=10; renderEditor(); }
function toast(message){ const el=document.createElement('div'); el.className='toast';el.textContent=message;els.toastRegion.appendChild(el);setTimeout(()=>el.remove(),2200); }

function bind(){
  document.querySelectorAll('.tool-btn').forEach(b=>b.addEventListener('click',()=>setTool(b.dataset.tool)));
  els.colorInput.addEventListener('input',e=>setColor(e.target.value));
  els.hexInput.addEventListener('input',e=>{ const v=e.target.value.replace(/[^0-9a-f]/gi,'').slice(0,6); e.target.value=v.toUpperCase(); if(v.length===6)setColor('#'+v,false); });
  document.querySelector('#undoBtn').addEventListener('click',undo); document.querySelector('#redoBtn').addEventListener('click',redo);
  document.querySelector('#zoomInBtn').addEventListener('click',()=>zoomBy(1)); document.querySelector('#zoomOutBtn').addEventListener('click',()=>zoomBy(-1)); document.querySelector('#fitBtn').addEventListener('click',resetZoom);
  document.querySelector('#gridBtn').addEventListener('click',()=>{state.grid=!state.grid;els.gridToggle.checked=state.grid;renderEditor()});
  document.querySelector('#checkerBtn').addEventListener('click',()=>{state.checker=!state.checker;els.checkerToggle.checked=state.checker;renderEditor()});
  els.gridToggle.addEventListener('change',e=>{state.grid=e.target.checked;renderEditor()});
  els.checkerToggle.addEventListener('change',e=>{state.checker=e.target.checked;renderEditor()});
  els.mirrorToggle.addEventListener('change',e=>state.mirror=e.target.checked);
  document.querySelector('#exportBtn').addEventListener('click',downloadSkin);
  document.querySelector('#importBtn').addEventListener('click',()=>els.fileInput.click()); els.fileInput.addEventListener('change',e=>importSkin(e.target.files[0]));
  document.querySelector('#newSkinBtn').addEventListener('click',()=>{ if(confirm('Create a new starter skin? Unsaved changes will be replaced.')){state.title='Untitled skin';els.docStatus.textContent=state.title;state.history=[];state.historyIndex=-1;createBlankSkin();renderAll();toast('New skin created.');} });
  document.querySelector('#clearHistoryBtn').addEventListener('click',()=>{state.recentColors=[DEFAULT_COLOR];renderPalettes();});
  els.canvas.addEventListener('pointerdown',pointerDown); els.canvas.addEventListener('pointermove',pointerMove); els.canvas.addEventListener('pointerup',pointerUp); els.canvas.addEventListener('pointercancel',pointerUp); els.canvas.addEventListener('contextmenu',e=>e.preventDefault());
  els.previewCanvas.addEventListener('pointerdown',e=>{previewState.dragging=true;previewState.startX=e.clientX;previewState.startRot=state.previewRotY;els.previewCanvas.setPointerCapture?.(e.pointerId);});
  els.previewCanvas.addEventListener('pointermove',e=>{if(!previewState.dragging)return;state.previewRotY=previewState.startRot+(e.clientX-previewState.startX)*.6;renderPreview();});
  els.previewCanvas.addEventListener('pointerup',()=>previewState.dragging=false); els.previewCanvas.addEventListener('pointercancel',()=>previewState.dragging=false);
  document.querySelector('#frontBtn').addEventListener('click',()=>{state.previewRotY=0;renderPreview()}); document.querySelector('#backBtn').addEventListener('click',()=>{state.previewRotY=180;renderPreview()}); document.querySelector('#resetViewBtn').addEventListener('click',()=>{state.previewRotY=28;renderPreview()});
  window.addEventListener('resize',()=>renderAll());
  window.addEventListener('keydown',e=>{
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();undo();}
    else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo();}
    else if(['1','2','3','4','5','6'].includes(e.key)){setTool(['pencil','eraser','fill','picker','line','rect'][Number(e.key)-1]);}
  });
}

function updateTitle(){ els.docStatus.textContent=state.title; }

bind();
setColor(DEFAULT_COLOR,false);
updateTitle();
createBlankSkin();
renderAll();
