$ErrorActionPreference='Stop'

$root=Split-Path $PSScriptRoot -Parent
$installer=Join-Path $root 'installers\install.ps1'
$tokens=$null
$parseErrors=$null
$ast=[System.Management.Automation.Language.Parser]::ParseFile($installer,[ref]$tokens,[ref]$parseErrors)
if($parseErrors.Count -gt 0){throw "install.ps1 parse failed: $($parseErrors[0].Message)"}

$functionText=@{}
$requiredFunctions=@(
  'Resolve-UniqueQBConfig',
  'Find-QBConfig',
  'Read-QBConfigText',
  'Write-QBConfigText',
  'Compare-QBBytes',
  'Test-QBittorrentRunning',
  'Get-QBPendingConfigPaths',
  'Assert-QBConfigTextLooksSafe',
  'Assert-QBConfigMutationSafe',
  'Get-QBPreferencesSectionInfo',
  'Get-QBManagedWebUIKeyMatches',
  'Assert-QBWebUISectionOwnership',
  'Get-QBUnmanagedConfigText',
  'Set-QBWebUIConfigText',
  'Assert-QBWebUIMutation',
  'Invoke-QBAtomicReplace',
  'Restore-QBConfigBackupAtomically',
  'Configure-QBWebUI'
)
foreach($name in $requiredFunctions){
  $fn=$ast.Find({param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name},$true)
  if(!$fn){throw "Missing installer function: $name"}
  $functionText[$name]=$fn.Extent.Text
  Invoke-Expression $fn.Extent.Text
}

function Assert-True([bool]$Condition,[string]$Message){if(!$Condition){throw $Message}}
function Bytes-Equal([byte[]]$A,[byte[]]$B){
  if($null -eq $A -or $null -eq $B -or $A.Length -ne $B.Length){return $false}
  for($i=0;$i -lt $A.Length;$i++){if($A[$i] -ne $B[$i]){return $false}}
  return $true
}
function Assert-Throws([scriptblock]$Script,[string]$Contains,[string]$Message){
  $thrown=$false
  $actual=''
  try { & $Script } catch { $thrown=$true; $actual=$_.Exception.Message }
  if(!$thrown){throw $Message}
  if($Contains -and !$actual.Contains($Contains)){
    throw "$Message Expected error containing '$Contains', got '$actual'."
  }
}
function Convert-ToCRLF([string]$Text){
  $normalized=($Text -replace "`r`n","`n") -replace "`r","`n"
  return ($normalized -replace "`n","`r`n")
}
function Write-EncodedFile([string]$Path,[string]$Text,$Encoding,[byte[]]$Preamble){
  [byte[]]$body=$Encoding.GetBytes($Text)
  [byte[]]$bytes=New-Object byte[] ($Preamble.Length+$body.Length)
  if($Preamble.Length -gt 0){[Array]::Copy($Preamble,0,$bytes,0,$Preamble.Length)}
  if($body.Length -gt 0){[Array]::Copy($body,0,$bytes,$Preamble.Length,$body.Length)}
  [IO.File]::WriteAllBytes($Path,$bytes)
}

# Keep the success-path tests independent from any qB process that may be running on a developer machine.
function Test-QBittorrentRunning { return $false }

$temp=Join-Path ([IO.Path]::GetTempPath()) ('weigg-config-safety-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $temp | Out-Null
try {
  $rootFolder='D:\软件\下载工具\qbittorrent\WeiG-qB-WebUI'
  $original=@"
[General]
Locale=zh_CN

[BitTorrent]
Session\DefaultSavePath=D:\clash\u\下载
Session\TempPath=D:\clash\其他文件\下载临时文件夹
Session\TempPathEnabled=true
Session\Tags=姫川ゆうな,羽田桃子,电影,moka酱,动漫,永野いち夏,小西まりえ
SavePathHistory=E:\clash\u\moka酱;E:\影视;D:\下载\电影;E:\clash\u\小西まりえ

[Preferences]
Username=admin
WebUI\AlternativeUIEnabled=false
WebUI\RootFolder=D:\old\webui
"@
  $original=Convert-ToCRLF $original

  $utf8NoBom=New-Object System.Text.UTF8Encoding($false,$true)
  $cfg=Join-Path $temp 'qBittorrent.ini'
  Write-EncodedFile $cfg $original $utf8NoBom ([byte[]]@())
  [byte[]]$before=[IO.File]::ReadAllBytes($cfg)

  Configure-QBWebUI $cfg $rootFolder

  [byte[]]$after=[IO.File]::ReadAllBytes($cfg)
  Assert-True ($after.Length -ge 16) 'Configured qBittorrent.ini unexpectedly became empty or tiny.'
  Assert-True (-not ($after[0] -eq 0xEF -and $after[1] -eq 0xBB -and $after[2] -eq 0xBF)) 'UTF-8 no-BOM qB config must remain no-BOM.'
  $decoded=$utf8NoBom.GetString($after)
  Assert-True ($decoded.Contains('Session\DefaultSavePath=D:\clash\u\下载')) 'DefaultSavePath Chinese text was corrupted.'
  Assert-True ($decoded.Contains('Session\TempPath=D:\clash\其他文件\下载临时文件夹')) 'TempPath Chinese text was corrupted.'
  Assert-True ($decoded.Contains('Session\Tags=姫川ゆうな,羽田桃子,电影,moka酱,动漫,永野いち夏,小西まりえ')) 'Chinese/Japanese tags were changed.'
  Assert-True ($decoded.Contains('SavePathHistory=E:\clash\u\moka酱;E:\影视;D:\下载\电影;E:\clash\u\小西まりえ')) 'Unicode save-path history was changed.'
  Assert-True (-not $decoded.Contains('涓嬭浇')) 'Known UTF-8-as-GBK mojibake appeared in qB config.'
  Assert-True ($decoded.Contains('WebUI\AlternativeUIEnabled=true')) 'Alternative WebUI enable line was not written.'
  Assert-True ($decoded.Contains("WebUI\RootFolder=$rootFolder")) 'Alternative WebUI RootFolder was not written.'
  Assert-QBWebUISectionOwnership $decoded $rootFolder
  Assert-True ((Get-QBUnmanagedConfigText $decoded) -eq (Get-QBUnmanagedConfigText $original)) 'Only the two managed WebUI lines may change when both already exist.'

  $backup="$cfg.weigg.bak"
  Assert-True (Test-Path $backup) 'Safe configure must create a raw-byte safety backup.'
  Assert-True (Bytes-Equal $before ([IO.File]::ReadAllBytes($backup))) 'qB config safety backup must be byte-identical to the pre-mutation file.'
  Assert-True (-not (Test-Path "$cfg.weigg.replace.bak")) 'Successful configure must not leave the internal atomic-replace backup behind.'

  # UTF-8 BOM stays BOM.
  $cfgBom=Join-Path $temp 'qBittorrent-bom.ini'
  Write-EncodedFile $cfgBom $original $utf8NoBom ([byte[]]@(0xEF,0xBB,0xBF))
  Configure-QBWebUI $cfgBom $rootFolder
  [byte[]]$afterBom=[IO.File]::ReadAllBytes($cfgBom)
  Assert-True ($afterBom[0] -eq 0xEF -and $afterBom[1] -eq 0xBB -and $afterBom[2] -eq 0xBF) 'UTF-8 BOM qB config must preserve its BOM.'
  $decodedBom=$utf8NoBom.GetString($afterBom[3..($afterBom.Length-1)])
  Assert-True ($decodedBom.Contains('Session\DefaultSavePath=D:\clash\u\下载')) 'UTF-8 BOM config Chinese path was corrupted.'

  # UTF-16 LE and BE BOMs are preserved.
  $utf16Le=New-Object System.Text.UnicodeEncoding($false,$false,$true)
  $cfgLe=Join-Path $temp 'qBittorrent-utf16le.ini'
  Write-EncodedFile $cfgLe $original $utf16Le ([byte[]]@(0xFF,0xFE))
  Configure-QBWebUI $cfgLe $rootFolder
  [byte[]]$afterLe=[IO.File]::ReadAllBytes($cfgLe)
  Assert-True ($afterLe[0] -eq 0xFF -and $afterLe[1] -eq 0xFE) 'UTF-16 LE BOM must be preserved.'
  $decodedLe=$utf16Le.GetString($afterLe[2..($afterLe.Length-1)])
  Assert-True ($decodedLe.Contains('Session\Tags=姫川ゆうな,羽田桃子,电影,moka酱,动漫,永野いち夏,小西まりえ')) 'UTF-16 LE Unicode values were corrupted.'

  $utf16Be=New-Object System.Text.UnicodeEncoding($true,$false,$true)
  $cfgBe=Join-Path $temp 'qBittorrent-utf16be.ini'
  Write-EncodedFile $cfgBe $original $utf16Be ([byte[]]@(0xFE,0xFF))
  Configure-QBWebUI $cfgBe $rootFolder
  [byte[]]$afterBe=[IO.File]::ReadAllBytes($cfgBe)
  Assert-True ($afterBe[0] -eq 0xFE -and $afterBe[1] -eq 0xFF) 'UTF-16 BE BOM must be preserved.'
  $decodedBe=$utf16Be.GetString($afterBe[2..($afterBe.Length-1)])
  Assert-True ($decodedBe.Contains('SavePathHistory=E:\clash\u\moka酱;E:\影视;D:\下载\电影;E:\clash\u\小西まりえ')) 'UTF-16 BE Unicode values were corrupted.'

  # qB running -> fail closed before touching the target or creating a backup.
  $runningCfg=Join-Path $temp 'qBittorrent-running.ini'
  Write-EncodedFile $runningCfg $original $utf8NoBom ([byte[]]@())
  [byte[]]$runningBefore=[IO.File]::ReadAllBytes($runningCfg)
  function Test-QBittorrentRunning { return $true }
  Assert-Throws { Configure-QBWebUI $runningCfg $rootFolder } 'qBittorrent is running' 'Configure must refuse while qBittorrent is running.'
  Assert-True (Bytes-Equal $runningBefore ([IO.File]::ReadAllBytes($runningCfg))) 'Running-process refusal must leave qB config byte-identical.'
  Assert-True (-not (Test-Path "$runningCfg.weigg.bak")) 'Running-process refusal must occur before creating a mutation backup.'
  Invoke-Expression $functionText['Test-QBittorrentRunning']
  function Test-QBittorrentRunning { return $false }

  # Non-empty qBittorrent_new.ini -> fail closed.
  $pendingCfg=Join-Path $temp 'qBittorrent-pending.ini'
  Write-EncodedFile $pendingCfg $original $utf8NoBom ([byte[]]@())
  [byte[]]$pendingBefore=[IO.File]::ReadAllBytes($pendingCfg)
  $pending=Join-Path $temp 'qBittorrent_new.ini'
  [IO.File]::WriteAllText($pending,'pending')
  Assert-Throws { Configure-QBWebUI $pendingCfg $rootFolder } 'recovery file is non-empty' 'Configure must refuse a non-empty qBittorrent_new.ini.'
  Assert-True (Bytes-Equal $pendingBefore ([IO.File]::ReadAllBytes($pendingCfg))) 'Pending-recovery refusal must leave qB config byte-identical.'
  Remove-Item $pending -Force

  # Zero-byte and structurally invalid configs -> fail closed.
  $zeroCfg=Join-Path $temp 'qBittorrent-zero.ini'
  [IO.File]::WriteAllBytes($zeroCfg,[byte[]]@())
  Assert-Throws { Configure-QBWebUI $zeroCfg $rootFolder } 'empty or obviously too small' 'Configure must refuse a zero-byte qB config.'
  Assert-True ((Get-Item $zeroCfg).Length -eq 0) 'Zero-byte config refusal must not mutate the file.'

  $invalidCfg=Join-Path $temp 'qBittorrent-invalid.ini'
  [byte[]]$invalidBefore=$utf8NoBom.GetBytes('this is not an INI document and has no safe qB structure')
  [IO.File]::WriteAllBytes($invalidCfg,$invalidBefore)
  Assert-Throws { Configure-QBWebUI $invalidCfg $rootFolder } 'parseable INI document' 'Configure must refuse structurally invalid qB config.'
  Assert-True (Bytes-Equal $invalidBefore ([IO.File]::ReadAllBytes($invalidCfg))) 'Invalid-config refusal must leave bytes untouched.'

  # Duplicate managed keys are ambiguous and must not be rewritten.
  $duplicateCfg=Join-Path $temp 'qBittorrent-duplicate.ini'
  $duplicate=$original+"`r`nWebUI\AlternativeUIEnabled=false`r`n"
  Write-EncodedFile $duplicateCfg $duplicate $utf8NoBom ([byte[]]@())
  [byte[]]$duplicateBefore=[IO.File]::ReadAllBytes($duplicateCfg)
  Assert-Throws { Configure-QBWebUI $duplicateCfg $rootFolder } 'duplicate managed WebUI keys' 'Configure must refuse duplicate managed keys.'
  Assert-True (Bytes-Equal $duplicateBefore ([IO.File]::ReadAllBytes($duplicateCfg))) 'Duplicate-key refusal must leave bytes untouched.'


  # Managed WebUI keys in a non-Preferences section must fail closed.
  $wrongSectionCfg=Join-Path $temp 'qBittorrent-wrong-section.ini'
  $wrongSection=(Get-QBUnmanagedConfigText $original)+"`r`n[WebUI]`r`nWebUI\AlternativeUIEnabled=false`r`nWebUI\RootFolder=D:\old\webui`r`n"
  Write-EncodedFile $wrongSectionCfg $wrongSection $utf8NoBom ([byte[]]@())
  [byte[]]$wrongSectionBefore=[IO.File]::ReadAllBytes($wrongSectionCfg)
  Assert-Throws { Configure-QBWebUI $wrongSectionCfg $rootFolder } 'must belong to the [Preferences] section' 'Configure must refuse managed WebUI keys outside [Preferences].'
  Assert-True (Bytes-Equal $wrongSectionBefore ([IO.File]::ReadAllBytes($wrongSectionCfg))) 'Wrong-section refusal must leave bytes untouched.'
  Assert-True (-not (Test-Path "$wrongSectionCfg.weigg.bak")) 'Wrong-section refusal must occur before creating a mutation backup.'

  # Multiple [Preferences] sections are ambiguous and must fail closed.
  $duplicateSectionCfg=Join-Path $temp 'qBittorrent-duplicate-section.ini'
  $duplicateSection=$original+"`r`n[Preferences]`r`nConnection\PortRangeMin=6881`r`n"
  Write-EncodedFile $duplicateSectionCfg $duplicateSection $utf8NoBom ([byte[]]@())
  [byte[]]$duplicateSectionBefore=[IO.File]::ReadAllBytes($duplicateSectionCfg)
  Assert-Throws { Configure-QBWebUI $duplicateSectionCfg $rootFolder } 'exactly one [Preferences] section' 'Configure must refuse duplicate [Preferences] sections.'
  Assert-True (Bytes-Equal $duplicateSectionBefore ([IO.File]::ReadAllBytes($duplicateSectionCfg))) 'Duplicate-section refusal must leave bytes untouched.'
  Assert-True (-not (Test-Path "$duplicateSectionCfg.weigg.bak")) 'Duplicate-section refusal must occur before creating a mutation backup.'

  # Multiple discovered configs must never choose the first one.
  $candidateA=Join-Path $temp 'candidate-a.ini'
  $candidateB=Join-Path $temp 'candidate-b.ini'
  Write-EncodedFile $candidateA $original $utf8NoBom ([byte[]]@())
  Write-EncodedFile $candidateB $original $utf8NoBom ([byte[]]@())
  Assert-Throws { Resolve-UniqueQBConfig @($candidateA,$candidateB) } 'Multiple qBittorrent config candidates' 'Multiple config candidates must fail closed.'
  Assert-True ((Resolve-UniqueQBConfig @($candidateA)) -eq (Resolve-Path $candidateA).Path) 'One exact config candidate should resolve deterministically.'

  # Simulate a failure immediately after the atomic swap. Configure must restore exact original bytes.
  $failureCfg=Join-Path $temp 'qBittorrent-failure.ini'
  Write-EncodedFile $failureCfg $original $utf8NoBom ([byte[]]@())
  [byte[]]$failureBefore=[IO.File]::ReadAllBytes($failureCfg)
  $script:AtomicReplaceCalls=0
  function Invoke-QBAtomicReplace([string]$Source,[string]$Destination,[string]$BackupPath) {
    $script:AtomicReplaceCalls++
    if(Test-Path -LiteralPath $BackupPath){Remove-Item -LiteralPath $BackupPath -Force}
    [IO.File]::Replace($Source,$Destination,$BackupPath,$true)
    if($script:AtomicReplaceCalls -eq 1){throw 'simulated post-replace failure'}
  }
  Assert-Throws { Configure-QBWebUI $failureCfg $rootFolder } 'simulated post-replace failure' 'Configure must surface an atomic replace failure.'
  Assert-True (Bytes-Equal $failureBefore ([IO.File]::ReadAllBytes($failureCfg))) 'Atomic replace failure must restore exact original qB config bytes.'
  Assert-True (Bytes-Equal $failureBefore ([IO.File]::ReadAllBytes("$failureCfg.weigg.bak"))) 'Safety backup must remain the exact original after rollback.'
  Invoke-Expression $functionText['Invoke-QBAtomicReplace']

  Write-Host 'Windows qB config safety contract passed: encoding preservation, process/recovery guards, invalid/ambiguous refusal, temp verification, atomic replace and exact rollback are enforced.'
} finally {
  Remove-Item $temp -Recurse -Force -ErrorAction SilentlyContinue
}
