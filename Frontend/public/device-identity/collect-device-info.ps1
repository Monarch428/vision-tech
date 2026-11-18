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
$json = $info | ConvertTo-Json
$json | Set-Content -Path $output -Encoding UTF8
try {
  Set-Clipboard -Value $json -ErrorAction Stop
  Write-Host "Created $output and copied device details to the clipboard. Return to NVT and use Paste & fill device details."
} catch {
  Write-Host "Created $output. Clipboard copy was unavailable; import the file in NVT instead."
}
Read-Host 'Press Enter to close'
