"""Registra DejaVu Sans in reportlab come "DV" (normale) e "DVB" (grassetto).
Cerca i TTF nei percorsi abituali di Linux (pacchetto fonts-dejavu-core) e macOS/Homebrew."""
import glob
from reportlab import rl_config
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# PDF riproducibili (niente data di creazione): stessi dati -> stessi file, nessun commit inutile
rl_config.invariant = 1

CARTELLE = ["/usr/share/fonts/truetype/dejavu", "/usr/share/fonts/dejavu", "/usr/share/fonts/TTF",
            "/Library/Fonts", "/opt/homebrew/share/fonts", "/usr/local/share/fonts"]


def _trova(nome):
    for cartella in CARTELLE:
        trovati = glob.glob(f"{cartella}/**/{nome}", recursive=True)
        if trovati:
            return trovati[0]
    raise SystemExit(f"Font {nome} non trovato: installa il pacchetto fonts-dejavu-core")


pdfmetrics.registerFont(TTFont("DV", _trova("DejaVuSans.ttf")))
pdfmetrics.registerFont(TTFont("DVB", _trova("DejaVuSans-Bold.ttf")))
