(() => {
  function recoverMonthlyScript(){
    const grid=document.getElementById('monthlySheetGrid');
    if(!grid||grid.querySelector('.monthly-table'))return;
    const loadScript=src=>new Promise(resolve=>{
      [...document.scripts].find(script=>script.src&&script.src.includes(src.split('?')[0]))?.remove();
      const script=document.createElement('script');
      script.src=src;
      script.onload=resolve;
      script.onerror=resolve;
      document.body.appendChild(script);
    });
    const run=async()=>{
      if(!window.NaviDayModal)await loadScript(`assets/js/day-popup.js?recover=${Date.now()}`);
      await loadScript(`assets/js/navidiaria-monthly.js?recover=${Date.now()}`);
      try{
        document.dispatchEvent(new CustomEvent('navidiaria:render'));
        if(window.NaviDiariaRuntime?.ready)document.dispatchEvent(new CustomEvent('navidiaria:ready'));
      }catch(error){console.warn('Recupero distinta mensile non riuscito',error)}
    };
    run();
  }
  setTimeout(recoverMonthlyScript,1200);
  window.addEventListener('pageshow',()=>setTimeout(recoverMonthlyScript,600));

  let scheduled = 0;
  document.addEventListener('click', event => {
    const cell = event.target.closest('td[data-row="hours"][data-date]');
    if (!cell) return;
    const entry = entries.find(item => item.date === cell.dataset.date);
    scheduled = entry ? (Number(entry.serviceMinutes) || Math.round((Number(shiftFor(entry.shift).hours) || 0) * 60)) : 0;
  }, true);
  new MutationObserver(() => {
    const dialog = document.getElementById('monthlyValueDialog');
    const actions = dialog?.querySelector('.monthly-dialog-actions');
    if (!dialog || !actions || actions.querySelector('.monthly-dialog-reset')) return;
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'monthly-dialog-reset'; button.textContent = 'Ripristina ore corsa';
    actions.prepend(button);
    button.addEventListener('click', () => {
      const input = dialog.querySelector('input');
      if (!input || !scheduled) return;
      input.value = String(Math.floor(scheduled / 60)).padStart(2, '0') + ':' + String(scheduled % 60).padStart(2, '0');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
    });
  }).observe(document.body, { childList: true, subtree: true });
})();
