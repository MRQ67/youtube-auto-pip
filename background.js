// background.js - Service worker for tab management

// Store active YouTube tabs and their PiP status
const youtubeTabs = new Map();

// Periodic cleanup of stale tab references
setInterval(async () => {
  try {
    if (!isExtensionContextValid()) return;
    
    const staleTabIds = [];
    
    // Check each tracked tab to see if it still exists
    for (const [tabId] of youtubeTabs) {
      try {
        await chrome.tabs.get(tabId);
      } catch (error) {
        if (error.message.includes('No tab with id')) {
          staleTabIds.push(tabId);
        }
      }
    }
    
    // Clean up stale tabs
    staleTabIds.forEach(tabId => {
      console.log(`Cleaning up stale tab reference: ${tabId}`);
      youtubeTabs.delete(tabId);
      
      // Reset previousActiveTabId if it's stale
      if (previousActiveTabId === tabId) {
        previousActiveTabId = null;
      }
    });
    
    if (staleTabIds.length > 0) {
      console.log(`Cleaned up ${staleTabIds.length} stale tab references`);
    }
  } catch (error) {
    // Ignore cleanup errors
    if (!error.message.includes('Extension context invalidated')) {
      console.warn('Error during tab cleanup:', error.message);
    }
  }
}, 30000); // Run cleanup every 30 seconds

// Utility function to check if extension context is still valid
function isExtensionContextValid() {
  try {
    // This will throw if the context is invalid
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

// Utility function to safely execute scripting with error handling
async function safeExecuteScript(tabId, func, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      if (!isExtensionContextValid()) {
        console.warn('Extension context is invalid, skipping script execution');
        return null;
      }
      
      // Check if tab still exists and get its info
      let tab;
      try {
        tab = await chrome.tabs.get(tabId);
      } catch (tabError) {
        console.warn(`Tab ${tabId} no longer exists:`, tabError.message);
        // Clean up our tracking for this tab
        youtubeTabs.delete(tabId);
        return null;
      }
      
      // Only proceed if it's a YouTube tab
      if (!isYouTubeUrl(tab.url)) {
        console.warn(`Tab ${tabId} is not a YouTube tab: ${tab.url}`);
        return null;
      }
      
      // Check if tab is loading
      if (tab.status === 'loading') {
        console.log(`Tab ${tabId} is still loading, waiting...`);
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
          continue;
        } else {
          console.warn(`Tab ${tabId} took too long to load`);
          return null;
        }
      }
      
      // Check if we have permission to access this tab
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: () => { return 'permission_check'; }
        });
      } catch (permissionError) {
        console.warn(`No permission to access tab ${tabId}:`, permissionError.message);
        // If it's a specific permission error, try to request permission
        if (permissionError.message.includes('Cannot access contents')) {
          console.log(`Attempting to request permissions for tab ${tabId}`);
          try {
            const granted = await chrome.permissions.request({
              origins: [tab.url]
            });
            if (!granted) {
              console.warn(`Permission not granted for tab ${tabId}`);
              return null;
            }
          } catch (permError) {
            console.error('Error requesting permissions:', permError.message);
            return null;
          }
        } else {
          return null;
        }
      }
      
      return await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: func
      });
    } catch (error) {
      console.warn(`Script execution failed (attempt ${i + 1}/${retries}):`, error.message);
      
      // If it's a context invalidation error, don't retry
      if (error.message.includes('Extension context invalidated')) {
        console.error('Extension context invalidated - extension may need to be reloaded');
        return null;
      }
      
      // If it's a permission error, don't retry
      if (error.message.includes('Cannot access contents') || 
          error.message.includes('Permission') || 
          error.message.includes('The extensions gallery cannot be scripted')) {
        console.error('Permission error - make sure host permissions are set correctly:', error.message);
        return null;
      }
      
      // If tab was removed, clean up and don't retry
      if (error.message.includes('No tab with id')) {
        youtubeTabs.delete(tabId);
        return null;
      }
      
      // If it's a tab error and not the last retry, wait a bit before retrying
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
  }
  console.error(`Failed to execute script on tab ${tabId} after ${retries} attempts`);
  return null;
}

// Keep track of the previously active tab
let previousActiveTabId = null;

// Listen for tab activation (when user switches to a different tab)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  let newActiveTabId; // Declare outside try block so it's available in catch
  
  try {
    // Check if extension context is still valid
    if (!isExtensionContextValid()) {
      return;
    }
    
    // Validate the activation info
    if (!activeInfo || !activeInfo.tabId || activeInfo.tabId <= 0) {
      console.warn('Invalid tab activation info:', activeInfo);
      return;
    }
    
    newActiveTabId = activeInfo.tabId;
    
    // If the new active tab is the same as the previous one, no need to process
    if (newActiveTabId === previousActiveTabId) {
      return;
    }
    
    // Get information about the newly active tab - check if it still exists
    let newActiveTab;
    try {
      newActiveTab = await chrome.tabs.get(newActiveTabId);
    } catch (tabError) {
      // The newly active tab was closed immediately, just clean up and exit
      if (tabError.message.includes('No tab with id')) {
        console.log(`Newly active tab ${newActiveTabId} was closed immediately, cleaning up`);
        youtubeTabs.delete(newActiveTabId);
        // Don't update previousActiveTabId since the new tab is already gone
        return;
      } else {
        // Re-throw if it's a different error
        throw tabError;
      }
    }
    
    // If we're switching to a YouTube tab that was in PiP mode, exit PiP
    if (isYouTubeUrl(newActiveTab.url)) {
      if (youtubeTabs.has(newActiveTabId) && youtubeTabs.get(newActiveTabId).inPip) {
        try {
          await safeExecuteScript(newActiveTabId, exitPiP);
          
          // Update the tab status
          const tabInfo = youtubeTabs.get(newActiveTabId);
          tabInfo.inPip = false;
          tabInfo.lastUpdated = Date.now();
          youtubeTabs.set(newActiveTabId, tabInfo);
        } catch (error) {
          console.error('Error exiting PiP when switching to YouTube tab:', error);
        }
      }
    }
    
    // Check if we're switching away from a YouTube tab
    // Add extra safety check to ensure previousActiveTabId is valid
    if (previousActiveTabId && previousActiveTabId !== newActiveTabId && youtubeTabs.has(previousActiveTabId)) {
      try {
        // Get the previous tab info - check if tab still exists first
        let previousTab;
        try {
          previousTab = await chrome.tabs.get(previousActiveTabId);
        } catch (tabError) {
          // Tab was closed, clean up our tracking and continue
          if (tabError.message.includes('No tab with id')) {
            console.log(`Previous tab ${previousActiveTabId} was closed, cleaning up`);
            youtubeTabs.delete(previousActiveTabId);
            previousActiveTabId = newActiveTabId;
            return; // Exit early, no need to process this closed tab
          } else {
            throw tabError; // Re-throw if it's a different error
          }
        }
        
        const previousTabInfo = youtubeTabs.get(previousActiveTabId);
        
        // If the previous tab was a YouTube tab and has a video that should be in PiP
        if (isYouTubeUrl(previousTab.url) && 
            previousTabInfo.shouldPlay && !previousTabInfo.inPip) {
          // Try to enter PiP mode on the previous tab
          try {
            await safeExecuteScript(previousActiveTabId, enterPiP);
            
            // Update the tab status
            previousTabInfo.inPip = true;
            previousTabInfo.lastUpdated = Date.now();
            youtubeTabs.set(previousActiveTabId, previousTabInfo);
          } catch (error) {
            console.error('Error entering PiP when switching away from YouTube tab:', error);
            // If the tab was closed during PiP attempt, clean up
            if (error.message.includes('No tab with id')) {
              youtubeTabs.delete(previousActiveTabId);
            }
          }
        }
      } catch (error) {
        // Handle any other errors with the previous tab
        if (error.message.includes('No tab with id')) {
          console.log(`Previous tab ${previousActiveTabId} no longer exists, cleaning up`);
          youtubeTabs.delete(previousActiveTabId);
        } else {
          console.error('Error handling previous tab:', error);
        }
      }
    }
    
    // Update the previously active tab ID for next time
    previousActiveTabId = newActiveTabId;
    
  } catch (error) {
    // Handle specific error types more gracefully
    if (error.message.includes('Extension context invalidated')) {
      // Silently ignore context invalidation errors during development
      return;
    } else if (error.message.includes('No tab with id')) {
      // Extract tab ID from error message if possible
      const tabIdMatch = error.message.match(/No tab with id: (\d+)/);
      if (tabIdMatch) {
        const tabId = parseInt(tabIdMatch[1]);
        console.log(`Tab ${tabId} was closed during activation handler, cleaning up tracking data`);
        youtubeTabs.delete(tabId);
        
        // Reset previousActiveTabId if it was the problematic tab
        if (previousActiveTabId === tabId) {
          console.log(`Resetting previousActiveTabId because tab ${tabId} was closed`);
          previousActiveTabId = null;
        }
        
        // If the new active tab was the one that was closed, don't update previousActiveTabId
        if (newActiveTabId === tabId) {
          console.log(`New active tab ${tabId} was closed, not updating previousActiveTabId`);
          return;
        }
      } else {
        console.warn('Tab was closed but could not extract tab ID from error:', error.message);
      }
    } else {
      console.error('Error in tab activation handler:', error);
    }
  }
});

// Listen for tab updates (navigation within YouTube)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  try {
    // Check if extension context is still valid
    if (!isExtensionContextValid()) {
      return;
    }
    
    // Only process YouTube tabs
    if (isYouTubeUrl(tab.url)) {
      // When the page has finished loading
      if (changeInfo.status === 'complete') {
        // Store tab information
        const tabInfo = youtubeTabs.get(tabId) || { 
          inPip: false, 
          hasVideo: false, 
          isPlaying: false,
          shouldPlay: false,
          lastUpdated: Date.now()
        };
        tabInfo.lastUpdated = Date.now();
        youtubeTabs.set(tabId, tabInfo);
        
        // Inject content script to check for videos
        try {
          await safeExecuteScript(tabId, checkForVideo);
        } catch (error) {
          console.error('Error injecting content script:', error);
        }
      }
    }
  } catch (error) {
    // Ignore errors if they're related to extension context invalidation
    if (!error.message.includes('Extension context invalidated')) {
      console.error('Error in tab update handler:', error);
    }
  }
});

// Listen for tab closure
chrome.tabs.onRemoved.addListener((tabId) => {
  try {
    // Clean up stored tab information
    if (youtubeTabs.has(tabId)) {
      console.log(`Tab ${tabId} was closed, cleaning up tracking data`);
      youtubeTabs.delete(tabId);
    }
    
    // Reset previousActiveTabId if it was the closed tab
    if (previousActiveTabId === tabId) {
      console.log(`Resetting previousActiveTabId (was ${tabId})`);
      previousActiveTabId = null;
    }
  } catch (error) {
    // Ignore cleanup errors but log them
    console.warn('Error during tab removal cleanup:', error.message);
  }
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    // Check if extension context is still valid
    if (!isExtensionContextValid()) {
      return;
    }
    
    if (message.action === 'videoStatusUpdate') {
      // Update our record of this tab's video status
      const tabInfo = youtubeTabs.get(sender.tab.id) || { 
        inPip: false, 
        hasVideo: false, 
        isPlaying: false,
        shouldPlay: false,
        lastUpdated: Date.now()
      };
      tabInfo.hasVideo = message.hasVideo;
      tabInfo.isPlaying = message.isPlaying || false;
      tabInfo.shouldPlay = message.shouldPlay || false;
      tabInfo.lastUpdated = Date.now();
      youtubeTabs.set(sender.tab.id, tabInfo);
      
      // If a video should be playing and we're not on this tab, enter PiP
      if (message.shouldPlay) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          // Check if extension context is still valid
          if (!isExtensionContextValid()) {
            return;
          }
          
          if (tabs.length > 0 && tabs[0].id !== sender.tab.id) {
            // We're on a different tab, so enter PiP
            safeExecuteScript(sender.tab.id, enterPiP).then(() => {
              tabInfo.inPip = true;
              youtubeTabs.set(sender.tab.id, tabInfo);
            }).catch(error => {
              console.error('Error entering PiP:', error);
            });
          }
        });
      }
    } else if (message.action === 'exitPip' || message.action === 'pipExited') {
      // Update PiP status when PiP is exited
      if (youtubeTabs.has(sender.tab.id)) {
        const tabInfo = youtubeTabs.get(sender.tab.id);
        tabInfo.inPip = false;
        tabInfo.lastUpdated = Date.now();
        youtubeTabs.set(sender.tab.id, tabInfo);
      }
    } else if (message.action === 'pipEntered') {
      // Update PiP status when PiP is entered
      if (youtubeTabs.has(sender.tab.id)) {
        const tabInfo = youtubeTabs.get(sender.tab.id);
        tabInfo.inPip = true;
        tabInfo.lastUpdated = Date.now();
        youtubeTabs.set(sender.tab.id, tabInfo);
      }
    } else if (message.action === 'tabClosed') {
      // Clean up when tab is closed
      youtubeTabs.delete(sender.tab.id);
    }
  } catch (error) {
    // Ignore errors if they're related to extension context invalidation
    if (!error.message.includes('Extension context invalidated')) {
      console.error('Error in message handler:', error);
    }
  }
});

// Function to be executed in the content script to enter PiP
function enterPiP() {
  try {
    // CRITICAL: Only enter PiP if the document is currently hidden (tab is in background)
    if (!document.hidden) {
      console.log('Cannot enter PiP: tab is currently active/visible');
      return;
    }
    
    // Try multiple selectors for YouTube videos
    const videoSelectors = [
      'video.html5-main-video',  // Main YouTube video
      '#movie_player video',     // Video within movie player
      'video'                    // Generic video selector
    ];
    
    let video = null;
    for (const selector of videoSelectors) {
      video = document.querySelector(selector);
      if (video) break;
    }
    
    if (video && document.pictureInPictureEnabled) {
      // Double-check that document is still hidden before attempting PiP
      if (!document.hidden) {
        console.log('Document became visible before PiP attempt - aborting');
        return;
      }
      
      // Check if PiP is supported
      if (video.requestPictureInPicture) {
        video.requestPictureInPicture()
          .then(() => {
            // Notify the background script
            try {
              chrome.runtime.sendMessage({ action: 'pipEntered' });
            } catch (e) {
              // Ignore errors in notification
            }
          })
          .catch(error => {
            console.error('Failed to enter PiP:', error);
          });
      }
    }
  } catch (error) {
    console.error('Error in enterPip:', error);
  }
}

// Function to be executed in the content script to exit PiP
function exitPiP() {
  try {
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture()
        .then(() => {
          // Notify the background script
          try {
            chrome.runtime.sendMessage({ action: 'pipExited' });
          } catch (e) {
            // Ignore errors in notification
          }
        })
        .catch(error => {
          console.error('Failed to exit PiP:', error);
          
          // Force notification even if exit fails
          try {
            chrome.runtime.sendMessage({ action: 'pipExited' });
          } catch (e) {
            // Ignore errors in force notification
          }
        });
    }
  } catch (error) {
    console.error('Error in exitPip:', error);
    
    // Force notification even if exit fails
    try {
      chrome.runtime.sendMessage({ action: 'pipExited' });
    } catch (e) {
      // Ignore errors in force notification
    }
  }
}

// Function to check for video elements
function checkForVideo() {
  try {
    // Try multiple selectors for YouTube videos
    const videoSelectors = [
      'video.html5-main-video',  // Main YouTube video
      '#movie_player video',     // Video within movie player
      'video'                    // Generic video selector
    ];
    
    let video = null;
    for (const selector of videoSelectors) {
      video = document.querySelector(selector);
      if (video) break;
    }
    
    const hasVideo = !!video;
    // Check if video is actually playing (not just present)
    const isVideoPlaying = hasVideo && 
                          video.readyState >= 3 && // HAVE_FUTURE_DATA
                          !video.paused && 
                          !video.ended && 
                          video.currentTime > 0;
    
    // Check if video should be in PiP (even if paused due to tab switch)
    const shouldVideoBeInPiP = hasVideo && video.currentTime > 0 && 
                               !video.ended && video.readyState >= 2;
    
    // Notify the background script about video status
    try {
      chrome.runtime.sendMessage({
        action: 'videoStatusUpdate',
        hasVideo: hasVideo,
        isPlaying: isVideoPlaying,
        shouldPlay: shouldVideoBeInPiP
      });
    } catch (e) {
      // Ignore errors in notification
    }
  } catch (error) {
    console.error('Error in checkForVideo:', error);
  }
}