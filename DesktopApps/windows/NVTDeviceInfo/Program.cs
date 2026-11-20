using System;
using System.Management;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Windows.Forms;

ApplicationConfiguration.Initialize();
var callback = Environment.GetEnvironmentVariable("NVT_DEVICE_INFO_CALLBACK");
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
