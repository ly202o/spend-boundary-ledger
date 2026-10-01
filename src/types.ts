export type FundingSource = 'budget' | 'freedom' | 'undecided'
export type Transaction = { id: string; title: string; amount: number; category: string; categoryGroup?: string; date: string; time?: string; note?: string; source?: 'meal' | 'general' | 'wish' | 'fixed'; budgetImpact?: boolean; fixedExpenseId?: string }
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
export type Income = { id: string; title: string; amount: number; date: string; time?: string }
export type CategoryGroup = { name: string; children: string[] }
export type DisplayPreferences = { groupThousands: boolean; font: 'system' | 'rounded' | 'serif' }
export type Ledger = { monthlyBudget: number; mealBudget: number; rentBudget?: number; otherBudget?: number; budgetVersion?: number; mode: 'dynamic' | 'fixed'; billingStartDay?: number; categories?: string[]; categoryGroups?: CategoryGroup[]; transactions: Transaction[]; incomes?: Income[]; wishes: Wish[]; expenses: Expense[]; display?: DisplayPreferences; updatedAt?: string }
