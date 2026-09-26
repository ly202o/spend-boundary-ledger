export type FundingSource = 'budget' | 'freedom' | 'undecided'
export type Transaction = { id: string; title: string; amount: number; category: string; date: string; note?: string; source?: 'meal' | 'general' | 'wish' | 'fixed'; budgetImpact?: boolean; fixedExpenseId?: string }
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
export type Ledger = { monthlyBudget: number; mealBudget: number; mode: 'dynamic' | 'fixed'; transactions: Transaction[]; wishes: Wish[]; expenses: Expense[]; updatedAt?: string }
