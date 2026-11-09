'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const sourceRoot=path.resolve(__dirname,'../src'),source=fs.readFileSync(path.join(sourceRoot,'glass-main.cjs'),'utf8');
test('migration preserves appearance, serializes saves, broadcasts, reloads manual mode, and rejects subframes',async t=>{
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'glass-settings-'));t.after(()=>fs.rmSync(profile,{recursive:true,force:true}));
 const old={enabled:true,opacity:0,highlights:100,workspaceTransparency:95,composerTransparency:91,blur:0,scene:'desktop',edgeFlow:true,sidebarTransparency:75,popupTransparency:50,edgeWidth:120,edgeIntensity:80,flowSpeed:140,readingMode:'reading'};
 const settingsPath=path.join(profile,'liquid-glass.json');fs.writeFileSync(settingsPath,JSON.stringify(old));
 function boot(){
  const handlers=new Map(),windows=new Map(),module={exports:{}};
  const electron={app:{on:()=>{},whenReady:()=>({then:fn=>fn()}),getPath:()=>profile,setAppUserModelId:()=>{},commandLine:{hasSwitch:()=>false}},BrowserWindow:{fromWebContents:sender=>windows.get(sender.windowId),fromId:id=>windows.get(id)},ipcMain:{handle:(name,fn)=>handlers.set(name,fn)},screen:{}};
  vm.runInNewContext(source,{require:name=>name==='./glass-adaptive.cjs'?{createManager:()=>({refresh:()=>{},attach:()=>{},stop:()=>{},sync:()=>{}})}:name==='electron'?electron:require(name),__dirname:sourceRoot,module,exports:module.exports,console,Buffer,process:{...process,platform:'win32',resourcesPath:profile},URL});
  function addWindow(id){const messages=[],sender={id:id+10,windowId:id,getURL:()=> 'app://-/index.html'};const win={id,messages,isDestroyed:()=>false,on:()=>{},once:()=>{},setBackgroundColor:()=>{},setBackgroundMaterial:()=>{},webContents:{id:sender.id,on:()=>{},once:()=>{},send:(channel,state)=>messages.push({channel,state})}};windows.set(id,win);module.exports.applyWindow(win,'primary',()=>{});return {win,event:{sender,senderFrame:{parent:null}}};}
  return {handlers,addWindow};
 }
 const runtime=boot(),a=runtime.addWindow(1),b=runtime.addWindow(2),get=runtime.handlers.get('codex-preview:glass:get'),set=runtime.handlers.get('codex-preview:glass:set');
 assert.equal(get(a.event).readingMode,'auto');
 for(const [key,value] of Object.entries(old).filter(([k])=>k!=='readingMode'))assert.equal(get(a.event)[key],value,key);
 assert.deepEqual(JSON.parse(fs.readFileSync(settingsPath)),old,'migration does not rewrite the file');
 await Promise.all([set(a.event,{...old,adaptiveVersion:1,readingMode:'balanced'}),set(a.event,{...old,adaptiveVersion:1,readingMode:'clear'})]);
 const saved=JSON.parse(fs.readFileSync(settingsPath));assert.equal(saved.readingMode,'clear');
 for(const [key,value] of Object.entries(old).filter(([k])=>k!=='readingMode'))assert.equal(saved[key],value,key);
 assert.equal(b.win.messages.at(-1).state.readingMode,'clear');
 const restarted=boot(),c=restarted.addWindow(3);assert.equal(restarted.handlers.get('codex-preview:glass:get')(c.event).readingMode,'clear');
 await assert.rejects(set({...a.event,senderFrame:{parent:{}}},{...saved,readingMode:'reading'}),/unavailable/);
 assert.equal(JSON.parse(fs.readFileSync(settingsPath)).readingMode,'clear');
});
