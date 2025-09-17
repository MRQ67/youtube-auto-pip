// background.js - Service worker for Windows app communication

// Store active YouTube tabs and their video status
const youtubeTabs = new Map();

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

// Windows app communication
let windowsAppProcess = null;
let windowsAppConnected = false;
let connectionRetryCount = 0;
let maxRetryAttempts = 3;
let retryDelay = 1000; // Start with 1 second delay
let heartbeatInterval = null;
let lastHeartbeatTime = 0;
let heartbeatTimeout = 30000; // 30 seconds timeout

// Enhanced logging function
function log(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}`;
  
  switch (level.toLowerCase()) {
    case 'error':
      console.error(logMessage, data || '');
      break;
    case 'warn':
      console.warn(logMessage, data || '');
      break;
    case 'info':
      console.log(logMessage, data || '');
      break;
    case 'debug':
      console.debug(logMessage, data || '');
      break;
    default:
      console.log(logMessage, data || '');
  }
}

// Show notification to user
function showNotification(title, message) {
  try {
    if (chrome.notifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: title,
        message: message
      });
    }
  } catch (error) {
    console.warn('Could not show notification:', error);
  }
}

// Start heartbeat mechanism
function startHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }
  
  heartbeatInterval = setInterval(() => {
    if (windowsAppConnected && windowsAppProcess) {
      const now = Date.now();
      
      // Check if we haven't received a response in too long
      if (now - lastHeartbeatTime > heartbeatTimeout) {
        console.warn('Heartbeat timeout - connection may be lost');
        windowsAppConnected = false;
        windowsAppProcess = null;
        
        // Attempt to reconnect
        if (connectionRetryCount < maxRetryAttempts) {
          console.log('Attempting to reconnect due to heartbeat timeout...');
          connectToWindowsApp(true);
        }
      } else {
        // Send heartbeat ping
        try {
          windowsAppProcess.postMessage({
            action: 'heartbeat',
            timestamp: now
          });
        } catch (error) {
          console.warn('Failed to send heartbeat:', error);
          windowsAppConnected = false;
          windowsAppProcess = null;
        }
      }
    }
  }, 10000); // Send heartbeat every 10 seconds
}

// Stop heartbeat mechanism
function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

// Connect to Windows app via Native Messaging (reuse existing connection)
async function connectToWindowsApp(forceReconnect = false) {
  try {
    if (!isExtensionContextValid()) return;
    
    // If already connected and not forcing reconnect, don't reconnect
    if (windowsAppConnected && windowsAppProcess && !forceReconnect) {
      return;
    }
    
    console.log(`Connecting to Windows app service... (attempt ${connectionRetryCount + 1}/${maxRetryAttempts})`);
    
    // Clean up existing connection if any
    if (windowsAppProcess) {
      try {
        windowsAppProcess.disconnect();
      } catch (e) {
        // Ignore disconnect errors
      }
      windowsAppProcess = null;
    }
    
    // Connect to the Windows app service via proxy
    windowsAppProcess = chrome.runtime.connectNative('com.youtu.pip');
    
    windowsAppProcess.onMessage.addListener((message) => {
      console.log('Received message from Windows app:', message);
      handleWindowsAppResponse(message);
      
      // Reset retry count on successful message
      connectionRetryCount = 0;
      retryDelay = 1000;
    });
    
    windowsAppProcess.onDisconnect.addListener((error) => {
      console.log('Disconnected from Windows app:', error);
      windowsAppConnected = false;
      windowsAppProcess = null;
      
      // Attempt to reconnect if not manually disconnected
      if (connectionRetryCount < maxRetryAttempts) {
        console.log(`Connection lost, attempting to reconnect in ${retryDelay}ms...`);
        setTimeout(() => {
          connectionRetryCount++;
          retryDelay = Math.min(retryDelay * 2, 10000); // Exponential backoff, max 10 seconds
          connectToWindowsApp(true);
        }, retryDelay);
      } else {
        console.error('Max retry attempts reached. Windows app connection failed.');
        showNotification('YouTu PiP Connection Failed', 'Unable to connect to Windows app. Please ensure the app is running.');
      }
    });
    
    windowsAppConnected = true;
    connectionRetryCount = 0;
    retryDelay = 1000;
    lastHeartbeatTime = Date.now();
    console.log('Connected to Windows app service successfully');
    
    // Start heartbeat mechanism
    startHeartbeat();
    
  } catch (error) {
    console.error('Failed to connect to Windows app:', error);
    windowsAppConnected = false;
    windowsAppProcess = null;
    
    // Retry connection if we haven't exceeded max attempts
    if (connectionRetryCount < maxRetryAttempts) {
      connectionRetryCount++;
      retryDelay = Math.min(retryDelay * 2, 10000);
      console.log(`Connection failed, retrying in ${retryDelay}ms... (attempt ${connectionRetryCount}/${maxRetryAttempts})`);
      setTimeout(() => connectToWindowsApp(true), retryDelay);
    } else {
      console.error('Max retry attempts reached. Windows app connection failed.');
      showNotification('YouTu PiP Connection Failed', 'Unable to connect to Windows app. Please ensure the app is running.');
    }
  }
}

// Send message to Windows app
function sendToWindowsApp(data, retryCount = 0) {
  try {
    if (!isExtensionContextValid()) return;
    
    // Validate message data
    if (!data || typeof data !== 'object') {
      console.error('Invalid message data:', data);
      return;
    }
    
    // Ensure we have a connection
    if (!windowsAppConnected || !windowsAppProcess) {
      console.log('Not connected to Windows app, attempting to connect...');
      connectToWindowsApp();
      
      // Wait a moment for connection, then try to send
      setTimeout(() => {
        if (windowsAppConnected && windowsAppProcess) {
          try {
            windowsAppProcess.postMessage(data);
            console.log('Sent message to Windows app:', data);
          } catch (error) {
            console.error('Failed to send message after connection:', error);
            if (retryCount < 2) {
              setTimeout(() => sendToWindowsApp(data, retryCount + 1), 500);
            }
          }
        } else {
          console.log('Could not establish connection to Windows app');
          if (retryCount < 2) {
            setTimeout(() => sendToWindowsApp(data, retryCount + 1), 1000);
          }
        }
      }, 100);
      return;
    }
    
    // Send message through existing connection
    windowsAppProcess.postMessage(data);
    console.log('Sent message to Windows app:', data);
    
  } catch (error) {
    console.error('Failed to send message to Windows app:', error);
    
    // Mark connection as failed and attempt to reconnect
    windowsAppConnected = false;
    windowsAppProcess = null;
    
    // Retry sending the message if we haven't exceeded retry limit
    if (retryCount < 2) {
      console.log(`Retrying message send in 500ms... (attempt ${retryCount + 1}/2)`);
      setTimeout(() => sendToWindowsApp(data, retryCount + 1), 500);
    } else {
      console.error('Max retry attempts reached for message send');
      showNotification('YouTu PiP Error', 'Failed to communicate with Windows app. Please check if the app is running.');
    }
  }
}

// Handle responses from Windows app
function handleWindowsAppResponse(response) {
  try {
    if (!response || typeof response !== 'object') {
      console.error('Invalid response from Windows app:', response);
      return;
    }
    
    console.log('Processing response from Windows app:', response);
    
    switch (response.action) {
      case 'pip_created':
        if (response.success) {
          console.log('Windows app created PiP window successfully');
          showNotification('YouTu PiP', 'Picture-in-Picture window created');
        } else {
          console.error('Windows app failed to create PiP window:', response.error);
          showNotification('YouTu PiP Error', `Failed to create PiP window: ${response.error || 'Unknown error'}`);
        }
        break;
        
      case 'pip_closed':
        console.log('Windows app closed PiP window:', response.reason);
        break;
        
      case 'state_change':
        console.log('Windows app state change:', response);
        break;
        
      case 'heartbeat':
        // Update last heartbeat time
        lastHeartbeatTime = Date.now();
        console.log('Received heartbeat response from Windows app');
        break;
        
      case 'error':
        console.error('Windows app error:', response);
        showNotification('YouTu PiP Error', `Windows app error: ${response.message || 'Unknown error'}`);
        break;
        
      default:
        console.log('Unknown response from Windows app:', response);
    }
  } catch (error) {
    console.error('Error handling Windows app response:', error);
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
  console.log('Extension startup - connecting to existing Windows app service');
  connectToWindowsApp();
});

// Connect to Windows app when extension is installed/enabled
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed - connecting to existing Windows app service');
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