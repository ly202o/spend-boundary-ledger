import test from 'node:test'
import assert from 'node:assert/strict'
import {filterTransactions} from './record-filter.ts'
const items=[
  {id:'1',title:'午餐',amount:20,category:'午餐',categoryGroup:'三餐',date:'2026-10-04',time:'12:00'},
  {id:'2',title:'奶茶',amount:15,category:'奶茶',categoryGroup:'零食饮品',date:'2026-10-04',time:'12:01'},
  {id:'3',title:'夜宵',amount:30,category:'夜宵',categoryGroup:'夜宵',date:'2026-10-04',time:'22:10'},
  {id:'4',title:'午餐',amount:18,category:'午餐',categoryGroup:'三餐',date:'2026-10-05',time:'12:00'},
]
test('时间区间精确到分钟，包含边界而且不会混入其他日期',()=>{
  assert.deepEqual(filterTransactions(items,{from:'2026-10-04T12:00',to:'2026-10-04T12:01'}).map(item=>item.id),['1','2'])
  assert.equal(filterTransactions(items,{from:'2026-10-05T12:00',to:'2026-10-04T12:00'}).length,0)
})
test('日期、大类、小类筛选取交集，清空条件恢复全部',()=>{
  assert.deepEqual(filterTransactions(items,{date:'2026-10-04',group:'三餐',category:'午餐'}).map(item=>item.id),['1'])
  assert.equal(filterTransactions(items,{group:'夜宵',category:'午餐'}).length,0)
  assert.equal(filterTransactions(items,{}).length,4)
})
