[CmdletBinding()]
param(
  [string]$InstallPath = "C:\Archiving",
  [switch]$WriteReport
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

$reportLines = New-Object System.Collections.Generic.List[string]
$reportLines.Add("# تقرير حالة تنصيب TIDC")
$reportLines.Add("")
$reportLines.Add("- وقت التقرير: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss K')")
$reportLines.Add("- النمط: $($settings['TIDC_TLS_MODE'])")
$reportLines.Add("- العنوان: https://$($settings['TIDC_HOSTNAME']):$($settings['TIDC_HTTPS_PORT'])")
$reportLines.Add("")

Push-Location $localOps
try {
  docker compose --env-file .env -f docker-compose.yml config --quiet
  if ($LASTEXITCODE -ne 0) { throw "تعذر التحقق من إعداد الحاويات." }
  $services = docker compose --env-file .env -f docker-compose.yml ps
  $services | ForEach-Object { Write-Host $_ }
  $reportLines.Add("## حالة الحاويات")
  $reportLines.Add('```text')
  $services | ForEach-Object { $reportLines.Add($_) }
  $reportLines.Add('```')
  $url = "https://$($settings['TIDC_HOSTNAME']):$($settings['TIDC_HTTPS_PORT'])"
  $headers = curl.exe -k -I --max-time 20 $url
  $securityHeaders = $headers | Select-String -Pattern "Strict-Transport-Security|Content-Security-Policy|X-Frame-Options|X-Content-Type-Options"
  $securityHeaders | ForEach-Object { Write-Host $_ }
  $reportLines.Add("## رؤوس الحماية")
  $reportLines.Add('```text')
  $securityHeaders | ForEach-Object { $reportLines.Add($_.ToString()) }
  $reportLines.Add('```')
  Write-Host "اكتمل فحص العنوان: $url"
  if ($WriteReport) {
    $reportDir = Join-Path $localOps "reports"
    New-Item -ItemType Directory -Path $reportDir -Force | Out-Null
    $reportPath = Join-Path $reportDir "TIDC-status-$(Get-Date -Format 'yyyyMMdd-HHmmss').md"
    $reportLines.Add("")
    $reportLines.Add("> لا يتضمن هذا التقرير ملف .env أو كلمات المرور أو مفاتيح التشفير أو سجلات المحتوى.")
    $reportLines | Set-Content -Path $reportPath -Encoding utf8NoBOM
    Write-Host "حُفظ تقرير حالة آمن في: $reportPath" -ForegroundColor Green
  }
} finally { Pop-Location }
