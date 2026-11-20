# NVT Device Info for Windows

This is a new request-aware Windows helper source; it is not the archived EXE.
It obtains a one-time callback URL from `NVT_DEVICE_INFO_CALLBACK`, asks for
explicit consent, reads the hostname and BIOS serial number, and submits only
to that request. It does not install RMM or antivirus software.

Build on a Windows machine with the .NET 8 SDK:

```powershell
dotnet publish -c Release
```

The resulting executable is under `bin\Release\net8.0-windows\win-x64\publish`.
The download endpoint must be extended to package this executable with the
request callback (for example as a small request-specific config file or
command-line argument) before it replaces the PowerShell fallback. Sign the
release with Authenticode before customer distribution.
