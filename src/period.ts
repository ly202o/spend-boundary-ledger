import type { Transaction } from './types'
import { billingMonthForDate, billingRange } from './cycle.ts'

export type SpendingPeriod = 'week' | 'seven' | 'month'

/** A week chart covers all seven displayed days, not just days with expenses. */
export function crossesBillingPeriod(period:SpendingPeriod,date:Date,startDay=17,month=billingMonthForDate(date,startDay)) {
  if(period==='month')return false
  const range=spendingPeriodRange(period,date,startDay,month)
  const end=period==='week'?addDays(range.start,6):range.end
  const billing=billingRange(month,startDay)
  return range.startKey<billing.startKey||key(end)>billing.endKey
}

const localDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12)
const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 12)
const key = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

export function spendingPeriodRange(period: SpendingPeriod, now = new Date(), billingStartDay = 17, selectedMonth = billingMonthForDate(now, billingStartDay)) {
  const end = localDay(now)
  let start: Date
  if (period === 'seven') start = addDays(end, -6)
  else if (period === 'week') start = addDays(end, -((end.getDay() + 6) % 7))
  else start = billingRange(selectedMonth, billingStartDay).start
  return { start, end, startKey: key(start), endKey: key(end) }
}

export function spendingPeriodSummary(transactions: Transaction[], period: SpendingPeriod, now = new Date(), billingStartDay = 17, selectedMonth = billingMonthForDate(now, billingStartDay)) {
  const range = spendingPeriodRange(period, now, billingStartDay, selectedMonth)
  const items = transactions.filter(item => item.date >= range.startKey && item.date <= range.endKey)
  const total = items.reduce((sum, item) => sum + item.amount, 0)
  const days = Math.max(1, Math.round((range.end.getTime() - range.start.getTime()) / 86400000) + 1)
  return { ...range, total, count: items.length, dailyAverage: total / days }
}

export function spendingPeriodDays(transactions: Transaction[], period: SpendingPeriod, now = new Date(), billingStartDay = 17, selectedMonth = billingMonthForDate(now, billingStartDay)) {
  const range = spendingPeriodRange(period, now, billingStartDay, selectedMonth)
  const length = period === 'month' ? billingRange(selectedMonth, billingStartDay).days : 7
  return Array.from({ length }, (_, index) => {
    const date = addDays(range.start, index)
    const dateKey = key(date)
    return {
      date,
      dateKey,
      amount: transactions.filter(item => item.date === dateKey).reduce((sum, item) => sum + item.amount, 0),
      future: date > range.end,
    }
  })
}
