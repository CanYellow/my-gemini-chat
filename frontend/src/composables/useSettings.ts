import { reactive, watch } from 'vue';

export interface AppSettings {
  enableAutoCollapse: boolean;
  collapseThreshold: number;
  exchangeRateSource: 'api' | 'custom';
  customExchangeRate: number;
  maxFileSizeKB: number;
  allowedExtensions: string;
}

const defaultSettings: AppSettings = {
  enableAutoCollapse: true,
  collapseThreshold: 5,
  exchangeRateSource: 'api',
  customExchangeRate: 7.2,
  maxFileSizeKB: 17, // Default 17KB as requested
  allowedExtensions: '.jpg,.jpeg,.png,.gif,.webp,.pdf,.txt,.md,.json,.js,.ts,.html,.css,.csv',
};

// Initialize from localStorage or defaults
const stored = localStorage.getItem('gemini-chat-settings');
const initialState: AppSettings = stored ? { ...defaultSettings, ...JSON.parse(stored) } : defaultSettings;

// Ensure new fields are present if loaded from old local storage
if (!initialState.exchangeRateSource) initialState.exchangeRateSource = 'api';
if (!initialState.customExchangeRate) initialState.customExchangeRate = 7.2;
if (initialState.maxFileSizeKB === undefined) initialState.maxFileSizeKB = defaultSettings.maxFileSizeKB;
if (initialState.allowedExtensions === undefined) initialState.allowedExtensions = defaultSettings.allowedExtensions;

const settings = reactive<AppSettings>(initialState);

watch(settings, (newVal) => {
  localStorage.setItem('gemini-chat-settings', JSON.stringify(newVal));
}, { deep: true });

export function useSettings() {
  return { settings };
}