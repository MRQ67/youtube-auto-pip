// background.js - Service worker for tab management

// Store active YouTube tabs and their PiP status
const youtubeTabs = new Map();

// Listen for tab activation (when user switches to a different tab)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    // Get the currently active tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length > 0) {
      const activeTab = tabs[0];
      
      // Check if we're switching to a YouTube tab
      if (activeTab.url && activeTab.url.includes('youtube.com')) {
        // If this YouTube tab was in PiP mode, exit PiP
        if (youtubeTabs.has(activeTab.id) && youtubeTabs.get(activeTab.id).inPip) {
          try {
            await chrome.scripting.executeScript({
              target: { tabId: activeTab.id },
              func: exitPiP
            });
            
            // Update the tab status
            const tabInfo = youtubeTabs.get(activeTab.id) || { inPip: false, hasVideo: false };
            tabInfo.inPip = false;
            youtubeTabs.set(activeTab.id, tabInfo);
          } catch (error) {
            console.error('Error exiting PiP:', error);
          }
        }
      } else {
        // We're switching away from the active tab to a non-YouTube tab
        // Check if the previously active tab was a YouTube tab with a playing video
        const previousTabId = activeInfo.tabId;
        if (youtubeTabs.has(previousTabId)) {
          const previousTabInfo = youtubeTabs.get(previousTabId);
          if (previousTabInfo.hasVideo) {
            // Try to enter PiP mode
            try {
              await chrome.scripting.executeScript({
                target: { tabId: previousTabId },
                func: enterPiP
              });
              
              // Update the tab status
              previousTabInfo.inPip = true;
              youtubeTabs.set(previousTabId, previousTabInfo);
            } catch (error) {
              console.error('Error entering PiP:', error);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Error in tab activation handler:', error);
  }
});

// Listen for tab updates (navigation within YouTube)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  try {
    // Only process YouTube tabs
    if (tab.url && tab.url.includes('youtube.com')) {
      // When the page has finished loading
      if (changeInfo.status === 'complete') {
        // Inject content script to check for videos
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: checkForVideo
          });
        } catch (error) {
          console.error('Error injecting content script:', error);
        }
      }
    }
  } catch (error) {
    console.error('Error in tab update handler:', error);
  }
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    if (message.action === 'videoStatusUpdate') {
      // Update our record of this tab's video status
      const tabInfo = youtubeTabs.get(sender.tab.id) || { inPip: false, hasVideo: false };
      tabInfo.hasVideo = message.hasVideo;
      youtubeTabs.set(sender.tab.id, tabInfo);
      
      // If a video started playing and we're not on this tab, enter PiP
      if (message.hasVideo) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs.length > 0 && tabs[0].id !== sender.tab.id) {
            // We're on a different tab, so enter PiP
            chrome.scripting.executeScript({
              target: { tabId: sender.tab.id },
              func: enterPiP
            }).then(() => {
              tabInfo.inPip = true;
              youtubeTabs.set(sender.tab.id, tabInfo);
            }).catch(error => {
              console.error('Error entering PiP:', error);
            });
          }
        });
      }
    } else if (message.action === 'exitPip') {
      // Update PiP status
      if (youtubeTabs.has(sender.tab.id)) {
        const tabInfo = youtubeTabs.get(sender.tab.id);
        tabInfo.inPip = false;
        youtubeTabs.set(sender.tab.id, tabInfo);
      }
    }
  } catch (error) {
    console.error('Error in message handler:', error);
  }
});

// Function to be executed in the content script to enter PiP
function enterPiP() {
  try {
    // Find the video element
    const video = document.querySelector('video');
    if (video && !document.pictureInPictureElement) {
      // Check if PiP is supported
      if (document.pictureInPictureEnabled && video.requestPictureInPicture) {
        video.requestPictureInPicture()
          .then(() => {
            // Notify the background script
            chrome.runtime.sendMessage({ action: 'pipEntered' });
          })
          .catch(error => {
            console.error('Failed to enter PiP:', error);
          });
      }
    }
  } catch (error) {
    console.error('Error in enterPiP:', error);
  }
}

// Function to be executed in the content script to exit PiP
function exitPiP() {
  try {
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture()
        .then(() => {
          // Notify the background script
          chrome.runtime.sendMessage({ action: 'pipExited' });
        })
        .catch(error => {
          console.error('Failed to exit PiP:', error);
        });
    }
  } catch (error) {
    console.error('Error in exitPiP:', error);
  }
}

// Function to check for video elements
function checkForVideo() {
  try {
    const video = document.querySelector('video');
    const hasVideo = !!video;
    
    // Notify the background script about video status
    chrome.runtime.sendMessage({
      action: 'videoStatusUpdate',
      hasVideo: hasVideo
    });
  } catch (error) {
    console.error('Error in checkForVideo:', error);
  }
}