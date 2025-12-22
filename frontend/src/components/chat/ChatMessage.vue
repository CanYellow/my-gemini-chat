<template>
  <div :class="['message', message.role]">
    <div class="role">{{ message.role === 'user' ? 'You' : 'Model' }}</div>
    
    <div 
      class="content-wrapper" 
      :class="{ 'collapsed': isCollapsed }"
      :style="collapsedStyle"
    >
      <div ref="contentRef" class="content-inner">
        <div v-if="message.role === 'user'" class="text">{{ message.parts[0].text }}</div>
        <div v-else class="text" v-html="renderedContent"></div>
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
        <div v-if="message.sentChars !== undefined || message.receivedChars !== undefined" class="token-info">
          <span v-if="message.sentChars !== undefined">{{ message.sentChars }}字</span>
          <span v-if="message.receivedChars !== undefined" class="received-chars">{{ message.receivedChars }}字</span>
        </div>
        
        <div v-if="message.inputTokens !== undefined" class="token-info">
          <span title="In">In:{{ message.inputTokens }}</span>
          <span title="Out">Out:{{ message.outputTokens }}</span>
        </div>

        <div v-if="totalCostDisplay" class="cost-info">
          <span>${{ totalCostDisplay }}</span>
        </div>
      </div>

      <!-- Actions -->
      <div class="actions">
        <!-- Branch Button: ALWAYS visible. Creates a new branch with THIS message as parent. -->
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

const props = defineProps<{ message: Message }>();
const emit = defineEmits<{ (e: 'delete', id: string): void }>();

const { settings } = useSettings();
const { createBranch, switchBranch } = useChat();

const contentRef = ref<HTMLElement | null>(null);
const isOverflowing = ref(false);

const renderedContent = computed(() => {
  return renderMarkdown(props.message.parts[0].text);
});

const totalCostDisplay = computed(() => {
  const inCost = props.message.inputCost || 0;
  const outCost = props.message.outputCost || 0;
  const total = inCost + outCost;
  return total > 0 ? total.toFixed(6) : null;
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
  // Use THIS message as the parent for the new branch
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

const checkOverflow = () => {
  if (!contentRef.value) return;
  const lineHeightEm = 1.6;
  const fullHeight = contentRef.value.scrollHeight;
  const fontSize = parseFloat(getComputedStyle(contentRef.value).fontSize || '13');
  const maxAllowedHeight = settings.collapseThreshold * lineHeightEm * fontSize;
  
  isOverflowing.value = fullHeight > maxAllowedHeight + 10;
};

watch(() => [props.message.parts[0].text, settings.collapseThreshold], () => {
  nextTick(checkOverflow);
}, { flush: 'post' });

onMounted(() => {
  setTimeout(checkOverflow, 100);
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
/* Branch Nav Styles */
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

/* Wrapper for collapse */
.content-wrapper {
  position: relative; border-radius: 16px; background-color: transparent; transition: max-height 0.3s ease;
}
.content-inner { overflow: hidden; }

/* User Message */
.message.user .content-wrapper { align-self: flex-end; }
.message.user .role { text-align: right; }
.message.user .text { 
  background: #007bff; color: white; padding: 10px 15px; 
  border-radius: 16px; border-bottom-right-radius: 4px; 
  white-space: pre-wrap; overflow-wrap: break-word; word-break: break-word; 
  line-height: 1.6; text-align: left;
}

/* Model Message */
.message.model .content-wrapper { align-self: flex-start; max-width: 100%; }
.message.model .role { text-align: left; }
.message.model .text { 
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
  display: flex; align-items: center; margin-top: 5px; width: 100%; padding: 0 4px; gap: 15px;
}

/* User Footer: Align Right (Actions on right) */
.message.user .message-footer {
  justify-content: flex-end;
}

/* Model Footer: Align Left (Actions on left) */
.message.model .message-footer {
  justify-content: flex-start;
}

.meta-info { display: flex; flex-direction: row; gap: 10px; font-size: 0.75em; color: #999; }
.token-info { display: flex; gap: 8px; }
.cost-info { color: #666; font-weight: 500; }

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