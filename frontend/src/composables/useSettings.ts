import { reactive, watch } from 'vue';

export interface AppSettings {
  enableAutoCollapse: boolean;
  collapseThreshold: number;
  exchangeRateSource: 'api' | 'custom';
  customExchangeRate: number;
}

const defaultSettings: AppSettings = {
  enableAutoCollapse: true,
  collapseThreshold: 5,
  exchangeRateSource: 'api',
  customExchangeRate: 7.2,
};

// Initialize from localStorage or defaults
const stored = localStorage.getItem('gemini-chat-settings');
const initialState: AppSettings = stored ? { ...defaultSettings, ...JSON.parse(stored) } : defaultSettings;

// Ensure new fields are present if loaded from old local storage
if (!initialState.exchangeRateSource) initialState.exchangeRateSource = 'api';
if (!initialState.customExchangeRate) initialState.customExchangeRate = 7.2;

const settings = reactive<AppSettings>(initialState);

watch(settings, (newVal) => {
  localStorage.setItem('gemini-chat-settings', JSON.stringify(newVal));
}, { deep: true });

export function useSettings() {
  return { settings };
}