(() => {
  const pointDate=p=>p?.date?new Date(p.date):new Date(Number(p?.dt)*1000);
  const valid=p=>Number.isFinite(Number(p?.height))&&Number.isFinite(pointDate(p).getTime());
  const unit=()=>state.units==='metric'?'m':'ft';
  function smooth(ctx,xy){
    if(!xy.length)return;
    ctx.moveTo(xy[0].x,xy[0].y);
    for(let i=1;i<xy.length-1;i++){
      const q=xy[i],n=xy[i+1];
      ctx.quadraticCurveTo(q.x,q.y,(q.x+n.x)/2,(q.y+n.y)/2);
    }
    const last=xy[xy.length-1];
    ctx.lineTo(last.x,last.y);
  }
  window.drawTideChart=function(activeIndex=null){
    const canvas=document.getElementById('tideChart');if(!canvas)return;
    const rect=canvas.getBoundingClientRect(),cssWidth=Math.max(320,Math.round(rect.width||canvas.parentElement?.clientWidth||900)),cssHeight=480,ratio=Math.max(1,window.devicePixelRatio||1);
    canvas.style.width='100%';canvas.style.height=`${cssHeight}px`;canvas.width=Math.round(cssWidth*ratio);canvas.height=Math.round(cssHeight*ratio);
    const ctx=canvas.getContext('2d');ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,cssWidth,cssHeight);
    const points=(state.chartPoints||[]).filter(valid);if(points.length<2){ctx.fillStyle='rgba(255,255,255,.9)';ctx.font='600 16px -apple-system,system-ui,sans-serif';ctx.fillText('No tide-height series is available.',24,48);return}
    const L=76,R=28,T=34,B=118,W=cssWidth-L-R,H=cssHeight-T-B,t0=pointDate(points[0]).getTime(),t1=pointDate(points.at(-1)).getTime(),span=t1-t0||1;
    const values=points.map(p=>Number(p.height)),min=Math.min(...values),max=Math.max(...values),padding=Math.max(.05,(max-min)*.08),lo=min-padding,hi=max+padding,range=hi-lo||1;
    const xy=points.map(p=>({x:L+(pointDate(p).getTime()-t0)*W/span,y:T+H-(Number(p.height)-lo)*H/range,p}));
    ctx.lineWidth=1;ctx.font='12px -apple-system,system-ui,sans-serif';
    for(let i=0;i<6;i++){const y=T+i*H/5,val=hi-i*range/5;ctx.strokeStyle='rgba(255,255,255,.18)';ctx.beginPath();ctx.moveTo(L,y);ctx.lineTo(cssWidth-R,y);ctx.stroke();ctx.fillStyle='rgba(255,255,255,.72)';ctx.textAlign='right';ctx.textBaseline='middle';ctx.fillText(`${val.toFixed(2)} ${unit()}`,L-10,y)}
    const tickHours=cssWidth<520?4:cssWidth<780?3:2,firstTick=Math.ceil(t0/(tickHours*3600000))*(tickHours*3600000);
    for(let ts=firstTick;ts<=t1;ts+=tickHours*3600000){const x=L+(ts-t0)*W/span;if(x-L<58||cssWidth-R-x<58)continue;const d=new Date(ts);ctx.strokeStyle='rgba(255,255,255,.11)';ctx.beginPath();ctx.moveTo(x,T);ctx.lineTo(x,T+H);ctx.stroke();ctx.fillStyle='rgba(255,255,255,.92)';ctx.textAlign='center';ctx.textBaseline='top';ctx.font='700 12px -apple-system,system-ui,sans-serif';ctx.fillText(d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}),x,T+H+12);if(d.getHours()===0){ctx.fillStyle='rgba(94,231,231,.95)';ctx.font='700 11px -apple-system,system-ui,sans-serif';ctx.fillText(d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'}),x,T+H+34)}}
    ctx.strokeStyle='rgba(94,231,231,.9)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(L,T);ctx.lineTo(L,T+H);ctx.stroke();ctx.fillStyle='#5ee7e7';ctx.textAlign='left';ctx.textBaseline='top';ctx.font='700 12px -apple-system,system-ui,sans-serif';ctx.fillText('NOW',L+6,T+5);
    const start=new Date(t0),end=new Date(t1);ctx.fillStyle='rgba(255,255,255,.96)';ctx.font='700 12px -apple-system,system-ui,sans-serif';ctx.textAlign='left';ctx.fillText(start.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}),L,T+H+62);ctx.fillStyle='rgba(255,255,255,.64)';ctx.font='11px -apple-system,system-ui,sans-serif';ctx.fillText(start.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'}),L,T+H+80);ctx.textAlign='right';ctx.fillStyle='rgba(255,255,255,.96)';ctx.font='700 12px -apple-system,system-ui,sans-serif';ctx.fillText(end.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}),cssWidth-R,T+H+62);ctx.fillStyle='rgba(255,255,255,.64)';ctx.font='11px -apple-system,system-ui,sans-serif';ctx.fillText(end.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'}),cssWidth-R,T+H+80);
    const fill=ctx.createLinearGradient(0,T,0,T+H);fill.addColorStop(0,'rgba(255,255,255,.35)');fill.addColorStop(1,'rgba(255,255,255,.03)');ctx.beginPath();ctx.moveTo(xy[0].x,T+H);ctx.lineTo(xy[0].x,xy[0].y);for(let i=1;i<xy.length-1;i++){const q=xy[i],n=xy[i+1];ctx.quadraticCurveTo(q.x,q.y,(q.x+n.x)/2,(q.y+n.y)/2)}ctx.lineTo(xy.at(-1).x,xy.at(-1).y);ctx.lineTo(xy.at(-1).x,T+H);ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.beginPath();smooth(ctx,xy);ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke();
    if(Number.isInteger(activeIndex)&&xy[activeIndex]){const q=xy[activeIndex],d=pointDate(q.p);ctx.strokeStyle='rgba(255,255,255,.55)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(q.x,T);ctx.lineTo(q.x,T+H);ctx.stroke();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(q.x,q.y,5,0,Math.PI*2);ctx.fill();const out=document.getElementById('tideReadout');if(out)out.textContent=`${d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})} ${d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})} · ${Number(q.p.height).toFixed(2)} ${unit()}`}
    canvas.onpointermove=e=>{const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,target=t0+Math.max(0,Math.min(1,(x-L)/W))*span;let best=0,diff=Infinity;points.forEach((p,i)=>{const v=Math.abs(pointDate(p).getTime()-target);if(v<diff){diff=v;best=i}});window.drawTideChart(best)};canvas.onpointerleave=()=>window.drawTideChart();canvas.onclick=e=>canvas.onpointermove(e);
  };
})();