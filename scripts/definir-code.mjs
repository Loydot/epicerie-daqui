/**
 * Définit le code d'accès de l'application.
 *
 * Le code lui-même n'est écrit nulle part : seule son empreinte PBKDF2 est
 * enregistrée dans src/verrou.json, avec un sel tiré au hasard. Personne d'autre
 * que toi ne connaît le code.
 *
 *   npm run verrou
 */
import { createInterface } from 'node:readline/promises'
import { pbkdf2Sync, randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// Une erreur ici doit rester lisible : pas de pile d'appels au visage.
const echec = (e) => {
  console.error(`\nÉchec : ${e?.message ?? e}\n`)
  process.exit(1)
}
process.on('unhandledRejection', echec)
process.on('uncaughtException', echec)

const ITERATIONS = 200_000
const FICHIER = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'verrou.json')

const ENTREE = '\r'
const RETOUR_LIGNE = '\n'
const CTRL_C = String.fromCharCode(3)
const FIN_FICHIER = String.fromCharCode(4)
const RETOUR_ARRIERE = String.fromCharCode(127)

/**
 * Repli quand le terminal n'est pas transmis (c'est le cas de npm sur certaines
 * consoles Windows) : la saisie est visible, mais la commande fonctionne.
 * Une seule interface readline, sinon la deuxième question perd ce qui a déjà
 * été tapé dans le tampon d'entrée.
 */
let lecteur = null
async function demandeVisible(question) {
  lecteur ??= createInterface({ input: process.stdin, output: process.stdout })
  const ferme = new Promise((_, rejeter) => {
    lecteur.once('close', () => rejeter(new Error("saisie interrompue (entrée fermée)")))
  })
  // Sans cette course, une entrée fermée laisserait la commande figée sans rien dire.
  return Promise.race([lecteur.question(question), ferme])
}

/** Saisie sans écho : le code n'apparaît pas à l'écran ni dans l'historique. */
function demandeMasquee(question) {
  if (!process.stdin.isTTY) return demandeVisible(question)
  return new Promise((resolve) => {
    process.stdout.write(question)
    process.stdin.setRawMode(true)
    process.stdin.resume()
    let saisie = ''
    const surTouche = (donnee) => {
      const touche = donnee.toString('utf8')
      if (touche === ENTREE || touche === RETOUR_LIGNE || touche === FIN_FICHIER) {
        process.stdin.removeListener('data', surTouche)
        process.stdin.setRawMode(false)
        process.stdin.pause()
        process.stdout.write('\n')
        resolve(saisie)
        return
      }
      if (touche === CTRL_C) {
        process.stdout.write('\n')
        process.exit(1)
      }
      if (touche === RETOUR_ARRIERE || touche === '\b') {
        if (saisie.length) {
          saisie = saisie.slice(0, -1)
          process.stdout.write('\b \b')
        }
        return
      }
      saisie += touche
      process.stdout.write('*')
    }
    process.stdin.on('data', surTouche)
  })
}

console.log("\nCode d'accès de l'application")
console.log('-----------------------------')
console.log("Il sera demandé une seule fois par appareil, à la première ouverture.")
if (!process.stdin.isTTY) {
  console.log("\n/!\\ Ce terminal ne permet pas de masquer la saisie : ton code va")
  console.log('    s\'afficher en clair. Efface la fenêtre ensuite (commande "cls").')
}
console.log('')

const code = (await demandeMasquee('Nouveau code      : ')).trim()

if (code.length < 6) {
  console.error('\nTrop court : prends au moins 6 caractères. Rien n\'a été modifié.')
  process.exit(1)
}

const confirmation = (await demandeMasquee('Confirme le code  : ')).trim()

if (code !== confirmation) {
  console.error('\nLes deux saisies ne correspondent pas. Rien n\'a été modifié.')
  process.exit(1)
}

const sel = randomBytes(16)
const empreinte = pbkdf2Sync(code, sel, ITERATIONS, 32, 'sha256')

const config = JSON.parse(readFileSync(FICHIER, 'utf8'))
config.actif = true
config.sel = sel.toString('base64')
config.empreinte = empreinte.toString('base64')
config.iterations = ITERATIONS
writeFileSync(FICHIER, `${JSON.stringify(config, null, 2)}\n`)

console.log('\nCode enregistré (empreinte seulement) dans src/verrou.json.')
console.log('Il prendra effet en ligne à la prochaine publication.\n')

lecteur?.close()
