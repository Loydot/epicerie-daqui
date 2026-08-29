import { useEffect, useState } from 'react'
import { resteAEnvoyer, synchronise } from '../lib/sync'
import { supabase } from '../lib/supabase'
import { IconeAlerte, IconeExport, IconeValide } from './Icones'

/** État de la synchronisation, et de quoi la relancer ou se déconnecter. */
export default function EtatSynchro() {
  const [enAttente, setEnAttente] = useState(0)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState('')
  const [compte, setCompte] = useState('')
  const [enLigne, setEnLigne] = useState(navigator.onLine)

  useEffect(() => {
    let vivant = true
    const rafraichit = async () => {
      const n = await resteAEnvoyer()
      if (vivant) setEnAttente(n)
    }
    void rafraichit()
    void supabase.auth.getUser().then(({ data }) => {
      if (vivant) setCompte(data.user?.email ?? '')
    })

    const minuteur = window.setInterval(() => void rafraichit(), 4000)
    const surReseau = () => setEnLigne(navigator.onLine)
    window.addEventListener('online', surReseau)
    window.addEventListener('offline', surReseau)
    return () => {
      vivant = false
      window.clearInterval(minuteur)
      window.removeEventListener('online', surReseau)
      window.removeEventListener('offline', surReseau)
    }
  }, [])

  const relance = async () => {
    setEnCours(true)
    setErreur('')
    try {
      await synchronise()
      setEnAttente(await resteAEnvoyer())
    } catch (e) {
      setErreur((e as Error).message)
    } finally {
      setEnCours(false)
    }
  }

  const deconnecte = async () => {
    if (enAttente > 0 && !confirm(
      `${enAttente} modification(s) n'ont pas encore été envoyées. Se déconnecter maintenant les garderait sur cet appareil sans les partager. Continuer ?`,
    )) return
    await supabase.auth.signOut()
    location.reload()
  }

  return (
    <div className="carte pile">
      <h2>Synchronisation</h2>

      {!enLigne ? (
        <div className="bandeau alerte">
          <IconeAlerte />
          <span>
            Hors ligne. La saisie continue normalement ; tout partira au retour du réseau.
          </span>
        </div>
      ) : enAttente > 0 ? (
        <div className="bandeau alerte">
          <IconeExport />
          <span>{enAttente} modification{enAttente > 1 ? 's' : ''} en attente d'envoi.</span>
        </div>
      ) : (
        <div className="bandeau">
          <IconeValide />
          <span>Tout est synchronisé avec les autres appareils.</span>
        </div>
      )}

      {erreur && (
        <div className="bandeau danger">
          <IconeAlerte />
          <span>{erreur}</span>
        </div>
      )}

      <button type="button" className="large" onClick={relance} disabled={enCours || !enLigne}>
        {enCours ? 'Échange en cours…' : 'Synchroniser maintenant'}
      </button>

      <p className="petit doux">
        Compte du magasin : <strong>{compte || '—'}</strong>
      </p>
      <button type="button" className="large" onClick={deconnecte}>
        Déconnecter cet appareil
      </button>
    </div>
  )
}
