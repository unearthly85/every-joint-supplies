# Silent install, launch, and uninstall of the NSIS artifact.
# Runs on the Windows installer job. See TESTING.md.
$ErrorActionPreference = "Stop"

$product = Get-Content -Raw -Path "src/extensions/church/product.json" | ConvertFrom-Json
$installer = Get-ChildItem -Path dist -Filter *.exe | Where-Object { $_.Name -notmatch "uninstall" } | Select-Object -First 1
if (-not $installer) { throw "No installer exe under dist/" }

Write-Host "Installing $($installer.FullName)"
$install = Start-Process -FilePath $installer.FullName -ArgumentList "/S" -Wait -PassThru
if ($install.ExitCode -ne 0) { throw "Installer exited $($install.ExitCode)" }

$installDir = Join-Path $env:LOCALAPPDATA "Programs\$($product.executableName)"
$exe = Join-Path $installDir "$($product.executableName).exe"
$deadline = (Get-Date).AddMinutes(3)
while (-not (Test-Path -LiteralPath $exe) -and (Get-Date) -lt $deadline) { Start-Sleep -Seconds 2 }
if (-not (Test-Path -LiteralPath $exe)) {
    Write-Host "Programs directory:"
    Get-ChildItem -Path (Join-Path $env:LOCALAPPDATA "Programs") -ErrorAction SilentlyContinue | ForEach-Object { Write-Host $_.FullName }
    throw "Installed exe not found at $exe"
}

Write-Host "Launching $exe"
Start-Process -FilePath $exe | Out-Null
Start-Sleep -Seconds 15
$running = @(Get-Process -Name $product.executableName -ErrorAction SilentlyContinue)
if ($running.Count -eq 0) { throw "$($product.executableName) was not running 15 seconds after launch" }
Write-Host "App is running. Pids: $($running.Id -join ', ')"

$running | Stop-Process -Force
Get-Process -Name $product.executableName -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

$uninstaller = Get-ChildItem -LiteralPath $installDir -Filter "Uninstall*.exe" | Select-Object -First 1
if (-not $uninstaller) { throw "Uninstaller not found in $installDir" }
Write-Host "Uninstalling $($uninstaller.FullName)"
$remove = Start-Process -FilePath $uninstaller.FullName -ArgumentList "/S" -Wait -PassThru
if ($remove.ExitCode -ne 0) { throw "Uninstaller exited $($remove.ExitCode)" }

$deadline = (Get-Date).AddMinutes(2)
while ((Test-Path -LiteralPath $exe) -and (Get-Date) -lt $deadline) { Start-Sleep -Seconds 2 }
if (Test-Path -LiteralPath $exe) { throw "Exe still present after uninstall: $exe" }
Write-Host "Smoke test passed: installed, launched, uninstalled."
