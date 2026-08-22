const slug=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const distance=(a,b,c,d)=>{const r=6371,p=x=>x*Math.PI/180,q1=p(a),q2=p(c),dq=p(c-a),dl=p(d-b),h=Math.sin(dq/2)**2+Math.cos(q1)*Math.cos(q2)*Math.sin(dl/2)**2;return 2*r*Math.asin(Math.sqrt(h))};

const SOLENT=[
  {name:'Cowes',lat:50.7631,lon:-1.2977,path:'england/isle-of-wight/cowes'},
  {name:'Yarmouth',lat:50.7058,lon:-1.4998,path:'england/isle-of-wight/yarmouth'},
  {name:'Ryde',lat:50.7299,lon:-1.1621,path:'england/isle-of-wight/ryde'},
  {name:'Bembridge Harbour',lat:50.6923,lon:-1.0835,path:'england/isle-of-wight/bembridge-harbour'},
  {name:'Hurst Point',lat:50.7077,lon:-1.5504,path:'england/isle-of-wight/hurst-point'},
  {name:'Totland Bay',lat:50.6837,lon:-1.5367,path:'england/isle-of-wight/totland-bay'},
  {name:'Freshwater Bay',lat:50.6683,lon:-1.5150,path:'england/isle-of-wight/freshwater-bay'},
  {name:'Ventnor',lat:50.5955,lon:-1.2064,path:'england/isle-of-wight/ventnor'},
  {name:'Lymington',lat:50.7580,lon:-1.5410,path:'england/hampshire/lymington'},
  {name:'Southampton',lat:50.8990,lon:-1.4044,path:'england/hampshire/southampton'},
  {name:'Portsmouth',lat:50.8020,lon:-1.0880,path:'england/hampshire/portsmouth'},
  {name:'Warsash',lat:50.8520,lon:-1.2980,path:'england/hampshire/warsash'},
  {name:'Calshot Castle',lat:50.8190,lon:-1.3060,path:'england/hampshire/calshot-castle'},
  {name:'Bucklers Hard',lat:50.7990,lon:-1.4210,path:'england/hampshire/bucklers-hard'}
];

async function inspect(path){
  const widgetUrl=`https://api.tidestoday.io/widgets-api/js-v1/en/${path}/widget.js`;
  const r=await fetch(widgetUrl,{headers:{'User-Agent':'Boaty-McBoatface/1.0'}});
  if(!r.ok)return null;
  const text=await r.text();
  const id=text.match(/tidewidget__(\d+)/i)?.[1]||text.match(/widget[_-]?id\D{0,12}(\d+)/i)?.[1];
  if(!id)return null;
  return {path,id,widgetUrl,pageUrl:`https://tides.today/en/%F0%9F%8C%8D/${path}`};
}

function exactCandidates(q){
  const name=slug(q.name),country=slug(q.country),code=String(q.country_code||'').toUpperCase(),a1=slug(q.admin1),a2=slug(q.admin2);
  const out=[];
  if((code==='GB'||code==='UK'||country==='united-kingdom')&&['england','scotland','wales','northern-ireland'].includes(a1)){
    if(a2&&name)out.push(`${a1}/${a2}/${name}`);
    if(name&&a1==='england'&&!a2)out.push(`england/hampshire/${name}`);
  }else if(country&&a1&&name){
    out.push(`${country}/${a1}/${name}`);
  }
  return [...new Set(out)];
}

module.exports=async function handler(req,res){
  const q=req.query||{},lat=Number(q.lat),lon=Number(q.lon);
  try{
    for(const path of exactCandidates(q)){
      const found=await inspect(path);
      if(found){res.setHeader('Cache-Control','s-maxage=86400, stale-while-revalidate=604800');return res.status(200).json({...found,name:q.name||path.split('/').pop(),match:'exact'});}
    }
    if(Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=50.45&&lat<=51.15&&lon>=-1.75&&lon<=-0.75){
      const ranked=SOLENT.map(s=>({...s,distanceKm:distance(lat,lon,s.lat,s.lon)})).sort((a,b)=>a.distanceKm-b.distanceKm);
      for(const station of ranked.slice(0,4)){
        const found=await inspect(station.path);
        if(found){res.setHeader('Cache-Control','s-maxage=86400, stale-while-revalidate=604800');return res.status(200).json({...found,name:station.name,distanceKm:Number(station.distanceKm.toFixed(1)),match:'nearest'});}
      }
    }
    return res.status(404).json({error:'No supported Tides Today widget station could be resolved for this location.',searchUrl:'https://tides.today/en'});
  }catch(error){return res.status(502).json({error:'Unable to resolve Tides Today widget.',detail:error.message});}
};
