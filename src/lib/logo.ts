/**
 * Le logo du magasin.
 *
 * Le fichier `public/logo.jpg` est l'original, à l'octet près : il n'est jamais
 * modifié, ni recadré, ni recompressé. Il contient de larges marges blanches,
 * qui feraient paraître le dessin minuscule sur une étiquette.
 *
 * On ne montre donc que la zone utile, au moment de l'affichage. Changer les
 * quatre nombres ci-dessous suffit à recadrer autrement — ou à tout montrer,
 * en remettant 0, 0, 1, 1.
 */

export const LOGO = './logo.jpg'

/** Zone utile, en fraction de l'image (mesurée sur le contenu non blanc). */
export const CADRE = {
  gauche: 152 / 1024,
  haut: 370 / 1536,
  largeur: 720 / 1024,
  hauteur: 725 / 1536,
}

/** Proportions de la zone montrée, pour réserver la bonne place. */
export const RAPPORT = (CADRE.largeur * 1024) / (CADRE.hauteur * 1536)

/**
 * Version recadrée pour les PDF : jsPDF ne sait pas rogner une image, on lui
 * prépare donc un canevas. Le fichier d'origine n'est pas touché pour autant.
 */
let cache: string | null = null

export async function logoPourPdf(): Promise<string | null> {
  if (cache) return cache
  try {
    const image = await new Promise<HTMLImageElement>((resolve, rejeter) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => rejeter(new Error('logo illisible'))
      img.src = LOGO
    })

    const l = Math.round(image.naturalWidth * CADRE.largeur)
    const h = Math.round(image.naturalHeight * CADRE.hauteur)
    const canvas = document.createElement('canvas')
    canvas.width = l
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    // Fond blanc : un PDF n'a pas de transparence utile ici.
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, l, h)
    ctx.drawImage(
      image,
      Math.round(image.naturalWidth * CADRE.gauche),
      Math.round(image.naturalHeight * CADRE.haut),
      l, h, 0, 0, l, h,
    )
    cache = canvas.toDataURL('image/jpeg', 0.92)
    return cache
  } catch {
    // Pas de logo : les documents restent parfaitement lisibles sans.
    return null
  }
}
