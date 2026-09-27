import type { Ledger } from './types'

const key = 'spend-boundary-ledger-v1'
const testKey = 'spend-boundary-ledger-test-v1'
const testModeKey = 'spend-boundary-ledger-test-mode'
const testDataStart = '2026-09-16'
export const initialLedger: Ledger = {
  monthlyBudget: 4000, mealBudget: 1500, mode: 'fixed', transactions: [], wishes: [],
  expenses: [
    { id: 'rent', title: '房租', amount: 1500, active: true, paid: false, category: '居住' },
    { id: 'bike', title: '电动车', amount: 200, active: true, paid: false, category: '交通' },
    { id: 'icloud', title: 'iCloud', amount: 6, active: true, paid: false, category: '订阅' },
    { id: 'phone', title: '电话费', amount: 30, active: true, paid: false, category: '通信' }
  ]
}
const currentMonth = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

/** Migrates the original one-time `paid` flag into the current month's payment. */
export function load(): Ledger {
  try {
    const ledger = JSON.parse(localStorage.getItem(key) || '') as Ledger
    if (!ledger?.expenses) return initialLedger
    return {
      ...ledger,
      expenses: ledger.expenses.map(expense =>
        expense.paid && !expense.paidMonth ? { ...expense, paidMonth: currentMonth() } : expense,
      ),
    }
  } catch { return initialLedger }
}
export function save(data: Ledger) { localStorage.setItem(key, JSON.stringify(data)) }
export function loadTest(): Ledger | null {
  try {
    const ledger = JSON.parse(localStorage.getItem(testKey) || '') as Ledger
    if (!ledger?.transactions) return null
    const filtered = ledger.transactions.filter(item => item.date >= testDataStart)
    if (filtered.length !== ledger.transactions.length) {
      const migrated = { ...ledger, transactions: filtered }
      saveTest(migrated)
      return migrated
    }
    return ledger
  } catch { return null }
}
export function saveTest(data: Ledger) { localStorage.setItem(testKey, JSON.stringify(data)) }
export function isTestMode() { return localStorage.getItem(testModeKey) === 'true' }
export function setStoredTestMode(active: boolean) { localStorage.setItem(testModeKey, String(active)) }
