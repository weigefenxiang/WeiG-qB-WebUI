param(
  [ValidateSet('Install','Update','Rollback')][string]$Mode='Install',
  [ValidateSet('Release','Dev')][string]$Channel='Release',
  [Alias('o','output')][string]$Destination="$env:LOCALAPPDATA\WeiG-qB-WebUI",
  [string]$QBConfig='',
  [string]$Version='',
  [switch]$Dev,
  [switch]$Configure,
  [switch]$Rollback,
  [switch]$Help
)

$ErrorActionPreference='Stop'
$Repo='weigefenxiang/WeiG-qB-WebUI'
$DevDistBase='https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev'

function Show-Usage {
@'
Usage: install.ps1 [options]

Default: install the latest stable GitHub Release.

Options:
  -version VERSION          Install a specific Release, for example 0.3.60.
  -dev                      Install the current dev exact Git SHA.
  -o PATH, -output PATH     WebUI install path.
  -qbconfig PATH            Exact qBittorrent config path for custom/portable profiles.
  -configure                Enable qBittorrent Alternative WebUI and set Root Folder.
  -rollback                 Restore the previous installation and qBittorrent config.
  -help                     Show this help.

Compatibility parameters kept for existing users:
  -Channel Release|Dev
  -Destination PATH
  -Mode Install|Update|Rollback

Notes:
  -dev and -version cannot be used together.
  A requested Release version never falls back to latest or dev.
  Dev installs use the exact-SHA materialized WebUI payload published by Virtual qB Pages.
  -configure refuses ambiguous config discovery; use -qbconfig for custom/portable profiles.
  PowerShell parameter names are case-insensitive; documentation uses lowercase.
'@ | Write-Host
}

function Test-PagesIrrelevantPath([string]$Path) {
  if([string]::IsNullOrWhiteSpace($Path)){return $false}
  if($Path.StartsWith('webui/',[System.StringComparison]::Ordinal)){return $false}
  if($Path.StartsWith('simulator/',[System.StringComparison]::Ordinal)){return $false}
  if($Path.StartsWith('installers/',[System.StringComparison]::Ordinal)){return $false}
  switch -CaseSensitive ($Path) {
    'VERSION' { return $false }
    'tools/data/qb-stable-lkg.json' { return $false }
    'tools/data/qb-locale-lkg.json' { return $false }
    'tests/fixtures/qb-release-catalog.lkg.json' { return $false }
    default { return $true }
  }
}

function Test-DevPayloadCanRepresentHead([string]$PublishedSha,[string]$DevHeadSha) {
  if($PublishedSha -eq $DevHeadSha){return $true}
  if($PublishedSha -notmatch '^[0-9a-fA-F]{40}$' -or $DevHeadSha -notmatch '^[0-9a-fA-F]{40}$'){return $false}
  try {
    $compare=Invoke-RestMethod -UseBasicParsing -Headers @{'User-Agent'='WeiG-qB-WebUI-installer'} "https://api.github.com/repos/$Repo/compare/$PublishedSha...$DevHeadSha"
  } catch {
    Write-Warning "Unable to verify whether unpublished dev changes are Pages-irrelevant: $($_.Exception.Message)"
    return $false
  }
  if(([string]$compare.status) -ne 'ahead'){return $false}
  $files=@($compare.files)
  if($files.Count -lt 1){return $false}
  if($files.Count -ge 300){
    Write-Warning 'GitHub compare returned 300 changed files; refusing to assume the file list is complete.'
    return $false
  }
  foreach($file in $files){
    $changedPath=[string]$file.filename
    if(!(Test-PagesIrrelevantPath $changedPath)){
      Write-Warning "Pages-relevant change exists after published dev payload: $changedPath"
      return $false
    }
  }
  return $true
}

if($Help){ Show-Usage; exit 0 }

$DestinationExplicit=$PSBoundParameters.ContainsKey('Destination')
$ChannelExplicit=$PSBoundParameters.ContainsKey('Channel')
if($Rollback){ $Mode='Rollback' }
if($Dev){
  if($ChannelExplicit -and $Channel -eq 'Release'){ throw '-dev conflicts with -Channel Release.' }
  $Channel='Dev'
}

$releaseVersion=$Version.Trim()
$releaseTag=$null
if($releaseVersion){
  if($Channel -eq 'Dev'){ throw '-version and -dev/-Channel Dev cannot be used together.' }
  if($releaseVersion.StartsWith('v',[System.StringComparison]::OrdinalIgnoreCase)){
    $releaseVersion=$releaseVersion.Substring(1)
  }
  if($releaseVersion -notmatch '^\d+\.\d+\.\d+$'){
    throw "Invalid Release version: $Version. Expected a version such as 0.3.60."
  }
  $releaseTag="v$releaseVersion"
}

$State=Join-Path $env:APPDATA 'WeiG-qB-WebUI'
$Backups=Join-Path $State 'backups'
New-Item -ItemType Directory -Force -Path $Backups | Out-Null

if($Mode -eq 'Rollback' -and !$DestinationExplicit){
  $lastDest=Join-Path $State 'last-dest'
  if(Test-Path $lastDest){
    $remembered=(Get-Content $lastDest -Raw).Trim()
    if($remembered){ $Destination=$remembered }
  }
}

function Resolve-UniqueQBConfig([object[]]$Candidates) {
  $unique=@{}
  foreach($candidate in @($Candidates)){
    if(!$candidate){continue}
    $path=[string]$candidate
    if(!(Test-Path -LiteralPath $path -PathType Leaf)){continue}
    try{$full=(Resolve-Path -LiteralPath $path -ErrorAction Stop).Path}catch{continue}
    $key=$full.ToLowerInvariant()
    if(!$unique.ContainsKey($key)){$unique[$key]=$full}
  }
  $paths=@($unique.Values | Sort-Object)
  if($paths.Count -gt 1){
    throw "Multiple qBittorrent config candidates were found; refusing to guess. Re-run with -qbconfig and one exact path. Candidates: $($paths -join '; ')"
  }
  if($paths.Count -eq 1){return $paths[0]}
  return $null
}

function Find-QBConfig([string]$ExplicitPath='') {
  if($ExplicitPath){
    if(!(Test-Path -LiteralPath $ExplicitPath -PathType Leaf)){
      throw "Explicit qBittorrent config does not exist: $ExplicitPath"
    }
    return (Resolve-Path -LiteralPath $ExplicitPath -ErrorAction Stop).Path
  }

  $candidates=@(
    (Join-Path $env:APPDATA 'qBittorrent\qBittorrent.ini'),
    (Join-Path $env:APPDATA 'qBittorrent\qBittorrent.conf'),
    (Join-Path $env:LOCALAPPDATA 'qBittorrent\qBittorrent.ini'),
    (Join-Path $env:LOCALAPPDATA 'qBittorrent\qBittorrent.conf'),
    (Join-Path $PWD 'qBittorrent.ini'),
    (Join-Path $PWD 'qBittorrent.conf')
  )
  if($env:ProgramData){$candidates += (Join-Path $env:ProgramData 'qBittorrent\qBittorrent.ini')}
  $resolved=Resolve-UniqueQBConfig $candidates
  return $resolved
}

function Read-QBConfigText([string]$Path) {
  [byte[]]$bytes=[IO.File]::ReadAllBytes($Path)
  $offset=0
  [byte[]]$preamble=@()
  $encoding=$null

  if($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF){
    $encoding=New-Object System.Text.UTF8Encoding($false,$true)
    $preamble=[byte[]]@(0xEF,0xBB,0xBF)
    $offset=3
  } elseif($bytes.Length -ge 2 -and $bytes[0] -eq 0xFF -and $bytes[1] -eq 0xFE){
    $encoding=New-Object System.Text.UnicodeEncoding($false,$false,$true)
    $preamble=[byte[]]@(0xFF,0xFE)
    $offset=2
  } elseif($bytes.Length -ge 2 -and $bytes[0] -eq 0xFE -and $bytes[1] -eq 0xFF){
    $encoding=New-Object System.Text.UnicodeEncoding($true,$false,$true)
    $preamble=[byte[]]@(0xFE,0xFF)
    $offset=2
  } else {
    $strictUtf8=New-Object System.Text.UTF8Encoding($false,$true)
    try {
      $null=$strictUtf8.GetString($bytes)
      $encoding=$strictUtf8
    } catch {
      $encoding=[Text.Encoding]::Default
    }
  }

  [byte[]]$payload=$bytes
  if($offset -gt 0){
    if($bytes.Length -gt $offset){$payload=[byte[]]$bytes[$offset..($bytes.Length-1)]}else{$payload=[byte[]]@()}
  }
  try{$text=$encoding.GetString($payload)}catch{throw "Unable to decode qBittorrent config without data loss: $Path"}
  [byte[]]$roundTrip=$encoding.GetBytes($text)
  if($roundTrip.Length -ne $payload.Length){throw "qBittorrent config encoding is not round-trip safe; refusing to rewrite: $Path"}
  for($i=0;$i -lt $payload.Length;$i++){
    if($roundTrip[$i] -ne $payload[$i]){throw "qBittorrent config encoding is not round-trip safe; refusing to rewrite: $Path"}
  }
  return [PSCustomObject]@{Text=$text;Encoding=$encoding;Preamble=$preamble;EncodingName=$encoding.WebName}
}

function Write-QBConfigText([string]$Path,[string]$Text,$State) {
  [byte[]]$body=$State.Encoding.GetBytes($Text)
  [byte[]]$prefix=$State.Preamble
  [byte[]]$output=New-Object byte[] ($prefix.Length+$body.Length)
  if($prefix.Length -gt 0){[Array]::Copy($prefix,0,$output,0,$prefix.Length)}
  if($body.Length -gt 0){[Array]::Copy($body,0,$output,$prefix.Length,$body.Length)}
  [IO.File]::WriteAllBytes($Path,$output)
}

function Compare-QBBytes([byte[]]$A,[byte[]]$B) {
  if($null -eq $A -or $null -eq $B -or $A.Length -ne $B.Length){return $false}
  for($i=0;$i -lt $A.Length;$i++){if($A[$i] -ne $B[$i]){return $false}}
  return $true
}

function Test-QBittorrentRunning {
  return [bool](Get-Process -Name 'qbittorrent' -ErrorAction SilentlyContinue | Select-Object -First 1)
}

function Get-QBPendingConfigPaths([string]$Path) {
  $dir=Split-Path $Path -Parent
  $name=[IO.Path]::GetFileNameWithoutExtension($Path)
  $ext=[IO.Path]::GetExtension($Path)
  $candidates=@(
    (Join-Path $dir ($name+'_new'+$ext)),
    (Join-Path $dir 'qBittorrent_new.ini')
  )
  $seen=@{}
  foreach($candidate in $candidates){
    $key=$candidate.ToLowerInvariant()
    if(!$seen.ContainsKey($key)){
      $seen[$key]=$true
      $candidate
    }
  }
}

function Assert-QBConfigTextLooksSafe([string]$Path,$State,[long]$ByteLength) {
  if($ByteLength -lt 16){throw "qBittorrent config is empty or obviously too small; refusing to rewrite: $Path"}
  $text=[string]$State.Text
  if([string]::IsNullOrWhiteSpace($text) -or $text.IndexOf([char]0) -ge 0){
    throw "qBittorrent config is not safe INI text; refusing to rewrite: $Path"
  }
  if($text -notmatch '(?m)^\[[^\]\r\n]+\]\s*$' -or $text -notmatch '(?m)^[^#;\[\]\r\n][^=\r\n]*='){
    throw "qBittorrent config does not look like a parseable INI document; refusing to rewrite: $Path"
  }
}

function Assert-QBConfigMutationSafe([string]$Path) {
  if(Test-QBittorrentRunning){
    throw 'qBittorrent is running. Exit qBittorrent completely before using -configure.'
  }
  if(!(Test-Path -LiteralPath $Path -PathType Leaf)){
    throw "qBittorrent config does not exist: $Path"
  }
  foreach($pending in @(Get-QBPendingConfigPaths $Path)){
    if(Test-Path -LiteralPath $pending -PathType Leaf){
      $pendingItem=Get-Item -LiteralPath $pending
      if($pendingItem.Length -gt 0){
        throw "qBittorrent recovery file is non-empty; refusing external config mutation: $pending"
      }
    }
  }
  $item=Get-Item -LiteralPath $Path
  $state=Read-QBConfigText $Path
  Assert-QBConfigTextLooksSafe $Path $state $item.Length
  return $state
}

function Get-QBPreferencesSectionInfo([string]$Text) {
  $headers=[regex]::Matches($Text,'(?m)^\[([^\]\r\n]+)\]\r?$')
  $preferences=@($headers | Where-Object { $_.Groups[1].Value -eq 'Preferences' })
  if($preferences.Count -ne 1){
    throw "qBittorrent config must contain exactly one [Preferences] section; found $($preferences.Count)."
  }
  $header=$preferences[0]
  $end=$Text.Length
  foreach($candidate in $headers){
    if($candidate.Index -gt $header.Index){$end=$candidate.Index;break}
  }
  return [PSCustomObject]@{Start=$header.Index;End=$end;HeaderEnd=$header.Index+$header.Length}
}

function Get-QBManagedWebUIKeyMatches([string]$Text) {
  return @([regex]::Matches($Text,'(?m)^WebUI\\(?:AlternativeUIEnabled|RootFolder)=[^\r\n]*\r?$'))
}

function Assert-QBWebUISectionOwnership([string]$Text,[string]$RootFolder) {
  $section=Get-QBPreferencesSectionInfo $Text
  $managed=@(Get-QBManagedWebUIKeyMatches $Text)
  foreach($match in $managed){
    if($match.Index -lt $section.Start -or $match.Index -ge $section.End){
      throw 'qBittorrent managed WebUI keys must belong to the [Preferences] section.'
    }
  }
  if(([regex]::Matches($Text,'(?m)^WebUI\\AlternativeUIEnabled=true\r?$')).Count -ne 1){
    throw 'qBittorrent config candidate must contain exactly one enabled Alternative WebUI line.'
  }
  $escapedRoot=[regex]::Escape('WebUI\RootFolder='+$RootFolder)
  if(([regex]::Matches($Text,'(?m)^'+$escapedRoot+'\r?$')).Count -ne 1){
    throw 'qBittorrent config candidate must contain exactly one exact WebUI RootFolder line.'
  }
  if(([regex]::Matches($Text,'(?m)^WebUI\\AlternativeUIEnabled=')).Count -ne 1 -or ([regex]::Matches($Text,'(?m)^WebUI\\RootFolder=')).Count -ne 1){
    throw 'qBittorrent config contains duplicate managed WebUI keys; refusing ambiguous mutation.'
  }
}

function Get-QBUnmanagedConfigText([string]$Text) {
  return [regex]::Replace($Text,'(?m)^WebUI\\(?:AlternativeUIEnabled|RootFolder)=.*(?:\r?\n|$)','')
}

function Set-QBWebUIConfigText([string]$Original,[string]$RootFolder,[string]$Newline) {
  $section=Get-QBPreferencesSectionInfo $Original
  $managed=@(Get-QBManagedWebUIKeyMatches $Original)
  foreach($match in $managed){
    if($match.Index -lt $section.Start -or $match.Index -ge $section.End){
      throw 'qBittorrent managed WebUI keys must belong to the [Preferences] section.'
    }
  }

  $preferencesText=$Original.Substring($section.Start,$section.End-$section.Start)
  if(([regex]::Matches($preferencesText,'(?m)^WebUI\\AlternativeUIEnabled=')).Count -gt 1 -or ([regex]::Matches($preferencesText,'(?m)^WebUI\\RootFolder=')).Count -gt 1){
    throw 'qBittorrent config contains duplicate managed WebUI keys; refusing ambiguous mutation.'
  }

  if($preferencesText -match '(?m)^WebUI\\AlternativeUIEnabled='){
    $preferencesText=[regex]::Replace($preferencesText,'(?m)^WebUI\\AlternativeUIEnabled=[^\r\n]*(\r?)$','WebUI\AlternativeUIEnabled=true$1')
  } else {
    if($preferencesText.Length -gt 0 -and !$preferencesText.EndsWith("`n") -and !$preferencesText.EndsWith("`r")){$preferencesText+=$Newline}
    $preferencesText+='WebUI\AlternativeUIEnabled=true'+$Newline
  }

  $rootLine='WebUI\RootFolder='+$RootFolder
  if($preferencesText -match '(?m)^WebUI\\RootFolder='){
    $preferencesText=[regex]::Replace($preferencesText,'(?m)^WebUI\\RootFolder=[^\r\n]*(\r?)$',[System.Text.RegularExpressions.MatchEvaluator]{param($m)$rootLine+$m.Groups[1].Value})
  } else {
    if($preferencesText.Length -gt 0 -and !$preferencesText.EndsWith("`n") -and !$preferencesText.EndsWith("`r")){$preferencesText+=$Newline}
    $preferencesText+=$rootLine+$Newline
  }

  $candidate=$Original.Substring(0,$section.Start)+$preferencesText+$Original.Substring($section.End)
  Assert-QBWebUISectionOwnership $candidate $RootFolder
  return $candidate
}

function Assert-QBWebUIMutation([string]$Original,[string]$Candidate,[string]$RootFolder,[string]$Newline) {
  Assert-QBWebUISectionOwnership $Candidate $RootFolder
  $before=Get-QBUnmanagedConfigText $Original
  $after=Get-QBUnmanagedConfigText $Candidate
  if($after -ne $before -and $after -ne ($before+$Newline)){
    throw 'qBittorrent config mutation changed unrelated content; refusing write.'
  }
}
function Invoke-QBAtomicReplace([string]$Source,[string]$Destination,[string]$BackupPath) {
  if(!(Test-Path -LiteralPath $Source -PathType Leaf)){throw "Atomic replace source is missing: $Source"}
  if(!(Test-Path -LiteralPath $Destination -PathType Leaf)){throw "Atomic replace destination is missing: $Destination"}
  if(Test-Path -LiteralPath $BackupPath){Remove-Item -LiteralPath $BackupPath -Force}
  try {
    [IO.File]::Replace($Source,$Destination,$BackupPath,$true)
  } catch {
    throw "Atomic qBittorrent config replace failed; refusing unsafe overwrite. $($_.Exception.Message)"
  }
}

function Restore-QBConfigBackupAtomically([string]$Path,[string]$Backup) {
  if(!(Test-Path -LiteralPath $Backup -PathType Leaf)){throw "qBittorrent safety backup is missing: $Backup"}
  [byte[]]$expected=[IO.File]::ReadAllBytes($Backup)
  $dir=Split-Path $Path -Parent
  $restoreTemp=Join-Path $dir ('.weigg-qb-restore-'+[guid]::NewGuid().ToString('N')+'.tmp')
  $replaceBackup="$Path.weigg.restore-replaced"
  try {
    [IO.File]::WriteAllBytes($restoreTemp,$expected)
    if(Test-Path -LiteralPath $Path -PathType Leaf){
      Invoke-QBAtomicReplace $restoreTemp $Path $replaceBackup
    } else {
      Move-Item -LiteralPath $restoreTemp -Destination $Path
    }
    if(!(Compare-QBBytes $expected ([IO.File]::ReadAllBytes($Path)))){
      throw 'qBittorrent config restore verification failed.'
    }
  } finally {
    if(Test-Path -LiteralPath $restoreTemp){Remove-Item -LiteralPath $restoreTemp -Force -ErrorAction SilentlyContinue}
    if(Test-Path -LiteralPath $replaceBackup){Remove-Item -LiteralPath $replaceBackup -Force -ErrorAction SilentlyContinue}
  }
}

function Configure-QBWebUI([string]$Path,[string]$RootFolder) {
  $state=Assert-QBConfigMutationSafe $Path
  [byte[]]$originalBytes=[IO.File]::ReadAllBytes($Path)
  $originalText=$state.Text
  $newline=if($originalText.Contains("`r`n")){"`r`n"}else{"`n"}

  $text=Set-QBWebUIConfigText $originalText $RootFolder $newline
  Assert-QBWebUIMutation $originalText $text $RootFolder $newline

  $backup="$Path.weigg.bak"
  [IO.File]::WriteAllBytes($backup,$originalBytes)
  if(!(Compare-QBBytes $originalBytes ([IO.File]::ReadAllBytes($backup)))){
    throw 'qBittorrent safety backup is not byte-identical; refusing mutation.'
  }

  $dir=Split-Path $Path -Parent
  $tempPath=Join-Path $dir ('.weigg-qb-config-'+[guid]::NewGuid().ToString('N')+'.tmp')
  $replaceBackup="$Path.weigg.replace.bak"
  [byte[]]$candidateBytes=$null
  try {
    Write-QBConfigText $tempPath $text $state
    $tempItem=Get-Item -LiteralPath $tempPath
    $verify=Read-QBConfigText $tempPath
    Assert-QBConfigTextLooksSafe $tempPath $verify $tempItem.Length
    if($verify.Text -ne $text){throw 'qBittorrent temp config verification failed.'}
    if($verify.EncodingName -ne $state.EncodingName -or !(Compare-QBBytes ([byte[]]$verify.Preamble) ([byte[]]$state.Preamble))){
      throw 'qBittorrent temp config did not preserve the original encoding.'
    }
    Assert-QBWebUIMutation $originalText $verify.Text $RootFolder $newline
    [byte[]]$candidateBytes=[IO.File]::ReadAllBytes($tempPath)

    $null=Assert-QBConfigMutationSafe $Path
    if(!(Compare-QBBytes $originalBytes ([IO.File]::ReadAllBytes($Path)))){
      throw 'qBittorrent config changed after preflight; refusing to overwrite a newer file.'
    }

    Invoke-QBAtomicReplace $tempPath $Path $replaceBackup

    $final=Read-QBConfigText $Path
    if($final.Text -ne $text -or !(Compare-QBBytes $candidateBytes ([IO.File]::ReadAllBytes($Path)))){
      throw 'qBittorrent config verification failed after atomic replace.'
    }
    Assert-QBWebUIMutation $originalText $final.Text $RootFolder $newline
    if(Test-Path -LiteralPath $replaceBackup){Remove-Item -LiteralPath $replaceBackup -Force}
  } catch {
    $failure=$_.Exception
    $currentBytes=$null
    if(Test-Path -LiteralPath $Path -PathType Leaf){$currentBytes=[IO.File]::ReadAllBytes($Path)}
    if($candidateBytes -and $currentBytes -and (Compare-QBBytes $candidateBytes $currentBytes)){
      try {
        Restore-QBConfigBackupAtomically $Path $backup
        if(Test-Path -LiteralPath $replaceBackup){Remove-Item -LiteralPath $replaceBackup -Force -ErrorAction SilentlyContinue}
      } catch {
        throw "qBittorrent config mutation failed and automatic rollback also failed. Original safety backup remains at $backup. Mutation error: $($failure.Message) Rollback error: $($_.Exception.Message)"
      }
    } elseif($currentBytes -and !(Compare-QBBytes $originalBytes $currentBytes)){
      throw "qBittorrent config changed unexpectedly during mutation; refusing to overwrite it. Original safety backup remains at $backup. Mutation error: $($failure.Message)"
    }
    throw $failure
  } finally {
    if(Test-Path -LiteralPath $tempPath){Remove-Item -LiteralPath $tempPath -Force -ErrorAction SilentlyContinue}
  }
  Write-Host "qBittorrent config encoding preserved and atomically replaced: $($state.EncodingName)"
}

function Backup-Current([string]$ConfigPath='') {
  $stamp=Get-Date -Format 'yyyyMMdd-HHmmss'
  $b=Join-Path $Backups $stamp
  New-Item -ItemType Directory -Force -Path $b | Out-Null
  if(Test-Path $Destination){
    Copy-Item $Destination (Join-Path $b 'webui') -Recurse -Force
    Set-Content -Encoding ASCII -Path (Join-Path $b 'had-webui') -Value '1'
  } else {
    Set-Content -Encoding ASCII -Path (Join-Path $b 'had-webui') -Value '0'
  }
  if($ConfigPath){
    Copy-Item -LiteralPath $ConfigPath (Join-Path $b 'qBittorrent.conf') -Force
    Set-Content -Encoding UTF8 -Path (Join-Path $b 'config-path') -Value $ConfigPath
  }
  Set-Content -Encoding UTF8 -Path (Join-Path $b 'dest-path') -Value $Destination
  Set-Content -Encoding UTF8 -Path (Join-Path $State 'last-backup') -Value $b
  Set-Content -Encoding UTF8 -Path (Join-Path $State 'last-dest') -Value $Destination
  Write-Host "Backup: $b"
}

function Restore-Last {
  $marker=Join-Path $State 'last-backup'
  if(!(Test-Path $marker)){ throw 'No backup found.' }
  $b=(Get-Content $marker -Raw).Trim()
  if(!(Test-Path $b)){ throw "Backup directory missing: $b" }

  $destMarker=Join-Path $b 'dest-path'
  if(!$DestinationExplicit -and (Test-Path $destMarker)){
    $savedDest=(Get-Content $destMarker -Raw).Trim()
    if($savedDest){ $script:Destination=$savedDest }
  }

  $old=Join-Path $b 'qBittorrent.conf'
  $configMarker=Join-Path $b 'config-path'
  $cfg=$null
  if((Test-Path $old) -and (Test-Path $configMarker)){
    $cfg=(Get-Content $configMarker -Raw).Trim()
    if($cfg){
      if(Test-QBittorrentRunning){throw 'qBittorrent is running. Exit qBittorrent completely before rollback restores its config.'}
      foreach($pending in @(Get-QBPendingConfigPaths $cfg)){
        if((Test-Path -LiteralPath $pending -PathType Leaf) -and (Get-Item -LiteralPath $pending).Length -gt 0){
          throw "qBittorrent recovery file is non-empty; refusing rollback config mutation: $pending"
        }
      }
      $backupState=Read-QBConfigText $old
      Assert-QBConfigTextLooksSafe $old $backupState (Get-Item -LiteralPath $old).Length
    }
  }

  $hadWebUi=$false
  $hadMarker=Join-Path $b 'had-webui'
  if(Test-Path $hadMarker){ $hadWebUi=((Get-Content $hadMarker -Raw).Trim() -eq '1') }

  if(Test-Path $Destination){ Remove-Item $Destination -Recurse -Force }
  if($hadWebUi){
    $web=Join-Path $b 'webui'
    if(!(Test-Path $web)){ throw "Backup webui missing: $web" }
    Copy-Item $web $Destination -Recurse -Force
    Write-Host "Restored previous WebUI: $Destination"
  } else {
    Write-Host "Removed WeiG qB WebUI from: $Destination"
  }

  if($cfg){
    New-Item -ItemType Directory -Force -Path (Split-Path $cfg -Parent) | Out-Null
    Restore-QBConfigBackupAtomically $cfg $old
    Write-Host "Restored qBittorrent config atomically: $cfg"
  }
}

function Inject-BuildSha([string]$Root,[string]$Sha) {
  if($Sha -notmatch '^[0-9a-fA-F]{40}$'){throw 'Invalid Git SHA for asset versioning.'}
  $utf8=New-Object System.Text.UTF8Encoding($false)
  Get-ChildItem $Root -Recurse -File | Where-Object { $_.Extension -in @('.html','.js','.css','.json') -or $_.Name -eq 'GIT_SHA' } | ForEach-Object {
    $text=[IO.File]::ReadAllText($_.FullName)
    if($text.Contains('__WEIGG_GIT_SHA__')){[IO.File]::WriteAllText($_.FullName,$text.Replace('__WEIGG_GIT_SHA__',$Sha),$utf8)}
  }
  [IO.File]::WriteAllText((Join-Path $Root 'GIT_SHA'),$Sha+"`n",$utf8)
}

function Verify-PackageChecksum([string]$Archive,[string]$SumFile) {
  $sumLine=Get-Content $SumFile | Where-Object { $_ -match '\s+\*?WeiG-qB-WebUI\.zip$' } | Select-Object -First 1
  if(!$sumLine){throw 'SHA256SUMS does not contain WeiG-qB-WebUI.zip; refusing installation.'}
  $expected=(($sumLine -split '\s+')[0]).ToLowerInvariant()
  $actual=(Get-FileHash $Archive -Algorithm SHA256).Hash.ToLowerInvariant()
  if($expected -notmatch '^[0-9a-f]{64}$' -or $expected -ne $actual){throw 'SHA256 verification failed.'}
}

function Assert-MaterializedWebUI([string]$Root) {
  $catalogFile=Join-Path $Root 'private\data\qb-releases.json'
  $registryFile=Join-Path $Root 'private\data\qb-settings-native.txt'
  $translations=Join-Path $Root 'translations'
  if(!(Test-Path $catalogFile)){throw 'Materialized WebUI is missing qb-releases.json.'}
  try{$catalog=Get-Content $catalogFile -Raw | ConvertFrom-Json}catch{throw 'Materialized WebUI release catalog is invalid JSON.'}
  if(!$catalog -or @($catalog).Count -lt 1){throw 'Materialized WebUI release catalog is empty.'}
  if(!(Test-Path $registryFile)){throw 'Materialized WebUI is missing the native Settings QBT_TR registry.'}
  if(!(Test-Path $translations) -or !(Get-ChildItem $translations -Filter 'webui_*.qm' -File -ErrorAction SilentlyContinue | Select-Object -First 1)){throw 'Materialized WebUI is missing official qB WebUI translation QM assets.'}
}

if($Mode -eq 'Rollback'){
  Restore-Last
  exit 0
}

$cfg=$null
if($Configure){
  $cfg=Find-QBConfig $QBConfig
  if(!$cfg){throw 'No unambiguous qBittorrent config was found. Use -qbconfig with the exact config path for custom/portable profiles.'}
  $null=Assert-QBConfigMutationSafe $cfg
}

Backup-Current $cfg
$tmp=Join-Path ([IO.Path]::GetTempPath()) ("weigg-qb-"+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
try {
  $archive=Join-Path $tmp 'WeiG-qB-WebUI.zip'
  $sourceSha=$null
  $web=$null

  if($Channel -eq 'Release'){
    $requestedReleaseVersion=$releaseVersion
    $requestedReleaseTag=$releaseTag
    $apiHeaders=@{'User-Agent'='WeiG-qB-WebUI-installer'}
    try {
      if($requestedReleaseVersion){
        $releaseMeta=Invoke-RestMethod -UseBasicParsing -Headers $apiHeaders "https://api.github.com/repos/$Repo/releases/tags/$requestedReleaseTag"
      } else {
        $releaseMeta=Invoke-RestMethod -UseBasicParsing -Headers $apiHeaders "https://api.github.com/repos/$Repo/releases/latest"
      }
    } catch {
      if($requestedReleaseVersion){throw "Release $requestedReleaseTag was not found. Refusing to fall back to latest or dev."}
      throw 'No published stable GitHub Release is available. Release installation will not fall back to a branch archive.'
    }

    $resolvedReleaseTag=[string]$releaseMeta.tag_name
    if($resolvedReleaseTag -notmatch '^v(\d+\.\d+\.\d+)$'){throw "GitHub Release metadata returned an invalid tag: $resolvedReleaseTag"}
    $resolvedReleaseVersion=$Matches[1]
    if($requestedReleaseTag -and $resolvedReleaseTag -ne $requestedReleaseTag){
      throw "Requested $requestedReleaseTag but GitHub Release metadata resolved $resolvedReleaseTag; refusing mismatched Release identity."
    }
    try {
      $releaseCommit=Invoke-RestMethod -UseBasicParsing -Headers $apiHeaders "https://api.github.com/repos/$Repo/commits/$resolvedReleaseTag"
    } catch {
      throw "Unable to resolve commit identity for Release $resolvedReleaseTag."
    }
    $releaseExpectedSha=([string]$releaseCommit.sha).ToLowerInvariant()
    if($releaseExpectedSha -notmatch '^[0-9a-f]{40}$'){throw "Release $resolvedReleaseTag did not resolve to a valid commit SHA."}

    $releaseTag=$resolvedReleaseTag
    $releaseVersion=$resolvedReleaseVersion
    $releaseBase="https://github.com/$Repo/releases/download/$releaseTag"
    $releaseLabel="Release $releaseTag"

    try {
      Invoke-WebRequest -UseBasicParsing "$releaseBase/WeiG-qB-WebUI.zip" -OutFile $archive
    } catch {
      throw "$releaseLabel does not contain WeiG-qB-WebUI.zip. Refusing to fall back to another Release or branch."
    }

    $sumFile=Join-Path $tmp 'SHA256SUMS'
    try {
      Invoke-WebRequest -UseBasicParsing "$releaseBase/SHA256SUMS" -OutFile $sumFile
    } catch {
      throw "$releaseLabel is missing SHA256SUMS; refusing an unverified installation."
    }
    Verify-PackageChecksum $archive $sumFile

    $root=Join-Path $tmp 'release'
    Expand-Archive $archive $root -Force
    $web=Join-Path $root 'WeiG-qB-WebUI'
    $shaFile=Join-Path $web 'GIT_SHA'
    if(!(Test-Path $shaFile)){throw "$releaseLabel does not contain GIT_SHA; refusing an unversioned asset deployment."}
    $sourceSha=(Get-Content $shaFile -Raw).Trim().ToLowerInvariant()
    if($sourceSha -notmatch '^[0-9a-f]{40}$'){throw "$releaseLabel contains an invalid GIT_SHA."}
    $versionFile=Join-Path $web 'VERSION'
    if(!(Test-Path $versionFile)){throw "$releaseLabel does not contain VERSION; refusing an unversioned asset deployment."}
    $packageVersion=(Get-Content $versionFile -Raw).Trim()
    if($packageVersion -ne $releaseVersion){
      throw "$releaseLabel maps to VERSION=$releaseVersion but the package reports VERSION=$packageVersion; refusing mismatched Release content."
    }
    if($sourceSha -ne $releaseExpectedSha){
      throw "$releaseLabel points to Git SHA $releaseExpectedSha but the package reports GIT_SHA=$sourceSha; refusing mismatched Release content."
    }
    Assert-MaterializedWebUI $web
    Write-Host "Source: $releaseLabel at $releaseExpectedSha (checksum and Release identity verified, materialized WebUI)"
  } else {
    try {
      $commit=Invoke-RestMethod -UseBasicParsing -Headers @{'User-Agent'='WeiG-qB-WebUI-installer'} "https://api.github.com/repos/$Repo/commits/dev"
    } catch {
      throw 'Unable to resolve the current dev commit.'
    }
    $devHeadSha=([string]$commit.sha).ToLowerInvariant()
    if($devHeadSha -notmatch '^[0-9a-f]{40}$'){throw 'GitHub did not return a valid dev commit SHA.'}

    $publishedShaFile=Join-Path $tmp 'DEV_GIT_SHA'
    try {
      Invoke-WebRequest -UseBasicParsing "$DevDistBase/GIT_SHA" -OutFile $publishedShaFile
    } catch {
      throw 'The materialized dev WebUI payload is not published yet. Wait for Virtual qB Pages to finish and retry.'
    }
    $publishedSha=(Get-Content $publishedShaFile -Raw).Trim().ToLowerInvariant()
    if($publishedSha -notmatch '^[0-9a-f]{40}$'){throw 'The materialized dev payload does not publish a valid GIT_SHA.'}

    $sourceSha=$publishedSha
    if($publishedSha -ne $devHeadSha){
      if(Test-DevPayloadCanRepresentHead $publishedSha $devHeadSha){
        Write-Host "Current dev HEAD $devHeadSha differs from materialized SHA $publishedSha only by Pages-irrelevant changes; reusing the verified payload."
      } else {
        throw "The materialized dev payload is still at $publishedSha while dev is $devHeadSha, and at least one Pages-relevant change is not published. Wait for the exact Pages build and retry; refusing raw-source fallback."
      }
    }

    $sumFile=Join-Path $tmp 'SHA256SUMS'
    try {
      Invoke-WebRequest -UseBasicParsing "$DevDistBase/WeiG-qB-WebUI.zip" -OutFile $archive
      Invoke-WebRequest -UseBasicParsing "$DevDistBase/SHA256SUMS" -OutFile $sumFile
    } catch {
      throw "Unable to download the materialized dev payload for exact SHA $sourceSha."
    }
    Verify-PackageChecksum $archive $sumFile
    $root=Join-Path $tmp 'dev'
    Expand-Archive $archive $root -Force
    $web=Join-Path $root 'WeiG-qB-WebUI'
    $packageSha=(Get-Content (Join-Path $web 'GIT_SHA') -Raw).Trim().ToLowerInvariant()
    if($packageSha -ne $sourceSha){throw "Dev package Git SHA $packageSha does not match materialized dev SHA $sourceSha."}
    Assert-MaterializedWebUI $web
    if($sourceSha -eq $devHeadSha){
      Write-Host "Source: dev exact SHA $sourceSha (materialized Pages payload; checksum verified)"
    } else {
      Write-Host "Source: dev materialized SHA $sourceSha for current HEAD $devHeadSha (only Pages-irrelevant changes are newer; checksum verified)"
    }
  }

  if(!$web -or !(Test-Path $web)){ throw 'WebUI payload not found.' }
  if(!(Test-Path (Join-Path $web 'public\index.html')) -or !(Test-Path (Join-Path $web 'public\login.html')) -or !(Test-Path (Join-Path $web 'private\index.html'))){ throw 'Source package is not a valid qBittorrent Alternate WebUI.' }

  $new="$Destination.new"
  if(Test-Path $new){Remove-Item $new -Recurse -Force}
  New-Item -ItemType Directory -Force -Path $new | Out-Null
  Copy-Item (Join-Path $web '*') $new -Recurse -Force
  Inject-BuildSha $new $sourceSha
  Assert-MaterializedWebUI $new
  if(!(Test-Path (Join-Path $new 'public\index.html')) -or !(Test-Path (Join-Path $new 'public\login.html')) -or !(Test-Path (Join-Path $new 'private\index.html')) -or !(Test-Path (Join-Path $new 'VERSION')) -or !(Test-Path (Join-Path $new 'GIT_SHA'))){ throw 'Invalid WebUI package.' }

  $version=(Get-Content (Join-Path $new 'VERSION') -Raw).Trim()
  $meta=[ordered]@{
    version=$version
    gitSha=$sourceSha
    channel=$Channel.ToLowerInvariant()
    container=$null
    qbPath=$Destination
    hostPath=$Destination
    installedAt=[DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ')
    installer='windows'
    materialized=$true
  }
  $meta | ConvertTo-Json | Set-Content -Path (Join-Path $new 'private\weigg-install.json') -Encoding UTF8

  $old="$Destination.old"
  if(Test-Path $old){Remove-Item $old -Recurse -Force}
  if(Test-Path $Destination){Move-Item $Destination $old}
  try {
    Move-Item $new $Destination
  } catch {
    if(Test-Path $old){Move-Item $old $Destination}
    throw
  }
  if(Test-Path $old){Remove-Item $old -Recurse -Force}

  Write-Host "Installed: $Destination"
  Write-Host "Channel: $($Channel.ToLowerInvariant())"
  Write-Host "Installed version: $version"
  Write-Host "Installed Git SHA: $sourceSha"
  Write-Host "Install metadata: $(Join-Path $Destination 'private\weigg-install.json')"

  if($Configure){
    Configure-QBWebUI $cfg $Destination
    Write-Host "Configured: $cfg"
    Write-Host "qBittorrent Root Folder: $Destination"
  } else {
    Write-Host 'qBittorrent -> Tools -> Preferences -> Web UI -> Use alternative WebUI'
    Write-Host "WebUI Root Folder: $Destination"
  }
  Write-Host 'Rollback: powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1 -rollback'
} finally {
  if(Test-Path $tmp){Remove-Item $tmp -Recurse -Force}
}
