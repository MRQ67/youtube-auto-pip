# Implementation Documentation

## Architecture Overview

The YouTu Chrome extension follows a three-tier architecture:

1. **Background Service Worker** (`background.js`) - Handles tab management and cross-tab communication
2. **Content Script** (`content.js`) - Interacts with YouTube pages and controls PiP functionality
3. **Popup UI** (`popup.html`/`popup.js`) - Provides user configuration interface

## Background Service Worker

The background service worker is responsible for:

- Tracking active YouTube tabs
- Monitoring tab switching events
- Coordinating PiP entry/exit across tabs
- Managing communication between different parts of the extension

### Key Functions

- `chrome.tabs.onActivated` - Detects when user switches tabs
- `chrome.tabs.onUpdated` - Monitors YouTube page navigation
- `chrome.runtime.onMessage` - Handles messages from content scripts

## Content Script

The content script runs in the context of YouTube pages and handles:

- Video element detection
- PiP API interactions
- Page visibility monitoring
- YouTube-specific event handling

### Video Detection

YouTube's SPA (Single Page Application) architecture makes video detection challenging. The content script uses:

- MutationObserver to detect DOM changes
- Periodic checks for video elements
- YouTube-specific selectors and events
- Enhanced video state detection (checking if videos are actually playing, not just present)

### PiP Control

The extension uses the modern Picture-in-Picture Web API:

- `video.requestPictureInPicture()` to enter PiP
- `document.exitPictureInPicture()` to exit PiP
- Event listeners for `enterpictureinpicture` and `leavepictureinpicture`

## Popup UI

The popup provides a user-friendly configuration interface:

- Enable/disable auto PiP
- Notification settings
- Channel whitelist functionality

## Data Storage

User preferences are stored using `chrome.storage.sync` which:

- Persists across browser sessions
- Syncs across devices (if sync is enabled)
- Provides asynchronous API for reading/writing

## Error Handling

The extension implements comprehensive error handling:

- Try/catch blocks around critical operations
- Graceful degradation when APIs are unavailable
- Console logging for debugging

## Performance Considerations

To maintain good performance:

- Content scripts only run on YouTube domains
- Event listeners are properly removed
- DOM queries are minimized
- Debouncing is used for rapid events

## Extending Functionality

### Adding New Settings

1. Add the setting to `popup.html`
2. Update `popup.js` to handle the new setting
3. Modify `content.js` or `background.js` to use the setting

### Adding New YouTube Page Support

1. Update the content script selectors
2. Add specific handling for new page types
3. Test across different YouTube page layouts

### Adding New Features

1. Plan the feature architecture
2. Add necessary permissions to `manifest.json`
3. Implement the feature in the appropriate layer
4. Update the popup UI if needed
5. Test thoroughly across different scenarios

## Testing Checklist

Before releasing updates, verify:

- [ ] Extension works on YouTube watch pages
- [ ] Extension works on YouTube playlist pages
- [ ] Extension works on YouTube channel pages
- [ ] Extension works with embedded YouTube videos
- [ ] PiP enters correctly when switching away from tabs
- [ ] PiP exits correctly when returning to tabs
- [ ] Settings are properly saved and loaded
- [ ] Extension handles tab closure correctly
- [ ] Extension works with multiple YouTube tabs
- [ ] Extension gracefully handles errors
- [ ] Extension performs well (no memory leaks)