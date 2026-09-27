import { useEffect, useRef, useMemo, useState } from 'react'
import { Check, CircleDollarSign, Heart, Home, Pause, Pencil, Play, Plus, ReceiptText, RotateCcw, Settings, Sparkles, Trash2, WalletCards, X } from 'lucide-react'
import { load, save } from './store'
import { calc } from './budget'
import type { Expense, Ledger, Transaction, Wish } from './types'
import type { User } from '@supabase/supabase-js'
import { supabase, syncConfigured } from './supabase'
import { fetchCloudLedger, saveCloudLedger, stamp } from './sync'
import { spendingPeriodDays, spendingPeriodSummary, type SpendingPeriod } from './period'

const yuan = (n: number) => `${n < 0 ? '−' : ''}¥${Math.abs(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
function Money({value,currency=true}:{value:number;currency?:boolean}) {
  const formatted=yuan(value)
  const [whole,decimal]=formatted.split('.')
  return <>{currency?whole:whole.replace('¥','')}<span className="money-decimal">.{decimal}</span></>
}
const now = new Date()
const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
const currentMonth = today.slice(0, 7)
const uid = () => crypto.randomUUID()
const validAmount = (value: string) => Number.isFinite(+value) && +value > 0 && +value <= 100000000 && /^\d+(\.\d{1,2})?$/.test(value)

export default function App() {
  const [ledger, setLedger] = useState<Ledger>(load)
  const [tab, setTab] = useState<'home'|'records'|'wishes'|'expenses'|'settings'>('home')
  const [modal, setModal] = useState<'transaction'|'wish'|'expense'|null>(null)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [resetBackup, setResetBackup] = useState<Ledger | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [syncState, setSyncState] = useState<'offline'|'syncing'|'synced'|'error'>('offline')
  const update = (next: Ledger) => {
    const stamped = stamp(next)
    setLedger(stamped); save(stamped)
    if (user) {
      setSyncState('syncing')
      saveCloudLedger(user, stamped).then(() => setSyncState('synced')).catch(() => setSyncState('error'))
    }
  }
  useEffect(() => {
    if (!supabase) return
    const hydrate = async (nextUser: User | null) => {
      setUser(nextUser)
      if (!nextUser) { setSyncState('offline'); return }
      setSyncState('syncing')
      try {
        const remote = await fetchCloudLedger(nextUser)
        const local = load()
        if (remote && (!local.updatedAt || new Date(remote.updatedAt || 0) > new Date(local.updatedAt))) {
          setLedger(remote); save(remote)
        } else {
          await saveCloudLedger(nextUser, stamp(local))
        }
        setSyncState('synced')
      } catch { setSyncState('error') }
    }
    supabase.auth.getUser().then(({ data }) => hydrate(data.user))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { void hydrate(session?.user ?? null) })
    return () => subscription.unsubscribe()
  }, [])
  const requestSyncLogin = async (email: string) => {
    if (!supabase) return '请先完成 Supabase 配置。'
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin + window.location.pathname } })
    return error?.message || '验证邮件已发送，请在此设备打开邮件中的链接。'
  }
  const signOut = async () => { await supabase?.auth.signOut() }
  const stats = useMemo(() => calc(ledger), [ledger])
  const paidExpense = (id: string) => {
    const exp = ledger.expenses.find(x => x.id === id)! 
    update({ ...ledger, expenses: ledger.expenses.map(x => x.id === id ? { ...x, paid: true, paidMonth: currentMonth } : x), transactions: [{ id: uid(), title: exp.title, amount: exp.amount, category: exp.category, date: today, source: 'fixed', fixedExpenseId: exp.id }, ...ledger.transactions] })
  }
  const undoPaidExpense = (id: string) => {
    const exp = ledger.expenses.find(x => x.id === id)
    if (!exp) return
    let removedLegacyMatch = false
    update({
      ...ledger,
      expenses: ledger.expenses.map(x => x.id === id ? { ...x, paid: false, paidMonth: undefined } : x),
      transactions: ledger.transactions.filter(transaction => {
        if (transaction.fixedExpenseId === id && transaction.date.startsWith(currentMonth)) return false
        const isLegacyMatch = !transaction.fixedExpenseId && !removedLegacyMatch && transaction.source === 'fixed' && transaction.title === exp.title && transaction.amount === exp.amount && transaction.date.startsWith(currentMonth)
        if (isLegacyMatch) removedLegacyMatch = true
        return !isLegacyMatch
      })
    })
  }
  const deleteTransaction = (id: string) => update({ ...ledger, transactions: ledger.transactions.filter(x => x.id !== id) })
  const resetData = () => {
    setResetBackup(ledger)
    update({ monthlyBudget: 4000, mealBudget: 1500, mode: 'fixed', transactions: [], wishes: [], expenses: [] })
  }
  const undoReset = () => {
    if (!resetBackup) return
    update(resetBackup)
    setResetBackup(null)
  }
  const buyWish = (id: string) => {
    const wish = ledger.wishes.find(x => x.id === id)
    if (!wish) return
    update({ ...ledger, wishes: ledger.wishes.filter(x => x.id !== id), transactions: [{ id: uid(), title: wish.title, amount: wish.amount, category: '愿望', date: today, source: 'wish', budgetImpact: wish.source === 'budget' }, ...ledger.transactions] })
  }
  return <main className="app">
    <header><div className="brand"><WalletCards size={26}/><span>消费边界</span></div><div className="header-actions"><div className="month">{now.getFullYear()} 年 {now.getMonth()+1} 月</div><button className={`settings-shortcut ${tab === 'settings' ? 'active' : ''}`} aria-label="设置" onClick={()=>setTab('settings')}><Settings size={20}/></button></div></header>
    <section className="content">
      {tab === 'home' && <HomePage stats={stats} ledger={ledger} />}
      {tab === 'records' && <Records items={ledger.transactions} onDelete={deleteTransaction} onEdit={setEditingTransaction} />}
      {tab === 'wishes' && <Wishes ledger={ledger} stats={stats} onAdd={() => setModal('wish')} update={update} onBuy={buyWish} />}
      {tab === 'expenses' && <Expenses items={ledger.expenses} onAdd={() => setModal('expense')} onPay={paidExpense} onUndoPay={undoPaidExpense} update={update} ledger={ledger} />}
      {tab === 'settings' && <SettingsPage ledger={ledger} update={update} configured={syncConfigured} user={user} syncState={syncState} onLogin={requestSyncLogin} onSignOut={signOut} onReset={resetData} onUndoReset={undoReset} canUndoReset={!!resetBackup} />}
    </section>
    <nav aria-label="主导航">
      <div className="nav-tabs">
        {([['home', Home, '首页'], ['records', ReceiptText, '账目'], ['wishes', Heart, '愿望'], ['expenses', CircleDollarSign, '固定支出']] as const).map(([id, Icon, name]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}><Icon size={20}/><span>{name}</span></button>)}
      </div>
      <button className="nav-add" aria-label="记一笔" onClick={() => setModal('transaction')}><Plus size={33}/></button>
    </nav>
    {modal === 'transaction' && <TransactionForm close={() => setModal(null)} save={(x) => update({ ...ledger, transactions: [x, ...ledger.transactions] })}/>} 
    {editingTransaction && <TransactionForm initial={editingTransaction} close={() => setEditingTransaction(null)} save={(x) => { update({ ...ledger, transactions: ledger.transactions.map(item => item.id === x.id ? x : item) }); setEditingTransaction(null) }}/>} 
    {modal === 'wish' && <WishForm close={() => setModal(null)} add={(x) => update({ ...ledger, wishes: [x, ...ledger.wishes] })}/>} 
    {modal === 'expense' && <ExpenseForm close={() => setModal(null)} add={(x) => update({ ...ledger, expenses: [...ledger.expenses, x] })}/>} 
  </main>
}

function HomePage({ stats, ledger }: { stats: ReturnType<typeof calc>; ledger: Ledger }) {
  const [period,setPeriod] = useState<SpendingPeriod>('week')
  return <><div className="overview"><article className="hero"><span className="hero-label"><WalletCards size={18}/>本月真正可支配</span><strong><Money value={stats.available}/></strong><p>{stats.available < 0 ? '预算已超出，先调整消费安排。' : '必要的已留好，这些由你自由安排。'}</p><div className="hero-bottom"><span>生活预算<b><Money value={ledger.monthlyBudget}/></b></span><span>实际支出<b><Money value={stats.spent}/></b></span><span>三餐待用<b><Money value={stats.mealRemaining}/></b></span></div></article><SpendingPeriodCard period={period} setPeriod={setPeriod} transactions={ledger.transactions} dailyLimit={stats.mealDaily}/></div>
  <div className="grid home-metrics"><Metric label="为愿望留一点" value={<Money value={stats.wishReserved}/>} hint="高强度愿望 · 本月资金" accent/></div>
  <section className="panel"><div className="section-title"><h2>最近账目</h2></div>{ledger.transactions.length ? ledger.transactions.slice(0,4).map(x => <div className="line" key={x.id}><div><b>{x.title}</b><small>{x.category} · {x.date}</small></div><strong><Money value={-x.amount}/></strong></div>) : <Empty text="还没有账目。点击下方加号记录第一笔消费。"/>}</section>
  <p className="budget-note">本机保存 · 预留支付不重复扣款 · 自由基金独立于生活预算</p></>
}
function Metric({ label, value, hint, accent, green }: {label:string;value:React.ReactNode;hint:string;accent?:boolean;green?:boolean}) { return <article className={`metric ${accent ? 'accent' : ''} ${green ? 'green' : ''}`}><span>{label}</span><b>{value}</b><small>{hint}</small></article> }
function Records({items,onDelete,onEdit}:{items:Transaction[];onDelete:(id:string)=>void;onEdit:(item:Transaction)=>void}) { return <Page title="全部账目"><div className="records-panel">{items.length ? items.map(x=><SwipeRecord key={x.id} item={x} onDelete={()=>onDelete(x.id)} onEdit={()=>onEdit(x)}/>):<div className="panel"><Empty text="点击下方加号，记录第一笔消费。"/></div>}</div></Page> }
function SwipeRecord({item,onDelete,onEdit}:{item:Transaction;onDelete:()=>void;onEdit:()=>void}) {
  const actions = <><button className="swipe-edit" aria-label={`编辑 ${item.title}`} onClick={onEdit}><Pencil size={18}/><span>编辑</span></button><button className="swipe-delete" aria-label={`删除 ${item.title}`} onClick={onDelete}><Trash2 size={19}/><span>删除</span></button></>
  return <SwipeActions actionCount={2} actions={actions}>
    <div className="line">
      <div><b>{item.title}</b><small>{item.category} · {item.date}{item.budgetImpact === false ? ' · 自由基金' : ''}</small>{item.note&&<small className="record-note">{item.note}</small>}</div><strong><Money value={-item.amount}/></strong>
    </div>
  </SwipeActions>
}
function SpendingPeriodCard({period,setPeriod,transactions,dailyLimit}:{period:SpendingPeriod;setPeriod:(period:SpendingPeriod)=>void;transactions:Transaction[];dailyLimit:number}) {
  const [category,setCategory] = useState<'meal'|'other'|'all'>('meal')
  const labels:Record<SpendingPeriod,string>={week:'本周',seven:'近7日',month:'本月'}
  const filtered=useMemo(()=>category==='all'?transactions:transactions.filter(item=>category==='meal'?item.source==='meal':item.source!=='meal'),[transactions,category])
  const summary=useMemo(()=>spendingPeriodSummary(filtered,period),[filtered,period])
  const days=useMemo(()=>spendingPeriodDays(filtered,period),[filtered,period])
  const maxAmount=Math.max(1,...days.map(day=>day.amount))
  const tone=(amount:number)=>amount<=0?'zero':category==='other'?'other':category==='all'?'all':dailyLimit<=0||amount>dailyLimit?'over':amount>=dailyLimit*.8?'near':'within'
  const spentHeight=(amount:number)=>amount>0?Math.max(8,amount/maxAmount*68):0
  const weekdays=['一','二','三','四','五','六','日']
  const actions=<>{(['week','seven','month'] as const).map(id=><button key={id} className={`period-choice ${period===id?'selected':''}`} aria-label={`切换到${labels[id]}`} onClick={()=>setPeriod(id)}><span>{labels[id]}</span></button>)}</>
  const weekLimit=dailyLimit*7
  const todaySpent=filtered.filter(item=>item.date===today).reduce((sum,item)=>sum+item.amount,0)
  const categoryLabel=category==='meal'?'三餐':category==='other'?'其他':'全部'
  return <SwipeActions className="period-swipe" actionCount={3} actions={actions}><article className="period-card"><div className="period-heading"><span className="eyebrow">{labels[period]}支出</span><div className="period-filter" role="group" aria-label="支出分类"><button className={category==='meal'?'active':''} onClick={()=>setCategory('meal')}>三餐支出</button><button className={category==='other'?'active':''} onClick={()=>setCategory('other')}>其他支出</button><button className={category==='all'?'active':''} onClick={()=>setCategory('all')}>全部支出</button></div></div><div className="period-meta">{category==='meal'?<div className="period-budget">{period==='week'&&<span>周额 <Money value={weekLimit}/>　剩余 <b><Money value={weekLimit-summary.total}/></b></span>}<span>日额 <Money value={dailyLimit}/>　剩余 <b><Money value={dailyLimit-todaySpent}/></b></span></div>:<span>{categoryLabel}支出不计入三餐预算</span>}<small>左滑切换周期</small></div><div className="period-total"><strong><Money value={summary.total}/></strong><span>日均 <b><Money value={summary.dailyAverage}/></b></span></div>{period==='month'?<div className="calendar-chart"><div className="calendar-weekdays">{weekdays.map(day=><span key={day}>{day}</span>)}</div><div className="calendar-grid" style={{'--start-column':String((days[0].date.getDay()+6)%7+1)} as React.CSSProperties}>{days.map((day,index)=><span key={day.dateKey} className={`${day.future?'future':''} ${day.amount?'spent':''} ${tone(day.amount)}`} style={{'--heat':String(Math.min(1,day.amount/maxAmount))} as React.CSSProperties} title={`${day.dateKey} ${yuan(day.amount)}`}><b>{day.date.getDate()}</b>{day.amount>0&&<i/>}{index===0&&<em>16</em>}</span>)}</div></div>:<div className="bar-chart" aria-label={`${labels[period]}${categoryLabel}支出柱状图`}>{days.map((day,index)=>{const height=spentHeight(day.amount);return <div className={`bar-day ${day.future?'future':''} ${tone(day.amount)}`} key={day.dateKey}><div className="bar-track" title={`${day.dateKey}：支出 ${yuan(day.amount)}`}><i style={{height:`${height}px`}}/>{day.amount>0&&<div className="bar-value" style={{bottom:`${height+4}px`}}><Money value={day.amount} currency={false}/></div>}</div><span>{period==='week'?`周${weekdays[index]}`:`${day.date.getMonth()+1}/${day.date.getDate()}`}</span></div>})}</div>}</article></SwipeActions>
}
function Wishes({ledger,stats,onAdd,update,onBuy}:{ledger:Ledger;stats:ReturnType<typeof calc>;onAdd:()=>void;update:(l:Ledger)=>void;onBuy:(id:string)=>void}) { return <Page title="愿望单" action="添加愿望" onAction={onAdd}><p className="description">强度为 8–10 且使用本月预算的愿望，会自动预留金额。购买后预留转换为实际支出，只扣一次。</p><div className="cards">{ledger.wishes.length ? ledger.wishes.map(x => <article className="wish" key={x.id}><div><span className="pill">{x.intensity}/10 想要</span><h3>{x.title}</h3><small>{x.source === 'budget' ? '本月可支配额度' : x.source === 'freedom' ? '自由基金' : '暂未决定'}</small></div><b><Money value={x.amount}/></b><div className="actions"><button className="primary" onClick={()=>onBuy(x.id)}>已购买</button><button onClick={()=>update({...ledger,wishes:ledger.wishes.filter(w=>w.id!==x.id)})}>删除</button></div></article>) : <Empty text="把想买的东西放进来，再决定它值不值得占用预算。"/>}</div><div className="notice">当前愿望预留：<b><Money value={stats.wishReserved}/></b></div></Page> }
function Expenses({items,onAdd,onPay,onUndoPay,update,ledger}:{items:Expense[];onAdd:()=>void;onPay:(id:string)=>void;onUndoPay:(id:string)=>void;update:(l:Ledger)=>void;ledger:Ledger}) { return <Page title="固定支出" action="添加项目" onAction={onAdd}><p className="description">左滑项目可标记支付、停用或删除；标错后也可以撤回。下月会自动重新预留。</p><div className="cards">{items.map(x => {
  const paidThisMonth = x.paidMonth ? x.paidMonth === currentMonth : x.paid
  const toggleActive = () => update({...ledger,expenses:ledger.expenses.map(e=>e.id===x.id?{...e,active:!e.active}:e)})
  const swipeActions = <>{x.active && (paidThisMonth ? <button className="swipe-undo" aria-label={`撤回 ${x.title} 的支付`} onClick={()=>onUndoPay(x.id)}><RotateCcw size={19}/><span>撤回</span></button> : <button className="swipe-pay" aria-label={`标记 ${x.title} 已支付`} onClick={()=>onPay(x.id)}><Check size={20}/><span>支付</span></button>)}<button className="swipe-toggle" aria-label={`${x.active?'停用':'启用'} ${x.title}`} onClick={toggleActive}>{x.active?<Pause size={19}/>:<Play size={19}/>}<span>{x.active?'停用':'启用'}</span></button><button className="swipe-delete" aria-label={`删除 ${x.title}`} onClick={()=>update({...ledger,expenses:ledger.expenses.filter(e=>e.id!==x.id)})}><Trash2 size={19}/><span>删除</span></button></>
  const actionCount = x.active ? 3 : 2
  const status = paidThisMonth ? '本月已支付' : x.active ? '待支付' : '已停用'
  const statusClass = paidThisMonth ? 'paid' : x.active ? 'pending' : 'disabled'
  return <SwipeActions key={x.id} className="expense-swipe" actionCount={actionCount} actions={swipeActions}><article className="expense"><div><h3>{x.title}</h3><div className="expense-meta"><small>{x.category}</small><span className={`status-badge ${statusClass}`}>{status}</span></div></div><b><Money value={x.amount}/></b></article></SwipeActions>
})}</div></Page> }
function SwipeActions({children,actions,actionCount=1,className=''}:{children:React.ReactNode;actions:React.ReactNode;actionCount?:number;className?:string}) {
  const [open,setOpen] = useState(false)
  const startX = useRef<number | null>(null)
  const dragX = useRef(0)
  const swiped = useRef(false)
  const finishSwipe = () => {
    if (dragX.current < -45) setOpen(true)
    if (dragX.current > 35) setOpen(false)
    startX.current = null
    dragX.current = 0
  }
  const actionWidth = actionCount * 72
  const swipeWidth = actionWidth
  return <div className={`swipe-shell ${open ? 'open' : ''} ${className}`} style={{'--action-width':`${actionWidth}px`,'--swipe-width':`${swipeWidth}px`} as React.CSSProperties} onPointerDown={event=>{if(!open&&(event.target as HTMLElement).closest('button'))return;startX.current=event.clientX;dragX.current=0;swiped.current=false}} onPointerMove={event=>{if(startX.current!==null){dragX.current=event.clientX-startX.current;if(Math.abs(dragX.current)>8)swiped.current=true}}} onPointerUp={finishSwipe} onPointerCancel={finishSwipe}>
    <div className="swipe-actions" aria-hidden={!open} onClickCapture={event=>{if(swiped.current){event.preventDefault();event.stopPropagation();swiped.current=false;return}setOpen(false)}}>{actions}</div>
    <div className="swipe-content">{children}</div>
  </div>
}
function SettingsPage({ledger,update,configured,user,syncState,onLogin,onSignOut,onReset,onUndoReset,canUndoReset}:{ledger:Ledger;update:(l:Ledger)=>void;configured:boolean;user:User|null;syncState:'offline'|'syncing'|'synced'|'error';onLogin:(email:string)=>Promise<string>;onSignOut:()=>Promise<void>;onReset:()=>void;onUndoReset:()=>void;canUndoReset:boolean}) {
  const [confirmingReset,setConfirmingReset] = useState(false)
  return <Page title="预算设置"><div className="panel settings"><label>月生活预算<input type="number" value={ledger.monthlyBudget} onChange={e=>update({...ledger,monthlyBudget:+e.target.value})}/></label><label>三餐月预算<input type="number" value={ledger.mealBudget} onChange={e=>update({...ledger,mealBudget:+e.target.value})}/></label><label>三餐日额模式<select value={ledger.mode} onChange={e=>update({...ledger,mode:e.target.value as Ledger['mode']})}><option value="dynamic">动态均摊</option><option value="fixed">固定日额</option></select></label><SyncSettings configured={configured} user={user} syncState={syncState} onLogin={onLogin} onSignOut={onSignOut}/><section className="reset-card"><div><b>重置数据</b><small>清空账目、愿望和固定支出，预算恢复为默认值。</small></div>{confirmingReset?<div className="reset-confirm"><span>确定要重置全部数据吗？</span><button type="button" onClick={()=>setConfirmingReset(false)}>取消</button><button type="button" className="danger" onClick={()=>{onReset();setConfirmingReset(false)}}>确认重置</button></div>:<button type="button" className="reset-button" onClick={()=>setConfirmingReset(true)}>一键重置</button>}{canUndoReset&&<button type="button" className="undo-reset" onClick={onUndoReset}><RotateCcw size={16}/>撤回刚才的重置</button>}</section><p>未登录时数据仅保存在当前设备；登录后会自动同步。</p></div></Page>
}
function SyncSettings({configured,user,syncState,onLogin,onSignOut}:{configured:boolean;user:User|null;syncState:'offline'|'syncing'|'synced'|'error';onLogin:(email:string)=>Promise<string>;onSignOut:()=>Promise<void>}) {
  const [email,setEmail] = useState('')
  const [notice,setNotice] = useState('')
  if (!configured) return <section className="sync-card"><b>跨设备同步尚未配置</b><small>请按 SYNC-SETUP.md 填写 .env.local 后重启应用。</small></section>
  if (user) return <section className="sync-card"><b>已登录 {user.email}</b><small>{syncState === 'synced' ? '已同步到云端' : syncState === 'syncing' ? '正在同步…' : '同步失败，请检查网络后再修改一次数据。'}</small><button type="button" onClick={()=>void onSignOut()}>退出登录</button></section>
  return <section className="sync-card"><b>跨设备同步</b><small>输入邮箱，点击邮件中的验证链接即可开始同步。</small><label>邮箱<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label><button type="button" className="primary" disabled={!email} onClick={()=>void onLogin(email).then(setNotice)}>发送登录链接</button>{notice&&<small role="status">{notice}</small>}</section>
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
function TransactionForm({close,save,initial}:{close:()=>void;save:(x:Transaction)=>void;initial?:Transaction}) { const [title,setTitle]=useState(initial?.title||''); const [amount,setAmount]=useState(initial?String(initial.amount):''); const [date,setDate]=useState(initial?.date||today); const [note,setNote]=useState(initial?.note||''); const [meal,setMeal]=useState(initial?.source==='meal'); const [category,setCategory]=useState(initial?.category||'日常消费'); const canChooseMeal=!initial||!initial.source||initial.source==='meal'||initial.source==='general'; return <Modal title={initial?'编辑账目':'记一笔消费'} close={close}><label>名称<input autoFocus value={title} onChange={e=>setTitle(e.target.value)} placeholder="例如：午餐"/></label><label>金额<input type="number" min="0" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00"/></label><label>日期<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label>分类<input value={category} onChange={e=>setCategory(e.target.value)}/></label><label>备注<textarea value={note} onChange={e=>setNote(e.target.value)} maxLength={120} placeholder="可选，例如：和朋友聚餐"/></label>{canChooseMeal&&<label className="check"><input type="checkbox" checked={meal} onChange={e=>setMeal(e.target.checked)}/> 计入三餐预算</label>}<button type="button" className="submit" disabled={!title.trim() || !validAmount(amount) || !date} onClick={()=>{if(title.trim()&&validAmount(amount)&&date){save({...initial,id:initial?.id||uid(),title:title.trim(),amount:+amount,category:meal?'三餐':category.trim()||'日常消费',date,note:note.trim()||undefined,source:canChooseMeal?(meal?'meal':'general'):initial?.source});if(!initial)close()}}}>{initial?'保存修改':'保存账目'}</button></Modal> }
function WishForm({close,add}:{close:()=>void;add:(x:Wish)=>void}) { const [title,setTitle]=useState('');const [amount,setAmount]=useState('');const [intensity,setIntensity]=useState(5);const [source,setSource]=useState<Wish['source']>('budget');return <Modal title="添加愿望" close={close}><label>想买什么<input autoFocus value={title} onChange={e=>setTitle(e.target.value)} /></label><label>预计价格<input type="number" value={amount} onChange={e=>setAmount(e.target.value)} /></label><label>愿望强度：<b>{intensity}/10</b><input type="range" min="1" max="10" value={intensity} onChange={e=>setIntensity(+e.target.value)}/></label><label>资金来源<select value={source} onChange={e=>setSource(e.target.value as Wish['source'])}><option value="budget">本月可支配额度</option><option value="freedom">自由基金</option><option value="undecided">暂未决定</option></select></label><button type="button" className="submit" disabled={!title.trim() || !validAmount(amount)} onClick={()=>{if(title.trim()&&validAmount(amount)){add({id:uid(),title,amount:+amount,intensity,source});close()}}}>加入愿望单</button></Modal>}
function ExpenseForm({close,add}:{close:()=>void;add:(x:Expense)=>void}) {const [title,setTitle]=useState('');const [amount,setAmount]=useState('');return <Modal title="添加固定支出" close={close}><label>名称<input autoFocus value={title} onChange={e=>setTitle(e.target.value)} placeholder="例如：房租"/></label><label>金额<input type="number" value={amount} onChange={e=>setAmount(e.target.value)}/></label><button type="button" className="submit" disabled={!title.trim() || !validAmount(amount)} onClick={()=>{if(title.trim()&&validAmount(amount)){add({id:uid(),title,amount:+amount,active:true,paid:false,category:'固定费用'});close()}}}>添加并预留</button></Modal>}
