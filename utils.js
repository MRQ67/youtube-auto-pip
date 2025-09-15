// utils.js - Shared utility functions

/**
 * Check if the current page is a YouTube page
 * @returns {boolean} True if the current page is a YouTube page
 */
function isYouTubePage() {
  return window.location.hostname.includes('youtube.com');
}

/**
 * Get the current YouTube video ID
 * @returns {string|null} The video ID or null if not found
 */
function getVideoId() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('v') || extractVideoIdFromUrl(window.location.href);
}

/**
 * Extract video ID from various YouTube URL formats
 * @param {string} url - The YouTube URL
 * @returns {string|null} The video ID or null if not found
 */
function extractVideoIdFromUrl(url) {
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

/**
 * Get the current YouTube channel name
 * @returns {string|null} The channel name or null if not found
 */
function getChannelName() {
  // Try to get channel name from various selectors
  const selectors = [
    '#channel-name .yt-simple-endpoint',
    '.ytd-channel-name a',
    '.ytd-video-owner-renderer a'
  ];
  
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent) {
      return element.textContent.trim();
    }
  }
  
  return null;
}

/**
 * Check if PiP is supported in the current browser
 * @returns {boolean} True if PiP is supported
 */
function isPipSupported() {
  return document.pictureInPictureEnabled !== undefined && 
         document.pictureInPictureEnabled === true;
}

/**
 * Check if a video element is currently playing
 * @param {HTMLVideoElement} video - The video element to check
 * @returns {boolean} True if the video is playing
 */
function isVideoPlaying(video) {
  return !!(video && video.currentTime > 0 && !video.paused && !video.ended && video.readyState > 2);
}

/**
 * Debounce function to limit the rate at which a function is called
 * @param {Function} func - The function to debounce
 * @param {number} delay - The delay in milliseconds
 * @returns {Function} The debounced function
 */
function debounce(func, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

/**
 * Check if the document is currently hidden (user switched tabs)
 * @returns {boolean} True if the document is hidden
 */
function isDocumentHidden() {
  return document.hidden;
}

/**
 * Get the current tab ID (only works in content scripts)
 * @returns {Promise<number>} The tab ID
 */
async function getCurrentTabId() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else if (tabs.length > 0) {
        resolve(tabs[0].id);
      } else {
        reject(new Error('No active tab found'));
      }
    });
  });
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    isYouTubePage,
    getVideoId,
    extractVideoIdFromUrl,
    getChannelName,
    isPipSupported,
    isVideoPlaying,
    debounce,
    isDocumentHidden,
    getCurrentTabId
  };
}