import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowRight, ShieldCheck, WalletCards } from 'lucide-react'
import { games } from '../data/games'
import { useWinveroStore } from '../store/useWinveroStore'
import { categoryLabel } from '../lib/format'
import { OverviewUnavailable } from '../components/OverviewUnavailable'
import { gameInfo } from '../data/gameInfo'
import { GameDetails, SimilarGames } from '../games/GameDetails'
import { DiceGame } from '../games/Dice'
import { CrashGame } from '../games/Crash'
import { CoinFlipGame } from '../games/CoinFlip'
import { LimboGame } from '../games/Limbo'
import { MinesGame } from '../games/Mines'
import { HiLoGame } from '../games/HiLo'
import { KenoGame } from '../games/Keno'
import { JackpotGame } from '../games/Jackpot'
import { PlinkoGame } from '../games/Plinko'
import { BlackjackGame } from '../games/Blackjack'
import { RouletteGame } from '../games/Roulette'
import { BigWheelGame, SicBoGame } from '../games/Chance'
import { PenaltyGame, ScratchGame, TowerGame } from '../games/Progress'
import { BaccaratGame, ThreeCardPokerGame, VideoPokerGame, WarGame } from '../games/CardTables'

export function GameRoom(){
 const {gameId}=useParams();
 const game=games.find((item)=>item.id===gameId);
 const unlocked=useWinveroStore((s)=>s.accessUnlocked);
 const balance=useWinveroStore((s)=>s.balance);
 const ready=useWinveroStore((s)=>s.overviewStatus)==='ready';
 if(!game)return <Navigate to="/app/games" replace/>;
 const renderGame=()=>{
  switch(game.id){
   case 'crash':return <CrashGame game={game}/>;
   case 'dice':return <DiceGame game={game}/>;
   case 'mines':return <MinesGame game={game}/>;
   case 'coinflip':return <CoinFlipGame game={game}/>;
   case 'roulette':return <RouletteGame game={game}/>;
   case 'jackpot':return <JackpotGame game={game}/>;
   case 'plinko':return <PlinkoGame game={game}/>;
   case 'limbo':return <LimboGame game={game}/>;
   case 'hilo':return <HiLoGame game={game}/>;
   case 'keno':return <KenoGame game={game}/>;
   case 'blackjack':return <BlackjackGame game={game}/>;
   case 'baccarat':return <BaccaratGame game={game}/>;
   case 'war':return <WarGame game={game}/>;
   case 'videopoker':return <VideoPokerGame game={game}/>;
   case 'threecardpoker':return <ThreeCardPokerGame game={game}/>;
   case 'bigwheel':return <BigWheelGame game={game}/>;
   case 'sicbo':return <SicBoGame game={game}/>;
   case 'tower':return <TowerGame game={game}/>;
   case 'penalty':return <PenaltyGame game={game}/>;
   case 'scratch':return <ScratchGame game={game}/>;
   default:return null;
  }
 };

 return (
  <>
   <nav aria-label="Fil d’Ariane"><ol className="crumbs">
    <li><Link to="/app/games">Catalogue</Link></li>
    <li><Link to="/app/games">{categoryLabel[game.category]}</Link></li>
    <li aria-current="page">{game.name}</li>
   </ol></nav>
   <header className="room-bar" style={{'--accent':game.accent} as React.CSSProperties}>
    <h1><span className="room-icon"><game.icon size={24}/></span>{game.name}</h1>
    <div className="room-chips"><span>Retour <b>{gameInfo[game.id].rtp.toLocaleString('fr-FR')} %</b></span><span>Gain max <b>{game.maxMultiplier}</b></span><span>Équité <b>vérifiable</b></span></div>
   </header>
   {!ready?<OverviewUnavailable/>:unlocked?(
    <>
     {balance===0&&<p className="form-hint" role="status">Votre solde est de 0,00 WVC : vous ne pouvez plus miser.</p>}
     {renderGame()}
     <GameDetails game={game}/>
     <SimilarGames game={game}/>
    </>
   ):(
    <section className="panel locked-game" style={{'--accent':game.accent} as React.CSSProperties}>
     <WalletCards size={28}/>
     <span className="page-kicker">{categoryLabel[game.category].toUpperCase()}</span>
     <h2>{game.description}</h2>
     <div className="notice">
      <div><ShieldCheck size={22}/><span><strong>Jeu verrouillé</strong><small>Validez le code en 12 mots pour recevoir 1 250 WVC et jouer.</small></span></div>
      <Link to="/app/wallet">Débloquer mes crédits <ArrowRight size={16}/></Link>
     </div>
    </section>
   )}
  </>
 );
}
