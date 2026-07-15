(() => {
  const getState = () => (typeof state !== 'undefined' ? state : null);

  function buildReferenceLayout(){
    const dashboard=document.getElementById('dashboard');
    const hero=document.querySelector('.hero-weather');
    const hourly=document.querySelector('.hourly-card');
    if(!dashboard||!hero||!hourly||document.querySelector('.reference-overview'))return;
    const overview=document.createElement('section');
    overview.className='reference-overview';
    dashboard.insertBefore(overview,dashboard.firstChild);
    overview.append(hero,hourly);
  }

  window.renderHourly=function(){
    const appState=getState();
    const host=document.getElementById('hourlyForecast');
    if(!host||!appState?.weather?.hourly)return;
    const now=Date.now();
    const hourly=appState.weather.hourly
      .filter(x=>Number.isFinite(new Date(x.time).getTime())&&new Date(x.time).getTime()>=now-30*60*1000)
      .slice(0,12);
    host.innerHTML=hourly.map((x,i)=>{
      const d=new Date(x.time);
      const label=i===0?'Now':d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
      const rain=Math.round((Number(x.precipitationChance)||0)*100);
      const icon=typeof iconFor==='function'?iconFor(x):'🌤';
      const temperature=typeof temp==='function'?temp(x.temperature):`${Math.round(Number(x.temperature)||0)}°`;
      const wind=Number.isFinite(Number(x.windSpeed))?`${Math.round(Number(x.windSpeed))}`:'—';
      const gust=Number.isFinite(Number(x.windGust))?`${Math.round(Number(x.windGust))}`:'—';
      return `<div class="hour-item"><strong>${label}</strong><span class="rain">${rain}%</span><span class="icon">${icon}</span><span>${temperature}</span><small>${wind} / ${gust}</small></div>`;
    }).join('');
  };

  function enhanceChecklist(){
    const appState=getState();
    const host=document.getElementById('boatChecklist');
    if(!host||!appState)return;
    const existing=host.querySelector('.wide');
    if(existing)existing.remove();
    const checks=[
      ['Forecasts','Check inshore waters forecast, local harbour forecast and weather warnings.'],
      ['Navigation','Update charts, route, waypoints, hazards, tidal gates and pilotage notes.'],
      ['Notices','Review Notices to Mariners, harbour notices, restrictions and local events.'],
      ['Tides','Confirm height, stream direction, clearance, launch/recovery depth and safe return time.'],
      ['Fuel & power','Allow reserve fuel; check batteries, charging, navigation lights and bilge pumps.'],
      ['Engine & systems','Check oil, cooling, belts, steering, controls, seacocks, leaks and alarms.'],
      ['Safety equipment','Lifejackets fitted, kill cord, flares where carried, extinguisher, first aid and throwable aid.'],
      ['Communications','Test VHF, DSC/MMSI, mobile phone, charging, emergency contacts and local channels.'],
      ['Distress equipment','Check PLB/EPIRB registration, AIS, radar reflector and emergency beacon batteries.'],
      ['Crew briefing','Explain route, weather, lifejackets, man-overboard actions, radio and emergency equipment.'],
      ['Float plan','Tell someone ashore the route, crew, boat details and overdue action time.'],
      ['Deck & anchoring','Secure hatches and loose gear; check anchor, chain, warp, fenders, warps and tender.'],
      ['Personal readiness','Warm/waterproof clothing, sun protection, food, water, medication and seasickness plan.'],
      ['Go/no-go review','Compare actual harbour conditions with forecast and vessel/crew limits before casting off.']
    ];
    const block=document.createElement('div');
    block.className='wide departure-checks-detailed';
    block.innerHTML=`<span>Recommended departure checks</span><div class="departure-check-grid">${checks.map(([title,text])=>`<article><strong>✓ ${title}</strong><p>${text}</p></article>`).join('')}</div>`;
    host.appendChild(block);
  }

  const style=document.createElement('style');
  style.textContent='.hour-item small{display:block;margin-top:5px;color:rgba(255,255,255,.72);font-size:10px}.departure-check-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:9px;margin-top:10px}.departure-check-grid article{padding:10px;border-radius:11px;background:rgba(1,24,53,.5);border:1px solid rgba(146,203,247,.16)}.departure-check-grid strong{font-size:13px!important;margin:0!important;color:#a7f0c9}.departure-check-grid p{margin:5px 0 0;font-size:12px;line-height:1.4;color:rgba(240,248,255,.75)}@media(max-width:700px){.departure-check-grid{grid-template-columns:1fr}}';
  document.head.appendChild(style);

  function refresh(){buildReferenceLayout();window.renderHourly?.();enhanceChecklist()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refresh);else refresh();
  const dashboard=document.getElementById('dashboard');
  if(dashboard)new MutationObserver(()=>setTimeout(refresh,40)).observe(dashboard,{childList:true,subtree:true,attributes:true});
  window.addEventListener('load',()=>{setTimeout(refresh,500);setTimeout(refresh,1600)});
})();