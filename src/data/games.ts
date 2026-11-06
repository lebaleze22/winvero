import type { LucideIcon } from 'lucide-react'
import { CircleDot, Coins, Dices, Flame, Gem, Grid3X3, Layers3, Medal, MousePointer2, Orbit, Pickaxe, Rocket, RotateCw, Shield, Spade, Sparkles, Target, Ticket, TrendingUp, Trophy } from 'lucide-react'

export type GameId = 'crash' | 'coinflip' | 'dice' | 'roulette' | 'mines' | 'jackpot' | 'plinko' | 'limbo' | 'hilo' | 'keno' | 'blackjack' | 'baccarat' | 'war' | 'bigwheel' | 'scratch' | 'videopoker' | 'sicbo' | 'tower' | 'penalty' | 'threecardpoker'

export interface GameDefinition {
  id: GameId
  name: string
  category: 'Originals' | 'Table' | 'Arcade'
  description: string
  accent: string
  maxMultiplier: string
  icon: LucideIcon
}

export const games: GameDefinition[] = [
  { id:'crash', name:'Crash', category:'Originals', description:'Encaissez avant que la fusée ne s’arrête.', accent:'#aa72ff', maxMultiplier:'1 000×', icon:Rocket },
  { id:'coinflip', name:'Pile ou face', category:'Originals', description:'Choisissez un côté de la pièce.', accent:'#f7bd51', maxMultiplier:'1,98×', icon:Coins },
  { id:'dice', name:'Dice', category:'Originals', description:'Réglez votre chance et lancez les dés.', accent:'#67d8ff', maxMultiplier:'19,8×', icon:Dices },
  { id:'roulette', name:'Roulette', category:'Table', description:'Misez sur la roue européenne à un zéro.', accent:'#fa6c82', maxMultiplier:'36×', icon:RotateCw },
  { id:'mines', name:'Mines', category:'Originals', description:'Révélez les cases sûres et encaissez.', accent:'#60dec7', maxMultiplier:'variable', icon:Pickaxe },
  { id:'jackpot', name:'Jackpot', category:'Arcade', description:'Alignez les symboles et tentez le triple.', accent:'#ffd16a', maxMultiplier:'8×', icon:Trophy },
  { id:'plinko', name:'Plinko', category:'Arcade', description:'Laissez tomber la bille et choisissez le risque.', accent:'#f48ecb', maxMultiplier:'19,55×', icon:CircleDot },
  { id:'limbo', name:'Limbo', category:'Originals', description:'Fixez une cible et visez le bon multiplicateur.', accent:'#7cdcff', maxMultiplier:'50×', icon:TrendingUp },
  { id:'hilo', name:'Hi-Lo', category:'Originals', description:'Devinez si la prochaine carte sera plus haute ou plus basse.', accent:'#86d981', maxMultiplier:'variable', icon:Layers3 },
  { id:'keno', name:'Keno', category:'Arcade', description:'Sélectionnez vos numéros et découvrez le tirage.', accent:'#b692ff', maxMultiplier:'100×', icon:Grid3X3 },
  { id:'blackjack', name:'Blackjack', category:'Table', description:'Approchez 21 sans dépasser la banque.', accent:'#81d8a0', maxMultiplier:'2,5×', icon:Spade },
  { id:'baccarat', name:'Baccarat', category:'Table', description:'Misez sur le joueur, la banque ou l’égalité.', accent:'#e6b96d', maxMultiplier:'9×', icon:Gem },
  { id:'war', name:'Casino War', category:'Table', description:'Comparez votre carte à celle du croupier.', accent:'#fa8995', maxMultiplier:'3×', icon:Shield },
  { id:'bigwheel', name:'Big Wheel', category:'Arcade', description:'Choisissez un segment et lancez la roue.', accent:'#f3af70', maxMultiplier:'40×', icon:Orbit },
  { id:'scratch', name:'Scratch', category:'Arcade', description:'Grattez votre ticket pour révéler son gain.', accent:'#d38bff', maxMultiplier:'50×', icon:Ticket },
  { id:'videopoker', name:'Video Poker', category:'Table', description:'Gardez vos cartes et formez la meilleure main.', accent:'#83cff4', maxMultiplier:'800×', icon:Medal },
  { id:'sicbo', name:'Sic Bo', category:'Table', description:'Pariez sur le résultat de trois dés.', accent:'#ff9d76', maxMultiplier:'181×', icon:MousePointer2 },
  { id:'tower', name:'Tower', category:'Originals', description:'Montez les étages et encaissez avant de tomber.', accent:'#8ddcb0', maxMultiplier:'variable', icon:Flame },
  { id:'penalty', name:'Penalty', category:'Arcade', description:'Choisissez la zone de tir et défiez le gardien.', accent:'#89c9ff', maxMultiplier:'variable', icon:Target },
  { id:'threecardpoker', name:'Three Card Poker', category:'Table', description:'Formez une main de trois cartes contre la banque.', accent:'#f7a8c8', maxMultiplier:'variable', icon:Sparkles },
]
