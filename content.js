// content.js - Content script for YouTube video detection and PiP control

// Keep track of PiP state
let inPipMode = false;
let videoObserver = null;
let playerObserver = null;

// Function to initialize the content script
function init() {
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
  
  // Check for existing videos
  setTimeout(checkForVideos, 1000);
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
            checkForVideos();
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
        setTimeout(checkForVideos, 500);
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
        }
      });
    });
  });
  
  bodyObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Check for video elements on the page
function checkForVideos() {
  try {
    const video = document.querySelector('video');
    const hasVideo = !!video;
    
    // Notify the background script about video status
    chrome.runtime.sendMessage({
      action: 'videoStatusUpdate',
      hasVideo: hasVideo
    });
    
    // If we have a video and it's playing, and we're not in PiP mode,
    // check if we should enter PiP
    if (hasVideo && !inPipMode) {
      // Check if the document is hidden (user switched tabs)
      if (document.hidden) {
        enterPictureInPicture();
      }
    }
  } catch (error) {
    console.error('Error checking for videos:', error);
  }
}

// Enter Picture-in-Picture mode
function enterPictureInPicture() {
  try {
    const video = document.querySelector('video');
    
    if (video && document.pictureInPictureEnabled) {
      // Check if we're already in PiP
      if (document.pictureInPictureElement) {
        inPipMode = true;
        return;
      }
      
      // Try to enter PiP
      if (video.requestPictureInPicture) {
        video.requestPictureInPicture()
          .then(() => {
            inPipMode = true;
            console.log('Entered Picture-in-Picture mode');
          })
          .catch(error => {
            console.error('Failed to enter Picture-in-Picture mode:', error);
          });
      }
    }
  } catch (error) {
    console.error('Error entering PiP:', error);
  }
}

// Exit Picture-in-Picture mode
function exitPictureInPicture() {
  try {
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture()
        .then(() => {
          inPipMode = false;
          chrome.runtime.sendMessage({ action: 'exitPip' });
          console.log('Exited Picture-in-Picture mode');
        })
        .catch(error => {
          console.error('Failed to exit Picture-in-Picture mode:', error);
        });
    } else {
      inPipMode = false;
    }
  } catch (error) {
    console.error('Error exiting PiP:', error);
  }
}

// Handle entering PiP
function onEnterPiP(event) {
  inPipMode = true;
  // Notify the background script
  chrome.runtime.sendMessage({ action: 'pipEntered' });
}

// Handle exiting PiP
function onLeavePiP(event) {
  inPipMode = false;
  // Notify the background script
  chrome.runtime.sendMessage({ action: 'pipExited' });
}

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Page is now hidden, check if we should enter PiP
    checkForVideos();
  } else {
    // Page is now visible, exit PiP if we're in it
    if (inPipMode) {
      exitPictureInPicture();
    }
  }
});

// Initialize when the DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}