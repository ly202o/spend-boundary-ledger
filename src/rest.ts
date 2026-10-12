import type { RestSettings, WorkPunch } from './types'
export const defaultRest:RestSettings={title:'休息时间',payday:15,eventName:'期待日',eventDate:'',dailyWage:0,breakMinutes:90,breakStart:'12:00',workStart:'09:30',workEnd:'19:00'}
export function restSettings(saved?:RestSettings):RestSettings{
 const settings={...defaultRest,...saved}
 if(settings.workStart==='09:00'&&settings.workEnd==='18:00')return {...settings,workStart:'09:30',workEnd:'19:00'}
 return settings
}
const minute=(time:string)=>/^([01]\d|2[0-3]):[0-5]\d$/.test(time)?Number(time.slice(0,2))*60+Number(time.slice(3)):NaN
export function validLunch(start:string,duration:number){return Number.isFinite(minute(start))&&Number.isFinite(duration)&&duration>=0&&duration<=240&&minute(start)+duration<1440}
export function lunchEnd(start:string,duration:number){
 const end=minute(start)+duration
 if(!Number.isFinite(end)||end<0||end>=1440)return ''
 return `${String(Math.floor(end/60)).padStart(2,'0')}:${String(end%60).padStart(2,'0')}`
}
export function lunchDuration(start:string,end:string){return minute(end)-minute(start)}
export function punchMinutes(start?:string,end?:string,nextDay=false){
 if(!start||!end)return null
 const first=minute(start),last=minute(end)+(nextDay?1440:0)
 return Number.isFinite(first)&&Number.isFinite(last)&&last>first?last-first:null
}
export function netMinutes(start:number,end:number,settings:RestSettings){
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)return 0
 const restStart=minute(settings.breakStart||'12:00'),duration=settings.breakMinutes??90
 let overlap=0
 for(const day of [0,1440])overlap+=Math.max(0,Math.min(end,restStart+day+duration)-Math.max(start,restStart+day))
 return Math.max(0,end-start-overlap)
}
export function expectedEnd(start:string,settings:RestSettings){
 const first=minute(start)
 if(!Number.isFinite(first))return null
 let end=first+480
 for(let n=0;n<4;n++)end+=480-netMinutes(first,end,settings)
 const clock=end%1440
 return {end:`${String(Math.floor(clock/60)).padStart(2,'0')}:${String(clock%60).padStart(2,'0')}`,endNextDay:end>=1440}
}
export function updatePunch(punch:WorkPunch,key:'start'|'end',value:string,settings:RestSettings):WorkPunch{
 if(key==='end')return {...punch,end:value||undefined,endEstimated:false,endNextDay:!!value&&!!punch.start&&value<punch.start}
 const result={...punch,start:value||undefined}
 if(!punch.end||punch.endEstimated){
  const expected=value?expectedEnd(value,settings):null
  return {...result,end:expected?.end,endNextDay:expected?.endNextDay,endEstimated:!!expected}
 }
 return result
}
export function actualWorkMinutes(punch:WorkPunch,settings:RestSettings){
 if(punch.endEstimated||punchMinutes(punch.start,punch.end,punch.endNextDay)===null)return null
 return netMinutes(minute(punch.start!),minute(punch.end!)+(punch.endNextDay?1440:0),settings)
}
export function workSummary(settings:RestSettings,now=new Date()){
 const month=restDateKey(now).slice(0,7)
 const records=Object.entries(settings.punches||{}).filter(([date])=>date.startsWith(month)&&date<=restDateKey(now)).map(([date,punch])=>({date,...punch,minutes:actualWorkMinutes(punch,settings)})).sort((a,b)=>b.date.localeCompare(a.date))
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
 const duration=punch?.start?480:netMinutes(start,minutes(today?.end||settings.workEnd),settings)
 const expected=punch?.start?expectedEnd(punch.start,settings):null
 const end=punch?.end?minutes(punch.end)+(punch.endNextDay?1440:0):expected?minutes(expected.end)+(expected.endNextDay?1440:0):minutes(today?.end||settings.workEnd),current=now.getHours()*60+now.getMinutes()
 const daily=settings.monthlySalary!==undefined?settings.monthlySalary/new Date(now.getFullYear(),now.getMonth()+1,0).getDate():settings.dailyWage
 const earned=duration>0?daily*Math.min(1,Math.max(0,netMinutes(start,Math.min(current,end),settings)/duration)):0
 return {payDays,friday,eventDays,earned}
}
