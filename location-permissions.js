(() => {
  const button = document.getElementById('locateButton');
  if (!button) return;

  const style = document.createElement('style');
  style.textContent = `
    .location-status{margin:10px 0 2px;padding:11px 13px;border-radius:12px;font-size:13px;line-height:1.45;background:rgba(3,35,70,.72);border:1px solid rgba(145,203,247,.28);color:rgba(245,250,255,.92)}
    .location-status[hidden]{display:none}.location-status.error{border-color:rgba(255,137,125,.62);background:rgba(86,25,31,.62)}
    .location-status.success{border-color:rgba(90,219,157,.54);background:rgba(18,75,57,.58)}
    #locateButton[disabled]{opacity:.72;cursor:wait}
  `;
  document.head.appendChild(style);

  const status = document.createElement('div');
  status.id = 'locationStatus';
  status.className = 'location-status';
  status.setAttribute('role','status');
  status.setAttribute('aria-live','polite');
  status.hidden = true;
  button.insertAdjacentElement('afterend', status);

  const originalText = '◎ Use My Location';
  const isiOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(navigator.userAgent);
  const inAppBrowser = /FBAN|FBAV|Instagram|Line\/|Twitter|LinkedInApp|GSA\//i.test(navigator.userAgent) || (/; wv\)/i.test(navigator.userAgent));

  function show(message, type='') {
    status.className = `location-status${type ? ` ${type}` : ''}`;
    status.textContent = message;
    status.hidden = false;
  }

  function hideStatus(){ status.hidden = true; }

  function permissionHelp(){
    if (inAppBrowser) return 'Open this link in Safari or Chrome, then press Use My Location again. Some messaging and social-media browsers do not pass location permission through reliably.';
    if (isiOS) return 'Location is blocked. In Safari, tap the page menu, open Website Settings and set Location to Allow. Also check Settings › Privacy & Security › Location Services › Safari Websites.';
    if (isAndroid) return 'Location is blocked. In Chrome, open the site controls beside the address, choose Permissions, allow Location, then try again.';
    return 'Location is blocked for this site. Open your browser site permissions, allow Location, then press Use My Location again.';
  }

  function getPosition(options){
    return new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,options));
  }

  async function requestLocation(event){
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }

    hideStatus();
    if (!window.isSecureContext) {
      show('Current location requires the secure HTTPS version of the app. Open the Vercel link beginning with https://.', 'error');
      return;
    }
    if (!navigator.geolocation || typeof window.loadLocation !== 'function') {
      show('This browser cannot provide a location. Search for a harbour, town or postcode instead.', 'error');
      return;
    }

    button.disabled = true;
    button.textContent = '◎ Finding your location…';

    try {
      if (navigator.permissions?.query) {
        try {
          const permission = await navigator.permissions.query({name:'geolocation'});
          if (permission.state === 'denied') throw Object.assign(new Error('Permission denied'), {code:1});
        } catch (permissionError) {
          if (permissionError?.code === 1) throw permissionError;
        }
      }

      let position;
      try {
        position = await getPosition({enableHighAccuracy:true,timeout:14000,maximumAge:300000});
      } catch (firstError) {
        if (firstError.code === 1) throw firstError;
        show('A precise GPS position was not available. Trying a quicker approximate location…');
        position = await getPosition({enableHighAccuracy:false,timeout:12000,maximumAge:900000});
      }

      const accuracy = Number(position.coords.accuracy);
      const location = {
        name: accuracy > 5000 ? 'Approximate Location' : 'Current Location',
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        timezone: 'auto'
      };
      show(`Location found${Number.isFinite(accuracy) ? ` (within about ${accuracy < 1000 ? Math.round(accuracy) + ' m' : (accuracy/1000).toFixed(1) + ' km'})` : ''}. Loading marine conditions…`, 'success');
      await window.loadLocation(location);
      setTimeout(hideStatus, 3500);
    } catch (error) {
      if (error?.code === 1) show(permissionHelp(), 'error');
      else if (error?.code === 2) show('Your device could not determine its position. Check that Location Services are switched on, move somewhere with a clearer signal, or search manually.', 'error');
      else if (error?.code === 3) show('The location request timed out. Try again outdoors, connect to Wi‑Fi, or search for the nearest harbour manually.', 'error');
      else show('Current location could not be obtained. Try opening the link in Safari or Chrome, or search manually.', 'error');
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  // Capture the click before the older app handler, so there is one consistent
  // permission flow on shared links and installed PWAs.
  document.addEventListener('click', event => {
    if (event.target.closest?.('#locateButton')) requestLocation(event);
  }, true);
})();