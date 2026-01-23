# Banana Slides - Quick API Test Script (PowerShell)
# ====================================================
# Script test nhanh các API endpoints cơ bản
#
# Cách sử dụng:
#   .\tests\test_api_quick.ps1                    # Test với localhost:5000
#   .\tests\test_api_quick.ps1 -BaseUrl "http://192.168.1.100:5000"  # Custom URL

param(
    [string]$BaseUrl = "http://localhost:5000"
)

# Colors
$Green = "Green"
$Red = "Red"
$Yellow = "Yellow"
$Cyan = "Cyan"

function Write-TestHeader {
    param([string]$Title)
    Write-Host ""
    Write-Host "=== $Title ===" -ForegroundColor $Yellow
    Write-Host ""
}

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Method = "GET",
        [string]$Endpoint,
        [hashtable]$Body = $null,
        [int]$ExpectedStatus = 200
    )

    $url = "$BaseUrl$Endpoint"
    $startTime = Get-Date

    try {
        $params = @{
            Uri = $url
            Method = $Method
            ContentType = "application/json"
            TimeoutSec = 30
            ErrorAction = "Stop"
        }

        if ($Body) {
            $params.Body = ($Body | ConvertTo-Json -Depth 10)
        }

        $response = Invoke-WebRequest @params
        $elapsed = ((Get-Date) - $startTime).TotalSeconds
        $statusCode = $response.StatusCode

        if ($statusCode -ne $ExpectedStatus) {
            Write-Host "  [" -NoNewline
            Write-Host "FAIL" -ForegroundColor $Red -NoNewline
            Write-Host "] $Name"
            Write-Host "         Expected status $ExpectedStatus, got $statusCode" -ForegroundColor $Red
            return @{
                Success = $false
                Error = "Unexpected status code"
                Time = $elapsed
            }
        }

        $data = $response.Content | ConvertFrom-Json

        Write-Host "  [" -NoNewline
        Write-Host "PASS" -ForegroundColor $Green -NoNewline
        Write-Host "] $Name ($([math]::Round($elapsed, 2))s)"

        return @{
            Success = $true
            Data = $data
            Time = $elapsed
        }
    }
    catch {
        $elapsed = ((Get-Date) - $startTime).TotalSeconds
        $errorMsg = $_.Exception.Message

        Write-Host "  [" -NoNewline
        Write-Host "FAIL" -ForegroundColor $Red -NoNewline
        Write-Host "] $Name"
        Write-Host "         Error: $errorMsg" -ForegroundColor $Red

        return @{
            Success = $false
            Error = $errorMsg
            Time = $elapsed
        }
    }
}

# =============================================================================
# Main Script
# =============================================================================

Write-Host ""
Write-Host "============================================================" -ForegroundColor $Yellow
Write-Host "  BANANA SLIDES - QUICK API TEST (PowerShell)" -ForegroundColor $Yellow
Write-Host "============================================================" -ForegroundColor $Yellow
Write-Host ""
Write-Host "Target: $BaseUrl" -ForegroundColor $Cyan
Write-Host ""

$results = @()
$testProjectId = $null

# --- Health & Basic ---
Write-TestHeader "Health & Basic"

$r = Test-Endpoint -Name "Health Check" -Endpoint "/health"
$results += $r

$r = Test-Endpoint -Name "Root Endpoint" -Endpoint "/"
$results += $r

# --- Settings API ---
Write-TestHeader "Settings API"

$r = Test-Endpoint -Name "Get Settings" -Endpoint "/api/settings"
$results += $r
if ($r.Success) {
    $settings = $r.Data.data
    Write-Host "         Provider: $($settings.ai_provider_format)" -ForegroundColor $Cyan
    Write-Host "         Resolution: $($settings.image_resolution)" -ForegroundColor $Cyan
}

$r = Test-Endpoint -Name "Get Output Language" -Endpoint "/api/output-language"
$results += $r

# --- Projects API ---
Write-TestHeader "Projects API"

$r = Test-Endpoint -Name "List Projects" -Endpoint "/api/projects"
$results += $r
if ($r.Success) {
    Write-Host "         Found: $($r.Data.data.Count) projects" -ForegroundColor $Cyan
}

# Create test project
$createBody = @{
    creation_type = "idea"
    idea_prompt = "Test project - can be deleted"
}
$r = Test-Endpoint -Name "Create Project" -Method "POST" -Endpoint "/api/projects" -Body $createBody -ExpectedStatus 201
$results += $r
if ($r.Success) {
    $testProjectId = $r.Data.data.project_id
    Write-Host "         Created: $($testProjectId.Substring(0, 8))..." -ForegroundColor $Cyan
}

# Get project
if ($testProjectId) {
    $r = Test-Endpoint -Name "Get Project" -Endpoint "/api/projects/$testProjectId"
    $results += $r
}

# --- Templates API ---
Write-TestHeader "Templates API"

$r = Test-Endpoint -Name "List System Templates" -Endpoint "/api/projects/templates"
$results += $r
if ($r.Success) {
    Write-Host "         Found: $($r.Data.data.Count) templates" -ForegroundColor $Cyan
}

$r = Test-Endpoint -Name "List User Templates" -Endpoint "/api/user-templates"
$results += $r

# --- Materials API ---
Write-TestHeader "Materials API"

$r = Test-Endpoint -Name "List Materials" -Endpoint "/api/materials"
$results += $r
if ($r.Success) {
    Write-Host "         Found: $($r.Data.data.Count) materials" -ForegroundColor $Cyan
}

# --- Cleanup ---
Write-TestHeader "Cleanup"

if ($testProjectId) {
    try {
        Invoke-RestMethod -Uri "$BaseUrl/api/projects/$testProjectId" -Method DELETE -TimeoutSec 30 | Out-Null
        Write-Host "  [" -NoNewline
        Write-Host "PASS" -ForegroundColor $Green -NoNewline
        Write-Host "] Delete Test Project"
        $results += @{ Success = $true; Time = 0 }
    }
    catch {
        Write-Host "  [" -NoNewline
        Write-Host "FAIL" -ForegroundColor $Red -NoNewline
        Write-Host "] Delete Test Project"
        $results += @{ Success = $false; Time = 0 }
    }
}

# =============================================================================
# Summary
# =============================================================================

Write-Host ""
Write-Host "============================================================" -ForegroundColor $Yellow
Write-Host "  TEST SUMMARY" -ForegroundColor $Yellow
Write-Host "============================================================" -ForegroundColor $Yellow

$total = $results.Count
$passed = ($results | Where-Object { $_.Success -eq $true }).Count
$failed = $total - $passed
$totalTime = ($results | Measure-Object -Property Time -Sum).Sum

Write-Host ""
Write-Host "Total Tests:  $total"
Write-Host "Passed:       " -NoNewline
Write-Host "$passed" -ForegroundColor $Green
Write-Host "Failed:       " -NoNewline
if ($failed -gt 0) {
    Write-Host "$failed" -ForegroundColor $Red
} else {
    Write-Host "0"
}
Write-Host "Total Time:   $([math]::Round($totalTime, 2))s"
Write-Host ""

if ($failed -eq 0) {
    Write-Host "All tests passed!" -ForegroundColor $Green
    exit 0
} else {
    Write-Host "Some tests failed!" -ForegroundColor $Red
    exit 1
}
