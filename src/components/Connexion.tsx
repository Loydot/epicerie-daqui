import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { IconeAlerte } from './Icones'

interface Props {
  surConnexion: () => void
}

/**
 * Connexion au compte du magasin. Contrairement à l'ancien code d'accès, qui se
 * contentait de masquer l'écran, celle-ci est vérifiée par le serveur : sans
 * session valide, la base ne répond rien du tout.
 */
export default function Connexion({ surConnexion }: Props) {
  const [email, setEmail] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [erreur, setErreur] = useState('')
  const [enCours, setEnCours] = useState(false)

  const valide = async (e: React.FormEvent) => {
    e.preventDefault()
    if (enCours) return
    setEnCours(true)
    setErreur('')

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: motDePasse,
    })
    setEnCours(false)

    if (error) {
      setErreur(
        error.message.includes('Invalid login')
          ? 'Identifiant ou mot de passe incorrect.'
          : navigator.onLine
            ? `Connexion impossible : ${error.message}`
            : "Pas de réseau. La première connexion sur cet appareil demande internet ; ensuite l'application s'ouvre sans.",
      )
      setMotDePasse('')
      return
    }
    surConnexion()
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 20 }}>
      <form className="carte pile" style={{ width: '100%', maxWidth: 360 }} onSubmit={valide}>
        <div style={{ textAlign: 'center' }}>
          <img src="./favicon.svg" alt="" width={52} height={52} style={{ borderRadius: 12 }} />
          <h1 style={{ marginTop: 10 }}>Épicerie</h1>
          <p className="petit doux" style={{ marginTop: 4 }}>Scan &amp; registres HACCP</p>
        </div>

        <div>
          <label htmlFor="email">Identifiant</label>
          <input
            id="email" type="email" autoComplete="username" inputMode="email"
            autoFocus value={email} onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="mdp">Mot de passe</label>
          <input
            id="mdp" type="password" autoComplete="current-password"
            value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)}
          />
        </div>

        {erreur && (
          <div className="bandeau danger">
            <IconeAlerte />
            <span>{erreur}</span>
          </div>
        )}

        <button
          type="submit" className="principal haut large"
          disabled={enCours || !email.trim() || !motDePasse}
        >
          {enCours ? 'Connexion…' : 'Se connecter'}
        </button>

        <p className="petit doux" style={{ textAlign: 'center' }}>
          Une seule fois par appareil. Ensuite l'application s'ouvre directement,
          même sans réseau.
        </p>
      </form>
    </div>
  )
}
