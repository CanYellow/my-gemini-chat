<template>
  <div :class="['message', message.role]">
    <div class="role">{{ message.role === 'user' ? 'You' : 'Model' }}</div>
    
    <div v-if="message.role === 'user'" class="text">{{ message.parts[0].text }}</div>
    <div v-else class="text" v-html="renderedContent"></div>

    <div class="message-footer">
      <div class="meta-info">
        <div v-if="message.sentChars !== undefined || message.receivedChars !== undefined" class="token-info">
          <span v-if="message.sentChars !== undefined">发送字符数: {{ message.sentChars }}</span>
          <span v-if="message.receivedChars !== undefined" class="received-chars">接收字符数: {{ message.receivedChars }}</span>
        </div>
        
        <div v-if="message.inputTokens !== undefined" class="token-info cost-info">
          <span title="输入 Token 数及费用 (USD)">
            消耗: {{ message.inputTokens }} tokens (≈ ${{ message.inputCost?.toFixed(6) }})
          </span>
          <span title="输出 Token 数及费用 (USD)" class="received-chars">
            生成: {{ message.outputTokens }} tokens (≈ ${{ message.outputCost?.toFixed(6) }})
          </span>
        </div>
      </div>

      <div class="actions">
        <button class="action-btn delete-btn" @click="$emit('delete')" title="删除消息">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          删除
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Message } from '../../types';
import { renderMarkdown } from '../../utils/markdown';

const props = defineProps<{ message: Message }>();
defineEmits<{ (e: 'delete'): void }>();

const renderedContent = computed(() => {
  return renderMarkdown(props.message.parts[0].text);
});
</script>

<style>
/* Global styles for markdown content are needed since v-html injects it */
.message { display: flex; flex-direction: column; margin-bottom: 15px; max-width: 95%; }
.message .role { font-weight: bold; font-size: 0.85em; margin-bottom: 4px; color: #555; }
.message .text { padding: 10px 15px; border-radius: 16px; line-height: 1.5; text-align: left; }

.message.user { align-self: flex-end; align-items: flex-end; }
.message.user .text { 
  background: #007bff; color: white; border-bottom-right-radius: 4px; 
  white-space: pre-wrap; overflow-wrap: break-word; word-break: break-word; 
}

.message.model { align-self: flex-start; align-items: flex-start; }
.message.model .text { 
  background: #e9ecef; color: #333; border-bottom-left-radius: 4px; 
  max-width: 100%; overflow-wrap: break-word; word-break: break-all; 
}

.message-footer {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-top: 5px;
  width: 100%;
  padding: 0 4px;
}

.meta-info { display: flex; flex-direction: column; }
.actions { margin-left: 10px; opacity: 0; transition: opacity 0.2s; }
.message:hover .actions { opacity: 1; }

.action-btn {
  background: none; border: none; cursor: pointer; color: #999; 
  padding: 4px 8px; font-size: 0.8em; display: flex; align-items: center; gap: 4px;
  border-radius: 4px; transition: all 0.2s;
}
.action-btn:hover { background-color: #f0f0f0; color: #555; }
.delete-btn:hover { background-color: #fee2e2; color: #dc3545; }

/* Markdown Specifics */
.message.model .text pre {
  background-color: #282c34; color: #abb2bf; padding: 0.8em; margin: 0.5em 0;
  border-radius: 8px; overflow-x: auto; font-size: 0.9em; white-space: pre;
}
.message.model .text code { font-family: 'Courier New', monospace; background-color: rgba(0,0,0,0.08); padding: 2px 5px; border-radius: 4px; }
.message.model .text pre > code { background-color: transparent; padding: 0; color: inherit; }
.message.model .text blockquote { border-left: 3px solid #ccc; padding-left: 1em; margin: 0.5em 0; color: #666; }
.message.model .text p { margin: 0.5em 0; }

.token-info { font-size: 0.75em; color: #888; display: flex; gap: 12px; }
.cost-info { color: #6c757d; margin-top: 3px; }

/* Scrollbars for code blocks */
.message.model .text pre::-webkit-scrollbar { height: 8px; background-color: #3d4451; }
.message.model .text pre::-webkit-scrollbar-thumb { background-color: #6c757d; border-radius: 4px; border: 2px solid #3d4451; }
.message.model .text pre::-webkit-scrollbar-thumb:hover { background-color: #9ea5ab; }

/* Code Block Copy Button Wrapper */
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