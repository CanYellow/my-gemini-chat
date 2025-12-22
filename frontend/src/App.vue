<template>
  <div id="app" :style="{ '--base-font-size': fontSize }">
    <template v-if="isAuthenticated">
      <AppSettings
        v-model:model="model"
        v-model:contextLength="contextLength"
        v-model:fontSize="fontSize"
        v-model:temperature="temperature"
        v-model:topP="topP"
      />

      <div id="chat-window" ref="chatWindowRef" @scroll="handleScroll" @click="handleCopyClick">
        <ChatMessage 
          v-for="(msg, index) in conversationHistory" 
          :key="index" 
          :message="msg" 
          @delete="handleDelete(index)"
        />
      </div>

      <button v-if="showCompletionHint" @click="forceScrollToBottom" class="completion-hint">
        ↓ 新消息
      </button>

      <ChatInput 
        :isLoading="isLoading" 
        @send="onSend" 
        @stop="stopGeneration" 
        ref="inputRef"
      />
    </template>

    <AccessDenied v-else />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import { useAuth } from './composables/useAuth';
import { useChat } from './composables/useChat';
import type { ModelKey } from './types';

// Components
import AppSettings from './components/header/AppSettings.vue';
import ChatMessage from './components/chat/ChatMessage.vue';
import ChatInput from './components/chat/ChatInput.vue';
import AccessDenied from './components/auth/AccessDenied.vue';

// State
const { isAuthenticated } = useAuth();
const { conversationHistory, isLoading, sendMessage, stopGeneration, deleteMessage } = useChat();

// Settings
const model = ref<ModelKey>('gemini-2.5-flash');
const contextLength = ref('12');
const fontSize = ref('13px');
const temperature = ref(0.1);
const topP = ref(0.7);

// UI Refs & State
const chatWindowRef = ref<HTMLElement | null>(null);
const inputRef = ref<InstanceType<typeof ChatInput> | null>(null);
const showCompletionHint = ref(false);
const shouldAutoScroll = ref(true);

// Scroll Logic
const scrollToBottom = (force = false) => {
  nextTick(() => {
    const el = chatWindowRef.value;
    if (el) {
      const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
      if (force || isAtBottom) {
        el.scrollTop = el.scrollHeight;
      }
    }
  });
};

const handleScroll = () => {
  const el = chatWindowRef.value;
  if (el) {
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    shouldAutoScroll.value = isNearBottom;
    if (isNearBottom) showCompletionHint.value = false;
  }
};

const forceScrollToBottom = () => {
  scrollToBottom(true);
  showCompletionHint.value = false;
};

// Handlers
const handleDelete = (index: number) => {
  // Prevent deletion during loading to avoid state inconsistencies
  if (isLoading.value) {
    alert("请等待生成完成后再删除消息。");
    return;
  }
  if (confirm('确定要删除这条消息吗？')) {
    deleteMessage(index);
  }
};

const onSend = (text: string) => {
  showCompletionHint.value = false;
  shouldAutoScroll.value = true;
  scrollToBottom(true);

  sendMessage(
    text,
    {
      model: model.value,
      temperature: temperature.value,
      topP: topP.value,
      contextLength: contextLength.value
    },
    () => { // On Stream Update callback
       if (shouldAutoScroll.value) {
         scrollToBottom(true);
       } else {
         showCompletionHint.value = true;
       }
    }
  ).then(() => {
    nextTick(() => inputRef.value?.focus());
  });
};

// Copy Code Logic (Event Delegation)
const handleCopyClick = async (event: MouseEvent) => {
  const target = event.target as HTMLElement;
  const copyButton = target.closest('.copy-code-button');

  if (!copyButton || copyButton.classList.contains('copied')) return;

  const wrapper = copyButton.closest('.code-block-wrapper');
  const preElement = wrapper?.querySelector('pre');

  if (preElement) {
    try {
      await navigator.clipboard.writeText(preElement.innerText);
      const copyText = copyButton.querySelector('.copy-text');
      if (copyText) copyText.textContent = 'Copied!';
      copyButton.classList.add('copied');
      setTimeout(() => {
        if (copyText) copyText.textContent = 'Copy';
        copyButton.classList.remove('copied');
      }, 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  }
};

onMounted(() => {
  if (isAuthenticated.value) {
    nextTick(() => inputRef.value?.focus());
  }
});
</script>

<style>
/* Global Layout Styles */
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  background-color: #f4f4f9; margin: 0; display: flex; justify-content: center; align-items: center;
  height: 100vh; color: #333;
}

#app {
  width: 90%; max-width: 800px; height: 95vh; max-height: 900px; background: #fff;
  border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); display: flex;
  flex-direction: column; overflow: hidden; font-size: var(--base-font-size, 13px);
}

#chat-window { flex-grow: 1; overflow-y: auto; padding: 15px; display: flex; flex-direction: column; }

.completion-hint {
  position: absolute; bottom: 75px; left: 50%; transform: translateX(-50%); z-index: 10;
  background-color: #007bff; color: white; border: none; border-radius: 20px; padding: 8px 16px;
  font-size: calc(var(--base-font-size, 13px) - 1px); font-weight: 500; cursor: pointer;
  box-shadow: 0 2px 10px rgba(0,0,0,0.2); transition: opacity 0.3s ease, transform 0.3s ease;
}
.completion-hint:hover { background-color: #0056b3; transform: translateX(-50%) translateY(-2px); }

/* Scrollbars */
::-webkit-scrollbar { width: 8px; height: 8px; background-color: #f1f1f1; }
::-webkit-scrollbar-thumb { background-color: #c1c1c1; border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background-color: #a8a8a8; }
</style>