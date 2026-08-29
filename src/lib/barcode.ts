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
    const boucle = async () => {
      if (!vivant) return
      try {
        if (video.readyState >= 2) {
          const codes = await detecteur.detect(video)
          if (codes.length) surCode(codes[0].rawValue)
        }
      } catch {
        // image illisible sur cette frame : on retente a la suivante
      }
      if (vivant) requestAnimationFrame(() => void boucle())
    }
    void boucle()
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
    hints.set(DecodeHintType.TRY_HARDER, true)
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

/** Bip court + vibration : confirme le scan sans avoir a regarder l'ecran. */
export function retourScanReussi(): void {
  try {
    navigator.vibrate?.(60)
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 1320
    gain.gain.setValueAtTime(0.12, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12)
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.12)
    osc.onended = () => void ctx.close()
  } catch {
    // audio bloque par le navigateur : la vibration suffit
  }
}
