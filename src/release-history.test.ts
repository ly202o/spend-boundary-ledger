import test from 'node:test'
import assert from 'node:assert/strict'
import { releaseHistory } from './release-history.ts'

test('历史日志按年/月/日倒序分组，同一天版本合并不漏条目',()=>{
 const result=releaseHistory('## 2025-12-31\n- 旧更新\n## v1.0.0 · 2026-10-12\n- 新模块\n## 2026-09-24\n- 初版\n## v1.0.1 · 2026-10-12\n- 折叠日志\n### 旧版说明\n- 修复\n## 2026-10-04\n- 饮食预算')
 assert.deepEqual(result.map(item=>item.year),['2026','2025'])
 assert.deepEqual(result[0].months.map(item=>item.month),['10','09'])
 assert.deepEqual(result[0].months[0].days.map(item=>item.date),['2026-10-12','2026-10-04'])
 assert.deepEqual(result[0].months[0].days[0].versions,['v1.0.0','v1.0.1'])
 assert.deepEqual(result[0].months[0].days[0].items,['新模块','折叠日志','修复'])
 assert.deepEqual(releaseHistory('# 更新日志\n说明'),[])
})
