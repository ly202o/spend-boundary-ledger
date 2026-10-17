export type Festival={name:string;date:string;days:number}
const solar:Record<string,string>={'1-1':'元旦','5-1':'劳动节','6-1':'儿童节','10-1':'国庆节'}
const lunar:Record<string,string>={'1-1':'春节','1-15':'元宵节','5-5':'端午节','7-7':'七夕节','8-15':'中秋节','9-9':'重阳节','12-8':'腊八节'}
const key=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
/** Common festival dates, not statutory days off or an employer's leave calendar. */
export function nearestFestival(now=new Date()):Festival|null{
 let chinese:Intl.DateTimeFormat|undefined
 try{chinese=new Intl.DateTimeFormat('en-u-ca-chinese',{month:'numeric',day:'numeric'})}catch{/* Solar festivals still work on older browsers. */}
 for(let days=0;days<=400;days++){
  const date=new Date(now.getFullYear(),now.getMonth(),now.getDate()+days,12)
  let name=solar[`${date.getMonth()+1}-${date.getDate()}`]
  if(!name&&chinese){
   const parts=chinese.formatToParts(date)
   const month=parts.find(part=>part.type==='month')?.value||''
   const day=parts.find(part=>part.type==='day')?.value||''
   if(/^\d+$/.test(month))name=lunar[`${Number(month)}-${Number(day)}`]
  }
  if(name)return {name,date:key(date),days}
 }
 return null
}
