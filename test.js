// test.js - Simple test utilities for the extension

/**
 * Test function to verify YouTube video detection
 */
function testVideoDetection() {
  console.log('Testing YouTube video detection...');
  
  // Check if we're on a YouTube page
  if (!window.location.hostname.includes('youtube.com')) {
    console.warn('Not on a YouTube page');
    return false;
  }
  
  // Try to find a video element
  const video = document.querySelector('video');
  if (video) {
    console.log('Video element found:', video);
    console.log('Video playing:', !video.paused);
    return true;
  } else {
    console.warn('No video element found');
    return false;
  }
}

/**
 * Test PiP functionality
 */
async function testPipFunctionality() {
  console.log('Testing PiP functionality...');
  
  // Check if PiP is supported
  if (!document.pictureInPictureEnabled) {
    console.warn('Picture-in-Picture is not enabled');
    return false;
  }
  
  // Find video element
  const video = document.querySelector('video');
  if (!video) {
    console.warn('No video element found');
    return false;
  }
  
  // Try to enter PiP
  try {
    if (!document.pictureInPictureElement) {
      await video.requestPictureInPicture();
      console.log('Successfully entered PiP mode');
      
      // Exit after a short delay
      setTimeout(async () => {
        try {
          await document.exitPictureInPicture();
          console.log('Successfully exited PiP mode');
        } catch (error) {
          console.error('Error exiting PiP:', error);
        }
      }, 2000);
    } else {
      console.log('Already in PiP mode');
    }
    return true;
  } catch (error) {
    console.error('Error entering PiP:', error);
    return false;
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('Running YouTu extension tests...');
  
  const videoDetectionResult = testVideoDetection();
  const pipResult = await testPipFunctionality();
  
  console.log('Test Results:');
  console.log('- Video Detection:', videoDetectionResult ? 'PASS' : 'FAIL');
  console.log('- PiP Functionality:', pipResult ? 'PASS' : 'FAIL');
  
  if (videoDetectionResult && pipResult) {
    console.log('All tests passed!');
  } else {
    console.log('Some tests failed. Check the logs above for details.');
  }
}

// Make functions available globally for testing
window.YouTuTest = {
  testVideoDetection,
  testPipFunctionality,
  runAllTests
};

console.log('YouTu test utilities loaded. Run tests with YouTuTest.runAllTests()');