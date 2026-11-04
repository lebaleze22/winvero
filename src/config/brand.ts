export const brandConfig = {
  name: 'Winvero',
  market: 'France',
  minimumAge: 18,
  campaign: {
    slogan: 'Plus de rythme. Plus de sensations. Plus Winvero.',
    eyebrow: 'L’EXPÉRIENCE DE JEU NOUVELLE GÉNÉRATION',
    primaryCta: 'Entrer dans le jeu',
    secondaryCta: 'Découvrir Winvero',
  },
  responsibleGaming: {
    short: '18+ · Jouer comporte des risques : endettement, isolement, dépendance.',
    help: 'Pour être aidé, appelez le 09 74 75 13 13 (appel non surtaxé).',
    url: 'https://www.joueurs-info-service.fr',
  },
  release: {
    moneyTransactionsEnabled: false,
    walletConnectionEnabled: true,
  },
} as const
