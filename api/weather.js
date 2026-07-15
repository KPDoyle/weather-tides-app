const BASE='https://data.hub.api.metoffice.gov.uk/sitespecific/v0/point';
const feature=x=>x?.features?.[0]?.properties||x?.properties||x||{};
const series=x=>{const p=feature(x);return p.timeSeries||p.timeseries||p.data||[]};
const n=(o,...keys)=>{for(const k of keys){const v=o?.[k];if(v!==undefined&&v!==null&&v!==''){const x=Number(v);if(Number.isFinite(x))return x}}};
const v=(o,...keys)=>{for(const k of keys)if(o?.[k]!==undefined&&o?.[k]!==null)return o[k]};
const iso=o=>v(o,'time','forecastTime','forecastStart','date','validTime')||new Date().toISOString();
const condition=c=>{c=Number(c);if([0,1].includes(c))return'Clear';if([2,3].includes(c))return'PartlyCloudy';if([5,6,7,8].includes(c))return'Cloudy';if([9,10,11,12].includes(c))return'Drizzle';if(c>=13&&c<=20)return'Rain';if(c>=21&&c<=27)return'Snow';if(c>=28)return'Thunderstorms';return'Cloudy'};

module.exports=async function handler(req,res){
  const lat=Number(req.query.lat),lon=Number(req.query.lon),key=process.env.MET_OFFICE_API_KEY;
  if(!Number.isFinite(lat)||!Number.isFinite(lon))return res.status(400).json({error:'Valid latitude and longitude are required.'});
  if(!key)return res.status(503).json({error:'Met Office DataHub is not configured',required:['MET_OFFICE_API_KEY']});
  const q=new URLSearchParams({latitude:String(lat),longitude:String(lon)}),headers={apikey:key,accept:'application/json'};
  try{
    const [hr,dr]=await Promise.all([fetch(`${BASE}/hourly?${q}`,{headers}),fetch(`${BASE}/daily?${q}`,{headers})]);
    const ht=await hr.text(),dt=await dr.text();
    if(!hr.ok||!dr.ok)return res.status(hr.ok?dr.status:hr.status).json({error:'Met Office DataHub request failed',detail:(hr.ok?dt:ht).slice(0,500)});
    const hs=series(JSON.parse(ht)),ds=series(JSON.parse(dt));
    if(!hs.length)return res.status(502).json({error:'Met Office returned no hourly forecast.'});
    const current=hs[0];
    const hours=hs.map(x=>({forecastStart:iso(x),temperature:n(x,'screenTemperature','temperature','airTemperature'),temperatureApparent:n(x,'feelsLikeTemperature','feelsLike','apparentTemperature'),conditionCode:condition(n(x,'significantWeatherCode','weatherCode')),precipitationChance:(n(x,'probOfPrecipitation','precipitationProbability')||0)/100,precipitationAmount:n(x,'totalPrecipAmount','precipitationAmount','precipitationRate')||0,windSpeed:n(x,'windSpeed10m','windSpeed','10mWindSpeed')||0}));
    let days=ds.map(x=>({forecastStart:iso(x),temperatureMax:n(x,'dayMaxScreenTemperature','maxScreenAirTemp','temperatureMax','maxTemperature'),temperatureMin:n(x,'nightMinScreenTemperature','minScreenAirTemp','temperatureMin','minTemperature'),conditionCode:condition(n(x,'daySignificantWeatherCode','significantWeatherCode','weatherCode')),precipitationChance:(n(x,'dayProbabilityOfPrecipitation','probOfPrecipitation','precipitationProbability')||0)/100,uvIndexMax:n(x,'maxUvIndex','uvIndex'),sunrise:v(x,'sunrise'),sunset:v(x,'sunset')}));
    if(!days.length){const g={};hours.forEach(x=>{const k=x.forecastStart.slice(0,10);(g[k]||(g[k]=[])).push(x)});days=Object.entries(g).slice(0,10).map(([k,a])=>({forecastStart:k,temperatureMax:Math.max(...a.map(x=>x.temperature)),temperatureMin:Math.min(...a.map(x=>x.temperature)),conditionCode:a[Math.floor(a.length/2)]?.conditionCode||'Cloudy',precipitationChance:Math.max(...a.map(x=>x.precipitationChance||0))}))}
    res.setHeader('Cache-Control','s-maxage=900, stale-while-revalidate=1800');
    return res.status(200).json({timezone:req.query.timezone&&req.query.timezone!=='auto'?req.query.timezone:'Europe/London',currentWeather:{temperature:n(current,'screenTemperature','temperature','airTemperature'),temperatureApparent:n(current,'feelsLikeTemperature','feelsLike','apparentTemperature'),conditionCode:condition(n(current,'significantWeatherCode','weatherCode')),daylight:true,humidity:(n(current,'screenRelativeHumidity','relativeHumidity')||0)/100,pressure:n(current,'mslp','meanSeaLevelPressure'),visibility:n(current,'visibility')||0,windSpeed:n(current,'windSpeed10m','windSpeed')||0,windGust:n(current,'windGustSpeed10m','windGust')||0,windDirection:n(current,'windDirectionFrom10m','windDirection')||0,uvIndex:n(current,'uvIndex')||0,precipitationIntensity:n(current,'precipitationRate','totalPrecipAmount')||0},forecastHourly:{hours},forecastDaily:{days},attribution:'Weather data: Met Office DataHub'});
  }catch(error){return res.status(502).json({error:'Unable to contact Met Office DataHub',detail:error.message})}
};
