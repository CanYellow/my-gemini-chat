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
        @export="handleExport"
        @restore="handleImport"
      />

      <div id="chat-window" ref="chatWindowRef" @scroll="handleScroll" @click="handleCopyClick">
        <ChatMessage 
          v-for="msg in conversationHistory" 
          :key="msg.id" 
          :message="msg" 
          @delete="handleDelete"
        />
      </div>

      <button v-if="showCompletionHint" @click="handleHintClick" class="completion-hint">
        {{ hintText }}
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
import { ref, onMounted, nextTick, watch, computed } from 'vue';
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
const { 
  conversationHistory, 
  isLoading, 
  currentGeneratingMessageId,
  sendMessage, 
  stopGeneration, 
  deleteMessage,
  navigateToMessage,
  exportState,
  importState
} = useChat();
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

// Track the ID of a new message that is currently hidden (in another branch)
const pendingJumpMessageId = ref<string | null>(null);

// Watch conversation history to clear pending jump if the message becomes visible manually
watch(conversationHistory, (history) => {
  if (pendingJumpMessageId.value) {
    const isVisible = history.some(m => m.id === pendingJumpMessageId.value);
    if (isVisible) {
      pendingJumpMessageId.value = null;
      // Re-evaluate auto-scroll logic if needed, but usually manual navigation implies we are where we want to be.
    }
  }
});

// Computed Hint Logic
const isGeneratingMessageVisible = computed(() => {
  if (!currentGeneratingMessageId.value) return false;
  return conversationHistory.value.some(m => m.id === currentGeneratingMessageId.value);
});

const hintText = computed(() => {
  // If we have a pending hidden message (either generating or finished), show Jump hint
  if (pendingJumpMessageId.value) {
    return '↪ 跳转到新消息分支';
  }
  return '↓ 新消息';
});

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
    
    // Logic to hide hint:
    // 1. If we are near bottom AND (no hidden message pending OR hidden message is now visible)
    if (isNearBottom && !pendingJumpMessageId.value) {
      showCompletionHint.value = false;
    }
  }
};

const forceScrollToBottom = () => {
  scrollToBottom(true);
  showCompletionHint.value = false;
};

const handleHintClick = () => {
  if (pendingJumpMessageId.value) {
    // Message is in another branch, switch to it
    navigateToMessage(pendingJumpMessageId.value);
    
    // Wait for DOM update (branch switch) then scroll
    nextTick(() => {
      forceScrollToBottom();
      shouldAutoScroll.value = true;
    });
  } else {
    // Message is in current view, just scroll
    forceScrollToBottom();
    shouldAutoScroll.value = true;
  }
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
  conversationHistory.value.forEach((msg) => {
    msg.collapsed = true;
  });
};

const handleGlobalExpand = () => {
  conversationHistory.value.forEach(msg => {
    msg.collapsed = false;
  });
};

const handleExport = () => {
  const jsonStr = exportState();
  if (!jsonStr) {
    alert("没有可导出的聊天记录。");
    return;
  }
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `chat-history-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const handleImport = (jsonStr: string) => {
  if (isLoading.value) {
    alert("生成过程中无法导入。");
    return;
  }
  if (!confirm("导入将覆盖当前所有聊天记录，确定继续吗？")) {
    return;
  }
  
  try {
    importState(jsonStr);
    scrollToBottom(true);
  } catch (e) {
    alert("导入失败：文件格式不正确或已损坏。");
  }
};

const onSend = (text: string) => {
  if (settings.enableAutoCollapse) {
    conversationHistory.value.forEach(msg => {
      msg.collapsed = true;
    });
  }

  showCompletionHint.value = false;
  shouldAutoScroll.value = true;
  pendingJumpMessageId.value = null; // Reset pending jump
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
       // Check if the generating message is in the current view
       if (isGeneratingMessageVisible.value) {
         if (shouldAutoScroll.value) {
           scrollToBottom(true);
         } else {
           showCompletionHint.value = true;
         }
       } else {
         // Generating message is NOT in view (user switched branch)
         // Always show hint so they can jump back
         showCompletionHint.value = true;
         
         // Capture the ID so we can jump to it even after generation finishes
         if (currentGeneratingMessageId.value) {
            pendingJumpMessageId.value = currentGeneratingMessageId.value;
         }
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
  position: relative; 
}

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

#input-area {
  display: flex;
  align-items: flex-end;
  padding: 12px;
  border-top: 1px solid #eee;
  background-color: #fafafa;
  flex-shrink: 0;
}

#message-input {
  flex-grow: 1;
  border: 1px solid #ccc;
  border-radius: 18px;
  padding: 10px 15px;
  resize: none;
  font-size: 1em;
  font-family: inherit;
  line-height: 1.4;
  max-height: 120px;
  overflow-y: auto;
}

#message-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0,123,255,0.25);
}

#send-button {
  background: #007bff;
  color: white;
  border: none;
  border-radius: 50%;
  width: 44px;
  height: 44px;
  margin-left: 10px;
  cursor: pointer;
  font-size: calc(var(--base-font-size, 13px) * 1.4);
  display: flex;
  justify-content: center;
  align-items: center;
  transition: background-color 0.2s;
  flex-shrink: 0;
}

#send-button.stop-button {
  background-color: #dc3545;
}
#send-button.stop-button:hover {
  background-color: #c82333;
}

#send-button:hover {
  background: #0056b3;
}

#send-button:disabled {
  background-color: #a0a0a0;
  cursor: not-allowed;
}

.message.model .text pre {
  background-color: #282c34;
  color: #abb2bf;
  padding: 0.8em;
  margin: 0.5em 0;
  border-radius: 8px;
  overflow-x: auto; /* 关键：这条规则本身是正确的，现在它的父元素行为正常了，它就能正确工作 */
  font-size: 0.9em;
  white-space: pre; /* 新增：明确指定代码块内的空白和换行行为，防止意外的自动换行 */
}
.message.model .text code {
  font-family: 'Courier New', Courier, monospace;
  background-color: rgba(0,0,0,0.08);
  padding: 2px 5px;
  border-radius: 4px;
}
.message.model .text pre > code {
  background-color: transparent;
  padding: 0;
  color: inherit;
}
.message.model .text blockquote {
  border-left: 3px solid #ccc;
  padding-left: 1em;
  margin: 0.5em 0;
  color: #666;
}
.message.model .text ul, .message.model .text ol {
  padding-left: 1.5em;
  margin: 0.5em 0;
}
.message.model .text p {
  margin: 0.5em 0;
}
.message.model .text p:first-child {
  margin-top: 0;
}
.message.model .text p:last-child {
  margin-bottom: 0;
}
.message.model .text strong {
  font-weight: bold;
}

/* --- 新增：访问受限页面的样式 --- */
.access-denied {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100%;
  padding: 20px;
  text-align: center;
  background-color: #f8f9fa;
  color: #495057;
}

.access-denied h2 {
  font-size: 2em;
  margin-bottom: 15px;
}

.access-denied p {
  font-size: 1.1em;
  margin-bottom: 20px;
  max-width: 500px;
  line-height: 1.6;
}

.access-denied code {
  background-color: #e9ecef;
  padding: 4px 8px;
  border-radius: 4px;
  font-family: 'Courier New', Courier, monospace;
  color: #c7254e;
}

.access-denied .warning {
  background-color: #fff3cd;
  color: #856404;
  padding: 10px 15px;
  border-radius: 6px;
  border: 1px solid #ffeeba;
  max-width: 90%;
  margin-top: 20px;
  margin-bottom: 20px;
}

/* 
 * ===================================================================
 *  最终的、保证有效的滚动条样式 (Chrome/WebKit 核心)
 * ===================================================================
 */

/* 
 * -------------------------------------------------------------------
 *  A. 美化【页面主滚动条】(应用浅色主题)
 * -------------------------------------------------------------------
 *  我们不再对 #chat-window 进行修改，而是直接修改全局的滚动条。
 *  在您的布局中，这会稳定地应用到主聊天窗口的滚动条上。
 */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
  background-color: #f1f1f1; /* 轨道背景色 */
}

/* 定义滑块的样式 */
::-webkit-scrollbar-thumb {
  background-color: #c1c1c1; /* 滑块颜色 */
  border-radius: 4px;
}

/* 鼠标悬浮在滑块上时的样式 */
::-webkit-scrollbar-thumb:hover {
  background-color: #a8a8a8; /* 滑块颜色加深 */
}


/* 
 * -------------------------------------------------------------------
 *  B. 美化【代码块内部】的【水平】滚动条 (应用深色主题)
 *     这部分样式具有更高的特异性，会覆盖上面的全局设置。
 * -------------------------------------------------------------------
 */
.message.model .text pre::-webkit-scrollbar {
  /* 尺寸和轨道背景在代码块中需要重新定义 */
  height: 8px;
  background-color: #3d4451; /* 代码块滚动条的轨道颜色 */
}

/* 定义代码块中滑块的样式 */
.message.model .text pre::-webkit-scrollbar-thumb {
  background-color: #6c757d; /* 代码块滑块颜色 */
  border-radius: 4px;
  border: 2px solid #3d4451; /* 使用边框创建内边距效果，让滑块看起来更精致 */
}

/* 鼠标悬浮在代码块滑块上时的样式 */
.message.model .text pre::-webkit-scrollbar-thumb:hover {
  background-color: #9ea5ab; /* 悬浮时滑块颜色变亮 */
}

/* 
 * ===================================================================
 *  代码块复制按钮样式 (V2 - 专业版)
 * ===================================================================
 */

/* 
  1. Wrapper 容器: 
  - 成为视觉上的代码块主体 (背景、圆角等)
  - 作为按钮的相对定位父级
*/
.code-block-wrapper {
  position: relative;
  background-color: #2e3440; /* Nord 主题暗色背景 */
  border-radius: 8px;
  margin: 1em 0;
  padding: 1em; /* 为内部<pre>提供空间 */
}

/* 
  2. 内部 <pre> 标签: 
  - 重置其所有样式，使其透明地存在于 Wrapper 内部
  - 它的唯一作用是保留代码的格式
*/
.message.model .text .code-block-wrapper pre {
  margin: 0;
  padding: 0;
  background-color: transparent;
  overflow-x: auto; /* 保持代码水平滚动 */
}

/* 
  3. 复制按钮:
  - 绝对定位到 Wrapper 的右上角内部
  - 默认隐藏，悬浮时出现，交互友好
*/
.copy-code-button {
  position: absolute;
  top: 0.75em;
  right: 0.75em;
  
  display: flex;
  align-items: center;
  gap: 0.5em; /* 图标和文字的间距 */

  padding: 0.35em 0.6em;
  background-color: rgba(216, 222, 233, 0.1); /* Nord 主题的半透明背景 */
  color: #d8dee9; /* Nord 主题的文字颜色 */
  border: 1px solid rgba(216, 222, 233, 0.15);
  border-radius: 6px;
  font-size: 0.875rem;
  font-family: inherit;
  cursor: pointer;
  
  opacity: 0; /* 默认完全透明 */
  transform: translateY(-5px); /* 默认向上移动一点 */
  transition: opacity 0.2s ease-in-out, transform 0.2s ease-in-out, background-color 0.2s;
  z-index: 10;
}

/* 
  4. 交互效果:
  - 当鼠标悬浮在【整个代码块】上时，按钮平滑地浮现出来
*/
.code-block-wrapper:hover .copy-code-button {
  opacity: 1;
  transform: translateY(0);
}

.copy-code-button:hover {
  background-color: rgba(216, 222, 233, 0.25);
}

.copy-code-button:active {
  background-color: rgba(216, 222, 233, 0.3);
}

/* 
  5. 复制成功状态:
  - 按钮背景变绿，文字和图标变白
*/
.copy-code-button.copied {
  background-color: #5e81ac; /* Nord 主题的蓝色，表示成功 */
  border-color: #5e81ac;
  color: #eceff4;
}

.copy-code-button .copy-text {
  line-height: 1; /* 确保文字垂直居中 */
}

/* --- 新增：参数滑块样式 --- */
.slider-container {
  display: flex;
  align-items: center;
  gap: 5px;
}
.slider-container label {
  font-weight: bold;
  font-size: 0.9em;
  color: #555;
}
.slider-container input[type="range"] {
  width: 60px;
  margin: 0;
  cursor: pointer;
}
.slider-container span {
  font-size: 0.85em;
  min-width: 28px;
  text-align: right;
  font-family: monospace;
  color: #333;
}
</style>
