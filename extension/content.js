// Content script - runs on all pages
// This can be extended to detect specific page changes or interactions

console.log('[Discord RPC] Content script loaded');

/**
 * Safe message sender that handles extension context invalidation
 */
function safeSendMessage(message) {
  try {
    // Check if extension context is still valid
    if (!chrome.runtime?.id) {
      console.log('[Discord RPC] Extension context invalidated, skipping message');
      return;
    }
    
    chrome.runtime.sendMessage(message, (response) => {
      // Check for errors
      if (chrome.runtime.lastError) {
        // Silently ignore context invalidation errors
        if (chrome.runtime.lastError.message?.includes('Extension context invalidated')) {
          console.log('[Discord RPC] Extension was reloaded, content script will be reloaded on next navigation');
        } else {
          console.warn('[Discord RPC] Message error:', chrome.runtime.lastError.message);
        }
      }
    });
  } catch (error) {
    // Ignore errors silently - extension might have been reloaded
    console.log('[Discord RPC] Could not send message:', error.message);
  }
}

// Listen for visibility changes
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    // Notify background that page is now visible
    safeSendMessage({ 
      type: 'pageVisible',
      url: window.location.href,
      title: document.title
    });
  }
});

// Listen for title changes (some SPAs change title dynamically)
let lastTitle = document.title;
const titleObserver = new MutationObserver(() => {
  if (document.title !== lastTitle) {
    lastTitle = document.title;
    safeSendMessage({ 
      type: 'titleChanged',
      url: window.location.href,
      title: document.title
    });
  }
});

// Only observe if title element exists
const titleElement = document.querySelector('title');
if (titleElement) {
  try {
    titleObserver.observe(titleElement, {
      childList: true,
      subtree: true,
      characterData: true
    });
  } catch (error) {
    console.warn('[Discord RPC] Could not observe title changes:', error.message);
  }
}

// Cleanup when extension is reloaded/unloaded
window.addEventListener('beforeunload', () => {
  try {
    titleObserver.disconnect();
  } catch (error) {
    // Ignore cleanup errors
  }
});

// Periodically check if extension context is still valid
// If not, stop all observers to prevent errors
const contextCheckInterval = setInterval(() => {
  try {
    if (!chrome.runtime?.id) {
      // Extension context lost - cleanup and stop
      console.log('[Discord RPC] Extension context lost, cleaning up...');
      titleObserver.disconnect();
      clearInterval(contextCheckInterval);
    }
  } catch (error) {
    // Context is invalid, stop checking
    clearInterval(contextCheckInterval);
  }
}, 5000); // Check every 5 seconds
