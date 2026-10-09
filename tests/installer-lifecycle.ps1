$ErrorActionPreference='Stop'

$Root=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$Tmp=Join-Path ([IO.Path]::GetTempPath()) ('weigg-installer-lifecycle-'+[guid]::NewGuid().ToString('N'))
$Fixtures=Join-Path $Tmp 'releases'
$HomeDir=Join-Path $Tmp 'home'
$Destination=Join-Path $Tmp 'install\weig-qb-webui'
$VersionOne='9.9.90'
$VersionTwo='9.9.91'
$ShaOne='1111111111111111111111111111111111111111'
$ShaTwo='2222222222222222222222222222222222222222'
$Utf8NoBom=New-Object System.Text.UTF8Encoding($false)

function Assert-True([bool]$Condition,[string]$Message){
  if(!$Condition){throw $Message}
}

function Write-Utf8NoBom([string]$Path,[string]$Text){
  [IO.File]::WriteAllText($Path,$Text,$Utf8NoBom)
}

try {
  New-Item -ItemType Directory -Force -Path $Fixtures,$HomeDir | Out-Null
  $env:APPDATA=Join-Path $HomeDir 'AppData\Roaming'
  $env:LOCALAPPDATA=Join-Path $HomeDir 'AppData\Local'
  $env:USERPROFILE=$HomeDir
  $env:ProgramData=Join-Path $Tmp 'ProgramData'
  $env:WEIGG_INSTALLER_FIXTURE_ROOT=$Fixtures
  New-Item -ItemType Directory -Force -Path $env:APPDATA,$env:LOCALAPPDATA,$env:ProgramData | Out-Null

  $Cfg=Join-Path $env:APPDATA 'qBittorrent\qBittorrent.ini'
  New-Item -ItemType Directory -Force -Path (Split-Path $Cfg -Parent) | Out-Null
  Write-Utf8NoBom $Cfg "[Preferences]`r`nWebUI\AlternativeUIEnabled=false`r`nWebUI\RootFolder=C:\original\webui`r`nLifecycle\Marker=preserve-me`r`n"

  $Base=Join-Path $Tmp 'base\WeiG-qB-WebUI'
  New-Item -ItemType Directory -Force -Path $Base | Out-Null
  Copy-Item (Join-Path $Root 'webui\*') $Base -Recurse -Force
  $CompactRuntime=@('capabilities.json','detail-compat.json','settings-compat.json','torrent-compat.json','source-actions.json','rss-compat.json')
  $WeiGLocaleOverlays=@('de','es','fr','ja','ko','pt','ru','zh-CN','zh-HK','zh-TW')
  foreach($name in $CompactRuntime){
    $file=Join-Path $Base ('private\data\'+$name)
    Assert-True ((Test-Path -LiteralPath $file -PathType Leaf) -and (Get-Item -LiteralPath $file).Length -gt 0) "Missing current compact runtime fixture: $name"
  }
  Assert-True (!(Test-Path -LiteralPath (Join-Path $Base 'private\data\qb-releases.json'))) 'Retired qb-releases.json must not be recreated for lifecycle fixtures.'
  foreach($dir in @('qb-copy-routes','qb-copy-bindings','qb-copy-fallback')){Assert-True (Test-Path -LiteralPath (Join-Path $Base ('private\data\'+$dir)) -PathType Container) "Missing current qB copy shard fixture: $dir"}
  $baseWeiGLocaleDir=Join-Path $Base 'private\data\weig-i18n';Assert-True (Test-Path -LiteralPath $baseWeiGLocaleDir -PathType Container) 'Missing current WeiG locale shard fixture directory.';Assert-True (@(Get-ChildItem $baseWeiGLocaleDir -Filter '*.json' -File).Count -eq $WeiGLocaleOverlays.Count) 'Current WeiG locale shard fixture count mismatch.';foreach($locale in $WeiGLocaleOverlays){Assert-True (Test-Path -LiteralPath (Join-Path $baseWeiGLocaleDir ($locale+'.json')) -PathType Leaf) "Missing current WeiG locale shard fixture: $locale"}
  Assert-True (!(Test-Path -LiteralPath (Join-Path $Base 'private\data\qb-settings-native.txt'))) 'Retired all-version qB copy registry must stay absent.'

  function Build-Release([string]$Version,[string]$SourceSha,[string]$Marker){
    $work=Join-Path $Tmp "build-$Version"
    $web=Join-Path $work 'WeiG-qB-WebUI'
    $out=Join-Path $Fixtures "v$Version"
    New-Item -ItemType Directory -Force -Path $web,$out | Out-Null
    Copy-Item (Join-Path $Base '*') $web -Recurse -Force
    Write-Utf8NoBom (Join-Path $web 'VERSION') ($Version+"`n")
    Write-Utf8NoBom (Join-Path $web 'GIT_SHA') ($SourceSha+"`n")
    Write-Utf8NoBom (Join-Path $web 'private\lifecycle-marker.txt') ($Marker+"`n")

    Get-ChildItem $web -Recurse -File | Where-Object { $_.Extension -in @('.html','.js','.css','.json') -or $_.Name -eq 'GIT_SHA' } | ForEach-Object {
      $text=[IO.File]::ReadAllText($_.FullName)
      if($text.Contains('__WEIGG_GIT_SHA__')){
        [IO.File]::WriteAllText($_.FullName,$text.Replace('__WEIGG_GIT_SHA__',$SourceSha),$Utf8NoBom)
      }
    }

    $zip=Join-Path $out 'WeiG-qB-WebUI.zip'
    Compress-Archive -Path $web -DestinationPath $zip -CompressionLevel Optimal -Force
    $hash=(Get-FileHash $zip -Algorithm SHA256).Hash.ToLowerInvariant()
    Write-Utf8NoBom (Join-Path $out 'SHA256SUMS') ("$hash  WeiG-qB-WebUI.zip`n")
  }

  Build-Release $VersionOne $ShaOne 'release-one'
  Build-Release $VersionTwo $ShaTwo 'release-two'

  function Invoke-RestMethod {
    [CmdletBinding()]
    param(
      [switch]$UseBasicParsing,
      [hashtable]$Headers,
      [Parameter(Position=0,Mandatory=$true)][string]$Uri
    )
    switch -Regex ($Uri) {
      '/releases/tags/v9\.9\.90$' { return [pscustomobject]@{tag_name='v9.9.90'} }
      '/commits/v9\.9\.90$' { return [pscustomobject]@{sha=$ShaOne} }
      '/releases/tags/v9\.9\.91$' { return [pscustomobject]@{tag_name='v9.9.91'} }
      '/commits/v9\.9\.91$' { return [pscustomobject]@{sha=$ShaTwo} }
      default { throw "mock Invoke-RestMethod: unexpected URL: $Uri" }
    }
  }

  function Invoke-WebRequest {
    [CmdletBinding()]
    param(
      [switch]$UseBasicParsing,
      [Parameter(Position=0,Mandatory=$true)][string]$Uri,
      [Parameter(Mandatory=$true)][string]$OutFile
    )
    $relative=$null
    switch -Regex ($Uri) {
      '/releases/download/v9\.9\.90/WeiG-qB-WebUI\.zip$' { $relative='v9.9.90\WeiG-qB-WebUI.zip'; break }
      '/releases/download/v9\.9\.90/SHA256SUMS$' { $relative='v9.9.90\SHA256SUMS'; break }
      '/releases/download/v9\.9\.91/WeiG-qB-WebUI\.zip$' { $relative='v9.9.91\WeiG-qB-WebUI.zip'; break }
      '/releases/download/v9\.9\.91/SHA256SUMS$' { $relative='v9.9.91\SHA256SUMS'; break }
      default { throw "mock Invoke-WebRequest: unexpected URL: $Uri" }
    }
    Copy-Item (Join-Path $env:WEIGG_INSTALLER_FIXTURE_ROOT $relative) $OutFile -Force
    [pscustomobject]@{StatusCode=200}
  }

  $Installer=Join-Path $Root 'installers\install.ps1'
  $State=Join-Path $env:APPDATA 'weig-qb-webui'
  $LegacyState=Join-Path $env:APPDATA 'WeiG_qB-WebUI'

  function Assert-Install([string]$ExpectedVersion,[string]$ExpectedSha,[string]$ExpectedMarker){
    Assert-True (Test-Path (Join-Path $Destination 'public\index.html')) 'public/index.html missing after install.'
    Assert-True (Test-Path (Join-Path $Destination 'public\login.html')) 'public/login.html missing after install.'
    Assert-True (Test-Path (Join-Path $Destination 'private\index.html')) 'private/index.html missing after install.'
    Assert-True (((Get-Content (Join-Path $Destination 'VERSION') -Raw).Trim()) -eq $ExpectedVersion) 'Installed VERSION mismatch.'
    Assert-True (((Get-Content (Join-Path $Destination 'GIT_SHA') -Raw).Trim()) -eq $ExpectedSha) 'Installed GIT_SHA mismatch.'
    Assert-True (((Get-Content (Join-Path $Destination 'private\lifecycle-marker.txt') -Raw).Trim()) -eq $ExpectedMarker) 'Installed lifecycle marker mismatch.'

    $cfgText=Get-Content $Cfg -Raw
    Assert-True ($cfgText.Contains('Lifecycle\Marker=preserve-me')) 'Unrelated qB config marker was not preserved.'

    $meta=Get-Content (Join-Path $Destination 'private\weig-install.json') -Raw | ConvertFrom-Json
    Assert-True ($meta.version -eq $ExpectedVersion) 'Install metadata version mismatch.'
    Assert-True ($meta.gitSha -eq $ExpectedSha) 'Install metadata gitSha mismatch.'
    Assert-True ($meta.channel -eq 'release') 'Install metadata channel mismatch.'
    Assert-True ($meta.installer -eq 'windows') 'Install metadata installer mismatch.'
    Assert-True ($meta.hostPath -eq $Destination -and $meta.qbPath -eq $Destination) 'Install metadata paths mismatch.'

    foreach($name in $CompactRuntime){
      $file=Join-Path $Destination ('private\data\'+$name)
      Assert-True ((Test-Path -LiteralPath $file -PathType Leaf) -and (Get-Item -LiteralPath $file).Length -gt 0) "Installed compact runtime missing: $name"
    }
    Assert-True (!(Test-Path -LiteralPath (Join-Path $Destination 'private\data\qb-releases.json'))) 'Retired qb-releases.json reappeared after install.'
    foreach($dir in @('qb-copy-routes','qb-copy-bindings','qb-copy-fallback')){Assert-True (Test-Path -LiteralPath (Join-Path $Destination ('private\data\'+$dir)) -PathType Container) "Installed qB copy shard directory missing: $dir"}
    $installedWeiGLocaleDir=Join-Path $Destination 'private\data\weig-i18n';Assert-True (Test-Path -LiteralPath $installedWeiGLocaleDir -PathType Container) 'Installed WeiG locale shard directory missing.';Assert-True (@(Get-ChildItem $installedWeiGLocaleDir -Filter '*.json' -File).Count -eq $WeiGLocaleOverlays.Count) 'Installed WeiG locale shard count mismatch.';foreach($locale in $WeiGLocaleOverlays){$file=Join-Path $installedWeiGLocaleDir ($locale+'.json');Assert-True ((Test-Path -LiteralPath $file -PathType Leaf) -and (Get-Item -LiteralPath $file).Length -gt 0) "Installed WeiG locale shard missing: $locale"}
    Assert-True (!(Test-Path -LiteralPath (Join-Path $Destination 'private\data\qb-settings-native.txt'))) 'Retired all-version qB copy registry reappeared after install.'
  }

  function Assert-ConfigEnabled {
    $cfgText=Get-Content $Cfg -Raw
    Assert-True ($cfgText.Contains('WebUI\AlternativeUIEnabled=true')) 'qB AlternativeUIEnabled was not configured.'
    Assert-True ($cfgText.Contains("WebUI\RootFolder=$Destination")) 'qB RootFolder was not configured to isolated destination.'
    Assert-True ($cfgText.Contains('Lifecycle\Marker=preserve-me')) 'Unrelated qB config marker was not preserved.'
  }

  function Get-BackupRecordText([string]$Backup,[string]$Name) {
    Add-Type -AssemblyName System.IO.Compression.FileSystem -ErrorAction SilentlyContinue
    $zip=[IO.Compression.ZipFile]::OpenRead($Backup)
    try {
      $entry=$zip.GetEntry($Name)
      if($null -eq $entry){return $null}
      $reader=[IO.StreamReader]::new($entry.Open())
      try {return $reader.ReadToEnd().Trim()} finally {$reader.Dispose()}
    } finally {$zip.Dispose()}
  }

  function Assert-ArchiveBackup([string]$Backup,[string]$ExpectedVersion='') {
    Assert-True (Test-Path -LiteralPath $Backup -PathType Leaf) 'Current Windows backup must be one ZIP file.'
    Assert-True ([IO.Path]::GetExtension($Backup).ToLowerInvariant() -eq '.zip') 'Current Windows backup extension mismatch.'
    Assert-True ((Split-Path $Backup -Leaf) -match '^\d{8}-\d{4}(?:-\d{2})?\.zip$') 'Current Windows backup filename must use minute timestamp plus optional collision suffix.'
    $record=Join-Path $Tmp 'windows-backup-record-check'
    if(Test-Path -LiteralPath $record){Remove-Item -LiteralPath $record -Recurse -Force}
    New-Item -ItemType Directory -Path $record | Out-Null
    Add-Type -AssemblyName System.IO.Compression.FileSystem -ErrorAction SilentlyContinue
    [IO.Compression.ZipFile]::ExtractToDirectory($Backup,$record)
    $manifestPath=Join-Path $record 'archive-manifest'
    Assert-True (Test-Path -LiteralPath $manifestPath -PathType Leaf) 'Backup archive manifest is missing.'
    $manifest=@{}
    foreach($line in @(Get-Content -LiteralPath $manifestPath)){if($line -match '^([^=]+)=(.*)$'){$manifest[$Matches[1]]=$Matches[2]}}
    if(((Get-Content (Join-Path $record 'had-webui') -Raw).Trim()) -eq '1'){
      Assert-True ([string]$manifest['format'] -eq 'zip') "Windows CI inner payload should prefer built-in .NET zip; got $($manifest['format'])."
      Assert-True ([string]$manifest['file'] -eq 'webui.zip') 'Windows inner payload filename mismatch.'
      $archive=Join-Path $record ([string]$manifest['file'])
      Assert-True (Test-Path -LiteralPath $archive -PathType Leaf) 'Windows inner backup payload is missing.'
      $actual=(Get-FileHash -Algorithm SHA256 -LiteralPath $archive).Hash.ToLowerInvariant()
      Assert-True ($actual -eq ([string]$manifest['sha256']).ToLowerInvariant()) 'Windows inner payload SHA-256 mismatch.'
      if($ExpectedVersion){
        $zip=[IO.Compression.ZipFile]::OpenRead($archive)
        try {
          $entry=$zip.GetEntry('VERSION')
          Assert-True ($null -ne $entry) 'Windows backup payload VERSION entry is missing.'
          $reader=[IO.StreamReader]::new($entry.Open())
          try {$value=$reader.ReadToEnd().Trim()} finally {$reader.Dispose()}
          Assert-True ($value -eq $ExpectedVersion) "Windows backup payload VERSION mismatch: $value."
        } finally {$zip.Dispose()}
      }
    }
  }

  & $Installer -Version $VersionOne -Configure -o $Destination
  Assert-Install $VersionOne $ShaOne 'release-one'
  Assert-ConfigEnabled
  $FirstBackup=(Get-Content (Join-Path $State 'last-backup') -Raw).Trim()
  Assert-True ((Get-BackupRecordText $FirstBackup 'had-webui') -eq '0') 'First backup should record no previous WebUI.'
  $firstCfg=Get-BackupRecordText $FirstBackup 'qBittorrent.conf'
  Assert-True ($firstCfg.Contains('WebUI\AlternativeUIEnabled=false')) 'First backup lost original AlternativeUIEnabled.'
  Assert-True ($firstCfg.Contains('WebUI\RootFolder=C:\original\webui')) 'First backup lost original RootFolder.'

  $cfgBeforePlainUpdate=(Get-FileHash -Algorithm SHA256 -LiteralPath $Cfg).Hash
  Start-Sleep -Milliseconds 1100
  & $Installer -Version $VersionTwo -o $Destination
  Assert-Install $VersionTwo $ShaTwo 'release-two'
  Assert-ConfigEnabled
  $cfgAfterPlainUpdate=(Get-FileHash -Algorithm SHA256 -LiteralPath $Cfg).Hash
  Assert-True ($cfgAfterPlainUpdate -eq $cfgBeforePlainUpdate) 'Plain update changed qBittorrent config bytes.'
  $SecondBackup=(Get-Content (Join-Path $State 'last-backup') -Raw).Trim()
  Assert-True ($SecondBackup -ne $FirstBackup) 'Upgrade backup reused the initial backup directory.'
  Assert-True ((Get-BackupRecordText $SecondBackup 'had-webui') -eq '1') 'Upgrade backup should record previous WebUI.'
  Assert-ArchiveBackup $SecondBackup $VersionOne
  Assert-True ($null -eq (Get-BackupRecordText $SecondBackup 'qBittorrent.conf')) 'Plain update unexpectedly captured qBittorrent config.'
  Assert-True ($null -eq (Get-BackupRecordText $SecondBackup 'config-path')) 'Plain update unexpectedly published a qBittorrent config path.'

  $mutated=(Get-Content $Cfg -Raw).Replace('WebUI\AlternativeUIEnabled=true','WebUI\AlternativeUIEnabled=false').Replace("WebUI\RootFolder=$Destination",'WebUI\RootFolder=C:\post-upgrade-mutated')
  Write-Utf8NoBom $Cfg $mutated
  $cfgBeforePlainRollback=(Get-FileHash -Algorithm SHA256 -LiteralPath $Cfg).Hash

  $legacySecondBackup=Join-Path (Join-Path $LegacyState 'backups') (Split-Path $SecondBackup -Leaf)
  if(Test-Path -LiteralPath $LegacyState){Remove-Item -LiteralPath $LegacyState -Recurse -Force}
  Move-Item -LiteralPath $State -Destination $LegacyState
  Set-Content -Encoding UTF8 -LiteralPath (Join-Path $LegacyState 'last-backup') -Value $legacySecondBackup
  Assert-True (!(Test-Path -LiteralPath $State)) 'Canonical state root should be absent before legacy-state rollback probe.'

  $pwsh=Join-Path $PSHOME 'pwsh.exe'
  foreach($retired in @('-Channel','-Mode','-Destination')){
    $accepted=$false
    try {
      & $pwsh -NoLogo -NoProfile -ExecutionPolicy Bypass -File $Installer $retired 'old' -Help *> $null
      $accepted=($LASTEXITCODE -eq 0)
    } catch { $accepted=$false }
    Assert-True (!$accepted) "Retired PowerShell argument was accepted: $retired"
  }
  foreach($supported in @('-o','-output','-version','-dev','-qbconfig','-configure','-rollback','-uninstall','-purge','-help')){
    [string[]]$cliArgs=@($supported)
    if($supported -in @('-o','-output','-version','-qbconfig')){$cliArgs+= '1.2.0'}
    if($supported -ne '-help'){$cliArgs+= '-Help'}
    & $pwsh -NoLogo -NoProfile -ExecutionPolicy Bypass -File $Installer @cliArgs *> $null
    Assert-True ($LASTEXITCODE -eq 0) "Current PowerShell argument was rejected: $supported"
  }
  & $pwsh -NoLogo -NoProfile -ExecutionPolicy Bypass -File $Installer -Rollback
  Assert-True (Test-Path -LiteralPath (Join-Path $State 'backups') -PathType Container) 'Rollback should recreate the canonical state root while reading historical state.'
  if($LASTEXITCODE -ne 0){throw "Rollback subprocess failed with exit code $LASTEXITCODE."}
  Assert-Install $VersionOne $ShaOne 'release-one'
  $cfgAfterPlainRollback=(Get-FileHash -Algorithm SHA256 -LiteralPath $Cfg).Hash
  Assert-True ($cfgAfterPlainRollback -eq $cfgBeforePlainRollback) 'Plain rollback changed qBittorrent config bytes.'
  $plainRollbackCfg=Get-Content $Cfg -Raw
  Assert-True ($plainRollbackCfg.Contains('WebUI\AlternativeUIEnabled=false')) 'Plain rollback did not preserve the user AlternativeUIEnabled state.'
  Assert-True ($plainRollbackCfg.Contains('WebUI\RootFolder=C:\post-upgrade-mutated')) 'Plain rollback did not preserve the user RootFolder.'

  Start-Sleep -Milliseconds 1100
  & $Installer -Version $VersionTwo -Configure -o $Destination
  Assert-Install $VersionTwo $ShaTwo 'release-two'
  Assert-ConfigEnabled
  $ConfiguredBackup=(Get-Content (Join-Path $State 'last-backup') -Raw).Trim()
  Assert-ArchiveBackup $ConfiguredBackup $VersionOne
  $configuredSnapshot=Get-BackupRecordText $ConfiguredBackup 'qBittorrent.conf'
  Assert-True ($configuredSnapshot.Contains('WebUI\AlternativeUIEnabled=false')) 'Explicit configure backup lost the previous AlternativeUIEnabled state.'
  Assert-True ($configuredSnapshot.Contains('WebUI\RootFolder=C:\post-upgrade-mutated')) 'Explicit configure backup lost the previous RootFolder.'

  & $pwsh -NoLogo -NoProfile -ExecutionPolicy Bypass -File $Installer -Rollback -Configure
  if($LASTEXITCODE -ne 0){throw "Explicit config rollback subprocess failed with exit code $LASTEXITCODE."}
  Assert-Install $VersionOne $ShaOne 'release-one'
  $explicitRollbackCfg=Get-Content $Cfg -Raw
  Assert-True ($explicitRollbackCfg.Contains('WebUI\AlternativeUIEnabled=false')) 'Explicit config rollback did not restore AlternativeUIEnabled.'
  Assert-True ($explicitRollbackCfg.Contains('WebUI\RootFolder=C:\post-upgrade-mutated')) 'Explicit config rollback did not restore RootFolder.'

  Start-Sleep -Milliseconds 1100
  & $Installer -Version $VersionOne -Configure -o $Destination
  Assert-Install $VersionOne $ShaOne 'release-one'
  Assert-ConfigEnabled
  Assert-True (((Get-Content (Join-Path $State 'last-dest') -Raw).Trim()) -eq $Destination) 'Remembered destination mismatch.'

  Start-Sleep -Milliseconds 1100
  & $pwsh -NoLogo -NoProfile -ExecutionPolicy Bypass -File $Installer -Uninstall -Configure -o $Destination
  if($LASTEXITCODE -ne 0){throw "Uninstall subprocess failed with exit code $LASTEXITCODE."}
  Assert-True (!(Test-Path -LiteralPath $Destination)) 'Uninstall did not remove the installer-owned WebUI directory.'
  $uninstallCfg=Get-Content $Cfg -Raw
  Assert-True ($uninstallCfg.Contains('WebUI\AlternativeUIEnabled=false')) 'Uninstall did not disable Alternative WebUI.'
  Assert-True ($uninstallCfg.Contains("WebUI\RootFolder=$Destination")) 'Uninstall unexpectedly rewrote the remembered RootFolder.'
  $UninstallBackup=(Get-Content (Join-Path $State 'last-backup') -Raw).Trim()
  Assert-True ((Get-BackupRecordText $UninstallBackup 'had-webui') -eq '1') 'Uninstall backup did not preserve the removed WebUI.'
  Assert-ArchiveBackup $UninstallBackup $VersionOne

  & $pwsh -NoLogo -NoProfile -ExecutionPolicy Bypass -File $Installer -Rollback -Configure
  if($LASTEXITCODE -ne 0){throw "Post-uninstall rollback subprocess failed with exit code $LASTEXITCODE."}
  Assert-Install $VersionOne $ShaOne 'release-one'
  Assert-ConfigEnabled

  Start-Sleep -Milliseconds 1100
  & $pwsh -NoLogo -NoProfile -ExecutionPolicy Bypass -File $Installer -Uninstall -Configure -Purge -o $Destination
  if($LASTEXITCODE -ne 0){throw "Purge uninstall subprocess failed with exit code $LASTEXITCODE."}
  Assert-True (!(Test-Path -LiteralPath $Destination)) 'Purge uninstall did not remove the installer-owned WebUI directory.'
  foreach($stateRoot in @($State,$LegacyState)){
    Assert-True (!(Test-Path -LiteralPath (Join-Path $stateRoot 'last-backup'))) "Purge uninstall left last-backup behind in $stateRoot."
    Assert-True (!(Test-Path -LiteralPath (Join-Path $stateRoot 'last-dest'))) "Purge uninstall left last-dest behind in $stateRoot."
  }
  $remaining=@()
  foreach($stateRoot in @($State,$LegacyState)){
    $backupRoot=Join-Path $stateRoot 'backups'
    if(Test-Path -LiteralPath $backupRoot -PathType Container){$remaining += @(Get-ChildItem -LiteralPath $backupRoot -Force -ErrorAction SilentlyContinue)}
  }
  Assert-True ($remaining.Count -eq 0) 'Purge uninstall left installer-owned backups for the selected destination.'
  & $pwsh -NoLogo -NoProfile -ExecutionPolicy Bypass -File $Installer -Rollback
  $purgeRollbackExit=$LASTEXITCODE
  Assert-True ($purgeRollbackExit -ne 0) 'Rollback unexpectedly succeeded after target backup purge.'
  $global:LASTEXITCODE=0
  & $Installer -Version $VersionOne -Configure -o $Destination
  Assert-Install $VersionOne $ShaOne 'release-one'
  Assert-ConfigEnabled

  $disabledCfg=(Get-Content $Cfg -Raw).Replace('WebUI\AlternativeUIEnabled=true','WebUI\AlternativeUIEnabled=false').Replace("WebUI\RootFolder=$Destination",'WebUI\RootFolder=C:\disabled-user-root')
  Write-Utf8NoBom $Cfg $disabledCfg
  $disabledCfgBeforePlainUpdate=(Get-FileHash -Algorithm SHA256 -LiteralPath $Cfg).Hash
  Start-Sleep -Milliseconds 1100
  & $Installer -Version $VersionTwo -o $Destination
  Assert-Install $VersionTwo $ShaTwo 'release-two'
  $disabledCfgAfterPlainUpdate=(Get-FileHash -Algorithm SHA256 -LiteralPath $Cfg).Hash
  Assert-True ($disabledCfgAfterPlainUpdate -eq $disabledCfgBeforePlainUpdate) 'Plain update changed a disabled user qBittorrent config.'
  $disabledCfgAfter=Get-Content $Cfg -Raw
  Assert-True ($disabledCfgAfter.Contains('WebUI\AlternativeUIEnabled=false')) 'Plain update unexpectedly enabled Alternative WebUI for a disabled user.'
  Assert-True ($disabledCfgAfter.Contains('WebUI\RootFolder=C:\disabled-user-root')) 'Plain update unexpectedly rewrote a disabled user RootFolder.'

  $artifactDir=Join-Path $Root 'artifacts\install-lifecycle'
  New-Item -ItemType Directory -Force -Path $artifactDir | Out-Null
  $repoSha=$env:GITHUB_SHA
  if(!$repoSha){$repoSha=(& git -C $Root rev-parse HEAD).Trim()}
  $compactBytes=0
  foreach($name in $CompactRuntime){$compactBytes+=(Get-Item -LiteralPath (Join-Path $Destination ('private\data\'+$name))).Length}
  $meta=Get-Content (Join-Path $Destination 'private\weig-install.json') -Raw | ConvertFrom-Json
  $evidence=[ordered]@{
    schemaVersion=1
    kind='isolated-windows-installer-lifecycle'
    gitSha=$repoSha
    target='REDACTED'
    fixture=[ordered]@{
      versions=@($VersionOne,$VersionTwo)
      sourceShas=@($ShaOne,$ShaTwo)
    }
    checks=[ordered]@{
      initialInstall=$true
      releaseChecksum=$true
      packedCatalog=$true
      installMetadata=$true
      qbConfigWrite=$true
      upgradeBackup=$true
      upgrade=$true
      plainUpdatePreservesEnabledConfig=$true
      plainUpdatePreservesDisabledConfig=$true
      rollbackWebui=$true
      rollbackQbConfig=$true
      uninstall=$true
      uninstallConfigDisable=$true
      uninstallRollback=$true
      uninstallPurge=$true
      purgeClearsRollbackState=$true
      rollbackUnavailableAfterPurge=$true
    }
    rollbackState=[ordered]@{
      version=$meta.version
      gitSha=$meta.gitSha
      compactRuntimeFiles=$CompactRuntime.Count
      compactRuntimeBytes=$compactBytes
    }
  }
  Write-Utf8NoBom (Join-Path $artifactDir 'windows.json') (($evidence | ConvertTo-Json -Depth 8)+"`n")

  Write-Host "Windows installer lifecycle passed: install $VersionOne -> upgrade $VersionTwo -> rollback $VersionOne -> uninstall -> rollback -> purge uninstall -> clean reinstall -> disabled-state plain update"
}
finally {
  Remove-Item Env:WEIGG_INSTALLER_FIXTURE_ROOT -ErrorAction SilentlyContinue
  if(Test-Path $Tmp){Remove-Item $Tmp -Recurse -Force -ErrorAction SilentlyContinue}
}
