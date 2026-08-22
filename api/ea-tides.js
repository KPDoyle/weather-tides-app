const EA_ROOT='https://environment.data.gov.uk/flood-monitoring';

function haversineKm(lat1,lon1,lat2,lon2){
  const R=6371,toRad=x=>x*Math.PI/180;
  const dLat=toRad(lat2-lat1),dLon=toRad(lon2-lon1);
  const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(a));
}

function stationId(station){
  const uri=station?.['@id']||'';
  return String(uri).split('/').filter(Boolean).pop()||station?.stationReference||'';
}

export default async function handler(req,res){
  if(req.method!=='GET'){
    res.setHeader('Allow','GET');
    return res.status(405).json({error:'Method not allowed'});
  }

  const lat=Number(req.query.lat),lon=Number(req.query.lon);
  if(!Number.isFinite(lat)||!Number.isFinite(lon))return res.status(400).json({error:'Valid latitude and longitude are required.'});

  try{
    const stationsUrl=`${EA_ROOT}/id/stations?type=TideGauge&unitName=mAOD&_view=full&_limit=100`;
    const stationsResponse=await fetch(stationsUrl,{headers:{Accept:'application/json'}});
    if(!stationsResponse.ok)throw new Error(`Environment Agency station request failed (${stationsResponse.status})`);
    const stationsData=await stationsResponse.json();
    const stations=(stationsData.items||[]).filter(s=>Number.isFinite(Number(s.lat))&&Number.isFinite(Number(s.long)));
    if(!stations.length)throw new Error('No Environment Agency tide gauges were returned.');

    let nearest=null,distanceKm=Infinity;
    for(const station of stations){
      const d=haversineKm(lat,lon,Number(station.lat),Number(station.long));
      if(d<distanceKm){nearest=station;distanceKm=d;}
    }

    const id=stationId(nearest);
    if(!id)throw new Error('The nearest Environment Agency tide gauge had no station identifier.');

    const measuresResponse=await fetch(`${EA_ROOT}/id/stations/${encodeURIComponent(id)}/measures`,{headers:{Accept:'application/json'}});
    const measuresData=measuresResponse.ok?await measuresResponse.json():{items:[]};
    const measures=measuresData.items||[];
    const measure=measures.find(m=>m.unitName==='mAOD')||measures[0]||null;

    const readingsResponse=await fetch(`${EA_ROOT}/id/stations/${encodeURIComponent(id)}/readings?_sorted&_limit=100`,{headers:{Accept:'application/json'}});
    const readingsData=readingsResponse.ok?await readingsResponse.json():{items:[]};
    const readings=(readingsData.items||[])
      .filter(r=>Number.isFinite(Number(r.value))&&r.dateTime)
      .map(r=>({dateTime:r.dateTime,value:Number(r.value)}))
      .sort((a,b)=>new Date(a.dateTime)-new Date(b.dateTime));

    const latest=measure?.latestReading&&Number.isFinite(Number(measure.latestReading.value))
      ? {dateTime:measure.latestReading.dateTime,value:Number(measure.latestReading.value)}
      : readings.at(-1)||null;

    res.setHeader('Cache-Control','s-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({
      source:'Environment Agency National Tide Gauge Network',
      station:{
        id,
        reference:nearest.stationReference||id,
        label:nearest.label||id,
        latitude:Number(nearest.lat),
        longitude:Number(nearest.long),
        distanceKm:Number(distanceKm.toFixed(1)),
        town:nearest.town||'',
        riverName:nearest.riverName||''
      },
      unit:measure?.unitName||'mAOD',
      datum:'Ordnance Datum Newlyn',
      latest,
      readings,
      attribution:'This uses Environment Agency tide gauge data from the real-time data API (Beta).',
      licence:'Open Government Licence v3.0',
      documentation:'https://environment.data.gov.uk/flood-monitoring/doc/tidegauge'
    });
  }catch(error){
    console.error(error);
    res.setHeader('Cache-Control','no-store');
    return res.status(502).json({error:error.message||'Unable to retrieve Environment Agency tide gauge data.'});
  }
}
