<template>
  <div class="chat-interface-container">
    <div class="chat-window" ref="chatWindow">
      <ChatMessage
        v-for="msg in chatLog"
        :key="msg.id"
        :message="msg"
        @mouseup="handleTextSelection"
      />
    </div>
    <div v-if="selectedText" class="capture-controls">
      <button @click="openCaptureModal" class="capture-button">
        Capture to Ah-ha
      </button>
    </div>
    <!-- Modal would go here, to be implemented later -->
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, defineEmits } from "vue";
import ChatMessage from "./ChatMessage.vue";

const emit = defineEmits(["open-capture-modal"]);

interface Message {
  id: number;
  user: "User" | "AI";
  text: string;
}

const chatLog = ref<Message[]>([]);
const chatWindow = ref<HTMLElement | null>(null);
const selectedText = ref<string>("");
const selectedContext = ref<string>(""); // To store the full message text of the selection

const fetchChatLog = async () => {
  try {
    // Assuming backend is running on port 8010
    const response = await fetch(
      "https://aha-backend-service-36070612387.us-central1.run.app/mock-chat/"
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    chatLog.value = data;
    scrollToBottom();
  } catch (error) {
    console.error("Failed to fetch chat log:", error);
    // Fallback to some default mock data if backend is not available
    chatLog.value = [
      { id: 1, user: "User", text: "Hello AI, can you help me?" },
      {
        id: 2,
        user: "AI",
        text: "Hello User, I am a mock AI. How can I assist you today? (Backend not connected)",
      },
      { id: 3, user: "User", text: "Just checking if the interface works." },
      {
        id: 4,
        user: "AI",
        text: "Interface seems to be working. This is a longer message to test wrapping and scrolling. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
      },
    ];
    scrollToBottom();
  }
};

const scrollToBottom = () => {
  nextTick(() => {
    if (chatWindow.value) {
      chatWindow.value.scrollTop = chatWindow.value.scrollHeight;
    }
  });
};

const handleTextSelection = (event: MouseEvent) => {
  const selection = window.getSelection();
  if (selection && selection.toString().trim() !== "") {
    selectedText.value = selection.toString().trim();
    // Find the parent message bubble to get the full context
    let target = event.target as HTMLElement;
    while (target && !target.classList.contains("message-bubble")) {
      target = target.parentElement as HTMLElement;
    }
    if (target) {
      const textElement = target.querySelector(".message-text") as HTMLElement;
      if (textElement) {
        selectedContext.value =
          textElement.innerText || textElement.textContent || "";
      }
    }
  } else {
    selectedText.value = "";
    selectedContext.value = "";
  }
};

const openCaptureModal = () => {
  if (!selectedText.value) return;
  // For now, just log it. Modal implementation is next.
  // console.log("Capture this Ah-ha:", selectedText.value);
  // console.log("Original Context:", selectedContext.value);
  emit("open-capture-modal", {
    snippet: selectedText.value,
    context: selectedContext.value,
  });
  // alert(
  //   `Selected: "${selectedText.value}"\nContext: "${selectedContext.value}"\n\nModal to capture this will be implemented next.`
  // );
  selectedText.value = ""; // Clear selection after "capture"
  selectedContext.value = "";
  if (window.getSelection) {
    // Clear browser selection
    window.getSelection()?.removeAllRanges();
  }
};

onMounted(() => {
  fetchChatLog();
});
</script>

<style scoped lang="scss">
.chat-interface-container {
  display: flex;
  flex-direction: column;
  height: 500px; /* Or any desired height */
  border: 1px solid #ccc;
  border-radius: 8px;
  overflow: hidden;
  background-color: #fff;
  position: relative; /* For positioning the capture button */
}

.chat-window {
  flex-grow: 1;
  padding: 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 5px; /* Small gap between messages */
}

.capture-controls {
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  padding: 5px;
  background-color: rgba(255, 255, 255, 0.9);
  border-radius: 20px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  z-index: 10;
}

.capture-button {
  padding: 8px 15px;
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 15px;
  cursor: pointer;
  font-size: 0.9em;
  &:hover {
    background-color: #218838;
  }
}
</style>
