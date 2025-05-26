<template>
  <div class="ah-ha-detail-view">
    <router-link to="/" class="back-link">← Back to list</router-link>
    <div v-if="item" class="article-content">
      <h1 class="article-title">{{ item.title }}</h1>

      <div class="article-metadata">
        <span class="timestamp"
          >Captured: {{ formatTimestamp(item.timestamp) }}</span
        >
        <a
          v-if="item.permalink_to_origin"
          :href="item.permalink_to_origin"
          target="_blank"
          rel="noopener noreferrer"
          class="source-link"
          >View Original Source</a
        >
        <div v-if="item.generated_tags?.length" class="tags-container">
          <span
            v-for="tag in item.generated_tags"
            :key="tag"
            :label="tag"
            size="small"
            class="tag-chip"
          />
        </div>
      </div>

      <div class="article-body" v-html="parsedContent"></div>
      <!-- Content is now rendered via v-html from parsedContent -->
    </div>
    <div v-else-if="loading" class="status-message loading-message">
      Loading details...
    </div>
    <div v-else-if="error" class="status-message error-message">
      {{ error }}
    </div>
    <router-link to="/" class="back-link">← Back to list</router-link>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from "vue";
import { useRoute } from "vue-router";
import { Chip } from "gm3-vue"; // Import Chip
import { marked } from "marked"; // Import marked
import DOMPurify from "dompurify"; // Import DOMPurify

interface AhHaDetail {
  id: string;
  title: string;
  generated_tags: string[] | null;
  content: string;
  content_type?: "html" | "text" | "markdown" | null; // Add content_type
  timestamp: string;
  permalink_to_origin?: string | null;
  original_context?: string | null;
}

const route = useRoute();
const itemId = ref(route.params.id as string);
const item = ref<AhHaDetail | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

const fetchAhHaDetail = async (id: string) => {
  if (!id) return;
  loading.value = true;
  error.value = null;
  item.value = null;
  try {
    // Adjust the API endpoint as needed
    const response = await fetch(`http://localhost:8010/ah-has/${id}/`);
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("Ah-ha moment not found.");
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    item.value = await response.json();
    console.log(
      "Fetched item in AhHaDetailView:",
      JSON.parse(JSON.stringify(item.value))
    ); // Log fetched item
  } catch (e: any) {
    console.error("Failed to fetch Ah-ha detail:", e);
    error.value = e.message || "Failed to load Ah-ha detail.";
  } finally {
    loading.value = false;
  }
};

const formatTimestamp = (isoString: string | undefined) => {
  if (!isoString) return "N/A";
  return new Date(isoString).toLocaleString();
};

const parsedContent = computed(() => {
  if (item.value && item.value.content) {
    const content = item.value.content;
    const contentType = item.value.content_type;

    if (contentType === "markdown") {
      // Parse markdown to HTML, then sanitize
      const rawHtml = marked.parse(content) as string;
      return DOMPurify.sanitize(rawHtml);
    } else if (contentType === "html") {
      // Sanitize HTML content directly
      return DOMPurify.sanitize(content);
    } else {
      // For 'text' or undefined content_type, treat as plain text.
      // Escape HTML entities to prevent rendering as HTML, then wrap in <pre> for formatting.
      // DOMPurify will also handle this safely if we pass it through.
      // For simplicity with v-html, we'll sanitize it.
      // If true plain text display is needed, use {{ }} and style appropriately.
      return DOMPurify.sanitize(content);
    }
  }
  return "";
});

onMounted(() => {
  fetchAhHaDetail(itemId.value);
});

watch(
  () => route.params.id,
  (newId) => {
    itemId.value = newId as string;
    fetchAhHaDetail(itemId.value);
  }
);
</script>

<style scoped lang="scss">
.ah-ha-detail-view {
  /* max-width: 800px; // Removed to allow it to extend */
  /* margin: 40px auto; // Removed auto margins for centering */
  margin: 0; /* Rely on parent for positioning, or set specific margins if needed e.g., margin: 20px; */
  padding: 30px 40px; /* Padding inside the container */
  background-color: #ffffff;
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  color: #333333;
  line-height: 1.6;
}
.article-content {
  max-width: 100%;
  box-sizing: border-box; /* Ensures padding and border are included in the 100% width */
}

.article-title {
  font-family: "Georgia", "Times New Roman", Times, serif; /* Serif for title */
  font-size: 2.5em; /* Larger title */
  font-weight: bold;
  color: #1a1a1a;
  margin-bottom: 0.5em;
  line-height: 1.2;
  overflow-wrap: break-word;
}

.article-metadata {
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; /* Sans-serif for metadata */
  font-size: 0.9em;
  color: #767676; /* Lighter color for metadata */
  margin-bottom: 2em;
  display: flex;
  flex-direction: column;
  gap: 0.75em;

  .timestamp {
    display: block;
  }

  .source-link {
    color: #0073bb; /* Instapaper-like blue for links */
    text-decoration: none;
    &:hover {
      text-decoration: underline;
    }
  }

  .tags-container {
    margin-top: 0.5em;
    .tag-chip {
      /* Using gm3-vue Chip component, so specific styling might not be needed */
      /* Adjust margin if necessary, Chip might have its own */
      margin-right: 6px;
      margin-bottom: 6px;
      /* gm3-vue Chip should provide its own padding, background, color, border-radius, font-size */
    }
  }
}

.article-body {
  font-family: "Georgia", "Times New Roman", Times, serif; /* Serif for body */
  font-size: 1.1em; /* Comfortable reading size */
  color: #333333;
  line-height: 1.7; /* Generous line height */
  max-width: 100%;
  box-sizing: border-box;
  overflow-wrap: break-word;

  /* p tag styling might be less relevant if content is rich HTML from Markdown */
  /* General typography for .article-body will apply to parsed HTML elements */
  & > :first-child {
    margin-top: 0; /* Remove top margin from the first element rendered by v-html */
  }
  & > :last-child {
    margin-bottom: 0; /* Remove bottom margin from the last element rendered by v-html */
  }

  /* You might want to add specific styles for h1, h2, ul, li, blockquote etc. from Markdown here */
  /* For example: */
  :deep(pre) {
    white-space: pre-wrap; /* Allows preformatted text to wrap */
    word-break: break-all; /* Breaks long words if necessary */
    max-width: 100%;
    overflow-x: auto; /* Adds scrollbar if content is still too wide */
  }

  :deep(img) {
    max-width: 100%;
    height: auto; /* Maintains aspect ratio */
    display: block; /* Prevents inline spacing issues */
  }

  // ::v-deep(h2) {
  //   font-size: 1.8em;
  //   margin-top: 1.5em;
  //   margin-bottom: 0.75em;
  //   font-family: "Georgia", "Times New Roman", Times, serif;
  // }
  // ::v-deep(ul), ::v-deep(ol) {
  //   margin-bottom: 1.5em;
  //   padding-left: 1.8em;
  // }
  // ::v-deep(li) {
  //   margin-bottom: 0.5em;
  // }
  // ::v-deep(a) {
  //   color: #0073bb;
  //   text-decoration: none;
  //   &:hover {
  //     text-decoration: underline;
  //   }
  // }
  // ::v-deep(blockquote) {
  //   margin-left: 0;
  //   padding-left: 1.5em;
  //   border-left: 3px solid #cccccc;
  //   color: #555555;
  //   font-style: italic;
  //   margin-bottom: 1.5em;
  // }
  // ::v-deep(pre) {
  //   background-color: #f9f9f9;
  //   border: 1px solid #e0e0e0;
  //   padding: 1em;
  //   overflow-x: auto;
  //   border-radius: 4px;
  //   margin-bottom: 1.5em;
  //   font-family: "Courier New", Courier, monospace;
  // }
  // ::v-deep(code) {
  //    font-family: "Courier New", Courier, monospace;
  //    background-color: #f0f0f0; /* Light grey for inline code */
  //    padding: 0.2em 0.4em;
  //    border-radius: 3px;
  //    font-size: 0.9em;
  // }
  // ::v-deep(pre code) {
  //   background-color: transparent;
  //   padding: 0;
  //   border-radius: 0;
  // }
}

.status-message {
  text-align: center;
  padding: 40px;
  font-style: italic;
  color: #767676;
}

.error-message {
  color: #d9534f; /* Red for errors */
}

.back-link {
  display: inline-block;
  margin-top: 30px;
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  color: #0073bb;
  text-decoration: none;
  font-size: 0.9em;

  &:hover {
    text-decoration: underline;
  }
}
</style>
