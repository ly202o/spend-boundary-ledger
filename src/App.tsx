import { createContext, useContext, useEffect, useRef, useMemo, useState } from 'react'
import { CalendarDays, Check, Download, Home, LayoutGrid, Pencil, Plus, ReceiptText, RotateCcw, Sparkles, Trash2, Upload, WalletCards, X } from 'lucide-react'
import { isTestMode, load, loadTest, normalizeLedger, save, saveTest, setStoredTestMode } from './store'
import { calc, isOtherTransaction } from './budget'
import type { CategoryGroup, DisplayPreferences, Income, Ledger, Transaction, Wish } from './types'
import type { User } from '@supabase/supabase-js'
import { supabase, syncConfigured } from './supabase'
import { fetchCloudLedger, saveCloudLedger, stamp } from './sync'
import { spendingPeriodDays, spendingPeriodSummary, type SpendingPeriod } from './period'
import { normalizeWorkbookRows, parseQianJiRows, transactionsToQianJiRows, type QianJiImportResult } from './qianji'
import { billingMonthForDate, billingRange } from './cycle'
import { categoryGroups, groupForCategory } from './categories'

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
type MoreView = 'menu'|'income'|'wishes'|'budgets'|'book-mode'|'categories'|'settings'

export default function App() {
  const [testMode,setTestMode] = useState(()=>isTestMode()&&!!loadTest())
  const [ledger, setLedger] = useState<Ledger>(()=>isTestMode()?loadTest()||load():load())
  const [selectedMonth,setSelectedMonth] = useState(()=>billingMonthForDate(new Date(),ledger.billingStartDay))
  const [tab, setTab] = useState<'home'|'records'|'more'>('home')
  const [moreView,setMoreView] = useState<MoreView>('menu')
  const [modal, setModal] = useState<'transaction'|'wish'|'income'|null>(null)
  const [showCalculation,setShowCalculation] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [editingIncome,setEditingIncome] = useState<Income|null>(null)
  const [resetBackup, setResetBackup] = useState<Ledger | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [syncState, setSyncState] = useState<'offline'|'syncing'|'synced'|'error'>('offline')
  const update = (next: Ledger) => {
    if (next.billingStartDay !== ledger.billingStartDay) setSelectedMonth(billingMonthForDate(new Date(), next.billingStartDay))
    const stamped = stamp(next)
    setLedger(stamped); testMode?saveTest(stamped):save(stamped)
    if (user&&!testMode) {
      setSyncState('syncing')
      saveCloudLedger(user, stamped).then(() => setSyncState('synced')).catch(() => setSyncState('error'))
    }
  }
  useEffect(() => {
    if (!supabase) return
    const hydrate = async (nextUser: User | null) => {
      setUser(nextUser)
      if (!nextUser||testMode) { setSyncState('offline'); return }
      setSyncState('syncing')
      try {
        const remote = await fetchCloudLedger(nextUser)
        const local = load()
        if (remote && (!local.updatedAt || new Date(remote.updatedAt || 0) > new Date(local.updatedAt))) {
          const migrated=normalizeLedger(remote);setLedger(migrated); save(migrated)
        } else {
          await saveCloudLedger(nextUser, stamp(local))
        }
        setSyncState('synced')
      } catch { setSyncState('error') }
    }
    supabase.auth.getUser().then(({ data }) => hydrate(data.user))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { void hydrate(session?.user ?? null) })
    return () => subscription.unsubscribe()
  }, [testMode])
  const requestSyncLogin = async (email: string) => {
    if (!supabase) return '请先完成 Supabase 配置。'
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin + window.location.pathname } })
    return error?.message || '验证邮件已发送，请在此设备打开邮件中的链接。'
  }
  const signOut = async () => { await supabase?.auth.signOut() }
  const referenceDate=useMemo(()=>monthDate(selectedMonth,ledger.billingStartDay),[selectedMonth,ledger.billingStartDay])
  const selectedDate=dateKey(referenceDate)
  const stats = useMemo(() => calc(ledger,referenceDate,selectedMonth), [ledger,referenceDate,selectedMonth])
  const deleteTransaction = (id: string) => update({ ...ledger, transactions: ledger.transactions.filter(x => x.id !== id) })
  const resetData = () => {
    setResetBackup(ledger)
    update({ monthlyBudget: 4000, mealBudget: 1500, rentBudget:1500, otherBudget:1000, budgetVersion:3, mode: 'fixed', billingStartDay:17, transactions: [], incomes:[], wishes: [], expenses: [] })
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
  const toggleTestData=async(active:boolean)=>{
    if(active){
      setStoredTestMode(true);setTestMode(true)
      try{let copy=loadTest();if(!copy){const readXlsxFile=(await import('read-excel-file/browser')).default;const response=await fetch(`${import.meta.env.BASE_URL}qianji-test-data.xlsx`);if(!response.ok)throw new Error('测试数据读取失败');const raw=await readXlsxFile(await response.arrayBuffer());const parsed=parseQianJiRows(normalizeWorkbookRows(raw));copy={...ledger,transactions:parsed.transactions.filter(item=>item.date>='2026-09-16'),updatedAt:undefined};saveTest(copy)}setLedger(copy)}catch(error){setStoredTestMode(false);setTestMode(false);throw error}
    }else{saveTest(ledger);setStoredTestMode(false);setTestMode(false);setLedger(load())}
  }
  const display=ledger.display||defaultDisplay
  const monthLabel=`${selectedMonth.slice(0,4)} 年 ${Number(selectedMonth.slice(5,7))} 月`
  const accountRange=billingRange(selectedMonth,ledger.billingStartDay)
  const monthTransactions=ledger.transactions.filter(item=>item.date>=accountRange.startKey&&item.date<=accountRange.endKey)
  return <DisplayContext.Provider value={display}><main className={`app font-${display.font}`}>
    <header><div className="brand"><WalletCards size={21}/><span>消费边界</span></div><div className="header-actions"><MonthPicker selectedMonth={selectedMonth} label={monthLabel} startDay={ledger.billingStartDay||17} onChange={setSelectedMonth}/></div></header>
    <section className="content">
      {tab === 'home' && <HomePage stats={stats} ledger={ledger} referenceDate={referenceDate} selectedMonth={selectedMonth} onShowCalculation={()=>setShowCalculation(true)} />}
      {tab === 'records' && <Records items={monthTransactions} onDelete={deleteTransaction} onEdit={setEditingTransaction} />}
      {tab === 'more' && (moreView==='menu'?<MoreMenu onSelect={setMoreView}/>:<>
        <button type="button" className="more-back" onClick={()=>setMoreView('menu')}>‹ 更多</button>
        {moreView==='wishes'&&<Wishes ledger={ledger} stats={stats} onAdd={() => setModal('wish')} update={update} onBuy={buyWish}/>}
        {moreView==='income'&&<IncomePage ledger={ledger} selectedMonth={selectedMonth} stats={stats} onAdd={()=>setModal('income')} onEdit={setEditingIncome} update={update}/>}
        {moreView==='budgets'&&<BudgetSettings ledger={ledger} update={update}/>}
        {moreView==='book-mode'&&<BookModeSettings ledger={ledger} update={update}/>}
        {moreView==='categories'&&<CategorySettings ledger={ledger} update={update}/>}
        {moreView==='settings'&&<SettingsPage ledger={ledger} update={update} testMode={testMode} onToggleTestData={toggleTestData} configured={syncConfigured} user={user} syncState={syncState} onLogin={requestSyncLogin} onSignOut={signOut} onReset={resetData} onUndoReset={undoReset} canUndoReset={!!resetBackup}/>}
      </>)}
    </section>
    <nav aria-label="主导航">
      <div className="nav-tabs">
        {([['home', Home, '首页'], ['records', ReceiptText, '账目'], ['more', LayoutGrid, '更多']] as const).map(([id, Icon, name]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => {setTab(id);if(id==='more')setMoreView('menu')}}><Icon size={20}/><span>{name}</span></button>)}
      </div>
      <button className="nav-add" aria-label="记一笔" onClick={() => setModal('transaction')}><Plus size={33}/></button>
    </nav>
    {modal === 'transaction' && <TransactionForm groups={categoryGroups(ledger)} close={() => setModal(null)} save={(x) => update({ ...ledger, transactions: [x, ...ledger.transactions] })}/>}
    {editingTransaction && <TransactionForm groups={categoryGroups(ledger)} initial={editingTransaction} close={() => setEditingTransaction(null)} save={(x) => { update({ ...ledger, transactions: ledger.transactions.map(item => item.id === x.id ? x : item) }); setEditingTransaction(null) }}/>}
    {modal === 'wish' && <WishForm close={() => setModal(null)} add={(x) => update({ ...ledger, wishes: [x, ...ledger.wishes] })}/>}
    {modal === 'income' && <IncomeForm close={() => setModal(null)} save={(x) => update({...ledger,incomes:[...(ledger.incomes||[]),x]})}/>}
    {editingIncome&&<IncomeForm initial={editingIncome} close={()=>setEditingIncome(null)} save={income=>{update({...ledger,incomes:(ledger.incomes||[]).map(item=>item.id===income.id?income:item)});setEditingIncome(null)}}/>}
    {showCalculation && <Modal title="本月真正可支配 · 计算明细" close={()=>setShowCalculation(false)}><div className="calculation-lines">
      <div><span>月生活预算</span><b><Money value={ledger.monthlyBudget}/></b></div>
      <div><span>预留三餐月预算</span><b>− <Money value={ledger.mealBudget}/></b></div>
      <div><span>房租预算</span><b>− <Money value={ledger.rentBudget??1500}/></b></div>
      <div><span>其他预算上限</span><b><Money value={ledger.otherBudget??1000}/></b></div>
      <div><span>可用弹性额度（取较小值）</span><b><Money value={stats.flexibleBase}/></b></div>
      <div><span>其他支出</span><b>− <Money value={stats.otherSpent}/></b></div>
      <div className="calculation-total"><span>真正可支配</span><b><Money value={stats.available}/></b></div>
    </div><p className="calculation-help">先从生活预算预留三餐和房租，再以其他预算为上限，扣除本账期其他支出。工资和未购买的愿望不参与这一数字；旧固定支出记录不重复扣减。</p></Modal>}
  </main></DisplayContext.Provider>
}

function MonthPicker({selectedMonth,label,startDay,onChange}:{selectedMonth:string;label:string;startDay:number;onChange:(month:string)=>void}) {
  const [open,setOpen]=useState(false)
  const [year,setYear]=useState(+selectedMonth.slice(0,4))
  const range=billingRange(selectedMonth,startDay)
  return <div className="month-picker-wrap"><button type="button" className="month-picker" aria-expanded={open} onClick={()=>{setYear(+selectedMonth.slice(0,4));setOpen(!open)}}><CalendarDays size={19}/><span>{label}</span></button>{open&&<div className="month-calendar"><div className="month-calendar-head"><button type="button" onClick={()=>setYear(year-1)}>‹</button><b>{year} 年</b><button type="button" onClick={()=>setYear(year+1)}>›</button></div><div className="month-grid">{Array.from({length:12},(_,index)=>{const month=`${year}-${String(index+1).padStart(2,'0')}`;return <button type="button" key={month} className={month===selectedMonth?'active':''} onClick={()=>{onChange(month);setOpen(false)}}>{index+1} 月</button>})}</div><small>当前账期 {range.startKey} 至 {range.endKey}</small></div>}</div>
}
function MoreMenu({onSelect}:{onSelect:(view:MoreView)=>void}) {
  const items:[MoreView,string,string][]=[['budgets','预算','生活、三餐、房租与其他预算'],['income','工资收入','查看与记录工资'],['wishes','愿望单','管理想买的东西'],['book-mode','账本模式','日额模式与月账期'],['categories','分类','管理大类与小类'],['settings','设置','同步、导入导出与显示']]
  return <Page title="更多"><div className="more-grid">{items.map(([id,title,detail])=><button type="button" key={id} onClick={()=>onSelect(id)}><b>{title}</b><small>{detail}</small><span>›</span></button>)}</div></Page>
}
function IncomePage({ledger,selectedMonth,stats,onAdd,onEdit,update}:{ledger:Ledger;selectedMonth:string;stats:ReturnType<typeof calc>;onAdd:()=>void;onEdit:(income:Income)=>void;update:(ledger:Ledger)=>void}) {
  const range=billingRange(selectedMonth,ledger.billingStartDay)
  const incomes=(ledger.incomes||[]).filter(item=>item.date>=range.startKey&&item.date<=range.endKey).sort((a,b)=>`${b.date} ${b.time||''}`.localeCompare(`${a.date} ${a.time||''}`))
  return <Page title="工资收入" action="添加收入" onAction={onAdd}><section className="panel income-panel"><strong><Money value={stats.income}/></strong><small>本账期收入单独记录，不改变固定的月生活预算。</small>{incomes.map(item=><div className="line" key={item.id}><div><b>{item.title}</b><small>{displayDateTime(item.date,item.time)}</small></div><div className="income-actions"><b><Money value={item.amount}/></b><button type="button" aria-label={`编辑${item.title}`} onClick={()=>onEdit(item)}><Pencil size={16}/></button><button type="button" aria-label={`删除${item.title}`} onClick={()=>update({...ledger,incomes:(ledger.incomes||[]).filter(income=>income.id!==item.id)})}><Trash2 size={16}/></button></div></div>)}</section></Page>
}
function BudgetSettings({ledger,update}:{ledger:Ledger;update:(ledger:Ledger)=>void}) {
  const total=ledger.mealBudget+(ledger.rentBudget??1500)+(ledger.otherBudget??1000)
  return <Page title="预算"><section className="panel settings budget-settings"><label>月生活预算<input type="number" min="0" step="0.01" value={ledger.monthlyBudget} onChange={event=>update({...ledger,monthlyBudget:+event.target.value})}/></label><label>三餐月预算<input type="number" min="0" step="0.01" value={ledger.mealBudget} onChange={event=>update({...ledger,mealBudget:+event.target.value})}/></label><label>房租预算<input type="number" min="0" step="0.01" value={ledger.rentBudget??1500} onChange={event=>update({...ledger,rentBudget:+event.target.value})}/></label><label>其他预算<input type="number" min="0" step="0.01" value={ledger.otherBudget??1000} onChange={event=>update({...ledger,otherBudget:+event.target.value})}/></label><p className={total===ledger.monthlyBudget?'budget-balance':'budget-balance warning'}>分配合计 <Money value={total}/> · {total===ledger.monthlyBudget?'与月生活预算一致':`与月生活预算相差 ${yuan(ledger.monthlyBudget-total)}`}</p></section></Page>
}
function BookModeSettings({ledger,update}:{ledger:Ledger;update:(ledger:Ledger)=>void}) {
  const start=ledger.billingStartDay||17
  return <Page title="账本模式"><section className="panel settings"><div className="mode-card"><b>三餐日额模式</b><div className="mode-options"><button type="button" className={ledger.mode==='fixed'?'active':''} onClick={()=>update({...ledger,mode:'fixed'})}>固定日额</button><button type="button" className={ledger.mode==='dynamic'?'active':''} onClick={()=>update({...ledger,mode:'dynamic'})}>动态均摊</button></div></div><div className="mode-card"><b>月账期</b><p>选择起始日，结束日自动设为下月前一天。</p><div className="cycle-day-grid">{Array.from({length:28},(_,index)=><button key={index+1} type="button" className={start===index+1?'active':''} onClick={()=>update({...ledger,billingStartDay:index+1})}>{index+1}</button>)}</div><small>当前：每月 {start} 日至{start===1?'当月最后一天':`次月 ${start-1} 日`}</small></div></section></Page>
}
function HomePage({ stats, ledger, referenceDate, selectedMonth, onShowCalculation }: { stats: ReturnType<typeof calc>; ledger: Ledger; referenceDate:Date; selectedMonth:string; onShowCalculation:()=>void }) {
  const [period,setPeriod] = useState<SpendingPeriod>('week')
  return <div className="overview"><article className="hero" role="button" tabIndex={0} aria-label="查看本月真正可支配计算明细" onClick={onShowCalculation} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onShowCalculation()}}}><span className="hero-label"><WalletCards size={18}/>本月真正可支配</span><strong><Money value={stats.available}/></strong><div className="hero-bottom"><span>其他支出<b><Money value={stats.otherSpent}/></b></span><span>三餐支出<b><Money value={stats.mealSpent}/></b></span><span>三餐剩余<b><Money value={stats.mealRemaining}/></b></span></div></article><SpendingPeriodCard period={period} setPeriod={setPeriod} transactions={ledger.transactions} dailyLimit={stats.mealDaily} referenceDate={referenceDate} selectedMonth={selectedMonth} billingStartDay={ledger.billingStartDay||17}/></div>
}
function Records({items,onDelete,onEdit}:{items:Transaction[];onDelete:(id:string)=>void;onEdit:(item:Transaction)=>void}) { return <Page title="全部账目"><div className="records-panel">{items.length ? items.map(x=><SwipeRecord key={x.id} item={x} onDelete={()=>onDelete(x.id)} onEdit={()=>onEdit(x)}/>):<div className="panel"><Empty text="点击下方加号，记录第一笔消费。"/></div>}</div></Page> }
function SwipeRecord({item,onDelete,onEdit}:{item:Transaction;onDelete:()=>void;onEdit:()=>void}) {
  const actions = <><button className="swipe-edit" aria-label={`编辑 ${item.title}`} onClick={onEdit}><Pencil size={18}/><span>编辑</span></button><button className="swipe-delete" aria-label={`删除 ${item.title}`} onClick={onDelete}><Trash2 size={19}/><span>删除</span></button></>
  return <SwipeActions actionCount={2} actions={actions}>
    <div className="line">
      <div><b>{item.title}</b><small>{item.categoryGroup?`${item.categoryGroup} / `:''}{item.category} · {displayDateTime(item.date,item.time)}{item.budgetImpact === false ? ' · 自由基金' : ''}</small>{item.note&&<small className="record-note">{item.note}</small>}</div><strong><Money value={-item.amount}/></strong>
    </div>
  </SwipeActions>
}
function SpendingPeriodCard({period,setPeriod,transactions,dailyLimit,referenceDate,selectedMonth,billingStartDay}:{period:SpendingPeriod;setPeriod:(period:SpendingPeriod)=>void;transactions:Transaction[];dailyLimit:number;referenceDate:Date;selectedMonth:string;billingStartDay:number}) {
  const [category,setCategory] = useState<'meal'|'other'|'all'>('meal')
  const [weekOffset,setWeekOffset] = useState(0)
  const labels:Record<SpendingPeriod,string>={week:'本周',seven:'近7日',month:'本月'}
  const filtered=useMemo(()=>category==='all'?transactions:transactions.filter(item=>category==='meal'?item.source==='meal':isOtherTransaction(item)),[transactions,category])
  const periodDate=useMemo(()=>{if(period!=='week')return referenceDate;const target=new Date(referenceDate.getFullYear(),referenceDate.getMonth(),referenceDate.getDate()-weekOffset*7,12);return weekOffset>0?new Date(target.getFullYear(),target.getMonth(),target.getDate()+((7-target.getDay())%7),12):target},[period,referenceDate,weekOffset])
  const summary=useMemo(()=>spendingPeriodSummary(filtered,period,periodDate,billingStartDay,selectedMonth),[filtered,period,periodDate,billingStartDay,selectedMonth])
  const days=useMemo(()=>spendingPeriodDays(filtered,period,periodDate,billingStartDay,selectedMonth),[filtered,period,periodDate,billingStartDay,selectedMonth])
  const maxAmount=Math.max(1,...days.map(day=>day.amount))
  const tone=(amount:number)=>amount<=0?'zero':category==='other'?'other':category==='all'?'all':dailyLimit<=0||amount>dailyLimit?'over':amount>=dailyLimit*.8?'near':'within'
  const spentHeight=(amount:number)=>amount>0?Math.max(8,amount/maxAmount*68):0
  const weekdays=['一','二','三','四','五','六','日']
  const actions=<>{(['week','seven','month'] as const).map(id=><button key={id} className={`period-choice ${period===id?'selected':''}`} aria-label={`切换到${labels[id]}`} onClick={()=>{setPeriod(id);setWeekOffset(0)}}><span>{labels[id]}</span></button>)}</>
  const weekLimit=dailyLimit*7
  const todaySpent=filtered.filter(item=>item.date===dateKey(periodDate)).reduce((sum,item)=>sum+item.amount,0)
  const categoryLabel=category==='meal'?'三餐':category==='other'?'其他':'全部'
  const firstDay=new Date(periodDate.getFullYear(),periodDate.getMonth(),1,12)
  const weekNumber=Math.ceil((periodDate.getDate()+((firstDay.getDay()+6)%7))/7)
  const periodTitle=period==='week'&&weekOffset>0?`${periodDate.getMonth()+1}月第${weekNumber}周`:labels[period]
  const weekActions=[weekOffset+2,weekOffset+1,weekOffset].map((offset,index)=>{const target=new Date(referenceDate.getFullYear(),referenceDate.getMonth(),referenceDate.getDate()-offset*7,12);const first=new Date(target.getFullYear(),target.getMonth(),1,12);const number=Math.ceil((target.getDate()+((first.getDay()+6)%7))/7);const prefix=target.getMonth()===periodDate.getMonth()?'':`${target.getMonth()+1}月`;return <button key={offset} className={`week-choice ${index===2?'selected':''}`} onClick={()=>{setPeriod('week');setWeekOffset(offset)}}><span>{offset===0?'本周':`${prefix}第${['','一','二','三','四','五','六'][number]||number}周`}</span></button>})
  return <SwipeActions className="period-swipe" actionCount={3} actions={actions} leftActions={weekActions} leftActionCount={3}>
    <article className="period-card">
      <div className="period-heading"><span className="eyebrow">{periodTitle}支出</span><CategorySelector value={category} onChange={setCategory}/></div>
      <div className="period-meta">{category==='meal'?<div className="period-budget">{period==='week'&&<span>周额 <Money value={weekLimit}/>　剩余 <b><Money value={weekLimit-summary.total}/></b></span>}<span>日额 <Money value={dailyLimit}/>　剩余 <b><Money value={dailyLimit-todaySpent}/></b></span></div>:<span>{categoryLabel}支出不计入三餐预算</span>}</div>
      <div className="period-total"><strong><Money value={summary.total}/></strong><span>日均 <b><Money value={summary.dailyAverage}/></b></span></div>
      {period==='month'?<div className="calendar-chart"><div className="calendar-weekdays">{weekdays.map(day=><span key={day}>{day}</span>)}</div><div className="calendar-grid" style={{'--start-column':String((days[0].date.getDay()+6)%7+1)} as React.CSSProperties}>{days.map((day,index)=><span key={day.dateKey} className={`${day.future?'future':''} ${day.amount?'spent':''} ${tone(day.amount)}`} style={{'--heat':String(Math.min(1,day.amount/maxAmount))} as React.CSSProperties} title={`${day.dateKey} ${yuan(day.amount)}`}><b>{day.date.getDate()}</b>{day.amount>0&&<i/>}{index===0&&<em>{billingStartDay}</em>}</span>)}</div></div>:<div className="bar-chart" aria-label={`${periodTitle}${categoryLabel}支出柱状图`}>{days.map((day,index)=>{const height=spentHeight(day.amount);return <div className={`bar-day ${day.future?'future':''} ${tone(day.amount)}`} key={day.dateKey}><div className="bar-track" title={`${day.dateKey}：支出 ${yuan(day.amount)}`}><i style={{height:`${height}px`}}/>{day.amount>0&&<div className="bar-value" style={{bottom:`${height+4}px`}}><Money value={day.amount} currency={false}/></div>}</div><span>周{weekdays[index]}<small>{day.date.getMonth()+1}/{day.date.getDate()}</small></span></div>})}</div>}
    </article>
  </SwipeActions>
}
function CategorySelector({value,onChange}:{value:'meal'|'other'|'all';onChange:(value:'meal'|'other'|'all')=>void}) {
  const [open,setOpen]=useState(false)
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null)
  const labels={meal:'三餐支出',other:'其他支出',all:'全部支出'}
  return <div className="category-selector"><button type="button" className="category-trigger" aria-label={`当前${labels[value]}，长按切换`} onPointerDown={()=>{timer.current=setTimeout(()=>setOpen(true),450)}} onPointerUp={()=>{if(timer.current)clearTimeout(timer.current)}} onPointerCancel={()=>{if(timer.current)clearTimeout(timer.current)}} onContextMenu={event=>{event.preventDefault();setOpen(true)}} onKeyDown={event=>{if(event.key==='Enter'||event.key===' ')setOpen(true)}}>{labels[value]}</button>{open&&<div className="category-options" role="group" aria-label="选择支出分类">{(['meal','other','all'] as const).map(id=><button key={id} type="button" className={value===id?'active':''} onClick={()=>{onChange(id);setOpen(false)}}>{labels[id]}</button>)}</div>}</div>
}
function Wishes({ledger,stats,onAdd,update,onBuy}:{ledger:Ledger;stats:ReturnType<typeof calc>;onAdd:()=>void;update:(l:Ledger)=>void;onBuy:(id:string)=>void}) { return <Page title="愿望单" action="添加愿望" onAction={onAdd}><p className="description">愿望先作计划，不扣减本月可支配额度；购买后才计入其他支出。自由基金购买不计入生活预算。</p><div className="cards">{ledger.wishes.length ? ledger.wishes.map(x => <SwipeActions key={x.id} className="wish-swipe" actionCount={2} actions={<><button className="swipe-pay" onClick={()=>onBuy(x.id)}><Check size={19}/><span>已购买</span></button><button className="swipe-delete" onClick={()=>update({...ledger,wishes:ledger.wishes.filter(w=>w.id!==x.id)})}><Trash2 size={19}/><span>删除</span></button></>}><article className="wish"><div><span className="pill">{x.intensity}/10 想要</span><h3>{x.title}</h3><small>{x.source === 'budget' ? '本月可支配额度' : x.source === 'freedom' ? '自由基金' : '暂未决定'}</small></div><b><Money value={x.amount}/></b></article></SwipeActions>) : <Empty text="把想买的东西放进来，再决定它值不值得占用预算。"/>}</div><div className="notice">计划中的愿望：<b><Money value={stats.wishReserved}/></b></div></Page> }
function SwipeActions({children,actions,actionCount=1,className='',leftActions,leftActionCount=0}:{children:React.ReactNode;actions:React.ReactNode;actionCount?:number;className?:string;leftActions?:React.ReactNode;leftActionCount?:number}) {
  const [open,setOpen] = useState<'left'|'right'|null>(null)
  const startX = useRef<number | null>(null)
  const dragX = useRef(0)
  const swiped = useRef(false)
  const finishSwipe = () => {
    if (dragX.current < -45) setOpen(open==='left'?null:'right')
    if (dragX.current > 35) setOpen(open==='right'?null:leftActions?'left':null)
    startX.current = null
    dragX.current = 0
  }
  const actionWidth = actionCount * 72
  const swipeWidth = actionWidth
  return <div className={`swipe-shell ${open ? `open open-${open}` : ''} ${className}`} style={{'--action-width':`${actionWidth}px`,'--swipe-width':`${swipeWidth}px`,'--left-action-width':`${leftActionCount*72}px`} as React.CSSProperties} onPointerDown={event=>{if(!open&&(event.target as HTMLElement).closest('button'))return;startX.current=event.clientX;dragX.current=0;swiped.current=false}} onPointerMove={event=>{if(startX.current!==null){dragX.current=event.clientX-startX.current;if(Math.abs(dragX.current)>8)swiped.current=true}}} onPointerUp={finishSwipe} onPointerCancel={finishSwipe}>
    <div className="swipe-actions" aria-hidden={open!=='right'} onClickCapture={event=>{if(swiped.current){event.preventDefault();event.stopPropagation();swiped.current=false;return}setOpen(null)}}>{actions}</div>
    {leftActions&&<div className="swipe-actions swipe-actions-left" aria-hidden={open!=='left'} onClickCapture={event=>{if(swiped.current){event.preventDefault();event.stopPropagation();swiped.current=false;return}setOpen(null)}}>{leftActions}</div>}
    <div className="swipe-content">{children}</div>
  </div>
}
function SettingsPage({ledger,update,testMode,onToggleTestData,configured,user,syncState,onLogin,onSignOut,onReset,onUndoReset,canUndoReset}:{ledger:Ledger;update:(l:Ledger)=>void;testMode:boolean;onToggleTestData:(active:boolean)=>Promise<void>;configured:boolean;user:User|null;syncState:'offline'|'syncing'|'synced'|'error';onLogin:(email:string)=>Promise<string>;onSignOut:()=>Promise<void>;onReset:()=>void;onUndoReset:()=>void;canUndoReset:boolean}) {
  const [confirmingReset,setConfirmingReset] = useState(false)
  const [testNotice,setTestNotice] = useState('')
  const display=ledger.display||defaultDisplay
  return <Page title="设置"><div className="panel settings"><section className="display-card"><b>显示设置</b><label className="switch-row"><span>金额使用千位分隔符<small>{display.groupThousands?'显示为 1,000.00':'显示为 1000.00'}</small></span><input type="checkbox" checked={display.groupThousands} onChange={e=>update({...ledger,display:{...display,groupThousands:e.target.checked}})}/></label><label>界面字体<select value={display.font} onChange={e=>update({...ledger,display:{...display,font:e.target.value as DisplayPreferences['font']}})}><option value="system">系统默认</option><option value="rounded">圆润字体</option><option value="serif">宋体</option></select></label></section><section className="test-data-card"><div><b>使用测试数据</b><small>使用你提供的钱迹账单副本。测试中的修改会单独保存，不影响正式账本。</small>{testNotice&&<small className="test-error">{testNotice}</small>}</div><button type="button" className={`toggle ${testMode?'on':''}`} role="switch" aria-checked={testMode} aria-label="使用测试数据" onClick={()=>{setTestNotice('');void onToggleTestData(!testMode).catch(error=>setTestNotice(error instanceof Error?error.message:'测试数据切换失败'))}}><span/></button></section><SyncSettings configured={configured} user={user} syncState={syncState} onLogin={onLogin} onSignOut={onSignOut}/><ImportExportSettings ledger={ledger} update={update}/><section className="reset-card"><div><b>重置数据</b><small>清空当前账本并恢复默认预算与房租，可在确认后撤回。</small></div>{confirmingReset?<div className="reset-confirm"><span>确定要重置当前账本吗？</span><button type="button" onClick={()=>setConfirmingReset(false)}>取消</button><button type="button" className="danger" onClick={()=>{onReset();setConfirmingReset(false)}}>确认重置</button></div>:<button type="button" className="reset-button" onClick={()=>setConfirmingReset(true)}>一键重置</button>}{canUndoReset&&<button type="button" className="undo-reset" onClick={onUndoReset}><RotateCcw size={16}/>撤回刚才的重置</button>}</section><p>{testMode?'当前正在使用测试账本，修改只保存在测试副本。':'未登录时数据仅保存在当前设备；登录后会自动同步。'}</p></div></Page>
}
function ImportExportSettings({ledger,update}:{ledger:Ledger;update:(ledger:Ledger)=>void}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview,setPreview] = useState<QianJiImportResult|null>(null)
  const [fileName,setFileName] = useState('')
  const [notice,setNotice] = useState('')
  const [busy,setBusy] = useState(false)
  const inspectFile = async (file?:File) => {
    if (!file) return
    setBusy(true); setNotice('')
    try {
      const readXlsxFile = (await import('read-excel-file/browser')).default
      const raw = await readXlsxFile(file)
      const next = parseQianJiRows(normalizeWorkbookRows(raw), new Set(ledger.transactions.map(item=>item.id)))
      setPreview(next); setFileName(file.name)
    } catch (error) {
      setPreview(null); setNotice(error instanceof Error ? error.message : '文件读取失败，请重新选择。')
    } finally { setBusy(false); if(inputRef.current) inputRef.current.value='' }
  }
  const confirmImport = () => {
    if (!preview?.transactions.length) return
    const transactions = [...preview.transactions, ...ledger.transactions].sort((a,b)=>b.date.localeCompare(a.date))
    update({...ledger,transactions})
    setNotice(`已导入 ${preview.transactions.length} 笔支出。`); setPreview(null); setFileName('')
  }
  const exportFile = async () => {
    setBusy(true); setNotice('')
    try {
      const writeXlsxFile = (await import('write-excel-file/browser')).default
      const source = transactionsToQianJiRows(ledger.transactions)
      const sheet = source.map((row,rowIndex)=>row.map(value=>({ value: value as string|number, type: typeof value === 'number' ? Number : String, fontWeight: rowIndex===0 ? 'bold' as const : undefined, textColor: rowIndex===0 ? '#FFFFFF' : undefined, backgroundColor: rowIndex===0 ? '#087D72' : undefined, align: rowIndex===0 ? 'center' as const : 'left' as const })))
      const columns = source[0].map((_,index)=>({width:[2,3,10].includes(index)?22:[1,4,6].includes(index)?16:12}))
      await writeXlsxFile(sheet,{sheet:'账单',columns,showGridLines:false}).toFile(`消费边界账单_${today}.xlsx`)
      setNotice(`已导出 ${ledger.transactions.length} 笔账目。`)
    } catch { setNotice('导出失败，请稍后重试。') } finally { setBusy(false) }
  }
  return <section className="transfer-card"><div className="transfer-heading"><div><b>账目导入与导出</b><small>支持钱迹导出的 Excel；导入只加入支出，且自动跳过重复账目。</small></div></div><input ref={inputRef} className="file-input" type="file" accept=".xlsx" onChange={event=>void inspectFile(event.target.files?.[0])}/><div className="transfer-actions"><button type="button" onClick={()=>inputRef.current?.click()} disabled={busy}><Upload size={17}/>{busy?'处理中…':'导入 Excel'}</button><button type="button" onClick={()=>void exportFile()} disabled={busy||!ledger.transactions.length}><Download size={17}/>导出 Excel</button></div>{preview&&<div className="import-preview"><b>{fileName}</b><span>可导入 {preview.transactions.length} 笔</span><small>{preview.skippedIncome} 笔收入已跳过 · {preview.duplicates} 笔重复已跳过 · {preview.skippedInvalid} 笔无法识别</small><div><button type="button" onClick={()=>{setPreview(null);setFileName('')}}>取消</button><button type="button" className="primary" disabled={!preview.transactions.length} onClick={confirmImport}>确认导入</button></div></div>}{notice&&<small className="transfer-notice" role="status">{notice}</small>}</section>
}
function SyncSettings({configured,user,syncState,onLogin,onSignOut}:{configured:boolean;user:User|null;syncState:'offline'|'syncing'|'synced'|'error';onLogin:(email:string)=>Promise<string>;onSignOut:()=>Promise<void>}) {
  const [email,setEmail] = useState('')
  const [notice,setNotice] = useState('')
  if (!configured) return <section className="sync-card"><b>跨设备同步尚未配置</b><small>请按 SYNC-SETUP.md 填写 .env.local 后重启应用。</small></section>
  if (user) return <section className="sync-card"><b>已登录 {user.email}</b><small>{syncState === 'synced' ? '已同步到云端' : syncState === 'syncing' ? '正在同步…' : '同步失败，请检查网络后再修改一次数据。'}</small><button type="button" onClick={()=>void onSignOut()}>退出登录</button></section>
  return <section className="sync-card"><b>跨设备同步</b><small>输入邮箱，点击邮件中的验证链接即可开始同步。</small><label>邮箱<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label><button type="button" className="primary" disabled={!email} onClick={()=>void onLogin(email).then(setNotice)}>发送登录链接</button>{notice&&<small role="status">{notice}</small>}</section>
}
function CategorySettings({ledger,update}:{ledger:Ledger;update:(ledger:Ledger)=>void}) {
  const groups=categoryGroups(ledger)
  const [groupName,setGroupName]=useState('')
  const [childNames,setChildNames]=useState<Record<string,string>>({})
  const [editing,setEditing]=useState<{group:number;child?:number}|null>(null)
  const [deletingGroup,setDeletingGroup]=useState<number|null>(null)
  const [draft,setDraft]=useState('')
  const saveGroups=(next:typeof groups,transactions=ledger.transactions)=>update({...ledger,categoryGroups:next,transactions})
  const rename=(groupIndex:number,childIndex?:number)=>{
    const name=draft.trim()
    if(!name)return
    const next=groups.map(group=>({...group,children:[...group.children]}))
    if(childIndex===undefined){
      if(next.some((group,index)=>index!==groupIndex&&group.name===name))return
      const old=next[groupIndex].name;next[groupIndex].name=name
      saveGroups(next,ledger.transactions.map(item=>item.categoryGroup===old?{...item,categoryGroup:name}:item))
    }else{
      if(next[groupIndex].children.some((child,index)=>index!==childIndex&&child===name))return
      const old=next[groupIndex].children[childIndex];next[groupIndex].children[childIndex]=name
      saveGroups(next,ledger.transactions.map(item=>item.category===old&&(item.categoryGroup||groupForCategory(groups,item.category))===groups[groupIndex].name?{...item,category:name,categoryGroup:groups[groupIndex].name}:item))
    }
    setEditing(null)
  }
  const removeChild=(groupIndex:number,childIndex:number)=>{
    const group=groups[groupIndex],child=group.children[childIndex]
    if(child==='其他')return
    const next=groups.map(item=>({...item,children:[...item.children]}));next[groupIndex].children.splice(childIndex,1)
    saveGroups(next,ledger.transactions.map(item=>item.category===child&&(item.categoryGroup||groupForCategory(groups,item.category))===group.name?{...item,category:'其他',categoryGroup:group.name}:item))
  }
  return <Page title="分类"><p className="description">先选大类，再选小类。删除小类时，旧账目会归到同一大类的“其他”。</p><div className="category-groups">{groups.map((group,groupIndex)=><section className="panel category-group" key={`${groupIndex}-${group.name}`}><div className="category-group-head">{editing?.group===groupIndex&&editing.child===undefined?<><input autoFocus value={draft} onChange={event=>setDraft(event.target.value)}/><button type="button" onClick={()=>rename(groupIndex)}>保存</button></>:<><h2>{group.name}</h2><button type="button" aria-label={`编辑大类${group.name}`} onClick={()=>{setDraft(group.name);setEditing({group:groupIndex})}}><Pencil size={16}/></button>{!['三餐','居住','日常'].includes(group.name)&&<button type="button" aria-label={`删除大类${group.name}`} onClick={()=>setDeletingGroup(groupIndex)}><Trash2 size={15}/></button>}</>}</div>{deletingGroup===groupIndex&&<div className="category-delete-confirm"><small>删除后，该大类账目会移到“日常 / 其他”。</small><button type="button" onClick={()=>setDeletingGroup(null)}>取消</button><button type="button" onClick={()=>{update({...ledger,categoryGroups:groups.filter((_,index)=>index!==groupIndex),transactions:ledger.transactions.map(item=>item.categoryGroup===group.name?{...item,categoryGroup:'日常',category:'其他'}:item)});setDeletingGroup(null)}}>确认删除</button></div>}<div className="category-list">{group.children.map((child,childIndex)=><span key={`${childIndex}-${child}`}>{editing?.group===groupIndex&&editing.child===childIndex?<><input autoFocus value={draft} onChange={event=>setDraft(event.target.value)}/><button type="button" onClick={()=>rename(groupIndex,childIndex)}>保存</button></>:<>{child}<button type="button" aria-label={`编辑${group.name}的${child}`} onClick={()=>{setDraft(child);setEditing({group:groupIndex,child:childIndex})}}><Pencil size={13}/></button>{child!=='其他'&&<button type="button" aria-label={`删除${group.name}的${child}`} onClick={()=>removeChild(groupIndex,childIndex)}><X size={14}/></button>}</>}</span>)}</div><div className="category-add"><input value={childNames[group.name]||''} onChange={event=>setChildNames({...childNames,[group.name]:event.target.value})} maxLength={20} placeholder="添加小类"/><button type="button" disabled={!childNames[group.name]?.trim()||group.children.includes(childNames[group.name].trim())} onClick={()=>{saveGroups(groups.map((item,index)=>index===groupIndex?{...item,children:[...item.children,childNames[group.name].trim()]}:item));setChildNames({...childNames,[group.name]:''})}}>添加</button></div></section>)}</div><div className="category-add category-add-group"><input value={groupName} onChange={event=>setGroupName(event.target.value)} maxLength={20} placeholder="添加大类"/><button type="button" disabled={!groupName.trim()||groups.some(group=>group.name===groupName.trim())} onClick={()=>{saveGroups([...groups,{name:groupName.trim(),children:['其他']}]);setGroupName('')}}>添加大类</button></div></Page>
}
function Page({title,action,onAction,children}:{title:string;action?:string;onAction?:()=>void;children:React.ReactNode}) { return <><div className="page-title"><h1>{title}</h1>{action&&<button className="primary" onClick={onAction}>{action}</button>}</div>{children}</> }
function Empty({text}:{text:string}) { return <div className="empty"><Sparkles size={22}/><p>{text}</p></div> }
function Modal({title,children,close}:{title:string;children:React.ReactNode;close:()=>void}) {
  const ref = useRef<HTMLFormElement>(null)
  const closeRef = useRef(close)
  closeRef.current = close
  useEffect(()=>{
    const prior = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    ref.current?.querySelector<HTMLInputElement>('input')?.focus()
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
function TransactionForm({close,save,initial,groups}:{close:()=>void;save:(x:Transaction)=>void;initial?:Transaction;groups:CategoryGroup[]}) {
  const initialGroup=initial?.categoryGroup||groupForCategory(groups,initial?.category||'三餐')
  const initialChildren=groups.find(item=>item.name===initialGroup)?.children||['其他']
  const initialCategory=initialChildren.includes(initial?.category||'')?initial!.category:initialChildren.includes(initial?.title||'')?initial!.title:initial?.categoryGroup||initialChildren[0]
  const [group,setGroup]=useState(groups.some(item=>item.name===initialGroup)?initialGroup:groups[0].name)
  const [category,setCategory]=useState(initialCategory)
  const [title,setTitle]=useState(initial?.title||'')
  const [amount,setAmount]=useState(initial?String(initial.amount):'')
  const [date,setDate]=useState(initial?.date||dateKey(new Date()))
  const [time,setTime]=useState(initial?.time||currentTime())
  const [note,setNote]=useState(initial?.note||'')
  const [meal,setMeal]=useState(initial?initial.source==='meal':true)
  const canChooseMeal=!initial||!initial.source||initial.source==='meal'||initial.source==='general'
  const chooseGroup=(name:string)=>{setGroup(name);setCategory(groups.find(item=>item.name===name)?.children[0]||'其他');setMeal(name==='三餐')}
  const submit=(again=false)=>{
    if(!validAmount(amount)||!date||!time)return
    save({...initial,id:initial?.id||uid(),title:title.trim()||category,amount:+amount,category,categoryGroup:group,date,time,note:note.trim()||undefined,source:canChooseMeal?(meal?'meal':'general'):initial?.source})
    if(again){setAmount('');setTitle('');setNote('')}else if(!initial)close()
  }
  return <Modal title={initial?'编辑账目':'记一笔'} close={close}><div className="quick-entry"><small>支出金额</small><div><span>¥</span><input autoFocus inputMode="decimal" type="number" min="0" step="0.01" value={amount} onChange={event=>setAmount(event.target.value)} placeholder="0.00"/></div></div><div className="entry-categories"><b>支出大类</b><div className="entry-groups">{groups.map(item=><button type="button" key={item.name} className={group===item.name?'active':''} onClick={()=>chooseGroup(item.name)}>{item.name}</button>)}</div><b>小类</b><div className="entry-children">{(groups.find(item=>item.name===group)?.children||['其他']).map(child=><button type="button" key={child} className={category===child?'active':''} onClick={()=>setCategory(child)}>{child}</button>)}</div></div><label>名称（可选）<input value={title} onChange={event=>setTitle(event.target.value)} placeholder={`默认：${category}`}/></label><div className="date-time-fields"><label>日期<input type="date" value={date} onChange={event=>setDate(event.target.value)}/></label><label>时间<input type="time" value={time} onChange={event=>setTime(event.target.value)}/></label></div><label>备注<textarea value={note} onChange={event=>setNote(event.target.value)} maxLength={120} placeholder="补充说明（可选）"/></label>{canChooseMeal&&<label className="check"><input type="checkbox" checked={meal} onChange={event=>setMeal(event.target.checked)}/> 计入三餐预算</label>}<div className="entry-actions">{!initial&&<button type="button" disabled={!validAmount(amount)} onClick={()=>submit(true)}>再记一笔</button>}<button type="button" className="submit" disabled={!validAmount(amount)||!date||!time} onClick={()=>submit()}>{initial?'保存修改':'保存'}</button></div></Modal>
}
function IncomeForm({close,save,initial}:{close:()=>void;save:(income:Income)=>void;initial?:Income}) {const [title,setTitle]=useState(initial?.title||'工资');const [amount,setAmount]=useState(initial?String(initial.amount):'');const [date,setDate]=useState(initial?.date||dateKey(new Date()));const [time,setTime]=useState(initial?.time||currentTime());return <Modal title={initial?'编辑工资收入':'记录工资收入'} close={close}><label>收入名称<input value={title} onChange={event=>setTitle(event.target.value)}/></label><label>金额<input type="number" min="0" step="0.01" value={amount} onChange={event=>setAmount(event.target.value)}/></label><div className="date-time-fields"><label>到账日期<input type="date" value={date} onChange={event=>setDate(event.target.value)}/></label><label>到账时间<input type="time" value={time} onChange={event=>setTime(event.target.value)}/></label></div><button type="button" className="submit" disabled={!title.trim()||!validAmount(amount)||!date||!time} onClick={()=>{save({id:initial?.id||uid(),title:title.trim(),amount:+amount,date,time});close()}}>保存收入</button></Modal>}
function WishForm({close,add}:{close:()=>void;add:(x:Wish)=>void}) { const [title,setTitle]=useState('');const [amount,setAmount]=useState('');const [intensity,setIntensity]=useState(5);const [source,setSource]=useState<Wish['source']>('budget');return <Modal title="添加愿望" close={close}><label>想买什么<input autoFocus value={title} onChange={e=>setTitle(e.target.value)} /></label><label>预计价格<input type="number" value={amount} onChange={e=>setAmount(e.target.value)} /></label><label>愿望强度：<b>{intensity}/10</b><input type="range" min="1" max="10" value={intensity} onChange={e=>setIntensity(+e.target.value)}/></label><label>资金来源<select value={source} onChange={e=>setSource(e.target.value as Wish['source'])}><option value="budget">本月可支配额度</option><option value="freedom">自由基金</option><option value="undecided">暂未决定</option></select></label><button type="button" className="submit" disabled={!title.trim() || !validAmount(amount)} onClick={()=>{if(title.trim()&&validAmount(amount)){add({id:uid(),title,amount:+amount,intensity,source});close()}}}>加入愿望单</button></Modal>}
