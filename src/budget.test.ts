import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calc } from './budget.ts'
import type { Ledger } from './types'
const base: Ledger = {monthlyBudget:4000,mealBudget:1500,mode:'dynamic',transactions:[],wishes:[],expenses:[{id:'rent',title:'房租',amount:1500,active:true,paid:false,category:'居住'}]}
const date = new Date(2026,8,1,12)
test('三餐预算已隔离，支付预留不会重复扣款',()=>{
 assert.equal(calc(base,date).available,1000)
 const paid: Ledger={...base,expenses:[{...base.expenses[0],paid:true}],transactions:[{id:'1',title:'房租',amount:1500,category:'居住',date:'2026-09-01',source:'fixed'}]}
 assert.equal(calc(paid,date).available,1000)
})
test('固定支出在下月自动重新预留',()=>{
 const paid: Ledger = {...base, expenses:[{...base.expenses[0], paid:true, paidMonth:'2026-09'}], transactions:[{id:'1',title:'房租',amount:1500,category:'居住',date:'2026-09-01',source:'fixed'}]}
 assert.equal(calc(paid, new Date(2026,8,15,12)).fixedReserved, 0)
 assert.equal(calc(paid, new Date(2026,9,1,12)).fixedReserved, 1500)
})
test('当天三餐只扣一次，账期外不混入',()=>{
 const l:Ledger={...base,transactions:[{id:'1',title:'午饭',amount:32,category:'三餐',date:'2026-09-17',source:'meal'},{id:'2',title:'旧消费',amount:999,category:'其他',date:'2026-08-31',source:'general'}]}
 assert.equal(calc(l,new Date(2026,8,17,12)).todayLeft,18)
 assert.equal(calc(l,new Date(2026,8,17,12)).available,1000)
})
test('高愿望按资金来源占用，超预算保留负数',()=>{
 const l:Ledger={...base,wishes:[{id:'w',title:'电脑',amount:2000,intensity:9,source:'budget'}]}
 assert.equal(calc(l,date).available,-1000)
 l.wishes[0].source='freedom'
 assert.equal(calc(l,date).available,1000)
})

test('自由基金购买不消耗当月生活预算',()=>{
 const l:Ledger={...base,transactions:[{id:'1',title:'耳机',amount:499,category:'愿望',date:'2026-09-01',source:'wish',budgetImpact:false}]}
 assert.equal(calc(l,date).spent,0)
 assert.equal(calc(l,date).available,1000)
})
test('17日至次月16日共享账期，工资单独记录而不扩大生活预算',()=>{
 const ledger:Ledger={...base,incomes:[{id:'salary',title:'工资',amount:3000,date:'2026-09-30'}],transactions:[{id:'meal',title:'午餐',amount:20,category:'三餐',date:'2026-09-17',source:'meal'},{id:'outside',title:'旧账',amount:100,date:'2026-09-16',category:'其他'}]}
 const result=calc(ledger,new Date(2026,9,1,12),'2026-10')
 assert.equal(result.income,3000)
 assert.equal(result.spent,20)
 assert.equal(result.mealSpent,20)
 assert.equal(result.available,1000)
})
test('三餐支出不重复占用弹性额度，其他支出直接减少可支配',()=>{
 const ledger:Ledger={...base,transactions:[{id:'meal',title:'午餐',amount:35,category:'午餐',date:'2026-09-17',source:'meal'},{id:'other',title:'日用品',amount:80,category:'日用品',date:'2026-09-18',source:'general'}]}
 const result=calc(ledger,new Date(2026,8,18,12),'2026-10')
 assert.equal(result.otherSpent,80)
 assert.equal(result.available,920)
})
test('其他预算可单独调低，但不能超出生活总预算余额',()=>{
 const lower=calc({...base,otherBudget:800},date)
 const higher=calc({...base,otherBudget:1200},date)
 assert.equal(lower.available,800)
 assert.equal(higher.available,1000)
})
