[CmdletBinding()]
param(
  [string]$InstallPath = "C:\Archiving"
)

$ErrorActionPreference = "Stop"
$localOps = Join-Path $InstallPath "ops\local-windows"
$envPath = Join-Path $localOps ".env"
if (-not (Test-Path $envPath)) { throw "لم يُعثر على ملف الإعداد المحلي. شغّل Install-TIDC.cmd أولاً." }

$settings = @{}
Get-Content $envPath | Where-Object { $_ -match "=" } | ForEach-Object {
  $key, $value = $_ -split "=", 2
  $settings[$key] = $value
}

Push-Location $localOps
try {
  docker compose --env-file .env -f docker-compose.yml config --quiet
  if ($LASTEXITCODE -ne 0) { throw "تعذر التحقق من إعداد الحاويات." }
  docker compose --env-file .env -f docker-compose.yml ps
  $url = "https://$($settings['TIDC_HOSTNAME']):$($settings['TIDC_HTTPS_PORT'])"
  $headers = curl.exe -k -I --max-time 20 $url
  $headers | Select-String -Pattern "Strict-Transport-Security|Content-Security-Policy|X-Frame-Options|X-Content-Type-Options" | ForEach-Object { Write-Host $_ }
  Write-Host "اكتمل فحص العنوان: $url"
} finally { Pop-Location }
