import { useEffect, useState } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Accueil from './pages/Accueil'
import Scan from './pages/Scan'
import Catalogue from './pages/Catalogue'
import ProduitDetail from './pages/ProduitDetail'
import Controles from './pages/Controles'
import Temperatures from './pages/Temperatures'
import Receptions from './pages/Receptions'
import Dlc from './pages/Dlc'
import Nettoyage from './pages/Nettoyage'
import Registres from './pages/Registres'
import Reglages from './pages/Reglages'
import Verrou from './components/Verrou'
import { amorceSiVide } from './db/seed'
import { dejaOuvert } from './lib/verrou'
import { surveilleLeReseau } from './lib/enrichissement'

export default function App() {
  const [pret, setPret] = useState(false)
  const [ouvert, setOuvert] = useState(dejaOuvert)

  useEffect(() => { void amorceSiVide().finally(() => setPret(true)) }, [])

  // Complete les fiches scannees hors ligne des que le reseau revient.
  useEffect(() => (ouvert ? surveilleLeReseau() : undefined), [ouvert])

  if (!ouvert) return <Verrou surOuverture={() => setOuvert(true)} />
  if (!pret) return null

  // HashRouter : l'appli marche telle quelle sur GitHub Pages et en ouverture directe.
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Accueil />} />
          <Route path="scan" element={<Scan />} />
          <Route path="catalogue" element={<Catalogue />} />
          <Route path="produit/:id" element={<ProduitDetail />} />
          <Route path="controles" element={<Controles />} />
          <Route path="temperatures" element={<Temperatures />} />
          <Route path="receptions" element={<Receptions />} />
          <Route path="dlc" element={<Dlc />} />
          <Route path="nettoyage" element={<Nettoyage />} />
          <Route path="registres" element={<Registres />} />
          <Route path="reglages" element={<Reglages />} />
          <Route path="*" element={<Accueil />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
