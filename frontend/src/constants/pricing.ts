import type { ModelKey, ModelPricing } from '../types';

export const MODEL_PRICING: Record<ModelKey, ModelPricing> = {
  'gemini-3-pro-preview': {
    tier1: { threshold: 200000, input: 2.00, output: 12.00 },
    tier2: { threshold: 200000, input: 4.00, output: 18.00 },
  },
  'gemini-2.5-pro': {
    tier1: { threshold: 200000, input: 1.25, output: 10.00 },
    tier2: { threshold: 200000, input: 2.50, output: 15.00 },
  },
  'gemini-2.5-flash': {
    input: 0.30,
    output: 2.50,
  },
};

export const MODEL_NAME_MAPPING: Record<string, string> = {
  'gemini-3-pro-preview': 'gemini-3-pro-preview',
  'gemini-2.5-pro': 'gemini-2.5-pro',
  'gemini-2.5-flash': 'gemini-2.5-flash',
};

export const calculateCost = (model: ModelKey, inputTokens: number, outputTokens: number) => {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return { inputCost: 0, outputCost: 0 };

  let inputPrice = 0;
  let outputPrice = 0;

  if ('tier1' in pricing) {
    if (inputTokens <= pricing.tier1.threshold) {
      inputPrice = pricing.tier1.input;
      outputPrice = pricing.tier1.output;
    } else {
      inputPrice = pricing.tier2.input;
      outputPrice = pricing.tier2.output;
    }
  } else {
    inputPrice = pricing.input;
    outputPrice = pricing.output;
  }

  const inputCost = (inputTokens / 1_000_000) * inputPrice;
  const outputCost = (outputTokens / 1_000_000) * outputPrice;

  return { inputCost, outputCost };
};