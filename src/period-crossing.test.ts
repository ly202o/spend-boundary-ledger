import test from 'node:test'
import assert from 'node:assert/strict'
import { crossesBillingPeriod, showBillingRemainder } from './period.ts'
test('仅跨账期且周剩余超过实际账期剩余时提醒，不在新账期无差额时显示',()=>{
 assert.equal(showBillingRemainder('week',true,242.9,168.93),true)
 assert.equal(showBillingRemainder('week',true,350,1500),false)
 assert.equal(showBillingRemainder('week',true,168.93,168.93),false)
 assert.equal(showBillingRemainder('week',false,242.9,168.93),false)
 assert.equal(showBillingRemainder('week',true,242.9,168.93,1),false)
 assert.equal(showBillingRemainder('seven',true,242.9,168.93),false)
})

test('跨账期按周图完整七天判断，不改变周额或图表范围',()=>{
 assert.equal(crossesBillingPeriod('week',new Date(2026,9,12,19,25),17,'2026-10'),true)
 assert.equal(crossesBillingPeriod('week',new Date(2026,9,5,12),17,'2026-10'),false)
 assert.equal(crossesBillingPeriod('week',new Date(2026,8,17,12),17,'2026-10'),true)
 assert.equal(crossesBillingPeriod('seven',new Date(2026,8,18,12),17,'2026-10'),true)
 assert.equal(crossesBillingPeriod('month',new Date(2026,9,12,12),17,'2026-10'),false)
 assert.equal(crossesBillingPeriod('week',new Date(2026,9,12,12),12,'2026-11'),false)
})
