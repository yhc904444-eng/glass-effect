'use strict';
// Optional browser QA: set PLAYWRIGHT_MODULE to an installed Playwright module.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.env.GLASS_QA_OUTPUT||path.join(root,'qa/release-1.2.0'));
fs.mkdirSync(out,{recursive:true});
const report={passed:false,checks:[],sliderCases:[]};
const check=(ok,name)=>{report.checks.push({name,passed:!!ok});assert.ok(ok,name);};
const fixture='<!doctype html><html lang="en"><head><meta charset="utf-8"><style>body{font:14px sans-serif;margin:0}main{height:1000px;overflow:auto;padding:24px}[data-app-shell-frame]{min-height:100vh}</style></head><body><div data-app-shell-frame="true"><main data-app-shell-main-surface><div class="group/settings"><h1>Appearance</h1></div></main></div></body></html>';
const state={enabled:true,opacity:0,highlights:100,workspaceTransparency:95,composerTransparency:95,blur:0,scene:'desktop',edgeFlow:false,sidebarTransparency:95,popupTransparency:0,edgeWidth:100,edgeIntensity:100,flowSpeed:140,readingMode:'auto',adaptiveVersion:1};
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1200,height:1100},reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.setContent(fixture);
  await page.evaluate(({state,renderer,css})=>{
   window.saved=state;window.saves=[];window.glassEffect={get:async()=>window.saved,set:async s=>{window.saved=s;window.saves.push(JSON.parse(JSON.stringify(s)));return s;},onChange:cb=>window.onGlassChange=cb};
   (0,eval)('('+renderer+')')(state,css,false,'data:image/png;base64,');window.__codexGlassAutoUpdate({alpha:.77,status:'active'});
  },{state,renderer:fs.readFileSync(path.join(root,'src/glass-renderer.js'),'utf8'),css:fs.readFileSync(path.join(root,'src/glass.css'),'utf8')});
  await page.waitForSelector('#lg-settings');
  check((await page.locator('#lg-settings').innerText()).includes('Glass reading mode'),'English reading mode controls are mounted');
  check(await page.locator('[data-lg-reading-choice]').count()===4,'All four modes are available');
  const choose=async mode=>{await page.locator('[data-lg-reading-choice="'+mode+'"]').click();await page.waitForFunction(m=>window.saved.readingMode===m,mode);};
  const slide=async(key,value)=>{await page.locator('#lg-'+key).evaluate((el,v)=>{el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));},value);await page.waitForFunction(([k,v])=>window.saved[k]===v,[key,value]);await page.waitForTimeout(200);};
  await page.evaluate(()=>{
   const composer=document.createElement('div');composer.setAttribute('data-composer-body','');composer.style.cssText='height:80px;width:400px;';document.body.append(composer);
   const menu=document.createElement('div');menu.setAttribute('role','menu');menu.id='test-menu';menu.innerHTML='<button role="menuitem">Example</button>';menu.style.cssText='position:fixed;right:20px;top:20px;width:200px;height:100px;';document.body.append(menu);
   const peek=document.createElement('div');peek.setAttribute('data-slate-sidebar-peeking','true');peek.innerHTML='<aside id="test-sidebar" data-slate-sidebar-content style="height:200px;width:200px">Sidebar</aside>';document.body.append(peek);
  });
  for(const mode of ['auto','clear','balanced','reading']){
   await choose(mode);const paints=[];for(const value of [95,50,0]){await slide('workspaceTransparency',value);paints.push(await page.locator('[data-app-shell-frame]').evaluate(el=>getComputedStyle(el).backgroundColor));}
   check(new Set(paints).size===3,'Body slider visibly responds and saves in '+mode);
  }
  for(const mode of ['auto','balanced','reading']){
   await choose(mode);
   for(const [key,selector,values] of [['workspaceTransparency','[data-app-shell-frame]',[95,50,0]],['opacity','[data-app-shell-frame]',[0,40,85]],['composerTransparency','[data-composer-body]',[95,50,0]],['popupTransparency','#test-menu',[100,50,0]],['sidebarTransparency','#test-sidebar',[95,50,0]]]){
    await slide('workspaceTransparency',95);await slide('opacity',0);const paints=[];
    for(const value of values){await slide(key,value);paints.push(await page.locator(selector).evaluate(el=>getComputedStyle(el).backgroundColor));}
    check(new Set(paints).size===3,mode+' '+key+' responds at three saved positions');report.sliderCases.push({mode,key,values,paints});
   }
  }
  await choose('auto');await page.evaluate(()=>window.__codexGlassAutoUpdate({alpha:.77,status:'fallback'}));
  check((await page.locator('#lg-reading-help').innerText()).includes('Detection unavailable'),'Capture failure explains the reading fallback');
  await page.evaluate(()=>window.__codexGlassAutoUpdate({alpha:.12,status:'active'}));
  check((await page.locator('#lg-reading-help').innerText()).includes('Dark background'),'Dark background updates the visible status');
  for(const width of [800,500,320]){
   await page.setViewportSize({width,height:1100});
   const fits=await page.locator('.lg-reading-modes').evaluate(el=>{const a=el.getBoundingClientRect(),b=el.parentElement.getBoundingClientRect();return a.width<=b.width+1&&[...el.children].every(c=>{const r=c.getBoundingClientRect();return r.left>=a.left-1&&r.right<=a.right+1;});});
   check(fits,'English mode buttons fit at '+width+'px');
  }
  await page.setViewportSize({width:1200,height:1100});await page.locator('[data-lg-reading-choice="reading"]').focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>window.saved.readingMode==='reading');
  check(await page.locator('[data-lg-reading-choice="reading"]').getAttribute('aria-pressed')==='true','Keyboard activation exposes selected state');
  await page.locator('#lg-scene').selectOption('alpine');await page.waitForFunction(()=>window.saved.scene==='alpine');check(await page.evaluate(()=>document.documentElement.dataset.lgScene==='alpine'),'Scene selection saves and applies');
  await page.locator('#lg-reset').click();await page.waitForFunction(()=>window.saved.readingMode==='auto'&&window.saved.workspaceTransparency===94);check(true,'Restore defaults saves automatic mode');
  check(errors.length===0,'No browser runtime errors');
  await page.screenshot({path:path.join(out,'release-appearance.png'),fullPage:true});report.passed=true;
 }finally{await browser.close();}
})().catch(error=>{report.error=error.stack;process.exitCode=1;}).finally(()=>{fs.writeFileSync(path.join(out,'appearance-validation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,error:report.error}));});
