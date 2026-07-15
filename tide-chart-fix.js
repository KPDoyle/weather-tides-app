(function(){
  function redraw(){
    const canvas=document.getElementById('tideChart');
    if(!canvas||typeof window.drawTideChart!=='function')return;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      try{window.drawTideChart();}catch(e){console.error('Tide chart redraw failed',e);}
    }));
  }

  function checkAndRedraw(){
    const dashboard=document.getElementById('dashboard');
    const canvas=document.getElementById('tideChart');
    if(!dashboard||!canvas||dashboard.hidden)return;
    redraw();
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