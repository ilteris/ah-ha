<template>
  <div class="my-ah-has-view">
    <h2>My Ah-ha Moments</h2>
    <div class="controls-container">
      <div class="search-bar">
        <input
          type="text"
          v-model="searchTerm"
          placeholder="Search by keyword..."
          @keyup.enter="performSearch"
        />
        <button @click="performSearch" :disabled="isLoading">Search</button>
      </div>
      <button
        @click="fetchAhHas(true)"
        class="refresh-button"
        :disabled="isLoading"
      >
        {{ isLoading ? "Refreshing..." : "Refresh All" }}
      </button>
    </div>
    <div v-if="isLoading && !ahHaItems.length" class="loading-message">
      Loading Ah-ha moments...
    </div>
    <div v-if="error" class="error-message">
      {{ error }}
    </div>
    <div v-if="!isLoading && !ahHaItems.length && !error" class="empty-message">
      No Ah-ha moments captured yet. Start capturing!
    </div>
    <ul v-if="ahHaItems.length" class="ah-ha-list">
      <li v-for="item in ahHaItems" :key="item.id" class="ah-ha-item-card">
        <h3>{{ item.title }}</h3>
        <p class="snippet-content">"{{ item.content }}"</p>
        <div class="tags" v-if="item.tags && item.tags.length">
          <span v-for="tag in item.tags" :key="tag" class="tag">{{ tag }}</span>
        </div>
        <p class="timestamp">{{ formatTimestamp(item.timestamp) }}</p>
        <button
          v-if="item.original_context"
          @click="showContext(item)"
          class="view-context-button"
        >
          View Context
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";

interface AhHaItem {
  id: number;
  title: string;
  tags: string[] | null;
  content: string;
  timestamp: string; // Assuming ISO string from backend
  original_context?: string | null;
}

const ahHaItems = ref<AhHaItem[]>([]);
const isLoading = ref(false);
const error = ref<string | null>(null);
const searchTerm = ref("");

const fetchAhHas = async (fetchAll = false) => {
  isLoading.value = true;
  error.value = null;
  let url = "http://localhost:8010/ah-has/";
  if (!fetchAll && searchTerm.value.trim() !== "") {
    url += `?search=${encodeURIComponent(searchTerm.value.trim())}`;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    ahHaItems.value = data;
    if (!data.length && !fetchAll && searchTerm.value.trim() !== "") {
      error.value = `No Ah-ha moments found for "${searchTerm.value.trim()}". Try refreshing all.`;
    } else if (!data.length && fetchAll) {
      error.value = "No Ah-ha moments captured yet. Start capturing!";
    }
  } catch (e: any) {
    console.error("Failed to fetch Ah-ha moments:", e);
    error.value = "Failed to load Ah-ha moments. Please try again.";
  } finally {
    isLoading.value = false;
  }
};

const performSearch = () => {
  fetchAhHas(false);
};

const showContext = (item: AhHaItem) => {
  if (item.original_context) {
    alert(`Original Context for "${item.title}":\n\n${item.original_context}`);
  } else {
    alert("No original context available for this Ah-ha.");
  }
};

const formatTimestamp = (isoString: string) => {
  const date = new Date(isoString);
  return date.toLocaleString(); // Simple local string format
};

onMounted(() => {
  fetchAhHas(true); // Fetch all on initial load
});
</script>

<style scoped lang="scss">
.my-ah-has-view {
  padding: 20px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background-color: #ffffff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);

  h2 {
    margin-top: 0;
    margin-bottom: 20px;
    color: #333;
    text-align: center;
  }
}

.controls-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  gap: 15px;
  flex-wrap: wrap; /* Allow wrapping on smaller screens */
}

.search-bar {
  display: flex;
  gap: 10px;
  flex-grow: 1; /* Allow search bar to take available space */

  input[type="text"] {
    padding: 10px;
    border: 1px solid #ccc;
    border-radius: 5px;
    font-size: 0.9em;
    flex-grow: 1; /* Input field takes most space in search-bar */
    min-width: 200px; /* Minimum width for the input */
  }

  button {
    padding: 10px 15px;
    background-color: #5cb85c; // Green for search
    color: white;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    font-size: 0.9em;
    transition: background-color 0.2s ease;

    &:hover {
      background-color: #4cae4c;
    }
    &:disabled {
      background-color: #ccc;
      cursor: not-allowed;
    }
  }
}

.refresh-button {
  padding: 10px 15px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 0.9em;
  transition: background-color 0.2s ease;
  white-space: nowrap; /* Prevent button text from wrapping */

  &:hover {
    background-color: #0056b3;
  }
  &:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }
}

.view-context-button {
  background-color: #6c757d; // Grey
  color: white;
  padding: 5px 10px;
  border: none;
  border-radius: 4px;
  font-size: 0.8em;
  cursor: pointer;
  margin-top: 10px;
  display: inline-block; // Or block if you want it full width

  &:hover {
    background-color: #5a6268;
  }
}

.loading-message,
.error-message,
.empty-message {
  text-align: center;
  padding: 20px;
  color: #777;
  font-style: italic;
}

.error-message {
  color: #d9534f;
  background-color: #f2dede;
  border: 1px solid #ebccd1;
  border-radius: 4px;
}

.ah-ha-list {
  list-style-type: none;
  padding: 0;
  margin: 0;
}

.ah-ha-item-card {
  background-color: #f9f9f9;
  border: 1px solid #eee;
  border-radius: 6px;
  padding: 15px 20px;
  margin-bottom: 15px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  transition: box-shadow 0.2s ease-in-out;

  &:hover {
    box-shadow: 0 3px 8px rgba(0, 0, 0, 0.1);
  }

  h3 {
    margin-top: 0;
    margin-bottom: 8px;
    color: #0056b3; // Darker blue for title
  }

  .snippet-content {
    font-style: italic;
    color: #555;
    margin-bottom: 10px;
    padding-left: 10px;
    border-left: 3px solid #007bff;
    background-color: #f0f8ff; // Very light blue
    padding: 8px;
    border-radius: 0 4px 4px 0;
    max-height: 120px; /* Limit height and allow scroll if needed */
    overflow-y: auto; /* Add scroll for long snippets */
  }

  .tags {
    margin-bottom: 10px;
    .tag {
      display: inline-block;
      background-color: #e0e0e0;
      color: #555;
      padding: 3px 8px;
      border-radius: 12px;
      font-size: 0.8em;
      margin-right: 5px;
      margin-bottom: 5px;
    }
  }

  .timestamp {
    font-size: 0.8em;
    color: #777;
    text-align: right;
    margin-bottom: 0;
  }
}
</style>
