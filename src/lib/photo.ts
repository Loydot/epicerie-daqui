/**
 * Réduit une photo prise au téléphone (plusieurs Mo) à un JPEG d'environ
 * 100 Ko, assez léger pour se synchroniser comme du texte.
 */
export async function photoReduite(fichier: File, cote = 900): Promise<string> {
  const image = await createImageBitmap(fichier)
  const echelle = Math.min(1, cote / Math.max(image.width, image.height))
  const toile = document.createElement('canvas')
  toile.width = Math.round(image.width * echelle)
  toile.height = Math.round(image.height * echelle)
  toile.getContext('2d')!.drawImage(image, 0, 0, toile.width, toile.height)
  image.close()
  return toile.toDataURL('image/jpeg', 0.72)
}
