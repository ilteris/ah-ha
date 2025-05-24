# Plan: Implement User Notes (Extension) & AI-Generated Tags (Backend)

**Date:** 2025-05-24
**Version:** 1.0

**Phase Objective:** Modify the Chrome extension to capture user notes instead of manual tags. Implement backend logic to use Gemini for generating tags based on snippet content, and store these AI-generated tags along with user notes.

**I. Chrome Extension Changes (Capture UI & Logic)**

*   **Task 1.1: Modify `capture_ui/capture.html`**
  *   Remove the existing "Tags" input field and its associated label.
  *   Add a new `<textarea>` element for "Custom Notes", styled similarly to the "Content" textarea, including a corresponding `<label>`.
*   **Task 1.2: Modify `capture_ui/capture.js`**
  *   Remove JavaScript logic for handling the (now removed) tags input.
  *   Add JavaScript logic to get the value from the new "Custom Notes" textarea.
  *   Update the `snippetData` payload sent to `background.js` to:
    *   Include a `notes` field (containing the value from the notes textarea).
    *   Remove the `tags` field.
*   **Task 1.3: Modify `background.js`**
  *   In the `chrome.runtime.onMessage.addListener` for `type: 'SAVE_ENRICHED_SNIPPET'`:
    *   Update the data structure passed to the `saveSnippet` function to include `notes` (from `request.payload`) and remove `tags`.
  *   In the `saveSnippet` function:
    *   Update the `payload` object that is sent to the backend API to include the `notes` field and no longer send a user-inputted `tags` field.

**II. Backend Changes (`ah-ha-backend/main.py`)**

*   **Task 2.1: Update `AhHaSnippet` Pydantic Model**
  *   Remove the existing `tags: Optional[List[str]] = None` field.
  *   Add a new field: `notes: Optional[str] = None` (to store user's custom notes).
  *   Add a new field: `generated_tags: Optional[List[str]] = None` (to store tags suggested by Gemini).
  *   Ensure the `permalink_to_origin` field is explicitly part of the model (the extension sends `permalink_to_origin`; the model currently has `original_context`). Align these or map them in the endpoint.
*   **Task 2.2: Modify `/api/v1/snippets` Endpoint (`create_ah_ha` function) - Initial Data Handling**
  *   The endpoint will now receive `notes` in the `snippet` payload.
  *   Update storage logic to handle the `snippet` object which now includes `notes` and will soon include `generated_tags`.
*   **Task 2.3: Integrate Gemini for Tag Generation (within `/api/v1/snippets` endpoint)**
  *   **(Prerequisite):** Set up Gemini API access (API key, client library `google-generativeai` added to `requirements.txt` and installed).
  *   After receiving snippet data: Prepare input for Gemini (e.g., combine `snippet.content`, `snippet.title`).
  *   Make an asynchronous API call to Gemini, requesting tag suggestions. Handle errors.
  *   Parse Gemini's response to extract the list of suggested tags.
*   **Task 2.4: Store AI-Generated Tags (within `/api/v1/snippets` endpoint)**
  *   Populate `snippet.generated_tags` with tags from Gemini.
  *   Ensure the updated `snippet` object (with `notes` and `generated_tags`) is stored.
*   **Task 2.5: Update Retrieval Endpoints**
  *   Modify GET endpoints (`/ah-has/`, `/ah-has/{ah_ha_id}/`) to retrieve and return `notes` and `generated_tags`.
*   **Task 2.6: Update Search/Filter Logic**
  *   Enhance search in `/ah-has/` GET endpoint to include filtering/searching by `generated_tags`.

**III. Testing**

*   Thoroughly test the end-to-end flow:
  *   Capture UI correctly accepts notes.
  *   Extension sends notes (and not manual tags) to the backend.
  *   Backend receives notes, calls Gemini, gets tags, and stores everything.
  *   Retrieval endpoints correctly return notes and AI-generated tags.
  *   Search functionality works with AI-generated tags.
