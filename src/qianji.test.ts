import test from 'node:test'
import assert from 'node:assert/strict'
import { parseQianJiRows, QIANJI_HEADERS, transactionsToQianJiRows } from './qianji.ts'

test('imports QianJi expenses and skips income and duplicates', () => {
  const rows = [
    [...QIANJI_HEADERS],
    ['a1','2026-09-27 12:30:00','三餐账本','三餐','午餐','支出',18.5,'CNY','','','鸡腿饭','','','','','','','',''],
    ['a2','2026-09-27 13:00:00','三餐账本','预算','','收入',50,'CNY','','','','','','','','','','',''],
    ['old','2026-09-26 18:00:00','三餐账本','三餐','晚餐','支出',22,'CNY','','','','','','','','','','','']
  ]
  const result = parseQianJiRows(rows, new Set(['old']))
  assert.equal(result.transactions.length, 1)
  assert.deepEqual(result.transactions[0], { id:'a1', title:'午餐', amount:18.5, category:'午餐', categoryGroup:'三餐', date:'2026-09-27', time:'12:30', note:'鸡腿饭', source:'meal' })
  assert.equal(result.skippedIncome, 1)
  assert.equal(result.duplicates, 1)
})

test('exports the QianJi column layout', () => {
  const rows = transactionsToQianJiRows([{ id:'1', title:'咖啡', amount:12, category:'饮料', date:'2026-09-27', source:'meal' }])
  assert.deepEqual(rows[0], [...QIANJI_HEADERS])
  assert.equal(rows[1][2], '三餐账本')
  assert.equal(rows[1][4], '咖啡')
  assert.equal(rows[1][5], '支出')
  assert.equal(rows[1][1], '2026-09-27')
})
