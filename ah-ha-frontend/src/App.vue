<script setup lang="ts">
import ChatInterface from "./components/ChatInterface.vue";
import CaptureAhHaModal from "./components/CaptureAhHaModal.vue";
import MyAhHasView from "./components/MyAhHasView.vue";
import { ref } from "vue";

const showCaptureModal = ref(false);
const currentSnippet = ref("");
const currentContext = ref("");

const openModalWithSnippet = (data: { snippet: string; context: string }) => {
  currentSnippet.value = data.snippet;
  currentContext.value = data.context;
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
  <div id="app-container">
    <header>
      <h1>Ah-ha! MVP Demo</h1>
      <!-- <button @click="toggleCaptureModal">Capture Ah-ha</button> -->
    </header>
    <main>
      <ChatInterface @open-capture-modal="openModalWithSnippet" />
      <MyAhHasView />
      <CaptureAhHaModal
        :show="showCaptureModal"
        :snippet="currentSnippet"
        :context="currentContext"
        @close="closeCaptureModal"
        @save="handleSaveAhHa"
      />
    </main>
    <footer>
      <p>&copy; 2025 Ah-ha Project</p>
    </footer>
  </div>
</template>

<style lang="scss">
/* Global styles (or move to a main.scss and import here) */
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica,
    Arial, sans-serif;
  margin: 0;
  padding: 0;
  background-color: #f4f7f9;
  color: #333;
}

#app-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  max-width: 900px; /* Max width for the app content */
  margin: 0 auto; /* Center the app */
  padding: 20px;
  box-sizing: border-box;
}

header {
  background-color: #4a90e2; // A pleasant blue
  color: white;
  padding: 15px 20px;
  text-align: center;
  border-radius: 8px 8px 0 0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

  h1 {
    margin: 0;
    font-size: 1.8em;
  }
}

main {
  flex-grow: 1;
  padding: 20px 0; /* Add some padding around the main content area */
}

footer {
  text-align: center;
  padding: 15px;
  font-size: 0.9em;
  color: #777;
  border-top: 1px solid #eee;
  margin-top: auto; /* Push footer to the bottom */
}

/* Scoped styles for App.vue specific elements if needed, but most are global here */
</style>
