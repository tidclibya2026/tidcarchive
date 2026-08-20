[CmdletBinding()]
param(
  [string]$InstallPath = "C:\Archiving",
  [int]$Port = 8080
)

$ErrorActionPreference = "Stop"

function New-TidcSecret {
  $bytes = New-Object byte[] 32
  [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
  return ([Convert]::ToHexString($bytes)).ToLowerInvariant()
}

function Read-PlainSecureString([string]$Prompt) {
  $secure = Read-Host $Prompt -AsSecureString
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}

$sourceRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "لم يُعثر على Docker Desktop. ثبّته وشغّله أولاً، ثم أعد تشغيل هذا الملف."
}

docker version | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Docker Desktop مثبت لكنه غير قيد التشغيل. شغّله ثم أعد المحاولة." }

if (-not (Test-Path $InstallPath)) { New-Item -ItemType Directory -Path $InstallPath -Force | Out-Null }
$targetRoot = (Resolve-Path $InstallPath).Path
if ($sourceRoot.Path -ne $targetRoot) {
  Write-Host "نسخ ملفات نظام TIDC إلى $InstallPath ..."
  Get-ChildItem -Path $sourceRoot -Force | Where-Object { $_.Name -notin @("node_modules", ".git", "dist", ".env") } | Copy-Item -Destination $InstallPath -Recurse -Force
}

$localOps = Join-Path $InstallPath "ops\local-windows"
$envPath = Join-Path $localOps ".env"
if (-not (Test-Path $envPath)) {
  $adminEmail = Read-Host "البريد الإلكتروني لمدير النظام المحلي [admin@tidcarchiv]"
  if ([string]::IsNullOrWhiteSpace($adminEmail)) { $adminEmail = "admin@tidcarchiv" }
  do {
    $adminPassword = Read-PlainSecureString "أدخل كلمة مرور جديدة لمدير النظام (10 أحرف على الأقل)"
    if ($adminPassword.Length -lt 10) { Write-Warning "كلمة المرور يجب ألا تقل عن 10 أحرف." }
  } while ($adminPassword.Length -lt 10)

  @(
    "TIDC_HTTP_PORT=$Port",
    "MYSQL_ROOT_PASSWORD=$(New-TidcSecret)",
    "MYSQL_APP_PASSWORD=$(New-TidcSecret)",
    "MINIO_ROOT_USER=tidc_minio",
    "MINIO_ROOT_PASSWORD=$(New-TidcSecret)",
    "MINIO_BUCKET=tidc-archive",
    "JWT_SECRET=$(New-TidcSecret)",
    "LOCAL_OCR_SHARED_SECRET=$(New-TidcSecret)",
    "TIDC_INITIAL_ADMIN_EMAIL=$adminEmail",
    "TIDC_INITIAL_ADMIN_PASSWORD=$adminPassword"
  ) | Set-Content -Path $envPath -Encoding utf8NoBOM

  $acl = Get-Acl $envPath
  $acl.SetAccessRuleProtection($true, $false)
  $currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
  $rule = New-Object System.Security.AccessControl.FileSystemAccessRule($currentUser, "FullControl", "Allow")
  $acl.SetAccessRule($rule)
  Set-Acl -Path $envPath -AclObject $acl
}

Push-Location $localOps
try {
  docker compose --env-file .env -f docker-compose.yml up -d --build
  if ($LASTEXITCODE -ne 0) { throw "تعذر بدء خدمات النظام. راجع ملف السجل عبر Show-Logs.cmd." }
} finally { Pop-Location }

Write-Host "اكتمل التنصيب. افتح: http://localhost:$Port"
Write-Host "يمكن لأجهزة الشبكة الداخلية استخدام: http://اسم-الخادم:$Port بعد ضبط جدار الحماية وHTTPS."
