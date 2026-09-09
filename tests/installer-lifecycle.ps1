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
  & node (Join-Path $Root 'tools\qb-webui-catalog.mjs') (Join-Path $Root 'tests\fixtures\qb-release-catalog.lkg.json') (Join-Path $Base 'private\data\qb-releases.json')
  if($LASTEXITCODE -ne 0){throw 'Failed to pack Frozen catalog for Windows installer lifecycle fixture.'}

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
  $State=Join-Path $env:APPDATA 'WeiG-qB-WebUI'

  function Assert-Install([string]$ExpectedVersion,[string]$ExpectedSha,[string]$ExpectedMarker){
    Assert-True (Test-Path (Join-Path $Destination 'public\index.html')) 'public/index.html missing after install.'
    Assert-True (Test-Path (Join-Path $Destination 'public\login.html')) 'public/login.html missing after install.'
    Assert-True (Test-Path (Join-Path $Destination 'private\index.html')) 'private/index.html missing after install.'
    Assert-True (((Get-Content (Join-Path $Destination 'VERSION') -Raw).Trim()) -eq $ExpectedVersion) 'Installed VERSION mismatch.'
    Assert-True (((Get-Content (Join-Path $Destination 'GIT_SHA') -Raw).Trim()) -eq $ExpectedSha) 'Installed GIT_SHA mismatch.'
    Assert-True (((Get-Content (Join-Path $Destination 'private\lifecycle-marker.txt') -Raw).Trim()) -eq $ExpectedMarker) 'Installed lifecycle marker mismatch.'

    $cfgText=Get-Content $Cfg -Raw
    Assert-True ($cfgText.Contains('WebUI\AlternativeUIEnabled=true')) 'qB AlternativeUIEnabled was not configured.'
    Assert-True ($cfgText.Contains("WebUI\RootFolder=$Destination")) 'qB RootFolder was not configured to isolated destination.'
    Assert-True ($cfgText.Contains('Lifecycle\Marker=preserve-me')) 'Unrelated qB config marker was not preserved.'

    $meta=Get-Content (Join-Path $Destination 'private\weigg-install.json') -Raw | ConvertFrom-Json
    Assert-True ($meta.version -eq $ExpectedVersion) 'Install metadata version mismatch.'
    Assert-True ($meta.gitSha -eq $ExpectedSha) 'Install metadata gitSha mismatch.'
    Assert-True ($meta.channel -eq 'release') 'Install metadata channel mismatch.'
    Assert-True ($meta.installer -eq 'windows') 'Install metadata installer mismatch.'
    Assert-True ($meta.hostPath -eq $Destination -and $meta.qbPath -eq $Destination) 'Install metadata paths mismatch.'

    $catalogPath=Join-Path $Destination 'private\data\qb-releases.json'
    $catalog=Get-Content $catalogPath -Raw | ConvertFrom-Json
    Assert-True ($catalog.Count -gt 0) 'Packed release catalog is empty.'
    Assert-True ((Get-Item $catalogPath).Length -lt 10MB) 'Packed release catalog exceeds qB static-file limit.'
  }

  & $Installer -Version $VersionOne -Configure -Destination $Destination
  Assert-Install $VersionOne $ShaOne 'release-one'
  $FirstBackup=(Get-Content (Join-Path $State 'last-backup') -Raw).Trim()
  Assert-True (((Get-Content (Join-Path $FirstBackup 'had-webui') -Raw).Trim()) -eq '0') 'First backup should record no previous WebUI.'
  $firstCfg=Get-Content (Join-Path $FirstBackup 'qBittorrent.conf') -Raw
  Assert-True ($firstCfg.Contains('WebUI\AlternativeUIEnabled=false')) 'First backup lost original AlternativeUIEnabled.'
  Assert-True ($firstCfg.Contains('WebUI\RootFolder=C:\original\webui')) 'First backup lost original RootFolder.'

  Start-Sleep -Milliseconds 1100
  & $Installer -Version $VersionTwo -Configure -Destination $Destination
  Assert-Install $VersionTwo $ShaTwo 'release-two'
  $SecondBackup=(Get-Content (Join-Path $State 'last-backup') -Raw).Trim()
  Assert-True ($SecondBackup -ne $FirstBackup) 'Upgrade backup reused the initial backup directory.'
  Assert-True (((Get-Content (Join-Path $SecondBackup 'had-webui') -Raw).Trim()) -eq '1') 'Upgrade backup should record previous WebUI.'
  Assert-True (((Get-Content (Join-Path $SecondBackup 'webui\VERSION') -Raw).Trim()) -eq $VersionOne) 'Upgrade backup VERSION mismatch.'
  Assert-True (((Get-Content (Join-Path $SecondBackup 'webui\GIT_SHA') -Raw).Trim()) -eq $ShaOne) 'Upgrade backup GIT_SHA mismatch.'
  Assert-True (((Get-Content (Join-Path $SecondBackup 'webui\private\lifecycle-marker.txt') -Raw).Trim()) -eq 'release-one') 'Upgrade backup marker mismatch.'
  $secondCfg=Get-Content (Join-Path $SecondBackup 'qBittorrent.conf') -Raw
  Assert-True ($secondCfg.Contains('WebUI\AlternativeUIEnabled=true')) 'Upgrade backup lost configured AlternativeUIEnabled.'
  Assert-True ($secondCfg.Contains("WebUI\RootFolder=$Destination")) 'Upgrade backup lost configured RootFolder.'

  $mutated=(Get-Content $Cfg -Raw).Replace('WebUI\AlternativeUIEnabled=true','WebUI\AlternativeUIEnabled=false').Replace("WebUI\RootFolder=$Destination",'WebUI\RootFolder=C:\post-upgrade-mutated')
  Write-Utf8NoBom $Cfg $mutated

  $pwsh=Join-Path $PSHOME 'pwsh.exe'
  & $pwsh -NoLogo -NoProfile -ExecutionPolicy Bypass -File $Installer -Rollback
  if($LASTEXITCODE -ne 0){throw "Rollback subprocess failed with exit code $LASTEXITCODE."}
  Assert-Install $VersionOne $ShaOne 'release-one'
  Assert-True (((Get-Content (Join-Path $State 'last-dest') -Raw).Trim()) -eq $Destination) 'Remembered destination mismatch.'

  $artifactDir=Join-Path $Root 'artifacts\install-lifecycle'
  New-Item -ItemType Directory -Force -Path $artifactDir | Out-Null
  $repoSha=$env:GITHUB_SHA
  if(!$repoSha){$repoSha=(& git -C $Root rev-parse HEAD).Trim()}
  $catalogPath=Join-Path $Destination 'private\data\qb-releases.json'
  $catalog=Get-Content $catalogPath -Raw | ConvertFrom-Json
  $meta=Get-Content (Join-Path $Destination 'private\weigg-install.json') -Raw | ConvertFrom-Json
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
    }
    rollbackState=[ordered]@{
      version=$meta.version
      gitSha=$meta.gitSha
      catalogProfiles=$catalog.Count
      packedCatalogBytes=(Get-Item $catalogPath).Length
    }
  }
  Write-Utf8NoBom (Join-Path $artifactDir 'windows.json') (($evidence | ConvertTo-Json -Depth 8)+"`n")

  Write-Host "Windows installer lifecycle passed: install $VersionOne -> upgrade $VersionTwo -> rollback $VersionOne"
}
finally {
  Remove-Item Env:WEIGG_INSTALLER_FIXTURE_ROOT -ErrorAction SilentlyContinue
  if(Test-Path $Tmp){Remove-Item $Tmp -Recurse -Force -ErrorAction SilentlyContinue}
}
