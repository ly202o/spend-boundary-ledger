import { test } from 'node:test'
import assert from 'node:assert/strict'
import { initialLedger, loadWorkspace, pruneTrash, saveWorkspace } from './store.ts'
import type { TrashEntry } from './types.ts'

function memoryStorage() {
  const values=new Map<string,string>()
  return {getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value)},removeItem:(key:string)=>{values.delete(key)}}
}

test('旧正式和测试数据迁移为两个独立可命名账本',()=>{
  const storage=memoryStorage()
  const previous=globalThis.localStorage
  Object.defineProperty(globalThis,'localStorage',{value:storage,configurable:true})
  try {
    storage.setItem('spend-boundary-ledger-v1',JSON.stringify({...initialLedger,transactions:[{id:'main-t',title:'正式',amount:1,date:'2026-09-20',category:'三餐'}]}))
    storage.setItem('spend-boundary-ledger-test-v1',JSON.stringify({...initialLedger,transactions:[{id:'old',title:'旧测试',amount:1,date:'2026-09-15',category:'三餐'},{id:'test-t',title:'测试',amount:2,date:'2026-09-20',category:'三餐'}]}))
    storage.setItem('spend-boundary-ledger-test-mode','true')
    const workspace=loadWorkspace()
    assert.equal(workspace.books.length,2)
    assert.equal(workspace.activeBookId,'test')
    assert.deepEqual(workspace.books.find(book=>book.id==='main')?.ledger.transactions.map(item=>item.id),['main-t'])
    assert.deepEqual(workspace.books.find(book=>book.id==='test')?.ledger.transactions.map(item=>item.id),['test-t'])
    workspace.books[1].name='旅行测试'
    saveWorkspace(workspace)
    assert.equal(loadWorkspace().books[1].name,'旅行测试')
  } finally {
    if(previous===undefined)Reflect.deleteProperty(globalThis,'localStorage')
    else Object.defineProperty(globalThis,'localStorage',{value:previous,configurable:true})
  }
})

test('垃圾桶只保留最近三十天',()=>{
  const at=new Date('2026-10-02T00:00:00.000Z')
  const entry=(id:string,deletedAt:string):TrashEntry=>({id,bookId:'main',kind:'transaction',label:id,deletedAt,data:{}})
  assert.deepEqual(pruneTrash([entry('recent','2026-10-01T00:00:00.000Z'),entry('old','2026-08-31T00:00:00.000Z')],at).map(item=>item.id),['recent'])
})
