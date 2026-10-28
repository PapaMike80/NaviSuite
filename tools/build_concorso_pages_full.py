# -*- coding: utf-8 -*-
import json
import os

from build_concorso_pages import modules_data
from build_concorso_data import past_papers, historical_questions, all_docs

# Leggiamo i quesiti dal file build_quiz.py originale
from build_concorso_pages import *

# Creiamo il file HTML per concorso-controllo.html
html_controllo = '''<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Concorso Controllo · Operatore di Ufficio | NaviSuite</title>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700;800&family=DM+Mono:wght@400;500&display=swap">
  <link rel="shortcut icon" href="assets/images/favicon.svg" type="image/svg+xml">
  <style>
    :root {
      --bg: #071923;
      --surface: #0b1c26;
      --card: #102733;
      --card2: #143140;
      --line: #1f4250;
      --ink: #eaf2f4;
      --muted: #9fb8c2;
      --on: #06231f;

      --teal: #2dd4bf;
      --cyan: #67d7e6;
      --violet: #a78bfa;
      --amber: #fbbf24;
      --orange: #fb923c;
      --rose: #fb7185;
      --green: #52c879;
      --pink: #f472b6;
      --blue: #54a7ff;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    body {
      background: linear-gradient(160deg, color-mix(in srgb, var(--teal) 9%, var(--surface)), var(--surface) 40%, color-mix(in srgb, var(--violet) 9%, var(--surface)));
      color: var(--ink);
      font-family: 'Manrope', system-ui, -apple-system, sans-serif;
      line-height: 1.5;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    a { color: var(--teal); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .mono { font-family: 'DM Mono', monospace; font-variant-numeric: tabular-nums; }
    .wrap { width: min(1060px, calc(100% - 32px)); margin: auto; }

    /* Top Breadcrumb */
    .top-nav {
      background: rgba(7, 25, 35, 0.92);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--line);
      position: sticky;
      top: 0;
      z-index: 100;
      padding: 12px 0;
    }
    .top-nav-inner {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }
    .back-link {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: var(--muted);
      font-weight: 700;
      font-size: 0.88rem;
      padding: 6px 12px;
      border-radius: 999px;
      border: 1px solid var(--line);
      background: var(--card);
      transition: all 0.15s ease;
    }
    .back-link:hover {
      color: var(--ink);
      border-color: var(--teal);
      background: var(--card2);
      text-decoration: none;
    }

    /* Hero */
    header.hero {
      padding: 34px 0 20px;
    }
    .eyebrow {
      display: inline-block;
      font-size: 0.76rem;
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--teal);
      margin-bottom: 6px;
    }
    h1.title {
      font-size: clamp(1.7rem, 4vw, 2.6rem);
      font-weight: 800;
      line-height: 1.15;
      margin-bottom: 10px;
      background: linear-gradient(135deg, #ffffff 40%, var(--cyan) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    p.subtitle {
      color: var(--muted);
      max-width: 78ch;
      font-size: 0.98rem;
      margin-bottom: 20px;
    }
    .meta-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .pill {
      background: var(--card);
      border: 1px solid var(--line);
      padding: 5px 12px;
      border-radius: 999px;
      font-size: 0.82rem;
      color: var(--muted);
    }
    .pill strong { color: var(--ink); }
    .pill.highlight { border-color: color-mix(in srgb, var(--teal) 50%, transparent); color: var(--teal); background: color-mix(in srgb, var(--teal) 10%, var(--card)); }

    /* Tab bar */
    .tabs-wrapper {
      margin: 24px 0 28px;
      border-bottom: 1px solid var(--line);
    }
    .tabs {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      padding-bottom: 4px;
    }
    .tab-btn {
      background: transparent;
      border: none;
      color: var(--muted);
      font-family: inherit;
      font-size: 0.95rem;
      font-weight: 700;
      padding: 10px 18px;
      border-radius: 12px 12px 0 0;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      border-bottom: 3px solid transparent;
      transition: all 0.2s ease;
      white-space: nowrap;
    }
    .tab-btn:hover {
      color: var(--ink);
      background: rgba(255,255,255,0.04);
    }
    .tab-btn.active {
      color: var(--teal);
      border-bottom-color: var(--teal);
      background: color-mix(in srgb, var(--teal) 8%, var(--card));
    }

    /* Content views */
    .tab-view { display: none; padding-bottom: 60px; }
    .tab-view.active { display: block; }

    /* Standardized Material Card */
    .material-grid {
      display: grid;
      gap: 20px;
    }
    .material-card {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 18px;
      padding: 24px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.25);
      position: relative;
      overflow: hidden;
      display: grid;
      gap: 16px;
    }
    .material-card::before {
      content: "";
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 4px;
      background: var(--c, var(--teal));
    }
    .card-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      flex-wrap: wrap;
    }
    .card-badge-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 4px;
    }
    .mod-tag {
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--c, var(--teal));
    }
    .ref-badge {
      font-size: 0.75rem;
      background: rgba(255,255,255,0.06);
      border: 1px solid var(--line);
      color: var(--muted);
      padding: 2px 8px;
      border-radius: 6px;
    }
    .card-title {
      font-size: 1.25rem;
      font-weight: 800;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .card-title .icon {
      font-size: 1.4rem;
    }

    /* Uniform Key Points Box */
    .key-points-box {
      background: color-mix(in srgb, var(--c, var(--teal)) 8%, #091724);
      border: 1px solid color-mix(in srgb, var(--c, var(--teal)) 35%, transparent);
      border-radius: 14px;
      padding: 16px 18px;
    }
    .box-header {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.86rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--c, var(--teal));
      margin-bottom: 12px;
    }
    .key-list {
      list-style: none;
      display: grid;
      gap: 9px;
    }
    .key-list li {
      font-size: 0.92rem;
      line-height: 1.5;
      padding-left: 20px;
      position: relative;
      color: #e2edfa;
    }
    .key-list li::before {
      content: "▪";
      position: absolute;
      left: 4px;
      color: var(--c, var(--teal));
      font-size: 1.2rem;
      line-height: 1;
      top: -1px;
    }
    .key-list strong {
      color: #ffffff;
      font-weight: 750;
    }

    /* Explanation body */
    .explanation-text {
      color: #c9d8e8;
      font-size: 0.94rem;
      line-height: 1.6;
    }

    /* Trap warning box */
    .traps-box {
      background: rgba(251, 113, 133, 0.08);
      border: 1px solid rgba(251, 113, 133, 0.3);
      border-left: 4px solid var(--rose);
      border-radius: 0 10px 10px 0;
      padding: 12px 16px;
    }
    .traps-title {
      font-size: 0.82rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--rose);
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .traps-list {
      list-style: square;
      padding-left: 18px;
      color: #ffdce1;
      font-size: 0.88rem;
      display: grid;
      gap: 4px;
    }

    /* Action bar of card */
    .card-actions {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 12px;
      border-top: 1px solid var(--line);
      padding-top: 14px;
      margin-top: 4px;
    }
    .btn-file {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: var(--card2);
      border: 1px solid var(--line);
      color: var(--ink);
      padding: 8px 14px;
      border-radius: 10px;
      font-size: 0.86rem;
      font-weight: 700;
      transition: all 0.15s ease;
    }
    .btn-file:hover {
      border-color: var(--teal);
      background: color-mix(in srgb, var(--teal) 15%, var(--card2));
      text-decoration: none;
    }

    /* Documents view table */
    .docs-table {
      width: 100%;
      border-collapse: collapse;
      background: var(--card);
      border-radius: 16px;
      overflow: hidden;
      border: 1px solid var(--line);
    }
    .docs-table th, .docs-table td {
      padding: 14px 16px;
      text-align: left;
      border-bottom: 1px solid var(--line);
      font-size: 0.92rem;
    }
    .docs-table th {
      background: #0d212d;
      color: var(--muted);
      font-weight: 800;
      font-size: 0.78rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .docs-table tr:hover td {
      background: rgba(255,255,255,0.02);
    }

    /* Past Papers Card Grid */
    .past-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(310px, 1fr));
      gap: 16px;
      margin-bottom: 30px;
    }
    .past-card {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      transition: all 0.2s ease;
    }
    .past-card:hover {
      border-color: var(--cyan);
      transform: translateY(-2px);
    }

    /* Simulator styling in-page */
    .sim-card {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 18px;
      padding: 26px;
      box-shadow: 0 12px 36px rgba(0,0,0,0.3);
    }
    .sim-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }
    .sim-timer {
      background: #2a1b0c;
      border: 1px solid #7c4412;
      color: #ffb74d;
      padding: 6px 14px;
      border-radius: 999px;
      font-weight: 800;
      font-family: 'DM Mono', monospace;
      font-size: 1rem;
      display: none;
    }
    .sim-progress-bar {
      height: 8px;
      background: var(--line);
      border-radius: 99px;
      overflow: hidden;
      margin-bottom: 20px;
    }
    .sim-progress-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--teal), var(--cyan));
      width: 0%;
      transition: width 0.3s ease;
    }
    .sim-q-badge {
      display: inline-block;
      font-size: 0.76rem;
      font-weight: 800;
      color: var(--teal);
      background: color-mix(in srgb, var(--teal) 12%, var(--card));
      padding: 4px 10px;
      border-radius: 8px;
      margin-bottom: 10px;
    }
    .sim-q-text {
      font-size: 1.18rem;
      font-weight: 750;
      line-height: 1.45;
      margin-bottom: 20px;
      color: #ffffff;
    }
    .sim-options {
      display: grid;
      gap: 12px;
      margin-bottom: 20px;
    }
    .sim-opt-btn {
      background: var(--card2);
      border: 1.5px solid var(--line);
      border-radius: 12px;
      padding: 14px 18px;
      color: var(--ink);
      font-family: inherit;
      font-size: 0.96rem;
      text-align: left;
      cursor: pointer;
      line-height: 1.4;
      transition: all 0.15s ease;
    }
    .sim-opt-btn:hover:not(:disabled) {
      border-color: var(--teal);
      background: color-mix(in srgb, var(--teal) 10%, var(--card2));
    }
    .sim-opt-btn.correct {
      background: rgba(82, 200, 121, 0.15) !important;
      border-color: var(--green) !important;
      color: #a4f2bf !important;
      font-weight: 700;
    }
    .sim-opt-btn.wrong {
      background: rgba(251, 113, 133, 0.15) !important;
      border-color: var(--rose) !important;
      color: #ffb4be !important;
      font-weight: 700;
    }
    .sim-feedback {
      display: none;
      padding: 14px 18px;
      border-radius: 12px;
      font-size: 0.94rem;
      line-height: 1.5;
      margin-bottom: 20px;
    }
    .sim-feedback.ok {
      display: block;
      background: rgba(82, 200, 121, 0.12);
      border-left: 4px solid var(--green);
      color: #c3f7d4;
    }
    .sim-feedback.bad {
      display: block;
      background: rgba(251, 113, 133, 0.12);
      border-left: 4px solid var(--rose);
      color: #ffd2d8;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .tabs { gap: 4px; }
      .tab-btn { padding: 8px 12px; font-size: 0.88rem; }
      .material-card { padding: 18px; }
    }
  </style>
</head>
<body>

  <!-- Barra Superiore di Ritorno -->
  <nav class="top-nav">
    <div class="wrap top-nav-inner">
      <a href="quiz.html" class="back-link">
        <span>←</span>
        <span>Torna a Concorsi GGNL</span>
      </a>
      <span class="mono" style="font-size:0.8rem; color:var(--muted);">GGNL · Ufficio Controllo</span>
    </div>
  </nav>

  <header class="wrap hero">
    <span class="eyebrow">MINISTERO DELLE INFRASTRUTTURE E DEI TRASPORTI · G.G.N.L.</span>
    <h1 class="title">Concorso Operatore di Ufficio</h1>
    <p class="subtitle">Settore Amministrativo – Ufficio Controllo (par. 130) · Bando Prot. C163/2026.<br>Materiale di studio ad impaginazione standardizzata, testi normativi integrali, prove scritte ufficiali passate e simulatore d'esame interattivo.</p>
    
    <div class="meta-pills">
      <div class="pill highlight"><strong>3 Posti</strong> (Arona, Como, Desenzano)</div>
      <div class="pill">Tempo Determinato <strong>12 Mesi Full-time</strong></div>
      <div class="pill">CCNL Autoferrotranviari <strong>(RAL ~23.000 €)</strong></div>
      <div class="pill">Soglia Idoneità <strong>18/30</strong></div>
    </div>

    <!-- Schede di Navigazione Rapida -->
    <div class="tabs-wrapper">
      <div class="tabs" role="tablist">
        <button class="tab-btn active" onclick="openTab('materiali')" id="btn-tab-materiali">
          <span>📚</span><span>Materiali & Dispense</span>
        </button>
        <button class="tab-btn" onclick="openTab('documenti')" id="btn-tab-documenti">
          <span>🏛️</span><span>Documenti & Normativa PDF</span>
        </button>
        <button class="tab-btn" onclick="openTab('prove')" id="btn-tab-prove">
          <span>📜</span><span>Prove Passate & Quesiti Storici</span>
        </button>
        <button class="tab-btn" onclick="openTab('quiz')" id="btn-tab-quiz">
          <span>🎯</span><span>Simulatore Quiz Ufficiale</span>
        </button>
      </div>
    </div>
  </header>

  <main class="wrap">
    <!-- TAB 1: MATERIALI DI STUDIO AD IMPAGINAZIONE UNIFORME -->
    <section id="tab-materiali" class="tab-view active">
      <div style="margin-bottom:18px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
        <p style="color:var(--muted); font-size:0.92rem;">Tutti i 9 moduli del programma d'esame strutturati secondo lo standard: <strong>Punti Chiave</strong>, <strong>Sintesi Ragionata</strong> e <strong>Trappole dei Quiz</strong>.</p>
        <a href="docs/controllo/00_GUIDA_STUDIO_E_INDICE_MATERIE.md" class="btn-file" target="_blank">📄 Apri Guida Completa (Markdown)</a>
      </div>

      <div class="material-grid">
'''

# Generiamo le carte dei moduli con stile identico
for m in modules_data:
    key_items_html = "".join([f"<li>{kp}</li>" for kp in m["key_points"]])
    traps_items_html = "".join([f"<li>{tr}</li>" for tr in m["traps"]])
    
    html_controllo += f'''
        <!-- {m["num"]} -->
        <article class="material-card" id="{m["id"]}" style="--c:{m["color"]};">
          <div class="card-top">
            <div>
              <div class="card-badge-row">
                <span class="mod-tag">{m["num"]}</span>
                <span class="ref-badge">{m["ref"]}</span>
              </div>
              <h2 class="card-title"><span class="icon">{m["icon"]}</span><span>{m["title"]}</span></h2>
            </div>
          </div>

          <!-- PUNTI CHIAVE STANDARD -->
          <div class="key-points-box">
            <div class="box-header"><span>📌</span><span>Punti Chiave & Numeri da Ricordare per l'Esame</span></div>
            <ul class="key-list">
              {key_items_html}
            </ul>
          </div>

          <!-- SINTESI RAGIONATA -->
          <div class="explanation-text">
            {m["body_text"]}
          </div>

          <!-- TRAPPOLE E DISTRATTORI QUIZ -->
          <div class="traps-box">
            <div class="traps-title"><span>⚠️</span><span>Attenzione alle Trappole e ai Distrattori nei Quiz</span></div>
            <ul class="traps-list">
              {traps_items_html}
            </ul>
          </div>

          <!-- AZIONI / LINK AL DOCUMENTO -->
          <div class="card-actions">
            <a href="{m["pdf_link"]}" target="_blank" class="btn-file">
              <span>📥</span><span>Consulta Documento ({m["pdf_name"]})</span>
            </a>
          </div>
        </article>
    '''

html_controllo += '''
      </div>
    </section>

    <!-- TAB 2: DOCUMENTI UFFICIALI & NORMATIVA PDF -->
    <section id="tab-documenti" class="tab-view">
      <div style="margin-bottom:18px;">
        <h2 style="font-size:1.3rem; margin-bottom:6px;">Archivio Normativo e Documentale Completo</h2>
        <p style="color:var(--muted); font-size:0.92rem;">Testi integrali ufficiali delle leggi, decreti, regolamenti aziendali e dispense scaricabili con un clic.</p>
      </div>

      <table class="docs-table">
        <thead>
          <tr>
            <th>Documento / Titolo</th>
            <th>Tipologia</th>
            <th>Descrizione</th>
            <th>Azione</th>
          </tr>
        </thead>
        <tbody>
'''

for title, path_file, desc, tipologia in all_docs:
    html_controllo += f'''
          <tr>
            <td><strong>{title}</strong></td>
            <td><span class="pill" style="font-size:0.75rem;">{tipologia}</span></td>
            <td style="color:var(--muted); font-size:0.86rem;">{desc}</td>
            <td><a href="{path_file}" target="_blank" class="btn-file" style="padding:5px 10px; font-size:0.8rem;">Apri ↗</a></td>
          </tr>
    '''

html_controllo += '''
        </tbody>
      </table>
    </section>

    <!-- TAB 3: PROVE PASSATE & QUESITI STORICI -->
    <section id="tab-prove" class="tab-view">
      <div style="margin-bottom:20px;">
        <h2 style="font-size:1.3rem; margin-bottom:6px;">Prove Scritte Ufficiali Passate della Gestione Governativa</h2>
        <p style="color:var(--muted); font-size:0.92rem;">Fascicoli originali delle prove scritte svolte nei concorsi precedenti di Navigazione Laghi (2025 Lago di Garda e Lago di Como).</p>
      </div>

      <div class="past-grid">
'''

for pp in past_papers:
    html_controllo += f'''
        <div class="past-card">
          <div>
            <span class="eyebrow" style="color:var(--cyan);">{pp["date"]}</span>
            <h3 style="font-size:1.05rem; margin:4px 0 8px; color:#fff;">{pp["title"]}</h3>
            <p style="color:var(--muted); font-size:0.88rem; margin-bottom:14px;">{pp["desc"]}</p>
          </div>
          <a href="{pp["file"]}" target="_blank" class="btn-file" style="justify-content:center;">📥 Scarica Prova Ufficiale PDF</a>
        </div>
    '''

html_controllo += '''
      </div>

      <!-- Tabella Quesiti Storici Commentati -->
      <div style="margin-top:28px;">
        <h3 style="font-size:1.15rem; margin-bottom:12px; color:var(--amber);">💡 Domande Reali Più Frequenti tratte dalle Prove Precedenti</h3>
        <table class="docs-table">
          <thead>
            <tr>
              <th style="width:40%;">Quesito Ufficiale</th>
              <th style="width:30%;">Risposta Esatta</th>
              <th>Fonte / Note Didattiche</th>
            </tr>
          </thead>
          <tbody>
'''

for hq in historical_questions:
    html_controllo += f'''
            <tr>
              <td><strong>{hq["q"]}</strong></td>
              <td style="color:var(--green); font-weight:700;">{hq["ans"]}</td>
              <td style="font-size:0.85rem; color:var(--muted);"><em>{hq["source"]}</em><br>{hq["note"]}</td>
            </tr>
    '''

html_controllo += '''
          </tbody>
        </table>
      </div>
    </section>

    <!-- TAB 4: SIMULATORE QUIZ UFFICIALE -->
    <section id="tab-quiz" class="tab-view">
      <div class="sim-card">
        <!-- Schermata Menu Quiz -->
        <div id="sim-screen-menu">
          <div style="margin-bottom:20px;">
            <h2 style="font-size:1.35rem; margin-bottom:6px; color:#fff;">Simulatore Quiz Concorso Controllo</h2>
            <p style="color:var(--muted); font-size:0.92rem;">Ogni volta che avvii una prova, <strong>le opzioni di risposta vengono rimescolate in modo casuale</strong> per un allenamento reale senza posizioni fisse. Punteggio in trentesimi e soglia di idoneità a <strong>18/30</strong>.</p>
          </div>

          <button onclick="startExam(true)" class="btn-file" style="background:linear-gradient(135deg,#00897b,#00695c); color:#fff; padding:16px 20px; font-size:1.05rem; font-weight:800; border:none; width:100%; justify-content:center; margin-bottom:20px; cursor:pointer;">
            <span>🎯 Avvia Simulazione d'Esame Completa (30 quesiti · 30 min)</span>
          </button>

          <h3 style="font-size:0.88rem; text-transform:uppercase; letter-spacing:0.1em; color:var(--muted); margin-bottom:12px;">Oppure allenati per singolo modulo tematico:</h3>
          <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:10px;" id="sim-module-buttons"></div>
        </div>

        <!-- Schermata Domanda in Corso -->
        <div id="sim-screen-active" style="display:none;">
          <div class="sim-header">
            <button onclick="exitSim()" class="back-link">← Interrompi e torna al menu</button>
            <span id="sim-counter" class="mono" style="font-size:0.9rem; font-weight:700; color:var(--muted);">Domanda 1 di 30</span>
            <div id="sim-timer-pill" class="sim-timer">⏱ <span id="sim-timer-val">30:00</span></div>
          </div>

          <div class="sim-progress-bar">
            <div id="sim-progress-fill" class="sim-progress-fill"></div>
          </div>

          <span class="sim-q-badge" id="sim-q-badge">Modulo</span>
          <h3 class="sim-q-text" id="sim-q-text">Testo della domanda...</h3>

          <div class="sim-options" id="sim-opts-container"></div>

          <div class="sim-feedback" id="sim-feedback"></div>

          <div style="display:flex; justify-content:flex-end; margin-top:14px;">
            <button id="sim-btn-next" onclick="nextQuestion()" class="btn-file" style="background:var(--teal); color:var(--on); border:none; display:none; cursor:pointer;">Prossima Domanda →</button>
          </div>
        </div>

        <!-- Schermata Risultati -->
        <div id="sim-screen-result" style="display:none; text-align:center; padding:20px 0;">
          <div style="width:130px; height:130px; border-radius:50%; margin:0 auto 16px; display:flex; flex-direction:column; align-items:center; justify-content:center; background:#071822; border:6px solid var(--teal);" id="res-circle">
            <span class="mono" id="res-score-val" style="font-size:2.4rem; font-weight:800; color:var(--teal); line-height:1;">0</span>
            <span style="font-size:0.8rem; color:var(--muted);">su 30</span>
          </div>

          <h2 id="res-verdict-title" style="font-size:1.4rem; font-weight:800; margin-bottom:6px;">Esito Prova</h2>
          <p id="res-verdict-desc" style="color:var(--muted); max-width:55ch; margin:0 auto 20px; font-size:0.94rem;">Descrizione del risultato.</p>

          <div style="display:flex; justify-content:center; gap:16px; margin-bottom:24px; flex-wrap:wrap;">
            <div class="pill">Esatte: <strong id="res-correct-count" style="color:var(--green);">0</strong></div>
            <div class="pill">Errate: <strong id="res-wrong-count" style="color:var(--rose);">0</strong></div>
            <div class="pill">Accuratezza: <strong id="res-accuracy-pct">0%</strong></div>
          </div>

          <div style="display:flex; justify-content:center; gap:12px;">
            <button onclick="startExam(isSimExamMode)" class="btn-file" style="background:var(--teal); color:var(--on); border:none; cursor:pointer;">Ripeti Prova</button>
            <button onclick="exitSim()" class="back-link" style="cursor:pointer;">Torna al Menu Quiz</button>
          </div>
        </div>
      </div>
    </section>
  </main>

  <footer style="text-align:center; padding:30px 0; border-top:1px solid var(--line); margin-top:60px; color:var(--muted); font-size:0.84rem;">
    NaviSuite · Preparazione Concorso Operatore di Ufficio GGNL (par. 130)
  </footer>

  <script>
    // Tab switching
    function openTab(tabName) {
      document.querySelectorAll('.tab-view').forEach(v => v.classList.remove('active'));
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      
      const target = document.getElementById('tab-' + tabName);
      const btn = document.getElementById('btn-tab-' + tabName);
      if (target) target.classList.add('active');
      if (btn) btn.classList.add('active');
    }

    // Dataset Quiz Concorso Controllo
    
with open(r'D:\Documenti\Navigarda\Controllo\07_Simulatore_Quiz_e_Test\Simulatore_Quiz_Concorso_Ufficio.html', 'r', encoding='utf-8') as f_quiz:
    import re
    m = re.search(r'const ALL_QUESTIONS = (\[.*?\]);\s*let currentQuizList', f_quiz.read(), re.DOTALL)
    quiz_json = m.group(1)
const CONTROL_QUESTIONS = ''' + quiz_json + ''';

    let currentQuestions = [];
    let qIdx = 0;
    let scoreCorrect = 0;
    let scoreWrong = 0;
    let isSimExamMode = false;
    let simTimerInterval = null;
    let simSecondsRemaining = 1800;

    function initQuizMenu() {
      const container = document.getElementById('sim-module-buttons');
      const mods = [...new Set(CONTROL_QUESTIONS.map(q => q.mod))];
      
      container.innerHTML = mods.map(m => {
        const count = CONTROL_QUESTIONS.filter(q => q.mod === m).length;
        return `
          <button class="btn-file" onclick="startModule('${m.replace(/'/g, "\\\\'")}')" style="justify-content:space-between; padding:12px 14px; text-align:left; cursor:pointer;">
            <span>${m}</span>
            <span class="mono" style="font-size:0.75rem; color:var(--muted);">${count} quesiti</span>
          </button>
        `;
      }).join('');
    }

    function shuffle(arr) {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }

    function startModule(modName) {
      isSimExamMode = false;
      const filtered = CONTROL_QUESTIONS.filter(q => q.mod === modName);
      currentQuestions = prepareQuestions(filtered);
      beginSim();
    }

    function startExam(fullExam) {
      isSimExamMode = fullExam;
      const picked = shuffle(CONTROL_QUESTIONS).slice(0, 30);
      currentQuestions = prepareQuestions(picked);
      beginSim();
    }

    // Mescolamento casuale delle risposte ad ogni nuova sessione
    function prepareQuestions(list) {
      return shuffle(list).map(q => {
        const copy = { ...q };
        const optsWithFlags = copy.opts.map((optText, originalIndex) => ({
          text: optText,
          isCorrect: (originalIndex === copy.ans)
        }));
        copy.shuffledOptions = shuffle(optsWithFlags);
        return copy;
      });
    }

    function beginSim() {
      qIdx = 0;
      scoreCorrect = 0;
      scoreWrong = 0;

      document.getElementById('sim-screen-menu').style.display = 'none';
      document.getElementById('sim-screen-result').style.display = 'none';
      document.getElementById('sim-screen-active').style.display = 'block';

      const timerBox = document.getElementById('sim-timer-pill');
      if (isSimExamMode) {
        timerBox.style.display = 'block';
        simSecondsRemaining = 1800; // 30 min
        clearInterval(simTimerInterval);
        updateSimTimer();
        simTimerInterval = setInterval(() => {
          simSecondsRemaining--;
          updateSimTimer();
          if (simSecondsRemaining <= 0) {
            clearInterval(simTimerInterval);
            finishSim();
          }
        }, 1000);
      } else {
        timerBox.style.display = 'none';
        clearInterval(simTimerInterval);
      }

      renderCurrentQuestion();
    }

    function updateSimTimer() {
      const min = Math.floor(simSecondsRemaining / 60);
      const sec = simSecondsRemaining % 60;
      document.getElementById('sim-timer-val').textContent = 
        `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    }

    function renderCurrentQuestion() {
      const q = currentQuestions[qIdx];
      document.getElementById('sim-q-badge').textContent = q.mod;
      document.getElementById('sim-q-text').textContent = q.q;
      document.getElementById('sim-counter').textContent = `Domanda ${qIdx + 1} di ${currentQuestions.length}`;

      const pct = (qIdx / currentQuestions.length) * 100;
      document.getElementById('sim-progress-fill').style.width = `${pct}%`;

      const feedback = document.getElementById('sim-feedback');
      feedback.style.display = 'none';
      document.getElementById('sim-btn-next').style.display = 'none';

      const container = document.getElementById('sim-opts-container');
      container.innerHTML = '';

      q.shuffledOptions.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = 'sim-opt-btn';
        btn.textContent = opt.text;
        btn.onclick = () => selectSimAnswer(idx, opt.isCorrect);
        container.appendChild(btn);
      });
    }

    function selectSimAnswer(selectedIdx, isCorrect) {
      const q = currentQuestions[qIdx];
      const buttons = document.querySelectorAll('.sim-opt-btn');
      buttons.forEach(b => b.disabled = true);

      if (isCorrect) {
        scoreCorrect++;
        buttons[selectedIdx].classList.add('correct');
      } else {
        scoreWrong++;
        buttons[selectedIdx].classList.add('wrong');
        q.shuffledOptions.forEach((opt, idx) => {
          if (opt.isCorrect) buttons[idx].classList.add('correct');
        });
      }

      const feedback = document.getElementById('sim-feedback');
      if (isCorrect) {
        feedback.className = 'sim-feedback ok';
        feedback.innerHTML = `<strong>Risposta Esatta!</strong> ${q.exp}`;
      } else {
        feedback.className = 'sim-feedback bad';
        feedback.innerHTML = `<strong>Risposta Errata.</strong> ${q.exp}`;
      }
      feedback.style.display = 'block';
      document.getElementById('sim-btn-next').style.display = 'inline-block';
    }

    function nextQuestion() {
      qIdx++;
      if (qIdx < currentQuestions.length) {
        renderCurrentQuestion();
      } else {
        finishSim();
      }
    }

    function finishSim() {
      clearInterval(simTimerInterval);
      document.getElementById('sim-screen-active').style.display = 'none';
      document.getElementById('sim-screen-result').style.display = 'block';

      const scoreIn30 = Math.round((scoreCorrect / currentQuestions.length) * 30 * 10) / 10;
      document.getElementById('res-score-val').textContent = scoreIn30;

      const circle = document.getElementById('res-circle');
      const title = document.getElementById('res-verdict-title');
      const desc = document.getElementById('res-verdict-desc');

      if (scoreIn30 >= 18) {
        circle.style.borderColor = 'var(--green)';
        document.getElementById('res-score-val').style.color = 'var(--green)';
        title.textContent = 'PROVA SUPERATA! 🎉';
        title.style.color = 'var(--green)';
        desc.textContent = `Punteggio conseguito: ${scoreIn30}/30. Hai superato la soglia minima di idoneità (18/30) richiesta dal bando.`;
      } else {
        circle.style.borderColor = 'var(--rose)';
        document.getElementById('res-score-val').style.color = 'var(--rose)';
        title.textContent = 'NON IDONEO ⚠️';
        title.style.color = 'var(--rose)';
        desc.textContent = `Punteggio conseguito: ${scoreIn30}/30. Inferiore alla soglia di 18/30. Ti consigliamo di ripassare le dispense nella scheda Materiali.`;
      }

      document.getElementById('res-correct-count').textContent = scoreCorrect;
      document.getElementById('res-wrong-count').textContent = scoreWrong;
      const pct = Math.round((scoreCorrect / currentQuestions.length) * 100);
      document.getElementById('res-accuracy-pct').textContent = `${pct}%`;
    }

    function exitSim() {
      clearInterval(simTimerInterval);
      document.getElementById('sim-screen-active').style.display = 'none';
      document.getElementById('sim-screen-result').style.display = 'none';
      document.getElementById('sim-screen-menu').style.display = 'block';
    }

    window.addEventListener('DOMContentLoaded', initQuizMenu);
  </script>
</body>
</html>
'''

with open(os.path.join(workspace_dir, "concorso-controllo.html"), "w", encoding="utf-8") as f:
    f.write(html_controllo)
print("concorso-controllo.html generato con successo.")

# Ora generiamo quiz.html (Hub Concorsi)
html_hub = '''<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Concorsi GGNL · NaviSuite</title>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700;800&family=DM+Mono:wght@400;500&display=swap">
  <link rel="shortcut icon" href="assets/images/favicon.svg" type="image/svg+xml">
  <style>
    :root {
      --bg: #071923;
      --surface: #0b1c26;
      --card: #102733;
      --card2: #143140;
      --line: #1f4250;
      --ink: #eaf2f4;
      --muted: #9fb8c2;
      --teal: #2dd4bf;
      --cyan: #67d7e6;
      --violet: #a78bfa;
      --amber: #fbbf24;
      --green: #52c879;
      --rose: #fb7185;
      --blue: #54a7ff;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: linear-gradient(160deg, color-mix(in srgb, var(--teal) 9%, var(--surface)), var(--surface) 40%, color-mix(in srgb, var(--violet) 9%, var(--surface)));
      color: var(--ink);
      font-family: 'Manrope', system-ui, -apple-system, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    a { text-decoration: none; color: inherit; }
    .wrap { width: min(960px, calc(100% - 32px)); margin: auto; }

    header {
      padding: 40px 0 24px;
      text-align: center;
    }
    .eyebrow {
      display: inline-block;
      font-size: 0.78rem;
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--teal);
      margin-bottom: 8px;
    }
    h1 {
      font-size: clamp(2rem, 5vw, 3rem);
      font-weight: 800;
      letter-spacing: -0.02em;
      margin-bottom: 10px;
      background: linear-gradient(135deg, #ffffff 40%, var(--cyan) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .intro {
      color: var(--muted);
      max-width: 65ch;
      margin: 0 auto;
      font-size: 1.02rem;
    }

    .hub-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 20px;
      margin: 30px 0 60px;
    }

    .hub-card {
      background: var(--card);
      border: 1.5px solid var(--line);
      border-radius: 22px;
      padding: 28px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      box-shadow: 0 14px 40px rgba(0,0,0,0.22);
      transition: all 0.22s ease;
      position: relative;
      overflow: hidden;
    }
    .hub-card::before {
      content: "";
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 5px;
      background: var(--card-color, var(--teal));
    }
    .hub-card:hover {
      border-color: var(--card-color, var(--teal));
      transform: translateY(-4px);
      box-shadow: 0 20px 50px rgba(0,0,0,0.35);
    }

    .card-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 800;
      letter-spacing: 0.05em;
      margin-bottom: 14px;
    }
    .card-badge.active {
      background: rgba(45, 212, 191, 0.15);
      border: 1px solid var(--teal);
      color: var(--teal);
    }
    .card-badge.archive {
      background: rgba(84, 167, 255, 0.15);
      border: 1px solid var(--blue);
      color: #a5d2ff;
    }

    .card-icon {
      font-size: 2.4rem;
      margin-bottom: 12px;
      display: block;
    }
    .card-title {
      font-size: 1.45rem;
      font-weight: 800;
      color: #fff;
      margin-bottom: 6px;
      line-height: 1.25;
    }
    .card-subtitle {
      font-size: 0.88rem;
      font-weight: 700;
      color: var(--card-color, var(--teal));
      margin-bottom: 14px;
    }
    .card-desc {
      color: var(--muted);
      font-size: 0.94rem;
      line-height: 1.55;
      margin-bottom: 24px;
    }
    .feature-list {
      list-style: none;
      display: grid;
      gap: 8px;
      margin-bottom: 26px;
      font-size: 0.88rem;
      color: #d1e2f2;
    }
    .feature-list li {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .feature-list li span.dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--card-color, var(--teal));
    }

    .btn-enter {
      background: var(--card-color, var(--teal));
      color: var(--btn-text, #06231f);
      font-weight: 800;
      font-size: 0.96rem;
      padding: 14px 20px;
      border-radius: 12px;
      text-align: center;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.15s ease;
    }
    .btn-enter:hover {
      filter: brightness(1.1);
    }

    footer {
      text-align: center;
      margin-top: auto;
      padding: 24px 0;
      color: var(--muted);
      font-size: 0.84rem;
      border-top: 1px solid var(--line);
    }
  </style>
</head>
<body>

  <header class="wrap">
    <span class="eyebrow">GESTIONE GOVERNATIVA NAVIGAZIONE LAGHI</span>
    <h1>Concorsi & Selettive GGNL</h1>
    <p class="intro">Portale unico di preparazione e simulazione concorsi per il personale di navigazione e gli uffici amministrativi.</p>
  </header>

  <main class="wrap">
    <div class="hub-grid">
      
      <!-- CARD 1: CONCORSO CONTROLLO (NUOVO) -->
      <article class="hub-card" style="--card-color:var(--teal); --btn-text:#06231f;">
        <div>
          <span class="card-badge active">● IN CORSO · BANDO 2026</span>
          <span class="card-icon">🏢</span>
          <h2 class="card-title">Concorso Ufficio Controllo</h2>
          <div class="card-subtitle">Operatore di Ufficio · Parametro 130</div>
          <p class="card-desc">Concorso per 3 posti a tempo determinato (12 mesi) nelle sedi di Arona, Como e Desenzano del Garda. Materiale di studio completo e simulatore d'esame.</p>

          <ul class="feature-list">
            <li><span class="dot"></span><span><strong>9 Moduli d'esame</strong> con impaginazione standardizzata</span></li>
            <li><span class="dot"></span><span><strong>Punti chiave</strong>, numeri e trappole dei quiz evidenziate</span></li>
            <li><span class="dot"></span><span><strong>Prove passate ufficiali</strong> (2025 Como e Desenzano)</span></li>
            <li><span class="dot"></span><span><strong>Simulatore Quiz</strong> con risposte rimescolate casualmente</span></li>
            <li><span class="dot"></span><span>Tutti i testi di legge e le dispense scaricabili in PDF</span></li>
          </ul>
        </div>

        <a href="concorso-controllo.html" class="btn-enter">
          <span>Accedi al Concorso Controllo</span>
          <span>→</span>
        </a>
      </article>

      <!-- CARD 2: CONCORSO MOVIMENTO (ARCHIVIO FATTO) -->
      <article class="hub-card" style="--card-color:var(--blue); --btn-text:#ffffff;">
        <div>
          <span class="card-badge archive">✔ ARCHIVIO · GIÀ FATTO</span>
          <span class="card-icon">🚢</span>
          <h2 class="card-title">Concorso Movimento</h2>
          <div class="card-subtitle">Personale Viaggiante · Parametro 130</div>
          <p class="card-desc">Archivio delle prove e quiz per il concorso movimento già svolto. Accesso completo ai 300 quesiti, alle simulazioni e al riepilogo errori.</p>

          <ul class="feature-list">
            <li><span class="dot"></span><span><strong>300 Quesiti</strong> complessivi sulle materie di navigazione</span></li>
            <li><span class="dot"></span><span><strong>2 Prove Ufficiali</strong> (CE Movimento e prova scritta 15/2025)</span></li>
            <li><span class="dot"></span><span><strong>8 Simulazioni</strong> da 30 domande per testare la preparazione</span></li>
            <li><span class="dot"></span><span>Spiegazioni con articoli del Regolamento di Navigazione</span></li>
            <li><span class="dot"></span><span>Pannello statistiche ed esiti superamento (soglia 18/30)</span></li>
          </ul>
        </div>

        <a href="concorso-movimento.html" class="btn-enter" style="background:var(--blue);">
          <span>Accedi ai Quiz Movimento</span>
          <span>→</span>
        </a>
      </article>

    </div>
  </main>

  <footer>
    NaviSuite · Portale Concorsi Gestione Governativa Navigazione Laghi
  </footer>

  <script src="assets/js/shared-roles.js?v=16"></script>
  <script src="assets/js/admin-firebase-rest.js"></script>
  <script src="assets/js/shared-menu.js?v=1.99"></script>
  <script src="assets/js/offline.js?v=2"></script>
</body>
</html>
'''

with open(os.path.join(workspace_dir, "quiz.html"), "w", encoding="utf-8") as f:
    f.write(html_hub)
print("quiz.html aggiornato con successo.")
