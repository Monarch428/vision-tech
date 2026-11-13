# Bitdefender live validation and scan integration checklist

## 1) Confirm the environment values
Set these as a local override, not in the active project .env unless you are ready to replace the live values.

```env
BITDEFENDER_API_URL=https://cloud.gravityzone.bitdefender.com/api/v1.0/jsonrpc
BITDEFENDER_API_KEY=YOUR_REAL_API_KEY
BITDEFENDER_PACKAGE_ID=YOUR_REAL_PACKAGE_ID
BITDEFENDER_PACKAGE_NAME=YOUR_REAL_PACKAGE_NAME
BITDEFENDER_SCAN_RUN_LIMIT=3
BITDEFENDER_HOSTNAME=apples-macbook-pro.local
VALIDATION_AUTH_TOKEN=YOUR_JWT_TOKEN
```

## 2) Check API key validity
This verifies the key is accepted by GravityZone.

```bash
node bitdefender-live-validation.js
```

You should see a successful result for the `getEndpointsList` call.

## 3) Check the endpoint list and hostname match
The script will query GravityZone using the configured hostname:

```text
apples-macbook-pro.local
```

It will return matching endpoint records if the device is enrolled correctly.

## 4) Register the device in the app
Once you have a valid JWT, the script can register the device and then attempt the scan.

## 5) Start the antivirus scan
The project expects a valid `bitdefenderEndpointId` to exist before scan start.

If the device has not been mapped, the backend will return:

```json
{
  "success": false,
  "message": "Bitdefender is not installed on your device yet."
}
```

## 6) Expected healthy flow
When everything is correctly connected:

1. API key validates against GravityZone
2. endpoint list loads successfully
3. hostname matches a GravityZone endpoint
4. app records the endpointId for the user
5. `/api/self-help/start` with `toolId: "antivirus-scan"` succeeds
6. scan status can be polled, and the result can be displayed in the platform

## 7) Known blockers
The most common blockers are:

- wrong BITDEFENDER_API_URL base
- API key invalid or from wrong region/account
- package not found or not published
- hostname mismatch between local machine and GravityZone agent name
- no endpoint map stored for the logged-in user

## 8) Current diagnosis for your environment
Your Bitdefender app details show the endpoint is online and active, which is good.
The remaining issue is in the project integration layer, especially the hostname mapping and the exact JSON-RPC base URL.
