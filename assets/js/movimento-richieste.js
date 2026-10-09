/*
 * NaviSuite · Movimento — tab Cambi richiesti: tutti i cambi turno fatti dagli agenti dalla propria Distinta, da oggi in poi,
 * ancora da decidere, in ordine di giorno. Per ognuno: approva, rifiuta (torna il turno previsto) o vai al giorno nel tab Agenti.
 */
(() => {
  'use strict';

  const NM = window.NaviMovimento;
  const view = document.getElementById('richieste-view');
  if (!NM || !view) return;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const NOMI = { RIP: 'Riposo', MAL: 'Malattia', CON: 'Congedo', FERIE: 'Ferie', LD: 'L.D.', LAV: 'Lavori', TERRA: 'Terra' };
  const nomeTurno = t => NOMI[String(t || '').trim().toUpperCase()] || t || '—';
  const GIORNI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
  const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
  const giorno = day => { const d = NM.parseIso(day); return `${GIORNI[d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()]}`; };
  const titolo = text => String(text || '').charAt(0) + String(text || '').slice(1).toLowerCase();

  function render() {
    const lista = NM.state.schedule ? NM.richieste() : [];
    document.getElementById('richieste-count').textContent = String(lista.length);
    if (!NM.state.schedule) { view.innerHTML = '<p class="muted">Caricamento turni…</p>'; return; }
    if (!lista.length) { view.innerHTML = '<p class="muted">Nessun cambio turno da decidere.</p>'; return; }
    view.innerHTML = `<ul class="rich-list">${lista.map(r => {
      const k = esc(`${r.agent.id}|${r.day}`);
      const prima = r.deciso || r.previsto;
      return `<li class="rich-item"><div class="rich-info"><b class="rich-giorno">${esc(giorno(r.day))}</b>` +
        `<span class="rich-nome">${esc(r.agent.agente)}</span><small>${esc(titolo(r.residenza))}${r.agent.qualifica ? ` · ${esc(r.agent.qualifica)}` : ''}</small></div>` +
        `<div class="rich-turni"><span class="chip" data-code="${esc(prima || '—')}">${esc(nomeTurno(prima))}</span><span class="rich-freccia">→</span>` +
        `<span class="chip" data-code="${esc(r.turno)}">${esc(nomeTurno(r.turno))}</span></div>` +
        `<div class="rich-azioni"><button type="button" class="btn primary" data-act="approva" data-k="${k}">✓ Approva</button>` +
        `<button type="button" class="btn danger" data-act="rifiuta" data-k="${k}" title="Torna ${esc(nomeTurno(prima))}">✗ Rifiuta</button>` +
        `<button type="button" class="btn" data-act="vai" data-k="${k}" title="Apri il giorno nel tab Agenti">Vai al giorno</button></div></li>`;
    }).join('')}</ul>`;
  }

  view.addEventListener('click', event => {
    const btn = event.target.closest('[data-act]');
    if (!btn) return;
    const [id, day] = String(btn.dataset.k).split('|');
    const r = NM.richieste().find(x => String(x.agent.id) === id && x.day === day);
    if (!r) return;
    if (btn.dataset.act === 'vai') {
      NM.goToDay(day);
      NM.showTab('agenti');
      document.dispatchEvent(new CustomEvent('mov:vedi-richieste'));
      return;
    }
    NM.decidiRichiesta(r, btn.dataset.act === 'approva' ? 'approva' : 'rifiuta');
  });

  NM.vista('richieste', render);
})();
