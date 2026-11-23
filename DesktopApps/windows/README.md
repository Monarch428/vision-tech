# NVT Device Info — Windows pilot

`Frontend/public/NVT-Device-Web-v1.3/NVT-Device-Web.exe` is the available
unsigned Windows pilot. It presents its own consent prompt and can save
`device-info.json` through its **Save JSON** action. It is not a background
agent and does not upload information by itself.

The website generates a request-specific EXE package when
`DEVICE_IDENTITY_WINDOWS_HELPER_PATH` points to the published helper. The EXE
collects the approved details and submits them to the one-time callback, which
fills the originating form automatically. Without that setting, the site
supplies a ZIP containing `Run NVT Device Info.cmd` and a PowerShell collector;
the CMD launcher avoids the Windows `.ps1`/Notepad file-association problem and
shows an error dialog if submission fails.

The current Windows build is unsigned, so Windows SmartScreen may warn pilot
testers. Production distribution requires an Authenticode certificate and a
new build that is configured for the production website origin.
