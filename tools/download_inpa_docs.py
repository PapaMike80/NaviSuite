import os
import urllib.request
import re

html_path = 'tools/inpa_page.html'
with open(html_path, 'r', encoding='utf-8') as f:
    html = f.read()

# Extract all concorso info fields
# Let's see all text fields
fields = re.findall(r'<span class="concorso-label[^"]*">(.*?)</span>\s*(?:</p>\s*)?<p class="concorso-content[^"]*">(.*?)</p>', html, re.DOTALL)
print("=== CONCORSO FIELDS IN inPA PAGE ===")
for label, content in fields:
    l = re.sub(r'<[^>]+>', ' ', label).strip()
    c = re.sub(r'<[^>]+>', ' ', content).strip()
    c = ' '.join(c.split())
    print(f"[{l}]: {c}")

# Also look for any communications / avvisi
comms = re.findall(r'<div class="concorso-comunicazione[^"]*">(.*?)</div>', html, re.DOTALL)
print(f"\nCommunications found: {len(comms)}")
for c in comms:
    clean = ' '.join(re.sub(r'<[^>]+>', ' ', c).split())
    print("Comm:", clean)

# Downloads list
media_items = [
    ("Bando162026_DE.pdf", "https://portale.inpa.gov.it/api/media/f1fa7369-ddb7-4a11-a034-c08492b2c616"),
    ("InformativaAlTrattamentoDeiDatiPersonaliDeiCandidati_Regolamento(UE)n.679_2016-1.pdf", "https://portale.inpa.gov.it/api/media/d90f73ca-8714-442a-879a-1ae197a62b40"),
    ("AllegatoA_Codice-Etico-GestioneNavigazioneLaghi.pdf", "https://portale.inpa.gov.it/api/media/c17ad42a-e3d7-4550-a95b-88c9fc7d05f1"),
    ("AllegatoC_REGOLAMENTO_ESERCIZIO_13_05_03.pdf", "https://portale.inpa.gov.it/api/media/6641b68d-49f8-4543-9fd5-d8e7c0e014e6"),
    ("Elenco_candidati_ammessi_16_2026_DE.pdf", "https://portale.inpa.gov.it/api/media/22e04c68-fb54-4a4e-aa2b-02681c098400")
]

dest_dirs = [
    r"docs\controllo\00_Bando_e_Atti_Ufficiali",
    r"D:\Documenti\Navigarda\Controllo\00_Bando_e_Atti_Ufficiali",
    r"D:\Download\NaviSuite\docs\controllo\00_Bando_e_Atti_Ufficiali"
]

for d in dest_dirs:
    os.makedirs(d, exist_ok=True)

print("\nDownloading official files from inPA:")
headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
for filename, url in media_items:
    print(f"Downloading {filename}...")
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as resp:
        content = resp.read()
    print(f"  Downloaded {len(content)} bytes")
    for d in dest_dirs:
        out_path = os.path.join(d, filename)
        with open(out_path, 'wb') as f:
            f.write(content)
        print(f"  Saved to {out_path}")
