# NVT Device Info — macOS pilot

This unsigned pilot is a small double-click macOS app. With user approval, it
creates `device-info.json` on the Desktop containing the computer name and
hardware serial number. It does not make network requests or install a
background service.

Because it is unsigned, macOS will warn that the developer cannot be verified.
Pilot testers must use Finder: Control-click the app, select **Open**, then
select **Open** again. Do not distribute this build to production customers.

Build the distributable ZIP from the repository root with:

```sh
./DesktopApps/macOS/build-pilot.sh
```
