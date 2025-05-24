# Chrome Extension Development Plan: Ah-Ha! Capture

**Date:** 2025-05-24

**Version:** 1.0

## 1. Introduction, Purpose, and Scope

*   **Purpose:** To create a Chrome extension that allows users to easily capture valuable "ah-ha" moments (snippets) from websites, chats, and emails, integrating with the broader "Ah-Ha!" knowledge management system.
*   **Scope:** The extension will focus on snippet extraction, user authentication, and communication with the backend "Ah-Ha!" services. It will be developed iteratively, starting with core functionalities.

## 2. Core Functionalities

*   **Manual Highlight & Extract:** Users can select text on any webpage and save it as a snippet.
*   **Context Capture:** Along with the text, the extension will capture the source URL. Future enhancements will aim for more detailed context for persistent origin linking.
*   **Backend Integration:** Captured snippets and their context will be sent to the "Snippet Management Service" API for storage and organization within the user's "Ah-Ha!" library.
*   **Foundation for AI-Suggested Snippets:** While initial versions will focus on manual capture, the architecture will consider future integration with backend-driven AI snippet suggestions.

## 3. User Interface (UI) and User Experience (UX)

*   **Popup Interface (`popup.html`):**
  *   Displays login status.
  *   Provides a quick capture button (if applicable, or instructions).
  *   Offers a link to the main "Ah-Ha!" web application/library.
  *   Handles user login/logout initiation.
*   **Context Menu Integration:** A "Save as Ah-Ha! Snippet" option will appear on right-clicking selected text.
*   **Visual Feedback:** Clear, non-intrusive notifications for capture initiation, success, or failure.
*   **Authentication Flow:**
  *   User initiates login via the popup.
  *   Redirects to the main "Ah-Ha!" web application for OAuth 2.0 / OpenID Connect authentication.
  *   Upon successful authentication, the extension securely receives and stores an authentication token.

## 4. Technical Architecture

*   **`manifest.json` (Version 3):**
  *   **Permissions:** `activeTab` (to access current page content), `storage` (to store tokens and settings), `scripting` (to inject content scripts), `contextMenus` (for right-click option), potentially `identity` (for Chrome's OAuth helpers).
  *   **Components:** Defines background service worker, content scripts, popup page (`popup.html`), and icons.
*   **`background.js` (Service Worker):**
  *   Manages authentication tokens and state.
  *   Handles all communication with the backend API (Snippet Management Service).
  *   Orchestrates actions triggered by the popup or content scripts (e.g., initiating capture, saving data).
  *   Creates and manages the context menu item.
*   **`content.js`:**
  *   Injected into web pages (`<all_urls>`).
  *   Responsible for DOM interaction: getting selected text and page URL.
  *   Communicates selected data and capture requests to `background.js`.
*   **`popup.js` & `popup.html`:**
  *   Logic and UI for the extension's popup.
  *   Handles user interactions within the popup (e.g., login button).
  *   Communicates user actions to `background.js`.
*   **Data Storage (`chrome.storage.local`):**
  *   Securely store authentication tokens.
  *   Store user preferences or extension settings.

## 5. API Interactions, Error Handling, and Security

*   **API Communication (`background.js`):**
  *   Uses `fetch` API to make HTTPS requests to the backend "Snippet Management Service" (e.g., `POST /v1/users/{userId}/snippets`).
  *   Sends data (snippet content, URL, etc.) in JSON format.
  *   Includes authentication token (e.g., Bearer token) in request headers.
*   **Error Handling:**
  *   Implement robust error handling for network issues, API errors (e.g., 401, 403, 500), and validation errors.
  *   Provide clear, user-friendly feedback via popup or notifications.
  *   Consider retry mechanisms for transient network errors.
*   **Security:**
  *   **Token Management:** Securely store and handle authentication tokens. Avoid storing them in easily accessible locations like `localStorage` of a webpage.
  *   **HTTPS:** All communication with the backend API must be over HTTPS.
  *   **Permissions:** Request only necessary permissions in `manifest.json`.
  *   **Content Script Isolation:** Be mindful of the content script's interaction with web pages.

## 6. Phased Development Approach & Future Enhancements

*   **Phase 1 (MVP):**
  *   Core manual highlight and extract functionality via context menu.
  *   Secure OAuth login and token management.
  *   Communication with the backend to save snippet (content + URL).
  *   Basic popup UI for login status and link to the main app.
*   **Phase 2:**
  *   Refine UI/UX based on feedback.
  *   Enhanced error handling and user feedback.
  *   Basic options/settings page for the extension.
*   **Phase 3 (Post-MVP/Future):**
  *   Deeper context capture for "Persistent Origin Links" (e.g., specific DOM path, surrounding text).
  *   Integration with AI-suggested snippets (displaying suggestions from the backend).
  *   Allow adding tags/notes directly from the extension before saving.

## 7. Key Dependencies & Testing Strategy

*   **Dependencies:**
  *   Stable "Ah-Ha!" backend API (Snippet Management Service, User Management Service for Auth).
  *   Operational OAuth 2.0 / OpenID Connect provider.
*   **Testing Strategy:**
  *   **Unit Tests:** For functions in `background.js`, `popup.js`, and any utility modules (e.g., using Jest or Mocha).
  *   **Integration Tests:** Test interactions between `content.js`, `background.js`, and `popup.js`. Test API call success/failure handling.
  *   **End-to-End (E2E) Tests:** Simulate full user flows (login, select text, save snippet, verify in a test backend/mock). Tools like Puppeteer or Playwright can be used.
  *   **Manual Testing:** Crucial for testing across diverse websites, checking context menu behavior, and overall usability.

## 8. Diagram: Snippet Capture Flow

```mermaid
sequenceDiagram
    participant User
    participant ContentScript
    participant BackgroundSW as Background ServiceWorker
    participant PopupUI
    participant BackendAPI as Ah-Ha! Backend API

    User->>ContentScript: Selects text & Right-clicks
    ContentScript->>BackgroundSW: "Save Snippet" (selected text, URL)
    BackgroundSW-->>User: (Optional) Notification: "Capturing..."
    BackgroundSW->>BackendAPI: POST /snippets (auth token, text, URL)
    alt Authentication Needed/Failed
        BackgroundSW->>PopupUI: Request Login
        PopupUI->>User: Shows Login Button
        User->>PopupUI: Clicks Login
        PopupUI->>BackgroundSW: Initiate Auth
        BackgroundSW->>BackendAPI: (OAuth Flow)
        BackendAPI-->>BackgroundSW: Auth Token
        BackgroundSW-->>PopupUI: Auth Success
        PopupUI-->>User: Shows Logged In
    end
    BackendAPI-->>BackgroundSW: Snippet Saved Confirmation / Error
    alt Snippet Saved Successfully
        BackgroundSW-->>User: Notification: "Snippet Saved!"
    else API Error / Save Failed
        BackgroundSW-->>User: Notification: "Error: Could not save snippet."
    end
