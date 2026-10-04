export type FundingSource = 'budget' | 'freedom' | 'undecided'
export type Transaction = { id: string; title: string; amount: number; category: string; categoryGroup?: string; diningKind?: 'meal'|'night'|'snack'; date: string; time?: string; note?: string; source?: 'meal' | 'general' | 'wish' | 'fixed'; budgetId?: string; budgetImpact?: boolean; fixedExpenseId?: string }
export type Reservation = { id: string; title: string; amount: number; type: 'fixed' | 'wish'; active: boolean; paid: boolean }
export type Wish = { id: string; title: string; amount: number; intensity: number; source: FundingSource; note?: string }
export type Expense = {
  id: string
  title: string
  amount: number
  active: boolean
  /** Kept for data created before monthly payment tracking was introduced. */
  paid: boolean
  /** The YYYY-MM in which this recurring expense was last paid. */
  paidMonth?: string
  category: string
}
export type Income = { id: string; title: string; amount: number; date: string; time?: string; category?: string }
export type CategoryGroup = { name: string; children: string[]; icon?: string; childIcons?: Record<string,string>; kind?: 'meal'|'night'|'snack' }
export type BudgetAllocation = { id: string; name: string; amount: number; kind: 'meal' | 'night' | 'snack' | 'rent' | 'custom' }
export type SpendingCategory = 'meal'|'night'|'snack'|'other'|'all'
export type HomeCard = {id:string;type:'balance'|'spending';category?:SpendingCategory;period?:'week'|'seven'|'month';balanceMode?:'minimal'|'detail'}
export type TrashKind = 'transaction' | 'income' | 'wish' | 'budget' | 'categoryGroup' | 'categoryChild' | 'book' | 'reset'
export type TrashEntry = { id: string; bookId: string; kind: TrashKind; label: string; deletedAt: string; data: unknown }
export type LedgerBook = { id: string; name: string; ledger: Ledger }
export type LedgerWorkspace = { version: 1; activeBookId: string; books: LedgerBook[]; trash: TrashEntry[] }
export type MealTimes = { breakfast: string; lunch: string; dinner: string; supper: string }
export type ChartThresholds = { nearPercent: number; moderatePercent?: number; severePercent: number }
export type ChartColors = { within: string; near: string; over: string; moderate?: string; severe: string }
export type DisplayPreferences = { groupThousands: boolean; font: 'system' | 'rounded' | 'serif' }
export type Ledger = { monthlyBudget: number; mealBudget: number; rentBudget?: number; otherBudget?: number; budgets?: BudgetAllocation[]; budgetVersion?: number; mode: 'dynamic' | 'fixed'; fixedDailyAmount?: number; mealTimes?: MealTimes; spendingPeriod?: 'week' | 'seven' | 'month'; homeCards?: HomeCard[]; diningVersion?: number; homeBalanceMode?: 'minimal' | 'detail'; homeFirstCard?: 'balance' | 'chart'; chartThresholds?: ChartThresholds; chartColors?: ChartColors; chartSquareOpacity?: number; billingStartDay?: number; categories?: string[]; categoryGroups?: CategoryGroup[]; transactions: Transaction[]; incomes?: Income[]; wishes: Wish[]; expenses: Expense[]; display?: DisplayPreferences; updatedAt?: string }
