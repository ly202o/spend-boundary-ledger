import { useMemo, useState } from 'react'
import { CircleDollarSign, Heart, Home, Plus, ReceiptText, Settings, Sparkles, WalletCards, X } from 'lucide-react'
import { load, save } from './store'
import type { Expense, Ledger, Transaction, Wish } from './types'

const yuan = (n: number) => `¥${Math.max(0, n).toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
const today = new Date().toISOString().slice(0, 10)
const uid = () => crypto.randomUUID()

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
  return <main className="app">
    <header><div className="brand"><WalletCards size={26}/><span>消费边界</span></div><div className="month">2026 年 9 月</div></header>
    <section className="content">
      {tab === 'home' && <HomePage stats={stats} ledger={ledger} onAdd={() => setModal('transaction')} />}
      {tab === 'records' && <Records items={ledger.transactions} onAdd={() => setModal('transaction')} />}
      {tab === 'wishes' && <Wishes ledger={ledger} stats={stats} onAdd={() => setModal('wish')} update={update} />}
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

function calc(l: Ledger) {
  const spent = l.transactions.reduce((s, x) => s + x.amount, 0)
  const fixedReserved = l.expenses.filter(x => x.active && !x.paid).reduce((s, x) => s + x.amount, 0)
  const wishReserved = l.wishes.filter(x => x.intensity >= 8 && x.source === 'budget').reduce((s, x) => s + x.amount, 0)
  const mealSpent = l.transactions.filter(x => x.source === 'meal').reduce((s, x) => s + x.amount, 0)
  const day = new Date().getDate(), days = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
  const mealDaily = l.mode === 'fixed' ? l.mealBudget / days : Math.max(0, l.mealBudget - mealSpent) / Math.max(1, days - day + 1)
  const todayMeal = l.transactions.filter(x => x.source === 'meal' && x.date === today).reduce((s, x) => s + x.amount, 0)
  return { spent, fixedReserved, wishReserved, reserved: fixedReserved + wishReserved, available: l.monthlyBudget - spent - fixedReserved - wishReserved, mealSpent, mealDaily, todayMeal, todayLeft: mealDaily - todayMeal, saved: Math.max(0, l.mealBudget / days - todayMeal) }
}

function HomePage({ stats, ledger, onAdd }: { stats: ReturnType<typeof calc>; ledger: Ledger; onAdd: () => void }) {
  return <><div className="greeting"><p>今天的消费边界</p><h1>先看还能花多少</h1><button className="round-add" onClick={onAdd}><Plus size={19}/>记一笔</button></div>
  <article className="hero"><span>今日三餐还能花</span><strong>{yuan(stats.todayLeft)}</strong><div><span>今日额度 {yuan(stats.mealDaily)}</span><span>已花 {yuan(stats.todayMeal)}</span></div></article>
  <div className="grid"><Metric label="本月真正可支配" value={yuan(stats.available)} hint="已扣除预留与实际支出" accent/><Metric label="已预留" value={yuan(stats.reserved)} hint={`固定支出 ${yuan(stats.fixedReserved)} · 愿望 ${yuan(stats.wishReserved)}`}/><Metric label="本月节省成果" value={`+${yuan(stats.saved)}`} hint="今天三餐留下的额度" green/></div>
  <section className="panel"><div className="section-title"><h2>最近账目</h2><button onClick={onAdd}>+ 记账</button></div>{ledger.transactions.length ? ledger.transactions.slice(0,4).map(x => <div className="line" key={x.id}><div><b>{x.title}</b><small>{x.category} · {x.date}</small></div><strong>-{yuan(x.amount)}</strong></div>) : <Empty text="还没有账目。记录第一笔消费吧。"/>}</section>
  </>
}
function Metric({ label, value, hint, accent, green }: {label:string;value:string;hint:string;accent?:boolean;green?:boolean}) { return <article className={`metric ${accent ? 'accent' : ''} ${green ? 'green' : ''}`}><span>{label}</span><b>{value}</b><small>{hint}</small></article> }
function Records({items,onAdd}:{items:Transaction[];onAdd:()=>void}) { return <Page title="全部账目" action="记一笔" onAction={onAdd}><div className="panel">{items.length ? items.map(x=><div className="line" key={x.id}><div><b>{x.title}</b><small>{x.category} · {x.date}</small></div><strong>-{yuan(x.amount)}</strong></div>):<Empty text="开始记账后，消费记录会显示在这里。"/>}</div></Page> }
function Wishes({ledger,stats,onAdd,update}:{ledger:Ledger;stats:ReturnType<typeof calc>;onAdd:()=>void;update:(l:Ledger)=>void}) { return <Page title="愿望单" action="添加愿望" onAction={onAdd}><p className="description">强度为 8–10 且使用本月预算的愿望，会自动预留金额。</p><div className="cards">{ledger.wishes.length ? ledger.wishes.map(x => <article className="wish" key={x.id}><div><span className="pill">{x.intensity}/10 想要</span><h3>{x.title}</h3><small>{x.source === 'budget' ? '本月可支配额度' : x.source === 'freedom' ? '自由基金' : '暂未决定'}</small></div><b>{yuan(x.amount)}</b><button onClick={()=>update({...ledger,wishes:ledger.wishes.filter(w=>w.id!==x.id)})}>删除</button></article>) : <Empty text="把想买的东西放进来，再决定它值不值得占用预算。"/>}</div><div className="notice">当前愿望预留：<b>{yuan(stats.wishReserved)}</b></div></Page> }
function Expenses({items,onAdd,onPay,update,ledger}:{items:Expense[];onAdd:()=>void;onPay:(id:string)=>void;update:(l:Ledger)=>void;ledger:Ledger}) { return <Page title="固定支出" action="添加项目" onAction={onAdd}><p className="description">预留变为支付时只转换状态，不会重复扣款。</p><div className="cards">{items.map(x => <article className="expense" key={x.id}><div><h3>{x.title}</h3><small>{x.category} · {x.paid ? '已支付' : x.active ? '已预留 / 未支付' : '已停用'}</small></div><b>{yuan(x.amount)}</b><div className="actions">{x.active && !x.paid && <button className="primary" onClick={()=>onPay(x.id)}>标记支付</button>}<button onClick={()=>update({...ledger,expenses:ledger.expenses.map(e=>e.id===x.id?{...e,active:!e.active}:e)})}>{x.active?'停用':'启用'}</button></div></article>)}</div></Page> }
function SettingsPage({ledger,update}:{ledger:Ledger;update:(l:Ledger)=>void}) { return <Page title="预算设置"><div className="panel settings"><label>月生活预算<input type="number" value={ledger.monthlyBudget} onChange={e=>update({...ledger,monthlyBudget:+e.target.value})}/></label><label>三餐月预算<input type="number" value={ledger.mealBudget} onChange={e=>update({...ledger,mealBudget:+e.target.value})}/></label><label>三餐日额模式<select value={ledger.mode} onChange={e=>update({...ledger,mode:e.target.value as Ledger['mode']})}><option value="dynamic">动态均摊</option><option value="fixed">固定日额</option></select></label><p>数据目前保存在此设备浏览器中。下一阶段会增加账户登录与跨设备同步。</p></div></Page> }
function Page({title,action,onAction,children}:{title:string;action?:string;onAction?:()=>void;children:React.ReactNode}) { return <><div className="page-title"><h1>{title}</h1>{action&&<button className="primary" onClick={onAction}>{action}</button>}</div>{children}</> }
function Empty({text}:{text:string}) { return <div className="empty"><Sparkles size={22}/><p>{text}</p></div> }
function Modal({title,children,close}:{title:string;children:React.ReactNode;close:()=>void}) { return <div className="shade"><form className="modal" onSubmit={e=>e.preventDefault()}><button type="button" className="close" onClick={close}><X/></button><h2>{title}</h2>{children}</form></div> }
function TransactionForm({close,add}:{close:()=>void;add:(x:Transaction)=>void}) { const [title,setTitle]=useState(''); const [amount,setAmount]=useState(''); const [meal,setMeal]=useState(false); return <Modal title="记一笔消费" close={close}><label>名称<input autoFocus value={title} onChange={e=>setTitle(e.target.value)} placeholder="例如：午餐"/></label><label>金额<input type="number" min="0" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00"/></label><label>分类<input defaultValue="日常消费"/></label><label className="check"><input type="checkbox" checked={meal} onChange={e=>setMeal(e.target.checked)}/> 计入三餐预算</label><button className="submit" onClick={()=>{if(title&&+amount){add({id:uid(),title,amount:+amount,category:meal?'三餐':'日常消费',date:today,source:meal?'meal':'general'});close()}}}>保存账目</button></Modal> }
function WishForm({close,add}:{close:()=>void;add:(x:Wish)=>void}) { const [title,setTitle]=useState('');const [amount,setAmount]=useState('');const [intensity,setIntensity]=useState(5);const [source,setSource]=useState<Wish['source']>('budget');return <Modal title="添加愿望" close={close}><label>想买什么<input autoFocus value={title} onChange={e=>setTitle(e.target.value)} /></label><label>预计价格<input type="number" value={amount} onChange={e=>setAmount(e.target.value)} /></label><label>愿望强度：<b>{intensity}/10</b><input type="range" min="1" max="10" value={intensity} onChange={e=>setIntensity(+e.target.value)}/></label><label>资金来源<select value={source} onChange={e=>setSource(e.target.value as Wish['source'])}><option value="budget">本月可支配额度</option><option value="freedom">自由基金</option><option value="undecided">暂未决定</option></select></label><button className="submit" onClick={()=>{if(title&&+amount){add({id:uid(),title,amount:+amount,intensity,source});close()}}}>加入愿望单</button></Modal>}
function ExpenseForm({close,add}:{close:()=>void;add:(x:Expense)=>void}) {const [title,setTitle]=useState('');const [amount,setAmount]=useState('');return <Modal title="添加固定支出" close={close}><label>名称<input autoFocus value={title} onChange={e=>setTitle(e.target.value)} placeholder="例如：房租"/></label><label>金额<input type="number" value={amount} onChange={e=>setAmount(e.target.value)}/></label><button className="submit" onClick={()=>{if(title&&+amount){add({id:uid(),title,amount:+amount,active:true,paid:false,category:'固定费用'});close()}}}>添加并预留</button></Modal>}
