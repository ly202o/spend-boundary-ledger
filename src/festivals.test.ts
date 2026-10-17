import test from 'node:test'
import assert from 'node:assert/strict'
import { nearestFestival } from './festivals.ts'
test('最近节日按实际公历日计算，重阳节当天保留到零点后再切换',()=>{
 assert.deepEqual(nearestFestival(new Date(2026,9,17,23)),{name:'重阳节',date:'2026-10-18',days:1})
 assert.equal(nearestFestival(new Date(2026,9,18))?.days,0)
 assert.notEqual(nearestFestival(new Date(2026,9,19))?.date,'2026-10-18')
 assert.equal(nearestFestival(new Date(2026,11,31))?.date,'2027-01-01')
})
