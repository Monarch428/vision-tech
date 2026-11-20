# NVT Device Info — Linux pilot

There is no safe, double-click Linux artifact produced from this macOS build
host. A production Linux release should be built on Linux as an AppImage (and,
where needed, `.deb` and `.rpm` packages), signed, and tested on supported
desktop distributions. Until a signed Linux package is produced, the website
generates a per-download shell collector. It saves a local JSON file, opens
the originating form, and fills hostname and serial number automatically. The
returned data is in a URL fragment and is not sent to the server.
