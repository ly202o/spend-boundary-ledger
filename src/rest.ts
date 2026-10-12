import type { RestSettings } from './types'
export const defaultRest:RestSettings={title:'休息时间',payday:15,eventName:'期待日',eventDate:'',dailyWage:0,workStart:'09:00',workEnd:'18:00'}
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
 const start=minutes(today?.start||settings.workStart),end=minutes(today?.end||settings.workEnd),current=now.getHours()*60+now.getMinutes()
 const earned=end>start?settings.dailyWage*Math.min(1,Math.max(0,(current-start)/(end-start))):0
 return {payDays,friday,eventDays,earned}
}
