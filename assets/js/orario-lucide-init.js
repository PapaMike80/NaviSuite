(() => {
  const initialize = () => {
    globalThis.lucide?.createIcons({ attrs: { width: 16, height: 16 } });
  };
  if (globalThis.lucide != null) {
    initialize();
  } else {
    document
      .getElementById("codex-visualization-lucide")
      ?.addEventListener("load", initialize, { once: true });
  }

  const installNaviSuiteMenuButton = () => {
    if (!document.body.classList.contains('orario-page')) return;
    if (document.getElementById('navisuite-orario-menu')) return;
    const controls = document.querySelector('#orario-garda-viz .og-zoom-controls');
    if (!controls) return;

    const button = document.createElement('button');
    button.id = 'navisuite-orario-menu';
    button.type = 'button';
    button.setAttribute('aria-label', 'Apri menu NaviSuite');
    button.textContent = '☰';
    button.style.cssText = 'display:grid;place-items:center;flex:0 0 auto;width:1.8rem;height:1.8rem;padding:0;border:1px solid #2dd4bf;border-radius:50%;background:#103a3d;color:#a7fff0;font:900 17px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;cursor:pointer';
    button.addEventListener('click', () => window.NaviSuiteMenu?.open?.());
    controls.prepend(button);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installNaviSuiteMenuButton, { once: true });
  } else {
    installNaviSuiteMenuButton();
  }
})();
