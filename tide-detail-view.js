(function(){
  const unit=()=>state.units==='metric'?'m':'ft';
  const pointDate=p=>p?.date?new Date(p.date):new Date(Number(p?.dt)*1000);
  const validPoint=p=>Number.isFinite(Number(p?.height))&&Number.isFinite(pointDate(p).getTime());
  const normalise=items=>(items||[]).map(p=>({date:p.date||new Date(Number(p.dt)*1000).toISOString(),dt:Number(p.dt)||new Date(p.date).getTime()/1000,height:Number(p.height),type:p.type||p.event||''})).filter(validPoint).sort((a,b)=>a.dt-b.dt);

  function next48Hours(items){
    const points=normalise(items),now=Date.now(),end=now+48*3600000;
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

  function fallbackFromMarine(marine){
    const h=marine?.hourly;
    const heights=(h?.time||[]).map((t,i)=>({date:t,dt:new Date(t).getTime()/1000,height:Number(h?.sea_level_height_msl?.[i])})).filter(validPoint);
    const extremes=[];
    for(let i=1;i<heights.length-1;i++){const a=heights[i-1].height,b=heights[i].height,c=heights[i+1].height;if(b>a&&b>c)extremes.push({...heights[i],type:'High'});if(b<a&&b<c)extremes.push({...heights[i],type:'Low'})}
    return {type:heights.length>1?'Open-Meteo sea-level fallback':'Tide data unavailable',heights,extremes};
  }

  window.loadTides=async function(loc,marine){
    try{
      const response=await fetch('/api/tides',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lat:loc.latitude,lon:loc.longitude})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||'WorldTides request failed.');
      const heights=normalise(data.heights),extremes=normalise(data.extremes);
      if(heights.length<2)throw new Error('WorldTides returned no usable height series.');
      return {...data,type:'WorldTides',heights,extremes};
    }catch(error){console.warn(error);return fallbackFromMarine(marine)}
  };

  function ensureLayout(){
    const canvas=document.getElementById('tideChart');if(!canvas||canvas.dataset.fixedLayout)return canvas;
    canvas.dataset.fixedLayout='true';const card=canvas.closest('.card');const toolbar=document.createElement('div');toolbar.className='tide-fixed-toolbar';toolbar.innerHTML='<strong>Detailed tide curve · next 48 hours</strong><span id="tideChartStatus">Loading tide heights…</span>';card?.insertBefore(toolbar,canvas);
    const readout=document.createElement('div');readout.id='tideReadout';readout.className='tide-fixed-readout';readout.textContent='Move across or tap the curve for exact local time and height.';canvas.insertAdjacentElement('afterend',readout);return canvas;
  }

  window.renderTides=function(){
    const tide=state.tide||{type:'Tide data unavailable',heights:[],extremes:[]};
    const heights=next48Hours(tide.heights),extremes=normalise(tide.extremes);state.chartPoints=heights;
    const source=document.getElementById('tideSource'),footer=document.getElementById('footerTideCredit');if(source)source.textContent=tide.type;if(footer)footer.textContent=`Tides: ${tide.type}`;
    const events=document.getElementById('tideEvents'),now=Date.now()/1000,upcoming=extremes.filter(x=>x.dt>now&&x.dt<=now+48*3600).slice(0,10);
    if(events)events.innerHTML=upcoming.length?upcoming.map(x=>`<div class="tide-event"><div><strong>${/high/i.test(x.type)?'High':'Low'} water</strong><div class="soft">${pointDate(x).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})} · ${pointDate(x).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</div></div><strong>${x.height.toFixed(2)} ${unit()}</strong></div>`).join(''):'<div class="soft">No high or low water events returned.</div>';
    const status=document.getElementById('tideChartStatus');if(status)status.textContent=heights.length>1?`From now · ${heights.length} points · ${tide.type}`:'No height points available';window.drawTideChart();
  };

  window.drawTideChart=function(activeIndex=null){
    const canvas=ensureLayout();if(!canvas)return;
    const rect=canvas.getBoundingClientRect(),cssWidth=Math.max(320,Math.round(rect.width||canvas.parentElement?.clientWidth||900)),cssHeight=430,ratio=Math.max(1,window.devicePixelRatio||1);
    canvas.style.width='100%';canvas.style.height=`${cssHeight}px`;canvas.width=Math.round(cssWidth*ratio);canvas.height=Math.round(cssHeight*ratio);
    const ctx=canvas.getContext('2d');ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,cssWidth,cssHeight);
    const points=(state.chartPoints||[]).filter(validPoint);if(points.length<2){ctx.fillStyle='rgba(255,255,255,.9)';ctx.font='600 16px -apple-system, BlinkMacSystemFont, sans-serif';ctx.fillText('No tide-height series is available.',24,48);return}
    const L=64,R=22,T=30,B=66,W=cssWidth-L-R,H=cssHeight-T-B,t0=pointDate(points[0]).getTime(),t1=pointDate(points[points.length-1]).getTime(),span=t1-t0||1;
    const values=points.map(p=>p.height),min=Math.min(...values),max=Math.max(...values),padding=Math.max(.05,(max-min)*.08),lo=min-padding,hi=max+padding,range=hi-lo||1;
    const xy=points.map(p=>({x:L+(pointDate(p).getTime()-t0)*W/span,y:T+H-(p.height-lo)*H/range,p}));
    ctx.lineWidth=1;ctx.strokeStyle='rgba(255,255,255,.18)';ctx.fillStyle='rgba(255,255,255,.72)';ctx.font='12px -apple-system, BlinkMacSystemFont, sans-serif';
    for(let i=0;i<6;i++){const y=T+i*H/5,val=hi-i*range/5;ctx.beginPath();ctx.moveTo(L,y);ctx.lineTo(cssWidth-R,y);ctx.stroke();ctx.textAlign='right';ctx.textBaseline='middle';ctx.fillText(`${val.toFixed(2)} ${unit()}`,L-8,y)}
    const tickHours=cssWidth<550?4:cssWidth<850?3:2;
    const firstTick=Math.ceil(t0/(tickHours*3600000))*(tickHours*3600000);
    for(let ts=firstTick;ts<=t1;ts+=tickHours*3600000){const x=L+(ts-t0)*W/span,d=new Date(ts);ctx.beginPath();ctx.moveTo(x,T);ctx.lineTo(x,T+H);ctx.strokeStyle='rgba(255,255,255,.09)';ctx.stroke();ctx.fillStyle='rgba(255,255,255,.78)';ctx.textAlign='center';ctx.textBaseline='top';ctx.fillText(d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}),x,T+H+10);if(d.getHours()===0||ts===firstTick)ctx.fillText(d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric'}),x,T+H+29)}
    ctx.strokeStyle='rgba(94,231,231,.75)';ctx.beginPath();ctx.moveTo(L,T);ctx.lineTo(L,T+H);ctx.stroke();ctx.fillStyle='#5ee7e7';ctx.textAlign='left';ctx.fillText('NOW',L+5,T+5);
    const fill=ctx.createLinearGradient(0,T,0,T+H);fill.addColorStop(0,'rgba(255,255,255,.35)');fill.addColorStop(1,'rgba(255,255,255,.03)');ctx.beginPath();ctx.moveTo(xy[0].x,T+H);xy.forEach(q=>ctx.lineTo(q.x,q.y));ctx.lineTo(xy[xy.length-1].x,T+H);ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.beginPath();xy.forEach((q,i)=>i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y));ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.stroke();
    if(Number.isInteger(activeIndex)&&xy[activeIndex]){const q=xy[activeIndex],d=pointDate(q.p);ctx.beginPath();ctx.moveTo(q.x,T);ctx.lineTo(q.x,T+H);ctx.strokeStyle='rgba(255,255,255,.55)';ctx.lineWidth=1;ctx.stroke();ctx.beginPath();ctx.arc(q.x,q.y,5,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();const readout=document.getElementById('tideReadout');if(readout)readout.textContent=`${d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})} ${d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})} · ${q.p.height.toFixed(2)} ${unit()}`}
    canvas.onpointermove=e=>{const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,target=t0+Math.max(0,Math.min(1,(x-L)/W))*span;let best=0,diff=Infinity;points.forEach((p,i)=>{const v=Math.abs(pointDate(p).getTime()-target);if(v<diff){diff=v;best=i}});window.drawTideChart(best)};canvas.onpointerleave=()=>window.drawTideChart();canvas.onclick=e=>canvas.onpointermove(e);
  };

  const style=document.createElement('style');style.textContent='.tide-fixed-toolbar{display:flex;justify-content:space-between;gap:14px;margin-bottom:12px;padding:11px 13px;border-radius:14px;background:rgba(255,255,255,.06)}.tide-fixed-toolbar span{font-size:12px;opacity:.72}.tide-fixed-readout{margin-top:10px;padding:11px 13px;border-radius:13px;background:rgba(255,255,255,.06);font-size:13px}#tideChart{display:block;width:100%;min-height:430px}@media(max-width:620px){.tide-fixed-toolbar{flex-direction:column}}';document.head.appendChild(style);
  let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>state.chartPoints?.length&&window.drawTideChart(),120)});
})();