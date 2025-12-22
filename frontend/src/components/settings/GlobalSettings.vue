<template>
  <div class="settings-modal-overlay" @click.self="$emit('close')">
    <div class="settings-modal">
      <div class="settings-header">
        <h3>全局设置</h3>
        <button class="close-btn" @click="$emit('close')">✕</button>
      </div>
      
      <div class="settings-body">
        <div class="setting-item">
          <div class="setting-label">
            <label for="auto-collapse">自动折叠历史长消息</label>
            <span class="setting-desc">当开始新对话时，自动折叠旧的长消息。</span>
          </div>
          <div class="setting-control">
             <label class="switch">
              <input type="checkbox" id="auto-collapse" v-model="settings.enableAutoCollapse">
              <span class="slider round"></span>
            </label>
          </div>
        </div>

        <div class="setting-item">
          <div class="setting-label">
            <label for="collapse-threshold">折叠阈值 (行数)</label>
            <span class="setting-desc">超过此行数的消息将被折叠 (默认 5 行)。</span>
          </div>
          <div class="setting-control">
            <input 
              type="number" 
              id="collapse-threshold" 
              v-model.number="settings.collapseThreshold" 
              min="3" 
              max="50"
              class="number-input"
            >
          </div>
        </div>

        <div class="setting-divider"></div>

        <div class="setting-section-title">汇率设置 (USD -> CNY)</div>

        <div class="setting-item">
          <div class="setting-label">
            <label>汇率来源优先</label>
            <span class="setting-desc">选择优先使用公开 API 还是自定义汇率。</span>
          </div>
          <div class="setting-control radio-group">
            <label class="radio-label">
              <input type="radio" value="api" v-model="settings.exchangeRateSource">
              <span>公开 API</span>
            </label>
            <label class="radio-label">
              <input type="radio" value="custom" v-model="settings.exchangeRateSource">
              <span>自定义</span>
            </label>
          </div>
        </div>

        <div class="setting-item">
          <div class="setting-label">
            <label for="custom-rate">自定义/备用 汇率</label>
            <span class="setting-desc">如果 API 失败或选择自定义优先，将使用此值。</span>
          </div>
          <div class="setting-control">
            <input 
              type="number" 
              id="custom-rate" 
              v-model.number="settings.customExchangeRate" 
              step="0.01" 
              min="0" 
              class="number-input wide"
            >
          </div>
        </div>
      </div>

      <div class="settings-footer">
        <button class="action-btn" @click="$emit('close')">完成</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useSettings } from '../../composables/useSettings';

defineEmits<{ (e: 'close'): void }>();
const { settings } = useSettings();
</script>

<style scoped>
.settings-modal-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex; justify-content: center; align-items: center;
  z-index: 1000;
}

.settings-modal {
  background: white; width: 90%; max-width: 450px;
  border-radius: 12px; box-shadow: 0 5px 20px rgba(0,0,0,0.2);
  display: flex; flex-direction: column; overflow: hidden;
  max-height: 90vh;
}

.settings-header {
  padding: 15px 20px; border-bottom: 1px solid #eee;
  display: flex; justify-content: space-between; align-items: center;
  background-color: #f8f9fa;
  flex-shrink: 0;
}
.settings-header h3 { margin: 0; font-size: 1.1em; color: #333; }
.close-btn { background: none; border: none; font-size: 1.2em; color: #666; cursor: pointer; padding: 0 5px; }
.close-btn:hover { color: #000; }

.settings-body { padding: 20px; overflow-y: auto; }

.setting-item {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 20px; gap: 15px;
}
.setting-item:last-child { margin-bottom: 0; }

.setting-divider { height: 1px; background-color: #eee; margin: 15px 0; }
.setting-section-title { font-size: 0.9em; font-weight: bold; color: #555; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 0.5px; }

.setting-label { display: flex; flex-direction: column; gap: 4px; flex-grow: 1; }
.setting-label label { font-weight: 600; color: #333; font-size: 0.95em; }
.setting-desc { font-size: 0.8em; color: #888; }

.number-input {
  width: 60px; padding: 6px; border: 1px solid #ddd; border-radius: 6px;
  text-align: center; font-size: 1em;
}
.number-input.wide { width: 80px; }

.radio-group { display: flex; gap: 10px; }
.radio-label { display: flex; align-items: center; gap: 4px; font-size: 0.9em; cursor: pointer; }

.settings-footer {
  padding: 15px 20px; border-top: 1px solid #eee;
  display: flex; justify-content: flex-end;
  flex-shrink: 0;
}
.action-btn {
  background-color: #007bff; color: white; border: none;
  padding: 8px 16px; border-radius: 6px; cursor: pointer;
  font-size: 0.9em; transition: background 0.2s;
}
.action-btn:hover { background-color: #0056b3; }

/* Switch Toggle CSS */
.switch { position: relative; display: inline-block; width: 44px; height: 24px; flex-shrink: 0; }
.switch input { opacity: 0; width: 0; height: 0; }
.slider {
  position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0;
  background-color: #ccc; transition: .4s; border-radius: 24px;
}
.slider:before {
  position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px;
  background-color: white; transition: .4s; border-radius: 50%;
}
input:checked + .slider { background-color: #007bff; }
input:checked + .slider:before { transform: translateX(20px); }
</style>