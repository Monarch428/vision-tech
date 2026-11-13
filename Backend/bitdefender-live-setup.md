# Bitdefender GravityZone live setup checklist

## 1) Confirm the account region
Go to Bitdefender GravityZone Control Center and check the access URL.

Use the exact JSON-RPC base URL that matches your account region:

- US / standard: https://cloud.gravityzone.bitdefender.com/api/v1.0/jsonrpc
- APAC: https://cloudap.gravityzone.bitdefender.com/api/v1.0/jsonrpc
- Other regions: use the exact URL shown in your Bitdefender account

The backend expects the base JSON-RPC root, not a specific namespace such as `/network`.

## 2) Create or confirm the API key
In GravityZone:

- Open Control Center
- Go to My Account or API Keys
- Generate an API key for this project
- Copy the full key
- Confirm the key has access to packages and endpoint operations

## 3) Verify the installation package
In GravityZone:

- Open Network > Packages
- Confirm the package is created and published
- Copy:
  - `packageId`
  - `packageName`

Set these values in the environment:

- `BITDEFENDER_PACKAGE_ID`
- `BITDEFENDER_PACKAGE_NAME`

## 4) Set scanning quota
To enforce the app-level limit:

- `BITDEFENDER_SCAN_RUN_LIMIT=3`

This blocks new antivirus scans when the user exceeds the configured limit.

## 5) Validate endpoint connectivity from the backend
Run these from the Backend directory:

```bash
node - <<'NODE'
const axios = require('axios');
const url = process.env.BITDEFENDER_API_URL;
const key = process.env.BITDEFENDER_API_KEY;
axios.post(`${url}/network`, {
  jsonrpc: '2.0',
  id: 1,
  method: 'getEndpointsList',
  params: {}
}, {
  headers: {
    Authorization: 'Basic ' + Buffer.from(`${key}:`).toString('base64'),
    'Content-Type': 'application/json'
  },
  timeout: 20000,
}).then((r) => {
  console.log('STATUS', r.status);
  console.log(JSON.stringify(r.data, null, 2));
}).catch((err) => {
  console.log('ERROR_STATUS', err.response?.status || 'unknown');
  console.log(JSON.stringify(err.response?.data || err.message, null, 2));
});
NODE
```

Expected result:

- HTTP 200 with JSON-RPC result object OR
- a valid GravityZone error payload without HTML

If you see 401, the API key or region URL is wrong.

## 6) Endpoint-by-endpoint verification checklist
Your backend should be able to call these methods successfully:

1. `getEndpointsList`
   - endpoint: `/network`
   - verifies that the key can list registered devices

2. `createScanTask`
   - uses the endpointId for the installed device
   - must be called only after the Bitdefender endpoint is registered

3. `getTaskStatus`
   - checks whether the task is finished, running, or failed

4. `getPackageDetails`
   - resolves packageId to packageName for installer links

5. `getInstallationLinks`
   - returns direct install URLs for the package

## 7) Device installation flow
The application expects this flow:

1. User downloads the installer manually or through the package link
2. User confirms hostname/device registration
3. Backend looks up the endpoint by hostname in GravityZone
4. The endpointId is stored in the device record
5. Quick scan starts using the stored endpointId

## 8) Final recommended env block
```env
BITDEFENDER_API_URL=https://cloudap.gravityzone.bitdefender.com/api/v1.0/jsonrpc
BITDEFENDER_API_KEY=PASTE_YOUR_GRAVITYZONE_API_KEY_HERE
BITDEFENDER_PACKAGE_ID=PASTE_YOUR_PACKAGE_ID_HERE
BITDEFENDER_PACKAGE_NAME=PASTE_YOUR_PACKAGE_NAME_HERE
BITDEFENDER_SCAN_RUN_LIMIT=3
BITDEFENDER_ACCOUNT_REGION=cloudap
```

Do not overwrite the existing project .env values while you are validating the live account. Put the new values into a separate environment file or .env.local during setup.
