import { MODEL_NAME_MAPPING } from '../constants/pricing';
import type { Message, ChatConfig, MessagePart } from '../types';

export interface StreamCallbacks {
  onChunk: (part: MessagePart) => void;
  onMetadata: (usage: { promptTokenCount: number; candidatesTokenCount: number }) => void;
  onError: (error: Error) => void;
}

export class ChatApiService {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async sendMessageStream(
    history: Message[],
    config: ChatConfig,
    signal: AbortSignal,
    callbacks: StreamCallbacks
  ) {
    const apiModelName = MODEL_NAME_MAPPING[config.model] || config.model;
    
    // Filter history based on context length
    let payloadMessages = history;
    if (config.contextLength !== 'all') {
        const length = parseInt(config.contextLength, 10);
        if (length > 0) {
          payloadMessages = history.slice(-length);
        } else if (length === 0) {
          // If 0, only send the last message (the new user input) which is already appended to history
           payloadMessages = history.slice(-1);
        }
    }

    // Construct Payload: Sanitize parts to remove UI-only fields (like `name` in InlineData)
    const contents = payloadMessages.map(msg => ({
      role: msg.role,
      parts: msg.parts.map(p => {
        if (p.inlineData) {
          return {
            inlineData: {
              mimeType: p.inlineData.mimeType,
              data: p.inlineData.data
            }
          };
        }
        return { text: p.text };
      })
    }));

    const payload = {
        model: apiModelName,
        contents,
        generationConfig: {
            temperature: config.temperature,
            topP: config.topP,
        }
    };

    try {
        const response = await fetch(`${this.baseUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal,
        });

        if (!response.ok || !response.body) {
            let errorText = `HTTP Error: ${response.status}`;
            try {
                const errorData = await response.json();
                errorText = errorData.error?.message || JSON.stringify(errorData);
            } catch { /* ignore */ }
            throw new Error(errorText);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const jsonStr = line.substring(6).trim();
                    if (!jsonStr || jsonStr === '[DONE]') continue;
                    
                    try {
                        const data = JSON.parse(jsonStr);
                        const candidate = data.candidates?.[0];
                        
                        if (candidate?.content?.parts) {
                            // Iterate over ALL parts, not just the first one
                            for (const part of candidate.content.parts) {
                                callbacks.onChunk(part);
                            }
                        }
                        
                        if (data.usageMetadata) {
                            callbacks.onMetadata(data.usageMetadata);
                        }
                    } catch (e) {
                        console.error('JSON Parse Error:', jsonStr, e);
                    }
                }
            }
        }
    } catch (error) {
        callbacks.onError(error as Error);
    }
  }
}