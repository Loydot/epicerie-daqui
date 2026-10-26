import { test } from 'node:test'
import assert from 'node:assert/strict'
import { versServeur } from '../src/lib/sync-payload.ts'

test('envoi groupé des équipements anciens et configurés sans champs calendrier NULL', () => {
  const lignes = [
    { id: 'ancien', aSynchroniser: 1 },
    { id: 'configure', joursOuverture: '2,5', exceptions: '-2026-10-10' },
    { id: 'null', joursOuverture: null, exceptions: null },
    { id: 'undefined', joursOuverture: undefined, exceptions: undefined },
    { id: 'quotidien', joursOuverture: '', exceptions: '' },
  ]
  const avant = structuredClone(lignes)
  const payload = JSON.parse(JSON.stringify(lignes.map(l => versServeur('equipements', l))))
  assert.deepEqual(payload, [
    { id: 'ancien', jours_ouverture: '', exceptions: '' },
    { id: 'configure', jours_ouverture: '2,5', exceptions: '-2026-10-10' },
    { id: 'null', jours_ouverture: '', exceptions: '' },
    { id: 'undefined', jours_ouverture: '', exceptions: '' },
    { id: 'quotidien', jours_ouverture: '', exceptions: '' },
  ])
  assert.deepEqual(lignes, avant)
})

test('les relevés conservent leur date sans recevoir de calendrier équipement', () => {
  assert.deepEqual(versServeur('releves', {
    equipementId: 'frigo', jour: '2026-10-10', temp: 3, aSynchroniser: 1,
  }), { equipement_id: 'frigo', jour: '2026-10-10', temp: 3 })
})

test('envoi des factures créées avant les devis sans type NULL', () => {
  const payload = [{ id: 'ancienne', numero: '2026-0001' }, { id: 'devis', type: 'devis', lien: 'f1' }]
    .map(l => versServeur('factures', l))
  assert.deepEqual(payload, [
    { id: 'ancienne', numero: '2026-0001', type: 'facture', lien: '' },
    { id: 'devis', type: 'devis', lien: 'f1' },
  ])
})
