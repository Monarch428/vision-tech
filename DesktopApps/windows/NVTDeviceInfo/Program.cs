using System;
using System.IO;
using System.Management;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text;
using System.Windows.Forms;

const string CallbackFilePrefix = "NVT-Device-Info--";

static string ReadCallbackFromFilename()
{
    var path = Environment.ProcessPath;
    var filename = string.IsNullOrWhiteSpace(path) ? "" : Path.GetFileNameWithoutExtension(path);
    if (!filename.StartsWith(CallbackFilePrefix, StringComparison.Ordinal)) return null;
    var encoded = filename.Substring(CallbackFilePrefix.Length);
    var suffix = encoded.IndexOf(' '); // Chrome may append " (1)" to duplicate downloads.
    if (suffix >= 0) encoded = encoded.Substring(0, suffix);
    if (encoded.Length == 0 || encoded.Length > 240) return null;
    try {
        var padded = encoded.Replace('-', '+').Replace('_', '/');
        padded = padded.PadRight(padded.Length + (4 - padded.Length % 4) % 4, '=');
        var callback = Encoding.UTF8.GetString(Convert.FromBase64String(padded));
        if (!Uri.TryCreate(callback, UriKind.Absolute, out var uri)) return null;
        return uri.Scheme == Uri.UriSchemeHttps || (uri.Scheme == Uri.UriSchemeHttp && uri.IsLoopback) ? callback : null;
    } catch (FormatException) { return null; }
}

ApplicationConfiguration.Initialize();
var callback = Environment.GetEnvironmentVariable("NVT_DEVICE_INFO_CALLBACK") ?? ReadCallbackFromFilename();
if (string.IsNullOrWhiteSpace(callback)) {
    MessageBox.Show("This helper must be downloaded from Vision Tech so it has a one-time request link.", "NVT Device Info", MessageBoxButtons.OK, MessageBoxIcon.Warning);
    return;
}
if (MessageBox.Show("Share this computer's hostname and hardware serial number with Vision Tech?", "NVT Device Info", MessageBoxButtons.YesNo, MessageBoxIcon.Question) != DialogResult.Yes) return;
var serial = "";
try { foreach (ManagementObject bios in new ManagementObjectSearcher("SELECT SerialNumber FROM Win32_BIOS").Get()) { serial = Convert.ToString(bios["SerialNumber"])?.Trim() ?? ""; break; } } catch { /* Hardware serial unavailable: never invent one. */ }
try {
    using var client = new HttpClient();
    var response = await client.PostAsJsonAsync(callback, new { hostname = Environment.MachineName, serialNumber = serial, platform = "windows" });
    if (!response.IsSuccessStatusCode) throw new HttpRequestException();
    MessageBox.Show("Device details shared. Return to the Vision Tech browser tab.", "NVT Device Info", MessageBoxButtons.OK, MessageBoxIcon.Information);
} catch {
    MessageBox.Show("Could not share device details. Check your connection and start a new request in Vision Tech.", "NVT Device Info", MessageBoxButtons.OK, MessageBoxIcon.Error);
}
