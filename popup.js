// popup.js - Handle popup UI logic and settings

// Utility function to safely access storage
async function safeGetStorage(keys) {
  try {
    if (chrome.storage && chrome.storage.sync) {
      return await chrome.storage.sync.get(keys);
    } else {
      console.warn('Storage API not available');
      return {};
    }
  } catch (error) {
    console.error('Error accessing storage:', error);
    return {};
  }
}

// Utility function to safely set storage
async function safeSetStorage(data) {
  try {
    if (chrome.storage && chrome.storage.sync) {
      await chrome.storage.sync.set(data);
      return true;
    } else {
      console.warn('Storage API not available');
      return false;
    }
  } catch (error) {
    console.error('Error setting storage:', error);
    return false;
  }
}

// Load saved settings when popup opens
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Load settings from storage
    const data = await safeGetStorage([
      'enableDetection',
      'enableNotifications',
      'enableAutoConnect'
    ]);
    
    // Set checkbox states (with defaults)
    document.getElementById('enableDetection').checked = data.enableDetection !== false; // default to true
    document.getElementById('enableNotifications').checked = data.enableNotifications === true; // default to false
    document.getElementById('enableAutoConnect').checked = data.enableAutoConnect !== false; // default to true
  } catch (error) {
    console.error('Error loading settings:', error);
  }
  
  // Add event listeners
  document.getElementById('saveSettings').addEventListener('click', saveSettings);
});

// Save settings to storage
async function saveSettings() {
  try {
    // Get current values
    const enableDetection = document.getElementById('enableDetection').checked;
    const enableNotifications = document.getElementById('enableNotifications').checked;
    const enableAutoConnect = document.getElementById('enableAutoConnect').checked;
    
    // Save to storage
    const success = await safeSetStorage({
      enableDetection,
      enableNotifications,
      enableAutoConnect
    });
    
    // Show confirmation
    const status = document.getElementById('status');
    if (success) {
      status.textContent = 'Settings saved!';
      status.className = 'status enabled';
      
      // Reset status message after 2 seconds
      setTimeout(() => {
        status.textContent = 'Extension is active';
      }, 2000);
    } else {
      status.textContent = 'Error saving settings';
      status.className = 'status disabled';
    }
  } catch (error) {
    console.error('Error saving settings:', error);
    
    // Show error message
    const status = document.getElementById('status');
    status.textContent = 'Error saving settings';
    status.className = 'status disabled';
  }
}