import { useEffect, useRef, useMemo, useState } from 'react'
import { CircleDollarSign, Heart, Home, Plus, ReceiptText, Settings, Sparkles, WalletCards, X } from 'lucide-react'
import { load, save } from './store'
import { calc } from './budget'
import type { Expense, Ledger, Transaction, Wish } from './types'

const yuan = (n: number) => `${n < 0 ? '−' : ''}¥${Math.abs(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const now = new Date()
const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
const uid = () => crypto.randomUUID()
const validAmount = (value: string) => Number.isFinite(+value) && +value > 0 && +value <= 100000000 && /^\d+(\.\d{1,2})?$/.test(value)

export default function App() {
  const [ledger, setLedger] = useState<Ledger>(load)
  const [tab, setTab] = useState<'home'|'records'|'wishes'|'expenses'|'settings'>('home')
  const [modal, setModal] = useState<'transaction'|'wish'|'expense'|null>(null)
  const update = (next: Ledger) => { setLedger(next); save(next) }
  const stats = useMemo(() => calc(ledger), [ledger])
  const paidExpense = (id: string) => {
    const exp = ledger.expenses.find(x => x.id === id)! 
    update({ ...ledger, expenses: ledger.expenses.map(x => x.id === id ? { ...x, paid: true } : x), transactions: [{ id: uid(), title: exp.title, amount: exp.amount, category: exp.category, date: today, source: 'fixed' }, ...ledger.transactions] })
  }
  const deleteTransaction = (id: string) => update({ ...ledger, transactions: ledger.transactions.filter(x => x.id !== id) })
  const buyWish = (id: string) => {
    const wish = ledger.wishes.find(x => x.id === id)
    if (!wish) return
    update({ ...ledger, wishes: ledger.wishes.filter(x => x.id !== id), transactions: [{ id: uid(), title: wish.title, amount: wish.amount, category: '愿望', date: today, source: 'wish', budgetImpact: wish.source === 'budget' }, ...ledger.transactions] })
  }
  return <main className="app">
    <header><div className="brand"><WalletCards size={26}/><span>消费边界</span></div><div className="month">{now.getFullYear()} 年 {now.getMonth()+1} 月</div></header>
    <section className="content">
      {tab === 'home' && <HomePage stats={stats} ledger={ledger} onAdd={() => setModal('transaction')} />}
      {tab === 'records' && <Records items={ledger.transactions} onAdd={() => setModal('transaction')} onDelete={deleteTransaction} />}
      {tab === 'wishes' && <Wishes ledger={ledger} stats={stats} onAdd={() => setModal('wish')} update={update} onBuy={buyWish} />}
      {tab === 'expenses' && <Expenses items={ledger.expenses} onAdd={() => setModal('expense')} onPay={paidExpense} update={update} ledger={ledger} />}
      {tab === 'settings' && <SettingsPage ledger={ledger} update={update} />}
    </section>
    <nav>{[
      ['home', Home, '首页'], ['records', ReceiptText, '账目'], ['wishes', Heart, '愿望'], ['expenses', CircleDollarSign, '固定支出'], ['settings', Settings, '设置']
    ].map(([id, Icon, name]) => <button key={id as string} className={tab === id ? 'active' : ''} onClick={() => setTab(id as typeof tab)}><Icon size={20}/><span>{name as string}</span></button>)}</nav>
    {modal === 'transaction' && <TransactionForm close={() => setModal(null)} add={(x) => update({ ...ledger, transactions: [x, ...ledger.transactions] })}/>} 
    {modal === 'wish' && <WishForm close={() => setModal(null)} add={(x) => update({ ...ledger, wishes: [x, ...ledger.wishes] })}/>} 
    {modal === 'expense' && <ExpenseForm close={() => setModal(null)} add={(x) => update({ ...ledger, expenses: [...ledger.expenses, x] })}/>} 
  </main>
}

function HomePage({ stats, ledger, onAdd }: { stats: ReturnType<typeof calc>; ledger: Ledger; onAdd: () => void }) {
  return <><div className="greeting"><p>每一份克制，都留给未来的自己</p><h1>把选择留给自己。</h1><button className="round-add" onClick={onAdd}><Plus size={19}/>记一笔</button></div>
  <div className="overview"><article className="hero"><span className="hero-label"><WalletCards size={18}/>本月真正可支配</span><strong>{yuan(stats.available)}</strong><p>{stats.available < 0 ? '预算已超出，先调整消费安排。' : '必要的已留好，这些由你自由安排。'}</p><div className="hero-bottom"><span>生活预算<b>{yuan(ledger.monthlyBudget)}</b></span><span>实际支出<b>{yuan(stats.spent)}</b></span><span>三餐待用<b>{yuan(stats.mealRemaining)}</b></span></div></article><article className="today-card"><span className="eyebrow">今日 · {ledger.mode === 'dynamic' ? '动态均摊' : '固定日额'}</span><h2>三餐还能花</h2><strong>{yuan(stats.todayLeft)}</strong><p>{stats.todayLeft < 0 ? '今日已超额，留意后续安排。' : '好好吃饭，也照顾好预算。'}</p><div className="progress" role="progressbar" aria-label="今日三餐预算使用比例" aria-valuenow={Math.min(100, Math.round(stats.todayMeal / (stats.mealDaily || 1)*100))} aria-valuemin={0} aria-valuemax={100}><span style={{width:`${Math.min(100,stats.todayMeal/(stats.mealDaily||1)*100)}%`}}/></div><div className="today-foot"><span>已花 {yuan(stats.todayMeal)}</span><span>额度 {yuan(stats.mealDaily)}</span></div></article></div>
  <div className="grid"><Metric label="固定支出已预留" value={yuan(stats.fixedReserved)} hint="尚未支付，已提前留好"/><Metric label="为愿望留一点" value={yuan(stats.wishReserved)} hint="高强度愿望 · 本月资金" accent/><Metric label="今日暂留额度" value={yuan(Math.max(0,stats.todayLeft))} hint="当天尚未结束，未计为节省成果" green/></div>
  <section className="panel"><div className="section-title"><h2>最近账目</h2><button onClick={onAdd}>+ 记账</button></div>{ledger.transactions.length ? ledger.transactions.slice(0,4).map(x => <div className="line" key={x.id}><div><b>{x.title}</b><small>{x.category} · {x.date}</small></div><strong>-{yuan(x.amount)}</strong></div>) : <Empty text="还没有账目。记录第一笔消费吧。"/>}</section>
  <p className="budget-note">本机保存 · 预留支付不重复扣款 · 自由基金独立于生活预算</p></>
}
function Metric({ label, value, hint, accent, green }: {label:string;value:string;hint:string;accent?:boolean;green?:boolean}) { return <article className={`metric ${accent ? 'accent' : ''} ${green ? 'green' : ''}`}><span>{label}</span><b>{value}</b><small>{hint}</small></article> }
function Records({items,onAdd,onDelete}:{items:Transaction[];onAdd:()=>void;onDelete:(id:string)=>void}) { return <Page title="全部账目" action="记一笔" onAction={onAdd}><div className="panel">{items.length ? items.map(x=><div className="line" key={x.id}><div><b>{x.title}</b><small>{x.category} · {x.date}{x.budgetImpact === false ? ' · 自由基金' : ''}</small></div><div className="record-end"><strong>-{yuan(x.amount)}</strong><button aria-label={`删除 ${x.title}`} onClick={()=>onDelete(x.id)}>删除</button></div></div>):<Empty text="开始记账后，消费记录会显示在这里。"/>}</div></Page> }
function Wishes({ledger,stats,onAdd,update,onBuy}:{ledger:Ledger;stats:ReturnType<typeof calc>;onAdd:()=>void;update:(l:Ledger)=>void;onBuy:(id:string)=>void}) { return <Page title="愿望单" action="添加愿望" onAction={onAdd}><p className="description">强度为 8–10 且使用本月预算的愿望，会自动预留金额。购买后预留转换为实际支出，只扣一次。</p><div className="cards">{ledger.wishes.length ? ledger.wishes.map(x => <article className="wish" key={x.id}><div><span className="pill">{x.intensity}/10 想要</span><h3>{x.title}</h3><small>{x.source === 'budget' ? '本月可支配额度' : x.source === 'freedom' ? '自由基金' : '暂未决定'}</small></div><b>{yuan(x.amount)}</b><div className="actions"><button className="primary" onClick={()=>onBuy(x.id)}>已购买</button><button onClick={()=>update({...ledger,wishes:ledger.wishes.filter(w=>w.id!==x.id)})}>删除</button></div></article>) : <Empty text="把想买的东西放进来，再决定它值不值得占用预算。"/>}</div><div className="notice">当前愿望预留：<b>{yuan(stats.wishReserved)}</b></div></Page> }
function Expenses({items,onAdd,onPay,update,ledger}:{items:Expense[];onAdd:()=>void;onPay:(id:string)=>void;update:(l:Ledger)=>void;ledger:Ledger}) { return <Page title="固定支出" action="添加项目" onAction={onAdd}><p className="description">预留变为支付时只转换状态，不会重复扣款。</p><div className="cards">{items.map(x => <article className="expense" key={x.id}><div><h3>{x.title}</h3><small>{x.category} · {x.paid ? '已支付' : x.active ? '已预留 / 未支付' : '已停用'}</small></div><b>{yuan(x.amount)}</b><div className="actions">{x.active && !x.paid && <button className="primary" onClick={()=>onPay(x.id)}>标记支付</button>}<button onClick={()=>update({...ledger,expenses:ledger.expenses.map(e=>e.id===x.id?{...e,active:!e.active}:e)})}>{x.active?'停用':'启用'}</button></div></article>)}</div></Page> }
function SettingsPage({ledger,update}:{ledger:Ledger;update:(l:Ledger)=>void}) { return <Page title="预算设置"><div className="panel settings"><label>月生活预算<input type="number" value={ledger.monthlyBudget} onChange={e=>update({...ledger,monthlyBudget:+e.target.value})}/></label><label>三餐月预算<input type="number" value={ledger.mealBudget} onChange={e=>update({...ledger,mealBudget:+e.target.value})}/></label><label>三餐日额模式<select value={ledger.mode} onChange={e=>update({...ledger,mode:e.target.value as Ledger['mode']})}><option value="dynamic">动态均摊</option><option value="fixed">固定日额</option></select></label><p>数据目前保存在此设备浏览器中。下一阶段会增加账户登录与跨设备同步。</p></div></Page> }
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
        const nodes = Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input,select')||[])
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
function TransactionForm({close,add}:{close:()=>void;add:(x:Transaction)=>void}) { const [title,setTitle]=useState(''); const [amount,setAmount]=useState(''); const [meal,setMeal]=useState(false); const [category,setCategory]=useState('日常消费'); return <Modal title="记一笔消费" close={close}><label>名称<input autoFocus value={title} onChange={e=>setTitle(e.target.value)} placeholder="例如：午餐"/></label><label>金额<input type="number" min="0" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00"/></label><label>分类<input value={category} onChange={e=>setCategory(e.target.value)}/></label><label className="check"><input type="checkbox" checked={meal} onChange={e=>setMeal(e.target.checked)}/> 计入三餐预算</label><button type="button" className="submit" disabled={!title.trim() || !validAmount(amount)} onClick={()=>{if(title.trim()&&validAmount(amount)){add({id:uid(),title,amount:+amount,category:meal?'三餐':category.trim()||'日常消费',date:today,source:meal?'meal':'general'});close()}}}>保存账目</button></Modal> }
function WishForm({close,add}:{close:()=>void;add:(x:Wish)=>void}) { const [title,setTitle]=useState('');const [amount,setAmount]=useState('');const [intensity,setIntensity]=useState(5);const [source,setSource]=useState<Wish['source']>('budget');return <Modal title="添加愿望" close={close}><label>想买什么<input autoFocus value={title} onChange={e=>setTitle(e.target.value)} /></label><label>预计价格<input type="number" value={amount} onChange={e=>setAmount(e.target.value)} /></label><label>愿望强度：<b>{intensity}/10</b><input type="range" min="1" max="10" value={intensity} onChange={e=>setIntensity(+e.target.value)}/></label><label>资金来源<select value={source} onChange={e=>setSource(e.target.value as Wish['source'])}><option value="budget">本月可支配额度</option><option value="freedom">自由基金</option><option value="undecided">暂未决定</option></select></label><button type="button" className="submit" disabled={!title.trim() || !validAmount(amount)} onClick={()=>{if(title.trim()&&validAmount(amount)){add({id:uid(),title,amount:+amount,intensity,source});close()}}}>加入愿望单</button></Modal>}
function ExpenseForm({close,add}:{close:()=>void;add:(x:Expense)=>void}) {const [title,setTitle]=useState('');const [amount,setAmount]=useState('');return <Modal title="添加固定支出" close={close}><label>名称<input autoFocus value={title} onChange={e=>setTitle(e.target.value)} placeholder="例如：房租"/></label><label>金额<input type="number" value={amount} onChange={e=>setAmount(e.target.value)}/></label><button type="button" className="submit" disabled={!title.trim() || !validAmount(amount)} onClick={()=>{if(title.trim()&&validAmount(amount)){add({id:uid(),title,amount:+amount,active:true,paid:false,category:'固定费用'});close()}}}>添加并预留</button></Modal>}
