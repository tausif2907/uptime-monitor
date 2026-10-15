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
# Native CLIs (vercel, railway, pnpm) write progress to stderr; Windows PowerShell 5.1 would
# treat that as an error under "Stop". Judge them by exit code instead (see Invoke-Cli).
$ErrorActionPreference = "Continue"
trap { Write-Host "`nStopped: $_" -ForegroundColor Red; exit 1 }

function Invoke-Cli([string]$what, [scriptblock]$cmd) {
  $output = & $cmd 2>&1 | Out-String
  if ($LASTEXITCODE -ne 0) {
    Write-Host $output
    throw "Failed: $what"
  }
}

function Get-RailwayVars([string]$service) {
  $json = (railway variables --service $service --json 2>$null | Out-String).Trim()
  if (-not $json.StartsWith("{")) { throw "Could not read Railway variables for $service (are you logged in and linked?)" }
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
  Invoke-Cli "set $name on Vercel" { vercel @cliArgs }
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
  Invoke-Cli "set RESEND_API_KEY on Railway" { railway variables --service worker --set "RESEND_API_KEY=$resendKey" --skip-deploys }
  Write-Host "  set RESEND_API_KEY on the Railway worker" -ForegroundColor DarkGray
}

Write-Host "4/5 Creating the demo account in the production database..." -ForegroundColor Cyan
$env:DATABASE_URL = $databaseUrl
$env:DEMO_PASSWORD = $demoPassword
$env:DEMO_EMAIL = "demo@uptime.local"
Invoke-Cli "seed the demo account" { pnpm --filter @uptime/database exec tsx prisma/seed.ts }
Write-Host "  demo account ready" -ForegroundColor DarkGray
Remove-Item Env:DATABASE_URL, Env:DEMO_PASSWORD, Env:DEMO_EMAIL

Write-Host "5/5 Redeploying the worker and the website with the new settings..." -ForegroundColor Cyan
Invoke-Cli "redeploy the Railway worker" { railway redeploy --service worker --yes }
Write-Host "  worker redeploying" -ForegroundColor DarkGray
Invoke-Cli "deploy the website to Vercel" { vercel deploy --prod --yes }
Write-Host "  website deployed" -ForegroundColor DarkGray

Write-Host "`nDone! Open $AppUrl" -ForegroundColor Green
