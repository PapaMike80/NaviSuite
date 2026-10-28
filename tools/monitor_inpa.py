# -*- coding: utf-8 -*-
"""
Monitor inPA e Navigazione Laghi per il Concorso Operatore di Ufficio Controllo (par. 130)
Bando Prot. C163 / Determina C162 / Cod. inPA 16/2026_DE
ID inPA: d45517744c9041e59f647892608c36ee
"""
import os
import sys
import json
import re
import urllib.request
import hashlib
from datetime import datetime

INPA_URL = "https://www.inpa.gov.it/bandi-e-avvisi/dettaglio-bando-avviso/?concorso_id=d45517744c9041e59f647892608c36ee"
NAVIGARDA_URL = "https://www.navigazionelaghi.it/bandi"

BASE_DIRS = [
    r"docs\controllo\00_Bando_e_Atti_Ufficiali",
    r"D:\Documenti\Navigarda\Controllo\00_Bando_e_Atti_Ufficiali",
    r"D:\Download\NaviSuite\docs\controllo\00_Bando_e_Atti_Ufficiali"
]

STATE_FILE = r"docs\controllo\monitor_state.json"

HEADERS = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}

def fetch_url(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=15) as resp:
        return resp.read().decode('utf-8', errors='ignore')

def download_file(url, filename):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as resp:
        content = resp.read()
    
    saved_paths = []
    for d in BASE_DIRS:
        os.makedirs(d, exist_ok=True)
        dest = os.path.join(d, filename)
        with open(dest, 'wb') as f:
            f.write(content)
        saved_paths.append(dest)
    return len(content), saved_paths

def check_updates():
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Avvio verifica aggiornamenti inPA & Navigazione Laghi...")
    
    # Carica stato precedente
    state = {
        "last_check": None,
        "inpa_docs": {},
        "navilaghi_docs": {},
        "alerts": []
    }
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, 'r', encoding='utf-8') as f:
                state = json.load(f)
        except Exception:
            pass
            
    new_items_found = []
    
    # 1. Controlla pagina inPA
    try:
        html_inpa = fetch_url(INPA_URL)
        # Cerca link ai media di portale.inpa.gov.it
        matches_inpa = re.findall(r'<a[^>]+href="([^"]*portale\.inpa\.gov\.it/api/media/[^"]*)"[^>]*title="([^"]+)"', html_inpa)
        matches_inpa += [(href, title) for title, href in re.findall(r'<a[^>]+title="([^"]+)"[^>]*href="([^"]*portale\.inpa\.gov\.it/api/media/[^"]*)"', html_inpa)]
        
        # Elimina duplicati
        seen_inpa = {}
        for href, title in matches_inpa:
            seen_inpa[title] = href
            
        for title, href in seen_inpa.items():
            if title not in state.get("inpa_docs", {}):
                print(f"[NUOVO DOCUMENTO inPA TROVATO]: {title} -> {href}")
                size, paths = download_file(href, title)
                state.setdefault("inpa_docs", {})[title] = {
                    "url": href,
                    "downloaded_at": datetime.now().isoformat(),
                    "size": size
                }
                new_items_found.append({"source": "inPA", "title": title, "url": href, "size": size})
            else:
                pass
    except Exception as e:
        print(f"Errore lettura inPA: {e}")
        
    # 2. Controlla pagina Navigazione Laghi
    try:
        html_navi = fetch_url(NAVIGARDA_URL)
        pos = html_navi.find('C163')
        if pos != -1:
            snippet = html_navi[max(0, pos-500):pos+3000]
            links_navi = re.findall(r'<a[^>]+href="([^"]+\.pdf)"[^>]*>(.*?)</a>', snippet, re.DOTALL)
            for href, t in links_navi:
                clean_title = os.path.basename(href)
                if clean_title not in state.get("navilaghi_docs", {}) and clean_title not in state.get("inpa_docs", {}):
                    print(f"[NUOVO DOCUMENTO NAVIGAZIONE LAGHI TROVATO]: {clean_title} -> {href}")
                    size, paths = download_file(href, clean_title)
                    state.setdefault("navilaghi_docs", {})[clean_title] = {
                        "url": href,
                        "downloaded_at": datetime.now().isoformat(),
                        "size": size
                    }
                    new_items_found.append({"source": "NavigazioneLaghi", "title": clean_title, "url": href, "size": size})
    except Exception as e:
        print(f"Errore lettura Navigazione Laghi: {e}")
        
    # Salva stato aggiornato
    state["last_check"] = datetime.now().isoformat()
    os.makedirs(os.path.dirname(STATE_FILE), exist_ok=True)
    with open(STATE_FILE, 'w', encoding='utf-8') as f:
        json.dump(state, f, indent=2, ensure_ascii=False)
        
    if new_items_found:
        print("\n=== NUOVI DOCUMENTI PUBBLICATI E SCARICATI! ===")
        for item in new_items_found:
            print(f"- [{item['source']}] {item['title']} ({item['size']} bytes)")
    else:
        print("Nessun nuovo documento pubblicato rispetto all'ultimo controllo.")
        print(f"Documenti attualmente monitorati e archiviati: {len(state.get('inpa_docs', {})) + len(state.get('navilaghi_docs', {}))}")
        
    return new_items_found

if __name__ == "__main__":
    check_updates()
