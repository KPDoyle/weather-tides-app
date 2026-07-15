const BASE='https://data.hub.api.metoffice.gov.uk/sitespecific/v0/point';

export default async function handler(req,res){
  if(req.method!=='GET'){
    res.setHeader('Allow','GET');
    return res.status(405).json({error:'Method not allowed'});
  }
  const lat=Number(req.query.lat),lon=Number(req.query.lon);
  const key=process.env.MET_OFFICE_API_KEY;
  if(!Number.isFinite(lat)||!Number.isFinite(lon)) return res.status(400).json({error:'Valid latitude and longitude are required.'});
  if(!key) return res.status(503).json({error:'MET_OFFICE_API_KEY is not configured.'});
  const query=new URLSearchParams({latitude:String(lat),longitude:String(lon)});
  try{
    const headers={apikey:key,accept:'application/json'};
    const [hourlyResponse,dailyResponse]=await Promise.all([
      fetch(`${BASE}/hourly?${query}`,{headers}),
      fetch(`${BASE}/daily?${query}`,{headers})
    ]);
    const hourlyText=await hourlyResponse.text();
    const dailyText=await dailyResponse.text();
    let hourly,daily;
    try{hourly=JSON.parse(hourlyText)}catch{hourly={error:hourlyText}}
    try{daily=JSON.parse(dailyText)}catch{daily={error:dailyText}}
    if(!hourlyResponse.ok||!dailyResponse.ok){
      return res.status(hourlyResponse.ok?dailyResponse.status:hourlyResponse.status).json({
        error:'Met Office DataHub request failed.',hourly,daily
      });
    }
    res.setHeader('Cache-Control','s-maxage=900, stale-while-revalidate=1800');
    return res.status(200).json({provider:'Met Office DataHub',hourly,daily});
  }catch(error){
    return res.status(502).json({error:'Unable to reach Met Office DataHub.'});
  }
}
