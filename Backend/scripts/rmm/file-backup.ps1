# Vision Tech customer file backup, run by Tactical RMM as SYSTEM.
#
# Setup: Tactical RMM > Settings > Script Manager > New Script, shell PowerShell,
# paste this file, save, and set the script's id as RMM_SCRIPT_FILE_BACKUP_ID.
# The portal passes every argument (src/utils/fileBackups.js); nothing is
# stored on the computer.
#
# Zips the chosen folders (Documents, Desktop, Pictures) of the signed-in
# Windows user (or the most recently used profile), then uploads the zip in
# parts to the portal using a one-time token. Locked files and OneDrive
# cloud-only files are skipped. The temporary zip is always deleted.
param(
  [Parameter(Mandatory = $true)][string]$ApiUrl,
  [Parameter(Mandatory = $true)][string]$Token,
  [Parameter(Mandatory = $true)][string]$Folders,
  [Parameter(Mandatory = $true)][long]$MaxBytes,
  [long]$PartBytes = 9437184
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem

$headers = @{ 'X-Backup-Token' = $Token }
$MB = 1024 * 1024

function Send-Status([hashtable]$Body) {
  Invoke-RestMethod -Uri "$ApiUrl/api/file-backups/agent/status" -Method Post -Headers $headers `
    -ContentType 'application/json' -Body ($Body | ConvertTo-Json -Compress) -UseBasicParsing -TimeoutSec 60 | Out-Null
}

function Send-Part([int]$Index, [byte[]]$Bytes) {
  for ($try = 1; $try -le 4; $try++) {
    try {
      Invoke-WebRequest -Uri "$ApiUrl/api/file-backups/agent/parts/$Index" -Method Put -Headers $headers `
        -ContentType 'application/octet-stream' -Body $Bytes -UseBasicParsing -TimeoutSec 300 | Out-Null
      return
    } catch {
      $code = 0
      if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
      # 4xx (other than rate limiting) won't succeed on retry.
      if (($code -ge 400 -and $code -lt 500 -and $code -ne 429) -or $try -eq 4) { throw }
      Start-Sleep -Seconds (15 * $try)
    }
  }
}

function Get-TargetProfile {
  $sid = $null
  $active = (Get-CimInstance Win32_ComputerSystem).UserName
  if ($active) {
    try { $sid = (New-Object Security.Principal.NTAccount($active)).Translate([Security.Principal.SecurityIdentifier]).Value } catch { }
  }
  $profiles = @(Get-CimInstance Win32_UserProfile | Where-Object { -not $_.Special -and $_.LocalPath -and (Test-Path -LiteralPath $_.LocalPath) })
  $found = $null
  if ($sid) { $found = $profiles | Where-Object { $_.SID -eq $sid } | Select-Object -First 1 }
  if (-not $found) { $found = $profiles | Sort-Object LastUseTime -Descending | Select-Object -First 1 }
  if (-not $found) { throw 'No Windows user profile was found on this computer.' }
  return $found
}

# The folder's real location: Windows (or OneDrive) may have moved it.
function Resolve-Folder($UserProfile, [string]$Name) {
  $valueNames = @{ Documents = 'Personal'; Desktop = 'Desktop'; Pictures = 'My Pictures' }
  $candidates = @()
  $key = "Registry::HKEY_USERS\$($UserProfile.SID)\Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders"
  try {
    # Read unexpanded: expanding would use SYSTEM's %USERPROFILE%, not the user's.
    $raw = (Get-Item -LiteralPath $key).GetValue($valueNames[$Name], $null, 'DoNotExpandEnvironmentNames')
    if ($raw) { $candidates += ($raw -replace '%USERPROFILE%', $UserProfile.LocalPath) }
  } catch { }
  $candidates += (Join-Path $UserProfile.LocalPath $Name)
  $candidates += (Join-Path $UserProfile.LocalPath "OneDrive\$Name")
  foreach ($path in $candidates) {
    if ($path -notmatch '%' -and (Test-Path -LiteralPath $path -PathType Container)) { return $path }
  }
  return $null
}

# Files under $Root, without following junctions (e.g. the hidden "My Music" links).
function Get-BackupFiles([string]$Root) {
  $offline = [int][IO.FileAttributes]::Offline -bor 0x40000 -bor 0x400000 # cloud-only / recall on open
  $stack = New-Object System.Collections.Stack
  $stack.Push((Get-Item -LiteralPath $Root -Force))
  while ($stack.Count) {
    $dir = $stack.Pop()
    try { $items = $dir.GetFileSystemInfos() } catch { $script:skipped++; continue }
    foreach ($item in $items) {
      if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { continue }
      if ($item -is [IO.DirectoryInfo]) { $stack.Push($item); continue }
      if (([int]$item.Attributes -band $offline) -ne 0) { $script:skipped++; continue }
      if ($item.Name -eq 'desktop.ini' -or $item.Name -eq 'Thumbs.db') { continue }
      $item
    }
  }
}

$zipPath = Join-Path $env:TEMP ('vt-backup-' + [guid]::NewGuid().ToString('N') + '.zip')
$script:skipped = 0
$fileCount = 0
$zip = $null; $zipStream = $null; $reader = $null

try {
  Send-Status @{ status = 'running' }
  $userProfile = Get-TargetProfile

  $zipStream = [IO.File]::Open($zipPath, [IO.FileMode]::CreateNew)
  $zip = New-Object IO.Compression.ZipArchive($zipStream, [IO.Compression.ZipArchiveMode]::Create, $true)
  foreach ($name in ($Folders -split ',')) {
    $root = Resolve-Folder $userProfile $name
    if (-not $root) { continue }
    foreach ($file in (Get-BackupFiles $root)) {
      $entry = $name + '/' + $file.FullName.Substring($root.Length).TrimStart('\').Replace('\', '/')
      try {
        [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $file.FullName, $entry, [IO.Compression.CompressionLevel]::Optimal) | Out-Null
        $fileCount++
      } catch {
        $script:skipped++ # locked or unreadable
      }
      if ($zipStream.Position -gt $MaxBytes) {
        throw ("Your files are larger than your remaining backup storage ({0} MB). Choose fewer folders, delete an old backup or upgrade your plan." -f [math]::Floor($MaxBytes / $MB))
      }
    }
  }
  $zip.Dispose(); $zip = $null
  $zipStream.Dispose(); $zipStream = $null
  if ($fileCount -eq 0) { throw 'No files were found in the chosen folders.' }

  $size = (Get-Item -LiteralPath $zipPath).Length
  if ($size -gt $MaxBytes) {
    throw ("Your files are larger than your remaining backup storage ({0} MB)." -f [math]::Floor($MaxBytes / $MB))
  }

  $reader = [IO.File]::OpenRead($zipPath)
  $buffer = New-Object byte[] $PartBytes
  $index = 0
  while (($read = $reader.Read($buffer, 0, $buffer.Length)) -gt 0) {
    if ($read -eq $buffer.Length) { $chunk = $buffer } else { $chunk = New-Object byte[] $read; [Array]::Copy($buffer, $chunk, $read) }
    Send-Part $index $chunk
    $index++
  }
  $reader.Dispose(); $reader = $null

  Send-Status @{ status = 'completed'; parts = $index; fileCount = $fileCount; skippedCount = $script:skipped }
  Write-Output ("Backup uploaded: {0} files, {1:N1} MB in {2} parts, {3} skipped." -f $fileCount, ($size / $MB), $index, $script:skipped)
} catch {
  $message = $_.Exception.Message
  Write-Output "Backup failed: $message"
  try { Send-Status @{ status = 'failed'; error = $message } } catch { }
  exit 1
} finally {
  if ($zip) { $zip.Dispose() }
  if ($zipStream) { $zipStream.Dispose() }
  if ($reader) { $reader.Dispose() }
  Remove-Item -LiteralPath $zipPath -Force -ErrorAction SilentlyContinue
}
