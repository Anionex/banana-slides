param(
  [Parameter(Mandatory=$true)]
  [string]$InstallerPath,

  [string]$OutDir = "$env:TEMP\banana-desktop-smoke",

  [int]$TimeoutSeconds = 90
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$logPath = Join-Path $OutDir "smoke-windows.log"
$resultPath = Join-Path $OutDir "smoke-result.json"
$screenshotPath = Join-Path $OutDir "smoke-screenshot.png"

function Write-Step {
  param([string]$Message)
  $line = "$(Get-Date -Format o) $Message"
  Write-Host $line
  Add-Content -Path $logPath -Value $line -Encoding UTF8
}

function Fail {
  param([string]$Message)
  Write-Step "FAIL $Message"
  exit 1
}

Remove-Item -Force -ErrorAction SilentlyContinue $logPath, $resultPath, $screenshotPath
Write-Step "Windows desktop smoke started"
Write-Step "InstallerPath=$InstallerPath"

if (!(Test-Path $InstallerPath)) {
  Fail "Installer not found"
}

$installer = Get-Item $InstallerPath
Write-Step "InstallerSize=$($installer.Length)"
if ($installer.Length -lt 100MB) {
  Fail "Installer is unexpectedly small"
}

$signature = Get-AuthenticodeSignature -FilePath $InstallerPath
$signature | Format-List * | Out-File -Encoding UTF8 (Join-Path $OutDir "installer-signature.txt")
Write-Step "InstallerSignature=$($signature.Status)"

function Run-SilentInstaller {
  Write-Step "Running silent installer"
  $install = Start-Process -FilePath $InstallerPath -ArgumentList "/S" -PassThru
  if (!$install.WaitForExit($TimeoutSeconds * 1000)) {
    try { Stop-Process -Id $install.Id -Force } catch {}
    Write-Step "Installer timed out"
    return $null
  }
  Write-Step "InstallerExitCode=$($install.ExitCode)"
  return $install.ExitCode
}

$installerExitCode = $null
for ($attempt = 1; $attempt -le 3; $attempt++) {
  Write-Step "InstallerAttempt=$attempt"
  $installerExitCode = Run-SilentInstaller
  if ($installerExitCode -eq 0) { break }
  Start-Sleep -Seconds 5
}
if ($installerExitCode -ne 0) {
  Write-Step "Installer did not report success; checking whether the app was installed anyway"
}

function Get-CandidateRoots {
  @(
    "$env:LOCALAPPDATA\Programs\Banana Slides",
    "$env:LOCALAPPDATA\Programs\banana-slides",
    "$env:LOCALAPPDATA\Programs\BananaSlides",
    "$env:LOCALAPPDATA\Programs",
    "$env:ProgramFiles\Banana Slides",
    "${env:ProgramFiles(x86)}\Banana Slides"
  ) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -Unique
}

function Find-InstalledApp {
  $explicitCandidates = @(
    "$env:LOCALAPPDATA\Programs\Banana Slides\Banana Slides.exe",
    "$env:LOCALAPPDATA\Programs\banana-slides\Banana Slides.exe",
    "$env:LOCALAPPDATA\Programs\BananaSlides\Banana Slides.exe",
    "$env:ProgramFiles\Banana Slides\Banana Slides.exe",
    "${env:ProgramFiles(x86)}\Banana Slides\Banana Slides.exe"
  )
  foreach ($candidate in $explicitCandidates) {
    if ($candidate -and (Test-Path $candidate)) {
      return Get-Item $candidate
    }
  }

  foreach ($root in (Get-CandidateRoots)) {
    $found = Get-ChildItem -Path $root -Recurse -File -Filter "*.exe" -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -eq "Banana Slides.exe" -and $_.FullName -notmatch "\\resources\\backend\\" } |
      Select-Object -First 1
    if ($found) { return $found }
  }
  return $null
}

$appExe = $null
$searchDeadline = (Get-Date).AddSeconds(90)
while ((Get-Date) -lt $searchDeadline) {
  $appExe = Find-InstalledApp
  if ($appExe) { break }
  Start-Sleep -Seconds 2
}

if (!$appExe) {
  Start-Sleep -Seconds 5
  $appExe = Find-InstalledApp
}

if (!$appExe) {
  Get-ChildItem -Path (Get-CandidateRoots) -Recurse -File -Filter "*Banana*.exe" -ErrorAction SilentlyContinue |
    Select-Object FullName,Length,LastWriteTime |
    Format-Table -AutoSize |
    Out-File -Encoding UTF8 (Join-Path $OutDir "banana-exe-candidates.txt")
  Fail "Installed Banana Slides executable not found; installer exit code was $installerExitCode"
}

Write-Step "AppExe=$($appExe.FullName)"
$env:BANANA_DESKTOP_SMOKE = "1"
$env:BANANA_DESKTOP_SMOKE_RESULT = $resultPath
$env:BANANA_DESKTOP_SMOKE_SCREENSHOT = $screenshotPath

Write-Step "Launching installed app"
$app = Start-Process -FilePath $appExe.FullName -PassThru
$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
while ((Get-Date) -lt $deadline) {
  if (Test-Path $resultPath) { break }
  if ($app.HasExited) {
    Write-Step "App exited before result, ExitCode=$($app.ExitCode)"
    break
  }
  Start-Sleep -Seconds 1
}

if (!(Test-Path $resultPath)) {
  try { Stop-Process -Id $app.Id -Force } catch {}
  Fail "Smoke result file was not created"
}

$result = Get-Content -Raw -Path $resultPath | ConvertFrom-Json
$result | ConvertTo-Json -Depth 8 | Out-File -Encoding UTF8 (Join-Path $OutDir "smoke-result.pretty.json")
Write-Step "SmokeResult=$($result.ok) BackendPort=$($result.backendPort) WindowVisible=$($result.windowVisible)"

if (!$result.ok) { Fail "Smoke result reported failure" }
if (!$result.backendPort) { Fail "Backend port missing from smoke result" }
if (!$result.windowVisible) { Fail "Window was not visible" }
if (!(Test-Path $screenshotPath)) { Fail "Screenshot missing" }
if ((Get-Item $screenshotPath).Length -lt 10000) { Fail "Screenshot is unexpectedly small" }

try {
  Invoke-WebRequest -UseBasicParsing -TimeoutSec 10 -Uri "http://127.0.0.1:$($result.backendPort)/health" |
    Select-Object StatusCode,Content |
    Format-List |
    Out-File -Encoding UTF8 (Join-Path $OutDir "backend-health.txt")
} catch {
  Fail "Backend health check failed: $($_.Exception.Message)"
}

Write-Step "RESULT: PASS"
