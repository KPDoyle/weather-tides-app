(() => {
  const pointDate=p=>p?.date?new Date(p.date):new Date(Number(p?.dt)*1000);
  const valid=p=>Number.isFinite(Number(p?.height))&&Number.isFinite(pointDate(p).getTime());
  const forecastUnit=()=>state.units==='metric'?'m':'ft';
  const isUkArea=loc=>Number(loc?.latitude)>=48&&Number(loc?.latitude)<=62.5&&Number(loc?.longitude)>=-11&&Number(loc?.longitude)<=4;

  const normalise=items=>(items||[]).map(p=>({
    date:p.date||new Date(Number(p.dt)*1000).toISOString(),
    dt:Number(p.dt)||new Date(p.date).getTime()/1000,
    height:Number(p.height),type:p.type||''
  })).filter(valid).sort((a,b)=>a.dt-b.dt);

  function interpolateExtremes(points){
    const p=normalise(points),out=[];
    for(let i=1;i<p.length-1;i++){
      const y0=p[i-1].height,y1=p[i].height,y2=p[i+1].height;
      const high=y1>y0&&y1>y2,low=y1<y0&&y1<y2;
      if(!high&&!low)continue;
      const a=(y0+y2)/2-y1,b=(y2-y0)/2;
      let x=Math.abs(a)>1e-9?-b/(2*a):0;
      x=Math.max(-1,Math.min(1,x));
      const height=a*x*x+b*x+y1;
      const t0=pointDate(p[i-1]).getTime(),t2=pointDate(p[i+1]).getTime();
      const ms=pointDate(p[i]).getTime()+x*((t2-t0)/2);
      out.push({date:new Date(ms).toISOString(),dt:ms/1000,height,type:high?'High':'Low'});
    }
    return out;
  }

  function next24Hours(items){
    const points=normalise(items),now=Date.now(),end=now+24*3600000;
    if(points.length<2)return points;
    let after=points.findIndex(p=>pointDate(p).getTime()>=now);
    if(after<0)return points.slice(-2);
    const before=Math.max(0,after-1),a=points[before],b=points[after];
    const selected=points.slice(after).filter(p=>pointDate(p).getTime()<=end);
    if(a&&b&&pointDate(a).getTime()<now){
      const at=pointDate(a).getTime(),bt=pointDate(b).getTime(),f=Math.max(0,Math.min(1,(now-at)/(bt-at||1)));
      selected.unshift({date:new Date(now).toISOString(),dt:now/1000,height:a.height+(b.height-a.height)*f,type:'Now'});
    }
    return selected;
  }

  function modelFromMarine(marine){
    const h=marine?.hourly;
    const heights=(h?.time||[]).map((t,i)=>({date:t,dt:new Date(t).getTime()/1000,height:Number(h?.sea_level_height_msl?.[i])})).filter(valid);
    return {heights,extremes:interpolateExtremes(heights)};
  }

  async function loadEaGauge(loc){
    if(!isUkArea(loc))return null;
    try{
      const q=new URLSearchParams({lat:String(loc.latitude),lon:String(loc.longitude)});
      const r=await fetch(`/api/ea-tides?${q}`,{headers:{Accept:'application/json'}});
      if(!r.ok)throw new Error('Environment Agency tide gauge unavailable.');
      return await r.json();
    }catch(error){console.warn(error);return {error:error.message||'Live gauge unavailable.'};}
  }

  window.loadTides=async function(loc,marine){
    const model=modelFromMarine(marine);
    const ea=await loadEaGauge(loc);
    return {
      type:'Open-Meteo + Environment Agency',
      source:'Open-Meteo marine model',
      heights:model.heights,
      extremes:model.extremes,
      forecastDatum:'Global mean sea level',
      ea,
      officialUrl:'https://easytide.admiralty.co.uk/'
    };
  };

  function ensureLayout(){
    const panel=document.getElementById('tidesPanel'),canvas=document.getElementById('tideChart');
    if(!panel||!canvas)return canvas;
    const cards=panel.querySelectorAll('.two-col .card');
    if(cards[0]){
      const title=cards[0].querySelector('.card-head span');if(title)title.textContent='MODELLED TIDE FORECAST';
    }
    if(cards[1]){
      const title=cards[1].querySelector('.card-head span');if(title)title.textContent='MODELLED HIGH & LOW WATER';
    }
    if(!canvas.dataset.freeTideLayout){
      canvas.dataset.freeTideLayout='true';
      const card=canvas.closest('.card');
      const toolbar=document.createElement('div');toolbar.className='tide-fixed-toolbar';toolbar.innerHTML='<strong>24-hour tide curve</strong><span id="tideChartStatus">Loading forecast…</span>';card?.insertBefore(toolbar,canvas);
      const readout=document.createElement('div');readout.id='tideReadout';readout.className='tide-fixed-readout';readout.textContent='Move across or tap the curve for exact modelled time and height.';canvas.insertAdjacentElement('afterend',readout);
      const datum=document.createElement('div');datum.id='tideDatumNote';datum.className='tide-datum-note';datum.textContent='Forecast heights are relative to global mean sea level and are not Chart Datum.';readout.insertAdjacentElement('afterend',datum);
    }
    if(!document.getElementById('eaGaugeCard')){
      const card=document.createElement('article');card.id='eaGaugeCard';card.className='glass card ea-gauge-card';card.innerHTML='<div class="card-head"><span>LIVE UK WATER LEVEL</span><small>Environment Agency</small></div><div id="eaGaugeContent" class="ea-gauge-content"><div class="soft">Finding nearest UK tide gauge…</div></div><p class="navigation-warning">Observed gauge levels use the gauge datum shown below. They are not directly comparable with the Open-Meteo forecast datum.</p>';
      const twoCol=panel.querySelector('.two-col');twoCol?.insertAdjacentElement('afterend',card);
    }
    const official=[...panel.querySelectorAll('.card')].find(c=>c.textContent.includes('OFFICIAL UKHO TIDES'));
    if(official){
      const p=official.querySelector('p');if(p)p.textContent='Use ADMIRALTY EasyTide as the official UKHO cross-check for seven-day tide predictions and the official tidal curve.';
    }
    return canvas;
  }

  function renderEaGauge(ea){
    const box=document.getElementById('eaGaugeContent');if(!box)return;
    if(!ea){box.innerHTML='<div class="soft">Environment Agency live tide gauges are shown for UK coastal locations.</div>';return;}
    if(ea.error||!ea.station){box.innerHTML=`<div class="soft">${ea.error||'Live Environment Agency gauge data is unavailable.'}</div>`;return;}
    const latest=ea.latest,readings=(ea.readings||[]).slice(-8),distance=Number(ea.station.distanceKm);
    const latestHtml=latest?`<div class="ea-live-reading"><div><span>Observed water level</span><strong>${Number(latest.value).toFixed(2)} ${ea.unit||'mAOD'}</strong></div><small>${new Date(latest.dateTime).toLocaleString('en-GB',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</small></div>`:'<div class="soft">No current reading returned.</div>';
    const strip=readings.length?`<div class="ea-reading-strip">${readings.map(r=>`<div><small>${new Date(r.dateTime).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</small><strong>${Number(r.value).toFixed(2)}</strong></div>`).join('')}</div>`:'';
    box.innerHTML=`<div class="ea-station"><strong>${ea.station.label}</strong><span>${Number.isFinite(distance)?distance.toFixed(1)+' km from selected point · ':''}${ea.datum||'Ordnance Datum Newlyn'}</span></div>${latestHtml}${strip}<div class="ea-attribution">${ea.attribution||'This uses Environment Agency tide gauge data from the real-time data API (Beta).'}</div>`;
  }

  window.renderTides=function(){
    const tide=state.tide||{heights:[],extremes:[],ea:null};ensureLayout();
    const heights=next24Hours(tide.heights),now=Date.now()/1000,events=normalise(tide.extremes).filter(x=>x.dt>now).slice(0,8);state.chartPoints=heights;
    const source=document.getElementById('tideSource'),footer=document.getElementById('footerTideCredit');
    if(source)source.textContent='Open-Meteo model';
    if(footer)footer.textContent='Tide forecast: Open-Meteo · Live gauge: Environment Agency';
    const status=document.getElementById('tideChartStatus');if(status)status.textContent=heights.length>1?`${heights.length} forecast points · ${tide.forecastDatum||'global mean sea level'}`:'Forecast unavailable';
    const eventsBox=document.getElementById('tideEvents');if(eventsBox)eventsBox.innerHTML=events.length?events.map(x=>`<div class="tide-event"><div><strong>Modelled ${x.type.toLowerCase()} water</strong><div class="soft">${pointDate(x).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})} · ${pointDate(x).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</div></div><strong>${x.height.toFixed(2)} ${forecastUnit()}</strong></div>`).join(''):'<div class="soft">No modelled high/low events found in the forecast window.</div>';
    renderEaGauge(tide.ea);window.drawTideChart();
  };

  function smooth(ctx,xy){
    if(!xy.length)return;ctx.moveTo(xy[0].x,xy[0].y);
    for(let i=1;i<xy.length-1;i++){const q=xy[i],n=xy[i+1];ctx.quadraticCurveTo(q.x,q.y,(q.x+n.x)/2,(q.y+n.y)/2)}
    const last=xy.at(-1);ctx.lineTo(last.x,last.y);
  }

  window.drawTideChart=function(activeIndex=null){
    const canvas=ensureLayout();if(!canvas)return;
    const rect=canvas.getBoundingClientRect(),cssWidth=Math.max(320,Math.round(rect.width||canvas.parentElement?.clientWidth||900)),cssHeight=480,ratio=Math.max(1,window.devicePixelRatio||1);
    canvas.style.width='100%';canvas.style.height=`${cssHeight}px`;canvas.width=Math.round(cssWidth*ratio);canvas.height=Math.round(cssHeight*ratio);
    const ctx=canvas.getContext('2d');ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,cssWidth,cssHeight);
    const points=(state.chartPoints||[]).filter(valid);if(points.length<2){ctx.fillStyle='rgba(255,255,255,.9)';ctx.font='600 16px -apple-system,system-ui,sans-serif';ctx.fillText('No modelled tide-height series is available.',24,48);return}
    const L=76,R=28,T=34,B=118,W=cssWidth-L-R,H=cssHeight-T-B,t0=pointDate(points[0]).getTime(),t1=pointDate(points.at(-1)).getTime(),span=t1-t0||1;
    const values=points.map(p=>Number(p.height)),min=Math.min(...values),max=Math.max(...values),padding=Math.max(.05,(max-min)*.08),lo=min-padding,hi=max+padding,range=hi-lo||1;
    const xy=points.map(p=>({x:L+(pointDate(p).getTime()-t0)*W/span,y:T+H-(Number(p.height)-lo)*H/range,p}));
    ctx.lineWidth=1;ctx.font='12px -apple-system,system-ui,sans-serif';
    for(let i=0;i<6;i++){const y=T+i*H/5,val=hi-i*range/5;ctx.strokeStyle='rgba(255,255,255,.18)';ctx.beginPath();ctx.moveTo(L,y);ctx.lineTo(cssWidth-R,y);ctx.stroke();ctx.fillStyle='rgba(255,255,255,.72)';ctx.textAlign='right';ctx.textBaseline='middle';ctx.fillText(`${val.toFixed(2)} ${forecastUnit()}`,L-10,y)}
    const tickHours=cssWidth<520?4:cssWidth<780?3:2,firstTick=Math.ceil(t0/(tickHours*3600000))*(tickHours*3600000);
    for(let ts=firstTick;ts<=t1;ts+=tickHours*3600000){const x=L+(ts-t0)*W/span;if(x-L<58||cssWidth-R-x<58)continue;const d=new Date(ts);ctx.strokeStyle='rgba(255,255,255,.11)';ctx.beginPath();ctx.moveTo(x,T);ctx.lineTo(x,T+H);ctx.stroke();ctx.fillStyle='rgba(255,255,255,.92)';ctx.textAlign='center';ctx.textBaseline='top';ctx.font='700 12px -apple-system,system-ui,sans-serif';ctx.fillText(d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}),x,T+H+12);if(d.getHours()===0){ctx.fillStyle='rgba(94,231,231,.95)';ctx.font='700 11px -apple-system,system-ui,sans-serif';ctx.fillText(d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'}),x,T+H+34)}}
    ctx.strokeStyle='rgba(94,231,231,.9)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(L,T);ctx.lineTo(L,T+H);ctx.stroke();ctx.fillStyle='#5ee7e7';ctx.textAlign='left';ctx.textBaseline='top';ctx.font='700 12px -apple-system,system-ui,sans-serif';ctx.fillText('NOW',L+6,T+5);
    const start=new Date(t0),end=new Date(t1);ctx.fillStyle='rgba(255,255,255,.96)';ctx.font='700 12px -apple-system,system-ui,sans-serif';ctx.textAlign='left';ctx.fillText(start.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}),L,T+H+62);ctx.fillStyle='rgba(255,255,255,.64)';ctx.font='11px -apple-system,system-ui,sans-serif';ctx.fillText(start.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'}),L,T+H+80);ctx.textAlign='right';ctx.fillStyle='rgba(255,255,255,.96)';ctx.font='700 12px -apple-system,system-ui,sans-serif';ctx.fillText(end.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}),cssWidth-R,T+H+62);ctx.fillStyle='rgba(255,255,255,.64)';ctx.font='11px -apple-system,system-ui,sans-serif';ctx.fillText(end.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'}),cssWidth-R,T+H+80);
    const fill=ctx.createLinearGradient(0,T,0,T+H);fill.addColorStop(0,'rgba(255,255,255,.35)');fill.addColorStop(1,'rgba(255,255,255,.03)');ctx.beginPath();ctx.moveTo(xy[0].x,T+H);ctx.lineTo(xy[0].x,xy[0].y);for(let i=1;i<xy.length-1;i++){const q=xy[i],n=xy[i+1];ctx.quadraticCurveTo(q.x,q.y,(q.x+n.x)/2,(q.y+n.y)/2)}ctx.lineTo(xy.at(-1).x,xy.at(-1).y);ctx.lineTo(xy.at(-1).x,T+H);ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.beginPath();smooth(ctx,xy);ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke();
    if(Number.isInteger(activeIndex)&&xy[activeIndex]){const q=xy[activeIndex],d=pointDate(q.p);ctx.strokeStyle='rgba(255,255,255,.55)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(q.x,T);ctx.lineTo(q.x,T+H);ctx.stroke();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(q.x,q.y,5,0,Math.PI*2);ctx.fill();const out=document.getElementById('tideReadout');if(out)out.textContent=`${d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})} ${d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})} · ${Number(q.p.height).toFixed(2)} ${forecastUnit()} relative to global mean sea level`}
    canvas.onpointermove=e=>{const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,target=t0+Math.max(0,Math.min(1,(x-L)/W))*span;let best=0,diff=Infinity;points.forEach((p,i)=>{const v=Math.abs(pointDate(p).getTime()-target);if(v<diff){diff=v;best=i}});window.drawTideChart(best)};canvas.onpointerleave=()=>window.drawTideChart();canvas.onclick=e=>canvas.onpointermove(e);
  };

  const style=document.createElement('style');style.textContent='.tide-fixed-toolbar{display:flex;justify-content:space-between;gap:14px;margin-bottom:12px;padding:11px 13px;border-radius:14px;background:rgba(255,255,255,.06)}.tide-fixed-toolbar span{font-size:12px;opacity:.72}.tide-fixed-readout,.tide-datum-note{margin-top:10px;padding:11px 13px;border-radius:13px;background:rgba(255,255,255,.06);font-size:13px}.tide-datum-note{opacity:.78}.ea-gauge-card{margin-top:14px}.ea-gauge-content{display:grid;gap:14px}.ea-station{display:grid;gap:4px}.ea-station span,.ea-attribution{font-size:12px;opacity:.72}.ea-live-reading{display:flex;align-items:end;justify-content:space-between;gap:16px;padding:14px;border-radius:15px;background:rgba(255,255,255,.07)}.ea-live-reading div{display:grid;gap:4px}.ea-live-reading span{font-size:12px;opacity:.72}.ea-live-reading strong{font-size:30px}.ea-reading-strip{display:grid;grid-template-columns:repeat(8,minmax(52px,1fr));gap:6px;overflow:auto}.ea-reading-strip div{display:grid;gap:4px;text-align:center;padding:9px 6px;border-radius:11px;background:rgba(255,255,255,.05)}.ea-reading-strip small{opacity:.66}#tideChart{display:block;width:100%;min-height:480px}@media(max-width:620px){.tide-fixed-toolbar{flex-direction:column}.ea-live-reading{align-items:start;flex-direction:column}.ea-reading-strip{grid-template-columns:repeat(8,68px)}}';document.head.appendChild(style);
  let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>state.chartPoints?.length&&window.drawTideChart(),120)});
})();