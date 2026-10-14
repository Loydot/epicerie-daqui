import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, setReglage, uid } from '../db/db'
import { aujourdhui, dateFr, euro, normalise } from '../lib/format'
import {
  CHAMPS_ENTREPRISE, cleEntreprise, ENTREPRISE_DEFAUT, litEntreprise, litLignes, prochainNumero,
  totaux, type Entreprise,
} from '../lib/factures'
import { IconePlus, IconeRecherche, IconeRegistre } from '../components/Icones'

export default function Factures() {
  const [params, setParams] = useSearchParams()
  const vue = params.get('vue') === 'entreprise' ? 'entreprise' : 'factures'

  return (
    <div className="pile">
      <div className="onglets">
        <button type="button" className={vue === 'factures' ? 'actif' : ''}
          onClick={() => setParams({}, { replace: true })}>Factures</button>
        <button type="button" className={vue === 'entreprise' ? 'actif' : ''}
          onClick={() => setParams({ vue: 'entreprise' }, { replace: true })}>Entreprise</button>
      </div>
      {vue === 'factures' ? <ListeFactures /> : <ConfigEntreprise />}
    </div>
  )
}

function ListeFactures() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const factures = useLiveQuery(() => db.factures.toArray(), [], []) ?? []
  const entreprise = useLiveQuery(litEntreprise, [], ENTREPRISE_DEFAUT) ?? ENTREPRISE_DEFAUT
  const franchise = entreprise.franchiseTva === '1'

  const affichees = useMemo(() => {
    const cle = normalise(q)
    return factures
      .filter((f) => !cle || normalise(`${f.numero} ${f.clientNom} ${f.clientVille}`).includes(cle))
      .sort((a, b) => b.numero.localeCompare(a.numero))
  }, [factures, q])

  const cree = async () => {
    const date = aujourdhui()
    const id = uid()
    await db.factures.add({
      id, numero: await prochainNumero(date.slice(0, 4)), date, dateVente: '', echeance: '',
      clientNom: '', clientAdresse: '', clientCodePostal: '', clientVille: '',
      clientTelephone: '', clientEmail: '', clientSiret: '', clientTva: '',
      lignes: '[]', modePaiement: '', acquittee: 0, note: '', creeLe: new Date().toISOString(),
    })
    navigate(`/facture/${id}`)
  }

  return (
    <>
      <button type="button" className="principal haut large" onClick={cree}>
        <IconePlus /> Nouvelle facture
      </button>

      {!entreprise.siret && (
        <p className="petit doux">
          Le SIRET de l'entreprise n'est pas encore renseigné : il est obligatoire sur une facture.
          Complétez l'onglet Entreprise.
        </p>
      )}

      {factures.length > 3 && (
        <div className="carte ligne">
          <IconeRecherche className="doux" />
          <input className="champ" placeholder="Numéro, client, ville…" value={q}
            onChange={(e) => setQ(e.target.value)} autoComplete="off" />
        </div>
      )}

      <div className="carte">
        {affichees.length === 0 ? (
          <div className="vide">
            <IconeRegistre />
            <p>Aucune facture pour l'instant.</p>
          </div>
        ) : (
          <div className="liste">
            {affichees.map((f) => (
              <Link key={f.id} to={`/facture/${f.id}`} className="item">
                <div className="item-corps">
                  <div className="item-nom">{f.clientNom || 'Client à renseigner'}</div>
                  <div className="petit doux mono">N° {f.numero} · {dateFr(f.date)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="mono" style={{ fontWeight: 600 }}>
                    {euro(totaux(litLignes(f), franchise).ttc)}
                  </div>
                  <span className={`etiquette ${f.acquittee ? 'ok' : 'alerte'}`}>
                    {f.acquittee ? 'Payée' : 'À payer'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

const LIBELLES: Record<keyof Entreprise, { titre: string; aide?: string; long?: boolean }> = {
  raisonSociale: { titre: 'Nom ou raison sociale' },
  formeJuridique: { titre: 'Forme juridique', aide: 'EI, EURL, SARL, SAS…' },
  capital: { titre: 'Capital social', aide: 'Pour une société, ex. 1 000 €' },
  adresse: { titre: 'Adresse' },
  codePostal: { titre: 'Code postal' },
  ville: { titre: 'Ville' },
  telephone: { titre: 'Téléphone' },
  email: { titre: 'E-mail' },
  siret: { titre: 'SIRET', aide: '14 chiffres' },
  rcs: { titre: 'RCS', aide: 'Pour une société, ex. RCS Perpignan 123 456 789' },
  tvaIntra: { titre: 'N° de TVA intracommunautaire', aide: 'Ex. FR12345678901' },
  franchiseTva: { titre: '' },
  iban: { titre: 'IBAN', aide: 'Pour les paiements par virement' },
  bic: { titre: 'BIC' },
  conditionsPaiement: { titre: 'Conditions de paiement', long: true },
  mentions: { titre: 'Mentions en bas de facture', aide: 'Pénalités de retard, indemnité de 40 €…', long: true },
}

function ConfigEntreprise() {
  const entreprise = useLiveQuery(litEntreprise, [], ENTREPRISE_DEFAUT) ?? ENTREPRISE_DEFAUT
  const ecrit = (champ: keyof Entreprise, valeur: string) => void setReglage(cleEntreprise(champ), valeur)
  const champs = CHAMPS_ENTREPRISE.filter((c) => c !== 'franchiseTva')

  return (
    <div className="carte pile">
      <h2>Informations de l'entreprise</h2>
      <p className="petit doux">
        Elles figurent sur chaque facture. Elles sont enregistrées automatiquement et partagées
        entre la tablette et le PC.
      </p>

      {champs.map((champ) => {
        const { titre, aide, long } = LIBELLES[champ]
        const id = `ent-${champ}`
        return (
          <div key={champ}>
            <label htmlFor={id}>{titre}</label>
            {long ? (
              <textarea id={id} value={entreprise[champ]} placeholder={aide}
                onChange={(e) => ecrit(champ, e.target.value)} />
            ) : (
              <input id={id} value={entreprise[champ]} placeholder={aide}
                className={['siret', 'tvaIntra', 'iban', 'bic', 'telephone', 'codePostal'].includes(champ) ? 'mono' : ''}
                onChange={(e) => ecrit(champ, e.target.value)} />
            )}
          </div>
        )
      })}

      <label className="ligne" style={{ alignItems: 'flex-start', gap: 10 }}>
        <input type="checkbox" style={{ width: 'auto', marginTop: 3 }}
          checked={entreprise.franchiseTva === '1'}
          onChange={(e) => ecrit('franchiseTva', e.target.checked ? '1' : '')} />
        <span>
          Franchise en base de TVA (micro-entreprise)
          <span className="petit doux" style={{ display: 'block' }}>
            Aucune TVA n'est facturée ; la mention « TVA non applicable, art. 293 B du CGI » est ajoutée.
          </span>
        </span>
      </label>
    </div>
  )
}
