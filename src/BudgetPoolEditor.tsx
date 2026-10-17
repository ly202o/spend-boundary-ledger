import { useState } from 'react'
import type { BudgetAllocation } from './types'
export default function BudgetPoolEditor({budget,onSave}:{budget:BudgetAllocation;onSave:(pool:{enabled:boolean;amount:number})=>void}){
 const [enabled,setEnabled]=useState(budget.pool?.enabled??false)
 const [amount,setAmount]=useState(String(budget.pool?.amount??0))
 const valid=/^\d+(\.\d{1,2})?$/.test(amount)&&+amount<=100000000
 return <><label className="check"><input type="checkbox" checked={enabled} onChange={event=>setEnabled(event.target.checked)}/>开启动态池</label><label>补充额度（元）<input type="number" min="0" step="0.01" inputMode="decimal" value={amount} onChange={event=>setAmount(event.target.value)}/></label><small>基础额度 {budget.amount.toFixed(2)} ＋ 动态池 {valid?(+amount).toFixed(2):'—'}。动态池由你自行分配，只提供另一套额度参考；不改写基础预算、周额、日额或月生活预算。</small><button type="button" className="primary" disabled={!valid} onClick={()=>onSave({enabled,amount:+amount})}>保存并关闭</button></>
}
