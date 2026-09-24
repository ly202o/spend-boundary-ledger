import type { Ledger } from './types'

/** Amounts are normalized to cents at the accounting boundary. */
export function calc(l: Ledger, date = new Date()) {
  const cents = (n: number) => Math.round(n * 100)
  const sum = (xs: {amount:number}[]) => xs.reduce((s,x) => s+cents(x.amount),0)
  const month = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`
  const today = `${month}-${String(date.getDate()).padStart(2,'0')}`
  const transactions = l.transactions.filter(x => x.date.startsWith(month) && x.budgetImpact !== false)
  const spent = sum(transactions)
  // Fixed expenses recur each month. Old records without `paidMonth` retain their
  // original meaning until load() migrates them.
  const fixedReserved = sum(l.expenses.filter(x => x.active && (x.paidMonth ? x.paidMonth !== month : !x.paid)))
  const wishReserved = sum(l.wishes.filter(x=>x.intensity>=8&&x.source==='budget'))
  const meals = transactions.filter(x=>x.source==='meal')
  const mealSpent = sum(meals)
  const todayMeal = sum(meals.filter(x=>x.date===today))
  const priorMeal = sum(meals.filter(x=>x.date<today))
  const days = new Date(date.getFullYear(),date.getMonth()+1,0).getDate()
  const mealDaily = l.mode==='fixed' ? cents(l.mealBudget)/days : Math.max(0,cents(l.mealBudget)-priorMeal)/(days-date.getDate()+1)
  const mealRemaining = Math.max(0,cents(l.mealBudget)-mealSpent)
  return {spent:spent/100,fixedReserved:fixedReserved/100,wishReserved:wishReserved/100,reserved:(fixedReserved+wishReserved)/100,mealSpent:mealSpent/100,mealRemaining:mealRemaining/100,mealDaily:mealDaily/100,todayMeal:todayMeal/100,todayLeft:(mealDaily-todayMeal)/100,available:(cents(l.monthlyBudget)-spent-fixedReserved-wishReserved-mealRemaining)/100}
}
