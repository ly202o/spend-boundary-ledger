import type { BudgetAllocation, Ledger } from './types'
import { billingMonthForDate, billingRange, dayKey } from './cycle.ts'
import { diningKind } from './dining.ts'

export function budgetPool(ledger:Ledger,budget:BudgetAllocation|undefined,date=new Date(),month=billingMonthForDate(date,ledger.billingStartDay)){
 if(!budget?.pool?.enabled)return null
 const range=billingRange(month,ledger.billingStartDay),today=dayKey(date)
 const cents=(amount:number)=>Math.round(amount*100)
 const base=cents(budget.amount),extra=cents(budget.pool.amount)
 const items=ledger.transactions.filter(item=>item.budgetImpact!==false&&item.date>=range.startKey&&item.date<=range.endKey&&(budget.kind==='meal'?diningKind(item)!==null:budget.kind==='rent'?(item.budgetId===budget.id||item.category==='房租'||(item.category==='居住'&&item.title==='房租')):item.budgetId===budget.id))
 const sum=(predicate:(date:string)=>boolean)=>items.filter(item=>predicate(item.date)).reduce((value,item)=>value+cents(item.amount),0)
 const spent=sum(()=>true),prior=sum(value=>value<today),todaySpent=sum(value=>value===today)
 const local=new Date(date.getFullYear(),date.getMonth(),date.getDate(),12)
 const elapsed=Math.max(1,Math.min(range.days,Math.round((local.getTime()-range.start.getTime())/86400000)+1))
 const daysLeft=range.days-elapsed+1,total=base+extra
 // This parallel reference never changes the original budget, daily allowance or available balance.
 const daily=ledger.mode==='dynamic'?Math.max(0,total-prior)/daysLeft:total/range.days
 const remaining=Math.max(0,total-spent)
 const nextDaily=ledger.mode==='dynamic'&&today>=range.startKey&&today<range.endKey?remaining/(daysLeft-1)/100:null
 return {base:base/100,extra:extra/100,total:total/100,spent:spent/100,remaining:remaining/100,daily:daily/100,todayLeft:(daily-todaySpent)/100,nextDaily}
}
