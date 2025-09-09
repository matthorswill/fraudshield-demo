$ProgressPreference = 'SilentlyContinue'
Write-Host "# explain-alert"
try {
  Invoke-RestMethod -Method Post -Uri "http://localhost:4000/v1/ai/explain-alert" -ContentType 'application/json' -Body '{"tx_id":1}' | ConvertTo-Json -Depth 4
} catch { Write-Host $_ }

Write-Host "# copilot"
try {
  Invoke-RestMethod -Method Post -Uri "http://localhost:4000/v1/ai/copilot" -ContentType 'application/json' -Body '{"question":"Quels dossiers à risque élevé cette semaine ?"}' | ConvertTo-Json -Depth 4
} catch { Write-Host $_ }

