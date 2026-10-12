export type ReleaseDay={date:string;versions:string[];items:string[]}
export type ReleaseYear={year:string;months:{month:string;days:ReleaseDay[]}[]}

export function releaseHistory(markdown:string):ReleaseYear[] {
  const days=new Map<string,ReleaseDay>()
  let current:ReleaseDay|undefined
  for(const line of markdown.split(/\r?\n/)){
    if(line.startsWith('## ')){
      const date=line.match(/\d{4}-\d{2}-\d{2}/)?.[0]
      current=date?(days.get(date)||{date,versions:[],items:[]}):undefined
      if(current){days.set(date!,current);const version=line.match(/v\d+\.\d+\.\d+/)?.[0];if(version&&!current.versions.includes(version))current.versions.push(version)}
    }else if(current&&line.startsWith('- '))current.items.push(line.slice(2))
  }
  const years:ReleaseYear[]=[]
  for(const day of [...days.values()].sort((a,b)=>b.date.localeCompare(a.date))){
    const year=day.date.slice(0,4),month=day.date.slice(5,7)
    let group=years.find(item=>item.year===year)
    if(!group){group={year,months:[]};years.push(group)}
    let section=group.months.find(item=>item.month===month)
    if(!section){section={month,days:[]};group.months.push(section)}
    section.days.push(day)
  }
  return years
}
