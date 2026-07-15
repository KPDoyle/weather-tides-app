// Provider overrides: Met Office DataHub weather + WorldTides tides.
(function(){
  const firstFeature=x=>x?.features?.[0]?.properties||x?.properties||x||{};
  const series=x=>{const p=firstFeature(x);return p.timeSeries||p.timeseries||p.data||[]};
  const num=(o,...keys)=>{for(const k of keys){const v=o?.[k];if(v!==undefined&&v!==null&&v!==''){const n=Number(v);if(Number.isFinite(n))return n}}};
  const val=(o,...keys)=>{for(const k of keys)if(o?.[k]!==undefined&&o?.[k]!==null)return o[k]};
  const metCode=c=>{c=Number(c);if([0,1].includes(c))return'Clear';if([2,3].includes(c))return'PartlyCloudy';if([5,6,7,8].includes(c))return'Cloudy';if([9,10,11,12].includes(c))return'Drizzle';if([13,14,15,16,17,18,19,20].includes(c))return'Rain';if([21,22,23,24,25,26,27].includes(c))return'Snow';if(c>=28)return'Thunderstorms';return'Cloudy'};
  const iso=x=>val(x,'time','forecastTime','forecastStart','date','validTime')||new Date().toISOString();
  window.loadWeather=async function(loc){
    const r=await fetch(`/api/metoffice?lat=${encodeURIComponent(loc.latitude)}&lon=${encodeURIComponent(loc.longitude)}`);
    const body=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(body.error||'Met Office weather is unavailable. Add MET_OFFICE_API_KEY in Vercel.');
    const hs=series(body.hourly),ds=series(body.daily);
    if(!hs.length)throw new Error('Met Office returned no hourly forecast for this location.');
    const now=hs[0],conditionCode=metCode(num(now,'significantWeatherCode','weatherCode'));
    const hourly=hs.map(x=>({time:iso(x),temperature:num(x,'screenTemperature','temperature','airTemperature'),temperatureApparent:num(x,'feelsLikeTemperature','feelsLike','apparentTemperature'),conditionCode:metCode(num(x,'significantWeatherCode','weatherCode')),precipitationChance:(num(x,'probOfPrecipitation','precipitationProbability')||0)/100,precipitationAmount:num(x,'totalPrecipAmount','precipitationAmount','precipitationRate')||0,windSpeed:num(x,'windSpeed10m','windSpeed','10mWindSpeed')||0}));
    const daily=ds.map(x=>({time:iso(x),temperatureMax:num(x,'dayMaxScreenTemperature','maxScreenAirTemp','temperatureMax','maxTemperature'),temperatureMin:num(x,'nightMinScreenTemperature','minScreenAirTemp','temperatureMin','minTemperature'),conditionCode:metCode(num(x,'daySignificantWeatherCode','significantWeatherCode','weatherCode')),precipitationChance:(num(x,'dayProbabilityOfPrecipitation','probOfPrecipitation','precipitationProbability')||0)/100,uvIndexMax:num(x,'maxUvIndex','uvIndex'),sunrise:val(x,'sunrise'),sunset:val(x,'sunset')}));
    if(!daily.length){
      const groups={};hourly.forEach(x=>{const k=x.time.slice(0,10);(groups[k]||(groups[k]=[])).push(x)});
      Object.entries(groups).slice(0,10).forEach(([k,a])=>daily.push({time:k,temperatureMax:Math.max(...a.map(x=>x.temperature)),temperatureMin:Math.min(...a.map(x=>x.temperature)),conditionCode:a[Math.floor(a.length/2)]?.conditionCode||'Cloudy',precipitationChance:Math.max(...a.map(x=>x.precipitationChance||0))}));
    }
    return{source:'Met Office',timezone:loc.timezone||'Europe/London',current:{temperature:num(now,'screenTemperature','temperature','airTemperature'),temperatureApparent:num(now,'feelsLikeTemperature','feelsLike','apparentTemperature'),conditionCode,isDaylight:true,humidity:(num(now,'screenRelativeHumidity','relativeHumidity')||0)/100,pressure:num(now,'mslp','meanSeaLevelPressure'),visibility:num(now,'visibility')||0,windSpeed:num(now,'windSpeed10m','windSpeed')||0,windGust:num(now,'windGustSpeed10m','windGust')||0,windDirection:num(now,'windDirectionFrom10m','windDirection')||0,uvIndex:num(now,'uvIndex')||0,precipitationIntensity:num(now,'precipitationRate','totalPrecipAmount')||0},hourly,daily,attribution:'Weather data: Met Office DataHub'};
  };
  window.loadTides=async function(loc){
    const r=await fetch('/api/tides',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lat:loc.latitude,lon:loc.longitude})});
    const x=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(x.error||'WorldTides data is unavailable. Add WORLD_TIDES_API_KEY in Vercel.');
    return{type:'WorldTides',...x};
  };
})();
