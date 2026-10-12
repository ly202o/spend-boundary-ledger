import { useState } from 'react'
import { appVersion } from './release'

declare const __BUILD_VERSION__: string

export default function AppUpdate() {
  const [checking,setChecking]=useState(false)
  const [version,setVersion]=useState<string|null>(null)
  const [notice,setNotice]=useState('')
  const check=async()=>{
    setChecking(true);setVersion(null);setNotice('')
    const controller=new AbortController()
    const timeout=window.setTimeout(()=>controller.abort(),10000)
    try{
      const url=new URL(`${import.meta.env.BASE_URL}version.json`,window.location.origin)
      url.searchParams.set('check',String(Date.now()))
      const response=await fetch(url,{cache:'no-store',signal:controller.signal})
      if(!response.ok)throw new Error('unavailable')
      const data=await response.json()
      if(typeof data.version!=='string'||!Number.isFinite(Date.parse(data.version)))throw new Error('invalid')
      if(data.version===__BUILD_VERSION__)setNotice('已是最新版本。')
      else {setVersion(data.version);setNotice(`发现新版本${typeof data.appVersion==='string'?' v'+data.appVersion:''}，点击更新即可。`)}
    }catch{setNotice('暂时无法检查更新，请确认网络连接后重试。')}
    finally{window.clearTimeout(timeout);setChecking(false)}
  }
  const reload=()=>{
    const url=new URL(window.location.href)
    url.searchParams.set('v',version||String(Date.now()))
    window.location.replace(url.toString())
  }
  return <section className="display-card app-update"><div className="transfer-actions"><button type="button" disabled={checking} onClick={()=>void check()}>{checking?'检查中…':'检查更新'}</button><button type="button" disabled={checking} onClick={reload}>{version?'立即更新':'重新加载'}</button></div><small>当前版本 v{appVersion}</small>{notice&&<small role="status">{notice}</small>}</section>
}

export function BuildInfo(){
  return <section className="display-card"><b>消费边界 v{appVersion}</b><small>构建时间：{new Date(__BUILD_VERSION__).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})}</small><p>检查更新与重新加载只更新应用页面，不清除本地账目和设置，也不需要删除桌面图标。</p></section>
}
