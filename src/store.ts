import type { Ledger, LedgerWorkspace, TrashEntry } from './types'
import { categoryGroups, defaultCategoryGroups } from './categories.ts'
import { diningBudgetId, diningKind } from './dining.ts'

const key = 'spend-boundary-ledger-v1'
const testKey = 'spend-boundary-ledger-test-v1'
const testModeKey = 'spend-boundary-ledger-test-mode'
const workspaceKey = 'spend-boundary-ledger-books-v1'
const testDataStart = '2026-09-16'
export const initialLedger: Ledger = {
  monthlyBudget: 4000, mealBudget: 1500, rentBudget: 1500, otherBudget: 1000, budgets: [{ id:'meal', name:'三餐', amount:1500, kind:'meal' }, { id:'rent', name:'房租', amount:1500, kind:'rent' }], budgetVersion: 4, mode: 'fixed', billingStartDay: 17, transactions: [], incomes: [], wishes: [], expenses: []
}
const currentMonth = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}
export function normalizeLedger(ledger: Ledger): Ledger {
  if(ledger.diningVersion!==1){
    const budgets=[...(ledger.budgets??[{id:'meal',name:'三餐',amount:ledger.mealBudget,kind:'meal' as const},{id:'rent',name:'房租',amount:ledger.rentBudget??1500,kind:'rent' as const}])]
    for(const kind of ['night','snack'] as const)if(!budgets.some(item=>item.kind===kind))budgets.push({id:kind,name:kind==='night'?'夜宵':'零食饮品',amount:0,kind})
    let groups=categoryGroups(ledger).map(group=>group.name==='三餐'?{...group,children:group.children.filter(name=>!['宵夜','夜宵','饮料','零食','奶茶','咖啡','小吃','水果','甜品','酒'].includes(name))}:group)
    for(const name of ['夜宵','零食饮品'])if(!groups.some(group=>group.name===name))groups.push(structuredClone(defaultCategoryGroups.find(group=>group.name===name)!))
    ledger={...ledger,budgets,categoryGroups:groups.map(group=>({...group,kind:group.kind||(group.name==='三餐'?'meal':group.name==='夜宵'?'night':group.name==='零食饮品'?'snack':undefined)})),diningVersion:1}
  }
  ledger={...ledger,transactions:ledger.transactions.map(item=>{const kind=diningKind(item);if(kind==='night'||kind==='snack')return {...item,source:'general' as const,diningKind:kind,categoryGroup:ledger.categoryGroups?.find(group=>group.kind===kind)?.name||(kind==='night'?'夜宵':'零食饮品'),budgetId:diningBudgetId(kind,ledger.budgets||[])};return item})}
  const rent = ledger.expenses?.find(expense => expense.id === 'rent' || expense.title === '房租')
  const rentBudget = ledger.rentBudget ?? rent?.amount ?? 1500
  const budgets = ledger.budgets ?? [{ id:'meal', name:'三餐', amount:ledger.mealBudget, kind:'meal' as const }, { id:'rent', name:'房租', amount:rentBudget, kind:'rent' as const }]
  const chartColors=ledger.chartColors&&!ledger.chartColors.moderate?{...ledger.chartColors,moderate:ledger.chartColors.over,over:ledger.chartColors.over==='#e88725'?'#f5d780':ledger.chartColors.over}:ledger.chartColors
  const chartThresholds=ledger.chartThresholds&&!ledger.chartThresholds.moderatePercent?{...ledger.chartThresholds,moderatePercent:Math.min(115,100+(ledger.chartThresholds.severePercent-100)/2)}:ledger.chartThresholds
  return { ...ledger, chartColors, chartThresholds, budgetVersion: 4, rentBudget, otherBudget: ledger.otherBudget ?? 1000, budgets, expenses: ledger.expenses ?? [] }
}

/** Migrates the original one-time `paid` flag into the current month's payment. */
export function load(): Ledger {
  try {
    const ledger = JSON.parse(localStorage.getItem(key) || '') as Ledger
    if (!ledger?.expenses) return initialLedger
    return normalizeLedger({
      ...ledger,
      expenses: ledger.expenses.map(expense =>
        expense.paid && !expense.paidMonth ? { ...expense, paidMonth: currentMonth() } : expense,
      ),
    })
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
      return normalizeLedger(migrated)
    }
    return normalizeLedger(ledger)
  } catch { return null }
}
export function saveTest(data: Ledger) { localStorage.setItem(testKey, JSON.stringify(data)) }
export function isTestMode() { return localStorage.getItem(testModeKey) === 'true' }
export function setStoredTestMode(active: boolean) { localStorage.setItem(testModeKey, String(active)) }

export function pruneTrash(items: TrashEntry[], at = new Date()): TrashEntry[] {
  const cutoff = at.getTime() - 30 * 86400000
  return items.filter(item => Number.isFinite(Date.parse(item.deletedAt)) && Date.parse(item.deletedAt) >= cutoff)
}

export function loadWorkspace(): LedgerWorkspace {
  try {
    const saved = JSON.parse(localStorage.getItem(workspaceKey) || '') as LedgerWorkspace
    if (saved?.version === 1 && Array.isArray(saved.books) && saved.books.length) {
      const books = saved.books.map(book => ({ ...book, ledger: normalizeLedger(book.ledger) }))
      const result: LedgerWorkspace = { version:1, books, activeBookId: books.some(book => book.id === saved.activeBookId) ? saved.activeBookId : books[0].id, trash: pruneTrash(saved.trash || []) }
      saveWorkspace(result)
      return result
    }
  } catch { /* First launch or old data. */ }
  const books = [{ id:'main', name:'我的账本', ledger:normalizeLedger(load()) }]
  const test = loadTest()
  if (test) books.push({ id:'test', name:'测试账本', ledger:test })
  const result: LedgerWorkspace = { version:1, books, activeBookId: isTestMode() && test ? 'test' : 'main', trash:[] }
  saveWorkspace(result)
  return result
}

export function saveWorkspace(workspace: LedgerWorkspace) {
  localStorage.setItem(workspaceKey, JSON.stringify({ ...workspace, trash: pruneTrash(workspace.trash) }))
}
