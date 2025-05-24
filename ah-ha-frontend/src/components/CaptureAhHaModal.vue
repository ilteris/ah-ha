<template>
  <div v-if="show" class="modal-overlay" @click.self="closeModal">
    <div class="capture-ah-ha-modal">
      <h2>Capture Ah-ha Moment</h2>
      <form @submit.prevent="handleSave">
        <div class="form-group snippet-preview">
          <label>Selected Snippet:</label>
          <blockquote>{{ snippet }}</blockquote>
        </div>
        <div class="form-group">
          <label for="ah-ha-title">Title (Required):</label>
          <input
            type="text"
            id="ah-ha-title"
            v-model="title"
            required
            ref="titleInput"
          />
        </div>
        <div class="form-group">
          <label for="ah-ha-tags">Tags (Comma-separated):</label>
          <input
            type="text"
            id="ah-ha-tags"
            v-model="tags"
            placeholder="e.g., project-x, idea, important"
          />
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
              snippet
            "
            class="no-suggestions"
          >
            No suggestions found.
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
        <div class="modal-actions">
          <button type="submit" class="button-save">Save Ah-ha</button>
          <button type="button" @click="closeModal" class="button-cancel">
            Cancel
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from "vue";

interface Props {
  show: boolean;
  snippet: string;
  context: string;
}

const props = defineProps<Props>();
const emit = defineEmits(["close", "save"]);

const title = ref("");
const tags = ref("");
const titleInput = ref<HTMLInputElement | null>(null);

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
      title.value = "";
      tags.value = "";
      // Focus the title input when modal becomes visible
      nextTick(() => {
        titleInput.value?.focus();
      });
      if (props.snippet) {
        fetchTagSuggestions(props.snippet);
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

// Watch for snippet changes while modal is open
watch(
  () => props.snippet,
  (newSnippet) => {
    if (props.show && newSnippet) {
      fetchTagSuggestions(newSnippet);
    } else if (props.show && !newSnippet) {
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

const handleSave = () => {
  if (!title.value.trim()) {
    alert("Title is required.");
    return;
  }
  emit("save", {
    title: title.value.trim(),
    tags: tags.value
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag !== ""),
    snippet: props.snippet,
    context: props.context,
  });
  closeModal();
};
</script>

<style scoped lang="scss">
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.capture-ah-ha-modal {
  background-color: #fff;
  padding: 25px 30px;
  border-radius: 10px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
  width: 90%;
  max-width: 550px; // Slightly wider for suggestions
  z-index: 1001;

  h2 {
    margin-top: 0;
    margin-bottom: 20px;
    color: #333;
    font-size: 1.5em;
    text-align: center;
  }
}

.form-group {
  margin-bottom: 20px;

  label {
    display: block;
    margin-bottom: 8px;
    font-weight: bold;
    color: #555;
  }

  input[type="text"] {
    width: 100%;
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 5px;
    box-sizing: border-box;
    font-size: 1em;

    &:focus {
      border-color: #007bff;
      outline: none;
      box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
    }
  }
}

.snippet-preview {
  label {
    margin-bottom: 5px;
  }
  blockquote {
    background-color: #f9f9f9;
    border-left: 4px solid #eee;
    margin: 0;
    padding: 10px 15px;
    font-style: italic;
    color: #555;
    max-height: 100px;
    overflow-y: auto;
    border-radius: 0 5px 5px 0;
  }
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 25px;

  button {
    padding: 10px 20px;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    font-size: 1em;
    font-weight: bold;
    transition: background-color 0.2s ease;
  }

  .button-save {
    background-color: #28a745;
    color: white;

    &:hover {
      background-color: #218838;
    }
  }

  .button-cancel {
    background-color: #6c757d;
    color: white;

    &:hover {
      background-color: #5a6268;
    }
  }
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
