<template>
  <div class="chat-settings">
    <div class="sliders">
      <div class="slider-container" title="温度 (Temperature)">
        <label>Temp</label>
        <input 
          type="range" 
          min="0" 
          max="1" 
          step="0.05" 
          :value="temperature" 
          @input="$emit('update:temperature', parseFloat(($event.target as HTMLInputElement).value))"
        >
        <span class="value">{{ temperature.toFixed(2) }}</span>
      </div>

      <div class="slider-container" title="Top-P">
        <label>TopP</label>
        <input 
          type="range" 
          min="0" 
          max="1" 
          step="0.05" 
          :value="topP" 
          @input="$emit('update:topP', parseFloat(($event.target as HTMLInputElement).value))"
        >
        <span class="value">{{ topP.toFixed(2) }}</span>
      </div>
    </div>

    <div class="selectors">
      <select 
        :value="contextLength" 
        @input="$emit('update:contextLength', ($event.target as HTMLSelectElement).value)" 
        title="选择上下文轮次"
        class="setting-select"
      >
        <option value="all">全部对话</option>
        <option value="20">最近10轮</option>
        <option value="12">最近6轮</option>
        <option value="8">最近4轮</option>
        <option value="4">最近2轮</option>
        <option value="2">最近1轮</option>
        <option value="0">无上下文 (单轮)</option>
      </select>

      <select 
        :value="model" 
        @input="$emit('update:model', ($event.target as HTMLSelectElement).value as any)"
        class="setting-select model-select"
      >
        <option value="gemini-3-pro-preview">Gemini 3-Pro-Preview</option>
        <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
        <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
      </select>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ModelKey } from '../../types';

defineProps<{
  model: ModelKey;
  contextLength: string;
  temperature: number;
  topP: number;
}>();

defineEmits<{
  (e: 'update:model', val: ModelKey): void;
  (e: 'update:contextLength', val: string): void;
  (e: 'update:temperature', val: number): void;
  (e: 'update:topP', val: number): void;
}>();
</script>

<style scoped>
.chat-settings {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background-color: #f8f9fa;
  border-top: 1px solid #eee;
  flex-shrink: 0;
  gap: 15px;
  flex-wrap: wrap;
}

.sliders {
  display: flex;
  gap: 15px;
  align-items: center;
}

.slider-container {
  display: flex;
  align-items: center;
  gap: 6px;
}

.slider-container label {
  font-size: 0.75rem;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
}

.slider-container input[type="range"] {
  width: 70px;
  margin: 0;
  cursor: pointer;
  accent-color: #007bff;
}

.slider-container .value {
  font-size: 0.75rem;
  font-family: monospace;
  color: #333;
  width: 24px;
  text-align: right;
}

.selectors {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-left: auto; /* Pushes selectors to the right */
}

.setting-select {
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid #ddd;
  font-size: 0.85rem;
  background-color: white;
  color: #333;
  cursor: pointer;
  outline: none;
  transition: border-color 0.2s;
}

.setting-select:hover, .setting-select:focus {
  border-color: #007bff;
}

.model-select {
  font-weight: 500;
  color: #0056b3;
  border-color: #b8daff;
}
</style>