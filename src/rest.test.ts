import test from 'node:test'
import assert from 'node:assert/strict'
import { defaultRest, restStats, workSummary, punchMinutes, restSettings } from './rest.ts'
test('每日工作时段当天覆盖、次日恢复默认且估算不超出收入',()=>{
 const settings={...defaultRest,dailyWage:360,todayWork:{date:'2026-10-12',start:'12:00',end:'20:00'}}
 assert.equal(restStats(settings,new Date(2026,9,12,16)).earned,180)
 assert.equal(restStats(settings,new Date(2026,9,13,16)).earned,360*390/570)
 assert.equal(restStats(settings,new Date(2026,9,12,10)).earned,0)
 assert.equal(restStats(settings,new Date(2026,9,12,22)).earned,360)
})
test('休息卡片发薪、周五、期待日和当天收入估算',()=>{
 const s=restStats({...defaultRest,payday:16,eventDate:'2026-10-18',dailyWage:360},new Date(2026,9,12,13,30))
 assert.deepEqual(s,{payDays:4,friday:4,eventDays:6,earned:360*240/570})
 assert.equal(restStats({...defaultRest,payday:31},new Date(2026,1,28,12)).payDays,0)
 assert.equal(restStats({...defaultRest,dailyWage:360},new Date(2026,9,12,20)).earned,360)
 assert.equal(restStats(defaultRest,new Date(2026,9,16,8)).friday,0)
 assert.equal(restStats(defaultRest,new Date(2026,9,16,8)).payDays,30)
})

test('打卡时长按实际记录汇总，缺失、无效与其他月份不计入',()=>{
 const settings={...defaultRest,dailyWage:380,punches:{'2026-10-12':{start:'09:45',end:'18:45'},'2026-10-11':{start:'09:30',end:'19:00'},'2026-10-10':{start:'09:30'},'2026-09-30':{start:'09:30',end:'19:00'}}}
 assert.equal(workSummary(settings,new Date(2026,9,12)).days,2)
 assert.equal(workSummary(settings,new Date(2026,9,12)).totalMinutes,1110)
 assert.equal(punchMinutes('09:45','18:45'),540)
 assert.equal(punchMinutes('19:00','09:30'),null)
 assert.equal(punchMinutes('30:00','31:00'),null)
 assert.equal(restStats(settings,new Date(2026,9,12,20)).earned,360)
 assert.equal(restSettings({...defaultRest,workStart:'09:00',workEnd:'18:00'}).workStart,'09:30')
 assert.equal(restSettings({...defaultRest,workStart:'10:00',workEnd:'20:00'}).workStart,'10:00')
})
