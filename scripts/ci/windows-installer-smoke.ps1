# Silent install, launch, and uninstall of the NSIS artifact.
# Runs on the Windows installer job. See TESTING.md.
$ErrorActionPreference = "Stop"

$product = Get-Content -Raw -Path "src/extensions/church/product.json" | ConvertFrom-Json
$installer = Get-ChildItem -Path dist -Filter *.exe | Where-Object { $_.Name -notmatch "uninstall" } | Select-Object -First 1
if (-not $installer) { throw "No installer exe under dist/" }

Write-Host "Installing $($installer.FullName)"
$install = Start-Process -FilePath $installer.FullName -ArgumentList "/S" -Wait -PassThru
if ($install.ExitCode -ne 0) { throw "Installer exited $($install.ExitCode)" }

# One-click NSIS puts the app in %LOCALAPPDATA%\Programs\<npm package name>,
# which is still "freeshow". The executable name is the product executableName.
$programs = Join-Path $env:LOCALAPPDATA "Programs"
$installed = $null
$deadline = (Get-Date).AddSeconds(45)
while (-not $installed -and (Get-Date) -lt $deadline) {
    $installed = Get-ChildItem -Path $programs -Filter "$($product.executableName).exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $installed) { Start-Sleep -Seconds 2 }
}
if (-not $installed) {
    Write-Host "Programs directory:"
    Get-ChildItem -Path $programs -ErrorAction SilentlyContinue | ForEach-Object { Write-Host $_.FullName }
    throw "Installed exe $($product.executableName).exe was not found under $programs"
}

$exe = $installed.FullName
$installDir = $installed.DirectoryName
$versionProduct = (Get-Item -LiteralPath $exe).VersionInfo.ProductName
Write-Host "Exe ProductName: $versionProduct"
if ($versionProduct -ne $product.productName) {
    throw "Installed exe ProductName is '$versionProduct', expected '$($product.productName)'"
}

Write-Host "Launching $exe"
$launched = Start-Process -FilePath $exe -PassThru
$deadline = (Get-Date).AddSeconds(30)
$title = ""
$running = @()
while ((Get-Date) -lt $deadline) {
    $running = @(Get-Process -Name $product.executableName -ErrorAction SilentlyContinue)
    if ($running.Count -eq 0 -and $launched.HasExited) {
        throw "App exited before a window appeared. Exit code $($launched.ExitCode)"
    }
    $title = @($running | ForEach-Object { $_.MainWindowTitle } | Where-Object { $_ }) | Select-Object -First 1
    if ($title -eq $product.productName) { break }
    Start-Sleep -Seconds 1
}
if ($running.Count -eq 0) { throw "$($product.executableName) was not running within 30 seconds" }
if ($title -ne $product.productName) {
    $seen = @($running | ForEach-Object { $_.MainWindowTitle }) -join " | "
    throw "Main window title was '$seen', expected '$($product.productName)'"
}
Write-Host "App is running as '$title'. Pids: $($running.Id -join ', ')"

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
