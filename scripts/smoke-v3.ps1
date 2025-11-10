param(
  [string]$Base = "http://localhost:5000",
  [string]$Email = "afrowholesaledirect@FEME.com",
  [string]$Password = "Beauty_F3m3!",
  [int]$Limit = 25
)

Write-Host "=== B2B Portal v3 Smoke Test ===" -ForegroundColor Cyan
Write-Host "Base: $Base"

function Invoke-Json {
  param([string]$Method = 'GET', [string]$Url, [object]$Body = $null, [hashtable]$Headers = @{})
  try {
    if ($Body) { $Body = $Body | ConvertTo-Json -Depth 10 }
    $resp = Invoke-RestMethod -Method $Method -Uri $Url -ContentType 'application/json' -Headers $Headers -Body $Body -ErrorAction Stop
    return $resp
  } catch {
    Write-Host ("FAIL: {0} {1} -> {2}" -f $Method, $Url, $_.Exception.Message) -ForegroundColor Red
    throw
  }
}

$ErrorActionPreference = 'Stop'

try {
  # Health
  $health = Invoke-Json -Url "$Base/health"
  Write-Host "Health: OK ($($health.status))" -ForegroundColor Green

  # Login
  $login = Invoke-Json -Method 'POST' -Url "$Base/api/v3/login" -Body @{ email = $Email; password = $Password; rememberMe = $false }
  $token = $login.accessToken
  if (-not $token) { throw "No accessToken returned from login" }
  $auth = @{ Authorization = "Bearer $token" }
  Write-Host "Login: OK (JWT acquired)" -ForegroundColor Green

  # Dashboard
  $stats = Invoke-Json -Url "$Base/api/v3/dashboard/stats" -Headers $auth
  Write-Host "Dashboard: OK" -ForegroundColor Green

  # Company & Users & Addresses
  $company = Invoke-Json -Url "$Base/api/v3/company" -Headers $auth
  Write-Host "Company: OK (Id=$($company.companyId))" -ForegroundColor Green

  $users = Invoke-Json -Url "$Base/api/v3/company/users" -Headers $auth
  Write-Host "Users: OK (Count=$($users.Count))" -ForegroundColor Green

  $addresses = Invoke-Json -Url "$Base/api/v3/company/addresses" -Headers $auth
  Write-Host "Addresses: OK (Count=$($addresses.Count))" -ForegroundColor Green

  # Orders
  $orders = Invoke-Json -Url "$Base/api/v3/orders?limit=$Limit" -Headers $auth
  Write-Host "Orders: OK (Count=$($orders.Count))" -ForegroundColor Green

  # Quotes
  $quotes = Invoke-Json -Url "$Base/api/v3/quotes?limit=$Limit" -Headers $auth
  Write-Host "Quotes: OK (Count=$($quotes.Count))" -ForegroundColor Green

  # Invoices
  $invoices = Invoke-Json -Url "$Base/api/v3/invoices?limit=$Limit" -Headers $auth
  Write-Host "Invoices: OK (Count=$($invoices.Count))" -ForegroundColor Green

  if ($invoices.Count -gt 0) {
    $first = $invoices[0]
    $id = $first.id
    $invoice = Invoke-Json -Url "$Base/api/v3/invoices/$id" -Headers $auth
    Write-Host "Invoice detail: OK (Id=$id)" -ForegroundColor Green

    try {
      $pdfPath = Join-Path $PSScriptRoot ("invoice-$id.pdf")
      Invoke-WebRequest -Uri "$Base/api/v3/invoices/$id/pdf" -Headers $auth -OutFile $pdfPath -ErrorAction Stop
      Write-Host "Invoice PDF: OK (Saved to $pdfPath)" -ForegroundColor Green
    } catch {
      Write-Host "Invoice PDF: Skipped/Failed ($($_.Exception.Message))" -ForegroundColor Yellow
    }
  } else {
    Write-Host "Invoices: None returned; skipping detail/PDF." -ForegroundColor Yellow
  }

  Write-Host "\nAll v3 smoke checks executed." -ForegroundColor Cyan
  exit 0
} catch {
  Write-Host "\nSmoke test failed: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}

