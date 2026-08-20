[CmdletBinding()]
param(
  [ValidateSet("internal", "public")]
  [string]$TlsMode = "internal",
  [string]$Hostname = "tidc.ly",
  [int]$HttpPort = 8080,
  [int]$HttpsPort = 8443,
  [int]$MinimumFreeGb = 60
)

$ErrorActionPreference = "Stop"
$issues = New-Object System.Collections.Generic.List[string]
$warnings = New-Object System.Collections.Generic.List[string]

function Test-RequiredCommand([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    $issues.Add("لم يُعثر على الأمر المطلوب: $Name")
  }
}

function Test-PortAvailable([int]$Port) {
  $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  if ($listener) { $issues.Add("المنفذ $Port مستخدم بالفعل بواسطة عملية أخرى.") }
}

Test-RequiredCommand "docker"
if ((Get-Command docker -ErrorAction SilentlyContinue)) {
  docker version | Out-Null
  if ($LASTEXITCODE -ne 0) { $issues.Add("Docker Desktop مثبت لكنه غير قيد التشغيل.") }
}

$systemDrive = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'"
if (-not $systemDrive -or ($systemDrive.FreeSpace / 1GB) -lt $MinimumFreeGb) {
  $issues.Add("المساحة الحرة على القرص C: أقل من $MinimumFreeGb GB.")
}

$memoryGb = [math]::Round(((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB), 1)
if ($memoryGb -lt 12) { $warnings.Add("ذاكرة الجهاز $memoryGb GB؛ يوصى بذاكرة لا تقل عن 12 GB.") }

Test-PortAvailable $HttpPort
Test-PortAvailable $HttpsPort

try {
  $resolved = Resolve-DnsName -Name $Hostname -ErrorAction Stop | Where-Object { $_.IPAddress } | Select-Object -First 1
  if ($resolved) { Write-Host "تم حل $Hostname إلى $($resolved.IPAddress)" -ForegroundColor Green }
} catch {
  $issues.Add("لم يتمكن DNS من حل الاسم $Hostname. أنشئ سجل DNS الداخلي أو العام قبل التنصيب.")
}

if ($TlsMode -eq "public") {
  if ($HttpPort -ne 80 -or $HttpsPort -ne 443) { $issues.Add("النمط العام يتطلب المنفذين 80 و443 للتحقق القياسي من الشهادة.") }
  $warnings.Add("تحقق من تمرير المنفذين 80 و443 من جدار الحماية العام إلى هذا الخادم قبل طلب شهادة عامة.")
}

Write-Host "`nنتيجة الفحص المسبق لنظام TIDC" -ForegroundColor Cyan
if ($warnings.Count) { $warnings | ForEach-Object { Write-Warning $_ } }
if ($issues.Count) {
  $issues | ForEach-Object { Write-Host "- $_" -ForegroundColor Red }
  exit 1
}
Write-Host "الفحص المسبق ناجح. يمكن متابعة التنصيب." -ForegroundColor Green
