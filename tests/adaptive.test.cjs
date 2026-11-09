'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {targetAlpha,contrast,AdaptiveFilter,NativeSampler,createManager}=require('../src/glass-adaptive.cjs');
const sample=color=>({ok:true,referenceColor:color,mean:.5,brightFraction:.1,durationMs:25,detailFraction:0});
test('adaptive glass protects reading contrast on bright, midtone, dark and colored backgrounds',()=>{
 for(const color of [[255,255,255],[242,238,230],[180,189,200],[23,33,45],[200,220,255],[255,224,180],[80,145,180]]){
  const alpha=targetAlpha(color),background=color.map((v,i)=>(v*(1-alpha)+[24,31,41][i]*alpha)*.975+255*.025);
  assert.ok(contrast([198,216,229],background)>=4.5,color.join(','));
 }
 assert.ok(targetAlpha([255,255,255])>.73);assert.equal(targetAlpha([23,33,45]),.12);
});
test('transient changes are suppressed, stable darkness clears smoothly, and bright text deepens the base',()=>{
 const filter=new AdaptiveFilter();for(let i=1;i<=12;i++)filter.update(sample([255,255,255]),i*500);
 const bright=filter.alpha;filter.update(sample([23,33,45]),6500);assert.ok(Math.abs(filter.alpha-bright)<.001);
 let previous=filter.alpha;
 for(let i=14;i<=26;i++){filter.update(sample([23,33,45]),i*500);assert.ok(filter.alpha<=previous+.001);previous=filter.alpha;}
 assert.ok(filter.alpha<.2);
 for(let i=27;i<=31;i++)filter.update({...sample([23,33,45]),peakColor:[255,255,255],detailFraction:.1},i*500);
 assert.ok(filter.alpha>.73);
});
test('failed or malformed captures restore the reading base',()=>{
 const filter=new AdaptiveFilter();for(let i=1;i<=20;i++)filter.update(sample([23,33,45]),i*500);
 assert.ok(filter.alpha<.2);
 for(let i=21;i<=25;i++)assert.equal(filter.update({ok:false},i*500).status,'fallback');
 assert.ok(filter.alpha>.73);assert.equal(filter.update({ok:true},13000).status,'fallback');
 for(const invalid of [undefined,[255],[-1,0,0],[NaN,0,0]])assert.equal(targetAlpha(invalid),.77);
});
test('a missing native helper returns an unavailable result and stops cleanly',async()=>{
 const helper=new NativeSampler(require('node:path').join(__dirname,'missing-sampler.exe'));
 try{assert.equal((await helper.sample('0',[])).ok,false);}finally{helper.stop();}
});
test('manager samples behind the window, stops in manual mode, and pauses while hidden',async()=>{
 const events={},calls=[],updates=[];let stopped=0,visible=true;
 const state={enabled:true,readingMode:'auto',scene:'desktop'};
 const win={id:1,isDestroyed:()=>false,isVisible:()=>visible,isMinimized:()=>false,getNativeWindowHandle:()=>{const b=Buffer.alloc(8);b.writeBigUInt64LE(123n);return b;},on:(e,fn)=>events[e]=fn,once:(e,fn)=>events[e]=fn,webContents:{executeJavaScript:async value=>updates.push(value)}};
 const sampler={sample:async(...args)=>{calls.push(args);return sample([255,255,255]);},stop:()=>stopped++};
 const manager=createManager({BrowserWindow:{fromId:()=>win,getAllWindows:()=>[win]},managed:new Map([[1,()=>{}]]),getState:()=>state,samplerOverride:sampler});
 const settle=()=>new Promise(resolve=>setTimeout(resolve,30));
 try{
  manager.attach(win);await settle();assert.equal(calls.length,1);assert.deepEqual(calls[0],['7b',['7b']]);assert.ok(updates.length);
  state.readingMode='clear';manager.refresh();await settle();assert.equal(calls.length,1);assert.ok(stopped);
  state.readingMode='auto';visible=false;manager.refresh();await settle();assert.equal(calls.length,1);
  visible=true;events.show();await settle();assert.equal(calls.length,2);
  state.scene='alpine';manager.refresh();await settle();assert.match(updates.at(-1),/scene-static/);assert.equal(calls.length,2);
 }finally{manager.stop();assert.equal(manager.diagnostics().scheduled,false);}
});
