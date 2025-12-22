<template>
  <div id="app" :style="{ '--base-font-size': fontSize }">
    <template v-if="isAuthenticated">
      <!-- Header with Title, Settings Button and Global Actions -->
      <AppSettings
        v-model:title="pageTitle"
        v-model:fontSize="fontSize"
        @openSettings="showSettings = true"
        @collapseAll="handleGlobalCollapse"
        @expandAll="handleGlobalExpand"
      />

      <div id="chat-window" ref="chatWindowRef" @scroll="handleScroll" @click="handleCopyClick">
        <ChatMessage 
          v-for="(msg, index) in conversationHistory" 
          :key="msg.id" 
          :message="msg" 
          @delete="handleDelete"
        />
      </div>

      <button v-if="showCompletionHint" @click="forceScrollToBottom" class="completion-hint">
        ↓ 新消息
      </button>

      <!-- Settings Bar (Model, Context, etc.) -->
      <ChatSettings
        v-model:model="model"
        v-model:contextLength="contextLength"
        v-model:temperature="temperature"
        v-model:topP="topP"
      />

      <ChatInput 
        :isLoading="isLoading" 
        @send="onSend" 
        @stop="stopGeneration" 
        ref="inputRef"
      />

      <!-- Global Settings Modal -->
      <GlobalSettings v-if="showSettings" @close="showSettings = false" />
    </template>

    <AccessDenied v-else />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, watch } from 'vue';
import { useAuth } from './composables/useAuth';
import { useChat } from './composables/useChat';
import { useSettings } from './composables/useSettings';
import type { ModelKey } from './types';

// Components
import AppSettings from './components/header/AppSettings.vue';
import ChatMessage from './components/chat/ChatMessage.vue';
import ChatInput from './components/chat/ChatInput.vue';
import ChatSettings from './components/chat/ChatSettings.vue';
import AccessDenied from './components/auth/AccessDenied.vue';
import GlobalSettings from './components/settings/GlobalSettings.vue';

// State
const { isAuthenticated } = useAuth();
const { conversationHistory, isLoading, sendMessage, stopGeneration, deleteMessage } = useChat();
const { settings } = useSettings();

// UI State
const pageTitle = ref('我的 Gemini 客户端');
const showSettings = ref(false);

// Model Settings
const model = ref<ModelKey>('gemini-2.5-flash');
const contextLength = ref('0');
const fontSize = ref('13px');
const temperature = ref(0.1);
const topP = ref(0.7);

// Update document title
watch(pageTitle, (newTitle) => {
  document.title = newTitle || 'Gemini Client';
}, { immediate: true });

// UI Refs & Scroll State
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
const handleDelete = (id: string) => {
  if (isLoading.value) {
    alert("请等待生成完成后再删除消息。");
    return;
  }
  if (confirm('确定要删除这条消息及其后续分支吗？')) {
    deleteMessage(id);
  }
};

const handleGlobalCollapse = () => {
  // Collapse all except the last one if it's currently generating (though history implies past)
  // Simple interpretation: Collapse all. User can expand if needed.
  // "Collapse all history messages" implies all past messages.
  conversationHistory.value.forEach((msg) => {
    msg.collapsed = true;
  });
};

const handleGlobalExpand = () => {
  conversationHistory.value.forEach(msg => {
    msg.collapsed = false;
  });
};

const onSend = (text: string) => {
  // Auto-collapse previous history if enabled
  if (settings.enableAutoCollapse) {
    conversationHistory.value.forEach(msg => {
      msg.collapsed = true;
    });
  }

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
  position: relative; /* For modal positioning context if needed, though modal uses fixed */
}

/* Fix text alignment inheritance issue */
#chat-window { 
  flex-grow: 1; 
  overflow-y: auto; 
  padding: 15px; 
  display: flex; 
  flex-direction: column; 
  text-align: left; 
}

.completion-hint {
  position: absolute; bottom: 130px; 
  left: 50%; transform: translateX(-50%); z-index: 10;
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