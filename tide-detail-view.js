(function(){
  const displayUnit=()=>state.units==='metric'?'m':'ft';
  const toDisplay=v=>state.units==='metric'?Number(v):Number(v)*3.28084;
  const pointDate=p=>p?.date?new Date(p.date):new Date(Number(p?.dt)*1000);
  const validPoint=p=>Number.isFinite(Number(p?.height))&&Number.isFinite(pointDate(p).getTime());
  const normalise=items=>(items||[]).map(p=>({
    date:p.date||new Date(Number(p.dt)*1000).toISOString(),
    dt:Number(p.dt)||new Date(p.date).getTime()/1000,
    height:Number(p.height),
    type:p.type||p.event||''
  })).filter(validPoint).sort((a,b)=>a.dt-b.dt);

  function deriveExtremes(heights){
    const points=normalise(heights),events=[];
    for(let i=1;i<points.length-1;i++){
      const a=points[i-1].height,b=points[i].height,c=points[i+1].height;
      if(b>a&&b>c)events.push({...points[i],type:'High'});
      if(b<a&&b<c)events.push({...points[i],type:'Low'});
    }
    return events;
  }

  function next24Hours(items){
    const points=normalise(items),now=Date.now(),end=now+24*3600000;
    if(points.length<2)return points;
    let after=points.findIndex(p=>pointDate(p).getTime()>=now);
    if(after<0)return points.slice(-2);
    const before=Math.max(0,after-1),a=points[before],b=points[after];
    const selected=points.slice(after).filter(p=>pointDate(p).getTime()<=end);
    if(a&&b&&pointDate(a).getTime()<now){
      const at=pointDate(a).getTime(),bt=pointDate(b).getTime(),fraction=Math.max(0,Math.min(1,(now-at)/(bt-at||1)));
      selected.unshift({date:new Date(now).toISOString(),dt:now/1000,height:a.height+(b.height-a.height)*fraction,type:'Now'});
    }
    return selected;
  }

  window.loadTides=async function(loc){
    const params=new URLSearchParams({
      latitude:String(loc.latitude),
      longitude:String(loc.longitude),
      hourly:'sea_level_height_msl',
      timezone:'auto',
      forecast_days:'7',
      cell_selection:'sea'
    });
    const response=await fetch(`https://marine-api.open-meteo.com/v1/marine?${params}`);
    if(!response.ok)return {type:'Open-Meteo marine model',heights:[],extremes:[],error:'Open-Meteo tide data unavailable.'};
    const data=await response.json();
    const h=data?.hourly||{};
    const rawHeights=(h.time||[]).map((t,i)=>({
      date:t,
      dt:new Date(t).getTime()/1000,
      height:Number(h.sea_level_height_msl?.[i])
    })).filter(validPoint);

    // Open-Meteo sea_level_height_msl is centred on mean sea level, so values can be
    // negative. For a clearer recreational-boating display we retain Open-Meteo as the
    // sole source but translate the entire seven-day series so its lowest forecast point
    // is 0.00 m. This preserves tidal range, curve shape and high/low timing. It is a
    // relative planning scale, not Chart Datum.
    const baseline=rawHeights.length?Math.min(...rawHeights.map(p=>p.height)):0;
    const heights=rawHeights.map(p=>({...p,height:p.height-baseline}));

    return {
      type:'Open-Meteo marine model',
      heights,
      extremes:deriveExtremes(heights),
      timezone:data.timezone,
      datumMode:'relative tide height above the seven-day forecast minimum',
      rawMslBaseline:baseline,
      sourceUrl:'https://marine-api.open-meteo.com/'
    };
  };

  function ensureLayout(){
    const canvas=document.getElementById('tideChart');
    if(!canvas||canvas.dataset.openMeteoTideLayout)return canvas;
    canvas.dataset.openMeteoTideLayout='true';
    const card=canvas.closest('.card');

    const toolbar=document.createElement('div');
    toolbar.className='tide-fixed-toolbar';
    toolbar.innerHTML='<strong>Open-Meteo relative tide curve · next 24 hours</strong><span id="tideChartStatus">Loading Open-Meteo tide forecast…</span>';
    card?.insertBefore(toolbar,canvas);

    const meta=document.createElement('div');
    meta.id='tideModelMeta';
    meta.className='tide-model-meta';
    meta.innerHTML='<strong>Open-Meteo Marine API</strong><span>All tide heights and high/low estimates come from Open-Meteo.</span><small>Relative scale: lowest point in the seven-day forecast = 0.00 m.</small>';
    card?.insertBefore(meta,canvas);

    const readout=document.createElement('div');
    readout.id='tideReadout';
    readout.className='tide-fixed-readout';
    readout.textContent='Move across or tap the curve for exact time and relative Open-Meteo tide height.';
    canvas.insertAdjacentElement('afterend',readout);

    document.querySelectorAll('#tidesPanel .card').forEach(el=>{
      if(/OFFICIAL UKHO TIDES/i.test(el.textContent||''))el.remove();
    });
    return canvas;
  }

  window.renderTides=function(){
    const tide=state.tide||{type:'Open-Meteo marine model',heights:[],extremes:[]};
    ensureLayout();
    const heights=next24Hours(tide.heights),extremes=normalise(tide.extremes);
    state.chartPoints=heights;

    const source=document.getElementById('tideSource'),footer=document.getElementById('footerTideCredit');
    if(source)source.textContent='Open-Meteo';
    if(footer)footer.textContent='Tides: Open-Meteo Marine API';

    const meta=document.getElementById('tideModelMeta');
    if(meta){
      meta.innerHTML='<strong>Open-Meteo Marine API</strong><span>Curve, heights and high/low estimates all come from sea_level_height_msl.</span><small>To avoid confusing negative figures, the seven-day forecast minimum is displayed as 0.00 and every value is shifted by the same amount. Tidal range and timing are unchanged. These are relative heights, not Chart Datum, and are not for navigation.</small>';
    }

    const events=document.getElementById('tideEvents'),now=Date.now()/1000,upcoming=extremes.filter(x=>x.dt>now).slice(0,8),u=displayUnit();
    if(events){
      events.innerHTML=upcoming.length?upcoming.map(x=>`<div class="tide-event"><div><strong>${/high/i.test(x.type)?'High':'Low'} water</strong><div class="soft">${pointDate(x).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})} · ${pointDate(x).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</div></div><strong>${toDisplay(x.height).toFixed(2)} ${u}</strong></div>`).join(''):'<div class="soft">No Open-Meteo high/low turning points available for this location.</div>';
    }

    const status=document.getElementById('tideChartStatus');
    if(status)status.textContent=heights.length>1?`${heights.length} Open-Meteo height points · positive relative scale`:'No Open-Meteo tide-height points available';

    document.querySelectorAll('#tidesPanel .navigation-warning').forEach(p=>{
      p.textContent='Open-Meteo model forecast only. Heights use a positive relative scale with the seven-day forecast minimum set to 0.00. Not Chart Datum and not for navigation.';
    });
    window.drawTideChart();
  };

  const style=document.createElement('style');
  style.textContent=`
    .tide-fixed-toolbar{display:flex;justify-content:space-between;gap:14px;margin-bottom:12px;padding:11px 13px;border-radius:14px;background:rgba(255,255,255,.06)}
    .tide-fixed-toolbar span{font-size:12px;opacity:.72}
    .tide-model-meta{display:grid;gap:4px;margin-bottom:12px;padding:13px 14px;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:rgba(255,255,255,.05)}
    .tide-model-meta span,.tide-model-meta small{opacity:.76}
    .tide-fixed-readout{margin-top:10px;padding:11px 13px;border-radius:13px;background:rgba(255,255,255,.06);font-size:13px}
    @media(max-width:620px){.tide-fixed-toolbar{flex-direction:column}}
  `;
  document.head.appendChild(style);

  const source=document.getElementById('tideSource');if(source)source.textContent='Open-Meteo';
  const footer=document.getElementById('footerTideCredit');if(footer)footer.textContent='Tides: Open-Meteo Marine API';

  let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>state.chartPoints?.length&&window.drawTideChart(),120)});
})();
