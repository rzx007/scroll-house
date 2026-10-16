# Grab stills of the walkthrough without touching the browser you are using.
#
#   pwsh tools/shot.ps1 -T 0.62                  one still -> t062.png
#   pwsh tools/shot.ps1 -T 0.30,0.46,0.62,0.9    several
#   pwsh tools/shot.ps1 -T 0.62 -Out shots
#
# The page animates forever, so a headless screenshot never settles. The app
# knows about ?still=1, which draws a handful of frames and stops; that plus
# --virtual-time-budget makes the capture quick and repeatable.
#
# --use-gl=angle --use-angle=swiftshader is required: with plain --disable-gpu
# the WebGL canvas comes back blank. The counter-intuitive part is that the
# still has to be rendered on the CPU, so a 1200x675 frame takes a few seconds.
# -T takes a delimited list as one string, e.g. -T "0.215;0.62;1.0". A
# PowerShell array parameter cannot be bound from a cmd.exe command line, which
# is how this gets called.
param(
  [string]$T = '0.0',
  [string]$Out = 'shots',
  [int]$Width = 1200,
  [int]$Height = 675,
  [string]$Base = 'http://127.0.0.1:8742/',
  # Extra query string, e.g. -Query "low=1" to shoot the mobile tier.
  [string]$Query = ''
)

# Chrome writes benign noise to stderr (GCM registration, usually). With
# ErrorActionPreference at Stop that becomes a terminating error, so keep it at
# Continue and judge success by whether the PNG appeared.
$ErrorActionPreference = 'Continue'

$chrome = @(
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $chrome) { throw 'no Chrome or Edge found' }

$outDir = Join-Path (Get-Location) $Out
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$profile = Join-Path $env:TEMP 'vykor-shot-profile'

foreach ($t in (($T -replace '"', '') -split '[;,]' | Where-Object { $_ -ne '' })) {
  $t = $t.Trim()
  $name = 't' + ($t -replace '\.', '') + '.png'
  $png = Join-Path $outDir $name
  if (Test-Path $png) { Remove-Item $png -Force }

  & $chrome --headless=new --hide-scrollbars "--user-data-dir=$profile" `
    "--window-size=$Width,$Height" --force-device-scale-factor=1 `
    --no-first-run --no-default-browser-check `
    --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader `
    --virtual-time-budget=20000 "--screenshot=$png" `
    "$($Base)?t=$t&still=1$(if ($Query) { '&' + $Query })" 2>&1 | Out-Null

  if (Test-Path $png) {
    Write-Host ("t={0,-6} -> {1}  ({2:N1} KB)" -f $t, $name, ((Get-Item $png).Length / 1KB))
  } else {
    Write-Host ("t={0,-6} -> FAILED" -f $t)
  }
}
