import { createWorker } from 'tesseract.js'
import { normalise } from './format'

const ALLERGENES: Array<{ nom: string; termes: string[] }> = [
  { nom: 'Céréales contenant du gluten', termes: ['gluten', 'ble', 'orge', 'seigle', 'avoine', 'epeautre', 'kamut'] },
  { nom: 'Crustacés', termes: ['crustace', 'crevette', 'crabe', 'homard', 'langoustine'] },
  { nom: 'Œufs', termes: ['oeuf', 'albumine', 'blanc d oeuf', 'jaune d oeuf'] },
  { nom: 'Poissons', termes: ['poisson', 'saumon', 'thon', 'anchois', 'cabillaud', 'morue', 'truite', 'sardine'] },
  { nom: 'Arachides', termes: ['arachide', 'cacahuete', 'peanut'] },
  { nom: 'Soja', termes: ['soja', 'soya'] },
  { nom: 'Lait', termes: ['lait', 'lactose', 'lactoserum', 'caseine', 'whey', 'beurre', 'fromage'] },
  { nom: 'Fruits à coque', termes: ['amande', 'noisette', 'noix', 'cajou', 'pecan', 'bresil', 'pistache', 'macadamia'] },
  { nom: 'Céleri', termes: ['celeri'] },
  { nom: 'Moutarde', termes: ['moutarde'] },
  { nom: 'Graines de sésame', termes: ['sesame'] },
  { nom: 'Anhydride sulfureux et sulfites', termes: ['sulfite', 'dioxyde de soufre', 'e220', 'e221', 'e222', 'e223', 'e224', 'e225', 'e226', 'e227', 'e228'] },
  { nom: 'Lupin', termes: ['lupin'] },
  { nom: 'Mollusques', termes: ['mollusque', 'moule', 'huitre', 'calmar', 'seiche', 'escargot'] },
]

/** Lit la photo dans le navigateur puis renvoie des pistes à confirmer sur l'étiquette. */
export async function litAllergenesEtiquette(
  photo: string,
  progression?: (etat: string) => void,
): Promise<string[]> {
  const worker = await createWorker('fra', 1, {
    logger: (message) => {
      if (message.status === 'recognizing text') {
        progression?.(`Lecture de l'étiquette… ${Math.round(message.progress * 100)} %`)
      } else if (message.status.includes('load')) {
        progression?.('Préparation de la lecture (connexion Internet nécessaire la première fois)…')
      }
    },
  })
  try {
    const { data } = await worker.recognize(photo)
    const texte = ` ${normalise(data.text).replace(/[^a-z0-9]+/g, ' ').trim()} `
    return ALLERGENES
      .filter(({ termes }) => termes.some((terme) => texte.includes(` ${normalise(terme)} `)))
      .map(({ nom }) => nom)
  } finally {
    await worker.terminate()
  }
}
