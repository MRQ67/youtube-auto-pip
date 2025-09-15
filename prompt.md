# Chrome Extension Development Prompt: YouTube Auto Picture-in-Picture

## Project Brief
You are tasked with developing a Chrome extension that automatically enables Picture-in-Picture (PiP) mode for YouTube videos when users switch away from YouTube tabs, and automatically exits PiP when they return to the YouTube tab.

## Core Requirements
- **Trigger**: Automatically enter PiP mode when switching away from a YouTube tab with a playing video
- **Exit**: Automatically exit PiP mode when returning to the YouTube tab
- **Scope**: Works on all YouTube pages (watch, playlist, channel, embedded)
- **State Management**: Handle multiple YouTube tabs intelligently (only one PiP active)
- **Performance**: Lightweight and efficient implementation

## Technical Constraints & Challenges
Based on research, be aware of these common issues:
- YouTube's SPA architecture causes DOM detection problems
- Manifest V3 migration issues, especially with tab switching detection
- PiP API requires user gestures and has browser-specific quirks
- Extensions work differently across Chromium browsers (Chrome vs Vivaldi)
- YouTube's dynamic content loading makes video element detection unreliable

## Chrome Extension Best Practices to Follow

### 1. **Manifest V3 Compliance**
- Use Manifest Version 3 (latest standard)
- Implement service workers instead of background pages
- Use proper permission declarations (minimal permissions principle)
- Handle async service worker lifecycle properly

### 2. **Architecture Best Practices**
- **Separation of Concerns**: Clear separation between background script, content scripts, and popup
- **Message Passing**: Use proper chrome.runtime messaging between scripts
- **Error Handling**: Comprehensive try-catch blocks and graceful degradation
- **Memory Management**: Avoid memory leaks in long-running content scripts

### 3. **Performance Optimization**
- **Lazy Loading**: Only inject content scripts on YouTube domains
- **Event Delegation**: Use efficient event listeners (avoid excessive DOM polling)
- **Debouncing**: Debounce rapid tab switching events
- **Resource Cleanup**: Properly remove event listeners and observers

### 4. **Security Best Practices**
- **Content Security Policy**: Handle YouTube's strict CSP
- **Input Validation**: Sanitize any user inputs or settings
- **Minimal Permissions**: Request only necessary permissions
- **Secure Communication**: Validate messages between scripts

### 5. **Cross-Browser Compatibility**
- Test on different Chromium browsers (Chrome, Edge, Brave)
- Handle browser-specific API differences
- Implement fallbacks for unsupported features

### 6. **User Experience**
- **Graceful Failures**: Show helpful error messages
- **Settings/Preferences**: Allow users to disable/configure behavior
- **Visual Feedback**: Indicate when PiP is active
- **Accessibility**: Ensure keyboard navigation support

## Specific Technical Implementation Guidelines

### YouTube Detection Strategy
```javascript
// Use multiple detection methods for reliability
1. Monitor video elements with MutationObserver
2. Listen for YouTube's SPA navigation events
3. Handle different YouTube page types
4. Detect video play state changes
```

### Tab Management Pattern
```javascript
// Robust tab switching detection
1. Combine chrome.tabs.onActivated with Page Visibility API
2. Track YouTube tabs in background script
3. Implement debouncing for rapid tab switches
4. Handle multiple windows/displays
```

### PiP API Integration
```javascript
// Handle PiP API limitations
1. Check for PiP support before calling API
2. Implement proper error handling
3. Store user interaction state for gesture requirements
4. Provide fallback messaging if PiP fails
```

## File Structure Requirements
```
youtube-auto-pip/
├── manifest.json              # Manifest V3 configuration
├── background.js             # Service worker for tab management
├── content.js               # YouTube video detection & PiP control
├── popup.html              # Optional: Settings UI
├── popup.js               # Optional: Settings logic
├── utils.js              # Shared utility functions
└── icons/               # Extension icons (16, 48, 128px)
```

## Code Quality Standards
- **ES6+ Syntax**: Use modern JavaScript features
- **Async/Await**: Prefer async/await over promises
- **Error Boundaries**: Implement proper error handling at all levels
- **Code Comments**: Document complex logic, especially YouTube-specific workarounds
- **Consistent Naming**: Use clear, descriptive variable and function names

## Testing Requirements
Ensure the extension works in these scenarios:
- Single YouTube tab with playing video
- Multiple YouTube tabs with different play states
- Rapid tab switching
- YouTube page navigation (watch → playlist → channel)
- Browser restart with YouTube tabs open
- Different video qualities and formats
- YouTube Premium vs free accounts

## Advanced Features to Consider
- User preferences for enabling/disabling per channel
- Minimum video duration threshold before PiP activation
- Custom PiP window positioning/sizing
- Keyboard shortcuts for manual PiP toggle
- Support for YouTube Music

## Research and Documentation Requirements
**Important**: Use the context7 MCP (Model Context Protocol) to access documentation for any topics you need more information about, including:
- Chrome Extension API specifics and best practices
- Manifest V3 migration guidelines
- Picture-in-Picture API documentation
- YouTube's DOM structure and SPA behavior
- Service Worker lifecycle management
- Cross-browser compatibility details

Query context7 whenever you encounter:
- Unclear API usage patterns
- Browser-specific implementation details
- Security considerations for extensions
- Performance optimization techniques
- Testing strategies for extensions

## Deliverables Expected
1. Complete, working Chrome extension files
2. Comprehensive error handling for edge cases
3. Clean, well-documented code following best practices
4. Installation and usage instructions
5. Known limitations documentation

## Success Criteria
- Extension reliably enters PiP when switching away from YouTube
- Extension reliably exits PiP when returning to YouTube tab
- No memory leaks or performance degradation
- Works across different YouTube page types
- Handles multiple YouTube tabs gracefully
- Follows all Chrome Web Store policies

Build this extension following modern Chrome extension development best practices, with particular attention to the technical challenges identified from developer complaints and the robust performance that Arc browser achieved with their built-in implementation.