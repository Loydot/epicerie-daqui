/**
 * Définit le code d'accès de l'application.
 *
 * Le code lui-même n'est écrit nulle part : seule son empreinte PBKDF2 est
 * enregistrée dans src/verrou.json, avec un sel tiré au hasard. Personne d'autre
 * que toi ne connaît le code.
 *
 *   npm run verrou
 */
import { pbkdf2Sync, randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ITERATIONS = 200_000
const FICHIER = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'verrou.json')

const ENTREE = '\r'
const RETOUR_LIGNE = '\n'
const CTRL_C = String.fromCharCode(3)
const FIN_FICHIER = String.fromCharCode(4)
const RETOUR_ARRIERE = String.fromCharCode(127)

/** Saisie sans écho : le code n'apparaît pas à l'écran ni dans l'historique. */
function demandeMasquee(question) {
  return new Promise((resolve, rejeter) => {
    process.stdout.write(question)
    if (!process.stdin.isTTY) {
      rejeter(new Error("Ce script doit être lancé dans un vrai terminal."))
      return
    }
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
console.log("Il sera demandé une seule fois par appareil, à la première ouverture.\n")

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
