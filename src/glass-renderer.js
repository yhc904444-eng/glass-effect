function(initial,css,openSettings,landscape) {
  if(window.__codexGlassPreview) return;
  window.__codexGlassPreview=true;
  let state={...initial},pending=Promise.resolve(),saveTimer;
  const root=document.documentElement;
  const style=document.createElement('style');
  style.id='codex-liquid-glass-style';style.textContent=css;document.head.append(style);
  const scenery=document.createElement('div');scenery.id='lg-landscape';scenery.setAttribute('aria-hidden','true');
  scenery.style.backgroundImage='url("'+landscape+'")';document.body.prepend(scenery);
  // Tag permanent surfaces as well as portals. Keep React's nodes, scrolling and hit targets.
  const layoutSurfaces=new Set(),scannedLayers=new WeakMap();
  const scopedElements=(selector,scopes)=>[...new Set(scopes.flatMap(scope=>[...(scope.matches?.(selector)?[scope]:[]),...scope.querySelectorAll(selector)]))];
  const layoutSelector='main[data-app-shell-main-surface],[data-lg-settings-shell],[data-slate-sidebar-content],nav[data-app-navigation-rail],[class*="_ApplicationMenuTopBar_"],[data-slot="card"],[class~="shadow-card"],[class*="bg-surface-elevated-secondary/"],[class*="_Card_"],[class*="_SettingsCard_"],[class*="_CardContainer_"],[data-app-shell-right-panel]';
  const mountLayoutGlass=(scopes)=>{
    const next=new Set();
    for(const el of document.querySelectorAll(layoutSelector)){
      if(el.hasAttribute('data-lg-floating-surface')||el.hasAttribute('data-sidebar-collapsed')||el.closest('[data-lg-floating-surface]'))continue;
      let kind=el.matches('main,[data-lg-settings-shell]')?'workspace':el.matches('[data-slate-sidebar-content]')?'sidebar':el.matches('nav[data-app-navigation-rail]')?'rail':el.className?.includes?.('_ApplicationMenuTopBar_')?'topbar':'card';
      if(kind==='card'&&el.parentElement.closest('[data-lg-layout-surface="card"]'))continue;
      el.setAttribute('data-lg-layout-surface',kind);next.add(el);
    }
    for(const previous of layoutSurfaces)if(!next.has(previous))previous.removeAttribute('data-lg-layout-surface');
    layoutSurfaces.clear();for(const el of next)layoutSurfaces.add(el);
    for(const scope of scopes.filter(el=>el.isConnected&&!el.closest('input,textarea,[contenteditable="true"]'))){
      for(const el of scope.querySelectorAll('div,section,main,aside,nav,header,footer')){
        const signature=el.className+':'+el.getAttribute('style');
        if(scannedLayers.get(el)===signature||el.id.startsWith('lg-')||el.hasAttribute('data-lg-layout-surface')||el.closest('button,pre,code,input,textarea,select,[contenteditable="true"],[data-lg-floating-surface],[role="button"],[role="menuitem"],[role="option"],[role="switch"],[role="tab"]'))continue;
        scannedLayers.set(el,signature);
        const fill=getComputedStyle(el).backgroundColor;
        if(!/^(rgba?\(|color\(srgb )/.test(fill))continue;
        const values=fill.match(/[\d.]+/g)?.map(Number);
        if(fill.startsWith('color(srgb '))values.splice(0,3,...values.slice(0,3).map(v=>v*255));
        if(values&&values.length>=3&&(values.length===3||values[3]>.9)&&Math.max(...values.slice(0,3))-Math.min(...values.slice(0,3))<30)el.setAttribute('data-lg-layout-layer','');
      }
    }
  };
  // Native markdown and individual controls sometimes hard-code neutral dark ink.
  // Recolor only neutral text; preserve semantic colors, code syntax and media.
  const inkSignatures=new WeakMap();
  const mountGlassInk=(scopes)=>{
    for(const el of scopedElements('p,span,strong,em,li,td,th,h1,h2,h3,h4,h5,h6,button,a,input,textarea,[contenteditable="true"],[role="option"]',scopes)){
      if(el.closest('pre,code,svg,canvas,iframe,[data-variant="solid"],[data-color="danger"],[data-color="success"]'))continue;
      const ownText=[...el.childNodes].some(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim());
      if(!ownText&&!el.matches('button,input,textarea,[contenteditable="true"]'))continue;
      const signature=el.className+':'+el.getAttribute('style');
      if(inkSignatures.get(el)===signature)continue;
      inkSignatures.set(el,signature);el.removeAttribute('data-lg-neutral-ink');
      const color=getComputedStyle(el).color,values=color.match(/[\d.]+/g)?.map(Number);
      if(!values||!color.startsWith('rgb')||values.length<3)continue;
      const channels=values.slice(0,3);
      if(Math.max(...channels)-Math.min(...channels)<28&&Math.max(...channels)<150)el.setAttribute('data-lg-neutral-ink','');
    }
  };
  // Settings is a route with nested opaque containers, rather than one dialog.
  // Tag its layout surfaces without moving React nodes or fading their text.
  const mountSettingsGlass=()=>{
    const page=document.querySelector('[class~="group/settings"]');
    const shell=page?.closest('main');
    for(const previous of document.querySelectorAll('[data-lg-settings-shell]')){
      if(previous===shell)continue;
      previous.removeAttribute('data-lg-settings-shell');
      for(const layer of previous.querySelectorAll('[data-lg-settings-layer]'))layer.removeAttribute('data-lg-settings-layer');
      for(const control of previous.querySelectorAll('[data-lg-settings-control]'))control.removeAttribute('data-lg-settings-control');
    }
    if(!shell)return;
    shell.setAttribute('data-lg-settings-shell','');
    // SelectControl renders a span with role=button and paints through ::before.
    // Cover native settings controls across routes, including newly mounted rows.
    for(const el of shell.querySelectorAll('button,[role="button"],[role="combobox"],select,input,textarea,[contenteditable="true"]')){
      if(el.closest('#lg-settings,[role="tablist"],[role="switch"],[role="checkbox"],[role="radio"],[data-color="danger"],[data-color="success"]')||el.matches('[role="tab"],[type="checkbox"],[type="radio"],[type="range"],[type="hidden"],input[aria-hidden="true"],.sr-only,[data-native-selectcontrol]'))continue;
      const kind=el.matches('input,textarea,[contenteditable="true"]')?'field':el.matches('select,[role="combobox"],[class*="_SelectControl_"],[aria-haspopup="listbox"],[aria-haspopup="menu"]')?'select':'button';
      const host=kind==='field'&&el.matches('[class*="_Input_"]')?el.closest('[class*="_Container_"][data-variant]')||el:el;
      if(host!==el)el.removeAttribute('data-lg-settings-control');
      host.setAttribute('data-lg-settings-control',kind);
    }
    for(const el of shell.querySelectorAll('div,main,section,aside,nav,header')){
      if(el.hasAttribute('data-lg-settings-layer')||el.id==='lg-settings'||el.closest('#lg-settings,button,input,textarea,select,[role="button"],[role="tab"],[role="switch"]'))continue;
      const fill=getComputedStyle(el).backgroundColor;
      const values=fill.match(/[\d.]+/g)?.map(Number);
      if(values&&values.length>=3&&(values.length===3||values[3]>.94))el.setAttribute('data-lg-settings-layer','');
    }
  };
  // The peeking sidebar is a native layout surface, not an ARIA popup.
  // Keep one glass coat on each floating surface and clear only neutral layout fills.
  const floatingSelector='[data-slate-sidebar-peeking="true"] [data-slate-sidebar-content],[role="menu"],[role="listbox"],[role="tooltip"],[role="dialog"],[role="alertdialog"],.codex-dialog,[class*="_Popover_"],[class*="_Tooltip_"],[class*="_fileHoverCard_"],[popover]';
  const floatingSurfaces=new Set();
  const mountFloatingGlass=()=>{
    const surfaces=new Set([...document.querySelectorAll(floatingSelector)].filter(el=>!el.parentElement?.closest(floatingSelector)));
    for(const previous of floatingSurfaces){
      if(surfaces.has(previous))continue;
      previous.removeAttribute('data-lg-floating-surface');
      for(const layer of previous.querySelectorAll('[data-lg-floating-layer]'))layer.removeAttribute('data-lg-floating-layer');
      floatingSurfaces.delete(previous);
    }
    for(const surface of surfaces){
      surface.setAttribute('data-lg-floating-surface',surface.matches('[data-slate-sidebar-content]')?'sidebar':'popup');
      floatingSurfaces.add(surface);
      for(const layer of surface.querySelectorAll('div,section,main,aside,nav,header,footer')){
        if(layer.hasAttribute('data-lg-floating-layer')||layer.closest('button,input,textarea,select,[contenteditable="true"],[role="button"],[role="menuitem"],[role="option"],[role="switch"],[role="tab"]'))continue;
        const fill=getComputedStyle(layer).backgroundColor;
        if(!/^(rgba?\(|color\(srgb )/.test(fill))continue;
        const values=fill.match(/[\d.]+/g)?.map(Number);
        if(fill.startsWith('color(srgb '))values.splice(0,3,...values.slice(0,3).map(value=>value*255));
        if(values&&values.length>=3&&(values.length===3||values[3]>.9)&&Math.max(...values.slice(0,3))-Math.min(...values.slice(0,3))<28)layer.setAttribute('data-lg-floating-layer','');
      }
    }
  };
  // Paint one material behind the native project rail and editor without moving React nodes.
  const homeComposers=new Map();
  let homeFrame;
  const syncHomeGlass=()=>{
    homeFrame=undefined;
    for(const [host,entry] of homeComposers){
      if(!host.isConnected){entry.resize.disconnect();homeComposers.delete(host);continue;}
      const {rail,body}=entry;
      const railRect=rail.getBoundingClientRect(),bodyRect=body.getBoundingClientRect();
      const joined=railRect.height>0&&bodyRect.height>0&&!host.querySelector('[data-expanded-composer]');
      host.toggleAttribute('data-lg-home-glass',joined);
      if(!joined)continue;
      const hostRect=host.getBoundingClientRect();
      host.style.setProperty('--lg-home-glass-top',(railRect.top-hostRect.top)+'px');
      host.style.setProperty('--lg-home-glass-height',(bodyRect.bottom-railRect.top)+'px');
    }
  };
  const queueHomeGlass=()=>{if(homeFrame===undefined)homeFrame=requestAnimationFrame(syncHomeGlass);};
  const mountHomeGlass=()=>{
    for(const host of document.querySelectorAll('[data-codex-composer-root][data-composer-placement="home"]')){
      const rail=host.querySelector(':scope > [data-composer-rail][data-composer-rail-placement="above"]');
      const body=host.querySelector('[data-composer-body]');
      const previous=homeComposers.get(host);
      if(previous?.rail===rail&&previous?.body===body)continue;
      previous?.resize.disconnect();homeComposers.delete(host);host.removeAttribute('data-lg-home-glass');
      if(!rail?.querySelector('[data-composer-utility-rail]')||!body)continue;
      const resize=new ResizeObserver(()=>{
        if(homeFrame!==undefined)cancelAnimationFrame(homeFrame);
        syncHomeGlass();
      });
      homeComposers.set(host,{rail,body,resize});
      for(const element of [host,rail,body])resize.observe(element);
    }
    queueHomeGlass();
  };
  // Refract only the backdrop; the native editor and popup text stay unfiltered.
  const svgNS='http://www.w3.org/2000/svg',refractionSurfaces=new Map();
  const opticalLayer=document.createElement('div');opticalLayer.id='lg-optical-layer';opticalLayer.setAttribute('aria-hidden','true');opticalLayer.inert=true;document.body.append(opticalLayer);
  const opticalSVG=document.createElementNS(svgNS,'svg'),opticalDefs=document.createElementNS(svgNS,'defs');
  opticalSVG.id='lg-refraction-definitions';opticalSVG.setAttribute('aria-hidden','true');opticalSVG.setAttribute('width','0');opticalSVG.setAttribute('height','0');opticalSVG.append(opticalDefs);document.body.append(opticalSVG);
  let opticalSequence=0,opticalFrame;
  const svgNode=(name,attributes)=>{
    const node=document.createElementNS(svgNS,name);
    for(const [key,value] of Object.entries(attributes))node.setAttribute(key,String(value));
    return node;
  };
  const makeRimMask=(width,height,radius,bevel)=>{
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation=".62"/></filter></defs><rect x=".4" y=".4" width="${width-.8}" height="${height-.8}" rx="${Math.max(0,radius-.4)}" fill="none" stroke="white" stroke-width="${bevel*1.25}" filter="url(#soft)"/></svg>`;
    return 'url("data:image/svg+xml,'+encodeURIComponent(svg)+'") center / 100% 100% no-repeat';
  };
  const makeRefractionMap=(width,height,radius,bevel)=>{
    const canvas=document.createElement('canvas');canvas.width=Math.min(128,Math.ceil(width));canvas.height=Math.min(128,Math.ceil(height));
    const context=canvas.getContext('2d'),pixels=context.createImageData(canvas.width,canvas.height);
    for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
      const px=(x+.5)*width/canvas.width-width/2,py=(y+.5)*height/canvas.height-height/2;
      const qx=Math.abs(px)-(width/2-radius),qy=Math.abs(py)-(height/2-radius);
      const ox=Math.max(qx,0),oy=Math.max(qy,0),length=Math.hypot(ox,oy);
      const distance=-(length+Math.min(Math.max(qx,qy),0)-radius);
      let nx=0,ny=0;
      if(length>0){nx=Math.sign(px)*ox/length;ny=Math.sign(py)*oy/length;}
      else if(qx>qy)nx=Math.sign(px);else ny=Math.sign(py);
      const t=Math.max(0,Math.min(1,1-distance/bevel));
      const bend=distance>=0?Math.sin(t*Math.PI/2)*t*.96:0;
      const i=(y*canvas.width+x)*4;
      pixels.data[i]=Math.round(127.5-nx*127.5*bend);pixels.data[i+1]=Math.round(127.5-ny*127.5*bend);pixels.data[i+2]=128;pixels.data[i+3]=255;
    }
    context.putImageData(pixels,0,0);return canvas.toDataURL('image/png');
  };
  const queueRefraction=()=>{if(opticalFrame===undefined)opticalFrame=requestAnimationFrame(syncRefraction);};
  const opticalResize=new ResizeObserver(queueRefraction);
  // Optical frames are siblings of the app, never ancestors of native controls.
  // A backdrop-filter on an ancestor changes the coordinate space of fixed popups.
  const normalMapCache=new Map();
  const cachedMap=(w,h,r,b)=>{
    const key=[Math.round(w),Math.round(h),r,b].join(':');
    if(normalMapCache.has(key))return normalMapCache.get(key);
    const map=makeRefractionMap(w,h,r,b);normalMapCache.set(key,map);
    if(normalMapCache.size>24)normalMapCache.delete(normalMapCache.keys().next().value);
    return map;
  };
  const clearOptics=()=>{
    for(const [host,entry] of refractionSurfaces){opticalResize.unobserve(host);entry.rim.remove();entry.filter?.remove();host.removeAttribute('data-lg-refraction');}
    refractionSurfaces.clear();
  };
  const syncRefraction=()=>{
    opticalFrame=undefined;
    if(!state.enabled||document.hidden){clearOptics();return;}
    const candidates=[document.body,...document.querySelectorAll('[data-lg-layout-surface],[data-lg-floating-surface],[data-lg-home-glass],#lg-settings,.lg-composer-preview,[data-composer-body]')];
    const visible=[];
    for(const host of candidates){
      // Joined structural panes share the window rim. Floating controls keep their own optics.
      const structuralKind=host.getAttribute('data-lg-layout-surface');
      if(!host.hasAttribute('data-lg-floating-surface')&&(['workspace','sidebar','rail','topbar'].includes(structuralKind)||host.matches('[data-app-shell-right-panel]')))continue;
      if(host.matches('[data-composer-body]')&&host.closest('[data-lg-home-glass]'))continue;
      const box=host===document.body?{x:0,y:0,width:innerWidth,height:innerHeight}:host.getBoundingClientRect(),style=getComputedStyle(host);
      if(box.width<8||box.height<8||box.x>=innerWidth||box.y>=innerHeight||box.x+box.width<=0||box.y+box.height<=0||style.visibility==='hidden'||style.display==='none')continue;
      visible.push({host,box,style});
    }
    // Bound large layer allocation on long settings and chat pages.
    const surfaces=new Set(visible.slice(0,18).map(item=>item.host));
    for(const [host,entry] of refractionSurfaces){
      if(surfaces.has(host)&&host.isConnected)continue;
      opticalResize.unobserve(host);entry.rim.remove();entry.filter?.remove();host.removeAttribute('data-lg-refraction');refractionSurfaces.delete(host);
    }
    let lenses=0;
    for(const {host,box,style} of visible.slice(0,18)){
      const windowEdge=host===document.body,home=host.hasAttribute('data-lg-home-glass'),kind=host.getAttribute('data-lg-layout-surface');
      const width=box.width,height=home?parseFloat(style.getPropertyValue('--lg-home-glass-height')):box.height;
      if(!Number.isFinite(height)||height<8)continue;
      const radius=Math.min(width/2,height/2,windowEdge?12:home?parseFloat(style.getPropertyValue('--lg-home-radius'))||36:parseFloat(style.borderTopLeftRadius)||20);
      const bevel=Math.max(1.2,Math.min(2.8,radius*.07))*(state.edgeWidth??100)/100;
      const lens=!windowEdge&&!kind&&lenses++<3;
      const key=[Math.round(width),Math.round(height),radius,bevel,lens].join(':');
      let entry=refractionSurfaces.get(host);
      if(!entry){
        const rim=document.createElement('span');rim.className='lg-refractive-edge';rim.setAttribute('aria-hidden','true');
        opticalLayer.append(rim);entry={rim};refractionSurfaces.set(host,entry);opticalResize.observe(host);
        host.setAttribute('data-lg-refraction',windowEdge?'window':home?'home':kind||'surface');
      }
      const placement=[box.x,box.y+(home?parseFloat(style.getPropertyValue('--lg-home-glass-top'))||0:0),width,height].map(n=>Math.round(n*100)/100);
      const placeKey=placement.join(':');
      if(entry.placeKey!==placeKey){entry.placeKey=placeKey;Object.assign(entry.rim.style,{left:placement[0]+'px',top:placement[1]+'px',width:placement[2]+'px',height:placement[3]+'px'});}
      if(entry.key===key)continue;
      entry.key=key;entry.filter?.remove();entry.filter=null;
      Object.assign(entry.rim.style,{borderRadius:radius+'px',mask:makeRimMask(width,height,radius,bevel),webkitMask:makeRimMask(width,height,radius,bevel)});
      entry.rim.style.setProperty('--lg-refraction-bevel',bevel+'px');
      entry.rim.classList.toggle('lg-edge-window',windowEdge);entry.rim.classList.toggle('lg-edge-animated',home||host.hasAttribute('data-lg-floating-surface'));
      entry.rim.style.removeProperty('--lg-refraction-filter');
      if(!lens)continue;
      const filter=svgNode('filter',{id:'lg-edge-optics-'+(++opticalSequence),x:0,y:0,width:Math.ceil(width),height:Math.ceil(height),filterUnits:'userSpaceOnUse',primitiveUnits:'userSpaceOnUse','color-interpolation-filters':'sRGB'});
      filter.append(svgNode('feImage',{href:cachedMap(width,height,radius,Math.max(4,Math.min(9,radius*.22))),x:0,y:0,width:Math.ceil(width),height:Math.ceil(height),preserveAspectRatio:'none',result:'edge-normal'}));
      const neutral=svgNode('feComponentTransfer',{in:'edge-normal',result:'centered-normal'});neutral.append(svgNode('feFuncR',{type:'linear',slope:255/256}),svgNode('feFuncG',{type:'linear',slope:255/256}));filter.append(neutral);
      filter.append(svgNode('feDisplacementMap',{in:'SourceGraphic',in2:'centered-normal',scale:8,xChannelSelector:'R',yChannelSelector:'G'}));
      opticalDefs.append(filter);entry.filter=filter;entry.rim.style.setProperty('--lg-refraction-filter','url("#'+filter.id+'")');
    }
  };
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  const syncLiquidMotion=()=>root.classList.toggle('lg-flowing',state.enabled&&state.edgeFlow!==false&&!document.hidden&&!reducedMotion.matches);
  document.addEventListener('visibilitychange',syncLiquidMotion);
  reducedMotion.addEventListener('change',syncLiquidMotion);
  const apply=()=>{
    const enabling=state.enabled&&!root.classList.contains('lg-enabled');
    root.classList.toggle('lg-enabled',state.enabled);
    if(enabling){dirtyScopes.add(document.body);scheduleMount();}
    root.dataset.lgScene=state.scene??'desktop';
    syncLiquidMotion();
    queueRefraction();
    root.style.setProperty('--lg-tint',String(state.opacity/100));
    root.style.setProperty('--lg-light',String(state.highlights/100));
    root.style.setProperty('--lg-workspace-alpha',String(1-(state.workspaceTransparency??94)/100));
    root.style.setProperty('--lg-composer-alpha',String(1-(state.composerTransparency??90)/100));
    root.style.setProperty('--lg-sidebar-alpha',String(1-(state.sidebarTransparency??state.workspaceTransparency??94)/100));
    root.style.setProperty('--lg-popup-adjust',String((75-(state.popupTransparency??75))/100));
    root.style.setProperty('--lg-edge-strength',String((state.edgeIntensity??100)/100));
    root.style.setProperty('--lg-soft-sheen-duration',(800/(state.flowSpeed??100))+'s');
    root.style.setProperty('--lg-blur',(state.blur??3)+'px');
    for(const [key,value] of Object.entries(state)) {
      const element=document.getElementById('lg-'+key);
      if(!element) continue;
      if(element.type==='checkbox') element.checked=value;
      else element.value=value;
      const output=document.getElementById('lg-'+key+'-value');
      if(output)output.textContent=value+(key==='blur'?'px':'%');
    }
  };
  const save=()=>{
    const snapshot={...state};
    pending=pending.then(()=>window.glassEffect.set(snapshot)).then(saved=>{
      const status=document.getElementById('lg-status');if(status)status.textContent='Saved · Applied immediately';
    }).catch(async error=>{
      const status=document.getElementById('lg-status');if(status)status.textContent='Save failed: '+error.message;
      try{state=await window.glassEffect.get();apply();}catch{}
    });
  };
  const update=(key,value)=>{
    state={...state,[key]:value};apply();
    clearTimeout(saveTimer);saveTimer=setTimeout(save,key==='enabled'?0:160);
  };
  const mount=()=>{
    if(document.getElementById('lg-settings'))return;
    const headings=[...document.querySelectorAll('h1,h2,h3,[role="heading"]')];
    const title=headings.find(e=>/^(外观|Appearance)$/.test(e.textContent.trim()));
    if(!title)return;
    const section=document.createElement('section');section.id='lg-settings';section.setAttribute('aria-label','Glass Effect settings');
    section.innerHTML=`<div class="lg-card-title"><span class="lg-glint">◈</span><div><h3>Glass Effect</h3><p>Clear desktop · Thin edges · Gentle light</p></div></div>
      <label class="lg-setting"><span><strong>Enable Glass Effect</strong><small>A shared glass material for the sidebar, workspace, and floating panels</small></span><input id="lg-enabled" type="checkbox" role="switch" aria-label="Enable Glass Effect"></label>
      <label class="lg-setting"><span><strong>Glass background</strong><small>See the desktop and other windows behind the app</small></span><select id="lg-scene" aria-label="Glass background"><option value="desktop">Clear desktop</option><option value="alpine">Alpine lake</option></select></label>
      <label class="lg-setting"><span><strong>Animated edges</strong><small>Soft light moves gently along the glass edges</small></span><input id="lg-edgeFlow" class="lg-flow-toggle" type="checkbox" role="switch" aria-label="Animated edges"></label>
      <label class="lg-setting"><span><strong>Glass tint</strong><small>Lower values make the neutral tint more transparent</small></span><span class="lg-slider"><input id="lg-opacity" type="range" min="0" max="85" step="1" aria-label="Glass tint"><output id="lg-opacity-value"></output></span></label>
      <label class="lg-setting"><span><strong>Edge highlights</strong><small>Adjust the soft highlights along glass boundaries</small></span><span class="lg-slider"><input id="lg-highlights" type="range" min="0" max="100" step="1" aria-label="Edge highlights"><output id="lg-highlights-value"></output></span></label>
      <label class="lg-setting"><span><strong>Body transparency</strong><small>Adjust the title bar, docked sidebar, and workspace together</small></span><span class="lg-slider"><input id="lg-workspaceTransparency" type="range" min="0" max="95" step="1" aria-label="Body transparency"><output id="lg-workspaceTransparency-value"></output></span></label>
      <label class="lg-setting"><span><strong>Floating sidebar transparency</strong><small>Applies to the peeking sidebar; the docked sidebar follows the body</small></span><span class="lg-slider"><input id="lg-sidebarTransparency" type="range" min="0" max="95" step="1" aria-label="Floating sidebar transparency"><output id="lg-sidebarTransparency-value"></output></span></label>
      <label class="lg-setting"><span><strong>Popup transparency</strong><small>Adjust the fill behind menus, tooltips, and dialogs</small></span><span class="lg-slider"><input id="lg-popupTransparency" type="range" min="0" max="100" step="1" aria-label="Popup transparency"><output id="lg-popupTransparency-value"></output></span></label>
      <label class="lg-setting"><span><strong>Composer transparency</strong><small>Higher values reveal more background while keeping text and buttons clear</small></span><span class="lg-slider"><input id="lg-composerTransparency" type="range" min="0" max="95" step="1" aria-label="Composer transparency"><output id="lg-composerTransparency-value"></output></span></label>
      <div class="lg-composer-demo"><div class="lg-composer-preview" aria-hidden="true"><span>Glass composer preview</span><span class="lg-demo-send">↑</span></div></div>
      <label class="lg-setting"><span><strong>Edge blur</strong><small>Soften the glass edges; the desktop behind the window stays unchanged</small></span><span class="lg-slider"><input id="lg-blur" type="range" min="0" max="16" step="1" aria-label="Edge blur"><output id="lg-blur-value"></output></span></label>
      <label class="lg-setting"><span><strong>Edge width</strong><small>Adjust the thickness of the glass edges</small></span><span class="lg-slider"><input id="lg-edgeWidth" type="range" min="50" max="200" step="5" aria-label="Edge width"><output id="lg-edgeWidth-value"></output></span></label>
      <label class="lg-setting"><span><strong>Edge intensity</strong><small>Adjust the visibility of edge optics and light bands</small></span><span class="lg-slider"><input id="lg-edgeIntensity" type="range" min="0" max="100" step="1" aria-label="Edge intensity"><output id="lg-edgeIntensity-value"></output></span></label>
      <label class="lg-setting"><span><strong>Animation speed</strong><small>100% is the default speed; applies when animated edges are enabled</small></span><span class="lg-slider"><input id="lg-flowSpeed" type="range" min="25" max="200" step="5" aria-label="Animation speed"><output id="lg-flowSpeed-value"></output></span></label>
      <div class="lg-card-footer"><span id="lg-status">Settings are saved locally</span><button id="lg-reset" type="button">Restore defaults</button></div>`;
    const host=title.closest('header')??title;
    host.insertAdjacentElement('afterend',section);
    for(const key of ['enabled','edgeFlow','opacity','highlights','workspaceTransparency','composerTransparency','blur','sidebarTransparency','popupTransparency','edgeWidth','edgeIntensity','flowSpeed']) {
      const el=section.querySelector('#lg-'+key);
      el.addEventListener('input',()=>update(key,['enabled','edgeFlow'].includes(key)?el.checked:Number(el.value)));
    }
    section.querySelector('#lg-scene').addEventListener('change',event=>update('scene',event.target.value));
    section.querySelector('#lg-reset').addEventListener('click',()=>{state={enabled:true,opacity:8,highlights:48,workspaceTransparency:94,composerTransparency:90,blur:3,scene:'desktop',edgeFlow:true,sidebarTransparency:94,popupTransparency:75,edgeWidth:100,edgeIntensity:100,flowSpeed:100};apply();save();});
    apply();
  };
  let mountFrame;const dirtyScopes=new Set();
  const isDecoration=node=>node.nodeType===1&&(node.id?.startsWith('lg-')||node.closest?.('#lg-optical-layer,#lg-refraction-definitions,#lg-settings')||node.classList?.contains('lg-refractive-edge'));
  const mountAll=(scopes=[document.body])=>{
    mount();
    if(!state.enabled)return;
    mountHomeGlass();mountSettingsGlass();mountFloatingGlass();mountLayoutGlass(scopes);mountGlassInk(scopes);queueRefraction();
  };
  const scheduleMount=()=>{
    if(mountFrame!==undefined)return;
    mountFrame=requestAnimationFrame(()=>{mountFrame=undefined;const scopes=[...dirtyScopes].filter(n=>n.isConnected);dirtyScopes.clear();mountAll(scopes);});
  };
  const observer=new MutationObserver(records=>{
    let changed=false;
    for(const record of records){
      if(isDecoration(record.target)||record.target.closest?.('input,textarea,[contenteditable="true"],pre,code'))continue;
      if(record.type==='attributes'){
        // Hover, cursor and token classes are not new glass surfaces.
        if(record.attributeName==='class'&&!record.target.matches(layoutSelector+','+floatingSelector+',[class~="group/settings"]'))continue;
        dirtyScopes.add(record.target);changed=true;
      }else{
        const nodes=[...record.addedNodes,...record.removedNodes].filter(n=>n.nodeType===1&&!isDecoration(n));
        if(!nodes.length)continue;
        for(const node of record.addedNodes)if(node.nodeType===1&&!isDecoration(node))dirtyScopes.add(node);
        changed=true;
      }
    }
    if(changed)scheduleMount();
  });
  apply();mountAll();
  observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','data-slate-sidebar-peeking','data-sidebar-collapsed','data-state','hidden','open','role']});
  window.addEventListener('resize',()=>{queueHomeGlass();queueRefraction();},{passive:true});
  document.addEventListener('scroll',queueRefraction,{capture:true,passive:true});
  let interactionTimer;
  const pauseMotion=()=>{root.classList.add('lg-interacting');clearTimeout(interactionTimer);interactionTimer=setTimeout(()=>root.classList.remove('lg-interacting'),220);};
  document.addEventListener('pointerdown',pauseMotion,{passive:true});
  document.addEventListener('beforeinput',pauseMotion,{passive:true});
  document.addEventListener('input',pauseMotion,{passive:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){dirtyScopes.add(document.body);scheduleMount();}queueRefraction();});
  if(window.glassEffect) {
    window.glassEffect.get().then(value=>{state=value;apply();}).catch(console.error);
    window.glassEffect.onChange(value=>{state=value;apply();});
  }
  if(openSettings){
    let attempts=0;
    const timer=setInterval(()=>{
      if(document.getElementById('lg-settings') || ++attempts>480){clearInterval(timer);return;}
      const appearance=[...document.querySelectorAll('button')].find(e=>['外观','Appearance'].includes(e.innerText.trim()));
      if(appearance){appearance.click();return;}
      const settings=[...document.querySelectorAll('[role="menuitem"]')].find(e=>/^(设置|Settings)(\s|$)/.test(e.innerText));
      if(settings){settings.click();return;}
      const profile=document.querySelector('button[aria-label="打开个人资料菜单"],button[aria-label="Open profile menu"]');
      if(profile && profile.getAttribute('aria-expanded')==='false')profile.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,pointerType:'mouse',isPrimary:true}));
    },250);
  }
}
