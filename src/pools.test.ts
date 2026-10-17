import test from 'node:test'
import assert from 'node:assert/strict'
import { budgetPool } from './pools.ts'
import { calc,budgetSummary } from './budget.ts'
import { initialLedger,normalizeLedger } from './store.ts'
import { readBackup } from './backup.ts'

test('动态池默认关闭，开启后并行计算且不改变原预算表',()=>{
 const ledger=normalizeLedger({...initialLedger,mode:'dynamic',transactions:[{id:'a',title:'午饭',category:'午餐',date:'2026-10-17',amount:20,source:'meal'}]})
 const date=new Date(2026,9,17,12),meal=ledger.budgets!.find(item=>item.kind==='meal')!
 assert.equal(budgetPool(ledger,meal,date,'2026-11'),null)
 const poolMeal={...meal,pool:{enabled:true,amount:300}}
 const next={...ledger,budgets:ledger.budgets!.map(item=>item.id===meal.id?poolMeal:item)}
 const result=budgetPool(next,poolMeal,date,'2026-11')!
 assert.equal(result.total,1800)
 assert.equal(result.remaining,1780)
 assert.equal(result.daily,1800/31)
 assert.ok(Math.abs(result.todayLeft-(1800/31-20))<0.000001)
 assert.ok(Math.abs(result.nextDaily!-1780/30)<0.000001)
 assert.deepEqual(calc(next,date,'2026-11'),calc(ledger,date,'2026-11'))
 assert.equal(budgetSummary(next).reserved,budgetSummary(ledger).reserved)
 assert.equal(budgetPool(next,{...poolMeal,pool:{enabled:false,amount:300}},date),null)
 assert.equal(budgetPool(next,poolMeal,new Date(2026,10,16),'2026-11')?.nextDaily,null)
})
test('自定义预算池按所选预算支出统计，备份保留设置并拒绝无效金额',()=>{
 const budget={id:'custom',name:'日用品',amount:100,kind:'custom' as const,pool:{enabled:true,amount:50}}
 const ledger=normalizeLedger({...initialLedger,budgets:[...initialLedger.budgets!,budget],foodPattern:'dots',splitFoodAmounts:true,transactions:[{id:'a',title:'纸巾',category:'日用',budgetId:'custom',date:'2026-10-17',amount:30}]})
 assert.equal(budgetPool(ledger,budget,new Date(2026,9,17),'2026-11')?.remaining,120)
 const restored=readBackup(JSON.parse(JSON.stringify({ledger}))).ledger!
 assert.deepEqual(restored.budgets?.find(item=>item.id==='custom')?.pool,budget.pool)
 assert.equal(restored.foodPattern,'dots')
 assert.equal(restored.splitFoodAmounts,true)
 assert.throws(()=>readBackup({ledger:{...ledger,budgets:[{...budget,pool:{enabled:true,amount:-1}}]}}))
})
