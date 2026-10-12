import { useState } from 'react'
import { appVersion } from './release'
import changelog from '../CHANGELOG.md?raw'
import { versionNotes } from './release-history'

declare const __BUILD_VERSION__: string

export default function AppUpdate() {
  const [checking,setChecking]=useState(false)
  const [notice,setNotice]=useState('')
  const check=async()=>{
    setChecking(true);setNotice('')
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
      else {
        setNotice('发现新版本，正在更新…')
        const target=new URL(window.location.href)
        target.searchParams.set('v',data.version)
        window.location.replace(target.toString())
      }
    }catch{setNotice('暂时无法检查更新，请确认网络连接后重试。')}
    finally{window.clearTimeout(timeout);setChecking(false)}
  }
  return <section className="display-card app-update"><div className="update-row"><button type="button" disabled={checking} onClick={()=>void check()}>{checking?'检查中…':'检查更新'}</button><small>当前版本 v{appVersion}</small></div>{notice&&<small role="status">{notice}</small>}</section>
}

export function BuildInfo(){
  return <section className="display-card release-notes"><b>消费边界 v{appVersion}</b><small>构建时间：{new Date(__BUILD_VERSION__).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})}</small><h2>本版更新</h2>{versionNotes(changelog,appVersion).map((item,index)=><p key={index}>{item}</p>)}<h2>休息时间卡片</h2><p>包含发薪、周五、期待日倒计时及今天已赚估算。添加入口：更多 → 首页卡片 → 休息时间；滑动卡片 → 编辑卡片，可修改日期、收入和当天工作时段。</p><p>检查更新与重新加载只更新应用页面，不清除本地账目和设置，也不需要删除桌面图标。</p></section>
}
