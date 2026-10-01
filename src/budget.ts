import type { Ledger } from './types'
import { billingMonthForDate, billingRange, dayKey } from './cycle.ts'

/** Amounts are normalized to cents at the accounting boundary. */
export function calc(l: Ledger, date = new Date(), selectedMonth = billingMonthForDate(date, l.billingStartDay)) {
  const cents = (n: number) => Math.round(n * 100)
  const sum = (xs: {amount:number}[]) => xs.reduce((s,x) => s+cents(x.amount),0)
  const month = selectedMonth
  const today = dayKey(date)
  const range = billingRange(month, l.billingStartDay)
  const transactions = l.transactions.filter(x => x.date >= range.startKey && x.date <= range.endKey && x.budgetImpact !== false)
  const spent = sum(transactions)
  // Fixed expenses recur each month. Old records without `paidMonth` retain their
  // original meaning until load() migrates them.
  const fixedReserved = sum(l.expenses.filter(x => x.active && (x.paidMonth ? x.paidMonth !== month : !x.paid)))
  const wishReserved = sum(l.wishes.filter(x=>x.intensity>=8&&x.source==='budget'))
  const meals = transactions.filter(x=>x.source==='meal')
  const mealSpent = sum(meals)
  const todayMeal = sum(meals.filter(x=>x.date===today))
  const priorMeal = sum(meals.filter(x=>x.date<today))
  const days = range.days
  const elapsed = Math.max(1, Math.min(days, Math.round((date.getTime()-range.start.getTime())/86400000)+1))
  const mealDaily = l.mode==='fixed' ? cents(l.mealBudget)/days : Math.max(0,cents(l.mealBudget)-priorMeal)/(days-elapsed+1)
  const mealRemaining = Math.max(0,cents(l.mealBudget)-mealSpent)
  const income = sum((l.incomes||[]).filter(x=>x.date>=range.startKey&&x.date<=range.endKey))
  const otherSpent = spent - mealSpent
  const fixedPaid = sum(transactions.filter(x=>x.source==='fixed'))
  const fixedCommitted = fixedPaid + fixedReserved
  const flexibleSpent = otherSpent - fixedPaid
  const totalAfterCommitments = cents(l.monthlyBudget)-cents(l.mealBudget)-fixedCommitted
  const flexibleBase = Math.min(l.otherBudget==null?totalAfterCommitments:cents(l.otherBudget),totalAfterCommitments)
  return {spent:spent/100,income:income/100,otherSpent:otherSpent/100,fixedPaid:fixedPaid/100,fixedCommitted:fixedCommitted/100,flexibleSpent:flexibleSpent/100,flexibleBase:flexibleBase/100,fixedReserved:fixedReserved/100,wishReserved:wishReserved/100,reserved:(fixedReserved+wishReserved)/100,mealSpent:mealSpent/100,mealRemaining:mealRemaining/100,mealDaily:mealDaily/100,todayMeal:todayMeal/100,todayLeft:(mealDaily-todayMeal)/100,available:(flexibleBase-flexibleSpent-wishReserved)/100}
}
