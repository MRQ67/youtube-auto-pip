# YouTu - YouTube Windows PiP

A Chrome extension that detects YouTube videos and communicates with a Windows application to provide seamless custom Picture-in-Picture functionality. This extension bypasses browser PiP restrictions by working with a dedicated Windows app.

## Features

- **Automatic Video Detection**: Detects YouTube videos and extracts video information
- **Tab Switching Detection**: Monitors when you switch away from YouTube tabs
- **Windows App Communication**: Sends video data to a custom Windows PiP application
- **Seamless Integration**: Works with any Chromium-based browser
- **No Browser Restrictions**: Bypasses all PiP API limitations and user gesture requirements
- **Real-time Sync**: Maintains perfect synchronization between browser and Windows app

## Architecture

This extension is part of a two-component system:

1. **Chrome Extension** (this repo): Detects videos and sends data
2. **Windows Application** (separate repo): Creates custom PiP windows

## Installation

### Chrome Extension

1. Open Chrome and navigate to `chrome://extensions`
2. Enable "Developer mode" in the top right corner
3. Click "Load unpacked" and select this extension directory
4. The extension icon should now appear in your toolbar

### Windows Application

1. Download and install the Windows application (see `WINDOWS_APP_PROMPT.md`)
2. Register the native messaging manifest
3. The extension will automatically connect to the Windows app

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

### Extension Issues

1. **Check extension status** in `chrome://extensions`
2. **Verify permissions** include YouTube sites
3. **Check console** for error messages
4. **Reload extension** if needed

### Windows App Connection Issues

1. **Ensure Windows app is running** (check system tray)
2. **Check native messaging registration**
3. **Verify extension ID** in native messaging manifest
4. **Restart both extension and Windows app**

### Video Detection Issues

1. **Refresh YouTube page** if video not detected
2. **Check video is playing** (not paused)
3. **Verify YouTube URL** format
4. **Check console logs** for detection messages

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