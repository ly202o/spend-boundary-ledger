import type { ChartColors, ChartThresholds } from './types'

export const defaultChartThresholds: ChartThresholds = { nearPercent: 80, moderatePercent: 115, severePercent: 130 }
export const defaultChartColors: ChartColors = { within: '#30a46c', near: '#a3be42', over: '#f5d780', moderate: '#f08c46', severe: '#e5484d' }
export const chartStyles: {name:string;colors:ChartColors}[] = [
  {name:'清新自然',colors:defaultChartColors},
  {name:'高级灰',colors:{within:'#69877c',near:'#a4aa83',over:'#d7c99b',moderate:'#bd9273',severe:'#ad7478'}},
  {name:'高饱和',colors:{within:'#00a86b',near:'#9bc900',over:'#ffe066',moderate:'#ff8500',severe:'#f03e3e'}},
  {name:'柔和奶油',colors:{within:'#86b99b',near:'#bdca80',over:'#f3dfa2',moderate:'#eab38a',severe:'#d88f91'}},
  {name:'复古大地',colors:{within:'#68846b',near:'#a4ad63',over:'#e0c780',moderate:'#c8874e',severe:'#b55c50'}},
  {name:'深色质感',colors:{within:'#267a59',near:'#798e31',over:'#dec369',moderate:'#c66d2d',severe:'#af3745'}},
]
export const validChartColors = (colors: ChartColors) => Object.values(colors).every(color => /^#[0-9a-fA-F]{6}$/.test(color))

export function validChartThresholds(value: ChartThresholds): boolean {
  return Number.isFinite(value.nearPercent) && Number.isFinite(value.severePercent)
    && value.nearPercent >= 1 && value.nearPercent <= 100
    && (value.moderatePercent ?? 115) > 100 && (value.moderatePercent ?? 115) < value.severePercent
    && value.severePercent > 100 && value.severePercent <= 500
}

export function spendingTone(amount: number, dailyBudget: number, configured?: ChartThresholds): 'zero' | 'within' | 'near' | 'over' | 'moderate' | 'severe' {
  if (amount <= 0) return 'zero'
  if (dailyBudget <= 0) return 'severe'
  const thresholds = configured && validChartThresholds(configured) ? configured : defaultChartThresholds
  const percent = amount / dailyBudget * 100
  if (percent <= thresholds.nearPercent) return 'within'
  if (percent <= 100) return 'near'
  if (percent <= (thresholds.moderatePercent ?? 115)) return 'over'
  if (percent <= thresholds.severePercent) return 'moderate'
  return 'severe'
}
