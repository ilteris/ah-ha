// Ah-Ha! Capture - content.js

console.log("Ah-Ha! Capture content script loaded and running.");

// Listener for messages from the extension (e.g., from popup or background)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Message received in content.js:", request);

  if (request.type === "GET_PAGE_SELECTION") {
    // Example: If background script needs to re-verify selection or get more context
    const selection = window.getSelection().toString();
    sendResponse({ selection: selection, url: window.location.href });
  } else if (request.type === "SHOW_CAPTURE_UI") {
    // Placeholder for future functionality to show some UI on the page
    console.log("Request to show capture UI received.");
    // Example: insertCaptureModal(request.data);
    sendResponse({ status: "Capture UI request noted." });
  }
  // Return true if you intend to send a response asynchronously.
  // return true;
});

// Example: A function that could be called to send selected text to background
// This might be triggered by an in-page button in the future.
function sendSelectionToBackground() {
  const selectionText = window.getSelection().toString().trim();
  if (selectionText) {
    chrome.runtime.sendMessage(
      {
        type: "CAPTURE_SNIPPET",
        payload: {
          selectionText: selectionText,
          content: document.body.innerText, // Or more specific context
          url: window.location.href,
        },
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error(
            "Error sending snippet from content script:",
            chrome.runtime.lastError.message
          );
        } else {
          console.log(
            "Response from background for CAPTURE_SNIPPET:",
            response
          );
        }
      }
    );
  } else {
    console.log("No text selected to send.");
  }
}

// Example: You could add an event listener for a key combination to trigger capture
// document.addEventListener('keydown', (event) => {
//   if (event.ctrlKey && event.shiftKey && event.key === 'S') { // Ctrl+Shift+S
//     event.preventDefault();
//     sendSelectionToBackground();
//   }
// });

console.log("Ah-Ha! Capture content script setup complete.");
