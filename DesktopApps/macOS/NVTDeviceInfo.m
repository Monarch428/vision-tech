#import <Cocoa/Cocoa.h>
#import <IOKit/IOKitLib.h>

static NSString *serialNumber(void) {
  io_registry_entry_t service = IOServiceGetMatchingService(kIOMainPortDefault, IOServiceMatching("IOPlatformExpertDevice"));
  if (!service) return @"";
  CFTypeRef value = IORegistryEntryCreateCFProperty(service, CFSTR("IOPlatformSerialNumber"), kCFAllocatorDefault, 0);
  IOObjectRelease(service);
  if (!value) return @"";
  id object = CFBridgingRelease(value);
  return [object isKindOfClass:[NSString class]] ? (NSString *)object : @"";
}

static NSURL *writeDeviceInfo(NSError **error) {
  NSString *hostname = [[NSHost currentHost] localizedName] ?: [[NSProcessInfo processInfo] hostName];
  NSDictionary *info = @{
    @"hostname": hostname ?: @"",
    @"serialNumber": serialNumber(),
    @"platform": @"darwin",
    @"collectedAt": [[NSISO8601DateFormatter new] stringFromDate:[NSDate date]],
  };
  NSData *json = [NSJSONSerialization dataWithJSONObject:info options:NSJSONWritingPrettyPrinted error:error];
  if (!json) return nil;
  NSURL *desktop = [[[NSFileManager defaultManager] URLsForDirectory:NSDesktopDirectory inDomains:NSUserDomainMask] firstObject];
  if (!desktop) desktop = [NSURL fileURLWithPath:NSHomeDirectory()];
  NSURL *destination = [desktop URLByAppendingPathComponent:@"device-info.json"];
  return [json writeToURL:destination options:NSDataWritingAtomic error:error] ? destination : nil;
}

// The website puts this value on the clipboard immediately before the user
// downloads the app. The app reads it before replacing the clipboard with the
// JSON, so it can return only to the page that launched the download.
static NSString *returnURLFromPasteboard(void) {
  NSString *value = [[NSPasteboard generalPasteboard] stringForType:NSPasteboardTypeString];
  NSString *prefix = @"nvt-device-info-callback:";
  return [value hasPrefix:prefix] ? [value substringFromIndex:prefix.length] : nil;
}

static void openReturnURL(NSURL *deviceInfoURL, NSString *returnURL) {
  if (!returnURL.length || !deviceInfoURL) return;
  NSData *data = [NSData dataWithContentsOfURL:deviceInfoURL];
  if (!data) return;
  NSString *payload = [data base64EncodedStringWithOptions:0];
  payload = [[payload stringByReplacingOccurrencesOfString:@"+" withString:@"-"] stringByReplacingOccurrencesOfString:@"/" withString:@"_"];
  payload = [payload stringByReplacingOccurrencesOfString:@"=" withString:@""];
  NSRange hash = [returnURL rangeOfString:@"#"];
  if (hash.location != NSNotFound) returnURL = [returnURL substringToIndex:hash.location];
  NSURL *url = [NSURL URLWithString:[returnURL stringByAppendingFormat:@"#nvt-device-info=%@", payload]];
  if (url) [[NSWorkspace sharedWorkspace] openURL:url];
}

int main(int argc, const char * argv[]) {
  @autoreleasepool {
    [NSApplication sharedApplication];
    [NSApp setActivationPolicy:NSApplicationActivationPolicyAccessory];
    [NSApp activateIgnoringOtherApps:YES];
    NSAlert *consent = [NSAlert new];
    consent.messageText = @"Allow NVT Device Info to collect this Mac’s details?";
    consent.informativeText = @"It will read this Mac’s name and hardware serial number, then create device-info.json on your Desktop. It does not send information to NVT or any other service.";
    [consent addButtonWithTitle:@"Create device-info.json"];
    [consent addButtonWithTitle:@"Cancel"];
    if ([consent runModal] != NSAlertFirstButtonReturn) return 0;

    NSString *returnURL = returnURLFromPasteboard();
    NSError *error = nil;
    NSURL *destination = writeDeviceInfo(&error);
    if (!destination) {
      [[NSAlert alertWithError:error] runModal];
      return 1;
    }
    NSData *clipboardData = [NSData dataWithContentsOfURL:destination];
    if (clipboardData) {
      NSPasteboard *pasteboard = [NSPasteboard generalPasteboard];
      [pasteboard clearContents];
      [pasteboard setData:clipboardData forType:NSPasteboardTypeString];
    }
    openReturnURL(destination, returnURL);
    NSAlert *done = [NSAlert new];
    done.messageText = @"Device information saved";
    done.informativeText = returnURL.length ? @"Created device-info.json and returned to NVT, where the details are filled automatically." : @"Created device-info.json on your Desktop and copied the details. Return to NVT and choose Paste & fill device details.";
    [done addButtonWithTitle:@"Show File"];
    [done addButtonWithTitle:@"Done"];
    if ([done runModal] == NSAlertFirstButtonReturn) {
      [[NSWorkspace sharedWorkspace] activateFileViewerSelectingURLs:@[destination]];
    }
  }
  return 0;
}
