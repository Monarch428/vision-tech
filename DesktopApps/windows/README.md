# NVT Device Info — Windows pilot

`Frontend/public/NVT-Device-Web-v1.3/NVT-Device-Web.exe` is the available
unsigned Windows pilot. It presents its own consent prompt and can save
`device-info.json` through its **Save JSON** action. It is not a background
agent and does not upload information by itself.

When `DEVICE_IDENTITY_WINDOWS_HELPER_PATH` points to the published helper, the
website sends one request-specific `NVT-Device-Info.exe`. Its short filename
carries the one-time request ID and token, so the customer runs one file,
approves collection, and the originating form fills automatically. There is no
ZIP, CMD launcher, PowerShell script, JSON import, or clipboard step.

The current Windows build is unsigned, so Windows SmartScreen may warn pilot
testers. Production distribution requires an Authenticode certificate and a
new build that is configured for the production website origin.
