(function(){
  function redraw(){
    const canvas=document.getElementById('tideChart');
    if(!canvas||typeof window.drawTideChart!=='function')return;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      try{window.drawTideChart();}catch(e){console.error('Tide chart redraw failed',e);}
    }));
  }

  function showStatus(message){
    const canvas=document.getElementById('tideChart');
    if(!canvas)return;
    const ctx=canvas.getContext('2d');
    const ratio=window.devicePixelRatio||1;
    const width=Math.max(canvas.clientWidth,320)*ratio;
    const height=360*ratio;
    canvas.width=width;canvas.height=height;
    ctx.clearRect(0,0,width,height);
    ctx.fillStyle='rgba(255,255,255,.82)';
    ctx.font=`${14*ratio}px -apple-system, BlinkMacSystemFont, sans-serif`;
    ctx.fillText(message,20*ratio,42*ratio);
  }

  function checkAndRedraw(){
    const dashboard=document.getElementById('dashboard');
    const canvas=document.getElementById('tideChart');
    if(!dashboard||!canvas||dashboard.hidden)return;
    if(window.state?.chartPoints?.length>=2) redraw();
    else showStatus('No WorldTides height data received. Check WORLD_TIDES_API_KEY and redeploy.');
  }

  document.addEventListener('DOMContentLoaded',()=>{
    const dashboard=document.getElementById('dashboard');
    if(dashboard)new MutationObserver(checkAndRedraw).observe(dashboard,{attributes:true,attributeFilter:['hidden']});
    document.querySelectorAll('[data-tab="tides"]').forEach(btn=>btn.addEventListener('click',()=>setTimeout(checkAndRedraw,80)));
    document.addEventListener('click',e=>{if(e.target?.id==='expandTideChart')setTimeout(checkAndRedraw,120);});
    window.addEventListener('resize',()=>setTimeout(checkAndRedraw,60));
    setTimeout(checkAndRedraw,600);
  });
})();