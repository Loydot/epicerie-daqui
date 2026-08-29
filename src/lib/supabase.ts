import { createClient } from '@supabase/supabase-js'

/**
 * Connexion au projet Supabase du magasin.
 *
 * La clé ci-dessous est la clé « publiable » : elle est faite pour vivre dans une
 * page web et Supabase la donne comme telle. Elle n'ouvre aucune porte par
 * elle-même — ce sont les règles d'accès (RLS) du serveur qui décident, et elles
 * exigent d'être connecté. La clé secrète, elle, n'a rien à faire ici et n'y est pas.
 */
export const SUPABASE_URL = 'https://ryysymgioutinjupeyod.supabase.co'
export const SUPABASE_CLE = 'sb_publishable_0CDi2dRnAdnhhkg6f7uvLA_kcKSxuPk'

export const supabase = createClient(SUPABASE_URL, SUPABASE_CLE, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // La session survit à la fermeture de l'app : le code n'est demandé qu'une fois.
    storageKey: 'epicerie-session',
  },
})

export async function estConnecte(): Promise<boolean> {
  const { data } = await supabase.auth.getSession()
  return Boolean(data.session)
}
