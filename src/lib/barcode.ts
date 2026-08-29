/** L'API native du navigateur, absente des typings DOM standards. */
interface DetecteurNatif {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>>
}
interface FabriqueDetecteur {
  new (options: { formats: string[] }): DetecteurNatif
  getSupportedFormats(): Promise<string[]>
}
declare global {
  interface Window { BarcodeDetector?: FabriqueDetecteur }
  interface MediaTrackCapabilities { torch?: boolean }
  interface MediaTrackConstraintSet { torch?: boolean }
}

const FORMATS_NATIFS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'itf']

export interface SessionScan {
  arrete: () => void
  torcheDispo: boolean
  basculeTorche: (allumee: boolean) => Promise<void>
  moteur: 'natif' | 'zxing'
}

async function detecteurNatifDispo(): Promise<boolean> {
  if (!window.BarcodeDetector) return false
  try {
    const formats = await window.BarcodeDetector.getSupportedFormats()
    return formats.includes('ean_13')
  } catch {
    return false
  }
}

/**
 * Ouvre la caméra arriere et lance la detection en continu.
 * Utilise le decodeur natif du navigateur quand il existe (nettement plus rapide
 * sur Android), sinon ZXing en WebAssembly, qui marche partout y compris iOS.
 */
export async function demarreScan(
  video: HTMLVideoElement,
  surCode: (code: string) => void,
): Promise<SessionScan> {
  const flux = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
    audio: false,
  })

  video.srcObject = flux
  video.setAttribute('playsinline', 'true')
  await video.play()

  const piste = flux.getVideoTracks()[0]
  const torcheDispo = Boolean(piste?.getCapabilities?.().torch)
  const basculeTorche = async (allumee: boolean) => {
    if (!torcheDispo) return
    await piste.applyConstraints({ advanced: [{ torch: allumee }] })
  }

  let vivant = true
  const nettoyages: Array<() => void> = [
    () => { vivant = false },
    () => flux.getTracks().forEach((t) => t.stop()),
    () => { video.srcObject = null },
  ]

  const natif = await detecteurNatifDispo()

  if (natif) {
    const detecteur = new window.BarcodeDetector!({ formats: FORMATS_NATIFS })
    // Analyser chaque image (60 par seconde) sature le telephone et fait saccader
    // l'apercu video. Dix analyses par seconde suffisent largement : on lit le
    // code des qu'il est cadre, et la video reste fluide.
    const INTERVALLE = 100
    let derniere = 0
    let occupe = false

    const boucle = async (horodatage: number) => {
      if (!vivant) return
      if (!occupe && horodatage - derniere >= INTERVALLE && video.readyState >= 2) {
        derniere = horodatage
        occupe = true
        try {
          const codes = await detecteur.detect(video)
          if (codes.length && vivant) surCode(codes[0].rawValue)
        } catch {
          // image illisible sur cette frame : on retente a la suivante
        } finally {
          occupe = false
        }
      }
      if (vivant) requestAnimationFrame(boucle)
    }
    requestAnimationFrame(boucle)
  } else {
    // Charge a la demande : sur Android le decodeur natif suffit et ce paquet
    // (plusieurs centaines de Ko) n'est jamais telecharge.
    const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
      import('@zxing/browser'),
      import('@zxing/library'),
    ])
    const hints = new Map()
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E, BarcodeFormat.CODE_128, BarcodeFormat.ITF,
    ])
    // TRY_HARDER multiplie le temps d'analyse pour gagner sur des codes abimes ;
    // en rayon les codes sont propres, la vitesse compte davantage.
    hints.set(DecodeHintType.TRY_HARDER, false)
    const lecteur = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120 })
    const controles = await lecteur.decodeFromVideoElement(video, (resultat) => {
      if (resultat && vivant) surCode(resultat.getText())
    })
    nettoyages.push(() => controles.stop())
  }

  return {
    moteur: natif ? 'natif' : 'zxing',
    torcheDispo,
    basculeTorche,
    arrete: () => nettoyages.forEach((f) => { try { f() } catch { /* déjà libere */ } }),
  }
}

/**
 * Un seul contexte audio pour toute la session : les navigateurs en limitent le
 * nombre (six sous Chrome), et en creer un par scan finissait par echouer au bout
 * de quelques produits, en plus de couter cher.
 */
let contexteAudio: AudioContext | null = null

function bip(): void {
  contexteAudio ??= new AudioContext()
  const ctx = contexteAudio
  // Suspendu par le navigateur tant qu'il n'y a pas eu d'interaction : on relance.
  if (ctx.state === 'suspended') void ctx.resume()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.frequency.value = 1320
  gain.gain.setValueAtTime(0.12, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12)
  osc.connect(gain).connect(ctx.destination)
  osc.start()
  osc.stop(ctx.currentTime + 0.12)
}

/** Bip court + vibration : confirme le scan sans avoir a regarder l'ecran. */
export function retourScanReussi(): void {
  try {
    navigator.vibrate?.(60)
    bip()
  } catch {
    // audio bloque par le navigateur : la vibration suffit
  }
}
