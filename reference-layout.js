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
      const wind=Number.isFinite(Number(x.windSpeed))?Math.round(Number(x.windSpeed)):'—';
      const gust=Number.isFinite(Number(x.windGust))?Math.round(Number(x.windGust)):'—';
      return `<div class="hour-item"><strong>${label}</strong><span class="rain">${rain}%</span><span class="icon">${icon}</span><span>${temperature}</span><small>${wind} / ${gust}</small></div>`;
    }).join('');
  };

  function enhanceChecklist(){
    const host=document.getElementById('boatChecklist');
    if(!host||host.querySelector('.departure-checks-detailed'))return;
    const checks=[
      ['Forecasts','Check inshore waters forecast, harbour forecast and warnings.'],
      ['Navigation','Update charts, route, hazards, tidal gates and pilotage notes.'],
      ['Notices','Review Notices to Mariners, harbour notices and restrictions.'],
      ['Tides','Confirm height, stream, clearance, launch depth and return time.'],
      ['Fuel & power','Allow reserves; check batteries, charging, lights and pumps.'],
      ['Engine & systems','Check oil, cooling, belts, steering, seacocks and alarms.'],
      ['Safety equipment','Lifejackets, kill cord, first aid, extinguisher and throwable aid.'],
      ['Communications','Test VHF, DSC, phone, charging and emergency contacts.'],
      ['Distress equipment','Check PLB/EPIRB, AIS and beacon batteries.'],
      ['Crew briefing','Cover route, weather, MOB actions and emergency equipment.'],
      ['Float plan','Leave route, crew details and overdue action time ashore.'],
      ['Deck & anchoring','Check anchor, warps, fenders, hatches and loose gear.'],
      ['Personal readiness','Clothing, sun protection, water, medication and seasickness plan.'],
      ['Go/no-go review','Compare actual conditions with vessel and crew limits.']
    ];
    const block=document.createElement('div');
    block.className='wide departure-checks-detailed';
    block.innerHTML=`<span>Recommended departure checks</span><div class="departure-check-grid">${checks.map(([title,text])=>`<article><strong>✓ ${title}</strong><p>${text}</p></article>`).join('')}</div>`;
    host.appendChild(block);
  }

  const style=document.createElement('style');
  style.textContent='.hour-item small{display:block;margin-top:5px;color:rgba(255,255,255,.72);font-size:10px}.departure-check-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:9px;margin-top:10px}.departure-check-grid article{padding:10px;border-radius:11px;background:rgba(1,24,53,.5);border:1px solid rgba(146,203,247,.16)}.departure-check-grid strong{font-size:13px!important;margin:0!important;color:#a7f0c9}.departure-check-grid p{margin:5px 0 0;font-size:12px;line-height:1.4;color:rgba(240,248,255,.75)}@media(max-width:700px){.departure-check-grid{grid-template-columns:1fr}}';
  document.head.appendChild(style);

  function initialise(){buildReferenceLayout();window.renderHourly?.()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialise,{once:true});else initialise();
  window.addEventListener('load',()=>setTimeout(initialise,250),{once:true});
  document.querySelector('[data-tab="marine"]')?.addEventListener('click',()=>setTimeout(enhanceChecklist,60));
})();