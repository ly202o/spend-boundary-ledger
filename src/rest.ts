import type { RestSettings } from './types'
export const defaultRest:RestSettings={title:'休息时间',payday:15,eventName:'期待日',eventDate:'',dailyWage:0,workStart:'09:30',workEnd:'19:00'}
export function restSettings(saved?:RestSettings):RestSettings{
 const settings={...defaultRest,...saved}
 if(settings.workStart==='09:00'&&settings.workEnd==='18:00')return {...settings,workStart:'09:30',workEnd:'19:00'}
 return settings
}
const minute=(time:string)=>/^([01]\d|2[0-3]):[0-5]\d$/.test(time)?Number(time.slice(0,2))*60+Number(time.slice(3)):NaN
export function punchMinutes(start?:string,end?:string){
 if(!start||!end)return null
 const first=minute(start),last=minute(end)
 return Number.isFinite(first)&&Number.isFinite(last)&&last>first?last-first:null
}
export function workSummary(settings:RestSettings,now=new Date()){
 const month=restDateKey(now).slice(0,7)
 const records=Object.entries(settings.punches||{}).filter(([date])=>date.startsWith(month)&&date<=restDateKey(now)).map(([date,punch])=>({date,...punch,minutes:punchMinutes(punch.start,punch.end)})).sort((a,b)=>b.date.localeCompare(a.date))
 const completed=records.filter(record=>record.minutes!==null)
 return {records,days:completed.length,totalMinutes:completed.reduce((sum,record)=>sum+record.minutes!,0)}
}
const stamp=(date:Date)=>Date.UTC(date.getFullYear(),date.getMonth(),date.getDate())
export const restDateKey=(now=new Date())=>`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
export function restStats(settings:RestSettings,now=new Date()){
 const payday=(month:number)=>new Date(now.getFullYear(),month,Math.min(settings.payday,new Date(now.getFullYear(),month+1,0).getDate()),12)
 let next=payday(now.getMonth())
 if(stamp(next)<stamp(now))next=payday(now.getMonth()+1)
 const payDays=Math.round((stamp(next)-stamp(now))/86400000)
 const friday=((settings.weekday??5)-now.getDay()+7)%7
 const event=/^\d{4}-\d{2}-\d{2}$/.test(settings.eventDate)?new Date(settings.eventDate+'T12:00:00'):null
 const eventDays=event&&Number.isFinite(event.getTime())?Math.round((stamp(event)-stamp(now))/86400000):null
 const minutes=(time:string)=>Number(time.slice(0,2))*60+Number(time.slice(3))
 const today=settings.todayWork?.date===restDateKey(now)?settings.todayWork:null
 const punch=settings.punches?.[restDateKey(now)]
 const start=minutes(punch?.start||today?.start||settings.workStart)
 const duration=minutes(today?.end||settings.workEnd)-minutes(today?.start||settings.workStart)
 const end=punch?.end?minutes(punch.end):start+duration,current=now.getHours()*60+now.getMinutes()
 const daily=settings.monthlySalary!==undefined?settings.monthlySalary/new Date(now.getFullYear(),now.getMonth()+1,0).getDate():settings.dailyWage
 const earned=duration>0?daily*Math.min(1,Math.max(0,(Math.min(current,end)-start)/duration)):0
 return {payDays,friday,eventDays,earned}
}
