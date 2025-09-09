#requires -Version 5

param()

$ErrorActionPreference = 'Stop'

Write-Host '=== Smoke Test: Start API ==='
$backend = Start-Process -FilePath node -ArgumentList 'backend/server.js' -PassThru -WindowStyle Hidden -RedirectStandardOutput backend.log -RedirectStandardError backend.err
Start-Sleep -Seconds 2

function Test-Url($url, [int]$timeoutSec = 2) {
  try {
    $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec $timeoutSec
    return $r.StatusCode
  } catch {
    return 0
  }
}

$apiOk = Test-Url 'http://localhost:4000/'
if ($apiOk -ne 200) { throw "API root failed: $apiOk" }
Write-Host "API / => $apiOk"

$alertsOk = Test-Url 'http://localhost:4000/api/alerts'
if ($alertsOk -lt 200) { throw "API alerts failed: $alertsOk" }
Write-Host "API /api/alerts => $alertsOk"

$oneOk = Test-Url 'http://localhost:4000/api/alerts/1'
if ($oneOk -lt 200) { throw "API alert 1 failed: $oneOk" }
Write-Host "API /api/alerts/1 => $oneOk"

Write-Host '=== Smoke Test: Start Web (Next dev) ==='
$env:NEXT_PUBLIC_API_BASE = 'http://localhost:4000'
$frontend = Start-Process -FilePath npm.cmd -ArgumentList 'run','dev' -PassThru -RedirectStandardOutput frontend.log -RedirectStandardError frontend.err

# Wait until Next dev is up
$max = 60
for ($i = 0; $i -lt $max; $i++) {
  $s = Test-Url 'http://localhost:3000/'
  if ($s -ge 200) { break }
  Start-Sleep -Milliseconds 750
}

$home = Test-Url 'http://localhost:3000/' 3
if ($home -lt 200) { throw "Web home failed: $home" }
Write-Host "WEB / => $home"

$detail = Test-Url 'http://localhost:3000/alert/1' 3
if ($detail -lt 200) { throw "Web detail failed: $detail" }
Write-Host "WEB /alert/1 => $detail"

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

Write-Host '=== Smoke Test: Done ==='

