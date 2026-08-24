(()=>{
  const fmtHeight=v=>state.units==='metric'?`${Number(v).toFixed(2)} m`:`${(Number(v)*3.28084).toFixed(2)} ft`;
  const eventLabel=t=>/high/i.test(t||'')?'High water':/low/i.test(t||'')?'Low water':String(t||'Tidal event');
  const eventDate=e=>new Date(`${e.dateTime}${/[zZ]|[+-]\d\d:?\d\d$/.test(e.dateTime)?'':'Z'}`);

  window.loadTides=async function(loc){
    const q=new URLSearchParams({lat:String(loc.latitude),lon:String(loc.longitude),duration:'7'});
    try{
      const r=await fetch(`/api/ukho-tides?${q}`);
      const data=await r.json();
      if(!r.ok)throw Object.assign(new Error(data.error||'ADMIRALTY tidal data unavailable.'),{data});
      return {type:'ADMIRALTY UK Tidal API',...data};
    }catch(error){
      const d=error.data||{};
      return {type:'ADMIRALTY UK Tidal API',configured:d.configured!==false,error:error.message,easyTideUrl:d.easyTideUrl||'https://easytide.admiralty.co.uk/',station:d.station};
    }
  };

  function ensureUkhoCard(){
    const panel=document.getElementById('tidesPanel');if(!panel)return null;
    panel.querySelector('.two-col')?.setAttribute('hidden','');
    [...panel.querySelectorAll('.card')].forEach(card=>{if(card.id!=='ukhoTideCard'&&/OFFICIAL UKHO TIDES/i.test(card.textContent||''))card.setAttribute('hidden','')});
    document.getElementById('tidesTodayCard')?.remove();
    let card=document.getElementById('ukhoTideCard');
    if(!card){
      card=document.createElement('article');card.id='ukhoTideCard';card.className='glass card ukho-tide-card';
      card.innerHTML=`<div class="card-head"><span>ADMIRALTY TIDE TIMES</span><small id="ukhoTideSource">UKHO</small></div>
        <div id="ukhoStation" class="ukho-station"></div>
        <div id="ukhoEvents" class="tide-events ukho-events"></div>
        <div id="ukhoStatus" class="ukho-status"></div>
        <div class="ukho-actions"><a id="ukhoEasyTide" class="primary-btn" target="_blank" rel="noopener">Open official EasyTide curve</a></div>
        <div class="ukho-attribution">Contains ADMIRALTY® tidal data:<br>© Crown Copyright and database right.</div>
        <p class="navigation-warning">Official UKHO tidal predictions. Heights are above Chart Datum and API times are GMT. EasyTide must not be used by vessels for navigation.</p>`;
      panel.prepend(card);
    }
    return card;
  }

  window.renderTides=function(){
    const tide=state.tide||{configured:false,easyTideUrl:'https://easytide.admiralty.co.uk/'};
    ensureUkhoCard();
    const station=document.getElementById('ukhoStation'),eventsBox=document.getElementById('ukhoEvents'),status=document.getElementById('ukhoStatus'),link=document.getElementById('ukhoEasyTide'),source=document.getElementById('ukhoTideSource'),footer=document.getElementById('footerTideCredit');
    if(source)source.textContent='ADMIRALTY / UKHO';
    if(footer)footer.textContent='Tides: ADMIRALTY UK Tidal API · UKHO EasyTide';
    const oldSource=document.getElementById('tideSource');if(oldSource)oldSource.textContent='UKHO';
    if(link)link.href=tide.easyTideUrl||'https://easytide.admiralty.co.uk/';

    if(tide.station){
      station.innerHTML=`<div><strong>${tide.station.name}</strong><span>Nearest UKHO tidal station · ${Number(tide.station.distanceKm||0).toFixed(1)} km away</span></div><small>Station ${tide.station.id} · Chart Datum</small>`;
    }else{
      station.innerHTML='<div><strong>ADMIRALTY EasyTide</strong><span>Official UKHO tidal source</span></div><small>Chart Datum</small>';
    }

    if(tide.configured===false){
      eventsBox.innerHTML='';
      status.innerHTML='<div class="ukho-connect"><strong>UKHO API connection required</strong><span>The app is now UKHO-only for tides. Add an ADMIRALTY UK Tidal API subscription key in Vercel to display high/low times and heights directly in the app.</span></div>';
      if(link)link.textContent='Open EasyTide for tide times & curve';
      return;
    }

    if(tide.error){
      eventsBox.innerHTML='';
      status.innerHTML=`<div class="ukho-connect"><strong>UKHO data temporarily unavailable</strong><span>${tide.error}</span></div>`;
      if(link)link.textContent='Open EasyTide';
      return;
    }

    status.innerHTML='';
    const now=Date.now(),events=(tide.events||[]).map(e=>({...e,_date:eventDate(e)})).filter(e=>Number.isFinite(e._date.getTime())&&e._date.getTime()>now).slice(0,12);
    eventsBox.innerHTML=events.length?events.map(e=>`<div class="tide-event"><div><strong>${eventLabel(e.eventType)}</strong><div class="soft">${e._date.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',timeZone:'UTC'})} · ${e._date.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'UTC'})} GMT</div></div><strong>${fmtHeight(e.height)}</strong></div>`).join(''):'<div class="soft">No upcoming UKHO tidal events returned.</div>';
    if(link)link.textContent=`Open ${tide.station?.name||'station'} in EasyTide`;
  };

  const style=document.createElement('style');style.textContent=`
    .ukho-tide-card{overflow:visible}.ukho-station{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin:2px 0 14px;padding:13px 14px;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:rgba(255,255,255,.05)}
    .ukho-station>div{display:grid;gap:3px}.ukho-station span,.ukho-station small{opacity:.72;font-size:12px}.ukho-events{display:grid;gap:8px}.ukho-status{margin-top:12px}.ukho-connect{display:grid;gap:6px;padding:16px;border-radius:14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12)}.ukho-connect span{opacity:.78;line-height:1.5}.ukho-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}.ukho-attribution{margin-top:16px;font-family:Arial,sans-serif;font-size:12px;line-height:1.35}
    @media(max-width:620px){.ukho-station{flex-direction:column}.ukho-actions>*{width:100%;text-align:center}}
  `;document.head.appendChild(style);
})();
