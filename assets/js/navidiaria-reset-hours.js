(() => {
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
