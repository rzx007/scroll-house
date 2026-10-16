# Lists candidate CC0 dusk HDRIs with their descriptions and tags, so a natural
# scene can be chosen over an urban one. The house sits in its own grounds; a
# cityscape on the horizon reads as a mistake.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\pick-hdri.ps1
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\pick-hdri.ps1 -Match "forest"
param([string]$Match = '')

$ErrorActionPreference = 'Continue'
try {
  $a = Invoke-RestMethod 'https://api.polyhaven.com/assets?t=hdris' -TimeoutSec 60 `
    -Headers @{ 'User-Agent' = 'vykor-house/1.0' }
} catch {
  Write-Host "API failed: $($_.Exception.Message)"
  exit 1
}

$rows = foreach ($p in $a.PSObject.Properties) {
  $m = $p.Value
  $cats = ($m.categories -join ',')
  $tags = ($m.tags -join ',')
  $blob = "$($p.Name) $($m.description) $cats $tags".ToLower()
  $isDusk = $blob -match 'sunset|dusk|sunrise|golden'
  $looksBuilt = $blob -match 'city|urban|street|building|architecture|village|town|roof|square|canal'
  $looksNatural = $blob -match 'field|forest|tree|hill|mountain|valley|coast|beach|grass|nature|meadow|desert|savanna|plain'
  if ($Match) { $isDusk = $isDusk -and ($blob -match $Match.ToLower()) }
  if ($isDusk) {
    [pscustomobject]@{
      Slug = $p.Name
      Natural = if ($looksNatural -and -not $looksBuilt) { 'Y' } else { '-' }
      Built = if ($looksBuilt) { 'Y' } else { '-' }
      Desc = (($m.description -replace '\s+', ' ') -replace '^(.{0,88}).*$', '$1')
    }
  }
}

$rows | Sort-Object Natural, Slug -Descending |
  Format-Table -AutoSize -Wrap | Out-String -Width 200 | Write-Host
