(function(){
  const displayUnit=()=>state.units==='metric'?'m':'ft';
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

  async function loadLiveGauge(loc){
    try{
      const params=new URLSearchParams({lat:String(loc.latitude),lon:String(loc.longitude)});
      const response=await fetch(`/api/ea-tides?${params}`);
      if(!response.ok)throw new Error('Environment Agency tide gauge unavailable.');
      return await response.json();
    }catch(error){
      console.warn(error);
      return null;
    }
  }

  window.loadTides=async function(loc,marine){
    const h=marine?.hourly;
    const heights=(h?.time||[]).map((t,i)=>({
      date:t,
      dt:new Date(t).getTime()/1000,
      height:Number(h?.sea_level_height_msl?.[i])
    })).filter(validPoint);
    const [liveGauge]=await Promise.all([loadLiveGauge(loc)]);
    return {
      type:'Open-Meteo tide model',
      heights,
      extremes:deriveExtremes(heights),
      liveGauge,
      officialUrl:'https://easytide.admiralty.co.uk/'
    };
  };

  function ensureLayout(){
    const canvas=document.getElementById('tideChart');
    if(!canvas||canvas.dataset.freeTideLayout)return canvas;
    canvas.dataset.freeTideLayout='true';
    const card=canvas.closest('.card');

    const toolbar=document.createElement('div');
    toolbar.className='tide-fixed-toolbar';
    toolbar.innerHTML='<strong>Model tide forecast · next 24 hours</strong><span id="tideChartStatus">Loading tide forecast…</span>';
    card?.insertBefore(toolbar,canvas);

    const meta=document.createElement('div');
    meta.id='tideModelMeta';
    meta.className='tide-model-meta';
    meta.innerHTML='<strong>Open-Meteo sea-level model</strong><span>Forecast tide curve for the selected coastal location.</span><small>Modelled sea-level height; coastal accuracy is limited and this is not for navigation.</small>';
    card?.insertBefore(meta,canvas);

    const readout=document.createElement('div');
    readout.id='tideReadout';
    readout.className='tide-fixed-readout';
    readout.textContent='Move across or tap the curve for exact time and modelled height.';
    canvas.insertAdjacentElement('afterend',readout);

    const live=document.createElement('div');
    live.id='eaLiveGauge';
    live.className='ea-live-gauge';
    live.innerHTML='<div><small>LIVE UK WATER LEVEL</small><strong>Loading Environment Agency gauge…</strong></div>';
    readout.insertAdjacentElement('afterend',live);
    return canvas;
  }

  function renderLiveGauge(gauge){
    const box=document.getElementById('eaLiveGauge');
    if(!box)return;
    if(!gauge?.station||!gauge.latest){
      box.innerHTML='<div><small>LIVE UK WATER LEVEL</small><strong>Environment Agency gauge unavailable</strong><span>Forecast tide data is still shown above.</span></div>';
      return;
    }
    const observed=Number(gauge.latest.value);
    const shown=state.units==='metric'?observed:observed*3.28084;
    const shownUnit=state.units==='metric'?'m':'ft';
    const d=new Date(gauge.latest.dateTime);
    box.innerHTML=`
      <div class="ea-live-head"><div><small>LIVE UK WATER LEVEL</small><strong>${gauge.station.label}</strong><span>${gauge.station.distanceKm} km from selected location · Environment Agency</span></div><div class="ea-live-value"><strong>${shown.toFixed(2)} ${shownUnit}</strong><span>above local gauge datum</span></div></div>
      <div class="ea-live-foot"><span>Observed ${d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})} · ${d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</span><span>Updated approximately every 15 minutes</span></div>
      <small class="ea-datum-note">This is an observed water level above the Environment Agency gauge's local datum. It is not Chart Datum and should not be directly compared with the Open-Meteo model height.</small>`;
  }

  window.renderTides=function(){
    const tide=state.tide||{type:'Open-Meteo tide model',heights:[],extremes:[]};
    ensureLayout();
    const heights=next24Hours(tide.heights),extremes=normalise(tide.extremes);
    state.chartPoints=heights;

    const source=document.getElementById('tideSource'),footer=document.getElementById('footerTideCredit');
    if(source)source.textContent='Open-Meteo model';
    if(footer)footer.textContent='Tides: Open-Meteo model · Live levels: Environment Agency';

    const events=document.getElementById('tideEvents'),now=Date.now()/1000,upcoming=extremes.filter(x=>x.dt>now).slice(0,8),u=displayUnit();
    if(events){
      events.innerHTML=upcoming.length?upcoming.map(x=>`<div class="tide-event"><div><strong>${/high/i.test(x.type)?'High':'Low'} water</strong><div class="soft">${pointDate(x).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})} · ${pointDate(x).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</div></div><strong>${x.height.toFixed(2)} ${u}</strong></div>`).join(''):'<div class="soft">No modelled high/low events available for this point.</div>';
    }

    const status=document.getElementById('tideChartStatus');
    if(status)status.textContent=heights.length>1?`${heights.length} model height points · ${u}`:'No model tide-height points available';
    renderLiveGauge(tide.liveGauge);
    window.drawTideChart();
  };

  const style=document.createElement('style');
  style.textContent=`
    .tide-fixed-toolbar{display:flex;justify-content:space-between;gap:14px;margin-bottom:12px;padding:11px 13px;border-radius:14px;background:rgba(255,255,255,.06)}
    .tide-fixed-toolbar span{font-size:12px;opacity:.72}
    .tide-model-meta{display:grid;gap:4px;margin-bottom:12px;padding:13px 14px;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:rgba(255,255,255,.05)}
    .tide-model-meta span,.tide-model-meta small{opacity:.76}
    .tide-fixed-readout{margin-top:10px;padding:11px 13px;border-radius:13px;background:rgba(255,255,255,.06);font-size:13px}
    .ea-live-gauge{margin-top:14px;padding:15px;border-radius:16px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12)}
    .ea-live-head{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}.ea-live-head>div:first-child{display:grid;gap:4px}.ea-live-head small{letter-spacing:.08em;opacity:.72}.ea-live-head span,.ea-live-foot,.ea-datum-note{opacity:.75}
    .ea-live-value{text-align:right;display:grid;gap:2px}.ea-live-value strong{font-size:28px}.ea-live-value span{font-size:12px}
    .ea-live-foot{display:flex;justify-content:space-between;gap:12px;margin-top:12px;font-size:12px}.ea-datum-note{display:block;margin-top:10px;line-height:1.45}
    @media(max-width:620px){.tide-fixed-toolbar,.ea-live-head,.ea-live-foot{flex-direction:column}.ea-live-value{text-align:left}}
  `;
  document.head.appendChild(style);

  let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>state.chartPoints?.length&&window.drawTideChart(),120)});
})();
