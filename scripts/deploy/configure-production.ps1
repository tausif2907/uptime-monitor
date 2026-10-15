<#
  Configure production: copies connection strings from Railway into Vercel, generates fresh
  secrets, stores your Resend key in both places, seeds the demo account and redeploys.
  No secret is ever printed. Run from the repo root, logged in to both CLIs:

    powershell -ExecutionPolicy Bypass -File scripts\deploy\configure-production.ps1
#>
param(
  [string]$AppUrl = "https://uptime-monitor-seven-tau.vercel.app",
  [string]$AdminEmails = "tausifansari2907@gmail.com"
)
$ErrorActionPreference = "Stop"

function Get-RailwayVars([string]$service) {
  $json = railway variables --service $service --json 2>$null
  if (-not $json) { throw "Could not read Railway variables for $service (are you logged in and linked?)" }
  return $json | ConvertFrom-Json
}

function New-Secret([int]$bytes = 32) {
  $buf = New-Object byte[] $bytes
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buf)
  return [Convert]::ToBase64String($buf).TrimEnd("=").Replace("+", "-").Replace("/", "_")
}

# Swap Railway's private host:port for the public TCP proxy so Vercel can connect.
function Get-PublicUrl($vars, [string]$urlKey) {
  $uri = [Uri]$vars.$urlKey
  $builder = New-Object System.UriBuilder($uri)
  $builder.Host = $vars.RAILWAY_TCP_PROXY_DOMAIN
  $builder.Port = [int]$vars.RAILWAY_TCP_PROXY_PORT
  return $builder.Uri.AbsoluteUri.TrimEnd("/")
}

function Set-VercelEnv([string]$name, [string]$value, [switch]$Sensitive) {
  $cliArgs = @("env", "add", $name, "production", "--force", "--value", $value, "--yes")
  if ($Sensitive) { $cliArgs += "--sensitive" } else { $cliArgs += "--no-sensitive" }
  & vercel @cliArgs *> $null
  if ($LASTEXITCODE -ne 0) { throw "Failed to set $name on Vercel" }
  Write-Host "  set $name" -ForegroundColor DarkGray
}

Write-Host "`n1/5 Reading database addresses from Railway..." -ForegroundColor Cyan
$pg = Get-RailwayVars "Postgres"
$redis = Get-RailwayVars "Redis"
$databaseUrl = Get-PublicUrl $pg "DATABASE_URL"
$redisUrl = Get-PublicUrl $redis "REDIS_URL"

Write-Host "2/5 Your Resend API key (input hidden; press Enter to skip email for now):" -ForegroundColor Cyan
$secure = Read-Host -AsSecureString "RESEND_API_KEY"
$resendKey = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))

$authSecret = New-Secret 32
$demoPassword = New-Secret 18

Write-Host "3/5 Saving settings in Vercel..." -ForegroundColor Cyan
Set-VercelEnv "DATABASE_URL" $databaseUrl -Sensitive
Set-VercelEnv "REDIS_URL" $redisUrl -Sensitive
Set-VercelEnv "AUTH_SECRET" $authSecret -Sensitive
Set-VercelEnv "DEMO_PASSWORD" $demoPassword -Sensitive
Set-VercelEnv "AUTH_TRUST_HOST" "true"
Set-VercelEnv "APP_URL" $AppUrl
Set-VercelEnv "EMAIL_FROM" "Uptime Monitor <onboarding@resend.dev>"
Set-VercelEnv "DEMO_LOGIN_ENABLED" "true"
Set-VercelEnv "DEMO_EMAIL" "demo@uptime.local"
Set-VercelEnv "ADMIN_EMAILS" $AdminEmails
if ($resendKey) {
  Set-VercelEnv "RESEND_API_KEY" $resendKey -Sensitive
  railway variables --service worker --set "RESEND_API_KEY=$resendKey" --skip-deploys *> $null
  Write-Host "  set RESEND_API_KEY on the Railway worker" -ForegroundColor DarkGray
}

Write-Host "4/5 Creating the demo account in the production database..." -ForegroundColor Cyan
$env:DATABASE_URL = $databaseUrl
$env:DEMO_PASSWORD = $demoPassword
$env:DEMO_EMAIL = "demo@uptime.local"
pnpm --filter @uptime/database exec tsx prisma/seed.ts
Remove-Item Env:DATABASE_URL, Env:DEMO_PASSWORD, Env:DEMO_EMAIL

Write-Host "5/5 Redeploying the worker and the website with the new settings..." -ForegroundColor Cyan
railway redeploy --service worker --yes *> $null
vercel deploy --prod --yes *> $null
if ($LASTEXITCODE -ne 0) { throw "Vercel deploy failed - run 'vercel deploy --prod' to see why" }

Write-Host "`nDone! Open $AppUrl" -ForegroundColor Green
