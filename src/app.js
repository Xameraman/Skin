const SIZE = 64;
const HISTORY_LIMIT = 100;
const DEFAULT_COLOR = '#7FD7FF';

const $ = (q) => document.querySelector(q);
const $$ = (q) => [...document.querySelectorAll(q)];

const els = {
  html: document.documentElement,
  canvas: $('#editorCanvas'),
  wrap: $('#canvasWrap'),
  previewCanvas: $('#previewCanvas'),
  colorInput: $('#colorInput'),
  hexInput: $('#hexInput'),
  swatches: $('#swatches'),
  quickColors: $('#quickColors'),
  zoomReadout: $('#zoomReadout'),
  activeToolLabel: $('#activeToolLabel'),
  cursorReadout: $('#cursorReadout'),
  docStatus: $('#docStatus'),
  checks: $('#checks'),
  toastRegion: $('#toastRegion'),
  themeSelect: $('#themeSelect'),
  skinFileInput: $('#skinFileInput'),
  referenceFileInput: $('#referenceFileInput'),
  referenceChip: $('#referenceChip'),
  referenceText: $('#referenceText'),
  brushSize: $('#brushSize'),
  brushSizeValue: $('#brushSizeValue'),
  brushOpacity: $('#brushOpacity'),
  brushOpacityValue: $('#brushOpacityValue'),
  replaceTolerance: $('#replaceTolerance'),
  toleranceValue: $('#toleranceValue'),
  shadeMode: $('#shadeMode'),
  referenceOpacity: $('#referenceOpacity'),
  referenceOpacityValue: $('#referenceOpacityValue'),
  animationStatus: $('#animationStatus'),
  animationSelect: $('#animationSelect'),
  animationSpeed: $('#animationSpeed'),
  animationSpeedValue: $('#animationSpeedValue'),
  modelSelect: $('#modelSelect'),
  outerToggle: $('#outerToggle'),
  referenceToggle: $('#referenceToggle'),
  geometryToggle: $('#geometryToggle'),
};

const ctx = els.canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const textureCanvas = document.createElement('canvas');
textureCanvas.width = SIZE; textureCanvas.height = SIZE;
const textureCtx = textureCanvas.getContext('2d', { willReadFrequently: true });
textureCtx.imageSmoothingEnabled = false;

const state = {
  pixels: new Uint8ClampedArray(SIZE * SIZE * 4),
  model: 'classic',
  tool: 'pencil',
  color: DEFAULT_COLOR,
  brushSize: 1,
  brushOpacity: 1,
  brushShape: 'square',
  shadeMode: 'lighten',
  replaceTolerance: 0,
  grid: true,
  checker: true,
  mirror: false,
  outer: true,
  zoom: 1,
  panX: 0,
  panY: 0,
  title: 'Complete Classic Starter',
  history: [],
  historyIndex: -1,
  recentColors: [DEFAULT_COLOR, '#FFFFFF', '#191E26', '#EF6675', '#FFC764', '#9AF0CF', '#708BFF', '#B68CFF', '#6CE0D5', '#F28BA8', '#A6B7C7', '#596474', '#7B4E3A', '#C98E5B', '#3B6D8C', '#273442'],
  reference: null,
  referenceVisible: false,
  referenceOpacity: .35,
  drawing: false,
  strokeBefore: null,
  strokeChanged: false,
  dragStart: null,
  activePointers: new Map(),
  editorGesture: null,
  geometry: { enabled:false, w:4, h:4, d:4, x:0, y:10, z:0, rx:0, ry:0, rz:0 },
};

let editorFrame = 0;
let preview = null;

function hexToRgba(hex, alpha = 255) {
  const clean = String(hex).replace(/^#/, '').trim();
  const value = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return null;
  const n = Number.parseInt(value, 16);
  return [(n >>> 16) & 255, (n >>> 8) & 255, n & 255, alpha];
}
function rgbaToHex(r,g,b) { return [r,g,b].map(v => v.toString(16).padStart(2,'0')).join('').toUpperCase(); }
function indexFor(x,y){ return (y * SIZE + x) * 4; }
function getPixel(x,y){ if(x<0||y<0||x>=SIZE||y>=SIZE) return [0,0,0,0]; const i=indexFor(x,y); return [state.pixels[i],state.pixels[i+1],state.pixels[i+2],state.pixels[i+3]]; }
function colorsEqual(a,b){ return a[0]===b[0]&&a[1]===b[1]&&a[2]===b[2]&&a[3]===b[3]; }
function clamp(v,min,max){ return Math.max(min,Math.min(max,v)); }
function setPixel(x,y,rgba){ if(x<0||y<0||x>=SIZE||y>=SIZE)return false; const i=indexFor(x,y); if(colorsEqual([state.pixels[i],state.pixels[i+1],state.pixels[i+2],state.pixels[i+3]],rgba)) return false; state.pixels[i]=rgba[0]; state.pixels[i+1]=rgba[1]; state.pixels[i+2]=rgba[2]; state.pixels[i+3]=rgba[3]; return true; }
function paintRect(x,y,w,h,hex,alpha=255){ const c=hexToRgba(hex,alpha); if(!c)return; for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)setPixel(xx,yy,c); }
function pixelsToImageData(){ return new ImageData(new Uint8ClampedArray(state.pixels),SIZE,SIZE); }

function setColor(hex, addRecent = true){
  const rgba=hexToRgba(hex); if(!rgba)return;
  state.color='#'+rgbaToHex(rgba[0],rgba[1],rgba[2]);
  els.colorInput.value=state.color; els.hexInput.value=state.color.slice(1);
  if(addRecent){ state.recentColors=[state.color,...state.recentColors.filter(c=>c!==state.color)].slice(0,16); renderPalettes(); }
}

function layout(model = state.model){
  const slim=model==='slim';
  const armW=slim?3:4;
  const face=(x,y,w,h)=>({x,y,w,h});
  const cube=(name,w,h,d,regions)=>({name,w,h,d,regions});
  return {
    head:cube('Head',8,8,8,{top:face(8,0,8,8),bottom:face(16,0,8,8),left:face(0,8,8,8),front:face(8,8,8,8),right:face(16,8,8,8),back:face(24,8,8,8)}),
    body:cube('Body',8,12,4,{top:face(20,16,8,4),bottom:face(28,16,8,4),left:face(16,20,4,12),front:face(20,20,8,12),right:face(28,20,4,12),back:face(32,20,8,12)}),
    rightLeg:cube('Right Leg',4,12,4,{top:face(4,16,4,4),bottom:face(8,16,4,4),left:face(0,20,4,12),front:face(4,20,4,12),right:face(8,20,4,12),back:face(12,20,4,12)}),
    rightArm:cube('Right Arm',armW,12,4,{top:face(44,16,armW,4),bottom:face(44+armW,16,armW,4),left:face(40,20,4,12),front:face(44,20,armW,12),right:face(44+armW,20,4,12),back:face(48+armW,20,armW,12)}),
    leftLeg:cube('Left Leg',4,12,4,{top:face(20,48,4,4),bottom:face(24,48,4,4),left:face(16,52,4,12),front:face(20,52,4,12),right:face(24,52,4,12),back:face(28,52,4,12)}),
    leftArm:cube('Left Arm',armW,12,4,{top:face(36,48,armW,4),bottom:face(36+armW,48,armW,4),left:face(32,52,4,12),front:face(36,52,armW,12),right:face(36+armW,52,4,12),back:face(40+armW,52,armW,12)}),
    outerHead:cube('Head Outer',8.75,8.75,8.75,{top:face(40,0,8,8),bottom:face(48,0,8,8),left:face(32,8,8,8),front:face(40,8,8,8),right:face(48,8,8,8),back:face(56,8,8,8)}),
    outerBody:cube('Body Outer',8.75,12.75,4.75,{top:face(20,32,8,4),bottom:face(28,32,8,4),left:face(16,36,4,12),front:face(20,36,8,12),right:face(28,36,4,12),back:face(32,36,8,12)}),
    outerRightLeg:cube('Right Leg Outer',4.75,12.75,4.75,{top:face(4,32,4,4),bottom:face(8,32,4,4),left:face(0,36,4,12),front:face(4,36,4,12),right:face(8,36,4,12),back:face(12,36,4,12)}),
    outerRightArm:cube('Right Arm Outer',armW+.75,12.75,4.75,{top:face(44,32,armW,4),bottom:face(44+armW,32,armW,4),left:face(40,36,4,12),front:face(44,36,armW,12),right:face(44+armW,36,4,12),back:face(48+armW,36,armW,12)}),
    outerLeftLeg:cube('Left Leg Outer',4.75,12.75,4.75,{top:face(4,48,4,4),bottom:face(8,48,4,4),left:face(0,52,4,12),front:face(4,52,4,12),right:face(8,52,4,12),back:face(12,52,4,12)}),
    outerLeftArm:cube('Left Arm Outer',armW+.75,12.75,4.75,{top:face(52,48,armW,4),bottom:face(52+armW,48,armW,4),left:face(48,52,4,12),front:face(52,52,armW,12),right:face(52+armW,52,4,12),back:face(56+armW,52,armW,12)}),
    armW,
  };
}

function starterTemplate(model=state.model){
  state.pixels.fill(0);
  const L=layout(model);
  const skin='#D8A177', skinShade='#B97654', hair='#3A2418', hairHi='#5B3827', shirt='#3F76B5', shirtHi='#6598CF', pants='#354250', pantsHi='#4A5A6B', shoes='#20252B';
  const pr=(r,c,a=255)=>paintRect(r.x,r.y,r.w,r.h,c,a);
  // Head
  ['front','right'].forEach(k=>pr(L.head.regions[k],skin));
  ['left','bottom'].forEach(k=>pr(L.head.regions[k],skinShade));
  ['top','back'].forEach(k=>pr(L.head.regions[k],hair));
  paintRect(10,11,1,2,'#2B2020'); paintRect(13,11,1,2,'#2B2020'); paintRect(11,13,2,1,'#A85E54');
  // Body
  ['front','right','back','bottom'].forEach(k=>pr(L.body.regions[k],shirt)); pr(L.body.regions.left,shirtHi); pr(L.body.regions.top,shirtHi);
  // Arms
  ['rightArm','leftArm'].forEach(k=>{const a=L[k];pr(a.regions.front,shirt);pr(a.regions.back,shirt);pr(a.regions.top,shirtHi);pr(a.regions.bottom,shirt);pr(a.regions.left,skin);pr(a.regions.right,skinShade);});
  // Legs
  ['rightLeg','leftLeg'].forEach(k=>{const leg=L[k];Object.keys(leg.regions).forEach(face=>pr(leg.regions[face],pants));pr(leg.regions.top,pantsHi);});
  ['rightLeg','leftLeg'].forEach(k=>{const r=L[k].regions.front;paintRect(r.x,r.y+r.h-3,r.w,3,shoes); const l=L[k].regions.left;paintRect(l.x,l.y+l.h-3,l.w,3,shoes);});
  // Outer layer: intentionally subtle, with hair and jacket panels.
  ['top','back','left','right'].forEach(k=>pr(L.outerHead.regions[k],hairHi));
  pr(L.outerBody.regions.front,'#214E78',220); pr(L.outerBody.regions.left,'#1A415F',220); pr(L.outerBody.regions.right,'#17394F',220);
  ['outerRightArm','outerLeftArm'].forEach(k=>{pr(L[k].regions.front,'#244F72',200);pr(L[k].regions.top,shirtHi,180);});
  ['outerRightLeg','outerLeftLeg'].forEach(k=>pr(L[k].regions.front,shoes,220));
  state.title=model==='slim'?'Complete Slim Starter':'Complete Classic Starter';
  els.docStatus.textContent=state.title;
  state.history=[]; state.historyIndex=-1; saveHistory();
}

function saveHistory(){
  const snap=new Uint8ClampedArray(state.pixels);
  if(state.historyIndex<state.history.length-1) state.history=state.history.slice(0,state.historyIndex+1);
  state.history.push(snap); if(state.history.length>HISTORY_LIMIT)state.history.shift(); state.historyIndex=state.history.length-1;
}
function restoreHistory(i){ if(i<0||i>=state.history.length)return; state.pixels.set(state.history[i]); state.historyIndex=i; scheduleRender(); }
function undo(){restoreHistory(state.historyIndex-1);} function redo(){restoreHistory(state.historyIndex+1);}

function blendPixel(x,y,color){
  if(x<0||y<0||x>=SIZE||y>=SIZE)return false;
  const srcA=color[3]/255; if(srcA<=0)return false;
  const dst=getPixel(x,y); const dstA=dst[3]/255; const outA=srcA+dstA*(1-srcA);
  const out=[0,0,0,Math.round(outA*255)];
  if(outA>0){ out[0]=Math.round((color[0]*srcA+dst[0]*dstA*(1-srcA))/outA); out[1]=Math.round((color[1]*srcA+dst[1]*dstA*(1-srcA))/outA); out[2]=Math.round((color[2]*srcA+dst[2]*dstA*(1-srcA))/outA); }
  return setPixel(x,y,out);
}
function brushPoints(cx,cy,size,shape){
  const out=[]; const radius=(size-1)/2; const minX=Math.floor(cx-radius), maxX=Math.ceil(cx+radius), minY=Math.floor(cy-radius), maxY=Math.ceil(cy+radius);
  for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
    if(shape==='circle'){const dx=x-cx,dy=y-cy;if(Math.hypot(dx,dy)>Math.max(.55,radius+.5))continue;}
    out.push([x,y]);
  }
  return out;
}
function applyBrush(x,y,erase=false){
  const baseColor=hexToRgba(state.color,Math.round(state.brushOpacity*255)); let changed=false;
  for(const [px,py] of brushPoints(x,y,state.brushSize,state.brushShape)){
    if(state.mirror){ const pair=[[px,py],[SIZE-1-px,py]]; for(const [qx,qy] of pair) changed=(erase?setPixel(qx,qy,[0,0,0,0]):blendPixel(qx,qy,baseColor))||changed; }
    else changed=(erase?setPixel(px,py,[0,0,0,0]):blendPixel(px,py,baseColor))||changed;
  }
  return changed;
}
function fillRegion(sx,sy,target,replacement){
  if(colorsEqual(target,replacement))return false; const stack=[[sx,sy]],seen=new Uint8Array(SIZE*SIZE);let changed=false;
  while(stack.length){const [x,y]=stack.pop();if(x<0||y<0||x>=SIZE||y>=SIZE)continue;const k=y*SIZE+x;if(seen[k])continue;seen[k]=1;const p=getPixel(x,y);if(!colorsEqual(p,target))continue;changed=setPixel(x,y,replacement)||changed;stack.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);}
  return changed;
}
function linePixels(x0,y0,x1,y1){const out=[];let dx=Math.abs(x1-x0),dy=Math.abs(y1-y0),sx=x0<x1?1:-1,sy=y0<y1?1:-1,err=dx-dy;while(true){out.push([x0,y0]);if(x0===x1&&y0===y1)break;const e2=2*err;if(e2>-dy){err-=dy;x0+=sx;}if(e2<dx){err+=dx;y0+=sy;}}return out;}
function circlePixels(x0,y0,x1,y1){const out=[];const cx=(x0+x1)/2,cy=(y0+y1)/2,rx=Math.abs(x1-x0)/2,ry=Math.abs(y1-y0)/2;const steps=Math.max(16,Math.ceil(2*Math.PI*Math.max(rx,ry)*2));for(let i=0;i<=steps;i++){const a=i/steps*Math.PI*2;const x=Math.round(cx+Math.cos(a)*rx),y=Math.round(cy+Math.sin(a)*ry);out.push([x,y]);}return [...new Map(out.map(p=>[p.join(','),p])).values()];}
function applyShape(x0,y0,x1,y1,tool){let changed=false;const apply=(x,y)=>{if(state.tool==='eraser')changed=applyBrush(x,y,true)||changed;else changed=applyBrush(x,y,false)||changed;};const points=tool==='line'?linePixels(x0,y0,x1,y1):tool==='circle'?circlePixels(x0,y0,x1,y1):null;if(points){points.forEach(([x,y])=>apply(x,y));return changed;}const minX=Math.min(x0,x1),maxX=Math.max(x0,x1),minY=Math.min(y0,y1),maxY=Math.max(y0,y1);for(let x=minX;x<=maxX;x++){apply(x,minY);apply(x,maxY);}for(let y=minY;y<=maxY;y++){apply(minX,y);apply(maxX,y);}return changed;}
function adjustShade(p,mode){const f=mode==='lighten'?1.18:.82;return [clamp(Math.round(p[0]*f),0,255),clamp(Math.round(p[1]*f),0,255),clamp(Math.round(p[2]*f),0,255),p[3]];}
function replaceColor(startX,startY){const target=getPixel(startX,startY);const replacement=hexToRgba(state.color,Math.round(state.brushOpacity*255));const tol=state.replaceTolerance;let changed=false;for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){const p=getPixel(x,y);const d=Math.max(Math.abs(p[0]-target[0]),Math.abs(p[1]-target[1]),Math.abs(p[2]-target[2]),Math.abs(p[3]-target[3]));if(d<=tol)changed=setPixel(x,y,replacement)||changed;}return changed;}

function toolAtPixel(x,y){
  if(state.tool==='picker'){const p=getPixel(x,y);if(p[3]>0)setColor('#'+rgbaToHex(p[0],p[1],p[2]));return false;}
  if(state.tool==='fill')return fillRegion(x,y,getPixel(x,y),hexToRgba(state.color,Math.round(state.brushOpacity*255)));
  if(state.tool==='shade')return setPixel(x,y,adjustShade(getPixel(x,y),state.shadeMode));
  if(state.tool==='replace')return replaceColor(x,y);
  if(state.tool==='eraser')return applyBrush(x,y,true);
  return applyBrush(x,y,false);
}

function getFitPixelSize(){const r=els.canvas.getBoundingClientRect();return Math.max(1,(Math.min(r.width,r.height)*.82)/SIZE);}
function textureToCanvasPoint(x,y){const r=els.canvas.getBoundingClientRect();const fit=getFitPixelSize();const px=fit*state.zoom;return {x:r.width/2+state.panX+(x-SIZE/2)*px,y:r.height/2+state.panY+(y-SIZE/2)*px};}
function eventToPixel(e){const r=els.canvas.getBoundingClientRect();const fit=getFitPixelSize();const px=fit*state.zoom;let x=((e.clientX-r.left)-(r.width/2+state.panX))/px+SIZE/2;let y=((e.clientY-r.top)-(r.height/2+state.panY))/px+SIZE/2;return {x:Math.floor(x),y:Math.floor(y)};}
function pointInCanvas(e){const r=els.canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}
function clampPan(){const r=els.canvas.getBoundingClientRect();const fit=getFitPixelSize();const px=fit*state.zoom;const texW=SIZE*px;const maxX=Math.max(0,(texW-r.width)/2+px*2);const maxY=Math.max(0,(texW-r.height)/2+px*2);state.panX=clamp(state.panX,-maxX,maxX);state.panY=clamp(state.panY,-maxY,maxY);}
function zoomAt(localX,localY,newZoom){const r=els.canvas.getBoundingClientRect();const oldPx=getFitPixelSize()*state.zoom;const oldTx=(localX-(r.width/2+state.panX))/oldPx+SIZE/2;const oldTy=(localY-(r.height/2+state.panY))/oldPx+SIZE/2;state.zoom=clamp(newZoom,.35,12);const newPx=getFitPixelSize()*state.zoom;state.panX=localX-r.width/2-(oldTx-SIZE/2)*newPx;state.panY=localY-r.height/2-(oldTy-SIZE/2)*newPx;clampPan();scheduleRender();}
function fitCanvas(){state.zoom=1;state.panX=0;state.panY=0;scheduleRender();}
function resetCenter(){state.panX=0;state.panY=0;scheduleRender();}

function drawChecker(target,w,h,cell){target.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--bg-2').trim()||'#0d1118';target.fillRect(0,0,w,h);target.fillStyle='rgba(120,130,145,.09)';for(let y=0;y<h;y+=cell)for(let x=0;x<w;x+=cell)if(((x/cell+y/cell)&1)===0)target.fillRect(x,y,cell,cell);}
function drawReference(){if(!state.reference||!state.referenceVisible)return;const r=els.canvas.getBoundingClientRect();const x=r.width/2+state.panX,y=r.height/2+state.panY,size=getFitPixelSize()*state.zoom*SIZE;ctx.save();ctx.globalAlpha=state.referenceOpacity;ctx.imageSmoothingEnabled=true;const ratio=state.reference.width/state.reference.height;let dw=size,dh=size;if(ratio>1)dh=size/ratio;else dw=size*ratio;ctx.drawImage(state.reference,x-dw/2,y-dh/2,dw,dh);ctx.restore();}
function renderEditor(){
  const r=els.canvas.getBoundingClientRect();const dpr=Math.min(window.devicePixelRatio||1,2);const w=Math.max(320,Math.round(r.width*dpr)),h=Math.max(320,Math.round(r.height*dpr));
  if(els.canvas.width!==w||els.canvas.height!==h){els.canvas.width=w;els.canvas.height=h;}
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,r.width,r.height);
  if(state.checker)drawChecker(ctx,r.width,r.height,16);else{ctx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()||'#080b10';ctx.fillRect(0,0,r.width,r.height);}
  drawReference();
  textureCtx.putImageData(pixelsToImageData(),0,0);
  const fit=getFitPixelSize(),px=fit*state.zoom, size=SIZE*px;const ox=r.width/2+state.panX-size/2,oy=r.height/2+state.panY-size/2;
  ctx.save();ctx.imageSmoothingEnabled=false;ctx.drawImage(textureCanvas,ox,oy,size,size);
  if(state.grid&&px>=5){ctx.globalAlpha=Math.min(.26,.06+(px-5)*.015);ctx.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue('--muted').trim()||'#87919e';ctx.lineWidth=1;ctx.beginPath();for(let i=0;i<=SIZE;i++){const gx=ox+i*px+.5;ctx.moveTo(gx,oy);ctx.lineTo(gx,oy+size);const gy=oy+i*px+.5;ctx.moveTo(ox,gy);ctx.lineTo(ox+size,gy);}ctx.stroke();}
  ctx.strokeStyle='rgba(255,255,255,.18)';ctx.lineWidth=1;ctx.strokeRect(ox+.5,oy+.5,size-1,size-1);ctx.restore();
  els.zoomReadout.textContent=`${Math.round(state.zoom*100)}%`;
}
function scheduleRender(){if(editorFrame)return;editorFrame=requestAnimationFrame(()=>{editorFrame=0;renderEditor();renderPalettes();renderChecks();if(preview)preview.update(state.pixels,state.outer);});}

function renderPalettes(){
  els.swatches.innerHTML=state.recentColors.map(c=>`<button class="swatch" style="background:${c}" data-color="${c}" title="${c}"></button>`).join('');
  els.quickColors.innerHTML=state.recentColors.slice(0,8).map(c=>`<button class="swatch" style="background:${c}" data-color="${c}" title="${c}"></button>`).join('');
  $$('.swatch').forEach(b=>b.addEventListener('click',()=>setColor(b.dataset.color)));
}
function countAlpha(){let n=0;for(let i=3;i<state.pixels.length;i+=4)if(state.pixels[i]>0)n++;return n;}
function renderChecks(){
  const alpha=countAlpha();const items=[
    [true,'64×64 texture buffer'],
    [alpha>0,'Skin texture contains pixels'],
    [preview?.ready===true, preview?.modelName ? `${preview.modelName} UV model loaded` : '3D preview available'],
    [state.historyIndex>=0,'Undo history ready'],
    [state.reference ? true : false,state.reference ? 'Reference image loaded' : 'No reference image'],
    [state.model==='classic'?true:true,state.model==='classic'?'Classic 4px arms selected':'Slim 3px arms selected'],
  ];
  els.checks.innerHTML=items.map(([ok,label])=>`<div class="check ${ok?'ok':'warn'}"><span class="check-icon">${ok?'✓':'!'}</span><span>${label}</span></div>`).join('');
}

function bindBrushControls(){
  els.brushSize.addEventListener('input',()=>{state.brushSize=+els.brushSize.value;els.brushSizeValue.textContent=`${state.brushSize} px`;});
  els.brushOpacity.addEventListener('input',()=>{state.brushOpacity=+els.brushOpacity.value/100;els.brushOpacityValue.textContent=`${els.brushOpacity.value}%`;});
  els.replaceTolerance.addEventListener('input',()=>{state.replaceTolerance=+els.replaceTolerance.value;els.toleranceValue.textContent=String(state.replaceTolerance);});
  els.shadeMode.addEventListener('change',()=>state.shadeMode=els.shadeMode.value);
  $$('.seg').forEach(b=>b.addEventListener('click',()=>{$$('.seg').forEach(x=>x.classList.remove('active'));b.classList.add('active');state.brushShape=b.dataset.brushShape;}));
}

function editorPointerDown(e){
  if(e.pointerType==='mouse'&&e.button===2){e.preventDefault();const p=eventToPixel(e);const c=getPixel(p.x,p.y);if(c[3]>0)setColor('#'+rgbaToHex(c[0],c[1],c[2]));return;}
  if(e.pointerType==='mouse'&&e.button!==0)return;
  els.canvas.setPointerCapture?.(e.pointerId);state.activePointers.set(e.pointerId,{x:e.clientX,y:e.clientY,type:e.pointerType});
  if(state.activePointers.size===2){state.drawing=false;restoreStrokeForGesture();beginEditorGesture();return;}
  if(state.activePointers.size>2)return;
  const p=eventToPixel(e);els.cursorReadout.textContent=`X: ${clamp(p.x,0,63)} Y: ${clamp(p.y,0,63)}`;state.drawing=true;state.strokeBefore=new Uint8ClampedArray(state.pixels);state.strokeChanged=false;state.dragStart={x:p.x,y:p.y};
  if(state.tool==='line'||state.tool==='rect'||state.tool==='circle')return;
  if(toolAtPixel(p.x,p.y))state.strokeChanged=true;scheduleRender();
}
function restoreStrokeForGesture(){if(state.strokeBefore)state.pixels.set(state.strokeBefore);state.strokeBefore=null;state.strokeChanged=false;state.dragStart=null;}
function getTwoPointerData(){const pts=[...state.activePointers.values()];if(pts.length<2)return null;const a=pts[0],b=pts[1];return {distance:Math.hypot(a.x-b.x,a.y-b.y),mid:{x:(a.x+b.x)/2,y:(a.y+b.y)/2}};}
function beginEditorGesture(){const t=getTwoPointerData();if(!t)return;const p=pointInCanvas({clientX:t.mid.x,clientY:t.mid.y});state.editorGesture={distance:t.distance||1,mid:t.mid,zoom:state.zoom,panX:state.panX,panY:state.panY,localX:p.x,localY:p.y};}
function editorPointerMove(e){
  if(state.activePointers.has(e.pointerId))state.activePointers.set(e.pointerId,{x:e.clientX,y:e.clientY,type:e.pointerType});
  if(state.activePointers.size>=2){const t=getTwoPointerData();if(!state.editorGesture)beginEditorGesture();const g=state.editorGesture;if(!t||!g)return;const factor=t.distance/g.distance;zoomAt(g.localX,g.localY,g.zoom*factor);state.panX=g.panX+(t.mid.x-g.mid.x);state.panY=g.panY+(t.mid.y-g.mid.y);clampPan();scheduleRender();return;}
  if(!state.drawing)return;const p=eventToPixel(e);els.cursorReadout.textContent=`X: ${clamp(p.x,0,63)} Y: ${clamp(p.y,0,63)}`;if(state.tool==='pencil'||state.tool==='brush'||state.tool==='eraser'){const from=state.dragStart||p;for(const [x,y] of linePixels(from.x,from.y,p.x,p.y))if(toolAtPixel(x,y))state.strokeChanged=true;state.dragStart=p;}scheduleRender();
}
function editorPointerUp(e){state.activePointers.delete(e.pointerId);if(state.activePointers.size>=2)return;if(state.editorGesture){state.editorGesture=null;return;}if(!state.drawing)return;const p=eventToPixel(e);if(state.tool==='line'||state.tool==='rect'||state.tool==='circle')state.strokeChanged=applyShape(state.dragStart.x,state.dragStart.y,p.x,p.y,state.tool)||state.strokeChanged;state.drawing=false;state.dragStart=null;if(state.strokeChanged)saveHistory();scheduleRender();}

function editorWheel(e){e.preventDefault();const local=pointInCanvas(e);const factor=e.deltaY<0?1.15:.87;zoomAt(local.x,local.y,state.zoom*factor);}

function loadReference(file){
  if(!file)return;const img=new Image();img.onload=()=>{state.reference=img;state.referenceVisible=true;els.referenceToggle.checked=true;els.referenceChip.hidden=false;els.referenceText.textContent=`Reference: ${file.name} (${img.width}×${img.height}). It stays behind your texture and does not change the exported PNG.`;URL.revokeObjectURL(img.src);scheduleRender();toast('Reference image loaded.');};img.onerror=()=>{toast('Could not read that image.');URL.revokeObjectURL(img.src);};img.src=URL.createObjectURL(file);
}
function importSkin(file){
  if(!file)return;const img=new Image();img.onload=()=>{if(img.width!==64||img.height!==64){toast(`That image is ${img.width}×${img.height}. Import Skin needs an exact 64×64 texture; use Reference for screenshots/photos.`);loadReference(file);return;}const c=document.createElement('canvas');c.width=64;c.height=64;const cctx=c.getContext('2d',{willReadFrequently:true});cctx.imageSmoothingEnabled=false;cctx.drawImage(img,0,0);state.pixels.set(cctx.getImageData(0,0,64,64).data);state.title=file.name.replace(/\.png$/i,'')||'Imported skin';els.docStatus.textContent=state.title;state.history=[];state.historyIndex=-1;saveHistory();scheduleRender();toast('Skin imported. The 3D preview now uses this texture.');URL.revokeObjectURL(img.src);};img.onerror=()=>{toast('Could not read that PNG.');URL.revokeObjectURL(img.src);};img.src=URL.createObjectURL(file);
}
function useReferenceAsSkin(){
  if(!state.reference)return toast('Add a reference image first.');
  if(state.reference.width!==64||state.reference.height!==64)return toast('That image is not 64×64, so it would not be a reliable Minecraft skin texture. Trace it or import the actual 64×64 PNG instead.');
  const c=document.createElement('canvas');c.width=64;c.height=64;const cctx=c.getContext('2d');cctx.drawImage(state.reference,0,0);state.pixels.set(cctx.getImageData(0,0,64,64).data);state.title='Reference skin';els.docStatus.textContent=state.title;state.history=[];state.historyIndex=-1;saveHistory();scheduleRender();toast('Reference copied into the editable skin.');
}
function clearReference(){state.reference=null;state.referenceVisible=false;els.referenceToggle.checked=false;els.referenceChip.hidden=true;els.referenceText.textContent='Upload a screenshot/photo to use as a translucent drawing reference. A valid 64×64 PNG should be imported with Import Skin so it stays game-accurate.';scheduleRender();}

function exportPng(){const out=document.createElement('canvas');out.width=64;out.height=64;out.getContext('2d').putImageData(pixelsToImageData(),0,0);out.toBlob(blob=>{const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`${slugify(state.title||'nova-skin')}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('PNG exported.');},'image/png');}
function exportPixelsPng(pixels,filename){const out=document.createElement('canvas');out.width=64;out.height=64;out.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(pixels),64,64),0,0);out.toBlob(blob=>{const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},'image/png');}
function downloadStarter(){const current=new Uint8ClampedArray(state.pixels);const h=state.history.map(s=>new Uint8ClampedArray(s));const hi=state.historyIndex;const t=state.title;starterTemplate(state.model);const p=new Uint8ClampedArray(state.pixels);state.pixels.set(current);state.history=h;state.historyIndex=hi;state.title=t;els.docStatus.textContent=t;exportPixelsPng(p,state.model==='slim'?'complete-slim-template.png':'complete-classic-template.png');scheduleRender();toast('Starter template downloaded.');}

function renderGuide(){
  const c=$('#guideCanvas'),g=c.getContext('2d');const s=c.width/64;g.clearRect(0,0,c.width,c.height);g.fillStyle='#0a0e14';g.fillRect(0,0,c.width,c.height);const L=layout(state.model);const parts=[['HEAD',L.head,'#73d4ff'],['BODY',L.body,'#9af0cf'],['R LEG',L.rightLeg,'#ffbf7b'],['R ARM',L.rightArm,'#b896ff'],['L LEG',L.leftLeg,'#ff7da0'],['L ARM',L.leftArm,'#ffe37a']];
  for(const [name,part,color] of parts){for(const rect of Object.values(part.regions)){g.fillStyle=color+'16';g.strokeStyle=color;g.lineWidth=Math.max(1,s*.12);g.strokeRect(rect.x*s+.5,rect.y*s+.5,rect.w*s-1,rect.h*s-1);g.fillRect(rect.x*s,rect.y*s,rect.w*s,rect.h*s);}const xs=Object.values(part.regions).map(r=>r.x),ys=Object.values(part.regions).map(r=>r.y),xe=Object.values(part.regions).map(r=>r.x+r.w),ye=Object.values(part.regions).map(r=>r.y+r.h);const minx=Math.min(...xs),miny=Math.min(...ys),maxx=Math.max(...xe),maxy=Math.max(...ye);g.fillStyle=color;g.font=`700 ${Math.max(8,s*1.5)}px system-ui`;g.textAlign='center';g.textBaseline='middle';g.fillText(name,(minx+maxx)/2*s,(miny+maxy)/2*s);}
  g.strokeStyle='rgba(255,255,255,.12)';g.lineWidth=1;g.strokeRect(.5,.5,c.width-1,c.height-1);
}
function openGuide(){renderGuide();$('#guideModal').hidden=false;}function closeGuide(){$('#guideModal').hidden=true;}

function setTool(tool){state.tool=tool;const labels={pencil:'Pencil',brush:'Brush',eraser:'Eraser',fill:'Fill',picker:'Eyedropper',line:'Line',rect:'Rectangle',circle:'Circle',shade:'Shade',replace:'Replace'};els.activeToolLabel.textContent=labels[tool]||tool;$$('.tool-btn').forEach(b=>b.classList.toggle('active',b.dataset.tool===tool));}
function slugify(v){return String(v).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'minecraft-skin';}
function toast(message){const t=document.createElement('div');t.className='toast';t.textContent=message;els.toastRegion.appendChild(t);setTimeout(()=>t.remove(),2500);}

function applyTheme(theme){els.html.dataset.theme=theme;localStorage.setItem('nova-skin-theme',theme);els.themeSelect.value=theme;}
function loadTheme(){applyTheme(localStorage.getItem('nova-skin-theme')||'midnight');}

function readGeometryInputs(){const ids=['W','H','D','X','Y','Z','RX','RY','RZ'];const keys=['w','h','d','x','y','z','rx','ry','rz'];ids.forEach((id,i)=>state.geometry[keys[i]]=parseFloat($(`#geo${id}`).value)||0);}
function writeGeometryInputs(){const map={W:state.geometry.w,H:state.geometry.h,D:state.geometry.d,X:state.geometry.x,Y:state.geometry.y,Z:state.geometry.z,RX:state.geometry.rx,RY:state.geometry.ry,RZ:state.geometry.rz};Object.entries(map).forEach(([k,v])=>$(`#geo${k}`).value=v);}
function resetGeometry(){state.geometry={enabled:false,w:4,h:4,d:4,x:0,y:10,z:0,rx:0,ry:0,rz:0};els.geometryToggle.checked=false;writeGeometryInputs();preview?.renderNow();}
function exportGeometryJSON(){readGeometryInputs();const data={tool:'Nova Skin Studio experimental custom geometry',warning:'This file is a geometry prototype, not a standard Bedrock PNG skin. Compatibility depends on the pack/resource workflow used to load custom geometry.',model:state.model,extraBox:{...state.geometry}};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`${slugify(state.title||'skin')}-experimental-geometry.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Experimental geometry JSON exported.');}

// ------------------------- WebGL preview -------------------------
function mat4Identity(){return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);}
function mat4Mul(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return o;}
function mat4T(x,y,z){const m=mat4Identity();m[12]=x;m[13]=y;m[14]=z;return m;}
function mat4S(x,y,z){const m=mat4Identity();m[0]=x;m[5]=y;m[10]=z;return m;}
function mat4Rx(a){const c=Math.cos(a),s=Math.sin(a);return new Float32Array([1,0,0,0,0,c,s,0,0,-s,c,0,0,0,0,1]);}
function mat4Ry(a){const c=Math.cos(a),s=Math.sin(a);return new Float32Array([c,0,-s,0,0,1,0,0,s,0,c,0,0,0,0,1]);}
function mat4Rz(a){const c=Math.cos(a),s=Math.sin(a);return new Float32Array([c,s,0,0,-s,c,0,0,0,0,1,0,0,0,0,1]);}
function mat4Perspective(fov,aspect,near,far){const f=1/Math.tan(fov/2),nf=1/(near-far),m=new Float32Array(16);m[0]=f/aspect;m[5]=f;m[10]=(far+near)*nf;m[11]=-1;m[14]=2*far*near*nf;return m;}
function mat4LookAt(eye,center,up){let zx=eye[0]-center[0],zy=eye[1]-center[1],zz=eye[2]-center[2];let l=Math.hypot(zx,zy,zz);zx/=l;zy/=l;zz/=l;let xx=up[1]*zz-up[2]*zy,xy=up[2]*zx-up[0]*zz,xz=up[0]*zy-up[1]*zx;l=Math.hypot(xx,xy,xz);xx/=l;xy/=l;xz/=l;const yx=zy*xz-zz*xy,yy=zz*xx-zx*xz,yz=zx*xy-zy*xx;return new Float32Array([xx,yx,zx,0,xy,yy,zy,0,xz,yz,zz,0,-(xx*eye[0]+xy*eye[1]+xz*eye[2]),-(yx*eye[0]+yy*eye[1]+yz*eye[2]),-(zx*eye[0]+zy*eye[1]+zz*eye[2]),1]);}
function addFace(data,p0,p1,p2,p3,uv,normal){const base=data.positions.length/3;[p0,p1,p2,p3].forEach(p=>data.positions.push(...p));const [u0,v0,u1,v1]=uv;data.uvs.push(u0,v1,u1,v1,u1,v0,u0,v0);for(let i=0;i<4;i++)data.normals.push(...normal);data.indices.push(base,base+1,base+2,base,base+2,base+3);}
function uvRect(r){return [r.x/64,r.y/64,(r.x+r.w)/64,(r.y+r.h)/64];}
function cubeMesh(size,uvs){const [w,h,d]=size,hx=w/2,hy=h/2,hz=d/2;const p={positions:[],uvs:[],normals:[],indices:[]};addFace(p,[-hx,-hy,hz],[hx,-hy,hz],[hx,hy,hz],[-hx,hy,hz],uvRect(uvs.front),[0,0,1]);addFace(p,[hx,-hy,-hz],[-hx,-hy,-hz],[-hx,hy,-hz],[hx,hy,-hz],uvRect(uvs.back),[0,0,-1]);addFace(p,[hx,-hy,hz],[hx,-hy,-hz],[hx,hy,-hz],[hx,hy,hz],uvRect(uvs.right),[1,0,0]);addFace(p,[-hx,-hy,-hz],[-hx,-hy,hz],[-hx,hy,hz],[-hx,hy,-hz],uvRect(uvs.left),[-1,0,0]);addFace(p,[-hx,hy,hz],[hx,hy,hz],[hx,hy,-hz],[-hx,hy,-hz],uvRect(uvs.top),[0,1,0]);addFace(p,[-hx,-hy,-hz],[hx,-hy,-hz],[hx,-hy,hz],[-hx,-hy,hz],uvRect(uvs.bottom),[0,-1,0]);return p;}
function shader(gl,type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;}
function programFor(gl){const vs=shader(gl,gl.VERTEX_SHADER,`attribute vec3 aPosition;attribute vec2 aUV;attribute vec3 aNormal;uniform mat4 uViewProj;uniform mat4 uModel;varying vec2 vUV;varying vec3 vNormal;void main(){vUV=aUV;vNormal=mat3(uModel)*aNormal;gl_Position=uViewProj*uModel*vec4(aPosition,1.0);}`);const fs=shader(gl,gl.FRAGMENT_SHADER,`precision mediump float;uniform sampler2D uTexture;uniform vec4 uColor;uniform bool uTextured;varying vec2 vUV;varying vec3 vNormal;void main(){vec4 base=uTextured?texture2D(uTexture,vUV):uColor;if(base.a<0.02)discard;vec3 light=normalize(vec3(.35,.85,.55));float shade=.68+.32*max(dot(normalize(vNormal),light),0.0);gl_FragColor=vec4(base.rgb*shade,base.a);}`);const p=gl.createProgram();gl.attachShader(p,vs);gl.attachShader(p,fs);gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p;}

function makePreview(){
  const gl=els.previewCanvas.getContext('webgl',{alpha:false,antialias:false,powerPreference:'low-power'});
  if(!gl)return {ready:false,modelName:'WebGL unavailable',update(){},renderNow(){},setModel(){},front(){},top(){},back(){},side(){},reset(){}};
  let program;try{program=programFor(gl);}catch(err){console.error(err);return {ready:false,modelName:'Preview shader error',update(){},renderNow(){},setModel(){},front(){},top(){},back(){},side(){},reset(){}};}
  const loc={pos:gl.getAttribLocation(program,'aPosition'),uv:gl.getAttribLocation(program,'aUV'),normal:gl.getAttribLocation(program,'aNormal'),vp:gl.getUniformLocation(program,'uViewProj'),model:gl.getUniformLocation(program,'uModel'),texture:gl.getUniformLocation(program,'uTexture'),color:gl.getUniformLocation(program,'uColor'),textured:gl.getUniformLocation(program,'uTextured')};
  const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
  const skinCanvas=document.createElement('canvas');skinCanvas.width=64;skinCanvas.height=64;const skinCtx=skinCanvas.getContext('2d');skinCtx.imageSmoothingEnabled=false;
  const meshes={};
  const pv={ready:true,modelName:'Classic',yaw:.35,pitch:.12,zoom:1,drag:false,lastX:0,lastY:0,pointers:new Map(),pinch:null,animation:'idle',playing:false,speed:1,animTime:0,lastTime:0};
  function upload(name,mesh){const b={pos:gl.createBuffer(),uv:gl.createBuffer(),normal:gl.createBuffer(),idx:gl.createBuffer(),count:mesh.indices.length};gl.bindBuffer(gl.ARRAY_BUFFER,b.pos);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(mesh.positions),gl.STATIC_DRAW);gl.bindBuffer(gl.ARRAY_BUFFER,b.uv);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(mesh.uvs),gl.STATIC_DRAW);gl.bindBuffer(gl.ARRAY_BUFFER,b.normal);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(mesh.normals),gl.STATIC_DRAW);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,b.idx);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(mesh.indices),gl.STATIC_DRAW);meshes[name]=b;}
  function build(model){const L=layout(model);const parts=[
    ['head',[0,12,0],[8,8,8],L.head.regions,[0,0,0],'head'],
    ['body',[0,2,0],[8,12,4],L.body.regions,[0,0,0],'body'],
    ['rightLeg',[-2,-10,0],[4,12,4],L.rightLeg.regions,[-2,-16,0],'rightLeg'],
    ['leftLeg',[2,-10,0],[4,12,4],L.leftLeg.regions,[2,-16,0],'leftLeg'],
    ['rightArm',[-(4+L.armW/2),1.6,0],[L.armW,12,4],L.rightArm.regions,[-(4+L.armW/2),7.6,0],'rightArm'],
    ['leftArm',[(4+L.armW/2),1.6,0],[L.armW,12,4],L.leftArm.regions,[(4+L.armW/2),7.6,0],'leftArm'],
  ];
  parts.forEach(p=>upload(p[0],cubeMesh(p[2],p[3])));
  const outer=[['headOuter',[0,12,0],L.outerHead],['bodyOuter',[0,2,0],L.outerBody],['rightLegOuter',[-2,-10,0],L.outerRightLeg],['leftLegOuter',[2,-10,0],L.outerLeftLeg],['rightArmOuter',[-(4+L.armW/2),1.6,0],L.outerRightArm],['leftArmOuter',[(4+L.armW/2),1.6,0],L.outerLeftArm]];outer.forEach(p=>upload(p[0],cubeMesh([p[2].w,p[2].h,p[2].d],p[2].regions)));pv.modelName=model==='slim'?'Slim':'Classic';render();}
  build(state.model);
  function resize(){const dpr=Math.min(window.devicePixelRatio||1,1.5);const w=Math.max(240,Math.round(els.previewCanvas.clientWidth*dpr)),h=Math.max(240,Math.round(els.previewCanvas.clientHeight*dpr));if(els.previewCanvas.width!==w||els.previewCanvas.height!==h){els.previewCanvas.width=w;els.previewCanvas.height=h;gl.viewport(0,0,w,h);}}
  function drawMesh(name,modelM,textured,color=[.3,.7,1,1]){const b=meshes[name];if(!b)return;gl.uniformMatrix4fv(loc.model,false,modelM);gl.uniform1i(loc.textured,textured?1:0);gl.uniform4fv(loc.color,new Float32Array(color));gl.bindBuffer(gl.ARRAY_BUFFER,b.pos);gl.enableVertexAttribArray(loc.pos);gl.vertexAttribPointer(loc.pos,3,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ARRAY_BUFFER,b.uv);gl.enableVertexAttribArray(loc.uv);gl.vertexAttribPointer(loc.uv,2,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ARRAY_BUFFER,b.normal);gl.enableVertexAttribArray(loc.normal);gl.vertexAttribPointer(loc.normal,3,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,b.idx);gl.drawElements(gl.TRIANGLES,b.count,gl.UNSIGNED_SHORT,0);}
  function partMatrix(pos,pivot,rx=0,ry=0,rz=0){let m=mat4T(pos[0],pos[1],pos[2]);if(pivot){m=mat4Mul(mat4T(pivot[0],pivot[1],pivot[2]),mat4Mul(mat4Rx(rx),mat4Mul(mat4Ry(ry),mat4Mul(mat4Rz(rz),mat4T(pos[0]-pivot[0],pos[1]-pivot[1],pos[2]-pivot[2])))));}return m;}
  function render(now=performance.now()){
    resize();if(pv.playing){const dt=Math.min(.05,(now-pv.lastTime)/1000||0);pv.animTime+=dt*pv.speed;pv.lastTime=now;}
    gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.clearColor(.035,.045,.06,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,tex);gl.uniform1i(loc.texture,0);
    const aspect=els.previewCanvas.width/els.previewCanvas.height;const pitch=clamp(pv.pitch,-1.1,1.1),dist=46/pv.zoom;const cp=Math.cos(pitch);const eye=[Math.sin(pv.yaw)*cp*dist,Math.sin(pitch)*dist+1,Math.cos(pv.yaw)*cp*dist];const vp=mat4Mul(mat4Perspective(34*Math.PI/180,aspect,.1,200),mat4LookAt(eye,[0,0,0],[0,1,0]));gl.uniformMatrix4fv(loc.vp,false,vp);
    const t=pv.animTime,walk=Math.sin(t*6)*.55,idle=Math.sin(t*1.8)*.035;let armR=idle,armL=-idle,legR=idle,legL=-idle,headY=0,bodyX=0;
    if(pv.animation==='walk'){armR=walk;armL=-walk;legR=-walk;legL=walk;bodyX=Math.sin(t*3)*.025;}
    if(pv.animation==='mine'){armR=-Math.abs(Math.sin(t*5))*1.0;armL=-Math.abs(Math.sin(t*5+Math.PI*.2))*1.0;legR=.03;legL=-.03;headY=Math.sin(t*5)*.06;}
    const parts=[['head',[0,12+headY,0],[0,0,0]],['body',[0,2,0],[bodyX,0,0]],['rightLeg',[-2,-10,0],[legR,0,0]],['leftLeg',[2,-10,0],[legL,0,0]],['rightArm',[-(4+layout(state.model).armW/2),1.6,0],[armR,0,0]],['leftArm',[(4+layout(state.model).armW/2),1.6,0],[armL,0,0]]];
    const pivots={head:null,body:null,rightLeg:[-2,-4,0],leftLeg:[2,-4,0],rightArm:[-(4+layout(state.model).armW/2),7.6,0],leftArm:[(4+layout(state.model).armW/2),7.6,0]};
    parts.forEach(([name,pos,rot])=>drawMesh(name,partMatrix(pos,pivots[name],rot[0],rot[1],rot[2]),true));
    if(state.outer){const outerMap={head:'headOuter',body:'bodyOuter',rightLeg:'rightLegOuter',leftLeg:'leftLegOuter',rightArm:'rightArmOuter',leftArm:'leftArmOuter'};parts.forEach(([name,pos,rot])=>drawMesh(outerMap[name],partMatrix(pos,pivots[name],rot[0],rot[1],rot[2]),true));}
    if(state.geometry.enabled){const g=state.geometry;let m=mat4Mul(mat4T(g.x,g.y,g.z),mat4Mul(mat4Rz(g.rz*Math.PI/180),mat4Mul(mat4Ry(g.ry*Math.PI/180),mat4Rx(g.rx*Math.PI/180))));const solidKey='__geometry';if(!meshes[solidKey])upload(solidKey,cubeMesh([g.w,g.h,g.d],{top:{x:0,y:0,w:1,h:1},bottom:{x:0,y:0,w:1,h:1},left:{x:0,y:0,w:1,h:1},front:{x:0,y:0,w:1,h:1},right:{x:0,y:0,w:1,h:1},back:{x:0,y:0,w:1,h:1}}));drawMesh(solidKey,m,false,[.42,.82,.98,.72]);}
    if(pv.playing)requestAnimationFrame(render);
  }
  function update(pixels,outer){skinCtx.putImageData(new ImageData(new Uint8ClampedArray(pixels),64,64),0,0);gl.bindTexture(gl.TEXTURE_2D,tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,skinCanvas);state.outer=outer;render();}
  function setModel(model){build(model);}
  function setPose(){pv.animation=els.animationSelect.value;}
  function reset(){pv.yaw=.35;pv.pitch=.12;pv.zoom=1;pv.animTime=0;render();}
  function front(){pv.yaw=0;pv.pitch=0;render();} function back(){pv.yaw=Math.PI;pv.pitch=0;render();} function top(){pv.yaw=0;pv.pitch=.85;render();} function side(){pv.yaw=Math.PI/2;pv.pitch=0;render();}
  function fit(){pv.zoom=1;render();}
  els.previewCanvas.addEventListener('pointerdown',e=>{els.previewCanvas.setPointerCapture?.(e.pointerId);pv.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pv.pointers.size===1){pv.drag=true;pv.lastX=e.clientX;pv.lastY=e.clientY;}else if(pv.pointers.size===2){pv.drag=false;const [a,b]=[...pv.pointers.values()];pv.pinch={dist:Math.hypot(a.x-b.x,a.y-b.y),zoom:pv.zoom};}});
  els.previewCanvas.addEventListener('pointermove',e=>{if(pv.pointers.has(e.pointerId))pv.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pv.pointers.size>=2){const [a,b]=[...pv.pointers.values()];const d=Math.hypot(a.x-b.x,a.y-b.y);if(pv.pinch)pv.zoom=clamp(pv.pinch.zoom*(d/(pv.pinch.dist||1)),.65,1.8);render();return;}if(!pv.drag)return;pv.yaw+=(e.clientX-pv.lastX)*.012;pv.pitch=clamp(pv.pitch+(e.clientY-pv.lastY)*.012,-1.1,1.1);pv.lastX=e.clientX;pv.lastY=e.clientY;render();});
  ['pointerup','pointercancel'].forEach(ev=>els.previewCanvas.addEventListener(ev,e=>{pv.pointers.delete(e.pointerId);if(pv.pointers.size<2)pv.pinch=null;pv.drag=false;}));
  els.previewCanvas.addEventListener('wheel',e=>{e.preventDefault();pv.zoom=clamp(pv.zoom*(e.deltaY<0?1.1:.91),.65,1.8);render();},{passive:false});
  function togglePlay(){pv.playing=!pv.playing;els.animationStatus.textContent=pv.playing?'ON':'OFF';els.animationToggle.textContent=pv.playing?'Pause':'Play';if(pv.playing){pv.lastTime=performance.now();requestAnimationFrame(render);}else render();}
  return {ready:true,modelName:pv.modelName,update,setModel,front,top,back,side,reset,fit,renderNow:render,togglePlay,setPose, setSpeed(v){pv.speed=v;},get playing(){return pv.playing;}};
}

function bind(){
  loadTheme();
  els.themeSelect.addEventListener('change',()=>{applyTheme(els.themeSelect.value);scheduleRender();});
  $$('.tool-btn').forEach(b=>b.addEventListener('click',()=>setTool(b.dataset.tool)));
  bindBrushControls();
  $('#gridToggle').addEventListener('change',e=>{state.grid=e.target.checked;scheduleRender();});
  $('#checkerToggle').addEventListener('change',e=>{state.checker=e.target.checked;scheduleRender();});
  $('#mirrorToggle').addEventListener('change',e=>state.mirror=e.target.checked);
  els.outerToggle.addEventListener('change',()=>{state.outer=els.outerToggle.checked;preview?.update(state.pixels,state.outer);});
  els.referenceToggle.addEventListener('change',()=>{state.referenceVisible=els.referenceToggle.checked;scheduleRender();});
  els.referenceOpacity.addEventListener('input',()=>{state.referenceOpacity=+els.referenceOpacity.value/100;els.referenceOpacityValue.textContent=`${els.referenceOpacity.value}%`;scheduleRender();});
  els.colorInput.addEventListener('input',e=>setColor(e.target.value));
  els.hexInput.addEventListener('input',e=>{const v=e.target.value.replace(/[^0-9a-f]/gi,'').slice(0,6).toUpperCase();e.target.value=v;if(v.length===6)setColor('#'+v,false);});
  $('#undoBtn').addEventListener('click',undo);$('#redoBtn').addEventListener('click',redo);
  $('#zoomInBtn').addEventListener('click',()=>zoomAt(els.canvas.clientWidth/2,els.canvas.clientHeight/2,state.zoom*1.25));$('#zoomOutBtn').addEventListener('click',()=>zoomAt(els.canvas.clientWidth/2,els.canvas.clientHeight/2,state.zoom*.8));$('#fitBtn').addEventListener('click',fitCanvas);$('#centerCanvasBtn').addEventListener('click',resetCenter);
  $('#gridBtn').addEventListener('click',()=>{$('#gridToggle').click();});$('#checkerBtn').addEventListener('click',()=>{$('#checkerToggle').click();});
  $('#newSkinBtn').addEventListener('click',()=>{if(confirm('Create a new starter skin? Unsaved changes will be replaced.')){starterTemplate(state.model);scheduleRender();toast('Starter skin loaded.');}});
  $('#templateBtn').addEventListener('click',()=>{starterTemplate(state.model);scheduleRender();toast('Complete editable template loaded.');});
  $('#importBtn').addEventListener('click',()=>els.skinFileInput.click());els.skinFileInput.addEventListener('change',e=>{importSkin(e.target.files?.[0]);e.target.value='';});
  $('#referenceBtn').addEventListener('click',()=>els.referenceFileInput.click());$('#referenceButton2').addEventListener('click',()=>els.referenceFileInput.click());els.referenceFileInput.addEventListener('change',e=>{loadReference(e.target.files?.[0]);e.target.value='';});
  $('#useReferenceAsSkinBtn').addEventListener('click',useReferenceAsSkin);$('#clearReferenceBtn').addEventListener('click',clearReference);
  $('#exportBtn').addEventListener('click',exportPng);$('#downloadTemplateBtn').addEventListener('click',downloadStarter);
  $('#guideBtn').addEventListener('click',openGuide);$('#guideBtn2').addEventListener('click',openGuide);$('#closeGuideBtn').addEventListener('click',closeGuide);$('#guideModal').addEventListener('click',e=>{if(e.target.id==='guideModal')closeGuide();});
  els.modelSelect.addEventListener('change',()=>{state.model=els.modelSelect.value;preview?.setModel(state.model);renderGuide();renderChecks();scheduleRender();toast(`${state.model==='slim'?'Slim':'Classic'} model selected. Your current texture was kept.`);});
  $('#clearHistoryBtn').addEventListener('click',()=>{state.recentColors=[DEFAULT_COLOR];renderPalettes();});
  els.canvas.addEventListener('pointerdown',editorPointerDown);els.canvas.addEventListener('pointermove',editorPointerMove);els.canvas.addEventListener('pointerup',editorPointerUp);els.canvas.addEventListener('pointercancel',editorPointerUp);els.canvas.addEventListener('wheel',editorWheel,{passive:false});els.canvas.addEventListener('contextmenu',e=>e.preventDefault());
  $('#frontBtn').addEventListener('click',()=>preview?.front());$('#topBtn').addEventListener('click',()=>preview?.top());$('#backBtn').addEventListener('click',()=>preview?.back());$('#sideBtn').addEventListener('click',()=>preview?.side());$('#resetViewBtn').addEventListener('click',()=>preview?.reset());$('#previewZoomFitBtn').addEventListener('click',()=>preview?.fit());
  $('#animationSelect').addEventListener('change',()=>{preview?.setPose();if(!preview?.playing)preview?.renderNow();});$('#animationToggle').addEventListener('click',()=>preview?.togglePlay());$('#animationReset').addEventListener('click',()=>preview?.reset());els.animationSpeed.addEventListener('input',()=>{const v=+els.animationSpeed.value;els.animationSpeedValue.textContent=`${v.toFixed(2)}×`;preview?.setSpeed(v);});
  els.geometryToggle.addEventListener('change',()=>{state.geometry.enabled=els.geometryToggle.checked;readGeometryInputs();preview?.renderNow();});$$('.geometry-grid input').forEach(i=>i.addEventListener('input',()=>{readGeometryInputs();preview?.renderNow();}));$('#geoResetBtn').addEventListener('click',resetGeometry);$('#geoExportBtn').addEventListener('click',exportGeometryJSON);
  window.addEventListener('resize',()=>{renderEditor();preview?.renderNow();});
  window.addEventListener('keydown',e=>{const tag=(e.target?.tagName||'').toLowerCase();if(['input','textarea','select'].includes(tag))return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();undo();return;}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo();return;}const keys=['pencil','brush','eraser','fill','picker','line','rect','circle','shade','replace'];if(e.key>='1'&&e.key<='9')setTool(keys[+e.key-1]);if(e.key==='0')setTool('replace');if(e.key==='Escape')closeGuide();if(e.key.toLowerCase()==='f')fitCanvas();});
}

loadTheme();bind();
setColor(DEFAULT_COLOR,false);els.brushSizeValue.textContent='1 px';els.brushOpacityValue.textContent='100%';els.referenceOpacityValue.textContent='35%';els.animationSpeedValue.textContent='1.00×';
starterTemplate(state.model);
preview=makePreview();
preview?.setPose();
writeGeometryInputs();
renderPalettes();renderEditor();renderChecks();
