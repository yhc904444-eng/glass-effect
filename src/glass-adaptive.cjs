'use strict';
const {spawn}=require('node:child_process');
const linear=v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;};
const luminance=rgb=>rgb.map(linear).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
function targetAlpha(color){
 if(!Array.isArray(color)||color.length!==3||color.some(v=>!Number.isFinite(v)||v<0||v>255))return .77;
 const tint=[24,31,41],ink=[198,216,229];
 const passes=alpha=>contrast(ink,color.map((v,i)=>(v*(1-alpha)+tint[i]*alpha)*.975+255*.025))>=4.8;
 if(passes(.12))return .12;
 let low=.12,high=.84;for(let i=0;i<16;i++){const middle=(low+high)/2;if(passes(middle))high=middle;else low=middle;}
 return Math.min(.84,high+.008);
}
class AdaptiveFilter{
 constructor(){this.alpha=.77;this.lastTime=0;this.lastGood=0;this.validCount=0;this.darkSince=null;this.failures=0;}
 update(sample,now=Date.now()){
  const elapsed=this.lastTime?Math.max(16,Math.min(1000,now-this.lastTime)):500;this.lastTime=now;
  let target=this.alpha,status='active';
  const valid=sample?.ok&&[sample.mean,sample.brightFraction,sample.durationMs].every(Number.isFinite)&&Array.isArray(sample.referenceColor)&&sample.referenceColor.length===3&&sample.referenceColor.every(v=>Number.isFinite(v)&&v>=0&&v<=255);
  if(valid){
   this.lastGood=now;this.validCount++;this.failures=0;target=targetAlpha(sample.detailFraction>=.02&&Array.isArray(sample.peakColor)?sample.peakColor:sample.referenceColor);
   if(target<this.alpha-.015){if(this.darkSince===null)this.darkSince=now;if(this.validCount<2||now-this.darkSince<700)target=this.alpha;}else this.darkSince=null;
  }else{this.failures++;status='fallback';this.darkSince=null;if(this.failures>=2||!this.lastGood||now-this.lastGood>=1500)target=.77;}
  if(Math.abs(target-this.alpha)>.006){const factor=1-Math.exp(-elapsed/(target>this.alpha?220:500));this.alpha+=(target-this.alpha)*factor;}
  this.alpha=Math.min(.84,Math.max(.12,this.alpha));
  return {alpha:Number(this.alpha.toFixed(4)),status,brightness:valid?Number(sample.mean.toFixed(4)):null,brightFraction:valid?Number(sample.brightFraction.toFixed(4)):null,sampleMs:valid?Number(sample.durationMs.toFixed(2)):null};
 }
}
class NativeSampler{
 constructor(executable){this.executable=executable;this.child=null;this.pending=null;this.nextStart=0;}
 start(){
  if(this.child)return;if(Date.now()<this.nextStart)throw Error('Sampler cooling down');
  const child=spawn(this.executable,[],{windowsHide:true,stdio:['pipe','pipe','pipe']});this.child=child;let buffer='';
  const fail=()=>{if(this.child===child){this.child=null;this.nextStart=Date.now()+2000;}if(this.pending?.child===child){const pending=this.pending;this.pending=null;clearTimeout(pending.timer);pending.resolve({ok:false,reason:'sampler-unavailable'});}};
  child.on('error',fail);child.on('exit',fail);child.stdin.on('error',fail);child.stderr.on('data',()=>{});
  child.stdout.on('data',chunk=>{buffer+=chunk.toString('utf8');if(buffer.length>16384){fail();child.kill();return;}let end;while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end);buffer=buffer.slice(end+1);if(this.pending?.child===child){const pending=this.pending;this.pending=null;clearTimeout(pending.timer);try{pending.resolve(JSON.parse(line));}catch{pending.resolve({ok:false,reason:'invalid-sample'});}}}});
 }
 async sample(hwnd,exclude){
  if(this.pending)return {ok:false,reason:'sampler-busy'};try{this.start();}catch{return {ok:false,reason:'sampler-unavailable'};}
  const child=this.child;return new Promise(resolve=>{const timer=setTimeout(()=>{if(this.pending?.child===child){this.pending=null;this.nextStart=Date.now()+2000;this.child=null;child.kill();resolve({ok:false,reason:'sampler-timeout'});}},1500);timer.unref?.();this.pending={resolve,timer,child};child.stdin.write(JSON.stringify({hwnd,exclude})+'\n');});
 }
 stop(){if(this.pending){clearTimeout(this.pending.timer);this.pending.resolve({ok:false,reason:'sampler-stopped'});this.pending=null;}const child=this.child;this.child=null;if(child){child.stdin.end();child.kill();}}
}
function createManager({BrowserWindow,managed,getState,executable,getExcludedWindows,samplerOverride}){
 const sampler=samplerOverride||new NativeSampler(executable),filters=new Map(),latest=new Map();let timer=null,busy=false,closed=false;
 const hwnd=win=>win.getNativeWindowHandle().readBigUInt64LE(0).toString(16);
 const windows=()=>[...managed.keys()].map(id=>BrowserWindow.fromId(id)).filter(win=>win&&!win.isDestroyed());
 const send=(win,payload)=>{latest.set(win.id,payload);if(!win.isDestroyed())win.webContents.executeJavaScript('window.__codexGlassAutoUpdate?.('+JSON.stringify(payload)+')').catch(()=>{});};
 const active=()=>{const state=getState();return state.enabled&&state.readingMode==='auto'&&state.scene==='desktop';};
 const schedule=delay=>{if(!closed&&!timer){timer=setTimeout(()=>{timer=null;void tick();},delay);timer.unref?.();}};
 async function tick(){
  if(closed||busy)return;
  if(!active()){sampler.stop();if(getState().readingMode==='auto')for(const win of windows())send(win,{alpha:.77,status:'scene-static'});return;}
  const visible=windows().filter(win=>win.isVisible()&&!win.isMinimized());if(!visible.length){sampler.stop();return;}busy=true;
  try{const excluded=(getExcludedWindows?getExcludedWindows():BrowserWindow.getAllWindows()).filter(win=>!win.isDestroyed()).map(hwnd);for(const win of visible){if(!active()||closed)break;let filter=filters.get(win.id);if(!filter){filter=new AdaptiveFilter();filters.set(win.id,filter);}const sample=await sampler.sample(hwnd(win),excluded);if(!win.isDestroyed()&&active())send(win,filter.update(sample));}}
  catch{for(const win of visible)if(!win.isDestroyed())send(win,{alpha:.77,status:'fallback'});}
  finally{busy=false;if(active())schedule(500);}
 }
 return {
  refresh(){if(closed)return;if(!active()){if(timer){clearTimeout(timer);timer=null;}sampler.stop();}schedule(0);},
  attach(win){for(const event of ['show','restore','focus','hide','minimize'])win.on(event,()=>this.refresh());win.once('closed',()=>{filters.delete(win.id);latest.delete(win.id);this.refresh();});this.refresh();},
  sync(win){send(win,latest.get(win.id)||{alpha:.77,status:'starting'});},
  stop(){closed=true;if(timer)clearTimeout(timer);timer=null;sampler.stop();filters.clear();latest.clear();},
  getLatest(id){return latest.get(id);},
  diagnostics(){return {workerRunning:!!sampler.child,busy,scheduled:!!timer};}
 };
}
module.exports={targetAlpha,contrast,AdaptiveFilter,NativeSampler,createManager};
