export default async function handler(req,res){
  if(req.method!=='POST'){
    res.setHeader('Allow','POST');
    return res.status(405).json({error:'Method not allowed'});
  }
  const {lat,lon}=req.body||{};
  const key=process.env.WORLD_TIDES_API_KEY;
  if(!Number.isFinite(Number(lat))||!Number.isFinite(Number(lon)))return res.status(400).json({error:'Valid latitude and longitude are required.'});
  if(!key)return res.status(503).json({error:'WorldTides is not configured. Add WORLD_TIDES_API_KEY in Vercel.'});
  const params=new URLSearchParams({lat:String(lat),lon:String(lon),key,date:'today',days:'7'});
  try{
    const response=await fetch(`https://www.worldtides.info/api/v3?heights&extremes&localtime&${params}`);
    const data=await response.json();
    res.setHeader('Cache-Control','s-maxage=1800, stale-while-revalidate=3600');
    return res.status(response.ok?200:response.status).json(data);
  }catch(error){return res.status(502).json({error:'Unable to reach WorldTides.'})}
}
