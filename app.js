const $ = (id) => document.getElementById(id);
const state = {
  location: null,
  weather: null,
  marine: null,
  tide: null,
  units: localStorage.getItem('wt-units') || 'metric',
  tideKey: localStorage.getItem('worldtides-key') || ''
};

const WMO = {
  0:['Clear sky','☀'],1:['Mainly clear','🌤'],2:['Partly cloudy','⛅'],3:['Overcast','☁'],
  45:['Fog','🌫'],48:['Rime fog','🌫'],51:['Light drizzle','🌦'],53:['Drizzle','🌦'],55:['Heavy drizzle','🌧'],
  56:['Freezing drizzle','🌧'],57:['Freezing drizzle','🌧'],61:['Light rain','🌦'],63:['Rain','🌧'],65:['Heavy rain','🌧'],
  66:['Freezing rain','🌧'],67:['Freezing rain','🌧'],71:['Light snow','🌨'],73:['Snow','🌨'],75:['Heavy snow','❄'],
  77:['Snow grains','🌨'],80:['Rain showers','🌦'],81:['Rain showers','🌧'],82:['Heavy showers','⛈'],
  85:['Snow showers','🌨'],86:['Heavy snow showers','❄'],95:['Thunderstorm','⛈'],96:['Thunderstorm with hail','⛈'],99:['Severe thunderstorm','⛈']
};

function condition(code){ return WMO[code] || ['Variable','🌤']; }
function compass(deg=0){ const d=['N','NE','E','SE','S','SW','W','NW']; return d[Math.round(deg/45)%8]; }
function fmt(value, digits=0){ return Number.isFinite(value) ? value.toFixed(digits) : '—'; }
function currentIndex(times){
  const now = Date.now();
  let best=0, diff=Infinity;
  times.forEach((t,i)=>{ const x=Math.abs(new Date(t).getTime()-now); if(x<diff){diff=x;best=i;} });
  return best;
}
function unitConfig(){
  return state.units === 'metric'
    ? { temperature_unit:'celsius', wind_speed_unit:'kmh', precipitation_unit:'mm', length_unit:'metric', temp:'°C', wind:'km/h', wave:'m', rain:'mm' }
    : { temperature_unit:'fahrenheit', wind_speed_unit:'mph', precipitation_unit:'inch', length_unit:'imperial', temp:'°F', wind:'mph', wave:'ft', rain:'in' };
}

async function geocode(query){
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=7&language=en&format=json`;
  const r=await fetch(url); if(!r.ok) throw new Error('Location search failed.');
  return (await r.json()).results || [];
}

async function reverseGeocode(lat,lon){
  return { name:'Current location', country:'', latitude:lat, longitude:lon, timezone:'auto' };
}

async function loadLocation(loc){
  state.location=loc;
  setLoading(true);
  try {
    const u=unitConfig();
    const weatherVars='temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,cloud_cover,pressure_msl,visibility,wind_speed_10m,wind_direction_10m,wind_gusts_10m,dew_point_2m,uv_index';
    const dailyVars='weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,sunrise,sunset,uv_index_max,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max';
    const weatherUrl=`https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=${weatherVars}&hourly=${weatherVars}&daily=${dailyVars}&timezone=auto&forecast_days=10&temperature_unit=${u.temperature_unit}&wind_speed_unit=${u.wind_speed_unit}&precipitation_unit=${u.precipitation_unit}`;
    const marineVars='wave_height,wave_direction,wave_period,wind_wave_height,wind_wave_direction,wind_wave_period,swell_wave_height,swell_wave_direction,swell_wave_period,sea_level_height_msl,sea_surface_temperature,ocean_current_velocity,ocean_current_direction';
    const marineUrl=`https://marine-api.open-meteo.com/v1/marine?latitude=${loc.latitude}&longitude=${loc.longitude}&hourly=${marineVars}&current=${marineVars}&timezone=auto&forecast_days=7&length_unit=${u.length_unit}&wind_speed_unit=${u.wind_speed_unit}&cell_selection=sea`;
    const [wr,mr]=await Promise.all([fetch(weatherUrl),fetch(marineUrl)]);
    if(!wr.ok) throw new Error('Weather data is unavailable for this location.');
    state.weather=await wr.json();
    state.marine=mr.ok ? await mr.json() : null;
    state.tide=await loadTideData(loc);
    render();
    $('dashboard').hidden=false;
    $('errorState').hidden=true;
  } catch(err){
    $('dashboard').hidden=true;
    $('errorState').hidden=false;
    $('errorState').textContent=err.message || 'Unable to load forecast.';
  } finally { setLoading(false); }
}

async function loadTideData(loc){
  if(state.tideKey){
    try{
      const r=await fetch('/api/tides', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({lat:loc.latitude,lon:loc.longitude,key:state.tideKey})
      });
      const data=await r.json();
      if(r.ok && data.status===200) return { type:'worldtides', ...data };
    }catch(e){}
  }
  const h=state.marine?.hourly;
  if(!h?.sea_level_height_msl) return {type:'none', heights:[], extremes:[]};
  const heights=h.time.map((time,i)=>({ date:time, dt:new Date(time).getTime()/1000, height:h.sea_level_height_msl[i] })).filter(x=>Number.isFinite(x.height));
  const extremes=[];
  for(let i=1;i<heights.length-1;i++){
    const a=heights[i-1].height,b=heights[i].height,c=heights[i+1].height;
    if(b>a && b>c) extremes.push({...heights[i],type:'High'});
    if(b<a && b<c) extremes.push({...heights[i],type:'Low'});
  }
  return {type:'model', heights, extremes};
}

function setLoading(on){ $('loadingState').hidden=!on; if(on){$('dashboard').hidden=true;$('errorState').hidden=true;} }
function metric(label,value){ return `<div class="metric"><span>${label}</span><strong>${value}</strong></div>`; }

function render(){
  const w=state.weather, c=w.current, u=unitConfig(), loc=state.location;
  const [desc,icon]=condition(c.weather_code);
  $('placeName').textContent=[loc.name,loc.admin1,loc.country].filter(Boolean).join(', ');
  $('coordinates').textContent=`${Number(loc.latitude).toFixed(4)}, ${Number(loc.longitude).toFixed(4)} · ${w.timezone_abbreviation || w.timezone}`;
  $('localTime').textContent=new Intl.DateTimeFormat('en-GB',{weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit',timeZone:w.timezone}).format(new Date());
  $('conditionBadge').textContent=c.is_day ? 'Daylight' : 'Night';
  $('weatherIcon').textContent=icon;
  $('temperature').textContent=`${Math.round(c.temperature_2m)}${u.temp}`;
  $('weatherDescription').textContent=desc;
  $('feelsLike').textContent=`Feels like ${Math.round(c.apparent_temperature)}${u.temp}`;
  $('weatherMetrics').innerHTML=[
    metric('Wind',`${fmt(c.wind_speed_10m)} ${u.wind} ${compass(c.wind_direction_10m)}`), metric('Gusts',`${fmt(c.wind_gusts_10m)} ${u.wind}`),
    metric('Rain',`${fmt(c.precipitation,1)} ${u.rain}`), metric('Humidity',`${fmt(c.relative_humidity_2m)}%`),
    metric('Pressure',`${fmt(c.pressure_msl)} hPa`), metric('Visibility',`${fmt(c.visibility/1000,1)} km`),
    metric('Cloud',`${fmt(c.cloud_cover)}%`), metric('UV index',fmt(c.uv_index,1))
  ].join('');
  renderMarineCurrent(); renderHourly(); renderDaily(); renderMarineForecast(); renderTides();
  $('unitButton').textContent=state.units==='metric'?'°C / km/h':'°F / mph';
}

function renderMarineCurrent(){
  const m=state.marine?.current, u=unitConfig();
  if(!m){ $('marineStatus').textContent='Inland / unavailable'; $('marineMetrics').innerHTML='<p class="muted">No marine grid data was found near this point.</p>'; return; }
  $('marineStatus').textContent='Model forecast';
  $('marineMetrics').innerHTML=[
    metric('Wave height',`${fmt(m.wave_height,1)} ${u.wave}`), metric('Wave period',`${fmt(m.wave_period,1)} s`),
    metric('Wave direction',`${fmt(m.wave_direction)}° ${compass(m.wave_direction)}`), metric('Swell',`${fmt(m.swell_wave_height,1)} ${u.wave}`),
    metric('Sea temperature',`${fmt(m.sea_surface_temperature,1)}${u.temp}`), metric('Current',`${fmt(m.ocean_current_velocity,1)} ${u.wind}`),
    metric('Current direction',`${fmt(m.ocean_current_direction)}° ${compass(m.ocean_current_direction)}`), metric('Sea level',`${fmt(m.sea_level_height_msl,2)} ${u.wave}`)
  ].join('');
}

function renderHourly(){
  const h=state.weather.hourly,u=unitConfig(),start=currentIndex(h.time), end=Math.min(start+24,h.time.length);
  $('hourlyForecast').innerHTML=h.time.slice(start,end).map((t,j)=>{
    const i=start+j,[d,ic]=condition(h.weather_code[i]);
    return `<article class="hour-card ${j===0?'current':''}"><strong>${j===0?'Now':new Date(t).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</strong><div class="hour-icon">${ic}</div><div class="hour-temp">${Math.round(h.temperature_2m[i])}${u.temp}</div><p class="muted">${d}</p><small>Rain ${fmt(h.precipitation[i],1)} ${u.rain}</small></article>`;
  }).join('');
}

function renderDaily(){
  const d=state.weather.daily,u=unitConfig();
  $('dailyForecast').innerHTML=d.time.map((t,i)=>{
    const [desc,ic]=condition(d.weather_code[i]);
    return `<article class="daily-row"><strong>${i===0?'Today':new Date(t+'T12:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric'})}</strong><div class="daily-condition"><span class="hour-icon">${ic}</span><span>${desc}</span></div><span><b>${Math.round(d.temperature_2m_max[i])}${u.temp}</b> / ${Math.round(d.temperature_2m_min[i])}${u.temp}</span><span>☂ ${fmt(d.precipitation_probability_max[i])}%</span><span>Wind ${fmt(d.wind_speed_10m_max[i])}</span><span>UV ${fmt(d.uv_index_max[i],1)}</span></article>`;
  }).join('');
}

function renderMarineForecast(){
  const h=state.marine?.hourly,u=unitConfig();
  if(!h){ $('marineForecast').innerHTML='<p class="muted">Marine data unavailable.</p>'; return; }
  const rows=[];
  for(let i=0;i<h.time.length;i+=6){
    rows.push(`<article class="daily-row"><strong>${new Date(h.time[i]).toLocaleDateString('en-GB',{weekday:'short',day:'numeric'})}<br>${new Date(h.time[i]).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</strong><div class="daily-condition"><span class="hour-icon">≈</span><span>Wave ${fmt(h.wave_height[i],1)} ${u.wave}</span></div><span>Period ${fmt(h.wave_period[i],1)}s</span><span>Swell ${fmt(h.swell_wave_height[i],1)}</span><span>SST ${fmt(h.sea_surface_temperature[i],1)}${u.temp}</span><span>${compass(h.wave_direction[i])}</span></article>`);
  }
  $('marineForecast').innerHTML=rows.join('');
}

function renderTides(){
  const t=state.tide,u=unitConfig(); let heights=t.heights||[], extremes=t.extremes||[];
  if(t.type==='worldtides'){
    $('tideSource').textContent='WorldTides'; $('tideDisclaimer').textContent=t.copyright || 'Tidal predictions supplied by WorldTides.'; $('footerTideCredit').textContent=t.copyright || 'Tides: WorldTides';
  } else if(t.type==='model'){
    $('tideSource').textContent='Sea-level model'; $('tideDisclaimer').textContent='Approximate modelled sea-level height including tides. Coastal accuracy is limited and this is not suitable for navigation.'; $('footerTideCredit').textContent='Tide curve inferred from Open-Meteo sea-level model.';
  } else {
    $('tideSource').textContent='Unavailable'; $('tideDisclaimer').textContent='No tide or sea-level data was available for this location.';
  }
  const now=Date.now()/1000;
  const upcoming=extremes.filter(x=>(x.dt || new Date(x.date).getTime()/1000)>now).slice(0,10);
  $('tideEvents').innerHTML=upcoming.length?upcoming.map(x=>{
    const dt=x.date?new Date(x.date):new Date(x.dt*1000);
    return `<div class="tide-event"><span class="tide-event-icon">${String(x.type).toLowerCase().includes('high')?'↑':'↓'}</span><div><strong>${x.type} water</strong><div class="muted">${dt.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})} · ${dt.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</div></div><strong>${fmt(Number(x.height),2)} ${u.wave}</strong></div>`;
  }).join(''):'<p class="muted">No upcoming extrema found. Add a WorldTides key in settings for dedicated high and low tide events.</p>';
  drawTideChart(heights.slice(0,96));
}

function drawTideChart(points){
  const canvas=$('tideChart'), ctx=canvas.getContext('2d'); const width=canvas.clientWidth*devicePixelRatio,height=300*devicePixelRatio;
  canvas.width=width;canvas.height=height;ctx.clearRect(0,0,width,height);
  if(points.length<2){ ctx.fillStyle='#9eb4c8';ctx.font=`${14*devicePixelRatio}px Manrope`;ctx.fillText('No tide curve available',20*devicePixelRatio,45*devicePixelRatio);return; }
  const pad=32*devicePixelRatio, vals=points.map(p=>Number(p.height)), min=Math.min(...vals),max=Math.max(...vals),range=max-min||1;
  const xy=points.map((p,i)=>[pad+i*(width-pad*2)/(points.length-1),height-pad-(Number(p.height)-min)*(height-pad*2)/range]);
  const grad=ctx.createLinearGradient(0,0,width,0);grad.addColorStop(0,'#5ee7e7');grad.addColorStop(1,'#52b7ff');
  ctx.strokeStyle='rgba(158,180,200,.16)';ctx.lineWidth=1*devicePixelRatio;
  for(let i=0;i<5;i++){const y=pad+i*(height-pad*2)/4;ctx.beginPath();ctx.moveTo(pad,y);ctx.lineTo(width-pad,y);ctx.stroke();}
  ctx.beginPath();ctx.moveTo(xy[0][0],height-pad);xy.forEach(([x,y])=>ctx.lineTo(x,y));ctx.lineTo(xy.at(-1)[0],height-pad);ctx.closePath();
  const fill=ctx.createLinearGradient(0,pad,0,height-pad);fill.addColorStop(0,'rgba(82,183,255,.35)');fill.addColorStop(1,'rgba(82,183,255,.02)');ctx.fillStyle=fill;ctx.fill();
  ctx.beginPath();xy.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.strokeStyle=grad;ctx.lineWidth=3*devicePixelRatio;ctx.stroke();
}

let searchTimer;
$('locationInput').addEventListener('input',()=>{
  clearTimeout(searchTimer); const q=$('locationInput').value.trim(); if(q.length<2){$('suggestions').hidden=true;return;}
  searchTimer=setTimeout(async()=>{
    try{ const items=await geocode(q); $('suggestions').innerHTML=items.map((x,i)=>`<button class="suggestion" data-i="${i}"><strong>${x.name}</strong><br><span class="muted">${[x.admin1,x.country].filter(Boolean).join(', ')}</span></button>`).join(''); $('suggestions').hidden=!items.length; $('suggestions').querySelectorAll('button').forEach((b)=>b.onclick=()=>{const x=items[+b.dataset.i];$('suggestions').hidden=true;$('locationInput').value=x.name;loadLocation(x);}); }catch(e){}
  },280);
});
$('searchForm').addEventListener('submit',async(e)=>{e.preventDefault();const q=$('locationInput').value.trim();if(!q)return;setLoading(true);try{const [loc]=await geocode(q);if(!loc)throw new Error('No matching location found.');$('suggestions').hidden=true;loadLocation(loc);}catch(err){setLoading(false);$('errorState').hidden=false;$('errorState').textContent=err.message;}});
$('locateButton').onclick=()=>navigator.geolocation?.getCurrentPosition(async p=>loadLocation(await reverseGeocode(p.coords.latitude,p.coords.longitude)),()=>{$('errorState').hidden=false;$('errorState').textContent='Location permission was not available. Search manually instead.';},{enableHighAccuracy:true,timeout:10000});
$('unitButton').onclick=()=>{state.units=state.units==='metric'?'imperial':'metric';localStorage.setItem('wt-units',state.units);if(state.location)loadLocation(state.location);};
$('settingsButton').onclick=()=>{$('tideKey').value=state.tideKey;$('settingsDialog').showModal();};
$('saveKeyButton').onclick=()=>{state.tideKey=$('tideKey').value.trim();localStorage.setItem('worldtides-key',state.tideKey);$('settingsDialog').close();if(state.location)loadLocation(state.location);};
$('clearKeyButton').onclick=()=>{$('tideKey').value='';state.tideKey='';localStorage.removeItem('worldtides-key');};
document.querySelectorAll('.tab').forEach(btn=>btn.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));btn.classList.add('active');document.querySelectorAll('.tab-panel').forEach(x=>x.hidden=true);$(`${btn.dataset.tab}Panel`).hidden=false;if(btn.dataset.tab==='tides')setTimeout(()=>renderTides(),0);});
window.addEventListener('resize',()=>{if(state.tide)drawTideChart((state.tide.heights||[]).slice(0,96));});
loadLocation({name:'Cowes',admin1:'England',country:'United Kingdom',latitude:50.7631,longitude:-1.2977,timezone:'Europe/London'});
