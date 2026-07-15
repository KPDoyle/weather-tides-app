// Open-Meteo weather + WorldTides tide integration.
(function(){
  window.loadWeather=async function(loc){
    const metric=state.units==='metric';
    const params=new URLSearchParams({
      latitude:String(loc.latitude),longitude:String(loc.longitude),
      current:'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,cloud_cover,pressure_msl,visibility,wind_speed_10m,wind_direction_10m,wind_gusts_10m,uv_index,is_day',
      hourly:'temperature_2m,apparent_temperature,precipitation_probability,precipitation,rain,weather_code,cloud_cover,visibility,wind_speed_10m,wind_direction_10m,wind_gusts_10m,relative_humidity_2m,pressure_msl,uv_index',
      daily:'weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,sunrise,sunset,uv_index_max,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max',
      timezone:'auto',forecast_days:'10',temperature_unit:metric?'celsius':'fahrenheit',wind_speed_unit:metric?'kmh':'mph',precipitation_unit:metric?'mm':'inch'
    });
    const r=await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if(!r.ok)throw new Error('Open-Meteo weather is unavailable.');
    const x=await r.json(),c=x.current,h=x.hourly,d=x.daily;
    return{source:'Open-Meteo',timezone:x.timezone,current:{temperature:c.temperature_2m,temperatureApparent:c.apparent_temperature,weather_code:c.weather_code,isDaylight:!!c.is_day,humidity:(c.relative_humidity_2m||0)/100,pressure:c.pressure_msl,visibility:c.visibility,windSpeed:c.wind_speed_10m,windGust:c.wind_gusts_10m,windDirection:c.wind_direction_10m,uvIndex:c.uv_index,precipitationIntensity:c.precipitation},hourly:h.time.map((t,i)=>({time:t,temperature:h.temperature_2m[i],temperatureApparent:h.apparent_temperature[i],precipitationChance:(h.precipitation_probability[i]||0)/100,precipitationAmount:h.precipitation[i],weather_code:h.weather_code[i],windSpeed:h.wind_speed_10m[i],windGust:h.wind_gusts_10m[i],windDirection:h.wind_direction_10m[i],humidity:(h.relative_humidity_2m[i]||0)/100,pressure:h.pressure_msl[i],visibility:h.visibility[i],uvIndex:h.uv_index[i]})),daily:d.time.map((t,i)=>({time:t,temperatureMax:d.temperature_2m_max[i],temperatureMin:d.temperature_2m_min[i],temperatureApparentMax:d.apparent_temperature_max[i],temperatureApparentMin:d.apparent_temperature_min[i],weather_code:d.weather_code[i],sunrise:d.sunrise[i],sunset:d.sunset[i],uvIndexMax:d.uv_index_max[i],precipitationChance:(d.precipitation_probability_max[i]||0)/100,precipitationAmount:d.precipitation_sum[i],windSpeedMax:d.wind_speed_10m_max[i],windGustMax:d.wind_gusts_10m_max[i]})),attribution:'Weather data: Open-Meteo'};
  };

  function marineFallback(marine){
    const h=marine?.hourly;
    if(!h?.time?.length||!h?.sea_level_height_msl?.length)return{type:'Tide data unavailable',heights:[],extremes:[]};
    const heights=h.time.map((t,i)=>({date:t,dt:new Date(t).getTime()/1000,height:Number(h.sea_level_height_msl[i])})).filter(x=>Number.isFinite(x.height));
    const extremes=[];
    for(let i=1;i<heights.length-1;i++){
      const a=heights[i-1].height,b=heights[i].height,c=heights[i+1].height;
      if(b>a&&b>c)extremes.push({...heights[i],type:'High'});
      if(b<a&&b<c)extremes.push({...heights[i],type:'Low'});
    }
    return{type:'Open-Meteo sea-level fallback',heights,extremes};
  }

  window.loadTides=async function(loc,marine){
    try{
      const r=await fetch('/api/tides',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lat:loc.latitude,lon:loc.longitude})});
      const x=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(x.error||'WorldTides request failed.');
      const heights=(x.heights||[]).map(p=>({date:p.date,dt:Number(p.dt)||new Date(p.date).getTime()/1000,height:Number(p.height)})).filter(p=>Number.isFinite(p.height)&&Number.isFinite(p.dt));
      const extremes=(x.extremes||[]).map(p=>({date:p.date,dt:Number(p.dt)||new Date(p.date).getTime()/1000,height:Number(p.height),type:p.type||p.event||''})).filter(p=>Number.isFinite(p.height)&&Number.isFinite(p.dt));
      if(heights.length<2)throw new Error('WorldTides returned no height series.');
      return{type:'WorldTides',...x,heights,extremes};
    }catch(error){
      console.warn('WorldTides unavailable; using sea-level fallback.',error);
      return marineFallback(marine);
    }
  };

  const settings=document.getElementById('settingsButton'),save=document.getElementById('saveKeyButton'),dialog=document.getElementById('settingsDialog');
  if(settings)settings.onclick=()=>dialog.showModal();
  if(save)save.onclick=()=>dialog.close();

  // app.js starts its first request before this override file loads. Refresh once
  // after both scripts are ready so the corrected tide provider and chart are used.
  window.addEventListener('load',()=>setTimeout(()=>{
    if(state?.location&&typeof loadLocation==='function')loadLocation(state.location);
  },300));
})();