import test from 'node:test'
import assert from 'node:assert/strict'
import { readBackup } from './backup.ts'
import { initialLedger } from './store.ts'

test('完整备份保存多账本、分类图标、收入和显示偏好',()=>{
  const ledger={...initialLedger,categoryGroups:[{name:'三餐',children:['早餐'],childIcons:{早餐:'🥐'}}],incomes:[{id:'income',title:'工资',amount:5000,date:'2026-10-02',time:'08:30'}],chartSquareOpacity:55}
  const workspace={version:1,activeBookId:'b',books:[{id:'a',name:'日常',ledger:initialLedger},{id:'b',name:'测试',ledger}],trash:[]}
  const restored=readBackup(JSON.parse(JSON.stringify({workspace}))).workspace!
  assert.equal(restored.activeBookId,'b')
  assert.deepEqual(restored.books[1].ledger.incomes,ledger.incomes)
  assert.deepEqual(restored.books[1].ledger.categoryGroups,ledger.categoryGroups)
  assert.equal(restored.books[1].ledger.chartSquareOpacity,55)
})
test('兼容旧版单账本备份',()=>assert.equal(readBackup({ledger:initialLedger}).ledger?.monthlyBudget,4000))
test('无效备份与重复账本标识被拒绝',()=>{
  assert.throws(()=>readBackup({ledger:{...initialLedger,transactions:[{id:'bad',amount:'123'}]}}))
  assert.throws(()=>readBackup({workspace:{version:1,books:[{id:'a',name:'一',ledger:initialLedger},{id:'a',name:'二',ledger:initialLedger}],trash:[]}}))
})
