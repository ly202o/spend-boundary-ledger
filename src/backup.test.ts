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
  assert.deepEqual(restored.books[1].ledger.categoryGroups?.[0].childIcons,ledger.categoryGroups[0].childIcons)
  assert.deepEqual(restored.books[1].ledger.categoryGroups?.[0].children,ledger.categoryGroups[0].children)
  assert.equal(restored.books[1].ledger.chartSquareOpacity,55)
})
test('兼容旧版单账本备份',()=>assert.equal(readBackup({ledger:initialLedger}).ledger?.monthlyBudget,4000))

test('完整和单账本备份均还原所有显示及账本设置',()=>{
 const ledger={...initialLedger,mode:'fixed' as const,fixedDailyAmount:66,billingStartDay:12,mealTimes:{breakfast:'06:00',lunch:'12:00',dinner:'18:00',supper:'23:00'},display:{groupThousands:true,font:'serif' as const},homeCards:[{id:'c',type:'spending' as const,category:'night' as const,period:'month' as const}],chartColors:{within:'#112233',near:'#223344',over:'#334455',moderate:'#445566',severe:'#556677'},chartThresholds:{nearPercent:75,moderatePercent:120,severePercent:150},chartSquareOpacity:42}
 const workspace={version:1,activeBookId:'a',books:[{id:'a',name:'日常',ledger}],trash:[]}
 for(const restored of [readBackup(JSON.parse(JSON.stringify({ledger}))).ledger!,readBackup(JSON.parse(JSON.stringify({workspace}))).workspace!.books[0].ledger]){
  for(const key of ['mode','fixedDailyAmount','billingStartDay','mealTimes','display','homeCards','chartColors','chartThresholds','chartSquareOpacity'] as const)assert.deepEqual(restored[key],ledger[key])
 }
})
test('无效备份与重复账本标识被拒绝',()=>{
  assert.throws(()=>readBackup({ledger:{...initialLedger,transactions:[{id:'bad',amount:'123'}]}}))
  assert.throws(()=>readBackup({workspace:{version:1,books:[{id:'a',name:'一',ledger:initialLedger},{id:'a',name:'二',ledger:initialLedger}],trash:[]}}))
})
