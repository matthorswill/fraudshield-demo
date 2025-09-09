#requires -Version 5

param(
  [int]$ApiPort = 4000,
  [int]$WebPort = 3000,
  [string]$ApiBase = "http://localhost:4000"
)

$ErrorActionPreference = 'Stop'

Write-Host "=== Dev Orchestrator ===" -ForegroundColor Cyan

function Kill-StaleBackend {
  try {
    Get-CimInstance Win32_Process |
      Where-Object { $_.CommandLine -match 'backend[\\/]+server\.js' } |
      ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  } catch {}
}

function Wait-HttpOk([string]$url, [int]$retries = 60, [int]$msDelay = 500) {
  for ($i = 0; $i -lt $retries; $i++) {
    try {
      $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
      if ($r.StatusCode -ge 200) { return $true }
    } catch {}
    Start-Sleep -Milliseconds $msDelay
  }
  return $false
}

Kill-StaleBackend

Write-Host "Starting API on port $ApiPort..." -ForegroundColor Yellow
$backend = Start-Process -FilePath node -ArgumentList 'backend/server.js' -PassThru -WindowStyle Hidden -RedirectStandardOutput dev.backend.log -RedirectStandardError dev.backend.err

if (-not (Wait-HttpOk "$ApiBase/_status" 60 500)) {
  Write-Warning "API did not become ready at $ApiBase/_status"
} else {
  Write-Host "API ready: $ApiBase" -ForegroundColor Green
}

$env:NEXT_PUBLIC_API_BASE = $ApiBase

# Start Next dev without npm.cmd to avoid PATH issues
$nextBin = Join-Path -Path (Join-Path $PSScriptRoot '..') -ChildPath 'node_modules/next/dist/bin/next'
if (-not (Test-Path $nextBin)) {
  Write-Warning "Next.js binary not found at $nextBin. Have you run 'npm ci' or 'npm install'?"
}

Write-Host "Starting Next dev on port $WebPort..." -ForegroundColor Yellow
$frontend = Start-Process -FilePath node -ArgumentList $nextBin, 'dev', 'frontend', '-p', ($WebPort.ToString()) -PassThru -RedirectStandardOutput dev.frontend.log -RedirectStandardError dev.frontend.err

if (-not (Wait-HttpOk "http://localhost:$WebPort/" 120 500)) {
  Write-Warning "Frontend did not become ready on http://localhost:$WebPort/"
} else {
  Write-Host "Frontend ready: http://localhost:$WebPort/" -ForegroundColor Green
}

Write-Host "Press Ctrl+C to stop both processes..." -ForegroundColor Cyan

try {
  Wait-Process -Id $frontend.Id
} finally {
  Write-Host "Stopping processes..." -ForegroundColor Yellow
  # --- Cleanup (robuste) ---
  try {
    if ($frontend -and (Get-Process -Id $frontend.Id -ErrorAction SilentlyContinue)) {
      Stop-Process -Id $frontend.Id -Force -ErrorAction SilentlyContinue
      Wait-Process -Id $frontend.Id -ErrorAction SilentlyContinue
    }
  } catch {}

  try {
    if ($backend -and (Get-Process -Id $backend.Id -ErrorAction SilentlyContinue)) {
      Stop-Process -Id $backend.Id -Force -ErrorAction SilentlyContinue
      Wait-Process -Id $backend.Id -ErrorAction SilentlyContinue
    }
  } catch {}

  # Option bonus : tue par nom s’il ne reste que des orphelins.
  Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
}

