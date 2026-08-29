import config from '../verrou.json'

/**
 * Code d'accès à l'ouverture de l'application.
 *
 * À quoi ça sert vraiment : dissuader quelqu'un qui tomberait sur l'adresse.
 * Ce que ça ne fait pas : protéger des données. Toute vérification faite dans le
 * navigateur peut être contournée en modifiant le JavaScript de la page. La vraie
 * barrière viendra des règles d'accès Supabase, côté serveur.
 *
 * Le code n'est pas dans le dépôt : seule son empreinte PBKDF2 y figure, avec un sel
 * aléatoire et 200 000 itérations, ce qui rend une attaque par dictionnaire lente.
 */

const MEMOIRE = 'epicerie-verrou'

export const verrouActif = config.actif === true && config.empreinte !== ''

const versOctets = (b64: string): Uint8Array =>
  Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))

const versBase64 = (buf: ArrayBuffer): string =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))

async function empreinte(code: string): Promise<string> {
  const cle = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(code), 'PBKDF2', false, ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: versOctets(config.sel) as unknown as BufferSource,
      iterations: config.iterations,
      hash: 'SHA-256',
    },
    cle, 256,
  )
  return versBase64(bits)
}

export async function codeValide(code: string): Promise<boolean> {
  if (!verrouActif) return true
  try {
    return (await empreinte(code.trim())) === config.empreinte
  } catch {
    return false
  }
}

/** Une fois ouvert, l'appareil le reste : ta sœur ne tape le code qu'une fois. */
export function dejaOuvert(): boolean {
  if (!verrouActif) return true
  try {
    return localStorage.getItem(MEMOIRE) === config.empreinte
  } catch {
    return false
  }
}

export function memoriseOuverture(): void {
  try {
    localStorage.setItem(MEMOIRE, config.empreinte)
  } catch {
    // navigation privée ou stockage bloqué : le code sera redemandé, sans plus
  }
}

export function oublieOuverture(): void {
  try {
    localStorage.removeItem(MEMOIRE)
  } catch {
    // rien à faire
  }
}
