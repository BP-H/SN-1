Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
$repo = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Join-Path $repo "frontend-next")
$env:NEXT_PUBLIC_API_URL = "http://127.0.0.1:8000"
& "C:\Program Files\nodejs\npm.cmd" run dev
