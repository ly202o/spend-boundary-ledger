import test from 'node:test'
import assert from 'node:assert/strict'
import { defaultRest, restStats } from './rest.ts'
test('每日工作时段当天覆盖、次日恢复默认且估算不超出收入',()=>{
 const settings={...defaultRest,dailyWage:360,todayWork:{date:'2026-10-12',start:'12:00',end:'20:00'}}
 assert.equal(restStats(settings,new Date(2026,9,12,16)).earned,180)
 assert.equal(restStats(settings,new Date(2026,9,13,16)).earned,280)
 assert.equal(restStats(settings,new Date(2026,9,12,10)).earned,0)
 assert.equal(restStats(settings,new Date(2026,9,12,22)).earned,360)
})
test('休息卡片发薪、周五、期待日和当天收入估算',()=>{
 const s=restStats({...defaultRest,payday:16,eventDate:'2026-10-18',dailyWage:360},new Date(2026,9,12,13,30))
 assert.deepEqual(s,{payDays:4,friday:4,eventDays:6,earned:180})
 assert.equal(restStats({...defaultRest,payday:31},new Date(2026,1,28,12)).payDays,0)
 assert.equal(restStats({...defaultRest,dailyWage:360},new Date(2026,9,12,20)).earned,360)
 assert.equal(restStats(defaultRest,new Date(2026,9,16,8)).friday,0)
 assert.equal(restStats(defaultRest,new Date(2026,9,16,8)).payDays,30)
})
