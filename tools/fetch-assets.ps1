# Downloads the CC0 environment map and the three.js addons this project uses.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\fetch-assets.ps1
#
# Everything lands under vendor/ so the site stays a plain static folder with no
# build step and no CDN dependency at runtime. Both sources are CC0:
#   - Poly Haven HDRI (polyhaven.com, CC0)
#   - three.js addons (MIT), from the npm mirror
# A dusk scene with no architecture: the house stands in its own grounds, and a
# cityscape on the horizon reads as a mistake. venice_sunset is in the fallback
# list only because it was the first one tried.
param(
  [string]$HdriSlug = 'safari_sunset',
  [string]$Three = '0.180.0',
  [int]$Resolution = 1
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$vendor = Join-Path $root 'vendor'
$hdriDir = Join-Path $root 'assets\hdri'
New-Item -ItemType Directory -Force -Path $hdriDir, $vendor | Out-Null

function Get-Json($url) {
  return Invoke-RestMethod -Uri $url -TimeoutSec 40 -Headers @{ 'User-Agent' = 'vykor-house/1.0' }
}

Write-Host '--- three.js addons ---'
$addons = @(
  # RGBELoader is a deprecated shim for HDRLoader as of r180.
  'loaders/HDRLoader.js',
  'postprocessing/EffectComposer.js',
  'postprocessing/Pass.js',
  'postprocessing/RenderPass.js',
  'postprocessing/ShaderPass.js',
  'postprocessing/MaskPass.js',
  'postprocessing/UnrealBloomPass.js',
  'postprocessing/OutputPass.js',
  'shaders/CopyShader.js',
  'shaders/LuminosityHighPassShader.js',
  'shaders/OutputShader.js'
)
foreach ($a in $addons) {
  $dest = Join-Path $vendor "three\addons\$a"
  New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
  $url = "https://cdn.jsdelivr.net/npm/three@$Three/examples/jsm/$a"
  try {
    Invoke-WebRequest -Uri $url -OutFile $dest -TimeoutSec 60 -UseBasicParsing
    Write-Host ("  ok   {0,-44} {1,8:N0} bytes" -f $a, (Get-Item $dest).Length)
  } catch {
    Write-Host ("  FAIL {0} -> {1}" -f $a, $_.Exception.Message)
  }
}

Write-Host '--- Poly Haven HDRI (CC0) ---'
$candidates = @($HdriSlug, 'straw_rolls_field_01', 'spaichingen_hill', 'scythian_tombs_2', 'venice_sunset')
$done = $false
foreach ($slug in $candidates) {
  if ($done) { break }
  try {
    $files = Get-Json "https://api.polyhaven.com/files/$slug"
    $node = $files.hdri.("${Resolution}k").hdr
    if (-not $node) { $node = $files.hdri.("${Resolution}k").exr }
    if (-not $node) { Write-Host "  $slug : no ${Resolution}k hdr"; continue }
    $dest = Join-Path $hdriDir "$slug.hdr"
    Invoke-WebRequest -Uri $node.url -OutFile $dest -TimeoutSec 180 -UseBasicParsing
    $kb = [math]::Round((Get-Item $dest).Length / 1KB)
    Write-Host ("  ok   {0} ({1}) -> assets/hdri/{0}.hdr  {2:N0} KB" -f $slug, $node.size, $kb)
    $done = $true
  } catch {
    Write-Host ("  fail {0} -> {1}" -f $slug, $_.Exception.Message)
  }
}
if (-not $done) { Write-Host '  !! no HDRI downloaded; the page falls back to the procedural sky' }

Write-Host ''
Write-Host 'vendor tree:'
Get-ChildItem -Recurse -File $vendor | ForEach-Object {
  Write-Host ('  ' + $_.FullName.Replace("$root\", '') + ('  {0:N0} KB' -f ($_.Length / 1KB)))
}
