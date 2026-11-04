import { Link } from 'react-router-dom'
import { ArrowRight, Check, Info } from 'lucide-react'
import { useWinveroStore } from '../store/useWinveroStore'
import { buildJourney } from '../lib/journey'
import { OverviewUnavailable } from '../components/OverviewUnavailable'

export function BonusPage(){
 const ready=useWinveroStore((s)=>s.overviewStatus)==='ready'
 const unlocked=useWinveroStore((s)=>s.accessUnlocked)
 const activity=useWinveroStore((s)=>s.activity)
 const steps=buildJourney(unlocked,activity)
 const done=steps.filter((step)=>step.done).length
 const next=steps.find((step)=>!step.done)

 return (
  <>
   <div className="page-heading">
    <div><span className="page-kicker">PARCOURS</span><h1>Votre progression.</h1><p>Chaque étape est calculée à partir de votre compte réel. Seule la validation du code crédite des WVC.</p></div>
    {ready&&<div className="page-balance"><small>ÉTAPES VALIDÉES</small><strong>{done} / {steps.length}</strong></div>}
   </div>
   {!ready?<OverviewUnavailable/>:(
    <>
     <div className="journey-bar" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={done} aria-label="Progression du parcours"><span style={{width:`${(done/steps.length)*100}%`}}/></div>
     <ol className="journey-list">
      {steps.map((step,index)=>(
       <li key={step.id} className={step.done?'journey-step done':step===next?'journey-step current':'journey-step'}>
        <span className="journey-mark" aria-hidden="true">{step.done?<Check size={18}/>:index+1}</span>
        <div className="journey-body">
         <h2>{step.title}</h2>
         <p>{step.text}</p>
         {step.target>1&&<small>{step.current} / {step.target}</small>}
        </div>
        <div className="journey-side">
         <b>{step.reward}</b>
         {step.done?<span className="journey-state">Validé</span>:step===next&&step.to?<Link className="button" to={step.to}>{step.cta} <ArrowRight size={16}/></Link>:<span className="journey-state muted">À venir</span>}
        </div>
       </li>
      ))}
     </ol>
     <p className="journey-note"><Info size={16}/> Les crédits Winvero sont fictifs et n’ont aucune valeur réelle. Aucune autre promotion n’est active pour le moment.</p>
    </>
   )}
  </>
 )
}
