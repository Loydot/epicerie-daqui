import { CADRE, LOGO, RAPPORT } from '../lib/logo'

interface Props {
  /** Hauteur affichée, en pixels. */
  hauteur?: number
  className?: string
}

/**
 * Affiche la zone utile du logo sans jamais altérer le fichier : l'image est
 * agrandie puis décalée dans un cadre qui masque les marges blanches.
 *
 * Le fond blanc reste blanc, y compris en thème sombre : c'est voulu, un logo
 * imprimé se pose sur du papier, pas sur du gris.
 */
export default function Logo({ hauteur = 48, className = '' }: Props) {
  return (
    <span
      className={className}
      style={{
        display: 'block',
        height: hauteur,
        width: hauteur * RAPPORT,
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 8,
        background: '#fff',
        flex: '0 0 auto',
      }}
    >
      <img
        src={LOGO}
        alt="L'Épicerie d'Aquí — Vingrau"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: `${100 / CADRE.largeur}%`,
          maxWidth: 'none',
          // Les pourcentages d'une translation se comptent sur l'image
          // elle-même : le cadrage reste exact quelle que soit la taille.
          transform: `translate(${-CADRE.gauche * 100}%, ${-CADRE.haut * 100}%)`,
        }}
      />
    </span>
  )
}
