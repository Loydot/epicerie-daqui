import { useCallback, useEffect, useRef, useState } from 'react'
import { demarreScan, retourScanReussi, type SessionScan } from '../lib/barcode'
import { IconeAlerte, IconeClavier, IconeTorche } from './Icones'

interface Props {
  /** Appele une fois par code lu, déjà dedoublonne. */
  surCode: (code: string) => void
  /** Met la caméra en pause, par exemple pendant qu'une fiche est ouverte. */
  enPause?: boolean
}

/** Deux lectures du meme code a moins de 2,5 s d'intervalle = une seule saisie. */
const DELAI_ANTI_DOUBLON = 2500

export default function Scanner({ surCode, enPause = false }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const sessionRef = useRef<SessionScan | null>(null)
  const dernierRef = useRef<{ code: string; t: number }>({ code: '', t: 0 })
  const surCodeRef = useRef(surCode)
  surCodeRef.current = surCode

  const [erreur, setErreur] = useState('')
  const [torcheDispo, setTorcheDispo] = useState(false)
  const [moteur, setMoteur] = useState<'natif' | 'zxing' | null>(null)
  const [torcheOn, setTorcheOn] = useState(false)
  const [saisieOuverte, setSaisieOuverte] = useState(false)
  const [saisie, setSaisie] = useState('')

  const filtre = useCallback((code: string) => {
    const propre = code.trim()
    const now = Date.now()
    const { code: prec, t } = dernierRef.current
    if (propre === prec && now - t < DELAI_ANTI_DOUBLON) return
    dernierRef.current = { code: propre, t: now }
    retourScanReussi()
    surCodeRef.current(propre)
  }, [])

  useEffect(() => {
    if (enPause) return
    let annule = false

    ;(async () => {
      try {
        const video = videoRef.current
        if (!video) return
        const session = await demarreScan(video, filtre)
        if (annule) { session.arrete(); return }
        sessionRef.current = session
        setTorcheDispo(session.torcheDispo)
        setMoteur(session.moteur)
        setErreur('')
      } catch (e) {
        const nom = (e as DOMException)?.name
        setErreur(
          nom === 'NotAllowedError'
            ? "Accès à la caméra refusé. Autorise-le dans les paramètres du site, puis recharge la page."
            : nom === 'NotFoundError'
              ? "Aucune caméra détectée sur cet appareil."
              : "La caméra n'a pas pu démarrer. Utilise la saisie manuelle en attendant.",
        )
        setSaisieOuverte(true)
      }
    })()

    return () => {
      annule = true
      sessionRef.current?.arrete()
      sessionRef.current = null
      setTorcheOn(false)
    }
  }, [enPause, filtre])

  const basculeTorche = async () => {
    const s = sessionRef.current
    if (!s) return
    const nouvel = !torcheOn
    await s.basculeTorche(nouvel).catch(() => {})
    setTorcheOn(nouvel)
  }

  const valideSaisie = (e: React.FormEvent) => {
    e.preventDefault()
    const code = saisie.replace(/\D/g, '')
    if (!code) return
    setSaisie('')
    dernierRef.current = { code: '', t: 0 }
    surCodeRef.current(code)
  }

  return (
    <div className="pile">
      {erreur && (
        <div className="bandeau danger">
          <IconeAlerte />
          <span>{erreur}</span>
        </div>
      )}

      {!erreur && (
        <div className="scene">
          <video ref={videoRef} muted playsInline />
          <div className="voile haut" />
          <div className="voile bas" />
          <div className="voile gauche" />
          <div className="voile droite" />
          <div className="viseur" />
          <div className="scene-outils">
            {torcheDispo && (
              <button type="button" onClick={basculeTorche} aria-pressed={torcheOn} aria-label="Lampe">
                <IconeTorche />
              </button>
            )}
            <button type="button" onClick={() => setSaisieOuverte((v) => !v)} aria-label="Saisie manuelle">
              <IconeClavier />
            </button>
          </div>
        </div>
      )}

      {moteur === 'zxing' && (
        <p className="petit doux" style={{ textAlign: 'center' }}>
          Décodeur de secours : ce navigateur n'a pas le lecteur intégré, la lecture est
          plus lente. Chrome à jour sur Android utilise le lecteur rapide.
        </p>
      )}

      {saisieOuverte && (
        <form className="carte" onSubmit={valideSaisie}>
          <label htmlFor="code-manuel">Code-barres illisible ? Tape-le</label>
          <div className="ligne">
            <input
              id="code-manuel"
              className="champ mono"
              inputMode="numeric"
              autoComplete="off"
              placeholder="3017620422003"
              value={saisie}
              onChange={(e) => setSaisie(e.target.value)}
            />
            <button type="submit" className="principal" disabled={!saisie.trim()}>OK</button>
          </div>
        </form>
      )}
    </div>
  )
}
