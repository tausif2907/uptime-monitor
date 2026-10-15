<#
  Turns on "Continue with Google": stores the Google OAuth client ID + secret in Vercel
  (production) and redeploys. Nothing is printed. Run from the repo root:

    powershell -ExecutionPolicy Bypass -File scripts\deploy\set-google-auth.ps1
#>
$ErrorActionPreference = "Continue"
trap { Write-Host "`nStopped: $_" -ForegroundColor Red; exit 1 }

function Invoke-Cli([string]$what, [scriptblock]$cmd) {
  $output = & $cmd 2>&1 | Out-String
  if ($LASTEXITCODE -ne 0) { Write-Host $output; throw "Failed: $what" }
}

function Read-Hidden([string]$prompt) {
  $secure = Read-Host -AsSecureString $prompt
  return [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)).Trim()
}

Write-Host "`nPaste the values from Google Cloud Console -> Credentials -> your OAuth client (input hidden):" -ForegroundColor Cyan
$clientId = Read-Hidden "Client ID"
$clientSecret = Read-Hidden "Client secret"
if (-not $clientId.EndsWith(".apps.googleusercontent.com")) {
  throw "That doesn't look like a Google Client ID (it should end with .apps.googleusercontent.com)"
}
if ($clientSecret.Length -lt 20) { throw "That client secret looks too short" }

Write-Host "Saving in Vercel..." -ForegroundColor Cyan
Invoke-Cli "set AUTH_GOOGLE_ID" { vercel env add AUTH_GOOGLE_ID production --force --value $clientId --yes --no-sensitive }
Write-Host "  set AUTH_GOOGLE_ID" -ForegroundColor DarkGray
Invoke-Cli "set AUTH_GOOGLE_SECRET" { vercel env add AUTH_GOOGLE_SECRET production --force --value $clientSecret --yes --sensitive }
Write-Host "  set AUTH_GOOGLE_SECRET" -ForegroundColor DarkGray

Write-Host "Redeploying the website (about 2 minutes)..." -ForegroundColor Cyan
Invoke-Cli "deploy the website" { vercel deploy --prod --yes }
Write-Host "`nDone! The 'Continue with Google' button is now on the sign-in page." -ForegroundColor Green
