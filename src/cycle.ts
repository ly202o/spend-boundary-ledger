export const dayKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`

/** The label month is the month in which the billing period ends. */
export function billingRange(month: string, startDay = 17) {
  const [year, monthNumber] = month.split('-').map(Number)
  const day = Math.min(28, Math.max(1, Math.trunc(startDay) || 17))
  const start = day === 1 ? new Date(year, monthNumber - 1, 1, 12) : new Date(year, monthNumber - 2, day, 12)
  const end = day === 1 ? new Date(year, monthNumber, 0, 12) : new Date(year, monthNumber - 1, day - 1, 12)
  return { start, end, startKey: dayKey(start), endKey: dayKey(end), days: Math.round((end.getTime()-start.getTime())/86400000)+1 }
}

export function billingMonthForDate(date: Date, startDay = 17) {
  const day = Math.min(28, Math.max(1, Math.trunc(startDay) || 17))
  const target = day === 1 || date.getDate() < day ? date : new Date(date.getFullYear(), date.getMonth()+1, 1)
  return `${target.getFullYear()}-${String(target.getMonth()+1).padStart(2,'0')}`
}
