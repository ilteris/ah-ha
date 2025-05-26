// Ah-Ha! Capture - background.js (Service Worker)

// --- Globals ---
const AH_HA_API_BASE_URL = "http://localhost:8010/api/v1"; // Replace with your actual backend API URL
const CONTEXT_MENU_ID = "AH_HA_CAPTURE_CONTEXT_MENU";

let currentAuthToken = null;
let currentUserLoggedIn = false; // In-memory flag for immediate state

// --- OAuth 2.0 Configuration (Replace with your actual provider details) ---
const OAUTH_CLIENT_ID =
  "36070612387-nib9a64uruobemn3hicj5oio9k3t5sdb.apps.googleusercontent.com";
const OAUTH_SCOPES = "email profile openid"; // Adjust scopes as needed
const OAUTH_AUTHORIZATION_URL = "https://accounts.google.com/o/oauth2/v2/auth"; // e.g., 'https://accounts.google.com/o/oauth2/v2/auth'
const OAUTH_REDIRECT_URI = `https://${chrome.runtime.id}.chromiumapp.org/oauth_callback.html`; // Standard redirect for Chrome extensions

// --- Event Listeners ---

// Runs when the extension is first installed or updated.
chrome.runtime.onInstalled.addListener(() => {
  console.log("Ah-Ha! Capture extension installed/updated.");
  setupContextMenu();
  // Perform other setup tasks here if needed, e.g., initializing storage
});

// Listener for context menu item clicks.
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === CONTEXT_MENU_ID) {
    handleContextMenuClick(info, tab);
  }
});

// Listener for messages from popup or content scripts.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Message received in background:", request);

  if (request.type === "GET_AUTH_STATUS") {
    checkAuthenticationStatus()
      .then((isAuthenticated) => {
        sendResponse({ isAuthenticated: isAuthenticated });
      })
      .catch((error) => {
        console.error("Error checking auth status in GET_AUTH_STATUS:", error);
        sendResponse({ isAuthenticated: false, error: error.message });
      });
    return true; // Indicates that the response will be sent asynchronously.
  } else if (request.type === "LOGIN") {
    initiateOAuthFlow(sendResponse);
    return true; // Indicates that the response will be sent asynchronously.
  } else if (request.type === "LOGOUT") {
    // Clear stored tokens and simulated login flag
    chrome.storage.local.remove(
      [
        "authToken",
        "idToken",
        "tokenExpiryTime",
        "ahHaUserLoggedIn",
        "refreshToken",
        "oauthNonce",
      ], // Clear nonce too
      () => {
        currentAuthToken = null; // Clear in-memory token
        currentUserLoggedIn = false; // Clear in-memory flag
        if (chrome.runtime.lastError) {
          console.error(
            "Error clearing tokens on logout:",
            chrome.runtime.lastError.message
          );
          sendResponse({
            status: "Logout failed to clear tokens.",
            error: chrome.runtime.lastError.message,
          });
        } else {
          console.log("Tokens and login flag cleared on logout.");
          sendResponse({ status: "Logout successful. Tokens cleared." });
        }
      }
    );
    return true; // Indicates that the response will be sent asynchronously.
  } else if (request.type === "CAPTURE_SNIPPET") {
    // Message from content script with selected text and URL
    const { content, url, selectionText } = request.payload;
    console.log("Snippet capture request received:", request.payload);
    saveSnippet({
      textContent: selectionText || content,
      sourceUrl: url,
      context: content,
    }); // Added context
    sendResponse({ status: "Snippet capture initiated." }); // This case might become obsolete or change
  } else if (request.type === "SAVE_ENRICHED_SNIPPET") {
    const snippetDataFromUI = request.payload; // Renamed for clarity
    console.log(
      "Received enriched snippet data from capture UI:",
      snippetDataFromUI
    );
    saveSnippet({
      title: snippetDataFromUI.title,
      notes: snippetDataFromUI.notes,
      sourceUrl: snippetDataFromUI.permalink_to_origin,
      htmlContent: snippetDataFromUI.htmlContent, // Correctly pass htmlContent
      textContent: snippetDataFromUI.textContent, // Correctly pass textContent
      // context: snippetDataFromUI.original_context // If you pass this
    })
      .then((result) => {
        sendResponse({ status: "success", data: result });
        // Optionally send a desktop notification for success from background
        chrome.notifications.create({
          type: "basic",
          iconUrl: "icons/icon48.png",
          title: "Ah-Ha! Capture",
          message: "Snippet saved successfully!",
          priority: 2, // Max priority
          requireInteraction: true, // Keep notification until user interacts
        });
      })
      .catch((error) => {
        console.error("Error saving enriched snippet:", error);
        sendResponse({ status: "error", error: error.message });
        // Optionally send a desktop notification for error from background
        chrome.notifications.create({
          type: "basic",
          iconUrl: "icons/icon48.png",
          title: "Ah-Ha! Capture Error",
          message: `Failed to save snippet: ${error.message}`,
        });
      });
    return true; // Indicates asynchronous response
  }
  // Return true if you intend to send a response asynchronously for other types
  // return true;
});

// --- Helper Functions ---

// Sets up the context menu item.
function setupContextMenu() {
  chrome.contextMenus.create(
    {
      id: CONTEXT_MENU_ID,
      title: "Save to Ah-Ha!",
      contexts: ["selection"], // Only show when text is selected
    },
    () => {
      if (chrome.runtime.lastError) {
        console.error(
          "Error creating context menu:",
          chrome.runtime.lastError.message
        );
      } else {
        console.log("Context menu created successfully.");
      }
    }
  );
}

// Handles the context menu click event.
async function handleContextMenuClick(info, tab) {
  if (!tab || !tab.url) {
    console.error("Cannot get tab information for context menu click.");
    return;
  }
  console.log("Context menu clicked:", info);
  console.log("Tab information:", tab);

  // const selectionText = info.selectionText; // We'll get this from content script
  const pageUrl = info.pageUrl || tab.url; // pageUrl is usually more reliable

  // Send message to content script to get selected HTML and text
  chrome.tabs.sendMessage(tab.id, { type: "GET_SELECTED_HTML" }, (response) => {
    if (chrome.runtime.lastError) {
      console.error(
        "Error getting selected HTML from content script:",
        chrome.runtime.lastError.message
      );
      // Fallback or notify user
      chrome.notifications.create({
        type: "basic",
        iconUrl: "icons/icon48.png",
        title: "Ah-Ha! Capture Error",
        message: "Could not get selected content from page.",
      });
      return;
    }

    if (!response || (!response.html && !response.text)) {
      console.warn("No HTML or text content received from content script.");
      // Optionally, notify the user via a desktop notification if no text selected
      return;
    }

    const selectedHtml = response.html;
    const selectedText = response.text; // Fallback for title or if HTML is empty

    console.log(
      `Selected HTML: "${
        selectedHtml ? selectedHtml.substring(0, 100) + "..." : "N/A"
      }" from URL: ${pageUrl}`
    );
    console.log(
      `Selected Text: "${
        selectedText ? selectedText.substring(0, 100) + "..." : "N/A"
      }"`
    );

    // Instead of saving directly, open the capture UI
    const captureUiUrl = chrome.runtime.getURL("capture_ui/capture.html");

    // Prepare data to pass to the capture UI
    const initialData = {
      htmlContent: selectedHtml, // Pass HTML content
      textContent: selectedText, // Pass plain text as well (for title, fallback)
      sourceUrl: pageUrl,
      title:
        selectedText.substring(0, 70) + (selectedText.length > 70 ? "..." : ""), // Auto-generate initial title from plain text
      // context: info.frameUrl || tab.url // Or more detailed context if needed
    };

    // Store data in local storage temporarily for the capture UI to fetch
    const dataKey = `captureUiData_${Date.now()}`; // Unique key
    chrome.storage.local.set({ [dataKey]: initialData }, () => {
      if (chrome.runtime.lastError) {
        console.error(
          "Error saving initialData to local storage:",
          chrome.runtime.lastError.message
        );
        chrome.notifications.create({
          type: "basic",
          iconUrl: "icons/icon48.png",
          title: "Ah-Ha! Capture Error",
          message: "Could not prepare data for capture dialog.",
        });
        return;
      }

      const urlWithParams = `${captureUiUrl}?dataKey=${dataKey}`;

      // Open a new window for the capture UI
      chrome.windows.create(
        {
          url: urlWithParams,
          type: "popup", // 'popup' or 'panel' are common for this
          width: 450, // Adjust size as needed
          height: 550, // Adjust size as needed
          focused: true,
        },
        (window) => {
          if (chrome.runtime.lastError) {
            console.error(
              "Error opening capture UI window:",
              chrome.runtime.lastError.message
            );
            // Fallback or error notification if window creation fails
            chrome.notifications.create({
              type: "basic",
              iconUrl: "icons/icon48.png",
              title: "Ah-Ha! Capture Error",
              message: "Could not open capture dialog.",
            });
          } else {
            console.log("Capture UI window opened:", window.id);
          }
        }
      );
    }); // Close chrome.storage.local.set callback
  }); // Close the sendMessage callback
}

// Function to check authentication status (checks for a stored token)
async function checkAuthenticationStatus() {
  console.log(
    "checkAuthenticationStatus: Initial in-memory: currentUserLoggedIn=",
    currentUserLoggedIn,
    ", currentAuthToken=",
    !!currentAuthToken
  );

  // Prioritize in-memory state for immediate checks post-login/logout
  if (currentUserLoggedIn && currentAuthToken) {
    console.log(
      "checkAuthenticationStatus: Using current in-memory state - Logged In."
    );
    return true;
  }

  // If in-memory suggests logged out, or if token is missing, check storage
  try {
    console.log(
      "checkAuthenticationStatus: In-memory state not conclusive or token missing, querying chrome.storage.local..."
    );
    const storageResult = await chrome.storage.local.get([
      "authToken",
      "ahHaUserLoggedIn",
    ]);
    console.log("checkAuthenticationStatus: Data from storage:", storageResult);

    const tokenFromStorage = storageResult.authToken;
    const flagFromStorage = storageResult.ahHaUserLoggedIn;

    if (tokenFromStorage) {
      console.log(
        "checkAuthenticationStatus: authToken found in storage. Updating in-memory state."
      );
      currentAuthToken = tokenFromStorage;
      currentUserLoggedIn = true;
      return true;
    }

    if (flagFromStorage) {
      console.log(
        "checkAuthenticationStatus: ahHaUserLoggedIn flag found in storage (authToken was not). Considering logged in for now."
      );
      currentUserLoggedIn = true;
      return true;
    }

    console.log(
      "checkAuthenticationStatus: No conclusive auth state in storage. Ensuring in-memory is logged out."
    );
    currentAuthToken = null;
    currentUserLoggedIn = false;
    return false;
  } catch (error) {
    console.error(
      "checkAuthenticationStatus: Error reading from chrome.storage.local:",
      error
    );
    currentAuthToken = null;
    currentUserLoggedIn = false;
    return false;
  }
}

// Initiates the OAuth 2.0 web authentication flow.
function initiateOAuthFlow(sendResponseToPopup) {
  if (
    !OAUTH_CLIENT_ID ||
    OAUTH_CLIENT_ID === "YOUR_OAUTH_CLIENT_ID" ||
    !OAUTH_AUTHORIZATION_URL ||
    OAUTH_AUTHORIZATION_URL === "YOUR_OAUTH_PROVIDER_AUTH_URL"
  ) {
    console.error(
      "OAuth Client ID or Authorization URL is not configured. Please update background.js"
    );
    sendResponseToPopup({
      status: "OAuth not configured.",
      error: "Client ID or Auth URL missing.",
    });
    return;
  }

  const nonce = generateNonce();
  chrome.storage.local.set({ oauthNonce: nonce }, async () => {
    if (chrome.runtime.lastError) {
      console.error("Error storing nonce:", chrome.runtime.lastError.message);
      sendResponseToPopup({
        status: "OAuth setup failed (nonce storage).",
        error: chrome.runtime.lastError.message,
      });
      return;
    }

    const authUrl = new URL(OAUTH_AUTHORIZATION_URL);
    authUrl.searchParams.append("client_id", OAUTH_CLIENT_ID);
    authUrl.searchParams.append("redirect_uri", OAUTH_REDIRECT_URI);
    authUrl.searchParams.append("response_type", "token id_token"); // Or 'code' for Authorization Code flow
    authUrl.searchParams.append("scope", OAUTH_SCOPES);
    authUrl.searchParams.append("nonce", nonce); // Add nonce to the auth request
    // Add any other parameters required by your OAuth provider (e.g., state for PKCE)

    console.log("Initiating OAuth with URL:", authUrl.toString());

    try {
      const redirectUrl = await chrome.identity.launchWebAuthFlow({
        url: authUrl.toString(),
        interactive: true,
      });

      // DO NOT clear nonce yet. We need it for verification.

      if (chrome.runtime.lastError || !redirectUrl) {
        console.error(
          "OAuth flow failed:",
          chrome.runtime.lastError
            ? chrome.runtime.lastError.message
            : "No redirect URL received."
        );
        await clearOauthNonce(); // Clear nonce if flow failed before verification attempt
        await chrome.storage.local.set({
          ahHaUserLoggedIn: false,
          authToken: null,
          idToken: null,
          tokenExpiryTime: null,
        });
        sendResponseToPopup({
          status: "OAuth flow failed or cancelled.",
          error: chrome.runtime.lastError
            ? chrome.runtime.lastError.message
            : "Cancelled",
        });
        return;
      }

      console.log("OAuth flow successful. Redirect URL:", redirectUrl);
      const params = new URLSearchParams(
        redirectUrl.substring(redirectUrl.indexOf("#") + 1)
      );
      const accessToken = params.get("access_token");
      const idToken = params.get("id_token"); // This is the JWT we need to parse for the nonce
      const expiresIn = params.get("expires_in");

      // Retrieve the stored nonce
      const storedNonceResult = await chrome.storage.local.get("oauthNonce");
      const storedNonce = storedNonceResult.oauthNonce;

      if (!storedNonce) {
        console.error("Stored nonce not found. Cannot verify ID token nonce.");
        await clearOauthNonce(); // Clear if it somehow still exists
        await chrome.storage.local.set({
          ahHaUserLoggedIn: false,
          authToken: null,
          idToken: null,
          tokenExpiryTime: null,
        });
        currentUserLoggedIn = false;
        currentAuthToken = null; // Update in-memory state
        sendResponseToPopup({
          status: "OAuth flow failed: Nonce verification setup error.",
        });
        return;
      }

      if (idToken) {
        try {
          const decodedIdToken = parseJwt(idToken); // Basic JWT parsing
          if (decodedIdToken && decodedIdToken.nonce) {
            if (decodedIdToken.nonce !== storedNonce) {
              console.error(
                "Nonce mismatch! ID Token Nonce:",
                decodedIdToken.nonce,
                "Stored Nonce:",
                storedNonce
              );
              await clearOauthNonce(); // Clear nonce after attempting verification
              await chrome.storage.local.set({
                ahHaUserLoggedIn: false,
                authToken: null,
                idToken: null,
                tokenExpiryTime: null,
              });
              currentUserLoggedIn = false;
              currentAuthToken = null; // Update in-memory state
              sendResponseToPopup({
                status:
                  "OAuth flow failed: Nonce mismatch. Security check failed.",
              });
              return;
            }
            console.log("Nonce verified successfully:", decodedIdToken.nonce);
          } else {
            console.warn(
              "Nonce claim not found in ID token or ID token is invalid."
            );
            await clearOauthNonce();
            await chrome.storage.local.set({
              ahHaUserLoggedIn: false,
              authToken: null,
              idToken: null,
              tokenExpiryTime: null,
            });
            currentUserLoggedIn = false;
            currentAuthToken = null; // Update in-memory state
            sendResponseToPopup({
              status: "OAuth flow failed: Nonce claim missing in ID token.",
            });
            return;
          }
        } catch (e) {
          console.error("Error parsing ID token:", e);
          await clearOauthNonce();
          await chrome.storage.local.set({
            ahHaUserLoggedIn: false,
            authToken: null,
            idToken: null,
            tokenExpiryTime: null,
          });
          currentUserLoggedIn = false;
          currentAuthToken = null; // Update in-memory state
          sendResponseToPopup({
            status: "OAuth flow failed: Could not parse ID token.",
          });
          return;
        }
      } else {
        console.warn(
          "ID token not found in redirect URL. Cannot verify nonce."
        );
        await clearOauthNonce();
        await chrome.storage.local.set({
          ahHaUserLoggedIn: false,
          authToken: null,
          idToken: null,
          tokenExpiryTime: null,
        });
        currentUserLoggedIn = false;
        currentAuthToken = null; // Update in-memory state
        sendResponseToPopup({
          status: "OAuth flow failed: ID token missing from response.",
        });
        return;
      }

      // Nonce has been verified (or an error occurred preventing verification).
      // NOW it's safe to clear the nonce we originally stored for this flow.
      await clearOauthNonce();

      if (accessToken) {
        const expiryTime = expiresIn
          ? Date.now() + parseInt(expiresIn, 10) * 1000
          : null;

        const tokenStorageObject = {
          authToken: accessToken,
          idToken: idToken,
          tokenExpiryTime: expiryTime,
          ahHaUserLoggedIn: true,
        };

        console.log(
          "Attempting to store tokens in chrome.storage.local:",
          tokenStorageObject
        );
        chrome.storage.local.set(tokenStorageObject, () => {
          if (chrome.runtime.lastError) {
            console.error(
              "CRITICAL ERROR in chrome.storage.local.set callback after OAuth:",
              chrome.runtime.lastError.message,
              "Token data that was attempted to be stored:",
              {
                accessTokenSubstring: accessToken
                  ? accessToken.substring(0, 10)
                  : "N/A",
                idTokenPresent: !!idToken,
                ahHaUserLoggedInFlag: true,
              }
            );
            currentAuthToken = null;
            currentUserLoggedIn = false;
            sendResponseToPopup({
              status:
                "Login Succeeded (OAuth), but CRITICAL error storing session details. Please check extension console.",
              error: `Storage set error: ${chrome.runtime.lastError.message}`,
            });
          } else {
            currentAuthToken = accessToken;
            currentUserLoggedIn = true;
            console.log(
              "SUCCESS: chrome.storage.local.set completed. In-memory state updated. currentAuthToken set, currentUserLoggedIn=true. Tokens should be in storage."
            );
            sendResponseToPopup({
              status: "Login successful. Tokens stored.",
            });
          }
        });
        console.log("chrome.storage.local.set for tokens has been called.");
      } else {
        const errorParam = params.get("error");
        console.error(
          "OAuth flow did not return an access token. Error:",
          errorParam || "Unknown error from redirect."
        );
        await chrome.storage.local.set({
          ahHaUserLoggedIn: false,
          authToken: null,
          idToken: null,
          tokenExpiryTime: null,
        });
        currentUserLoggedIn = false;
        currentAuthToken = null; // Update in-memory state
        sendResponseToPopup({
          status: "OAuth flow failed: No access token received.",
          error: errorParam || "Token missing",
        });
      }
    } catch (error) {
      // This catch block handles errors from launchWebAuthFlow itself if it throws
      console.error("Exception during launchWebAuthFlow:", error);
      await clearOauthNonce(); // Ensure nonce is cleared even on exceptions
      await chrome.storage.local.set({
        ahHaUserLoggedIn: false,
        authToken: null,
        idToken: null,
        tokenExpiryTime: null,
      });
      currentUserLoggedIn = false;
      currentAuthToken = null; // Update in-memory state
      sendResponseToPopup({
        status: "OAuth flow threw an exception.",
        error: error.message,
      });
    }
  });
}

// Basic JWT parser (decodes payload, does NOT verify signature)
// For production, consider a library or backend validation.
function parseJwt(token) {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map(function (c) {
          return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error("Failed to parse JWT:", e);
    return null;
  }
}

// Helper function to generate a random nonce string
function generateNonce(length = 32) {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

// Helper function to clear the stored nonce
async function clearOauthNonce() {
  try {
    await chrome.storage.local.remove("oauthNonce");
    console.log("OAuth nonce cleared from storage.");
  } catch (e) {
    console.error("Error clearing nonce:", e);
  }
}

// Placeholder function for saving a snippet to the backend.
async function saveSnippet(snippetData) {
  // snippetData should be an object like:
  // { textContent: "the selected text", sourceUrl: "http://example.com", context: "optional surrounding text/html" }

  console.log("Attempting to save snippet:", snippetData);

  // 1. Check authentication status (this now checks for a valid token or flag)
  const isAuthenticated = await checkAuthenticationStatus();
  console.log(`saveSnippet: isAuthenticated result = ${isAuthenticated}`); // Detailed log
  if (!isAuthenticated) {
    console.warn(
      "User not authenticated (checked via checkAuthenticationStatus). Snippet not saved."
    );
    throw new Error(
      "User not authenticated. Please login via the extension popup."
    );
  }

  // 2. Get auth token
  const tokenData = await chrome.storage.local.get([
    "authToken",
    "tokenExpiryTime",
    "idToken",
  ]);
  const authToken = tokenData.authToken;
  const tokenExpiryTime = tokenData.tokenExpiryTime;
  // const idToken = tokenData.idToken; // idToken is available if your backend needs it

  // Prioritize in-memory token for immediate use after login
  const effectiveAuthToken = currentAuthToken || authToken;

  if (!effectiveAuthToken) {
    console.warn(
      "Auth token not found in storage despite checkAuthenticationStatus passing. This should not happen. Snippet not saved."
    );
    // This error will be caught by handleContextMenuClick and shown as a notification.
    throw new Error("Authentication token missing. Please login again.");
  }

  // Optional: Check for token expiry if tokenExpiryTime is stored
  if (tokenExpiryTime && Date.now() > tokenExpiryTime) {
    console.warn("Auth token has expired. Please login again.");
    // Clear expired/invalid tokens and prompt for re-login.
    await chrome.storage.local.remove([
      "authToken",
      "idToken",
      "tokenExpiryTime",
      "ahHaUserLoggedIn",
      "refreshToken",
    ]);
    throw new Error(
      "Authentication token has expired. Please login again via the extension popup."
    );
  }

  // 3. Make the API call
  try {
    const defaultTitle =
      snippetData.textContent.substring(0, 70) +
      (snippetData.textContent.length > 70 ? "..." : ""); // Generate a title from content
    const payload = {
      title: snippetData.title || defaultTitle, // Use UI title or generate from content
      content: snippetData.htmlContent || snippetData.textContent, // Prioritize HTML content
      permalink_to_origin: snippetData.sourceUrl,
      notes: snippetData.notes, // Added notes from capture UI
      content_type: snippetData.htmlContent ? "html" : "text", // Indicate content type
      // context: snippetData.context, // Optional: if you send full page context
      // id_token: idToken // Optional: if your backend validates the id_token with Google
    };
    console.log("Sending payload to API:", JSON.stringify(payload));
    console.log(
      "Using Auth Token:",
      effectiveAuthToken
        ? effectiveAuthToken.substring(0, 10) + "..."
        : "No Token"
    );

    const response = await fetch(`${AH_HA_API_BASE_URL}/snippets`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${effectiveAuthToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (response.status === 401) {
      // Unauthorized
      console.warn(
        "API returned 401 Unauthorized. Token might be invalid or expired."
      );
      await chrome.storage.local.remove([
        "authToken",
        "idToken",
        "tokenExpiryTime",
        "ahHaUserLoggedIn",
        "refreshToken",
      ]);
      throw new Error(
        "Authentication failed with API (401). Please login again."
      );
    }

    if (!response.ok) {
      let errorResponseMessage = `HTTP error ${response.status}: ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorResponseMessage =
          errorData.message || errorData.detail || errorResponseMessage;
      } catch (e) {
        console.warn(
          "Could not parse error response as JSON or response.ok was false without JSON body.",
          e
        );
      }
      console.error(
        "API Error saving snippet:",
        response.status,
        errorResponseMessage
      );
      throw new Error(`API Error ${response.status}: ${errorResponseMessage}`);
    }

    const result = await response.json();
    console.log("Snippet saved successfully via API:", result);
    return result;
  } catch (error) {
    console.error("Error during fetch to save snippet:", error.message); // Log the actual error message
    if (
      error.message.includes("Failed to fetch") &&
      typeof navigator !== "undefined" &&
      !navigator.onLine
    ) {
      throw new Error(
        "Network error: You appear to be offline. Please check your connection."
      );
    } else if (error.message.includes("Failed to fetch")) {
      throw new Error(
        "Network error. Unable to connect to Ah-Ha! server. Is the backend running at " +
          AH_HA_API_BASE_URL +
          "?"
      );
    }
    // Re-throw other errors (like the ones we created for auth issues) to be caught by handleContextMenuClick
    throw error;
  }
}

console.log("Ah-Ha! Capture background script loaded.");
