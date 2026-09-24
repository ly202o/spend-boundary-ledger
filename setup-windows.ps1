# 消费边界账本：首次安装与启动（Windows 10/11）
$ErrorActionPreference = 'Stop'
$projectRoot = Join-Path $env:USERPROFILE 'Documents\SpendBoundaryLedger'
$repository = 'https://github.com/ly202o/spend-boundary-ledger.git'

function Ensure-Command([string]$command, [string]$package) {
  if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
    Write-Host "正在安装 $command ..." -ForegroundColor Cyan
    winget install --id $package --exact --accept-source-agreements --accept-package-agreements
    $env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path', 'User')
  }
}

if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
  throw '此电脑缺少 Windows 包管理器 winget。请先在 Microsoft Store 安装“应用安装程序”，再重新运行。'
}

Ensure-Command git 'Git.Git'
Ensure-Command npm 'OpenJS.NodeJS.LTS'

if (-not (Test-Path (Join-Path $projectRoot '.git'))) {
  New-Item -ItemType Directory -Force -Path (Split-Path $projectRoot) | Out-Null
  Write-Host '正在下载你的私有项目。若出现 GitHub 登录窗口，请登录 ly202o 账号。' -ForegroundColor Cyan
  git clone $repository $projectRoot
}

Set-Location $projectRoot
git pull --ff-only
npm install
Write-Host ''
Write-Host '账本已启动。请在浏览器打开 http://127.0.0.1:5173/' -ForegroundColor Green
npm run dev -- --host 127.0.0.1
