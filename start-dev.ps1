# start-dev.ps1 - Start Banana Slides development environment
# Usage: .\start-dev.ps1

Write-Host "Starting Banana Slides..." -ForegroundColor Green
Write-Host ""

# Get script directory (project root)
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

# Start backend in new PowerShell window
Write-Host "[1/2] Starting Backend (port 5000)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectRoot\backend'; Write-Host 'Backend starting...' -ForegroundColor Yellow; uv run alembic upgrade head; uv run python app.py"

# Wait for backend to initialize
Write-Host "[...] Waiting for backend to start..." -ForegroundColor Gray
Start-Sleep -Seconds 3

# Start frontend in current terminal
Write-Host "[2/2] Starting Frontend (port 3000)..." -ForegroundColor Cyan
Write-Host ""
Set-Location "$projectRoot\frontend"
npm run dev
