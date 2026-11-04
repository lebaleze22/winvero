import { Gamepad2, History, TrendingUp } from 'lucide-react'
import { useWinveroStore } from '../store/useWinveroStore'
import { dateTime, money } from '../lib/format'

export function ActivityList({entries}:{entries:ReturnType<typeof useWinveroStore.getState>['activity']}){
 if(!entries.length)return <div className="empty-list"><History size={28}/><strong>Aucune activité</strong><p>Vos crédits et vos parties apparaîtront ici.</p></div>;
 return <div className="activity-list">{entries.map((entry)=><div key={entry.id}><span className={`activity-icon ${entry.type}`}>{entry.type==='deposit'?<TrendingUp size={17}/>:<Gamepad2 size={17}/>}</span><div><strong>{entry.label}</strong><small>{entry.detail} · {dateTime(entry.createdAt)}</small></div><b className={entry.amount>=0?'positive':'negative'}>{entry.amount>=0?'+':''}{money(entry.amount)}</b></div>)}</div>;
}
