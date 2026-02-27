// Content script - runs on all pages
// This can be extended to detect specific page changes or interactions

console.log('[Discord RPC] Content script loaded');

// Listen for visibility changes
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    // Notify background that page is now visible
    chrome.runtime.sendMessage({ 
      type: 'pageVisible',
      url: window.location.href,
      title: document.title
    }).catch(() => {
      // Ignore errors if extension context is invalidated
    });
  }
});

// Listen for title changes (some SPAs change title dynamically)
let lastTitle = document.title;
const titleObserver = new MutationObserver(() => {
  if (document.title !== lastTitle) {
    lastTitle = document.title;
    chrome.runtime.sendMessage({ 
      type: 'titleChanged',
      url: window.location.href,
      title: document.title
    }).catch(() => {
      // Ignore errors if extension context is invalidated
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
