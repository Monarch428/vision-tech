# Device-detail autofill

The signup and profile forms share `DeviceIdentityAssistant`. After website
consent, it creates a ten-minute request and downloads a request-specific
helper. The original tab polls with its read token; the helper has a separate
write token. A result can be submitted once only. Tokens are SHA-256 hashes in
MongoDB and expired requests are removed by a TTL index.

## Configuration

For local development, `Backend/.env` must contain:

```dotenv
PORT=5001
DEVICE_IDENTITY_PUBLIC_API_URL=http://localhost:5001/api
```

`Frontend/.env` must use the same API:

```dotenv
VITE_API_BASE_URL=http://localhost:5001/api
```

For Windows, set `DEVICE_IDENTITY_WINDOWS_HELPER_PATH` to the published
`NVTDeviceInfo.exe` build. The API supplies a short one-time request ID and
token in the downloaded filename; the app is built for
`https://essentials.newvtech.com/api`. The customer receives one directly
runnable Windows EXE—no ZIP, CMD file, PowerShell script, JSON import, or
clipboard step. The app displays its approval/status dialogs and returns
approved details to the already-open browser tab.

Build the Windows x64 helper with:

```sh
dotnet publish DesktopApps/windows/NVTDeviceInfo/NVTDeviceInfo.csproj --configuration Release --runtime win-x64 --self-contained true --output ./nvt-device-info-publish
```

Set the environment variable to `./nvt-device-info-publish/NVTDeviceInfo.exe`.
This is a Windows `.exe`; an APK is an Android package and cannot run on
Windows. The EXE is not modified at download time, so it can be
Authenticode-signed before deployment. The server returns a configuration error
rather than a fallback script when this executable is not configured.

In production set `DEVICE_IDENTITY_PUBLIC_API_URL=https://essentials.newvtech.com/api`.
HTTPS is required in production. HTTP is accepted only for loopback addresses
outside production.

## Local verification

1. Start MongoDB.
2. In `Backend`, run `npm run dev`.
3. In `Frontend`, run `npm run dev`.
4. Open either Signup or Profile. Check consent, choose a platform, and select
   **Get computer info**.
5. For a non-hardware test, use the request helper's POST endpoint with
   synthetic hostname/serial values and confirm that the already-open tab fills
   without navigating. Do not send this computer's identifiers to the external
   reference site.

The helpers are intentionally not RMM or antivirus installers. Windows gets a
request-specific Windows EXE; macOS gets a request-specific `NVT Device
Info.app` inside a ZIP, so Finder launches it as an app instead of opening a
shell script in an editor; Linux gets a shell collector. Each asks for a second
explicit approval before collecting or sending details. They do not request
administrator rights or change machine-wide execution-policy settings. The
Windows EXE project is at
`DesktopApps/windows/NVTDeviceInfo`; it must be Authenticode-signed before
customer distribution.
