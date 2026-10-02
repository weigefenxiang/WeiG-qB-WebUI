$ErrorActionPreference='Stop'

$Root=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$Tmp=Join-Path ([IO.Path]::GetTempPath()) ('weigg-installer-lifecycle-'+[guid]::NewGuid().ToString('N'))
$Fixtures=Join-Path $Tmp 'releases'
$HomeDir=Join-Path $Tmp 'home'
$Destination=Join-Path $Tmp 'install\weigg-qb-webui'
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
  $CompactRuntime=@('capabilities.json','detail-compat.json','settings-compat.json','torrent-compat.json','source-actions.json','rss-compat.json','qb-settings-native.txt')
  foreach($name in $CompactRuntime){
    $file=Join-Path $Base ('private\data\'+$name)
    Assert-True ((Test-Path -LiteralPath $file -PathType Leaf) -and (Get-Item -LiteralPath $file).Length -gt 0) "Missing current compact runtime fixture: $name"
  }
  Assert-True (!(Test-Path -LiteralPath (Join-Path $Base 'private\data\qb-releases.json'))) 'Retired qb-releases.json must not be recreated for lifecycle fixtures.'

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
  $State=Join-Path $env:APPDATA 'WeiG_qB-WebUI'

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
  }

  function Assert-ConfigEnabled {
    $cfgText=Get-Content $Cfg -Raw
    Assert-True ($cfgText.Contains('WebUI\AlternativeUIEnabled=true')) 'qB AlternativeUIEnabled was not configured.'
    Assert-True ($cfgText.Contains("WebUI\RootFolder=$Destination")) 'qB RootFolder was not configured to isolated destination.'
    Assert-True ($cfgText.Contains('Lifecycle\Marker=preserve-me')) 'Unrelated qB config marker was not preserved.'
  }

  function Assert-ArchiveBackup([string]$Backup,[string]$ExpectedVersion='') {
    $manifestPath=Join-Path $Backup 'archive-manifest'
    Assert-True (Test-Path -LiteralPath $manifestPath -PathType Leaf) 'Backup archive manifest is missing.'
    $manifest=@{}
    foreach($line in @(Get-Content -LiteralPath $manifestPath)){if($line -match '^([^=]+)=(.*)$'){$manifest[$Matches[1]]=$Matches[2]}}
    Assert-True ([string]$manifest['format'] -eq 'zip') "Windows CI backup should prefer built-in .NET zip; got $($manifest['format'])."
    Assert-True ([string]$manifest['file'] -eq 'webui.zip') 'Windows backup archive filename mismatch.'
    $archive=Join-Path $Backup ([string]$manifest['file'])
    Assert-True (Test-Path -LiteralPath $archive -PathType Leaf) 'Windows compressed backup archive is missing.'
    Assert-True (!(Test-Path -LiteralPath (Join-Path $Backup 'webui') -PathType Container)) 'New Windows backups must not retain an uncompressed webui directory when zip is available.'
    $actual=(Get-FileHash -Algorithm SHA256 -LiteralPath $archive).Hash.ToLowerInvariant()
    Assert-True ($actual -eq ([string]$manifest['sha256']).ToLowerInvariant()) 'Windows backup archive SHA-256 mismatch.'
    if($ExpectedVersion){
      Add-Type -AssemblyName System.IO.Compression.FileSystem -ErrorAction SilentlyContinue
      $zip=[IO.Compression.ZipFile]::OpenRead($archive)
      try {
        $entry=$zip.GetEntry('VERSION')
        Assert-True ($null -ne $entry) 'Windows backup archive VERSION entry is missing.'
        $reader=[IO.StreamReader]::new($entry.Open())
        try {$value=$reader.ReadToEnd().Trim()} finally {$reader.Dispose()}
        Assert-True ($value -eq $ExpectedVersion) "Windows backup archive VERSION mismatch: $value."
      } finally {$zip.Dispose()}
    }
  }

  & $Installer -Version $VersionOne -Configure -Destination $Destination
  Assert-Install $VersionOne $ShaOne 'release-one'
  Assert-ConfigEnabled
  $FirstBackup=(Get-Content (Join-Path $State 'last-backup') -Raw).Trim()
  Assert-True (((Get-Content (Join-Path $FirstBackup 'had-webui') -Raw).Trim()) -eq '0') 'First backup should record no previous WebUI.'
  $firstCfg=Get-Content (Join-Path $FirstBackup 'qBittorrent.conf') -Raw
  Assert-True ($firstCfg.Contains('WebUI\AlternativeUIEnabled=false')) 'First backup lost original AlternativeUIEnabled.'
  Assert-True ($firstCfg.Contains('WebUI\RootFolder=C:\original\webui')) 'First backup lost original RootFolder.'

  $cfgBeforePlainUpdate=(Get-FileHash -Algorithm SHA256 -LiteralPath $Cfg).Hash
  Start-Sleep -Milliseconds 1100
  & $Installer -Version $VersionTwo -Destination $Destination
  Assert-Install $VersionTwo $ShaTwo 'release-two'
  Assert-ConfigEnabled
  $cfgAfterPlainUpdate=(Get-FileHash -Algorithm SHA256 -LiteralPath $Cfg).Hash
  Assert-True ($cfgAfterPlainUpdate -eq $cfgBeforePlainUpdate) 'Plain update changed qBittorrent config bytes.'
  $SecondBackup=(Get-Content (Join-Path $State 'last-backup') -Raw).Trim()
  Assert-True ($SecondBackup -ne $FirstBackup) 'Upgrade backup reused the initial backup directory.'
  Assert-True (((Get-Content (Join-Path $SecondBackup 'had-webui') -Raw).Trim()) -eq '1') 'Upgrade backup should record previous WebUI.'
  Assert-ArchiveBackup $SecondBackup $VersionOne
  Assert-True (!(Test-Path -LiteralPath (Join-Path $SecondBackup 'qBittorrent.conf'))) 'Plain update unexpectedly captured qBittorrent config.'
  Assert-True (!(Test-Path -LiteralPath (Join-Path $SecondBackup 'config-path'))) 'Plain update unexpectedly published a qBittorrent config path.'

  $mutated=(Get-Content $Cfg -Raw).Replace('WebUI\AlternativeUIEnabled=true','WebUI\AlternativeUIEnabled=false').Replace("WebUI\RootFolder=$Destination",'WebUI\RootFolder=C:\post-upgrade-mutated')
  Write-Utf8NoBom $Cfg $mutated
  $cfgBeforePlainRollback=(Get-FileHash -Algorithm SHA256 -LiteralPath $Cfg).Hash

  $pwsh=Join-Path $PSHOME 'pwsh.exe'
  & $pwsh -NoLogo -NoProfile -ExecutionPolicy Bypass -File $Installer -Rollback
  if($LASTEXITCODE -ne 0){throw "Rollback subprocess failed with exit code $LASTEXITCODE."}
  Assert-Install $VersionOne $ShaOne 'release-one'
  $cfgAfterPlainRollback=(Get-FileHash -Algorithm SHA256 -LiteralPath $Cfg).Hash
  Assert-True ($cfgAfterPlainRollback -eq $cfgBeforePlainRollback) 'Plain rollback changed qBittorrent config bytes.'
  $plainRollbackCfg=Get-Content $Cfg -Raw
  Assert-True ($plainRollbackCfg.Contains('WebUI\AlternativeUIEnabled=false')) 'Plain rollback did not preserve the user AlternativeUIEnabled state.'
  Assert-True ($plainRollbackCfg.Contains('WebUI\RootFolder=C:\post-upgrade-mutated')) 'Plain rollback did not preserve the user RootFolder.'

  Start-Sleep -Milliseconds 1100
  & $Installer -Version $VersionTwo -Configure -Destination $Destination
  Assert-Install $VersionTwo $ShaTwo 'release-two'
  Assert-ConfigEnabled
  $ConfiguredBackup=(Get-Content (Join-Path $State 'last-backup') -Raw).Trim()
  Assert-ArchiveBackup $ConfiguredBackup $VersionOne
  $configuredSnapshot=Get-Content (Join-Path $ConfiguredBackup 'qBittorrent.conf') -Raw
  Assert-True ($configuredSnapshot.Contains('WebUI\AlternativeUIEnabled=false')) 'Explicit configure backup lost the previous AlternativeUIEnabled state.'
  Assert-True ($configuredSnapshot.Contains('WebUI\RootFolder=C:\post-upgrade-mutated')) 'Explicit configure backup lost the previous RootFolder.'

  & $pwsh -NoLogo -NoProfile -ExecutionPolicy Bypass -File $Installer -Rollback -Configure
  if($LASTEXITCODE -ne 0){throw "Explicit config rollback subprocess failed with exit code $LASTEXITCODE."}
  Assert-Install $VersionOne $ShaOne 'release-one'
  $explicitRollbackCfg=Get-Content $Cfg -Raw
  Assert-True ($explicitRollbackCfg.Contains('WebUI\AlternativeUIEnabled=false')) 'Explicit config rollback did not restore AlternativeUIEnabled.'
  Assert-True ($explicitRollbackCfg.Contains('WebUI\RootFolder=C:\post-upgrade-mutated')) 'Explicit config rollback did not restore RootFolder.'

  Start-Sleep -Milliseconds 1100
  & $Installer -Version $VersionOne -Configure -Destination $Destination
  Assert-Install $VersionOne $ShaOne 'release-one'
  Assert-ConfigEnabled
  Assert-True (((Get-Content (Join-Path $State 'last-dest') -Raw).Trim()) -eq $Destination) 'Remembered destination mismatch.'

  Start-Sleep -Milliseconds 1100
  & $pwsh -NoLogo -NoProfile -ExecutionPolicy Bypass -File $Installer -Uninstall -Configure -Destination $Destination
  if($LASTEXITCODE -ne 0){throw "Uninstall subprocess failed with exit code $LASTEXITCODE."}
  Assert-True (!(Test-Path -LiteralPath $Destination)) 'Uninstall did not remove the installer-owned WebUI directory.'
  $uninstallCfg=Get-Content $Cfg -Raw
  Assert-True ($uninstallCfg.Contains('WebUI\AlternativeUIEnabled=false')) 'Uninstall did not disable Alternative WebUI.'
  Assert-True ($uninstallCfg.Contains("WebUI\RootFolder=$Destination")) 'Uninstall unexpectedly rewrote the remembered RootFolder.'
  $UninstallBackup=(Get-Content (Join-Path $State 'last-backup') -Raw).Trim()
  Assert-True (((Get-Content (Join-Path $UninstallBackup 'had-webui') -Raw).Trim()) -eq '1') 'Uninstall backup did not preserve the removed WebUI.'
  Assert-ArchiveBackup $UninstallBackup $VersionOne

  & $pwsh -NoLogo -NoProfile -ExecutionPolicy Bypass -File $Installer -Rollback -Configure
  if($LASTEXITCODE -ne 0){throw "Post-uninstall rollback subprocess failed with exit code $LASTEXITCODE."}
  Assert-Install $VersionOne $ShaOne 'release-one'
  Assert-ConfigEnabled

  Start-Sleep -Milliseconds 1100
  & $pwsh -NoLogo -NoProfile -ExecutionPolicy Bypass -File $Installer -Uninstall -Configure -Purge -Destination $Destination
  if($LASTEXITCODE -ne 0){throw "Purge uninstall subprocess failed with exit code $LASTEXITCODE."}
  Assert-True (!(Test-Path -LiteralPath $Destination)) 'Purge uninstall did not remove the installer-owned WebUI directory.'
  Assert-True (!(Test-Path -LiteralPath (Join-Path $State 'last-backup'))) 'Purge uninstall left the last-backup pointer behind.'
  Assert-True (!(Test-Path -LiteralPath (Join-Path $State 'last-dest'))) 'Purge uninstall left the last-dest pointer behind.'
  $remaining=@(Get-ChildItem -LiteralPath (Join-Path $State 'backups') -Directory -ErrorAction SilentlyContinue | Where-Object {
    $marker=Join-Path $_.FullName 'dest-path'
    if(!(Test-Path -LiteralPath $marker -PathType Leaf)){return $false}
    ((Get-Content $marker -Raw).Trim()).Equals($Destination,[StringComparison]::OrdinalIgnoreCase)
  })
  Assert-True ($remaining.Count -eq 0) 'Purge uninstall left installer-owned backups for the selected destination.'
  & $pwsh -NoLogo -NoProfile -ExecutionPolicy Bypass -File $Installer -Rollback
  $purgeRollbackExit=$LASTEXITCODE
  Assert-True ($purgeRollbackExit -ne 0) 'Rollback unexpectedly succeeded after target backup purge.'
  $global:LASTEXITCODE=0
  & $Installer -Version $VersionOne -Configure -Destination $Destination
  Assert-Install $VersionOne $ShaOne 'release-one'

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

  Write-Host "Windows installer lifecycle passed: install $VersionOne -> upgrade $VersionTwo -> rollback $VersionOne -> uninstall -> rollback -> purge uninstall -> clean reinstall"
}
finally {
  Remove-Item Env:WEIGG_INSTALLER_FIXTURE_ROOT -ErrorAction SilentlyContinue
  if(Test-Path $Tmp){Remove-Item $Tmp -Recurse -Force -ErrorAction SilentlyContinue}
}
