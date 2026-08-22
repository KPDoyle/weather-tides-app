const DISCOVERY_BASE='https://admiraltyapi.azure-api.net/uktidalapi/api/V1';
const PREMIUM_HEIGHTS_BASE='https://admiraltyapi.azure-api.net/uktidalapi-premium/api/V2';

function haversineKm(lat1,lon1,lat2,lon2){
  const r=6371,toRad=x=>x*Math.PI/180;
  const dLat=toRad(lat2-lat1),dLon=toRad(lon2-lon1);
  const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return 2*r*Math.asin(Math.sqrt(a));
}

function isoUtc(value){
  if(!value)return null;
  const s=String(value);
  if(/[zZ]$|[+-]\d\d:?\d\d$/.test(s))return new Date(s).toISOString();
  return new Date(`${s}Z`).toISOString();
}

async function ukhoFetch(url,key){
  const response=await fetch(url,{headers:{'Ocp-Apim-Subscription-Key':key,'Cache-Control':'no-cache','Accept':'application/json'}});
  const text=await response.text();
  let data;
  try{data=text?JSON.parse(text):null}catch{data={raw:text}}
  if(!response.ok){
    const error=new Error(data?.message||data?.error||`UKHO request failed (${response.status})`);
    error.status=response.status;
    throw error;
  }
  return data;
}

function stationFromFeature(feature){
  const p=feature?.properties||{},coords=feature?.geometry?.coordinates||[];
  const lon=Number(coords[0]),lat=Number(coords[1]);
  return {
    id:String(p.Id??p.ID??p.id??''),
    name:p.Name??p.name??'UKHO tidal station',
    country:p.Country??p.country??'',
    latitude:lat,longitude:lon,
    continuousHeightsAvailable:Boolean(p.ContinuousHeightsAvailable),
    footnote:p.Footnote??''
  };
}

export default async function handler(req,res){
  if(req.method!=='GET'){
    res.setHeader('Allow','GET');
    return res.status(405).json({error:'Method not allowed'});
  }

  const lat=Number(req.query.lat),lon=Number(req.query.lon);
  if(!Number.isFinite(lat)||!Number.isFinite(lon))return res.status(400).json({error:'Valid latitude and longitude are required.'});

  const key=process.env.UKHO_TIDAL_API_KEY;
  const tier=String(process.env.UKHO_TIDAL_API_TIER||'discovery').toLowerCase();
  const heightsBase=process.env.UKHO_TIDAL_HEIGHTS_BASE_URL||(tier==='premium'?PREMIUM_HEIGHTS_BASE:'');
  if(!key){
    res.setHeader('Cache-Control','no-store');
    return res.status(503).json({
      configured:false,
      source:'UK Hydrographic Office / ADMIRALTY',
      officialUrl:'https://easytide.admiralty.co.uk/',
      error:'UKHO Tidal API is not configured. Add UKHO_TIDAL_API_KEY in Vercel.'
    });
  }

  try{
    const collection=await ukhoFetch(`${DISCOVERY_BASE}/Stations/`,key);
    const features=Array.isArray(collection?.features)?collection.features:[];
    const stations=features.map(stationFromFeature).filter(s=>s.id&&Number.isFinite(s.latitude)&&Number.isFinite(s.longitude));
    if(!stations.length)throw new Error('UKHO returned no tidal stations.');

    let station=stations[0],distanceKm=Infinity;
    for(const candidate of stations){
      const d=haversineKm(lat,lon,candidate.latitude,candidate.longitude);
      if(d<distanceKm){station=candidate;distanceKm=d;}
    }

    const eventsRaw=await ukhoFetch(`${DISCOVERY_BASE}/Stations/${encodeURIComponent(station.id)}/TidalEvents?duration=7`,key);
    const events=(Array.isArray(eventsRaw)?eventsRaw:[]).map(e=>({
      date:isoUtc(e.DateTime),
      dt:isoUtc(e.DateTime)?new Date(isoUtc(e.DateTime)).getTime()/1000:null,
      height:Number(e.Height),
      type:e.EventType||''
    })).filter(e=>e.date&&Number.isFinite(e.height));

    let heights=[];
    let intervalSource=null;
    if(heightsBase&&station.continuousHeightsAvailable!==false){
      const start=new Date();
      start.setUTCSeconds(0,0);
      const end=new Date(start.getTime()+30*60*60*1000);
      const fmt=d=>d.toISOString().slice(0,16)+'Z';
      const url=`${heightsBase}/Stations/${encodeURIComponent(station.id)}/TidalHeights?StartDateTime=${encodeURIComponent(fmt(start))}&EndDateTime=${encodeURIComponent(fmt(end))}&IntervalInMinutes=15`;
      try{
        const heightsRaw=await ukhoFetch(url,key);
        heights=(Array.isArray(heightsRaw)?heightsRaw:[]).map(h=>({
          date:isoUtc(h.DateTime),
          dt:isoUtc(h.DateTime)?new Date(isoUtc(h.DateTime)).getTime()/1000:null,
          height:Number(h.Height)
        })).filter(h=>h.date&&Number.isFinite(h.height));
        if(heights.length>1)intervalSource='UKHO interval heights';
      }catch(error){
        console.warn('UKHO interval heights unavailable:',error.message);
      }
    }

    res.setHeader('Cache-Control','no-store');
    return res.status(200).json({
      configured:true,
      source:'UK Hydrographic Office / ADMIRALTY',
      station:{...station,distanceKm:Number(distanceKm.toFixed(1))},
      events,
      heights,
      intervalSource,
      tier,
      timezone:'GMT',
      datum:'Chart Datum',
      officialUrl:`https://easytide.admiralty.co.uk/?PortID=${encodeURIComponent(station.id)}`,
      attribution:'Contains ADMIRALTY® tidal data:\n© Crown Copyright and database right.'
    });
  }catch(error){
    console.error(error);
    res.setHeader('Cache-Control','no-store');
    return res.status(error.status&&error.status<500?error.status:502).json({
      configured:true,
      source:'UK Hydrographic Office / ADMIRALTY',
      officialUrl:'https://easytide.admiralty.co.uk/',
      error:error.message||'Unable to retrieve UKHO tidal data.'
    });
  }
}
