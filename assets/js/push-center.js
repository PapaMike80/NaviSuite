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
    const section=document.createElement('section');section.className='section settings-foldable';section.id='notifiche-push';section.dataset.collapsed='false';
    section.innerHTML=`
      <div class="section-head" role="button" tabindex="0" aria-expanded="true">
        <div><h2>Notifiche</h2><p>Ricevi avvisi NaviSuite anche quando la PWA è chiusa o l’iPhone è bloccato.</p></div>
        <span class="badge">Web Push</span><span class="settings-chevron" aria-hidden="true">⌄</span>
      </div>
      <div class="push-settings-body" style="display:grid;gap:16px">
        <div style="padding:15px;border:1px solid #31535e;border-radius:11px;background:#0b2029">
          <strong id="push-device-title" style="display:block;margin-bottom:5px">Verifica notifiche…</strong>
          <span id="push-device-copy" style="display:block;color:var(--muted);font-size:12px;line-height:1.45">Controllo lo stato di questo dispositivo.</span>
          <div style="display:flex;flex-wrap:wrap;gap:9px;margin-top:14px">
            <button class="btn primary" id="push-enable" type="button">🔔 Attiva notifiche</button>
            <button class="btn" id="push-disable" type="button" hidden>Disattiva su questo dispositivo</button>
          </div>
          <div class="status" id="push-status" aria-live="polite"></div>
        </div>

        <div>
          <h3 style="margin:0 0 4px;font-size:15px">Cosa vuoi ricevere</h3>
          <p style="margin:0 0 8px;color:var(--muted);font-size:12px">Le preferenze sono associate a questo dispositivo.</p>
          <div class="switch-row" style="margin:0;padding:12px 0 8px;border-top:1px solid #203e48;border-bottom:0">
            <div class="switch-copy"><strong>Riepilogo giornata di oggi</strong><span>Servizio, nave, equipaggio, ormeggio e rifornimento della giornata corrente.</span></div>
            <label class="switch"><input id="push-pref-summary" type="checkbox"><i></i></label>
          </div>
          <div id="push-summary-schedule" style="margin:0 0 6px;padding:9px 12px 13px;border-bottom:1px solid #203e48;background:rgba(11,32,41,.45);border-radius:0 0 10px 10px">
            <div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:end">
              <div class="field" style="margin:0"><label for="push-summary-mode">Quando riceverlo</label><select id="push-summary-mode"><option value="previous-day">Giorno prima, a un orario scelto</option><option value="same-day">Giorno stesso, a un orario scelto</option><option value="before-service">Prima dell’inizio del servizio</option></select></div>
              <div class="field" id="push-summary-time-wrap" style="margin:0;min-width:112px"><label for="push-summary-time">Ora</label><input id="push-summary-time" type="time" value="22:05" step="60"></div>
              <div class="field" id="push-summary-lead-wrap" style="margin:0;min-width:150px" hidden><label for="push-summary-lead">Anticipo</label><select id="push-summary-lead"><option value="30">30 minuti prima</option><option value="60" selected>1 ora prima</option><option value="120">2 ore prima</option></select></div>
            </div>
            <p id="push-summary-copy" style="margin:8px 0 0;color:var(--muted);font-size:11px;line-height:1.4"></p>
          </div>
          <div class="switch-row" style="margin:0;padding:12px 0;border-bottom:0"><div class="switch-copy"><strong>Cambi turno</strong><span>Richieste, approvazioni e modifiche che ti riguardano.</span></div><label class="switch"><input id="push-pref-changes" type="checkbox"><i></i></label></div>
          <div class="switch-row" style="margin:0;padding:12px 0"><div class="switch-copy"><strong>ODS e variazioni</strong><span>Nuovi ODS e variazioni rilevanti per il tuo servizio.</span></div><label class="switch"><input id="push-pref-ods" type="checkbox"><i></i></label></div>
          <div class="switch-row" style="margin:0;padding:12px 0;border-bottom:0"><div class="switch-copy"><strong>Arrivi delle navi</strong><span>Quando lavori a terra: 10 minuti prima di ogni nave in arrivo, con pontile e comandante.</span></div><label class="switch"><input id="push-pref-arrivals" type="checkbox"><i></i></label></div>
        </div>

        <div id="push-admin-alerts" ${isAdmin?'':'hidden'}>
          <div style="height:1px;background:#294b56;margin:2px 0 10px"></div>
          <div class="section-head" style="margin-bottom:6px"><div><h3 style="margin:0 0 4px;font-size:16px">Avvisi amministratore</h3><p style="margin:0;color:var(--muted);font-size:12px">Impostazione condivisa: vale per tutti i dispositivi.</p></div><span class="badge">Admin</span></div>
          <div class="switch-row" style="margin:0;padding:12px 0;border-bottom:0"><div class="switch-copy"><strong>Agente collegato a NaviSuite</strong><span>Ricevi una notifica ogni volta che un agente apre o riprende NaviSuite.</span></div><label class="switch"><input id="push-alert-connections" type="checkbox"><i></i></label></div>
          <div class="status" id="push-alert-status" aria-live="polite"></div>
        </div>

        <div id="push-ios-help" style="display:none;padding:12px 14px;border:1px solid #795b24;border-radius:10px;background:#2b2415;color:#ffd27a;font-size:12px;line-height:1.5">Su iPhone le notifiche funzionano aprendo NaviSuite dall’icona aggiunta alla schermata Home.</div>

        <div id="push-admin-day" ${isAdmin?'':'hidden'} style="padding-top:5px">
          <div style="height:1px;background:#294b56;margin:2px 0 14px"></div>
          <div class="section-head" style="margin-bottom:10px"><div><h3 style="margin:0 0 4px;font-size:16px">Invia giornata · Admin</h3><p style="margin:0;color:var(--muted);font-size:12px">Invia manualmente a un agente il riepilogo reale della giornata.</p></div><span class="badge">Admin</span></div>
          <div class="grid"><div class="field"><label for="push-day-agent">Destinatario</label><select id="push-day-agent"><option value="">Caricamento…</option></select></div><div class="field"><label for="push-day-date">Giornata</label><input id="push-day-date" type="date" value="${todayRome()}"></div></div>
          <div id="push-day-preview" style="margin-top:12px;padding:12px 14px;border:1px solid #294b56;border-radius:10px;background:#0b2029;color:var(--muted);font-size:12px;line-height:1.5;white-space:pre-line">Scegli destinatario e giornata per vedere l’anteprima.</div>
          <div style="display:flex;flex-wrap:wrap;gap:9px;margin-top:12px"><button class="btn primary" id="push-day-send" type="button">Invia giornata</button><button class="btn" id="push-day-refresh" type="button">Aggiorna destinatari</button></div>
          <div class="status" id="push-day-status" aria-live="polite"></div>
        </div>

      </div>`;
    const intro=document.querySelector('main > .intro');if(intro)intro.insertAdjacentElement('afterend',section);else document.querySelector('main')?.prepend(section);
    const head=section.querySelector(':scope > .section-head');const toggle=()=>{const collapsed=section.dataset.collapsed==='true';section.dataset.collapsed=String(!collapsed);head.setAttribute('aria-expanded',String(collapsed));};
    head.addEventListener('click',event=>{if(event.target.closest('button,a,input,select,textarea'))return;toggle();});
    head.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();toggle();}});
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
    $('push-summary-mode').value=prefs.summaryDelivery.mode;$('push-summary-time').value=prefs.summaryDelivery.time;$('push-summary-lead').value=String(prefs.summaryDelivery.leadMinutes);updateScheduleUi();
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
