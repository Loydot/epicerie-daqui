import { useEffect, useMemo, useRef, useState } from 'react'
import type { Equipement, Releve } from '../db/types'
import { dateHeureFr, nombre } from '../lib/format'

/**
 * Courbe des relevés d'un équipement, avec sa zone admise en fond.
 *
 * Un frigo travaille entre 0 et 4 °C, un congélateur entre −25 et −18 : les
 * superposer sur un axe commun écraserait les deux. Chaque équipement a donc son
 * propre graphique et sa propre échelle.
 *
 * Un relevé hors zone se repère d'abord à sa position, en dehors de la bande —
 * un repère géométrique, lisible même par quelqu'un qui ne distingue pas le rouge.
 * La couleur et le point plus gros ne font que confirmer.
 */

interface Props {
  equipement: Equipement
  releves: Releve[]
}

const HAUTEUR = 150
const BANDE_AXE = 22
const MARGE = { haut: 14, droite: 58, bas: BANDE_AXE, gauche: 34 }
/** Au-dela, les points se chevauchent et forment une bouillie : on ne garde
 *  que la courbe, les relevés hors zone et le dernier point. */
const SEUIL_POINTS_VISIBLES = 40

/** Largeur réelle du conteneur : sans elle, le texte du SVG grossirait avec la carte. */
function useLargeur(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null)
  const [largeur, setLargeur] = useState(320)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observateur = new ResizeObserver(([entree]) => {
      setLargeur(Math.max(240, entree.contentRect.width))
    })
    observateur.observe(element)
    return () => observateur.disconnect()
  }, [])
  return [ref, largeur]
}

export default function GraphiqueTemperatures({ equipement, releves }: Props) {
  const [conteneur, largeur] = useLargeur()
  const [survole, setSurvole] = useState<number | null>(null)

  const points = useMemo(
    () => [...releves].sort((a, b) => a.date.localeCompare(b.date)),
    [releves],
  )

  const echelle = useMemo(() => {
    if (!points.length) return null
    const temps = points.map((r) => new Date(r.date).getTime())
    const valeurs = points.map((r) => r.temp)

    const tMin = Math.min(...temps)
    const tMax = Math.max(...temps)
    // Une seule mesure n'a pas d'étendue : on lui en invente une pour la centrer.
    const etendueT = tMax - tMin || 3_600_000

    const yBas = Math.min(equipement.tempMin, ...valeurs)
    const yHaut = Math.max(equipement.tempMax, ...valeurs)
    const marge = (yHaut - yBas) * 0.18 || 1

    const largeurTrace = largeur - MARGE.gauche - MARGE.droite
    const hauteurTrace = HAUTEUR - MARGE.haut - MARGE.bas

    const x = (t: number) => MARGE.gauche + ((t - tMin) / etendueT) * largeurTrace
    const y = (v: number) =>
      MARGE.haut + (1 - (v - (yBas - marge)) / ((yHaut + marge) - (yBas - marge))) * hauteurTrace

    return { x, y, temps, tMin, etendueT, largeurTrace }
  }, [points, equipement, largeur])

  if (!points.length || !echelle) {
    return (
      <p className="petit doux" style={{ margin: '6px 0 0' }}>
        Pas encore de relevé pour cet équipement.
      </p>
    )
  }

  const { x, y } = echelle
  const horsZone = points.filter((r) => r.conforme === 0)
  const dernier = points[points.length - 1]

  const chemin = points
    .map((r, i) => `${i === 0 ? 'M' : 'L'}${x(new Date(r.date).getTime()).toFixed(1)},${y(r.temp).toFixed(1)}`)
    .join(' ')

  const hautBande = y(equipement.tempMax)
  const basBande = y(equipement.tempMin)

  /** Point le plus proche horizontalement : la cible de survol est la colonne entière. */
  const surPointeur = (e: React.PointerEvent<SVGSVGElement>) => {
    const boite = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - boite.left) / boite.width) * largeur
    let meilleur = 0
    let distance = Infinity
    points.forEach((r, i) => {
      const d = Math.abs(x(new Date(r.date).getTime()) - px)
      if (d < distance) { distance = d; meilleur = i }
    })
    setSurvole(meilleur)
  }

  const actif = survole == null ? null : points[survole]
  const dates = [points[0], points[points.length - 1]]

  return (
    <div ref={conteneur} className="graphe">
      <svg
        viewBox={`0 0 ${largeur} ${HAUTEUR}`}
        width="100%"
        height={HAUTEUR}
        role="img"
        aria-label={`Relevés de ${equipement.nom}, zone admise de ${equipement.tempMin} à ${equipement.tempMax} degrés`}
        onPointerMove={surPointeur}
        onPointerLeave={() => setSurvole(null)}
        style={{ touchAction: 'pan-y', display: 'block' }}
      >
        {/* Zone admise : c'est elle qui donne son sens à la courbe. */}
        <rect
          x={MARGE.gauche} y={hautBande}
          width={echelle.largeurTrace} height={Math.max(1, basBande - hautBande)}
          fill="var(--graphe-zone)"
        />
        <line x1={MARGE.gauche} x2={largeur - MARGE.droite} y1={hautBande} y2={hautBande}
          stroke="var(--graphe-grille)" strokeWidth="1" />
        <line x1={MARGE.gauche} x2={largeur - MARGE.droite} y1={basBande} y2={basBande}
          stroke="var(--graphe-grille)" strokeWidth="1" />

        <text x={MARGE.gauche - 6} y={hautBande + 3} textAnchor="end"
          fill="var(--texte-doux)" fontSize="9" className="mono">
          {nombre(equipement.tempMax, 0)}
        </text>
        <text x={MARGE.gauche - 6} y={basBande + 3} textAnchor="end"
          fill="var(--texte-doux)" fontSize="9" className="mono">
          {nombre(equipement.tempMin, 0)}
        </text>

        <path d={chemin} fill="none" stroke="var(--graphe-trait)" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" />

        {points
          .filter((r, i) => points.length <= SEUIL_POINTS_VISIBLES
            || r.conforme === 0 || i === points.length - 1)
          .map((r) => {
            const mauvais = r.conforme === 0
            return (
              <circle
                key={r.id}
                cx={x(new Date(r.date).getTime())} cy={y(r.temp)} r={mauvais ? 5 : 4}
                fill={mauvais ? 'var(--graphe-alerte)' : 'var(--graphe-trait)'}
                stroke="var(--surface)" strokeWidth="2"
              />
            )
          })}

        {/* Repère de survol */}
        {actif && (
          <line
            x1={x(new Date(actif.date).getTime())} x2={x(new Date(actif.date).getTime())}
            y1={MARGE.haut} y2={HAUTEUR - MARGE.bas}
            stroke="var(--graphe-grille)" strokeWidth="1"
          />
        )}

        {/* Une seule valeur écrite : la dernière. Le reste se lit à la bulle. */}
        {(() => {
          const texte = `${nombre(dernier.temp, 1)} °C`
          const cx = x(new Date(dernier.date).getTime())
          // Largeur approchée : sans ce calcul, une valeur négative sortait du cadre.
          const deborde = cx + 9 + texte.length * 5.8 > largeur
          return (
            <text
              x={deborde ? cx - 9 : cx + 9} y={y(dernier.temp) + 3}
              textAnchor={deborde ? 'end' : 'start'}
              fill="var(--texte)" fontSize="10" fontWeight="600"
            >
              {texte}
            </text>
          )
        })()}

        <text x={MARGE.gauche} y={HAUTEUR - 6} fill="var(--texte-doux)" fontSize="9">
          {new Date(dates[0].date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
        </text>
        <text x={largeur - MARGE.droite} y={HAUTEUR - 6} textAnchor="end"
          fill="var(--texte-doux)" fontSize="9">
          {new Date(dates[1].date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
        </text>
      </svg>

      {actif && (
        <div className="bulle-graphe" style={{
          left: `${Math.min(Math.max((x(new Date(actif.date).getTime()) / largeur) * 100, 12), 88)}%`,
        }}>
          <strong className="mono">{nombre(actif.temp, 1)} °C</strong>
          <span className="petit doux">{dateHeureFr(actif.date)}</span>
          {actif.conforme === 0 && <span className="petit" style={{ color: 'var(--danger)' }}>Hors zone</span>}
        </div>
      )}

      {horsZone.length > 0 && (
        <p className="petit" style={{ color: 'var(--danger)', marginTop: 4 }}>
          {horsZone.length} relevé{horsZone.length > 1 ? 's' : ''} hors zone sur la période
        </p>
      )}
    </div>
  )
}
