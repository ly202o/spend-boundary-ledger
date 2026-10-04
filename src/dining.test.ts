import test from 'node:test'
import assert from 'node:assert/strict'
import { initialLedger,normalizeLedger } from './store.ts'
import { diningKind } from './dining.ts'
import { calc } from './budget.ts'
import { automaticDiningSelection,categoryGroups } from './categories.ts'

test('旧夜宵与饮料迁移后不再占用三餐预算，迁移可重复执行',()=>{
  const ledger=normalizeLedger({...initialLedger,transactions:[{id:'1',title:'午餐',category:'午餐',date:'2026-10-04',amount:20,source:'meal'},{id:'2',title:'夜宵',category:'夜宵',date:'2026-10-04',amount:30,source:'meal'},{id:'3',title:'奶茶',category:'饮料',date:'2026-10-04',amount:15,source:'meal'}]})
  assert.deepEqual(ledger.transactions.map(diningKind),['meal','night','snack'])
  assert.equal(calc(ledger,new Date(2026,9,4,12)).mealSpent,20)
  assert.equal(calc(ledger,new Date(2026,9,4,12)).spent,65)
  assert.equal(ledger.transactions[1].budgetId,ledger.budgets?.find(item=>item.kind==='night')?.id)
  assert.deepEqual(normalizeLedger(ledger),ledger)
})
test('夜宵和零食饮品有独立可编辑预留，不能重复扣可支配',()=>{
  const ledger=normalizeLedger({...initialLedger,transactions:[{id:'night',title:'夜宵',category:'夜宵',date:'2026-10-04',amount:30,source:'general'}]})
  const next={...ledger,budgets:ledger.budgets!.map(item=>({...item,amount:item.kind==='night'?200:item.kind==='snack'?100:item.amount}))}
  assert.equal(calc(next,new Date(2026,9,4,12)).available,700)
  assert.equal(calc(next,new Date(2026,9,4,12)).mealSpent,0)
})
test('按默认或自定义时间选择独立夜宵大类，三餐只有三顿',()=>{
  const groups=categoryGroups(initialLedger)
  assert.deepEqual(groups.find(item=>item.name==='三餐')?.children,['早餐','午餐','晚餐'])
  assert.deepEqual(automaticDiningSelection('22:30',groups),{group:'夜宵',category:'夜宵'})
  assert.deepEqual(automaticDiningSelection('12:30',groups),{group:'三餐',category:'午餐'})
  assert.deepEqual(automaticDiningSelection('01:30',groups,{breakfast:'06:00',lunch:'11:00',dinner:'17:00',supper:'21:00'}),{group:'夜宵',category:'夜宵'})
})
