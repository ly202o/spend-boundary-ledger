import test from 'node:test'
import assert from 'node:assert/strict'
import { defaultRest, restStats } from './rest.ts'
test('休息卡片发薪、周五、期待日和当天收入估算',()=>{
 const s=restStats({...defaultRest,payday:16,eventDate:'2026-10-18',dailyWage:360},new Date(2026,9,12,13,30))
 assert.deepEqual(s,{payDays:4,friday:4,eventDays:6,earned:180})
 assert.equal(restStats({...defaultRest,payday:31},new Date(2026,1,28,12)).payDays,0)
 assert.equal(restStats({...defaultRest,dailyWage:360},new Date(2026,9,12,20)).earned,360)
 assert.equal(restStats(defaultRest,new Date(2026,9,16,8)).friday,0)
 assert.equal(restStats(defaultRest,new Date(2026,9,16,8)).payDays,30)
})
