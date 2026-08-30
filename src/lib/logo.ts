/**
 * Le logo du magasin.
 *
 * `public/logo.jpg` est l'original fourni, conservé à l'octet près : il ne doit
 * être ni recadré, ni recompressé, ni remplacé. Il reste la référence.
 *
 * `public/logo.svg` en est la version vectorielle, détourée du fond blanc : elle
 * reste nette à n'importe quelle taille, d'une étiquette de 5 mm à une enseigne,
 * et son fond transparent lui permet de se poser aussi bien sur clair que sur
 * sombre. C'est elle que l'application affiche.
 */

export const LOGO = './logo.svg'
export const LOGO_ORIGINAL = './logo.jpg'

/** Proportions du tracé, reprises du viewBox du SVG. */
export const RAPPORT = 720 / 725

/**
 * Version matricielle pour les PDF : jsPDF ne sait pas placer un SVG. On le
 * dessine donc dans un canevas, à une définition largement supérieure à ce que
 * l'impression demande, pour rester net même sur un grand format.
 */
let cache: string | null = null

export async function logoPourPdf(largeurCible = 900): Promise<string | null> {
  if (cache) return cache
  try {
    const image = await new Promise<HTMLImageElement>((resolve, rejeter) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => rejeter(new Error('logo illisible'))
      img.src = LOGO
    })

    const l = largeurCible
    const h = Math.round(l / RAPPORT)
    const canvas = document.createElement('canvas')
    canvas.width = l
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    // Un PDF n'a pas de transparence utile ici : on aplatit sur du blanc.
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, l, h)
    ctx.drawImage(image, 0, 0, l, h)
    cache = canvas.toDataURL('image/jpeg', 0.92)
    return cache
  } catch {
    // Pas de logo : les documents restent parfaitement lisibles sans.
    return null
  }
}
