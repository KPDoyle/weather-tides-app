(() => {
  const style = document.createElement('style');
  style.textContent = `
    .kevin-brand{font-size:clamp(25px,4vw,42px);font-weight:800;letter-spacing:-.045em;line-height:1;white-space:nowrap}
    .wind-chart-card{margin-top:16px}.wind-chart-wrap{width:100%;overflow-x:auto;border-radius:18px;background:rgba(0,0,0,.08)}
    #windChart{display:block;width:100%;height:330px;min-width:760px}
    @media(max-width:640px){.kevin-brand{font-size:25px}.topbar{gap:8px}.header-actions{gap:5px}#windChart{height:310px;min-width:900px}}
  `;
  document.head.appendChild(style);

  const dateOf = p => p?.date ? new Date(p.date) : new Date(Number(p?.dt) * 1000);
  const nowMs = () => Date.now();

  function current24Hours(points) {
    const sorted = (points || [])
      .map(p => ({ ...p, _time: dateOf(p).getTime(), height: Number(p.height) }))
      .filter(p => Number.isFinite(p._time) && Number.isFinite(p.height))
      .sort((a,b) => a._time - b._time);
    if (!sorted.length) return [];
    const now = nowMs();
    let start = sorted.findIndex(p => p._time >= now);
    if (start < 0) start = sorted.length - 1;
    if (start > 0 && Math.abs(sorted[start-1]._time-now) < Math.abs(sorted[start]._time-now)) start -= 1;
    const end = now + 24 * 60 * 60 * 1000;
    return sorted.slice(start).filter(p => p._time <= end);
  }

  function drawWindChart() {
    const canvas = document.getElementById('windChart');
    const hourly = (window.state?.weather?.hourly || []).filter(x => new Date(x.time).getTime() >= nowMs()).slice(0,24);
    if (!canvas || hourly.length < 2) return;
    const ctx = canvas.getContext('2d');
    const ratio = window.devicePixelRatio || 1;
    const cssWidth = Math.max(canvas.clientWidth, 760);
    const cssHeight = 330;
    canvas.width = cssWidth * ratio;
    canvas.height = cssHeight * ratio;
    canvas.style.height = `${cssHeight}px`;
    const width = canvas.width, height = canvas.height;
    ctx.clearRect(0,0,width,height);
    const left=52*ratio,right=18*ratio,top=26*ratio,bottom=58*ratio;
    const pw=width-left-right,ph=height-top-bottom;
    const speed=hourly.map(x=>Number(x.windSpeed)||0),gust=hourly.map(x=>Number(x.windGust)||0);
    const max=Math.max(5,...speed,...gust)*1.15;
    ctx.font=`${10*ratio}px -apple-system,system-ui,sans-serif`;ctx.textBaseline='middle';ctx.textAlign='right';
    for(let i=0;i<=5;i++){
      const v=max-i*max/5,y=top+i*ph/5;
      ctx.strokeStyle='rgba(255,255,255,.15)';ctx.lineWidth=ratio;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(width-right,y);ctx.stroke();
      ctx.fillStyle='rgba(255,255,255,.72)';ctx.fillText(`${Math.round(v)}`,left-7*ratio,y);
    }
    const xAt=i=>left+i*pw/(hourly.length-1), yAt=v=>top+ph-(v/max)*ph;
    const plot=(values,stroke,dash=[])=>{ctx.beginPath();values.forEach((v,i)=>i?ctx.lineTo(xAt(i),yAt(v)):ctx.moveTo(xAt(i),yAt(v)));ctx.strokeStyle=stroke;ctx.lineWidth=3*ratio;ctx.setLineDash(dash.map(x=>x*ratio));ctx.stroke();ctx.setLineDash([])};
    plot(gust,'rgba(255,255,255,.6)',[6,5]);
    plot(speed,'#5ee7e7');
    const every=cssWidth<700?2:1;
    ctx.textAlign='center';ctx.textBaseline='top';
    hourly.forEach((p,i)=>{
      if(i%every) return;
      const x=xAt(i),d=new Date(p.time);
      ctx.strokeStyle='rgba(255,255,255,.08)';ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,top+ph);ctx.stroke();
      ctx.fillStyle='rgba(255,255,255,.82)';ctx.fillText(d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}),x,top+ph+10*ratio);
    });
    ctx.textAlign='left';ctx.fillStyle='#5ee7e7';ctx.fillRect(left,8*ratio,18*ratio,3*ratio);ctx.fillStyle='white';ctx.fillText('Wind speed',left+24*ratio,10*ratio);
    ctx.strokeStyle='rgba(255,255,255,.65)';ctx.setLineDash([6*ratio,5*ratio]);ctx.beginPath();ctx.moveTo(left+115*ratio,10*ratio);ctx.lineTo(left+133*ratio,10*ratio);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='white';ctx.fillText('Gusts',left+139*ratio,10*ratio);
    const unit = window.state?.units === 'metric' ? 'km/h' : 'mph';
    const summary=document.getElementById('windChartSummary');
    if(summary) summary.textContent=`Peak ${Math.round(Math.max(...speed))} ${unit} · Gusts ${Math.round(Math.max(...gust))} ${unit}`;
  }

  const previousDraw = window.drawTideChart;
  window.drawTideChart = function(points){
    const source = Array.isArray(points) && points.length ? points : (window.state?.tide?.heights || []);
    return previousDraw(current24Hours(source));
  };

  function redrawAll(){
    drawWindChart();
    if(window.state?.tide) window.drawTideChart(window.state.tide.heights || []);
  }

  const observer = new MutationObserver(() => setTimeout(redrawAll, 50));
  const dashboard = document.getElementById('dashboard');
  if(dashboard) observer.observe(dashboard,{attributes:true,subtree:true,childList:true});
  window.addEventListener('resize',()=>setTimeout(redrawAll,80));
  document.querySelector('[data-tab="tides"]')?.addEventListener('click',()=>setTimeout(redrawAll,60));

  function useDeviceLocationByDefault(){
    if(!navigator.geolocation || typeof window.loadLocation!=='function') return;
    navigator.geolocation.getCurrentPosition(
      pos => window.loadLocation({
        name:'Current Location',
        latitude:pos.coords.latitude,
        longitude:pos.coords.longitude,
        timezone:'auto'
      }),
      () => {},
      {enableHighAccuracy:true,timeout:10000,maximumAge:300000}
    );
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(useDeviceLocationByDefault,250));
  else setTimeout(useDeviceLocationByDefault,250);
  setTimeout(redrawAll,1400);
})();