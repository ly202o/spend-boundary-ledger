import test from 'node:test'
import assert from 'node:assert/strict'
import { categoryGroups, groupForCategory, mealCategoryForTime } from './categories.ts'
import { normalizeLedger } from './store.ts'
import type { Ledger } from './types'

const ledger: Ledger = { monthlyBudget:4000, mealBudget:1500, mode:'fixed', transactions:[], incomes:[], wishes:[], expenses:[] }

test('旧账本房租迁移为独立预算，不再新增固定支出', () => {
  const migrated = normalizeLedger(ledger)
  assert.equal(migrated.rentBudget,1500)
  assert.equal(migrated.expenses.length,0)
  assert.equal(normalizeLedger(migrated).rentBudget,1500)
  assert.equal(normalizeLedger({...ledger,expenses:[{id:'custom',title:'房租',amount:1800,active:true,paid:false,category:'居住'}]}).rentBudget,1800)
})

test('导入的自定义大类和小类在记账选择中可见', () => {
  const groups=categoryGroups({...ledger,transactions:[{id:'1',title:'地铁',amount:3,category:'地铁',categoryGroup:'出行',date:'2026-09-20'}]})
  assert.deepEqual(groups.find(group=>group.name==='出行')?.children,['地铁','其他'])
  assert.equal(groupForCategory(groups,'地铁'),'出行')
})

test('新记账按时间选择三餐小类，手动分类可继续覆盖', () => {
  const choices=categoryGroups(ledger)[0].children
  assert.equal(mealCategoryForTime('10:59',choices),'早餐')
  assert.equal(mealCategoryForTime('11:00',choices),'午餐')
  assert.equal(mealCategoryForTime('15:59',choices),'午餐')
  assert.equal(mealCategoryForTime('16:59',choices),'午餐')
  assert.equal(mealCategoryForTime('17:00',choices),'晚餐')
  assert.equal(mealCategoryForTime('21:59',choices),'晚餐')
  assert.equal(mealCategoryForTime('22:00',choices),'夜宵')
  assert.equal(mealCategoryForTime('23:30',['宵夜','其他']),'宵夜')
})
