param(
  [Alias('output')][string]$o="$env:LOCALAPPDATA\weig-qb-webui",
  [string]$QBConfig='',
  [string]$Version='',
  [switch]$Dev,
  [switch]$Configure,
  [switch]$Rollback,
  [switch]$Uninstall,
  [switch]$Purge,
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
  -version VERSION          Install a specific Release, for example 1.2.0.
  -dev                      Install the current dev exact Git SHA.
  -o PATH, -output PATH     WebUI install path.
  -qbconfig PATH            Exact qBittorrent config path for custom/portable profiles.
  -configure                Enable qBittorrent Alternative WebUI and set Root Folder.
  -rollback                 Restore previous WeiG files. Add -configure to restore a saved qB WebUI config snapshot.
  -uninstall                Remove an installer-owned WeiG WebUI. Add -configure to disable it in qBittorrent too.
  -purge                    With -uninstall, also remove installer-owned backups for this install target.
  -help                     Show this help.

Notes:
  -dev and -version cannot be used together.
  A requested Release version never falls back to latest or dev.
  Dev installs use the exact-SHA materialized WebUI payload published by Virtual qB Pages.
  -configure refuses ambiguous config discovery; use -qbconfig for custom/portable profiles.
  -purge is destructive and is only accepted together with -uninstall.
  Backups prefer a verified compressed archive and retain the latest 3 per install target.
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

$Destination=$o
$Mode='Install'
$Channel='Release'
$DestinationExplicit=$PSBoundParameters.ContainsKey('o')
$LegacyDefaultDestination="$env:LOCALAPPDATA\WeiG_qB-WebUI"
if($Rollback){ $Mode='Rollback' }
if($Uninstall){ $Mode='Uninstall' }
if($Purge -and $Mode -ne 'Uninstall'){ throw '-purge can only be used together with -uninstall.' }
if($Dev){
  $Channel='Dev'
}

if(!$DestinationExplicit -and ($Mode -eq 'Install') -and !(Test-Path -LiteralPath $Destination) -and
  (Test-Path -LiteralPath $LegacyDefaultDestination -PathType Container) -and
  (Test-Path -LiteralPath (Join-Path $LegacyDefaultDestination 'public\index.html') -PathType Leaf) -and
  (Test-Path -LiteralPath (Join-Path $LegacyDefaultDestination 'private\index.html') -PathType Leaf) -and
  (Test-Path -LiteralPath (Join-Path $LegacyDefaultDestination 'private\weig-install.json') -PathType Leaf)){
  $Destination=$LegacyDefaultDestination
  Write-Host "Using existing legacy install directory: $Destination"
}

$releaseVersion=$Version.Trim()
$releaseTag=$null
if($releaseVersion){
  if($Channel -eq 'Dev'){ throw '-version and -dev cannot be used together.' }
  if($releaseVersion.StartsWith('v',[System.StringComparison]::OrdinalIgnoreCase)){
    $releaseVersion=$releaseVersion.Substring(1)
  }
  if($releaseVersion -notmatch '^\d+\.\d+\.\d+$'){
    throw "Invalid Release version: $Version. Expected a version such as 1.2.0."
  }
  $releaseTag="v$releaseVersion"
}

$State=Join-Path $env:APPDATA 'weig-qb-webui'
$LegacyState=Join-Path $env:APPDATA 'WeiG_qB-WebUI'
$Backups=Join-Path $State 'backups'
$LegacyBackups=Join-Path $LegacyState 'backups'
New-Item -ItemType Directory -Force -Path $Backups | Out-Null

function Get-InstallerStateMarker([string]$Name) {
  foreach($root in @($State,$LegacyState)){
    $marker=Join-Path $root $Name
    if(Test-Path -LiteralPath $marker -PathType Leaf){
      $value=(Get-Content $marker -Raw).Trim()
      if($value){return $value}
    }
  }
  return $null
}

if(($Mode -eq 'Rollback' -or $Mode -eq 'Uninstall') -and !$DestinationExplicit){
  $remembered=Get-InstallerStateMarker 'last-dest'
  if($remembered){ $Destination=$remembered }
}

function Move-OutOfInstallTarget([string]$Path) {
  if([string]::IsNullOrWhiteSpace($Path)){return}
  $destinationFull=[IO.Path]::GetFullPath($Path).TrimEnd([IO.Path]::DirectorySeparatorChar,[IO.Path]::AltDirectorySeparatorChar)
  $location=Get-Location
  if($location.Provider.Name -ne 'FileSystem'){return}
  $currentFull=[IO.Path]::GetFullPath($location.ProviderPath).TrimEnd([IO.Path]::DirectorySeparatorChar,[IO.Path]::AltDirectorySeparatorChar)
  $inside=$currentFull.Equals($destinationFull,[StringComparison]::OrdinalIgnoreCase) -or
    $currentFull.StartsWith($destinationFull+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)
  if(!$inside){return}
  $safe=Split-Path $destinationFull -Parent
  if([string]::IsNullOrWhiteSpace($safe) -or !(Test-Path -LiteralPath $safe -PathType Container)){
    $safe=$env:TEMP
  }
  if([string]::IsNullOrWhiteSpace($safe) -or !(Test-Path -LiteralPath $safe -PathType Container)){
    throw "Unable to leave install target before atomic directory swap: $destinationFull"
  }
  Set-Location -LiteralPath $safe
  Write-Host "Working directory moved outside install target before atomic swap: $safe"
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
  $restoreTemp=Join-Path $dir ('.weig-qb-restore-'+[guid]::NewGuid().ToString('N')+'.tmp')
  $replaceBackup="$Path.weig.restore-replaced"
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

  $backup="$Path.weig.bak"
  [IO.File]::WriteAllBytes($backup,$originalBytes)
  if(!(Compare-QBBytes $originalBytes ([IO.File]::ReadAllBytes($backup)))){
    throw 'qBittorrent safety backup is not byte-identical; refusing mutation.'
  }

  $dir=Split-Path $Path -Parent
  $tempPath=Join-Path $dir ('.weig-qb-config-'+[guid]::NewGuid().ToString('N')+'.tmp')
  $replaceBackup="$Path.weig.replace.bak"
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

function Disable-QBWebUI([string]$Path,[string]$RootFolder) {
  $state=Assert-QBConfigMutationSafe $Path
  [byte[]]$originalBytes=[IO.File]::ReadAllBytes($Path)
  $originalText=[string]$state.Text
  $section=Get-QBPreferencesSectionInfo $originalText
  foreach($match in @(Get-QBManagedWebUIKeyMatches $originalText)){
    if($match.Index -lt $section.Start -or $match.Index -ge $section.End){throw 'qBittorrent managed WebUI keys must belong to the [Preferences] section.'}
  }
  $rootPattern='(?m)^'+[regex]::Escape('WebUI\RootFolder='+$RootFolder)+'\r?$'
  if(([regex]::Matches($originalText,$rootPattern)).Count -ne 1){throw 'qBittorrent Root Folder does not match the uninstall target; refusing config mutation.'}
  $altPattern='(?m)^WebUI\\AlternativeUIEnabled=(?:true|false)(\r?)$'
  if(([regex]::Matches($originalText,$altPattern)).Count -ne 1){throw 'qBittorrent AlternativeUIEnabled is missing or ambiguous; refusing config mutation.'}
  $text=[regex]::Replace($originalText,$altPattern,{param($m) 'WebUI\AlternativeUIEnabled=false'+$m.Groups[1].Value})
  if(([regex]::Matches($text,'(?m)^WebUI\\AlternativeUIEnabled=false\r?$')).Count -ne 1){throw 'Failed to build a disabled Alternative WebUI config candidate.'}

  $backup="$Path.weig.bak"
  [IO.File]::WriteAllBytes($backup,$originalBytes)
  if(!(Compare-QBBytes $originalBytes ([IO.File]::ReadAllBytes($backup)))){throw 'qBittorrent safety backup is not byte-identical; refusing mutation.'}
  $dir=Split-Path $Path -Parent
  $tempPath=Join-Path $dir ('.weig-qb-uninstall-'+[guid]::NewGuid().ToString('N')+'.tmp')
  $replaceBackup="$Path.weig.uninstall-replace.bak"
  [byte[]]$candidateBytes=$null
  try {
    Write-QBConfigText $tempPath $text $state
    $verify=Read-QBConfigText $tempPath
    if($verify.Text -ne $text){throw 'qBittorrent uninstall config verification failed.'}
    if($verify.EncodingName -ne $state.EncodingName -or !(Compare-QBBytes ([byte[]]$verify.Preamble) ([byte[]]$state.Preamble))){throw 'qBittorrent uninstall config did not preserve the original encoding.'}
    [byte[]]$candidateBytes=[IO.File]::ReadAllBytes($tempPath)
    $null=Assert-QBConfigMutationSafe $Path
    if(!(Compare-QBBytes $originalBytes ([IO.File]::ReadAllBytes($Path)))){throw 'qBittorrent config changed after uninstall preflight; refusing to overwrite a newer file.'}
    Invoke-QBAtomicReplace $tempPath $Path $replaceBackup
    $final=Read-QBConfigText $Path
    if($final.Text -ne $text -or !(Compare-QBBytes $candidateBytes ([IO.File]::ReadAllBytes($Path)))){throw 'qBittorrent config verification failed after uninstall mutation.'}
  } catch {
    $failure=$_.Exception
    $currentBytes=$null
    if(Test-Path -LiteralPath $Path -PathType Leaf){[byte[]]$currentBytes=[IO.File]::ReadAllBytes($Path)}
    if($candidateBytes -and $currentBytes -and (Compare-QBBytes $candidateBytes $currentBytes)){
      try {
        Restore-QBConfigBackupAtomically $Path $backup
      } catch {
        throw "qBittorrent uninstall config mutation failed and automatic rollback also failed. Original safety backup remains at $backup. Mutation error: $($failure.Message) Rollback error: $($_.Exception.Message)"
      }
    } elseif($currentBytes -and !(Compare-QBBytes $originalBytes $currentBytes)){
      throw "qBittorrent config changed unexpectedly during uninstall mutation; refusing to overwrite it. Original safety backup remains at $backup. Mutation error: $($failure.Message)"
    }
    throw $failure
  } finally {
    if(Test-Path -LiteralPath $tempPath){Remove-Item -LiteralPath $tempPath -Force -ErrorAction SilentlyContinue}
    if(Test-Path -LiteralPath $replaceBackup){Remove-Item -LiteralPath $replaceBackup -Force -ErrorAction SilentlyContinue}
  }
}

function Read-BackupRecordText([string]$Backup,[string]$Name) {
  if(Test-Path -LiteralPath $Backup -PathType Container){
    $path=Join-Path $Backup $Name
    if(Test-Path -LiteralPath $path -PathType Leaf){return (Get-Content -LiteralPath $path -Raw).Trim()}
    return $null
  }
  if(!(Test-Path -LiteralPath $Backup -PathType Leaf) -or [IO.Path]::GetExtension($Backup).ToLowerInvariant() -ne '.zip'){return $null}
  try {
    Add-Type -AssemblyName System.IO.Compression.FileSystem -ErrorAction SilentlyContinue
    $zip=[IO.Compression.ZipFile]::OpenRead($Backup)
    try {
      $entry=$zip.GetEntry($Name)
      if($null -eq $entry){return $null}
      $reader=[IO.StreamReader]::new($entry.Open())
      try {return $reader.ReadToEnd().Trim()} finally {$reader.Dispose()}
    } finally {$zip.Dispose()}
  } catch {return $null}
}

function Copy-BackupRecordFile([string]$Backup,[string]$Name,[string]$Destination) {
  if(Test-Path -LiteralPath $Backup -PathType Container){
    $path=Join-Path $Backup $Name
    if(!(Test-Path -LiteralPath $path -PathType Leaf)){return $false}
    Copy-Item -LiteralPath $path -Destination $Destination -Force
    return $true
  }
  if(!(Test-Path -LiteralPath $Backup -PathType Leaf)){return $false}
  Add-Type -AssemblyName System.IO.Compression.FileSystem -ErrorAction SilentlyContinue
  $zip=[IO.Compression.ZipFile]::OpenRead($Backup)
  try {
    $entry=$zip.GetEntry($Name)
    if($null -eq $entry){return $false}
    $input=$entry.Open()
    $output=[IO.File]::Open($Destination,[IO.FileMode]::Create,[IO.FileAccess]::Write,[IO.FileShare]::None)
    try {$input.CopyTo($output)} finally {$output.Dispose();$input.Dispose()}
    return $true
  } finally {$zip.Dispose()}
}

function Test-BackupOwned([string]$Backup) {
  $had=Read-BackupRecordText $Backup 'had-webui'
  $dest=Read-BackupRecordText $Backup 'dest-path'
  return (![string]::IsNullOrWhiteSpace($dest) -and $had -in @('0','1'))
}

function New-BackupArchivePath {
  $stamp=Get-Date -Format 'yyyyMMdd-HHmm'
  $next=1
  $escaped=[regex]::Escape($stamp)
  foreach($backupRoot in @($Backups,$LegacyBackups)){
    if(!(Test-Path -LiteralPath $backupRoot -PathType Container)){continue}
    foreach($item in @(Get-ChildItem -LiteralPath $backupRoot -File -Filter "$stamp*.zip" -ErrorAction SilentlyContinue)){
      $ordinal=$null
      if($item.Name -eq "$stamp.zip"){$ordinal=1}
      elseif($item.Name -match "^$escaped-(\d{2})\.zip$"){$ordinal=[int]$Matches[1]}
      if($null -ne $ordinal -and $ordinal -ge $next){$next=$ordinal+1}
    }
  }
  for($i=$next;$i -le 99;$i++){
    $name=if($i -eq 1){"$stamp.zip"}else{"$stamp-$($i.ToString('00')).zip"}
    $candidate=Join-Path $Backups $name
    $lock="$candidate.lock"
    if(Test-Path -LiteralPath $candidate){continue}
    try {
      $null=New-Item -ItemType Directory -Path $lock -ErrorAction Stop
      if(!(Test-Path -LiteralPath $candidate)){return $candidate}
      Remove-Item -LiteralPath $lock -Force -ErrorAction SilentlyContinue
    } catch {}
  }
  throw "Unable to reserve a unique backup archive name for $stamp."
}

function New-BackupRecordArchive([string]$Record,[string]$Archive) {
  Add-Type -AssemblyName System.IO.Compression.FileSystem -ErrorAction SilentlyContinue
  $temp="$Archive.tmp-$PID-$([guid]::NewGuid().ToString('N'))"
  try {
    [IO.Compression.ZipFile]::CreateFromDirectory($Record,$temp,[IO.Compression.CompressionLevel]::Optimal,$false)
    Move-Item -LiteralPath $temp -Destination $Archive
  } finally {
    if(Test-Path -LiteralPath $temp){Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue}
  }
}

function Get-OwnedBackupsForDestination([string]$Target) {
  $targetFull=[IO.Path]::GetFullPath($Target).TrimEnd([IO.Path]::DirectorySeparatorChar,[IO.Path]::AltDirectorySeparatorChar)
  $owned=@()
  foreach($backupRoot in @($Backups,$LegacyBackups)){
    if(!(Test-Path -LiteralPath $backupRoot -PathType Container)){continue}
    foreach($item in @(Get-ChildItem -LiteralPath $backupRoot -Force -ErrorAction SilentlyContinue)){
      if(!(Test-BackupOwned $item.FullName)){continue}
      try {
        $saved=Read-BackupRecordText $item.FullName 'dest-path'
        $savedFull=[IO.Path]::GetFullPath($saved).TrimEnd([IO.Path]::DirectorySeparatorChar,[IO.Path]::AltDirectorySeparatorChar)
      } catch {continue}
      if($savedFull.Equals($targetFull,[StringComparison]::OrdinalIgnoreCase)){$owned += $item}
    }
  }
  return @($owned | Sort-Object LastWriteTimeUtc,Name -Descending)
}

function Prune-Backups([string]$Target,[int]$Keep=3) {
  if($Keep -lt 1){throw 'Backup retention must keep at least one backup.'}
  $owned=@(Get-OwnedBackupsForDestination $Target)
  foreach($item in @($owned | Select-Object -Skip $Keep)){
    Remove-Item -LiteralPath $item.FullName -Recurse -Force
  }
}

function Purge-BackupsForDestination([string]$Target) {
  $owned=@(Get-OwnedBackupsForDestination $Target)
  $deleted=@{}
  foreach($item in $owned){
    $deleted[$item.FullName.ToLowerInvariant()]=$true
    Remove-Item -LiteralPath $item.FullName -Recurse -Force
    Write-Host "Purged installer backup: $($item.FullName)"
  }

  foreach($stateRoot in @($State,$LegacyState)){
    $stateMatchesTarget=$false
    $lastDestMarker=Join-Path $stateRoot 'last-dest'
    if(Test-Path -LiteralPath $lastDestMarker -PathType Leaf){
      $saved=(Get-Content $lastDestMarker -Raw).Trim()
      try {
        $savedFull=[IO.Path]::GetFullPath($saved).TrimEnd([IO.Path]::DirectorySeparatorChar,[IO.Path]::AltDirectorySeparatorChar)
        $targetFull=[IO.Path]::GetFullPath($Target).TrimEnd([IO.Path]::DirectorySeparatorChar,[IO.Path]::AltDirectorySeparatorChar)
        $stateMatchesTarget=$savedFull.Equals($targetFull,[StringComparison]::OrdinalIgnoreCase)
      } catch {}
    }

    $lastBackupMarker=Join-Path $stateRoot 'last-backup'
    if(Test-Path -LiteralPath $lastBackupMarker -PathType Leaf){
      $lastBackup=(Get-Content $lastBackupMarker -Raw).Trim()
      if($lastBackup -and $deleted.ContainsKey($lastBackup.ToLowerInvariant())){$stateMatchesTarget=$true}
      elseif($lastBackup){
        $lastBackupDest=Read-BackupRecordText $lastBackup 'dest-path'
        if($lastBackupDest){
          try {$stateMatchesTarget=([IO.Path]::GetFullPath($lastBackupDest).TrimEnd([IO.Path]::DirectorySeparatorChar,[IO.Path]::AltDirectorySeparatorChar)).Equals($targetFull,[StringComparison]::OrdinalIgnoreCase)} catch {}
        }
      }
    }

    if($stateMatchesTarget){
      Remove-Item -LiteralPath $lastBackupMarker -Force -ErrorAction SilentlyContinue
      Remove-Item -LiteralPath $lastDestMarker -Force -ErrorAction SilentlyContinue
      Remove-Item -LiteralPath (Join-Path $stateRoot 'last-qb-root-folder') -Force -ErrorAction SilentlyContinue
    }
  }

  foreach($backupRoot in @($Backups,$LegacyBackups)){
    if((Test-Path -LiteralPath $backupRoot -PathType Container) -and -not (Get-ChildItem -LiteralPath $backupRoot -Force -ErrorAction SilentlyContinue | Select-Object -First 1)){
      Remove-Item -LiteralPath $backupRoot -Force
    }
  }
  foreach($stateRoot in @($State,$LegacyState)){
    if((Test-Path -LiteralPath $stateRoot -PathType Container) -and -not (Get-ChildItem -LiteralPath $stateRoot -Force -ErrorAction SilentlyContinue | Select-Object -First 1)){
      Remove-Item -LiteralPath $stateRoot -Force
    }
  }
}
function Write-BackupArchiveManifest([string]$Backup,[string]$Format,[string]$File,[string]$Tool,[string]$Sha256,[long]$Bytes) {
  @(
    'schema=1'
    "format=$Format"
    "file=$File"
    "tool=$Tool"
    "sha256=$Sha256"
    "bytes=$Bytes"
  ) | Set-Content -Encoding UTF8 -LiteralPath (Join-Path $Backup 'archive-manifest')
}

function Read-BackupArchiveManifest([string]$Backup) {
  $file=Join-Path $Backup 'archive-manifest'
  if(!(Test-Path -LiteralPath $file -PathType Leaf)){return $null}
  $values=@{}
  foreach($line in @(Get-Content -LiteralPath $file)){
    if($line -match '^([^=]+)=(.*)$'){$values[$Matches[1]]=$Matches[2]}
  }
  return $values
}

function Save-BackupArchiveManifest([string]$Backup,[string]$Archive,[string]$Format,[string]$Tool) {
  if(!(Test-Path -LiteralPath $Archive -PathType Leaf)){return $false}
  $hash=(Get-FileHash -Algorithm SHA256 -LiteralPath $Archive).Hash.ToLowerInvariant()
  $bytes=(Get-Item -LiteralPath $Archive).Length
  Write-BackupArchiveManifest $Backup $Format ([IO.Path]::GetFileName($Archive)) $Tool $hash $bytes
  return $true
}

function New-WebUiBackupPayload([string]$Source,[string]$Backup) {
  $archive=Join-Path $Backup 'webui.zip'
  try {
    Add-Type -AssemblyName System.IO.Compression.FileSystem -ErrorAction SilentlyContinue
    if(Test-Path -LiteralPath $archive){Remove-Item -LiteralPath $archive -Force}
    [IO.Compression.ZipFile]::CreateFromDirectory($Source,$archive,[IO.Compression.CompressionLevel]::Optimal,$false)
    if(Save-BackupArchiveManifest $Backup $archive 'zip' '.NET ZipFile'){
      Write-Host "Backup payload: compressed zip ($((Get-Item -LiteralPath $archive).Length) bytes)"
      return $true
    }
  } catch {
    if(Test-Path -LiteralPath $archive){Remove-Item -LiteralPath $archive -Force -ErrorAction SilentlyContinue}
  }

  $tar=Get-Command tar.exe,tar -ErrorAction SilentlyContinue | Select-Object -First 1
  if($tar){
    $archive=Join-Path $Backup 'webui.tar.gz'
    try {
      & $tar.Source -czf $archive -C $Source .
      if($LASTEXITCODE -eq 0 -and (Save-BackupArchiveManifest $Backup $archive 'tar.gz' 'tar')){
        Write-Host "Backup payload: compressed tar.gz ($((Get-Item -LiteralPath $archive).Length) bytes)"
        return $true
      }
    } catch {}
    if(Test-Path -LiteralPath $archive){Remove-Item -LiteralPath $archive -Force -ErrorAction SilentlyContinue}
  }

  $seven=Get-Command 7z.exe,7za.exe,7z,7za -ErrorAction SilentlyContinue | Select-Object -First 1
  if($seven){
    $archive=Join-Path $Backup 'webui.7z'
    try {
      Push-Location $Source
      try { & $seven.Source a -bd -y -t7z -mx=5 $archive . | Out-Null }
      finally { Pop-Location }
      if($LASTEXITCODE -eq 0 -and (Save-BackupArchiveManifest $Backup $archive '7z' ([string]$seven.Name))){
        Write-Host "Backup payload: compressed 7z ($((Get-Item -LiteralPath $archive).Length) bytes)"
        return $true
      }
    } catch {}
    if(Test-Path -LiteralPath $archive){Remove-Item -LiteralPath $archive -Force -ErrorAction SilentlyContinue}
  }

  Write-Warning 'No verified compressed backup backend with SHA-256 support is available; refusing an unverified directory backup.'
  return $false
}

function Assert-BackupArchive([string]$Backup,[hashtable]$Manifest) {
  if(!$Manifest){throw 'Backup archive manifest is missing.'}
  $name=[string]$Manifest['file']
  if($name -notin @('webui.zip','webui.tar.gz','webui.7z')){throw "Unsupported backup archive file: $name"}
  $archive=Join-Path $Backup $name
  if(!(Test-Path -LiteralPath $archive -PathType Leaf)){throw "Backup archive missing: $archive"}
  $expected=([string]$Manifest['sha256']).ToLowerInvariant()
  if($expected -notmatch '^[0-9a-f]{64}$'){throw 'Backup archive SHA-256 is missing or invalid.'}
  $actual=(Get-FileHash -Algorithm SHA256 -LiteralPath $archive).Hash.ToLowerInvariant()
  if($actual -ne $expected){throw "Backup archive checksum mismatch: $archive"}
  return $archive
}

function Expand-WebUiBackupPayload([string]$Backup,[string]$Stage) {
  if(Test-Path -LiteralPath $Backup -PathType Leaf){
    Add-Type -AssemblyName System.IO.Compression.FileSystem -ErrorAction SilentlyContinue
    $record=Join-Path ([IO.Path]::GetTempPath()) ("weig-qb-backup-record-"+[guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $record | Out-Null
    try {
      [IO.Compression.ZipFile]::ExtractToDirectory($Backup,$record)
      Expand-WebUiBackupPayload $record $Stage
    } finally {
      if(Test-Path -LiteralPath $record){Remove-Item -LiteralPath $record -Recurse -Force -ErrorAction SilentlyContinue}
    }
    return
  }
  $legacy=Join-Path $Backup 'webui'
  if(Test-Path -LiteralPath $legacy -PathType Container){
    Copy-Item -LiteralPath $legacy -Destination $Stage -Recurse -Force
    return
  }

  $manifest=Read-BackupArchiveManifest $Backup
  $archive=Assert-BackupArchive $Backup $manifest
  New-Item -ItemType Directory -Path $Stage | Out-Null
  switch([string]$manifest['format']){
    'zip' {
      Add-Type -AssemblyName System.IO.Compression.FileSystem -ErrorAction SilentlyContinue
      [IO.Compression.ZipFile]::ExtractToDirectory($archive,$Stage)
    }
    'tar.gz' {
      $tar=Get-Command tar.exe,tar -ErrorAction SilentlyContinue | Select-Object -First 1
      if(!$tar){throw 'tar is required to restore this backup.'}
      & $tar.Source -xzf $archive -C $Stage
      if($LASTEXITCODE -ne 0){throw "tar failed to restore backup with exit code $LASTEXITCODE."}
    }
    '7z' {
      $seven=Get-Command 7z.exe,7za.exe,7z,7za -ErrorAction SilentlyContinue | Select-Object -First 1
      if(!$seven){throw '7z/7za is required to restore this backup.'}
      & $seven.Source x -bd -y "-o$Stage" $archive | Out-Null
      if($LASTEXITCODE -ne 0){throw "7z failed to restore backup with exit code $LASTEXITCODE."}
    }
    default { throw "Unsupported backup archive format: $($manifest['format'])" }
  }
  if(!(Get-ChildItem -LiteralPath $Stage -Force -ErrorAction SilentlyContinue | Select-Object -First 1)){throw 'Backup archive extracted no WebUI files.'}
}

function Install-WebUiStage([string]$Stage,[string]$Target) {
  if(!(Test-Path -LiteralPath $Stage -PathType Container)){throw "Prepared WebUI stage is missing: $Stage"}
  foreach($relative in @('public\index.html','public\login.html','private\index.html','VERSION','GIT_SHA','private\weig-install.json')){
    if(!(Test-Path -LiteralPath (Join-Path $Stage $relative) -PathType Leaf)){throw "Prepared WebUI stage is missing $relative."}
  }
  $reparse=@(Get-ChildItem -LiteralPath $Stage -Recurse -Force -ErrorAction Stop | Where-Object { ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 })
  if($reparse.Count -gt 0){throw 'Prepared WebUI stage contains a reparse point/symlink; refusing a qBittorrent Alternative WebUI deployment.'}

  if(!(Test-Path -LiteralPath $Target)){
    Move-Item -LiteralPath $Stage -Destination $Target
    return
  }
  if(!(Test-Path -LiteralPath $Target -PathType Container)){throw "Install target exists but is not a directory: $Target"}
  if(!(Test-Path -LiteralPath (Join-Path $Target 'public\index.html') -PathType Leaf) -or !(Test-Path -LiteralPath (Join-Path $Target 'private\index.html') -PathType Leaf)){
    throw 'Existing WeiG WebUI is missing a live index entry; refusing an in-place update.'
  }

  $stageRoot=[IO.Path]::GetFullPath($Stage).TrimEnd([IO.Path]::DirectorySeparatorChar,[IO.Path]::AltDirectorySeparatorChar)+[IO.Path]::DirectorySeparatorChar
  $targetRoot=[IO.Path]::GetFullPath($Target).TrimEnd([IO.Path]::DirectorySeparatorChar,[IO.Path]::AltDirectorySeparatorChar)+[IO.Path]::DirectorySeparatorChar

  foreach($dir in @(Get-ChildItem -LiteralPath $Stage -Directory -Recurse -Force -ErrorAction Stop)){
    $relative=$dir.FullName.Substring($stageRoot.Length)
    $destination=Join-Path $Target $relative
    if((Test-Path -LiteralPath $destination) -and !(Test-Path -LiteralPath $destination -PathType Container)){throw "Live WebUI path type collision: $destination"}
    New-Item -ItemType Directory -Force -Path $destination | Out-Null
  }

  foreach($file in @(Get-ChildItem -LiteralPath $Stage -File -Recurse -Force -ErrorAction Stop)){
    $relative=$file.FullName.Substring($stageRoot.Length)
    $destination=Join-Path $Target $relative
    $parent=Split-Path $destination -Parent
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
    if((Test-Path -LiteralPath $destination) -and !(Test-Path -LiteralPath $destination -PathType Leaf)){throw "Live WebUI path type collision: $destination"}
    $temp=Join-Path $parent ('.weig-stage-'+[guid]::NewGuid().ToString('N')+'.tmp')
    $replaceBackup=Join-Path $parent ('.weig-stage-backup-'+[guid]::NewGuid().ToString('N')+'.tmp')
    try {
      Copy-Item -LiteralPath $file.FullName -Destination $temp -Force
      if(Test-Path -LiteralPath $destination -PathType Leaf){
        [IO.File]::Replace($temp,$destination,$replaceBackup,$true)
      } else {
        Move-Item -LiteralPath $temp -Destination $destination
      }
    } finally {
      if(Test-Path -LiteralPath $temp){Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue}
      if(Test-Path -LiteralPath $replaceBackup){Remove-Item -LiteralPath $replaceBackup -Force -ErrorAction SilentlyContinue}
    }
  }

  foreach($file in @(Get-ChildItem -LiteralPath $Target -File -Recurse -Force -ErrorAction Stop)){
    $relative=$file.FullName.Substring($targetRoot.Length)
    if(!(Test-Path -LiteralPath (Join-Path $Stage $relative) -PathType Leaf)){
      Remove-Item -LiteralPath $file.FullName -Force
    }
  }
  foreach($dir in @(Get-ChildItem -LiteralPath $Target -Directory -Recurse -Force -ErrorAction Stop | Sort-Object { $_.FullName.Length } -Descending)){
    $relative=$dir.FullName.Substring($targetRoot.Length)
    if((Test-Path -LiteralPath (Join-Path $Stage $relative) -PathType Container)){continue}
    if(!(Get-ChildItem -LiteralPath $dir.FullName -Force -ErrorAction SilentlyContinue | Select-Object -First 1)){
      Remove-Item -LiteralPath $dir.FullName -Force
    }
  }

  Remove-Item -LiteralPath $Stage -Recurse -Force
  foreach($relative in @('public\index.html','public\login.html','private\index.html')){
    if(!(Test-Path -LiteralPath (Join-Path $Target $relative) -PathType Leaf)){throw "Live WebUI verification failed after deployment: $relative"}
  }
}

function Restore-WebUiBackup([string]$Backup,[string]$Target) {
  $hadValue=Read-BackupRecordText $Backup 'had-webui'
  if($hadValue -notin @('0','1')){throw "Backup had-webui marker is missing or invalid: $Backup"}
  $hadWebUi=($hadValue -eq '1')

  if($hadWebUi){
    $parent=Split-Path $Target -Parent
    if($parent){New-Item -ItemType Directory -Force -Path $parent | Out-Null}
    $stage="$Target.weig-restore-$PID-$([guid]::NewGuid().ToString('N'))"
    if(Test-Path -LiteralPath $stage){throw "Restore staging path already exists: $stage"}
    try {
      Expand-WebUiBackupPayload $Backup $stage
      Install-WebUiStage $stage $Target
    } finally {
      if(Test-Path -LiteralPath $stage){Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue}
    }
    Write-Host "Restored previous WebUI: $Target"
  } else {
    if(Test-Path -LiteralPath $Target){Remove-Item -LiteralPath $Target -Recurse -Force}
    Write-Host "Removed WeiG qB WebUI from: $Target"
  }
}

function Backup-Current([string]$ConfigPath='') {
  $b=New-BackupArchivePath
  $lock="$b.lock"
  $record=Join-Path ([IO.Path]::GetTempPath()) ("weig-qb-backup-record-"+[guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $record | Out-Null
  try {
    if(Test-Path $Destination){
      if(!(New-WebUiBackupPayload $Destination $record)){throw 'Unable to create a verified WebUI backup payload.'}
      Set-Content -Encoding ASCII -Path (Join-Path $record 'had-webui') -Value '1'
    } else {
      Write-BackupArchiveManifest $record 'none' '' 'none' '' 0
      Set-Content -Encoding ASCII -Path (Join-Path $record 'had-webui') -Value '0'
    }
    if($ConfigPath){
      Copy-Item -LiteralPath $ConfigPath (Join-Path $record 'qBittorrent.conf') -Force
      Set-Content -Encoding UTF8 -Path (Join-Path $record 'config-path') -Value $ConfigPath
    }
    Set-Content -Encoding UTF8 -Path (Join-Path $record 'dest-path') -Value $Destination
    New-BackupRecordArchive $record $b
  } catch {
    if(Test-Path -LiteralPath $b){Remove-Item -LiteralPath $b -Force -ErrorAction SilentlyContinue}
    throw
  } finally {
    if(Test-Path -LiteralPath $record){Remove-Item -LiteralPath $record -Recurse -Force -ErrorAction SilentlyContinue}
    if(Test-Path -LiteralPath $lock){Remove-Item -LiteralPath $lock -Force -ErrorAction SilentlyContinue}
  }
  if(!(Test-BackupOwned $b)){Remove-Item -LiteralPath $b -Force -ErrorAction SilentlyContinue;throw "Backup bundle verification failed: $b"}
  Set-Content -Encoding UTF8 -Path (Join-Path $State 'last-backup') -Value $b
  Set-Content -Encoding UTF8 -Path (Join-Path $State 'last-dest') -Value $Destination
  Prune-Backups $Destination 3
  Write-Host "Backup: $b"
  return $b
}

function Restore-Last {
  $b=Get-InstallerStateMarker 'last-backup'
  if(!$b){throw 'No backup found.'}
  if(!(Test-BackupOwned $b)){throw "Backup record missing or invalid: $b"}

  if(!$DestinationExplicit){
    $savedDest=Read-BackupRecordText $b 'dest-path'
    if($savedDest){$script:Destination=$savedDest}
  }

  $cfg=$null
  $old=$null
  if($Configure){
    $cfg=Read-BackupRecordText $b 'config-path'
    if(!$cfg){throw 'This backup has no qBittorrent config snapshot; refusing -Rollback -Configure.'}
    $old=Join-Path ([IO.Path]::GetTempPath()) ("weig-qb-rollback-config-"+[guid]::NewGuid().ToString('N'))
    if(!(Copy-BackupRecordFile $b 'qBittorrent.conf' $old)){throw 'This backup has no qBittorrent config snapshot; refusing -Rollback -Configure.'}
    if(Test-QBittorrentRunning){Remove-Item -LiteralPath $old -Force -ErrorAction SilentlyContinue;throw 'qBittorrent is running. Exit qBittorrent completely before rollback restores its config.'}
    foreach($pending in @(Get-QBPendingConfigPaths $cfg)){
      if((Test-Path -LiteralPath $pending -PathType Leaf) -and (Get-Item -LiteralPath $pending).Length -gt 0){
        Remove-Item -LiteralPath $old -Force -ErrorAction SilentlyContinue
        throw "qBittorrent recovery file is non-empty; refusing rollback config mutation: $pending"
      }
    }
    $backupState=Read-QBConfigText $old
    Assert-QBConfigTextLooksSafe $old $backupState (Get-Item -LiteralPath $old).Length
  }

  try {
    Restore-WebUiBackup $b $Destination
    if($cfg){
      New-Item -ItemType Directory -Force -Path (Split-Path $cfg -Parent) | Out-Null
      Restore-QBConfigBackupAtomically $cfg $old
      Write-Host "Restored qBittorrent WebUI config by explicit -Configure: $cfg"
    }
  } finally {
    if($old -and (Test-Path -LiteralPath $old)){Remove-Item -LiteralPath $old -Force -ErrorAction SilentlyContinue}
  }
}

function Assert-WeiGInstallTarget([string]$Path) {
  if([string]::IsNullOrWhiteSpace($Path)){throw 'Refusing an empty uninstall target.'}
  $full=[IO.Path]::GetFullPath($Path).TrimEnd([IO.Path]::DirectorySeparatorChar,[IO.Path]::AltDirectorySeparatorChar)
  $root=[IO.Path]::GetPathRoot($full).TrimEnd([IO.Path]::DirectorySeparatorChar,[IO.Path]::AltDirectorySeparatorChar)
  if($full.Equals($root,[StringComparison]::OrdinalIgnoreCase)){throw "Refusing unsafe uninstall target: $full"}
  foreach($relative in @('public\index.html','private\index.html','VERSION','GIT_SHA','private\weig-install.json')){
    if(!(Test-Path -LiteralPath (Join-Path $full $relative) -PathType Leaf)){throw "Refusing to uninstall a directory that is not an installer-owned WeiG qB WebUI: $full"}
  }
  return $full
}

function Uninstall-Current {
  $script:Destination=Assert-WeiGInstallTarget $Destination
  $cfg=$null
  if($Configure){
    $cfg=Find-QBConfig $QBConfig
    if(!$cfg){throw 'No unambiguous qBittorrent config was found; uninstall stopped before deleting files.'}
    $null=Assert-QBConfigMutationSafe $cfg
  }
  $null=Backup-Current $cfg
  if($Configure){
    Disable-QBWebUI $cfg $Destination
    Write-Host "Disabled qBittorrent Alternative WebUI: $cfg"
  }
  Move-OutOfInstallTarget $Destination
  Remove-Item -LiteralPath $Destination -Recurse -Force
  if(Test-Path -LiteralPath $Destination){throw "Failed to remove WeiG qB WebUI: $Destination"}
  Write-Host "Uninstalled WeiG qB WebUI: $Destination"
  if($Purge){
    Purge-BackupsForDestination $Destination
    Write-Host 'Installer backups for this uninstall target were purged; installer rollback is no longer available for it.'
  } else {
    Write-Host 'Rollback is available with: powershell -ExecutionPolicy Bypass -File .\install.ps1 -rollback'
  }
}

function Inject-BuildSha([string]$Root,[string]$Sha) {
  if($Sha -notmatch '^[0-9a-fA-F]{40}$'){throw 'Invalid Git SHA for asset versioning.'}
  $utf8=New-Object System.Text.UTF8Encoding($false)
  Get-ChildItem $Root -Recurse -File | Where-Object { $_.Extension -in @('.html','.js','.css','.json') -or $_.Name -eq 'GIT_SHA' } | ForEach-Object {
    $text=[IO.File]::ReadAllText($_.FullName)
    if($text.Contains('__WEIG_GIT_SHA__')){[IO.File]::WriteAllText($_.FullName,$text.Replace('__WEIG_GIT_SHA__',$Sha),$utf8)}
  }
  [IO.File]::WriteAllText((Join-Path $Root 'GIT_SHA'),$Sha+"`n",$utf8)
}

function Verify-PackageChecksum([string]$Archive,[string]$SumFile,[string]$ArchiveName) {
  $escaped=[regex]::Escape($ArchiveName)
  $sumLine=Get-Content $SumFile | Where-Object { $_ -match ("\s+\*?"+$escaped+"$") } | Select-Object -First 1
  if(!$sumLine){throw "SHA256SUMS does not contain $ArchiveName; refusing installation."}
  $expected=(($sumLine -split '\s+')[0]).ToLowerInvariant()
  $actual=(Get-FileHash $Archive -Algorithm SHA256).Hash.ToLowerInvariant()
  if($expected -notmatch '^[0-9a-f]{64}$' -or $expected -ne $actual){throw "SHA256 verification failed for $ArchiveName."}
}

function Assert-MaterializedWebUI([string]$Root) {
  $data=Join-Path $Root 'private\data'
  $translations=Join-Path $Root 'translations'
  foreach($contract in @('capabilities.json','torrent-compat.json','detail-compat.json','settings-compat.json','source-actions.json','rss-compat.json')){
    $file=Join-Path $data $contract
    if(!(Test-Path $file -PathType Leaf) -or (Get-Item $file).Length -le 0){throw "Materialized WebUI is missing compact runtime contract $contract."}
  }
  foreach($legacy in @('private\scripts\release-profile.js','private\data\qb-releases.json','private\data\qb-release-profiles','private\data\qb-settings-native.txt')){if(Test-Path (Join-Path $Root $legacy)){throw "Materialized WebUI retained retired runtime path $legacy."}}
  foreach($spec in @(@('qb-copy-routes','*.json.gz'),@('qb-copy-bindings','*.txt'),@('qb-copy-fallback','*.json.gz'))){
    $dir=Join-Path $data $spec[0]
    if(!(Test-Path $dir -PathType Container)){throw "Materialized WebUI is missing qB copy shard directory $($spec[0])."}
    $files=Get-ChildItem $dir -Filter $spec[1] -File -Recurse -ErrorAction SilentlyContinue
    if(!($files | Select-Object -First 1)){throw "Materialized WebUI qB copy shard directory $($spec[0]) is empty."}
    if($files | Where-Object {$_.Length -le 0} | Select-Object -First 1){throw "Materialized WebUI contains an empty qB copy shard in $($spec[0])."}
  }
  $weigLocaleDir=Join-Path $data 'weig-i18n'
  $expectedWeiGLocaleShards=@('de','es','fr','ja','ko','pt','ru','zh-CN','zh-HK','zh-TW')
  if(!(Test-Path $weigLocaleDir -PathType Container)){throw 'Materialized WebUI is missing WeiG locale shard directory.'}
  $actualWeiGLocaleShards=@(Get-ChildItem $weigLocaleDir -Filter '*.json' -File -ErrorAction SilentlyContinue)
  if($actualWeiGLocaleShards.Count -ne $expectedWeiGLocaleShards.Count){throw "Materialized WebUI WeiG locale shard count mismatch: $($actualWeiGLocaleShards.Count) != $($expectedWeiGLocaleShards.Count)."}
  foreach($locale in $expectedWeiGLocaleShards){$file=Join-Path $weigLocaleDir ($locale+'.json');if(!(Test-Path $file -PathType Leaf) -or (Get-Item $file).Length -le 0){throw "Materialized WebUI is missing WeiG locale shard $locale.json."}}
  $binding=Get-ChildItem (Join-Path $data 'qb-copy-bindings') -Filter '*.txt' -File | Select-Object -First 1
  if(!$binding -or (Get-Content $binding.FullName -Raw) -notmatch '(?m)^@@BINDING\tb[0-9a-f]{20}$'){throw 'Materialized WebUI qB copy binding shard is malformed.'}
  if(!(Test-Path $translations) -or !(Get-ChildItem $translations -Filter 'webui_*.qm' -File -ErrorAction SilentlyContinue | Select-Object -First 1)){throw 'Materialized WebUI is missing official qB WebUI translation QM assets.'}
}

if($Mode -eq 'Rollback'){
  Restore-Last
  exit 0
}
if($Mode -eq 'Uninstall'){
  Uninstall-Current
  exit 0
}

$cfg=$null
if($Configure){
  $cfg=Find-QBConfig $QBConfig
  if(!$cfg){throw 'No unambiguous qBittorrent config was found. Use -qbconfig with the exact config path for custom/portable profiles.'}
  $null=Assert-QBConfigMutationSafe $cfg
}

$deploymentBackup=Backup-Current $cfg
$tmp=Join-Path ([IO.Path]::GetTempPath()) ("weig-qb-"+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
try {
  $archive=$null
  $archiveName=$null
  $sourceSha=$null
  $web=$null

  if($Channel -eq 'Release'){
    $requestedReleaseVersion=$releaseVersion
    $requestedReleaseTag=$releaseTag
    $apiHeaders=@{'User-Agent'='WeiG-qB-WebUI-installer'}
    try {
      if($requestedReleaseVersion){$releaseMeta=Invoke-RestMethod -UseBasicParsing -Headers $apiHeaders "https://api.github.com/repos/$Repo/releases/tags/$requestedReleaseTag"}
      else {$releaseMeta=Invoke-RestMethod -UseBasicParsing -Headers $apiHeaders "https://api.github.com/repos/$Repo/releases/latest"}
    } catch {
      if($requestedReleaseVersion){throw "Release $requestedReleaseTag was not found. Refusing to fall back to latest or dev."}
      throw 'No published stable GitHub Release is available. Release installation will not fall back to a branch archive.'
    }
    $resolvedReleaseTag=[string]$releaseMeta.tag_name
    if($resolvedReleaseTag -notmatch '^v(\d+\.\d+\.\d+)$'){throw "GitHub Release metadata returned an invalid tag: $resolvedReleaseTag"}
    $resolvedReleaseVersion=$Matches[1]
    if($requestedReleaseTag -and $resolvedReleaseTag -ne $requestedReleaseTag){throw "Requested $requestedReleaseTag but GitHub Release metadata resolved $resolvedReleaseTag; refusing mismatched Release identity."}
    try {$releaseCommit=Invoke-RestMethod -UseBasicParsing -Headers $apiHeaders "https://api.github.com/repos/$Repo/commits/$resolvedReleaseTag"} catch {throw "Unable to resolve commit identity for Release $resolvedReleaseTag."}
    $releaseExpectedSha=([string]$releaseCommit.sha).ToLowerInvariant()
    if($releaseExpectedSha -notmatch '^[0-9a-f]{40}$'){throw "Release $resolvedReleaseTag did not resolve to a valid commit SHA."}
    $releaseTag=$resolvedReleaseTag; $releaseVersion=$resolvedReleaseVersion
    $releaseBase="https://github.com/$Repo/releases/download/$releaseTag"
    $releaseLabel="Release $releaseTag"
    $sumFile=Join-Path $tmp 'SHA256SUMS'
    try {Invoke-WebRequest -UseBasicParsing "$releaseBase/SHA256SUMS" -OutFile $sumFile} catch {throw "$releaseLabel is missing SHA256SUMS; refusing an unverified installation."}

    $manifestFile=Join-Path $tmp 'manifest.json'
    $manifestDownloaded=$false
    try {Invoke-WebRequest -UseBasicParsing "$releaseBase/manifest.json" -OutFile $manifestFile; $manifestDownloaded=$true} catch {}
    $root=Join-Path $tmp 'release'
    if($manifestDownloaded){
      Verify-PackageChecksum $manifestFile $sumFile 'manifest.json'
      try {$manifest=Get-Content $manifestFile -Raw | ConvertFrom-Json} catch {throw "$releaseLabel contains an invalid manifest.json."}
      if([string]$manifest.rootFolder -ne 'weig-qb-webui' -or [string]$manifest.zipArchive -ne 'weig-qb-webui.zip'){throw "$releaseLabel contains an unsupported distribution manifest."}
      $archiveName=[string]$manifest.zipArchive
      $archive=Join-Path $tmp $archiveName
      try {Invoke-WebRequest -UseBasicParsing "$releaseBase/$archiveName" -OutFile $archive} catch {throw "$releaseLabel is missing canonical archive $archiveName."}
      Verify-PackageChecksum $archive $sumFile $archiveName
      Expand-Archive $archive $root -Force
      $web=Join-Path $root ([string]$manifest.rootFolder)
    } else {
      $archiveName='WeiG-qB-WebUI.zip'
      $archive=Join-Path $tmp $archiveName
      try {Invoke-WebRequest -UseBasicParsing "$releaseBase/$archiveName" -OutFile $archive} catch {throw "$releaseLabel has neither the canonical manifest artifact set nor legacy $archiveName."}
      Verify-PackageChecksum $archive $sumFile $archiveName
      Expand-Archive $archive $root -Force
      $web=Join-Path $root 'WeiG-qB-WebUI'
    }

    $shaFile=Join-Path $web 'GIT_SHA'
    if(!(Test-Path $shaFile)){throw "$releaseLabel does not contain GIT_SHA; refusing an unversioned asset deployment."}
    $sourceSha=(Get-Content $shaFile -Raw).Trim().ToLowerInvariant()
    if($sourceSha -notmatch '^[0-9a-f]{40}$'){throw "$releaseLabel contains an invalid GIT_SHA."}
    $versionFile=Join-Path $web 'VERSION'
    if(!(Test-Path $versionFile)){throw "$releaseLabel does not contain VERSION; refusing an unversioned asset deployment."}
    $packageVersion=(Get-Content $versionFile -Raw).Trim()
    if($packageVersion -ne $releaseVersion){throw "$releaseLabel maps to VERSION=$releaseVersion but the package reports VERSION=$packageVersion; refusing mismatched Release content."}
    if($sourceSha -ne $releaseExpectedSha){throw "$releaseLabel points to Git SHA $releaseExpectedSha but the package reports GIT_SHA=$sourceSha; refusing mismatched Release content."}
    Write-Host "Source: $releaseLabel at $releaseExpectedSha ($archiveName; checksum and Release identity verified)"
  } else {
    try {$commit=Invoke-RestMethod -UseBasicParsing -Headers @{'User-Agent'='WeiG-qB-WebUI-installer'} "https://api.github.com/repos/$Repo/commits/dev"} catch {throw 'Unable to resolve the current dev commit.'}
    $devHeadSha=([string]$commit.sha).ToLowerInvariant()
    if($devHeadSha -notmatch '^[0-9a-f]{40}$'){throw 'GitHub did not return a valid dev commit SHA.'}
    $publishedShaFile=Join-Path $tmp 'DEV_GIT_SHA'
    try {Invoke-WebRequest -UseBasicParsing "$DevDistBase/GIT_SHA" -OutFile $publishedShaFile} catch {throw 'The materialized dev WebUI payload is not published yet. Wait for Virtual qB Pages to finish and retry.'}
    $publishedSha=(Get-Content $publishedShaFile -Raw).Trim().ToLowerInvariant()
    if($publishedSha -notmatch '^[0-9a-f]{40}$'){throw 'The materialized dev payload does not publish a valid GIT_SHA.'}
    $sourceSha=$publishedSha
    if($publishedSha -ne $devHeadSha){
      if(Test-DevPayloadCanRepresentHead $publishedSha $devHeadSha){Write-Host "Current dev HEAD $devHeadSha differs from materialized SHA $publishedSha only by Pages-irrelevant changes; reusing the verified payload."}
      else {throw "The materialized dev payload is still at $publishedSha while dev is $devHeadSha, and at least one Pages-relevant change is not published. Wait for the exact Pages build and retry; refusing raw-source fallback."}
    }
    $manifestFile=Join-Path $tmp 'manifest.json'
    $sumFile=Join-Path $tmp 'SHA256SUMS'
    try {
      Invoke-WebRequest -UseBasicParsing "$DevDistBase/manifest.json" -OutFile $manifestFile
      Invoke-WebRequest -UseBasicParsing "$DevDistBase/SHA256SUMS" -OutFile $sumFile
    } catch {throw "Unable to download the canonical materialized dev manifest for exact SHA $sourceSha."}
    Verify-PackageChecksum $manifestFile $sumFile 'manifest.json'
    try {$manifest=Get-Content $manifestFile -Raw | ConvertFrom-Json} catch {throw 'Materialized dev manifest.json is invalid.'}
    if([string]$manifest.rootFolder -ne 'weig-qb-webui' -or [string]$manifest.zipArchive -ne 'weig-qb-webui.zip'){throw 'Materialized dev distribution manifest is unsupported.'}
    $archiveName=[string]$manifest.zipArchive
    $archive=Join-Path $tmp $archiveName
    try {Invoke-WebRequest -UseBasicParsing "$DevDistBase/$archiveName" -OutFile $archive} catch {throw "Unable to download the materialized dev archive $archiveName for exact SHA $sourceSha."}
    Verify-PackageChecksum $archive $sumFile $archiveName
    $root=Join-Path $tmp 'dev'
    Expand-Archive $archive $root -Force
    $web=Join-Path $root ([string]$manifest.rootFolder)
    $packageSha=(Get-Content (Join-Path $web 'GIT_SHA') -Raw).Trim().ToLowerInvariant()
    if($packageSha -ne $sourceSha){throw "Dev package Git SHA $packageSha does not match materialized dev SHA $sourceSha."}
    Assert-MaterializedWebUI $web
    if($sourceSha -eq $devHeadSha){Write-Host "Source: dev exact SHA $sourceSha ($archiveName; materialized Pages payload; checksum verified)"}
    else {Write-Host "Source: dev materialized SHA $sourceSha for current HEAD $devHeadSha ($archiveName; only Pages-irrelevant changes are newer; checksum verified)"}
  }
  if(!$web -or !(Test-Path $web)){ throw 'WebUI payload not found.' }
  if(!(Test-Path (Join-Path $web 'public\index.html')) -or !(Test-Path (Join-Path $web 'public\login.html')) -or !(Test-Path (Join-Path $web 'private\index.html'))){ throw 'Source package is not a valid qBittorrent Alternate WebUI.' }

  $new="$Destination.new"
  if(Test-Path $new){Remove-Item $new -Recurse -Force}
  New-Item -ItemType Directory -Force -Path $new | Out-Null
  Copy-Item (Join-Path $web '*') $new -Recurse -Force
  Inject-BuildSha $new $sourceSha
  if($Channel -eq 'Dev'){ Assert-MaterializedWebUI $new }
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
  $meta | ConvertTo-Json | Set-Content -Path (Join-Path $new 'private\weig-install.json') -Encoding UTF8

  Move-OutOfInstallTarget $Destination
  try {
    Install-WebUiStage $new $Destination
  } catch {
    $deploymentFailure=$_.Exception
    try {
      Restore-WebUiBackup $deploymentBackup $Destination
    } catch {
      throw "Live WebUI deployment failed and automatic file rollback also failed. Deployment error: $($deploymentFailure.Message) Rollback error: $($_.Exception.Message)"
    }
    throw $deploymentFailure
  }

  Write-Host "Installed: $Destination"
  Write-Host "Channel: $($Channel.ToLowerInvariant())"
  Write-Host "Installed version: $version"
  Write-Host "Installed Git SHA: $sourceSha"
  Write-Host "Install metadata: $(Join-Path $Destination 'private\weig-install.json')"

  if($Configure){
    Configure-QBWebUI $cfg $Destination
    Write-Host "Configured: $cfg"
    Write-Host "qBittorrent Root Folder: $Destination"
  } else {
    Write-Host 'qBittorrent -> Tools -> Preferences -> Web UI -> Use alternative WebUI'
    Write-Host "WebUI Root Folder: $Destination"
  }
  Write-Host 'Rollback: powershell -ExecutionPolicy Bypass -File .\install.ps1 -rollback'
} finally {
  if(Test-Path $tmp){Remove-Item $tmp -Recurse -Force}
}
