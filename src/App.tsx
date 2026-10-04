import { createContext, useContext, useEffect, useRef, useMemo, useState } from 'react'
import { CalendarDays, Check, Download, Home, LayoutGrid, Pencil, Plus, ReceiptText, RotateCcw, Sparkles, Trash2, Upload, WalletCards, X } from 'lucide-react'
import { diningKind, diningBudgetId, spendingLabels } from './dining'
import { filterTransactions } from './record-filter'
import { readBackup } from './backup'
import { initialLedger, loadWorkspace, normalizeLedger, saveWorkspace } from './store'
import { budgetSummary, calc, withBudgets } from './budget'
import type { BudgetAllocation, CategoryGroup, ChartColors, ChartThresholds, DisplayPreferences, HomeCard, SpendingCategory, Income, Ledger, LedgerBook, LedgerWorkspace, MealTimes, Transaction, TrashEntry, TrashKind, Wish } from './types'
import { spendingPeriodDays, spendingPeriodSummary, type SpendingPeriod } from './period'
import { normalizeWorkbookRows, parseQianJiRows, transactionsToQianJiRows, type QianJiImportResult } from './qianji'
import { billingMonthForDate, billingRange } from './cycle'
import { automaticDiningSelection, childIcon, defaultCategoryGroups, categoryGroups, defaultMealTimes, groupForCategory, mealCategoryForTime, validMealTimes } from './categories'
import { chartStyles, defaultChartColors, defaultChartThresholds, spendingTone, validChartColors, validChartThresholds } from './chart-tone'

const defaultDisplay:DisplayPreferences={groupThousands:false,font:'system'}
const DisplayContext=createContext(defaultDisplay)
const yuan = (n: number, groupThousands=false) => `${n < 0 ? '−' : ''}¥${Math.abs(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping:groupThousands })}`
function Money({value,currency=true}:{value:number;currency?:boolean}) {
  const {groupThousands}=useContext(DisplayContext)
  const formatted=yuan(value,groupThousands)
  const [whole,decimal]=formatted.split('.')
  return <>{currency?whole:whole.replace('¥','')}<span className="money-decimal">.{decimal}</span></>
}
const now = new Date()
const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
const currentTime = () => new Date().toTimeString().slice(0,5)
const displayDateTime = (date:string,time?:string) => time ? `${date} ${time}` : `${date} · 未记录时分`
const monthDate=(month:string,startDay=17)=>month===billingMonthForDate(new Date(),startDay)?new Date():billingRange(month,startDay).end
const dateKey=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
const uid = () => crypto.randomUUID()
const validAmount = (value: string) => Number.isFinite(+value) && +value > 0 && +value <= 100000000 && /^\d+(\.\d{1,2})?$/.test(value)
type MoreView = 'menu'|'books'|'income'|'wishes'|'budgets'|'book-mode'|'categories'|'trash'|'settings'|'home-cards'

export default function App() {
  const [workspace,setWorkspace] = useState<LedgerWorkspace>(loadWorkspace)
  const activeBook=workspace.books.find(book=>book.id===workspace.activeBookId)||workspace.books[0]
  const ledger=activeBook.ledger
  const [selectedMonth,setSelectedMonth] = useState(()=>billingMonthForDate(new Date(),ledger.billingStartDay))
  const [tab, setTab] = useState<'home'|'records'|'more'>('home')
  const [recordDate,setRecordDate]=useState<string|null>(null)
  const [moreView,setMoreView] = useState<MoreView>('menu')
  const [modal, setModal] = useState<'transaction'|'wish'|'income'|null>(null)
  const [showCalculation,setShowCalculation] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [editingIncome,setEditingIncome] = useState<Income|null>(null)
  const [editingWish,setEditingWish] = useState<Wish|null>(null)
  const [resetBackup, setResetBackup] = useState<Ledger | null>(null)
  const persist=(next:LedgerWorkspace)=>{setWorkspace(next);saveWorkspace(next)}
  const update = (next: Ledger) => {
    if (next.billingStartDay !== ledger.billingStartDay) setSelectedMonth(billingMonthForDate(new Date(), next.billingStartDay))
    persist({...workspace,books:workspace.books.map(book=>book.id===activeBook.id?{...book,ledger:normalizeLedger({...next,updatedAt:new Date().toISOString()})}:book)})
  }
  const trashItem=(kind:TrashKind,label:string,data:unknown,nextLedger:Ledger)=>{
    const entry:TrashEntry={id:uid(),bookId:activeBook.id,kind,label,deletedAt:new Date().toISOString(),data}
    persist({...workspace,books:workspace.books.map(book=>book.id===activeBook.id?{...book,ledger:nextLedger}:book),trash:[entry,...workspace.trash]})
  }
  const referenceDate=useMemo(()=>monthDate(selectedMonth,ledger.billingStartDay),[selectedMonth,ledger.billingStartDay])
  const selectedDate=dateKey(referenceDate)
  const stats = useMemo(() => calc(ledger,referenceDate,selectedMonth), [ledger,referenceDate,selectedMonth])
  const deleteTransaction = (id: string) => {
    const item=ledger.transactions.find(x=>x.id===id)
    if(item)trashItem('transaction',item.title,item,{...ledger,transactions:ledger.transactions.filter(x=>x.id!==id)})
  }
  const resetData = () => {
    setResetBackup(ledger)
    update(structuredClone(initialLedger))
  }
  const undoReset = () => {
    if (!resetBackup) return
    update(resetBackup)
    setResetBackup(null)
  }
  const buyWish = (id: string) => {
    const wish = ledger.wishes.find(x => x.id === id)
    if (!wish) return
    update({ ...ledger, wishes: ledger.wishes.filter(x => x.id !== id), transactions: [{ id: uid(), title: wish.title, amount: wish.amount, category: '愿望', date: selectedDate, time: currentTime(), source: 'wish', budgetImpact: wish.source === 'budget' }, ...ledger.transactions] })
  }
  const exportBackup=()=>{
    const blob=new Blob([JSON.stringify({name:activeBook.name,exportedAt:new Date().toISOString(),ledger},null,2)],{type:'application/json'})
    const url=URL.createObjectURL(blob)
    const link=document.createElement('a');link.href=url;link.download=`消费边界_${activeBook.name.replace(/[\\/:*?"<>|]/g,'_')}_${today}.json`;document.body.append(link);link.click();link.remove()
    window.setTimeout(()=>URL.revokeObjectURL(url),60000)
  }
  const switchBook=(id:string)=>{const book=workspace.books.find(item=>item.id===id);if(!book)return;setResetBackup(null);persist({...workspace,activeBookId:id});setSelectedMonth(billingMonthForDate(new Date(),book.ledger.billingStartDay));setTab('home');setMoreView('menu')}
  const createBook=(name:string,copy:boolean,seed?:Ledger)=>{
    const book:LedgerBook={id:uid(),name,ledger:seed?normalizeLedger(seed):copy?structuredClone(ledger):normalizeLedger(structuredClone(initialLedger))}
    setResetBackup(null)
    persist({...workspace,books:[...workspace.books,book],activeBookId:book.id});setSelectedMonth(billingMonthForDate(new Date(),book.ledger.billingStartDay));setTab('home');setMoreView('menu')
  }
  const renameBook=(id:string,name:string)=>persist({...workspace,books:workspace.books.map(book=>book.id===id?{...book,name}:book)})
  const deleteBook=(id:string)=>{
    if(workspace.books.length<=1)return
    const book=workspace.books.find(item=>item.id===id);if(!book)return
    const books=workspace.books.filter(item=>item.id!==id)
    setResetBackup(null)
    const entry:TrashEntry={id:uid(),bookId:id,kind:'book',label:book.name,deletedAt:new Date().toISOString(),data:book}
    persist({...workspace,books,activeBookId:workspace.activeBookId===id?books[0].id:workspace.activeBookId,trash:[entry,...workspace.trash]})
    if(workspace.activeBookId===id)setSelectedMonth(billingMonthForDate(new Date(),books[0].ledger.billingStartDay))
  }
  const restoreTrash=(entry:TrashEntry)=>{
    if(entry.kind==='book'){
      const book=entry.data as LedgerBook
      persist({...workspace,books:workspace.books.some(item=>item.id===book.id)?workspace.books:[...workspace.books,book],trash:workspace.trash.filter(item=>item.id!==entry.id)})
      return
    }
    const book=workspace.books.find(item=>item.id===entry.bookId)
    if(!book)return
    const base=book.ledger
    let restored=base
    if(entry.kind==='transaction')restored={...base,transactions:[entry.data as Transaction,...base.transactions]}
    if(entry.kind==='income')restored={...base,incomes:[entry.data as Income,...(base.incomes||[])]}
    if(entry.kind==='wish')restored={...base,wishes:[entry.data as Wish,...base.wishes]}
    if(entry.kind==='budget')restored=withBudgets(base,[...(base.budgets||[]),entry.data as BudgetAllocation])
    if(entry.kind==='categoryGroup')restored={...base,categoryGroups:[...(base.categoryGroups||[]),entry.data as CategoryGroup]}
    if(entry.kind==='categoryChild'){
      const child=entry.data as {groupName:string;childName:string}
      restored={...base,categoryGroups:categoryGroups(base).map(group=>group.name===child.groupName&&!group.children.includes(child.childName)?{...group,children:[...group.children,child.childName]}:group)}
    }
    if(entry.kind==='reset')restored=entry.data as Ledger
    persist({...workspace,books:workspace.books.map(item=>item.id===book.id?{...item,ledger:normalizeLedger(restored)}:item),trash:workspace.trash.filter(item=>item.id!==entry.id)})
  }
  const display=ledger.display||defaultDisplay
  const monthLabel=`${selectedMonth.slice(0,4)} 年 ${Number(selectedMonth.slice(5,7))} 月`
  const accountRange=billingRange(selectedMonth,ledger.billingStartDay)
  const monthTransactions=ledger.transactions.filter(item=>item.date>=accountRange.startKey&&item.date<=accountRange.endKey)
  return <DisplayContext.Provider value={display}><main className={`app font-${display.font}`}>
    <header><div className="brand"><WalletCards size={21}/><span>消费边界</span></div><div className="header-actions"><MonthPicker selectedMonth={selectedMonth} label={monthLabel} startDay={ledger.billingStartDay||17} onChange={setSelectedMonth}/></div></header>
    <div className="active-book-label">当前账本 · {activeBook.name}</div>
    <section className="content">
      {tab === 'home' && <HomePage stats={stats} ledger={ledger} referenceDate={referenceDate} selectedMonth={selectedMonth} onDisplayChange={changes=>update({...ledger,...changes})} onShowCalculation={()=>setShowCalculation(true)} onDateSelect={date=>{setRecordDate(date);setTab('records')}} />}
      {tab === 'records' && <Records selectedDate={recordDate} onClearDate={()=>setRecordDate(null)} items={recordDate?ledger.transactions:monthTransactions} onDelete={deleteTransaction} onEdit={setEditingTransaction} />}
      {tab === 'more' && (moreView==='menu'?<MoreMenu onSelect={setMoreView}/>:<>
        <button type="button" className="more-back" onClick={()=>setMoreView('menu')}>‹ 更多</button>
        {moreView==='home-cards'&&<HomeCardSettings ledger={ledger} onDisplayChange={changes=>update({...ledger,...changes})}/>}
        {moreView==='books'&&<BooksPage workspace={workspace} onSwitch={switchBook} onCreate={createBook} onRename={renameBook} onDelete={deleteBook}/>}
        {moreView==='wishes'&&<Wishes ledger={ledger} stats={stats} onAdd={() => setModal('wish')} onBuy={buyWish} onEdit={wish=>setEditingWish(wish)} onDelete={wish=>trashItem('wish',wish.title,wish,{...ledger,wishes:ledger.wishes.filter(item=>item.id!==wish.id)})}/>}
        {moreView==='income'&&<IncomePage ledger={ledger} selectedMonth={selectedMonth} stats={stats} onAdd={()=>setModal('income')} onEdit={setEditingIncome} onDelete={income=>trashItem('income',income.title,income,{...ledger,incomes:(ledger.incomes||[]).filter(item=>item.id!==income.id)})}/>}
        {moreView==='budgets'&&<BudgetSettings ledger={ledger} update={update} onDelete={budget=>trashItem('budget',budget.name,budget,withBudgets(ledger,(ledger.budgets||[]).filter(item=>item.id!==budget.id)))}/>}
        {moreView==='book-mode'&&<BookModeSettings ledger={ledger} update={update}/>}
        {moreView==='categories'&&<CategorySettings ledger={ledger} update={update} onTrash={(kind,label,data,next)=>trashItem(kind,label,data,next)}/>}
        {moreView==='trash'&&<TrashPage entries={workspace.trash} books={workspace.books} onRestore={restoreTrash} onDelete={id=>persist({...workspace,trash:workspace.trash.filter(item=>item.id!==id)})} onClear={()=>persist({...workspace,trash:[]})}/>}
        {moreView==='settings'&&<SettingsPage workspace={workspace} onRestoreWorkspace={next=>{persist(next);setRecordDate(null);setSelectedMonth(billingMonthForDate(new Date(),next.books.find(book=>book.id===next.activeBookId)!.ledger.billingStartDay))}} ledger={ledger} update={update} onReset={resetData} onExportBackup={exportBackup} onUndoReset={undoReset} canUndoReset={!!resetBackup}/>}
      </>)}
    </section>
    <nav aria-label="主导航">
      <div className="nav-tabs">
        {([['home', Home, '首页'], ['records', ReceiptText, '账目'], ['more', LayoutGrid, '更多']] as const).map(([id, Icon, name]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => {setTab(id);if(id==='records')setRecordDate(null);if(id==='more')setMoreView('menu')}}><Icon size={20}/><span>{name}</span></button>)}
      </div>
      <button className="nav-add" aria-label="记一笔" onClick={() => setModal('transaction')}><Plus size={33}/></button>
    </nav>
    {modal === 'transaction' && <TransactionForm groups={categoryGroups(ledger)} budgets={budgetSummary(ledger).allocations} mealTimes={ledger.mealTimes} close={() => setModal(null)} save={(x) => update({ ...ledger, transactions: [x, ...ledger.transactions] })}/>}
    {editingTransaction && <TransactionForm
      groups={categoryGroups(ledger)} budgets={budgetSummary(ledger).allocations} mealTimes={ledger.mealTimes} initial={editingTransaction}
      close={() => setEditingTransaction(null)}
      save={(x) => { update({ ...ledger, transactions: ledger.transactions.map(item => item.id === x.id ? x : item) }); setEditingTransaction(null) }}
    />}
    {modal === 'wish' && <WishForm close={() => setModal(null)} add={(x) => update({ ...ledger, wishes: [x, ...ledger.wishes] })}/>}
    {editingWish&&<WishForm initial={editingWish} close={()=>setEditingWish(null)} add={wish=>{update({...ledger,wishes:ledger.wishes.map(item=>item.id===wish.id?wish:item)});setEditingWish(null)}}/>}
    {modal === 'income' && <IncomeForm close={() => setModal(null)} save={(x) => update({...ledger,incomes:[...(ledger.incomes||[]),x]})}/>}
    {editingIncome&&<IncomeForm initial={editingIncome} close={()=>setEditingIncome(null)} save={income=>{update({...ledger,incomes:(ledger.incomes||[]).map(item=>item.id===income.id?income:item)});setEditingIncome(null)}}/>}
    {showCalculation && <Modal title="本月真正可支配 · 计算明细" close={()=>setShowCalculation(false)}><div className="calculation-lines">
      <div><span>月生活预算</span><b><Money value={ledger.monthlyBudget}/></b></div>
      {budgetSummary(ledger).allocations.map(item=><div key={item.id}><span>预留{item.name}</span><b>− <Money value={item.amount}/></b></div>)}
      <div><span>剩余预算</span><b><Money value={stats.flexibleBase}/></b></div>
      <div><span>从剩余预算扣除的支出</span><b>− <Money value={stats.otherSpent}/></b></div>
      <div className="calculation-total"><span>真正可支配</span><b><Money value={stats.available}/></b></div>
    </div><p className="calculation-help">月生活预算减去各项预留后得到剩余预算，再扣除本账期从剩余预算支付的支出。收入和未购买的愿望不参与这一数字。</p></Modal>}
  </main></DisplayContext.Provider>
}

function MonthPicker({selectedMonth,label,startDay,onChange}:{selectedMonth:string;label:string;startDay:number;onChange:(month:string)=>void}) {
  const [open,setOpen]=useState(false)
  const [year,setYear]=useState(+selectedMonth.slice(0,4))
  const range=billingRange(selectedMonth,startDay)
  return <div className="month-picker-wrap"><button type="button" className="month-picker" aria-expanded={open} onClick={()=>{setYear(+selectedMonth.slice(0,4));setOpen(!open)}}><CalendarDays size={19}/><span>{label}</span></button>{open&&<div className="month-calendar"><div className="month-calendar-head"><button type="button" onClick={()=>setYear(year-1)}>‹</button><b>{year} 年</b><button type="button" onClick={()=>setYear(year+1)}>›</button></div><div className="month-grid">{Array.from({length:12},(_,index)=>{const month=`${year}-${String(index+1).padStart(2,'0')}`;return <button type="button" key={month} className={month===selectedMonth?'active':''} onClick={()=>{onChange(month);setOpen(false)}}>{index+1} 月</button>})}</div><small>当前账期 {range.startKey} 至 {range.endKey}</small></div>}</div>
}
function MoreMenu({onSelect}:{onSelect:(view:MoreView)=>void}) {
  const items:[MoreView,string,string][]=[['home-cards','首页卡片','添加、排序和移除首页卡片'],['books','账本管理','切换、创建和管理账本'],['budgets','预算管理','预留额度与自动计算的剩余预算'],['income','收入记录','查看本月收入与记录明细'],['wishes','愿望单','管理想买的东西'],['book-mode','账本规则','日额模式与月账期'],['categories','分类管理','管理大类、小类与图标'],['trash','回收站','30 天内可恢复的项目'],['settings','偏好与数据','导入导出与显示']]
  return <Page title="更多"><div className="more-grid">{items.map(([id,title,detail])=><button type="button" key={id} onClick={()=>onSelect(id)}><b>{title}</b><small>{detail}</small><span>›</span></button>)}</div></Page>
}
function BooksPage({workspace,onSwitch,onCreate,onRename,onDelete}:{workspace:LedgerWorkspace;onSwitch:(id:string)=>void;onCreate:(name:string,copy:boolean,seed?:Ledger)=>void;onRename:(id:string,name:string)=>void;onDelete:(id:string)=>void}) {
  const [name,setName]=useState('')
  const [copy,setCopy]=useState(false)
  const [editing,setEditing]=useState<string|null>(null)
  const [draft,setDraft]=useState('')
  const [sampleBusy,setSampleBusy]=useState(false)
  const [sampleNotice,setSampleNotice]=useState('')
  const createSample=async()=>{
    setSampleBusy(true);setSampleNotice('')
    try {
      const readXlsxFile=(await import('read-excel-file/browser')).default
      const response=await fetch(`${import.meta.env.BASE_URL}qianji-test-data.xlsx`)
      if(!response.ok)throw new Error('示例数据读取失败。')
      const raw=await readXlsxFile(await response.arrayBuffer())
      const parsed=parseQianJiRows(normalizeWorkbookRows(raw))
      const seed={...structuredClone(initialLedger),transactions:parsed.transactions.filter(item=>item.date>='2026-09-16')}
      const name=workspace.books.some(book=>book.name==='测试账本')?`测试账本 ${workspace.books.length+1}`:'测试账本'
      onCreate(name,false,seed)
    } catch(error) {setSampleNotice(error instanceof Error?error.message:'示例数据创建失败。')}
    finally {setSampleBusy(false)}
  }
  return <Page title="账本管理"><div className="panel books-create"><b>创建账本</b><input value={name} maxLength={30} placeholder="例如：日常、旅行、测试" onChange={event=>setName(event.target.value)}/><label className="check"><input type="checkbox" checked={copy} onChange={event=>setCopy(event.target.checked)}/> 复制当前账本数据</label><div className="book-create-actions"><button type="button" className="primary" disabled={!name.trim()||workspace.books.some(book=>book.name===name.trim())} onClick={()=>{onCreate(name.trim(),copy);setName('')}}>创建并切换</button><button type="button" disabled={sampleBusy} onClick={()=>void createSample()}>{sampleBusy?'创建中…':'从示例数据创建测试账本'}</button></div>{sampleNotice&&<small role="alert">{sampleNotice}</small>}</div><div className="book-list">{workspace.books.map(book=><SwipeActions key={book.id} actionCount={2} actions={<><button className="swipe-edit" onClick={()=>{setEditing(book.id);setDraft(book.name)}}><Pencil size={17}/><span>重命名</span></button><button className="swipe-delete" disabled={workspace.books.length===1} onClick={()=>onDelete(book.id)}><Trash2 size={18}/><span>删除</span></button></>}><div className="panel book-row"><div><b>{book.name}</b><small>{book.ledger.transactions.length} 笔支出 · {(book.ledger.incomes||[]).length} 笔收入</small></div><button type="button" className={book.id===workspace.activeBookId?'book-active':''} onClick={()=>onSwitch(book.id)}>{book.id===workspace.activeBookId?'当前账本':'切换'}</button></div></SwipeActions>)}</div>{editing&&<Modal title="重命名账本" close={()=>setEditing(null)}><label>账本名称<input autoFocus value={draft} maxLength={30} onChange={event=>setDraft(event.target.value)}/></label><button type="button" className="submit" disabled={!draft.trim()||workspace.books.some(book=>book.name===draft.trim()&&book.id!==editing)} onClick={()=>{onRename(editing,draft.trim());setEditing(null)}}>保存名称</button></Modal>}</Page>
}
function TrashPage({entries,books,onRestore,onDelete,onClear}:{entries:TrashEntry[];books:LedgerBook[];onRestore:(entry:TrashEntry)=>void;onDelete:(id:string)=>void;onClear:()=>void}) {
  const kinds:Record<TrashKind,string>={transaction:'支出',income:'收入',wish:'愿望',budget:'预算',categoryGroup:'分类大类',categoryChild:'分类小类',book:'账本',reset:'重置备份'}
  return <Page title="回收站" action={entries.length?"一键清空":undefined} onAction={()=>{if(window.confirm("彻底清空回收站？清空后无法恢复。"))onClear()}}><p className="description">删除的项目在本设备保留 30 天，到期自动清理。恢复后回到原账本。</p><div className="records-panel">{entries.length?entries.map(entry=><SwipeActions key={entry.id} actionCount={2} actions={<><button className="swipe-pay" disabled={entry.kind!=='book'&&!books.some(book=>book.id===entry.bookId)} onClick={()=>onRestore(entry)}><RotateCcw size={17}/><span>恢复</span></button><button className="swipe-delete" onClick={()=>{if(window.confirm(`彻底删除“${entry.label}”？删除后无法恢复。`))onDelete(entry.id)}}><Trash2 size={17}/><span>彻底删除</span></button></>}><div className="panel line trash-row"><div><b>{entry.label}</b><small>{kinds[entry.kind]} · {books.find(book=>book.id===entry.bookId)?.name||'已删除账本'} · {entry.deletedAt.slice(0,10)}</small></div><span>30 天内可恢复</span></div></SwipeActions>):<div className="panel"><Empty text="垃圾桶是空的。"/></div>}</div></Page>
}
function IncomePage({ledger,selectedMonth,stats,onAdd,onEdit,onDelete}:{ledger:Ledger;selectedMonth:string;stats:ReturnType<typeof calc>;onAdd:()=>void;onEdit:(income:Income)=>void;onDelete:(income:Income)=>void}) {
  const range=billingRange(selectedMonth,ledger.billingStartDay)
  const incomes=(ledger.incomes||[]).filter(item=>item.date>=range.startKey&&item.date<=range.endKey).sort((a,b)=>`${b.date} ${b.time||''}`.localeCompare(`${a.date} ${a.time||''}`))
  const counts=incomes.reduce<Record<string,number>>((result,item)=>({...result,[item.category||'工资']:(result[item.category||'工资']||0)+item.amount}),{})
  return <Page title="收入记录" action="记收入" onAction={onAdd}><section className="panel income-panel"><small>本账期总收入</small><strong><Money value={stats.income}/></strong><div className="income-summary"><span>{incomes.length} 笔收入</span><span>平均每笔 <Money value={incomes.length?stats.income/incomes.length:0}/></span></div><small>分类：{Object.entries(counts).map(([name,amount])=>`${name} ${yuan(amount)}`).join(' · ')||'暂无'}</small><small>收入单独记录，不改变固定的月生活预算。</small></section><div className="records-panel">{incomes.map(item=><SwipeActions key={item.id} actionCount={2} actions={<><button className="swipe-edit" onClick={()=>onEdit(item)}><Pencil size={17}/><span>编辑</span></button><button className="swipe-delete" onClick={()=>onDelete(item)}><Trash2 size={18}/><span>删除</span></button></>}><div className="panel line income-row"><div><b>{item.title}</b><small>{item.category||'工资'} · {displayDateTime(item.date,item.time)}</small></div><strong><Money value={item.amount}/></strong></div></SwipeActions>)}</div></Page>
}
function BudgetSettings({ledger,update,onDelete}:{ledger:Ledger;update:(ledger:Ledger)=>void;onDelete:(budget:BudgetAllocation)=>void}) {
  const summary=budgetSummary(ledger)
  const [editing,setEditing]=useState<BudgetAllocation|null>(null)
  const [adding,setAdding]=useState(false)
  const [name,setName]=useState('')
  const [amount,setAmount]=useState('')
  const open=(item?:BudgetAllocation)=>{setEditing(item||null);setAdding(true);setName(item?.name||'');setAmount(item?String(item.amount):'')}
  const saveBudget=()=>{
    if(!name.trim()||!/^\d+(\.\d{1,2})?$/.test(amount))return
    const item:BudgetAllocation=editing?{...editing,name:name.trim(),amount:+amount}:{id:uid(),name:name.trim(),amount:+amount,kind:'custom'}
    const next=editing?summary.allocations.map(current=>current.id===editing.id?item:current):[...summary.allocations,item]
    update(withBudgets(ledger,next));setAdding(false)
  }
  return <Page title="预算管理" action="添加预算" onAction={()=>open()}><section className="panel budget-overview"><label>月生活预算<input type="number" min="0" step="0.01" value={ledger.monthlyBudget} onChange={event=>update({...ledger,monthlyBudget:+event.target.value})}/></label><div><span>已预留 <Money value={summary.reserved}/></span><strong>剩余预算 <Money value={summary.remaining}/></strong></div><small>剩余预算由月生活预算减去下面各项预算自动计算，不需要填写。</small></section><div className="records-panel budget-list">{summary.allocations.map(item=><SwipeActions key={item.id} actionCount={2} actions={<><button className="swipe-edit" onClick={()=>open(item)}><Pencil size={17}/><span>编辑</span></button><button className="swipe-delete" disabled={item.kind==='meal'} onClick={()=>onDelete(item)}><Trash2 size={18}/><span>删除</span></button></>}><div className="panel line budget-row"><div><b>{item.name}</b><small>{item.kind==='meal'?'三餐额度':item.kind==='rent'?'房租额度':'自定义预留'}</small></div><strong><Money value={item.amount}/></strong></div></SwipeActions>)}</div>{summary.remaining<0&&<p className="budget-balance warning">预留已超过月生活预算，请调整金额。</p>}{adding&&<Modal title={editing?'编辑预算':'添加预算'} close={()=>setAdding(false)}><label>名称<input autoFocus value={name} maxLength={24} onChange={event=>setName(event.target.value)}/></label><label>每月金额<input type="number" min="0" step="0.01" inputMode="decimal" value={amount} onChange={event=>setAmount(event.target.value)}/></label><button type="button" className="submit" disabled={!name.trim()||!/^\d+(\.\d{1,2})?$/.test(amount)||summary.allocations.some(item=>item.name===name.trim()&&item.id!==editing?.id)} onClick={saveBudget}>保存预算</button></Modal>}</Page>
}
function BookModeSettings({ledger,update}:{ledger:Ledger;update:(ledger:Ledger)=>void}) {
  const start=ledger.billingStartDay||17
  const currentCycle=billingRange(billingMonthForDate(new Date(),start),start)
  const automaticDaily=(ledger.mealBudget/currentCycle.days).toFixed(2)
  const [dailyDraft,setDailyDraft]=useState(String(ledger.fixedDailyAmount??automaticDaily))
  useEffect(()=>setDailyDraft(String(ledger.fixedDailyAmount??automaticDaily)),[ledger.fixedDailyAmount,automaticDaily])
  const saveDaily=()=>{
    const trimmed=dailyDraft.trim()
    if(!trimmed){setDailyDraft(automaticDaily);if(ledger.fixedDailyAmount!==undefined)update({...ledger,fixedDailyAmount:undefined});return}
    if(!/^\d+(\.\d{1,2})?$/.test(trimmed)||+trimmed>100000000){setDailyDraft(String(ledger.fixedDailyAmount??automaticDaily));return}
    if(ledger.fixedDailyAmount===undefined&&trimmed===automaticDaily)return
    if(+trimmed!==ledger.fixedDailyAmount)update({...ledger,fixedDailyAmount:+trimmed})
  }
  return <Page title="账本规则"><section className="panel settings"><div className="mode-card"><b>三餐日额模式</b><div className="mode-options"><button type="button" className={ledger.mode==='fixed'?'active':''} onClick={()=>update({...ledger,mode:'fixed'})}>固定日额</button><button type="button" className={ledger.mode==='dynamic'?'active':''} onClick={()=>update({...ledger,mode:'dynamic'})}>动态均摊</button></div>{ledger.mode==='fixed'&&<><label>固定日额（元）<input type="number" min="0" max="100000000" step="0.01" inputMode="decimal" value={dailyDraft} onChange={event=>setDailyDraft(event.target.value)} onBlur={saveDaily} onKeyDown={event=>{if(event.key==='Enter')event.currentTarget.blur()}}/></label><small>留空并离开输入框可恢复按本账期三餐预算均分；自定义金额会沿用到之后的账期。</small></>}</div><MealTimeSettings times={ledger.mealTimes} onSave={mealTimes=>update({...ledger,mealTimes})}/><div className="mode-card"><b>月账期</b><p>选择起始日，结束日自动设为下月前一天。</p><div className="cycle-day-grid">{Array.from({length:28},(_,index)=><button key={index+1} type="button" className={start===index+1?'active':''} onClick={()=>update({...ledger,billingStartDay:index+1})}>{index+1}</button>)}</div><small>当前：每月 {start} 日至{start===1?'当月最后一天':`次月 ${start-1} 日`}</small></div></section></Page>
}
function MealTimeSettings({times,onSave}:{times?:MealTimes;onSave:(times:MealTimes)=>void}) {
  const [draft,setDraft]=useState<MealTimes>(()=>({...defaultMealTimes,...times}))
  const [editing,setEditing]=useState<keyof MealTimes|null>(null)
  const [hour,setHour]=useState('')
  const [minute,setMinute]=useState('')
  useEffect(()=>setDraft({...defaultMealTimes,...times}),[times])
  const valid=validMealTimes(draft)
  const fields=([['breakfast','早餐'],['lunch','午餐'],['dinner','晚餐'],['supper','夜宵']] as const)
  const openEditor=(key:keyof MealTimes)=>{const [nextHour,nextMinute]=draft[key].split(':');setHour(nextHour);setMinute(nextMinute);setEditing(key)}
  const validPart=(value:string,max:number)=>/^\d{1,2}$/.test(value)&&Number(value)<=max
  const validEntry=validPart(hour,23)&&validPart(minute,59)
  return <div className="mode-card"><b>默认餐别时间</b><small>点选餐别编辑开始时间；改动不会影响已记的账。</small><div className="meal-time-grid">{fields.map(([key,label])=><button type="button" className="meal-time-button" key={key} onClick={()=>openEditor(key)}><span>{label}开始</span><strong>{draft[key]}</strong><span aria-hidden="true">›</span></button>)}</div>{!valid&&<small className="meal-time-error" role="alert">请按早餐、午餐、晚餐、夜宵的顺序设置不同的开始时间。</small>}<div className="meal-time-actions"><button type="button" disabled={!valid} onClick={()=>onSave(draft)}>保存时间</button><button type="button" onClick={()=>{setDraft({...defaultMealTimes});onSave({...defaultMealTimes})}}>恢复默认</button></div>{editing&&<Modal title={`设置${fields.find(([key])=>key===editing)?.[1]}开始时间`} close={()=>setEditing(null)}><div className="meal-time-inputs"><label>小时（0–23）<input autoFocus type="text" inputMode="numeric" pattern="[0-9]*" maxLength={2} value={hour} onChange={event=>setHour(event.target.value)}/></label><span aria-hidden="true">:</span><label>分钟（0–59）<input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={2} value={minute} onChange={event=>setMinute(event.target.value)}/></label></div><button type="button" className="submit" disabled={!validEntry} onClick={()=>{setDraft({...draft,[editing]:`${hour.padStart(2,'0')}:${minute.padStart(2,'0')}`});setEditing(null)}}>确定时间</button></Modal>}</div>
}
function HomePage({ stats, ledger, referenceDate, selectedMonth, onDisplayChange, onShowCalculation, onDateSelect }: { stats: ReturnType<typeof calc>; ledger: Ledger; referenceDate:Date; selectedMonth:string; onDisplayChange:(changes:Partial<Ledger>)=>void; onShowCalculation:()=>void; onDateSelect:(date:string)=>void }) {
  const cards=ledger.homeCards??(ledger.homeFirstCard==='chart'?[{id:'chart',type:'spending' as const},{id:'balance',type:'balance' as const}]:[{id:'balance',type:'balance' as const},{id:'chart',type:'spending' as const}])
  const save=(next:HomeCard[])=>onDisplayChange({homeCards:next})
  const change=(id:string,changes:Partial<HomeCard>)=>save(cards.map(card=>card.id===id?{...card,...changes}:card))
  const render=(card:HomeCard)=>{
    if(card.type==='spending')return <SpendingPeriodCard onDateSelect={onDateSelect} key={card.id} initialCategory={card.category||'meal'} onCategoryChange={category=>change(card.id,{category})} categoryBudgets={budgetSummary(ledger).allocations} period={card.period||ledger.spendingPeriod||'week'} setPeriod={period=>change(card.id,{period})} transactions={ledger.transactions} allocatedBudgetIds={new Set(budgetSummary(ledger).allocations.filter(item=>item.kind!=='meal').map(item=>item.id))} dailyLimit={stats.mealDaily} monthlyBudget={ledger.monthlyBudget} otherBudget={budgetSummary(ledger).remaining} thresholds={ledger.chartThresholds} colors={ledger.chartColors} squareOpacity={ledger.chartSquareOpacity} referenceDate={referenceDate} selectedMonth={selectedMonth} billingStartDay={ledger.billingStartDay||17}/>
    const minimal=(card.balanceMode||ledger.homeBalanceMode)==='minimal'
    return <SwipeActions key={card.id} className="hero-swipe" actionCount={2} actions={<><button className={minimal?'selected':''} onClick={()=>change(card.id,{balanceMode:'minimal'})}>极简</button><button className={!minimal?'selected':''} onClick={()=>change(card.id,{balanceMode:'detail'})}>详细</button></>}><article className={`hero ${minimal?'hero-minimal':''}`} role={minimal?undefined:'button'} tabIndex={minimal?undefined:0} onClick={minimal?undefined:onShowCalculation} onKeyDown={event=>{if(!minimal&&(event.key==='Enter'||event.key===' ')){event.preventDefault();onShowCalculation()}}}><span className="hero-label"><WalletCards size={18}/>{minimal?'三餐剩余':'本月真正可支配'}</span><strong><Money value={minimal?stats.mealRemaining:stats.available}/></strong><div className="hero-bottom">{minimal?<span>三餐支出<b><Money value={stats.mealSpent}/></b></span>:<><span>三餐外支出<b><Money value={stats.nonMealSpent}/></b></span><span>三餐支出<b><Money value={stats.mealSpent}/></b></span><span>三餐剩余<b><Money value={stats.mealRemaining}/></b></span></>}</div></article></SwipeActions>
  }
  return <><div className="overview custom-home">{cards.map(render)}</div>{!cards.length&&<Empty text="请在更多 → 首页卡片中添加卡片。"/>}</>
}
function HomeCardSettings({ledger,onDisplayChange}:{ledger:Ledger;onDisplayChange:(changes:Partial<Ledger>)=>void}) {
  const [type,setType]=useState<HomeCard['type']>('spending')
  const [category,setCategory]=useState<SpendingCategory>('meal')
  const cards=ledger.homeCards??(ledger.homeFirstCard==='chart'?[{id:'chart',type:'spending' as const},{id:'balance',type:'balance' as const}]:[{id:'balance',type:'balance' as const},{id:'chart',type:'spending' as const}])
  const save=(next:HomeCard[])=>onDisplayChange({homeCards:next})
  return <Page title="首页卡片"><section className="panel"><label>卡片类型<select value={type} onChange={event=>setType(event.target.value as HomeCard['type'])}><option value="balance">本月真正可支配</option><option value="spending">支出图表（柱图／月历）</option></select></label>{type==='spending'&&<label>显示分类<select value={category} onChange={event=>setCategory(event.target.value as SpendingCategory)}>{Object.entries(spendingLabels).map(([id,label])=><option value={id} key={id}>{label}</option>)}</select></label>}<button type="button" className="primary" onClick={()=>save([...cards,{id:uid(),type,category,period:ledger.spendingPeriod||'week'}])}>添加卡片</button><div className="home-card-list">{cards.map((card,index)=><SwipeActions key={card.id} actionCount={1} actions={<button className="swipe-delete" onClick={()=>save(cards.filter(item=>item.id!==card.id))}><Trash2 size={17}/><span>移除卡片</span></button>}><div className="home-card-row"><b>{card.type==='balance'?'本月真正可支配':spendingLabels[card.category||'meal']+'图表'}</b><div><button type="button" disabled={index===0} onClick={()=>{const next=[...cards];[next[index-1],next[index]]=[next[index],next[index-1]];save(next)}}>上移</button><button type="button" disabled={index===cards.length-1} onClick={()=>{const next=[...cards];[next[index+1],next[index]]=[next[index],next[index+1]];save(next)}}>下移</button></div></div></SwipeActions>)}</div></section></Page>
}
function Records({items,onDelete,onEdit,selectedDate,onClearDate}:{items:Transaction[];onDelete:(id:string)=>void;onEdit:(item:Transaction)=>void;selectedDate:string|null;onClearDate:()=>void}) {
  const [filters,setFilters]=useState(false)
  const [from,setFrom]=useState('')
  const [to,setTo]=useState('')
  const [group,setGroup]=useState('')
  const [category,setCategory]=useState('')
  const groups=[...new Set(items.map(item=>item.categoryGroup||'未分类'))]
  const categories=[...new Set(items.filter(item=>!group||(item.categoryGroup||'未分类')===group).map(item=>item.category))]
  const filtered=filterTransactions(items,{date:selectedDate,from,to,group,category})
  const dates=[...new Set(filtered.map(item=>item.date))].sort((a,b)=>b.localeCompare(a))
  return <Page title={selectedDate?selectedDate+' 账目':'账目明细'} action="筛选" onAction={()=>setFilters(!filters)}>
    {selectedDate&&<button className="more-back" onClick={onClearDate}>查看本账期全部日期</button>}
    {filters&&<section className="panel record-filters"><div className="date-time-fields"><label>开始时间<input type="datetime-local" value={from} onChange={event=>setFrom(event.target.value)}/></label><label>结束时间<input type="datetime-local" value={to} onChange={event=>setTo(event.target.value)}/></label></div><label>大类<select value={group} onChange={event=>{setGroup(event.target.value);setCategory('')}}><option value="">全部分类</option>{groups.map(name=><option key={name}>{name}</option>)}</select></label><label>小类<select value={category} onChange={event=>setCategory(event.target.value)}><option value="">全部小类</option>{categories.map(name=><option key={name}>{name}</option>)}</select></label><button type="button" onClick={()=>{setFrom('');setTo('');setGroup('');setCategory('')}}>清除筛选</button>{from&&to&&from>to&&<small>开始时间不能晚于结束时间。</small>}</section>}
    <div className="record-filter-summary">{filtered.length} 笔 · 支出 <Money value={filtered.reduce((sum,item)=>sum+item.amount,0)}/></div>
    <div className="records-panel">{dates.length?dates.map(date=>{const rows=filtered.filter(item=>item.date===date).sort((a,b)=>(b.time||'').localeCompare(a.time||''));return <section className="record-date-group" key={date}><div className="record-date-heading"><b>{date}</b><span>{rows.length} 笔 · <Money value={rows.reduce((sum,item)=>sum+item.amount,0)}/></span></div>{rows.map(item=><SwipeRecord key={item.id} item={item} onDelete={()=>onDelete(item.id)} onEdit={()=>onEdit(item)}/>)}</section>}):<div className="panel"><Empty text="没有符合筛选条件的账目。"/></div>}</div>
  </Page>
}
function SwipeRecord({item,onDelete,onEdit}:{item:Transaction;onDelete:()=>void;onEdit:()=>void}) {
  const actions = <><button className="swipe-edit" aria-label={`编辑 ${item.title}`} onClick={onEdit}><Pencil size={18}/><span>编辑</span></button><button className="swipe-delete" aria-label={`删除 ${item.title}`} onClick={onDelete}><Trash2 size={19}/><span>删除</span></button></>
  return <SwipeActions actionCount={2} actions={actions}>
    <div className="line">
      <div><b>{item.title}</b><small>{item.categoryGroup?`${item.categoryGroup} / `:''}{item.category} · {displayDateTime(item.date,item.time)}{item.budgetImpact === false ? ' · 自由基金' : ''}</small>{item.note&&<small className="record-note">{item.note}</small>}</div><strong><Money value={-item.amount}/></strong>
    </div>
  </SwipeActions>
}
function SpendingPeriodCard({initialCategory,onCategoryChange,categoryBudgets,onDateSelect,period,setPeriod,transactions,allocatedBudgetIds,dailyLimit,monthlyBudget,otherBudget,thresholds,colors,squareOpacity,referenceDate,selectedMonth,billingStartDay}:{period:SpendingPeriod;setPeriod:(period:SpendingPeriod)=>void;transactions:Transaction[];allocatedBudgetIds:Set<string>;dailyLimit:number;monthlyBudget:number;otherBudget:number;thresholds?:ChartThresholds;colors?:ChartColors;squareOpacity?:number;referenceDate:Date;selectedMonth:string;billingStartDay:number;initialCategory:SpendingCategory;onCategoryChange:(category:SpendingCategory)=>void;categoryBudgets:BudgetAllocation[];onDateSelect:(date:string)=>void}) {
  const category=initialCategory
  const setCategory=onCategoryChange
  const [weekOffset,setWeekOffset] = useState(0)
  const labels:Record<SpendingPeriod,string>={week:'本周',seven:'近7日',month:'本月'}
  const filtered=useMemo(()=>category==='all'?transactions:transactions.filter(item=>category==='other'?diningKind(item)!=='meal':diningKind(item)===category),[transactions,category,allocatedBudgetIds])
  const periodDate=useMemo(()=>{if(period!=='week')return referenceDate;const target=new Date(referenceDate.getFullYear(),referenceDate.getMonth(),referenceDate.getDate()-weekOffset*7,12);return weekOffset>0?new Date(target.getFullYear(),target.getMonth(),target.getDate()+((7-target.getDay())%7),12):target},[period,referenceDate,weekOffset])
  const summary=useMemo(()=>spendingPeriodSummary(filtered,period,periodDate,billingStartDay,selectedMonth),[filtered,period,periodDate,billingStartDay,selectedMonth])
  const days=useMemo(()=>spendingPeriodDays(filtered,period,periodDate,billingStartDay,selectedMonth),[filtered,period,periodDate,billingStartDay,selectedMonth])
  const maxAmount=Math.max(1,...days.map(day=>day.amount))
  const cycleDays=billingRange(selectedMonth,billingStartDay).days
  const colorDailyLimit=category==='meal'?dailyLimit:category==='other'?otherBudget/cycleDays:category==='all'?monthlyBudget/cycleDays:(categoryBudgets.find(item=>item.kind===category)?.amount||0)/cycleDays
  const tone=(amount:number)=>spendingTone(amount,colorDailyLimit,thresholds)
  const palette=colors&&validChartColors(colors)?colors:defaultChartColors
  const opacity=Number.isFinite(squareOpacity)?Math.max(0,Math.min(100,squareOpacity!)):35
  const paletteStyle={'--tone-within':palette.within,'--tone-near':palette.near,'--tone-moderate':palette.moderate||defaultChartColors.moderate,'--tone-over':palette.over,'--tone-severe':palette.severe,'--square-opacity':`${opacity}%`} as React.CSSProperties
  const spentHeight=(amount:number)=>amount>0?Math.max(8,amount/maxAmount*68):0
  const weekdays=['一','二','三','四','五','六','日']
  const actions=<>{(['week','seven','month'] as const).map(id=><button key={id} className={`period-choice ${period===id?'selected':''}`} aria-label={`切换到${labels[id]}`} onClick={()=>{setPeriod(id);setWeekOffset(0)}}><span>{labels[id]}</span></button>)}</>
  const weekLimit=dailyLimit*7
  const todaySpent=filtered.filter(item=>item.date===dateKey(periodDate)).reduce((sum,item)=>sum+item.amount,0)
  const categoryLabel=spendingLabels[category]
  const firstDay=new Date(periodDate.getFullYear(),periodDate.getMonth(),1,12)
  const weekNumber=Math.ceil((periodDate.getDate()+((firstDay.getDay()+6)%7))/7)
  const periodTitle=period==='week'&&weekOffset>0?`${periodDate.getMonth()+1}月第${weekNumber}周`:labels[period]
  const weekActions=[weekOffset+2,weekOffset+1,weekOffset].map((offset,index)=>{const target=new Date(referenceDate.getFullYear(),referenceDate.getMonth(),referenceDate.getDate()-offset*7,12);const first=new Date(target.getFullYear(),target.getMonth(),1,12);const number=Math.ceil((target.getDate()+((first.getDay()+6)%7))/7);const prefix=target.getMonth()===periodDate.getMonth()?'':`${target.getMonth()+1}月`;return <button key={offset} className={`week-choice ${index===2?'selected':''}`} onClick={()=>{setPeriod('week');setWeekOffset(offset)}}><span>{offset===0?'本周':`${prefix}第${['','一','二','三','四','五','六'][number]||number}周`}</span></button>})
  return <SwipeActions className="period-swipe" actionCount={3} actions={actions} leftActions={weekActions} leftActionCount={3}>
    <article className="period-card" style={paletteStyle}>
      <div className="period-heading"><span className="eyebrow">{periodTitle}支出</span><CategorySelector value={category} onChange={setCategory}/></div>
      <div className="period-meta">{category==='meal'?<div className="period-budget">{period==='week'&&<span>周额 <Money value={weekLimit}/>　剩余 <b><Money value={weekLimit-summary.total}/></b></span>}<span>日额 <Money value={dailyLimit}/>　剩余 <b><Money value={dailyLimit-todaySpent}/></b></span></div>:<span>颜色参考{category==='other'?'剩余预算':category==='all'?'生活预算':spendingLabels[category]}日额 <Money value={colorDailyLimit}/></span>}</div>
      <div className="period-total"><strong><Money value={summary.total}/></strong><span>日均 <b><Money value={summary.dailyAverage}/></b></span></div>
      {period==='month'?<div className="calendar-chart"><div className="calendar-weekdays">{weekdays.map(day=><span key={day}>{day}</span>)}</div><div className="calendar-grid" style={{'--start-column':String((days[0].date.getDay()+6)%7+1)} as React.CSSProperties}>{days.map(day=><span onDoubleClick={()=>onDateSelect(day.dateKey)} key={day.dateKey} className={`${day.future?'future':''} ${day.amount?'spent':''} ${tone(day.amount)}`} title={`${day.dateKey} ${yuan(day.amount)}`}><strong style={{fontSize:`${Math.min(11,38/Math.max(3,day.amount.toFixed(2).length)*1.8)}px`}}>{day.future?'':day.amount.toFixed(2)}</strong><small>{day.date.getMonth()+1}/{day.date.getDate()}</small></span>)}</div></div>:<div className="bar-chart" aria-label={`${periodTitle}${categoryLabel}支出柱状图`}>{days.map(day=>{const height=spentHeight(day.amount);return <div onDoubleClick={()=>onDateSelect(day.dateKey)} className={`bar-day ${day.future?'future':''} ${tone(day.amount)}`} key={day.dateKey}><div className="bar-track" title={`${day.dateKey}：支出 ${yuan(day.amount)}`}><i style={{height:`${height}px`}}/>{day.amount>0&&<div className="bar-value" style={{bottom:`${height+4}px`}}><Money value={day.amount} currency={false}/></div>}</div><span>周{weekdays[(day.date.getDay()+6)%7]}<small>{day.date.getMonth()+1}/{day.date.getDate()}</small></span></div>})}</div>}
    </article>
  </SwipeActions>
}
function CategorySelector({value,onChange}:{value:SpendingCategory;onChange:(value:SpendingCategory)=>void}) {
  const [open,setOpen]=useState(false)
  const lastClick=useRef(0)
  const labels=spendingLabels
  return <div className="category-selector"><button type="button" className="category-trigger" aria-label={`当前${labels[value]}，双击切换`} aria-expanded={open} onClick={()=>{const current=Date.now();if(current-lastClick.current<420)setOpen(true);lastClick.current=current}} onDoubleClick={()=>setOpen(true)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();setOpen(true)}}}>{labels[value]}</button>{open&&<div className="category-options" role="group" aria-label="选择支出分类">{(['meal','night','snack','other','all'] as const).map(id=><button key={id} type="button" className={value===id?'active':''} onClick={()=>{onChange(id);setOpen(false)}}>{labels[id]}</button>)}</div>}</div>
}
function Wishes({ledger,stats,onAdd,onBuy,onEdit,onDelete}:{ledger:Ledger;stats:ReturnType<typeof calc>;onAdd:()=>void;onBuy:(id:string)=>void;onEdit:(wish:Wish)=>void;onDelete:(wish:Wish)=>void}) {
  return <Page title="愿望单" action="添加愿望" onAction={onAdd}><p className="description">愿望先作计划，购买后才计入支出。</p><div className="cards">{ledger.wishes.length ? ledger.wishes.map(x => <SwipeActions key={x.id} className="wish-swipe" actionCount={3} actions={<><button className="swipe-pay" onClick={()=>onBuy(x.id)}><Check size={19}/><span>已购买</span></button><button className="swipe-edit" onClick={()=>onEdit(x)}><Pencil size={18}/><span>编辑</span></button><button className="swipe-delete" onClick={()=>onDelete(x)}><Trash2 size={19}/><span>删除</span></button></>}><article className="wish"><div><span className="pill">{x.intensity}/10 想要</span><h3>{x.title}</h3><small>{x.source === 'budget' ? '本月可支配额度' : x.source === 'freedom' ? '自由基金' : '暂未决定'}</small></div><b><Money value={x.amount}/></b></article></SwipeActions>) : <Empty text="把想买的东西放进来，再决定它值不值得占用预算。"/>}</div><div className="notice">计划中的愿望：<b><Money value={stats.wishReserved}/></b></div></Page>
}
function SwipeActions({children,actions,actionCount=1,className='',leftActions,leftActionCount=0}:{children:React.ReactNode;actions:React.ReactNode;actionCount?:number;className?:string;leftActions?:React.ReactNode;leftActionCount?:number}) {
  leftActions=leftActions||actions
  leftActionCount=leftActionCount||actionCount
  const [open,setOpen] = useState<'left'|'right'|null>(null)
  const startX = useRef<number | null>(null)
  const dragX = useRef(0)
  const swiped = useRef(false)
  const finishSwipe = () => {
    if (dragX.current < -45) setOpen(open==='left'?null:'right')
    if (dragX.current > 35) setOpen(open==='right'?null:leftActions?'left':null)
    startX.current = null
    dragX.current = 0
    // Ignore only the click synthesized by this drag, not the user's next tap.
    window.setTimeout(()=>{swiped.current=false},0)
  }
  const actionWidth = actionCount * 72
  const swipeWidth = actionWidth
  return <div className={`swipe-shell ${open ? `open open-${open}` : ''} ${className}`} style={{'--action-width':`${actionWidth}px`,'--swipe-width':`${swipeWidth}px`,'--left-action-width':`${leftActionCount*72}px`} as React.CSSProperties} onPointerDown={event=>{if((event.target as HTMLElement).closest('.swipe-shell')!==event.currentTarget)return;if(!open&&(event.target as HTMLElement).closest('button'))return;startX.current=event.clientX;dragX.current=0;swiped.current=false}} onPointerMove={event=>{if(startX.current!==null){dragX.current=event.clientX-startX.current;if(Math.abs(dragX.current)>8)swiped.current=true}}} onPointerUp={finishSwipe} onPointerCancel={finishSwipe}>
    <div className="swipe-actions" aria-hidden={open!=='right'} onClickCapture={event=>{if(swiped.current){event.preventDefault();event.stopPropagation();swiped.current=false;return}setOpen(null)}}>{actions}</div>
    {leftActions&&<div className="swipe-actions swipe-actions-left" aria-hidden={open!=='left'} onClickCapture={event=>{if(swiped.current){event.preventDefault();event.stopPropagation();swiped.current=false;return}setOpen(null)}}>{leftActions}</div>}
    <div className="swipe-content" onClickCapture={event=>{if(swiped.current){event.preventDefault();event.stopPropagation();swiped.current=false}}}>{children}</div>
  </div>
}
function SettingsPage({workspace,onRestoreWorkspace,ledger,update,onReset,onExportBackup,onUndoReset,canUndoReset}:{ledger:Ledger;update:(l:Ledger)=>void;onReset:()=>void;onExportBackup:()=>void;onUndoReset:()=>void;canUndoReset:boolean;workspace:LedgerWorkspace;onRestoreWorkspace:(next:LedgerWorkspace)=>void}) {
  const [confirmingReset,setConfirmingReset] = useState(false)
  const display=ledger.display||defaultDisplay
  return <Page title="偏好与数据"><div className="panel settings">
    <section className="display-card"><b>显示设置</b><label className="switch-row"><span>金额使用千位分隔符<small>{display.groupThousands?'显示为 1,000.00':'显示为 1000.00'}</small></span><input type="checkbox" checked={display.groupThousands} onChange={e=>update({...ledger,display:{...display,groupThousands:e.target.checked}})}/></label><label>界面字体<select value={display.font} onChange={e=>update({...ledger,display:{...display,font:e.target.value as DisplayPreferences['font']}})}><option value="system">系统默认</option><option value="rounded">圆润字体</option><option value="serif">宋体</option></select></label></section>
    <ChartThresholdSettings thresholds={ledger.chartThresholds} colors={ledger.chartColors} squareOpacity={ledger.chartSquareOpacity} onSave={chartThresholds=>update({...ledger,chartThresholds})} onSaveColors={chartColors=>update({...ledger,chartColors})} onSaveOpacity={chartSquareOpacity=>update({...ledger,chartSquareOpacity})}/>
    <ImportExportSettings ledger={ledger} update={update} workspace={workspace} onRestoreWorkspace={onRestoreWorkspace}/>
    <section className="reset-card"><div><b>重置当前账本</b><small>只重置当前账本，其他账本不受影响。请先决定是否导出完整备份。</small></div>{confirmingReset?<div className="reset-confirm"><span>重置前要导出数据吗？</span><button type="button" onClick={()=>setConfirmingReset(false)}>取消</button><button type="button" onClick={()=>{onExportBackup();onReset();setConfirmingReset(false)}}>导出并重置</button><button type="button" className="danger" onClick={()=>{onReset();setConfirmingReset(false)}}>不导出，直接重置</button></div>:<button type="button" className="reset-button" onClick={()=>setConfirmingReset(true)}>重置数据</button>}{canUndoReset&&<button type="button" className="undo-reset" onClick={onUndoReset}><RotateCcw size={16}/>撤回刚才的重置</button>}</section>
    <p>数据仅保存在当前设备；需要跨设备使用时，请先导出再在另一设备导入。</p>
  </div></Page>
}
function ChartThresholdSettings({thresholds,colors,squareOpacity,onSave,onSaveColors,onSaveOpacity}:{thresholds?:ChartThresholds;colors?:ChartColors;squareOpacity?:number;onSave:(value:ChartThresholds)=>void;onSaveColors:(value:ChartColors)=>void;onSaveOpacity:(value:number)=>void}) {
  const saved=thresholds&&validChartThresholds(thresholds)?thresholds:defaultChartThresholds
  const savedColors=colors&&validChartColors(colors)?colors:defaultChartColors
  const savedOpacity=Number.isFinite(squareOpacity)?Math.max(0,Math.min(100,squareOpacity!)):35
  const [near,setNear]=useState(String(saved.nearPercent))
  const [moderate,setModerate]=useState(String(saved.moderatePercent??115))
  const [severe,setSevere]=useState(String(saved.severePercent))
  const [palette,setPalette]=useState<ChartColors>(savedColors)
  const [opacity,setOpacity]=useState(savedOpacity)
  useEffect(()=>{setNear(String(saved.nearPercent));setModerate(String(saved.moderatePercent??115));setSevere(String(saved.severePercent))},[saved.nearPercent,saved.moderatePercent,saved.severePercent])
  useEffect(()=>setPalette(savedColors),[savedColors.within,savedColors.near,savedColors.over,savedColors.severe])
  useEffect(()=>setOpacity(savedOpacity),[savedOpacity])
  const value={nearPercent:Number(near),moderatePercent:Number(moderate),severePercent:Number(severe)}
  const valid=near.trim()!==''&&severe.trim()!==''&&validChartThresholds(value)
  const changed=value.moderatePercent!==(saved.moderatePercent??115)||value.nearPercent!==saved.nearPercent||value.severePercent!==saved.severePercent
  const colorNames:[keyof ChartColors,string][]=[['within','未接近'],['near','接近超支'],['over','轻度超支'],['moderate','中度超支'],['severe','严重超支']]
  const colorsChanged=colorNames.some(([key])=>(palette[key]||defaultChartColors.moderate!).toLowerCase()!==(savedColors[key]||defaultChartColors.moderate!).toLowerCase())
  return <section className="display-card chart-threshold-settings"><b>支出柱与月历颜色</b><small>按每天对应预算的使用比例着色；五档颜色可分别修改，选择风格后立即保存。</small><div className="chart-style-grid">{chartStyles.map(style=><button type="button" key={style.name} className={Object.keys(style.colors).every(key=>style.colors[key as keyof ChartColors]===(savedColors[key as keyof ChartColors]||defaultChartColors.moderate))?"active":""} onClick={()=>{setPalette(style.colors);onSaveColors(style.colors)}}><b>{style.name}</b><span>{Object.values(style.colors).map((color,index)=><i key={index} style={{background:color}}/>)}</span></button>)}</div><div className="chart-color-editors">{colorNames.map(([key,label])=><label key={key}><span>{label}</span><input type="color" aria-label={`${label}颜色`} value={palette[key]||defaultChartColors.moderate} onChange={event=>setPalette({...palette,[key]:event.target.value})}/><code>{(palette[key]||defaultChartColors.moderate!).toUpperCase()}</code></label>)}</div><div className="chart-color-actions"><button type="button" disabled={!colorsChanged||!validChartColors(palette)} onClick={()=>onSaveColors(palette)}>保存颜色</button><button type="button" onClick={()=>{setPalette(defaultChartColors);onSaveColors(defaultChartColors)}}>恢复默认颜色</button></div><div className="calendar-opacity-setting"><label>月历方块颜色浓度 <b>{opacity}%</b><input type="range" min="0" max="100" step="5" value={opacity} onChange={event=>setOpacity(+event.target.value)}/></label><button type="button" disabled={opacity===savedOpacity} onClick={()=>onSaveOpacity(opacity)}>保存透明度</button></div><div className="chart-threshold-fields"><label>接近超支从日额的百分之几开始<input type="number" min="1" max="100" step="1" value={near} onChange={event=>setNear(event.target.value)}/></label><label>中度超支从日额的百分之几开始<input type="number" min="101" max="499" value={moderate} onChange={event=>setModerate(event.target.value)}/></label><label>严重超支从日额的百分之几开始<input type="number" min="100" max="500" step="1" value={severe} onChange={event=>setSevere(event.target.value)}/></label></div><small>绿色为正常，黄绿色为接近预算，浅黄色为轻度超支，橙色为中度超支，红色为严重超支。默认界线为 80%、115%、130%。</small>{!valid&&<small className="meal-time-error" role="alert">接近界线为 1–100%，中度界线大于 100% 且小于严重界线，严重界线不超过 500%。</small>}<button type="button" disabled={!valid||!changed} onClick={()=>onSave(value)}>保存比例界线</button></section>
}
function ImportExportSettings({ledger,update,workspace,onRestoreWorkspace}:{ledger:Ledger;update:(ledger:Ledger)=>void;workspace:LedgerWorkspace;onRestoreWorkspace:(next:LedgerWorkspace)=>void}) {
  const inputRef=useRef<HTMLInputElement>(null)
  const [scope,setScope]=useState('all')
  const [busy,setBusy]=useState(false)
  const [notice,setNotice]=useState('')
  const [preview,setPreview]=useState<QianJiImportResult|null>(null)
  const [pending,setPending]=useState<{workspace?:LedgerWorkspace;ledger?:Ledger}|null>(null)
  const inspect=async(file?:File)=>{
    if(!file)return
    setBusy(true);setNotice('');setPending(null);setPreview(null)
    try{
      if(file.name.toLowerCase().endsWith('.json')){
        const parsed=JSON.parse(await file.text())
        setPending(readBackup(parsed))
      }else{
        const read=(await import('read-excel-file/browser')).default
        setPreview(parseQianJiRows(normalizeWorkbookRows(await read(file)),new Set(ledger.transactions.map(item=>item.id))))
      }
    }catch(error){setNotice(error instanceof Error?error.message:'导入失败。')}
    finally{setBusy(false);if(inputRef.current)inputRef.current.value=''}
  }
  const exportData=async()=>{
    setBusy(true);setNotice('')
    try{
      if(scope==='expenses'){
        const write=(await import('write-excel-file/browser')).default
        const rows=transactionsToQianJiRows(ledger.transactions).map(row=>row.map(value=>({value:value as string|number,type:typeof value==='number'?Number:String})))
        await write(rows,{sheet:'支出账目'}).toFile('消费边界_支出_'+today+'.xlsx')
      }else{
        const data=scope==='all'?{format:'spend-boundary-backup',version:1,exportedAt:new Date().toISOString(),workspace}:{version:1,exportedAt:new Date().toISOString(),ledger}
        const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}))
        const link=document.createElement('a');link.href=url;link.download='消费边界_'+(scope==='all'?'完整备份':'当前账本')+'_'+today+'.json';document.body.append(link);link.click();link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),60000)
      }
      setNotice('导出完成。')
    }catch{setNotice('导出失败，请重试。')}finally{setBusy(false)}
  }
  return <section className="transfer-card"><b>备份与导入导出</b><small>默认导出所有账本、预算、分类、收入、账本规则、餐别时间、首页卡片、配色、字体等设置与回收站。完整备份使用 JSON；也可选择只导出支出 Excel。</small><label>导出范围<select value={scope} onChange={event=>setScope(event.target.value)}><option value="all">完整备份（所有账本＋设置）</option><option value="book">当前账本（数据＋设置）</option><option value="expenses">当前账本（支出 Excel）</option></select></label><input className="file-input" ref={inputRef} type="file" accept=".json,.xlsx" onChange={event=>void inspect(event.target.files?.[0])}/><div className="transfer-actions"><button type="button" disabled={busy} onClick={()=>inputRef.current?.click()}><Upload size={17}/>导入</button><button type="button" disabled={busy} onClick={()=>void exportData()}><Download size={17}/>导出</button></div>{pending&&<div className="import-preview"><b>{pending.workspace?'完整备份：'+pending.workspace.books.length+' 个账本':'当前账本备份'}</b><small>{pending.workspace?'将恢复全部账本、设置和回收站，并替换本设备现有内容。':'将恢复当前账本的数据和设置，并替换其现有内容。'}建议先导出已有数据。</small><div><button type="button" onClick={()=>setPending(null)}>取消</button><button type="button" onClick={()=>{if(pending.workspace)onRestoreWorkspace(pending.workspace);else update(pending.ledger!);setPending(null);setNotice('备份恢复完成。')}}>确认恢复</button></div></div>}{preview&&<div className="import-preview"><b>Excel：可导入 {preview.transactions.length} 笔支出</b><small>重复 {preview.duplicates} 笔 · 收入 {preview.skippedIncome} 笔 · 无效 {preview.skippedInvalid} 笔。Excel 支出模式不会覆盖其他数据。</small><div><button type="button" onClick={()=>setPreview(null)}>取消</button><button type="button" disabled={!preview.transactions.length} onClick={()=>{update({...ledger,transactions:[...preview.transactions,...ledger.transactions]});setPreview(null);setNotice('支出导入完成。')}}>确认导入</button></div></div>}{notice&&<small role="status">{notice}</small>}</section>
}
function CategorySettings({ledger,update,onTrash}:{ledger:Ledger;update:(ledger:Ledger)=>void;onTrash:(kind:'categoryGroup'|'categoryChild',label:string,data:unknown,next:Ledger)=>void}) {
  const groups=categoryGroups(ledger)
  const [groupName,setGroupName]=useState('')
  const [childNames,setChildNames]=useState<Record<string,string>>({})
  const [editing,setEditing]=useState<{group:string;child?:string;icon?:boolean}|null>(null)
  const [draft,setDraft]=useState('')
  const icons=['🥐','🍱','🍚','🍜','🥤','🍎','🍪','🍺','🧻','🛍️','🚇','⛽','🎬','🎓','🧧','🍽️','🏠','🛒','☕','🚕','💼','🎁','🎮','📚','💊','🐾','✨','💰','🧾','🧳','🏃']
  const saveGroups=(next:CategoryGroup[],transactions=ledger.transactions)=>update({...ledger,categoryGroups:next,transactions})
  const rename=()=>{
    if(!editing)return
    const name=draft.trim()
    if(!name)return
    if(!editing.child){
      if(groups.some(group=>group.name===name&&group.name!==editing.group))return
      saveGroups(groups.map(group=>group.name===editing.group?{...group,name}:group),ledger.transactions.map(item=>item.categoryGroup===editing.group?{...item,categoryGroup:name}:item))
    }else{
      const group=groups.find(item=>item.name===editing.group)
      if(!group||group.children.some(child=>child===name&&child!==editing.child))return
      saveGroups(groups.map(item=>item.name===editing.group?{...item,childIcons:{...item.childIcons,[name]:childIcon(item,editing.child!)},children:item.children.map(child=>child===editing.child?name:child)}:item),ledger.transactions.map(item=>item.category===editing.child&&(item.categoryGroup||groupForCategory(groups,item.category))===editing.group?{...item,category:name,categoryGroup:editing.group}:item))
    }
    setEditing(null)
  }
  return <Page title="分类管理" action="补充常用分类" onAction={()=>{const next=groups.map(group=>({...group,children:[...new Set([...group.children,...(defaultCategoryGroups.find(item=>item.name===group.name)?.children||[]),...(group.name==='零食饮品'?['咖啡','水果','零食','酒']:[])])]}));saveGroups([...next,...defaultCategoryGroups.filter(group=>!next.some(item=>item.name===group.name))])}}><p className="description">左滑分类卡片可在右侧编辑、选图标或删除；删除的分类可在垃圾桶恢复。</p><div className="category-groups">{groups.map(group=><section className="panel category-group" key={group.name}><SwipeActions actionCount={3} actions={<><button className="swipe-edit" onClick={()=>{setDraft(group.name);setEditing({group:group.name})}}><Pencil size={17}/><span>改名</span></button><button className="swipe-pay" onClick={()=>setEditing({group:group.name,icon:true})}><span>{group.icon||'✨'}</span><span>图标</span></button><button className="swipe-delete" disabled={group.name==='三餐'||groups.length===1} onClick={()=>onTrash('categoryGroup',group.name,group,{...ledger,categoryGroups:groups.filter(item=>item.name!==group.name)})}><Trash2 size={18}/><span>删除</span></button></>}><div className="category-group-head"><span className="category-icon">{group.icon||'✨'}</span><h2>{group.name}</h2><small>{group.children.length} 个小类</small></div></SwipeActions><div className="category-rows">{group.children.map(child=><SwipeActions key={child} actionCount={3} actions={<><button className="swipe-edit" onClick={()=>{setDraft(child);setEditing({group:group.name,child})}}><Pencil size={17}/><span>改名</span></button><button className="swipe-pay" onClick={()=>setEditing({group:group.name,child,icon:true})}><span>{childIcon(group,child)}</span><span>图标</span></button><button className="swipe-delete" disabled={child==='其他'} onClick={()=>onTrash('categoryChild',child,{groupName:group.name,childName:child},{...ledger,categoryGroups:groups.map(item=>item.name===group.name?{...item,children:item.children.filter(name=>name!==child)}:item)})}><Trash2 size={18}/><span>删除</span></button></>}><div className="category-child-row"><span className="category-icon">{childIcon(group,child)}</span><span>{child}</span></div></SwipeActions>)}</div><div className="category-add"><input value={childNames[group.name]||''} onChange={event=>setChildNames({...childNames,[group.name]:event.target.value})} maxLength={20} placeholder="添加小类"/><button type="button" disabled={!childNames[group.name]?.trim()||group.children.includes(childNames[group.name].trim())} onClick={()=>{saveGroups(groups.map(item=>item.name===group.name?{...item,children:[...item.children,childNames[group.name].trim()]}:item));setChildNames({...childNames,[group.name]:''})}}>添加</button></div></section>)}</div><div className="category-add category-add-group"><input value={groupName} onChange={event=>setGroupName(event.target.value)} maxLength={20} placeholder="添加大类"/><button type="button" disabled={!groupName.trim()||groups.some(group=>group.name===groupName.trim())} onClick={()=>{saveGroups([...groups,{name:groupName.trim(),icon:'✨',children:['其他']}]);setGroupName('')}}>添加大类</button></div>{editing&&<Modal title={editing.icon?'选择图标':'编辑分类'} close={()=>setEditing(null)}>{editing.icon?<div className="category-icon-grid">{icons.map(icon=><button key={icon} type="button" onClick={()=>{saveGroups(groups.map(group=>group.name===editing.group?editing.child?{...group,childIcons:{...group.childIcons,[editing.child]:icon}}:{...group,icon}:group));setEditing(null)}}>{icon}</button>)}</div>:<><label>分类名称<input autoFocus value={draft} maxLength={20} onChange={event=>setDraft(event.target.value)}/></label><button type="button" className="submit" disabled={!draft.trim()} onClick={rename}>保存</button></>}</Modal>}</Page>
}
function Page({title,action,onAction,children}:{title:string;action?:string;onAction?:()=>void;children:React.ReactNode}) { return <><div className="page-title"><h1>{title}</h1>{action&&<button className="primary" onClick={onAction}>{action}</button>}</div>{children}</> }
function Empty({text}:{text:string}) { return <div className="empty"><Sparkles size={22}/><p>{text}</p></div> }
function Modal({title,children,close,autoFocus=true}:{title:string;children:React.ReactNode;close:()=>void;autoFocus?:boolean}) {
  const ref = useRef<HTMLFormElement>(null)
  const closeRef = useRef(close)
  closeRef.current = close
  useEffect(()=>{
    const prior = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    if(autoFocus)ref.current?.querySelector<HTMLInputElement>('input')?.focus()
    const key = (e:KeyboardEvent)=>{
      if(e.key==='Escape') closeRef.current()
      if(e.key==='Tab'){
        const nodes = Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input,select,textarea')||[])
        const first=nodes[0], last=nodes[nodes.length-1]
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}
        if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}
      }
    }
    document.addEventListener('keydown',key)
    return ()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',key);prior?.focus()}
  },[])
  return <div className="shade" onClick={e=>{if(e.target===e.currentTarget)close()}}><form ref={ref} role="dialog" aria-modal="true" aria-label={title} className="modal" onSubmit={e=>e.preventDefault()}><button type="button" aria-label="关闭弹窗" className="close" onClick={close}><X/></button><h2>{title}</h2>{children}</form></div>
}
function TransactionForm({close,save,initial,groups,budgets,mealTimes}:{close:()=>void;save:(x:Transaction)=>void;initial?:Transaction;groups:CategoryGroup[];budgets:BudgetAllocation[];mealTimes?:MealTimes}) {
  const startingTime=initial?.time||currentTime()
  const chooseAutomatic=(time:string)=>automaticDiningSelection(time,groups,mealTimes)
  const automatic=chooseAutomatic(startingTime)
  const [group,setGroup]=useState(initial?.categoryGroup||automatic.group)
  const [category,setCategory]=useState(initial?.category||automatic.category)
  const [title,setTitle]=useState(initial?.title||'')
  const [amount,setAmount]=useState(initial?String(initial.amount):'')
  const [manual,setManual]=useState(false)
  const [date,setDate]=useState(initial?.date||dateKey(new Date()))
  const [time,setTime]=useState(startingTime)
  const [note,setNote]=useState(initial?.note||'')
  const [budgetId,setBudgetId]=useState(initial?.budgetId||'')
  const [touched,setTouched]=useState(!!initial)
  const activeGroup=groups.find(item=>item.name===group)||groups[0]
  const foodKind=activeGroup.kind||(group==='三餐'?'meal':group==='夜宵'?'night':group==='零食饮品'?'snack':null)
  const chooseGroup=(name:string)=>{const item=groups.find(item=>item.name===name)!;setGroup(name);setCategory(name==='三餐'?mealCategoryForTime(time,item.children,mealTimes):item.children[0]);setTouched(true);setBudgetId('')}
  const chooseTime=(value:string)=>{setTime(value);if(!touched&&value){const next=chooseAutomatic(value);setGroup(next.group);setCategory(next.category)}}
  const key=(value:string)=>{
    if(value==='⌫'){setAmount(amount.slice(0,-1));return}
    if(value==='清空'){setAmount('');return}
    if(value==='.'&&amount.includes('.'))return
    const next=value==='.'&&!amount?'0.':amount==='0'&&value!=='.'?value:amount+value
    if(/^\d{0,9}(\.\d{0,2})?$/.test(next))setAmount(next)
  }
  const submit=(again=false)=>{
    if(!validAmount(amount)||!date||!time)return
    save({...initial,id:initial?.id||uid(),title:title.trim()||category,amount:+amount,category,categoryGroup:group,diningKind:foodKind||undefined,date,time,note:note.trim()||undefined,source:foodKind==='meal'?'meal':initial?.source==='wish'||initial?.source==='fixed'?initial.source:'general',budgetId:foodKind?diningBudgetId(foodKind,budgets):(budgetId||undefined)})
    if(again){setAmount('');setTitle('');setNote('')}else if(!initial)close()
  }
  return <Modal autoFocus={false} title={initial?'编辑账目':'记一笔'} close={close}>
    <div className="quick-entry"><small>支出金额</small><div><span>¥</span>{manual?<input autoFocus inputMode="decimal" value={amount} onChange={event=>setAmount(event.target.value)} placeholder="0.00"/>:<output aria-label="支出金额">{amount||'0.00'}</output>}</div><button type="button" className="keyboard-mode" onClick={()=>setManual(!manual)}>{manual?'使用数字键盘':'使用输入法修改'}</button></div>
    <div className="entry-categories"><div className="entry-groups">{groups.map(item=><button type="button" key={item.name} className={group===item.name?'active':''} onClick={()=>chooseGroup(item.name)}>{item.icon} {item.name}</button>)}</div><div className="entry-children">{activeGroup.children.map(child=><button type="button" key={child} className={category===child?'active':''} onClick={()=>{setCategory(child);setTouched(true)}}>{childIcon(activeGroup,child)} {child}</button>)}</div></div>
    <small className="entry-budget-note">{foodKind?'计入'+(budgets.find(item=>item.kind===foodKind)?.name||group)+'预算':'计入剩余预算或指定预算'}</small>
    <details className="entry-details"><summary>{date} {time} · 名称与备注</summary><div><label>名称（可选）<input value={title} onChange={event=>setTitle(event.target.value)} placeholder={'默认：'+category}/></label><div className="date-time-fields"><label>日期<input type="date" value={date} onChange={event=>setDate(event.target.value)}/></label><label>时间<input type="time" value={time} onChange={event=>chooseTime(event.target.value)}/></label></div><label>备注<textarea value={note} onChange={event=>setNote(event.target.value)} maxLength={120}/></label>{!foodKind&&<label>支付预算<select value={budgetId} onChange={event=>setBudgetId(event.target.value)}><option value="">剩余预算</option>{budgets.filter(item=>item.kind!=='meal').map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</select></label>}</div></details>
    {!manual&&<div className="entry-keypad" aria-label="记账数字键盘">{['1','2','3','4','5','6','7','8','9','.','0','⌫'].map(value=><button type="button" aria-label={value==='⌫'?'退格':value} key={value} onClick={()=>key(value)}>{value}</button>)}</div>}
    <div className="entry-actions">{!initial&&<button type="button" disabled={!validAmount(amount)} onClick={()=>submit(true)}>再记一笔</button>}<button type="button" className="submit" disabled={!validAmount(amount)||!date||!time} onClick={()=>submit()}>{initial?'保存修改':'保存'}</button></div>
  </Modal>
}
function IncomeForm({close,save,initial}:{close:()=>void;save:(income:Income)=>void;initial?:Income}) {
  const [category,setCategory]=useState(initial?.category||'工资')
  const [title,setTitle]=useState(initial?.title||'')
  const [amount,setAmount]=useState(initial?String(initial.amount):'')
  const [date,setDate]=useState(initial?.date||dateKey(new Date()))
  const [time,setTime]=useState(initial?.time||currentTime())
  return <Modal title={initial?'编辑收入':'记收入'} close={close}><div className="quick-entry"><small>收入金额</small><div><span>¥</span><input autoFocus type="number" inputMode="decimal" min="0" step="0.01" value={amount} onChange={event=>setAmount(event.target.value)} placeholder="0.00"/></div></div><div className="entry-categories"><b>收入分类</b><div className="entry-children">{['工资','奖金','兼职','退款','其他'].map(name=><button type="button" key={name} className={category===name?'active':''} onClick={()=>setCategory(name)}>{name}</button>)}</div></div><label>名称（可选）<input value={title} onChange={event=>setTitle(event.target.value)} placeholder={`默认：${category}`}/></label><div className="date-time-fields"><label>到账日期<input type="date" value={date} onChange={event=>setDate(event.target.value)}/></label><label>到账时间<input type="time" value={time} onChange={event=>setTime(event.target.value)}/></label></div><button type="button" className="submit" disabled={!validAmount(amount)||!date||!time} onClick={()=>{save({id:initial?.id||uid(),title:title.trim()||category,category,amount:+amount,date,time});close()}}>保存收入</button></Modal>
}
function WishForm({close,add,initial}:{close:()=>void;add:(x:Wish)=>void;initial?:Wish}) { const [title,setTitle]=useState(initial?.title||'');const [amount,setAmount]=useState(initial?String(initial.amount):'');const [intensity,setIntensity]=useState(initial?.intensity||5);const [source,setSource]=useState<Wish['source']>(initial?.source||'budget');return <Modal title={initial?'编辑愿望':'添加愿望'} close={close}><label>想买什么<input autoFocus value={title} onChange={e=>setTitle(e.target.value)} /></label><label>预计价格<input type="number" value={amount} onChange={e=>setAmount(e.target.value)} /></label><label>愿望强度：<b>{intensity}/10</b><input type="range" min="1" max="10" value={intensity} onChange={e=>setIntensity(+e.target.value)}/></label><label>资金来源<select value={source} onChange={e=>setSource(e.target.value as Wish['source'])}><option value="budget">本月可支配额度</option><option value="freedom">自由基金</option><option value="undecided">暂未决定</option></select></label><button type="button" className="submit" disabled={!title.trim() || !validAmount(amount)} onClick={()=>{if(title.trim()&&validAmount(amount)){add({id:initial?.id||uid(),title,amount:+amount,intensity,source});close()}}}>{initial?'保存愿望':'加入愿望单'}</button></Modal>}
