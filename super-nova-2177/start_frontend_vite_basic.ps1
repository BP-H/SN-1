Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
$repo = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Join-Path $repo "frontend-vite-basic")
$env:VITE_API_URL = "http://127.0.0.1:8000"
& "C:\Program Files\nodejs\npm.cmd" run dev -- --host 0.0.0.0 --port 5174
