using System;
using System.IO;
using System.Management;
using System.Net.Http;
using System.Net.Http.Json;
using System.Windows.Forms;

const string CallbackFilePrefix = "NVT-Device-Info--";
const string PublicApiBaseUrl = "https://essentials.newvtech.com/api";

static bool IsHexObjectId(string value)
{
    if (value.Length != 24) return false;
    foreach (var character in value) if (!Uri.IsHexDigit(character)) return false;
    return true;
}

static bool IsWriteToken(string value)
{
    if (value.Length < 32 || value.Length > 128) return false;
    foreach (var character in value) if (!(char.IsLetterOrDigit(character) || character == '-' || character == '_')) return false;
    return true;
}

static string ReadCallbackFromFilename()
{
    var path = Environment.ProcessPath;
    var filename = string.IsNullOrWhiteSpace(path) ? "" : Path.GetFileNameWithoutExtension(path);
    if (!filename.StartsWith(CallbackFilePrefix, StringComparison.Ordinal)) return null;
    var parts = filename.Substring(CallbackFilePrefix.Length).Split("--", StringSplitOptions.None);
    if (parts.Length != 2 || !IsHexObjectId(parts[0]) || !IsWriteToken(parts[1])) return null;
    return $"{PublicApiBaseUrl}/device-identity/requests/{parts[0]}/result?token={parts[1]}";
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
