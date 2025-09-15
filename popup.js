// popup.js - Handle popup UI logic and settings

// Load saved settings when popup opens
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Load settings from storage
    const data = await chrome.storage.sync.get([
      'enablePip',
      'enableNotifications',
      'enableWhitelist',
      'whitelist'
    ]);
    
    // Set checkbox states
    document.getElementById('enablePip').checked = data.enablePip !== false; // default to true
    document.getElementById('enableNotifications').checked = data.enableNotifications === true; // default to false
    document.getElementById('enableWhitelist').checked = data.enableWhitelist === true; // default to false
    
    // Set whitelist content
    if (data.whitelist) {
      document.getElementById('whitelist').value = data.whitelist.join('\n');
    }
    
    // Show/hide whitelist container based on checkbox
    document.getElementById('whitelistContainer').style.display = 
      document.getElementById('enableWhitelist').checked ? 'block' : 'none';
  } catch (error) {
    console.error('Error loading settings:', error);
  }
  
  // Add event listeners
  document.getElementById('enableWhitelist').addEventListener('change', function() {
    document.getElementById('whitelistContainer').style.display = this.checked ? 'block' : 'none';
  });
  
  document.getElementById('saveSettings').addEventListener('click', saveSettings);
});

// Save settings to storage
async function saveSettings() {
  try {
    // Get current values
    const enablePip = document.getElementById('enablePip').checked;
    const enableNotifications = document.getElementById('enableNotifications').checked;
    const enableWhitelist = document.getElementById('enableWhitelist').checked;
    
    // Process whitelist
    let whitelist = [];
    if (enableWhitelist) {
      const whitelistText = document.getElementById('whitelist').value;
      whitelist = whitelistText.split('\n')
        .map(channel => channel.trim())
        .filter(channel => channel.length > 0);
    }
    
    // Save to storage
    await chrome.storage.sync.set({
      enablePip,
      enableNotifications,
      enableWhitelist,
      whitelist
    });
    
    // Show confirmation
    const status = document.getElementById('status');
    status.textContent = 'Settings saved!';
    status.className = 'status enabled';
    
    // Reset status message after 2 seconds
    setTimeout(() => {
      status.textContent = 'Extension is active';
    }, 2000);
  } catch (error) {
    console.error('Error saving settings:', error);
    
    // Show error message
    const status = document.getElementById('status');
    status.textContent = 'Error saving settings';
    status.className = 'status disabled';
  }
}