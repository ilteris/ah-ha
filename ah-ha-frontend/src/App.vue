<script setup lang="ts">
import { ref, watch } from "vue"; // Added watch
import CaptureAhHaModal from "./components/CaptureAhHaModal.vue";

// GM3 Components from linked gm3-vue library
import {
  NavigationRail,
  NavigationItem,
  FAB,
  AppBar,
  IconButton,
  ExtendedFAB, // Added ExtendedFAB
} from "gm3-vue"; // Added AppBar and IconButton

const showCaptureModal = ref(false);
const globalSearchTerm = ref(""); // For AppBar search
const globalSearchValueFromAppBar = ref(""); // To receive search value if not using v-model
const isNavRailExpanded = ref(false);

const toggleNavRail = () => {
  isNavRailExpanded.value = !isNavRailExpanded.value;
};

// Placeholder for actual search logic or event emission to children
watch(globalSearchTerm, (newValue) => {
  console.log("Global search term changed (v-model):", newValue);
  // Here you would typically trigger a search action, perhaps by emitting an event
  // or calling a method in a shared service/store that MyAhHasView listens to.
});

watch(globalSearchValueFromAppBar, (newValue) => {
  console.log("Search value from AppBar event:", newValue);
  // Similar logic for handling search
});

const handleSearchIconClick = () => {
  console.log("Search icon clicked");
  // Implement search toggle or navigation
};

const handleLoginIconClick = () => {
  console.log("Login icon clicked");
  // Implement login action
};

// handleTrailingIconClick might not be needed if all trailing items have specific handlers
// const handleTrailingIconClick = (iconName: string) => {
//   if (iconName === "refresh") {
//     handleGlobalRefresh();
//   }
//   // Handle other icons if added
// };

const currentSnippet = ref("");
const currentContext = ref("");

const triggerCaptureModal = () => {
  // For FAB, open with empty snippet/context or predefined values
  currentSnippet.value = ""; // Or some default
  currentContext.value = ""; // Or some default
  showCaptureModal.value = true;
};

const closeCaptureModal = () => {
  showCaptureModal.value = false;
  currentSnippet.value = "";
  currentContext.value = "";
};

const handleSaveAhHa = async (ahHaData: {
  title: string;
  tags: string[];
  snippet: string;
  context: string;
}) => {
  // console.log("Ah-ha to save:", ahHaData);
  try {
    const response = await fetch("http://localhost:8010/api/v1/snippets/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: ahHaData.title,
        generated_tags: ahHaData.tags, // Align with backend model, will be overwritten by AI if enabled
        content: ahHaData.snippet,
        permalink_to_origin: ahHaData.context, // Align with backend model
        // timestamp will be set by backend
        // notes field is also available in backend if needed
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Failed to save Ah-ha: ${response.status} ${response.statusText} - ${
          errorData.detail || "Unknown error"
        }`
      );
    }

    const savedAhHa = await response.json();
    console.log("Successfully saved Ah-ha:", savedAhHa);
    // Optionally, you might want to refresh the MyAhHasView here
    // or emit an event that MyAhHasView can listen to.
  } catch (error) {
    console.error("Error saving Ah-ha:", error);
    alert(`Error saving Ah-ha: ${error}`);
  } finally {
    closeCaptureModal();
  }
};
</script>

<template>
  <div class="app-layout">
    <NavigationRail :expanded="isNavRailExpanded" style="flex-shrink: 0">
      <template #header>
        <button
          @click="toggleNavRail"
          aria-label="Menu"
          class="material-symbols-outlined"
          style="
            border: none;
            background: transparent;
            cursor: pointer;
            padding: 16px;
            font-size: 24px;
            color: var(--md-sys-color-on-surface-variant);
          "
        >
          menu
        </button>
      </template>

      <template #fab="{ expanded: isRailExpandedInSlot }">
        <ExtendedFAB
          v-if="isRailExpandedInSlot"
          icon="add"
          label="Capture"
          aria-label="Capture Ah-Ha"
          size="small"
          @click="triggerCaptureModal"
        />
        <FAB
          v-else
          icon="add"
          aria-label="Capture Ah-Ha"
          @click="triggerCaptureModal"
        />
      </template>
      <NavigationItem
        icon="search"
        label="Search"
        :itemType="isNavRailExpanded ? 'rail-expanded' : 'rail'"
      />
      <NavigationItem
        icon="dashboard"
        label="Dashboard"
        :itemType="isNavRailExpanded ? 'rail-expanded' : 'rail'"
      />
    </NavigationRail>

    <div class="main-content-wrapper">
      <AppBar headline="Ah-ha Moments">
        <template #trailing>
          <div
            class="app-bar-actions"
            style="display: flex; gap: 8px; align-items: center; height: 48px"
          >
            <IconButton
              icon="search"
              @click="handleSearchIconClick"
              aria-label="Search"
            />
            <IconButton
              icon="login"
              @click="handleLoginIconClick"
              aria-label="Login"
            />
          </div>
        </template>
      </AppBar>
      <div class="router-view-content">
        <div class="router-view-inner-padding">
          <router-view :global-search-query="globalSearchTerm" />
          <!-- Pass globalSearchTerm to the view -->
          <!-- Vue Router will render the matched component here -->
        </div>
      </div>
    </div>

    <CaptureAhHaModal
      :show="showCaptureModal"
      :snippet="currentSnippet"
      :context="currentContext"
      @close="closeCaptureModal"
      @save="handleSaveAhHa"
    />
  </div>
</template>

<style lang="scss">
body,
html {
  margin: 0;
  padding: 0;
  font-family: var(
    --md-sys-typescale-body-medium-font-family-name,
    "Roboto",
    sans-serif
  ); /* Using GM3 typography token */
  background-color: var(--md-sys-color-surface-container-low, #f8f9fa);
  color: var(--md-sys-color-on-surface, #1c1b1f);
  height: 100%;
  overflow: hidden; /* Prevent body scroll when layout is 100vh */
}

.app-layout {
  display: flex;
  height: 100vh;
  background-color: var(
    --md-sys-color-surface-bright
  ); // Slightly off-white like reference
}

.main-content-wrapper {
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  overflow: hidden; /* Prevent this wrapper from scrolling, AppBar is fixed height */
}

.router-view-content {
  flex-grow: 1;
  overflow-y: auto; /* Allow content of router-view to scroll */
  /* Padding moved to inner div */
}

.router-view-inner-padding {
  padding: 20px; /* Add padding around the page content */
}

/* Ensure material symbols are styled if not handled by GM3 */
.material-symbols-outlined {
  font-variation-settings: "FILL" 0, "wght" 400, "GRAD" 0, "opsz" 24;
  font-size: 24px; /* Default icon size */
}
</style>
