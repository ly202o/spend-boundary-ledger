import type { CategoryGroup, Ledger, MealTimes } from './types'

export const defaultMealTimes: MealTimes = { breakfast: '00:00', lunch: '11:00', dinner: '17:00', supper: '22:00' }
const minutes = (time: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? Number(time.slice(0, 2)) * 60 + Number(time.slice(3)) : NaN
export function validMealTimes(times: MealTimes): boolean {
  const values = [times.breakfast, times.lunch, times.dinner, times.supper].map(minutes)
  return values.every(Number.isFinite) && values.every((value, index) => index === 0 || value > values[index - 1])
}

export const defaultCategoryGroups: CategoryGroup[] = [
  { name: '三餐', icon:'🍽️', children: ['早餐', '午餐', '晚餐', '饮料', '夜宵', '其他'] },
  { name: '居住', icon:'🏠', children: ['房租', '水电', '物业', '其他'] },
  { name: '日常', icon:'🛒', children: ['日用品', '购物', '交通', '订阅', '其他'] },
  { name:'出行',icon:'🚕',children:['公交地铁','打车','加油','停车','旅行','其他'] },
  { name:'健康',icon:'💊',children:['药品','看病','健身','其他'] },
  { name:'娱乐',icon:'🎮',children:['电影','游戏','聚会','其他'] },
  { name:'学习',icon:'📚',children:['书籍','课程','文具','其他'] },
  { name:'人情',icon:'🎁',children:['礼物','红包','请客','其他'] },
]
export const commonCategoryIcons:Record<string,string>={'早餐':'🥐','午餐':'🍱','晚餐':'🍚','夜宵':'🍜','宵夜':'🍜','饮料':'🥤','咖啡':'☕','水果':'🍎','零食':'🍪','酒':'🍺','房租':'🏠','水电':'💡','物业':'🏢','日用品':'🧻','购物':'🛍️','交通':'🚌','订阅':'📱','公交地铁':'🚇','打车':'🚕','加油':'⛽','停车':'🅿️','旅行':'🧳','药品':'💊','看病':'🏥','健身':'🏃','电影':'🎬','游戏':'🎮','聚会':'🎉','书籍':'📚','课程':'🎓','文具':'✏️','礼物':'🎁','红包':'🧧','请客':'🍻','其他':'✨'}
export const childIcon=(group:CategoryGroup,name:string)=>group.childIcons?.[name]||commonCategoryIcons[name]||'✨'

export function categoryGroups(ledger: Ledger): CategoryGroup[] {
  if (ledger.categoryGroups) return ledger.categoryGroups.map(group=>({...group,children:[...group.children]}))
  const groups = defaultCategoryGroups.map(group => ({ ...group, children: [...group.children] }))
  for (const item of ledger.transactions) {
    if (!item.categoryGroup) continue
    let group = groups.find(group => group.name === item.categoryGroup)
    if (!group) { group = { name: item.categoryGroup, children: ['其他'] }; groups.push(group) }
    if (item.category && !group.children.includes(item.category)) group.children.splice(Math.max(0,group.children.length-1),0,item.category)
  }
  const legacy = (ledger.categories || []).filter(name => !groups.some(group => group.name === name || group.children.includes(name)))
  return legacy.length ? [...groups, { name: '自定义', children: [...legacy, '其他'] }] : groups
}

export function groupForCategory(groups: CategoryGroup[], category: string) {
  return groups.find(group => group.name === category || group.children.includes(category))?.name || '日常'
}

/** Use the chosen transaction time, while respecting customized meal categories. */
export function mealCategoryForTime(time: string, children: string[], mealTimes: MealTimes = defaultMealTimes): string {
  const current = minutes(time)
  if (!Number.isFinite(current)) return children[0] || '其他'
  const starts = validMealTimes(mealTimes) ? mealTimes : defaultMealTimes
  const preferred = current < minutes(starts.breakfast) || current >= minutes(starts.supper) ? '夜宵'
    : current < minutes(starts.lunch) ? '早餐'
    : current < minutes(starts.dinner) ? '午餐' : '晚餐'
  const choices = preferred === '夜宵' ? ['宵夜', '夜宵'] : [preferred]
  return choices.find(name => children.includes(name)) || children[0] || '其他'
}
