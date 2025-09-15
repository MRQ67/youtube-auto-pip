// errors.js - Error handling and reporting utilities

/**
 * Custom error class for extension-specific errors
 */
class YouTuError extends Error {
  constructor(message, code = 'UNKNOWN_ERROR', details = {}) {
    super(message);
    this.name = 'YouTuError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Log an error with context
 * @param {Error|string} error - The error to log
 * @param {string} context - Context where the error occurred
 * @param {object} additionalData - Additional data to log
 */
function logError(error, context, additionalData = {}) {
  const errorData = {
    timestamp: new Date().toISOString(),
    context,
    message: error.message || error,
    stack: error.stack || 'No stack trace',
    ...additionalData
  };
  
  console.error('[YouTu Error]', errorData);
  
  // In production, you might want to send this to a logging service
  // sendErrorReport(errorData);
}

/**
 * Handle PiP API errors
 * @param {Error} error - The error from PiP API
 * @param {string} action - The action that failed (enter/exit)
 */
function handlePipError(error, action) {
  logError(error, `PiP_${action}_failed`, { action });
  
  // Show user-friendly message
  const actionText = action === 'enter' ? 'enter' : 'exit';
  console.warn(`Could not ${actionText} Picture-in-Picture mode. This might be due to browser restrictions.`);
  
  // Additional handling based on error type
  if (error.name === 'NotAllowedError') {
    console.info('PiP requires a user gesture. Try interacting with the page first.');
  } else if (error.name === 'NotSupportedError') {
    console.info('Picture-in-Picture is not supported on this device/browser.');
  }
}

/**
 * Handle YouTube detection errors
 * @param {Error} error - The detection error
 * @param {string} elementType - The type of element that failed detection
 */
function handleDetectionError(error, elementType) {
  logError(error, `YouTube_${elementType}_detection_failed`, { elementType });
  
  // Depending on the element type, we might want to retry or fallback
  console.warn(`Could not detect ${elementType} on YouTube page. Retrying...`);
}

/**
 * Handle communication errors between scripts
 * @param {Error} error - The communication error
 * @param {string} source - Source of the message
 * @param {string} target - Target of the message
 */
function handleCommunicationError(error, source, target) {
  logError(error, 'Script_communication_error', { source, target });
  
  console.warn(`Communication failed between ${source} and ${target}. This might be temporary.`);
}

/**
 * Report an error to the background script
 * @param {Error} error - The error to report
 * @param {string} context - Context where the error occurred
 */
function reportError(error, context) {
  try {
    chrome.runtime.sendMessage({
      action: 'errorReport',
      error: {
        message: error.message,
        name: error.name,
        stack: error.stack,
        context
      }
    });
  } catch (sendError) {
    // If we can't send the error, log it locally
    logError(sendError, 'Error_reporting_failed', { originalError: error.message });
  }
}

// Export functions
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    YouTuError,
    logError,
    handlePipError,
    handleDetectionError,
    handleCommunicationError,
    reportError
  };
}