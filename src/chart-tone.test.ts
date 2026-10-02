import test from 'node:test'
import assert from 'node:assert/strict'
import { defaultChartColors, spendingTone, validChartColors, validChartThresholds } from './chart-tone.ts'

test('柱图与月历共用五级超支界线', () => {
  assert.equal(spendingTone(0, 50), 'zero')
  assert.equal(spendingTone(40, 50), 'within')
  assert.equal(spendingTone(40.01, 50), 'near')
  assert.equal(spendingTone(50, 50), 'near')
  assert.equal(spendingTone(50.01, 50), 'over')
  assert.equal(spendingTone(57.5, 50), 'over')
  assert.equal(spendingTone(57.51, 50), 'moderate')
  assert.equal(spendingTone(65, 50), 'moderate')
  assert.equal(spendingTone(65.01, 50), 'severe')
  assert.equal(spendingTone(1, 0), 'severe')
})

test('颜色阈值可编辑，并拒绝无效比例', () => {
  const custom = { nearPercent: 90, severePercent: 150 }
  assert.equal(validChartThresholds(custom), true)
  assert.equal(spendingTone(44, 50, custom), 'within')
  assert.equal(spendingTone(46, 50, custom), 'near')
  assert.equal(spendingTone(70, 50, custom), 'moderate')
  assert.equal(spendingTone(76, 50, custom), 'severe')
  assert.equal(validChartThresholds({ nearPercent: 110, severePercent: 150 }), false)
  assert.equal(validChartThresholds({ nearPercent: 80, severePercent: 99 }), false)
})

test('四档支出颜色可编辑，且拒绝不安全的 CSS 色值',()=>{
  assert.equal(validChartColors(defaultChartColors),true)
  assert.equal(validChartColors({...defaultChartColors,over:'#ffa020'}),true)
  assert.equal(validChartColors({...defaultChartColors,over:'red;position:absolute'}),false)
})
