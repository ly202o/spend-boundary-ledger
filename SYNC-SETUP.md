# 开启跨设备同步

1. 在 [Supabase](https://supabase.com/dashboard) 创建免费项目。
2. 在 SQL Editor 中执行 [`supabase/schema.sql`](supabase/schema.sql) 的全部内容。
3. 在 **Authentication → URL Configuration** 的 Redirect URLs 中加入本地地址，例如 `http://127.0.0.1:5173/**`；部署后也加入正式网址。
4. 在项目的 **Connect** 面板复制 Project URL 和 Publishable key；将 `.env.example` 复制为 `.env.local`，填入这两个值。
5. 重启 `npm run dev`，在应用“设置”页面输入邮箱。邮件中的链接验证后，当前本地账本会自动上传；其他设备登录同一邮箱即可下载和继续同步。

公开 Publishable key 可以放在浏览器端；数据库访问由 `schema.sql` 中的 Row Level Security 策略限制到当前登录用户。绝不要把 `service_role` key 写入前端或提交到 Git。
