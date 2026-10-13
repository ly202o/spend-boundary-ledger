import test from 'node:test'
import assert from 'node:assert/strict'
import { shoppingSummary,validShoppingItems } from './shopping.ts'
test('购物清单预计总价按数量计算，已购项不影响待购额度，允许未定价',()=>{
 const items=[{id:'a',title:'纸巾',quantity:3,unitPrice:12.34,purchased:false},{id:'b',title:'饮料',quantity:1,unitPrice:8,purchased:true},{id:'c',title:'洗衣液',quantity:1,purchased:false}]
 assert.equal(validShoppingItems(items),true)
 assert.deepEqual(shoppingSummary(items),{pending:2,completed:1,estimate:37.02,unpriced:1})
 assert.equal(validShoppingItems([{...items[0],quantity:0}]),false)
 assert.equal(validShoppingItems([items[0],items[0]]),false)
})
