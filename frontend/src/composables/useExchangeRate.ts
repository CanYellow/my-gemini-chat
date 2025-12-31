import { ref, computed } from 'vue';
import { useSettings } from './useSettings';

// Singleton state for the API rate to avoid re-fetching in every component
const apiRate = ref<number | null>(null);
const isFetching = ref(false);

const fetchExchangeRate = async () => {
  if (apiRate.value !== null || isFetching.value) return;
  
  isFetching.value = true;
  try {
    // efficient, no-auth public API
    const response = await fetch('https://open.er-api.com/v6/latest/USD');
    const data = await response.json();
    if (data && data.rates && data.rates.CNY) {
      apiRate.value = data.rates.CNY;
    }
  } catch (error) {
    console.warn('Failed to fetch exchange rate:', error);
    // apiRate remains null, will fall back to custom/default
  } finally {
    isFetching.value = false;
  }
};

export function useExchangeRate() {
  const { settings } = useSettings();

  // Trigger fetch if needed
  if (settings.exchangeRateSource === 'api' && apiRate.value === null) {
    fetchExchangeRate();
  }

  const effectiveRate = computed(() => {
    if (settings.exchangeRateSource === 'custom') {
      return settings.customExchangeRate;
    }
    // If API source, try API rate, otherwise fall back to custom (as the default backup)
    // If custom is somehow 0 or invalid, use hard fallback 7.0
    return apiRate.value || settings.customExchangeRate || 7.0;
  });

  return {
    effectiveRate,
    apiRate, // exposed for debugging or UI display if needed
    fetchExchangeRate
  };
}