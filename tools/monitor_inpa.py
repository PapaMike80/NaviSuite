# -*- coding: utf-8 -*-
"""
Monitor inPA e Navigazione Laghi a 360° per tutti i Concorsi GGNL:
- Monitoraggio Settore UFFICI (Amministrazione, Controllo, Tecnico, Acquisti, Cassa)
- Monitoraggio Settore NAVIGANTI (Operatori generici, Marinai di linea e stagionali)
- Rilevamento automatico di qualsiasi nuovo bando, determina, elenco ammessi o diario prove
"""
import os
import sys
import json
import re
import urllib.request
import ssl
from datetime import datetime

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
    "uffici": r"docs\uffici\00_Bando_e_Atti_Ufficiali",
    "generale": r"docs\bandi_attivi"
}

STATE_FILE = r"docs\controllo\monitor_state.json"
GLOBAL_STATE_FILE = r"docs\bandi_attivi\monitor_global_state.json"
DATA_JSON_FILE = r"docs\concorsi_data.json"

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

def categorize_document(fname, text):
    combined = (fname + ' ' + text).lower()
    if re.search(r'controllo|16.*2026', combined):
        return "controllo", "Ufficio Controllo"
    elif re.search(r'tecnico|18.*2026|14.*2026|ingegner|fabbri|officin', combined):
        return "uffici", "Ufficio Tecnico / Officina"
    elif re.search(r'acquisti|ragioneria|amministrativ|personale|supporto|15.*2026|13.*2026', combined):
        return "uffici", "Uffici Amministrativi"
    elif re.search(r'marinaio|marinai|navigant|17.*2026|bordo|timonier|motorist|capitan', combined):
        return "naviganti", "Settore Naviganti"
    return "generale", "Altro / Generale"

def check_all_competitions():
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Avvio scansione completa concorsi Navigazione Laghi (Uffici e Naviganti)...")
    
    state = {"last_check": None, "known_bandi": {}, "known_files": {}}
    if os.path.exists(GLOBAL_STATE_FILE):
        try:
            with open(GLOBAL_STATE_FILE, 'r', encoding='utf-8') as f:
                state = json.load(f)
        except Exception:
            pass
            
    new_alerts = []
    
    try:
        html = fetch_url(NAVILAGHI_BANDI_URL)
        pdf_links = re.findall(r'<a[^>]+href="([^"]+\.pdf)"[^>]*>(.*?)</a>', html, re.DOTALL | re.IGNORECASE)
        print(f"Scansione Albo GGNL completata: {len(pdf_links)} documenti rilevati.")
        
        for href, text in pdf_links:
            clean_title = re.sub(r'<[^>]+>', '', text).strip()
            fname = os.path.basename(href)
            
            if fname not in state["known_files"]:
                folder, category = categorize_document(fname, clean_title)
                print(f"\n[NUOVO DOCUMENTO]: {fname} ({category})")
                
                try:
                    size, dest = download_file(href, fname, folder)
                    state["known_files"][fname] = {
                        "url": href,
                        "title": clean_title,
                        "category": category,
                        "downloaded_at": datetime.now().isoformat(),
                        "size": size
                    }
                    new_alerts.append({
                        "category": category,
                        "title": fname,
                        "url": href,
                        "dest": dest
                    })
                except Exception as dl_err:
                    print(f"  Errore download {href}: {dl_err}")
                    
    except Exception as e:
        print(f"Errore lettura Albo Bandi Navigazione Laghi: {e}")
        
    state["last_check"] = datetime.now().isoformat()
    os.makedirs(os.path.dirname(GLOBAL_STATE_FILE), exist_ok=True)
    with open(GLOBAL_STATE_FILE, 'w', encoding='utf-8') as f:
        json.dump(state, f, indent=2, ensure_ascii=False)
        
    print("\n--- RIEPILOGO MONITORAGGIO TOTALE ---")
    if new_alerts:
        print(f"Trovati {len(new_alerts)} nuovi aggiornamenti:")
        for a in new_alerts:
            print(f"- [{a['category']}] {a['title']} -> {a['dest']}")
    else:
        print(f"Nessun nuovo documento pubblicato rispetto all'ultimo controllo. Totale monitorati: {len(state['known_files'])}")
        
    return new_alerts

if __name__ == "__main__":
    check_all_competitions()
