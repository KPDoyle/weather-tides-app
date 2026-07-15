(function(){
  const unit=()=>state.units==='metric'?'m':'ft';
  const pointDate=p=>p?.date?new Date(p.date):new Date(Number(p?.dt)*1000);
  const validPoint=p=>Number.isFinite(Number(p?.height))&&Number.isFinite(pointDate(p).getTime());
  const normalise=items=>(items||[]).map(p=>({
    date:p.date||new Date(Number(p.dt)*1000).toISOString(),
    dt:Number(p.dt)||new Date(p.date).getTime()/1000,
    height:Number(p.height),
    type:p.type||p.event||''
  })).filter(validPoint).sort((a,b)=>a.dt-b.dt);

  function fallbackFromMarine(marine){
    const h=marine?.hourly;
    const heights=(h?.time||[]).map((t,i)=>({date:t,dt:new Date(t).getTime()/1000,height:Number(h?.sea_level_height_msl?.[i])})).filter(validPoint);
    const extremes=[];
    for(let i=1;i<heights.length-1;i++){
      const a=heights[i-1].height,b=heights[i].height,c=heights[i+1].height;
      if(b>a&&b>c)extremes.push({...heights[i],type:'High'});
      if(b<a&&b<c)extremes.push({...heights[i],type:'Low'});
    }
    return {type:heights.length>1?'Open-Meteo sea-level fallback':'Tide data unavailable',heights,extremes};
  }

  window.loadTides=async function(loc,marine){
    try{
      const response=await fetch('/api/tides',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lat:loc.latitude,lon:loc.longitude})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||'WorldTides request failed.');
      const heights=normalise(data.heights);
      const extremes=normalise(data.extremes);
      if(heights.length<2)throw new Error('WorldTides returned no usable height series.');
      return {...data,type:'WorldTides',heights,extremes};
    }catch(error){
      console.warn(error);
      return fallbackFromMarine(marine);
    }
  };

  function ensureLayout(){
    const canvas=document.getElementById('tideChart');
    if(!canvas||canvas.dataset.fixedLayout)return canvas;
    canvas.dataset.fixedLayout='true';
    const card=canvas.closest('.card');
    const toolbar=document.createElement('div');
    toolbar.className='tide-fixed-toolbar';
    toolbar.innerHTML='<strong>Detailed tide curve</strong><span id="tideChartStatus">Loading tide heights…</span>';
    card?.insertBefore(toolbar,canvas);
    const readout=document.createElement('div');
    readout.id='tideReadout';
    readout.className='tide-fixed-readout';
    readout.textContent='Move across or tap the curve for exact local time and height.';
    canvas.insertAdjacentElement('afterend',readout);
    return canvas;
  }

  window.renderTides=function(){
    const tide=state.tide||{type:'Tide data unavailable',heights:[],extremes:[]};
    const heights=normalise(tide.heights).slice(0,168);
    const extremes=normalise(tide.extremes);
    state.chartPoints=heights;
    const source=document.getElementById('tideSource');
    const footer=document.getElementById('footerTideCredit');
    if(source)source.textContent=tide.type;
    if(footer)footer.textContent=`Tides: ${tide.type}`;
    const events=document.getElementById('tideEvents');
    const now=Date.now()/1000;
    const upcoming=extremes.filter(x=>x.dt>now).slice(0,10);
    if(events)events.innerHTML=upcoming.length?upcoming.map(x=>`<div class="tide-event"><div><strong>${/high/i.test(x.type)?'High':'Low'} water</strong><div class="soft">${pointDate(x).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})} · ${pointDate(x).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</div></div><strong>${x.height.toFixed(2)} ${unit()}</strong></div>`).join(''):'<div class="soft">No high or low water events returned.</div>';
    const status=document.getElementById('tideChartStatus');
    if(status)status.textContent=heights.length>1?`${heights.length} height points · ${tide.type}`:'No height points available';
    window.drawTideChart();
  };

  window.drawTideChart=function(activeIndex=null){
    const canvas=ensureLayout();
    if(!canvas)return;
    const rect=canvas.getBoundingClientRect();
    const cssWidth=Math.max(320,Math.round(rect.width||canvas.parentElement?.clientWidth||900));
    const cssHeight=430;
    const ratio=Math.max(1,window.devicePixelRatio||1);
    canvas.style.width='100%';
    canvas.style.height=`${cssHeight}px`;
    canvas.width=Math.round(cssWidth*ratio);
    canvas.height=Math.round(cssHeight*ratio);
    const ctx=canvas.getContext('2d');
    ctx.setTransform(ratio,0,0,ratio,0,0);
    ctx.clearRect(0,0,cssWidth,cssHeight);
    const points=(state.chartPoints||[]).filter(validPoint);
    if(points.length<2){
      ctx.fillStyle='rgba(255,255,255,.9)';
      ctx.font='600 16px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText('No tide-height series is available.',24,48);
      ctx.font='13px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle='rgba(255,255,255,.68)';
      ctx.fillText('Check WORLD_TIDES_API_KEY in Vercel or wait for the sea-level fallback.',24,76);
      return;
    }
    const L=64,R=22,T=30,B=62,W=cssWidth-L-R,H=cssHeight-T-B;
    const values=points.map(p=>p.height),min=Math.min(...values),max=Math.max(...values),padding=Math.max(.05,(max-min)*.08),lo=min-padding,hi=max+padding,range=hi-lo||1;
    const xy=points.map((p,i)=>({x:L+i*W/(points.length-1),y:T+H-(p.height-lo)*H/range,p}));
    ctx.lineWidth=1;ctx.strokeStyle='rgba(255,255,255,.18)';ctx.fillStyle='rgba(255,255,255,.72)';ctx.font='12px -apple-system, BlinkMacSystemFont, sans-serif';
    for(let i=0;i<6;i++){
      const y=T+i*H/5,val=hi-i*range/5;
      ctx.beginPath();ctx.moveTo(L,y);ctx.lineTo(cssWidth-R,y);ctx.stroke();ctx.textAlign='right';ctx.textBaseline='middle';ctx.fillText(`${val.toFixed(2)} ${unit()}`,L-8,y);
    }
    const ticks=cssWidth<600?6:10;
    for(let n=0;n<ticks;n++){
      const i=Math.round(n*(points.length-1)/(ticks-1)),x=xy[i].x,d=pointDate(points[i]);
      ctx.beginPath();ctx.moveTo(x,T);ctx.lineTo(x,T+H);ctx.strokeStyle='rgba(255,255,255,.09)';ctx.stroke();
      ctx.fillStyle='rgba(255,255,255,.72)';ctx.textAlign='center';ctx.textBaseline='top';ctx.fillText(d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}),x,T+H+10);ctx.fillText(d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric'}),x,T+H+28);
    }
    const fill=ctx.createLinearGradient(0,T,0,T+H);fill.addColorStop(0,'rgba(255,255,255,.35)');fill.addColorStop(1,'rgba(255,255,255,.03)');
    ctx.beginPath();ctx.moveTo(xy[0].x,T+H);xy.forEach(q=>ctx.lineTo(q.x,q.y));ctx.lineTo(xy[xy.length-1].x,T+H);ctx.closePath();ctx.fillStyle=fill;ctx.fill();
    ctx.beginPath();xy.forEach((q,i)=>i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y));ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.stroke();
    if(Number.isInteger(activeIndex)&&xy[activeIndex]){
      const q=xy[activeIndex],d=pointDate(q.p);
      ctx.beginPath();ctx.moveTo(q.x,T);ctx.lineTo(q.x,T+H);ctx.strokeStyle='rgba(255,255,255,.55)';ctx.lineWidth=1;ctx.stroke();
      ctx.beginPath();ctx.arc(q.x,q.y,5,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();
      const label=`${d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})} ${d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})} · ${q.p.height.toFixed(2)} ${unit()}`;
      const readout=document.getElementById('tideReadout');if(readout)readout.textContent=label;
    }
  };

  function bindPointer(){
    const canvas=ensureLayout();if(!canvas||canvas.dataset.pointerReady)return;canvas.dataset.pointerReady='true';
    const move=e=>{const points=state.chartPoints||[];if(points.length<2)return;const rect=canvas.getBoundingClientRect();const x=Math.max(0,Math.min(rect.width,e.clientX-rect.left));const i=Math.round(x/rect.width*(points.length-1));window.drawTideChart(i);};
    canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerdown',move);canvas.addEventListener('pointerleave',()=>window.drawTideChart());
  }

  const style=document.createElement('style');
  style.textContent='.tide-fixed-toolbar{display:flex;justify-content:space-between;gap:14px;align-items:center;margin:0 0 12px;padding:12px 14px;border-radius:14px;background:rgba(255,255,255,.07)}.tide-fixed-toolbar span{font-size:12px;opacity:.72}.tide-fixed-readout{margin-top:10px;padding:11px 13px;border-radius:12px;background:rgba(255,255,255,.06);font-size:13px}#tideChart{display:block;width:100%;height:430px;min-width:0!important}.tides-layout,.two-col{align-items:start}@media(max-width:650px){#tideChart{height:380px}.tide-fixed-toolbar{align-items:flex-start;flex-direction:column}}';
  document.head.appendChild(style);

  const start=()=>{ensureLayout();bindPointer();setTimeout(()=>{if(state?.location&&typeof loadLocation==='function')loadLocation(state.location);},50);};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
  window.addEventListener('resize',()=>window.drawTideChart());
})();