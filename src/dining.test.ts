import test from 'node:test'
import assert from 'node:assert/strict'
import { initialLedger,normalizeLedger } from './store.ts'
import { diningKind } from './dining.ts'
import { calc } from './budget.ts'
import { automaticDiningSelection,categoryGroups } from './categories.ts'

test('旧三餐、夜宵与饮料合并饮食大类，细分类型保留且迁移可重复执行',()=>{
  const ledger=normalizeLedger({...initialLedger,transactions:[{id:'1',title:'午餐',category:'午餐',date:'2026-10-04',amount:20,source:'meal'},{id:'2',title:'夜宵',category:'夜宵',date:'2026-10-04',amount:30,source:'meal'},{id:'3',title:'奶茶',category:'饮料',date:'2026-10-04',amount:15,source:'meal'}]})
  assert.deepEqual(ledger.transactions.map(diningKind),['meal','night','snack'])
  assert.equal(calc(ledger,new Date(2026,9,4,12)).mealSpent,65)
  assert.equal(calc(ledger,new Date(2026,9,4,12)).spent,65)
  assert.equal(ledger.transactions[1].budgetId,ledger.budgets?.find(item=>item.kind==='meal')?.id)
  assert.ok(ledger.transactions.every(item=>item.categoryGroup==='饮食'))
  assert.deepEqual(normalizeLedger(ledger),ledger)
})
test('旧饮食预算合并保留总额，不重复扣弹性余额',()=>{
  const ledger=normalizeLedger({...initialLedger,budgets:[...initialLedger.budgets!,{id:'night',name:'夜宵',kind:'night',amount:200},{id:'snack',name:'零食',kind:'snack',amount:100}],transactions:[{id:'night',title:'夜宵',category:'夜宵',date:'2026-10-04',amount:30,source:'general'}]})
  assert.equal(ledger.mealBudget,1800)
  assert.equal(ledger.budgets?.filter(item=>['meal','night','snack'].includes(item.kind)).length,1)
  assert.equal(calc(ledger,new Date(2026,9,4,12)).available,700)
  assert.equal(calc(ledger,new Date(2026,9,4,12)).mealSpent,30)
  assert.deepEqual(automaticDiningSelection('22:30',categoryGroups(ledger)),{group:'饮食',category:'夜宵'})
})
test('按默认或自定义时间选择独立夜宵大类，三餐只有三顿',()=>{
  const groups=categoryGroups(initialLedger)
  assert.deepEqual(groups.find(item=>item.name==='三餐')?.children,['早餐','午餐','晚餐'])
  assert.deepEqual(automaticDiningSelection('22:30',groups),{group:'夜宵',category:'夜宵'})
  assert.deepEqual(automaticDiningSelection('12:30',groups),{group:'三餐',category:'午餐'})
  assert.deepEqual(automaticDiningSelection('01:30',groups,{breakfast:'06:00',lunch:'11:00',dinner:'17:00',supper:'21:00'}),{group:'夜宵',category:'夜宵'})
})
