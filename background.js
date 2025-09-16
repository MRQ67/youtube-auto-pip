// background.js - Service worker for Windows app communication

// Store active YouTube tabs and their video status
const youtubeTabs = new Map();

// Windows app communication
let windowsAppProcess = null;
let windowsAppConnected = false;

// Utility function to check if extension context is still valid
function isExtensionContextValid() {
  try {
    chrome.runtime.lastError;
    return true;
  } catch (e) {
    return false;
  }
}

// Utility function to check if URL is a YouTube URL
function isYouTubeUrl(url) {
  if (!url) return false;
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.includes('youtube.com');
  } catch (e) {
    return false;
  }
}

// Connect to Windows app via Native Messaging
async function connectToWindowsApp() {
  try {
    if (!isExtensionContextValid()) return;
    
    console.log('Attempting to connect to Windows app...');
    
    // Try to connect to Windows app
    windowsAppProcess = chrome.runtime.connectNative('com.youtu.pip');
    
    windowsAppProcess.onMessage.addListener((message) => {
      console.log('Received message from Windows app:', message);
      handleWindowsAppMessage(message);
    });
    
    windowsAppProcess.onDisconnect.addListener(() => {
      console.log('Disconnected from Windows app');
      windowsAppConnected = false;
      windowsAppProcess = null;
    });
    
    windowsAppConnected = true;
    console.log('Connected to Windows app successfully');
    
  } catch (error) {
    console.error('Failed to connect to Windows app:', error);
    windowsAppConnected = false;
    windowsAppProcess = null;
  }
}

// Handle messages from Windows app
function handleWindowsAppMessage(message) {
  try {
    switch (message.action) {
      case 'pip_created':
        console.log('Windows app created PiP window');
        break;
        
      case 'pip_closed':
        console.log('Windows app closed PiP window');
        break;
        
      case 'state_change':
        console.log('Windows app state change:', message);
        break;
        
      case 'error':
        console.error('Windows app error:', message);
        break;
        
      default:
        console.log('Unknown message from Windows app:', message);
    }
  } catch (error) {
    console.error('Error handling Windows app message:', error);
  }
}

// Send message to Windows app
function sendToWindowsApp(data) {
  if (!windowsAppConnected || !windowsAppProcess) {
    console.log('Windows app not connected, attempting to connect...');
    connectToWindowsApp();
    return;
  }
  
  try {
    windowsAppProcess.postMessage(data);
    console.log('Sent message to Windows app:', data);
  } catch (error) {
    console.error('Failed to send message to Windows app:', error);
    windowsAppConnected = false;
    windowsAppProcess = null;
  }
}

// Keep track of the previously active tab
let previousActiveTabId = null;

// Listen for tab activation (when user switches to a different tab)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    if (!isExtensionContextValid()) return;
    
    const newActiveTabId = activeInfo.tabId;
    
    if (newActiveTabId === previousActiveTabId) {
      return;
    }
    
    // Get information about the newly active tab
    let newActiveTab;
    try {
      newActiveTab = await chrome.tabs.get(newActiveTabId);
    } catch (tabError) {
      if (tabError.message.includes('No tab with id')) {
        youtubeTabs.delete(newActiveTabId);
        return;
      }
      throw tabError;
    }
    
    // If we're switching to a YouTube tab that has a PiP window open, close it
    if (isYouTubeUrl(newActiveTab.url)) {
      if (youtubeTabs.has(newActiveTabId)) {
          const tabInfo = youtubeTabs.get(newActiveTabId);
        if (tabInfo.hasPipWindow) {
          sendToWindowsApp({
            action: 'close_pip',
            reason: 'tab_visible'
          });
          tabInfo.hasPipWindow = false;
          youtubeTabs.set(newActiveTabId, tabInfo);
        }
      }
    }
    
    // Check if we're switching away from a YouTube tab
    if (previousActiveTabId && previousActiveTabId !== newActiveTabId && youtubeTabs.has(previousActiveTabId)) {
      try {
        let previousTab;
        try {
          previousTab = await chrome.tabs.get(previousActiveTabId);
        } catch (tabError) {
          if (tabError.message.includes('No tab with id')) {
            youtubeTabs.delete(previousActiveTabId);
            previousActiveTabId = newActiveTabId;
            return;
          }
          throw tabError;
        }
        
        const previousTabInfo = youtubeTabs.get(previousActiveTabId);
        
        // If the previous tab was a YouTube tab with a video, send data to Windows app
        if (isYouTubeUrl(previousTab.url) && previousTabInfo.shouldTrack) {
          // Get current video info from content script
          try {
            const response = await chrome.tabs.sendMessage(previousActiveTabId, { action: 'getVideoInfo' });
            if (response) {
              response.tabId = previousActiveTabId;
              response.windowId = previousTab.windowId;
              
              sendToWindowsApp({
                action: 'create_pip',
                videoUrl: response.url,
                videoTitle: response.title,
                currentTime: response.currentTime,
                isPlaying: response.isPlaying,
                volume: response.volume,
                playbackRate: response.playbackRate,
                tabId: response.tabId,
                windowId: response.windowId
              });
              
              // Mark that this tab has a PiP window
              previousTabInfo.hasPipWindow = true;
            youtubeTabs.set(previousActiveTabId, previousTabInfo);
            }
          } catch (error) {
            console.error('Error getting video info from content script:', error);
          }
        }
      } catch (error) {
        if (error.message.includes('No tab with id')) {
          youtubeTabs.delete(previousActiveTabId);
        } else {
          console.error('Error handling previous tab:', error);
        }
      }
    }
    
    previousActiveTabId = newActiveTabId;
    
  } catch (error) {
    if (error.message.includes('Extension context invalidated')) {
      return;
    } else if (error.message.includes('No tab with id')) {
      const tabIdMatch = error.message.match(/No tab with id: (\d+)/);
      if (tabIdMatch) {
        const tabId = parseInt(tabIdMatch[1]);
        youtubeTabs.delete(tabId);
        if (previousActiveTabId === tabId) {
          previousActiveTabId = null;
        }
      }
    } else {
      console.error('Error in tab activation handler:', error);
    }
  }
});

// Listen for tab updates (navigation within YouTube)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  try {
    if (!isExtensionContextValid()) return;
    
    if (isYouTubeUrl(tab.url)) {
      if (changeInfo.status === 'complete') {
        const tabInfo = youtubeTabs.get(tabId) || { 
          hasVideo: false, 
          shouldTrack: false,
          hasPipWindow: false,
          lastUpdated: Date.now()
        };
        tabInfo.lastUpdated = Date.now();
        youtubeTabs.set(tabId, tabInfo);
      }
    }
  } catch (error) {
    if (!error.message.includes('Extension context invalidated')) {
      console.error('Error in tab update handler:', error);
    }
  }
});

// Listen for tab closure
chrome.tabs.onRemoved.addListener((tabId) => {
  try {
    if (youtubeTabs.has(tabId)) {
      console.log(`Tab ${tabId} was closed, cleaning up tracking data`);
      youtubeTabs.delete(tabId);
    }
    
    if (previousActiveTabId === tabId) {
      previousActiveTabId = null;
    }
  } catch (error) {
    console.warn('Error during tab removal cleanup:', error.message);
  }
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    if (!isExtensionContextValid()) return;
    
    if (message.action === 'videoStatusUpdate') {
      // Update our record of this tab's video status
      const tabInfo = youtubeTabs.get(sender.tab.id) || { 
        hasVideo: false, 
        shouldTrack: false,
        hasPipWindow: false,
        lastUpdated: Date.now()
      };
      
      tabInfo.hasVideo = message.hasVideo;
      tabInfo.shouldTrack = message.shouldTrack;
      tabInfo.lastUpdated = Date.now();
      youtubeTabs.set(sender.tab.id, tabInfo);
      
      // Update tab info in content script
      chrome.tabs.sendMessage(sender.tab.id, {
        action: 'updateTabInfo',
        tabId: sender.tab.id,
        windowId: sender.tab.windowId
            }).catch(error => {
        console.warn('Could not update tab info:', error);
      });
      
    } else if (message.action === 'sendToWindowsApp') {
      // Forward message to Windows app
      sendToWindowsApp(message.data);
      
    } else if (message.action === 'tabClosed') {
      // Clean up when tab is closed
      youtubeTabs.delete(sender.tab.id);
    }
  } catch (error) {
    if (!error.message.includes('Extension context invalidated')) {
      console.error('Error in message handler:', error);
    }
  }
});

// Initialize connection to Windows app on startup
chrome.runtime.onStartup.addListener(() => {
  console.log('Extension startup - attempting to connect to Windows app');
  connectToWindowsApp();
});

// Connect to Windows app when extension is installed/enabled
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed - attempting to connect to Windows app');
  connectToWindowsApp();
});

// Periodic cleanup of stale tab references
setInterval(async () => {
  try {
    if (!isExtensionContextValid()) return;
    
    const staleTabIds = [];
    
    for (const [tabId] of youtubeTabs) {
      try {
        await chrome.tabs.get(tabId);
      } catch (error) {
        if (error.message.includes('No tab with id')) {
          staleTabIds.push(tabId);
        }
      }
    }
    
    staleTabIds.forEach(tabId => {
      youtubeTabs.delete(tabId);
      if (previousActiveTabId === tabId) {
        previousActiveTabId = null;
      }
    });
    
    if (staleTabIds.length > 0) {
      console.log(`Cleaned up ${staleTabIds.length} stale tab references`);
    }
  } catch (error) {
    if (!error.message.includes('Extension context invalidated')) {
      console.warn('Error during tab cleanup:', error.message);
    }
  }
}, 30000); // Run cleanup every 30 seconds