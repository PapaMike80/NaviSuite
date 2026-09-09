#!/usr/bin/env python3
"""Rigenera assets/shift-times.json dalla tabella corse imbarcata in
assets/js/orario-main.js (variabile `data`, campi services[]/shifts[]).

Per ogni codice turno: l'inizio e' la partenza della prima corsa MENO il
margine di presentazione a bordo (PRESENTAZIONE_MINUTI, default 60'), la
fine e' l'arrivo dell'ultima corsa cosi' com'e' (nessun anticipo/margine).
Regola confermata sui codici D1-D4 gia' presenti nel vecchio
tools/navisuite-calendar-apps-script-v2.gs (SERVICE_TIMES): partenza prima
corsa - 60' in tutti e 4 i casi, arrivo ultima corsa invariato.

Uso: python3 tools/generate-shift-times.py
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ORARIO_JS = ROOT / "assets" / "js" / "orario-main.js"
OUT_JSON = ROOT / "assets" / "shift-times.json"
CALENDAR_JS = ROOT / "assets" / "js" / "calendar-settings-v2.js"
PRESENTAZIONE_MINUTI = 60


def update_inline_js(result):
    """Aggiorna la costante SHIFT_TIMES in calendar-settings-v2.js (copiata in
    linea per non dipendere da un fetch separato — vedi commento nel file)."""
    text = CALENDAR_JS.read_text(encoding="utf-8")
    start_marker = "/* SHIFT_TIMES:START (rigenerato da tools/generate-shift-times.py, non modificare a mano) */"
    end_marker = "/* SHIFT_TIMES:END */"
    start = text.index(start_marker)
    end = text.index(end_marker, start) + len(end_marker)

    codes = list(result.items())
    rows = []
    for i in range(0, len(codes), 4):
        chunk = codes[i:i + 4]
        rows.append("    " + " ".join(f"{code}:{{start:'{t['start']}',end:'{t['end']}'}}," for code, t in chunk))
    body = "\n".join(rows)

    replacement = f"{start_marker}\n  const SHIFT_TIMES = {{\n{body}\n  }};\n  {end_marker}"
    CALENDAR_JS.write_text(text[:start] + replacement + text[end:], encoding="utf-8")


def minute_to_hhmm(minute):
    h, m = divmod(int(minute) % 1440, 60)
    return f"{h:02d}:{m:02d}"


def main():
    src = ORARIO_JS.read_text(encoding="utf-8")
    match = re.search(r"const data = (\{.*?\});", src)
    if not match:
        raise SystemExit("Non trovo 'const data = {...}' in orario-main.js")
    data = json.loads(match.group(1))

    services = data["services"]
    shifts = data["shifts"]

    result = {}
    for code, info in shifts.items():
        runs = {str(r) for r in info.get("r", [])}
        starts, ends = [], []
        for svc in services:
            if str(svc.get("r")) in runs:
                points = svc.get("p") or []
                if not points:
                    continue
                minutes = [p[1] for p in points]
                starts.append(min(minutes))
                ends.append(max(minutes))
        if not starts:
            continue
        result[code] = {
            "start": minute_to_hhmm(min(starts) - PRESENTAZIONE_MINUTI),
            "end": minute_to_hhmm(max(ends)),
        }

    missing = sorted(set(shifts.keys()) - set(result.keys()))
    out = {
        "_fonte": f"Ricavato da assets/js/orario-main.js (tabella corse ufficiale) — inizio = partenza prima corsa - {PRESENTAZIONE_MINUTI}' di presentazione, fine = arrivo ultima corsa. Vedi tools/generate-shift-times.py",
        "_mancanti": missing,
        "turni": result,
    }
    OUT_JSON.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    update_inline_js(result)
    print(f"scritto {OUT_JSON} e aggiornato {CALENDAR_JS} ({len(result)} codici, mancanti: {missing})")


if __name__ == "__main__":
    main()
