import { useState } from 'react'
import AppUpdate, { BuildInfo } from './AppUpdate'
import ReleaseNotes from './ReleaseNotes'

const features=[
  ['多账本','为日常、旅行或测试创建独立账本，分别管理账目和设置。'],
  ['预算与边界','先预留饮食、房租等预算，再看弹性余额；饮食日额支持固定金额或动态均摊。'],
  ['记账与分类','数字键盘快速记账，日期时间可编辑；饮食包含三餐、夜宵、零食饮品等小类。'],
  ['支出概览','查看本周、近七日或账期月历，按分类筛选；首页卡片可添加和排序。'],
  ['账目与收入','按日期、时间和分类查找支出，单独记录收入；收入不会自动扩大生活预算。'],
  ['滑动操作','卡片和账目通过滑动展开菜单，进行编辑、删除或模式选择；部分图表支持双击切换分类。'],
  ['愿望与回收站','管理愿望清单；删除的可恢复项目在回收站保留 30 天，也可彻底删除。'],
  ['备份与个性化','完整备份所有账本及设置，支持 Excel 支出交换；字体、金额格式与支出颜色可调整。'],
]

type AboutView='menu'|'intro'|'features'|'data'|'version'|'history'
const entries:[AboutView,string][]=[['intro','项目介绍'],['features','功能概览'],['data','数据与使用说明'],['version','版本信息'],['history','更新日志']]
export default function About(){
  const [view,setView]=useState<AboutView>('menu')
  return <div className="panel settings about-page">
    <div hidden={view!=='menu'}><AppUpdate/><div className="about-links">{entries.map(([id,label])=><button type="button" key={id} onClick={()=>setView(id)}><span>{label}</span><span aria-hidden="true">›</span></button>)}</div></div>
    {view!=='menu'&&<><button type="button" className="more-back" onClick={()=>setView('menu')}>‹ 返回关于</button>
      {view==='intro'&&<section className="display-card about-intro"><b>消费边界</b><p>把预算变成看得见的消费边界。先留好必要的开支，再清楚地知道饮食还能花多少、剩下的钱可以怎样安排。</p><small>一个以滑动菜单、直观支出图表和本地数据为核心的轻量记账工具。</small></section>}
      {view==='features'&&<section className="display-card about-overview"><b>功能概览</b>{features.map(([title,description])=><details key={title}><summary>{title}</summary><p>{description}</p></details>)}</section>}
      {view==='data'&&<section className="display-card about-data"><b>数据与使用说明</b><p>账目和设置保存在当前设备、当前浏览器本地。目前不提供跨设备自动同步，换设备时需先导出完整备份，再在另一设备导入。</p><p>完整 JSON 备份包含账本、预算、分类、收入、首页卡片、账本规则、显示设置和回收站。Excel 仅交换支出账目，不包含设置。</p><p>应用更新只重新加载页面，不清除本地数据。清除浏览器网站数据、卸载或更换浏览器可能导致原本地数据无法访问，请定期备份。</p><small>预算与日额是消费参考，不是银行余额。本月弹性余额不等于所有账户的现金总额。</small></section>}
      {view==='version'&&<BuildInfo/>}
      {view==='history'&&<ReleaseNotes/>}
    </>}
  </div>
}
