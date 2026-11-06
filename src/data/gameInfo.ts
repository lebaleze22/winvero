import type { GameId } from './games'

export const MIN_STAKE = 1
export const MAX_STAKE = 1000

interface GameInfo {
  rtp: number
  theme: 'felt' | 'space' | 'void' | 'arcade'
  rules: string[]
  payouts: [string, string][]
}

const info = (rtp:number, theme:GameInfo['theme'], rule:string, payouts:[string,string][]):GameInfo => ({
  rtp, theme, rules:[rule, 'Choisissez une mise entre 1 et 1 000 WVC, puis lancez la partie.', 'Le résultat et le solde sont calculés par le serveur.'], payouts,
})

export const gameInfo: Record<GameId, GameInfo> = {
  crash:info(99,'space','Encaissez avant le crash pour conserver le multiplicateur affiché.',[['Encaissement','Mise × multiplicateur'],['Crash avant encaissement','0 WVC']]),
  coinflip:info(99,'arcade','Choisissez pile ou face avant le lancer.',[['Bon côté','1,98×'],['Autre côté','0×']]),
  dice:info(99,'arcade','Réglez la probabilité de gagner entre 5 % et 95 %.',[['Résultat gagnant','Multiplicateur selon la probabilité'],['Résultat perdant','0×']]),
  roulette:info(97.297,'felt','Choisissez un pari sur une roue européenne à 37 cases.',[['Numéro plein','36×'],['Couleur, pair ou impair','2×'],['Douzaine ou colonne','3×']]),
  mines:info(99,'void','Ouvrez les cases sans toucher une mine, puis encaissez.',[['Encaissement','Multiplicateur selon les cases ouvertes'],['Mine','0×']]),
  jackpot:info(92,'arcade','Lancez les symboles et recherchez une paire ou un triple.',[['Paire','1,25×'],['Triple','8×']]),
  plinko:info(97,'arcade','Choisissez le niveau de risque et suivez la bille.',[['Case atteinte','0,13× à 19,55× selon le risque']]),
  limbo:info(99,'space','Choisissez un multiplicateur cible entre 1,1× et 50×.',[['Cible atteinte','Multiplicateur choisi'],['Cible manquée','0×']]),
  hilo:info(99,'felt','Devinez la valeur de la prochaine carte puis continuez ou encaissez.',[['Encaissement','Multiplicateur accumulé'],['Mauvais choix','0×']]),
  keno:info(98.052,'arcade','Sélectionnez des numéros avant le tirage.',[['Selon les correspondances','0×, 2×, 5×, 10× ou 100×']]),
  blackjack:info(99.4,'felt','Atteignez 21 ou battez la main du croupier sans dépasser 21.',[['Blackjack','3:2 de gain'],['Victoire ordinaire','1:1 de gain'],['Assurance','2:1 de gain']]),
  baccarat:info(98.94,'felt','Misez sur le joueur, la banque ou l’égalité.',[['Joueur','2×'],['Banque','1,95×'],['Égalité','9×']]),
  war:info(97,'felt','Comparez votre carte à celle du croupier ; une égalité ouvre la guerre.',[['Victoire','2×'],['Victoire après guerre','3×'],['Abandon','0,5×']]),
  bigwheel:info(92.6,'arcade','Choisissez un segment et lancez la roue.',[['Segment gagnant','1×, 3×, 5×, 10×, 20× ou 40×']]),
  scratch:info(97.8,'arcade','Révélez votre ticket et découvrez son résultat.',[['Ticket gagnant','1× à 50× selon le symbole']]),
  videopoker:info(99.54,'felt','Gardez les cartes voulues puis échangez les autres.',[['Paire de valets ou mieux','1× ou plus'],['Quinte royale','800×']]),
  sicbo:info(97.22,'felt','Pariez sur le résultat de trois dés.',[['Petit ou grand','2×'],['Triple spécifique','181×']]),
  tower:info(99,'void','Choisissez une case sûre à chaque étage et encaissez à temps.',[['Encaissement','Multiplicateur selon les étages franchis'],['Erreur','0×']]),
  penalty:info(99,'arcade','Choisissez une zone de tir et tentez de marquer.',[['Série réussie','Multiplicateur selon les tirs marqués']]),
  threecardpoker:info(96.63,'felt','Formez la meilleure main de trois cartes face au croupier.',[['Main gagnante','Selon la main et le bonus'],['Quinte flush','Bonus 5:1']]),
}
