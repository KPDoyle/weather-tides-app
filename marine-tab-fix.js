(() => {
  function setupTabs() {
    const buttons = [...document.querySelectorAll('.tab[data-tab]')];
    const tidesPanel = document.getElementById('tidesPanel');
    const marinePanel = document.getElementById('marinePanel');
    if (!buttons.length || !tidesPanel || !marinePanel) return;

    const show = (name) => {
      const marine = name === 'marine';
      tidesPanel.hidden = marine;
      marinePanel.hidden = !marine;
      buttons.forEach((button) => {
        const active = button.dataset.tab === name;
        button.classList.toggle('active', active);
        button.setAttribute('aria-selected', String(active));
      });
      if (marine && typeof renderMarine === 'function') renderMarine();
      if (!marine && typeof drawTideChart === 'function') setTimeout(() => drawTideChart(), 40);
    };

    buttons.forEach((button) => {
      button.type = 'button';
      button.setAttribute('role', 'tab');
      button.onclick = (event) => {
        event.preventDefault();
        show(button.dataset.tab);
      };
    });
    show('tides');
  }

  function explainDatum() {
    const canvas = document.getElementById('tideChart');
    if (!canvas || document.getElementById('tideDatumNote')) return;
    const note = document.createElement('p');
    note.id = 'tideDatumNote';
    note.className = 'navigation-warning';
    note.textContent = 'WorldTides heights are shown above Chart Datum. If the Open-Meteo fallback is used, values are relative to global mean sea level and can be negative.';
    canvas.insertAdjacentElement('afterend', note);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setupTabs();
      explainDatum();
    });
  } else {
    setupTabs();
    explainDatum();
  }
})();