import type { Transaction } from './types'
export function filterTransactions(items:Transaction[],filters:{date?:string|null;from?:string;to?:string;group?:string;category?:string}) {
  return items.filter(item=>(!filters.date||item.date===filters.date)&&(!filters.from||item.date+'T'+(item.time||'00:00')>=filters.from)&&(!filters.to||item.date+'T'+(item.time||'23:59')<=filters.to)&&(!filters.group||(item.categoryGroup||'未分类')===filters.group)&&(!filters.category||item.category===filters.category))
}
