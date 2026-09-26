import assert from 'node:assert/strict'
import test from 'node:test'
import { spendingPeriodDays, spendingPeriodRange, spendingPeriodSummary } from './period.ts'

test('本周从周一开始', () => {
  const range = spendingPeriodRange('week', new Date(2026, 8, 26, 18))
  assert.equal(range.startKey, '2026-09-21')
  assert.equal(range.endKey, '2026-09-26')
})

test('近七日包含今天共七天', () => {
  const range = spendingPeriodRange('seven', new Date(2026, 8, 26, 18))
  assert.equal(range.startKey, '2026-09-20')
})

test('月账期从16日开始', () => {
  assert.equal(spendingPeriodRange('month', new Date(2026, 8, 26)).startKey, '2026-09-16')
  assert.equal(spendingPeriodRange('month', new Date(2026, 8, 10)).startKey, '2026-08-16')
})

test('周期支出只统计范围内账目', () => {
  const summary = spendingPeriodSummary([
    {id:'1',title:'午餐',amount:20,category:'三餐',date:'2026-09-21'},
    {id:'2',title:'旧账',amount:99,category:'日常',date:'2026-09-20'}
  ], 'week', new Date(2026, 8, 26))
  assert.equal(summary.total, 20)
  assert.equal(summary.count, 1)
})

test('周图固定生成周一到周日七根柱', () => {
  const days = spendingPeriodDays([], 'week', new Date(2026, 8, 23))
  assert.equal(days.length, 7)
  assert.equal(days[0].dateKey, '2026-09-21')
  assert.equal(days[6].dateKey, '2026-09-27')
})

test('月热力格覆盖16日至下月15日', () => {
  const days = spendingPeriodDays([], 'month', new Date(2026, 8, 26))
  assert.equal(days[0].dateKey, '2026-09-16')
  assert.equal(days.at(-1)?.dateKey, '2026-10-15')
})
