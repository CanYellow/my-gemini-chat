export interface MessagePart {
  text: string;
}

export interface Message {
  role: 'user' | 'model';
  parts: [MessagePart, ...MessagePart[]];
  sentChars?: number;
  receivedChars?: number;
  inputTokens?: number;
  outputTokens?: number;
  inputCost?: number;
  outputCost?: number;
}

export interface ModelPricingTier {
  threshold: number;
  input: number;
  output: number;
}

export interface ModelPricingFlat {
  input: number;
  output: number;
}

export type ModelPricing = 
  | { tier1: ModelPricingTier; tier2: ModelPricingTier } 
  | ModelPricingFlat;

export type ModelKey = 'gemini-3-pro-preview' | 'gemini-2.5-pro' | 'gemini-2.5-flash';

export interface ChatConfig {
  model: ModelKey;
  temperature: number;
  topP: number;
  contextLength: string;
}
