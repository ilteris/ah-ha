<template>
  <Dialog
    :visible="props.show"
    title="Capture Ah-ha Moment"
    @update:visible="handleDialogVisibilityChange"
    persistent
    max-width="600px"
  >
    <form @submit.prevent="handleSave" class="dialog-form-content">
      <div class="form-group">
        <label for="ah-ha-snippet">Snippet:</label>
        <textarea
          id="ah-ha-snippet"
          v-model="editableSnippet"
          rows="4"
          placeholder="Enter your ah-ha moment details..."
        ></textarea>
      </div>
      <div class="form-group suggested-tags-group" v-if="props.show">
        <label>Suggested Tags:</label>
        <div v-if="isLoadingSuggestions" class="loading-suggestions">
          Loading suggestions...
        </div>
        <div v-if="suggestionsError" class="suggestions-error">
          {{ suggestionsError }}
        </div>
        <div
          v-if="
            !isLoadingSuggestions &&
            !suggestionsError &&
            suggestedTags.length === 0 &&
            editableSnippet
          "
          class="no-suggestions"
        >
          No suggestions found for the current snippet.
        </div>
        <div
          class="suggested-tags-container"
          v-if="
            !isLoadingSuggestions &&
            !suggestionsError &&
            suggestedTags.length > 0
          "
        >
          <button
            type="button"
            v-for="tag in suggestedTags"
            :key="tag"
            @click="addSuggestedTag(tag)"
            class="suggested-tag-button"
          >
            {{ tag }}
          </button>
        </div>
      </div>
    </form>
    <template #actions>
      <button
        type="button"
        @click="closeModal"
        class="button-cancel dialog-button"
      >
        Cancel
      </button>
      <button
        type="button"
        @click="handleSave"
        class="button-save dialog-button"
      >
        Save Ah-ha
      </button>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from "vue";
import { Dialog } from "gm3-vue"; // Import Dialog

interface Props {
  show: boolean;
  snippet: string;
  context: string;
}

const props = defineProps<Props>();
const emit = defineEmits(["close", "save"]); // Removed "update:show" as App.vue controls 'show'

const editableSnippet = ref("");
const tags = ref(""); // This will store comma-separated tags selected by clicking suggestions
// const titleInput = ref<HTMLInputElement | null>(null); // Removed titleInput

const suggestedTags = ref<string[]>([]);
const isLoadingSuggestions = ref(false);
const suggestionsError = ref<string | null>(null);

const fetchTagSuggestions = async (snippetText: string) => {
  if (!snippetText.trim()) {
    suggestedTags.value = [];
    return;
  }
  isLoadingSuggestions.value = true;
  suggestionsError.value = null;
  try {
    const response = await fetch("http://localhost:8010/suggest-tags/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ snippet: snippetText }),
    });
    if (!response.ok) {
      throw new Error("Failed to fetch tag suggestions");
    }
    const data = await response.json();
    suggestedTags.value = data.suggested_tags || [];
  } catch (error: any) {
    console.error("Error fetching tag suggestions:", error);
    suggestionsError.value = "Could not load suggestions.";
    suggestedTags.value = []; // Clear suggestions on error
  } finally {
    isLoadingSuggestions.value = false;
  }
};

watch(
  () => props.show,
  (newVal) => {
    if (newVal) {
      // Reset fields when modal opens
      editableSnippet.value = props.snippet; // Initialize editableSnippet
      tags.value = "";
      // Focus the snippet textarea when modal becomes visible (or another primary input)
      nextTick(() => {
        // If you want to focus the textarea:
        const snippetTextarea = document.getElementById("ah-ha-snippet");
        snippetTextarea?.focus();
        // titleInput.value?.focus(); // Removed
      });
      if (editableSnippet.value) {
        // Use editableSnippet for suggestions
        fetchTagSuggestions(editableSnippet.value);
      } else {
        suggestedTags.value = []; // Clear if no snippet
      }
    } else {
      // Clear suggestions when modal is hidden
      suggestedTags.value = [];
      isLoadingSuggestions.value = false;
      suggestionsError.value = null;
    }
  }
);

// Watch for editableSnippet changes while modal is open for tag suggestions
watch(
  editableSnippet, // Watch the local editableSnippet ref
  (newSnippetText) => {
    if (props.show && newSnippetText) {
      fetchTagSuggestions(newSnippetText);
    } else if (props.show && !newSnippetText) {
      suggestedTags.value = [];
    }
  }
);

const addSuggestedTag = (tagToAdd: string) => {
  const currentTags = tags.value
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t);
  if (!currentTags.includes(tagToAdd.toLowerCase())) {
    if (tags.value.trim() === "") {
      tags.value = tagToAdd;
    } else {
      tags.value += `, ${tagToAdd}`;
    }
  }
};

const closeModal = () => {
  emit("close");
};

const handleDialogVisibilityChange = (isVisible: boolean) => {
  if (!isVisible) {
    // This is called when Dialog wants to close (e.g. scrim click if not persistent, ESC key)
    // We emit 'close' which App.vue listens to, to set its `showCaptureModal` to false.
    // This in turn updates the :visible prop of the Dialog.
    emit("close");
  }
};

const handleSave = () => {
  // Title validation removed as it's auto-generated
  if (!editableSnippet.value.trim()) {
    alert("Snippet content cannot be empty.");
    // Optionally focus the snippet textarea
    const snippetTextarea = document.getElementById("ah-ha-snippet");
    snippetTextarea?.focus();
    return;
  }
  emit("save", {
    // title: title.value.trim(), // Title removed from emitted data
    tags: tags.value
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag !== ""),
    snippet: editableSnippet.value,
    context: props.context,
  });
  // App.vue's handleSaveAhHa method is responsible for calling closeCaptureModal,
  // which will set showCaptureModal to false, hiding the dialog.
  // No direct call to closeModal() here.
};
</script>

<style scoped lang="scss">
/* Removed .modal-overlay and .capture-ah-ha-modal styles */

.dialog-form-content {
  /* Add any specific padding or layout for the form inside the dialog if needed */
  /* For example, if the gm3-vue Dialog doesn't provide enough padding for the content slot */
  padding: 0 10px; /* Example: Add some horizontal padding to the form content */
}

.form-group {
  margin-bottom: 20px;

  label {
    display: block;
    margin-bottom: 8px;
    font-weight: bold;
    color: #555;
  }

  input[type="text"],
  textarea {
    // Apply similar styling to textarea
    width: 100%;
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 5px;
    box-sizing: border-box;
    font-size: 1em;
    font-family: inherit; // Ensure textarea uses the same font

    &:focus {
      border-color: #007bff;
      outline: none;
      box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
    }
  }

  textarea {
    // Specific textarea styling if needed
    min-height: 160px; // Give it some default height
    resize: vertical; // Allow vertical resizing
  }
}

/* Styles for .modal-actions are no longer needed if using Dialog's #actions slot with gm3-vue buttons.
   If using custom buttons in the slot, these styles might need to be adjusted or gm3 button classes used.
   For now, assuming custom buttons as per the template.
*/
.dialog-button {
  /* General styling for buttons in the #actions slot */
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease,
    border-color 0.2s ease;
}

.button-save.dialog-button {
  background-color: var(--md-sys-color-primary, #007bff);
  color: var(--md-sys-color-on-primary, white);
  border-color: var(--md-sys-color-primary, #007bff);
}

.button-save.dialog-button:hover {
  background-color: var(
    --md-sys-color-primary-dark,
    #0056b3
  ); /* A slightly darker shade for hover */
  border-color: var(--md-sys-color-primary-dark, #0056b3);
}

.button-cancel.dialog-button {
  background-color: transparent;
  color: var(--md-sys-color-primary, #007bff);
  border-color: var(
    --md-sys-color-outline,
    #6c757d
  ); /* Use outline color for border */
}

.button-cancel.dialog-button:hover {
  background-color: var(
    --md-sys-color-surface-container-highest,
    #e0e0e0
  ); /* Light background for hover */
  color: var(--md-sys-color-primary-dark, #0056b3);
}

.suggested-tags-group {
  label {
    margin-bottom: 8px;
  }
}

.loading-suggestions,
.suggestions-error,
.no-suggestions {
  font-style: italic;
  color: #666;
  font-size: 0.9em;
  padding: 5px 0;
}
.suggestions-error {
  color: #d9534f;
}

.suggested-tags-container {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 5px;
}

.suggested-tag-button {
  padding: 5px 10px;
  font-size: 0.85em;
  background-color: #e9ecef;
  color: #495057;
  border: 1px solid #ced4da;
  border-radius: 15px; // Pill shape
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;

  &:hover {
    background-color: #007bff;
    color: white;
    border-color: #007bff;
  }
}
</style>
