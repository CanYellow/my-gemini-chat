import { ref, nextTick } from 'vue';
import type { Message, ChatConfig, ModelKey } from '../types';
import { calculateCost } from '../constants/pricing';
import { ChatApiService } from '../services/chatApi';

export function useChat() {
  const conversationHistory = ref<Message[]>([]);
  const isLoading = ref(false);
  const abortController = ref<AbortController | null>(null);
  
  const apiService = new ChatApiService(import.meta.env.VITE_API_BASE_URL || '');

  // Add a message to history
  const addMessage = (message: Message) => {
    conversationHistory.value.push(message);
  };

  // Remove a message from history
  const deleteMessage = (index: number) => {
    if (index >= 0 && index < conversationHistory.value.length) {
      conversationHistory.value.splice(index, 1);
    }
  };

  // Update the last message (used for streaming)
  const updateLastMessage = (text: string, append = true) => {
    const lastMsg = conversationHistory.value[conversationHistory.value.length - 1];
    if (lastMsg && lastMsg.role === 'model') {
       if (!append) {
           lastMsg.parts[0].text = text;
       } else {
           lastMsg.parts[0].text += text;
       }
    }
  };

  const stopGeneration = () => {
    if (abortController.value) {
      abortController.value.abort();
      // Logic handled in sendMessage catch block
    }
  };

  const sendMessage = async (input: string, config: ChatConfig, onStreamUpdate: () => void) => {
    if (!input.trim() || isLoading.value) return;

    isLoading.value = true;
    abortController.value = new AbortController();

    // 1. Add User Message
    addMessage({
      role: 'user',
      parts: [{ text: input }],
      sentChars: input.length
    });

    // 2. Add Placeholder Model Message
    addMessage({ role: 'model', parts: [{ text: '思考中...' }] });
    
    let isFirstChunk = true;
    let fullText = '';
    const lastMsgIndex = conversationHistory.value.length - 1;

    try {
      await apiService.sendMessageStream(
        conversationHistory.value.slice(0, -1), // Send history excluding the 'thinking' placeholder
        config,
        abortController.value.signal,
        {
          onChunk: (text) => {
            if (isFirstChunk) {
              updateLastMessage(text, false); // Replace 'Thinking...'
              isFirstChunk = false;
            } else {
              updateLastMessage(text, true);
            }
            fullText += text;
            onStreamUpdate();
          },
          onMetadata: (usage) => {
            const { inputCost, outputCost } = calculateCost(config.model, usage.promptTokenCount, usage.candidatesTokenCount);
            const msg = conversationHistory.value[lastMsgIndex];
            // Ensure message still exists (in case of race conditions with delete)
            if (msg) {
                msg.inputTokens = usage.promptTokenCount;
                msg.outputTokens = usage.candidatesTokenCount;
                msg.inputCost = inputCost;
                msg.outputCost = outputCost;
            }
          },
          onError: (err) => { throw err; }
        }
      );
      
      const msg = conversationHistory.value[lastMsgIndex];
      if (msg) {
        msg.receivedChars = fullText.length;
      }

    } catch (error: any) {
      // Re-fetch index as it might have changed if user deleted previous messages during stream (edge case)
      const currentLastMsg = conversationHistory.value[conversationHistory.value.length - 1];
      
      if (currentLastMsg) {
          if (error.name === 'AbortError') {
             const stopText = '\n\n**[生成已手动停止]**';
             if (currentLastMsg.parts[0].text === '思考中...') {
                 currentLastMsg.parts[0].text = '**[生成已手动停止]**';
             } else {
                 currentLastMsg.parts[0].text += stopText;
             }
          } else {
             currentLastMsg.parts[0].text = `**Error:** ${error.message || 'Unknown error'}`;
          }
      }
      onStreamUpdate();
    } finally {
      isLoading.value = false;
      abortController.value = null;
    }
  };

  return {
    conversationHistory,
    isLoading,
    sendMessage,
    stopGeneration,
    deleteMessage
  };
}