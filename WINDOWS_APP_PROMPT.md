# Windows Application Development Prompt: Custom Picture-in-Picture Player

## Project Overview
Create a Windows desktop application that receives video data from a Chrome extension and displays it in a custom Picture-in-Picture window. The app must provide seamless video playback with minimal controls and maximum performance.

## Tech Stack Requirements
- **Framework**: C# WPF (.NET 6 or later)
- **Video Rendering**: WebView2 (Microsoft Edge WebView2)
- **Communication**: Named Pipes for IPC with Chrome extension
- **Window Management**: Native WPF window controls
- **System Integration**: System tray support

## Core Features (Minimal Set)

### 1. **Play/Pause Control**
- Single button that toggles video playback
- Visual state indication (play icon vs pause icon)
- Instant response (<10ms)
- Send play/pause commands to WebView2

### 2. **Close Control**
- Close button to terminate PiP window
- Restore original video state in browser
- Send "close" command back to extension
- Clean up all resources

### 3. **Resize Functionality**
- Native WPF window resizing
- Maintain aspect ratio during resize
- Smooth video scaling in WebView2
- Minimum size: 320x180px
- Maximum size: 1920x1080px

### 4. **Return to Tab**
- Button to close PiP and focus original browser tab
- Send "return_to_tab" command to extension
- Restore video state in browser
- Focus browser window

## Communication Protocol

### **Named Pipe Configuration**
- **Pipe Name**: `YouTuPiP_Communication`
- **Direction**: Bidirectional
- **Format**: JSON messages
- **Encoding**: UTF-8

### **Message Types (Incoming from Extension)**

#### **CREATE_PIP**
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

#### **UPDATE_STATE**
```json
{
  "action": "update_state",
  "currentTime": 125.67,
  "isPlaying": false,
  "volume": 0.9,
  "playbackRate": 1.25
}
```

#### **CLOSE_PIP**
```json
{
  "action": "close_pip",
  "reason": "user_requested" | "tab_closed" | "video_ended"
}
```

### **Message Types (Outgoing to Extension)**

#### **PIP_CREATED**
```json
{
  "action": "pip_created",
  "success": true,
  "windowHandle": 123456,
  "error": null
}
```

#### **PIP_CLOSED**
```json
{
  "action": "pip_closed",
  "reason": "user_close" | "user_return_to_tab" | "app_closed",
  "finalTime": 130.25,
  "wasPlaying": false
}
```

#### **STATE_CHANGE**
```json
{
  "action": "state_change",
  "currentTime": 128.90,
  "isPlaying": true,
  "volume": 0.7,
  "playbackRate": 1.0
}
```

#### **ERROR**
```json
{
  "action": "error",
  "errorType": "video_load_failed" | "communication_error" | "window_creation_failed",
  "message": "Detailed error description",
  "code": "ERROR_CODE"
}
```

## Window Specifications

### **Default Window Properties**
- **Size**: 640x360px (16:9 aspect ratio)
- **Position**: Top-right corner of screen (20px from edges)
- **Always on top**: Yes
- **Resizable**: Yes
- **Minimizable**: Yes (to system tray)
- **Closeable**: Yes
- **Title**: "YouTu PiP - [Video Title]"

### **Window Styling**
- **Background**: Black (#000000)
- **Border**: 2px solid #ff0000 (YouTube red)
- **Border radius**: 8px
- **Shadow**: Drop shadow for depth
- **Controls**: Minimal, YouTube-style controls

### **Control Layout**
```
┌─────────────────────────────────┐
│ [Video Content Area - WebView2] │
│                                 │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ [⏸️] [❌] [📱] [⏹️]        │ │ <- Control bar
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

### **Control Buttons**
- **Play/Pause**: ⏸️/▶️ (24x24px)
- **Close**: ❌ (24x24px)
- **Return to Tab**: 📱 (24x24px)
- **Resize Handle**: Corner/edge drag areas

## Video Rendering Specifications

### **WebView2 Configuration**
- **Engine**: Microsoft Edge WebView2 Runtime
- **Hardware acceleration**: Enabled
- **JavaScript**: Enabled
- **Media autoplay**: Enabled
- **Fullscreen**: Disabled
- **Context menu**: Disabled

### **Video Player Implementation**
- **Method**: Load YouTube URL in WebView2
- **Player controls**: Hide YouTube's native controls
- **Custom controls**: Overlay custom control bar
- **Responsive**: Scale video to fit window size
- **Quality**: Maintain original video quality

### **Video State Management**
- **Time sync**: Sync with browser video time
- **Playback sync**: Sync play/pause state
- **Volume sync**: Sync volume level
- **Speed sync**: Sync playback rate
- **Update frequency**: Every 100ms

## System Integration

### **System Tray**
- **Icon**: YouTu logo (16x16px)
- **Tooltip**: "YouTu PiP Player"
- **Context menu**: 
  - "Show PiP Window"
  - "Hide PiP Window"
  - "Settings"
  - "Exit"

### **Window Management**
- **Minimize to tray**: Yes
- **Restore from tray**: Yes
- **Multiple windows**: Support up to 3 PiP windows
- **Window positioning**: Remember last position
- **Window sizing**: Remember last size

### **Hotkeys (Optional)**
- **Ctrl+Shift+P**: Toggle PiP window visibility
- **Space**: Play/pause current video
- **Escape**: Close PiP window
- **Ctrl+R**: Return to tab

## Performance Requirements

### **Resource Usage**
- **Memory**: <50MB per PiP window
- **CPU**: <5% additional usage
- **GPU**: Hardware accelerated
- **Startup time**: <2 seconds
- **Window creation**: <100ms

### **Responsiveness**
- **Play/pause response**: <10ms
- **Window resize**: Smooth, no lag
- **State updates**: <50ms latency
- **Communication**: <5ms message processing

## Error Handling

### **Video Loading Errors**
- **Network issues**: Retry mechanism (3 attempts)
- **Invalid URL**: Show error message, close window
- **Video not available**: Show error message, close window
- **WebView2 not available**: Show installation prompt

### **Communication Errors**
- **Pipe connection lost**: Attempt reconnection
- **Invalid message format**: Log error, ignore message
- **Extension not responding**: Show warning, continue operation

### **Window Creation Errors**
- **Insufficient permissions**: Show error dialog
- **Screen resolution issues**: Adjust window size
- **Multiple monitor issues**: Detect primary monitor

## Installation Requirements

### **Prerequisites**
- **Windows 10/11**: x64 architecture
- **.NET 6 Runtime**: Minimum required
- **WebView2 Runtime**: Microsoft Edge WebView2
- **Visual C++ Redistributable**: Latest version

### **Installation Process**
1. **Download**: Single executable file
2. **Install**: Run installer or portable version
3. **First run**: Auto-detect Chrome extension
4. **Configuration**: Minimal setup required

### **Auto-Update**
- **Check for updates**: On startup
- **Download updates**: In background
- **Install updates**: With user permission
- **Version compatibility**: Check extension compatibility

## Security Considerations

### **Communication Security**
- **Named pipes**: Local machine only
- **Message validation**: Validate all incoming data
- **Input sanitization**: Sanitize video URLs
- **Error logging**: Log security-related events

### **Video Content**
- **URL validation**: Only allow YouTube URLs
- **Content filtering**: Block inappropriate content
- **Privacy**: No data collection or transmission

## Testing Requirements

### **Functional Testing**
- **Video playback**: Test various YouTube videos
- **Control functionality**: Test all buttons
- **Window management**: Test resize, move, minimize
- **Communication**: Test all message types

### **Performance Testing**
- **Resource usage**: Monitor memory and CPU
- **Response times**: Measure all operations
- **Stress testing**: Multiple PiP windows
- **Compatibility**: Test on different Windows versions

### **Integration Testing**
- **Chrome extension**: Test full workflow
- **Multiple browsers**: Test with different browsers
- **System integration**: Test tray, hotkeys, etc.

## File Structure
```
YouTuPiP/
├── YouTuPiP.exe                 # Main executable
├── YouTuPiP.dll                 # Core library
├── WebView2Loader.dll           # WebView2 loader
├── config.json                  # Configuration file
├── logs/                        # Log files directory
└── updates/                     # Update files directory
```

## Configuration File (config.json)
```json
{
  "window": {
    "defaultWidth": 640,
    "defaultHeight": 360,
    "defaultPosition": "top-right",
    "alwaysOnTop": true,
    "rememberPosition": true,
    "rememberSize": true
  },
  "video": {
    "updateInterval": 100,
    "quality": "auto",
    "autoplay": true,
    "mute": false
  },
  "communication": {
    "pipeName": "YouTuPiP_Communication",
    "timeout": 5000,
    "retryAttempts": 3
  },
  "system": {
    "minimizeToTray": true,
    "startWithWindows": false,
    "checkForUpdates": true
  }
}
```

## Success Criteria
- **Seamless transition**: Video appears in PiP within 300ms
- **Perfect sync**: Video state matches browser exactly
- **Smooth controls**: All controls respond instantly
- **Stable operation**: No crashes or memory leaks
- **User-friendly**: Intuitive interface and controls

## Deliverables
1. **Executable**: Single .exe file or installer
2. **Documentation**: User manual and technical docs
3. **Source code**: Complete C# WPF project
4. **Configuration**: Default config files
5. **Testing**: Test suite and results

This Windows application must work seamlessly with the Chrome extension to provide a superior Picture-in-Picture experience that bypasses all browser restrictions while maintaining perfect video synchronization and user experience.
