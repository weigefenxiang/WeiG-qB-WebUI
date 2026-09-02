param(
  [ValidateSet('Install','Update','Rollback')][string]$Mode='Install',
  [ValidateSet('Release','Dev')][string]$Channel='Release',
  [string]$Destination="$env:LOCALAPPDATA\WeiG-qB-WebUI",
  [switch]$Configure
)
$ErrorActionPreference='Stop'
$Repo='weigefenxiang/WeiG-qB-WebUI'
$State=Join-Path $env:APPDATA 'WeiG-qB-WebUI'
$Backups=Join-Path $State 'backups'
New-Item -ItemType Directory -Force -Path $Backups | Out-Null

function Find-QBConfig {
  $candidates=@(
    (Join-Path $env:APPDATA 'qBittorrent\qBittorrent.ini'),
    (Join-Path $env:APPDATA 'qBittorrent\qBittorrent.conf'),
    (Join-Path $env:LOCALAPPDATA 'qBittorrent\qBittorrent.ini'),
    (Join-Path $env:LOCALAPPDATA 'qBittorrent\qBittorrent.conf'),
    (Join-Path $PWD 'qBittorrent.ini'),
    (Join-Path $PWD 'qBittorrent.conf')
  )
  if($env:ProgramData){$candidates += (Join-Path $env:ProgramData 'qBittorrent\qBittorrent.ini')}
  foreach($p in $candidates){ if($p -and (Test-Path $p)){ return $p } }
  foreach($root in @($env:USERPROFILE,$PWD.Path)){
    if(!$root -or !(Test-Path $root)){continue}
    $found=Get-ChildItem $root -Filter 'qBittorrent.ini' -File -Recurse -Depth 5 -ErrorAction SilentlyContinue | Select-Object -First 1
    if($found){return $found.FullName}
  }
  return $null
}

function Backup-Current {
  $stamp=Get-Date -Format 'yyyyMMdd-HHmmss'
  $b=Join-Path $Backups $stamp
  New-Item -ItemType Directory -Force -Path $b | Out-Null
  if(Test-Path $Destination){ Copy-Item $Destination (Join-Path $b 'webui') -Recurse -Force }
  $cfg=Find-QBConfig
  if($cfg){ Copy-Item $cfg (Join-Path $b 'qBittorrent.conf') -Force }
  Set-Content -Encoding UTF8 -Path (Join-Path $State 'last-backup') -Value $b
  Set-Content -Encoding UTF8 -Path (Join-Path $State 'last-dest') -Value $Destination
  Write-Host "Backup: $b"
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

if($Mode -eq 'Rollback'){
  $marker=Join-Path $State 'last-backup'
  if(!(Test-Path $marker)){ throw 'No backup found.' }
  $b=(Get-Content $marker -Raw).Trim()
  $web=Join-Path $b 'webui'
  if(!(Test-Path $web)){ throw "Backup webui missing: $b" }
  if(Test-Path $Destination){ Remove-Item $Destination -Recurse -Force }
  Copy-Item $web $Destination -Recurse -Force
  $cfg=Find-QBConfig
  $old=Join-Path $b 'qBittorrent.conf'
  if($cfg -and (Test-Path $old)){ Copy-Item $old $cfg -Force }
  Write-Host "Rolled back to: $b"
  exit 0
}

Backup-Current
$tmp=Join-Path ([IO.Path]::GetTempPath()) ("weigg-qb-"+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
try {
  $archive=Join-Path $tmp 'WeiG-qB-WebUI.zip'
  $sourceSha=$null
  $web=$null

  if($Channel -eq 'Release'){
    try {
      Invoke-WebRequest -UseBasicParsing "https://github.com/$Repo/releases/latest/download/WeiG-qB-WebUI.zip" -OutFile $archive
    } catch {
      throw 'No published stable GitHub Release is available. Release installation will not fall back to a branch archive.'
    }

    $sumFile=Join-Path $tmp 'SHA256SUMS'
    try {
      Invoke-WebRequest -UseBasicParsing "https://github.com/$Repo/releases/latest/download/SHA256SUMS" -OutFile $sumFile
    } catch {
      throw 'The latest Release is missing SHA256SUMS; refusing an unverified installation.'
    }
    $sumLine=Get-Content $sumFile | Where-Object { $_ -match '\s+\*?WeiG-qB-WebUI\.zip$' } | Select-Object -First 1
    if(!$sumLine){throw 'SHA256SUMS does not contain WeiG-qB-WebUI.zip; refusing installation.'}
    $expected=(($sumLine -split '\s+')[0]).ToLowerInvariant()
    $actual=(Get-FileHash $archive -Algorithm SHA256).Hash.ToLowerInvariant()
    if($expected -notmatch '^[0-9a-f]{64}$' -or $expected -ne $actual){throw 'SHA256 verification failed.'}

    $root=Join-Path $tmp 'release'
    Expand-Archive $archive $root -Force
    $web=Join-Path $root 'WeiG-qB-WebUI'
    $shaFile=Join-Path $web 'GIT_SHA'
    if(!(Test-Path $shaFile)){throw 'Latest Release does not contain GIT_SHA; refusing an unversioned asset deployment.'}
    $sourceSha=(Get-Content $shaFile -Raw).Trim()
    if($sourceSha -notmatch '^[0-9a-fA-F]{40}$'){throw 'Latest Release contains an invalid GIT_SHA.'}
    Write-Host 'Source: latest GitHub Release (checksum verified)'
  } else {
    try {
      $commit=Invoke-RestMethod -UseBasicParsing -Headers @{'User-Agent'='WeiG-qB-WebUI-installer'} "https://api.github.com/repos/$Repo/commits/dev"
    } catch {
      throw 'Unable to resolve the current dev commit.'
    }
    $sourceSha=[string]$commit.sha
    if($sourceSha -notmatch '^[0-9a-fA-F]{40}$'){throw 'GitHub did not return a valid dev commit SHA.'}
    try {
      Invoke-WebRequest -UseBasicParsing "https://github.com/$Repo/archive/$sourceSha.zip" -OutFile $archive
    } catch {
      throw "Unable to download dev exact SHA $sourceSha."
    }
    $root=Join-Path $tmp 'dev'
    Expand-Archive $archive $root -Force
    $repoDir=Get-ChildItem $root -Directory | Select-Object -First 1
    if(!$repoDir){throw 'dev source archive is empty.'}
    $web=Join-Path $repoDir.FullName 'webui'
    Write-Host "Source: dev exact SHA $sourceSha (development channel; no Release checksum)"
  }

  if(!$web -or !(Test-Path $web)){ throw 'WebUI payload not found.' }
  if(!(Test-Path (Join-Path $web 'public\index.html')) -or !(Test-Path (Join-Path $web 'public\login.html')) -or !(Test-Path (Join-Path $web 'private\index.html'))){ throw 'Source package is not a valid qBittorrent Alternate WebUI.' }

  $new="$Destination.new"
  if(Test-Path $new){Remove-Item $new -Recurse -Force}
  New-Item -ItemType Directory -Force -Path $new | Out-Null
  Copy-Item (Join-Path $web '*') $new -Recurse -Force
  Inject-BuildSha $new $sourceSha
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
  Write-Host "Channel: $Channel"
  Write-Host "Installed version: $version"
  Write-Host "Installed Git SHA: $sourceSha"
  Write-Host "Install metadata: $(Join-Path $Destination 'private\weigg-install.json')"

  $cfg=Find-QBConfig
  if($Configure -and $cfg){
    Copy-Item $cfg "$cfg.weigg.bak" -Force
    $text=Get-Content $cfg -Raw
    if($text -match '(?m)^WebUI\\AlternativeUIEnabled='){ $text=[regex]::Replace($text,'(?m)^WebUI\\AlternativeUIEnabled=.*$','WebUI\AlternativeUIEnabled=true') } else { $text += "`r`nWebUI\AlternativeUIEnabled=true`r`n" }
    $rootLine='WebUI\RootFolder='+$Destination
    if($text -match '(?m)^WebUI\\RootFolder='){ $text=[regex]::Replace($text,'(?m)^WebUI\\RootFolder=.*$',[System.Text.RegularExpressions.MatchEvaluator]{param($m)$rootLine}) } else { $text += $rootLine+"`r`n" }
    Set-Content -Path $cfg -Value $text -Encoding UTF8
    Write-Host "Configured: $cfg"
  } else {
    Write-Host 'qBittorrent -> Tools -> Preferences -> Web UI -> Use alternative WebUI'
    Write-Host "WebUI Root Folder: $Destination"
    if($cfg){Write-Host "Detected config: $cfg"}
  }
  Write-Host 'Rollback: .\install.ps1 -Mode Rollback'
} finally {
  if(Test-Path $tmp){Remove-Item $tmp -Recurse -Force}
}
