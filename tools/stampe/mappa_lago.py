"""Mappa del Lago di Garda per la pagina Orario: scrive assets/js/orario-lago.js.

La costa e' il contorno del lago ricalcato (pixel per pixel, poi semplificato) da una cartina del lago
di 900x1027 pixel; i pontili sono i pallini della stessa cartina. Le rotte fra due scali seguono
l'acqua: quando la linea diretta passa sulla terra (es. Garda - Torri attorno a Punta San Vigilio o
attorno alla penisola di Sirmione) si calcola il percorso piu' breve in acqua.

Uso: python3 mappa_lago.py > ../../assets/js/orario-lago.js"""
import heapq
import json
import math

# Pixel della cartina -> unita' della mappa (viewBox): 6.5 pixel per unita'.
PX = 6.5
X0, Y0 = 160, 80


def unita(x, y):
    return ((x - X0) / PX, (y - Y0) / PX)


# Contorno del lago in pixel della cartina, in senso orario da Riva.
COSTA_PX = [
    (587, 86), (593, 87), (597, 95), (608, 104), (616, 107), (627, 108), (635, 113), (642, 112), (646, 116), (646,
    120), (640, 127), (637, 138), (628, 149), (621, 165), (615, 191), (613, 193), (611, 213), (607, 226), (591,
    246), (591, 248), (575, 271), (566, 281), (560, 282), (561, 289), (553, 308), (555, 313), (559, 317), (560,
    322), (557, 326), (549, 330), (545, 340), (533, 350), (532, 356), (535, 361), (535, 367), (531, 375), (517,
    394), (513, 403), (511, 415), (508, 422), (500, 430), (493, 440), (473, 480), (470, 488), (472, 499), (461,
    506), (455, 519), (455, 522), (451, 528), (450, 534), (445, 542), (445, 545), (429, 571), (423, 586), (419,
    591), (414, 592), (414, 596), (417, 600), (404, 626), (408, 640), (399, 648), (397, 652), (397, 663), (385,
    688), (384, 694), (384, 703), (386, 707), (390, 707), (395, 702), (406, 698), (422, 701), (426, 699), (431,
    699), (436, 704), (433, 714), (441, 733), (444, 746), (446, 750), (454, 757), (455, 760), (452, 768), (458,
    784), (461, 802), (463, 805), (466, 833), (472, 843), (469, 851), (470, 863), (467, 869), (467, 873), (455,
    896), (441, 934), (431, 944), (424, 956), (421, 967), (423, 975), (418, 980), (412, 979), (405, 967), (387,
    957), (353, 945), (343, 937), (327, 933), (320, 933), (304, 925), (300, 919), (302, 904), (301, 888), (300,
    887), (297, 889), (298, 904), (297, 910), (293, 915), (266, 937), (258, 940), (246, 940), (224, 933), (217,
    927), (215, 927), (203, 915), (203, 894), (201, 892), (191, 887), (184, 887), (176, 882), (173, 883), (167,
    879), (164, 871), (163, 861), (167, 851), (193, 824), (208, 813), (218, 808), (222, 804), (221, 788), (224,
    781), (229, 776), (239, 770), (248, 759), (247, 751), (238, 746), (232, 740), (230, 742), (223, 742), (218,
    740), (212, 734), (208, 726), (201, 719), (201, 715), (204, 712), (212, 709), (238, 686), (232, 681), (228,
    673), (223, 670), (204, 669), (192, 672), (172, 671), (170, 669), (176, 657), (175, 652), (180, 647), (187,
    649), (203, 640), (211, 638), (216, 627), (219, 624), (227, 625), (232, 623), (241, 616), (257, 608), (268,
    598), (276, 596), (282, 592), (287, 593), (292, 591), (295, 594), (298, 576), (302, 570), (336, 535), (340,
    527), (340, 516), (342, 508), (350, 496), (357, 489), (360, 482), (384, 456), (393, 450), (408, 436), (424,
    413), (426, 408), (448, 386), (458, 372), (469, 344), (482, 330), (486, 323), (488, 315), (504, 292), (512,
    265), (520, 250), (524, 237), (519, 226), (520, 223), (524, 219), (532, 220), (539, 216), (542, 216), (557,
    206), (564, 197), (568, 186), (568, 181), (580, 152), (584, 111), (584, 98), (582, 91)
]

# Pontili: pallino sulla cartina (pixel), coordinate vere (lat, lon) per la scala e lato dell'etichetta
# (o = a sinistra, e = a destra, n = sopra, s = sotto; o+/o- un po' piu' in basso/in alto). Portese e' sulla sponda sud
# del golfo di Salò.
SCALI = [
    ("Riva", (589.0, 92.5), (45.8858, 10.8418), "o"), ("Torbole", (639.4, 118.5), (45.8706, 10.8740), "e"),
    ("Limone", (526.4, 225.4), (45.8128, 10.7920), "o"), ("Malcesine", (553.0, 320.1), (45.7638, 10.8094), "e"),
    ("Gargnano", (362.7, 490.5), (45.6890, 10.6640), "o"), ("Brenzone", (465.4, 496.2), (45.6990, 10.7640), "e"),
    ("Maderno", (283.6, 597.7), (45.6365, 10.6040), "o"), ("Gardone", (221.3, 629.8), (45.6215, 10.5640), "o-"),
    ("Torri", (400.9, 638.6), (45.6106, 10.6870), "e"), ("Salò", (181.5, 654.0), (45.6060, 10.5230), "o+"),
    ("Garda", (428.8, 705.4), (45.5752, 10.7067), "e"), ("Portese", (208.5, 669.5), (45.5966, 10.5603), "s"),
    ("Bardolino", (447.6, 759.4), (45.5486, 10.7212), "e"), ("Lazise", (464.9, 844.0), (45.5053, 10.7323), "e"),
    ("Sirmione", (296.8, 875.3), (45.4935, 10.6075), "n"), ("Desenzano", (209.3, 911.8), (45.4686, 10.5420), "o"),
    ("Peschiera", (416.0, 973.5), (45.4400, 10.6915), "e"),
]


def km_per_unita():
    """Scala media fra le coppie di pontili lontane (distanza vera / distanza sulla mappa)."""
    rapporti = []
    for i, (_, pa, ga, _) in enumerate(SCALI):
        for _, pb, gb, _ in SCALI[i + 1:]:
            dy = (ga[0] - gb[0]) * 111.2
            dx = (ga[1] - gb[1]) * 111.2 * math.cos(math.radians(45.67))
            d = math.dist(unita(*pa), unita(*pb))
            if d > 40:
                rapporti.append(math.hypot(dx, dy) / d)
    return sum(rapporti) / len(rapporti)


def infittisci(ring, passo=0.6):
    out = []
    for i, a in enumerate(ring):
        b = ring[(i + 1) % len(ring)]
        n = max(1, int(math.dist(a, b) / passo))
        out += [(a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n) for k in range(n)]
    return out


def dentro(ring, p):
    x, y = p
    c = False
    for i in range(len(ring)):
        (x1, y1), (x2, y2) = ring[i], ring[i - 1]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            c = not c
    return c


def vicino(ring, p):
    """Punto della costa piu' vicino a p: (distanza, punto, indice)."""
    best = None
    for i in range(len(ring)):
        a, b = ring[i - 1], ring[i]
        dx, dy = b[0] - a[0], b[1] - a[1]
        lung = dx * dx + dy * dy
        t = max(0, min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lung)) if lung else 0
        q = (a[0] + t * dx, a[1] + t * dy)
        d = math.dist(p, q)
        if best is None or d < best[0]:
            best = (d, q, i)
    return best


def normale_interna(ring, i, p):
    """Versore verso l'acqua dal punto p della costa (vicino al vertice i)."""
    a, b = ring[(i - 3) % len(ring)], ring[(i + 2) % len(ring)]
    tx, ty = b[0] - a[0], b[1] - a[1]
    n = math.hypot(tx, ty) or 1
    cand = (-ty / n, tx / n)
    prova = (p[0] + cand[0] * 0.4, p[1] + cand[1] * 0.4)
    return cand if dentro(ring, prova) else (-cand[0], -cand[1])


def boa_di(ring, q, n, raggio=2.4):
    """Punto d'attesa delle navi davanti al pontile: in acqua, il piu' lontano possibile dalla costa."""
    migliori = []
    for k in range(36):
        a = 2 * math.pi * k / 36
        p = (q[0] + math.cos(a) * raggio, q[1] + math.sin(a) * raggio)
        if dentro(ring, p):
            allineato = math.cos(a) * n[0] + math.sin(a) * n[1]
            migliori.append((round(vicino(ring, p)[0], 1), allineato, p))
    return max(migliori)[2]


def liscia(ring, iterazioni=2):
    """Smussa gli spigoli (Chaikin) mantenendo la forma."""
    for _ in range(iterazioni):
        out = []
        for i, a in enumerate(ring):
            b = ring[(i + 1) % len(ring)]
            out += [(0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]), (0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1])]
        ring = out
    return ring


def semplifica(ring, tolleranza):
    """Douglas-Peucker su un anello chiuso."""
    def dp(pts):
        if len(pts) < 3:
            return pts
        a, b = pts[0], pts[-1]
        dx, dy = b[0] - a[0], b[1] - a[1]
        lung = math.hypot(dx, dy) or 1
        dist = [abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / lung for p in pts[1:-1]]
        k = max(range(len(dist)), key=dist.__getitem__)
        if dist[k] <= tolleranza:
            return [a, b]
        return dp(pts[:k + 2])[:-1] + dp(pts[k + 1:])
    meta = len(ring) // 2
    return dp(ring[:meta + 1])[:-1] + dp(ring[meta:] + [ring[0]])[:-1]


def rotte(ring, boe):
    """Percorsi in acqua fra le boe degli scali quando la linea diretta tocca la terra."""
    memo = {}

    def libero(a, b, margine=0.9):
        chiave = (a, b) if a < b else (b, a)
        if chiave not in memo:
            memo[chiave] = _libero(a, b, margine)
        return memo[chiave]

    def _libero(a, b, margine):
        n = max(2, int(math.dist(a, b) / 0.4))
        for k in range(n + 1):
            p = (a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n)
            if not dentro(ring, p) or (0 < k < n and vicino(ring, p)[0] < margine):
                return False
        return True

    xs, ys = [p[0] for p in ring], [p[1] for p in ring]
    griglia = []
    y = min(ys)
    while y < max(ys):
        x = min(xs)
        while x < max(xs):
            if dentro(ring, (x, y)) and vicino(ring, (x, y))[0] >= 1.4:
                griglia.append((round(x, 1), round(y, 1)))
            x += 1.5
        y += 1.5
    out = {}
    nomi = list(boe)
    for i, a in enumerate(nomi):
        for b in nomi[i + 1:]:
            if libero(boe[a], boe[b]):
                continue
            nodi = [boe[a], boe[b]] + griglia
            dist = {0: 0}
            prec = {}
            coda = [(0, 0)]
            while coda:
                d, u = heapq.heappop(coda)
                if u == 1:
                    break
                if d > dist.get(u, math.inf):
                    continue
                for v in range(len(nodi)):
                    if v == u:
                        continue
                    lung = math.dist(nodi[u], nodi[v])
                    if lung > 9 or d + lung >= dist.get(v, math.inf) or not libero(nodi[u], nodi[v]):
                        continue
                    dist[v] = d + lung
                    prec[v] = u
                    heapq.heappush(coda, (d + lung, v))
            cammino = [1]
            while cammino[-1] != 0:
                cammino.append(prec[cammino[-1]])
            punti = [nodi[k] for k in reversed(cammino)]
            # tira il filo: salta i punti intermedi finche' la linea resta in acqua
            corto = [punti[0]]
            k = 0
            while k < len(punti) - 1:
                j = len(punti) - 1
                while j > k + 1 and not libero(punti[k], punti[j]):
                    j -= 1
                corto.append(punti[j])
                k = j
            out[f"{a}|{b}"] = [[round(x, 1), round(y, 1)] for x, y in corto[1:-1]]
    return out


def main():
    ring = [unita(x, y) for x, y in COSTA_PX]
    lisce = liscia(ring, 1)
    disegno = semplifica(lisce, 0.05)
    scali = {}
    boe = {}
    for nome, px, geo, lato in SCALI:
        porto = unita(*px)
        _, q, i = vicino(lisce, porto)
        n = normale_interna(lisce, i, q)
        boa = boa_di(lisce, q, n)
        boe[nome] = boa
        scali[nome] = {"porto": [round(porto[0], 1), round(porto[1], 1)], "boa": [round(boa[0], 1), round(boa[1], 1)],
                       "lato": lato, "geo": list(geo)}
    d = "M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in disegno) + "Z"
    dati = {"km": round(1 / km_per_unita(), 3), "costa": d, "scali": scali, "rotte": rotte(semplifica(lisce, 0.05), boe)}
    print("// Mappa del Lago di Garda per la pagina Orario (generato da tools/stampe/mappa_lago.py: costa, pontili,")
    print("// boe d'attracco, coordinate GPS dei pontili e rotte in acqua fra gli scali; km = unita' per chilometro). Non modificare a mano.")
    print("(function (root) {")
    print("  'use strict';")
    print(f"  root.NaviLagoMappa = {json.dumps(dati, ensure_ascii=False)};")
    print("})(typeof window !== 'undefined' ? window : globalThis);")


if __name__ == "__main__":
    main()
