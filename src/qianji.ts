import type { Transaction } from './types'

export const QIANJI_HEADERS = ['ID','时间','账本','分类','二级分类','类型','金额','币种','账户1','账户2','备注','已报销','手续费','优惠券','记账者','账单标记','标签','账单图片','关联账单'] as const

type Cell = string | number | boolean | Date | null | undefined

export type QianJiImportResult = {
  transactions: Transaction[]
  totalRows: number
  skippedIncome: number
  skippedInvalid: number
  duplicates: number
}

const text = (value: Cell) => value == null ? '' : value instanceof Date ? value.toISOString() : String(value).trim()
const dateText = (value: Cell) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0,10)
  const raw = text(value)
  const match = raw.match(/^(\d{4})[-/]?(\d{1,2})[-/]?(\d{1,2})/)
  return match ? `${match[1]}-${match[2].padStart(2,'0')}-${match[3].padStart(2,'0')}` : ''
}

export function normalizeWorkbookRows(value: unknown): Cell[][] {
  if (!Array.isArray(value)) return []
  const first = value[0] as { data?: unknown } | undefined
  if (value.length === 1 && first && Array.isArray(first.data)) return first.data as Cell[][]
  return value as Cell[][]
}

export function parseQianJiRows(rows: Cell[][], existingIds = new Set<string>()): QianJiImportResult {
  const result: QianJiImportResult = { transactions: [], totalRows: Math.max(0, rows.length - 1), skippedIncome: 0, skippedInvalid: 0, duplicates: 0 }
  if (!rows.length) return result
  const columns = new Map(rows[0].map((name,index)=>[text(name),index]))
  const required = ['ID','时间','账本','分类','类型','金额','币种']
  if (required.some(name=>!columns.has(name))) throw new Error('不是受支持的钱迹账单文件，请选择钱迹导出的 Excel。')
  const cell = (row:Cell[],name:string) => row[columns.get(name)!]
  const seen = new Set(existingIds)
  for (const row of rows.slice(1)) {
    if (!row.some(value=>text(value))) continue
    const kind = text(cell(row,'类型'))
    if (kind === '收入') { result.skippedIncome++; continue }
    const id = text(cell(row,'ID'))
    const date = dateText(cell(row,'时间'))
    const amount = Number(cell(row,'金额'))
    const currency = text(cell(row,'币种')).toUpperCase()
    if (kind !== '支出' || !id || !date || !Number.isFinite(amount) || amount <= 0 || (currency && currency !== 'CNY')) { result.skippedInvalid++; continue }
    if (seen.has(id)) { result.duplicates++; continue }
    seen.add(id)
    const category = text(cell(row,'分类')) || '日常消费'
    const subcategory = text(cell(row,'二级分类'))
    const book = text(cell(row,'账本'))
    const note = text(cell(row,'备注'))
    result.transactions.push({ id, title: subcategory || category, amount: Math.round(amount * 100) / 100, category, date, note: note || undefined, source: book.includes('三餐') ? 'meal' : 'general' })
  }
  return result
}

export function transactionsToQianJiRows(transactions: Transaction[]): Cell[][] {
  return [
    [...QIANJI_HEADERS],
    ...transactions.map(item=>[
      item.id, `${item.date} 12:00:00`, item.source === 'meal' ? '三餐账本' : '消费边界账本', item.category,
      item.title !== item.category ? item.title : '', '支出', item.amount, 'CNY', '', '', item.note || '', '', '', '', '', '', '', '', ''
    ])
  ]
}
