// content.js - Chrome Extension for YouTube Video Detection and Windows App Communication

// Video detection and state management
let currentVideo = null;
let videoObserver = null;
let playerObserver = null;
let videoCheckInterval = null;
let lastVideoCheck = 0;

// Video state tracking
let videoState = {
  url: null,
  title: null,
  currentTime: 0,
  isPlaying: false,
  volume: 1,
  playbackRate: 1,
  tabId: null,
  windowId: null,
  lastUpdate: 0
};

// Communication with Windows app
let windowsAppConnected = false;
let communicationPipe = null;

// Utility function to check if extension context is still valid
function isExtensionContextValid() {
  try {
    chrome.runtime.lastError;
    return true;
  } catch (e) {
    return false;
  }
}

// Utility function to safely send messages
function safeSendMessage(message) {
  try {
    if (isExtensionContextValid()) {
      chrome.runtime.sendMessage(message);
    }
  } catch (error) {
    if (!error.message.includes('Extension context invalidated')) {
      console.error('Error sending message:', error);
    }
  }
}

// Enhanced video detection with YouTube-specific selectors
function findYouTubeVideo() {
  const videoSelectors = [
    'video.html5-main-video',  // Main YouTube video
    '#movie_player video',     // Video within movie player
    'video'                    // Generic video selector
  ];
  
  for (const selector of videoSelectors) {
    const video = document.querySelector(selector);
    if (video) {
      return video;
    }
  }
  
  return null;
}

// Extract video information
function extractVideoInfo(video) {
  if (!video) {
    console.warn('Cannot extract video info: video element is null');
    return null;
  }
  
  try {
    const videoInfo = {
      url: window.location.href,
      title: getVideoTitle(),
      currentTime: video.currentTime || 0,
      isPlaying: !video.paused && !video.ended && video.currentTime > 0,
      volume: video.volume !== undefined ? video.volume : 1,
      playbackRate: video.playbackRate !== undefined ? video.playbackRate : 1,
      tabId: null, // Will be set by background script
      windowId: null, // Will be set by background script
      lastUpdate: Date.now()
    };
    
    // Validate extracted data
    if (!videoInfo.url || videoInfo.url === 'about:blank') {
      console.warn('Invalid video URL:', videoInfo.url);
      return null;
    }
    
    if (!videoInfo.title || videoInfo.title === 'Unknown Video') {
      console.warn('Could not extract video title');
    }
    
    return videoInfo;
  } catch (error) {
    console.error('Error extracting video info:', error);
    return null;
  }
}

// Get video title from page
function getVideoTitle() {
  const titleSelectors = [
    'h1.title yt-formatted-string',
    'h1.title',
    '.ytd-video-primary-info-renderer h1',
    'title'
  ];
  
  for (const selector of titleSelectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent) {
      return element.textContent.trim();
    }
  }
  
  return 'Unknown Video';
}

// Check if video should be tracked
function shouldTrackVideo(video) {
  if (!video) return false;
  
  // Check if video has started playing and has data
  const hasSufficientData = video.readyState >= 2; // HAVE_CURRENT_DATA
  const notEnded = !video.ended;
  const hasStarted = video.currentTime > 0;
  
  return hasSufficientData && notEnded && hasStarted;
}

// Send video data to Windows app
function sendVideoDataToWindowsApp(videoInfo) {
  if (!videoInfo) {
    console.error('Cannot send video data: videoInfo is null or undefined');
    return;
  }
  
  // Validate required fields
  if (!videoInfo.url || !videoInfo.title) {
    console.error('Cannot send video data: missing required fields (url or title)');
    return;
  }
  
  const message = {
    action: 'create_pip',
    videoUrl: videoInfo.url,
    videoTitle: videoInfo.title,
    currentTime: videoInfo.currentTime || 0,
    isPlaying: videoInfo.isPlaying || false,
    volume: videoInfo.volume || 1,
    playbackRate: videoInfo.playbackRate || 1,
    tabId: videoInfo.tabId || 0,
    windowId: videoInfo.windowId || 0
  };
  
  console.log('Sending video data to Windows app:', message);
  
  // Send to background script for Windows app communication
  safeSendMessage({
    action: 'sendToWindowsApp',
    data: message
  });
}

// Update video state
function updateVideoState() {
    const video = findYouTubeVideo();
  
  if (video && shouldTrackVideo(video)) {
    const videoInfo = extractVideoInfo(video);
    
    // Check if state has changed significantly
    const stateChanged = 
      videoInfo.currentTime !== videoState.currentTime ||
      videoInfo.isPlaying !== videoState.isPlaying ||
      videoInfo.volume !== videoState.volume ||
      videoInfo.playbackRate !== videoState.playbackRate;
    
    if (stateChanged) {
      videoState = { ...videoInfo };
      
      // Send update to Windows app
      safeSendMessage({ 
        action: 'sendToWindowsApp',
        data: {
          action: 'update_state',
          currentTime: videoInfo.currentTime,
          isPlaying: videoInfo.isPlaying,
          volume: videoInfo.volume,
          playbackRate: videoInfo.playbackRate
        }
      });
    }
  }
}

// Check for video elements on the page
function checkForVideos() {
  try {
    lastVideoCheck = Date.now();
    
    const video = findYouTubeVideo();
    
    if (video && video !== currentVideo) {
      currentVideo = video;
      console.log('New video detected:', getVideoTitle());
    }
    
    const hasVideo = !!currentVideo;
    const shouldTrack = hasVideo && shouldTrackVideo(currentVideo);
    
    // Notify background script about video status
    safeSendMessage({
      action: 'videoStatusUpdate',
      hasVideo: hasVideo,
      shouldTrack: shouldTrack,
      videoInfo: shouldTrack ? extractVideoInfo(currentVideo) : null
    });
    
  } catch (error) {
    console.error('Error checking for videos:', error);
  }
}

// Set up observer to detect video elements
function setupVideoObserver() {
  videoObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (node.tagName === 'VIDEO' || node.querySelector('video')) {
            const now = Date.now();
            if (now - lastVideoCheck > 500) {
              lastVideoCheck = now;
              setTimeout(checkForVideos, 100);
            }
          }
        }
      });
    });
  });
  
  videoObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Set up observer to detect YouTube player changes
function setupPlayerObserver() {
  playerObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList' && mutation.target.id === 'movie_player') {
        const now = Date.now();
        if (now - lastVideoCheck > 500) {
          lastVideoCheck = now;
          setTimeout(checkForVideos, 500);
        }
      }
    });
  });
  
  const playerElement = document.getElementById('movie_player');
  if (playerElement) {
    playerObserver.observe(playerElement, {
      childList: true,
      subtree: true
    });
  }
  
  // Watch for player element being added to the DOM
  const bodyObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE && node.id === 'movie_player') {
          playerObserver.observe(node, {
            childList: true,
            subtree: true
          });
          
          const now = Date.now();
          if (now - lastVideoCheck > 500) {
            lastVideoCheck = now;
            setTimeout(checkForVideos, 100);
          }
        }
      });
    });
  });
  
  bodyObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Start monitoring video state periodically
function startVideoMonitoring() {
  if (videoCheckInterval) {
    clearInterval(videoCheckInterval);
  }
  
  videoCheckInterval = setInterval(() => {
    checkForVideos();
    updateVideoState();
  }, document.hidden ? 500 : 2000);
}

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    console.log('Tab became hidden - checking for video to send to Windows app');
    
    setTimeout(() => {
      const video = findYouTubeVideo();
      if (video && shouldTrackVideo(video)) {
        const videoInfo = extractVideoInfo(video);
        sendVideoDataToWindowsApp(videoInfo);
      }
    }, 100);
  } else {
    console.log('Tab became visible');
    
    // Send close command to Windows app if it's open
    safeSendMessage({
      action: 'sendToWindowsApp',
      data: {
        action: 'close_pip',
        reason: 'tab_visible'
      }
    });
  }
  
  // Adjust monitoring frequency based on visibility
  if (videoCheckInterval) {
    clearInterval(videoCheckInterval);
    startVideoMonitoring();
  }
});

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getVideoInfo') {
    const video = findYouTubeVideo();
    if (video && shouldTrackVideo(video)) {
      const videoInfo = extractVideoInfo(video);
      sendResponse(videoInfo);
    } else {
      sendResponse(null);
    }
  } else if (message.action === 'updateTabInfo') {
    videoState.tabId = message.tabId;
    videoState.windowId = message.windowId;
  }
});

// Clean up when the page is unloaded
window.addEventListener('beforeunload', () => {
  if (videoCheckInterval) {
    clearInterval(videoCheckInterval);
  }
  
  // Notify background script of tab closure
  safeSendMessage({ action: 'tabClosed' });
});

// Function to initialize the content script
function init() {
  console.log('YouTu extension initializing - Windows app communication mode');
  
  // Set up observers to detect video elements and player changes
  setupVideoObserver();
  setupPlayerObserver();
  
  // Set up periodic video checking
  startVideoMonitoring();
  
  // Check for existing videos
  setTimeout(checkForVideos, 1000);
  
  console.log('YouTu extension initialized for Windows app communication');
}

// Initialize when the DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
