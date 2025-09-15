# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

YouTu is a Chrome extension that automatically enables Picture-in-Picture (PiP) mode for YouTube videos when switching away from YouTube tabs and exits PiP when returning to the YouTube tab.

## Core Architecture

The extension follows a **three-tier Manifest V3 architecture**:

1. **Background Service Worker** (`background.js`) - Tab management and cross-tab communication
2. **Content Script** (`content.js`) - YouTube page interaction and PiP control  
3. **Popup UI** (`popup.html`/`popup.js`) - User configuration interface

### Key Technical Challenges

- **YouTube SPA Navigation**: YouTube's Single Page Application architecture requires robust video detection using MutationObserver and multiple selector strategies
- **User Gesture Requirements**: PiP API requires recent user interaction, handled through gesture tracking and deferred execution
- **Cross-Tab Coordination**: Background service worker maintains state for multiple YouTube tabs and coordinates PiP entry/exit
- **Extension Context Invalidation**: Extensive error handling for when Chrome reloads the extension during development

## Common Development Commands

### Build and Package
```powershell
# Create extension package (excludes development files)
npm run build
```

### Testing
```powershell
# No formal test suite - use manual testing
# Load test utilities in browser console on YouTube pages
npm run test  # Currently just echoes no tests
```

### Development Workflow
1. Load unpacked extension in `chrome://extensions` with Developer mode enabled
2. Make code changes
3. Click reload button in Chrome extensions page
4. Test on various YouTube page types (watch, playlist, channel)

## Key Files and Responsibilities

- **`background.js`** - Service worker handling tab events, state management, and script injection
- **`content.js`** - YouTube page interaction, video detection, PiP API calls
- **`popup.js`** - Settings UI logic and Chrome storage API
- **`utils.js`** - Shared utilities for YouTube detection and video state checking
- **`errors.js`** - Error handling utilities and custom error classes
- **`test.js`** - Manual testing utilities (run in browser console)

## Video Detection Strategy

The extension uses a **multi-layered approach** for robust YouTube video detection:

1. **Multiple Selectors**: `video.html5-main-video`, `#movie_player video`, `video`
2. **MutationObserver**: Watches for DOM changes in YouTube's dynamic interface
3. **Periodic Monitoring**: Interval-based checks with variable frequency (500ms when hidden, 2s when visible)
4. **Video State Validation**: Checks `readyState`, `currentTime`, `paused`, and `ended` properties

## PiP Lifecycle Management

**Entry Conditions**: Video has started playing, user has switched to different tab, recent user gesture available
**Exit Conditions**: User returns to YouTube tab or video ends

**Critical Implementation Details**:
- PiP state tracked in both background service worker and content script
- User gesture tracking with 5-second timeout window  
- Graceful handling of PiP API failures (NotAllowedError, NotSupportedError)
- Automatic retry mechanisms for context invalidation errors

## State Management

The background service worker maintains a `Map` of YouTube tabs with structure:
```javascript
{
  inPip: boolean,
  hasVideo: boolean,
  isPlaying: boolean,
  shouldPlay: boolean,
  lastUpdated: timestamp
}
```

## Error Handling Patterns

- **Extension Context Validation**: Check `chrome.runtime.lastError` before API calls
- **Safe Script Execution**: Retry logic with exponential backoff for script injection
- **Graceful Degradation**: Continue functioning even if some features fail
- **Comprehensive Logging**: Detailed console output for debugging during development

## Testing Requirements

When making changes, verify functionality across:
- YouTube watch pages (/watch?v=...)
- YouTube playlist pages (/playlist?list=...)  
- YouTube channel pages (/channel/... or /c/...)
- Embedded YouTube videos on other sites
- Multiple simultaneous YouTube tabs
- Tab switching scenarios
- Extension reload during active use

## Chrome Extension Permissions

- `activeTab` - Access to currently active tab
- `tabs` - Tab management and switching detection
- `scripting` - Content script injection
- `storage` - Settings persistence
- Host permissions for all YouTube domains

## Development Notes

- Use Chrome DevTools extension debugging features extensively
- Monitor both extension console and page console for errors
- Test user gesture scenarios by interacting with videos before testing PiP
- YouTube's interface updates can break selectors - maintain multiple fallbacks
- Extension context can be invalidated during development - implement robust error handling

## Settings and Configuration

User settings stored via `chrome.storage.sync`:
- `enablePip` - Auto PiP functionality toggle
- `enableNotifications` - Notification preferences  
- `enableWhitelist` - Channel-specific PiP control
- `whitelist` - Array of allowed channel names