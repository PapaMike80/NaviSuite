(function(){
  const APP_VERSION='v1.43';
  const NAVISUITE_PAYPAL_URL='https://www.paypal.com/pool/9sbGlr5lE9?sr=wccr';
  function installSupportFooter(){
    if(document.getElementById('navisuite-support-footer'))return;
    const style=document.createElement('style');
    style.id='navisuite-support-footer-style';
    style.textContent='.navisuite-support-footer{display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;max-width:720px;margin:30px auto calc(22px + env(safe-area-inset-bottom,0px));padding:15px 16px;border-top:1px solid rgba(138,194,197,.3);border-bottom:1px solid rgba(138,194,197,.18);color:rgba(219,241,241,.74);font-size:.92rem;text-align:center}.navisuite-support-footer p{margin:0}.navisuite-support-footer a{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 16px;border:1px solid rgba(84,224,205,.48);border-radius:999px;background:rgba(35,182,163,.13);color:#8bf4e3;font-weight:750;text-decoration:none;transition:background .16s ease,border-color .16s ease,transform .16s ease}.navisuite-support-footer a:hover{background:rgba(35,182,163,.23);border-color:#8bf4e3}.navisuite-support-footer a:focus-visible{outline:3px solid rgba(122,229,214,.86);outline-offset:3px}.navisuite-support-footer a:active{transform:translateY(1px)}html.navisuite-light .navisuite-support-footer{border-color:#bed7da;color:#547078}html.navisuite-light .navisuite-support-footer a{background:#e4f6f3;border-color:#8acfc6;color:#087b6e}html.navisuite-light .navisuite-support-footer a:hover{background:#d4f1ec;border-color:#087b6e}@media(max-width:600px){.navisuite-support-footer{margin:26px 14px calc(22px + env(safe-area-inset-bottom,0px));padding:14px 12px;gap:5px}.navisuite-support-footer p{flex-basis:100%}}';
    document.head.appendChild(style);
    const footer=document.createElement('footer');
    footer.id='navisuite-support-footer';
    footer.className='navisuite-support-footer';
    footer.innerHTML='<p>☕ NaviSuite ti è utile?</p><a href="'+NAVISUITE_PAYPAL_URL+'" target="_blank" rel="noopener noreferrer" aria-label="Offrimi un caffè e sostieni NaviSuite tramite PayPal">Offrimi un caffè</a>';
    document.body.appendChild(footer);
  }
  installSupportFooter();
  window.NAVISUITE_VERSION=APP_VERSION;
  // Applica subito il tema anche alla Home, che non ha un menu laterale.
  // In questo modo non compare una schermata scura prima del reindirizzamento.
  let initialThemeAgent=null;try{initialThemeAgent=JSON.parse(localStorage.getItem('navidiaria.activeAgent')||localStorage.getItem('naviturni_logged_agent')||'null')}catch{}
  const initialLightTester=['91','AG_PEDRONI_M'].includes(String(initialThemeAgent?.id||'').toUpperCase())||/\bPEDRONI\b/i.test(String(initialThemeAgent?.name||initialThemeAgent?.agente||initialThemeAgent?.cognome||''));
  const initialLightTheme=initialLightTester&&localStorage.getItem('navisuite.theme.'+String(initialThemeAgent?.id||''))==='light';
  document.documentElement.classList.toggle('navisuite-light',initialLightTheme);
  document.body.classList.toggle('navisuite-light',initialLightTheme);
  if(initialLightTheme)document.documentElement.dataset.theme='light';
  const sessionValue=localStorage.getItem('navidiaria.activeAgent')||localStorage.getItem('naviturni_logged_agent')||'null';
  let sessionAgent=null;try{sessionAgent=JSON.parse(sessionValue)}catch{}
  // Registra un solo dato di attività: pagina corrente e ora. Il tentativo viene
  // ripetuto perché in alcune pagine Firebase è caricato dopo questo script.
  const trackPageView=attempt=>{
    if(!sessionAgent?.id)return;
    const tracker=window.NaviAdminFirebase?.recordUserAccess;
    if(typeof tracker==='function'){tracker(sessionAgent).catch(()=>{});return;}
    if(attempt<8)setTimeout(()=>trackPageView(attempt+1),250);
  };
  trackPageView(0);
  const sidebar=document.querySelector('.app-sidebar');if(!sidebar)return;
  if('serviceWorker' in navigator){
    if(!window.__naviSwRegistrationPromise){
      window.__naviSwRegistrationPromise=navigator.serviceWorker.register('sw.js?menu=168').then(registration=>{
        if(registration&&typeof registration.update==='function')registration.update().catch(()=>{});
        return registration;
      }).catch(()=>null);
    }
  }
  const page=document.body.classList.contains('tickets-page')?'tickets':document.body.classList.contains('orario-data-page')?'orario-data':document.body.classList.contains('orario-page')?'orario':document.body.classList.contains('impostazioni-page')?'settings':document.body.classList.contains('trova-turno-page')?'trova':document.body.classList.contains('diaria-page')?'diaria':document.body.classList.contains('agenti-page')?'agenti':document.body.classList.contains('aggiornamenti-page')?'aggiornamenti':sidebar.id==='archive-sidebar'?'archive':'turni';
  const tabNames={turni:'NaviTurniTab',trova:'NaviTrovaTurnoTab',diaria:'NaviDiariaTab',archive:'NaviDocumentiTab',settings:'NaviImpostazioniTab',orario:'NaviOrarioTab','orario-data':'NaviOrarioTab'};
  if(page==='archive')document.body.classList.add('archive-page');
  const isAdminAgent=agent=>['91','92'].includes(String(agent?.id||''))||String(agent?.role||'').toLowerCase()==='admin';
  const isNaviPage=location.pathname.toLowerCase().endsWith('/gestione_navi.html');
  // La Diaria e' personale, non amministrativa: basta una sessione autenticata.
  const canUseDiaria=agent=>Boolean(String(agent?.id||'').trim());
  const isBaristaAgent=agent=>String(agent?.role||'').toLowerCase()==='barista'||String(agent?.qualifica||'').toLowerCase()==='barista';
  const isHibaBarista=agent=>String(agent?.id||'').toUpperCase()==='BARISTA_HIBA'||(isBaristaAgent(agent)&&String(agent?.name||agent?.agente||agent?.cognome||'').trim().toUpperCase()==='HIBA');
  const isBaristaSession=isBaristaAgent(sessionAgent);
  // Il test è riservato a Marco: riconosciamo sia gli ID storici sia il cognome
  // con cui può comparire nelle diverse versioni dell'anagrafica.
  const isLightThemeTester=['91','AG_PEDRONI_M'].includes(String(sessionAgent?.id||'').toUpperCase())||/\bPEDRONI\b/i.test(String(sessionAgent?.name||sessionAgent?.agente||sessionAgent?.cognome||''));
  const themeKey='navisuite.theme.'+String(sessionAgent?.id||'');
  const currentTheme=()=>isLightThemeTester&&localStorage.getItem(themeKey)==='light'?'light':'dark';
  function applyTheme(){
    const light=currentTheme()==='light';
    document.documentElement.classList.toggle('navisuite-light',light);
    document.body.classList.toggle('navisuite-light',light);
    if(light)document.documentElement.dataset.theme='light';else delete document.documentElement.dataset.theme;
  }
  function installLightTheme(){
    if(document.getElementById('navisuite-light-theme-style'))return;
    const style=document.createElement('style');style.id='navisuite-light-theme-style';
    style.textContent='html.navisuite-light{color-scheme:light}html.navisuite-light body{background:#edf5f6!important;color:#17323a!important}html.navisuite-light .app-sidebar{background:#ffffff!important;border-color:#c8dde1!important;color:#18333b!important}html.navisuite-light .app-sidebar a,html.navisuite-light .app-sidebar button,html.navisuite-light .shared-sidebar-brand{color:#23434b!important}html.navisuite-light .app-sidebar .nav-link.active,html.navisuite-light .app-sidebar .nav-link:hover{background:#d7f5ef!important;color:#075e55!important}html.navisuite-light main,html.navisuite-light header{color:#17323a!important}html.navisuite-light .section,html.navisuite-light .panel,html.navisuite-light .card,html.navisuite-light .settings-card,html.navisuite-light .ticket-card,html.navisuite-light .announcement-card{background:#ffffff!important;border-color:#bcd5da!important;color:#17323a!important}html.navisuite-light p,html.navisuite-light .muted,html.navisuite-light .intro,html.navisuite-light .hero p{color:#547078!important}html.navisuite-light input,html.navisuite-light select,html.navisuite-light textarea{background:#f8fcfc!important;border-color:#a9c9cf!important;color:#17323a!important}html.navisuite-light table,html.navisuite-light th,html.navisuite-light td{color:#17323a!important}html.navisuite-light th{background:#e9f3f4!important}html.navisuite-light .mobile-liquid-nav{background:rgba(255,255,255,.86)!important;border-color:#bdd5da!important}html.navisuite-light .mobile-liquid-nav .nav-item,html.navisuite-light .mobile-liquid-nav .nav-icon{color:#31545c!important}html.navisuite-light .mobile-liquid-nav .nav-item.active{color:#047b6c!important}html.navisuite-light body.turni-page{background:#edf5f6!important}html.navisuite-light .page-header{background:linear-gradient(135deg,#ffffff,#e6f7f4)!important;border-color:#b7d8d7!important;color:#17323a!important}html.navisuite-light .turni-header-copy,html.navisuite-light .turni-header-copy *{color:#17323a!important}html.navisuite-light .turni-header-label{color:#047b6c!important}html.navisuite-light #matrix-scroll-wrap,html.navisuite-light .scroll-wrap{background:#fff!important;border-color:#b5d1d6!important;box-shadow:0 6px 22px rgba(24,60,70,.1)!important}html.navisuite-light #matrix-scroll-wrap table{background:#fff!important}html.navisuite-light #thead-container .month-header th,html.navisuite-light #thead-container .date-header th,html.navisuite-light .month-header th,html.navisuite-light .date-header th{background:#e2f3f2!important;color:#183940!important;border-color:#b6d3d6!important}html.navisuite-light .month-visible-label,html.navisuite-light .date-head-day,html.navisuite-light .date-head-num{color:#17323a!important}html.navisuite-light #tbody tr,html.navisuite-light #tbody tr td{background:#fff!important;border-color:#d0e1e4!important;color:#183940!important}html.navisuite-light #tbody tr:nth-child(even) td{background:#f7fbfb!important}html.navisuite-light #tbody tr td.td-name{background:#eef8f7!important;color:#17323a!important;box-shadow:inset -1px 0 #b6d3d6!important}html.navisuite-light #tbody tr.logged-agent-row td{background:#d8f3ef!important}html.navisuite-light #tbody tr.logged-agent-row td.td-name{background:#c7ebe5!important}html.navisuite-light #tbody .agent-name-text,html.navisuite-light #tbody .agent-grade,html.navisuite-light #tbody .agent-number{color:#17323a!important}html.navisuite-light #tbody td[data-col]{background-color:#fff!important}html.navisuite-light .cell-pill{filter:none!important;box-shadow:0 1px 2px rgba(20,50,55,.14)!important}html.navisuite-light body.turni-page::before{background:#edf5f6!important}html.navisuite-light #tbody .cell-pill{background:#fff!important;border:2px solid currentColor!important;box-shadow:0 1px 3px rgba(20,50,55,.18)!important}html.navisuite-light #tbody tr.grado-capitano td.td-name{background:#fff3c4!important;border-left:7px solid #d6a700!important}html.navisuite-light #tbody tr.grado-capo td.td-name{background:#ffe2cf!important;border-left:7px solid #e47725!important}html.navisuite-light #tbody tr.grado-timoniere td.td-name{background:#dff6e7!important;border-left:7px solid #24a45e!important}html.navisuite-light #tbody tr.grado-motorista td.td-name{background:#e7e0ff!important;border-left:7px solid #7656cc!important}html.navisuite-light #tbody tr.grado-marinaio td.td-name{background:#e7eff2!important;border-left:7px solid #607d8b!important}html.navisuite-light #tbody tr.grado-operaio td.td-name{background:#d8f4ef!important;border-left:7px solid #159b8d!important}html.navisuite-light body.diaria-page,html.navisuite-light .diaria-page{background:#edf5f6!important;color:#17323a!important}html.navisuite-light .diaria-page .panel,html.navisuite-light .diaria-page .monthly-sheet,html.navisuite-light .diaria-page .weekly-calendar,html.navisuite-light .diaria-page .login-card{background:#fff!important;border-color:#bad5da!important;color:#17323a!important;box-shadow:0 6px 20px rgba(27,62,70,.1)!important}html.navisuite-light .diaria-page .monthly-sheet-grid,html.navisuite-light .diaria-page .weekly-days,html.navisuite-light .diaria-page .weekly-totals{background:#fff!important;border-color:#b6d3d8!important}html.navisuite-light .diaria-page .monthly-sheet-grid *,html.navisuite-light .diaria-page .weekly-calendar *{border-color:#bdd7dc!important}html.navisuite-light .diaria-page .monthly-sheet-grid .day-cell,html.navisuite-light .diaria-page .monthly-sheet-grid .value-cell,html.navisuite-light .diaria-page .weekly-days>*,html.navisuite-light .diaria-page .weekly-totals>*{background:#fff!important;color:#17323a!important}html.navisuite-light .diaria-page .monthly-sheet-grid .label-cell,html.navisuite-light .diaria-page .weekly-days .day-label{background:#eaf4f5!important;color:#17323a!important}html.navisuite-light .diaria-page .monthly-sheet-grid .total-cell,html.navisuite-light .diaria-page .weekly-month-totals{background:#e0f3f0!important;color:#17323a!important}html.navisuite-light .diaria-page .weekly-month-switch,html.navisuite-light .diaria-page .monthly-month-button,html.navisuite-light .diaria-page .monthly-today-button{background:#fff!important;color:#17323a!important;border-color:#9fc4ca!important}html.navisuite-light .diaria-page .monthly-month-button.active{background:#35cdbb!important;color:#073a36!important}html.navisuite-light body.archive-page,html.navisuite-light .archive-page{background:#edf5f6!important}html.navisuite-light .archive-page .archive-header{background:linear-gradient(135deg,#fff,#e2f5f2)!important;color:#17323a!important;border-color:#b9d5d8!important}html.navisuite-light .archive-page .document,html.navisuite-light .archive-page .admin-upload{background:#fff!important;border-color:#b8d5da!important;color:#17323a!important;box-shadow:0 6px 20px rgba(27,62,70,.1)!important}html.navisuite-light .archive-page .document strong,html.navisuite-light .archive-page .admin-upload h2{color:#17323a!important}html.navisuite-light .archive-page .document p,html.navisuite-light .archive-page .admin-upload label{color:#547078!important}html.navisuite-light .archive-page .document .pdf-icon{background:#fde8ec!important;color:#b83f55!important}html.navisuite-light .archive-page .document .ods-number{background:#dff5f1!important;color:#087c6e!important}html.navisuite-light .archive-page .document button,html.navisuite-light .archive-page .document a{background:#f8fcfc!important;color:#17596a!important;border-color:#9fc5cc!important}html.navisuite-light .archive-page .published-document{background:#f4fffc!important;border-color:#51b7a8!important}html.navisuite-light #day-panel{background:#fff!important;border-color:#9fc6cd!important;box-shadow:0 8px 24px rgba(22,56,66,.12)!important}html.navisuite-light #day-panel .panel-header,html.navisuite-light #day-panel .panel-groups,html.navisuite-light #day-panel .shift-group,html.navisuite-light #day-panel .crew-info-group{background:#fff!important;color:#17323a!important;border-color:#c0d9dd!important}html.navisuite-light #day-panel .panel-date,html.navisuite-light #day-panel .service-code,html.navisuite-light #day-panel .shift-group-label,html.navisuite-light #day-panel .c-name{color:#17323a!important}html.navisuite-light #day-panel .ship-day-badge,html.navisuite-light #day-panel .colleague-card{background:#f3f9fa!important;color:#17323a!important;border-color:#c0d9dd!important}html.navisuite-light #day-panel .c-num,html.navisuite-light #day-panel .c-grade,html.navisuite-light #day-panel .c-res{color:#547078!important}html.navisuite-light #day-panel .panel-arrow,html.navisuite-light #day-panel .shift-arrow{background:#fff!important;color:#176b87!important;border-color:#4b85df!important}html.navisuite-light #day-panel .panel-today,html.navisuite-light #day-panel .shift-nav-label{background:#e0f1ff!important;color:#175ea8!important}html.navisuite-light #day-panel .crew-shift-bubble{background:#fff!important}html.navisuite-light .diaria-page .diaria-view-switch{background:#fff!important;border-color:#b6d3d8!important;box-shadow:0 5px 16px rgba(22,56,66,.1)!important}html.navisuite-light .diaria-page .diaria-view-switch button{background:#fff!important;color:#547078!important}html.navisuite-light .diaria-page .diaria-view-switch button.active{background:#d7f4ef!important;color:#087b6e!important}html.navisuite-light .diaria-page .monthly-table{background:#fff!important;color:#17323a!important}html.navisuite-light .diaria-page .monthly-table th,html.navisuite-light .diaria-page .monthly-table td{background:#fff!important;color:#17323a!important;border-color:#bcd8dd!important;box-shadow:none!important}html.navisuite-light .diaria-page .monthly-table .monthly-label,html.navisuite-light .diaria-page .monthly-table .monthly-day-head{background:#edf6f7!important;color:#17323a!important}html.navisuite-light .diaria-page .monthly-table .monthly-total-head,html.navisuite-light .diaria-page .monthly-table .weekly-total-head{background:#d9f1ee!important;color:#17323a!important;box-shadow:-5px 0 10px rgba(22,56,66,.1)!important}html.navisuite-light .diaria-page .monthly-table .monthly-total-cell,html.navisuite-light .diaria-page .monthly-table .weekly-total-cell{background:#eaf7f5!important;color:#17323a!important;box-shadow:-5px 0 10px rgba(22,56,66,.1)!important}html.navisuite-light .diaria-page .monthly-table .monthly-total-cell *,html.navisuite-light .diaria-page .monthly-table .weekly-total-cell *,html.navisuite-light .diaria-page .monthly-table .monthly-total-head *,html.navisuite-light .diaria-page .monthly-table .weekly-total-head *{color:#17323a!important}html.navisuite-light .diaria-page .monthly-table .selected-col{background:#fff8d7!important}html.navisuite-light .diaria-page .monthly-table .today-col{background:#e1f6f2!important}html.navisuite-light .diaria-page .monthly-table .shift-cell{background:#f8fbfc!important;color:#17323a!important}html.navisuite-light .diaria-page .monthly-table .row-service .shift-cell{background:#f2fbfa!important}html.navisuite-light .diaria-page .monthly-table .service-value,html.navisuite-light .diaria-page .monthly-table .monthly-cell-value{color:#17323a!important}html.navisuite-light .monthly-value-overlay,html.navisuite-light .weekly-edit-overlay{background:rgba(220,238,240,.72)!important}html.navisuite-light .monthly-value-dialog,html.navisuite-light .weekly-edit-dialog{background:#fff!important;color:#17323a!important;border-color:#a8ccd2!important}html.navisuite-light .monthly-value-dialog h3,html.navisuite-light .weekly-edit-dialog h3{color:#17323a!important}';
    document.head.appendChild(style);
    // Superfici visibili mentre la tabella di NaviTurni sta ancora caricando.
    // Restano chiare anche prima che arrivino i dati del periodo.
    const loadingStyle=document.createElement('style');loadingStyle.id='navisuite-light-loading-style';
    loadingStyle.textContent='html.navisuite-light #welcome-notice{background:#fff!important;border-color:#83c9c2!important;color:#17323a!important;box-shadow:0 6px 20px rgba(22,56,66,.1)!important}html.navisuite-light #welcome-notice h3{color:#087b6e!important}html.navisuite-light #welcome-notice p{color:#547078!important}html.navisuite-light #welcome-notice .loading-spinner{border-color:#c9e1e2!important;border-top-color:#22bda9!important}html.navisuite-light #matrix-scroll-wrap #thead-container .month-header th,html.navisuite-light #matrix-scroll-wrap #thead-container .month-header th[data-month],html.navisuite-light #matrix-scroll-wrap .month-header th[data-month]{background:#e7f5f4!important;color:#17323a!important;box-shadow:none!important}html.navisuite-light #matrix-scroll-wrap #thead-container .month-header th[data-month] .month-visible-label,html.navisuite-light #matrix-scroll-wrap .month-header th[data-month] .month-visible-label{background:transparent!important;color:#17323a!important}html.navisuite-light .app-sidebar .sidebar-agent-name,html.navisuite-light .app-sidebar .login-user-name{background:#f3f9fa!important;border-color:#b9d7dc!important;color:#17323a!important;box-shadow:none!important}html.navisuite-light .app-sidebar .sidebar-agent-name:before{color:#417078!important}html.navisuite-light .app-sidebar .sidebar-action,html.navisuite-light .app-sidebar .login-user-panel button:not(.login-user-name){background:#fff!important;border-color:#b9d7dc!important;color:#31545c!important}html.navisuite-light .app-sidebar .sidebar-action.sidebar-exit,html.navisuite-light .app-sidebar .login-user-panel .sidebar-exit{background:#fff5f6!important;border-color:#efb7c0!important;color:#b53c4c!important}html.navisuite-light .app-sidebar .sidebar-footer-update{background:#e7f7f4!important;border-color:#83c9c2!important;color:#087b6e!important}html.navisuite-light .app-sidebar .sidebar-data-status{color:#17856f!important}html.navisuite-light body.orario-page,html.navisuite-light .orario-page{background:#edf5f6!important;color:#17323a!important}html.navisuite-light .orario-page .og-page-chart,html.navisuite-light .orario-page .og-chart-wrap,html.navisuite-light .orario-page .card,html.navisuite-light .orario-page dialog{background:#fff!important;color:#17323a!important;border-color:#b9d5da!important}html.navisuite-light .orario-page .btn,html.navisuite-light .orario-page button{background:#fff!important;color:#17323a!important;border-color:#a9cbd1!important}';
    document.head.appendChild(loadingStyle);
    const finalLightStyle=document.createElement('style');finalLightStyle.textContent='html.navisuite-light .diaria-page .topbar{background:linear-gradient(135deg,#fff,#e7f7f4)!important;border-bottom-color:#b7d8d7!important}html.navisuite-light .diaria-page .topbar h1{color:#17323a!important}html.navisuite-light .diaria-page .topbar .eyebrow{color:#087b6e!important}html.navisuite-light .diaria-page .topbar-context{color:#547078!important}html.navisuite-light .diaria-page .monthly-table .shift-column{background:color-mix(in srgb,var(--day-color) 13%,#fff)!important;border-color:color-mix(in srgb,var(--day-color) 35%,#c2dce0)!important}html.navisuite-light .diaria-page .monthly-table thead .shift-column{background:color-mix(in srgb,var(--day-color) 22%,#f7fcfc)!important;box-shadow:inset 0 3px var(--day-color)!important}html.navisuite-light .diaria-page .monthly-table .row-service .shift-column{background:color-mix(in srgb,var(--day-color) 20%,#fff)!important}html.navisuite-light .diaria-page .weekly-day[style*="--shift-color"]{background:color-mix(in srgb,var(--shift-color) 12%,#fff)!important;border-color:color-mix(in srgb,var(--shift-color) 34%,#bdd7dc)!important}html.navisuite-light .diaria-page .weekly-day[style*="--shift-color"] .weekly-service{background:color-mix(in srgb,var(--shift-color) 18%,#fff)!important;border-color:color-mix(in srgb,var(--shift-color) 52%,#bdd7dc)!important}html.navisuite-light .liquid-modal-overlay,html.navisuite-light .weekly-edit-overlay,html.navisuite-light .monthly-value-overlay{background:rgba(225,241,242,.82)!important}html.navisuite-light .liquid-modal-content,html.navisuite-light .weekly-edit-dialog,html.navisuite-light .monthly-value-dialog,html.navisuite-light .monthly-shift-dialog,html.navisuite-light .monthly-bubble-dialog{background:#fff!important;color:#17323a!important;border-color:#a8ccd2!important;box-shadow:0 18px 48px rgba(22,56,66,.18)!important}html.navisuite-light .liquid-modal-content *,html.navisuite-light .weekly-edit-dialog h3,html.navisuite-light .monthly-value-dialog h3{color:#17323a!important}html.navisuite-light .liquid-modal-content input,html.navisuite-light .liquid-modal-content select,html.navisuite-light .weekly-edit-dialog input,html.navisuite-light .weekly-edit-dialog select,html.navisuite-light .monthly-value-dialog input,html.navisuite-light .monthly-value-dialog select{background:#f8fcfc!important;color:#17323a!important;border-color:#aacbd1!important}';document.head.appendChild(finalLightStyle);
  }
  installLightTheme();applyTheme();
  if(currentTheme()==='light'){
    const menuToggleLight=document.createElement('style');
    menuToggleLight.textContent='html.navisuite-light .sidebar-collapse-button{background:#fff!important;border-color:#9fc4ca!important;color:#176b87!important;box-shadow:6px 0 16px rgba(22,56,66,.14)!important}html.navisuite-light .sidebar-collapse-button:hover{background:#e5f6f3!important;color:#087b6e!important}html.navisuite-light .app-sidebar .shifts-filter-block{background:#f7fcfc!important;border-color:#bdd8dc!important}html.navisuite-light .app-sidebar .filter-label{color:#547078!important}html.navisuite-light .diaria-page .weekly-calendar,html.navisuite-light .diaria-page .weekly-week{background:#fff!important;border-color:#bdd8dc!important}html.navisuite-light .diaria-page .weekly-week-heading{background:#e8f5f4!important;border-color:#bdd8dc!important}html.navisuite-light .diaria-page .weekly-week-heading>div:first-child small{color:#087b6e!important}html.navisuite-light .diaria-page .weekly-week-heading>div:first-child strong{color:#17323a!important}html.navisuite-light .diaria-page .weekly-days-row{background:#bdd8dc!important}html.navisuite-light .diaria-page .weekly-day{background:#fff!important;color:#17323a!important}html.navisuite-light .diaria-page .weekly-day-name,html.navisuite-light .diaria-page .weekly-field,html.navisuite-light .diaria-page .weekly-field strong,html.navisuite-light .diaria-page .weekly-service{color:#17323a!important}html.navisuite-light .diaria-page .weekly-service{background:#f8fcfc!important;border-color:#b7d4d8!important}html.navisuite-light .diaria-page .weekly-field,html.navisuite-light .diaria-page .weekly-bubble{background:#f5fafb!important;border-color:#c7dfe2!important}html.navisuite-light .diaria-page .weekly-more{background:#fff5fb!important;border-color:#efbdd9!important;color:#b33b81!important}html.navisuite-light .diaria-page .weekly-week-totals span,html.navisuite-light .diaria-page .weekly-total-bubble{background:#f5fafb!important;border-color:#b9d7dc!important}html.navisuite-light .diaria-page .weekly-week-totals small,html.navisuite-light .diaria-page .weekly-week-totals b{color:#17323a!important}html.navisuite-light #day-panel .panel-date,html.navisuite-light #day-panel .shift-nav-label,html.navisuite-light #day-panel .crew-tooltip{background:#f8fcfc!important;color:#17323a!important;border-color:#9fc6cd!important}html.navisuite-light #day-panel .service-code{background:transparent!important;color:var(--day-color,#176b87)!important}html.navisuite-light #day-panel .crew-tooltip *{color:#17323a!important}';
    document.head.appendChild(menuToggleLight);
  }
  const isPinChangePage=page==='diaria'&&new URLSearchParams(location.search).has('pin');
  if(!sessionAgent){
    document.documentElement.style.display='none';
    location.replace('index.html');
    return;
  }
  // NaviDiaria è disponibile dal menu mobile a ogni agente autenticato.
  if((page==='agenti'||page==='aggiornamenti')&&!isAdminAgent(sessionAgent)&&!(page==='aggiornamenti'&&isHibaBarista(sessionAgent))){location.replace('index.html');return}
  if(window.NaviAdminFirebase?.touchUserPresence){
    const signalPresence=()=>window.NaviAdminFirebase.touchUserPresence(sessionAgent).catch(()=>{});
    signalPresence();
    setInterval(signalPresence,45000);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)signalPresence();});
  }
  // Mantiene allineate le due chiavi di sessione usate dalle pagine storiche.
  try{
    if(!localStorage.getItem('navidiaria.activeAgent'))localStorage.setItem('navidiaria.activeAgent',JSON.stringify(sessionAgent));
    if(!localStorage.getItem('naviturni_logged_agent'))localStorage.setItem('naviturni_logged_agent',JSON.stringify({
      id:sessionAgent.id,
      name:sessionAgent.name||sessionAgent.agente||sessionAgent.cognome||'',
      residence:sessionAgent.residence||sessionAgent.residenza||'',
      qualifica:sessionAgent.qualifica||'',
      role:sessionAgent.role||''
    }));
  }catch{}
  // Orario è ora accessibile a TUTTI gli utenti (rimosso controllo admin)
  if(isBaristaSession&&page==='aggiornamenti'&&!isHibaBarista(sessionAgent)){location.replace('naviturni.html');return}
  const item=(href,icon,label,active=false,id='')=>`<a ${id?`id="${id}" `:''}class="nav-link${active?' active':''}" href="${href}"${['competencyNav','adminNav','archiveAdminNav'].includes(id)?' hidden':''}><span>${icon}</span>${label}</a>`;
  let common='',specific='',user='',status='<div id="odsVariationStatus" class="ods-variation-status" hidden></div>';
  const adminOrarioLink=item('Orario.html','◴','Orario',false,'orarioNavLink');

  if(page==='diaria'){
    common=item('naviturni.html','▦','NaviTurni')+item('cambi_turno.html','⇄','Trova turno',false,'trovaTurnoNavLink')+item('#oggi','≈','NaviDiaria',true,'diariaNavLink')+item('documenti.html','▤','Documenti',false,'archiveNavLink')+adminOrarioLink+item('impostazioni.html','⚙','Impostazioni');
    specific=`<span class="sidebar-menu-label">DIARIA</span>${item('#registro','≡','Registro mese')}${item('#consultivo','≈','Consultivo settimane')}${item('#competenze','◇','Competenze',false,'competencyNav')}${item('agenti.html','♙','Gestione agenti',false,'adminNav')}`;
    user=`<div class="sidebar-user-actions"><button id="syncShifts" class="sidebar-footer-update" type="button"><span>↻</span>Aggiorna</button><small id="syncStatus" class="sidebar-data-status">Locale</small><strong id="sidebarAgentName" class="sidebar-agent-name">AGENTE</strong><button id="logoutButton" class="sidebar-action sidebar-exit" type="button" hidden>Esci</button><button id="pinSettingsButton" class="sidebar-action" type="button" hidden>Cambia PIN</button></div>`;
  }else if(page==='trova'){
    common=item('naviturni.html','▦','NaviTurni')+item('#turni-operativi','⇄','Trova turno',true)+item('navidiaria.html','≈','NaviDiaria',false,'diariaNavLink')+item('documenti.html','▤','Documenti',false,'archiveNavLink')+adminOrarioLink+item('impostazioni.html','⚙','Impostazioni');
    // Elementi tecnici richiesti dal codice di NaviTurni: restano nel DOM ma non sono visibili.
    specific=`<div hidden aria-hidden="true"><button id="togglePastBtn" type="button"></button><div id="shift-filter-container"><div id="top-residence-buttons"></div><div id="shift-buttons-wrapper"></div></div></div>`;
    user=`<div class="sidebar-user-actions login-user-panel" id="login-user-panel"><button id="refreshBtn" class="sidebar-footer-update" onclick="ricaricaDati()" type="button"><span>↻</span>Aggiorna</button><small id="turniMenuStatus" class="sidebar-data-status">Locale</small><button class="sidebar-agent-name login-user-name" id="login-user-name" type="button" onclick="repinLoggedAgent()"></button><button id="login-exit-button" class="sidebar-action sidebar-exit" type="button" onclick="logoutAgent()">Esci</button><button id="login-change-button" class="sidebar-action" type="button" onclick="location.href='navidiaria.html?pin=1'">Cambia PIN</button></div>`;
  }else if(page==='turni'){
    common=item('#turni-operativi','▦','NaviTurni',true)+item('cambi_turno.html','⇄','Trova turno',false,'trovaTurnoNavLink')+item('navidiaria.html','≈','NaviDiaria',false,'diariaNavLink')+item('documenti.html','▤','Documenti',false,'archiveNavLink')+adminOrarioLink+item('impostazioni.html','⚙','Impostazioni');
    specific=`<span class="sidebar-menu-label">TURNI</span><button id="togglePastBtn" class="nav-link sidebar-nav-button" onclick="togglePastColumns()" type="button"><span>◷</span>Mostra passato</button><div class="shifts-filter-block" id="shift-filter-container"><div class="top-filter-controls"><div class="top-residence-controls"><span class="filter-label">Residenze</span><div class="coverage-residence-buttons" id="top-residence-buttons"></div></div><div class="top-filter-group"><span class="filter-label">Corse</span><div class="shift-buttons-grid" id="shift-buttons-wrapper"></div></div></div></div>`;
    user=`<div class="sidebar-user-actions login-user-panel" id="login-user-panel"><button id="refreshBtn" class="sidebar-footer-update" onclick="ricaricaDati()" type="button"><span>↻</span>Aggiorna</button><small id="turniMenuStatus" class="sidebar-data-status">Locale</small><button class="sidebar-agent-name login-user-name" id="login-user-name" type="button" onclick="repinLoggedAgent()"></button><button id="login-exit-button" class="sidebar-action sidebar-exit" type="button" onclick="logoutAgent()">Esci</button><button id="login-change-button" class="sidebar-action" type="button" onclick="location.href='navidiaria.html?pin=1'">Cambia PIN</button></div>`;
  }else if(page==='orario' || page==='orario-data'){
    const graficoLink=item('Orario.html','◴','Grafico interattivo',page==='orario','orarioGraphNavLink');
    const tabelleLink=item('orari-tabella.html','▥','Orari tabella',page==='orario-data','orarioDataNavLink');
    common=item('naviturni.html','▦','NaviTurni')+item('cambi_turno.html','⇄','Trova turno',false,'trovaTurnoNavLink')+item('navidiaria.html','≈','NaviDiaria',false,'diariaNavLink')+item('documenti.html','▤','Documenti',false,'archiveNavLink')+item('Orario.html','◴','Orario',true,'orarioNavLink')+item('impostazioni.html','⚙','Impostazioni');
    specific=`<span class="sidebar-menu-label">ORARIO</span>${graficoLink}${tabelleLink}`;
    user=`<div class="sidebar-user-actions"><strong id="settingsSidebarAgent" class="sidebar-agent-name">AGENTE</strong><button id="settingsLogout" class="sidebar-action sidebar-exit" type="button">Esci</button><button id="settingsChangePin" class="sidebar-action" type="button">Cambia PIN</button></div>`;
    status='';
  }else if(page==='settings'){
    common=item('naviturni.html','▦','NaviTurni')+item('cambi_turno.html','⇄','Trova turno',false,'trovaTurnoNavLink')+item('navidiaria.html','≈','NaviDiaria',false,'diariaNavLink')+item('documenti.html','▤','Documenti',false,'archiveNavLink')+adminOrarioLink+item('#altre-preferenze','⚙','Impostazioni',true);
    specific=`<span class="sidebar-menu-label">PREFERENZE</span>${item('#altre-preferenze','≡','Altre preferenze')}${isAdminAgent(sessionAgent)?item('aggiornamenti.html','↻','Aggiornamenti turni')+item('agenti.html','♙','Gestione agenti'):''}`;
    user=`<div class="sidebar-user-actions"><strong id="settingsSidebarAgent" class="sidebar-agent-name">AGENTE</strong><button id="settingsLogout" class="sidebar-action sidebar-exit" type="button">Esci</button><button id="settingsChangePin" class="sidebar-action" type="button">Cambia PIN</button></div>`;
  }else if(page==='tickets'){
    common=item('naviturni.html','▦','NaviTurni')+item('cambi_turno.html','⇄','Trova turno',false,'trovaTurnoNavLink')+item('navidiaria.html','≈','NaviDiaria',false,'diariaNavLink')+item('documenti.html','▤','Documenti',false,'archiveNavLink')+adminOrarioLink+item('impostazioni.html','⚙','Impostazioni');
    specific=`<span class="sidebar-menu-label">ASCOLTO</span>${item('#ticket-form','✉','Nuova segnalazione',true)}`;
    user=`<div class="sidebar-user-actions"><strong id="settingsSidebarAgent" class="sidebar-agent-name">AGENTE</strong><button id="settingsLogout" class="sidebar-action sidebar-exit" type="button">Esci</button><button id="settingsChangePin" class="sidebar-action" type="button">Cambia PIN</button></div>`;
  }else if(page==='agenti'||page==='aggiornamenti'){
    const isAgenti=page==='agenti';
    common=item('naviturni.html','▦','NaviTurni')+item('cambi_turno.html','⇄','Trova turno',false,'trovaTurnoNavLink')+item('navidiaria.html','≈','NaviDiaria',false,'diariaNavLink')+item('documenti.html','▤','Documenti',false,'archiveNavLink')+adminOrarioLink+item('impostazioni.html','⚙','Impostazioni');
    specific=`<span class="sidebar-menu-label">AMMINISTRAZIONE</span>${item('aggiornamenti.html','↻','Aggiornamenti turni',!isAgenti,'aggiornamentiNav')}${item('agenti.html','♙','Gestione agenti',isAgenti,'agentiNav')}`;
    user=`<div class="sidebar-user-actions"><strong id="settingsSidebarAgent" class="sidebar-agent-name">AGENTE</strong><button id="settingsLogout" class="sidebar-action sidebar-exit" type="button">Esci</button><button id="settingsChangePin" class="sidebar-action" type="button">Cambia PIN</button></div>`;
  }else{
    common=item('naviturni.html','▦','NaviTurni')+item('navidiaria.html','≈','NaviDiaria',false,'diariaNavLink')+item('#turni-docs','▤','Documenti',true,'archiveNavLink')+adminOrarioLink+item('impostazioni.html','⚙','Impostazioni');
    specific=`<span class="sidebar-menu-label">DOCUMENTI</span>${item('#turni-docs','▦','Turni e bozze')}${item('#ods-docs','≡','ODS 2026')}${item('#adminUploadPanel','＋','Carica documenti',false,'archiveAdminNav')}`;
    user=`<div class="sidebar-user-actions"><button class="sidebar-footer-update" type="button" onclick="typeof loadDocuments==='function'?loadDocuments():location.reload()"><span>↻</span>Aggiorna</button><small id="archiveMenuStatus" class="sidebar-data-status">Locale</small><strong id="archiveSidebarAgent" class="sidebar-agent-name">AGENTE</strong><button id="archiveLogout" class="sidebar-action sidebar-exit" type="button">Esci</button><button id="archiveChangePin" class="sidebar-action" type="button">Cambia PIN</button></div>`;
  }

  if(isBaristaSession&&page==='turni'){
    common=item('#turni-operativi','▦','NaviTurni',true);
    specific=`<span class="sidebar-menu-label">TURNI</span><button id="togglePastBtn" class="nav-link sidebar-nav-button" onclick="togglePastColumns()" type="button"><span>◷</span>Mostra passato</button><div id="shift-filter-container" hidden aria-hidden="true"><div id="top-residence-buttons"></div><div id="shift-buttons-wrapper"></div></div>`;
    status='';
  }else if(isBaristaSession&&isPinChangePage){
    common=item('naviturni.html','▦','NaviTurni',false,true);
    specific='';
    status='';
  }

  // Collegamento amministrativo comune: non viene mai creato per gli utenti
  // ordinari o per le bariste. In Impostazioni è già presente nella sezione
  // PREFERENZE, quindi evitiamo di mostrarlo due volte.
  if(isAdminAgent(sessionAgent)&&page!=='settings'&&page!=='agenti'&&page!=='aggiornamenti'){
    common+=item('aggiornamenti.html','↻','Aggiornamenti');
    common+=item('agenti.html','♙','Agenti');
  }

  // Gestione navi resta, per ora, un collegamento riservato agli amministratori.
  if(isAdminAgent(sessionAgent))common+=item('gestione_navi.html','▤','Navi',isNaviPage,'naviAdminNav');

  common=item('index.html','⌂','Home')+common+item('segnalazioni.html','✉','Segnalazioni',page==='tickets');

  const brandTitle=page==='diaria'?'NaviSuite Diaria':page==='trova'?'NaviSuite Cambi':page==='turni'?'NaviSuite Turni':page==='orario'?'NaviSuite Orario':page==='orario-data'?'NaviSuite Orari':page==='settings'?'NaviSuite Impostazioni':page==='agenti'?'NaviSuite Agenti':page==='aggiornamenti'?'NaviSuite Aggiornamenti':page==='tickets'?'NaviSuite Segnalazioni':'NaviSuite Documenti';
  const version=`<div class="shared-app-version" aria-label="Versione applicazione">Versione ${APP_VERSION}</div>`;

  const brandHref=isBaristaSession?(page==='turni'?'#turni-operativi':'naviturni.html'):'index.html';
  sidebar.innerHTML=`<a class="shared-sidebar-brand" href="${brandHref}"><span class="shared-brand-mark">N</span><strong>${brandTitle}</strong></a><nav>${common}${specific}</nav>${user}${status}${version}`;
  if(!canUseDiaria(sessionAgent))sidebar.querySelectorAll('a[href="navidiaria.html"],#diariaNavLink').forEach(link=>link.hidden=true);

  function installThemeSettings(){
    if(page!=='settings'||!isLightThemeTester||document.getElementById('theme-test-setting'))return;
    const main=document.querySelector('main');if(!main)return;
    const section=document.createElement('section');section.id='theme-test-setting';section.className='section';
    section.innerHTML='<div class="section-head"><div><h2>Tema grafico <small style="color:#2dd4bf">· prova personale</small></h2><p>Questa scelta è visibile e applicata solo al tuo profilo di prova.</p></div></div><div class="field" style="max-width:300px"><label for="navisuite-theme-select">Aspetto</label><select id="navisuite-theme-select"><option value="dark">Scuro</option><option value="light">Chiaro</option></select></div>';
    const target=main.querySelector('.section');if(target)main.insertBefore(section,target);else main.appendChild(section);
    const select=section.querySelector('select');select.value=currentTheme();
    select.addEventListener('change',()=>{localStorage.setItem(themeKey,select.value);applyTheme();});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installThemeSettings,{once:true});else installThemeSettings();

  const settingsAgent=sidebar.querySelector('#settingsSidebarAgent');
  if(settingsAgent) settingsAgent.textContent=String(sessionAgent?.name||sessionAgent?.cognome||'AGENTE').toLocaleUpperCase('it');
  const settingsLogout=sidebar.querySelector('#settingsLogout');
  if(settingsLogout)settingsLogout.addEventListener('click',()=>{
    localStorage.removeItem('navidiaria.activeAgent');
    localStorage.removeItem('naviturni_logged_agent');
    location.href='index.html';
  });
  const settingsChangePin=sidebar.querySelector('#settingsChangePin');
  if(settingsChangePin)settingsChangePin.addEventListener('click',()=>{location.href='navidiaria.html?pin=1'});

  const versionEl=sidebar.querySelector('.shared-app-version');
  if(versionEl){
    versionEl.style.cssText='margin:10px 12px 8px;padding-top:10px;border-top:1px solid rgba(124,173,189,.18);color:#19e3c1;font-size:11px;font-weight:700;letter-spacing:.04em;text-align:center';
  }

  const odsStatusEl=sidebar.querySelector('#odsVariationStatus');
  if(odsStatusEl){
    odsStatusEl.style.cssText='margin:8px 12px 2px;color:#19e3c1;font-size:11px;font-weight:700;letter-spacing:.04em;text-align:center;white-space:nowrap;background:none;border:none;padding:0';
  }


  function installFilterBubbleStyle(){
    if(document.getElementById('navi-filter-bubbles-style')) return;

    const style=document.createElement('style');
    style.id='navi-filter-bubbles-style';
    style.textContent=`
      .app-sidebar .top-filter-controls,
      .app-sidebar .top-residence-controls,
      .app-sidebar .top-filter-group{
        display:flex!important;
        flex-direction:column!important;
        align-items:center!important;
        justify-content:center!important;
        width:100%!important;
        text-align:center!important;
      }

      .app-sidebar .filter-label{
        display:block!important;
        width:100%!important;
        margin:5px 0 8px!important;
        color:#86a5af!important;
        font-size:9px!important;
        font-weight:900!important;
        letter-spacing:.14em!important;
        text-align:center!important;
      }

      .app-sidebar #top-residence-buttons,
      .app-sidebar #coverage-residence-buttons{
        display:grid!important;
        grid-template-columns:repeat(2,minmax(0,1fr))!important;
        align-items:center!important;
        justify-content:center!important;
        gap:7px!important;
        width:100%!important;
      }

      .app-sidebar #shift-buttons-wrapper,
      .app-sidebar #coverage-shift-buttons{
        display:grid!important;
        grid-template-columns:repeat(3,minmax(0,1fr))!important;
        align-items:center!important;
        justify-content:center!important;
        gap:7px!important;
        width:100%!important;
      }

      .app-sidebar #top-residence-buttons button,
      .app-sidebar #shift-buttons-wrapper button,
      .app-sidebar #coverage-residence-buttons button,
      .app-sidebar #coverage-shift-buttons button{
        --bubble-color:#2dd4bf;
        --bubble-bg:rgba(45,212,191,.11);
        display:flex!important;
        align-items:center!important;
        justify-content:center!important;
        width:100%!important;
        min-width:0!important;
        min-height:30px!important;
        margin:0!important;
        padding:6px 11px!important;
        border:1px solid color-mix(in srgb,var(--bubble-color) 52%,transparent)!important;
        border-radius:999px!important;
        background:var(--bubble-bg)!important;
        color:var(--bubble-color)!important;
        box-shadow:inset 0 0 0 1px rgba(255,255,255,.025)!important;
        font:800 10px/1 Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;
        letter-spacing:.03em!important;
        text-transform:uppercase!important;
        cursor:pointer!important;
        transition:transform .15s ease,box-shadow .15s ease,background .15s ease!important;
      }

      .app-sidebar #top-residence-buttons button:hover,
      .app-sidebar #shift-buttons-wrapper button:hover,
      .app-sidebar #coverage-residence-buttons button:hover,
      .app-sidebar #coverage-shift-buttons button:hover{
        transform:translateY(-1px)!important;
        box-shadow:0 5px 13px color-mix(in srgb,var(--bubble-color) 18%,transparent)!important;
      }

      .app-sidebar #top-residence-buttons button.active,
      .app-sidebar #shift-buttons-wrapper button.active,
      .app-sidebar #coverage-residence-buttons button.active,
      .app-sidebar #coverage-shift-buttons button.active{
        background:var(--bubble-color)!important;
        border-color:var(--bubble-color)!important;
        color:#06171d!important;
        box-shadow:0 0 0 2px color-mix(in srgb,var(--bubble-color) 22%,transparent),
                   0 5px 15px color-mix(in srgb,var(--bubble-color) 25%,transparent)!important;
      }

      .app-sidebar .shifts-filter-block{
        align-items:center!important;
        justify-content:center!important;
        width:100%!important;
        padding:11px 8px!important;
        border:1px solid rgba(66,105,116,.38)!important;
        border-radius:13px!important;
        background:rgba(10,35,45,.56)!important;
        text-align:center!important;
      }
    `;
    document.head.appendChild(style);

    const residenceColors={
      DESENZANO:['#22d3ee','rgba(34,211,238,.12)'],
      MADERNO:['#fb923c','rgba(251,146,60,.12)'],
      RIVA:['#c084fc','rgba(192,132,252,.12)'],
      PESCHIERA:['#4ade80','rgba(74,222,128,.12)']
    };

    const shiftColors={
      D1:['#5b8cff','rgba(91,140,255,.13)'],
      R1:['#5b8cff','rgba(91,140,255,.13)'],
      P1:['#5b8cff','rgba(91,140,255,.13)'],
      T1:['#5b8cff','rgba(91,140,255,.13)'],

      D2:['#46c98a','rgba(70,201,138,.13)'],
      R2:['#46c98a','rgba(70,201,138,.13)'],
      P2:['#46c98a','rgba(70,201,138,.13)'],
      T2:['#46c98a','rgba(70,201,138,.13)'],

      D3:['#f59a52','rgba(245,154,82,.13)'],
      R3:['#f59a52','rgba(245,154,82,.13)'],
      P3:['#f59a52','rgba(245,154,82,.13)'],
      M1:['#f59a52','rgba(245,154,82,.13)'],

      D4:['#dc74d2','rgba(220,116,210,.13)'],
      R4:['#dc74d2','rgba(220,116,210,.13)'],
      P4:['#dc74d2','rgba(220,116,210,.13)'],

      BIS:['#67d7e6','rgba(103,215,230,.13)'],
      DT:['#f4df57','rgba(244,223,87,.12)'],
      POND:['#fb9292','rgba(251,146,146,.13)'],
      PONM:['#fb9292','rgba(251,146,146,.13)'],
      AGB:['#6eb1ff','rgba(110,177,255,.13)'],
      AGM:['#6eb1ff','rgba(110,177,255,.13)'],
      AGT:['#6eb1ff','rgba(110,177,255,.13)'],
      CAR:['#f973a8','rgba(249,115,168,.13)'],
      CAP:['#f973a8','rgba(249,115,168,.13)'],
      SR1:['#a78bfa','rgba(167,139,250,.13)'],
      TERRA:['#94a3b8','rgba(148,163,184,.13)']
    };

    function paintButton(button,type){
      const raw=(button.dataset.res||button.dataset.shift||button.textContent||'')
        .trim().toUpperCase().replace(/\s+/g,'');
      const palette=type==='residence'
        ? residenceColors[raw]
        : shiftColors[raw] || ['#94a3b8','rgba(148,163,184,.13)'];
      button.style.setProperty('--bubble-color',palette[0]);
      button.style.setProperty('--bubble-bg',palette[1]);
    }

    function refreshFilterBubbleColors(){
      document.querySelectorAll(
        '#top-residence-buttons button,#coverage-residence-buttons button'
      ).forEach(button=>paintButton(button,'residence'));

      document.querySelectorAll(
        '#shift-buttons-wrapper button,#coverage-shift-buttons button'
      ).forEach(button=>paintButton(button,'shift'));
    }

    refreshFilterBubbleColors();

    const observer=new MutationObserver(refreshFilterBubbleColors);
    [
      'top-residence-buttons',
      'shift-buttons-wrapper',
      'coverage-residence-buttons',
      'coverage-shift-buttons'
    ].forEach(id=>{
      const node=document.getElementById(id);
      if(node) observer.observe(node,{childList:true,subtree:true});
    });

    window.refreshFilterBubbleColors=refreshFilterBubbleColors;
    setTimeout(refreshFilterBubbleColors,250);
    setTimeout(refreshFilterBubbleColors,1000);
  }

  installFilterBubbleStyle();

  const diariaNavLink=sidebar.querySelector('#diariaNavLink');if(diariaNavLink)diariaNavLink.hidden=!canUseDiaria(sessionAgent);
  const archiveNavLink=sidebar.querySelector('#archiveNavLink');if(archiveNavLink)archiveNavLink.hidden=isBaristaAgent(sessionAgent);
  sidebar.classList.add('menu-ready');

  sidebar.addEventListener('click',event=>{
    const link=event.target.closest('a[data-navi-tab]');
    if(!link)return;
    event.preventDefault();
    const target=window.open(link.href,link.dataset.naviTab);
    if(target)target.focus();
  });

  const toggle=document.createElement('button');
  toggle.className='sidebar-collapse-button';
  toggle.type='button';
  document.body.appendChild(toggle);

  function syncCollapseToggle(){
    toggle.hidden=window.innerWidth<=800;
  }

  function setCollapsed(value){
    document.body.classList.toggle('menu-collapsed',value);
    toggle.setAttribute('aria-expanded',String(!value));
    toggle.setAttribute('aria-label',value?'Mostra menu':'Nascondi menu');
    toggle.textContent=value?'›':'‹';
    syncCollapseToggle();
  }

  toggle.addEventListener('click',()=>setCollapsed(!document.body.classList.contains('menu-collapsed')));
  window.addEventListener('resize',syncCollapseToggle);
  sidebar.querySelector('nav')?.addEventListener('click',event=>{
    if(window.innerWidth<=800&&event.target.closest('a'))setCollapsed(true);
  });
  setCollapsed(true);

  async function refreshOdsVariationStatus(){
    const target=document.getElementById('odsVariationStatus');if(!target||!window.NaviFirebaseAuth)return;
    let agent=null;try{agent=JSON.parse(localStorage.getItem('navidiaria.activeAgent')||localStorage.getItem('naviturni_logged_agent')||'null')}catch{}
    const agentId=String(agent?.id||'');
    const pinHash=localStorage.getItem(`navidiaria.pin.${agentId}`)||'';
    if(!agentId||!pinHash){target.hidden=true;return}
    try{
      const result=await NaviFirebaseAuth.request('variation_status',{agentId,pinHash}),info=result.variationStatus;
      if(!info||Number(info.count)<=1){target.hidden=true;return}
      target.textContent=`ODS nr. ${info.number}`;
      target.hidden=false;
    }catch{
      target.hidden=true;
    }
  }

  window.refreshOdsVariationStatus=refreshOdsVariationStatus;
  window.addEventListener('DOMContentLoaded',refreshOdsVariationStatus);

  function installUniversalMobileMenu(){
    document.querySelectorAll('.mobile-liquid-nav,.admin-mobile-nav,.hiba-updates-mobile-nav,.hiba-mobile-nav').forEach(node=>node.hidden=true);
    document.getElementById('navisuite-mobile-nav')?.remove();
    document.getElementById('navisuite-mobile-menu')?.remove();

    const nav=document.createElement('nav');
    nav.id='navisuite-mobile-nav';
    nav.className='navisuite-mobile-nav';
    nav.setAttribute('aria-label','Navigazione principale');
    const primary=[
      ['naviturni.html','▦','Turni','turni'],
      ['cambi_turno.html','⇄','Cambio','trova'],
      ['navidiaria.html','≈','Diaria','diaria'],
      ['documenti.html','▤','Documenti','archive']
    ];
    nav.innerHTML=primary.map(([href,icon,label,key])=>`<a href="${href}" class="${page===key?'active':''}"><span>${icon}</span><b>${label}</b></a>`).join('')+'<button type="button" data-open-mobile-menu aria-label="Apri menu"><span>☰</span><b>Menu</b></button>';
    document.body.appendChild(nav);

    const overlay=document.createElement('div');
    overlay.id='navisuite-mobile-menu';
    overlay.className='navisuite-mobile-menu';
    overlay.hidden=true;
    const isAdmin=isAdminAgent(sessionAgent),canUpdate=isAdmin||isHibaBarista(sessionAgent);
    const links=[];
    if(isAdmin)links.push(['impostazioni.html','⚙','Impostazioni']);
    if(canUpdate)links.push(['aggiornamenti.html','↻','Aggiornamenti']);
    if(isAdmin)links.push(['agenti.html','♙','Agenti']);
    if(isAdmin)links.push(['Orario.html','◴','Orario']);
    links.push(['segnalazioni.html','✉','Segnalazioni']);
    overlay.innerHTML=`<section><header><strong>Menu NaviSuite</strong><button type="button" data-close-mobile-menu aria-label="Chiudi">✕</button></header><div class="navisuite-mobile-menu-links">${links.map(([href,icon,label])=>`<a href="${href}"><span>${icon}</span>${label}</a>`).join('')}<button type="button" data-mobile-logout><span>⇥</span>Esci</button></div></section>`;
    document.body.appendChild(overlay);

    const open=()=>{overlay.hidden=false;requestAnimationFrame(()=>overlay.classList.add('open'));};
    const close=()=>{overlay.classList.remove('open');setTimeout(()=>{if(!overlay.classList.contains('open'))overlay.hidden=true;},160);};
    nav.querySelector('[data-open-mobile-menu]')?.addEventListener('click',open);
    overlay.querySelector('[data-close-mobile-menu]')?.addEventListener('click',close);
    overlay.addEventListener('click',event=>{if(event.target===overlay)close();});
    overlay.querySelector('[data-mobile-logout]')?.addEventListener('click',()=>{
      if(typeof window.logoutAgent==='function'){window.logoutAgent();return;}
      localStorage.removeItem('navidiaria.activeAgent');
      localStorage.removeItem('naviturni_logged_agent');
      location.href='index.html';
    });

    if(!document.getElementById('navisuite-mobile-menu-style')){
      const style=document.createElement('style');
      style.id='navisuite-mobile-menu-style';
      style.textContent='.mobile-liquid-nav[hidden],.admin-mobile-nav[hidden],.hiba-updates-mobile-nav[hidden],.hiba-mobile-nav[hidden]{display:none!important}.navisuite-mobile-nav,.navisuite-mobile-menu{display:none}@media(max-width:850px){body{padding-bottom:102px!important}.navisuite-mobile-nav{position:fixed;left:50vw;bottom:14px;z-index:2200;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));align-items:center;width:calc(100vw - 24px);max-width:620px;height:68px;transform:translateX(-50%);border:1px solid rgba(255,255,255,.18);border-top-color:rgba(255,255,255,.28);border-radius:36px;background:rgba(18,34,45,.78);box-shadow:0 18px 40px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.13);backdrop-filter:blur(24px) saturate(180%);-webkit-backdrop-filter:blur(24px) saturate(180%)}.navisuite-mobile-nav a,.navisuite-mobile-nav button{display:flex;flex:1 1 0;min-width:0;max-width:72px;align-self:stretch;flex-direction:column;align-items:center;justify-content:center;gap:3px;margin:0;padding:7px 2px;border:0;border-radius:28px;background:transparent;color:#a9c4ca;text-decoration:none;font:800 9px/1 Inter,Arial,sans-serif}.navisuite-mobile-nav span{font-size:20px;line-height:20px;color:#b9d2d8}.navisuite-mobile-nav a.active{background:rgba(45,212,191,.14);color:#99f6e4}.navisuite-mobile-nav a.active span{color:#2dd4bf}.navisuite-mobile-menu{position:fixed;inset:0;z-index:2300;background:rgba(1,15,21,.58);opacity:0;transition:opacity .16s ease}.navisuite-mobile-menu.open{opacity:1}.navisuite-mobile-menu section{position:absolute;left:12px;right:12px;bottom:94px;padding:12px;border:1px solid rgba(255,255,255,.18);border-radius:23px;background:rgba(13,39,50,.96);box-shadow:0 18px 45px rgba(0,0,0,.42);backdrop-filter:blur(22px)}.navisuite-mobile-menu header{display:flex;align-items:center;justify-content:space-between;padding:4px 5px 10px;color:#e9ffff;font:800 15px Inter,Arial,sans-serif}.navisuite-mobile-menu header button{width:32px;height:32px;border:1px solid rgba(151,212,221,.35);border-radius:50%;background:transparent;color:#9de8e0;font-size:16px}.navisuite-mobile-menu-links{display:grid;grid-template-columns:1fr 1fr;gap:8px}.navisuite-mobile-menu-links a,.navisuite-mobile-menu-links button{display:flex;align-items:center;gap:9px;min-height:45px;padding:10px 12px;border:1px solid rgba(114,170,181,.35);border-radius:13px;background:rgba(5,26,35,.68);color:#e7fbfb;text-decoration:none;font:800 12px Inter,Arial,sans-serif;text-align:left}.navisuite-mobile-menu-links span{font-size:18px;color:#34d6c0}.navisuite-mobile-menu-links [data-mobile-logout]{color:#ffd3d9}.navisuite-mobile-menu-links [data-mobile-logout] span{color:#fb8291}}';
      document.head.appendChild(style);
    }
  }

  function installHibaMobileNav(){
    if(!isHibaBarista(sessionAgent))return;
    document.querySelectorAll('.mobile-liquid-nav,.admin-mobile-nav').forEach(node=>node.hidden=true);
    document.getElementById('hiba-mobile-nav')?.remove();
    const nav=document.createElement('nav');
    nav.id='hiba-mobile-nav';
    nav.className='hiba-mobile-nav';
    nav.setAttribute('aria-label','Navigazione Hiba');
    nav.innerHTML=[
      ['naviturni.html','▦','Turni','turni'],
      ['aggiornamenti.html','↻','Aggiornamenti','aggiornamenti'],
      ['segnalazioni.html','✉','Segnalazioni','tickets']
    ].map(([href,icon,label,key])=>`<a href="${href}" class="${page===key?'active':''}"><span>${icon}</span><b>${label}</b></a>`).join('');
    document.body.appendChild(nav);
    if(document.getElementById('hiba-mobile-nav-style'))return;
    const style=document.createElement('style');
    style.id='hiba-mobile-nav-style';
    style.textContent='.hiba-mobile-nav{display:none}@media(max-width:850px){body{padding-bottom:102px!important}.hiba-mobile-nav{position:fixed;left:50%;bottom:14px;z-index:2000;display:flex;align-items:center;justify-content:space-evenly;width:calc(100% - 24px);height:68px;transform:translateX(-50%);border:1px solid rgba(255,255,255,.18);border-top-color:rgba(255,255,255,.28);border-radius:36px;background:rgba(18,34,45,.74);box-shadow:0 18px 40px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.13);backdrop-filter:blur(24px) saturate(180%);-webkit-backdrop-filter:blur(24px) saturate(180%)}.hiba-mobile-nav a{display:flex;flex:1 1 0;min-width:0;max-width:112px;align-self:stretch;flex-direction:column;align-items:center;justify-content:center;gap:3px;margin:0;padding:7px 3px;border:0;border-radius:28px;color:#a9c4ca;text-decoration:none;font:800 10px/1 Inter,Arial,sans-serif}.hiba-mobile-nav a span{font-size:20px;line-height:20px;color:#b9d2d8}.hiba-mobile-nav a.active{background:rgba(45,212,191,.14);color:#99f6e4}.hiba-mobile-nav a.active span{color:#2dd4bf}.hiba-mobile-nav a:active{transform:scale(.96)}}';
    document.head.appendChild(style);
  }

  function installCompleteMobileMenu(){
    if(isHibaBarista(sessionAgent))return;
    let nav=document.querySelector('.mobile-liquid-nav');
    if(!nav&&document.body.classList.contains('turni-page')){
      nav=document.createElement('nav');
      nav.className='mobile-liquid-nav';
      nav.setAttribute('aria-label','Navigazione principale mobile');
      nav.innerHTML='<a href="naviturni.html" class="nav-item"><span class="nav-icon">▦</span><span>Turni</span></a><a href="cambi_turno.html" class="nav-item"><span class="nav-icon">⇄</span><span>Cambio</span></a><a href="documenti.html" class="nav-item"><span class="nav-icon">▤</span><span>Doc</span></a>';
      document.body.appendChild(nav);
    }
    if(!nav)return;

    let trigger=document.getElementById('mobile-filter-btn')||document.getElementById('mobile-altre-btn')||document.getElementById('mobile-app-menu-btn');
    if(canUseDiaria(sessionAgent)&&!nav.querySelector('a[href="navidiaria.html"]')){
      const diaria=document.createElement('a');
      diaria.href='navidiaria.html';
      diaria.className=`nav-item${page==='diaria'?' active':''}`;
      diaria.innerHTML='<span class="nav-icon">≈</span><span>Diaria</span>';
      nav.insertBefore(diaria,trigger||null);
    }
    if(!trigger){
      // Nelle pagine che usavano Impostazioni come quarta voce, quella
      // posizione diventa il nuovo Menu completo.
      nav.querySelector('a[href="impostazioni.html"]')?.remove();
      trigger=document.createElement('button');
      trigger.type='button';
      trigger.className='nav-item';
      trigger.id='mobile-app-menu-btn';
      trigger.setAttribute('aria-label','Apri menu');
      trigger.innerHTML='<span class="nav-icon">☰</span><span>Menu</span>';
      nav.appendChild(trigger);
    }else{
      trigger.setAttribute('aria-label','Apri menu e filtri');
      const label=trigger.querySelector('span:last-child');
      if(label)label.textContent='Menu';
      const icon=trigger.querySelector('.nav-icon');
      if(icon)icon.textContent='☰';
    }

    let modal=document.getElementById('mobile-filter-modal');
    if(!modal){
      modal=document.createElement('div');
      modal.id='mobile-filter-modal';
      modal.className='liquid-modal-overlay';
      modal.hidden=true;
      modal.innerHTML=`<div class="liquid-modal-content"><div class="liquid-modal-header"><strong>Menu NaviSuite</strong><button type="button" id="close-filter-modal" aria-label="Chiudi">✕</button></div><div class="liquid-modal-body"></div></div>`;
      document.body.appendChild(modal);
    }

    const body=modal.querySelector('.liquid-modal-body');
    if(!body||body.querySelector('.mobile-complete-menu'))return;

    // I vecchi comandi che aprivano il laterale non servono più su mobile:
    // tutte le stesse funzioni sono disponibili direttamente qui.
    modal.querySelectorAll('#modal-sidebar-toggle,#modal-sidebar-mini-toggle').forEach(node=>node.remove());

    const section=document.createElement('div');
    section.className='filter-section mobile-complete-menu';
    const links=[];
    if(canUseDiaria(sessionAgent))links.push('<a href="navidiaria.html"><span>≈</span>NaviDiaria</a>');
    if(!isBaristaSession){
      links.push('<a href="index.html"><span>⌂</span>Home</a>');
      links.push('<a href="Orario.html"><span>◴</span>Orario</a>');
      links.push('<a href="impostazioni.html"><span>⚙</span>Impostazioni</a>');
      links.push('<a href="segnalazioni.html"><span>✉</span>Segnalazioni</a>');
    }
    if(isAdminAgent(sessionAgent)){
      links.push('<a href="gestione_navi.html" class="admin-mobile-action"><span>▤</span>Navi</a>');
      links.push('<a href="aggiornamenti.html" class="admin-mobile-action"><span>↻</span>Aggiornamenti</a>');
      links.push('<a href="agenti.html" class="admin-mobile-action"><span>♙</span>Agenti</a>');
    }

    const supportsPast=page==='turni'||page==='trova';
    section.innerHTML=`
      <span class="filter-section-title">AZIONI</span>
      <div class="mobile-menu-actions">
        <button type="button" data-mobile-refresh><span>↻</span><b>Aggiorna</b></button>
        ${supportsPast?'<button type="button" data-mobile-past><span>◷</span><b>Mostra passato</b></button>':''}
        ${links.join('')}
        <a href="navidiaria.html?pin=1"><span>⌁</span>Cambia PIN</a>
        <button type="button" class="mobile-menu-logout" data-mobile-logout><span>⇥</span><b>Esci</b></button>
      </div>`;
    body.appendChild(section);

    const openModal=()=>{
      modal.removeAttribute('hidden');
      modal.classList.add('open');
      document.body.classList.remove('mobile-nav-hidden');
    };
    const closeModal=()=>modal.classList.remove('open');
    trigger.addEventListener('click',openModal);
    modal.querySelector('#close-filter-modal')?.addEventListener('click',closeModal);
    modal.addEventListener('click',event=>{if(event.target===modal)closeModal();});

    section.querySelector('[data-mobile-refresh]')?.addEventListener('click',()=>{
      closeModal();
      if(typeof window.ricaricaDati==='function'){window.ricaricaDati();return;}
      if(typeof window.loadDocuments==='function'){window.loadDocuments();return;}
      location.reload();
    });

    section.querySelector('[data-mobile-past]')?.addEventListener('click',()=>{
      if(typeof window.togglePastColumns==='function')window.togglePastColumns();
      const source=document.getElementById('togglePastBtn');
      const label=section.querySelector('[data-mobile-past] b');
      if(label)label.textContent=source?.textContent?.replace(/^[^A-Za-zÀ-ÿ]+/,'').trim()||'Mostra passato';
    });
    section.querySelector('[data-mobile-logout]')?.addEventListener('click',()=>{
      if(typeof window.logoutAgent==='function'){window.logoutAgent();return;}
      localStorage.removeItem('navidiaria.activeAgent');
      localStorage.removeItem('naviturni_logged_agent');
      location.href='index.html';
    });
  }

  // Il menu mobile è gestito esclusivamente da mobile-menu-solid.js.
  // Lasciamo qui il codice storico soltanto per non alterare il menu desktop.

  function installMobileNavAutoHide(){
    const nav=document.querySelector('.mobile-liquid-nav');
    if(!nav){
      if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installMobileNavAutoHide,{once:true});
      return;
    }

    const lastPositions=new WeakMap();
    let directionDistance=0;
    let lastDirection=0;

    const scrollingElement=target=>{
      if(target===window||target===document||target===document.documentElement||target===document.body)return document.scrollingElement||document.documentElement;
      return target instanceof Element?target:null;
    };

    const showNav=()=>document.body.classList.remove('mobile-nav-hidden');
    const hideNav=()=>{
      if(window.innerWidth<=800&&!document.querySelector('.liquid-modal-overlay.open')){
        document.body.classList.add('mobile-nav-hidden');
      }
    };

    const handleScroll=event=>{
      if(window.innerWidth>800){showNav();return;}
      const source=scrollingElement(event.target);
      if(!source)return;
      const current=Math.max(0,source.scrollTop||0);
      const previous=lastPositions.has(source)?lastPositions.get(source):current;
      const delta=current-previous;
      lastPositions.set(source,current);
      if(Math.abs(delta)<1)return;

      const direction=delta>0?1:-1;
      if(direction!==lastDirection){directionDistance=0;lastDirection=direction;}
      directionDistance+=Math.abs(delta);

      if(current<18){showNav();return;}
      if(direction<0&&directionDistance>=6)showNav();
      else if(direction>0&&directionDistance>=14)hideNav();
    };

    document.addEventListener('scroll',handleScroll,{capture:true,passive:true});
    window.addEventListener('scroll',handleScroll,{passive:true});
    window.addEventListener('resize',()=>{if(window.innerWidth>800)showNav();},{passive:true});
    document.addEventListener('click',event=>{
      if(event.target.closest('.liquid-modal-overlay,.mobile-liquid-nav,.turni-menu-button'))showNav();
    });
  }

  // L'autohide è ora gestito dal solo menu mobile comune.
})();


/* Feedback immediato: la voce selezionata resta visibile durante la navigazione. */
(() => {
  const style=document.createElement('style');
  style.textContent='@keyframes ns-navigation-pulse{0%,100%{opacity:1;filter:none}50%{opacity:.52;filter:brightness(1.35)}}.ns-navigation-pending{pointer-events:none!important;animation:ns-navigation-pulse .72s ease-in-out infinite!important;outline:2px solid rgba(90,245,221,.8)!important;outline-offset:-2px!important;background:rgba(45,212,191,.24)!important;color:#d9fffb!important}';
  document.head.appendChild(style);
  document.addEventListener('click',event=>{
    const link=event.target.closest('a[href]');
    if(!link||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||link.target==='_blank'||link.hasAttribute('download'))return;
    const href=link.getAttribute('href')||'';
    if(!href||href[0]==='#'||/^javascript:/i.test(href))return;
    link.classList.add('ns-navigation-pending');
    link.setAttribute('aria-busy','true');
  },true);
})();
