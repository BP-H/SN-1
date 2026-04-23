Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
$repo = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $repo

if (-not (Test-Path ".venv\Scripts\Activate.ps1")) {
  Write-Error "Virtual environment not found at .venv. Create it first."
  exit 1
}

. .\.venv\Scripts\Activate.ps1
python -m uvicorn app:app --host 0.0.0.0 --port 8000
