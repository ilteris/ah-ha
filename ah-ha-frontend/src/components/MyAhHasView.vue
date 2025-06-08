<template>
  <div class="my-ah-has-view">
    <div
      v-if="isLoading && !isReady"
      class="loading-message initial-load-spinner"
    >
      Loading Ah-ha moments...
    </div>
    <div v-else-if="error && !isReady" class="error-message">
      {{ error }}
    </div>
    <div
      v-else-if="isReady"
      ref="contentAreaRef"
      class="content-area"
      :class="{ 'content-hidden': !fullyRendered }"
    >
      <div v-if="isLoading && !ahHaItems.length" class="loading-message">
        Loading Ah-ha moments...
      </div>
      <div v-if="error" class="error-message">
        {{ error }}
      </div>
      <div
        v-if="!isLoading && !ahHaItems.length && !error"
        class="empty-message"
      >
        No Ah-ha moments captured yet. Start capturing!
      </div>
      <List v-if="ahHaItems.length" ref="ahHaListCompRef" class="ah-ha-list">
        <ListItem
          v-for="item in ahHaItems"
          :key="item.id"
          :headline="item.title"
          @click="navigateToDetail(item.id)"
          style="
            cursor: pointer;
            margin-bottom: 8px;
            border: 1px solid var(--md-sys-color-outline-variant);
          "
          lines="3-line+"
        >
          <!-- Content for headline and supportingText is now passed via props -->
          <!-- Default slot is not used for primary content here based on ListItem structure -->
          <template #trailing>
            <div class="list-item-trailing-content">
              <div
                class="list-item-tags-container-trailing"
                v-if="item.generated_tags && item.generated_tags.length"
              >
                <Chip
                  v-for="tag in item.generated_tags"
                  :key="tag"
                  :label="tag"
                  size="small"
                  class="list-item-tag-chip"
                />
              </div>
              <span class="list-item-timestamp">{{
                formatTimestamp(item.timestamp)
              }}</span>
              <div class="list-item-actions">
                <IconButton
                  v-if="item.original_context"
                  icon="visibility"
                  @click.stop="showContext(item)"
                  aria-label="View Context"
                  size="small"
                />
                <IconButton
                  icon="delete"
                  @click.stop="deleteAhHa(item.id)"
                  :disabled="!item.id"
                  aria-label="Delete Ah-ha"
                  size="small"
                />
              </div>
            </div>
          </template>
        </ListItem>
      </List>
    </div>
    <!-- Replaced div with StackedCard, moved to bottom -->
    <StackedCard
      v-if="allUniqueTags.length"
      :titleText="'All Tags:'"
      :style="'elevated'"
      class="all-tags-card-bottom"
    >
      <div class="tag-cloud-wrapper">
        <Chip
          v-for="tag in allUniqueTags"
          :key="tag"
          :label="tag"
          class="all-tag-item"
        />
      </div>
    </StackedCard>
  </div>
</template>

<script setup lang="ts">
import {
  ref,
  onMounted,
  computed,
  onUpdated,
  nextTick,
  defineExpose,
} from "vue"; // Added onUpdated, nextTick, defineExpose
import { useRouter } from "vue-router"; // Import useRouter
import { Chip, IconButton, List, ListItem, StackedCard } from "gm3-vue"; // Import StackedCard

interface AhHaItem {
  id: string; // Changed to string to match Firestore IDs
  title: string;
  generated_tags: string[] | null; // Changed from 'tags' to 'generated_tags'
  content: string;
  content_type?: "html" | "text" | "markdown" | null; // Add content_type
  timestamp: string; // Assuming ISO string from backend
  permalink_to_origin?: string | null; // Added permalink
  original_context?: string | null;
}

const ahHaItems = ref<AhHaItem[]>([]);
const isLoading = ref(false);
const error = ref<string | null>(null);
const searchTerm = ref("");
const router = useRouter(); // Initialize router
const isReady = ref(false); // New reactive variable for FOUC control
const fullyRendered = ref(false); // For CSS transition to control visibility

const contentAreaRef = ref<HTMLDivElement | null>(null);
const ahHaListCompRef = ref<any | null>(null); // Ref for the List component instance
let loggedListFirstAppearanceWidth = false;
let loggedContentAreaFullyRenderedWidth = false;
let loggedListFullyRenderedWidth = false;

// const tableHeaders = ref([...]); // DataTable specific, can be removed

const navigateToDetail = (itemId: string) => {
  router.push({ name: "AhHaDetail", params: { id: itemId } });
};

const truncateSnippet = (content: string, maxLength = 50) => {
  // Reduced maxLength
  if (content.length <= maxLength) {
    return content;
  }
  return content.substring(0, maxLength) + "...";
};

const fetchAhHas = async (
  fetchAll = false,
  triggeredBy: string | null = null
) => {
  if (triggeredBy) {
    console.log(
      `[MyAhHasView] fetchAhHas called. Trigger: ${triggeredBy}. FetchAll: ${fetchAll}, SearchTerm: ${searchTerm.value}`
    );
  } else {
    console.log(
      "[MyAhHasView] fetchAhHas started. FetchAll:",
      fetchAll,
      "SearchTerm:",
      searchTerm.value
    );
  }
  isLoading.value = true;
  error.value = null;
  let url =
    "https://aha-backend-service-36070612387.us-central1.run.app/ah-has/";
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
    console.log("[MyAhHasView] fetchAhHas success. Items count:", data.length);

    // If this was the initial fetch (triggered from onMounted)
    if (fetchAll) {
      await nextTick(); // Wait for DOM to update with items (if any)
      isReady.value = true; // Mark as ready to display content
      console.log(
        "[MyAhHasView] fetchAhHas: Initial data loaded, isReady set to true."
      );
      await nextTick(); // Ensure .content-area is in DOM and ref is populated due to isReady=true
      if (contentAreaRef.value) {
        console.log(
          `[MyAhHasView Debug] Width of .content-area after isReady=true, before fullyRendered timeout: ${contentAreaRef.value.offsetWidth}px, Height: ${contentAreaRef.value.offsetHeight}px`
        );
      }
      // After isReady allows rendering, wait for Vue to patch DOM, then for browser to process, then make visible
      // The existing nextTick here is fine.
      await nextTick();
      setTimeout(() => {
        fullyRendered.value = true;
        console.log("[MyAhHasView] fetchAhHas: Content set to fullyRendered.");
      }, 0); // A small timeout can help ensure styles are applied before visibility change
    }

    if (!data.length && !fetchAll && searchTerm.value.trim() !== "") {
      error.value = `No Ah-ha moments found for "${searchTerm.value.trim()}". Try refreshing all.`;
    } else if (!data.length && fetchAll) {
      error.value = "No Ah-ha moments captured yet. Start capturing!";
    }
  } catch (e: any) {
    console.error("[MyAhHasView] Failed to fetch Ah-ha moments:", e);
    error.value = "Failed to load Ah-ha moments. Please try again.";
    if (fetchAll && !ahHaItems.value.length) {
      // If initial fetch failed or returned no data
      isReady.value = true; // Still mark as ready to show empty/error state
      await nextTick(); // Ensure DOM is updated for error/empty state & contentAreaRef
      if (contentAreaRef.value) {
        console.log(
          `[MyAhHasView Debug] Width of .content-area after isReady=true (error/empty path), before fullyRendered: ${contentAreaRef.value.offsetWidth}px, Height: ${contentAreaRef.value.offsetHeight}px`
        );
      }
      fullyRendered.value = true; // Make the error/empty state visible
      console.log(
        "[MyAhHasView] fetchAhHas: Initial data fetch failed or empty, isReady and fullyRendered set to true."
      );
    }
  } finally {
    isLoading.value = false;
  }
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
  console.log(
    "[MyAhHasView] onMounted: Component is mounted. Fetching initial data..."
  );
  fetchAhHas(true); // Fetch all on initial load
  console.log("[MyAhHasView] onMounted: Initial fetchAhHas called.");
});

onUpdated(async () => {
  console.log("[MyAhHasView] onUpdated: Component has been updated.");
  await nextTick(); // Ensure DOM and refs are settled after updates

  const listEl = ahHaListCompRef.value?.$el;

  if (ahHaItems.value.length === 0) {
    loggedListFirstAppearanceWidth = false; // Reset if list becomes empty
  }

  if (listEl && ahHaItems.value.length > 0 && !loggedListFirstAppearanceWidth) {
    console.log(
      `[MyAhHasView Debug] Width of .ah-ha-list ($el) on first appearance with items: ${listEl.offsetWidth}px, Height: ${listEl.offsetHeight}px`
    );
    loggedListFirstAppearanceWidth = true;
  }

  if (fullyRendered.value) {
    if (contentAreaRef.value && !loggedContentAreaFullyRenderedWidth) {
      console.log(
        `[MyAhHasView Debug] Width of .content-area when fullyRendered=true (onUpdated): ${contentAreaRef.value.offsetWidth}px, Height: ${contentAreaRef.value.offsetHeight}px`
      );
      loggedContentAreaFullyRenderedWidth = true;
    }
    if (listEl && ahHaItems.value.length > 0 && !loggedListFullyRenderedWidth) {
      console.log(
        `[MyAhHasView Debug] Width of .ah-ha-list ($el) when fullyRendered=true (onUpdated): ${listEl.offsetWidth}px, Height: ${listEl.offsetHeight}px (items: ${ahHaItems.value.length})`
      );
      loggedListFullyRenderedWidth = true;
    }
  } else {
    // If not fully rendered, reset flags for the "fullyRendered" specific logs
    loggedListFullyRenderedWidth = false;
    loggedContentAreaFullyRenderedWidth = false;
    // loggedListFirstAppearanceWidth is reset when ahHaItems is empty
  }
});

const deleteAhHa = async (id: string | null | undefined) => {
  // Check if the ID is valid before proceeding
  if (
    !id ||
    typeof id !== "string" ||
    id.trim() === "" ||
    id.trim().toLowerCase() === "null" ||
    id.trim().toLowerCase() === "undefined"
  ) {
    console.error(
      "Attempted to delete an Ah-ha moment with an invalid ID:",
      id
    );
    error.value = "Cannot delete: Snippet ID is invalid or missing.";
    return;
  }

  if (
    !confirm(`Are you sure you want to delete this Ah-ha moment (ID: ${id})?`)
  ) {
    return;
  }

  isLoading.value = true;
  error.value = null;
  try {
    const response = await fetch(
      `https://aha-backend-service-36070612387.us-central1.run.app/api/v1/snippets/${id}`,
      {
        method: "DELETE",
      }
    );
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Ah-ha moment with ID ${id} not found on the server.`);
      }
      // Try to parse error detail from backend if available
      const errorData = await response
        .json()
        .catch(() => ({ detail: `HTTP error ${response.status}` }));
      throw new Error(
        errorData.detail || `HTTP error! status: ${response.status}`
      );
    }
    // If deletion is successful (204 No Content)
    ahHaItems.value = ahHaItems.value.filter((item) => item.id !== id);
    console.log(`Ah-ha moment with ID ${id} deleted successfully.`);
  } catch (e: any) {
    console.error(`Failed to delete Ah-ha moment with ID ${id}:`, e);
    error.value = `Failed to delete Ah-ha moment: ${e.message}.`;
  } finally {
    isLoading.value = false;
  }
};

const allUniqueTags = computed(() => {
  const tagsSet = new Set<string>();
  ahHaItems.value.forEach((item) => {
    if (item.generated_tags) {
      item.generated_tags.forEach((tag) => tagsSet.add(tag));
    }
  });
  return Array.from(tagsSet).sort();
});

defineExpose({
  fetchAhHas,
});
</script>

<style scoped lang="scss">
.content-hidden {
  visibility: hidden;
  /* opacity: 0; */ /* Uncomment with transition for a fade-in effect */
  /* transition: opacity 0.2s ease-out; */
}

/*
.content-area:not(.content-hidden) {
  opacity: 1;
}
*/

.initial-load-spinner {
  /* Styles to make the initial loading message more prominent or centered if desired */
  /* For example, ensure it takes up space to prevent layout shift */
  min-height: 200px; /* Adjust as needed */
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.my-ah-has-view {
  /* padding: 20px; AppBar will provide its own padding/structure */
  /* border: 1px solid #e0e0e0; */
  /* border-radius: 8px; */
  /* background-color: #ffffff; */ /* Assuming AppBar or page background handles this */
  /* box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05); */
  display: flex;
  flex-direction: column;
  height: 100%; /* Make view take full height for flex layout */

  /* h2 styling removed as AppBar's title prop will be used */
}

.app-bar-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.app-bar-search-input {
  padding: 8px 12px; /* Adjust padding to fit AppBar style */
  border: 1px solid var(--md-sys-color-outline, #747775); /* Use GM3 variable */
  border-radius: var(--md-sys-shape-corner-medium, 8px); /* Use GM3 variable */
  font-size: var(
    --md-sys-typescale-body-medium-font-size,
    14px
  ); /* Use GM3 variable */
  background-color: var(
    --md-sys-color-surface-container-highest,
    #e1e3e1
  ); /* Use GM3 variable */
  color: var(--md-sys-color-on-surface-variant, #444746); /* Use GM3 variable */
}

.content-area {
  padding: 20px; /* Add padding back to the content area below AppBar */
  flex-grow: 1; /* Allows this area to expand and push the card down */
  overflow-y: auto; /* Allows content to scroll if it exceeds available space */
  /* overflow-x: auto; // Changed to hidden */
  overflow-x: hidden;
  width: 100%;
  box-sizing: border-box; /* Ensures padding doesn't add to the width */
}

/* Removed .all-tags-container styles */

.all-tags-card-bottom {
  /* Applied to the StackedCard component */
  margin: 16px; /* Spacing around the card */
  margin-top: auto; /* Pushes the card to the bottom of the flex container */
  width: calc(
    100% - 32px
  ); /* Overrides StackedCard's default width, makes it responsive */
  box-sizing: border-box;
  flex-shrink: 0; /* Prevents the card from shrinking */

  /* StackedCard's internal 'titleText' prop is used for "All Tags:" */

  .tag-cloud-wrapper {
    display: flex;
    flex-wrap: wrap;
    gap: 8px; /* Spacing between chips */
    padding-top: 8px; /* Add some space below the card's title if needed */
  }

  .all-tag-item {
    /* Removed margins as 'gap' on wrapper handles spacing */
    /* Chip component itself should handle its inline display characteristics */
  }
}

/* .controls-container and its children (.search-bar, .refresh-button) styling removed as they are replaced by AppBar */

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

.delete-button {
  background-color: #d9534f; // Red for delete
  color: white;
  padding: 5px 10px;
  border: none;
  border-radius: 4px;
  font-size: 0.8em;
  cursor: pointer;
  margin-top: 10px;
  margin-left: 10px; /* Add some space if next to another button */
  display: inline-block;

  &:hover {
    background-color: #c9302c;
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

/* Styles for .ah-ha-data-table and its children can be removed or commented out */
/*
.ah-ha-data-table {
  // ... previous DataTable styles ...
}
*/

.ah-ha-list {
  // Add any specific styling for the List if needed
}

/* Removed .list-item-content-wrapper, .list-item-headline, .list-item-supporting-text, .list-item-tags-container
   as content is now primarily handled by ListItem props and the #end slot. */

.list-item-trailing-content {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px; /* Space between tags, timestamp, and actions */
}

.list-item-tags-container-trailing {
  display: flex;
  flex-wrap: wrap;
  gap: 4px; /* Smaller gap for chips in trailing content */
  justify-content: flex-end; /* Align chips to the right if they wrap */
}

.list-item-tag-chip {
  /* Chip component already has styling, additional overrides if needed */
}

.list-item-timestamp {
  font-size: 0.8em;
  color: var(--md-sys-color-on-surface-variant);
}

.list-item-actions {
  display: flex;
  gap: 4px; /* Smaller gap for action buttons */
}

/* Remove .ah-ha-gm-list and .list-item-meta-content styles */

/* Styling for view-context-button might need adjustment if it's an IconButton now */
/* .view-context-button styling is kept for now if it's still a regular button */
</style>
