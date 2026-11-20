# NVT Device Info — Windows pilot

`Frontend/public/NVT-Device-Web-v1.3/NVT-Device-Web.exe` is the available
unsigned Windows pilot. It presents its own consent prompt and can save
`device-info.json` through its **Save JSON** action. It is not a background
agent and does not upload information by itself.

This archived build cannot return data to a browser. The website therefore
generates a per-download PowerShell collector. After it runs, it saves the
same local file, copies it to the clipboard, opens the originating form, and
fills hostname and serial number automatically. The returned data is carried
in a URL fragment, so it is not sent to the server.

The current Windows build is unsigned, so Windows SmartScreen may warn pilot
testers. Production distribution requires an Authenticode certificate and a
new build that is configured for the production website origin.
