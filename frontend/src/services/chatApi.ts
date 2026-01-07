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
    // Ensure we use the correct model name from mapping or config
    const apiModelName = MODEL_NAME_MAPPING[config.model] || config.model;
    
    // Strict context length filtering
    let payloadMessages = history;
    const lengthStr = String(config.contextLength); // Normalize to string for comparison

    if (lengthStr !== 'all') {
        const historyMsgCount = parseInt(lengthStr, 10);
        
        if (!isNaN(historyMsgCount) && historyMsgCount >= 0) {
            // CRITICAL FIX:
            // The config.contextLength (e.g. "2") represents the number of HISTORY messages to include (1 round = 2 msgs).
            // But the 'history' array passed here ALREADY includes the CURRENT message at the very end.
            // So if user wants "1 Round" (2 history msgs), we need 2 history + 1 current = 3 total messages.
            // Slice logic: slice(-3) gives the last 3 items.
            const totalMessagesToKeep = historyMsgCount + 1;
            payloadMessages = history.slice(-totalMessagesToKeep);
        }
    }

    // Construct Payload
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
        // Fallback for text to ensure it's never undefined/null
        return { text: p.text || '' }; 
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