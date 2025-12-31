<template>
  <div :class="['message', message.role]">
    <div class="role">{{ message.role === 'user' ? 'You' : 'Model' }}</div>
    
    <div 
      class="content-wrapper" 
      :class="{ 'collapsed': isCollapsed }"
      :style="collapsedStyle"
    >
      <div ref="contentRef" class="content-inner">
        <!-- Loop through parts -->
        <div v-for="(part, index) in message.parts" :key="index" class="message-part">
          
          <!-- Image Part -->
          <div v-if="part.inlineData && part.inlineData.mimeType.startsWith('image/')" class="image-container group">
            <img 
              :src="`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`" 
              alt="Content" 
              class="chat-image"
            />
            <button class="download-btn" @click="downloadFile(part.inlineData.data, part.inlineData.mimeType, part.inlineData.name || 'image')" title="下载图片">
               <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            </button>
          </div>

          <!-- File Part (Non-Image) -->
          <div v-else-if="part.inlineData" class="file-card">
            <div class="file-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            </div>
            <div class="file-info">
              <span class="file-name">{{ part.inlineData.name || 'Attachment' }}</span>
              <span class="file-type">{{ part.inlineData.mimeType }}</span>
            </div>
            <button class="file-download-btn" @click="downloadFile(part.inlineData.data, part.inlineData.mimeType, part.inlineData.name || 'file')">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            </button>
          </div>
          
          <!-- Text Part -->
          <div v-if="part.text" class="text-content">
             <div v-if="message.role === 'user'" class="text user-text">{{ part.text }}</div>
             <div v-else class="text model-text" v-html="renderMarkdown(part.text)"></div>
          </div>
        </div>
      </div>
      
      <div v-if="isCollapsed" class="collapse-overlay"></div>
    </div>

    <!-- Branch Navigation Bar -->
    <div v-if="showBranchNav" class="branch-nav">
      <div class="branch-separator"></div>
      <div class="branch-controls">
        <button 
          class="nav-btn" 
          :disabled="currentBranchIndex <= 1"
          @click="prevBranch"
          title="上一分支"
        >
          &lt;
        </button>
        
        <div class="page-indicator">
          <input 
            type="text" 
            v-model="pageInput" 
            @keydown.enter="handlePageJump" 
            @blur="resetPageInput"
            class="page-input"
          />
          <span class="total-pages">/ {{ totalBranches }}</span>
        </div>
        
        <button 
          class="nav-btn" 
          :disabled="currentBranchIndex >= totalBranches"
          @click="nextBranch"
          title="下一分支"
        >
          &gt;
        </button>
      </div>
    </div>

    <div class="message-footer">
      <!-- Meta Info -->
      <div class="meta-info">
        <div v-if="message.sentChars !== undefined || message.receivedChars !== undefined" class="char-info">
          <span v-if="message.sentChars !== undefined">{{ message.sentChars }}字</span>
          <span v-if="message.receivedChars !== undefined" class="received-chars">{{ message.receivedChars }}字</span>
        </div>
        
        <div v-if="message.inputTokens !== undefined" class="token-info">
          <span title="Input Tokens">In: {{ message.inputTokens }} tokens</span>
          <span class="separator">|</span>
          <span title="Output Tokens">Out: {{ message.outputTokens }} tokens</span>
        </div>

        <div v-if="costDisplay" class="cost-info">
          <span title="USD">${{ costDisplay.usd }}</span>
          <span class="cost-cny" title="CNY (Estimated)"> (¥{{ costDisplay.cny }})</span>
        </div>
      </div>

      <!-- Actions -->
      <div class="actions">
        <button 
          class="action-btn branch-btn" 
          @click="handleCreateBranch" 
          title="新建分支 (Create Branch)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="3" x2="6" y2="15"></line><circle cx="18" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><path d="M18 9a9 9 0 0 1-9 9"></path></svg>
        </button>

        <button 
          class="action-btn toggle-btn" 
          @click="toggleCollapse" 
          :title="isCollapsed ? '展开' : '折叠'"
        >
          <span v-if="isCollapsed">▼</span>
          <span v-else>▲</span>
        </button>

        <button class="action-btn delete-btn" @click="$emit('delete', message.id)" title="删除消息">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch, nextTick } from 'vue';
import type { Message } from '../../types';
import { renderMarkdown } from '../../utils/markdown';
import { useSettings } from '../../composables/useSettings';
import { useChat } from '../../composables/useChat';
import { useExchangeRate } from '../../composables/useExchangeRate';

const props = defineProps<{ message: Message }>();
const emit = defineEmits<{ (e: 'delete', id: string): void }>();

const { settings } = useSettings();
const { createBranch, switchBranch } = useChat();
const { effectiveRate } = useExchangeRate();

const contentRef = ref<HTMLElement | null>(null);
const isOverflowing = ref(false);

const costDisplay = computed(() => {
  const inCost = props.message.inputCost || 0;
  const outCost = props.message.outputCost || 0;
  const totalUSD = inCost + outCost;
  
  if (totalUSD <= 0) return null;

  const totalCNY = totalUSD * effectiveRate.value;

  return {
    usd: totalUSD.toFixed(6),
    cny: totalCNY.toFixed(6)
  };
});

// Branch Navigation Logic
const hasChildren = computed(() => props.message.childrenIds.length > 0);
const isDrafting = computed(() => props.message.selectedChildIndex >= props.message.childrenIds.length);
const showBranchNav = computed(() => props.message.childrenIds.length > 1 || (hasChildren.value && isDrafting.value));
const currentBranchIndex = computed(() => props.message.selectedChildIndex + 1);
const totalBranches = computed(() => props.message.childrenIds.length);
const pageInput = ref(currentBranchIndex.value.toString());

watch(currentBranchIndex, (newVal) => {
  pageInput.value = newVal.toString();
});

const prevBranch = () => {
  if (currentBranchIndex.value > 1) {
    switchBranch(props.message.id, props.message.selectedChildIndex - 1);
  }
};

const nextBranch = () => {
  if (currentBranchIndex.value < totalBranches.value) {
    switchBranch(props.message.id, props.message.selectedChildIndex + 1);
  }
};

const handleCreateBranch = () => {
  createBranch(props.message.id);
};

const handlePageJump = () => {
  const val = parseInt(pageInput.value, 10);
  if (!isNaN(val) && val >= 1 && val <= totalBranches.value) {
    switchBranch(props.message.id, val - 1);
  } else {
    pageInput.value = currentBranchIndex.value.toString();
  }
};

const resetPageInput = () => {
   pageInput.value = currentBranchIndex.value.toString();
};

// File Download Logic
const downloadFile = (base64: string, mimeType: string, filename: string) => {
  const link = document.createElement('a');
  link.href = `data:${mimeType};base64,${base64}`;
  
  // Attempt to detect extension from filename, else mime type
  let name = filename;
  if (name.indexOf('.') === -1) {
     const ext = mimeType.split('/')[1] || 'bin';
     name = `${name}.${ext}`;
  }
  
  link.download = name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const checkOverflow = () => {
  if (!contentRef.value) return;
  const lineHeightEm = 1.6;
  const fullHeight = contentRef.value.scrollHeight;
  const fontSize = parseFloat(getComputedStyle(contentRef.value).fontSize || '13');
  const maxAllowedHeight = settings.collapseThreshold * lineHeightEm * fontSize;
  
  // Increase threshold tolerance slightly for images
  isOverflowing.value = fullHeight > maxAllowedHeight + 10;
};

// Watch all text parts text to trigger overflow check
const textContentCombined = computed(() => props.message.parts.map(p => p.text).join(''));

watch(() => [textContentCombined.value, settings.collapseThreshold], () => {
  nextTick(checkOverflow);
}, { flush: 'post' });

onMounted(() => {
  // Wait a bit longer for images to render size
  setTimeout(checkOverflow, 200);
});

const isCollapsed = computed(() => {
  return props.message.collapsed && isOverflowing.value;
});

const toggleCollapse = () => {
  props.message.collapsed = !props.message.collapsed;
};

const collapsedStyle = computed(() => {
  if (!isCollapsed.value) return {};
  return {
    '--max-lines': settings.collapseThreshold
  };
});
</script>

<style scoped>
.branch-nav {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}
.branch-separator {
  width: 100%; height: 1px; background-color: #e0e0e0; margin-bottom: 6px; position: relative;
}
.branch-controls {
  display: flex; align-items: center; gap: 10px; background-color: #f8f9fa;
  padding: 2px 10px; border-radius: 12px; border: 1px solid #eee; font-size: 0.85em; color: #666;
}
.nav-btn {
  background: none; border: none; cursor: pointer; color: #555;
  font-weight: bold; padding: 2px 6px; border-radius: 4px;
}
.nav-btn:hover:not(:disabled) { background-color: #e2e6ea; color: #007bff; }
.nav-btn:disabled { color: #ccc; cursor: default; }
.page-indicator { display: flex; align-items: center; gap: 4px; font-family: monospace; }
.page-input {
  width: 24px; text-align: center; border: 1px solid transparent; 
  background: transparent; font-family: inherit; font-size: 1em; color: #333; padding: 0;
}
.page-input:focus { border-bottom: 1px solid #007bff; outline: none; }
.total-pages { color: #999; }
</style>

<style>
/* Global styles for markdown content */
.message { 
  display: flex; flex-direction: column; margin-bottom: 15px; 
  max-width: 95%; text-align: left;
}
.message .role { 
  font-weight: bold; font-size: 0.85em; margin-bottom: 4px; color: #555; width: 100%;
}

.content-wrapper {
  position: relative; border-radius: 16px; background-color: transparent; transition: max-height 0.3s ease;
}
.content-inner { overflow: hidden; display: flex; flex-direction: column; gap: 8px; }

/* Image Styling */
.image-container {
  max-width: 100%;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 4px;
  position: relative; 
}
.chat-image {
  max-width: 300px;
  max-height: 300px;
  display: block;
  border-radius: 8px;
  cursor: default;
}
/* Allow larger images in model response */
.message.model .chat-image {
  max-width: 100%;
}

/* File Card Styling */
.file-card {
  display: flex; align-items: center; gap: 10px;
  background-color: #f8f9fa; border: 1px solid #e0e0e0;
  border-radius: 8px; padding: 10px; margin-bottom: 5px;
  max-width: 300px;
}
.file-icon {
  width: 36px; height: 36px; background-color: #e2e6ea;
  border-radius: 6px; display: flex; align-items: center; justify-content: center;
  color: #6c757d;
}
.file-info {
  display: flex; flex-direction: column; flex-grow: 1; overflow: hidden;
}
.file-name {
  font-weight: 500; font-size: 0.9em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  color: #333;
}
.file-type {
  font-size: 0.75em; color: #888;
}
.file-download-btn {
  background: none; border: none; cursor: pointer; color: #007bff;
  padding: 4px; border-radius: 4px;
}
.file-download-btn:hover { background-color: #e2e6ea; }

/* Download Button Overlay for Images */
.download-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  background-color: rgba(0,0,0,0.5);
  color: white;
  border: none;
  border-radius: 6px;
  padding: 6px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s, background-color 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}
.image-container:hover .download-btn {
  opacity: 1;
}
.download-btn:hover {
  background-color: rgba(0,0,0,0.7);
}

/* User Message */
.message.user .content-wrapper { align-self: flex-end; align-items: flex-end; }
.message.user .role { text-align: right; }
.message.user .text.user-text { 
  background: #007bff; color: white; padding: 10px 15px; 
  border-radius: 16px; border-bottom-right-radius: 4px; 
  white-space: pre-wrap; overflow-wrap: break-word; word-break: break-word; 
  line-height: 1.6; text-align: left; display: inline-block;
}

/* Model Message */
.message.model .content-wrapper { align-self: flex-start; max-width: 100%; }
.message.model .role { text-align: left; }
.message.model .text.model-text { 
  background: #e9ecef; color: #333; padding: 10px 15px; 
  border-radius: 16px; border-bottom-left-radius: 4px; 
  max-width: 100%; overflow-wrap: break-word; word-break: break-all; 
  line-height: 1.6; text-align: left;
}

/* Collapsed State */
.content-wrapper.collapsed .content-inner { max-height: calc(1.6em * var(--max-lines, 5)); }
.content-wrapper.collapsed .collapse-overlay {
  position: absolute; bottom: 0; left: 0; right: 0; height: 40px;
  border-bottom-left-radius: 4px; border-bottom-right-radius: 16px;
  background: linear-gradient(to bottom, rgba(233,236,239,0), rgba(233,236,239,1)); pointer-events: none;
}
.message.user .content-wrapper.collapsed .collapse-overlay {
  border-bottom-left-radius: 16px; border-bottom-right-radius: 4px;
  background: linear-gradient(to bottom, rgba(0,123,255,0), rgba(0,123,255,1));
}

/* Footer & Actions */
.message-footer {
  display: flex; align-items: center; margin-top: 5px; width: 100%; padding: 0 4px; gap: 15px; flex-wrap: wrap;
}
.message.user .message-footer { justify-content: flex-end; }
.message.model .message-footer { justify-content: flex-start; }

.meta-info { display: flex; flex-direction: row; gap: 12px; font-size: 0.75em; color: #999; align-items: center; flex-wrap: wrap; }
.char-info { font-family: sans-serif; }
.token-info { display: flex; gap: 6px; font-family: monospace; background: #f1f3f5; padding: 2px 6px; border-radius: 4px; }
.separator { color: #ccc; }
.cost-info { color: #666; font-weight: 500; display: flex; gap: 4px; }
.cost-cny { color: #888; }

.actions { display: flex; align-items: center; gap: 4px; opacity: 0; transition: opacity 0.2s; }
.message:hover .actions { opacity: 1; }

.action-btn {
  background: none; border: none; cursor: pointer; color: #999; 
  padding: 4px 6px; font-size: 0.8em; display: flex; align-items: center; gap: 2px;
  border-radius: 4px; transition: all 0.2s;
}
.action-btn:hover { background-color: #f0f0f0; color: #555; }
.delete-btn:hover { background-color: #fee2e2; color: #dc3545; }
.branch-btn:hover { background-color: #e0f2f1; color: #009688; }
.toggle-btn { color: #007bff; font-weight: 500; }
.toggle-btn:hover { background-color: #e7f1ff; color: #0056b3; }

/* Markdown Styles */
.message.model .text pre {
  background-color: #282c34; color: #abb2bf; padding: 0.8em; margin: 0.5em 0;
  border-radius: 8px; overflow-x: auto; font-size: 0.9em; white-space: pre;
}
.message.model .text code { font-family: 'Courier New', monospace; background-color: rgba(0,0,0,0.08); padding: 2px 5px; border-radius: 4px; }
.message.model .text pre > code { background-color: transparent; padding: 0; color: inherit; }
.message.model .text blockquote { border-left: 3px solid #ccc; padding-left: 1em; margin: 0.5em 0; color: #666; }
.message.model .text p { margin: 0.5em 0; }

/* Scrollbars */
.message.model .text pre::-webkit-scrollbar { height: 8px; background-color: #3d4451; }
.message.model .text pre::-webkit-scrollbar-thumb { background-color: #6c757d; border-radius: 4px; border: 2px solid #3d4451; }

/* Copy Code Button */
.code-block-wrapper { position: relative; background-color: #2e3440; border-radius: 8px; margin: 1em 0; padding: 1em; }
.message.model .text .code-block-wrapper pre { margin: 0; padding: 0; background-color: transparent; }
.copy-code-button {
  position: absolute; top: 0.75em; right: 0.75em; display: flex; align-items: center; gap: 0.5em;
  padding: 0.35em 0.6em; background-color: rgba(216, 222, 233, 0.1); color: #d8dee9;
  border: 1px solid rgba(216, 222, 233, 0.15); border-radius: 6px; font-size: 0.875rem;
  opacity: 0; transform: translateY(-5px); transition: all 0.2s; z-index: 10; cursor: pointer;
}
.code-block-wrapper:hover .copy-code-button { opacity: 1; transform: translateY(0); }
.copy-code-button:hover { background-color: rgba(216, 222, 233, 0.25); }
.copy-code-button.copied { background-color: #5e81ac; border-color: #5e81ac; color: #eceff4; }
</style>