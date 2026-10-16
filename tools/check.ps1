# Everything that can be verified without a browser, in one command.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\check.ps1
#
# 1. every module parses (ES modules need a package.json with type:module for
#    `node --check`, so the sources are copied to a scratch dir)
# 2. the camera path clears the building at several viewport aspects
# 3. the timeline's caption windows actually contain a material sweep
# 4. no leftover debug scaffolding
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$scratch = Join-Path $env:TEMP 'vykor-syntax'

if (Test-Path $scratch) { Remove-Item -Recurse -Force $scratch }
New-Item -ItemType Directory -Force -Path $scratch | Out-Null
Set-Content -LiteralPath (Join-Path $scratch 'package.json') -Value '{"type":"module"}'
Copy-Item -Recurse -Force (Join-Path $root 'src') (Join-Path $scratch 'src')

Write-Host '--- syntax ---'
$bad = 0
Get-ChildItem -Recurse -File -Filter *.js (Join-Path $scratch 'src') | ForEach-Object {
  $out = & node --check $_.FullName 2>&1
  if ($LASTEXITCODE -ne 0) {
    $bad++
    Write-Host ('  FAIL ' + $_.Name + ' -> ' + ($out -join ' '))
  }
}
if ($bad -eq 0) { Write-Host ('  ok  ' + (Get-ChildItem -Recurse -File -Filter *.js (Join-Path $scratch 'src')).Count + ' modules') }

Write-Host '--- camera path ---'
Push-Location $root
# node writes its module-type advisory to stderr, and with ErrorActionPreference
# set to Stop that becomes a terminating error. --no-warnings silences it.
$prev = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
foreach ($aspect in @(1.78, 1.0, 0.46)) {
  $r = & node --no-warnings 'tools\verify-path.mjs' $aspect
  $verdict = ($r | Select-String -Pattern 'PASS|FAIL').Line
  $failures = ($r | Select-String -Pattern '!!').Line
  Write-Host ("  aspect {0,-5} {1}" -f $aspect, $verdict)
  if ($failures) { $failures | ForEach-Object { Write-Host ('    ' + $_) } }
}

Write-Host '--- timeline ---'
$probe = @'
import { CAPTIONS, REVEAL_TRACKS, TOTAL } from "./src/timeline.js";
console.log("  total " + TOTAL);
let bad = 0;
for (const r of REVEAL_TRACKS) {
  if (r.b <= r.a) { console.log("  !! " + r.group + " has an empty window"); bad++; }
  if (r.reveal.at(r.a) > 0.01 || r.reveal.at(r.b) < 0.99) { console.log("  !! " + r.group + " window does not span 0..1"); bad++; }
}
for (let i = 1; i < CAPTIONS.length; i++) {
  if (CAPTIONS[i].a < CAPTIONS[i - 1].b - 1e-9) { console.log("  !! caption " + CAPTIONS[i].n + " overlaps the previous one"); bad++; }
}
if (bad === 0) console.log("  ok  " + REVEAL_TRACKS.length + " reveals, " + CAPTIONS.length + " captions, no gaps or overlaps");
'@
Set-Content -LiteralPath (Join-Path $scratch 'probe.mjs') -Value $probe
Copy-Item -Recurse -Force (Join-Path $root 'src') (Join-Path $scratch 'src')
& node --no-warnings (Join-Path $scratch 'probe.mjs')
$ErrorActionPreference = $prev
Pop-Location

Write-Host '--- leftover debug ---'
$hits = Get-ChildItem -Recurse -File (Join-Path $root 'src') |
  Select-String -Pattern 'uDebug|ff00ff|roofdbg|noground|console\.log'
if ($hits) { $hits | ForEach-Object { Write-Host ('  ' + $_.Path.Replace($root, '') + ':' + $_.LineNumber) } }
else { Write-Host '  ok  none' }
