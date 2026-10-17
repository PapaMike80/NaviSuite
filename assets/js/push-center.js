(function(){
  'use strict';
  if(!/(?:^|\/)impostazioni\.html$/i.test(location.pathname))return;

  const profile=(()=>{try{return JSON.parse(localStorage.getItem('navidiaria.activeAgent')||localStorage.getItem('naviturni_logged_agent')||'null');}catch(_){return null;}})();
  if(!profile)return;

  const agentId=String(profile?.id||profile?.agentId||'').trim();
  const agentName=String(profile?.name||profile?.agente||profile?.cognome||agentId).trim();
  const isAdmin=window.NaviRoles.isAdminOrSuperUser(profile);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const $=id=>document.getElementById(id);

  const todayRome=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Rome'});

  // Testo del riepilogo: modulo condiviso con il push-worker (push-summary.js).
  // I dati di NaviSharedData hanno gia' turni caricati e residenze: qui si
  // applicano anche le variazioni ODS/manuali, come fa il worker.
  function buildSummary(data,targetAgentId,iso){return NaviPushSummary.buildSummary(NaviPushSummary.effectiveData(data,{odsVariations:data?.variazioni_ods}),targetAgentId,iso);}
  async function loadSchedule(){
    for(let i=0;i<80&&!window.NaviSharedData?.load;i++)await sleep(50);
    if(!window.NaviSharedData?.load)throw new Error('Dati turni non disponibili.');
    return NaviSharedData.load('',{force:true});
  }

  function createSection(){
    if($('notifiche-push'))return $('notifiche-push');
    const section=document.createElement('section');section.className='pref-card';section.id='notifiche-push';
    section.innerHTML=`
      <style>
        #notifiche-push .np-box{--c:var(--s-violet,#a78bfa);display:grid;gap:8px;padding:12px;border-radius:14px;background:color-mix(in srgb,var(--c) 12%,#102733);border:1px solid color-mix(in srgb,var(--c) 38%,transparent)}
        #notifiche-push .np-box h3{margin:0;font:800 13px Manrope,system-ui,sans-serif;color:var(--c)}
        #notifiche-push .np-box p{margin:0;font-size:12px;color:var(--s-muted,#9fb8c2);line-height:1.45}
        #notifiche-push .np-riga{display:flex;align-items:center;gap:10px;width:100%;padding:4px 0;border:0;background:none;color:inherit;text-align:left;font:inherit;cursor:pointer}
        #notifiche-push .np-riga>span{flex:1;font-weight:800;font-size:13px;color:#eaf2f4}
        #notifiche-push .np-riga small{display:block;font-weight:500;font-size:11px;color:var(--s-muted,#9fb8c2);line-height:1.4}
        #notifiche-push .np-tg{position:relative;flex-shrink:0;width:46px;height:28px;border-radius:999px;background:#143140;transition:background .15s}
        #notifiche-push .np-tg::after{content:'';position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:50%;background:#9fb8c2;transition:left .15s}
        #notifiche-push [aria-pressed="true"] .np-tg{background:var(--c)}
        #notifiche-push [aria-pressed="true"] .np-tg::after{left:21px;background:#06231f}
        #notifiche-push .np-riga:disabled{opacity:.5;cursor:default}
        #notifiche-push.ns-sez:not(.chiusa){display:grid!important;gap:8px!important}
        #notifiche-push.ns-sez:not(.chiusa)>.np-box{margin:0!important}
        #notifiche-push .status:empty{display:none}
        #notifiche-push .np-box .pref-tiles{margin-top:2px!important}
        #notifiche-push label.np-riga input{position:absolute;opacity:0;pointer-events:none}
        #notifiche-push label.np-riga:has(input:checked) .np-tg{background:var(--c)}
        #notifiche-push label.np-riga:has(input:checked) .np-tg::after{left:21px;background:#06231f}
        #notifiche-push #push-admin-day>summary{font:800 13px Manrope,system-ui,sans-serif!important}
        #notifiche-push .np-admin{--c:var(--s-rose,#fb7185)}
        #notifiche-push .np-admin .btn{width:100%}
      </style>
      <div class="pref-head"><div><h2>🔔 Notifiche</h2><p>Avvisi di NaviSuite anche con l’app chiusa. Le scelte valgono per questo telefono.</p></div></div>
      <div class="np-box">
        <button type="button" class="np-riga" id="push-device-tg" aria-pressed="false"><span><b id="push-device-title">Su questo telefono</b><small id="push-device-copy">Controllo lo stato di questo dispositivo…</small></span><i class="np-tg"></i></button>
        <div hidden><button id="push-enable" type="button">Attiva</button><button id="push-disable" type="button" hidden>Disattiva</button></div>
        <button class="btn" id="push-test" type="button" style="width:100%">🧪 Prova le notifiche</button>
        <div class="status" id="push-status" aria-live="polite"></div>
        <div id="push-ios-help" style="display:none;padding:10px 12px;border:1px solid #795b24;border-radius:10px;background:#2b2415;color:#ffd27a;font-size:12px;line-height:1.5">Su iPhone le notifiche funzionano solo aprendo NaviSuite dall’icona sulla Home: in Safari tocca Condividi → «Aggiungi a Home», poi apri l’app da lì.</div>
      </div>

      <div class="np-box" style="--c:var(--s-teal,#2dd4bf)"><h3>📅 Riepilogo della giornata</h3><p>Servizio, nave, equipaggio, ormeggio e rifornimento.</p>
      <div class="pref-tiles" role="group" aria-label="Riepilogo della giornata"><button type="button" class="pref-tile" data-sum="previous-day" aria-pressed="false"><span class="pref-label">🌙 Il giorno prima</span></button><button type="button" class="pref-tile" data-sum="same-day" aria-pressed="false"><span class="pref-label">☀️ La mattina</span></button><button type="button" class="pref-tile" data-sum="before-service" aria-pressed="false"><span class="pref-label">⏱ Prima del servizio</span></button><button type="button" class="pref-tile" data-sum="off" aria-pressed="false"><span class="pref-label">🔕 Spento</span></button></div>
      <div id="push-summary-schedule" style="display:flex;gap:12px;flex-wrap:wrap;align-items:end">
        <div class="field" id="push-summary-time-wrap" style="margin:0;min-width:110px"><label for="push-summary-time">Ora</label><input id="push-summary-time" type="time" value="22:05" step="60"></div>
        <div class="field" id="push-summary-lead-wrap" style="margin:0;min-width:160px" hidden><label for="push-summary-lead">Anticipo</label><select id="push-summary-lead"><option value="30">30 minuti prima</option><option value="60" selected>1 ora prima</option><option value="120">2 ore prima</option></select></div>
        <p id="push-summary-copy" style="flex:1 1 200px"></p>
      </div></div>

      <div class="np-box" style="--c:var(--s-cyan,#67d7e6)">
        <button type="button" class="np-riga" data-navi="tg" aria-pressed="false"><span>⛴ Navi<small>10 minuti prima: a bordo il prossimo scalo, a terra la prossima nave con pontile e comandante.</small></span><i class="np-tg"></i></button>
      </div>

      <div class="np-box" style="--c:var(--s-amber,#fbbf24)"><h3>Altri avvisi</h3>
        <button type="button" class="np-riga" data-altro="changes" aria-pressed="false"><span>⇄ Cambi turno<small>Richieste, approvazioni e modifiche.</small></span><i class="np-tg"></i></button>
        <button type="button" class="np-riga" data-altro="ods" aria-pressed="false"><span>📋 ODS e variazioni<small>Nuovi ODS che ti riguardano.</small></span><i class="np-tg"></i></button>
      </div>

      <div hidden>
        <input id="push-pref-summary" type="checkbox"><input id="push-pref-changes" type="checkbox"><input id="push-pref-ods" type="checkbox"><input id="push-pref-arrivals" type="checkbox">
        <select id="push-summary-mode"><option value="previous-day"></option><option value="same-day"></option><option value="before-service"></option></select>
      </div>

      <div class="np-box np-admin" ${isAdmin?'':'hidden'}><h3>Solo amministratori <span class="badge">ADMIN</span></h3>
        <div id="push-admin-alerts">
          <label class="np-riga" style="cursor:pointer"><span>Agente collegato<small>Una notifica quando un agente apre NaviSuite. Vale per tutti i dispositivi.</small></span><input id="push-alert-connections" type="checkbox"><i class="np-tg"></i></label>
          <div class="status" id="push-alert-status" aria-live="polite"></div>
        </div>
        <details id="push-admin-day">
          <summary style="cursor:pointer;font-weight:800;color:var(--c)">Invia giornata · elimina registrazioni</summary>
          <div style="display:grid;gap:10px;margin-top:10px">
          <div class="grid"><div class="field"><label for="push-day-agent">Agente</label><select id="push-day-agent"><option value="">Caricamento…</option></select></div><div class="field"><label for="push-day-date">Giornata</label><input id="push-day-date" type="date" value="${todayRome()}"></div></div>
          <div id="push-day-preview" style="padding:10px 12px;border:1px solid #294b56;border-radius:10px;background:#0b2029;color:var(--muted);font-size:12px;line-height:1.5;white-space:pre-line">Scegli agente e giornata per vedere l’anteprima.</div>
          <div style="display:flex;flex-wrap:wrap;gap:8px"><button class="btn primary" id="push-day-send" type="button">Invia giornata</button><button class="btn" id="push-day-refresh" type="button">Aggiorna elenco</button><button class="btn" id="push-day-remove" type="button" style="border-color:#fb7185;color:#fecdd3;background:transparent">Elimina dispositivi dell’agente</button><button class="btn" id="push-remove-all" type="button" style="border-color:#fb7185;color:#fecdd3;background:transparent">Elimina tutte le registrazioni</button></div>
          <div class="status" id="push-day-status" aria-live="polite"></div>
          </div>
        </details>
      </div>
`;
    const dopo=document.getElementById('ticket-preference')||document.getElementById('pagina-iniziale');
    if(dopo)dopo.insertAdjacentElement('afterend',section);else document.querySelector('main')?.prepend(section);
    // tessere -> campi delle preferenze (stessi campi di prima: il push-worker sul NAS li legge uguali)
    const paint=()=>{
      const on=$('push-pref-summary').checked,mode=$('push-summary-mode').value;
      section.querySelectorAll('[data-sum]').forEach(t=>t.setAttribute('aria-pressed',String(on?t.dataset.sum===mode:t.dataset.sum==='off')));
      section.querySelectorAll('[data-navi]').forEach(t=>t.setAttribute('aria-pressed',String($('push-pref-arrivals').checked)));
      section.querySelectorAll('[data-altro]').forEach(t=>t.setAttribute('aria-pressed',String($(t.dataset.altro==='changes'?'push-pref-changes':'push-pref-ods').checked)));
      $('push-summary-schedule').hidden=!on;
    };
    const cambia=id=>$(id).dispatchEvent(new Event('change'));
    section.addEventListener('click',event=>{
      const t=event.target.closest('[data-sum],[data-navi],[data-altro]');if(!t)return;
      if(t.dataset.sum){const off=t.dataset.sum==='off';$('push-pref-summary').checked=!off;if(!off)$('push-summary-mode').value=t.dataset.sum;cambia('push-summary-mode');}
      else if(t.dataset.navi){$('push-pref-arrivals').checked=!$('push-pref-arrivals').checked;cambia('push-pref-arrivals');}
      else{const id=t.dataset.altro==='changes'?'push-pref-changes':'push-pref-ods';$(id).checked=!$(id).checked;cambia(id);}
      paint();
    });
    section._paint=paint;
    { const d=(window.NaviPush?.defaultPreferences?.())||{tomorrowSummary:true,arrivals:true,shiftChanges:true,ods:true,summaryDelivery:{mode:'previous-day'}}; $('push-pref-summary').checked=d.tomorrowSummary!==false;$('push-pref-arrivals').checked=d.arrivals!==false;$('push-pref-changes').checked=d.shiftChanges!==false;$('push-pref-ods').checked=d.ods!==false;$('push-summary-mode').value=d.summaryDelivery?.mode||'previous-day';paint(); }
    return section;
  }

  async function waitPush(){for(let i=0;i<100&&!window.NaviPush;i++)await sleep(50);if(!window.NaviPush)throw new Error('Modulo Web Push non disponibile.');}
  async function waitAdminFirebase(){for(let i=0;i<100&&!window.NaviAdminFirebase?.getPushSettings;i++)await sleep(50);return window.NaviAdminFirebase?.getPushSettings?window.NaviAdminFirebase:null;}
  async function initAdminAlerts(){
    if(!isAdmin)return;
    const box=$('push-alert-connections'),status=$('push-alert-status');
    if(!box||!status)return;
    const provider=await waitAdminFirebase();
    if(!provider){status.textContent='Impostazione non disponibile: Firebase non raggiungibile.';box.disabled=true;return;}
    try{const settings=await provider.getPushSettings();box.checked=settings.agentConnectionAlerts!==false;}
    catch(error){status.textContent=error?.message||'Impostazione non caricata.';}
    box.addEventListener('change',async()=>{
      box.disabled=true;status.textContent='Salvataggio…';
      try{
        const next=await provider.savePushSettings({agentConnectionAlerts:box.checked});
        box.checked=next.agentConnectionAlerts!==false;
        if(box.checked){
          status.textContent='Avviso "agente collegato" attivo per tutti.';
        }else{
          // Il worker invia la coda senza guardare il flag: svuota l'arretrato.
          let removed=0;
          try{removed=await provider.clearPendingConnectionAlerts?.()||0;}catch(_){ }
          status.textContent=`Avviso "agente collegato" disattivato per tutti${removed?` · ${removed} già in coda rimossi`:''}.`;
        }
      }catch(error){box.checked=!box.checked;status.textContent=error?.message||'Salvataggio non riuscito.';}
      finally{box.disabled=false;}
    });
  }
  function prefsFromUi(){return {tomorrowSummary:$('push-pref-summary').checked,shiftChanges:$('push-pref-changes').checked,ods:$('push-pref-ods').checked,arrivals:$('push-pref-arrivals').checked,summaryDelivery:{mode:String($('push-summary-mode').value||'previous-day'),time:String($('push-summary-time').value||'22:05'),leadMinutes:Number($('push-summary-lead').value||60)}};}
  function updateScheduleUi(){
    const mode=String($('push-summary-mode')?.value||'previous-day'),enabled=$('push-pref-summary')?.checked!==false,relative=mode==='before-service';
    $('push-summary-time-wrap').hidden=relative;$('push-summary-lead-wrap').hidden=!relative;$('push-summary-schedule').style.opacity=enabled?'1':'.48';
    ['push-summary-mode','push-summary-time','push-summary-lead'].forEach(id=>$(id).disabled=!enabled);
    const time=String($('push-summary-time').value||'22:05'),lead=Number($('push-summary-lead').value||60);
    $('push-summary-copy').textContent=mode==='previous-day'?`Riceverai automaticamente il riepilogo alle ${time} del giorno prima.`:mode==='same-day'?`Riceverai automaticamente il riepilogo alle ${time} del giorno stesso.`:`Riceverai automaticamente il riepilogo ${lead===60?'1 ora':lead===120?'2 ore':'30 minuti'} prima dell’inizio del servizio.`;
  }
  function fillPrefs(value){
    const prefs=NaviPush.normalizePreferences(value);$('push-pref-summary').checked=prefs.tomorrowSummary!==false;$('push-pref-changes').checked=prefs.shiftChanges!==false;$('push-pref-ods').checked=prefs.ods!==false;$('push-pref-arrivals').checked=prefs.arrivals!==false;
    $('push-summary-mode').value=prefs.summaryDelivery.mode;$('push-summary-time').value=prefs.summaryDelivery.time;$('push-summary-lead').value=String(prefs.summaryDelivery.leadMinutes);updateScheduleUi();$('notifiche-push')?._paint?.();
  }
  async function savePrefs(message='Preferenze notifiche salvate.'){
    try{await NaviPush.updatePreferences(profile,prefsFromUi());$('push-status').textContent=message;}catch(error){$('push-status').textContent=error?.message||'Preferenze non salvate.';}
  }
  // stato del telefono: interruttore in alto e riassunto sulla sezione chiusa (Attive / Spente / Da riattivare)
  function statoTelefono(titolo,testo,acceso,riepilogo,bloccato=false){
    $('push-device-title').textContent=titolo;$('push-device-copy').textContent=testo;
    const tg=$('push-device-tg');tg.setAttribute('aria-pressed',String(acceso));tg.disabled=bloccato;
    $('push-enable').hidden=acceso;$('push-disable').hidden=!acceso;
    $('notifiche-push').dataset.riepilogo=riepilogo;
  }
  async function refreshStatus(){
    const state=await NaviPush.getStatus(profile);fillPrefs(state.preferences);$('push-ios-help').style.display=NaviPush.isIos()&&!NaviPush.isStandalone()?'block':'none';
    if(!state.supported)return statoTelefono('Su questo telefono','Questo browser non può ricevere notifiche.',false,'Non disponibili',true);
    if(state.requiresMigration)return statoTelefono('Su questo telefono','🔄 Da riattivare: tocca l’interruttore una volta.',false,'Da riattivare');
    if(state.enabled)return statoTelefono('Su questo telefono','Attive: arrivano anche con l’app chiusa.',true,'Attive');
    statoTelefono('Su questo telefono',state.permission==='denied'?'Permesso negato nelle impostazioni di iOS o del browser.':'Spente: tocca per attivarle.',false,'Spente',state.permission==='denied');
  }

  async function removeAll(){
    const status=$('push-day-status'),btn=$('push-remove-all');
    if(!confirm('Eliminare le registrazioni notifiche di TUTTI gli agenti? Ognuno dovrà riattivare le notifiche sul proprio telefono.'))return;
    btn.disabled=true;status.textContent='Eliminazione…';
    try{const n=await NaviPush.removeAllSubscriptions();try{await NaviPush.unsubscribe(profile);}catch(_){ }await refreshStatus();await loadRecipients();status.textContent=`${n} registrazion${n===1?'e eliminata':'i eliminate'}. Ognuno riattivi le notifiche da Impostazioni.`;}
    catch(error){status.textContent=error?.message||'Eliminazione non riuscita.';}
    finally{btn.disabled=false;}
  }
  async function removeDevices(){
    const select=$('push-day-agent'),status=$('push-day-status'),id=String(select.value||'');
    if(!id){status.textContent='Scegli prima l’agente nel campo Destinatario.';return;}
    const nome=select.selectedOptions[0]?.textContent.split(' · ')[0]||id;
    if(!confirm(`Eliminare tutti i dispositivi registrati di ${nome}? Dovrà riattivare le notifiche su ogni telefono.`))return;
    const btn=$('push-day-remove');btn.disabled=true;status.textContent='Eliminazione…';
    try{
      const n=await NaviPush.removeAgentSubscriptions(id);
      if(id===agentId){try{await NaviPush.unsubscribe(profile);}catch(_){ }await refreshStatus();}
      await loadRecipients();status.textContent=`${nome}: ${n} dispositiv${n===1?'o eliminato':'i eliminati'}. Riattivi le notifiche da Impostazioni.`;
    }catch(error){status.textContent=error?.message||'Eliminazione non riuscita.';}
    finally{btn.disabled=false;}
  }
  async function loadRecipients(){
    const select=$('push-day-agent'),status=$('push-day-status');
    if(!isAdmin||!select||!status)return;
    const refresh=$('push-day-refresh');if(refresh)refresh.disabled=true;status.textContent='Aggiornamento destinatari…';
    try{
      const subs=await NaviPush.listSubscriptions();const map=new Map();
      subs.forEach(item=>{const id=String(item?.agentId||'').trim();if(!id)return;const row=map.get(id)||{id,name:String(item?.agentName||id),count:0};row.count+=1;if(item?.agentName)row.name=String(item.agentName);map.set(id,row);});
      const recipientRows=[...map.values()].sort((a,b)=>a.name.localeCompare(b.name,'it'));
      const options=recipientRows.map(row=>`<option value="${esc(row.id)}">${esc(row.name)} · ${row.count} dispositiv${row.count===1?'o':'i'}</option>`).join('');
      select.innerHTML='<option value="">Scegli agente…</option>'+options;
      if(map.has(agentId))select.value=agentId;
      status.textContent=`${subs.length} dispositiv${subs.length===1?'o':'i'} push registrato${subs.length===1?'':'i'}.`;
      refreshDayPreview();
    }catch(error){status.textContent=error?.message||'Impossibile caricare i destinatari.';}
    finally{if(refresh)refresh.disabled=false;}
  }

  let previewToken=0,currentSummary=null;
  async function refreshDayPreview(){
    if(!isAdmin)return;const target=String($('push-day-agent')?.value||''),iso=String($('push-day-date')?.value||''),token=++previewToken;
    if(!target||!iso){$('push-day-preview').textContent='Scegli destinatario e giornata per vedere l’anteprima.';currentSummary=null;return;}
    $('push-day-preview').textContent='Preparazione riepilogo…';
    try{const data=await loadSchedule();if(token!==previewToken)return;currentSummary=buildSummary(data,target,iso);$('push-day-preview').innerHTML=`<strong style="display:block;color:var(--ink);margin-bottom:5px">${esc(currentSummary.title)}</strong>${esc(currentSummary.body).replace(/\n/g,'<br>')}`;}
    catch(error){if(token!==previewToken)return;currentSummary=null;$('push-day-preview').textContent='❌ '+(error?.message||'Riepilogo non disponibile.');}
  }

  async function sendDay(){
    const target=String($('push-day-agent').value||''),iso=String($('push-day-date').value||'');if(!target){$('push-day-status').textContent='Scegli un destinatario.';return;}if(!iso){$('push-day-status').textContent='Scegli la giornata.';return;}
    const button=$('push-day-send');button.disabled=true;$('push-day-status').textContent='Preparazione giornata…';
    try{const data=await loadSchedule();currentSummary=buildSummary(data,target,iso);await NaviPush.queuePush({requestedByAgentId:agentId,requestedByName:agentName,targetAgentId:target,title:currentSummary.title,body:currentSummary.body,url:'naviturni.html',kind:'tomorrow-summary',meta:{date:iso,service:currentSummary.shift||''}});$('push-day-status').textContent=`✅ Giornata ${NaviPushSummary.dateLabel(iso)} inviata.`;}
    catch(error){$('push-day-status').textContent='❌ '+(error?.message||'Invio non riuscito.');}finally{button.disabled=false;}
  }

  async function install(){
    createSection();await waitPush();
    // Prova in due passi: 1) il telefono sa mostrare una notifica; 2) una vera notifica parte dal server (NAS) verso questo agente
    $('push-test').addEventListener('click',async()=>{
      const btn=$('push-test'),st=$('push-status');btn.disabled=true;
      try{
        if(!('Notification' in window))throw new Error('Questo browser non può mostrare notifiche.');
        if(Notification.permission!=='granted')throw new Error('Prima attiva le notifiche con l’interruttore.');
        const reg=await navigator.serviceWorker.ready;
        await reg.showNotification('NaviSuite · prova sul telefono',{body:'1/2 · Questo telefono mostra le notifiche.',tag:'navi-test-locale'});
        st.textContent='1/2 ✓ Il telefono mostra le notifiche. Invio della prova dal server…';
        await NaviPush.queuePush({requestedByAgentId:agentId,requestedByName:profile?.name||'',targetAgentId:agentId,title:'NaviSuite · prova dal server',body:`2/2 · Le notifiche arrivano dal server (${new Date().toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}).`,url:'impostazioni.html',kind:'test'});
        st.textContent='1/2 ✓ Il telefono mostra le notifiche. 2/2 Prova inviata al server: deve arrivare entro un minuto su tutti i tuoi dispositivi. Se non arriva, il problema è sul server delle notifiche.';
      }catch(error){st.textContent=`Prova non riuscita: ${error?.message||error}`;}
      finally{btn.disabled=false;}
    });
    $('push-device-tg').addEventListener('click',()=>{const on=$('push-device-tg').getAttribute('aria-pressed')==='true';$(on?'push-disable':'push-enable').click();});
    $('push-enable').addEventListener('click',async()=>{const btn=$('push-enable');btn.disabled=true;$('push-status').textContent='Attivazione notifiche…';try{await NaviPush.subscribe(profile,prefsFromUi());$('push-status').textContent='✅ Notifiche attive e dispositivo registrato.';await refreshStatus();await loadRecipients();}catch(error){$('push-status').textContent=error?.message||'Attivazione non riuscita.';}finally{btn.disabled=false;}});
    $('push-disable').addEventListener('click',async()=>{const btn=$('push-disable');btn.disabled=true;$('push-status').textContent='Disattivazione…';try{await NaviPush.unsubscribe(profile);$('push-status').textContent='Notifiche disattivate su questo dispositivo.';await refreshStatus();await loadRecipients();}catch(error){$('push-status').textContent=error?.message||'Disattivazione non riuscita.';}finally{btn.disabled=false;}});
    ['push-pref-summary','push-pref-changes','push-pref-ods','push-pref-arrivals'].forEach(id=>$(id).addEventListener('change',()=>{updateScheduleUi();savePrefs();}));
    ['push-summary-mode','push-summary-time','push-summary-lead'].forEach(id=>$(id).addEventListener('change',()=>{updateScheduleUi();savePrefs('Orario del riepilogo automatico salvato.');}));
    if(isAdmin){$('push-day-refresh').addEventListener('click',loadRecipients);$('push-day-agent').addEventListener('change',refreshDayPreview);$('push-day-date').addEventListener('change',refreshDayPreview);$('push-day-send').addEventListener('click',sendDay);$('push-day-remove').addEventListener('click',removeDevices);$('push-remove-all').addEventListener('click',removeAll);}
    initAdminAlerts().catch(error=>console.warn('Avvisi amministratore:',error));
    await refreshStatus();await loadRecipients();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>install().catch(error=>console.error('Centro notifiche:',error)),{once:true});
  else install().catch(error=>console.error('Centro notifiche:',error));
})();
