# Runs locally after the customer explicitly downloads and starts it.
# It creates device-info.json on the Desktop. It does not upload any data.
$ErrorActionPreference = 'Stop'

$serialNumber = ''
try {
  $serialNumber = (Get-CimInstance -ClassName Win32_BIOS -ErrorAction Stop).SerialNumber
} catch {
  # Some virtual machines and locked-down devices do not expose a serial.
}

$info = [ordered]@{
  hostname = $env:COMPUTERNAME
  serialNumber = [string]$serialNumber
  platform = 'windows'
  collectedAt = (Get-Date).ToUniversalTime().ToString('o')
}

$desktop = [Environment]::GetFolderPath('Desktop')
if ([string]::IsNullOrWhiteSpace($desktop)) { $desktop = (Get-Location).Path }
$output = Join-Path $desktop 'device-info.json'
$info | ConvertTo-Json | Set-Content -Path $output -Encoding UTF8
Write-Host "Created $output"
Read-Host 'Press Enter to close'
