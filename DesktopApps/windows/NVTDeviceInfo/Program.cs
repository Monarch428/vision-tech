using System;
using System.IO;
using System.Management;
using System.Net.Http;
using System.Net.Http.Json;
using System.Windows.Forms;

const string CallbackFilePrefix = "NVT-Device-Info-";
const string PublicApiBaseUrl = "https://essentials.newvtech.com/api";

static bool IsCallbackCode(string value)
{
    if (value.Length != 6) return false;
    foreach (var character in value) if (!(char.IsLetterOrDigit(character))) return false;
    return true;
}

static string ReadCallbackFromFilename()
{
    var path = Environment.ProcessPath;
    var filename = string.IsNullOrWhiteSpace(path) ? "" : Path.GetFileNameWithoutExtension(path);
    if (!filename.StartsWith(CallbackFilePrefix, StringComparison.Ordinal)) return null;
    var callbackCode = filename.Substring(CallbackFilePrefix.Length);
    if (!IsCallbackCode(callbackCode)) return null;
    return $"{PublicApiBaseUrl}/device-identity/requests/callback/{callbackCode}/result";
}

var callback = Environment.GetEnvironmentVariable("NVT_DEVICE_INFO_CALLBACK") ?? ReadCallbackFromFilename();
if (string.IsNullOrWhiteSpace(callback))
{
    MessageBox.Show("This helper filename is invalid. Download a new NVT Device Info helper and run it without renaming it.", "NVT Device Info", MessageBoxButtons.OK, MessageBoxIcon.Error);
    return;
}

var serial = "";
try { foreach (ManagementObject bios in new ManagementObjectSearcher("SELECT SerialNumber FROM Win32_BIOS").Get()) { serial = Convert.ToString(bios["SerialNumber"])?.Trim() ?? ""; break; } } catch { /* Hardware serial unavailable: never invent one. */ }
try {
    using var client = new HttpClient();
    var response = await client.PostAsJsonAsync(callback, new { hostname = Environment.MachineName, serialNumber = serial, platform = "windows" });
    if (!response.IsSuccessStatusCode) throw new HttpRequestException($"The request was not accepted ({(int)response.StatusCode}).");
} catch (Exception error) {
    MessageBox.Show($"Device details could not be shared. {error.Message} Download a new helper and try again.", "NVT Device Info", MessageBoxButtons.OK, MessageBoxIcon.Error);
}
