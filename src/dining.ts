import type { SpendingCategory, Transaction } from './types'

export const spendingLabels:Record<SpendingCategory,string>={food:'饮食支出',meal:'三餐支出',night:'夜宵支出',snack:'零食饮品',other:'饮食外支出',all:'全部支出'}
const snacks=new Set(['饮料','奶茶','咖啡','可乐','雪碧','零食','小吃','水果','酒','甜品','冰淇淋'])
export function diningKind(item:Transaction):'meal'|'night'|'snack'|null {
  if(item.categoryGroup==='夜宵'||item.category==='夜宵'||item.category==='宵夜')return 'night'
  if(item.categoryGroup==='零食饮品'||snacks.has(item.category))return 'snack'
  if(item.diningKind)return item.diningKind
  if(item.source==='meal'||item.categoryGroup==='三餐'||item.categoryGroup==='饮食')return 'meal'
  return null
}
export function diningBudgetId(kind:'meal'|'night'|'snack',budgets:{id:string;kind:string}[]) {
  return (budgets.find(item=>item.kind===kind)||budgets.find(item=>item.kind==='meal'))?.id
}
