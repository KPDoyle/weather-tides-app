(() => {
  const dialog = document.getElementById('locationsDialog');
  const close = document.getElementById('closeLocationsDialog');
  if (dialog && close) close.addEventListener('click', () => dialog.close());
  if (dialog) {
    dialog.addEventListener('click', event => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener('cancel', event => {
      event.preventDefault();
      dialog.close();
    });
  }

  const style = document.createElement('style');
  style.textContent = `
    .top-segment{margin:12px 0 0;position:sticky;top:8px;z-index:20}
    .top-segment .tab{min-height:44px;font-weight:700}
    #locationsDialog::backdrop{background:rgba(2,12,24,.66);backdrop-filter:blur(8px)}
    #locationsDialog .dialog-card{position:relative;max-height:min(82vh,720px);overflow:auto}
    #closeLocationsDialog{position:relative;z-index:2;flex:0 0 auto;font-size:24px;line-height:1}
    @media(max-width:620px){.top-segment{display:grid;grid-template-columns:repeat(3,1fr);gap:4px}.top-segment .tab{padding:10px 6px;font-size:13px}}
  `;
  document.head.appendChild(style);
})();