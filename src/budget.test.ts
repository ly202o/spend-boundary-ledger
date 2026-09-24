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
test('当天三餐只扣一次，历史月份不混入',()=>{
 const l:Ledger={...base,transactions:[{id:'1',title:'午饭',amount:32,category:'三餐',date:'2026-09-01',source:'meal'},{id:'2',title:'旧消费',amount:999,category:'其他',date:'2026-08-31',source:'general'}]}
 assert.equal(calc(l,date).todayLeft,18)
 assert.equal(calc(l,date).available,1000)
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
