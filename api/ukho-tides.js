const BASE='https://admiraltyapi.azure-api.net/uktidalapi/api/V1';

const rad=d=>d*Math.PI/180;
const distanceKm=(a,b,c,d)=>{
  const R=6371,dp=rad(c-a),dl=rad(d-b),x=Math.sin(dp/2)**2+Math.cos(rad(a))*Math.cos(rad(c))*Math.sin(dl/2)**2;
  return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
};
const stationFromFeature=f=>{
  const p=f?.properties||{},coords=f?.geometry?.coordinates||[];
  return {
    id:String(p.Id??p.ID??p.StationId??p.stationId??''),
    name:p.Name??p.name??'ADMIRALTY tidal station',
    country:p.Country??p.country??'',
    continuousHeightsAvailable:Boolean(p.ContinuousHeightsAvailable),
    longitude:Number(coords[0]),
    latitude:Number(coords[1])
  };
};

module.exports=async function handler(req,res){
  const lat=Number(req.query.lat),lon=Number(req.query.lon),key=process.env.UKHO_TIDAL_API_KEY;
  if(!Number.isFinite(lat)||!Number.isFinite(lon))return res.status(400).json({error:'Valid latitude and longitude are required.'});
  if(!key){
    return res.status(200).json({
      configured:false,
      source:'ADMIRALTY UK Tidal API / EasyTide',
      easyTideUrl:'https://easytide.admiralty.co.uk/',
      message:'ADMIRALTY UK Tidal API subscription key is not configured.',
      required:['UKHO_TIDAL_API_KEY']
    });
  }
  const headers={'Ocp-Apim-Subscription-Key':key,Accept:'application/json'};
  try{
    const sr=await fetch(`${BASE}/Stations/`,{headers,cache:'no-store'});
    const st=await sr.text();
    if(!sr.ok)return res.status(sr.status).json({configured:true,error:'UKHO station request failed.',detail:st.slice(0,500),easyTideUrl:'https://easytide.admiralty.co.uk/'});
    const raw=JSON.parse(st),features=raw?.features||[];
    const stations=features.map(stationFromFeature).filter(s=>s.id&&Number.isFinite(s.latitude)&&Number.isFinite(s.longitude));
    if(!stations.length)return res.status(502).json({configured:true,error:'UKHO returned no tidal stations.',easyTideUrl:'https://easytide.admiralty.co.uk/'});
    let nearest=null,best=Infinity;
    for(const s of stations){
      const d=distanceKm(lat,lon,s.latitude,s.longitude);
      if(d<best){best=d;nearest=s;}
    }
    const duration=Math.max(1,Math.min(7,Number(req.query.duration)||7));
    const er=await fetch(`${BASE}/Stations/${encodeURIComponent(nearest.id)}/TidalEvents?duration=${duration}`,{headers,cache:'no-store'});
    const et=await er.text();
    if(!er.ok)return res.status(er.status).json({configured:true,error:'UKHO tidal event request failed.',detail:et.slice(0,500),station:{...nearest,distanceKm:Number(best.toFixed(1))},easyTideUrl:`https://easytide.admiralty.co.uk/?PortID=${encodeURIComponent(nearest.id)}`});
    const payload=JSON.parse(et);
    const events=(Array.isArray(payload)?payload:payload?.events||[]).map(e=>({
      dateTime:e.DateTime??e.dateTime,
      eventType:e.EventType??e.eventType,
      height:Number(e.Height??e.height)
    })).filter(e=>e.dateTime&&Number.isFinite(e.height));
    res.setHeader('Cache-Control','no-store');
    return res.status(200).json({
      configured:true,
      source:'ADMIRALTY UK Tidal API',
      station:{...nearest,distanceKm:Number(best.toFixed(1))},
      events,
      datum:'Chart Datum',
      timeReference:'GMT',
      easyTideUrl:`https://easytide.admiralty.co.uk/?PortID=${encodeURIComponent(nearest.id)}`,
      attribution:'Contains ADMIRALTY® tidal data: © Crown Copyright and database right.'
    });
  }catch(error){
    return res.status(502).json({configured:true,error:'Unable to contact the ADMIRALTY UK Tidal API.',detail:error.message,easyTideUrl:'https://easytide.admiralty.co.uk/'});
  }
};
