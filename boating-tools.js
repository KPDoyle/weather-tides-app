(() => {
  const getState = () => (typeof state !== 'undefined' ? state : null);
  let lastTrafficKey = '';

  const style = document.createElement('style');
  style.textContent = `
    .segment{grid-template-columns:repeat(3,1fr)}
    .traffic-map{position:relative;min-height:520px;border-radius:18px;overflow:hidden;background:rgba(0,0,0,.12)}
    .traffic-map iframe{display:block;width:100%;height:520px;border:0;background:#0b2035}
    .traffic-loading{display:grid;place-items:center;min-height:520px;padding:24px;text-align:center;opacity:.75}
    .traffic-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}.traffic-actions a{text-decoration:none}
    .boat-plan-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px}
    .boat-plan-summary>div,.boat-checklist>div{padding:13px;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:rgba(255,255,255,.05)}
    .boat-plan-summary span,.boat-checklist span{display:block;font-size:11px;letter-spacing:.055em;text-transform:uppercase;opacity:.68}
    .boat-plan-summary strong,.boat-checklist strong{display:block;margin-top:5px;font-size:15px}
    .boat-checklist{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.boat-checklist .wide{grid-column:1/-1}
    .condition-good strong{color:#88f2c0}.condition-watch strong{color:#ffd277}.condition-caution strong{color:#ff9b91}
    @media(max-width:720px){.traffic-map,.traffic-map iframe,.traffic-loading{min-height:430px;height:430px}.boat-plan-summary,.boat-checklist{grid-template-columns:1fr}.boat-checklist .wide{grid-column:auto}}
  `;
  document.head.appendChild(style);

  function switchTab(name) {
    document.querySelectorAll('.tab').forEach(button => button.classList.toggle('active', button.dataset.tab === name));
    const panels = {tides:'tidesPanel', marine:'marinePanel', traffic:'trafficPanel'};
    Object.entries(panels).forEach(([key,id]) => {
      const panel = document.getElementById(id);
      if (panel) panel.hidden = key !== name;
    });
    if (name === 'tides' && typeof window.drawTideChart === 'function') setTimeout(() => window.drawTideChart(), 60);
    if (name === 'traffic') setTimeout(renderTraffic, 30);
    if (name === 'marine') setTimeout(renderBoatPlan, 30);
  }

  document.querySelectorAll('.tab').forEach(button => {
    button.addEventListener('click', event => {
      event.preventDefault();
      switchTab(button.dataset.tab);
    });
  });

  function locationCoords() {
    const appState = getState();
    const lat = Number(appState?.location?.latitude);
    const lon = Number(appState?.location?.longitude);
    return Number.isFinite(lat) && Number.isFinite(lon) ? {lat,lon} : null;
  }

  function renderTraffic(force=false) {
    const host = document.getElementById('marineTrafficMap');
    const openLink = document.getElementById('openMarineTraffic');
    const coords = locationCoords();
    if (!host || !coords) {
      if (host) host.innerHTML = '<div class="traffic-loading">Choose a location or allow device location to show nearby vessels.</div>';
      return;
    }
    const key = `${coords.lat.toFixed(4)},${coords.lon.toFixed(4)}`;
    if (!force && key === lastTrafficKey && host.querySelector('iframe')) return;
    lastTrafficKey = key;
    const embed = `https://www.marinetraffic.com/en/ais/embed/zoom:11/centery:${coords.lat}/centerx:${coords.lon}/maptype:4/shownames:true/mmsi:0/shipid:0/fleet:/fleet_id:/vtypes:/showmenu:true/remember:false`;
    const full = `https://www.marinetraffic.com/en/ais/home/centerx:${coords.lon}/centery:${coords.lat}/zoom:11`;
    host.innerHTML = `<iframe title="MarineTraffic vessels near selected location" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen src="${embed}"></iframe>`;
    if (openLink) openLink.href = full;
  }

  document.getElementById('refreshTraffic')?.addEventListener('click', () => renderTraffic(true));

  const fmt = (v,n=0) => Number.isFinite(Number(v)) ? Number(v).toFixed(n) : '—';
  const speedUnit = () => getState()?.units === 'metric' ? 'km/h' : 'mph';
  const lengthUnit = () => getState()?.units === 'metric' ? 'm' : 'ft';

  function classify(value, watch, caution, inverse=false) {
    if (!Number.isFinite(Number(value))) return 'watch';
    if (inverse) return value < caution ? 'caution' : value < watch ? 'watch' : 'good';
    return value >= caution ? 'caution' : value >= watch ? 'watch' : 'good';
  }

  function nextTide() {
    const appState = getState();
    const now = Date.now()/1000;
    return (appState?.tide?.extremes || [])
      .filter(x => Number(x.dt) > now)
      .sort((a,b) => Number(a.dt)-Number(b.dt))[0] || null;
  }

  function renderBoatPlan() {
    const appState = getState();
    const current = appState?.weather?.current || {};
    const marine = appState?.marine?.current || {};
    const daily = appState?.weather?.daily?.[0] || {};
    const summary = document.getElementById('boatPlanSummary');
    const checklist = document.getElementById('boatChecklist');
    const status = document.getElementById('boatPlanStatus');
    if (!summary || !checklist) return;

    const wind = Number(current.windSpeed);
    const gust = Number(current.windGust);
    const wave = Number(marine.wave_height);
    const visibilityKm = Number(current.visibility)/1000;
    const rain = Number(current.precipitationIntensity);
    const tide = nextTide();

    const ratings = [
      classify(wind, 25, 40),
      classify(gust, 35, 55),
      classify(wave, getState()?.units === 'metric' ? 1 : 3.3, getState()?.units === 'metric' ? 2 : 6.6),
      classify(visibilityKm, 5, 2, true)
    ];
    const overall = ratings.includes('caution') ? 'Caution' : ratings.includes('watch') ? 'Watch conditions' : 'Generally favourable';
    const cls = overall === 'Caution' ? 'condition-caution' : overall === 'Watch conditions' ? 'condition-watch' : 'condition-good';
    if (status) status.textContent = overall;

    summary.innerHTML = `
      <div class="${cls}"><span>Planning summary</span><strong>${overall}</strong></div>
      <div><span>Wind / gusts</span><strong>${fmt(wind)} / ${fmt(gust)} ${speedUnit()}</strong></div>
      <div><span>Wave height</span><strong>${fmt(wave,1)} ${lengthUnit()}</strong></div>`;

    const tideText = tide ? `${/high/i.test(tide.type||'')?'High':'Low'} ${new Date((tide.date ? new Date(tide.date).getTime() : Number(tide.dt)*1000)).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})} · ${fmt(tide.height,2)} ${lengthUnit()}` : 'No event available';
    const sunsetText = daily.sunset ? new Date(daily.sunset).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}) : '—';
    checklist.innerHTML = `
      <div class="condition-${classify(visibilityKm,5,2,true)}"><span>Visibility</span><strong>${fmt(visibilityKm,1)} km</strong></div>
      <div class="condition-${classify(rain,.5,2)}"><span>Rain now</span><strong>${fmt(rain,1)} ${getState()?.units==='metric'?'mm':'in'}</strong></div>
      <div><span>Next tide</span><strong>${tideText}</strong></div>
      <div><span>Sunset</span><strong>${sunsetText}</strong></div>
      <div><span>Swell period</span><strong>${fmt(marine.swell_wave_period,1)} s</strong></div>
      <div><span>Sea temperature</span><strong>${fmt(marine.sea_surface_temperature,1)}°</strong></div>
      <div class="wide"><span>Departure checks</span><strong>Lifejackets · fuel/battery · VHF/phone · charts · local notices · passage plan · crew briefing · anchor and lines</strong></div>`;
  }

  const dashboard = document.getElementById('dashboard');
  if (dashboard) new MutationObserver(() => {
    setTimeout(renderBoatPlan, 80);
    if (!document.getElementById('trafficPanel')?.hidden) setTimeout(renderTraffic, 80);
  }).observe(dashboard,{childList:true,subtree:true,attributes:true});

  window.addEventListener('load', () => {
    setTimeout(renderBoatPlan, 1200);
    setTimeout(renderTraffic, 1400);
  });
})();