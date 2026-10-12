import changelog from '../CHANGELOG.md?raw'
import { releaseHistory } from './release-history'

const history=releaseHistory(changelog)
export default function ReleaseNotes(){
  return <section className="display-card release-notes"><b>更新日志</b><small>按日期整理，点击年、月、日可展开或收起。</small>{history.map((year,yi)=><details key={year.year} open={yi===0} className="release-year"><summary>{year.year} 年</summary>{year.months.map((month,mi)=><details key={month.month} open={yi===0&&mi===0} className="release-month"><summary>{Number(month.month)} 月 <small>{month.days.length} 个更新日</small></summary>{month.days.map((day,di)=><details key={day.date} open={yi===0&&mi===0&&di===0} className="release-day"><summary>{Number(day.date.slice(8))} 日 <small>{day.versions.join(' · ')||'历史更新'} · {day.items.length} 项</small></summary><ul>{day.items.map((item,index)=><li key={index}>{item}</li>)}</ul></details>)}</details>)}</details>)}</section>
}
