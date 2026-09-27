const BASE_SIZE = 64;
const SUPPORTED_SIZES = [64, 128];
const HISTORY_LIMIT = 80;
const LIBRARY_LIMIT = 12;
const DEFAULT_COLOR = '#7FD7FF';

const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const slugify = (s) => String(s || 'nova-skin').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80) || 'nova-skin';

const els = {
  html: document.documentElement,
  canvas: $('#editorCanvas'),
  wrap: $('#canvasWrap'),
  previewCanvas: $('#previewCanvas'),
  colorInput: $('#colorInput'), hexInput: $('#hexInput'), swatches: $('#swatches'), quickColors: $('#quickColors'),
  zoomReadout: $('#zoomReadout'), activeToolLabel: $('#activeToolLabel'), cursorReadout: $('#cursorReadout'),
  docStatus: $('#docStatus'), docSize: $('#docSize'), textureSizeSelect: $('#textureSizeSelect'), checks: $('#checks'), toastRegion: $('#toastRegion'),
  themeSelect: $('#themeSelect'), skinFileInput: $('#skinFileInput'), referenceFileInput: $('#referenceFileInput'), referenceChip: $('#referenceChip'), referenceText: $('#referenceText'),
  brushSize: $('#brushSize'), brushSizeValue: $('#brushSizeValue'), brushOpacity: $('#brushOpacity'), brushOpacityValue: $('#brushOpacityValue'),
  brushShape: $('#brushShape'), brushMode: $('#brushMode'), replaceTolerance: $('#replaceTolerance'), toleranceValue: $('#toleranceValue'), shadeMode: $('#shadeMode'),
  referenceOpacity: $('#referenceOpacity'), referenceOpacityValue: $('#referenceOpacityValue'),
  animationStatus: $('#animationStatus'), animationSelect: $('#animationSelect'), animationSpeed: $('#animationSpeed'), animationSpeedValue: $('#animationSpeedValue'),
  modelSelect: $('#modelSelect'), outerToggle: $('#outerToggle'), referenceToggle: $('#referenceToggle'), geometryToggle: $('#geometryToggle'),
  libraryList: $('#libraryList'),
};

const ctx = els.canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const textureCanvas = document.createElement('canvas');
const textureCtx = textureCanvas.getContext('2d', { willReadFrequently:true });
textureCtx.imageSmoothingEnabled = false;

const state = {
  size:64,
  pixels:new Uint8ClampedArray(64*64*4),
  model:'classic', tool:'pencil', color:DEFAULT_COLOR,
  brushSize:1, brushOpacity:1, brushShape:'square', brushMode:'hard', shadeMode:'lighten', replaceTolerance:0,
  grid:true, checker:true, mirror:false, outer:true, zoom:1, panX:0, panY:0,
  title:'Complete Classic Starter', history:[], historyIndex:-1,
  recentColors:[DEFAULT_COLOR,'#FFFFFF','#191E26','#EF6675','#FFC764','#9AF0CF','#708BFF','#B68CFF','#6CE0D5','#F28BA8','#A6B7C7','#596474','#7B4E3A','#C98E5B','#3B6D8C','#273442'],
  reference:null, referenceVisible:false, referenceOpacity:.35,
  activePointers:new Map(), drawing:false, strokeBefore:null, strokeChanged:false, dragStart:null, editorGesture:null,
  geometry:{enabled:false,w:4,h:4,d:4,x:0,y:4,z:0,rx:0,ry:0,rz:0,color:'#B68CFF'},
};

let preview = null;
let editorFrame = 0;
let toastTimer = 0;

function safeStorage(){ try { return window.localStorage; } catch { return null; } }
const store = safeStorage();

function toast(msg){
  if(!els.toastRegion) return;
  els.toastRegion.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>{ if(els.toastRegion) els.toastRegion.textContent=''; }, 2600);
}
function hexToRgba(hex, alpha=255){
  const s=String(hex||'').replace(/^#/,'').trim();
  const v=s.length===3?s.split('').map(c=>c+c).join(''):s;
  if(!/^[0-9a-fA-F]{6}$/.test(v)) return null;
  const n=parseInt(v,16); return [(n>>16)&255,(n>>8)&255,n&255,alpha];
}
function rgbaToHex(r,g,b){ return [r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('').toUpperCase(); }
function indexFor(x,y){ return (y*state.size+x)*4; }
function getPixel(x,y){ if(x<0||y<0||x>=state.size||y>=state.size)return [0,0,0,0];const i=indexFor(x,y);return [state.pixels[i],state.pixels[i+1],state.pixels[i+2],state.pixels[i+3]]; }
function colorsEqual(a,b){ return a[0]===b[0]&&a[1]===b[1]&&a[2]===b[2]&&a[3]===b[3]; }
function setPixel(x,y,c){ if(x<0||y<0||x>=state.size||y>=state.size)return false;const i=indexFor(x,y);if(state.pixels[i]===c[0]&&state.pixels[i+1]===c[1]&&state.pixels[i+2]===c[2]&&state.pixels[i+3]===c[3])return false;state.pixels[i]=c[0];state.pixels[i+1]=c[1];state.pixels[i+2]=c[2];state.pixels[i+3]=c[3];return true; }
function pixelsToImageData(){ return new ImageData(new Uint8ClampedArray(state.pixels),state.size,state.size); }
function setColor(hex,addRecent=true){ const c=hexToRgba(hex);if(!c)return;state.color='#'+rgbaToHex(c[0],c[1],c[2]);if(els.colorInput)els.colorInput.value=state.color;if(els.hexInput)els.hexInput.value=state.color.slice(1);if(addRecent){state.recentColors=[state.color,...state.recentColors.filter(x=>x!==state.color)].slice(0,16);renderPalettes();} }

function layout(model=state.model){
  const armW=model==='slim'?3:4; const f=(x,y,w,h)=>({x,y,w,h}); const c=(name,w,h,d,regions)=>({name,w,h,d,regions});
  return {
    head:c('Head',8,8,8,{top:f(8,0,8,8),bottom:f(16,0,8,8),left:f(0,8,8,8),front:f(8,8,8,8),right:f(16,8,8,8),back:f(24,8,8,8)}),
    body:c('Body',8,12,4,{top:f(20,16,8,4),bottom:f(28,16,8,4),left:f(16,20,4,12),front:f(20,20,8,12),right:f(28,20,4,12),back:f(32,20,8,12)}),
    rightLeg:c('Right Leg',4,12,4,{top:f(4,16,4,4),bottom:f(8,16,4,4),left:f(0,20,4,12),front:f(4,20,4,12),right:f(8,20,4,12),back:f(12,20,4,12)}),
    rightArm:c('Right Arm',armW,12,4,{top:f(44,16,armW,4),bottom:f(44+armW,16,armW,4),left:f(40,20,4,12),front:f(44,20,armW,12),right:f(44+armW,20,4,12),back:f(48+armW,20,armW,12)}),
    leftLeg:c('Left Leg',4,12,4,{top:f(20,48,4,4),bottom:f(24,48,4,4),left:f(16,52,4,12),front:f(20,52,4,12),right:f(24,52,4,12),back:f(28,52,4,12)}),
    leftArm:c('Left Arm',armW,12,4,{top:f(36,48,armW,4),bottom:f(36+armW,48,armW,4),left:f(32,52,4,12),front:f(36,52,armW,12),right:f(36+armW,52,4,12),back:f(40+armW,52,armW,12)}),
    outerHead:c('Head Outer',8.75,8.75,8.75,{top:f(40,0,8,8),bottom:f(48,0,8,8),left:f(32,8,8,8),front:f(40,8,8,8),right:f(48,8,8,8),back:f(56,8,8,8)}),
    outerBody:c('Body Outer',8.75,12.75,4.75,{top:f(20,32,8,4),bottom:f(28,32,8,4),left:f(16,36,4,12),front:f(20,36,8,12),right:f(28,36,4,12),back:f(32,36,8,12)}),
    outerRightLeg:c('Right Leg Outer',4.75,12.75,4.75,{top:f(4,32,4,4),bottom:f(8,32,4,4),left:f(0,36,4,12),front:f(4,36,4,12),right:f(8,36,4,12),back:f(12,36,4,12)}),
    outerRightArm:c('Right Arm Outer',armW+.75,12.75,4.75,{top:f(44,32,armW,4),bottom:f(44+armW,32,armW,4),left:f(40,36,4,12),front:f(44,36,armW,12),right:f(44+armW,36,4,12),back:f(48+armW,36,armW,12)}),
    outerLeftLeg:c('Left Leg Outer',4.75,12.75,4.75,{top:f(4,48,4,4),bottom:f(8,48,4,4),left:f(0,52,4,12),front:f(4,52,4,12),right:f(8,52,4,12),back:f(12,52,4,12)}),
    outerLeftArm:c('Left Arm Outer',armW+.75,12.75,4.75,{top:f(52,48,armW,4),bottom:f(52+armW,48,armW,4),left:f(48,52,4,12),front:f(52,52,armW,12),right:f(52+armW,52,4,12),back:f(56+armW,52,armW,12)}),
    armW,
  };
}
function scaledLayout(model=state.model){
  const base=layout(model),scale=state.size/64,out={};
  for(const [k,v] of Object.entries(base)){
    if(k==='armW'){out.armW=v;continue;}
    const regions={};for(const [face,r] of Object.entries(v.regions))regions[face]={x:r.x*scale,y:r.y*scale,w:r.w*scale,h:r.h*scale};
    out[k]={...v,regions};
  } return out;
}
function setDocMeta(){els.docStatus.textContent=state.title;els.docSize.textContent=`${state.size}×${state.size}`;els.textureSizeSelect.value=String(state.size);}

function paintRect(r,c,alpha=255){const rgba=hexToRgba(c,alpha);if(!rgba)return;for(let y=r.y;y<r.y+r.h;y++)for(let x=r.x;x<r.x+r.w;x++)setPixel(Math.floor(x),Math.floor(y),rgba);}
function createStarterPixels(model=state.model,size=64){
  const oldSize=state.size,oldPixels=state.pixels;state.size=64;state.pixels=new Uint8ClampedArray(64*64*4);const L=layout(model);
  const skin='#D8A177',shade='#B97654',hair='#3A2418',hair2='#5B3827',shirt='#3F76B5',shirt2='#6598CF',pants='#354250',pants2='#4A5A6B',shoe='#20252B';
  ['front','right'].forEach(k=>paintRect(L.head.regions[k],skin));['left','bottom'].forEach(k=>paintRect(L.head.regions[k],shade));['top','back'].forEach(k=>paintRect(L.head.regions[k],hair));
  paintRect({x:10,y:11,w:1,h:2},'#241919');paintRect({x:13,y:11,w:1,h:2},'#241919');paintRect({x:11,y:13,w:2,h:1},'#A85E54');
  ['front','back','right','bottom'].forEach(k=>paintRect(L.body.regions[k],shirt));['top','left'].forEach(k=>paintRect(L.body.regions[k],shirt2));
  ['rightArm','leftArm'].forEach(k=>{paintRect(L[k].regions.front,shirt);paintRect(L[k].regions.back,shirt);paintRect(L[k].regions.top,shirt2);paintRect(L[k].regions.bottom,shirt);paintRect(L[k].regions.left,skin);paintRect(L[k].regions.right,shade);});
  ['rightLeg','leftLeg'].forEach(k=>{Object.values(L[k].regions).forEach(r=>paintRect(r,pants));paintRect(L[k].regions.top,pants2);});
  ['rightLeg','leftLeg'].forEach(k=>{const r=L[k].regions.front;paintRect({x:r.x,y:r.y+r.h-3,w:r.w,h:3},shoe);});
  ['top','back','left','right'].forEach(k=>paintRect(L.outerHead.regions[k],hair2));
  paintRect(L.outerBody.regions.front,'#214E78',220);paintRect(L.outerBody.regions.left,'#1A415F',220);paintRect(L.outerBody.regions.right,'#17394F',220);
  ['outerRightArm','outerLeftArm'].forEach(k=>{paintRect(L[k].regions.front,'#244F72',200);paintRect(L[k].regions.top,shirt2,180);});
  ['outerRightLeg','outerLeftLeg'].forEach(k=>paintRect(L[k].regions.front,shoe,220));
  const canonical=new Uint8ClampedArray(state.pixels);
  state.size=oldSize;state.pixels=new Uint8ClampedArray(oldSize*oldSize*4);
  if(oldSize===64) state.pixels.set(canonical); else scalePixels(canonical,64,state.pixels,oldSize);
  state.title=(size===128?`Complete ${model==='slim'?'Slim':'Classic'} HD Starter`:`Complete ${model==='slim'?'Slim':'Classic'} Starter`);
}
function scalePixels(src,srcSize,dst,dstSize){const ratio=dstSize/srcSize;for(let y=0;y<dstSize;y++)for(let x=0;x<dstSize;x++){const sx=Math.floor(x/ratio),sy=Math.floor(y/ratio),si=(sy*srcSize+sx)*4,di=(y*dstSize+x)*4;dst[di]=src[si];dst[di+1]=src[si+1];dst[di+2]=src[si+2];dst[di+3]=src[si+3];}}

function saveHistory(){
  const snap=new Uint8ClampedArray(state.pixels);if(state.historyIndex<state.history.length-1)state.history=state.history.slice(0,state.historyIndex+1);state.history.push(snap);if(state.history.length>HISTORY_LIMIT)state.history.shift();state.historyIndex=state.history.length-1;
}
function undo(){if(state.historyIndex<=0)return;state.historyIndex--;state.pixels.set(state.history[state.historyIndex]);touchPreview();scheduleRender();}
function redo(){if(state.historyIndex>=state.history.length-1)return;state.historyIndex++;state.pixels.set(state.history[state.historyIndex]);touchPreview();scheduleRender();}
function touchPreview(){ if(preview) preview.invalidate(); }

function blend(src,dst){const sa=src[3]/255,da=dst[3]/255,oa=sa+da*(1-sa);if(oa<=0)return[0,0,0,0];return[Math.round((src[0]*sa+dst[0]*da*(1-sa))/oa),Math.round((src[1]*sa+dst[1]*da*(1-sa))/oa),Math.round((src[2]*sa+dst[2]*da*(1-sa))/oa),Math.round(oa*255)];}
function brushPixels(cx,cy){const s=state.brushSize,r=(s-1)/2,out=[];const minX=Math.floor(cx-r),maxX=Math.ceil(cx+r),minY=Math.floor(cy-r),maxY=Math.ceil(cy+r);for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){if(state.brushShape==='circle'){const dx=x-cx,dy=y-cy;if(Math.hypot(dx,dy)>r+.55)continue;}let alpha=state.brushOpacity;if(state.brushMode==='soft'){const d=Math.hypot(x-cx,y-cy)/(r+.75);alpha*=clamp(1-d,0,1);if(alpha<.03)continue;}out.push([x,y,Math.round(alpha*255)]);}return out;}
function applyBrush(x,y,erase=false){let changed=false;const paintOne=(px,py,a)=>{const c=erase?[0,0,0,0]:hexToRgba(state.color,a);if(!c)return;if(erase)changed=setPixel(px,py,c)||changed;else changed=setPixel(px,py,blend(c,getPixel(px,py)))||changed;};for(const [px,py,a] of brushPixels(x,y)){paintOne(px,py,a);if(state.mirror)paintOne(state.size-1-px,py,a);}return changed;}
function fillRegion(sx,sy,target,replacement){if(colorsEqual(target,replacement))return false;const stack=[[sx,sy]],seen=new Uint8Array(state.size*state.size);let changed=false;while(stack.length){const [x,y]=stack.pop();if(x<0||y<0||x>=state.size||y>=state.size)continue;const k=y*state.size+x;if(seen[k])continue;seen[k]=1;const p=getPixel(x,y);if(!colorsEqual(p,target))continue;changed=setPixel(x,y,replacement)||changed;stack.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);}return changed;}
function linePixels(x0,y0,x1,y1){const o=[];let dx=Math.abs(x1-x0),dy=Math.abs(y1-y0),sx=x0<x1?1:-1,sy=y0<y1?1:-1,err=dx-dy;while(true){o.push([x0,y0]);if(x0===x1&&y0===y1)break;const e2=2*err;if(e2>-dy){err-=dy;x0+=sx;}if(e2<dx){err+=dx;y0+=sy;}}return o;}
function circlePixels(x0,y0,x1,y1){const o=new Map(),cx=(x0+x1)/2,cy=(y0+y1)/2,rx=Math.max(.5,Math.abs(x1-x0)/2),ry=Math.max(.5,Math.abs(y1-y0)/2),steps=Math.max(18,Math.ceil(2*Math.PI*Math.max(rx,ry)*2));for(let i=0;i<=steps;i++){const a=i/steps*Math.PI*2,x=Math.round(cx+Math.cos(a)*rx),y=Math.round(cy+Math.sin(a)*ry);o.set(`${x},${y}`,[x,y]);}return [...o.values()];}
function adjustShade(p){const f=state.shadeMode==='lighten'?1.17:.83;return [clamp(Math.round(p[0]*f),0,255),clamp(Math.round(p[1]*f),0,255),clamp(Math.round(p[2]*f),0,255),p[3]];}
function replaceColor(sx,sy){const target=getPixel(sx,sy),newC=hexToRgba(state.color,Math.round(state.brushOpacity*255));let changed=false;for(let y=0;y<state.size;y++)for(let x=0;x<state.size;x++){const p=getPixel(x,y),d=Math.max(Math.abs(p[0]-target[0]),Math.abs(p[1]-target[1]),Math.abs(p[2]-target[2]),Math.abs(p[3]-target[3]));if(d<=state.replaceTolerance)changed=setPixel(x,y,blend(newC,p))||changed;}return changed;}
function toolAt(x,y){
  if(x<0||y<0||x>=state.size||y>=state.size)return false;
  if(state.tool==='picker'){const p=getPixel(x,y);if(p[3])setColor('#'+rgbaToHex(p[0],p[1],p[2]));return false;}
  if(state.tool==='fill')return fillRegion(x,y,getPixel(x,y),hexToRgba(state.color,Math.round(state.brushOpacity*255)));
  if(state.tool==='shade')return setPixel(x,y,adjustShade(getPixel(x,y)));
  if(state.tool==='replace')return replaceColor(x,y);
  if(state.tool==='eraser')return applyBrush(x,y,true);
  return applyBrush(x,y,false);
}

function fitPixelSize(){const r=els.canvas.getBoundingClientRect();return Math.max(.5,(Math.min(r.width,r.height)*.82)/state.size);}
function eventToPixel(e){const r=els.canvas.getBoundingClientRect(),px=fitPixelSize()*state.zoom;return {x:Math.floor(((e.clientX-r.left)-(r.width/2+state.panX))/px+state.size/2),y:Math.floor(((e.clientY-r.top)-(r.height/2+state.panY))/px+state.size/2)};}
function localPoint(e){const r=els.canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}
function clampPan(){const r=els.canvas.getBoundingClientRect(),px=fitPixelSize()*state.zoom,tex=state.size*px,max=Math.max(0,(tex-Math.min(r.width,r.height))/2+px*2);state.panX=clamp(state.panX,-max,max);state.panY=clamp(state.panY,-max,max);}
function zoomAt(localX,localY,newZoom){const r=els.canvas.getBoundingClientRect(),oldPx=fitPixelSize()*state.zoom;const tx=(localX-(r.width/2+state.panX))/oldPx+state.size/2,ty=(localY-(r.height/2+state.panY))/oldPx+state.size/2;state.zoom=clamp(newZoom,.35,14);const npx=fitPixelSize()*state.zoom;state.panX=localX-r.width/2-(tx-state.size/2)*npx;state.panY=localY-r.height/2-(ty-state.size/2)*npx;clampPan();scheduleRender();}
function fitCanvas(){state.zoom=1;state.panX=0;state.panY=0;scheduleRender();}

function drawChecker(target,w,h,cell){const bg=getComputedStyle(document.documentElement).getPropertyValue('--bg-2').trim()||'#0d1118';target.fillStyle=bg;target.fillRect(0,0,w,h);target.fillStyle='rgba(120,130,145,.10)';for(let y=0;y<h;y+=cell)for(let x=0;x<w;x+=cell)if(((x/cell+y/cell)&1)===0)target.fillRect(x,y,cell,cell);}
function renderEditor(){
  const r=els.canvas.getBoundingClientRect();if(r.width<1||r.height<1)return;const dpr=Math.min(window.devicePixelRatio||1,1.5),w=Math.max(320,Math.round(r.width*dpr)),h=Math.max(320,Math.round(r.height*dpr));if(els.canvas.width!==w||els.canvas.height!==h)els.canvas.width=w,els.canvas.height=h;
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,r.width,r.height);
  if(state.checker)drawChecker(ctx,r.width,r.height,16);else{ctx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()||'#080b10';ctx.fillRect(0,0,r.width,r.height);}
  if(state.reference&&state.referenceVisible){const fit=fitPixelSize(),size=state.size*fit*state.zoom;ctx.save();ctx.globalAlpha=state.referenceOpacity;ctx.imageSmoothingEnabled=true;const ratio=state.reference.width/state.reference.height;let dw=size,dh=size;if(ratio>1)dh=size/ratio;else dw=size*ratio;ctx.drawImage(state.reference,r.width/2+state.panX-dw/2,r.height/2+state.panY-dh/2,dw,dh);ctx.restore();}
  if(textureCanvas.width!==state.size){textureCanvas.width=state.size;textureCanvas.height=state.size;}textureCtx.putImageData(pixelsToImageData(),0,0);
  const px=fitPixelSize()*state.zoom,size=state.size*px,ox=r.width/2+state.panX-size/2,oy=r.height/2+state.panY-size/2;ctx.save();ctx.imageSmoothingEnabled=false;ctx.drawImage(textureCanvas,ox,oy,size,size);
  if(state.grid&&px>=4){ctx.globalAlpha=Math.min(.30,.07+(px-4)*.012);ctx.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue('--muted').trim()||'#87919e';ctx.lineWidth=1;ctx.beginPath();for(let i=0;i<=state.size;i++){const gx=ox+i*px+.5,gy=oy+i*px+.5;ctx.moveTo(gx,oy);ctx.lineTo(gx,oy+size);ctx.moveTo(ox,gy);ctx.lineTo(ox+size,gy);}ctx.stroke();}
  ctx.strokeStyle='rgba(255,255,255,.18)';ctx.lineWidth=1;ctx.strokeRect(ox+.5,oy+.5,size-1,size-1);ctx.restore();els.zoomReadout.textContent=`${Math.round(state.zoom*100)}%`;
}
function scheduleRender(){if(editorFrame)return;editorFrame=requestAnimationFrame(()=>{editorFrame=0;renderEditor();renderChecks();touchPreview();});}

function renderPalettes(){
  if(els.swatches)els.swatches.innerHTML=state.recentColors.map(c=>`<button class="swatch" style="background:${c}" data-color="${c}" title="${c}"></button>`).join('');
  if(els.quickColors)els.quickColors.innerHTML=state.recentColors.slice(0,8).map(c=>`<button class="swatch" style="background:${c}" data-color="${c}" title="${c}"></button>`).join('');
  $$('.swatch').forEach(b=>b.addEventListener('click',()=>setColor(b.dataset.color)));
}
function countAlpha(){let n=0;for(let i=3;i<state.pixels.length;i+=4)if(state.pixels[i])n++;return n;}
function renderChecks(){if(!els.checks)return;const items=[[SUPPORTED_SIZES.includes(state.size),`${state.size}×${state.size} texture loaded`],[countAlpha()>0,'Texture contains visible pixels'],[preview?.ready===true,preview?.modelName?`${preview.modelName} preview ready`:'3D preview unavailable'],[state.historyIndex>=0,'Undo history ready'],[state.reference?'Reference image loaded':'No reference image',true],[state.model==='classic','Classic 4px arms selected']];els.checks.innerHTML=items.map(([a,b])=>{const ok=typeof b==='boolean'?b:a;const label=typeof b==='boolean'?'':b;return `<div class="check ${ok?'ok':'warn'}"><span class="check-icon">${ok?'✓':'!'}</span><span>${label||a}</span></div>`}).join('');}

function setTool(tool){state.tool=tool;$$('.tool-btn').forEach(b=>b.classList.toggle('active',b.dataset.tool===tool));if(els.activeToolLabel)els.activeToolLabel.textContent=tool.charAt(0).toUpperCase()+tool.slice(1);}
function saveProjectToLibrary(){
  if(!store)return;
  try{const all=JSON.parse(store.getItem('nova-skin-library')||'[]');const pngCanvas=document.createElement('canvas');pngCanvas.width=state.size;pngCanvas.height=state.size;pngCanvas.getContext('2d').putImageData(pixelsToImageData(),0,0);const data=pngCanvas.toDataURL('image/png');const item={id:Date.now().toString(36)+Math.random().toString(36).slice(2,8),title:state.title,size:state.size,model:state.model,data};const next=[item,...all.filter(x=>x.title!==item.title)].slice(0,LIBRARY_LIMIT);store.setItem('nova-skin-library',JSON.stringify(next));renderLibrary();}catch{toast('Library storage is full. Current skin is still safe in this tab.');}
}
function loadLibrary(){if(!store)return;try{const all=JSON.parse(store.getItem('nova-skin-library')||'[]');renderLibrary(all);}catch{}}
function renderLibrary(items){if(!els.libraryList)return;items=items||(()=>{try{return JSON.parse(store?.getItem('nova-skin-library')||'[]')}catch{return[]}})();els.libraryList.innerHTML=items.length?items.map(i=>`<button class="library-item" data-id="${i.id}"><img src="${i.data}" alt=""><span>${i.title}</span><small>${i.size}×${i.size} · ${i.model==='slim'?'Slim':'Classic'}</small></button>`).join(''):'<div class="library-empty" id="libraryEmpty">Your saved skins will appear here.</div>';$$('.library-item').forEach(b=>b.addEventListener('click',()=>{const id=b.dataset.id,all=JSON.parse(store.getItem('nova-skin-library')||'[]'),i=all.find(x=>x.id===id);if(i)loadDataUrlAsSkin(i.data,i.title,i.size,i.model);}));}
function loadDataUrlAsSkin(data,title,size,model){const img=new Image();img.onload=()=>{state.size=size;state.model=model;els.modelSelect.value=model;els.textureSizeSelect.value=String(size);const c=document.createElement('canvas');c.width=size;c.height=size;c.getContext('2d').drawImage(img,0,0);state.pixels=new Uint8ClampedArray(c.getContext('2d').getImageData(0,0,size,size).data);state.title=title;state.history=[];state.historyIndex=-1;saveHistory();setDocMeta();preview?.setModel(model);fitCanvas();scheduleRender();toast('Saved skin loaded.');};img.src=data;}

function importSkin(file){if(!file)return;const img=new Image();img.onload=()=>{const w=img.naturalWidth,h=img.naturalHeight;if(w!==h||!SUPPORTED_SIZES.includes(w)){loadReference(file);toast(`${w}×${h} is not a supported skin texture. Loaded as a reference instead.`);return;}const c=document.createElement('canvas');c.width=w;c.height=h;const cctx=c.getContext('2d',{willReadFrequently:true});cctx.imageSmoothingEnabled=false;cctx.drawImage(img,0,0);state.size=w;state.pixels=new Uint8ClampedArray(cctx.getImageData(0,0,w,h).data);state.title=(file.name||'Imported skin').replace(/\.png$/i,'')||'Imported skin';state.history=[];state.historyIndex=-1;saveHistory();els.textureSizeSelect.value=String(w);setDocMeta();preview?.setModel(state.model);fitCanvas();scheduleRender();saveProjectToLibrary();toast(`${w}×${h} skin imported and applied automatically.`);};img.onerror=()=>toast('That image could not be read.');img.src=URL.createObjectURL(file);}
function useReferenceAsSkin(){if(!state.reference)return toast('Add a reference image first.');if(!SUPPORTED_SIZES.includes(state.reference.width)||state.reference.width!==state.reference.height)return toast('Only 64×64 and 128×128 images can become a game-ready skin.');const c=document.createElement('canvas');c.width=state.reference.width;c.height=state.reference.height;c.getContext('2d').drawImage(state.reference,0,0);state.size=state.reference.width;state.pixels=new Uint8ClampedArray(c.getContext('2d').getImageData(0,0,state.size,state.size).data);state.title='Reference skin';state.history=[];state.historyIndex=-1;saveHistory();setDocMeta();preview?.setModel(state.model);scheduleRender();saveProjectToLibrary();toast('Reference copied into the skin editor.');}
function loadReference(file){if(!file)return;const img=new Image();img.onload=()=>{state.reference=img;state.referenceVisible=true;els.referenceToggle.checked=true;els.referenceChip.hidden=false;els.referenceText.textContent=`Reference: ${file.name} (${img.width}×${img.height}). It is visual guidance only.`;scheduleRender();toast('Reference image loaded.');};img.onerror=()=>toast('Could not read that image.');img.src=URL.createObjectURL(file);}
function clearReference(){state.reference=null;state.referenceVisible=false;els.referenceToggle.checked=false;els.referenceChip.hidden=true;els.referenceText.textContent='Use Reference for screenshots, photos, or concept art. It will not be exported.';scheduleRender();}
function exportPng(){const out=document.createElement('canvas');out.width=state.size;out.height=state.size;out.getContext('2d').putImageData(pixelsToImageData(),0,0);out.toBlob(blob=>{const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${slugify(state.title)}-${state.size}x${state.size}.png`;a.click();URL.revokeObjectURL(url);toast('PNG exported.');},'image/png');}
function downloadStarter(){const oldSize=state.size,oldTitle=state.title,oldPix=new Uint8ClampedArray(state.pixels);createStarterPixels(state.model,state.size);const out=document.createElement('canvas');out.width=state.size;out.height=state.size;out.getContext('2d').putImageData(pixelsToImageData(),0,0);out.toBlob(blob=>{const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`complete-${state.model}-${state.size}.png`;a.click();URL.revokeObjectURL(url);state.pixels=oldPix;state.size=oldSize;state.title=oldTitle;scheduleRender();},'image/png');}

function storageTheme(){try{return store?.getItem('nova-theme')||'midnight'}catch{return'midnight'}}
function applyTheme(theme){els.html.dataset.theme=theme;if(store)try{store.setItem('nova-theme',theme)}catch{}}
function loadTheme(){applyTheme(storageTheme());if(els.themeSelect)els.themeSelect.value=els.html.dataset.theme;}

function renderGuide(){const c=$('#guideCanvas');if(!c)return;const g=c.getContext('2d'),L=scaledLayout(state.model),s=c.width/state.size;g.clearRect(0,0,c.width,c.height);g.fillStyle='#0B0F16';g.fillRect(0,0,c.width,c.height);const parts=[['HEAD',L.head,'#73D4FF'],['BODY',L.body,'#9AF0CF'],['R LEG',L.rightLeg,'#FFBF7B'],['R ARM',L.rightArm,'#B896FF'],['L LEG',L.leftLeg,'#FF7DA0'],['L ARM',L.leftArm,'#FFE37A']];for(const [name,p,col] of parts){for(const r of Object.values(p.regions)){g.fillStyle=col+'18';g.fillRect(r.x*s,r.y*s,r.w*s,r.h*s);g.strokeStyle=col;g.lineWidth=1;g.strokeRect(r.x*s+.5,r.y*s+.5,r.w*s-1,r.h*s-1);}const rs=Object.values(p.regions),minx=Math.min(...rs.map(r=>r.x)),maxx=Math.max(...rs.map(r=>r.x+r.w)),miny=Math.min(...rs.map(r=>r.y)),maxy=Math.max(...rs.map(r=>r.y+r.h));g.fillStyle=col;g.font=`700 ${Math.max(9,s*1.55)}px system-ui`;g.textAlign='center';g.textBaseline='middle';g.fillText(name,(minx+maxx)/2*s,(miny+maxy)/2*s);}if($('#guideSizeNote'))$('#guideSizeNote').textContent=`Current texture: ${state.size}×${state.size}. Coordinates scale with the texture size; a 128×128 skin is the same layout at 2× scale.`;if($('#guideRows'))$('#guideRows').innerHTML=Object.entries(L).filter(([k,v])=>v?.regions).map(([part,v])=>`<div class="guide-map-row"><b>${v.name}</b><span>${Object.entries(v.regions).map(([face,r])=>`${face.toUpperCase()} ${r.x},${r.y} ${r.w}×${r.h}`).join(' · ')}</span></div>`).join('');}

function setGeometryInputs(){const g=state.geometry;for(const k of ['w','h','d','x','y','z','rx','ry','rz']){const el=$(`#geo${k.toUpperCase()}`);if(el)el.value=g[k];}}
function readGeometry(){const g=state.geometry;for(const k of ['w','h','d','x','y','z','rx','ry','rz']){const el=$(`#geo${k.toUpperCase()}`);if(el)g[k]=+el.value||0;}}
function resetGeometry(){state.geometry={enabled:false,w:4,h:4,d:4,x:0,y:4,z:0,rx:0,ry:0,rz:0,color:'#B68CFF'};if(els.geometryToggle)els.geometryToggle.checked=false;setGeometryInputs();preview?.renderNow();}
function exportGeometryJSON(){readGeometry();const g=state.geometry;const json={format_version:'1.12.0',minecraft:{geometry:[{description:{identifier:'geometry.nova_skin_5d',texture_width:state.size,texture_height:state.size,visible_bounds_width:4,visible_bounds_height:4,visible_bounds_offset:[0,0,0]},bones:[{name:'root',pivot:[0,0,0],cubes:[{origin:[g.x-g.w/2,g.y-g.h/2,g.z-g.d/2],size:[g.w,g.h,g.d],rotation:[g.rx,g.ry,g.rz],pivot:[g.x,g.y,g.z]}]}]}]}};const blob=new Blob([JSON.stringify(json,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${slugify(state.title)}-5d-geometry.geo.json`;a.click();URL.revokeObjectURL(url);toast('Experimental 5D geometry JSON exported.');}

// --- Preview ---------------------------------------------------------------
function mat4Identity(){const m=new Float32Array(16);m[0]=m[5]=m[10]=m[15]=1;return m;}
function mat4Mul(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return o;}
function T(x,y,z){const m=mat4Identity();m[12]=x;m[13]=y;m[14]=z;return m;} function S(x,y,z){const m=mat4Identity();m[0]=x;m[5]=y;m[10]=z;return m;}
function RX(a){const c=Math.cos(a),s=Math.sin(a);return new Float32Array([1,0,0,0,0,c,s,0,0,-s,c,0,0,0,0,1]);}
function RY(a){const c=Math.cos(a),s=Math.sin(a);return new Float32Array([c,0,-s,0,0,1,0,0,s,0,0,1]);}
function RZ(a){const c=Math.cos(a),s=Math.sin(a);return new Float32Array([c,s,0,0,-s,c,0,0,0,0,1,0,0,0,0,1]);}
function perspective(fov,aspect,near,far){const f=1/Math.tan(fov/2),nf=1/(near-far),m=new Float32Array(16);m[0]=f/aspect;m[5]=f;m[10]=(far+near)*nf;m[11]=-1;m[14]=2*far*near*nf;return m;}
function lookAt(eye,c,up){let z0=eye[0]-c[0],z1=eye[1]-c[1],z2=eye[2]-c[2],l=Math.hypot(z0,z1,z2);z0/=l;z1/=l;z2/=l;let x0=up[1]*z2-up[2]*z1,x1=up[2]*z0-up[0]*z2,x2=up[0]*z1-up[1]*z0;l=Math.hypot(x0,x1,x2);x0/=l;x1/=l;x2/=l;const y0=z1*x2-z2*x1,y1=z2*x0-z0*x2,y2=z0*x1-z1*x0;return new Float32Array([x0,y0,z0,0,x1,y1,z1,0,x2,y2,z2,0,-(x0*eye[0]+x1*eye[1]+x2*eye[2]),-(y0*eye[0]+y1*eye[1]+y2*eye[2]),-(z0*eye[0]+z1*eye[1]+z2*eye[2]),1]);}
function cubeData(size,regions,texSize){const [w,h,d]=size,hx=w/2,hy=h/2,hz=d/2,P={p:[],u:[],n:[],i:[]};
  const add=(a,b,c,dv,uv,n)=>{const base=P.p.length/3;[a,b,c,dv].forEach(v=>P.p.push(...v));const [u0,v0,u1,v1]=uv;P.u.push(u0,v0,u1,v0,u1,v1,u0,v1);for(let i=0;i<4;i++)P.n.push(...n);P.i.push(base,base+1,base+2,base,base+2,base+3);};
  const uv=(r,flipU=false,flipV=false)=>{const u0=r.x/texSize,u1=(r.x+r.w)/texSize,v0=1-(r.y+r.h)/texSize,v1=1-r.y/texSize;return[flipU?u1:u0,flipV?v1:v0,flipU?u0:u1,flipV?v0:v1];};
  // The winding/UV pairs below keep each face readable from outside the model.
  add([-hx,-hy,hz],[hx,-hy,hz],[hx,hy,hz],[-hx,hy,hz],uv(regions.front),[0,0,1]);
  add([hx,-hy,-hz],[-hx,-hy,-hz],[-hx,hy,-hz],[hx,hy,-hz],uv(regions.back,true),[0,0,-1]);
  add([hx,-hy,hz],[hx,-hy,-hz],[hx,hy,-hz],[hx,hy,hz],uv(regions.right,true),[1,0,0]);
  add([-hx,-hy,-hz],[-hx,-hy,hz],[-hx,hy,hz],[-hx,hy,-hz],uv(regions.left),[-1,0,0]);
  add([-hx,hy,hz],[hx,hy,hz],[hx,hy,-hz],[-hx,hy,-hz],uv(regions.top,false,true),[0,1,0]);
  add([-hx,-hy,-hz],[hx,-hy,-hz],[hx,-hy,hz],[-hx,-hy,hz],uv(regions.bottom,false,true),[0,-1,0]);
  return P; }
function shader(gl,type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s)||'shader compile error');return s;}
function makeProgram(gl){const vs=shader(gl,gl.VERTEX_SHADER,`attribute vec3 aP;attribute vec2 aUV;attribute vec3 aN;uniform mat4 uVP;uniform mat4 uM;varying vec2 vUV;varying vec3 vN;void main(){vUV=aUV;vN=mat3(uM)*aN;gl_Position=uVP*uM*vec4(aP,1.0);}`);const fs=shader(gl,gl.FRAGMENT_SHADER,`precision mediump float;uniform sampler2D uTex;uniform vec4 uColor;uniform bool uTextured;varying vec2 vUV;varying vec3 vN;void main(){vec4 c=uTextured?texture2D(uTex,vUV):uColor;if(c.a<0.02)discard;vec3 L=normalize(vec3(.3,.85,.55));float sh=.72+.28*max(dot(normalize(vN),L),0.0);gl_FragColor=vec4(c.rgb*sh,c.a);}`);const p=gl.createProgram();gl.attachShader(p,vs);gl.attachShader(p,fs);gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p)||'program link error');return p;}
function makePreview(){
  let gl;try{gl=els.previewCanvas.getContext('webgl',{alpha:false,antialias:false,powerPreference:'low-power',preserveDrawingBuffer:false});}catch{gl=null;}
  const noop={ready:false,modelName:'Preview unavailable',update(){},invalidate(){},setModel(){},front(){},top(){},back(){},side(){},reset(){},fit(){},renderNow(){},togglePlay(){},setPose(){},setSpeed(){}};
  if(!gl)return noop;
  let program;try{program=makeProgram(gl);}catch(err){console.error(err);return noop;}
  const loc={p:gl.getAttribLocation(program,'aP'),uv:gl.getAttribLocation(program,'aUV'),n:gl.getAttribLocation(program,'aN'),vp:gl.getUniformLocation(program,'uVP'),m:gl.getUniformLocation(program,'uM'),tex:gl.getUniformLocation(program,'uTex'),color:gl.getUniformLocation(program,'uColor'),textured:gl.getUniformLocation(program,'uTextured')};
  const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  const skinCanvas=document.createElement('canvas');let skinCtx=skinCanvas.getContext('2d');skinCtx.imageSmoothingEnabled=false;const meshes={};const pv={ready:true,modelName:'Classic / Steve',yaw:.18,pitch:.12,zoom:1.0,drag:false,lastX:0,lastY:0,pointers:new Map(),pinch:null,animation:'none',playing:false,speed:1,animTime:0,lastTime:0,dirty:true};
  function syncTexture(){if(skinCanvas.width!==state.size||skinCanvas.height!==state.size){skinCanvas.width=state.size;skinCanvas.height=state.size;skinCtx=skinCanvas.getContext('2d');skinCtx.imageSmoothingEnabled=false;}skinCtx.putImageData(pixelsToImageData(),0,0);gl.bindTexture(gl.TEXTURE_2D,tex);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,skinCanvas);pv.dirty=false;}
  function upload(name,data){const b={p:gl.createBuffer(),u:gl.createBuffer(),n:gl.createBuffer(),i:gl.createBuffer(),count:data.i.length};gl.bindBuffer(gl.ARRAY_BUFFER,b.p);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data.p),gl.STATIC_DRAW);gl.bindBuffer(gl.ARRAY_BUFFER,b.u);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data.u),gl.STATIC_DRAW);gl.bindBuffer(gl.ARRAY_BUFFER,b.n);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data.n),gl.STATIC_DRAW);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,b.i);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(data.i),gl.STATIC_DRAW);meshes[name]=b;}
  function clearMeshes(){for(const m of Object.values(meshes)){gl.deleteBuffer(m.p);gl.deleteBuffer(m.u);gl.deleteBuffer(m.n);gl.deleteBuffer(m.i);}for(const k of Object.keys(meshes))delete meshes[k];}
  function build(model){clearMeshes();const C=layout(model),L=scaledLayout(model),parts=[['head',[0,12,0],[8,8,8],L.head],['body',[0,2,0],[8,12,4],L.body],['rightLeg',[-2,-10,0],[4,12,4],L.rightLeg],['leftLeg',[2,-10,0],[4,12,4],L.leftLeg],['rightArm',[-(4+C.armW/2),1.6,0],[C.armW,12,4],L.rightArm],['leftArm',[(4+C.armW/2),1.6,0],[C.armW,12,4],L.leftArm]];for(const [name,,size,part] of parts)upload(name,cubeData(size,part.regions,state.size));const outer=[['headOuter',[8.75,8.75,8.75],L.outerHead],['bodyOuter',[8.75,12.75,4.75],L.outerBody],['rightLegOuter',[4.75,12.75,4.75],L.outerRightLeg],['leftLegOuter',[4.75,12.75,4.75],L.outerLeftLeg],['rightArmOuter',[C.armW+.75,12.75,4.75],L.outerRightArm],['leftArmOuter',[C.armW+.75,12.75,4.75],L.outerLeftArm]];for(const [name,size,part] of outer)upload(name,cubeData(size,part.regions,state.size));pv.modelName=model==='slim'?'Slim / Alex':'Classic / Steve';pv.dirty=true;render();}
  function resize(){const dpr=Math.min(window.devicePixelRatio||1,1.5),w=Math.max(240,Math.round(els.previewCanvas.clientWidth*dpr)),h=Math.max(240,Math.round(els.previewCanvas.clientHeight*dpr));if(els.previewCanvas.width!==w||els.previewCanvas.height!==h){els.previewCanvas.width=w;els.previewCanvas.height=h;}gl.viewport(0,0,els.previewCanvas.width,els.previewCanvas.height);}
  function draw(name,m,texd=true,color=[.45,.7,.95,1]){const b=meshes[name];if(!b)return;gl.uniformMatrix4fv(loc.m,false,m);gl.uniform1i(loc.textured,texd?1:0);gl.uniform4fv(loc.color,new Float32Array(color));gl.bindBuffer(gl.ARRAY_BUFFER,b.p);gl.enableVertexAttribArray(loc.p);gl.vertexAttribPointer(loc.p,3,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ARRAY_BUFFER,b.u);gl.enableVertexAttribArray(loc.uv);gl.vertexAttribPointer(loc.uv,2,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ARRAY_BUFFER,b.n);gl.enableVertexAttribArray(loc.n);gl.vertexAttribPointer(loc.n,3,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,b.i);gl.drawElements(gl.TRIANGLES,b.count,gl.UNSIGNED_SHORT,0);}
  function partM(pos,pivot,rx=0,ry=0,rz=0){let m=T(pos[0],pos[1],pos[2]);if(pivot)m=mat4Mul(T(pivot[0],pivot[1],pivot[2]),mat4Mul(RX(rx),mat4Mul(RY(ry),mat4Mul(RZ(rz),T(pos[0]-pivot[0],pos[1]-pivot[1],pos[2]-pivot[2])))));return m;}
  function render(now=performance.now()){
    resize();if(pv.dirty)syncTexture();if(pv.playing){const dt=Math.min(.05,(now-pv.lastTime)/1000||0);pv.animTime+=dt*pv.speed;pv.lastTime=now;}
    gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.clearColor(.025,.03,.04,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,tex);gl.uniform1i(loc.tex,0);
    const aspect=els.previewCanvas.width/els.previewCanvas.height,dist=40/pv.zoom,cp=Math.cos(pv.pitch),eye=[Math.sin(pv.yaw)*cp*dist,Math.sin(pv.pitch)*dist+1,Math.cos(pv.yaw)*cp*dist],vp=mat4Mul(perspective(28*Math.PI/180,aspect,.1,180),lookAt(eye,[0,0,0],[0,1,0]));gl.uniformMatrix4fv(loc.vp,false,vp);
    const armW=layout(state.model).armW,walk=state.animation==='walk'?Math.sin(pv.animTime*5.4)*.45:0,parts=[['head',[0,12,0],null],[ 'body',[0,2,0],null],['rightLeg',[-2,-10,0],[-2,-4,0],-walk],['leftLeg',[2,-10,0],[2,-4,0],walk],['rightArm',[-(4+armW/2),1.6,0],[-(4+armW/2),7.6,0],walk],['leftArm',[(4+armW/2),1.6,0],[(4+armW/2),7.6,0],-walk]];
    for(const [name,pos,pivot,rot] of parts)draw(name,partM(pos,pivot,rot||0,0,0));
    if(state.outer){const map={head:'headOuter',body:'bodyOuter',rightLeg:'rightLegOuter',leftLeg:'leftLegOuter',rightArm:'rightArmOuter',leftArm:'leftArmOuter'};for(const [name,pos,pivot,rot] of parts)draw(map[name],partM(pos,pivot,rot||0,0,0));}
    if(state.geometry.enabled){const g=state.geometry,deg=[g.rx*Math.PI/180,g.ry*Math.PI/180,g.rz*Math.PI/180],m=partM([g.x,g.y,g.z],[g.x,g.y,g.z],...deg);const data=cubeData([g.w,g.h,g.d],{front:{x:0,y:0,w:1,h:1},back:{x:0,y:0,w:1,h:1},left:{x:0,y:0,w:1,h:1},right:{x:0,y:0,w:1,h:1},top:{x:0,y:0,w:1,h:1},bottom:{x:0,y:0,w:1,h:1}},1);if(!meshes.__geo)upload('__geo',data);draw('__geo',m,false,hexToRgba(g.color||'#B68CFF',255).map((v,i)=>i<3?v/255:v));}
    if(pv.playing)requestAnimationFrame(render);
  }
  function rebuild(){build(state.model);}
  function update(){pv.dirty=true;if(!pv.playing)render();}
  function setModel(model){build(model);}
  function setPose(){state.animation=els.animationSelect.value;if(!pv.playing)render();}
  function reset(){pv.yaw=.18;pv.pitch=.12;pv.zoom=1;pv.animTime=0;pv.playing=false;els.animationSelect.value='none';state.animation='none';els.animationStatus.textContent='OFF';els.animationToggle.textContent='Play';render();}
  function front(){pv.yaw=0;pv.pitch=.04;render();} function back(){pv.yaw=Math.PI;pv.pitch=.04;render();} function top(){pv.yaw=0;pv.pitch=1.2;render();} function side(){pv.yaw=Math.PI/2;pv.pitch=.04;render();} function fit(){pv.zoom=1;render();}
  els.previewCanvas.addEventListener('pointerdown',e=>{els.previewCanvas.setPointerCapture?.(e.pointerId);pv.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pv.pointers.size===1){pv.drag=true;pv.lastX=e.clientX;pv.lastY=e.clientY;}else if(pv.pointers.size===2){pv.drag=false;const[a,b]=[...pv.pointers.values()];pv.pinch={dist:Math.hypot(a.x-b.x,a.y-b.y),zoom:pv.zoom};}});
  els.previewCanvas.addEventListener('pointermove',e=>{if(pv.pointers.has(e.pointerId))pv.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pv.pointers.size>=2){const[a,b]=[...pv.pointers.values()],d=Math.hypot(a.x-b.x,a.y-b.y);if(pv.pinch)pv.zoom=clamp(pv.pinch.zoom*d/(pv.pinch.dist||1),.62,2.8);render();return;}if(!pv.drag)return;pv.yaw+=(e.clientX-pv.lastX)*.01;pv.pitch=clamp(pv.pitch+(e.clientY-pv.lastY)*.01,-1.35,1.35);pv.lastX=e.clientX;pv.lastY=e.clientY;render();});
  ['pointerup','pointercancel','pointerleave'].forEach(ev=>els.previewCanvas.addEventListener(ev,e=>{pv.pointers.delete(e.pointerId);if(pv.pointers.size<2)pv.pinch=null;pv.drag=false;}));
  els.previewCanvas.addEventListener('wheel',e=>{e.preventDefault();pv.zoom=clamp(pv.zoom*(e.deltaY<0?1.1:.91),.62,2.8);render();},{passive:false});
  function togglePlay(){pv.playing=!pv.playing;if(pv.playing){state.animation='walk';els.animationSelect.value='walk';els.animationStatus.textContent='ON';els.animationToggle.textContent='Pause';pv.lastTime=performance.now();requestAnimationFrame(render);}else{els.animationStatus.textContent='OFF';els.animationToggle.textContent='Play';render();}}
  function invalidate(){pv.dirty=true;if(!pv.playing)render();}
  build(state.model);return{ready:true,modelName:pv.modelName,update, invalidate, setModel,front,top,back,side,reset,fit,renderNow:render,togglePlay,setPose,setSpeed(v){pv.speed=v;}};
}

function editorPointerDown(e){
  if(e.pointerType==='mouse'&&e.button===2){e.preventDefault();const p=eventToPixel(e),c=getPixel(p.x,p.y);if(c[3])setColor('#'+rgbaToHex(c[0],c[1],c[2]));return;}
  if(e.pointerType==='mouse'&&e.button!==0)return;
  els.canvas.setPointerCapture?.(e.pointerId);state.activePointers.set(e.pointerId,{x:e.clientX,y:e.clientY,type:e.pointerType});
  if(state.activePointers.size===2){state.drawing=false;if(state.strokeBefore)state.pixels.set(state.strokeBefore);state.strokeBefore=null;state.strokeChanged=false;state.dragStart=null;const pts=[...state.activePointers.values()],a=pts[0],b=pts[1];state.editorGesture={dist:Math.hypot(a.x-b.x,a.y-b.y)||1,mid:{x:(a.x+b.x)/2,y:(a.y+b.y)/2},zoom:state.zoom,panX:state.panX,panY:state.panY};return;}
  const p=eventToPixel(e);els.cursorReadout.textContent=`X: ${clamp(p.x,0,state.size-1)} Y: ${clamp(p.y,0,state.size-1)}`;state.drawing=true;state.strokeBefore=new Uint8ClampedArray(state.pixels);state.strokeChanged=false;state.dragStart=p;
  if(!['line','rect','circle'].includes(state.tool))state.strokeChanged=toolAt(p.x,p.y)||state.strokeChanged;scheduleRender();
}
function editorPointerMove(e){
  if(state.activePointers.has(e.pointerId))state.activePointers.set(e.pointerId,{x:e.clientX,y:e.clientY,type:e.pointerType});
  if(state.activePointers.size>=2&&state.editorGesture){const pts=[...state.activePointers.values()],a=pts[0],b=pts[1],dist=Math.hypot(a.x-b.x,a.y-b.y)||1,mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2},g=state.editorGesture;const r=els.canvas.getBoundingClientRect();state.zoom=clamp(g.zoom*dist/g.dist,.35,14);state.panX=g.panX+(mid.x-g.mid.x);state.panY=g.panY+(mid.y-g.mid.y);clampPan();scheduleRender();return;}
  if(!state.drawing)return;const p=eventToPixel(e);els.cursorReadout.textContent=`X: ${clamp(p.x,0,state.size-1)} Y: ${clamp(p.y,0,state.size-1)}`;if(['pencil','brush','eraser'].includes(state.tool)){const from=state.dragStart||p;for(const [x,y] of linePixels(from.x,from.y,p.x,p.y))state.strokeChanged=toolAt(x,y)||state.strokeChanged;state.dragStart=p;scheduleRender();}
}
function editorPointerUp(e){
  state.activePointers.delete(e.pointerId);if(state.activePointers.size>=2)return;if(state.editorGesture){state.editorGesture=null;return;}if(!state.drawing)return;const p=eventToPixel(e);if(['line','rect','circle'].includes(state.tool)){if(state.tool==='line')for(const [x,y] of linePixels(state.dragStart.x,state.dragStart.y,p.x,p.y))state.strokeChanged=toolAt(x,y)||state.strokeChanged;else if(state.tool==='circle')for(const [x,y] of circlePixels(state.dragStart.x,state.dragStart.y,p.x,p.y))state.strokeChanged=toolAt(x,y)||state.strokeChanged;else{const x0=Math.min(state.dragStart.x,p.x),x1=Math.max(state.dragStart.x,p.x),y0=Math.min(state.dragStart.y,p.y),y1=Math.max(state.dragStart.y,p.y);for(let x=x0;x<=x1;x++){state.strokeChanged=toolAt(x,y0)||state.strokeChanged;state.strokeChanged=toolAt(x,y1)||state.strokeChanged;}for(let y=y0;y<=y1;y++){state.strokeChanged=toolAt(x0,y)||state.strokeChanged;state.strokeChanged=toolAt(x1,y)||state.strokeChanged;}}}state.drawing=false;state.dragStart=null;if(state.strokeChanged){saveHistory();saveProjectToLibrary();}scheduleRender();}
function editorWheel(e){e.preventDefault();const p=localPoint(e);zoomAt(p.x,p.y,state.zoom*(e.deltaY<0?1.15:.87));}

function bind(){
  loadTheme();
  els.themeSelect?.addEventListener('change',e=>{applyTheme(e.target.value);scheduleRender();});
  $$('.tool-btn').forEach(b=>b.addEventListener('click',()=>setTool(b.dataset.tool)));
  els.brushSize?.addEventListener('input',()=>{state.brushSize=+els.brushSize.value;els.brushSizeValue.textContent=`${state.brushSize} px`;});
  els.brushOpacity?.addEventListener('input',()=>{state.brushOpacity=+els.brushOpacity.value/100;els.brushOpacityValue.textContent=`${els.brushOpacity.value}%`;});
  els.brushShape?.addEventListener('change',()=>state.brushShape=els.brushShape.value);
  els.brushMode?.addEventListener('change',()=>state.brushMode=els.brushMode.value);
  els.replaceTolerance?.addEventListener('input',()=>{state.replaceTolerance=+els.replaceTolerance.value;els.toleranceValue.textContent=String(state.replaceTolerance);});
  els.shadeMode?.addEventListener('change',()=>state.shadeMode=els.shadeMode.value);
  $('#gridToggle')?.addEventListener('change',e=>{state.grid=e.target.checked;scheduleRender();});
  $('#checkerToggle')?.addEventListener('change',e=>{state.checker=e.target.checked;scheduleRender();});
  $('#mirrorToggle')?.addEventListener('change',e=>{state.mirror=e.target.checked;});
  els.outerToggle?.addEventListener('change',e=>{state.outer=e.target.checked;preview?.renderNow();});
  els.referenceToggle?.addEventListener('change',e=>{state.referenceVisible=e.target.checked;scheduleRender();});
  els.referenceOpacity?.addEventListener('input',e=>{state.referenceOpacity=+e.target.value/100;els.referenceOpacityValue.textContent=`${e.target.value}%`;scheduleRender();});
  els.colorInput?.addEventListener('input',e=>setColor(e.target.value));
  els.hexInput?.addEventListener('input',e=>{const v=e.target.value.replace(/[^0-9a-f]/gi,'').slice(0,6).toUpperCase();e.target.value=v;if(v.length===6)setColor('#'+v,false);});
  $('#undoBtn')?.addEventListener('click',undo);$('#redoBtn')?.addEventListener('click',redo);
  $('#zoomInBtn')?.addEventListener('click',()=>zoomAt(els.canvas.clientWidth/2,els.canvas.clientHeight/2,state.zoom*1.25));$('#zoomOutBtn')?.addEventListener('click',()=>zoomAt(els.canvas.clientWidth/2,els.canvas.clientHeight/2,state.zoom*.8));$('#fitBtn')?.addEventListener('click',fitCanvas);$('#centerCanvasBtn')?.addEventListener('click',()=>{state.panX=state.panY=0;scheduleRender();});
  $('#gridBtn')?.addEventListener('click',()=>$('#gridToggle')?.click());$('#checkerBtn')?.addEventListener('click',()=>$('#checkerToggle')?.click());
  $('#newSkinBtn')?.addEventListener('click',()=>{if(confirm('Create a new starter skin? Unsaved changes will be replaced.')){createStarterPixels(state.model,state.size);state.history=[];state.historyIndex=-1;saveHistory();setDocMeta();fitCanvas();scheduleRender();toast('Starter skin loaded.');}});
  $('#templateBtn')?.addEventListener('click',()=>{createStarterPixels(state.model,state.size);state.history=[];state.historyIndex=-1;saveHistory();setDocMeta();fitCanvas();scheduleRender();toast('Complete editable template loaded.');});
  $('#importBtn')?.addEventListener('click',()=>els.skinFileInput?.click());$('#uploadSkinHero')?.addEventListener('click',()=>els.skinFileInput?.click());els.skinFileInput?.addEventListener('change',e=>{importSkin(e.target.files?.[0]);e.target.value='';});
  $('#referenceBtn')?.addEventListener('click',()=>els.referenceFileInput?.click());$('#referenceButton2')?.addEventListener('click',()=>els.referenceFileInput?.click());els.referenceFileInput?.addEventListener('change',e=>{loadReference(e.target.files?.[0]);e.target.value='';});$('#useReferenceAsSkinBtn')?.addEventListener('click',useReferenceAsSkin);$('#clearReferenceBtn')?.addEventListener('click',clearReference);
  $('#exportBtn')?.addEventListener('click',exportPng);$('#downloadTemplateBtn')?.addEventListener('click',downloadStarter);
  $('#guideBtn')?.addEventListener('click',()=>{$('#guideModal').hidden=false;renderGuide();});$('#guideBtn2')?.addEventListener('click',()=>{$('#guideModal').hidden=false;renderGuide();});$('#closeGuideBtn')?.addEventListener('click',()=>{$('#guideModal').hidden=true;});
  els.modelSelect?.addEventListener('change',()=>{state.model=els.modelSelect.value;preview?.setModel(state.model);renderGuide();renderChecks();scheduleRender();toast(`${state.model==='slim'?'Slim / Alex':'Classic / Steve'} selected.`);});
  els.textureSizeSelect?.addEventListener('change',e=>{const n=+e.target.value;if(n!==state.size){const old=new Uint8ClampedArray(state.pixels),next=new Uint8ClampedArray(n*n*4);scalePixels(old,state.size,next,n);state.size=n;state.pixels=next;state.history=[];state.historyIndex=-1;saveHistory();setDocMeta();preview?.setModel(state.model);fitCanvas();scheduleRender();toast(`Texture resized to ${n}×${n}.`);}});
  $('#clearHistoryBtn')?.addEventListener('click',()=>{state.recentColors=[DEFAULT_COLOR];renderPalettes();});
  $('#librarySaveBtn')?.addEventListener('click',()=>{saveProjectToLibrary();toast('Current skin saved to My skins.');});
  els.canvas.addEventListener('pointerdown',editorPointerDown);els.canvas.addEventListener('pointermove',editorPointerMove);els.canvas.addEventListener('pointerup',editorPointerUp);els.canvas.addEventListener('pointercancel',editorPointerUp);els.canvas.addEventListener('wheel',editorWheel,{passive:false});els.canvas.addEventListener('contextmenu',e=>e.preventDefault());
  $('#frontBtn')?.addEventListener('click',()=>preview?.front());$('#topBtn')?.addEventListener('click',()=>preview?.top());$('#backBtn')?.addEventListener('click',()=>preview?.back());$('#sideBtn')?.addEventListener('click',()=>preview?.side());$('#resetViewBtn')?.addEventListener('click',()=>preview?.reset());$('#previewZoomFitBtn')?.addEventListener('click',()=>preview?.fit());
  $('#animationSelect')?.addEventListener('change',()=>preview?.setPose());$('#animationToggle')?.addEventListener('click',()=>preview?.togglePlay());$('#animationReset')?.addEventListener('click',()=>preview?.reset());els.animationSpeed?.addEventListener('input',e=>{const v=+e.target.value;els.animationSpeedValue.textContent=`${v.toFixed(2)}×`;preview?.setSpeed(v);});
  els.geometryToggle?.addEventListener('change',e=>{state.geometry.enabled=e.target.checked;readGeometry();preview?.renderNow();});$$('.geometry-grid input').forEach(i=>i.addEventListener('input',()=>{readGeometry();preview?.renderNow();}));$('#geoResetBtn')?.addEventListener('click',resetGeometry);$('#geoExportBtn')?.addEventListener('click',exportGeometryJSON);
  window.addEventListener('resize',()=>{renderEditor();preview?.renderNow();});
  window.addEventListener('keydown',e=>{const tag=(e.target?.tagName||'').toLowerCase();if(['input','textarea','select'].includes(tag))return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();undo();}else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo();}else if(e.key.toLowerCase()==='f')fitCanvas();});
}

loadTheme();
bind();
setColor(DEFAULT_COLOR,false);
createStarterPixels(state.model,64);
saveHistory();setDocMeta();setGeometryInputs();renderPalettes();renderGuide();loadLibrary();
preview=makePreview();
requestAnimationFrame(()=>{renderEditor();renderChecks();preview?.renderNow();});
