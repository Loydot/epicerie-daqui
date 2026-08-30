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
import Commandes from './pages/Commandes'
import CommandeDetail from './pages/CommandeDetail'
import Reglages from './pages/Reglages'
import Connexion from './components/Connexion'
import { amorceSiVide } from './db/seed'
import { supabase } from './lib/supabase'
import { surveilleLeReseau } from './lib/enrichissement'
import { demarreLaSynchronisation } from './lib/sync'

export default function App() {
  const [pret, setPret] = useState(false)
  const [connecte, setConnecte] = useState<boolean | null>(null)

  useEffect(() => { void amorceSiVide().finally(() => setPret(true)) }, [])

  // La session est conservée sur l'appareil : au lancement suivant on entre
  // directement, y compris sans réseau.
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setConnecte(Boolean(data.session)))
    const { data: abonnement } = supabase.auth.onAuthStateChange((_evenement, session) => {
      setConnecte(Boolean(session))
    })
    return () => abonnement.subscription.unsubscribe()
  }, [])

  // Complète les fiches scannées hors ligne dès que le réseau revient.
  useEffect(() => (connecte ? surveilleLeReseau() : undefined), [connecte])

  // Échange permanent avec le serveur tant qu'on est connecté.
  useEffect(() => (connecte ? demarreLaSynchronisation() : undefined), [connecte])

  if (connecte === null) return null
  if (!connecte) return <Connexion surConnexion={() => setConnecte(true)} />
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
          <Route path="commandes" element={<Commandes />} />
          <Route path="commande/:id" element={<CommandeDetail />} />
          <Route path="reglages" element={<Reglages />} />
          <Route path="*" element={<Accueil />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
