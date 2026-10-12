import { useEffect, useState } from 'react'
import type { RestSettings } from './types'
import { defaultRest, restStats, restDateKey } from './rest'

export function RestCard({settings}:{settings?:RestSettings}){
 const value={...defaultRest,...settings}
 const [now,setNow]=useState(()=>new Date())
 useEffect(()=>{const timer=window.setInterval(()=>setNow(new Date()),30000);return()=>window.clearInterval(timer)},[])
 const stats=restStats(value,now)
 return <article className="rest-card"><div className="rest-header"><h2>{value.title}</h2><small>倒计时 · 收入估算</small></div><div className="rest-tiles"><div><span>发薪</span><b>{stats.payDays}</b><small>{stats.payDays===0?'今天':'天'}</small></div><div><span>周五</span><b>{stats.friday}</b><small>{stats.friday===0?'今天':'天'}</small></div><div><span>{value.eventName}</span><b>{stats.eventDays===null?'—':Math.abs(stats.eventDays)}</b><small>{stats.eventDays===null?'未设置':stats.eventDays<0?'天前':stats.eventDays===0?'今天':'天'}</small></div><div><span>今天已赚</span><b>{stats.earned.toFixed(2)}</b><small>¥ · 估算</small></div></div></article>
}

export function RestEditor({settings,onSave}:{settings?:RestSettings;onSave:(value:RestSettings)=>void}){
 const [draft,setDraft]=useState<RestSettings>({...defaultRest,...settings})
 const change=(key:keyof RestSettings,value:string|number)=>setDraft({...draft,[key]:value})
 const [scope,setScope]=useState<'today'|'default'>('today')
 const today=draft.todayWork?.date===restDateKey()?draft.todayWork:{date:restDateKey(),start:draft.workStart,end:draft.workEnd}
 const start=scope==='today'?today.start:draft.workStart,end=scope==='today'?today.end:draft.workEnd
 const changeTime=(key:'start'|'end',value:string)=>scope==='today'?setDraft({...draft,todayWork:{...today,[key]:value}}):change(key==='start'?'workStart':'workEnd',value)
 const valid=draft.title.trim()&&draft.eventName.trim()&&Number.isInteger(draft.payday)&&draft.payday>=1&&draft.payday<=31&&Number.isFinite(draft.dailyWage)&&draft.dailyWage>=0&&/^\d{2}:\d{2}$/.test(start)&&/^\d{2}:\d{2}$/.test(end)&&end>start&&draft.workEnd>draft.workStart
 return <><label>卡片名称<input maxLength={20} value={draft.title} onChange={event=>change('title',event.target.value)}/></label><label>每月发薪日<input type="number" min="1" max="31" value={draft.payday} onChange={event=>change('payday',+event.target.value)}/></label><small>当月不足该日期时，按月末计算。</small><label>倒计时名称<input maxLength={12} value={draft.eventName} onChange={event=>change('eventName',event.target.value)}/></label><label>期待日期<input type="date" value={draft.eventDate} onChange={event=>change('eventDate',event.target.value)}/></label><label>每日收入估算（元）<input type="number" min="0" step="0.01" inputMode="decimal" value={draft.dailyWage} onChange={event=>change('dailyWage',+event.target.value)}/></label><label>工作时间设置<select value={scope} onChange={event=>setScope(event.target.value as typeof scope)}><option value="today">仅今天</option><option value="default">默认时段</option></select></label><div className="date-time-fields"><label>工作开始<input type="time" value={start} onChange={event=>changeTime('start',event.target.value)}/></label><label>工作结束<input type="time" value={end} onChange={event=>changeTime('end',event.target.value)}/></label></div><small>仅今天的时段次日自动失效，恢复默认时段；可每天修改。收入按时段估算，不自动记账。结束需晚于开始。</small><button type="button" className="primary" disabled={!valid} onClick={()=>onSave({...draft,title:draft.title.trim(),eventName:draft.eventName.trim()})}>保存卡片</button></>
}
