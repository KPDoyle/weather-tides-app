window.drawTideChart = function(points){
  const canvas=$('tideChart'), ctx=canvas.getContext('2d');
  const ratio=window.devicePixelRatio || 1;
  const cssWidth=Math.max(canvas.clientWidth,320), cssHeight=340;
  const width=cssWidth*ratio, height=cssHeight*ratio;
  canvas.width=width; canvas.height=height;
  canvas.style.height=`${cssHeight}px`;
  ctx.clearRect(0,0,width,height);

  if(points.length<2){
    ctx.fillStyle='#9eb4c8';
    ctx.font=`${14*ratio}px Manrope`;
    ctx.fillText('No tide curve available',20*ratio,45*ratio);
    return;
  }

  const u=unitConfig();
  const left=58*ratio,right=18*ratio,top=24*ratio,bottom=64*ratio;
  const plotWidth=width-left-right, plotHeight=height-top-bottom;
  const vals=points.map(p=>Number(p.height));
  const rawMin=Math.min(...vals), rawMax=Math.max(...vals);
  const padding=Math.max((rawMax-rawMin)*0.08,0.05);
  const min=rawMin-padding, max=rawMax+padding, range=max-min||1;
  const xy=points.map((p,i)=>[
    left+i*plotWidth/(points.length-1),
    top+plotHeight-(Number(p.height)-min)*plotHeight/range
  ]);

  const grad=ctx.createLinearGradient(0,0,width,0);
  grad.addColorStop(0,'#5ee7e7');
  grad.addColorStop(1,'#52b7ff');

  ctx.font=`${11*ratio}px Manrope`;
  ctx.textBaseline='middle';
  for(let i=0;i<6;i++){
    const y=top+i*plotHeight/5;
    const value=max-i*range/5;
    ctx.strokeStyle='rgba(158,180,200,.18)';
    ctx.lineWidth=1*ratio;
    ctx.beginPath(); ctx.moveTo(left,y); ctx.lineTo(width-right,y); ctx.stroke();
    ctx.fillStyle='#9eb4c8';
    ctx.textAlign='right';
    ctx.fillText(`${value.toFixed(2)} ${u.wave}`,left-8*ratio,y);
  }

  ctx.beginPath();
  ctx.moveTo(xy[0][0],top+plotHeight);
  xy.forEach(([x,y])=>ctx.lineTo(x,y));
  ctx.lineTo(xy.at(-1)[0],top+plotHeight);
  ctx.closePath();
  const fill=ctx.createLinearGradient(0,top,0,top+plotHeight);
  fill.addColorStop(0,'rgba(82,183,255,.35)');
  fill.addColorStop(1,'rgba(82,183,255,.02)');
  ctx.fillStyle=fill; ctx.fill();

  ctx.beginPath();
  xy.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));
  ctx.strokeStyle=grad; ctx.lineWidth=3*ratio; ctx.stroke();

  const labelCount=cssWidth<520?6:cssWidth<800?9:13;
  ctx.font=`${11*ratio}px Manrope`;
  ctx.fillStyle='#9eb4c8';
  ctx.textAlign='center';
  ctx.textBaseline='top';
  for(let tick=0;tick<labelCount;tick++){
    const i=Math.round(tick*(points.length-1)/(labelCount-1));
    const point=points[i];
    const dt=point.date?new Date(point.date):new Date(point.dt*1000);
    const x=left+i*plotWidth/(points.length-1);
    ctx.strokeStyle='rgba(158,180,200,.3)';
    ctx.beginPath(); ctx.moveTo(x,top+plotHeight); ctx.lineTo(x,top+plotHeight+5*ratio); ctx.stroke();
    ctx.fillText(dt.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}),x,top+plotHeight+8*ratio);
    ctx.fillText(dt.toLocaleDateString('en-GB',{weekday:'short',day:'numeric'}),x,top+plotHeight+23*ratio);
  }

  const pointStep=cssWidth<520?Math.max(1,Math.ceil(points.length/24)):Math.max(1,Math.ceil(points.length/48));
  xy.forEach(([x,y],i)=>{
    if(i%pointStep!==0 && i!==points.length-1) return;
    ctx.beginPath(); ctx.arc(x,y,2.5*ratio,0,Math.PI*2);
    ctx.fillStyle='#dffcff'; ctx.fill();
  });

  function drawTooltip(index){
    window.drawTideChart(points);
    const [x,y]=xy[index];
    const point=points[index];
    const dt=point.date?new Date(point.date):new Date(point.dt*1000);
    const time=dt.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
    const date=dt.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});
    const value=`${Number(point.height).toFixed(2)} ${u.wave}`;

    ctx.strokeStyle='rgba(223,252,255,.55)';
    ctx.lineWidth=1*ratio;
    ctx.beginPath(); ctx.moveTo(x,top); ctx.lineTo(x,top+plotHeight); ctx.stroke();
    ctx.beginPath(); ctx.arc(x,y,5*ratio,0,Math.PI*2); ctx.fillStyle='#ffffff'; ctx.fill();

    ctx.font=`${12*ratio}px Manrope`;
    const lines=[`${date} ${time}`,`Height ${value}`];
    const boxW=Math.max(...lines.map(line=>ctx.measureText(line).width))+22*ratio;
    const boxH=48*ratio;
    let boxX=x-boxW/2;
    boxX=Math.max(6*ratio,Math.min(boxX,width-boxW-6*ratio));
    let boxY=y-boxH-14*ratio;
    if(boxY<6*ratio) boxY=y+14*ratio;
    ctx.fillStyle='rgba(7,26,45,.96)';
    ctx.strokeStyle='rgba(94,231,231,.65)';
    ctx.lineWidth=1*ratio;
    ctx.beginPath(); ctx.roundRect(boxX,boxY,boxW,boxH,8*ratio); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#ffffff'; ctx.textAlign='left'; ctx.textBaseline='top';
    ctx.fillText(lines[0],boxX+11*ratio,boxY+8*ratio);
    ctx.fillStyle='#5ee7e7';
    ctx.fillText(lines[1],boxX+11*ratio,boxY+25*ratio);
  }

  canvas.onpointermove=(event)=>{
    const rect=canvas.getBoundingClientRect();
    const x=(event.clientX-rect.left)*ratio;
    if(x<left || x>width-right) return;
    const index=Math.max(0,Math.min(points.length-1,Math.round((x-left)/plotWidth*(points.length-1))));
    drawTooltip(index);
  };
  canvas.onpointerleave=()=>window.drawTideChart(points);
  canvas.onclick=(event)=>{
    const rect=canvas.getBoundingClientRect();
    const x=(event.clientX-rect.left)*ratio;
    const index=Math.max(0,Math.min(points.length-1,Math.round((x-left)/plotWidth*(points.length-1))));
    drawTooltip(index);
  };
};