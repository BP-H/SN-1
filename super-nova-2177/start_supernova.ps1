Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "      SuperNova 2177 Unified Launcher     " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Which Frontend would you like to launch?"
Write-Host "  1. Next.js (Legacy)" -ForegroundColor Green
Write-Host "  2. Vite Professional" -ForegroundColor Yellow
Write-Host "  3. Vite 3D" -ForegroundColor Magenta
Write-Host "  4. Vite Basic" -ForegroundColor White
Write-Host "  5. Frontend Nova (legacy / retired candidate)" -ForegroundColor Cyan
Write-Host "  6. Social Six (Next.js + Social Login)" -ForegroundColor Blue
Write-Host "  7. Social Seven (Active/default FE7)" -ForegroundColor Magenta
Write-Host ""

$choice = Read-Host "Enter a number (1-7) or press Enter for Social Seven"

if ([string]::IsNullOrWhiteSpace($choice)) {
    $choice = "7"
}

$frontendMap = @{
    "1" = "frontend-next"
    "2" = "frontend-professional"
    "3" = "frontend-vite-3d"
    "4" = "frontend-vite-basic"
    "5" = "frontend-nova"
    "6" = "frontend-social-six"
    "7" = "frontend-social-seven"
}

$frontendPorts = @{
    "frontend-next" = 3000
    "frontend-professional" = 5173
    "frontend-vite-3d" = 5175
    "frontend-vite-basic" = 5174
    "frontend-nova" = 5176
    "frontend-social-six" = 3001
    "frontend-social-seven" = 3007
}

$frontendDir = $frontendMap[$choice]

if ($null -eq $frontendDir) {
    Write-Host "Invalid choice. Exiting." -ForegroundColor Red
    exit 1
}

Write-Host "`n[1/2] Starting Backend in a new window..." -ForegroundColor Cyan
$repoPath = Split-Path -Parent $MyInvocation.MyCommand.Path

# Start the backend in a separate PowerShell window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$repoPath'; Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass; .\.venv\Scripts\Activate.ps1; python -m uvicorn app:app --host 0.0.0.0 --port 8000"

Write-Host "[2/2] Starting Frontend: $frontendDir..." -ForegroundColor Cyan

# Start the frontend in the current window
Set-Location "$repoPath\$frontendDir"
if ($frontendDir -eq "frontend-next" -or $frontendDir -eq "frontend-social-six" -or $frontendDir -eq "frontend-social-seven") {
    $env:NEXT_PUBLIC_API_URL = "http://127.0.0.1:8000"
    & "C:\Program Files\nodejs\npm.cmd" run dev
} else {
    $env:VITE_API_URL = "http://127.0.0.1:8000"
    $port = $frontendPorts[$frontendDir]
    & "C:\Program Files\nodejs\npm.cmd" run dev -- --host 0.0.0.0 --port $port
}
