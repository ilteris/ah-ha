document.addEventListener("DOMContentLoaded", () => {
  const titleInput = document.getElementById("snippet-title");
  const contentEditableDiv = document.getElementById("snippet-content"); // Changed from contentTextarea
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
    // Populate contentEditableDiv with HTML, fallback to textContent
    if (data.htmlContent) {
      contentEditableDiv.innerHTML = data.htmlContent;
    } else if (data.textContent) {
      contentEditableDiv.innerText = data.textContent; // Fallback for plain text
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
  const dataKey = urlParams.get("dataKey");

  if (dataKey) {
    chrome.storage.local.get(dataKey, (result) => {
      if (chrome.runtime.lastError) {
        console.error(
          "Error retrieving data from local storage:",
          chrome.runtime.lastError.message
        );
        titleInput.value = "Error loading data";
        contentEditableDiv.innerText =
          "Could not load snippet content (storage read error).";
        return;
      }

      const storedData = result[dataKey];
      if (storedData) {
        console.log("Data retrieved from local storage:", storedData);
        populateForm(storedData);
        // Clean up the data from local storage
        chrome.storage.local.remove(dataKey, () => {
          if (chrome.runtime.lastError) {
            console.error(
              "Error removing data from local storage:",
              chrome.runtime.lastError.message
            );
          } else {
            console.log(
              "Cleaned up data from local storage with key:",
              dataKey
            );
          }
        });
      } else {
        console.error("No data found in local storage for key:", dataKey);
        titleInput.value = "Error loading data";
        contentEditableDiv.innerText =
          "Could not load snippet content (data missing).";
      }
    });
  } else {
    console.warn("No dataKey found in URL parameters for capture UI.");
    // Potentially close the window or show an error if no data is present,
    // as this UI isn't meant to be opened directly without context.
    titleInput.value = "Error loading data";
    contentEditableDiv.innerText =
      "Could not load snippet content (no data key).";
  }

  saveButton.addEventListener("click", () => {
    // Removed tagsArray logic

    const snippetData = {
      title: titleInput.value.trim(),
      htmlContent: contentEditableDiv.innerHTML.trim(), // Get HTML content
      textContent: contentEditableDiv.innerText.trim(), // Also get plain text for fallback/summary
      notes: notesTextarea.value.trim(), // Added notes
      permalink_to_origin: urlInput.value, // Get from the hidden input
      // original_context: initialData ? initialData.context : '', // If you pass full context
    };

    if (!snippetData.title && !snippetData.textContent) {
      // Check textContent for emptiness
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
