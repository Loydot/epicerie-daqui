import { useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, TABLES_SYNCHRONISEES, type TableSynchronisee } from '../db/db'
import { dateHeureFr, normalise } from '../lib/format'
import {
  archives, cleDe, decrit, NOMS_TABLES, ouvreFichier, recupere, recupereLesManquantes,
  type Archive,
} from '../lib/sauvegardes'
import { IconeCorbeille, IconeRecherche, IconeValide } from '../components/Icones'

/** Égalité de contenu, sans les marques techniques de synchronisation. */
function memeContenu(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const net = (o: Record<string, unknown>) => JSON.stringify(
    Object.keys(o).filter((k) => k !== 'aSynchroniser' && k !== 'majLe').sort().map((k) => [k, o[k]]),
  )
  return net(a) === net(b)
}

export default function Sauvegardes() {
  const fichierRef = useRef<HTMLInputElement>(null)
  const [ouverte, setOuverte] = useState<string>('')
  const [message, setMessage] = useState('')

  const liste = useLiveQuery(() => archives.archives.orderBy('ouvertLe').reverse().toArray(), [], []) ?? []
  const archive = liste.find((a) => a.id === ouverte)

  const ouvre = async (f: File) => {
    try {
      setOuverte(await ouvreFichier(f))
      setMessage('')
    } catch {
      setMessage("Fichier illisible : ce n'est pas une sauvegarde de l'application.")
    }
  }

  if (archive) return <Consultation archive={archive} surFermer={() => setOuverte('')} />

  return (
    <div className="pile">
      <div className="carte pile">
        <h2>Consulter une sauvegarde</h2>
        <p className="petit doux">
          La sauvegarde est ouverte à part : elle ne remplace rien et ne supprime rien.
          Vous y choisissez ce que vous voulez récupérer.
        </p>
        <button type="button" className="principal large" onClick={() => fichierRef.current?.click()}>
          Ouvrir un fichier de sauvegarde
        </button>
        <input ref={fichierRef} type="file" accept="application/json,.json" hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void ouvre(f); e.target.value = '' }} />
        {message && <p className="petit" style={{ color: 'var(--danger)' }}>{message}</p>}
      </div>

      {liste.length > 0 && (
        <div className="carte">
          <div className="liste">
            {liste.map((a) => (
              <div key={a.id} className="item">
                <button type="button" className="discret item-corps" style={{ textAlign: 'left', justifyContent: 'flex-start' }}
                  onClick={() => setOuverte(a.id)}>
                  <span>
                    <span className="item-nom" style={{ display: 'block' }}>Sauvegarde du {dateHeureFr(a.exporteLe)}</span>
                    <span className="petit doux">{a.nom}</span>
                  </span>
                </button>
                <button type="button" className="discret" aria-label="Retirer cette sauvegarde de la liste"
                  onClick={() => {
                    if (confirm('Retirer cette sauvegarde de la liste ? Le fichier et les données en service ne sont pas touchés.')) {
                      void archives.archives.delete(a.id)
                    }
                  }}>
                  <IconeCorbeille />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Consultation({ archive, surFermer }: { archive: Archive; surFermer: () => void }) {
  const presentes = TABLES_SYNCHRONISEES.filter((t) => (archive.donnees[t]?.length ?? 0) > 0)
  const [table, setTable] = useState<TableSynchronisee>(presentes[0] ?? 'produits')
  const [q, setQ] = useState('')
  const [message, setMessage] = useState('')

  const lignes = archive.donnees[table] ?? []
  const actuelles = useLiveQuery(async () => {
    const m = new Map<string, Record<string, unknown>>()
    for (const l of await db.table(table).toArray()) m.set(cleDe(table, l), l)
    return m
  }, [table], new Map()) ?? new Map()

  const affichees = useMemo(() => {
    const cle = normalise(q)
    return lignes
      .map((l) => ({ l, ...decrit(table, l, archive) }))
      .filter((x) => !cle || normalise(`${x.titre} ${x.detail}`).includes(cle))
      .slice(0, 300)
  }, [lignes, q, table, archive])

  const manquantes = lignes.filter((l) => !actuelles.has(cleDe(table, l))).length

  const agit = async (action: () => Promise<unknown>, ok: string) => {
    try {
      const r = await action()
      setMessage(typeof r === 'string' ? r : ok)
    } catch (e) {
      setMessage(`Impossible : ${(e as Error).message}`)
    }
  }

  return (
    <div className="pile">
      <div className="carte pile">
        <div className="ligne-espace">
          <h2>Sauvegarde du {dateHeureFr(archive.exporteLe)}</h2>
          <button type="button" className="discret" onClick={surFermer}>Fermer</button>
        </div>
        <p className="petit doux">
          Consultation seule. « Récupérer » remet une fiche dans l'application ; rien n'est supprimé.
        </p>
        <select value={table} onChange={(e) => { setTable(e.target.value as TableSynchronisee); setQ('') }}>
          {presentes.map((t) => (
            <option key={t} value={t}>{NOMS_TABLES[t]} ({archive.donnees[t].length})</option>
          ))}
        </select>
        <div className="ligne">
          <IconeRecherche className="doux" />
          <input className="champ" placeholder="Chercher…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {manquantes > 0 && (
          <button type="button" className="large" onClick={() => {
            if (!confirm(`Récupérer les ${manquantes} fiche(s) absente(s) de l'application ? Les fiches existantes ne sont pas touchées.`)) return
            void agit(async () => `${await recupereLesManquantes(table, lignes)} fiche(s) récupérée(s).`, '')
          }}>
            Récupérer les {manquantes} fiche(s) absente(s)
          </button>
        )}
        {message && <div className="bandeau"><IconeValide /><span>{message}</span></div>}
      </div>

      <div className="carte">
        <div className="liste">
          {affichees.map(({ l, titre, detail }) => {
            const actuelle = actuelles.get(cleDe(table, l))
            const etat = !actuelle ? 'absente' : memeContenu(actuelle, l) ? 'identique' : 'differente'
            return (
              <div key={cleDe(table, l)} className="item">
                <div className="item-corps">
                  <div className="item-nom">{titre}</div>
                  <div className="petit doux">{detail}</div>
                </div>
                {etat === 'identique' && <span className="etiquette ok">Déjà là</span>}
                {etat === 'absente' && (
                  <button type="button" className="principal"
                    onClick={() => void agit(() => recupere(table, l), `« ${titre} » récupéré.`)}>
                    Récupérer
                  </button>
                )}
                {etat === 'differente' && (
                  <button type="button"
                    onClick={() => {
                      if (!confirm(`« ${titre} » existe déjà avec un contenu différent. Le remplacer par la version de la sauvegarde ?`)) return
                      void agit(() => recupere(table, l), `« ${titre} » remplacé par la version sauvegardée.`)
                    }}>
                    Remplacer
                  </button>
                )}
              </div>
            )
          })}
        </div>
        {affichees.length === 0 && <div className="vide"><p>Rien ici.</p></div>}
      </div>
    </div>
  )
}
