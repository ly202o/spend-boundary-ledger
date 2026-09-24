# 在一台新 Windows 电脑上继续

先安装 [ChatGPT 桌面版](https://chatgpt.com/download)。登录和当前相同的账号后，打开 Codex。

打开你的私有仓库 [ly202o/spend-boundary-ledger](https://github.com/ly202o/spend-boundary-ledger)，点击绿色 **Code** 按钮，再点 **Download ZIP**。下载完成后：

1. 解压 ZIP。
2. 双击里面的 `START.cmd`。
3. 出现 GitHub 登录窗口时，登录 `ly202o` 账号。

它会安装 Git、Node.js，下载项目并启动本地网页。浏览器打开：

```text
http://127.0.0.1:5173/
```

之后只要在 PowerShell 运行：

```powershell
cd $env:USERPROFILE\Documents\SpendBoundaryLedger
git pull
npm run dev
```

在 Codex 中把 `C:\Users\你的用户名\Documents\SpendBoundaryLedger` 添加为本地项目，然后直接说“继续开发消费边界账本”。

该仓库是私有仓库，首次下载时 GitHub 会让你使用 `ly202o` 账号授权。这个步骤确保其他人无法读取你的源代码。
