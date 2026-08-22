(()=>{
  const qs=o=>new URLSearchParams(Object.entries(o).filter(([,v])=>v!==undefined&&v!==null&&v!=='')).toString();
  const cleanupScripts=()=>document.querySelectorAll('script[data-tides-today]').forEach(s=>s.remove());
  const loadScript=src=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.async=false;s.dataset.tidesToday='true';s.onload=resolve;s.onerror=()=>reject(new Error(`Unable to load ${src}`));document.body.appendChild(s)});

  window.loadTides=async function(loc){
    const params={name:loc.name,admin1:loc.admin1,admin2:loc.admin2,country:loc.country,country_code:loc.country_code,lat:loc.latitude,lon:loc.longitude};
    try{
      const r=await fetch(`/api/tides-today-resolver?${qs(params)}`);
      const data=await r.json();
      if(!r.ok)throw new Error(data.error||'Tides Today station unavailable.');
      return {type:'Tides Today',...data};
    }catch(error){
      return {type:'Tides Today',error:error.message||'Tides Today station unavailable.',searchUrl:'https://tides.today/en'};
    }
  };

  function ensureCard(){
    const panel=document.getElementById('tidesPanel');if(!panel)return null;
    panel.querySelector('.two-col')?.setAttribute('hidden','');
    [...panel.querySelectorAll('.card')].forEach(card=>{if(/OFFICIAL UKHO TIDES/i.test(card.textContent||''))card.setAttribute('hidden','')});
    let card=document.getElementById('tidesTodayCard');
    if(!card){
      card=document.createElement('article');card.id='tidesTodayCard';card.className='glass card tides-today-card';
      card.innerHTML=`<div class="card-head"><span>TIDE TIMES & HEIGHTS</span><small id="tidesTodaySource">Tides Today</small></div>
        <div id="tidesTodayStation" class="tides-today-station"></div>
        <div id="tidesTodayWidgetHost" class="tides-today-host"><div class="soft">Loading tide chart…</div></div>
        <div class="tides-today-actions"><a id="tidesTodayOpen" class="primary-btn" target="_blank" rel="noopener">Open on Tides Today</a><a class="pill-btn" href="https://easytide.admiralty.co.uk" target="_blank" rel="noopener">UKHO EasyTide check</a></div>
        <p class="navigation-warning">Tide information is supplied by the embedded Tides Today service. For UK locations, source licensing/attribution is shown by Tides Today. Planning aid only; verify navigational information independently.</p>`;
      panel.prepend(card);
    }
    return card;
  }

  async function mountWidget(tide){
    const host=document.getElementById('tidesTodayWidgetHost');if(!host)return;
    cleanupScripts();host.innerHTML='';
    if(tide.error||!tide.path||!tide.id){
      host.innerHTML=`<div class="tides-today-error"><strong>Tide station unavailable</strong><span>${tide.error||'No Tides Today station could be resolved for this location.'}</span><a class="primary-btn" href="${tide.searchUrl||'https://tides.today/en'}" target="_blank" rel="noopener">Search Tides Today</a></div>`;
      return;
    }
    const target=document.createElement('div');target.id=`tidewidget__${tide.id}`;host.appendChild(target);
    const heightUnit=state.units==='metric'?'m':'ft';
    const base=`https://api.tidestoday.io/widgets-api/js-v1/en/${tide.path}`;
    const init=`${base}/widget-init.js?${qs({includeMap:'false',includeWeather:'false',includeStyles:'true',includeTitle:'true',numberDays:'3',weatherUnit:'c',heightUnit})}`;
    try{
      await loadScript(`${base}/widget.js`);
      await loadScript(init);
    }catch(error){
      host.innerHTML=`<div class="tides-today-error"><strong>Unable to load tide widget</strong><span>${error.message}</span><a class="primary-btn" href="${tide.pageUrl}" target="_blank" rel="noopener">Open Tides Today</a></div>`;
    }
  }

  window.renderTides=function(){
    const tide=state.tide||{type:'Tides Today',error:'Tide station unavailable.'};ensureCard();
    const station=document.getElementById('tidesTodayStation'),source=document.getElementById('tidesTodaySource'),open=document.getElementById('tidesTodayOpen'),footer=document.getElementById('footerTideCredit');
    const place=tide.name||state.location?.name||'Selected location';
    if(station)station.innerHTML=`<div><strong>${place}</strong><span>${tide.match==='nearest'&&Number.isFinite(Number(tide.distanceKm))?`Nearest supported station · ${Number(tide.distanceKm).toFixed(1)} km away`:'Matched Tides Today station'}</span></div><small>Chart Datum heights where provided by the source</small>`;
    if(source)source.textContent='Tides Today';
    if(open){open.href=tide.pageUrl||tide.searchUrl||'https://tides.today/en';open.textContent=`Open ${place} on Tides Today`;}
    if(footer)footer.textContent='Tides: Tides Today · Marine forecast: Open-Meteo';
    const oldSource=document.getElementById('tideSource');if(oldSource)oldSource.textContent='Tides Today';
    mountWidget(tide);
  };

  const style=document.createElement('style');style.textContent=`
    .tides-today-card{overflow:visible}.tides-today-station{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin:2px 0 14px;padding:13px 14px;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:rgba(255,255,255,.05)}
    .tides-today-station>div{display:grid;gap:3px}.tides-today-station span,.tides-today-station small{opacity:.72;font-size:12px}.tides-today-host{min-height:300px;background:#fff;border-radius:16px;overflow:hidden;color:#0d2238;padding:8px}.tides-today-host>*{max-width:100%}.tides-today-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}.tides-today-error{min-height:220px;display:grid;place-content:center;justify-items:center;gap:12px;text-align:center;padding:24px;color:#16324c}.tides-today-error span{max-width:520px;color:#597080}
    @media(max-width:620px){.tides-today-station{flex-direction:column}.tides-today-host{padding:4px;border-radius:12px}.tides-today-actions>*{width:100%;text-align:center}}
  `;document.head.appendChild(style);
})();
