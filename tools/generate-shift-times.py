#!/usr/bin/env python3
"""Rigenera assets/shift-times.json dalla tabella corse imbarcata in
assets/js/orario-main.js (variabile `data`, campi services[]/shifts[]).

Per ogni codice turno: prende la partenza della prima corsa e l'arrivo
dell'ultima corsa tra quelle assegnate al turno (data.shifts[codice].r),
usando i minuti-da-mezzanotte in services[].p (coppia [fermata, minuto]).

Uso: python3 tools/generate-shift-times.py
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ORARIO_JS = ROOT / "assets" / "js" / "orario-main.js"
OUT_JSON = ROOT / "assets" / "shift-times.json"


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
        result[code] = {"start": minute_to_hhmm(min(starts)), "end": minute_to_hhmm(max(ends))}

    missing = sorted(set(shifts.keys()) - set(result.keys()))
    out = {
        "_fonte": "Ricavato da assets/js/orario-main.js (tabella corse ufficiale) — vedi tools/generate-shift-times.py",
        "_mancanti": missing,
        "turni": result,
    }
    OUT_JSON.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"scritto {OUT_JSON} ({len(result)} codici, mancanti: {missing})")


if __name__ == "__main__":
    main()
