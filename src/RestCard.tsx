import { useEffect, useState } from 'react'
import type { RestSettings } from './types'
import { restSettings, restStats, restDateKey, workSummary, punchMinutes } from './rest'

export type RestPart='all'|'payday'|'week'|'event'|'income'|'work'
export function RestCard({settings,onEdit}:{settings?:RestSettings;onEdit:(part:RestPart)=>void}){
 const value=restSettings(settings)
 const [now,setNow]=useState(()=>new Date())
 useEffect(()=>{const timer=window.setInterval(()=>setNow(new Date()),30000);return()=>window.clearInterval(timer)},[])
 const stats=restStats(value,now)
 const punch=value.punches?.[restDateKey(now)]
 const worked=punchMinutes(punch?.start,punch?.end)
 const dateMode=value.countdownMode==='event'
 const remaining=dateMode?stats.eventDays:stats.payDays
 return <article className="rest-card"><div className="rest-header"><h2>{value.title}</h2><small>倒计时 · 收入估算</small></div><div className="rest-tiles">
 <button type="button" onClick={()=>onEdit('payday')} aria-label="编辑日期倒计时"><span>{dateMode?value.eventName:'发薪'}</span><b>{remaining===null?'—':Math.abs(remaining)}</b><small>{remaining===null?'未设置':remaining===0?'今天':remaining<0?'天前':'天'}{!dateMode&&` · 每月${value.payday}号`}</small></button>
 <button type="button" onClick={()=>onEdit('week')} aria-label="编辑每周期待日"><span>周{['日','一','二','三','四','五','六'][value.weekday??5]}</span><b>{stats.friday}</b><small>{stats.friday===0?'今天':'天'}</small></button>
 <button type="button" onClick={()=>onEdit('work')} aria-label="编辑打卡与查看工时"><span>今日时长</span><b>{worked===null?'—':(worked/60).toFixed(2)}</b><small>{worked===null?'点击记录打卡':'小时 · 已打卡'}</small></button>
 <button type="button" onClick={()=>onEdit('income')} aria-label="编辑收入估算与工作时间"><span>今天已赚</span><b>{stats.earned.toFixed(2)}</b><small>¥ · 估算</small></button>
 </div></article>
}

export function RestEditor({settings,onSave,part='all'}:{part?:RestPart;settings?:RestSettings;onSave:(value:RestSettings)=>void}){
 const [draft,setDraft]=useState<RestSettings>(()=>restSettings(settings))
 const change=(key:keyof RestSettings,value:string|number)=>setDraft({...draft,[key]:value})
 const [scope,setScope]=useState<'today'|'default'>('today')
 const today=draft.todayWork?.date===restDateKey()?draft.todayWork:{date:restDateKey(),start:draft.workStart,end:draft.workEnd}
 const start=scope==='today'?today.start:draft.workStart,end=scope==='today'?today.end:draft.workEnd
 const changeTime=(key:'start'|'end',value:string)=>scope==='today'?setDraft({...draft,todayWork:{...today,[key]:value}}):change(key==='start'?'workStart':'workEnd',value)
 const [punchDate,setPunchDate]=useState(restDateKey())
 const punch=draft.punches?.[punchDate]||{}
 const setPunch=(key:'start'|'end',value:string)=>setDraft({...draft,punches:{...draft.punches,[punchDate]:{...punch,[key]:value||undefined}}})
 const summary=workSummary(draft)
 const all=part==='all',pay=all||part==='payday',week=all||part==='week',event=all||part==='event'||part==='payday',income=all||part==='income',work=all||part==='work'
 const valid=(!all||draft.title.trim())&&(!pay||(Number.isInteger(draft.payday)&&draft.payday>=1&&draft.payday<=31))&&(!event||draft.eventName.trim())&&(!income||(Number.isFinite(draft.dailyWage)&&draft.dailyWage>=0&&/^\d{2}:\d{2}$/.test(start)&&/^\d{2}:\d{2}$/.test(end)&&end>start&&draft.workEnd>draft.workStart))&&(!work||!punch.start||!punch.end||punchMinutes(punch.start,punch.end)!==null)
 return <>
 {all&&<label>卡片名称<input maxLength={20} value={draft.title} onChange={event=>change('title',event.target.value)}/></label>}
 {pay&&<><label>倒计时类型<select value={draft.countdownMode||'payday'} onChange={event=>change('countdownMode',event.target.value)}><option value="payday">每月发薪</option><option value="event">自定义日期</option></select></label><span>每月发薪日 · {draft.payday} 号</span><div className="cycle-day-grid payday-grid" role="group" aria-label="选择每月发薪日">{Array.from({length:31},(_,index)=>index+1).map(day=><button type="button" key={day} className={draft.payday===day?'active':''} aria-pressed={draft.payday===day} aria-label={`每月 ${day} 号`} onClick={()=>change('payday',day)}>{day}</button>)}</div><small>当月不足该日期时按月末计算，卡片显示设置的日期和倒计时。</small></>}
 {week&&<label>每周期待日<select value={draft.weekday??5} onChange={event=>change('weekday',+event.target.value)}>{['日','一','二','三','四','五','六'].map((name,index)=><option key={index} value={index}>周{name}</option>)}</select></label>}
 {event&&<><label>倒计时名称<input maxLength={12} value={draft.eventName} onChange={event=>change('eventName',event.target.value)}/></label><label>期待日期<input type="date" value={draft.eventDate} onChange={event=>change('eventDate',event.target.value)}/></label></>}
 {work&&<><label>打卡日期<input type="date" max={restDateKey()} value={punchDate} onChange={event=>{if(event.target.value)setPunchDate(event.target.value)}}/></label><div className="date-time-fields"><label>上班打卡<input type="time" value={punch.start||''} onChange={event=>setPunch('start',event.target.value)}/></label><label>下班打卡<input type="time" value={punch.end||''} onChange={event=>setPunch('end',event.target.value)}/></label></div><small>未打卡按默认 09:30–19:00 估算。已记录上班但未记录下班时，预计下班随上班顺延 9.5 小时。实际下班需晚于上班；时长未扣午休，不等于计薪工时。</small><b>本月已完成 {summary.days} 天 · 共 {(summary.totalMinutes/60).toFixed(2)} 小时</b><small>仅统计上下班均已记录的日期；单次打卡不会计入完成天数。</small>{summary.records.map(record=><button type="button" className="work-record" key={record.date} onClick={()=>setPunchDate(record.date)}>{record.date} · {record.start||'未上班'}–{record.end||'未下班'} · {record.minutes===null?'待补全':(record.minutes/60).toFixed(2)+'h'}</button>)}</>}
 {income&&<><label>每日收入估算（元）<input type="number" min="0" step="0.01" inputMode="decimal" value={draft.dailyWage} onChange={event=>change('dailyWage',+event.target.value)}/></label><label>工作时间设置<select value={scope} onChange={event=>setScope(event.target.value as typeof scope)}><option value="today">仅今天</option><option value="default">默认时段</option></select></label><div className="date-time-fields"><label>工作开始<input type="time" value={start} onChange={event=>changeTime('start',event.target.value)}/></label><label>工作结束<input type="time" value={end} onChange={event=>changeTime('end',event.target.value)}/></label></div><small>仅今天的时段次日自动失效，恢复默认时段；收入按时段估算，不自动记账。结束需晚于开始。</small></>}
 <button type="button" className="primary" disabled={!valid} onClick={()=>onSave({...draft,title:draft.title.trim(),eventName:draft.eventName.trim()})}>保存设置</button></>

}
