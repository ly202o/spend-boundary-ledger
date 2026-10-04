import type { BudgetAllocation, Ledger, Transaction } from './types'
import { diningKind } from './dining.ts'
import { billingMonthForDate, billingRange, dayKey } from './cycle.ts'

export const isOtherTransaction = (item:Transaction, allocatedBudgetIds: Set<string> = new Set()) => item.budgetImpact!==false && diningKind(item)!=='meal' && item.source!=='fixed' && !allocatedBudgetIds.has(item.budgetId || '') && item.category!=='房租' && !(item.category==='居住'&&item.title==='房租')

export function budgetSummary(l: Ledger) {
  const allocations = l.budgets ?? [{ id:'meal', name:'三餐', amount:l.mealBudget, kind:'meal' as const }, { id:'rent', name:'房租', amount:l.rentBudget??1500, kind:'rent' as const }]
  const meal = allocations.find(item => item.kind === 'meal')?.amount ?? 0
  const rent = allocations.find(item => item.kind === 'rent')?.amount ?? 0
  const reserved = allocations.reduce((sum,item)=>sum+item.amount,0)
  return { allocations, meal, rent, reserved, remaining:l.monthlyBudget-reserved }
}

export function withBudgets(l: Ledger, budgets: BudgetAllocation[]): Ledger {
  const meal = budgets.find(item=>item.kind==='meal')?.amount ?? 0
  const rent = budgets.find(item=>item.kind==='rent')?.amount ?? 0
  return { ...l, budgets, mealBudget:meal, rentBudget:rent, otherBudget:l.monthlyBudget-budgets.reduce((sum,item)=>sum+item.amount,0) }
}

/** Amounts are normalized to cents at the accounting boundary. */
export function calc(l: Ledger, date = new Date(), selectedMonth = billingMonthForDate(date, l.billingStartDay)) {
  const cents = (n: number) => Math.round(n * 100)
  const sum = (xs: {amount:number}[]) => xs.reduce((s,x) => s+cents(x.amount),0)
  const month = selectedMonth
  const today = dayKey(date)
  const range = billingRange(month, l.billingStartDay)
  const transactions = l.transactions.filter(x => x.date >= range.startKey && x.date <= range.endKey && x.budgetImpact !== false)
  const budgets = budgetSummary(l)
  const mealBudget = budgets.meal
  const spent = sum(transactions)
  const wishReserved = sum(l.wishes.filter(x=>x.intensity>=8&&x.source==='budget'))
  const meals = transactions.filter(x=>diningKind(x)==='meal')
  const mealSpent = sum(meals)
  const todayMeal = sum(meals.filter(x=>x.date===today))
  const priorMeal = sum(meals.filter(x=>x.date<today))
  const days = range.days
  const elapsed = Math.max(1, Math.min(days, Math.round((date.getTime()-range.start.getTime())/86400000)+1))
  const fixedDaily = l.fixedDailyAmount != null && Number.isFinite(l.fixedDailyAmount) && l.fixedDailyAmount >= 0 ? cents(l.fixedDailyAmount) : cents(mealBudget)/days
  const mealDaily = l.mode==='fixed' ? fixedDaily : Math.max(0,cents(mealBudget)-priorMeal)/(days-elapsed+1)
  const mealRemaining = Math.max(0,cents(mealBudget)-mealSpent)
  const income = sum((l.incomes||[]).filter(x=>x.date>=range.startKey&&x.date<=range.endKey))
  // Legacy fixed-payment records remain visible in the ledger, but the rent
  // allocation is now managed only by the editable rent budget.
  const allocatedIds = new Set(budgets.allocations.filter(item=>item.kind!=='meal').map(item=>item.id))
  const otherSpent = sum(transactions.filter(item=>isOtherTransaction(item,allocatedIds)))
  // Display all non-meal expenses independently of the flexible-budget deduction.
  const nonMealSpent = sum(l.transactions.filter(item=>item.date>=range.startKey&&item.date<=range.endKey&&diningKind(item)!=='meal'))
  const flexibleBase = cents(l.monthlyBudget)-sum(budgets.allocations)
  return {spent:spent/100,income:income/100,otherSpent:otherSpent/100,nonMealSpent:nonMealSpent/100,flexibleBase:flexibleBase/100,wishReserved:wishReserved/100,mealSpent:mealSpent/100,mealRemaining:mealRemaining/100,mealDaily:mealDaily/100,todayMeal:todayMeal/100,todayLeft:(mealDaily-todayMeal)/100,available:(flexibleBase-otherSpent)/100}
}
