(function(){
  const getProfile=()=>{try{return JSON.parse(localStorage.getItem('navidiaria.activeAgent')||localStorage.getItem('naviturni_logged_agent')||'null')}catch{return null}};
  let profile=getProfile();
  const isAdmin=['91','92'].includes(String(profile?.id||''))||String(profile?.role||'').toLowerCase()==='admin';
  const body=document.body;
  const isHomePage=location.pathname.endsWith('/')||location.pathname.endsWith('/index.html');
  const pageKey=body.classList.contains('impostazioni-page')?'settings':body.classList.contains('trova-turno-page')?'cambi':body.classList.contains('diaria-page')?'diaria':body.classList.contains('turni-page')?'turni':isHomePage?'home':'';
  const labels={general:'Aggiornamento generale',home:'Home NaviSuite',turni:'NaviTurni',cambi:'NaviCambi',diaria:'NaviDiaria'};
  const defaults={
    general:{
      title:'Novità di NaviSuite',
      message:'È disponibile una nuova funzione per aiutarci a migliorare NaviSuite.\n\n• Segnalazioni e idee: dalla Home o dal Menu puoi inviare un bug, un suggerimento o una richiesta di miglioramento.\n• Puoi scegliere la pagina coinvolta e descrivere con calma cosa è successo.\n• Riceverai lo stato della segnalazione: Nuovo, In verifica o Risolto.\n\nSono stati inoltre sistemati il menu mobile della pagina Segnalazioni e alcuni aggiornamenti della PWA.'
    },
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
  // Primo avviso generale distribuito con la versione: resta attivo finché
  // l’amministratore non lo sostituisce o lo disattiva da Impostazioni.
  const generalRelease={...defaults.general,id:'v1.41-segnalazioni',publishedAt:'2026-08-12T08:45:00.000Z',scope:'general'};

  function installStyle(){
    if(document.getElementById('navisuite-announcements-style'))return;
    const style=document.createElement('style');style.id='navisuite-announcements-style';
    style.textContent='.navi-news-overlay{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(1,10,15,.74);backdrop-filter:blur(13px);-webkit-backdrop-filter:blur(13px)}.navi-news-card{width:min(540px,100%);max-height:86vh;overflow:auto;padding:23px;border:1px solid rgba(45,212,191,.36);border-radius:24px;background:linear-gradient(145deg,rgba(20,51,62,.98),rgba(7,25,34,.99));color:#edfafa;box-shadow:0 28px 80px rgba(0,0,0,.58)}.navi-news-kicker{display:block;margin-bottom:7px;color:#2dd4bf;font-size:11px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.navi-news-footer{margin-top:18px;padding-top:14px;border-top:1px solid rgba(124,173,189,.22);color:#8faab2;font-size:11px;line-height:1.45}.navi-news-version{display:block;margin-bottom:5px;color:#2dd4bf;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.navi-news-disclaimer strong{color:#fbbf24}.navi-news-card h2{margin:0 0 14px;font-size:24px}.navi-news-message{white-space:pre-wrap;color:#c8dce1;font-size:15px;line-height:1.58}.navi-news-actions{display:flex;justify-content:flex-end;margin-top:22px}.navi-news-close{min-width:130px;padding:11px 18px;border:0;border-radius:999px;background:#2dd4bf;color:#06231f;font-weight:900;cursor:pointer}#announcement-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:18px}.announcement-card{padding:16px;border:1px solid var(--line);border-radius:16px;background:rgba(8,31,41,.72)}.announcement-card h3{margin:0 0 12px;color:var(--accent)}.announcement-personal-help{margin:0;color:var(--ink-dim);font-size:12px;line-height:1.45}.announcement-card label{display:block;margin:10px 0 5px;color:var(--ink-dim);font-size:11px;font-weight:800;text-transform:uppercase}.announcement-card input,.announcement-card textarea,.announcement-card select{box-sizing:border-box;width:100%;padding:10px;border:1px solid var(--line);border-radius:10px;background:#071923;color:var(--ink);font:inherit}.announcement-card textarea{min-height:220px;resize:vertical}.announcement-personal-search{position:relative}.announcement-personal-results{position:absolute;z-index:3;top:calc(100% + 4px);left:0;right:0;max-height:190px;overflow:auto;border:1px solid var(--line);border-radius:10px;background:#071923;box-shadow:0 12px 24px #0005}.announcement-personal-results button{display:block;width:100%;padding:10px 12px;border:0;border-bottom:1px solid var(--line);background:transparent;color:var(--ink);text-align:left;font:inherit;font-weight:800;cursor:pointer}.announcement-personal-results button:last-child{border-bottom:0}.announcement-personal-results button:hover{background:rgba(45,212,191,.14)}.announcement-personal-selected{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border:1px solid var(--accent);border-radius:10px;background:rgba(45,212,191,.12);color:var(--ink)}.announcement-personal-selected span{font-size:11px;color:var(--ink-dim)}.announcement-personal-selected button{padding:6px 9px;border:1px solid var(--line);border-radius:999px;background:var(--bg-card);color:var(--ink);font-weight:800;cursor:pointer}.announcement-actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px}.announcement-actions button{padding:8px 11px;border:1px solid var(--line);border-radius:999px;background:var(--bg-card);color:var(--ink);font-weight:800;cursor:pointer}.announcement-actions button:disabled{opacity:.52;cursor:not-allowed}.announcement-actions .publish{border-color:var(--accent);background:var(--accent);color:#06231f}.announcement-actions .disable{color:#fca5a5}.announcement-state{min-height:18px;margin-top:10px;color:var(--ink-dim);font-size:11px}.announcement-state.live{color:#2dd4bf}@media(max-width:900px){#announcement-grid{grid-template-columns:1fr}.announcement-card textarea{min-height:180px}}';
    document.head.appendChild(style);
  }
  function show(item,preview){
    if(!item?.title&&!item?.message)return;
    installStyle();document.querySelectorAll('.navi-news-overlay').forEach(node=>node.remove());
    const overlay=document.createElement('div');overlay.className='navi-news-overlay';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');
    const card=document.createElement('div');card.className='navi-news-card';
    const kicker=document.createElement('span');kicker.className='navi-news-kicker';kicker.textContent=preview?'ANTEPRIMA':item.scope==='personal'?'MESSAGGIO PERSONALE':item.scope==='general'?'AGGIORNAMENTO NAVISUITE':'GUIDA ALLA PAGINA';
    const title=document.createElement('h2');title.textContent=item.title||'Guida';
    const message=document.createElement('div');message.className='navi-news-message';message.textContent=item.message||'';
    const actions=document.createElement('div');actions.className='navi-news-actions';
    const footer=document.createElement('div');footer.className='navi-news-footer';
    const version=document.createElement('span');version.className='navi-news-version';version.textContent='Versione '+(window.NAVISUITE_VERSION||'v1.41');
    const disclaimer=document.createElement('div');disclaimer.className='navi-news-disclaimer';
    disclaimer.append('Questo lavoro è stato fatto da Pedro per uso personale. Si ');
    const emphasis=document.createElement('strong');emphasis.textContent='DECLINA';
    disclaimer.append(emphasis,' ogni responsabilità per errori od omissioni.');
    footer.append(version,disclaimer);
    const close=document.createElement('button');close.type='button';close.className='navi-news-close';close.textContent=preview?'Chiudi anteprima':'Ho capito';
    const dismiss=()=>{
      try{
        const scope=item.dismissScope||item.scope||pageKey;
        if(!preview&&item.id&&scope)localStorage.setItem('navisuite.announcement.'+scope+'.'+item.id,'seen');
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
    // Prima dell'accesso nessun avviso viene mostrato. Nella Home aspettiamo
    // inoltre che sia comparsa la scelta delle applicazioni.
    profile=getProfile();
    if(!profile)return;
    if(pageKey==='home'&&document.getElementById('appChoice')?.hidden!==false)return;
    if(announcementCheckRunning||!window.NaviAdminFirebase?.getAnnouncements)return;
    announcementCheckRunning=true;
    try{
      await NaviAdminFirebase.ready;
      const all=await NaviAdminFirebase.getAnnouncements();
      const agentId=String(profile.id||'').trim();
      const personal=agentId?all?.personal?.[agentId]:null;
      const candidates=[
        personal?.published&&!personal.disabled&&String(personal.published.targetAgentId||agentId)===agentId?{...personal.published,scope:'personal',dismissScope:'personal.'+agentId}:null,
        all?.general?.published?{...all.general.published,scope:'general'}:(all?.general?.disabled?null:generalRelease),
        pageKey?{...(all?.[pageKey]?.published||{}),scope:pageKey}:null
      ].filter(item=>item?.id);
      for(const item of candidates){
        const key='navisuite.announcement.'+(item.dismissScope||item.scope)+'.'+item.id;
        let alreadySeen=false;try{alreadySeen=localStorage.getItem(key)==='seen'}catch{}
        if(alreadySeen||document.querySelector('.navi-news-overlay')||pendingAnnouncementId===String(item.id))continue;
        pendingAnnouncementId=String(item.id);
        setTimeout(()=>{
          if(!document.querySelector('.navi-news-overlay'))show(item,false);
          pendingAnnouncementId='';
        },150);
        break; // Un solo popup per apertura: il generale ha sempre precedenza.
      }
    }catch(error){console.warn('Guide NaviSuite non disponibili',error)}
    finally{announcementCheckRunning=false}
  }
  function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  async function setupAdmin(){
    if(pageKey!=='settings'||!isAdmin)return;
    const section=document.getElementById('gestione-avvisi'),grid=document.getElementById('announcement-grid'),status=document.getElementById('announcement-status');
    if(!section||!grid||!window.NaviAdminFirebase)return;section.hidden=false;installStyle();
    let data={},recipients=[],selectedAgentId='';
    try{
      await NaviAdminFirebase.ready;
      const [announcements,agents]=await Promise.all([NaviAdminFirebase.getAnnouncements(),NaviAdminFirebase.getAgentAdminData?.()]);
      data=announcements||{};
      const byId=new Map();
      (agents?.users||[]).forEach(agent=>{const id=String(agent?.id||'').trim();if(id)byId.set(id,{id,name:String(agent.name||id).trim()})});
      Object.entries(agents?.profiles||{}).forEach(([id,agent])=>{id=String(id||'').trim();if(id)byId.set(id,{id,name:String(agent?.name||agent?.agente||byId.get(id)?.name||id).trim()})});
      recipients=Array.from(byId.values()).sort((a,b)=>a.name.localeCompare(b.name,'it'));
      selectedAgentId='';
    }catch(error){status.textContent='Impossibile caricare le guide: '+error.message;return}
    const personalCard=()=>{
      const recipient=recipients.find(item=>item.id===selectedAgentId);
      const entry=data.personal?.[selectedAgentId]||{};
      const draft=entry.draft||{title:'Messaggio da NaviSuite',message:''};
      const live=entry.published&&!entry.disabled?entry.published:null;
      const recipientPicker=recipient?'<div class="announcement-personal-selected"><div><strong>'+escapeHtml(recipient.name)+'</strong><span> · ID '+escapeHtml(recipient.id)+'</span></div><button type="button" data-clear-personal>↺ Cambia</button></div>':'<div class="announcement-personal-search"><input data-personal-search autocomplete="off" placeholder="Inizia a digitare nome o cognome" '+(recipients.length?'':'disabled')+'><div class="announcement-personal-results" data-personal-results hidden></div></div>';
      const stamp=live?'Inviato il '+new Intl.DateTimeFormat('it-IT',{dateStyle:'short',timeStyle:'short'}).format(new Date(live.publishedAt||Date.now())):'Nessun popup personale attivo';
      return '<article class="announcement-card announcement-personal-card"><h3>Popup personale</h3><p class="announcement-personal-help">Invialo a un solo agente: comparirà dopo il suo accesso e gli altri non lo vedranno.</p><label>Agente destinatario</label>'+recipientPicker+'<label>Titolo</label><input data-personal-title value="'+escapeHtml(draft.title)+'" '+(recipient?'':'disabled')+'><label>Messaggio</label><textarea data-personal-message '+(recipient?'':'disabled')+'>'+escapeHtml(draft.message)+'</textarea><div class="announcement-actions"><button type="button" data-personal-action="save" '+(recipient?'':'disabled')+'>Salva bozza</button><button type="button" data-personal-action="preview" '+(recipient?'':'disabled')+'>Anteprima</button><button type="button" class="publish" data-personal-action="publish" '+(recipient?'':'disabled')+'>Invia a '+escapeHtml(recipient?.name||'agente')+'</button><button type="button" class="disable" data-personal-action="disable" '+(live?'':'disabled')+'>Revoca</button></div><div class="announcement-state '+(live?'live':'')+'">'+stamp+(recipient?' · '+escapeHtml(recipient.name):'')+'</div></article>';
    };
    const render=()=>{grid.innerHTML=Object.entries(labels).map(([key,label])=>{const entry=data[key]||{},draft=entry.draft||defaults[key],live=entry.published||(key==='general'&&!entry.disabled?generalRelease:null);const stamp=live?'Pubblicata il '+new Intl.DateTimeFormat('it-IT',{dateStyle:'short',timeStyle:'short'}).format(new Date(live.publishedAt||Date.now())):'Non pubblicata';return '<article class="announcement-card" data-key="'+key+'"><h3>'+label+'</h3><label>Titolo</label><input data-title value="'+escapeHtml(draft.title)+'"><label>Spiegazione</label><textarea data-message>'+escapeHtml(draft.message)+'</textarea><div class="announcement-actions"><button type="button" data-action="save">Salva bozza</button><button type="button" data-action="preview">Anteprima</button><button type="button" class="publish" data-action="publish">Pubblica ora</button><button type="button" class="disable" data-action="disable">Disattiva</button></div><div class="announcement-state '+(live?'live':'')+'">'+stamp+' · visibile a tutti</div></article>'}).join('')+personalCard()};
    render();
    grid.addEventListener('input',event=>{const input=event.target.closest('[data-personal-search]');if(!input)return;const query=input.value.trim().toLocaleUpperCase('it');const results=grid.querySelector('[data-personal-results]');if(!query){results.hidden=true;results.innerHTML='';return}const matches=recipients.filter(item=>String(item.name||'').toLocaleUpperCase('it').split(/\\s+/).some(part=>part.startsWith(query))).slice(0,12);results.innerHTML=matches.map(item=>'<button type="button" data-personal-recipient="'+escapeHtml(item.id)+'">'+escapeHtml(item.name)+'</button>').join('')||'<button type="button" disabled>Nessun agente trovato</button>';results.hidden=false});
    grid.addEventListener('click',event=>{const recipientButton=event.target.closest('[data-personal-recipient]');if(recipientButton){selectedAgentId=recipientButton.dataset.personalRecipient;render();return}if(event.target.closest('[data-clear-personal]')){selectedAgentId='';render()}});
    grid.addEventListener('click',async event=>{const button=event.target.closest('button[data-action]'),card=button?.closest('[data-key]');if(!button||!card)return;const key=card.dataset.key,action=button.dataset.action,draft={title:card.querySelector('[data-title]').value.trim(),message:card.querySelector('[data-message]').value.trim()};if(action==='preview'){show({...draft,scope:key},true);return}button.disabled=true;try{data[key]={...(data[key]||{}),draft,audience:'all',disabled:false};if(action==='publish'){if(!draft.title&&!draft.message)throw new Error('Inserisci un titolo o un messaggio');data[key].published={...draft,id:String(Date.now()),publishedAt:new Date().toISOString(),scope:key}}if(action==='disable'){data[key].published=null;if(key==='general')data[key].disabled=true;}status.textContent='Salvataggio…';await NaviAdminFirebase.saveAnnouncements(data);status.textContent=action==='publish'?labels[key]+' pubblicata per tutti gli utenti.':action==='disable'?labels[key]+' disattivata.':'Bozza salvata.';render()}catch(error){status.textContent='Errore: '+error.message}finally{button.disabled=false}});
    grid.addEventListener('click',async event=>{
      const button=event.target.closest('button[data-personal-action]');if(!button)return;
      const action=button.dataset.personalAction,recipient=recipients.find(item=>item.id===selectedAgentId);if(!recipient)return;
      const draft={title:grid.querySelector('[data-personal-title]').value.trim(),message:grid.querySelector('[data-personal-message]').value.trim()};
      if(action==='preview'){show({...draft,scope:'personal',targetAgentId:recipient.id},true);return}
      button.disabled=true;
      try{
        data.personal=data.personal||{};
        const entry={...(data.personal[recipient.id]||{}),draft,disabled:false};
        if(action==='publish'){
          if(!draft.title&&!draft.message)throw new Error('Inserisci un titolo o un messaggio');
          entry.published={...draft,id:'personal-'+Date.now(),publishedAt:new Date().toISOString(),scope:'personal',targetAgentId:recipient.id,targetAgentName:recipient.name};
        }
        if(action==='disable'){entry.published=null;entry.disabled=true}
        data.personal[recipient.id]=entry;
        status.textContent='Salvataggio…';await NaviAdminFirebase.saveAnnouncements(data);
        status.textContent=action==='publish'?'Popup inviato a '+recipient.name+'. Comparirà al suo prossimo accesso.':action==='disable'?'Popup personale revocato.':'Bozza personale salvata.';
        render();
      }catch(error){status.textContent='Errore: '+error.message}finally{button.disabled=false}
    });
  }
  setupAdmin();loadPublished();
  document.addEventListener('navisuite-login-complete',loadPublished);
  // Una PWA spesso viene ripresa dalla memoria senza un nuovo caricamento.
  // Ricontrolliamo quindi la pubblicazione quando torna visibile o attiva.
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)loadPublished()});
  window.addEventListener('focus',loadPublished);
  window.addEventListener('pageshow',loadPublished);
})();
