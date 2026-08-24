(()=>{
  const pointDate=p=>p?.date?new Date(p.date):new Date(Number(p?.dt)*1000);
  const valid=p=>Number.isFinite(Number(p?.height))&&Number.isFinite(pointDate(p).getTime());
  const unit=()=>state.units==='metric'?'m':'ft';
  const displayHeight=v=>state.units==='metric'?Number(v):Number(v)*3.28084;
  const normalise=items=>(items||[]).map(p=>({date:p.date||new Date(Number(p.dt)*1000).toISOString(),dt:Number(p.dt)||new Date(p.date).getTime()/1000,height:Number(p.height),type:p.type||''})).filter(valid).sort((a,b)=>a.dt-b.dt);

  function extremes(points){
    const p=normalise(points),out=[];
    for(let i=1;i<p.length-1;i++){
      const a=p[i-1].height,b=p[i].height,c=p[i+1].height;
      if(b>a&&b>c)out.push({...p[i],type:'High'});
      if(b<a&&b<c)out.push({...p[i],type:'Low'});
    }
    return out;
  }

  function positiveScale(points){
    const p=normalise(points);if(!p.length)return {points:p,offset:0};
    const min=Math.min(...p.map(x=>x.height));
    const offset=min<0?-min:0;
    return {points:p.map(x=>({...x,height:x.height+offset})),offset};
  }

  function next24(items){
    const p=normalise(items),now=Date.now(),end=now+24*3600000;if(p.length<2)return p;
    let i=p.findIndex(x=>pointDate(x).getTime()>=now);if(i<0)return p.slice(-2);
    const selected=p.slice(i).filter(x=>pointDate(x).getTime()<=end),a=p[Math.max(0,i-1)],b=p[i];
    if(a&&b&&pointDate(a).getTime()<now){const at=pointDate(a).getTime(),bt=pointDate(b).getTime(),f=Math.max(0,Math.min(1,(now-at)/(bt-at||1)));selected.unshift({date:new Date(now).toISOString(),dt:now/1000,height:a.height+(b.height-a.height)*f,type:'Now'});}
    return selected;
  }

  window.loadTides=async function(loc){
    const q=new URLSearchParams({latitude:String(loc.latitude),longitude:String(loc.longitude),hourly:'sea_level_height_msl',timezone:'auto',forecast_days:'7',cell_selection:'sea'});
    try{
      const r=await fetch(`https://marine-api.open-meteo.com/v1/marine?${q}`);
      if(!r.ok)throw new Error('Open-Meteo tide data unavailable.');
      const data=await r.json(),h=data?.hourly||{};
      const raw=(h.time||[]).map((t,i)=>({date:t,dt:new Date(t).getTime()/1000,height:Number(h.sea_level_height_msl?.[i])})).filter(valid);
      const adjusted=positiveScale(raw);
      return {type:'Open-Meteo Marine API',heights:adjusted.points,extremes:extremes(adjusted.points),offset:adjusted.offset,timezone:data.timezone,datumMode:'relative local tide scale'};
    }catch(error){return {type:'Open-Meteo Marine API',heights:[],extremes:[],error:error.message};}
  };

  function ensureLayout(){
    const panel=document.getElementById('tidesPanel'),canvas=document.getElementById('tideChart');if(!panel||!canvas)return canvas;
    panel.querySelector('.two-col')?.removeAttribute('hidden');
    document.getElementById('ukhoTideCard')?.remove();document.getElementById('tidesTodayCard')?.remove();
    [...panel.querySelectorAll('.card')].forEach(card=>{if(/OFFICIAL UKHO TIDES/i.test(card.textContent||''))card.setAttribute('hidden','')});
    const cards=panel.querySelectorAll('.two-col .card');
    if(cards[0]){const t=cards[0].querySelector('.card-head span');if(t)t.textContent='24-HOUR TIDE HEIGHT';}
    if(cards[1]){const t=cards[1].querySelector('.card-head span');if(t)t.textContent='HIGH & LOW WATER';}
    return canvas;
  }

  window.renderTides=function(){
    const tide=state.tide||{type:'Open-Meteo Marine API',heights:[],extremes:[]};ensureLayout();
    const heights=next24(tide.heights),events=normalise(tide.extremes).filter(x=>x.dt>Date.now()/1000).slice(0,8);state.chartPoints=heights;
    const source=document.getElementById('tideSource'),footer=document.getElementById('footerTideCredit');
    if(source)source.textContent='Open-Meteo';if(footer)footer.textContent='Tides: Open-Meteo Marine API';
    const box=document.getElementById('tideEvents');
    if(box)box.innerHTML=events.length?events.map(x=>`<div class="tide-event"><div><strong>${/high/i.test(x.type)?'High':'Low'} water</strong><div class="soft">${pointDate(x).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})} · ${pointDate(x).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</div></div><strong>${displayHeight(x.height).toFixed(2)} ${unit()}</strong></div>`).join(''):`<div class="soft">${tide.error||'No Open-Meteo high/low events available.'}</div>`;
    document.querySelectorAll('#tidesPanel .navigation-warning').forEach(p=>{if(!p.closest('[hidden]'))p.textContent='Open-Meteo marine model. Heights use a positive relative tide scale derived from sea_level_height_msl; they are not Chart Datum. Not for navigation.'});
    window.drawTideChart();
  };

  function smooth(ctx,xy){if(!xy.length)return;ctx.moveTo(xy[0].x,xy[0].y);for(let i=1;i<xy.length-1;i++){const q=xy[i],n=xy[i+1];ctx.quadraticCurveTo(q.x,q.y,(q.x+n.x)/2,(q.y+n.y)/2)}const last=xy[xy.length-1];ctx.lineTo(last.x,last.y);}

  window.drawTideChart=function(activeIndex=null){
    const canvas=ensureLayout();if(!canvas)return;const rect=canvas.getBoundingClientRect(),cssWidth=Math.max(320,Math.round(rect.width||canvas.parentElement?.clientWidth||900)),cssHeight=480,ratio=Math.max(1,window.devicePixelRatio||1);
    canvas.style.width='100%';canvas.style.height=`${cssHeight}px`;canvas.width=Math.round(cssWidth*ratio);canvas.height=Math.round(cssHeight*ratio);
    const ctx=canvas.getContext('2d');ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,cssWidth,cssHeight);
    const sourcePoints=(state.chartPoints||[]).filter(valid);if(sourcePoints.length<2){ctx.fillStyle='rgba(255,255,255,.9)';ctx.font='600 16px -apple-system,system-ui,sans-serif';ctx.fillText('No Open-Meteo tide-height series is available.',24,48);return;}
    const points=sourcePoints.map(p=>({...p,displayHeight:Math.max(0,displayHeight(p.height))})),L=76,R=28,T=34,B=118,W=cssWidth-L-R,H=cssHeight-T-B,t0=pointDate(points[0]).getTime(),t1=pointDate(points[points.length-1]).getTime(),span=t1-t0||1;
    const values=points.map(p=>p.displayHeight),min=Math.min(...values),max=Math.max(...values),padding=Math.max(.05,(max-min)*.08),lo=Math.max(0,min-padding),hi=max+padding,range=hi-lo||1,xy=points.map(p=>({x:L+(pointDate(p).getTime()-t0)*W/span,y:T+H-(p.displayHeight-lo)*H/range,p}));
    ctx.lineWidth=1;ctx.font='12px -apple-system,system-ui,sans-serif';for(let i=0;i<6;i++){const y=T+i*H/5,val=hi-i*range/5;ctx.strokeStyle='rgba(255,255,255,.18)';ctx.beginPath();ctx.moveTo(L,y);ctx.lineTo(cssWidth-R,y);ctx.stroke();ctx.fillStyle='rgba(255,255,255,.72)';ctx.textAlign='right';ctx.textBaseline='middle';ctx.fillText(`${Math.max(0,val).toFixed(2)} ${unit()}`,L-10,y);}
    const tickHours=cssWidth<520?4:cssWidth<780?3:2,firstTick=Math.ceil(t0/(tickHours*3600000))*(tickHours*3600000);for(let ts=firstTick;ts<=t1;ts+=tickHours*3600000){const x=L+(ts-t0)*W/span;if(x-L<58||cssWidth-R-x<58)continue;const d=new Date(ts);ctx.strokeStyle='rgba(255,255,255,.11)';ctx.beginPath();ctx.moveTo(x,T);ctx.lineTo(x,T+H);ctx.stroke();ctx.fillStyle='rgba(255,255,255,.92)';ctx.textAlign='center';ctx.textBaseline='top';ctx.font='700 12px -apple-system,system-ui,sans-serif';ctx.fillText(d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}),x,T+H+12);}
    ctx.strokeStyle='rgba(94,231,231,.9)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(L,T);ctx.lineTo(L,T+H);ctx.stroke();ctx.fillStyle='#5ee7e7';ctx.textAlign='left';ctx.textBaseline='top';ctx.font='700 12px -apple-system,system-ui,sans-serif';ctx.fillText('NOW',L+6,T+5);
    const fill=ctx.createLinearGradient(0,T,0,T+H);fill.addColorStop(0,'rgba(255,255,255,.35)');fill.addColorStop(1,'rgba(255,255,255,.03)');ctx.beginPath();ctx.moveTo(xy[0].x,T+H);ctx.lineTo(xy[0].x,xy[0].y);for(let i=1;i<xy.length-1;i++){const q=xy[i],n=xy[i+1];ctx.quadraticCurveTo(q.x,q.y,(q.x+n.x)/2,(q.y+n.y)/2)}ctx.lineTo(xy[xy.length-1].x,xy[xy.length-1].y);ctx.lineTo(xy[xy.length-1].x,T+H);ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.beginPath();smooth(ctx,xy);ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke();
    if(Number.isInteger(activeIndex)&&xy[activeIndex]){const q=xy[activeIndex],d=pointDate(q.p);ctx.strokeStyle='rgba(255,255,255,.55)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(q.x,T);ctx.lineTo(q.x,T+H);ctx.stroke();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(q.x,q.y,5,0,Math.PI*2);ctx.fill();const out=document.getElementById('tideReadout');if(out)out.textContent=`${d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})} ${d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})} · ${q.p.displayHeight.toFixed(2)} ${unit()} relative tide height`;}
    canvas.onpointermove=e=>{const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,target=t0+Math.max(0,Math.min(1,(x-L)/W))*span;let best=0,diff=Infinity;points.forEach((p,i)=>{const v=Math.abs(pointDate(p).getTime()-target);if(v<diff){diff=v;best=i}});window.drawTideChart(best)};canvas.onpointerleave=()=>window.drawTideChart();canvas.onclick=e=>canvas.onpointermove(e);
  };
})();
