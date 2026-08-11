(function(){
  const profile=(()=>{try{return JSON.parse(localStorage.getItem('navidiaria.activeAgent')||localStorage.getItem('naviturni_logged_agent')||'null')}catch{return null}})();
  const isAdmin=['91','92'].includes(String(profile?.id||''))||String(profile?.role||'').toLowerCase()==='admin';
  const body=document.body;
  const isHomePage=location.pathname.endsWith('/')||location.pathname.endsWith('/index.html');
  const pageKey=body.classList.contains('impostazioni-page')?'settings':body.classList.contains('trova-turno-page')?'cambi':body.classList.contains('diaria-page')?'diaria':body.classList.contains('turni-page')?'turni':isHomePage?'home':'';
  const labels={home:'Home NaviSuite',turni:'NaviTurni',cambi:'NaviCambi',diaria:'NaviDiaria'};
  const defaults={
    home:{
      title:'A cosa serve NaviSuite',
      message:'NaviSuite riunisce in un unico spazio gli strumenti utili per il lavoro.\n\nPuoi consultare turni ed equipaggi, proporre cambi turno, registrare diaria e competenze, aprire documenti e consultare gli orari.\n\nDalla Home scegli semplicemente la sezione che vuoi utilizzare.'
    },
    turni:{
      title:'Come usare NaviTurni',
      message:'NaviTurni mostra i turni di tutti gli agenti ordinati per residenza e anzianità.\n\n• La tua riga resta sempre visibile durante lo scorrimento.\n• Tocca un turno per vedere equipaggio, nave e dettagli del servizio.\n• Le celle evidenziate indicano i colleghi che lavorano con te.\n• Le frecce rosse segnalano un cambio richiesto; diventano verdi quando viene approvato.\n• Dal menu puoi filtrare residenze e corse, mostrare il passato e aggiornare i dati.\n• La dicitura BOZZA identifica le settimane non ancora definitive.'
    },
    cambi:{
      title:'Come usare NaviCambi',
      message:'NaviCambi serve per cercare e preparare uno scambio di turno con un collega.\n\n• Seleziona le giornate e il collega interessato.\n• Puoi proporre cambi anche quando uno dei due è a riposo.\n• Prima dell’invio controlla il riepilogo con i turni di entrambi.\n• La freccia rossa indica che la richiesta è stata registrata.\n• La freccia verde indica che il cambio risulta approvato tramite ODS o approvazione manuale.\n• Le richieste restano raggruppate per facilitarne il controllo.'
    },
    diaria:{
      title:'Come usare NaviDiaria',
      message:'NaviDiaria raccoglie ore lavorate e competenze per confrontarle con la busta paga.\n\n• Tocca il servizio per scegliere turno, riposo, malattia o servizio di terra.\n• Inserisci straordinari e banca ore direttamente nella giornata.\n• Registra ticket, secondo ticket, diaria, pernotto, festività e indennità.\n• I totali settimanali e mensili vengono calcolati automaticamente.\n• Le settimane a cavallo del mese seguono le regole di conteggio previste.\n• Le modifiche vengono salvate su Firebase e restano disponibili ai successivi accessi.'
    }
  };

  function installStyle(){
    if(document.getElementById('navisuite-announcements-style'))return;
    const style=document.createElement('style');style.id='navisuite-announcements-style';
    style.textContent='.navi-news-overlay{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(1,10,15,.74);backdrop-filter:blur(13px);-webkit-backdrop-filter:blur(13px)}.navi-news-card{width:min(540px,100%);max-height:86vh;overflow:auto;padding:23px;border:1px solid rgba(45,212,191,.36);border-radius:24px;background:linear-gradient(145deg,rgba(20,51,62,.98),rgba(7,25,34,.99));color:#edfafa;box-shadow:0 28px 80px rgba(0,0,0,.58)}.navi-news-kicker{display:block;margin-bottom:7px;color:#2dd4bf;font-size:11px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.navi-news-footer{margin-top:18px;padding-top:14px;border-top:1px solid rgba(124,173,189,.22);color:#8faab2;font-size:11px;line-height:1.45}.navi-news-version{display:block;margin-bottom:5px;color:#2dd4bf;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.navi-news-disclaimer strong{color:#fbbf24}.navi-news-card h2{margin:0 0 14px;font-size:24px}.navi-news-message{white-space:pre-wrap;color:#c8dce1;font-size:15px;line-height:1.58}.navi-news-actions{display:flex;justify-content:flex-end;margin-top:22px}.navi-news-close{min-width:130px;padding:11px 18px;border:0;border-radius:999px;background:#2dd4bf;color:#06231f;font-weight:900;cursor:pointer}#announcement-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:18px}.announcement-card{padding:16px;border:1px solid var(--line);border-radius:16px;background:rgba(8,31,41,.72)}.announcement-card h3{margin:0 0 12px;color:var(--accent)}.announcement-card label{display:block;margin:10px 0 5px;color:var(--ink-dim);font-size:11px;font-weight:800;text-transform:uppercase}.announcement-card input,.announcement-card textarea{box-sizing:border-box;width:100%;padding:10px;border:1px solid var(--line);border-radius:10px;background:#071923;color:var(--ink);font:inherit}.announcement-card textarea{min-height:220px;resize:vertical}.announcement-actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px}.announcement-actions button{padding:8px 11px;border:1px solid var(--line);border-radius:999px;background:var(--bg-card);color:var(--ink);font-weight:800;cursor:pointer}.announcement-actions .publish{border-color:var(--accent);background:var(--accent);color:#06231f}.announcement-actions .disable{color:#fca5a5}.announcement-state{min-height:18px;margin-top:10px;color:var(--ink-dim);font-size:11px}.announcement-state.live{color:#2dd4bf}@media(max-width:900px){#announcement-grid{grid-template-columns:1fr}.announcement-card textarea{min-height:180px}}';
    document.head.appendChild(style);
  }
  function show(item,preview){
    if(!item?.title&&!item?.message)return;
    installStyle();document.querySelectorAll('.navi-news-overlay').forEach(node=>node.remove());
    const overlay=document.createElement('div');overlay.className='navi-news-overlay';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');
    const card=document.createElement('div');card.className='navi-news-card';
    const kicker=document.createElement('span');kicker.className='navi-news-kicker';kicker.textContent=preview?'ANTEPRIMA GUIDA':'GUIDA ALLA PAGINA';
    const title=document.createElement('h2');title.textContent=item.title||'Guida';
    const message=document.createElement('div');message.className='navi-news-message';message.textContent=item.message||'';
    const actions=document.createElement('div');actions.className='navi-news-actions';
    const footer=document.createElement('div');footer.className='navi-news-footer';
    const version=document.createElement('span');version.className='navi-news-version';version.textContent='Versione '+(window.NAVISUITE_VERSION||'v1.40');
    const disclaimer=document.createElement('div');disclaimer.className='navi-news-disclaimer';
    disclaimer.append('Questo lavoro è stato fatto da Pedro per uso personale. Si ');
    const emphasis=document.createElement('strong');emphasis.textContent='DECLINA';
    disclaimer.append(emphasis,' ogni responsabilità per errori od omissioni.');
    footer.append(version,disclaimer);
    const close=document.createElement('button');close.type='button';close.className='navi-news-close';close.textContent=preview?'Chiudi anteprima':'Ho capito';
    const dismiss=()=>{
      try{
        if(!preview&&item.id&&pageKey)localStorage.setItem('navisuite.announcement.'+pageKey+'.'+item.id,'seen');
      }catch(error){
        console.warn('Memorizzazione chiusura popup non disponibile',error);
      }finally{
        document.querySelectorAll('.navi-news-overlay').forEach(node=>node.remove());
      }
    };
    close.addEventListener('click',dismiss);overlay.addEventListener('click',e=>{if(e.target===overlay)dismiss()});
    actions.appendChild(close);card.append(kicker,title,message,actions,footer);overlay.appendChild(card);document.body.appendChild(overlay);close.focus();
  }
  window.NaviAnnouncements={preview:item=>show(item,true)};

  let announcementCheckRunning=false;
  let pendingAnnouncementId='';
  async function loadPublished(){
    // Nella Home il popup deve apparire soltanto quando il login è terminato
    // e la scelta delle applicazioni è realmente visibile.
    if(pageKey==='home'&&document.getElementById('appChoice')?.hidden!==false)return;
    if(announcementCheckRunning||!labels[pageKey]||!window.NaviAdminFirebase?.getAnnouncements)return;
    announcementCheckRunning=true;
    try{
      await NaviAdminFirebase.ready;
      const all=await NaviAdminFirebase.getAnnouncements();
      const item=all?.[pageKey]?.published;
      if(!item?.id)return;
      const key='navisuite.announcement.'+pageKey+'.'+item.id;
      let alreadySeen=false;
      try{alreadySeen=localStorage.getItem(key)==='seen'}catch{}
      if(!alreadySeen&&!document.querySelector('.navi-news-overlay')&&pendingAnnouncementId!==String(item.id)){
        pendingAnnouncementId=String(item.id);
        setTimeout(()=>{
          if(!document.querySelector('.navi-news-overlay'))show(item,false);
          pendingAnnouncementId='';
        },150);
      }
    }catch(error){console.warn('Guide NaviSuite non disponibili',error)}
    finally{announcementCheckRunning=false}
  }
  function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  async function setupAdmin(){
    if(pageKey!=='settings'||!isAdmin)return;
    const section=document.getElementById('gestione-avvisi'),grid=document.getElementById('announcement-grid'),status=document.getElementById('announcement-status');
    if(!section||!grid||!window.NaviAdminFirebase)return;section.hidden=false;installStyle();
    let data={};try{await NaviAdminFirebase.ready;data=await NaviAdminFirebase.getAnnouncements()}catch(error){status.textContent='Impossibile caricare le guide: '+error.message;return}
    const render=()=>{grid.innerHTML=Object.entries(labels).map(([key,label])=>{const entry=data[key]||{},draft=entry.draft||defaults[key],live=entry.published;const stamp=live?'Pubblicata il '+new Intl.DateTimeFormat('it-IT',{dateStyle:'short',timeStyle:'short'}).format(new Date(live.publishedAt||Date.now())):'Non pubblicata';return '<article class="announcement-card" data-key="'+key+'"><h3>'+label+'</h3><label>Titolo</label><input data-title value="'+escapeHtml(draft.title)+'"><label>Spiegazione</label><textarea data-message>'+escapeHtml(draft.message)+'</textarea><div class="announcement-actions"><button type="button" data-action="save">Salva bozza</button><button type="button" data-action="preview">Anteprima</button><button type="button" class="publish" data-action="publish">Pubblica ora</button><button type="button" class="disable" data-action="disable">Disattiva</button></div><div class="announcement-state '+(live?'live':'')+'">'+stamp+' · visibile a tutti</div></article>'}).join('')};
    render();
    grid.addEventListener('click',async event=>{const button=event.target.closest('button[data-action]'),card=button?.closest('[data-key]');if(!button||!card)return;const key=card.dataset.key,action=button.dataset.action,draft={title:card.querySelector('[data-title]').value.trim(),message:card.querySelector('[data-message]').value.trim()};if(action==='preview'){show(draft,true);return}button.disabled=true;try{data[key]={...(data[key]||{}),draft,audience:'all'};if(action==='publish'){if(!draft.title&&!draft.message)throw new Error('Inserisci un titolo o un messaggio');data[key].published={...draft,id:String(Date.now()),publishedAt:new Date().toISOString()}}if(action==='disable')data[key].published=null;status.textContent='Salvataggio…';await NaviAdminFirebase.saveAnnouncements(data);status.textContent=action==='publish'?labels[key]+' pubblicata per tutti gli utenti.':action==='disable'?labels[key]+' disattivata.':'Bozza salvata.';render()}catch(error){status.textContent='Errore: '+error.message}finally{button.disabled=false}});
  }
  setupAdmin();loadPublished();
  document.addEventListener('navisuite-login-complete',loadPublished);
  // Una PWA spesso viene ripresa dalla memoria senza un nuovo caricamento.
  // Ricontrolliamo quindi la pubblicazione quando torna visibile o attiva.
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)loadPublished()});
  window.addEventListener('focus',loadPublished);
  window.addEventListener('pageshow',loadPublished);
})();