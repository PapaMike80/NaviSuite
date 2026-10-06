"""Registra DejaVu Sans in reportlab come "DV" (normale) e "DVB" (grassetto).
I TTF sono in tools/stampe/fonts (licenza in LICENSE-DejaVu.txt), cosi' le stampe escono uguali
su Windows, Mac e Linux; in mancanza li cerca nei percorsi di sistema."""
import glob
import os
from reportlab import rl_config
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# PDF riproducibili (niente data di creazione): stessi dati -> stessi file, nessun commit inutile
rl_config.invariant = 1

CARTELLE = [os.path.join(os.path.dirname(os.path.abspath(__file__)), "fonts"),
            "/usr/share/fonts/truetype/dejavu", "/usr/share/fonts/dejavu", "/usr/share/fonts/TTF",
            "/Library/Fonts", "/opt/homebrew/share/fonts", "/usr/local/share/fonts"]


def _trova(nome):
    for cartella in CARTELLE:
        trovati = glob.glob(f"{cartella}/**/{nome}", recursive=True)
        if trovati:
            return trovati[0]
    raise SystemExit(f"Font {nome} non trovato in tools/stampe/fonts")


pdfmetrics.registerFont(TTFont("DV", _trova("DejaVuSans.ttf")))
pdfmetrics.registerFont(TTFont("DVB", _trova("DejaVuSans-Bold.ttf")))
