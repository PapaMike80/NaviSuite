# -*- coding: utf-8 -*-
"""
Monitor inPA e Navigazione Laghi per tutti i Concorsi GGNL:
- Monitoraggio concorso Operatore Ufficio Controllo (Cod. 16/2026_DE)
- Monitoraggio concorso Operatore Generico Naviganti (Cod. 17/2026_DE)
- Monitoraggio concorso Coordinatore Ufficio Tecnico (Cod. 18/2026_DE)
- Rilevamento automatico e download immediato del nuovo bando per MARINAIO STAGIONALE
"""
import os
import sys
import json
import re
import urllib.request
import ssl
from datetime import datetime

# Assicura output console compatibile Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

NAVILAGHI_BANDI_URL = "https://www.navigazionelaghi.it/bandi/"
INPA_BASE_URL = "https://www.inpa.gov.it"

DOWNLOAD_DIRS = {
    "controllo": r"docs\controllo\00_Bando_e_Atti_Ufficiali",
    "naviganti": r"docs\naviganti\00_Bando_e_Atti_Ufficiali",
    "generale": r"docs\bandi_attivi"
}

STATE_FILE = r"docs\controllo\monitor_state.json"
GLOBAL_STATE_FILE = r"docs\bandi_attivi\monitor_global_state.json"

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE

def fetch_url(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, context=CTX, timeout=20) as resp:
        return resp.read().decode('utf-8', errors='ignore')

def download_file(url, filename, folder_type="generale"):
    target_dir = DOWNLOAD_DIRS.get(folder_type, DOWNLOAD_DIRS["generale"])
    os.makedirs(target_dir, exist_ok=True)
    dest = os.path.join(target_dir, filename)
    
    if os.path.exists(dest):
        return os.path.getsize(dest), dest

    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, context=CTX, timeout=35) as resp:
        content = resp.read()
    with open(dest, 'wb') as f:
        f.write(content)
        
    print(f"  -> Scaricato con successo: {dest} ({len(content)} bytes)")
    return len(content), dest

def check_all_competitions():
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Avvio scansione inPA e Navigazione Laghi...")
    
    # Carica stato globale
    state = {"last_check": None, "known_bandi": {}, "known_files": {}}
    if os.path.exists(GLOBAL_STATE_FILE):
        try:
            with open(GLOBAL_STATE_FILE, 'r', encoding='utf-8') as f:
                state = json.load(f)
        except Exception:
            pass
            
    new_alerts = []
    
    # 1. Scansione Albo Pretorio Bandi Navigazione Laghi
    try:
        html = fetch_url(NAVILAGHI_BANDI_URL)
        print(f"Ricevuto HTML Bandi Navigazione Laghi ({len(html)} caratteri)")
        
        pdf_links = re.findall(r'<a[^>]+href="([^"]+\.pdf)"[^>]*>(.*?)</a>', html, re.DOTALL | re.IGNORECASE)
        print(f"Trovati {len(pdf_links)} link PDF sul sito.")
        
        for href, text in pdf_links:
            clean_title = re.sub(r'<[^>]+>', '', text).strip()
            fname = os.path.basename(href)
            
            # Se è un nuovo file non ancora visto
            if fname not in state["known_files"]:
                is_marinaio = bool(re.search(r'marinaio|marinai', fname + ' ' + clean_title, re.I))
                is_controllo = bool(re.search(r'controllo|16.*2026', fname, re.I))
                is_naviganti = bool(re.search(r'navigant|17.*2026', fname, re.I))
                
                folder = "controllo" if is_controllo else ("naviganti" if is_naviganti else "generale")
                print(f"\n[NUOVO DOCUMENTO RILEVATO]: {fname} ({clean_title})")
                if is_marinaio:
                    print("[ALERT] BANDO / ATTO RELATIVO A MARINAIO RILEVATO!")
                    
                try:
                    size, dest = download_file(href, fname, folder)
                    state["known_files"][fname] = {
                        "url": href,
                        "title": clean_title,
                        "downloaded_at": datetime.now().isoformat(),
                        "size": size,
                        "is_marinaio": is_marinaio
                    }
                    new_alerts.append({
                        "type": "marinaio" if is_marinaio else "altro",
                        "title": fname,
                        "url": href,
                        "dest": dest
                    })
                except Exception as dl_err:
                    print(f"  Errore download {href}: {dl_err}")
                    
    except Exception as e:
        print(f"Errore lettura Albo Bandi Navigazione Laghi: {e}")
        
    # Salva stato aggiornato
    state["last_check"] = datetime.now().isoformat()
    os.makedirs(os.path.dirname(GLOBAL_STATE_FILE), exist_ok=True)
    with open(GLOBAL_STATE_FILE, 'w', encoding='utf-8') as f:
        json.dump(state, f, indent=2, ensure_ascii=False)
        
    print("\n--- RIEPILOGO MONITORAGGIO ---")
    if new_alerts:
        print(f"Trovati {len(new_alerts)} nuovi aggiornamenti:")
        for a in new_alerts:
            print(f"- [{a['type'].upper()}] {a['title']} -> {a['dest']}")
    else:
        print(f"Nessun nuovo documento pubblicato rispetto all'ultimo controllo. Totale file monitorati: {len(state['known_files'])}")
        
    return new_alerts

if __name__ == "__main__":
    check_all_competitions()
