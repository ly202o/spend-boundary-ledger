import type { ShoppingItem } from './types'
export function shoppingSummary(items:ShoppingItem[]){
 const pending=items.filter(item=>!item.purchased)
 return {pending:pending.length,completed:items.length-pending.length,estimate:pending.reduce((sum,item)=>sum+Math.round((item.unitPrice??0)*100)*item.quantity,0)/100,unpriced:pending.filter(item=>item.unitPrice===undefined).length}
}
export function validShoppingItems(value:unknown):value is ShoppingItem[]{
 return Array.isArray(value)&&value.every(item=>item&&typeof item==='object'&&typeof item.id==='string'&&typeof item.title==='string'&&Number.isInteger(item.quantity)&&item.quantity>=1&&item.quantity<=9999&&typeof item.purchased==='boolean'&&(item.unitPrice===undefined||(typeof item.unitPrice==='number'&&Number.isFinite(item.unitPrice)&&item.unitPrice>=0&&item.unitPrice<=100000000)))&&new Set(value.map(item=>item.id)).size===value.length
}
