<template>
  <div id="header">
    <h1>我的 Gemini 客户端</h1>
    <div id="settings">
      <select :value="model" @input="$emit('update:model', ($event.target as HTMLSelectElement).value as any)">
        <option value="gemini-3-pro-preview">Gemini 3-Pro-Preview</option>
        <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
        <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
      </select>

      <select :value="contextLength" @input="$emit('update:contextLength', ($event.target as HTMLSelectElement).value)" title="选择上下文轮次">
        <option value="all">全部对话</option>
        <option value="20">最近10轮</option>
        <option value="12">最近6轮</option>
        <option value="8">最近4轮</option>
        <option value="4">最近2轮</option>
        <option value="2">最近1轮</option>
        <option value="0">无上下文</option>
      </select>

      <select :value="fontSize" @input="$emit('update:fontSize', ($event.target as HTMLSelectElement).value)" title="选择字体大小">
        <option value="12px">小</option>
        <option value="13px">默认</option>
        <option value="14px">中</option>
        <option value="16px">大</option>
      </select>

      <div class="slider-container" title="温度 (Temperature)">
        <label>T</label>
        <input type="range" min="0" max="1" step="0.05" :value="temperature" @input="$emit('update:temperature', parseFloat(($event.target as HTMLInputElement).value))">
        <span>{{ temperature.toFixed(2) }}</span>
      </div>

      <div class="slider-container" title="Top-P">
        <label>P</label>
        <input type="range" min="0" max="1" step="0.05" :value="topP" @input="$emit('update:topP', parseFloat(($event.target as HTMLInputElement).value))">
        <span>{{ topP.toFixed(2) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ModelKey } from '../../types';

defineProps<{
  model: ModelKey;
  contextLength: string;
  fontSize: string;
  temperature: number;
  topP: number;
}>();

defineEmits<{
  (e: 'update:model', val: ModelKey): void;
  (e: 'update:contextLength', val: string): void;
  (e: 'update:fontSize', val: string): void;
  (e: 'update:temperature', val: number): void;
  (e: 'update:topP', val: number): void;
}>();
</script>

<style scoped>
#header {
  display: flex; justify-content: space-between; align-items: center; padding: 0 20px;
  border-bottom: 1px solid #eee; background-color: #fafafa; flex-shrink: 0;
}
h1 { font-size: 1.1em; color: #444; margin: 0; padding: 15px 0; }
#settings { display: flex; align-items: center; gap: 10px; }
#settings select { padding: 5px 8px; border-radius: 6px; border: 1px solid #ddd; font-size: 0.9em; background-color: #fff; }
.slider-container { display: flex; align-items: center; gap: 5px; }
.slider-container label { font-weight: bold; font-size: 0.9em; color: #555; }
.slider-container input[type="range"] { width: 60px; margin: 0; cursor: pointer; }
.slider-container span { font-size: 0.85em; min-width: 28px; text-align: right; font-family: monospace; color: #333; }
</style>
