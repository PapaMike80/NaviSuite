// Sondaggio anonimo in popup per gli agenti. Configurato dall'admin (Impostazioni › Guide popup › Sondaggi).
// Nessuna domanda obbligatoria; si puo' rimandare 3 volte (24 h ciascuna), poi resta finche' non si invia.
// Le risposte non contengono nome, id o ora: solo il giorno. Se la rete non risponde l'app non si blocca.
(function () {
  'use strict';
  if (window.NaviSurvey) return; // caricato due volte (menu e annunci): basta una
  // Domande di riserva (le stesse di partenza): di solito arrivano dal sondaggio, modificabili dall'admin
  const QUESTIONS = [
    { key: 'frequency', icon: '🕒', title: 'Con quale frequenza usi NaviSuite?', color: '#67d7e6', type: 'single',
      options: ['Ogni giorno', 'Qualche volta a settimana', 'Qualche volta al mese', 'Quasi mai'] },
    { key: 'ease', icon: '🧭', title: 'Quanto è facile trovare quello che ti serve?', color: '#fbbf24', type: 'single',
      options: ['Molto facile', 'Abbastanza facile', "Un po' difficile", 'Difficile'] },
    { key: 'features', icon: '⭐', title: 'Quali sezioni usi di più?', color: '#a78bfa', type: 'multi',
      options: ['Turni', 'Oggi', 'Cambio turno', 'Diaria', 'Documenti', 'Orario', 'Ponte Radio', 'Segnalazioni'] },
    { key: 'comment', icon: '💬', title: 'Cosa ti manca o non funziona?', color: '#fb923c', type: 'text' }
  ];
  const MAX_SKIPS = 3, SNOOZE_MS = 24 * 60 * 60 * 1000;
  let running = false;

  const agent = () => { try { return JSON.parse(localStorage.getItem('navidiaria.activeAgent') || localStorage.getItem('naviturni_logged_agent') || 'null'); } catch (_) { return null; } };
  const stateKey = (version, id) => `navisuite.survey.${version}.${id}`;
  const readState = (version, id) => { try { return { skips: 0, snoozeUntil: 0, done: false, ...JSON.parse(localStorage.getItem(stateKey(version, id)) || '{}') }; } catch (_) { return { skips: 0, snoozeUntil: 0, done: false }; } };
  const writeState = (version, id, state) => { try { localStorage.setItem(stateKey(version, id), JSON.stringify(state)); } catch (_) { /* niente */ } };

  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }

  function injectStyle() {
    if (document.getElementById('navi-survey-style')) return;
    const style = el('style'); style.id = 'navi-survey-style';
    style.textContent = '.navi-survey-overlay{position:fixed;inset:0;z-index:100001;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(1,10,15,.74);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);font-family:Manrope,system-ui,sans-serif}'
      + '.navi-survey-card{width:min(560px,100%);max-height:88vh;overflow:auto;box-sizing:border-box;padding:20px;border:1px solid rgba(45,212,191,.32);border-radius:22px;color:#eaf2f4;background:linear-gradient(160deg,color-mix(in srgb,#2dd4bf 9%,#0b1c26),#0b1c26 40%,color-mix(in srgb,#a78bfa 9%,#0b1c26));box-shadow:0 28px 80px rgba(0,0,0,.58)}'
      + '.navi-survey-kicker{display:block;color:#2dd4bf;font-size:11px;font-weight:900;letter-spacing:.16em}'
      + '.navi-survey-title{margin:6px 0 8px;font-size:22px;font-weight:900;background:linear-gradient(90deg,#2dd4bf,#67d7e6,#a78bfa);-webkit-background-clip:text;background-clip:text;color:transparent}'
      + '.navi-survey-badge{display:inline-block;margin-bottom:14px;padding:4px 10px;border-radius:999px;background:color-mix(in srgb,#a78bfa 20%,#102733);border:1px solid color-mix(in srgb,#a78bfa 45%,transparent);color:#c4b5fd;font-size:12px;font-weight:800}'
      + '.navi-survey-box{margin:0 0 10px;padding:12px;border-radius:14px;border:1px solid color-mix(in srgb,var(--c) 40%,transparent);background:color-mix(in srgb,var(--c) 12%,#102733)}'
      + '.navi-survey-box h3{margin:0 0 9px;color:var(--c);font-size:14px;font-weight:900}'
      + '.navi-survey-opts{display:flex;flex-wrap:wrap;gap:6px}'
      + '.navi-survey-opt{padding:7px 11px;border-radius:999px;border:1px solid color-mix(in srgb,var(--c) 45%,transparent);background:transparent;color:#eaf2f4;font:800 13px Manrope,system-ui,sans-serif;cursor:pointer}'
      + '.navi-survey-opt.on{background:var(--c);border-color:var(--c);color:#06231f}'
      + '.navi-survey-text{box-sizing:border-box;width:100%;min-height:80px;padding:10px;border-radius:10px;border:1px solid color-mix(in srgb,var(--c) 45%,transparent);background:#071923;color:#eaf2f4;font:14px Manrope,system-ui,sans-serif;resize:vertical}'
      + '.navi-survey-count{display:block;margin-top:4px;text-align:right;color:#9fb8c2;font-size:11px}'
      + '.navi-survey-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;margin-top:14px}'
      + '.navi-survey-actions button{padding:11px 18px;border-radius:999px;font:900 14px Manrope,system-ui,sans-serif;cursor:pointer}'
      + '.navi-survey-send{border:0;background:linear-gradient(90deg,#2dd4bf,#67d7e6);color:#06231f}'
      + '.navi-survey-later{border:1px solid #1f4250;background:transparent;color:#9fb8c2}'
      + '.navi-survey-msg{min-height:16px;margin-top:8px;color:#fb7185;font-size:12px;text-align:right}';
    document.head.appendChild(style);
  }

  // Costruisce il popup; onSend(risposte) / onLater() / preview
  function show({ preview = false, skipsLeft = MAX_SKIPS, questions, onSend, onLater }) {
    injectStyle();
    document.querySelector('.navi-survey-overlay')?.remove();
    const list = Array.isArray(questions) && questions.length ? questions : QUESTIONS;
    const answers = Object.fromEntries(list.map(q => [q.key, q.type === 'multi' ? [] : '']));
    const overlay = el('div', 'navi-survey-overlay'), card = el('div', 'navi-survey-card');
    overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true');
    card.append(el('span', 'navi-survey-kicker', 'SONDAGGIO'), el('h2', 'navi-survey-title', 'Aiutaci a migliorare NaviSuite'), el('span', 'navi-survey-badge', 'Anonimo · non collegato al tuo nome'));
    list.forEach(q => {
      const box = el('div', 'navi-survey-box'); box.style.setProperty('--c', q.color);
      box.appendChild(el('h3', '', `${q.icon ? q.icon + ' ' : ''}${q.title}`));
      if (q.type === 'text') {
        const ta = el('textarea', 'navi-survey-text'); ta.maxLength = 500; ta.placeholder = 'Scrivi qui (facoltativo)';
        const count = el('span', 'navi-survey-count', '0/500');
        ta.addEventListener('input', () => { answers[q.key] = ta.value; count.textContent = `${ta.value.length}/500`; });
        box.append(ta, count);
      } else {
        const opts = el('div', 'navi-survey-opts');
        q.options.forEach(option => {
          const b = el('button', 'navi-survey-opt', option); b.type = 'button';
          b.addEventListener('click', () => {
            if (q.type === 'multi') {
              const sel = answers[q.key], i = sel.indexOf(option);
              if (i >= 0) sel.splice(i, 1); else sel.push(option);
              b.classList.toggle('on', i < 0);
            } else {
              // secondo tocco sulla stessa scelta: la toglie
              answers[q.key] = answers[q.key] === option ? '' : option;
              opts.querySelectorAll('.navi-survey-opt').forEach(x => x.classList.toggle('on', x.textContent === answers[q.key]));
            }
          });
          opts.appendChild(b);
        });
        box.appendChild(opts);
      }
      card.appendChild(box);
    });
    const actions = el('div', 'navi-survey-actions'), msg = el('div', 'navi-survey-msg');
    const close = () => overlay.remove();
    if (preview) {
      const b = el('button', 'navi-survey-send', 'Chiudi anteprima'); b.type = 'button'; b.addEventListener('click', close); actions.appendChild(b);
    } else {
      if (skipsLeft > 0) {
        const later = el('button', 'navi-survey-later', `Più tardi (${skipsLeft})`); later.type = 'button';
        later.addEventListener('click', () => { close(); onLater?.(); });
        actions.appendChild(later);
      }
      const send = el('button', 'navi-survey-send', 'Invia'); send.type = 'button';
      send.addEventListener('click', async () => {
        send.disabled = true; msg.textContent = '';
        try { await onSend?.(answers); close(); }
        catch (_) { send.disabled = false; msg.textContent = 'Invio non riuscito: riprova tra poco.'; }
      });
      actions.appendChild(send);
    }
    card.append(actions, msg); overlay.appendChild(card); document.body.appendChild(overlay);
  }

  async function run() {
    if (running || document.querySelector('.navi-survey-overlay')) return;
    const me = agent(), id = String(me?.id || '').trim();
    if (!id) return; // solo dopo il login
    if (document.querySelector('.navi-news-overlay')) { setTimeout(run, 4000); return; } // prima gli annunci
    const F = window.NaviAdminFirebase;
    if (!F?.getSurveyConfig) return;
    running = true;
    try {
      const config = await F.getSurveyConfig();
      const version = String(config?.version || '');
      if (!config?.enabled || !/^[A-Za-z0-9_-]{1,40}$/.test(version)) return;
      const state = readState(version, id);
      if (state.done) return;
      if (state.skips < MAX_SKIPS && Date.now() < Number(state.snoozeUntil || 0)) return;
      if (await F.hasSurveyDone(id, version)) { writeState(version, id, { ...state, done: true }); return; }
      if (document.querySelector('.navi-news-overlay')) { setTimeout(run, 4000); return; }
      show({
        skipsLeft: MAX_SKIPS - state.skips,
        questions: config.questions,
        onLater: () => writeState(version, id, { ...state, skips: state.skips + 1, snoozeUntil: Date.now() + SNOOZE_MS }),
        onSend: async answers => { await F.submitSurvey(id, version, answers); writeState(version, id, { ...state, done: true }); }
      });
    } catch (_) { /* rete o servizio non disponibili: l'app continua */ }
    finally { running = false; }
  }

  window.NaviSurvey = { run, preview: questions => show({ preview: true, questions }) };
  setTimeout(run, 1800);
  document.addEventListener('navisuite-login-complete', () => setTimeout(run, 1800));
})();
