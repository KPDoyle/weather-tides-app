(() => {
  const getState = () => (typeof state !== 'undefined' ? state : null);
  let redrawTimer = null;

  const style = document.createElement('style');
  style.textContent = `
    .kevin-brand{font-size:clamp(25px,4vw,42px);font-weight:800;letter-spacing:-.045em;line-height:1;white-space:nowrap}
    .wind-chart-card{margin-top:16px}.wind-chart-wrap{width:100%;overflow-x:auto;border-radius:18px;background:rgba(0,0,0,.08)}
    #windChart{display:block;width:100%;height:330px;min-width:900px}
    @media(max-width:640px){.kevin-brand{font-size:25px}.topbar{gap:8px}.header-actions{gap:5px}#windChart{height:310px;min-width:1050px}}
  `;
  document.head.appendChild(style);

  const dateOf = p => p?.date ? new Date(p.date) : new Date(Number(p?.dt) * 1000);

  function current48Hours(points) {
    const sorted = (points || [])
      .map(p => ({ ...p, _time: dateOf(p).getTime(), height: Number(p.height) }))
      .filter(p => Number.isFinite(p._time) && Number.isFinite(p.height))
      .sort((a,b) => a._time - b._time);
    if (sorted.length < 2) return sorted;

    const now = Date.now();
    const end = now + 48 * 60 * 60 * 1000;
    let after = sorted.findIndex(p => p._time >= now);
    if (after < 0) after = sorted.length - 1;
    const before = Math.max(0, after - 1);
    let start = after;
    if (Math.abs(sorted[before]._time - now) <= Math.abs(sorted[after]._time - now)) start = before;

    const selected = sorted.slice(start).filter(p => p._time <= end);
    if (selected.length && selected[0]._time < now && selected[1]) {
      const a = selected[0], b = selected[1];
      const fraction = Math.max(0, Math.min(1, (now - a._time) / (b._time - a._time || 1)));
      selected[0] = {
        date: new Date(now).toISOString(),
        dt: now / 1000,
        _time: now,
        height: a.height + (b.height - a.height) * fraction,
        current: true
      };
    }
    return selected;
  }

  function drawWindChart() {
    const canvas = document.getElementById('windChart');
    if (!canvas) return;
    const appState = getState();
    const allHourly = appState?.weather?.hourly || [];
    const now = Date.now();
    const hourly = allHourly
      .filter(x => Number.isFinite(new Date(x.time).getTime()) && new Date(x.time).getTime() >= now - 30 * 60 * 1000)
      .slice(0, 25);

    const ctx = canvas.getContext('2d');
    const ratio = window.devicePixelRatio || 1;
    const cssWidth = Math.max(canvas.clientWidth || 0, 900);
    const cssHeight = 330;
    canvas.width = Math.round(cssWidth * ratio);
    canvas.height = Math.round(cssHeight * ratio);
    canvas.style.height = `${cssHeight}px`;
    const width = canvas.width, height = canvas.height;
    ctx.clearRect(0,0,width,height);

    if (hourly.length < 2) {
      ctx.fillStyle='rgba(255,255,255,.75)';
      ctx.font=`${14*ratio}px -apple-system,system-ui,sans-serif`;
      ctx.fillText('Wind forecast is loading…',24*ratio,48*ratio);
      return;
    }

    const left=58*ratio,right=20*ratio,top=34*ratio,bottom=62*ratio;
    const pw=width-left-right,ph=height-top-bottom;
    const speed=hourly.map(x=>Number.isFinite(Number(x.windSpeed))?Number(x.windSpeed):0);
    const gust=hourly.map(x=>Number.isFinite(Number(x.windGust))?Number(x.windGust):Number(x.windSpeed)||0);
    const max=Math.max(5,...speed,...gust)*1.15;
    const unit = appState?.units === 'metric' ? 'km/h' : 'mph';

    ctx.font=`${10*ratio}px -apple-system,system-ui,sans-serif`;ctx.textBaseline='middle';ctx.textAlign='right';
    for(let i=0;i<=5;i++){
      const v=max-i*max/5,y=top+i*ph/5;
      ctx.strokeStyle='rgba(255,255,255,.15)';ctx.lineWidth=ratio;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(width-right,y);ctx.stroke();
      ctx.fillStyle='rgba(255,255,255,.72)';ctx.fillText(`${Math.round(v)}`,left-7*ratio,y);
    }
    ctx.save();ctx.translate(14*ratio,top+ph/2);ctx.rotate(-Math.PI/2);ctx.textAlign='center';ctx.fillStyle='rgba(255,255,255,.7)';ctx.fillText(unit,0,0);ctx.restore();

    const xAt=i=>left+i*pw/(hourly.length-1), yAt=v=>top+ph-(v/max)*ph;
    const plot=(values,stroke,dash=[])=>{ctx.beginPath();values.forEach((v,i)=>i?ctx.lineTo(xAt(i),yAt(v)):ctx.moveTo(xAt(i),yAt(v)));ctx.strokeStyle=stroke;ctx.lineWidth=3*ratio;ctx.setLineDash(dash.map(x=>x*ratio));ctx.stroke();ctx.setLineDash([])};
    plot(gust,'rgba(255,255,255,.68)',[6,5]);
    plot(speed,'#5ee7e7');

    ctx.textAlign='center';ctx.textBaseline='top';
    hourly.forEach((p,i)=>{
      const d=new Date(p.time);
      const major=i===0 || d.getHours()%2===0;
      if(!major) return;
      const x=xAt(i);
      ctx.strokeStyle='rgba(255,255,255,.08)';ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,top+ph);ctx.stroke();
      ctx.fillStyle='rgba(255,255,255,.84)';ctx.font=`${10*ratio}px -apple-system,system-ui,sans-serif`;
      ctx.fillText(i===0?'Now':d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}),x,top+ph+10*ratio);
    });

    ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillStyle='#5ee7e7';ctx.fillRect(left,10*ratio,18*ratio,3*ratio);ctx.fillStyle='white';ctx.fillText('Wind speed',left+24*ratio,11*ratio);
    ctx.strokeStyle='rgba(255,255,255,.68)';ctx.setLineDash([6*ratio,5*ratio]);ctx.beginPath();ctx.moveTo(left+120*ratio,11*ratio);ctx.lineTo(left+138*ratio,11*ratio);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='white';ctx.fillText('Gusts',left+144*ratio,11*ratio);
    const summary=document.getElementById('windChartSummary');
    if(summary) summary.textContent=`Peak ${Math.round(Math.max(...speed))} ${unit} · Gusts ${Math.round(Math.max(...gust))} ${unit}`;
  }

  const previousDraw = window.drawTideChart;
  if (typeof previousDraw === 'function') {
    window.drawTideChart = function(points){
      const appState = getState();
      const source = Array.isArray(points) && points.length ? points : (appState?.tide?.heights || []);
      return previousDraw(current48Hours(source));
    };
  }

  function redrawAll(){
    const appState = getState();
    drawWindChart();
    if(appState?.tide && typeof window.drawTideChart==='function') window.drawTideChart(appState.tide.heights || []);
  }
  function scheduleRedraw(delay=80){clearTimeout(redrawTimer);redrawTimer=setTimeout(redrawAll,delay)}

  const dashboard = document.getElementById('dashboard');
  if(dashboard) new MutationObserver(()=>scheduleRedraw(100)).observe(dashboard,{childList:true,subtree:true});
  window.addEventListener('resize',()=>scheduleRedraw(120));
  document.querySelector('[data-tab="tides"]')?.addEventListener('click',()=>scheduleRedraw(80));

  function useDeviceLocationByDefault(){
    if(!navigator.geolocation || typeof loadLocation!=='function') return;
    navigator.geolocation.getCurrentPosition(
      pos => loadLocation({name:'Current Location',latitude:pos.coords.latitude,longitude:pos.coords.longitude,timezone:'auto'}),
      () => {},
      {enableHighAccuracy:true,timeout:10000,maximumAge:300000}
    );
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(useDeviceLocationByDefault,250));
  else setTimeout(useDeviceLocationByDefault,250);
  setTimeout(redrawAll,1000);
  setTimeout(redrawAll,2200);
})();