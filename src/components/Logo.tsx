import { LOGO, RAPPORT } from '../lib/logo'

interface Props {
  /** Hauteur du logo lui-même, en pixels. */
  hauteur?: number
  className?: string
}

/**
 * Le logo, en vectoriel : net à toute taille.
 *
 * Il est posé sur une plaque blanche, comme un logo imprimé sur du papier. Sans
 * elle, le lettrage noir de « L'ÉPICERIE » et de « VINGRAU » disparaît sur le
 * thème sombre — le détourage seul ne suffit pas.
 */
export default function Logo({ hauteur = 48, className = '' }: Props) {
  const marge = Math.max(3, Math.round(hauteur * 0.07))
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        padding: marge,
        background: '#fff',
        borderRadius: Math.max(4, Math.round(hauteur * 0.1)),
        flex: '0 0 auto',
        lineHeight: 0,
      }}
    >
      <img
        src={LOGO}
        alt="L'Épicerie d'Aquí — Vingrau"
        width={Math.round(hauteur * RAPPORT)}
        height={hauteur}
        style={{ display: 'block', height: hauteur, width: 'auto' }}
      />
    </span>
  )
}
