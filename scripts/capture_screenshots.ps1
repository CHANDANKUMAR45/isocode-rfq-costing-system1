# Script to test and capture responsive viewport screenshots
$ErrorActionPreference = "Continue"

$screenshotsDir = "C:\Users\chand\.gemini\antigravity\brain\e92d5d5e-ed75-40e2-a6b7-5a3cf24ce434\screenshots"
if (!(Test-Path $screenshotsDir)) {
    New-Item -ItemType Directory -Path $screenshotsDir -Force | Out-Null
}

Write-Host "Starting backend server on port 5000..."
$serverProcess = Start-Process -FilePath "node" -ArgumentList "dist/index.js" -WorkingDirectory "server" -PassThru

Write-Host "Starting frontend preview on port 5173..."
$clientProcess = Start-Process -FilePath "npx" -ArgumentList "vite", "preview", "--port", "5173" -WorkingDirectory "client" -PassThru

Start-Sleep -Seconds 4

$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"

$viewports = @(
    @{ name = "desktop_1440"; width = 1440; height = 900 },
    @{ name = "laptop_1024"; width = 1024; height = 800 },
    @{ name = "tablet_768"; width = 768; height = 1024 },
    @{ name = "mobile_430"; width = 430; height = 932 },
    @{ name = "mobile_390"; width = 390; height = 844 },
    @{ name = "mobile_360"; width = 360; height = 740 }
)

foreach ($vp in $viewports) {
    $outPath = Join-Path $screenshotsDir "$($vp.name).png"
    Write-Host "Capturing $($vp.name) ($($vp.width)x$($vp.height))..."
    & $chrome --headless --disable-gpu --hide-scrollbars --window-size="$($vp.width),$($vp.height)" --screenshot="$outPath" http://localhost:5173
    Start-Sleep -Milliseconds 800
}

Write-Host "Cleaning up test processes..."
try { Stop-Process -Id $clientProcess.Id -Force } catch {}
try { Stop-Process -Id $serverProcess.Id -Force } catch {}

Write-Host "Screenshots captured successfully in $screenshotsDir"
