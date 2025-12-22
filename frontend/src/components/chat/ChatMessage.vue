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

    <div class="message-footer">
      <div class="meta-info">
        <div v-if="message.sentChars !== undefined || message.receivedChars !== undefined" class="token-info">
          <span v-if="message.sentChars !== undefined">发送: {{ message.sentChars }}字</span>
          <span v-if="message.receivedChars !== undefined" class="received-chars">接收: {{ message.receivedChars }}字</span>
        </div>
        
        <div v-if="message.inputTokens !== undefined" class="token-info cost-info">
          <span title="输入 Token">In: {{ message.inputTokens }}</span>
          <span title="输出 Token">Out: {{ message.outputTokens }}</span>
        </div>
      </div>

      <div class="actions">
        <button 
          v-if="canCollapse"
          class="action-btn toggle-btn" 
          @click="toggleCollapse" 
          :title="isCollapsed ? '展开' : '折叠'"
        >
          <span v-if="isCollapsed">▼ 展开</span>
          <span v-else>▲ 折叠</span>
        </button>

        <button class="action-btn delete-btn" @click="$emit('delete')" title="删除消息">
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

const props = defineProps<{ message: Message }>();
const emit = defineEmits<{ (e: 'delete'): void }>();

const { settings } = useSettings();
const contentRef = ref<HTMLElement | null>(null);
const isOverflowing = ref(false);

const renderedContent = computed(() => {
  return renderMarkdown(props.message.parts[0].text);
});

// Check if content height exceeds the threshold
const checkOverflow = () => {
  if (!contentRef.value) return;
  // Calculate max height in pixels: threshold lines * 1.6em line-height * 13px base font (approx)
  // We use CSS logic for the constraint, here we just check if scrollHeight is significantly larger than expected collapsed height
  // A rough estimate or letting CSS handle the visual and JS handle the button availability.
  // Better: Apply the collapsed class tentatively to measure? No.
  // Let's assume line-height is 1.6em.
  const lineHeightEm = 1.6;
  // We can't easily get exact pixel height of 'em' without computing style, but we can approximate or use ResizeObserver.
  // Let's use a simpler heuristic: Measure full height vs Max height.
  
  const fullHeight = contentRef.value.scrollHeight;
  const fontSize = parseFloat(getComputedStyle(contentRef.value).fontSize || '13');
  const maxAllowedHeight = settings.collapseThreshold * lineHeightEm * fontSize;
  
  isOverflowing.value = fullHeight > maxAllowedHeight + 10; // +10px buffer
};

// Re-check on content change or setting change
watch(() => [props.message.parts[0].text, settings.collapseThreshold], () => {
  nextTick(checkOverflow);
}, { flush: 'post' });

onMounted(() => {
  // Add a small delay to ensure images/layout render (though pure text is fast)
  setTimeout(checkOverflow, 100);
});

// Sync prop state
const isCollapsed = computed(() => {
  return props.message.collapsed && isOverflowing.value;
});

const canCollapse = computed(() => isOverflowing.value);

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

<style>
/* Global styles for markdown content are needed since v-html injects it */
.message { display: flex; flex-direction: column; margin-bottom: 15px; max-width: 95%; }
.message .role { font-weight: bold; font-size: 0.85em; margin-bottom: 4px; color: #555; }

/* Wrapper for collapse functionality */
.content-wrapper {
  position: relative;
  border-radius: 16px;
  background-color: transparent;
  transition: max-height 0.3s ease;
}

.content-inner {
  overflow: hidden;
}

/* User Message specific */
.message.user .content-wrapper { align-self: flex-end; }
.message.user .text { 
  background: #007bff; color: white; padding: 10px 15px; border-radius: 16px; border-bottom-right-radius: 4px; 
  white-space: pre-wrap; overflow-wrap: break-word; word-break: break-word; line-height: 1.6;
}

/* Model Message specific */
.message.model .content-wrapper { align-self: flex-start; max-width: 100%; }
.message.model .text { 
  background: #e9ecef; color: #333; padding: 10px 15px; border-radius: 16px; border-bottom-left-radius: 4px; 
  max-width: 100%; overflow-wrap: break-word; word-break: break-all; line-height: 1.6;
}

/* Collapsed State */
.content-wrapper.collapsed .content-inner {
  max-height: calc(1.6em * var(--max-lines, 5)); 
}

.content-wrapper.collapsed .collapse-overlay {
  position: absolute; bottom: 0; left: 0; right: 0; height: 40px;
  border-bottom-left-radius: 4px; border-bottom-right-radius: 16px; /* Model style default */
  background: linear-gradient(to bottom, rgba(233,236,239,0), rgba(233,236,239,1));
  pointer-events: none;
}
.message.user .content-wrapper.collapsed .collapse-overlay {
  border-bottom-left-radius: 16px; border-bottom-right-radius: 4px;
  background: linear-gradient(to bottom, rgba(0,123,255,0), rgba(0,123,255,1));
}

/* Footer & Actions */
.message-footer {
  display: flex; justify-content: space-between; align-items: center;
  margin-top: 5px; width: 100%; padding: 0 4px;
}

.meta-info { display: flex; flex-direction: row; gap: 10px; font-size: 0.75em; color: #999; }
.token-info { display: flex; gap: 8px; }

.actions { display: flex; align-items: center; gap: 4px; opacity: 0; transition: opacity 0.2s; }
.message:hover .actions { opacity: 1; }

.action-btn {
  background: none; border: none; cursor: pointer; color: #999; 
  padding: 4px 6px; font-size: 0.8em; display: flex; align-items: center; gap: 2px;
  border-radius: 4px; transition: all 0.2s;
}
.action-btn:hover { background-color: #f0f0f0; color: #555; }
.delete-btn:hover { background-color: #fee2e2; color: #dc3545; }
.toggle-btn { color: #007bff; font-weight: 500; }
.toggle-btn:hover { background-color: #e7f1ff; color: #0056b3; }

/* Markdown Styles (Preserved) */
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
