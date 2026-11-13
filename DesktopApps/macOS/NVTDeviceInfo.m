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

    NSError *error = nil;
    NSURL *destination = writeDeviceInfo(&error);
    if (!destination) {
      [[NSAlert alertWithError:error] runModal];
      return 1;
    }
    NSAlert *done = [NSAlert new];
    done.messageText = @"Device information saved";
    done.informativeText = @"Created device-info.json on your Desktop. Return to NVT and choose Import device-info.json.";
    [done addButtonWithTitle:@"Show File"];
    [done addButtonWithTitle:@"Done"];
    if ([done runModal] == NSAlertFirstButtonReturn) {
      [[NSWorkspace sharedWorkspace] activateFileViewerSelectingURLs:@[destination]];
    }
  }
  return 0;
}
