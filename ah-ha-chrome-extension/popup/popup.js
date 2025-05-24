document.addEventListener("DOMContentLoaded", () => {
  const authStatusElement = document.getElementById("auth-status");
  const userActionsElement = document.getElementById("user-actions");
  const loginButton = document.getElementById("login-button");
  const logoutButton = document.getElementById("logout-button");
  const openAhhaLink = document.getElementById("open-ahha-link");

  // Placeholder for Ah-Ha! app URL - replace with actual URL
  const AH_HA_APP_URL = "http://localhost:5173"; // Or your production URL

  openAhhaLink.href = AH_HA_APP_URL;

  // Function to update UI based on authentication state
  function updateUI(isAuthenticated) {
    if (isAuthenticated) {
      authStatusElement.innerHTML = "<p>Status: Logged In</p>";
      loginButton.style.display = "none";
      logoutButton.style.display = "block";
      userActionsElement.style.display = "block";
    } else {
      authStatusElement.innerHTML = "<p>Status: Not Logged In</p>";
      loginButton.style.display = "block";
      logoutButton.style.display = "none";
      userActionsElement.style.display = "block";
    }
  }

  function checkAuthStatus() {
    authStatusElement.innerHTML = "<p>Checking authentication status...</p>";
    chrome.runtime.sendMessage({ type: "GET_AUTH_STATUS" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error(
          "Error getting auth status:",
          chrome.runtime.lastError.message
        );
        authStatusElement.innerHTML = "<p>Error checking status.</p>";
        updateUI(false); // Assume not logged in on error
        return;
      }
      if (response) {
        updateUI(response.isAuthenticated);
      } else {
        // Handle cases where response might be undefined (e.g. background script error before sending response)
        console.error("No response received for GET_AUTH_STATUS");
        authStatusElement.innerHTML = "<p>Could not retrieve status.</p>";
        updateUI(false);
      }
    });
  }

  loginButton.addEventListener("click", () => {
    authStatusElement.innerHTML = "<p>Initiating login...</p>";
    chrome.runtime.sendMessage({ type: "LOGIN" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error(
          "Error initiating login:",
          chrome.runtime.lastError.message
        );
        authStatusElement.innerHTML = "<p>Login initiation failed.</p>";
        return;
      }
      if (response) {
        console.log("Login response:", response);
        // The actual UI update to "logged in" will happen after OAuth flow completes
        // and background.js confirms it. For now, background.js might send a status.
        // Or, we re-check auth status.
        authStatusElement.innerHTML = `<p>${
          response.status || "Login process started."
        }</p>`;
        // Potentially, the OAuth flow will close the popup.
        // If login is successful and popup is still open, refresh status.
        // For now, we'll rely on the user re-opening the popup or a direct message from background.
      }
    });
  });

  logoutButton.addEventListener("click", () => {
    authStatusElement.innerHTML = "<p>Logging out...</p>";
    chrome.runtime.sendMessage({ type: "LOGOUT" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error(
          "Error initiating logout:",
          chrome.runtime.lastError.message
        );
        authStatusElement.innerHTML = "<p>Logout failed.</p>";
        return;
      }
      if (response) {
        console.log("Logout response:", response);
        authStatusElement.innerHTML = `<p>${
          response.status || "Logout process started."
        }</p>`;
        updateUI(false); // Assume logout means not authenticated
      }
    });
  });

  // Initial check
  checkAuthStatus();
});
