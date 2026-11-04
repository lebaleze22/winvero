import type { ActivityEntry } from '../store/useWinveroStore'

export interface Step{id:string;title:string;text:string;reward:string;done:boolean;current:number;target:number;to?:string;cta?:string}

/** Parcours calculé uniquement à partir de l'état réel du compte (accès validé + historique serveur). */
export function buildJourney(accessUnlocked:boolean,activity:ActivityEntry[]):Step[]{
 const games=activity.filter((item)=>item.type==='game')
 const rooms=new Set(games.map((item)=>item.label)).size
 return [
  {id:'account',title:'Créer votre compte',text:'Votre espace Winvero est prêt.',reward:'Aucun crédit',done:true,current:1,target:1},
  {id:'code',title:'Valider le code en 12 mots',text:'Seule étape qui crédite des WVC, une seule fois par compte.',reward:'+1 250 WVC',done:accessUnlocked,current:accessUnlocked?1:0,target:1,to:'/app/wallet',cta:'Saisir le code'},
  {id:'first',title:'Jouer une première partie',text:'Lancez n’importe quelle salle avec vos crédits fictifs.',reward:'Sans crédit',done:games.length>=1,current:Math.min(games.length,1),target:1,to:'/app/games',cta:'Choisir un jeu'},
  {id:'rooms',title:'Essayer 3 jeux différents',text:'Découvrez plusieurs salles pour comparer les mécaniques.',reward:'Sans crédit',done:rooms>=3,current:Math.min(rooms,3),target:3,to:'/app/games',cta:'Explorer les jeux'},
  {id:'ten',title:'Jouer 10 parties',text:'Votre historique se remplit à chaque manche réglée.',reward:'Sans crédit',done:games.length>=10,current:Math.min(games.length,10),target:10,to:'/app/games',cta:'Continuer'},
 ]
}
