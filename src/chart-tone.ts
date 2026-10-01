import type { ChartColors, ChartThresholds } from './types'

export const defaultChartThresholds: ChartThresholds = { nearPercent: 80, severePercent: 130 }
export const defaultChartColors: ChartColors = { within: '#087d72', near: '#92ba3d', over: '#e88725', severe: '#d95047' }
export const validChartColors = (colors: ChartColors) => Object.values(colors).every(color => /^#[0-9a-fA-F]{6}$/.test(color))

export function validChartThresholds(value: ChartThresholds): boolean {
  return Number.isFinite(value.nearPercent) && Number.isFinite(value.severePercent)
    && value.nearPercent >= 1 && value.nearPercent <= 100
    && value.severePercent >= 100 && value.severePercent <= 500
}

export function spendingTone(amount: number, dailyBudget: number, configured?: ChartThresholds): 'zero' | 'within' | 'near' | 'over' | 'severe' {
  if (amount <= 0) return 'zero'
  if (dailyBudget <= 0) return 'severe'
  const thresholds = configured && validChartThresholds(configured) ? configured : defaultChartThresholds
  const percent = amount / dailyBudget * 100
  if (percent <= thresholds.nearPercent) return 'within'
  if (percent <= 100) return 'near'
  if (percent <= thresholds.severePercent) return 'over'
  return 'severe'
}
