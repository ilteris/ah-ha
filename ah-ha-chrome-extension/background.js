// Ah-Ha! Capture - background.js (Service Worker)

// --- Globals ---
const AH_HA_API_BASE_URL = "http://localhost:8010/api/v1"; // Replace with your actual backend API URL
const CONTEXT_MENU_ID = "AH_HA_CAPTURE_CONTEXT_MENU";

// --- OAuth 2.0 Configuration (Replace with your actual provider details) ---
const OAUTH_CLIENT_ID =
  "36070612387-nib9a64uruobemn3hicj5oio9k3t5sdb.apps.googleusercontent.com";
const OAUTH_SCOPES = "email profile openid"; // Adjust scopes as needed
const OAUTH_AUTHORIZATION_URL = "https://accounts.google.com/o/oauth2/v2/auth"; // e.g., 'https://accounts.google.com/o/oauth2/v2/auth'
const OAUTH_REDIRECT_URI = `https://${chrome.runtime.id}.chromiumapp.org/`; // Standard redirect for Chrome extensions

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
      ["authToken", "ahHaUserLoggedIn", "refreshToken"],
      () => {
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
    sendResponse({ status: "Snippet capture initiated." });
  }
  // Return true if you intend to send a response asynchronously
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

  const selectionText = info.selectionText;
  const pageUrl = info.pageUrl || tab.url; // pageUrl is usually more reliable

  if (!selectionText) {
    console.warn("No text selected for capture.");
    // Optionally, notify the user via a desktop notification if no text selected
    return;
  }

  console.log(`Selected text: "${selectionText}" from URL: ${pageUrl}`);

  // For MVP, we'll directly try to save.
  // Later, we might show a popup/modal from content script or open a small capture window.
  try {
    // We need to get the full page content for context if desired,
    // or just send the selection. For now, just selection and URL.
    // To get more context, we'd need to message the content script.
    // This is simplified for now.
    await saveSnippet({ textContent: selectionText, sourceUrl: pageUrl });
    // Optionally, send a notification to the user upon successful save
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon48.png", // Ensure you have this icon
      title: "Ah-Ha! Capture",
      message: "Snippet saved successfully!",
    });
  } catch (error) {
    console.error("Failed to save snippet:", error);
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon48.png",
      title: "Ah-Ha! Capture Error",
      message: `Failed to save snippet: ${error.message}`,
    });
  }
}

// Function to check authentication status (checks for a stored token)
async function checkAuthenticationStatus() {
  try {
    // In a real OAuth flow, you'd store an access token.
    // For now, we'll keep the ahHaUserLoggedIn flag for simplicity until token handling is complete.
    // Later, this will check for a valid (non-expired) access token.
    const result = await chrome.storage.local.get([
      "authToken",
      "ahHaUserLoggedIn",
    ]);
    console.log(
      "Auth status check from storage (authToken, ahHaUserLoggedIn):",
      result
    );
    return !!result.authToken || !!result.ahHaUserLoggedIn; // Consider user logged in if either a token or the flag exists
  } catch (error) {
    console.error(
      "Error reading auth status from chrome.storage.local:",
      error
    );
    return false; // Default to false on error
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

      // Always try to clear the stored nonce once the flow completes or fails
      await clearOauthNonce();

      if (chrome.runtime.lastError || !redirectUrl) {
        console.error(
          "OAuth flow failed:",
          chrome.runtime.lastError
            ? chrome.runtime.lastError.message
            : "No redirect URL received."
        );
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
        await chrome.storage.local.set({
          ahHaUserLoggedIn: false,
          authToken: null,
          idToken: null,
          tokenExpiryTime: null,
        });
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
              // Handle nonce mismatch error - this is a security risk
              await chrome.storage.local.set({
                ahHaUserLoggedIn: false,
                authToken: null,
                idToken: null,
                tokenExpiryTime: null,
              });
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
            // Depending on policy, you might allow if accessToken is present, or fail. For stricter security, fail.
            await chrome.storage.local.set({
              ahHaUserLoggedIn: false,
              authToken: null,
              idToken: null,
              tokenExpiryTime: null,
            });
            sendResponseToPopup({
              status: "OAuth flow failed: Nonce claim missing in ID token.",
            });
            return;
          }
        } catch (e) {
          console.error("Error parsing ID token:", e);
          await chrome.storage.local.set({
            ahHaUserLoggedIn: false,
            authToken: null,
            idToken: null,
            tokenExpiryTime: null,
          });
          sendResponseToPopup({
            status: "OAuth flow failed: Could not parse ID token.",
          });
          return;
        }
      } else {
        console.warn(
          "ID token not found in redirect URL. Cannot verify nonce."
        );
        // If id_token is essential for your flow (e.g. for nonce), you might fail here.
        // For a flow that only needs access_token, this might be acceptable if nonce is not strictly enforced.
        // Given Google requires nonce for id_token, its absence is problematic if id_token was expected.
        await chrome.storage.local.set({
          ahHaUserLoggedIn: false,
          authToken: null,
          idToken: null,
          tokenExpiryTime: null,
        });
        sendResponseToPopup({
          status: "OAuth flow failed: ID token missing from response.",
        });
        return;
      }

      if (accessToken) {
        const expiryTime = expiresIn
          ? Date.now() + parseInt(expiresIn, 10) * 1000
          : null;
        await chrome.storage.local.set({
          authToken: accessToken,
          idToken: idToken,
          tokenExpiryTime: expiryTime,
          ahHaUserLoggedIn: true,
        });
        console.log("Access token and ID token stored successfully.");
        sendResponseToPopup({
          status: "Login successful. Tokens stored.",
        });
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

  if (!authToken) {
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
      title: defaultTitle, // Added title
      content: snippetData.textContent,
      permalink_to_origin: snippetData.sourceUrl,
      // context: snippetData.context, // Optional: if you send full page context
      // id_token: idToken // Optional: if your backend validates the id_token with Google
      // tags: [], // Optional: if your backend expects tags and you want to send a default
    };
    console.log("Sending payload to API:", JSON.stringify(payload));
    console.log(
      "Using Auth Token:",
      authToken ? authToken.substring(0, 10) + "..." : "No Token"
    );

    const response = await fetch(`${AH_HA_API_BASE_URL}/snippets`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
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
