<template>
  <div
    :class="[
      'chat-message',
      message.user === 'AI' ? 'ai-message' : 'user-message',
    ]"
  >
    <div class="message-bubble">
      <div class="message-text" v-html="renderedMarkdown"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineProps, computed } from "vue";
import { marked } from "marked";

interface Message {
  id: number;
  user: "User" | "AI";
  text: string;
}

const props = defineProps<{
  message: Message;
}>();

const renderedMarkdown = computed(() => {
  // Basic configuration for marked, can be extended
  // Ensure to sanitize if dealing with user-generated markdown from untrusted sources in a real app.
  // For this MVP with mock data, direct rendering is acceptable.
  return marked(props.message.text, { breaks: true, gfm: true });
});
</script>

<style scoped lang="scss">
.chat-message {
  display: flex;
  margin-bottom: 10px;
  max-width: 80%;
}

.ai-message {
  justify-content: flex-start;
  .message-bubble {
    background-color: #f0f0f0;
    color: #333;
    border-radius: 15px 15px 15px 0;
  }
}

.user-message {
  justify-content: flex-end;
  margin-left: auto; /* Push user messages to the right */
  .message-bubble {
    background-color: #007bff;
    color: white;
    border-radius: 15px 15px 0 15px;
  }
}

.message-bubble {
  padding: 10px 15px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  word-wrap: break-word; /* Ensure long words don't overflow */
}

.message-text {
  margin: 0;
  word-wrap: break-word; /* Ensure long words don't overflow before markdown processing */
  :deep(p) {
    margin-top: 0;
    margin-bottom: 0.5em;
    &:last-child {
      margin-bottom: 0;
    }
  }
  :deep(ul),
  :deep(ol) {
    padding-left: 20px;
    margin-top: 0.5em;
    margin-bottom: 0.5em;
  }
  :deep(pre) {
    background-color: #eee;
    padding: 10px;
    border-radius: 4px;
    overflow-x: auto;
  }
  :deep(code) {
    font-family: "Courier New", Courier, monospace;
    background-color: #f0f0f0;
    padding: 0.2em 0.4em;
    border-radius: 3px;
  }
  :deep(pre code) {
    background-color: transparent;
    padding: 0;
  }
}
</style>
