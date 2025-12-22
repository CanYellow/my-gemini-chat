<template>
  <div id="header">
    <div class="title-container">
      <input 
        type="text" 
        :value="title" 
        @input="$emit('update:title', ($event.target as HTMLInputElement).value)"
        class="editable-title"
        placeholder="输入标题..."
      />
      <span class="edit-icon">✎</span>
    </div>

    <div class="header-actions">
      <!-- Data Management -->
      <div class="data-controls">
         <button class="icon-btn" @click="triggerFileUpload" title="导入聊天记录">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
        </button>
        <button class="icon-btn" @click="$emit('export')" title="导出聊天记录">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        </button>
        <!-- Hidden Input -->
        <input 
          type="file" 
          ref="fileInputRef" 
          accept=".json" 
          style="display:none" 
          @change="handleFileChange"
        />
      </div>

      <!-- Global Collapse Controls -->
      <div class="collapse-controls">
        <button class="icon-btn" @click="$emit('collapseAll')" title="折叠所有历史消息">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 12 6 20 14"></polyline><line x1="4" y1="20" x2="20" y2="20"></line></svg>
        </button>
        <button class="icon-btn" @click="$emit('expandAll')" title="展开所有消息">
           <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 10 12 18 20 10"></polyline><line x1="4" y1="4" x2="20" y2="4"></line></svg>
        </button>
      </div>

      <div class="view-settings">
        <select 
          :value="fontSize" 
          @input="$emit('update:fontSize', ($event.target as HTMLSelectElement).value)" 
          title="选择字体大小"
          class="font-select"
        >
          <option value="12px">小字体</option>
          <option value="13px">默认</option>
          <option value="14px">中等</option>
          <option value="16px">大字体</option>
        </select>
      </div>

      <button class="icon-btn settings-btn" @click="$emit('openSettings')" title="全局设置">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

defineProps<{
  title: string;
  fontSize: string;
}>();

const emit = defineEmits<{
  (e: 'update:title', val: string): void;
  (e: 'update:fontSize', val: string): void;
  (e: 'openSettings'): void;
  (e: 'collapseAll'): void;
  (e: 'expandAll'): void;
  (e: 'export'): void;
  (e: 'restore', jsonContent: string): void;
}>();

const fileInputRef = ref<HTMLInputElement | null>(null);

const triggerFileUpload = () => {
  fileInputRef.value?.click();
};

const handleFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const content = e.target?.result as string;
    if (content) {
      emit('restore', content);
    }
    // Reset input so same file can be selected again if needed
    if (fileInputRef.value) fileInputRef.value.value = '';
  };
  reader.readAsText(file);
};
</script>

<style scoped>
#header {
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  padding: 15px 20px;
  border-bottom: 1px solid #eee; 
  background-color: #fff; 
  flex-shrink: 0;
}

.title-container {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-grow: 1;
  min-width: 0;
}

.editable-title {
  font-size: 1.2rem;
  font-weight: 600;
  color: #333;
  border: 1px solid transparent;
  background: transparent;
  padding: 4px 8px;
  border-radius: 4px;
  width: 100%;
  max-width: 300px;
  transition: all 0.2s;
  text-overflow: ellipsis;
}

.editable-title:hover {
  background-color: #f8f9fa;
  border-color: #eee;
}

.editable-title:focus {
  outline: none;
  background-color: #fff;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0,123,255,0.1);
}

.edit-icon {
  font-size: 0.9rem;
  color: #ccc;
  pointer-events: none;
}

.title-container:hover .edit-icon {
  color: #999;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 15px;
}

.data-controls, .collapse-controls {
  display: flex;
  gap: 5px;
  border-right: 1px solid #eee;
  padding-right: 15px;
}

.icon-btn {
  background: none; border: none; cursor: pointer;
  padding: 6px; border-radius: 6px; color: #555;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.2s;
}
.icon-btn:hover { background-color: #f0f0f0; color: #007bff; }

.font-select {
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid #ddd;
  font-size: 0.85rem;
  background-color: #fff;
  color: #555;
}
</style>