# YouTu - YouTube Windows PiP Extension

A powerful Chrome/Chromium extension that detects YouTube videos and communicates with a companion Windows application to provide seamless custom Picture-in-Picture functionality. This extension bypasses browser PiP limitations by working with a dedicated Windows app through native messaging.

## 🚧 **Current Status: IN DEVELOPMENT** ⚠️

While significant progress has been made on architecture and error handling, **the core PiP functionality is not yet working**. No PiP windows have been successfully created despite extensive troubleshooting.

### ✨ **Key Features**
- **🎯 Automatic Video Detection**: Intelligently detects YouTube videos and extracts comprehensive video information
- **🔄 Smart Tab Management**: Monitors tab switching and automatically creates/closes PiP windows
- **💬 Native Messaging Communication**: Secure communication with Windows app via Chrome's native messaging API
- **🔗 Robust Connection Management**: Automatic retry logic with exponential backoff (up to 3 attempts)
- **💓 Heartbeat Monitoring**: Proactive connection health monitoring every 10 seconds
- **🛡️ Advanced Error Handling**: Comprehensive error validation with user-friendly notifications
- **📊 Enhanced Logging**: Detailed timestamped logs for debugging and monitoring
- **🔧 Message Validation**: Input validation and sanitization for all communications
- **🌐 Browser Compatibility**: Works with Chrome, Chromium, Thorium, and other Chromium-based browsers

### 🏗️ **Architecture Overview**
```
YouTube Page → Extension Content Script → Background Service Worker → Native Messaging → Windows Proxy → Windows App → PiP Window
```

### 📋 **Completed Improvements**
- ✅ **Enhanced Error Handling**: Comprehensive error validation and user notifications
- ✅ **Connection Validation**: Retry mechanisms with intelligent backoff
- ✅ **Heartbeat System**: Bidirectional connection health monitoring
- ✅ **Message Protocol**: Consistent JSON serialization and validation
- ✅ **Logging System**: Detailed debug logging with timestamps
- ✅ **Input Validation**: Robust data validation and sanitization
- ✅ **Browser Support**: Universal Chromium browser compatibility

### 🚨 **Current Issues & Problems**

#### **❌ Primary Issue: Native Messaging Host Not Found**
- **Error**: `Unchecked runtime.lastError: Specified native messaging host not found`
- **Impact**: Extension cannot communicate with Windows application
- **Status**: Persistent issue despite multiple registry registration attempts
- **Browsers Tested**: Chrome, Thorium, Chromium
- **Registry Paths Tried**: All standard Chrome/Chromium paths

#### **❌ No PiP Windows Created**
- **Problem**: Despite video detection and tab switching, no PiP windows appear
- **Video Detection**: ✅ Working (videos are detected correctly)
- **Tab Switching**: ✅ Working (extension detects tab changes)
- **Communication**: ❌ Failing (cannot reach Windows app)
- **Result**: Videos pause but no PiP window is created

#### **❌ Browser Compatibility Issues**
- **Thorium Browser**: Main target browser, native messaging not working
- **Chrome**: Registry paths exist but communication still fails
- **Edge/Chromium**: Similar communication failures
- **Issue**: Each browser may use different native messaging implementations

#### **🔍 Troubleshooting Attempts Made**
1. **Registry Registration**: Multiple paths tried (Chrome, Thorium, Chromium)
2. **Manifest Validation**: File exists and contains correct paths
3. **Process Verification**: Both main app and proxy confirmed running
4. **Path Verification**: Proxy executable exists and is accessible
5. **Permission Testing**: Tried running as Administrator
6. **Cache Clearing**: Attempted browser cache clearing (caused extension removal)
7. **Directory Registration**: Tried both registry and directory-based registration

#### **🤔 Suspected Root Causes**
1. **Browser-Specific Implementation**: Thorium may use non-standard native messaging
2. **Security Restrictions**: Windows/browser security blocking communication
3. **Path Issues**: Manifest path may not be resolving correctly
4. **Extension ID Mismatch**: Dynamic extension IDs may not match manifest
5. **Proxy Communication**: Issue between proxy and main Windows application

### 🎯 **Next Steps Required**
1. **Browser Investigation**: Research Thorium-specific native messaging requirements
2. **Alternative Communication**: Consider WebSocket or HTTP-based communication
3. **Debugging Tools**: Implement more detailed native messaging diagnostics
4. **Simplified Testing**: Create minimal test case to isolate the issue
5. **Alternative Browsers**: Test with standard Chrome to rule out Thorium-specific issues

## 🏗️ **System Architecture**

This extension is part of a sophisticated two-component system:

1. **🌐 Chrome Extension** (this repository): Video detection, tab management, and browser communication
2. **🖥️ Windows Application** (companion repository): PiP window creation and video rendering

### **Communication Flow:**
```
Browser Tab Switch → Content Script → Background Worker → Native Messaging → Proxy → Windows App → PiP Window Creation
```

## 📦 **Installation & Setup**

### **Prerequisites**
- Windows 10/11 (64-bit)
- Chrome, Chromium, Thorium, or compatible Chromium-based browser
- .NET 9.0 Runtime (for Windows app)
- WebView2 Runtime (usually pre-installed on Windows 11)

### **Step 1: Install Chrome Extension**

1. **Download/Clone** this repository
2. **Open Browser Extensions**:
   - Chrome: `chrome://extensions`
   - Thorium: `thorium://extensions`
   - Edge: `edge://extensions`
3. **Enable "Developer mode"** (toggle in top right)
4. **Click "Load unpacked"** and select the `yt-auto-pip_extension` folder
5. **Verify**: Extension icon should appear in toolbar

### **Step 2: Install Windows Application**

1. **Download** the companion Windows application
2. **Build** the application using the provided scripts
3. **Register** native messaging (automatic via setup script)
4. **Start** the Windows application (runs in system tray)

### **Step 3: Test Connection**

1. **Open Browser DevTools** (`F12` → Console tab)
2. **Navigate to YouTube** and play any video
3. **Look for connection messages**:
   ```
   [timestamp] Connected to Windows app service successfully
   [timestamp] Received heartbeat response from Windows app
   ```
4. **Test PiP**: Switch tabs while video is playing
5. **Success**: PiP window should appear with video

## Development Progress

### Phase 1: Extension Development ✅
- [x] Created manifest.json with proper permissions
- [x] Implemented background.js service worker
- [x] Built content.js for YouTube video detection
- [x] Created popup UI for settings
- [x] Added native messaging support
- [x] Fixed extension ID configuration

### Phase 2: Native Messaging Integration 🔧
- [x] Configured native messaging manifest
- [x] Added `nativeMessaging` permission
- [x] Implemented `connectNative()` communication
- [x] Fixed extension ID: `mmhpkloajoohbnjpdbbpmneldidhmapi`
- [ ] **BLOCKED**: Windows app service integration

### Phase 3: Windows App Integration 🚧
- [ ] Configure Windows app for native messaging service
- [ ] Implement service proxy or hybrid model
- [ ] Test end-to-end communication
- [ ] Verify PiP window creation

## Usage

1. **Start the Windows app** (runs in system tray)
2. **Navigate to any YouTube video** and start playing
3. **Switch to a different tab** - the Windows app will create a custom PiP window
4. **Use the PiP controls** (play/pause/close/resize/return to tab)
5. **Switch back to YouTube tab** - the PiP window closes automatically

## Configuration

Click the extension icon in the toolbar to configure:

- **Enable Video Detection**: Turn on/off video detection
- **Show Notifications**: Display connection status notifications
- **Auto-Connect to Windows App**: Automatically connect on startup

## Technical Details

### Extension Components

- **Manifest V3**: Modern Chrome extension architecture
- **Service Worker**: Background tab management and Windows app communication
- **Content Scripts**: YouTube video detection and data extraction
- **Native Messaging**: Communication with Windows application via Named Pipes

### Communication Protocol

The extension sends structured data to the Windows app:

```json
{
  "action": "create_pip",
  "videoUrl": "https://www.youtube.com/watch?v=VIDEO_ID",
  "videoTitle": "Video Title",
  "currentTime": 123.45,
  "isPlaying": true,
  "volume": 0.8,
  "playbackRate": 1.0,
  "tabId": 12345,
  "windowId": 67890
}
```

### Data Extracted

- Video URL and title
- Current playback time
- Play/pause state
- Volume level
- Playback rate
- Tab and window IDs

## File Structure

```
youtube-auto-pip/
├── manifest.json                    # Extension manifest
├── background.js                    # Service worker for communication
├── content.js                       # Video detection and data extraction
├── popup.html                       # Settings UI
├── popup.js                         # Settings logic
├── native-messaging-manifest.json   # Windows app communication config
├── WINDOWS_APP_PROMPT.md            # Windows app specifications
├── icons/                           # Extension icons
└── README.md                        # This file
```

## Windows App Integration

The Windows application provides:

- **Custom PiP Window**: Native Windows window with video controls
- **Always-on-Top**: Stays above other windows
- **Resizable**: Drag to resize, maintain aspect ratio
- **System Integration**: Minimize to tray, global hotkeys
- **Perfect Sync**: Real-time video state synchronization

## Advantages Over Browser PiP

- **No Restrictions**: Bypasses all browser PiP limitations
- **No User Gestures**: No need for user interaction
- **Better Performance**: Native Windows rendering
- **Advanced Features**: Custom controls, multiple windows, etc.
- **Cross-Browser**: Works with any Chromium-based browser
- **Persistent**: Survives browser crashes

## Troubleshooting

### Current Known Issues

#### Native Messaging Service Integration
**Problem**: Chrome's native messaging expects to launch applications, but the Windows app runs as a persistent service.

**Symptoms**:
- "Native host has exited" errors
- "Error when communicating with the native messaging host"
- "Already running" popups every second
- No PiP window creation

**Root Cause**: Chrome's `connectNative()` tries to launch `YouTuPiP.exe`, but it's already running as a service.

**Solution Required**: Windows app needs to be restructured for native messaging service compatibility.

### Extension Issues

1. **Check extension status** in `chrome://extensions`
2. **Verify permissions** include YouTube sites and `nativeMessaging`
3. **Check console** for error messages
4. **Reload extension** if needed

### Windows App Connection Issues

1. **Ensure Windows app is running** (check system tray)
2. **Check native messaging registration** in Windows Registry
3. **Verify extension ID** in native messaging manifest: `mmhpkloajoohbnjpdbbpmneldidhmapi`
4. **Check Windows app logs** for message reception

### Video Detection Issues

1. **Refresh YouTube page** if video not detected
2. **Check video is playing** (not paused)
3. **Verify YouTube URL** format
4. **Check console logs** for detection messages

### Debugging Steps

1. **Open Chrome DevTools** (F12)
2. **Check Console tab** for extension messages
3. **Look for**:
   - "Connecting to existing Windows app service..."
   - "Connected to Windows app service successfully"
   - "Sending message to Windows app: {action: 'create_pip'...}"
4. **Check Windows app logs** for received messages
5. **Verify native messaging manifest** is properly registered

## Development

### Building the Extension

1. Clone this repository
2. Load as unpacked extension in Chrome
3. Make changes and reload extension
4. Test with Windows app

### Testing Communication

1. Open browser console
2. Look for "Sending video data to Windows app" messages
3. Check Windows app logs for received messages
4. Verify data format matches protocol specification

## Requirements

- **Chrome/Chromium**: Version 88+ (Manifest V3 support)
- **Windows**: Windows 10/11 (for Windows app)
- **YouTube**: Any YouTube video page

## Known Limitations

- Requires Windows application for PiP functionality
- Native messaging only works on Windows
- Initial setup requires both extension and Windows app installation
- **Current**: Windows app must be restructured for native messaging service compatibility

## Technical Challenges Resolved

### Extension Development
- ✅ Manifest V3 compliance
- ✅ Service worker implementation
- ✅ YouTube video detection
- ✅ Tab switching detection
- ✅ Native messaging API integration
- ✅ Extension ID configuration

### Native Messaging Integration
- ✅ Registry configuration
- ✅ Extension ID mapping
- ✅ Permission setup
- ❌ **BLOCKED**: Service vs Launch model conflict

### Windows App Integration
- ❌ **PENDING**: Service proxy implementation
- ❌ **PENDING**: Hybrid launch/service model
- ❌ **PENDING**: Message processing
- ❌ **PENDING**: PiP window creation

## License

This project is open source. See the Windows app repository for its specific license.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review console logs
3. Check Windows app logs
4. Open an issue with detailed information