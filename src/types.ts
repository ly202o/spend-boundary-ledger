export type FundingSource = 'budget' | 'freedom' | 'undecided'
export type Transaction = { id: string; title: string; amount: number; category: string; date: string; note?: string; source?: 'meal' | 'general' | 'wish' | 'fixed'; budgetImpact?: boolean }
export type Reservation = { id: string; title: string; amount: number; type: 'fixed' | 'wish'; active: boolean; paid: boolean }
export type Wish = { id: string; title: string; amount: number; intensity: number; source: FundingSource; note?: string }
export type Expense = { id: string; title: string; amount: number; active: boolean; paid: boolean; category: string }
export type Ledger = { monthlyBudget: number; mealBudget: number; mode: 'dynamic' | 'fixed'; transactions: Transaction[]; wishes: Wish[]; expenses: Expense[] }
