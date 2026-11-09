'use strict';
const {app, BrowserWindow, ipcMain, screen} = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const managed = new Map();
const defaults={enabled:true, opacity:8, highlights:48, workspaceTransparency:94, composerTransparency:90, blur:3, scene:'desktop',edgeFlow:true,sidebarTransparency:94,popupTransparency:75,edgeWidth:100,edgeIntensity:100,flowSpeed:100,readingMode:'auto',adaptiveVersion:1};
let state = {...defaults};
const adaptive=require('./glass-adaptive.cjs').createManager({BrowserWindow,managed,getState:()=>state,executable:path.join(process.resourcesPath,'glass-adaptive-sampler.exe')});
app.on('before-quit',()=>adaptive.stop());
let settingsPath,saveQueue=Promise.resolve();
const renderer = fs.readFileSync(path.join(__dirname,'glass-renderer.js'),'utf8');
const css = fs.readFileSync(path.join(__dirname,'glass.css'),'utf8');
const landscape='data:image/png;base64,'+fs.readFileSync(path.join(__dirname,'assets/alpine-lake-v11.png')).toString('base64');
function normalize(input) {
  if (!input || typeof input.enabled !== 'boolean') throw new Error('Invalid glass settings');
  for (const key of ['opacity','highlights']) if (!Number.isFinite(input[key])) throw new Error('Invalid '+key);
  const composerTransparency=input.composerTransparency??defaults.composerTransparency;
  if(!Number.isFinite(composerTransparency))throw new Error('Invalid composer transparency');
  const workspaceTransparency=input.workspaceTransparency??defaults.workspaceTransparency;
  if(!Number.isFinite(workspaceTransparency))throw new Error('Invalid workspace transparency');
  const blur=input.blur??defaults.blur;
  if(!Number.isFinite(blur))throw new Error('Invalid blur');
  const number=(key,fallback,min,max)=>{const value=input[key]??fallback;if(!Number.isFinite(value))throw new Error('Invalid '+key);return Math.round(Math.max(min,Math.min(max,value)));};
  return {enabled:input.enabled,opacity:Math.round(Math.max(0,Math.min(85,input.opacity))),highlights:Math.round(Math.max(0,Math.min(100,input.highlights))),workspaceTransparency:Math.round(Math.max(0,Math.min(95,workspaceTransparency))),composerTransparency:Math.round(Math.max(0,Math.min(95,composerTransparency))),blur:Math.round(Math.max(0,Math.min(16,blur))),scene:input.scene==='alpine'?'alpine':'desktop',edgeFlow:input.edgeFlow!==false,sidebarTransparency:number('sidebarTransparency',workspaceTransparency,0,95),popupTransparency:number('popupTransparency',75,0,100),edgeWidth:number('edgeWidth',100,50,200),edgeIntensity:number('edgeIntensity',100,0,100),flowSpeed:number('flowSpeed',100,25,200),readingMode:input.adaptiveVersion===1&&['clear','balanced','reading','auto'].includes(input.readingMode)?input.readingMode:'auto',adaptiveVersion:1};
}
function allowed(event) {
  const win = BrowserWindow.fromWebContents(event.sender);
  const url=new URL(event.sender.getURL());
  const localApp=url.protocol==='app:' && url.hostname==='-' && ['/index.html','/detached-window.html'].includes(url.pathname);
  if (!win || !managed.has(win.id) || !localApp || event.senderFrame?.parent) throw new Error('Glass settings unavailable in this window');
}
function inject(win) {
  if(win.isDestroyed()) return;
  win.webContents.executeJavaScript(`(${renderer})(${JSON.stringify(state)},${JSON.stringify(css)},${app.commandLine.hasSwitch('liquid-glass-settings')},${JSON.stringify(landscape)})`).then(()=>{syncWindowFrame(win);adaptive.sync(win);}).catch(error=>console.error('[Glass Effect] Renderer:',error.message));
}
function syncWindowFrame(win) {
  if(win.isDestroyed())return;
  const expanded=win.isMaximized()||win.isFullScreen();
  win.webContents.executeJavaScript(`document.documentElement.classList.toggle('lg-window-expanded',${expanded})`).catch(()=>{});
}
app.whenReady().then(()=>{
  try { if(process.platform==='win32'&&typeof app.setAppUserModelId==='function')app.setAppUserModelId('GlassEffect.Desktop'); } catch(error) { console.error('[Glass] Window identity:',error.message); }
  settingsPath = path.join(app.getPath('userData'),'liquid-glass.json');
  try { state=normalize(JSON.parse(fs.readFileSync(settingsPath,'utf8'))); } catch(error) { if(error.code!=='ENOENT') console.error('[Glass Effect] Settings:',error.message); }
  ipcMain.handle('codex-preview:glass:get',event=>{allowed(event);return state;});
  ipcMain.handle('codex-preview:glass:set',async(event,input)=>{
    allowed(event);
    const next=normalize(input);
    const commit=async()=>{
      if(JSON.stringify(next)===JSON.stringify(state))return state;
      const materialChanged=state.enabled!==next.enabled;
      await fs.promises.writeFile(settingsPath+'.tmp',JSON.stringify(next,null,2));
      await fs.promises.rename(settingsPath+'.tmp',settingsPath);
      state=next;adaptive.refresh();
      for(const [id,restore] of managed){
        const win=BrowserWindow.fromId(id);
        if(!win||win.isDestroyed())continue;
        if(materialChanged)restore();
        if(win.webContents.id!==event.sender.id)win.webContents.send('codex-preview:glass:changed',state);
      }
      return state;
    };
    const saved=saveQueue.then(commit);saveQueue=saved.catch(()=>{});
    return saved;
  });
});
exports.applyWindow = function(win,appearance,restore) {
  if(process.platform!=='win32' || !['primary','detached'].includes(appearance)) return false;
  if(!managed.has(win.id)) {
    if(appearance==='primary'&&app.commandLine.hasSwitch('liquid-glass-preview-4-3'))win.webContents.once('dom-ready',()=>{
      const area=screen.getDisplayMatching(win.getBounds()).workArea;
      const width=Math.floor(Math.min(1280,area.width*.9,area.height*.88*4/3)/4)*4;
      const height=width*3/4;
      if(win.isMaximized())win.unmaximize();
      win.setBounds({x:Math.round(area.x+(area.width-width)/2),y:Math.round(area.y+(area.height-height)/2),width,height});
    });
    win.webContents.on('dom-ready',()=>inject(win));
    for(const event of ['maximize','unmaximize','enter-full-screen','leave-full-screen'])win.on(event,()=>syncWindowFrame(win));
    win.once('closed',()=>managed.delete(win.id));adaptive.attach(win);
  }
  managed.set(win.id,restore);adaptive.refresh();
  if(!state.enabled) return false;
  win.setBackgroundColor('#00000000');
  win.setBackgroundMaterial('none');
  return true;
};

exports.prepareWindowOptions=function(options,appearance){
 if(process.platform==='win32'&&['primary','detached'].includes(appearance))return {...options,transparent:true,backgroundColor:'#00000000',backgroundMaterial:'none'};
 return options;
};
