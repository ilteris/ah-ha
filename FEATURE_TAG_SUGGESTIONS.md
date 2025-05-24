# Feature Plan: Tag Suggestions for Ah-ha Capture

## 1. Purpose

To assist users by automatically suggesting relevant tags based on the content of the selected snippet, speeding up the capture process and improving tag consistency.

## 2. Functionality

*   When a snippet is selected and the 'Capture Ah-ha' modal opens, the system will automatically analyze the snippet content.
*   A list of suggested tags will be displayed within the modal, typically as clickable buttons/pills.
*   Users can click suggested tags to add them to their list of tags for the Ah-ha moment.
*   Users can still manually add, edit, or remove tags as usual.

## 3. Demo Highlight (If applicable)

Show how suggested tags appear based on snippet content and how easily they can be added during the Ah-ha capture process.

## 4. Tasks

### 4.1. Backend (`ah-ha-backend/main.py`)

*   [X] **Define Pydantic Model:** Create a Pydantic model for the snippet text request (e.g., `SnippetText(BaseModel): snippet: str`).
*   [X] **Implement API Endpoint:** Create a new API endpoint `POST /suggest-tags/`.
  *   **Accepts:** JSON payload `{"snippet": "text"}`.
  *   **Logic:**
        1.  Convert snippet to lowercase.
        2.  Remove common punctuation.
        3.  Tokenize text into words.
        4.  Filter out a predefined list of common English stop words.
        5.  Filter words by a minimum length (e.g., 3 characters).
        6.  Select the top N (e.g., 5-7) unique words based on frequency as potential tags.
  *   **Returns:** JSON payload `{"suggested_tags": ["tag1", "tag2"]}`.
  *   **Error Handling:** Gracefully handle empty or very short input snippets (e.g., return an empty list of suggestions).
*   [X] **Stop Word List:** Add a predefined list of common English stop words directly within the backend logic for this feature.

### 4.2. Frontend (`ah-ha-frontend/src/components/CaptureAhHaModal.vue`)

*   [X] **API Call:** When the modal opens with a non-empty snippet (or when the `snippet` prop is populated and changes), make an asynchronous API call to the `POST /suggest-tags/` endpoint.
*   [X] **State Management:**
  *   Add a reactive state variable for `suggestedTags` (e.g., `ref<string[]>([])`).
  *   Add reactive state variables for loading status (e.g., `isLoadingSuggestions = ref(false)`) and error status (e.g., `suggestionsError = ref<string | null>(null)`) related to fetching suggestions.
*   [X] **Display Suggestions:**
  *   Render suggested tags as clickable buttons or pills, likely below the snippet preview or near the main tags input field.
*   [X] **Interaction Logic:**
  *   When a suggested tag button is clicked:
    *   Check if the tag (case-insensitive to avoid minor variations) is already present in the `tags.value` string.
    *   If not already present, append the tag to `tags.value`. If `tags.value` is not empty, ensure a comma and a space precede the new tag.
*   [X] **User Feedback:**
  *   Display a loading indicator while suggestions are being fetched.
  *   Display an error message if fetching suggestions fails.
  *   Ensure the modal remains fully functional for manual tagging and saving the Ah-ha moment, even if the suggestion service fails or returns no suggestions.
*   [X] **Styling:** Style the suggested tags area, buttons, loading indicator, and error messages to be clear, helpful, and visually consistent with the existing UI.
