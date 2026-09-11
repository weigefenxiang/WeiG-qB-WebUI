$ErrorActionPreference='Stop'

$root=Split-Path $PSScriptRoot -Parent
$installer=Join-Path $root 'installers\install.ps1'
$tokens=$null
$parseErrors=$null
$ast=[System.Management.Automation.Language.Parser]::ParseFile($installer,[ref]$tokens,[ref]$parseErrors)
if($parseErrors.Count -gt 0){throw "install.ps1 parse failed: $($parseErrors[0].Message)"}

foreach($name in @('Read-QBConfigText','Write-QBConfigText','Configure-QBWebUI')){
  $fn=$ast.Find({param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name},$true)
  if(!$fn){throw "Missing installer function: $name"}
  Invoke-Expression $fn.Extent.Text
}

function Assert-True([bool]$Condition,[string]$Message){if(!$Condition){throw $Message}}
function Bytes-Equal([byte[]]$A,[byte[]]$B){
  if($A.Length -ne $B.Length){return $false}
  for($i=0;$i -lt $A.Length;$i++){if($A[$i] -ne $B[$i]){return $false}}
  return $true
}

$temp=Join-Path ([IO.Path]::GetTempPath()) ('weigg-encoding-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $temp | Out-Null
try {
  $cfg=Join-Path $temp 'qBittorrent.ini'
  $original=@"
[BitTorrent]
Session\DefaultSavePath=D:\clash\u\下载
Session\TempPath=D:\clash\临时下载保存目录
Session\TempPathEnabled=true

[WebUI]
Username=admin
"@ -replace "`n","`r`n"
  $utf8NoBom=New-Object System.Text.UTF8Encoding($false,$true)
  [IO.File]::WriteAllBytes($cfg,$utf8NoBom.GetBytes($original))
  [byte[]]$before=[IO.File]::ReadAllBytes($cfg)

  $rootFolder='D:\软件\下载工具\qbittorrent\WeiG-qB-WebUI'
  Configure-QBWebUI $cfg $rootFolder

  [byte[]]$after=[IO.File]::ReadAllBytes($cfg)
  Assert-True ($after.Length -ge 3) 'Configured qBittorrent.ini unexpectedly became empty.'
  Assert-True (-not ($after[0] -eq 0xEF -and $after[1] -eq 0xBB -and $after[2] -eq 0xBF)) 'UTF-8 no-BOM qB config must remain no-BOM.'
  $decoded=$utf8NoBom.GetString($after)
  Assert-True ($decoded.Contains('Session\DefaultSavePath=D:\clash\u\下载')) 'DefaultSavePath Chinese text was corrupted.'
  Assert-True ($decoded.Contains('Session\TempPath=D:\clash\临时下载保存目录')) 'TempPath Chinese text was corrupted.'
  Assert-True (-not $decoded.Contains('涓嬭浇')) 'Known UTF-8-as-GBK mojibake appeared in qB config.'
  Assert-True ($decoded.Contains('WebUI\AlternativeUIEnabled=true')) 'Alternative WebUI enable line was not written.'
  Assert-True ($decoded.Contains("WebUI\RootFolder=$rootFolder")) 'Alternative WebUI RootFolder was not written.'

  $backup="$cfg.weigg.bak"
  Assert-True (Test-Path $backup) 'Encoding-safe configure must create a raw-byte backup.'
  Assert-True (Bytes-Equal $before ([IO.File]::ReadAllBytes($backup))) 'qB config backup must be byte-identical to the pre-mutation file.'

  $cfgBom=Join-Path $temp 'qBittorrent-bom.ini'
  [byte[]]$body=$utf8NoBom.GetBytes($original)
  [byte[]]$withBom=New-Object byte[] ($body.Length+3)
  $withBom[0]=0xEF;$withBom[1]=0xBB;$withBom[2]=0xBF
  [Array]::Copy($body,0,$withBom,3,$body.Length)
  [IO.File]::WriteAllBytes($cfgBom,$withBom)
  Configure-QBWebUI $cfgBom $rootFolder
  [byte[]]$afterBom=[IO.File]::ReadAllBytes($cfgBom)
  Assert-True ($afterBom[0] -eq 0xEF -and $afterBom[1] -eq 0xBB -and $afterBom[2] -eq 0xBF) 'UTF-8 BOM qB config must preserve its BOM.'
  $decodedBom=$utf8NoBom.GetString($afterBom[3..($afterBom.Length-1)])
  Assert-True ($decodedBom.Contains('Session\DefaultSavePath=D:\clash\u\下载')) 'UTF-8 BOM config Chinese path was corrupted.'

  Write-Host 'Windows qB config encoding contract passed: UTF-8 no-BOM/BOM Chinese paths survive installer configuration byte-safely.'
} finally {
  Remove-Item $temp -Recurse -Force -ErrorAction SilentlyContinue
}
