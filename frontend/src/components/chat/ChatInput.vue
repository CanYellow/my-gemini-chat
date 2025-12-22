<template>
  <div id="input-area">
    <textarea
      id="message-input"
      placeholder="在这里输入消息... (Shift+Enter 换行)"
      rows="1"
      v-model="inputModel"
      @keydown.enter.prevent.exact="handleEnter"
      @keydown.shift.enter.prevent
      @keyup.shift.enter="inputModel += '\n'; adjustHeight($event)"
      @input="adjustHeight"
      :disabled="isLoading"
      ref="textareaRef"
    ></textarea>
    <button
      id="send-button"
      :title="isLoading ? '停止生成' : '发送'"
      @click="isLoading ? $emit('stop') : handleSend()"
      :disabled="!inputModel.trim() && !isLoading"
      :class="{ 'stop-button': isLoading }"
    >
      <span v-if="isLoading">✕</span>
      <span v-else>➤</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue';

const props = defineProps<{ isLoading: boolean }>();
const emit = defineEmits<{
  (e: 'send', text: string): void;
  (e: 'stop'): void;
}>();

const inputModel = ref('');
const textareaRef = ref<HTMLTextAreaElement | null>(null);

const handleSend = () => {
  const text = inputModel.value;
  if (!text.trim()) return;
  emit('send', text);
  inputModel.value = '';
  // Reset height
  if (textareaRef.value) textareaRef.value.style.height = 'auto';
};

const handleEnter = () => {
  if (!props.isLoading) handleSend();
};

const adjustHeight = (event: Event) => {
  const textarea = event.target as HTMLTextAreaElement;
  const isScrolledToBottom = textarea.scrollHeight - textarea.scrollTop - textarea.clientHeight < 5;
  
  textarea.style.height = 'auto';
  const newHeight = Math.min(textarea.scrollHeight, 120);
  textarea.style.height = `${newHeight}px`;

  if (isScrolledToBottom) {
    textarea.scrollTop = textarea.scrollHeight;
  }
};

const focus = () => {
  nextTick(() => textareaRef.value?.focus());
};

defineExpose({ focus });
</script>

<style scoped>
#input-area {
  display: flex; align-items: flex-end; padding: 12px; border-top: 1px solid #eee;
  background-color: #fafafa; flex-shrink: 0;
}
#message-input {
  flex-grow: 1; border: 1px solid #ccc; border-radius: 18px; padding: 10px 15px;
  resize: none; font-size: 1em; font-family: inherit; line-height: 1.4; max-height: 120px; overflow-y: auto;
}
#message-input:focus { outline: none; border-color: #007bff; box-shadow: 0 0 0 2px rgba(0,123,255,0.25); }
#send-button {
  background: #007bff; color: white; border: none; border-radius: 50%; width: 44px; height: 44px;
  margin-left: 10px; cursor: pointer; font-size: 1.4em; display: flex; justify-content: center;
  align-items: center; transition: background-color 0.2s; flex-shrink: 0;
}
#send-button.stop-button { background-color: #dc3545; }
#send-button.stop-button:hover { background-color: #c82333; }
#send-button:hover { background: #0056b3; }
#send-button:disabled { background-color: #a0a0a0; cursor: not-allowed; }
</style>
