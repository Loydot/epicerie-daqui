/** Pictogrammes maison : trait de 1.8, aucun paquet externe a charger. */
type Props = { className?: string }

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export const IconeScan = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M3 8V5.5A2.5 2.5 0 0 1 5.5 3H8M16 3h2.5A2.5 2.5 0 0 1 21 5.5V8M21 16v2.5a2.5 2.5 0 0 1-2.5 2.5H16M8 21H5.5A2.5 2.5 0 0 1 3 18.5V16" />
    <path d="M7 8v8M10.5 8v8M14 8v8M17 8v8" />
  </svg>
)

export const IconeCatalogue = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H19v14H6.5A2.5 2.5 0 0 0 4 20.5z" />
    <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H19v3H6.5" />
    <path d="M9 8h6" />
  </svg>
)

export const IconeEtiquette = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M3 12.4V5a2 2 0 0 1 2-2h7.4a2 2 0 0 1 1.42.59l6.6 6.6a2 2 0 0 1 0 2.82l-7.4 7.4a2 2 0 0 1-2.82 0l-6.6-6.6A2 2 0 0 1 3 12.4z" />
    <path d="M7.5 7.5h.01" />
  </svg>
)

export const IconeTemperature = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M10 13.8V5a2 2 0 1 1 4 0v8.8a4 4 0 1 1-4 0z" />
    <path d="M12 9v6.5" />
  </svg>
)

export const IconeCamion = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M2 7.5A1.5 1.5 0 0 1 3.5 6H14v10H2z" />
    <path d="M14 10h3.6a2 2 0 0 1 1.7.9L22 15v1h-8z" />
    <circle cx="6.5" cy="18" r="2" />
    <circle cx="17.5" cy="18" r="2" />
  </svg>
)

export const IconeCalendrier = (p: Props) => (
  <svg {...base} {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2.5" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </svg>
)

export const IconeBalai = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M15.5 3.5 9 10" />
    <path d="m7.5 8.5 3 3-4.2 4.2a3 3 0 0 1-2.6.8l-1.4-.3.3-1.4a3 3 0 0 1 .8-2.6z" />
    <path d="m13 6.5 4.5 4.5" />
    <path d="M17 14c2 0 3.5 1.6 3.5 3.5S19 21 17 21h-4l2-3z" />
  </svg>
)

export const IconeReglages = (p: Props) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.1a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 7.1 19l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.3 7.1l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 2.9-1.2V3a2 2 0 1 1 4 0v.1A1.7 1.7 0 0 0 16.9 4.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
)

export const IconeRegistre = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5M9 13h6M9 17h4" />
  </svg>
)

export const IconeAccueil = (p: Props) => (
  <svg {...base} {...p}>
    <path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <path d="M9 21v-7h6v7" />
  </svg>
)

export const IconePlus = (p: Props) => (
  <svg {...base} {...p} strokeWidth={2.2}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)

export const IconeRetour = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M15 5 8 12l7 7" />
  </svg>
)

export const IconeRecherche = (p: Props) => (
  <svg {...base} {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
)

export const IconeAlerte = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M10.3 3.9 2.5 17.4A2 2 0 0 0 4.2 20.4h15.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    <path d="M12 9v4.5M12 17h.01" />
  </svg>
)

export const IconeValide = (p: Props) => (
  <svg {...base} {...p} strokeWidth={2.2}>
    <path d="m4.5 12.5 5 5 10-11" />
  </svg>
)

export const IconeTorche = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M9 2h6v4l-1.5 2v13a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1V8L9 6z" />
    <path d="M9 6h6" />
  </svg>
)

export const IconeClavier = (p: Props) => (
  <svg {...base} {...p}>
    <rect x="2" y="6" width="20" height="12" rx="2.5" />
    <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" />
  </svg>
)

export const IconeExport = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M12 15V3m0 0L8 7m4-4 4 4" />
    <path d="M4 15v3.5A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V15" />
  </svg>
)

export const IconeCorbeille = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    <path d="M6 7v12.5A1.5 1.5 0 0 0 7.5 21h9a1.5 1.5 0 0 0 1.5-1.5V7" />
    <path d="M10 11v6M14 11v6" />
  </svg>
)

export const IconeBoite = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M21 8.5v7a2 2 0 0 1-1 1.7l-7 4a2 2 0 0 1-2 0l-7-4a2 2 0 0 1-1-1.7v-7a2 2 0 0 1 1-1.7l7-4a2 2 0 0 1 2 0l7 4a2 2 0 0 1 1 1.7z" />
    <path d="m3.3 7.5 8.7 5 8.7-5M12 12.5V21" />
  </svg>
)
