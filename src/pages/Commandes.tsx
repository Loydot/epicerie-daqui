import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, uid } from '../db/db'
import type { Client, ModeRemise } from '../db/types'
import { dateFr, euro, normalise, nombre } from '../lib/format'
import { enCours, motRemise, nomStatut, tonStatut, totalLignes } from '../lib/commandes'
import { useOperateur } from '../lib/operateur'
import { IconePlus, IconeRecherche, IconeRegistre, IconeValide } from '../components/Icones'

type Filtre = 'encours' | 'terminees' | 'toutes'

export default function Commandes() {
  const navigate = useNavigate()
  const [operateur] = useOperateur()
  const [filtre, setFiltre] = useState<Filtre>('encours')
  const [q, setQ] = useState('')

  const [ouvert, setOuvert] = useState(false)
  const [nomClient, setNomClient] = useState('')
  const [telephone, setTelephone] = useState('')
  const [clientChoisi, setClientChoisi] = useState<Client | null>(null)
  const [adresse, setAdresse] = useState('')
  const [mode, setMode] = useState<ModeRemise>('retrait')

  const commandes = useLiveQuery(() => db.commandes.toArray(), [], []) ?? []
  const clients = useLiveQuery(() => db.clients.toArray(), [], []) ?? []
  const lignes = useLiveQuery(() => db.lignesCommande.toArray(), [], []) ?? []

  const client = (id: string) => clients.find((c) => c.id === id)

  const affichees = useMemo(() => {
    const cle = normalise(q)
    return commandes
      .filter((c) => {
        if (filtre === 'encours' && !enCours(c.statut)) return false
        if (filtre === 'terminees' && enCours(c.statut)) return false
        if (!cle) return true
        const cl = client(c.clientId)
        return normalise(
          `${cl?.nom ?? ''} ${cl?.telephone ?? ''} ${cl?.adresse ?? ''} ${c.adresseLivraison} ${c.note}`,
        ).includes(cle)
      })
      // Les plus urgentes d'abord : celles dont le retrait approche.
      .sort((a, b) => (a.dateRetrait || '9999').localeCompare(b.dateRetrait || '9999')
        || b.date.localeCompare(a.date))
  }, [commandes, clients, filtre, q])

  const suggestions = useMemo(() => {
    const cle = normalise(nomClient)
    if (!cle) return []
    return clients
      .filter((c) => normalise(`${c.nom} ${c.telephone}`).includes(cle))
      .slice(0, 5)
  }, [clients, nomClient])

  const cree = async () => {
    const nom = nomClient.trim()
    if (!nom && !clientChoisi) return

    let clientId = clientChoisi?.id
    if (!clientId) {
      clientId = uid()
      await db.clients.add({
        id: clientId, nom, telephone: telephone.trim(), adresse: adresse.trim(),
        note: '', creeLe: new Date().toISOString(),
      })
    } else {
      // La fiche existe : on complète ce qui y manquait, sans rien écraser.
      const manques: Partial<Client> = {}
      if (telephone.trim() && !clientChoisi?.telephone) manques.telephone = telephone.trim()
      if (adresse.trim() && !clientChoisi?.adresse) manques.adresse = adresse.trim()
      if (Object.keys(manques).length) await db.clients.update(clientId, manques)
    }

    const id = uid()
    await db.commandes.add({
      id, clientId, date: new Date().toISOString(), mode, dateRetrait: '',
      adresseLivraison: '', statut: 'a_commander', note: '', operateur, retireLe: '',
    })
    setOuvert(false)
    setNomClient('')
    setTelephone('')
    setAdresse('')
    setMode('retrait')
    setClientChoisi(null)
    navigate(`/commande/${id}`)
  }

  return (
    <div className="pile">
      {!ouvert && (
        <button type="button" className="principal haut large" onClick={() => setOuvert(true)}>
          <IconePlus /> Nouvelle commande
        </button>
      )}

      {ouvert && (
        <div className="carte pile">
          <h2>Qui appelle ?</h2>
          <div>
            <label htmlFor="cl-nom">Nom du client</label>
            <input id="cl-nom" autoFocus value={nomClient} autoComplete="off"
              placeholder="Nom, ou début du nom"
              onChange={(e) => { setNomClient(e.target.value); setClientChoisi(null) }} />
          </div>

          {!clientChoisi && suggestions.length > 0 && (
            <div className="liste">
              {suggestions.map((c) => (
                <button key={c.id} type="button" className="item"
                  onClick={() => {
                    setClientChoisi(c); setNomClient(c.nom)
                    setTelephone(c.telephone); setAdresse(c.adresse)
                  }}>
                  <div className="item-corps">
                    <div className="item-nom">{c.nom}</div>
                    <div className="petit doux mono">{c.telephone || 'sans numéro'}</div>
                  </div>
                  <span className="etiquette accent">Client connu</span>
                </button>
              ))}
            </div>
          )}

          <div>
            <label htmlFor="cl-tel">Téléphone</label>
            <input id="cl-tel" type="tel" inputMode="tel" className="mono" value={telephone}
              onChange={(e) => setTelephone(e.target.value)} />
          </div>

          <div>
            <label>Comment la récupère-t-il ?</label>
            <div className="onglets">
              <button type="button" className={mode === 'retrait' ? 'actif' : ''}
                onClick={() => setMode('retrait')} aria-pressed={mode === 'retrait'}>
                Il passe la prendre
              </button>
              <button type="button" className={mode === 'livraison' ? 'actif' : ''}
                onClick={() => setMode('livraison')} aria-pressed={mode === 'livraison'}>
                On le livre
              </button>
            </div>
          </div>

          {mode === 'livraison' && (
            <div>
              <label htmlFor="cl-adr">Adresse de livraison</label>
              <textarea id="cl-adr" value={adresse} placeholder="Rue, complément, village"
                onChange={(e) => setAdresse(e.target.value)} />
              <p className="petit doux" style={{ marginTop: 4 }}>
                Enregistrée sur sa fiche : elle sera reprise à la prochaine commande.
              </p>
            </div>
          )}

          {clientChoisi && (
            <p className="petit doux">
              Commande rattachée à la fiche existante de {clientChoisi.nom}.
            </p>
          )}

          <div className="ligne">
            <button type="button" className="champ" onClick={() => {
              setOuvert(false); setNomClient(''); setTelephone('')
              setAdresse(''); setMode('retrait'); setClientChoisi(null)
            }}>
              Annuler
            </button>
            <button type="button" className="champ principal" onClick={cree}
              disabled={!nomClient.trim() && !clientChoisi}>
              <IconeValide /> Créer
            </button>
          </div>
        </div>
      )}

      <div className="onglets">
        <button type="button" className={filtre === 'encours' ? 'actif' : ''}
          onClick={() => setFiltre('encours')}>En cours</button>
        <button type="button" className={filtre === 'terminees' ? 'actif' : ''}
          onClick={() => setFiltre('terminees')}>Terminées</button>
        <button type="button" className={filtre === 'toutes' ? 'actif' : ''}
          onClick={() => setFiltre('toutes')}>Toutes</button>
      </div>

      {commandes.length > 3 && (
        <div className="carte ligne">
          <IconeRecherche className="doux" />
          <input className="champ" placeholder="Nom du client, téléphone…" value={q}
            onChange={(e) => setQ(e.target.value)} autoComplete="off" />
        </div>
      )}

      <div className="carte">
        {affichees.length === 0 ? (
          <div className="vide">
            <IconeRegistre />
            <p>
              {filtre === 'encours'
                ? 'Aucune commande en cours.'
                : 'Aucune commande ici.'}
            </p>
          </div>
        ) : (
          <div className="liste">
            {affichees.map((c) => {
              const siennes = lignes.filter((l) => l.commandeId === c.id)
              const cl = client(c.clientId)
              return (
                <Link key={c.id} to={`/commande/${c.id}`} className="item">
                  <div className="item-corps">
                    <div className="item-nom">{cl?.nom ?? 'Client supprimé'}</div>
                    <div className="petit doux">
                      {c.mode === 'livraison' && <span className="etiquette accent">Livraison</span>}
                      {c.mode === 'livraison' && ' '}
                      {siennes.length} article{siennes.length > 1 ? 's' : ''}
                      {c.dateRetrait && ` · ${motRemise(c.mode).verbe.toLowerCase()} le ${dateFr(c.dateRetrait)}`}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="mono" style={{ fontWeight: 600 }}>
                      {siennes.length ? euro(totalLignes(siennes)) : '—'}
                    </div>
                    <span className={`etiquette ${tonStatut(c.statut)}`}>{nomStatut(c.statut, c.mode)}</span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {clients.length > 0 && (
        <p className="petit doux" style={{ textAlign: 'center' }}>
          {nombre(clients.length)} client{clients.length > 1 ? 's' : ''} enregistré{clients.length > 1 ? 's' : ''}
        </p>
      )}
    </div>
  )
}
