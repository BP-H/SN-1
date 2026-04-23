Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
$repoPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location "$repoPath\frontend-social-seven"
$env:NEXT_PUBLIC_API_URL = "http://127.0.0.1:8000"
& "C:\Program Files\nodejs\npm.cmd" run dev
