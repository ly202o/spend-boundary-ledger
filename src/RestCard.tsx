import { useEffect, useState } from 'react'
import type { RestSettings, WorkPunch } from './types'
import { restSettings, restStats, restDateKey, workSummary, punchMinutes, updatePunch, actualWorkMinutes, validLunch, lunchEnd, lunchDuration, defaultPunch, countdownToEnd, isWorkday } from './rest'

export type RestPart='all'|'payday'|'week'|'event'|'income'|'work'
export function RestCard({settings,onEdit,onAutoPunch}:{settings?:RestSettings;onEdit:(part:RestPart)=>void;onAutoPunch:(date:string,punch:WorkPunch)=>void}){
 const value=restSettings(settings)
 const [now,setNow]=useState(()=>new Date())
 useEffect(()=>{const timer=window.setInterval(()=>setNow(new Date()),1000);return()=>window.clearInterval(timer)},[])
 const stats=restStats(value,now)
 const date=restDateKey(now)
 const working=isWorkday(value,now)
 useEffect(()=>{if(working&&!value.punches?.[date])onAutoPunch(date,defaultPunch(value,date))},[date,working,value.punches,onAutoPunch])
 const countdown=countdownToEnd(value,now)
 return <article className="rest-card"><div className="rest-header"><h2>{value.title}</h2></div>{working&&<button type="button" className="offwork-countdown" aria-label="编辑打卡与查看工时" onClick={()=>onEdit('work')}><span>{countdown.remaining?'下班还有':'今日已到下班时间'}</span><strong>{countdown.text}</strong><small>{countdown.punch.startDefault?'默认时段':countdown.punch.endEstimated?'下班预计':'手动记录'} · {countdown.punch.start}–{countdown.punch.endNextDay?'次日 ':''}{countdown.punch.end}</small></button>}<div className="rest-tiles">
 <button type="button" onClick={()=>onEdit('payday')} aria-label="编辑发薪日"><span>发薪</span><b>{stats.payDays}</b><small>{stats.payDays===0?'今天':'天'} · 每月{value.payday}号</small></button>
 <button type="button" onClick={()=>onEdit('week')} aria-label="编辑每周期待日"><span>周{['日','一','二','三','四','五','六'][value.weekday??5]}</span><b>{stats.friday}</b><small>{stats.friday===0?'今天':'天'}</small></button>
 <button type="button" onClick={()=>onEdit('event')} aria-label="编辑期待日期"><span>{value.eventName}</span><b>{stats.eventDays===null?'—':Math.abs(stats.eventDays)}</b><small>{stats.eventDays===null?'未设置':stats.eventDays===0?'今天':stats.eventDays<0?'天前':'天'}</small></button>
 <button type="button" onClick={()=>onEdit('income')} aria-label="编辑收入估算与工作时间"><span>今天已赚</span><b>{stats.earned.toFixed(2)}</b><small>¥ · 估算</small></button>
 </div></article>
}

export function RestEditor({settings,onSave,part='all'}:{part?:RestPart;settings?:RestSettings;onSave:(value:RestSettings)=>void}){
 const [draft,setDraft]=useState<RestSettings>(()=>restSettings(settings))
 const change=(key:keyof RestSettings,value:string|number)=>{const next={...draft,[key]:value};if(key==='breakMinutes'||key==='breakStart')next.punches=Object.fromEntries(Object.entries(next.punches||{}).map(([date,punch])=>[date,punch.endEstimated&&punch.start?updatePunch(punch,'start',punch.start,next):punch]));setDraft(next)}
 const [scope,setScope]=useState<'today'|'default'>('today')
 const today=draft.todayWork?.date===restDateKey()?draft.todayWork:{date:restDateKey(),start:draft.workStart,end:draft.workEnd}
 const start=scope==='today'?today.start:draft.workStart,end=scope==='today'?today.end:draft.workEnd
 const changeTime=(key:'start'|'end',value:string)=>scope==='today'?setDraft({...draft,todayWork:{...today,[key]:value}}):change(key==='start'?'workStart':'workEnd',value)
 const [punchDate,setPunchDate]=useState(restDateKey())
 const punch=draft.punches?.[punchDate]||defaultPunch(draft,punchDate)
 const setPunch=(key:'start'|'end',value:string)=>setDraft({...draft,punches:{...draft.punches,[punchDate]:updatePunch(punch,key,value,draft)}})
 const summary=workSummary(draft)
 const all=part==='all',pay=all||part==='payday',week=all||part==='week',event=all||part==='event',income=all||part==='income',work=all||part==='work'
 const [restEnd,setRestEnd]=useState(()=>lunchEnd(draft.breakStart||'12:00',draft.breakMinutes??90))
 const setLunch=(key:'start'|'end',value:string)=>{const start=key==='start'?value:(draft.breakStart||'12:00'),end=key==='end'?value:restEnd;setRestEnd(end);const next={...draft,breakStart:start,breakMinutes:lunchDuration(start,end)};if(validLunch(start,next.breakMinutes))next.punches=Object.fromEntries(Object.entries(next.punches||{}).map(([date,punch])=>[date,punch.endEstimated&&punch.start?updatePunch(punch,'start',punch.start,next):punch]));setDraft(next)}
 const breakValid=validLunch(draft.breakStart||'12:00',draft.breakMinutes??90)
 const valid=(!all||breakValid)&&(!all||draft.title.trim())&&(!pay||(Number.isInteger(draft.payday)&&draft.payday>=1&&draft.payday<=31))&&(!event||draft.eventName.trim())&&(!income||((all&&draft.monthlySalary===undefined)||(draft.monthlySalary!==undefined&&Number.isFinite(draft.monthlySalary)&&draft.monthlySalary>=0)))&&(!all||(/^\d{2}:\d{2}$/.test(start)&&/^\d{2}:\d{2}$/.test(end)&&end>start&&draft.workEnd>draft.workStart))&&(!work||!punch.start||!punch.end||punchMinutes(punch.start,punch.end,punch.endNextDay)!==null)
 return <>
 {all&&<label>卡片名称<input maxLength={20} value={draft.title} onChange={event=>change('title',event.target.value)}/></label>}
 {pay&&<><span>每月发薪日 · {draft.payday} 号</span><div className="cycle-day-grid payday-grid" role="group" aria-label="选择每月发薪日">{Array.from({length:31},(_,index)=>index+1).map(day=><button type="button" key={day} className={draft.payday===day?'active':''} aria-pressed={draft.payday===day} aria-label={`每月 ${day} 号`} onClick={()=>change('payday',day)}>{day}</button>)}</div><small>当月不足该日期时按月末计算，卡片显示设置的日期和倒计时。</small></>}
 {week&&<label>每周期待日<select value={draft.weekday??5} onChange={event=>change('weekday',+event.target.value)}>{['日','一','二','三','四','五','六'].map((name,index)=><option key={index} value={index}>周{name}</option>)}</select></label>}
 {event&&<><label>倒计时名称<input maxLength={12} value={draft.eventName} onChange={event=>change('eventName',event.target.value)}/></label><label>期待日期<input type="date" value={draft.eventDate} onChange={event=>change('eventDate',event.target.value)}/></label></>}
 {work&&<><label>打卡日期<input type="date" max={restDateKey()} value={punchDate} onChange={event=>{if(event.target.value)setPunchDate(event.target.value)}}/></label><div className="date-time-fields"><label>上班打卡<input type="time" value={punch.start||''} onChange={event=>setPunch('start',event.target.value)}/></label><label>下班打卡<input type="time" value={punch.end||''} onChange={event=>setPunch('end',event.target.value)}/></label></div><small>上班后自动预填满 8 小时工作后的下班时间（包含午休）。未手动打卡时自动采用默认时段，标记为默认而非真实打卡；可手动修改或确认。跨日记录按次日下班计算。</small>{punch.endEstimated&&<button type="button" className="primary" onClick={()=>setDraft({...draft,punches:{...draft.punches,[punchDate]:{...punch,endEstimated:false,startDefault:false}}})}>确认已于 {punch.endNextDay?'次日 ':''}{punch.end} 下班</button>}<small>{punch.endEstimated?'下班时间为预填，暂不计入实际工时。':''}</small><b>本月已完成 {summary.days} 天 · 共 {(summary.totalMinutes/60).toFixed(2)} 小时</b><small>另有默认时段 {summary.defaultDays} 天 · {(summary.defaultMinutes/60).toFixed(2)} 小时（估算）</small><small>仅统计已确认的上下班记录，已扣午休；单次或预填下班不计入完成天数。</small>{summary.records.map(record=><button type="button" className="work-record" key={record.date} onClick={()=>setPunchDate(record.date)}>{record.date} · {record.start||'未上班'}–{record.end||'未下班'} · {record.minutes===null?(record.startDefault?'默认时段':record.endEstimated?'下班待确认':'待补全'):(record.minutes/60).toFixed(2)+' 小时'}</button>)}</>}
 {income&&<><label>月薪（元）<input type="number" min="0" step="0.01" inputMode="decimal" value={draft.monthlySalary??''} placeholder="填写月薪" onChange={event=>setDraft({...draft,monthlySalary:event.target.value===''?undefined:+event.target.value})}/></label><small>按月薪和当天工作进度估算，不自动记账。作息和午休在滑动菜单的整体设置中修改。</small></>}
 {all&&<><span>每周工作日</span><div className="cycle-day-grid" role="group" aria-label="选择每周工作日">{[1,2,3,4,5,6,0].map(day=><button type="button" key={day} aria-pressed={(draft.workDays??[1,2,3,4,5]).includes(day)} className={(draft.workDays??[1,2,3,4,5]).includes(day)?'active':''} onClick={()=>{const current=draft.workDays??[1,2,3,4,5];setDraft({...draft,workDays:current.includes(day)?current.filter(value=>value!==day):[...current,day]})}}>周{['日','一','二','三','四','五','六'][day]}</button>)}</div><small>按这里选择的星期判断工作日，不自动识别节假日调休。</small><label>工作时间设置<select value={scope} onChange={event=>setScope(event.target.value as typeof scope)}><option value="today">仅今天</option><option value="default">默认时段</option></select></label><div className="date-time-fields"><label>工作开始<input type="time" value={start} onChange={event=>changeTime('start',event.target.value)}/></label><label>工作结束<input type="time" value={end} onChange={event=>changeTime('end',event.target.value)}/></label></div><small>月薪按当月自然日均摊，再按当天工作进度估算，已扣午休，不扣税或考勤，不代表实际计薪。仅今天的时段次日恢复默认，不自动记账。</small></>}
 {all&&<><span>午休时段</span><div className="date-time-fields"><label>开始<input type="time" aria-label="午休开始" value={draft.breakStart??'12:00'} onChange={event=>setLunch('start',event.target.value)}/></label><label>结束<input type="time" aria-label="午休结束" value={restEnd} onChange={event=>setLunch('end',event.target.value)}/></label></div><small>午休时长：{breakValid?Number(((draft.breakMinutes??90)/60).toFixed(2))+' 小时':'请检查时间段'}</small><small>默认 12:00–13:30（1.5 小时）；仅扣与工作时段重叠的午休。修改后历史工时也按此规则重新汇总。</small></>}
 {!valid&&<small role="alert" className="meal-time-error">{!breakValid?'请设置有效的午休时段，结束不早于开始，时长不超过 4 小时。':income&&draft.monthlySalary===undefined?'请填写月薪。':'请检查必填字段及上下班时间。'}</small>}

 <button type="button" className="primary" disabled={!valid} onClick={()=>{const next={...draft,...(work?{punches:{...draft.punches,[punchDate]:punch}}:{}),title:draft.title.trim(),eventName:draft.eventName.trim()};if(all&&next.punches?.[restDateKey()]?.startDefault)next.punches={...next.punches,[restDateKey()]:defaultPunch(next)};onSave(next)}}>保存并关闭</button></>

}
