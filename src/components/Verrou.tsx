import { useState } from 'react'
import { codeValide, memoriseOuverture } from '../lib/verrou'
import { IconeAlerte } from './Icones'

interface Props {
  surOuverture: () => void
}

export default function Verrou({ surOuverture }: Props) {
  const [code, setCode] = useState('')
  const [erreur, setErreur] = useState('')
  const [verification, setVerification] = useState(false)

  const valide = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim() || verification) return
    setVerification(true)
    setErreur('')
    // La vérification prend volontairement ~200 ms : c'est ce qui rend
    // les essais en série coûteux.
    const ok = await codeValide(code)
    setVerification(false)
    if (!ok) {
      setErreur('Code incorrect.')
      setCode('')
      return
    }
    memoriseOuverture()
    surOuverture()
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 20 }}>
      <form className="carte pile" style={{ width: '100%', maxWidth: 340 }} onSubmit={valide}>
        <div style={{ textAlign: 'center' }}>
          <img src="./favicon.svg" alt="" width={52} height={52} style={{ borderRadius: 12 }} />
          <h1 style={{ marginTop: 10 }}>Épicerie</h1>
          <p className="petit doux" style={{ marginTop: 4 }}>Scan &amp; registres HACCP</p>
        </div>

        <div>
          <label htmlFor="code">Code d'accès</label>
          <input
            id="code"
            type="password"
            inputMode="text"
            autoComplete="current-password"
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            style={{ textAlign: 'center', letterSpacing: '.18em', fontSize: '1.1rem' }}
          />
        </div>

        {erreur && (
          <div className="bandeau danger">
            <IconeAlerte />
            <span>{erreur}</span>
          </div>
        )}

        <button type="submit" className="principal haut large" disabled={!code.trim() || verification}>
          {verification ? 'Vérification…' : 'Ouvrir'}
        </button>

        <p className="petit doux" style={{ textAlign: 'center' }}>
          Le code n'est demandé qu'une fois par appareil.
        </p>
      </form>
    </div>
  )
}
