(function(){
  const unit=()=> 'm';
  const pointDate=p=>p?.date?new Date(p.date):new Date(Number(p?.dt)*1000);
  const validPoint=p=>Number.isFinite(Number(p?.height))&&Number.isFinite(pointDate(p).getTime());
  const normalise=items=>(items||[]).map(p=>({
    date:p.date||new Date(Number(p.dt)*1000).toISOString(),
    dt:Number(p.dt)||new Date(p.date).getTime()/1000,
    height:Number(p.height),
    type:p.type||p.event||''
  })).filter(validPoint).sort((a,b)=>a.dt-b.dt);

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
    try{
      const params=new URLSearchParams({lat:String(loc.latitude),lon:String(loc.longitude)});
      const response=await fetch(`/api/ukho-tides?${params}`,{headers:{'Accept':'application/json'}});
      const data=await response.json().catch(()=>({}));
      if(!response.ok){
        return {
          type:'UKHO ADMIRALTY',configured:false,heights:[],extremes:[],
          officialUrl:data.officialUrl||'https://easytide.admiralty.co.uk/',
          error:data.error||'Official UKHO tidal data is not configured.'
        };
      }
      return {
        ...data,
        type:'UKHO ADMIRALTY',
        heights:normalise(data.heights),
        extremes:normalise(data.events),
        configured:true
      };
    }catch(error){
      console.warn(error);
      return {
        type:'UKHO ADMIRALTY',configured:false,heights:[],extremes:[],
        officialUrl:'https://easytide.admiralty.co.uk/',
        error:'Unable to reach the UKHO tidal service.'
      };
    }
  };

  function ensureLayout(){
    const canvas=document.getElementById('tideChart');
    if(!canvas||canvas.dataset.ukhoLayout)return canvas;
    canvas.dataset.ukhoLayout='true';
    const card=canvas.closest('.card');

    const toolbar=document.createElement('div');
    toolbar.className='tide-fixed-toolbar';
    toolbar.innerHTML='<strong>Official UKHO tide curve · next 24 hours</strong><span id="tideChartStatus">Loading UKHO tidal data…</span>';
    card?.insertBefore(toolbar,canvas);

    const station=document.createElement('div');
    station.id='ukhoStationMeta';
    station.className='ukho-station-meta';
    station.textContent='Finding nearest UKHO tidal station…';
    card?.insertBefore(station,canvas);

    const readout=document.createElement('div');
    readout.id='tideReadout';
    readout.className='tide-fixed-readout';
    readout.textContent='Move across or tap the curve for exact local time and official predicted height above Chart Datum.';
    canvas.insertAdjacentElement('afterend',readout);

    const attribution=document.createElement('div');
    attribution.id='ukhoAttribution';
    attribution.className='ukho-attribution';
    attribution.innerHTML='Contains ADMIRALTY® tidal data:<br>© Crown Copyright and database right.';
    readout.insertAdjacentElement('afterend',attribution);
    return canvas;
  }

  function updateOfficialLink(tide){
    const url=tide.officialUrl||'https://easytide.admiralty.co.uk/';
    document.querySelectorAll('a[href*="easytide.admiralty.co.uk"]').forEach(a=>a.href=url);
  }

  window.renderTides=function(){
    const tide=state.tide||{type:'UKHO ADMIRALTY',heights:[],extremes:[],configured:false};
    ensureLayout();
    updateOfficialLink(tide);

    const heights=next24Hours(tide.heights),extremes=normalise(tide.extremes);
    state.chartPoints=heights;

    const source=document.getElementById('tideSource'),footer=document.getElementById('footerTideCredit');
    if(source)source.textContent=tide.configured?'UKHO ADMIRALTY · official':'UKHO ADMIRALTY';
    if(footer)footer.textContent='Tides: UK Hydrographic Office / ADMIRALTY';

    const stationMeta=document.getElementById('ukhoStationMeta');
    if(stationMeta){
      if(tide.station){
        const distance=Number.isFinite(Number(tide.station.distanceKm))?` · ${Number(tide.station.distanceKm).toFixed(1)} km from selected point`:'';
        const continuous=tide.heights?.length>1?' · official interval heights':' · official high/low events';
        stationMeta.innerHTML=`<strong>${tide.station.name}</strong> <span>UKHO station ${tide.station.id}${distance}${continuous}</span><small>Heights are metres above Chart Datum. UKHO API source times are GMT; this app displays them in your local time.</small>`;
      }else{
        stationMeta.innerHTML=`<strong>Official UKHO source selected</strong><span>${tide.error||'Connect a UKHO Tidal API subscription to load station data.'}</span><small><a href="${tide.officialUrl||'https://easytide.admiralty.co.uk/'}" target="_blank" rel="noopener">Open ADMIRALTY EasyTide</a> for the official seven-day public tide table and tidal curve.</small>`;
      }
    }

    const events=document.getElementById('tideEvents'),now=Date.now()/1000,upcoming=extremes.filter(x=>x.dt>now).slice(0,8);
    if(events){
      events.innerHTML=upcoming.length?upcoming.map(x=>`<div class="tide-event"><div><strong>${/high/i.test(x.type)?'High':'Low'} water</strong><div class="soft">${pointDate(x).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})} · ${pointDate(x).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</div></div><strong>${x.height.toFixed(2)} m</strong></div>`).join(''):`<div class="ukho-empty"><strong>No UKHO events loaded</strong><span>${tide.error||'The connected UKHO subscription did not return high/low events.'}</span><a href="${tide.officialUrl||'https://easytide.admiralty.co.uk/'}" target="_blank" rel="noopener">View official tides on ADMIRALTY EasyTide</a></div>`;
    }

    const status=document.getElementById('tideChartStatus');
    if(status){
      if(heights.length>1)status.textContent=`${tide.station?.name||'UKHO station'} · ${heights.length} official height points`;
      else if(tide.configured)status.textContent='Official events available · interval curve requires Foundation/Premium height access';
      else status.textContent='UKHO API connection required for in-app official curve';
    }
    window.drawTideChart();
  };

  window.drawTideChart=function(activeIndex=null){
    const canvas=ensureLayout();if(!canvas)return;
    const rect=canvas.getBoundingClientRect(),cssWidth=Math.max(320,Math.round(rect.width||canvas.parentElement?.clientWidth||900)),cssHeight=480,ratio=Math.max(1,window.devicePixelRatio||1);
    canvas.style.width='100%';canvas.style.height=`${cssHeight}px`;canvas.width=Math.round(cssWidth*ratio);canvas.height=Math.round(cssHeight*ratio);
    const ctx=canvas.getContext('2d');ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,cssWidth,cssHeight);
    const points=(state.chartPoints||[]).filter(validPoint);
    if(points.length<2){
      ctx.fillStyle='rgba(255,255,255,.94)';ctx.font='700 17px -apple-system, BlinkMacSystemFont, sans-serif';ctx.fillText('Official UKHO interval tide curve not yet available',24,52);
      ctx.fillStyle='rgba(255,255,255,.68)';ctx.font='13px -apple-system, BlinkMacSystemFont, sans-serif';
      const lines=['High and low water events use the official UKHO API when connected.','For an in-app continuous curve, configure UKHO Foundation/Premium interval-height access.','You can always open ADMIRALTY EasyTide below for the official public tidal curve.'];
      lines.forEach((line,i)=>ctx.fillText(line,24,88+i*25));
      return;
    }

    const L=76,R=28,T=34,B=118,W=cssWidth-L-R,H=cssHeight-T-B,t0=pointDate(points[0]).getTime(),t1=pointDate(points[points.length-1]).getTime(),span=t1-t0||1;
    const values=points.map(p=>p.height),min=Math.min(...values),max=Math.max(...values),padding=Math.max(.05,(max-min)*.08),lo=min-padding,hi=max+padding,range=hi-lo||1;
    const xy=points.map(p=>({x:L+(pointDate(p).getTime()-t0)*W/span,y:T+H-(p.height-lo)*H/range,p}));

    ctx.lineWidth=1;ctx.strokeStyle='rgba(255,255,255,.18)';ctx.fillStyle='rgba(255,255,255,.72)';ctx.font='12px -apple-system, BlinkMacSystemFont, sans-serif';
    for(let i=0;i<6;i++){
      const y=T+i*H/5,val=hi-i*range/5;
      ctx.beginPath();ctx.moveTo(L,y);ctx.lineTo(cssWidth-R,y);ctx.stroke();
      ctx.textAlign='right';ctx.textBaseline='middle';ctx.fillText(`${val.toFixed(2)} m`,L-10,y);
    }

    const tickHours=cssWidth<520?4:cssWidth<780?3:2;
    const firstTick=Math.ceil(t0/(tickHours*3600000))*(tickHours*3600000);
    for(let ts=firstTick;ts<=t1;ts+=tickHours*3600000){
      const x=L+(ts-t0)*W/span;if(x-L<58||cssWidth-R-x<58)continue;
      const d=new Date(ts);
      ctx.beginPath();ctx.moveTo(x,T);ctx.lineTo(x,T+H);ctx.strokeStyle='rgba(255,255,255,.11)';ctx.stroke();
      ctx.fillStyle='rgba(255,255,255,.92)';ctx.textAlign='center';ctx.textBaseline='top';ctx.font='700 12px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText(d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}),x,T+H+12);
      if(d.getHours()===0){ctx.fillStyle='rgba(94,231,231,.95)';ctx.font='700 11px -apple-system, BlinkMacSystemFont, sans-serif';ctx.fillText(d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'}),x,T+H+34)}
    }

    ctx.strokeStyle='rgba(94,231,231,.9)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(L,T);ctx.lineTo(L,T+H);ctx.stroke();
    ctx.fillStyle='#5ee7e7';ctx.textAlign='left';ctx.textBaseline='top';ctx.font='700 12px -apple-system, BlinkMacSystemFont, sans-serif';ctx.fillText('NOW',L+6,T+5);

    const startTime=new Date(t0),endTime=new Date(t1);
    ctx.fillStyle='rgba(255,255,255,.96)';ctx.font='700 12px -apple-system, BlinkMacSystemFont, sans-serif';ctx.textAlign='left';ctx.fillText(startTime.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}),L,T+H+62);
    ctx.fillStyle='rgba(255,255,255,.64)';ctx.font='11px -apple-system, BlinkMacSystemFont, sans-serif';ctx.fillText(startTime.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'}),L,T+H+80);
    ctx.textAlign='right';ctx.fillStyle='rgba(255,255,255,.96)';ctx.font='700 12px -apple-system, BlinkMacSystemFont, sans-serif';ctx.fillText(endTime.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}),cssWidth-R,T+H+62);
    ctx.fillStyle='rgba(255,255,255,.64)';ctx.font='11px -apple-system, BlinkMacSystemFont, sans-serif';ctx.fillText(endTime.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'}),cssWidth-R,T+H+80);

    const fill=ctx.createLinearGradient(0,T,0,T+H);fill.addColorStop(0,'rgba(255,255,255,.35)');fill.addColorStop(1,'rgba(255,255,255,.03)');
    ctx.beginPath();ctx.moveTo(xy[0].x,T+H);xy.forEach(q=>ctx.lineTo(q.x,q.y));ctx.lineTo(xy[xy.length-1].x,T+H);ctx.closePath();ctx.fillStyle=fill;ctx.fill();
    ctx.beginPath();xy.forEach((q,i)=>i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y));ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.stroke();

    if(Number.isInteger(activeIndex)&&xy[activeIndex]){
      const q=xy[activeIndex],d=pointDate(q.p);
      ctx.beginPath();ctx.moveTo(q.x,T);ctx.lineTo(q.x,T+H);ctx.strokeStyle='rgba(255,255,255,.55)';ctx.lineWidth=1;ctx.stroke();
      ctx.beginPath();ctx.arc(q.x,q.y,5,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();
      const readout=document.getElementById('tideReadout');
      if(readout)readout.textContent=`${d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})} ${d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})} · ${q.p.height.toFixed(2)} m above Chart Datum`;
    }

    canvas.onpointermove=e=>{
      const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,target=t0+Math.max(0,Math.min(1,(x-L)/W))*span;
      let best=0,diff=Infinity;points.forEach((p,i)=>{const v=Math.abs(pointDate(p).getTime()-target);if(v<diff){diff=v;best=i}});
      window.drawTideChart(best);
    };
    canvas.onpointerleave=()=>window.drawTideChart();canvas.onclick=e=>canvas.onpointermove(e);
  };

  const style=document.createElement('style');
  style.textContent='.tide-fixed-toolbar{display:flex;justify-content:space-between;gap:14px;margin-bottom:12px;padding:11px 13px;border-radius:14px;background:rgba(255,255,255,.06)}.tide-fixed-toolbar span{font-size:12px;opacity:.72}.ukho-station-meta{display:grid;gap:4px;margin-bottom:12px;padding:13px 14px;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:rgba(255,255,255,.05)}.ukho-station-meta span,.ukho-station-meta small{opacity:.76}.ukho-station-meta a,.ukho-empty a{color:inherit;font-weight:700}.tide-fixed-readout{margin-top:10px;padding:11px 13px;border-radius:13px;background:rgba(255,255,255,.06);font-size:13px}.ukho-attribution{font:12px Arial,sans-serif;line-height:1.4;margin-top:12px;opacity:.88}.ukho-empty{display:grid;gap:8px;padding:14px;border-radius:14px;background:rgba(255,255,255,.05)}#tideChart{display:block;width:100%;min-height:480px}@media(max-width:620px){.tide-fixed-toolbar{flex-direction:column}}';
  document.head.appendChild(style);

  const source=document.getElementById('tideSource');if(source)source.textContent='UKHO ADMIRALTY';
  const footer=document.getElementById('footerTideCredit');if(footer)footer.textContent='Tides: UK Hydrographic Office / ADMIRALTY';

  let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>window.drawTideChart(),120)});
})();
