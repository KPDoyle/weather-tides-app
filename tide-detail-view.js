(function(){
  const ready=()=>{
    const canvas=document.getElementById('tideChart');
    if(!canvas||canvas.dataset.detailReady)return;
    canvas.dataset.detailReady='true';
    const card=canvas.closest('.card');
    const layout=card?.closest('.two-col');
    if(!card||!layout)return;

    const toolbar=document.createElement('div');
    toolbar.className='tide-detail-toolbar';
    toolbar.innerHTML='<div><strong>Detailed tide curve</strong><span>Exact height scale and local time</span></div><button id="expandTideChart" type="button" class="pill-btn">⛶ Expand chart</button>';
    card.insertBefore(toolbar,canvas);

    const scroll=document.createElement('div');
    scroll.className='tide-chart-scroll';
    canvas.parentNode.insertBefore(scroll,canvas);
    scroll.appendChild(canvas);

    const readout=document.createElement('div');
    readout.className='tide-live-readout';
    readout.innerHTML='<span>Move across or tap the curve</span><strong>Time and height will appear on the chart</strong>';
    scroll.insertAdjacentElement('afterend',readout);

    const summary=document.createElement('div');
    summary.className='tide-detail-summary';
    summary.innerHTML='<div><span>Next high water</span><strong id="nextHighDetail">—</strong></div><div><span>Next low water</span><strong id="nextLowDetail">—</strong></div><div><span>Next tidal range</span><strong id="tideRangeDetail">—</strong></div>';
    readout.insertAdjacentElement('afterend',summary);

    const updateSummary=()=>{
      const events=[...document.querySelectorAll('#tideEvents .tide-event')];
      const parsed=events.map(el=>{
        const text=el.innerText.replace(/\s+/g,' ').trim();
        const height=text.match(/(-?\d+(?:\.\d+)?)\s*(m|ft)\b/i);
        return {text,height:height?Number(height[1]):null,unit:height?.[2]||''};
      });
      const high=parsed.find(x=>/high water/i.test(x.text));
      const low=parsed.find(x=>/low water/i.test(x.text));
      document.getElementById('nextHighDetail').textContent=high?.text.replace(/high water/i,'').trim()||'Unavailable';
      document.getElementById('nextLowDetail').textContent=low?.text.replace(/low water/i,'').trim()||'Unavailable';
      const range=high&&low&&Number.isFinite(high.height)&&Number.isFinite(low.height)?Math.abs(high.height-low.height):null;
      document.getElementById('tideRangeDetail').textContent=range!==null?`${range.toFixed(2)} ${high.unit||low.unit}`:'Unavailable';
    };
    new MutationObserver(updateSummary).observe(document.getElementById('tideEvents'),{childList:true,subtree:true,characterData:true});
    updateSummary();

    const button=document.getElementById('expandTideChart');
    button.addEventListener('click',()=>{
      layout.classList.toggle('tide-expanded');
      const expanded=layout.classList.contains('tide-expanded');
      button.textContent=expanded?'✕ Close expanded view':'⛶ Expand chart';
      document.body.classList.toggle('tide-chart-open',expanded);
      setTimeout(()=>window.dispatchEvent(new Event('resize')),80);
      if(expanded)card.scrollIntoView({behavior:'smooth',block:'start'});
    });

    const reflectPointer=e=>{
      const rect=canvas.getBoundingClientRect();
      const x=Math.max(0,Math.min(rect.width,e.clientX-rect.left));
      const pct=Math.round(x/rect.width*100);
      readout.firstElementChild.textContent=`Chart position ${pct}%`;
      readout.lastElementChild.textContent='Exact local time and height are shown in the chart tooltip';
    };
    canvas.addEventListener('pointermove',reflectPointer);
    canvas.addEventListener('pointerdown',reflectPointer);
  };

  const style=document.createElement('style');
  style.textContent=`
    .tide-detail-toolbar{display:flex;justify-content:space-between;align-items:center;gap:16px;margin:0 0 14px;padding:12px 14px;border-radius:16px;background:rgba(255,255,255,.07)}
    .tide-detail-toolbar div{display:grid;gap:3px}.tide-detail-toolbar span{font-size:12px;opacity:.72}
    .tide-chart-scroll{width:100%;overflow-x:auto;overflow-y:hidden;border-radius:18px;background:rgba(0,0,0,.08);scrollbar-width:thin}
    .tide-chart-scroll canvas{display:block;width:100%;height:420px;min-width:860px}
    .tide-live-readout{display:flex;justify-content:space-between;gap:16px;margin-top:12px;padding:12px 14px;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:rgba(255,255,255,.05);font-size:13px}
    .tide-live-readout span{opacity:.7}.tide-detail-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:12px}
    .tide-detail-summary>div{padding:13px;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:rgba(255,255,255,.05)}
    .tide-detail-summary span{display:block;font-size:11px;letter-spacing:.06em;text-transform:uppercase;opacity:.65}.tide-detail-summary strong{display:block;margin-top:6px;font-size:14px;line-height:1.35}
    .two-col.tide-expanded{position:fixed;inset:12px;z-index:1000;display:block;overflow:auto;padding:10px;border-radius:24px;background:rgba(24,55,91,.97);backdrop-filter:blur(28px);box-shadow:0 30px 100px rgba(0,0,0,.55)}
    .two-col.tide-expanded>.card:first-child{min-height:calc(100vh - 44px)}.two-col.tide-expanded>.card:last-child{margin-top:14px}
    .two-col.tide-expanded .tide-chart-scroll canvas{height:520px;min-width:1200px}.tide-chart-open{overflow:hidden}
    @media(max-width:700px){.tide-detail-toolbar{align-items:flex-start;flex-direction:column}.tide-live-readout{flex-direction:column}.tide-detail-summary{grid-template-columns:1fr}.tide-chart-scroll canvas{height:390px;min-width:1050px}.two-col.tide-expanded{inset:5px}.two-col.tide-expanded .tide-chart-scroll canvas{height:480px;min-width:1250px}}
  `;
  document.head.appendChild(style);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready);else ready();
})();