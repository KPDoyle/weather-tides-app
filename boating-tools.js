(() => {
  const getState=()=>typeof state!=='undefined'?state:null;
  let lastTrafficKey='';
  const style=document.createElement('style');
  style.textContent='.segment{grid-template-columns:repeat(4,1fr)}.traffic-map{position:relative;min-height:520px;border-radius:18px;overflow:hidden;background:rgba(0,0,0,.12)}.traffic-map iframe{display:block;width:100%;height:520px;border:0;background:#0b2035}.traffic-loading{display:grid;place-items:center;min-height:520px;padding:24px;text-align:center;opacity:.75}.traffic-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}.traffic-actions a{text-decoration:none}.boat-plan-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px}.boat-plan-summary>div,.boat-checklist>div{padding:13px;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:rgba(255,255,255,.05)}.boat-plan-summary span,.boat-checklist span{display:block;font-size:11px;letter-spacing:.055em;text-transform:uppercase;opacity:.68}.boat-plan-summary strong,.boat-checklist strong{display:block;margin-top:5px;font-size:15px}.boat-checklist{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.boat-checklist .wide{grid-column:1/-1}.condition-good strong{color:#88f2c0}.condition-watch strong{color:#ffd277}.condition-caution strong{color:#ff9b91}.selected-panel{margin:8px 0 18px}.boating-links{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding-top:14px}.boating-links a{display:block;padding:15px;border-radius:14px;background:rgba(4,36,74,.82);border:1px solid rgba(145,203,247,.24);color:white;text-decoration:none;transition:transform .15s ease,background .15s ease}.boating-links a:hover{transform:translateY(-2px);background:rgba(10,63,119,.9)}.boating-links strong,.boating-links span{display:block}.boating-links span{margin-top:5px;color:rgba(235,246,255,.7);font-size:13px;line-height:1.4}.kevin-brand{cursor:pointer;user-select:none}.kevin-brand:focus-visible{outline:2px solid #8ed8ff;outline-offset:4px;border-radius:8px}@media(max-width:720px){.segment{grid-template-columns:repeat(2,1fr)}.traffic-map,.traffic-map iframe,.traffic-loading{min-height:430px;height:430px}.boat-plan-summary,.boat-checklist,.boating-links{grid-template-columns:1fr}.boat-checklist .wide{grid-column:auto}}';
  document.head.appendChild(style);

  function locationCoords(){const s=getState(),lat=Number(s?.location?.latitude),lon=Number(s?.location?.longitude);return Number.isFinite(lat)&&Number.isFinite(lon)?{lat,lon}:null}
  function renderTraffic(force=false){
    const host=document.getElementById('marineTrafficMap'),link=document.getElementById('openMarineTraffic'),c=locationCoords();
    if(!host||!c){if(host)host.innerHTML='<div class="traffic-loading">Choose a location or allow device location to show nearby vessels.</div>';return}
    const key=`${c.lat.toFixed(4)},${c.lon.toFixed(4)}`;
    if(!force&&key===lastTrafficKey&&host.querySelector('iframe'))return;
    lastTrafficKey=key;
    const embed=`https://www.marinetraffic.com/en/ais/embed/zoom:11/centery:${c.lat}/centerx:${c.lon}/maptype:4/shownames:true/mmsi:0/shipid:0/fleet:/fleet_id:/vtypes:/showmenu:true/remember:false`;
    host.innerHTML=`<iframe title="MarineTraffic vessels near selected location" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen src="${embed}"></iframe>`;
    if(link)link.href=`https://www.marinetraffic.com/en/ais/home/centerx:${c.lon}/centery:${c.lat}/zoom:11`;
  }

  const fmt=(v,n=0)=>Number.isFinite(Number(v))?Number(v).toFixed(n):'—';
  const speedUnit=()=>getState()?.units==='metric'?'km/h':'mph';
  const lengthUnit=()=>getState()?.units==='metric'?'m':'ft';
  function classify(v,watch,caution,inverse=false){v=Number(v);if(!Number.isFinite(v))return'watch';if(inverse)return v<caution?'caution':v<watch?'watch':'good';return v>=caution?'caution':v>=watch?'watch':'good'}
  function nextTide(){const now=Date.now()/1000;return(getState()?.tide?.extremes||[]).filter(x=>Number(x.dt)>now).sort((a,b)=>Number(a.dt)-Number(b.dt))[0]||null}
  function renderBoatPlan(){
    const s=getState(),current=s?.weather?.current||{},marine=s?.marine?.current||{},daily=s?.weather?.daily?.[0]||{};
    const summary=document.getElementById('boatPlanSummary'),checklist=document.getElementById('boatChecklist'),status=document.getElementById('boatPlanStatus');
    if(!summary||!checklist)return;
    const wind=Number(current.windSpeed),gust=Number(current.windGust),wave=Number(marine.wave_height),visibility=Number(current.visibility)/1000,rain=Number(current.precipitationIntensity),tide=nextTide();
    const ratings=[classify(wind,25,40),classify(gust,35,55),classify(wave,s?.units==='metric'?1:3.3,s?.units==='metric'?2:6.6),classify(visibility,5,2,true)];
    const overall=ratings.includes('caution')?'Caution':ratings.includes('watch')?'Watch conditions':'Generally favourable';
    const cls=overall==='Caution'?'condition-caution':overall==='Watch conditions'?'condition-watch':'condition-good';
    if(status)status.textContent=overall;
    summary.innerHTML=`<div class="${cls}"><span>Planning summary</span><strong>${overall}</strong></div><div><span>Wind / gusts</span><strong>${fmt(wind)} / ${fmt(gust)} ${speedUnit()}</strong></div><div><span>Wave height</span><strong>${fmt(wave,1)} ${lengthUnit()}</strong></div>`;
    const tideText=tide?`${/high/i.test(tide.type||'')?'High':'Low'} ${new Date(tide.date?new Date(tide.date).getTime():Number(tide.dt)*1000).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})} · ${fmt(tide.height,2)} ${lengthUnit()}`:'No event available';
    const sunset=daily.sunset?new Date(daily.sunset).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}):'—';
    checklist.innerHTML=`<div class="condition-${classify(visibility,5,2,true)}"><span>Visibility</span><strong>${fmt(visibility,1)} km</strong></div><div class="condition-${classify(rain,.5,2)}"><span>Rain now</span><strong>${fmt(rain,1)} ${s?.units==='metric'?'mm':'in'}</strong></div><div><span>Next tide</span><strong>${tideText}</strong></div><div><span>Sunset</span><strong>${sunset}</strong></div><div><span>Swell period</span><strong>${fmt(marine.swell_wave_period,1)} s</strong></div><div><span>Sea temperature</span><strong>${fmt(marine.sea_surface_temperature,1)}°</strong></div>`;
  }

  const panelIds={tides:'tidesPanel',marine:'marinePanel',traffic:'trafficPanel',links:'linksPanel'};
  function showNormalDashboard(){
    document.querySelectorAll('.tab').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-selected','false')});
    Object.values(panelIds).forEach(id=>{const panel=document.getElementById(id);if(panel)panel.hidden=true});
    document.querySelector('.reference-overview')?.scrollIntoView({behavior:'smooth',block:'start'});
  }
  window.showNormalDashboard=showNormalDashboard;
  function switchTab(name){
    document.querySelectorAll('.tab').forEach(b=>{const active=b.dataset.tab===name;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active))});
    const dashboard=document.getElementById('dashboard');
    Object.entries(panelIds).forEach(([key,id])=>{const panel=document.getElementById(id);if(panel)panel.hidden=key!==name});
    const activePanel=document.getElementById(panelIds[name]);
    if(dashboard&&activePanel&&dashboard.firstElementChild!==activePanel)dashboard.insertBefore(activePanel,dashboard.firstElementChild);
    if(name==='tides'&&typeof window.drawTideChart==='function')setTimeout(()=>window.drawTideChart(),60);
    if(name==='marine')setTimeout(renderBoatPlan,40);
    if(name==='traffic')setTimeout(()=>renderTraffic(false),40);
    activePanel?.scrollIntoView({behavior:'smooth',block:'start'});
  }
  document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();switchTab(b.dataset.tab)}));
  document.getElementById('refreshTraffic')?.addEventListener('click',()=>renderTraffic(true));
  const brand=document.querySelector('.kevin-brand');
  if(brand){brand.setAttribute('role','button');brand.setAttribute('tabindex','0');brand.setAttribute('aria-label','Return to normal dashboard');brand.addEventListener('click',showNormalDashboard);brand.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();showNormalDashboard()}})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',showNormalDashboard,{once:true});else showNormalDashboard();
  window.addEventListener('load',()=>setTimeout(renderBoatPlan,700),{once:true});
})();