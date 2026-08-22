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

  window.loadTides=async function(loc,marine){
    const h=marine?.hourly;
    const heights=(h?.time||[]).map((t,i)=>({
      date:t,
      dt:new Date(t).getTime()/1000,
      height:Number(h?.sea_level_height_msl?.[i])
    })).filter(validPoint);
    return {
      type:'Open-Meteo marine model',
      heights,
      extremes:deriveExtremes(heights),
      datumMode:'sea level height relative to global mean sea level',
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
    toolbar.innerHTML='<strong>Open-Meteo tide curve · next 24 hours</strong><span id="tideChartStatus">Loading Open-Meteo sea-level forecast…</span>';
    card?.insertBefore(toolbar,canvas);

    const meta=document.createElement('div');
    meta.id='tideModelMeta';
    meta.className='tide-model-meta';
    meta.innerHTML='<strong>Open-Meteo Marine API</strong><span>All tide heights and high/low estimates come from the Open-Meteo sea-level model.</span><small>Heights are relative to global mean sea level, not Chart Datum.</small>';
    card?.insertBefore(meta,canvas);

    const readout=document.createElement('div');
    readout.id='tideReadout';
    readout.className='tide-fixed-readout';
    readout.textContent='Move across or tap the curve for exact time and modelled sea-level height.';
    canvas.insertAdjacentElement('afterend',readout);
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
      meta.innerHTML='<strong>Open-Meteo Marine API</strong><span>Curve, heights and high/low estimates all use sea_level_height_msl from Open-Meteo.</span><small>Values are relative to global mean sea level. Negative values can legitimately occur when modelled sea level is below that reference. This is not Chart Datum and is not for navigation.</small>';
    }

    const events=document.getElementById('tideEvents'),now=Date.now()/1000,upcoming=extremes.filter(x=>x.dt>now).slice(0,8),u=displayUnit();
    if(events){
      events.innerHTML=upcoming.length?upcoming.map(x=>`<div class="tide-event"><div><strong>${/high/i.test(x.type)?'High':'Low'} water</strong><div class="soft">${pointDate(x).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})} · ${pointDate(x).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</div></div><strong>${toDisplay(x.height).toFixed(2)} ${u}</strong></div>`).join(''):'<div class="soft">No modelled high/low events available for this point.</div>';
    }

    const status=document.getElementById('tideChartStatus');
    if(status)status.textContent=heights.length>1?`${heights.length} Open-Meteo height points · mean-sea-level reference`:'No Open-Meteo tide-height points available';

    document.querySelectorAll('#tidesPanel .navigation-warning').forEach(p=>{
      if(/WorldTides|Environment Agency|UKHO API/i.test(p.textContent))p.textContent='Open-Meteo model forecast only. Heights are relative to global mean sea level, not Chart Datum. Not for navigation.';
    });
    window.drawTideChart();
  };

  const originalDraw=window.drawTideChart;
  window.drawTideChart=function(activeIndex=null){
    if(typeof originalDraw==='function')originalDraw(activeIndex);
    const out=document.getElementById('tideReadout');
    if(out&&out.textContent.includes('above Chart Datum'))out.textContent=out.textContent.replace('above Chart Datum','relative to mean sea level');
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

  let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>state.chartPoints?.length&&window.drawTideChart(),120)});
})();
