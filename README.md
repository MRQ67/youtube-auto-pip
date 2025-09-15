# YouTu - YouTube Auto PiP

A Chrome extension that automatically enables Picture-in-Picture (PiP) mode for YouTube videos when you switch away from YouTube tabs, and automatically exits PiP when you return to the YouTube tab.

## Features

- Automatically enters PiP mode when switching away from a YouTube tab with a playing video
- Automatically exits PiP mode when returning to a YouTube tab
- Works on all YouTube pages (watch, playlist, channel, embedded)
- Lightweight and efficient implementation
- Configurable settings via popup UI

## Installation

1. Open Chrome and navigate to `chrome://extensions`
2. Enable "Developer mode" in the top right corner
3. Click "Load unpacked" and select the extension directory
4. The extension icon should now appear in your toolbar

## Usage

1. Navigate to any YouTube video
2. Start playing the video
3. Switch to a different tab
4. The video should automatically enter Picture-in-Picture mode
5. Switch back to the YouTube tab
6. The video should automatically exit Picture-in-Picture mode

## Configuration

Click the extension icon in the toolbar to open the popup menu where you can:

- Enable/disable auto PiP
- Enable/disable notifications
- Configure channel whitelist

## Technical Details

This extension uses:

- Manifest V3 architecture
- Service worker for background tab management
- Content scripts for YouTube video detection and PiP control
- Modern PiP API for Picture-in-Picture functionality
- Efficient event handling to minimize resource usage

## Troubleshooting

If the extension is not working:

1. Make sure you're using a recent version of Chrome (85+)
2. Check that the extension is enabled in `chrome://extensions`
3. Verify that the site permissions include YouTube
4. Try reloading the extension
5. Check the console for any error messages

## Known Limitations

- PiP requires a user gesture on some browsers (first-time use)
- Some YouTube features may interfere with PiP functionality
- PiP is not supported on all devices/browsers