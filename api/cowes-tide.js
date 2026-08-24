const SOURCE='https://www.cowes.co.uk/harbour-information/weather-tide-information/';

const decode=s=>String(s||'').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&#8211;|&ndash;/gi,'-').replace(/&#8722;/gi,'-');
const plain=html=>decode(html).replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();

function londonEpoch(day,month,year,hour,minute){
  const y=year<100?2000+year:year;
  const approx=Date.UTC(y,month-1,day,hour,minute,0);
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(approx));
  const o={};for(const p of parts)if(p.type!=='literal')o[p.type]=Number(p.value);
  const displayedAsUtc=Date.UTC(o.year,o.month-1,o.day,o.hour,o.minute,0);
  const offset=displayedAsUtc-approx;
  return approx-offset;
}

module.exports=async function handler(req,res){
  try{
    const r=await fetch(SOURCE,{headers:{'User-Agent':'Boaty-McBoatface/1.0 (+https://weather-tides-app.vercel.app)','Accept':'text/html'}});
    if(!r.ok)return res.status(502).json({error:'Cowes Harbour tide page unavailable.',status:r.status,sourceUrl:SOURCE});
    const text=plain(await r.text());
    const section=text.match(/Tide Heights\s+Observed:\s*(-?\d+(?:\.\d+)?)\s*m\s+Predicted:\s*(-?\d+(?:\.\d+)?)\s*m\s+Surge:\s*(-?\d+(?:\.\d+)?)\s*m\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+(\d{1,2}):(\d{2})/i);
    if(!section)return res.status(502).json({error:'Could not read Cowes Harbour tide values.',sourceUrl:SOURCE});
    const [,observed,predicted,surge,dd,mm,yy,hh,min]=section;
    const epoch=londonEpoch(Number(dd),Number(mm),Number(yy),Number(hh),Number(min));
    const ageMinutes=Math.max(0,(Date.now()-epoch)/60000);
    res.setHeader('Cache-Control','s-maxage=60, stale-while-revalidate=180');
    return res.status(200).json({
      source:'Cowes Harbour Commission',
      station:'Shepards Marina, Cowes',
      observed:Number(observed),
      predicted:Number(predicted),
      surge:Number(surge),
      unit:'m',
      datum:'Cowes Harbour published tide-height reference',
      timestamp:new Date(epoch).toISOString(),
      localTimestamp:`${String(dd).padStart(2,'0')}/${String(mm).padStart(2,'0')}/${String(yy).padStart(2,'0')} ${String(hh).padStart(2,'0')}:${min}`,
      ageMinutes:Number(ageMinutes.toFixed(1)),
      fresh:ageMinutes<=120,
      sourceUrl:SOURCE,
      note:'Cowes Harbour states this information is for guidance only and should be used with other meteorological and tidal information.'
    });
  }catch(error){return res.status(502).json({error:'Unable to retrieve Cowes Harbour tide data.',detail:error.message,sourceUrl:SOURCE});}
};
