import type { Ledger } from './types'

const key = 'spend-boundary-ledger-v1'
export const initialLedger: Ledger = {
  monthlyBudget: 4000, mealBudget: 1500, mode: 'dynamic', transactions: [], wishes: [],
  expenses: [
    { id: 'rent', title: '房租', amount: 1500, active: true, paid: false, category: '居住' },
    { id: 'bike', title: '电动车', amount: 200, active: true, paid: false, category: '交通' },
    { id: 'icloud', title: 'iCloud', amount: 6, active: true, paid: false, category: '订阅' },
    { id: 'phone', title: '电话费', amount: 30, active: true, paid: false, category: '通信' }
  ]
}
export function load(): Ledger { try { return JSON.parse(localStorage.getItem(key) || '') } catch { return initialLedger } }
export function save(data: Ledger) { localStorage.setItem(key, JSON.stringify(data)) }
