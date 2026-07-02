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

Write-Step "Running silent installer"
$install = Start-Process -FilePath $InstallerPath -ArgumentList "/S" -PassThru
if (!$install.WaitForExit($TimeoutSeconds * 1000)) {
  try { Stop-Process -Id $install.Id -Force } catch {}
  Fail "Installer timed out"
}
Write-Step "InstallerExitCode=$($install.ExitCode)"
if ($install.ExitCode -ne 0) {
  Fail "Installer failed with exit code $($install.ExitCode)"
}

$candidateRoots = @(
  "$env:LOCALAPPDATA\Programs\Banana Slides",
  "$env:LOCALAPPDATA\Programs\banana-slides",
  "$env:LOCALAPPDATA\Programs\BananaSlides",
  "$env:ProgramFiles\Banana Slides",
  "${env:ProgramFiles(x86)}\Banana Slides"
) | Where-Object { $_ -and (Test-Path $_) }

$appExe = $null
foreach ($root in ($candidateRoots + "$env:LOCALAPPDATA\Programs")) {
  if (Test-Path $root) {
    $appExe = Get-ChildItem -Path $root -Recurse -Filter "Banana Slides.exe" -ErrorAction SilentlyContinue |
      Select-Object -First 1
    if ($appExe) { break }
  }
}

if (!$appExe) {
  Get-ChildItem -Path "$env:LOCALAPPDATA\Programs" -Recurse -Filter "*Banana*.exe" -ErrorAction SilentlyContinue |
    Select-Object FullName,Length,LastWriteTime |
    Format-Table -AutoSize |
    Out-File -Encoding UTF8 (Join-Path $OutDir "banana-exe-candidates.txt")
  Fail "Installed Banana Slides executable not found"
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
