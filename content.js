// content.js - Content script for YouTube video detection and PiP control

// Keep track of PiP state and video element
let inPipMode = false;
let currentVideo = null;
let videoObserver = null;
let playerObserver = null;
let videoCheckInterval = null;
let lastVideoCheck = 0;
let pipFailedCount = 0;
let useFallbackMode = false;
let videoWasPausedByExtension = false;

// Enhanced video state management
let videoState = {
  wasPlaying: false,
  wasPaused: false,
  currentTime: 0,
  playbackRate: 1,
  volume: 1,
  muted: false,
  lastStateChange: 0
};

// Enhanced gesture management
let gestureManager = {
  hasValidGesture: false,
  lastGestureTime: 0,
  gestureSource: null,
  gestureListeners: new Set(),
  pendingActions: [],
  gestureBank: [], // Store multiple gestures for better reliability
  maxBankSize: 5
};

// Semi-auto PiP state tracking
let pipPermissionGranted = false;  // Has user granted permission via interaction?
let pipPermissionRequested = false; // Have we shown the permission request UI?
let userUnlockedPip = false;  // Has user clicked the 'unlock' button?
let lastUserUnlock = 0;       // When was the last user unlock?

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

// Utility function to safely send messages
function safeSendMessage(message) {
  try {
    if (isExtensionContextValid()) {
      chrome.runtime.sendMessage(message);
    }
  } catch (error) {
    // Ignore errors related to context invalidation
    if (!error.message.includes('Extension context invalidated')) {
      console.error('Error sending message:', error);
    }
  }
}

// Enhanced video state management functions
function saveVideoState(video) {
  if (!video) return;
  
  videoState = {
    wasPlaying: !video.paused && !video.ended && video.currentTime > 0,
    wasPaused: video.paused,
    currentTime: video.currentTime,
    playbackRate: video.playbackRate,
    volume: video.volume,
    muted: video.muted,
    lastStateChange: Date.now()
  };
  
  console.log('Video state saved:', videoState);
}

function restoreVideoState(video) {
  if (!video || !videoState.lastStateChange) return;
  
  // Only restore if the state is recent (within 30 seconds)
  const stateAge = Date.now() - videoState.lastStateChange;
  if (stateAge > 30000) {
    console.log('Video state too old, not restoring');
    return;
  }
  
  try {
    // Restore playback properties
    if (videoState.playbackRate !== video.playbackRate) {
      video.playbackRate = videoState.playbackRate;
    }
    
    if (videoState.volume !== video.volume) {
      video.volume = videoState.volume;
    }
    
    if (videoState.muted !== video.muted) {
      video.muted = videoState.muted;
    }
    
    // Restore playback state
    if (videoState.wasPlaying && video.paused) {
      console.log('Restoring video playback state');
      video.play().catch(error => {
        console.warn('Could not restore video playback:', error);
      });
    }
    
    console.log('Video state restored:', videoState);
  } catch (error) {
    console.error('Error restoring video state:', error);
  }
}

function preserveVideoPlayback(video) {
  if (!video) return;
  
  // Save current state before any PiP operations
  saveVideoState(video);
  
  // Ensure video continues playing during PiP transition
  if (!video.paused && !video.ended) {
    console.log('Preserving video playback during PiP transition');
    
    // Add event listeners to maintain playback
    const maintainPlayback = () => {
      if (video.paused && !video.ended && videoState.wasPlaying) {
        console.log('Video paused unexpectedly, resuming...');
        video.play().catch(error => {
          console.warn('Could not resume video:', error);
        });
      }
    };
    
    // Listen for pause events and resume if needed
    video.addEventListener('pause', maintainPlayback, { once: true });
    
    // Set up a timeout to check playback state
    setTimeout(() => {
      if (video.paused && videoState.wasPlaying) {
        console.log('Video still paused after timeout, attempting resume');
        video.play().catch(error => {
          console.warn('Could not resume video after timeout:', error);
        });
      }
    }, 100);
  }
}

// Enhanced gesture management system
function captureUserGesture(event) {
  gestureManager.hasValidGesture = true;
  gestureManager.lastGestureTime = Date.now();
  gestureManager.gestureSource = event.type;
  
  // Add to gesture bank for better reliability
  const gestureData = {
    type: event.type,
    timestamp: Date.now(),
    source: event.target?.tagName || 'unknown'
  };
  
  gestureManager.gestureBank.push(gestureData);
  
  // Keep only recent gestures
  if (gestureManager.gestureBank.length > gestureManager.maxBankSize) {
    gestureManager.gestureBank.shift();
  }
  
  console.log('Enhanced gesture captured:', gestureData);
  console.log(`Gesture bank size: ${gestureManager.gestureBank.length}`);
  
  // Execute any pending actions
  if (gestureManager.pendingActions.length > 0) {
    console.log(`Executing ${gestureManager.pendingActions.length} pending actions`);
    gestureManager.pendingActions.forEach(action => {
      try {
        action();
      } catch (error) {
        console.error('Error executing pending action:', error);
      }
    });
    gestureManager.pendingActions = [];
  }
}

function hasValidUserGesture() {
  const gestureAge = Date.now() - gestureManager.lastGestureTime;
  const hasRecentGesture = gestureManager.hasValidGesture && (gestureAge < 30000); // 30 seconds
  
  // Also check gesture bank for any recent gestures
  const hasRecentBankGesture = gestureManager.gestureBank.some(gesture => {
    const age = Date.now() - gesture.timestamp;
    return age < 30000; // 30 seconds
  });
  
  const isValid = hasRecentGesture || hasRecentBankGesture;
  
  console.log(`Gesture validity check:`, {
    hasRecentGesture,
    hasRecentBankGesture,
    isValid,
    gestureAge: Math.round(gestureAge/1000) + 's',
    bankSize: gestureManager.gestureBank.length
  });
  
  return isValid;
}

function addPendingAction(action) {
  gestureManager.pendingActions.push(action);
  console.log(`Added pending action. Total pending: ${gestureManager.pendingActions.length}`);
}

function setupEnhancedGestureCapture() {
  if (gestureManager.gestureListeners.size > 0) {
    console.log('Gesture capture already active');
    return;
  }
  
  const events = [
    'click', 'keydown', 'mousedown', 'touchstart', 'pointerdown',
    'scroll', 'wheel', 'mousemove', 'focus', 'input', 'change'
  ];
  
  const captureHandler = (event) => {
    captureUserGesture(event);
  };
  
  events.forEach(eventType => {
    document.addEventListener(eventType, captureHandler, { 
      passive: true, 
      capture: true 
    });
    window.addEventListener(eventType, captureHandler, { 
      passive: true, 
      capture: true 
    });
    gestureManager.gestureListeners.add(eventType);
  });
  
  console.log('Enhanced gesture capture activated');
}

function cleanupGestureCapture() {
  gestureManager.gestureListeners.forEach(eventType => {
    document.removeEventListener(eventType, captureUserGesture, { capture: true });
    window.removeEventListener(eventType, captureUserGesture, { capture: true });
  });
  gestureManager.gestureListeners.clear();
  console.log('Gesture capture cleaned up');
}

// Legacy compatibility
let hasUserGesture = false;
let lastUserInteraction = 0;
let gestureListenersActive = false;
let pendingPipEntry = false;

// Function to track user interactions (enhanced)
function trackUserInteraction(event) {
  hasUserGesture = true;
  lastUserInteraction = Date.now();
  console.log('User gesture captured:', event.type);
  
  // Also update the enhanced gesture manager
  captureUserGesture(event);
  
  // If we have a pending PiP entry and the document is hidden, try to enter PiP now
  if (pendingPipEntry && document.hidden) {
    pendingPipEntry = false;
    console.log('Attempting deferred PiP entry with fresh user gesture');
    setTimeout(() => enterPictureInPicture(), 50);
  }
}

// Add event listeners to track user interactions
function setupUserGestureTracking() {
  if (gestureListenersActive) return;
  
  const events = ['click', 'keydown', 'mousedown', 'touchstart', 'pointerdown'];
  events.forEach(event => {
    document.addEventListener(event, trackUserInteraction, { passive: true, capture: true });
  });
  gestureListenersActive = true;
  console.log('User gesture tracking set up');
}

// Check if we have a recent user gesture (extended to 30 seconds for better reliability)
function hasRecentUserGesture() {
  const gestureAge = Date.now() - lastUserInteraction;
  const hasRecent = hasUserGesture && (gestureAge < 30000); // Extended to 30 seconds
  console.log(`Gesture check: hasGesture=${hasUserGesture}, age=${Math.round(gestureAge/1000)}s, valid=${hasRecent}`);
  return hasRecent;
}

// Proactively capture user gesture when tab becomes visible
function setupProactiveGestureCapture() {
  console.log('Setting up proactive gesture capture for future PiP entry');
  
  // Set up immediate, high-priority gesture listeners
  const immediateGestureCapture = (event) => {
    console.log('Proactive gesture captured:', event.type);
    hasUserGesture = true;
    lastUserInteraction = Date.now();
    
    // Remove the immediate listeners since we got our gesture
    const events = ['click', 'keydown', 'mousedown', 'touchstart', 'pointerdown', 'scroll', 'wheel'];
    events.forEach(eventType => {
      document.removeEventListener(eventType, immediateGestureCapture, { capture: true });
    });
  };
  
  // Add temporary high-priority listeners for immediate gesture capture
  const events = ['click', 'keydown', 'mousedown', 'touchstart', 'pointerdown', 'scroll', 'wheel'];
  events.forEach(eventType => {
    document.addEventListener(eventType, immediateGestureCapture, { once: true, capture: true, passive: true });
  });
}

// Set up immediate gesture capture when returning to tab
function setupImmediateGestureCapture() {
  console.log('Setting up immediate gesture capture for next PiP attempt');
  
  const immediateCapture = (event) => {
    console.log('Immediate gesture captured on tab return:', event.type);
    
    // Update gesture state
    hasUserGesture = true;
    lastUserInteraction = Date.now();
    captureUserGesture(event);
    
    // Clean up listeners
    const events = ['click', 'keydown', 'mousedown', 'touchstart', 'pointerdown', 'scroll', 'wheel'];
    events.forEach(eventType => {
      document.removeEventListener(eventType, immediateCapture, { capture: true });
    });
    
    console.log('Immediate gesture capture completed');
  };
  
  // Add high-priority listeners for immediate capture
  const events = ['click', 'keydown', 'mousedown', 'touchstart', 'pointerdown', 'scroll', 'wheel'];
  events.forEach(eventType => {
    document.addEventListener(eventType, immediateCapture, { once: true, capture: true, passive: true });
  });
  
  // Clean up after 10 seconds if no gesture captured
  setTimeout(() => {
    events.forEach(eventType => {
      document.removeEventListener(eventType, immediateCapture, { capture: true });
    });
  }, 10000);
}

// Enhanced aggressive gesture capture for PiP API failures
function setupAggressiveGestureCapture() {
  console.log('Setting up enhanced aggressive gesture capture due to PiP API restrictions');
  
  // Clean up any existing aggressive listeners first
  cleanupAggressiveGestureCapture();
  
  // Set up cross-window gesture capture with enhanced tracking
  const aggressiveGestureCapture = (event) => {
    console.log('Enhanced aggressive gesture captured for PiP retry:', {
      type: event.type,
      target: event.target?.tagName || 'unknown',
      timestamp: Date.now()
    });
    
    // Update both gesture systems
    hasUserGesture = true;
    lastUserInteraction = Date.now();
    captureUserGesture(event);
    
    // If we have a pending PiP entry and document is hidden, try immediately
    if (pendingPipEntry && document.hidden) {
      pendingPipEntry = false;
      console.log('Attempting PiP with enhanced aggressively captured gesture');
      
      // Multiple attempts with different delays
      setTimeout(() => {
        if (document.hidden) {
          enterPictureInPicture();
        }
      }, 50);
      
      setTimeout(() => {
        if (document.hidden && !inPipMode) {
          console.log('Retry PiP attempt with captured gesture');
          enterPictureInPicture();
        }
      }, 200);
    }
    
    // Clean up all aggressive listeners
    cleanupAggressiveGestureCapture();
  };
  
  // Store the handler for cleanup
  window.aggressiveGestureHandler = aggressiveGestureCapture;
  
  // Add listeners to both document and window for maximum coverage
  const events = [
    'click', 'keydown', 'mousedown', 'touchstart', 'pointerdown', 
    'scroll', 'wheel', 'mousemove', 'focus', 'input', 'change',
    'keyup', 'mouseup', 'touchend', 'pointerup'
  ];
  
  events.forEach(eventType => {
    document.addEventListener(eventType, aggressiveGestureCapture, { once: true, capture: true, passive: true });
    window.addEventListener(eventType, aggressiveGestureCapture, { once: true, capture: true, passive: true });
  });
  
  // Set up a timeout to clean up if no gesture is captured
  setTimeout(() => {
    cleanupAggressiveGestureCapture();
    console.log('Enhanced aggressive gesture capture timeout - cleaned up listeners');
  }, 120000); // 2 minute timeout (extended)
}

// Clean up aggressive gesture capture
function cleanupAggressiveGestureCapture() {
  if (window.aggressiveGestureHandler) {
    const events = [
      'click', 'keydown', 'mousedown', 'touchstart', 'pointerdown', 
      'scroll', 'wheel', 'mousemove', 'focus', 'input', 'change',
      'keyup', 'mouseup', 'touchend', 'pointerup'
    ];
    
    events.forEach(eventType => {
      document.removeEventListener(eventType, window.aggressiveGestureHandler, { capture: true });
      window.removeEventListener(eventType, window.aggressiveGestureHandler, { capture: true });
    });
    
    delete window.aggressiveGestureHandler;
  }
}

// Enhanced fallback functionality - preserve video state instead of pausing
function handlePipFallback() {
  try {
    const video = findYouTubeVideo();
    if (!video) return;
    
    // Save video state but don't pause the video
    saveVideoState(video);
    
    console.log('PiP not available - preserving video state without pausing');
    
    // Show a subtle notification about PiP unavailability
    showFallbackNotification('PiP not available - video continues playing');
      
      safeSendMessage({ 
      action: 'pipFallback',
      reason: 'PiP blocked, video state preserved',
      videoState: videoState
    });
    
    // Set up monitoring to ensure video continues playing
    const monitorPlayback = () => {
      if (video.paused && videoState.wasPlaying && !video.ended) {
        console.log('Video paused unexpectedly, attempting to resume');
        video.play().catch(error => {
          console.warn('Could not resume video:', error);
        });
      }
    };
    
    // Monitor for unexpected pauses
    video.addEventListener('pause', monitorPlayback, { once: true });
    
    // Set up periodic check
    setTimeout(monitorPlayback, 1000);
    
  } catch (error) {
    console.error('Error in PiP fallback handling:', error);
  }
}

// Legacy fallback functions for backward compatibility
function pauseVideoAsFallback() {
  console.log('Legacy pause fallback called - using enhanced fallback instead');
  handlePipFallback();
}

function resumeVideoFromFallback() {
  try {
    const video = findYouTubeVideo();
    if (video && videoState.lastStateChange) {
      console.log('Restoring video state from fallback');
      restoreVideoState(video);
      videoWasPausedByExtension = false;
      
      showFallbackNotification('Video state restored');
      
      safeSendMessage({ 
        action: 'fallbackResume',
        reason: 'Video state restored when returning to tab'
      });
    }
  } catch (error) {
    console.error('Error in fallback resume:', error);
  }
}

// Show a subtle notification for fallback actions
function showFallbackNotification(message) {
  // Create a subtle notification overlay
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 10px 15px;
    border-radius: 5px;
    font-family: Arial, sans-serif;
    font-size: 14px;
    z-index: 10000;
    transition: opacity 0.3s ease;
  `;
  notification.textContent = `YouTu: ${message}`;
  
  document.body.appendChild(notification);
  
  // Remove notification after 3 seconds
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 3000);
}

// Show the semi-auto PiP permission request UI
function showPipPermissionUI() {
  if (pipPermissionRequested) return; // Don't show multiple times
  
  pipPermissionRequested = true;
  console.log('Showing PiP permission request UI');
  
  // Create permission request overlay
  const overlay = document.createElement('div');
  overlay.id = 'youtu-pip-permission-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    z-index: 999999;
    display: flex;
    justify-content: center;
    align-items: center;
    font-family: 'YouTube Sans', Roboto, Arial, sans-serif;
  `;
  
  const modal = document.createElement('div');
  modal.style.cssText = `
    background: white;
    border-radius: 8px;
    padding: 24px;
    max-width: 400px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    text-align: center;
  `;
  
  modal.innerHTML = `
    <div style="color: #ff0000; font-size: 24px; margin-bottom: 16px;">📺</div>
    <h3 style="margin: 0 0 16px 0; color: #030303; font-size: 18px;">Enable Auto Picture-in-Picture</h3>
    <p style="margin: 0 0 20px 0; color: #606060; font-size: 14px; line-height: 1.4;">
      Click "Enable" to unlock automatic Picture-in-Picture for YouTube videos. 
      This will work for the entire browser session.
    </p>
    <div style="display: flex; gap: 12px; justify-content: center;">
      <button id="youtu-enable-pip" style="
        background: #ff0000;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 18px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
      ">Enable Auto PiP</button>
      <button id="youtu-cancel-pip" style="
        background: #f1f1f1;
        color: #606060;
        border: none;
        padding: 10px 20px;
        border-radius: 18px;
        cursor: pointer;
        font-size: 14px;
      ">Maybe Later</button>
    </div>
  `;
  
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  
  // Handle enable button click
  document.getElementById('youtu-enable-pip').addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    
    console.log('User clicked Enable Auto PiP');
    
    // This click gives us a user gesture to work with
    hasUserGesture = true;
    lastUserInteraction = Date.now();
    userUnlockedPip = true;
    lastUserUnlock = Date.now();
    pipPermissionGranted = true;
    pipFailedCount = 0; // Reset failures
    useFallbackMode = false; // Reset fallback mode
    
    // Save the permission state
    savePipPermissionState();
    
    // Remove the UI
    overlay.remove();
    
    // Show confirmation
    showFallbackNotification('Auto PiP enabled! Switch tabs to test.');
    
    // If we're currently on a hidden tab with a video, try PiP immediately
    if (document.hidden) {
      const video = findYouTubeVideo();
      if (video && shouldVideoBeInPiP(video)) {
        console.log('Attempting PiP immediately after user unlock');
        setTimeout(() => enterPictureInPicture(), 100);
      }
    }
  });
  
  // Handle cancel button click
  document.getElementById('youtu-cancel-pip').addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    
    console.log('User declined PiP permission');
    overlay.remove();
    
    // Don't ask again for this session
    pipPermissionRequested = true;
    pipPermissionGranted = false;
    
    // Save the declined state (but with shorter expiry)
    savePipPermissionState();
    
    // Show fallback notification
    showFallbackNotification('PiP not enabled. Extension will pause videos instead.');
    useFallbackMode = true;
  });
  
  // Close on overlay click
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      document.getElementById('youtu-cancel-pip').click();
    }
  });
}

// Reset fallback mode and give PiP another chance
function resetPipMode() {
  console.log('Resetting PiP mode - giving PiP API another chance');
  pipFailedCount = 0;
  useFallbackMode = false;
  videoWasPausedByExtension = false;
  pendingPipEntry = false;
  
  // Set up fresh gesture capture
  setupProactiveGestureCapture();
  
  showFallbackNotification('PiP mode reset - will try PiP again');
}

// Automatically reset fallback mode after some time
setInterval(() => {
  if (useFallbackMode && pipFailedCount > 0) {
    // After 5 minutes in fallback mode, give PiP another chance
    console.log('Auto-resetting PiP mode after fallback period');
    pipFailedCount = Math.max(0, pipFailedCount - 2);
    if (pipFailedCount === 0) {
      useFallbackMode = false;
      console.log('Switched back to PiP mode from fallback');
    }
  }
}, 300000); // 5 minutes

// Load saved PiP permission state
function loadPipPermissionState() {
  try {
    const savedState = localStorage.getItem('youtu-pip-permission');
    if (savedState) {
      const state = JSON.parse(savedState);
      const timeSinceGrant = Date.now() - state.grantedAt;
      
      // Permission expires after 24 hours
      if (timeSinceGrant < 86400000) {
        pipPermissionGranted = state.granted;
        pipPermissionRequested = state.requested;
        if (state.granted) {
          lastUserUnlock = state.grantedAt;
          console.log('Restored PiP permission from previous session');
        }
      } else {
        // Clear expired permission
        localStorage.removeItem('youtu-pip-permission');
        console.log('Previous PiP permission expired');
      }
    }
  } catch (error) {
    console.warn('Error loading PiP permission state:', error);
  }
}

// Save PiP permission state
function savePipPermissionState() {
  try {
    const state = {
      granted: pipPermissionGranted,
      requested: pipPermissionRequested,
      grantedAt: lastUserUnlock
    };
    localStorage.setItem('youtu-pip-permission', JSON.stringify(state));
  } catch (error) {
    console.warn('Error saving PiP permission state:', error);
  }
}

// Function to initialize the content script (enhanced)
function init() {
  console.log('YouTu extension initializing with enhanced features...');
  
  // Load saved permission state first
  loadPipPermissionState();
  
  // Set up enhanced gesture tracking immediately
  setupEnhancedGestureCapture();
  
  // Set up legacy gesture tracking for backward compatibility
  setupUserGestureTracking();
  
  // Set up observers to detect video elements and player changes
  setupVideoObserver();
  setupPlayerObserver();
  
  // Listen for messages from the background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'enterPip') {
      enterPictureInPicture();
    } else if (message.action === 'exitPip') {
      exitPictureInPicture();
    }
  });
  
  // Listen for PiP events
  document.addEventListener('enterpictureinpicture', onEnterPiP);
  document.addEventListener('leavepictureinpicture', onLeavePiP);
  
  // Set up periodic video checking
  startVideoMonitoring();
  
  // Check for existing videos
  setTimeout(checkForVideos, 1000);
  
  console.log('YouTu extension initialized with enhanced video state management and gesture capture');
}

// Set up observer to detect video elements
function setupVideoObserver() {
  // Create a MutationObserver to watch for video elements
  videoObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // Check if the added node is a video or contains a video
          if (node.tagName === 'VIDEO' || node.querySelector('video')) {
            // Debounce to avoid excessive checks
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
  
  // Start observing
  videoObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Set up observer to detect YouTube player changes
function setupPlayerObserver() {
  // YouTube uses SPA navigation, so we need to watch for player changes
  playerObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      // Look for changes that might indicate a new video has loaded
      if (mutation.type === 'childList' && mutation.target.id === 'movie_player') {
        // Debounce to avoid excessive checks
        const now = Date.now();
        if (now - lastVideoCheck > 500) {
          lastVideoCheck = now;
          setTimeout(checkForVideos, 500);
        }
      }
    });
  });
  
  // Start observing the player element if it exists
  const playerElement = document.getElementById('movie_player');
  if (playerElement) {
    playerObserver.observe(playerElement, {
      childList: true,
      subtree: true
    });
  }
  
  // Also watch for the player element being added to the DOM
  const bodyObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE && node.id === 'movie_player') {
          playerObserver.observe(node, {
            childList: true,
            subtree: true
          });
          
          // Check for videos when player is added
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
  // Clear any existing interval
  if (videoCheckInterval) {
    clearInterval(videoCheckInterval);
  }
  
  // Set up a periodic check for video state (more frequent when document is hidden)
  videoCheckInterval = setInterval(() => {
    checkForVideos();
  }, document.hidden ? 500 : 2000);
}

// Enhanced video detection with YouTube-specific selectors
function findYouTubeVideo() {
  // Try multiple selectors for YouTube videos
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

// Check if video should be considered as "intended to play"
function shouldVideoBeInPiP(video) {
  if (!video) return false;
  
  // If video has started playing and has data
  const hasSufficientData = video.readyState >= 2; // HAVE_CURRENT_DATA
  
  // Check if video is not ended
  const notEnded = !video.ended;
  
  // Check if video has started (user has interacted)
  const hasStarted = video.currentTime > 0;
  
  return hasSufficientData && notEnded && hasStarted;
}

// Check for video elements on the page
function checkForVideos() {
  try {
    // Reset last check time
    lastVideoCheck = Date.now();
    
    // Find the YouTube video element
    const video = findYouTubeVideo();
    
    // Update current video reference
    if (video && video !== currentVideo) {
      currentVideo = video;
    }
    
    const hasVideo = !!currentVideo;
    
    // Check if video is actually playing
    const isVideoCurrentlyPlaying = hasVideo && 
                                  currentVideo && 
                                  currentVideo.readyState >= 3 && // HAVE_FUTURE_DATA
                                  !currentVideo.paused && 
                                  !currentVideo.ended && 
                                  currentVideo.currentTime > 0;
    
    // Check if video should be in PiP (even if paused due to tab switch)
    const shouldVideoBeInPiPState = hasVideo && shouldVideoBeInPiP(currentVideo);
    
    // Notify the background script about video status
    safeSendMessage({
      action: 'videoStatusUpdate',
      hasVideo: hasVideo,
      isPlaying: isVideoCurrentlyPlaying,
      shouldPlay: shouldVideoBeInPiPState
    });
    
    // If we have a video that should be in PiP, and we're not in PiP mode,
    // check if we should enter PiP when the document is hidden
    if (shouldVideoBeInPiPState && !inPipMode && document.hidden) {
      enterPictureInPicture();
    }
  } catch (error) {
    console.error('Error checking for videos:', error);
  }
}

// Enter Picture-in-Picture mode (enhanced with video state preservation)
async function enterPictureInPicture() {
  try {
    // CRITICAL: Only enter PiP if the document is currently hidden (tab is in background)
    if (!document.hidden) {
      console.log('Cannot enter PiP: tab is currently active/visible');
      return;
    }
    
    // Check if user has granted permission for auto PiP
    if (!pipPermissionGranted && !pipPermissionRequested) {
      console.log('PiP permission not granted yet - showing permission UI');
      // Don't show UI if document is hidden - wait until they return to tab
      if (!document.hidden) {
        showPipPermissionUI();
      }
      return;
    }
    
    // If user declined permission, use enhanced fallback mode
    if (!pipPermissionGranted && pipPermissionRequested) {
      console.log('User declined PiP permission - using enhanced fallback mode');
      if (!useFallbackMode) {
        useFallbackMode = true;
        handlePipFallback();
      }
      return;
    }
    
    // Re-find the video element to ensure we have the current one
    const video = findYouTubeVideo();
    
    if (video && document.pictureInPictureEnabled) {
      // Check if we're already in PiP
      if (document.pictureInPictureElement === video) {
        inPipMode = true;
        return;
      }
      
      // Preserve video state before attempting PiP
      preserveVideoPlayback(video);
      
      // Check if we have permission and a relatively recent unlock
      const timeSinceUnlock = Date.now() - lastUserUnlock;
      const hasValidPermission = pipPermissionGranted && (timeSinceUnlock < 300000); // 5 minutes
      
      if (!hasValidPermission && !hasValidUserGesture()) {
        console.log('No valid permission or recent gesture for PiP. Setting up deferred entry.');
        
        // Mark that we have a pending PiP entry
        pendingPipEntry = true;
        
        // Add pending action to the enhanced gesture manager
        addPendingAction(() => {
          if (document.hidden) {
            console.log('Executing pending PiP entry with fresh gesture');
            enterPictureInPicture();
          }
        });
        
        // Set up enhanced gesture capture
        setupEnhancedGestureCapture();
        
        console.log('Deferred PiP entry set up - waiting for next user interaction');
        return;
      }
      
      // Double-check that document is still hidden before attempting PiP
      if (!document.hidden) {
        console.log('Document became visible before PiP attempt - aborting');
        return;
      }
      
      // Try to enter PiP
      if (video.requestPictureInPicture) {
        video.requestPictureInPicture()
          .then(() => {
            inPipMode = true;
            currentVideo = video;
            console.log('Entered Picture-in-Picture mode');
            
            // Ensure video continues playing in PiP
            if (videoState.wasPlaying && video.paused) {
              console.log('Resuming video playback in PiP mode');
              video.play().catch(error => {
                console.warn('Could not resume video in PiP:', error);
              });
            }
            
            safeSendMessage({ action: 'pipEntered' });
          })
          .catch(error => {
            console.error('Failed to enter Picture-in-Picture mode:', error);
            
            // Enhanced error analysis
            const errorName = error.name || 'Unknown';
            const errorMessage = error.message || error.toString();
            const errorCode = error.code || 'No code';
            
            console.log('PiP Error Details:', {
              name: errorName,
              message: errorMessage,
              code: errorCode,
              stack: error.stack,
              timestamp: new Date().toISOString(),
              documentHidden: document.hidden,
              hasValidGesture: hasValidUserGesture(),
              gestureAge: Date.now() - gestureManager.lastGestureTime,
              pipPermissionGranted: pipPermissionGranted,
              timeSinceUnlock: Date.now() - lastUserUnlock
            });
            
            // Track PiP failures
            pipFailedCount++;
            console.log(`PiP failure count: ${pipFailedCount}`);
            
            // Handle specific error types
            if (errorName === 'NotAllowedError' || 
                errorMessage.includes('user gesture') || 
                errorMessage.includes('user activation') ||
                errorMessage.includes('not allowed') ||
                errorMessage.includes('DOMException')) {
              
              console.log('PiP blocked: User gesture required or DOMException occurred.');
              
              // After 2 failed attempts, switch to enhanced fallback mode
              if (pipFailedCount >= 2) {
                console.log('Multiple PiP failures detected - switching to enhanced fallback mode');
                useFallbackMode = true;
                handlePipFallback();
                
                // Show user notification about fallback mode
                showFallbackNotification('PiP unavailable - video continues playing');
                return;
              }
              
              console.log('Setting up enhanced aggressive gesture capture...');
              
              // Reset gesture tracking and set up immediate capture
              gestureManager.hasValidGesture = false;
              pendingPipEntry = true;
              
              // Add pending action with retry logic
              addPendingAction(() => {
                if (document.hidden) {
                  console.log('Retrying PiP with fresh gesture');
                  // Multiple retry attempts
                  setTimeout(() => enterPictureInPicture(), 100);
                  setTimeout(() => {
                    if (!inPipMode && document.hidden) {
                      enterPictureInPicture();
                    }
                  }, 500);
                }
              });
              
              // Set up enhanced aggressive gesture capture
              setupAggressiveGestureCapture();
              
            } else if (errorName === 'InvalidStateError') {
              console.log('PiP blocked: Invalid state (video may not be ready)');
              
              // Try again after a short delay if document is still hidden
              if (document.hidden) {
                console.log('Retrying PiP after video state delay...');
                setTimeout(() => {
                  if (document.hidden) {
                    enterPictureInPicture();
                  }
                }, 1000);
              }
              
            } else if (errorName === 'NotSupportedError') {
              console.log('PiP not supported on this device/browser');
              // Switch to enhanced fallback mode
              useFallbackMode = true;
              handlePipFallback();
              
            } else {
              console.log('Unknown PiP error, will retry with next user gesture');
              gestureManager.hasValidGesture = false;
              pendingPipEntry = true;
              
              addPendingAction(() => {
                if (document.hidden) {
                  console.log('Retrying PiP with fresh gesture after unknown error');
                  enterPictureInPicture();
                }
              });
              
              setupEnhancedGestureCapture();
            }
            
            // Try to notify even if PiP fails
            safeSendMessage({ 
              action: 'pipFailed', 
              error: errorMessage,
              errorName: errorName
            });
          });
      }
    }
  } catch (error) {
    console.error('Error entering PiP:', error);
    // Try to notify even if PiP fails
    safeSendMessage({ action: 'pipFailed', error: error.message });
  }
}

// Exit Picture-in-Picture mode (enhanced with video state restoration)
function exitPictureInPicture() {
  try {
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture()
        .then(() => {
          inPipMode = false;
          
          // Restore video state when exiting PiP
          const video = findYouTubeVideo();
          if (video && videoState.lastStateChange) {
            console.log('Restoring video state after exiting PiP');
            restoreVideoState(video);
          }
          
          safeSendMessage({ action: 'exitPip' });
          console.log('Exited Picture-in-Picture mode');
        })
        .catch(error => {
          console.error('Failed to exit Picture-in-Picture mode:', error);
          
          // Force state update even if exit fails
          inPipMode = false;
          
          // Still try to restore video state
          const video = findYouTubeVideo();
          if (video && videoState.lastStateChange) {
            restoreVideoState(video);
          }
          
          safeSendMessage({ action: 'exitPip' });
        });
    } else {
      inPipMode = false;
      
      // Restore video state even if not in PiP
      const video = findYouTubeVideo();
      if (video && videoState.lastStateChange) {
        restoreVideoState(video);
      }
    }
  } catch (error) {
    console.error('Error exiting PiP:', error);
    
    // Force state update even if exit fails
    inPipMode = false;
    
    // Still try to restore video state
    const video = findYouTubeVideo();
    if (video && videoState.lastStateChange) {
      restoreVideoState(video);
    }
    
    safeSendMessage({ action: 'exitPip' });
  }
}

// Handle entering PiP
function onEnterPiP(event) {
  inPipMode = true;
  currentVideo = event.target;
  // Notify the background script
  safeSendMessage({ action: 'pipEntered' });
}

// Handle exiting PiP
function onLeavePiP(event) {
  inPipMode = false;
  // Notify the background script
  safeSendMessage({ action: 'pipExited' });
}

// Handle page visibility changes (enhanced with better state management)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Page is now hidden
    console.log('Tab became hidden');
    
    // Use a small delay to ensure video state is updated
    setTimeout(() => {
      checkForVideos();
      const video = findYouTubeVideo();
      
      if (video && shouldVideoBeInPiP(video)) {
        // Save video state before any operations
        saveVideoState(video);
        
        if (useFallbackMode) {
          console.log('Using enhanced fallback mode - preserving video state');
          handlePipFallback();
        } else {
          console.log('Attempting PiP entry with enhanced state preservation');
          enterPictureInPicture();
        }
      }
    }, 100);
  } else {
    // Page is now visible
    console.log('Tab became visible');
    
    if (inPipMode) {
      console.log('Exiting PiP mode');
      exitPictureInPicture();
    } else if (videoState.lastStateChange) {
      console.log('Restoring video state on tab return');
      const video = findYouTubeVideo();
      if (video) {
        restoreVideoState(video);
      }
    }
    
    // If we haven't asked for PiP permission yet and there's a video, show the UI
    if (!pipPermissionRequested && !pipPermissionGranted) {
      const video = findYouTubeVideo();
      if (video && shouldVideoBeInPiP(video)) {
        console.log('Showing PiP permission UI on tab return');
        // Small delay to let the tab fully load/become visible
        setTimeout(() => {
          if (!document.hidden && !pipPermissionRequested) {
            showPipPermissionUI();
          }
        }, 1000);
      }
    }
    
    // Reset PiP failure count when returning to tab (give PiP another chance)
    if (pipFailedCount > 0) {
      pipFailedCount = Math.max(0, pipFailedCount - 1);
      console.log(`Reduced PiP failure count to ${pipFailedCount} (giving PiP another chance)`);
    }
    
    // CRITICAL: When tab becomes visible, set up enhanced gesture capture
    // This ensures we have a fresh user gesture for the next PiP cycle
    setupEnhancedGestureCapture();
    
    // Set up immediate gesture capture for the next PiP attempt
    setupImmediateGestureCapture();
    
    // Clean up any pending actions since we're back on the tab
    gestureManager.pendingActions = [];
    
    // Reset PiP failure count more aggressively when returning to tab
    if (pipFailedCount > 0) {
      pipFailedCount = Math.max(0, pipFailedCount - 2);
      console.log(`Reduced PiP failure count to ${pipFailedCount} (giving PiP another chance)`);
      
      // If we were in fallback mode, try PiP again
      if (useFallbackMode && pipFailedCount === 0) {
        console.log('Resetting fallback mode - will try PiP again');
        useFallbackMode = false;
        showFallbackNotification('PiP mode restored - will try again');
      }
    }
  }
  
  // Adjust monitoring frequency based on visibility
  if (videoCheckInterval) {
    clearInterval(videoCheckInterval);
    startVideoMonitoring();
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

// Initialize when the DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}