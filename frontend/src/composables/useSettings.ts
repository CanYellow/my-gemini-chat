import { reactive, watch } from 'vue';

export interface AppSettings {
  enableAutoCollapse: boolean;
  collapseThreshold: number;
}

const defaultSettings: AppSettings = {
  enableAutoCollapse: true,
  collapseThreshold: 5,
};

// Initialize from localStorage or defaults
const stored = localStorage.getItem('gemini-chat-settings');
const initialState: AppSettings = stored ? { ...defaultSettings, ...JSON.parse(stored) } : defaultSettings;

const settings = reactive<AppSettings>(initialState);

watch(settings, (newVal) => {
  localStorage.setItem('gemini-chat-settings', JSON.stringify(newVal));
}, { deep: true });

export function useSettings() {
  return { settings };
}
