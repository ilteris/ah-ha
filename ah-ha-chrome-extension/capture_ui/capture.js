document.addEventListener("DOMContentLoaded", () => {
  const titleInput = document.getElementById("snippet-title");
  const contentTextarea = document.getElementById("snippet-content");
  const notesTextarea = document.getElementById("snippet-notes"); // Added for notes
  const urlInput = document.getElementById("snippet-url"); // Hidden, but we'll store URL here
  const saveButton = document.getElementById("save-button");
  const cancelButton = document.getElementById("cancel-button");

  let initialData = null;

  // Function to populate form fields
  function populateForm(data) {
    initialData = data;
    if (data.title) {
      titleInput.value = data.title;
    }
    if (data.textContent) {
      contentTextarea.value = data.textContent;
    }
    if (data.sourceUrl) {
      urlInput.value = data.sourceUrl; // Store it, though field is hidden
    }
    // Tags will be empty initially for the user to fill
  }

  // Listen for messages from the background script containing initial data
  // This approach assumes background.js will send a message to this specific tab/window.
  // A more robust way is to get data from URL query parameters if background.js opens this page with them.
  // For now, let's assume URL parameters for simplicity and robustness.

  const urlParams = new URLSearchParams(window.location.search);
  const encodedData = urlParams.get("data");

  if (encodedData) {
    try {
      const decodedData = JSON.parse(decodeURIComponent(encodedData));
      populateForm(decodedData);
    } catch (e) {
      console.error("Error parsing initial data from URL:", e);
      // Fallback or error display
      titleInput.value = "Error loading data";
      contentTextarea.value = "Could not load snippet content.";
    }
  } else {
    console.warn("No initial data found in URL parameters for capture UI.");
    // Potentially close the window or show an error if no data is present,
    // as this UI isn't meant to be opened directly without context.
  }

  saveButton.addEventListener("click", () => {
    // Removed tagsArray logic

    const snippetData = {
      title: titleInput.value.trim(),
      content: contentTextarea.value.trim(),
      notes: notesTextarea.value.trim(), // Added notes
      permalink_to_origin: urlInput.value, // Get from the hidden input
      // original_context: initialData ? initialData.context : '', // If you pass full context
    };

    if (!snippetData.title && !snippetData.content) {
      alert("Title or content cannot be empty.");
      return;
    }

    // Send data back to background script
    chrome.runtime.sendMessage(
      {
        type: "SAVE_ENRICHED_SNIPPET",
        payload: snippetData,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error(
            "Error sending snippet data to background:",
            chrome.runtime.lastError.message
          );
          alert("Error saving snippet: " + chrome.runtime.lastError.message);
        } else if (response && response.status === "success") {
          // alert("Snippet saved successfully!"); // Optional: background can send notification
          window.close(); // Close the capture UI window on success
        } else if (response && response.status === "error") {
          alert(
            "Failed to save snippet: " + (response.error || "Unknown error")
          );
        } else {
          alert(
            "Failed to save snippet. No response or unexpected response from background."
          );
        }
      }
    );
  });

  cancelButton.addEventListener("click", () => {
    window.close(); // Close the capture UI window
  });
});
