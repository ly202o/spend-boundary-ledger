import type { CategoryGroup, Ledger } from './types'

export const defaultCategoryGroups: CategoryGroup[] = [
  { name: '三餐', children: ['早餐', '午餐', '晚餐', '饮料', '夜宵', '其他'] },
  { name: '居住', children: ['房租', '水电', '物业', '其他'] },
  { name: '日常', children: ['日用品', '购物', '交通', '订阅', '其他'] },
]

export function categoryGroups(ledger: Ledger): CategoryGroup[] {
  const groups = (ledger.categoryGroups?.length ? ledger.categoryGroups : defaultCategoryGroups).map(group => ({ ...group, children: [...group.children] }))
  for (const item of ledger.transactions) {
    if (!item.categoryGroup) continue
    let group = groups.find(group => group.name === item.categoryGroup)
    if (!group) { group = { name: item.categoryGroup, children: ['其他'] }; groups.push(group) }
    if (item.category && !group.children.includes(item.category)) group.children.splice(Math.max(0,group.children.length-1),0,item.category)
  }
  if (ledger.categoryGroups?.length) return groups
  const legacy = (ledger.categories || []).filter(name => !groups.some(group => group.name === name || group.children.includes(name)))
  return legacy.length ? [...groups, { name: '自定义', children: [...legacy, '其他'] }] : groups
}

export function groupForCategory(groups: CategoryGroup[], category: string) {
  return groups.find(group => group.name === category || group.children.includes(category))?.name || '日常'
}

/** Use the chosen transaction time, while respecting customized meal categories. */
export function mealCategoryForTime(time: string, children: string[]): string {
  const hour = Number(time.slice(0, 2))
  const preferred = hour < 11 ? '早餐' : hour < 17 ? '午餐' : hour < 22 ? '晚餐' : '夜宵'
  const choices = preferred === '夜宵' ? ['宵夜', '夜宵'] : [preferred]
  return choices.find(name => children.includes(name)) || children[0] || '其他'
}
