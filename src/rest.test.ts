import test from 'node:test'
import assert from 'node:assert/strict'
import { defaultRest, restStats, workSummary, punchMinutes, restSettings, expectedEnd, updatePunch, validLunch, lunchEnd, lunchDuration } from './rest.ts'
test('午休时段正常时间通过校验，时长正确换算小时',()=>{
 assert.equal(validLunch('12:00',90),true)
 assert.equal(lunchEnd('12:00',90),'13:30')
 assert.equal(lunchDuration('12:00','13:30')/60,1.5)
 assert.equal(validLunch('12:00',0),true)
 assert.equal(validLunch('bad',90),false)
 assert.equal(validLunch('13:30',-90),false)
 assert.equal(validLunch('23:30',90),false)
})
test('月薪按月份自然日均摊并跟随打卡进度，覆盖旧日薪',()=>{
 const settings={...defaultRest,dailyWage:999,monthlySalary:3100}
 assert.equal(restStats(settings,new Date(2026,9,12,19)).earned,100)
 assert.equal(restStats(settings,new Date(2026,9,12,14,15)).earned,100*195/480)
 assert.equal(restStats({...settings,monthlySalary:2800},new Date(2026,1,12,19)).earned,100)
 assert.equal(restStats({...settings,monthlySalary:0},new Date(2026,9,12,19)).earned,0)
})
test('每日工作时段当天覆盖、次日恢复默认且估算不超出收入',()=>{
 const settings={...defaultRest,dailyWage:360,todayWork:{date:'2026-10-12',start:'12:00',end:'20:00'}}
 assert.ok(Math.abs(restStats(settings,new Date(2026,9,12,16)).earned-360*150/390)<0.000001)
 assert.equal(restStats(settings,new Date(2026,9,13,16)).earned,225)
 assert.equal(restStats(settings,new Date(2026,9,12,10)).earned,0)
 assert.equal(restStats(settings,new Date(2026,9,12,22)).earned,360)
})
test('休息卡片发薪、周五、期待日和当天收入估算',()=>{
 const s=restStats({...defaultRest,payday:16,eventDate:'2026-10-18',dailyWage:360},new Date(2026,9,12,13,30))
 assert.deepEqual(s,{payDays:4,friday:4,eventDays:6,earned:112.5})
 assert.equal(restStats({...defaultRest,payday:31},new Date(2026,1,28,12)).payDays,0)
 assert.equal(restStats({...defaultRest,dailyWage:360},new Date(2026,9,12,20)).earned,360)
 assert.equal(restStats(defaultRest,new Date(2026,9,16,8)).friday,0)
 assert.equal(restStats(defaultRest,new Date(2026,9,16,8)).payDays,30)
})

test('打卡时长按实际记录汇总，缺失、无效与其他月份不计入',()=>{
 const settings={...defaultRest,dailyWage:380,punches:{'2026-10-12':{start:'09:45',end:'18:45'},'2026-10-11':{start:'09:30',end:'19:00'},'2026-10-10':{start:'09:30'},'2026-09-30':{start:'09:30',end:'19:00'}}}
 assert.equal(workSummary(settings,new Date(2026,9,12)).days,2)
 assert.equal(workSummary(settings,new Date(2026,9,12)).totalMinutes,930)
 assert.equal(punchMinutes('09:45','18:45'),540)
 assert.equal(punchMinutes('19:00','09:30'),null)
 assert.equal(punchMinutes('30:00','31:00'),null)
 assert.equal(restStats(settings,new Date(2026,9,12,20)).earned,356.25)
 assert.equal(restSettings({...defaultRest,workStart:'09:00',workEnd:'18:00'}).workStart,'09:30')
 assert.equal(restSettings({...defaultRest,workStart:'10:00',workEnd:'20:00'}).workStart,'10:00')
})

test('自动下班预填包含可编辑午休，需确认才计入实际工时',()=>{
 assert.deepEqual(expectedEnd('09:30',defaultRest),{end:'19:00',endNextDay:false})
 assert.deepEqual(expectedEnd('09:00',defaultRest),{end:'18:30',endNextDay:false})
 assert.deepEqual(expectedEnd('09:30',{...defaultRest,breakMinutes:60}),{end:'18:30',endNextDay:false})
 assert.deepEqual(expectedEnd('16:00',defaultRest),{end:'00:00',endNextDay:true})
 const punch=updatePunch({},'start','09:30',defaultRest)
 assert.equal(punch.endEstimated,true)
 const settings={...defaultRest,punches:{'2026-10-12':punch}}
 assert.equal(workSummary(settings,new Date(2026,9,12)).days,0)
 const confirmed=updatePunch(punch,'end','19:00',defaultRest)
 assert.equal(workSummary({...settings,punches:{'2026-10-12':confirmed}},new Date(2026,9,12)).totalMinutes,480)
 assert.equal(updatePunch(confirmed,'start','09:00',defaultRest).end,'19:00')
 assert.equal(updatePunch(punch,'start','09:00',defaultRest).end,'18:30')
 assert.equal(restStats({...settings,monthlySalary:3100},new Date(2026,9,12,12,15)).earned,restStats({...settings,monthlySalary:3100},new Date(2026,9,12,13,15)).earned)
})
