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

To serve the new Windows EXE instead of the PowerShell fallback, set
`DEVICE_IDENTITY_WINDOWS_HELPER_PATH` to the signed `NVTDeviceInfo.exe` build.
The API packages it with a request-specific `Run NVT Device Info.cmd` launcher
that supplies the one-time callback URL to the EXE.

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
PowerShell `.ps1`; macOS gets a request-specific `NVT Device Info.app` inside
a ZIP, so Finder launches it as an app instead of opening a shell script in an
editor; Linux gets a shell collector. Each asks for a second explicit approval
before collecting or sending details. They do not request administrator rights
or change execution-policy settings. A new Windows EXE project is at
`DesktopApps/windows/NVTDeviceInfo`; it must be Authenticode-signed before
customer distribution.
