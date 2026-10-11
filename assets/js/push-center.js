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
      <div class="pref-head"><span class="pref-num" aria-hidden="true">03</span><div><h2>Notifiche</h2><p>Avvisi di NaviSuite anche con l’app chiusa o il telefono bloccato. Le scelte valgono per questo dispositivo.</p></div></div>
      <div style="padding:15px;border:1px solid #31535e;border-radius:14px;background:#0b2029">
        <strong id="push-device-title" style="display:block;margin-bottom:5px">Verifica notifiche…</strong>
        <span id="push-device-copy" style="display:block;color:var(--muted);font-size:12px;line-height:1.45">Controllo lo stato di questo dispositivo.</span>
        <div style="display:flex;flex-wrap:wrap;gap:9px;margin-top:14px">
          <button class="btn primary" id="push-enable" type="button">🔔 Attiva notifiche</button>
          <button class="btn" id="push-disable" type="button" hidden>Disattiva su questo dispositivo</button>
        </div>
        <div class="status" id="push-status" aria-live="polite"></div>
      </div>
      <div id="push-ios-help" style="display:none;padding:12px 14px;border:1px solid #795b24;border-radius:10px;background:#2b2415;color:#ffd27a;font-size:12px;line-height:1.5">Su iPhone le notifiche funzionano solo aprendo NaviSuite dall’icona sulla Home: in Safari tocca Condividi → «Aggiungi a Home», poi apri l’app da lì.</div>

      <div><h3 style="margin:0 0 4px;font-size:16px">Riepilogo della giornata</h3><p style="margin:0 0 12px;color:var(--muted);font-size:13px">Servizio, nave, equipaggio, ormeggio e rifornimento. Scegli quando riceverlo.</p>
      <div class="pref-tiles" role="group" aria-label="Riepilogo della giornata"><button type="button" class="pref-tile" data-sum="previous-day" aria-pressed="false"><span class="pref-tile-top"><span class="pref-icon" style="font-size:22px">🌙</span><span class="pref-check">✓</span></span><span><span class="pref-label">Il giorno prima</span><span class="pref-desc">A un’ora che scegli, la sera prima.</span></span></button><button type="button" class="pref-tile" data-sum="same-day" aria-pressed="false"><span class="pref-tile-top"><span class="pref-icon" style="font-size:22px">☀️</span><span class="pref-check">✓</span></span><span><span class="pref-label">La mattina</span><span class="pref-desc">A un’ora che scegli, il giorno stesso.</span></span></button><button type="button" class="pref-tile" data-sum="before-service" aria-pressed="false"><span class="pref-tile-top"><span class="pref-icon" style="font-size:22px">⏱</span><span class="pref-check">✓</span></span><span><span class="pref-label">Prima del servizio</span><span class="pref-desc">Un po’ prima dell’inizio del turno.</span></span></button><button type="button" class="pref-tile" data-sum="off" aria-pressed="false"><span class="pref-tile-top"><span class="pref-icon" style="font-size:22px">🔕</span><span class="pref-check">✓</span></span><span><span class="pref-label">Spento</span><span class="pref-desc">Nessun riepilogo.</span></span></button></div>
      <div id="push-summary-schedule" style="display:flex;gap:12px;flex-wrap:wrap;align-items:end;margin-top:12px">
        <div class="field" id="push-summary-time-wrap" style="margin:0;min-width:120px"><label for="push-summary-time">Ora</label><input id="push-summary-time" type="time" value="22:05" step="60"></div>
        <div class="field" id="push-summary-lead-wrap" style="margin:0;min-width:160px" hidden><label for="push-summary-lead">Anticipo</label><select id="push-summary-lead"><option value="30">30 minuti prima</option><option value="60" selected>1 ora prima</option><option value="120">2 ore prima</option></select></div>
        <p id="push-summary-copy" style="margin:0;flex:1 1 220px;color:var(--muted);font-size:12px;line-height:1.4"></p>
      </div></div>

      <div><h3 style="margin:0 0 4px;font-size:16px">Navi</h3><p style="margin:0 0 12px;color:var(--muted);font-size:13px">10 minuti prima. A bordo: il <b>prossimo scalo</b>. A terra: la <b>prossima nave</b> in arrivo, con pontile e comandante.</p>
      <div class="pref-tiles ticket" role="group" aria-label="Notifiche navi"><button type="button" class="pref-tile" data-navi="on" aria-pressed="false"><span class="pref-tile-top"><span class="pref-icon" style="font-size:22px">⛴</span><span class="pref-check">✓</span></span><span><span class="pref-label">Attive</span><span class="pref-desc">Prossimo scalo o prossima nave.</span></span></button><button type="button" class="pref-tile" data-navi="off" aria-pressed="false"><span class="pref-tile-top"><span class="pref-icon" style="font-size:22px">🔕</span><span class="pref-check">✓</span></span><span><span class="pref-label">Spente</span><span class="pref-desc">Nessun avviso delle navi.</span></span></button></div></div>

      <div><h3 style="margin:0 0 4px;font-size:16px">Altri avvisi</h3><p style="margin:0 0 12px;color:var(--muted);font-size:13px">Tocca per accendere o spegnere.</p>
      <div class="pref-tiles ticket" role="group" aria-label="Altri avvisi"><button type="button" class="pref-tile" data-altro="changes" aria-pressed="false"><span class="pref-tile-top"><span class="pref-icon" style="font-size:22px">⇄</span><span class="pref-check">✓</span></span><span><span class="pref-label">Cambi turno</span><span class="pref-desc">Richieste, approvazioni e modifiche.</span></span></button><button type="button" class="pref-tile" data-altro="ods" aria-pressed="false"><span class="pref-tile-top"><span class="pref-icon" style="font-size:22px">📋</span><span class="pref-check">✓</span></span><span><span class="pref-label">ODS e variazioni</span><span class="pref-desc">Nuovi ODS che ti riguardano.</span></span></button></div></div>

      <div hidden>
        <input id="push-pref-summary" type="checkbox"><input id="push-pref-changes" type="checkbox"><input id="push-pref-ods" type="checkbox"><input id="push-pref-arrivals" type="checkbox">
        <select id="push-summary-mode"><option value="previous-day"></option><option value="same-day"></option><option value="before-service"></option></select>
      </div>
        <div id="push-admin-alerts" ${isAdmin?'':'hidden'}>
          <div style="height:1px;background:#294b56;margin:2px 0 10px"></div>
          <div class="section-head" style="margin-bottom:6px"><div><h3 style="margin:0 0 4px;font-size:16px">Avvisi amministratore</h3><p style="margin:0;color:var(--muted);font-size:12px">Impostazione condivisa: vale per tutti i dispositivi.</p></div><span class="badge">Admin</span></div>
          <div class="switch-row" style="margin:0;padding:12px 0;border-bottom:0"><div class="switch-copy"><strong>Agente collegato a NaviSuite</strong><span>Ricevi una notifica ogni volta che un agente apre o riprende NaviSuite.</span></div><label class="switch"><input id="push-alert-connections" type="checkbox"><i></i></label></div>
          <div class="status" id="push-alert-status" aria-live="polite"></div>
        </div>

        <div id="push-admin-day" ${isAdmin?'':'hidden'} style="padding-top:5px">
          <div style="height:1px;background:#294b56;margin:2px 0 14px"></div>
          <div class="section-head" style="margin-bottom:10px"><div><h3 style="margin:0 0 4px;font-size:16px">Invia giornata · Admin</h3><p style="margin:0;color:var(--muted);font-size:12px">Invia manualmente a un agente il riepilogo reale della giornata.</p></div><span class="badge">Admin</span></div>
          <div class="grid"><div class="field"><label for="push-day-agent">Destinatario</label><select id="push-day-agent"><option value="">Caricamento…</option></select></div><div class="field"><label for="push-day-date">Giornata</label><input id="push-day-date" type="date" value="${todayRome()}"></div></div>
          <div id="push-day-preview" style="margin-top:12px;padding:12px 14px;border:1px solid #294b56;border-radius:10px;background:#0b2029;color:var(--muted);font-size:12px;line-height:1.5;white-space:pre-line">Scegli destinatario e giornata per vedere l’anteprima.</div>
          <div style="display:flex;flex-wrap:wrap;gap:9px;margin-top:12px"><button class="btn primary" id="push-day-send" type="button">Invia giornata</button><button class="btn" id="push-day-refresh" type="button">Aggiorna destinatari</button></div>
          <div class="status" id="push-day-status" aria-live="polite"></div>
        </div>
`;
    const dopo=document.getElementById('ticket-preference')||document.getElementById('pagina-iniziale');
    if(dopo)dopo.insertAdjacentElement('afterend',section);else document.querySelector('main')?.prepend(section);
    // tessere -> campi delle preferenze (stessi campi di prima: il push-worker sul NAS li legge uguali)
    const paint=()=>{
      const on=$('push-pref-summary').checked,mode=$('push-summary-mode').value;
      section.querySelectorAll('[data-sum]').forEach(t=>t.setAttribute('aria-pressed',String(on?t.dataset.sum===mode:t.dataset.sum==='off')));
      section.querySelectorAll('[data-navi]').forEach(t=>t.setAttribute('aria-pressed',String((t.dataset.navi==='on')===$('push-pref-arrivals').checked)));
      section.querySelectorAll('[data-altro]').forEach(t=>t.setAttribute('aria-pressed',String($(t.dataset.altro==='changes'?'push-pref-changes':'push-pref-ods').checked)));
      $('push-summary-schedule').hidden=!on;
    };
    const cambia=id=>$(id).dispatchEvent(new Event('change'));
    section.addEventListener('click',event=>{
      const t=event.target.closest('[data-sum],[data-navi],[data-altro]');if(!t)return;
      if(t.dataset.sum){const off=t.dataset.sum==='off';$('push-pref-summary').checked=!off;if(!off)$('push-summary-mode').value=t.dataset.sum;cambia('push-summary-mode');}
      else if(t.dataset.navi){$('push-pref-arrivals').checked=t.dataset.navi==='on';cambia('push-pref-arrivals');}
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
  async function refreshStatus(){
    const state=await NaviPush.getStatus(profile);fillPrefs(state.preferences);$('push-ios-help').style.display=NaviPush.isIos()&&!NaviPush.isStandalone()?'block':'none';
    if(!state.supported){$('push-device-title').textContent='Dispositivo non compatibile';$('push-device-copy').textContent='Questo browser non espone le API Web Push.';$('push-enable').hidden=false;$('push-enable').disabled=true;$('push-disable').hidden=true;return;}
    if(state.requiresMigration){$('push-device-title').textContent='🔄 Aggiornamento notifiche richiesto';$('push-device-copy').textContent='Tocca Riattiva notifiche una sola volta su questo dispositivo.';$('push-enable').textContent='🔔 Riattiva notifiche';$('push-enable').hidden=false;$('push-enable').disabled=false;$('push-disable').hidden=true;return;}
    if(state.enabled){$('push-device-title').textContent='🔔 Notifiche attive su questo dispositivo';$('push-device-copy').textContent='NaviSuite può ricevere Web Push anche quando è chiusa.';$('push-enable').hidden=true;$('push-disable').hidden=false;}
    else{$('push-device-title').textContent='🔕 Notifiche non attive';$('push-device-copy').textContent=state.permission==='denied'?'Il permesso è stato negato nelle impostazioni di iOS/browser.':'Attivale per ricevere gli avvisi di NaviSuite.';$('push-enable').hidden=false;$('push-enable').disabled=state.permission==='denied';$('push-disable').hidden=true;}
  }

  async function loadRecipients(){
    const select=$('push-day-agent'),status=$('push-day-status');
    if(!isAdmin||!select||!status)return;
    const refresh=$('push-day-refresh');if(refresh)refresh.disabled=true;status.textContent='Aggiornamento destinatari…';
    try{
      const subs=await NaviPush.listSubscriptions();const map=new Map();
      subs.forEach(item=>{const id=String(item?.agentId||'').trim();if(!id)return;const row=map.get(id)||{id,name:String(item?.agentName||id),count:0};row.count+=1;if(item?.agentName)row.name=String(item.agentName);map.set(id,row);});
      const recipientRows=[...map.values()].sort((a,b)=>a.name.localeCompare(b.name,'it'));
      const options=recipientRows.map(row=>`<option value="${esc(row.id)}">${esc(row.name)} · ${row.count} dispositivo${row.count===1?'':'i'}</option>`).join('');
      select.innerHTML='<option value="">Scegli agente…</option>'+options;
      if(map.has(agentId))select.value=agentId;
      status.textContent=`${subs.length} dispositivo${subs.length===1?'':'i'} push registrato${subs.length===1?'':'i'}.`;
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
    try{const data=await loadSchedule();currentSummary=buildSummary(data,target,iso);await NaviPush.queuePush({requestedByAgentId:agentId,requestedByName:agentName,targetAgentId:target,title:currentSummary.title,body:currentSummary.body,url:'naviturni.html',kind:'tomorrow-summary',meta:{date:iso,service:currentSummary.shift||''}});$('push-day-status').textContent=`✅ Giornata ${dateLabel(iso)} inviata.`;}
    catch(error){$('push-day-status').textContent='❌ '+(error?.message||'Invio non riuscito.');}finally{button.disabled=false;}
  }

  async function install(){
    createSection();await waitPush();
    $('push-enable').addEventListener('click',async()=>{const btn=$('push-enable');btn.disabled=true;$('push-status').textContent='Attivazione notifiche…';try{await NaviPush.subscribe(profile,prefsFromUi());$('push-status').textContent='✅ Notifiche attive e dispositivo registrato.';await refreshStatus();await loadRecipients();}catch(error){$('push-status').textContent=error?.message||'Attivazione non riuscita.';}finally{btn.disabled=false;}});
    $('push-disable').addEventListener('click',async()=>{const btn=$('push-disable');btn.disabled=true;$('push-status').textContent='Disattivazione…';try{await NaviPush.unsubscribe(profile);$('push-status').textContent='Notifiche disattivate su questo dispositivo.';await refreshStatus();await loadRecipients();}catch(error){$('push-status').textContent=error?.message||'Disattivazione non riuscita.';}finally{btn.disabled=false;}});
    ['push-pref-summary','push-pref-changes','push-pref-ods','push-pref-arrivals'].forEach(id=>$(id).addEventListener('change',()=>{updateScheduleUi();savePrefs();}));
    ['push-summary-mode','push-summary-time','push-summary-lead'].forEach(id=>$(id).addEventListener('change',()=>{updateScheduleUi();savePrefs('Orario del riepilogo automatico salvato.');}));
    if(isAdmin){$('push-day-refresh').addEventListener('click',loadRecipients);$('push-day-agent').addEventListener('change',refreshDayPreview);$('push-day-date').addEventListener('change',refreshDayPreview);$('push-day-send').addEventListener('click',sendDay);}
    initAdminAlerts().catch(error=>console.warn('Avvisi amministratore:',error));
    await refreshStatus();await loadRecipients();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>install().catch(error=>console.error('Centro notifiche:',error)),{once:true});
  else install().catch(error=>console.error('Centro notifiche:',error));
})();
