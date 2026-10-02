import type { Ledger, LedgerWorkspace } from './types'
import { normalizeLedger, pruneTrash } from './store.ts'

const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)
const records=(value:unknown,date=false)=>Array.isArray(value)&&value.every(item=>object(item)&&typeof item.id==='string'&&typeof item.title==='string'&&typeof item.amount==='number'&&Number.isFinite(item.amount)&&item.amount>=0&&(!date||typeof item.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(item.date)))
function validLedger(value:unknown):value is Ledger {
  return object(value)&&typeof value.monthlyBudget==='number'&&Number.isFinite(value.monthlyBudget)&&typeof value.mealBudget==='number'&&Number.isFinite(value.mealBudget)&&records(value.transactions,true)&&records(value.wishes)&&records(value.expenses)&&(value.incomes===undefined||records(value.incomes,true))
}
export function readBackup(parsed:unknown):{workspace?:LedgerWorkspace;ledger?:Ledger} {
  if(!object(parsed))throw new Error('备份格式无效。')
  if(parsed.workspace){
    const next=parsed.workspace
    if(!object(next)||next.version!==1||!Array.isArray(next.books)||!next.books.length||!next.books.every(book=>object(book)&&typeof book.id==='string'&&typeof book.name==='string'&&validLedger(book.ledger))||new Set(next.books.map(book=>book.id)).size!==next.books.length||!Array.isArray(next.trash)||!next.trash.every(item=>object(item)&&typeof item.id==='string'&&typeof item.bookId==='string'&&typeof item.label==='string'&&typeof item.deletedAt==='string'&&['transaction','income','wish','budget','categoryGroup','categoryChild','book','reset'].includes(String(item.kind))))throw new Error('完整备份格式无效。')
    const workspace=next as LedgerWorkspace
    const books=workspace.books.map(book=>({...book,ledger:normalizeLedger(book.ledger)}))
    return {workspace:{...workspace,books,trash:pruneTrash(workspace.trash),activeBookId:books.some(book=>book.id===workspace.activeBookId)?workspace.activeBookId:books[0].id}}
  }
  if(!validLedger(parsed.ledger))throw new Error('不是有效的账本备份。')
  return {ledger:normalizeLedger(parsed.ledger)}
}
