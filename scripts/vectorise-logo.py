# -*- coding: utf-8 -*-
"""Vectorise le logo de l'épicerie. L'original public/logo.jpg n'est pas modifié.

Méthode, adaptée à un logo en aplats :
  1. réduction à une petite palette de couleurs ;
  2. pour chaque couleur, on relève les frontières exactes entre pixels dedans
     et dehors, puis on les chaîne en boucles fermées — les trous (l'intérieur
     d'un « d », d'un « é ») sortent naturellement comme des boucles à part ;
  3. on allège les boucles, puis on les adoucit ;
  4. le blanc n'est jamais tracé : c'est le détourage.
"""
import os
from collections import defaultdict
from PIL import Image, ImageFilter

PROJET = r'C:\Users\Shibakun\haccp-app'
SRC = os.path.join(PROJET, 'public', 'logo.jpg')
SORTIE = os.path.join(PROJET, 'public', 'logo.svg')

COULEURS = 7           # taille de la palette, calculée sur le dessin seul
AIRE_MINI = 26         # en pixels : en dessous, c'est du bruit de compression
EPSILON = 1.4          # simplification, en pixels


def charge_et_cadre() -> Image.Image:
    src = Image.open(SRC).convert('RGB')
    boite = src.convert('L').point(lambda v: 255 if v < 243 else 0).getbbox()
    return src.crop(boite)


def boucles(masque: set, largeur: int, hauteur: int) -> list:
    """Frontières du masque, chaînées en boucles fermées orientées."""
    # Chaque pixel dedans dont le voisin est dehors donne une arête, orientée
    # pour que le dedans reste à gauche.
    aretes = {}
    for (x, y) in masque:
        if (x, y - 1) not in masque:
            aretes.setdefault((x, y), []).append((x + 1, y))
        if (x + 1, y) not in masque:
            aretes.setdefault((x + 1, y), []).append((x + 1, y + 1))
        if (x, y + 1) not in masque:
            aretes.setdefault((x + 1, y + 1), []).append((x, y + 1))
        if (x - 1, y) not in masque:
            aretes.setdefault((x, y + 1), []).append((x, y))

    sortie = []
    restantes = {k: list(v) for k, v in aretes.items()}
    while restantes:
        depart = next(iter(restantes))
        boucle = [depart]
        point = depart
        while True:
            suivants = restantes.get(point)
            if not suivants:
                break
            prochain = suivants.pop()
            if not suivants:
                del restantes[point]
            boucle.append(prochain)
            point = prochain
            if point == depart:
                break
        if len(boucle) > 4:
            sortie.append(boucle)
    return sortie


def aire(points: list) -> float:
    s = 0.0
    for i in range(len(points) - 1):
        x1, y1 = points[i]
        x2, y2 = points[i + 1]
        s += x1 * y2 - x2 * y1
    return abs(s) / 2


def simplifie_ouverte(points: list, eps: float) -> list:
    """Douglas-Peucker sur une ligne ouverte, itératif pour ne pas saturer la pile."""
    if len(points) < 3:
        return points
    garde = [False] * len(points)
    garde[0] = garde[-1] = True
    pile = [(0, len(points) - 1)]
    while pile:
        debut, fin = pile.pop()
        x1, y1 = points[debut]
        x2, y2 = points[fin]
        dx, dy = x2 - x1, y2 - y1
        norme = (dx * dx + dy * dy) ** .5 or 1e-9
        pire, indice = 0.0, -1
        for i in range(debut + 1, fin):
            x, y = points[i]
            d = abs(dy * x - dx * y + x2 * y1 - y2 * x1) / norme
            if d > pire:
                pire, indice = d, i
        if pire > eps and indice != -1:
            garde[indice] = True
            pile.append((debut, indice))
            pile.append((indice, fin))
    return [p for p, g in zip(points, garde) if g]


def simplifie(points: list, eps: float) -> list:
    """Simplification d'une boucle fermée.

    Appliquer Douglas-Peucker directement sur une boucle ne marche pas : ses deux
    extrémités étant le même point, le segment de référence est de longueur nulle,
    toutes les distances valent zéro et il ne reste que deux points. On coupe donc
    la boucle au point le plus éloigné du départ, et on simplifie les deux moitiés.
    """
    if points[0] == points[-1]:
        points = points[:-1]
    if len(points) < 4:
        return points

    x0, y0 = points[0]
    oppose = max(range(len(points)), key=lambda i: (points[i][0] - x0) ** 2 + (points[i][1] - y0) ** 2)
    premiere = simplifie_ouverte(points[:oppose + 1], eps)
    seconde = simplifie_ouverte(points[oppose:] + [points[0]], eps)
    return premiere[:-1] + seconde[:-1]


def chemin(points: list) -> str:
    """Boucle rendue en courbes quadratiques.

    Les sommets deviennent les points de contrôle et les milieux d'arêtes les
    points de passage : la courbe est lisse par construction, sans multiplier
    les points comme le faisait l'adoucissement précédent.
    """
    n = len(points)
    if n < 3:
        return ''
    milieu = lambda a, b: ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)

    depart = milieu(points[0], points[1])
    d = [f'M{depart[0]:.1f} {depart[1]:.1f}']
    for i in range(1, n + 1):
        controle = points[i % n]
        arrivee = milieu(points[i % n], points[(i + 1) % n])
        d.append(f'Q{controle[0]:.1f} {controle[1]:.1f} {arrivee[0]:.1f} {arrivee[1]:.1f}')
    d.append('Z')
    return ''.join(d)


def est_fond(r: int, g: int, b: int) -> bool:
    return r > 232 and g > 232 and b > 232


def palette_du_dessin(img: Image.Image, k: int) -> list:
    """Palette calculée sur le dessin seul.

    Sur cette image, le blanc occupe 70 % de la surface et le bruit JPEG en fait
    plusieurs teintes : une palette calculée sur l'image entière gaspillait sept
    emplacements sur dix en nuances de blanc, et mélangeait le noir du texte avec
    le rouge du script.
    """
    dessin = [c for c in img.getdata() if not est_fond(*c)]
    bande = Image.new('RGB', (len(dessin), 1))
    bande.putdata(dessin)
    reduite = bande.quantize(colors=k, method=Image.MEDIANCUT).convert('RGB')
    return sorted(set(reduite.getdata()))


def main() -> None:
    img = charge_et_cadre()
    largeur, hauteur = img.size
    print('zone utile', img.size, flush=True)

    # Un léger lissage avant analyse : le bruit de compression crée sinon des
    # milliers de minuscules îlots qui alourdissent le tracé sans rien apporter.
    lisse = img.filter(ImageFilter.MedianFilter(3))
    palette = palette_du_dessin(lisse, COULEURS)
    print('palette du dessin :', palette, flush=True)

    par_couleur = defaultdict(set)
    for i, couleur in enumerate(lisse.getdata()):
        if est_fond(*couleur):
            continue
        r, g, b = couleur
        proche = min(palette, key=lambda p: (p[0] - r) ** 2 + (p[1] - g) ** 2 + (p[2] - b) ** 2)
        par_couleur[proche].add((i % largeur, i // largeur))

    formes = []
    for couleur, masque in par_couleur.items():
        r, g, b = couleur
        morceaux = []
        for boucle in boucles(masque, largeur, hauteur):
            if aire(boucle) < AIRE_MINI:
                continue
            allege = simplifie(boucle, EPSILON)
            if len(allege) < 4:
                continue
            morceaux.append(chemin(allege))
        if morceaux:
            formes.append((len(masque), f'#{r:02x}{g:02x}{b:02x}', ''.join(morceaux)))

    # Les grandes surfaces d'abord, les détails par-dessus.
    formes.sort(key=lambda f: -f[0])

    svg = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {largeur} {hauteur}" '
        f'width="{largeur}" height="{hauteur}" role="img">',
        '<title>L\'Épicerie d\'Aquí — Vingrau</title>',
    ]
    for _, couleur, d in formes:
        svg.append(f'<path fill="{couleur}" fill-rule="evenodd" d="{d}"/>')
    svg.append('</svg>')

    open(SORTIE, 'w', encoding='utf-8').write('\n'.join(svg))
    print(f'{len(formes)} couleurs tracées, {os.path.getsize(SORTIE)} octets', flush=True)


main()
