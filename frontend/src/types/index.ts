export interface InlineData {
  mimeType: string;
  data: string;
  name?: string;
}

export interface MessagePart {
  text?: string;
  inlineData?: InlineData;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  parts: MessagePart[]; // Changed from fixed tuple to array
  
  // Tree structure
  parentId: string | null;
  childrenIds: string[];
  selectedChildIndex: number; // The index in childrenIds that is currently active

  // Metadata
  sentChars?: number;
  receivedChars?: number;
  inputTokens?: number;
  outputTokens?: number;
  inputCost?: number;
  outputCost?: number;
  collapsed?: boolean;
  timestamp: number;
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