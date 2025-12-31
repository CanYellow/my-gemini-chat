import { ref, reactive, computed } from 'vue';
import type { Message, ChatConfig } from '../types';
import { calculateCost } from '../constants/pricing';
import { ChatApiService } from '../services/chatApi';

// Simple ID generator
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

// --- Shared State (Singleton) ---
const messageMap = reactive(new Map<string, Message>());
const rootId = ref<string | null>(null);
const isLoading = ref(false);
const currentGeneratingMessageId = ref<string | null>(null);
const abortController = ref<AbortController | null>(null);
const apiService = new ChatApiService(import.meta.env.VITE_API_BASE_URL || '');

// --- Compact Export Types ---
// [id, role(0/1), text, parentId, childrenIds, selectedChildIndex, timestamp, meta?]
type RoleEnum = 0 | 1; // 0: user, 1: model
type CompactMessage = [
  string,          // 0: id
  RoleEnum,        // 1: role
  string,          // 2: text content
  string | null,   // 3: parentId
  string[],        // 4: childrenIds
  number,          // 5: selectedChildIndex
  number,          // 6: timestamp
  Record<string, any>? // 7: metadata (optional)
];

interface CompactExport {
  v: number;        // Version
  r: string | null; // Root ID
  d: CompactMessage[]; // Data
}

export function useChat() {
  
  // Computed property to reconstruct the linear conversation history based on selected branches
  const conversationHistory = computed(() => {
    const history: Message[] = [];
    if (!rootId.value) return history;

    // Traverse from root using selectedChildIndex
    let currentId: string | null = rootId.value;
    
    while (currentId && messageMap.has(currentId)) {
      const msg: Message = messageMap.get(currentId)!;
      history.push(msg);
      
      if (msg.childrenIds.length > 0) {
        if (msg.selectedChildIndex < msg.childrenIds.length) {
          // Fix: Ensure undefined becomes null if index access fails (though guaranteed by check)
          currentId = msg.childrenIds[msg.selectedChildIndex] ?? null;
        } else {
          currentId = null;
        }
      } else {
        currentId = null;
      }
    }
    return history;
  });

  // Helper to create a new message node
  const createMessageNode = (
    role: 'user' | 'model', 
    text: string, 
    parentId: string | null
  ): Message => ({
    id: generateId(),
    role,
    parts: [{ text }],
    parentId,
    childrenIds: [],
    selectedChildIndex: 0,
    timestamp: Date.now()
  });

  const addMessage = (partialMsg: Partial<Message>) => {
    const parentId = partialMsg.parentId ?? null;
    const newMessage = {
      ...createMessageNode(partialMsg.role || 'user', partialMsg.parts?.[0].text || '', parentId),
      ...partialMsg
    };
    
    // Add to map first
    messageMap.set(newMessage.id, newMessage);

    // Retrieve the reactive proxy. This is CRITICAL. 
    // If we return 'newMessage' (the raw object), mutations won't trigger Vue's reactivity system.
    const reactiveMessage = messageMap.get(newMessage.id)!;

    if (parentId) {
      const parent = messageMap.get(parentId);
      if (parent) {
        parent.childrenIds.push(reactiveMessage.id);
        parent.selectedChildIndex = parent.childrenIds.length - 1;
      }
    } else {
      if (!rootId.value) {
        rootId.value = reactiveMessage.id;
      }
    }
    return reactiveMessage;
  };

  const deleteMessage = (id: string) => {
    const msg = messageMap.get(id);
    if (!msg) return;

    const deleteSubtree = (nodeId: string) => {
      const node = messageMap.get(nodeId);
      if (node) {
        node.childrenIds.forEach(deleteSubtree);
        messageMap.delete(nodeId);
      }
    };

    if (msg.parentId) {
      const parent = messageMap.get(msg.parentId);
      if (parent) {
        const index = parent.childrenIds.indexOf(id);
        if (index !== -1) {
          parent.childrenIds.splice(index, 1);
          if (parent.selectedChildIndex >= parent.childrenIds.length) {
            parent.selectedChildIndex = Math.max(0, parent.childrenIds.length - 1);
          }
        }
      }
    } else {
      if (rootId.value === id) {
        rootId.value = null;
      }
    }

    deleteSubtree(id);
  };

  const stopGeneration = () => {
    if (abortController.value) {
      abortController.value.abort();
    }
  };

  const createBranch = (parentId: string) => {
    const parent = messageMap.get(parentId);
    if (parent) {
      parent.selectedChildIndex = parent.childrenIds.length;
    }
  };

  const switchBranch = (parentId: string, index: number) => {
    const parent = messageMap.get(parentId);
    if (parent) {
      if (index >= 0 && index <= parent.childrenIds.length) {
         parent.selectedChildIndex = index;
      }
    }
  };

  // Navigate to a specific message by updating the selectedChildIndex of all ancestors
  const navigateToMessage = (targetId: string) => {
    let curr = messageMap.get(targetId);
    
    while (curr && curr.parentId) {
      const parent = messageMap.get(curr.parentId);
      if (parent) {
        const index = parent.childrenIds.indexOf(curr.id);
        if (index !== -1) {
          parent.selectedChildIndex = index;
        }
        curr = parent;
      } else {
        break; 
      }
    }
  };

  const sendMessage = async (input: string, config: ChatConfig, onStreamUpdate: () => void) => {
    if (!input.trim() || isLoading.value) return;

    isLoading.value = true;
    abortController.value = new AbortController();

    const history = conversationHistory.value;
    const parentMsg = history.length > 0 ? history[history.length - 1] : null;
    const parentId = parentMsg ? parentMsg.id : null;

    // 1. Add User Message
    const userMsg = addMessage({
      role: 'user',
      parts: [{ text: input }],
      sentChars: input.length,
      parentId
    });

    // 2. Add Placeholder Model Message
    const modelMsg = addMessage({ 
      role: 'model', 
      parts: [{ text: '思考中...' }],
      parentId: userMsg.id
    });
    
    currentGeneratingMessageId.value = modelMsg.id;
    
    let isFirstChunk = true;
    let fullText = '';

    try {
      const buildHistoryForMsg = (msg: Message): Message[] => {
        const path: Message[] = [msg];
        let curr = msg;
        while (curr.parentId) {
          const parent = messageMap.get(curr.parentId);
          if (parent) {
            path.unshift(parent);
            curr = parent;
          } else {
            break;
          }
        }
        return path;
      };

      const contextHistory = buildHistoryForMsg(userMsg);

      await apiService.sendMessageStream(
        contextHistory,
        config,
        abortController.value.signal,
        {
          onChunk: (text) => {
            // Because modelMsg is the reactive proxy (thanks to the fix in addMessage),
            // this mutation triggers Vue's reactivity system.
            if (isFirstChunk) {
              modelMsg.parts[0].text = text;
              isFirstChunk = false;
            } else {
              modelMsg.parts[0].text += text;
            }
            fullText += text;
            onStreamUpdate();
          },
          onMetadata: (usage) => {
            const { inputCost, outputCost } = calculateCost(config.model, usage.promptTokenCount, usage.candidatesTokenCount);
            modelMsg.inputTokens = usage.promptTokenCount;
            modelMsg.outputTokens = usage.candidatesTokenCount;
            modelMsg.inputCost = inputCost;
            modelMsg.outputCost = outputCost;
          },
          onError: (err) => { throw err; }
        }
      );
      
      modelMsg.receivedChars = fullText.length;

    } catch (error: any) {
      if (error.name === 'AbortError') {
         const stopText = '\n\n**[生成已手动停止]**';
         if (modelMsg.parts[0].text === '思考中...') {
             modelMsg.parts[0].text = '**[生成已手动停止]**';
         } else {
             modelMsg.parts[0].text += stopText;
         }
      } else {
         modelMsg.parts[0].text = `**Error:** ${error.message || 'Unknown error'}`;
      }
      onStreamUpdate();
    } finally {
      isLoading.value = false;
      currentGeneratingMessageId.value = null;
      abortController.value = null;
    }
  };

  /**
   * Serializes the entire chat history into a highly compact JSON string.
   * Structure: { v: 1, r: rootId, d: [Array of CompactMessage] }
   */
  const exportState = (): string => {
    if (!rootId.value) return '';
    
    const messages: CompactMessage[] = [];
    
    for (const msg of messageMap.values()) {
        const role: RoleEnum = msg.role === 'user' ? 0 : 1;
        
        // Metadata: compact short keys
        const meta: Record<string, any> = {};
        if (msg.inputTokens) meta.it = msg.inputTokens;
        if (msg.outputTokens) meta.ot = msg.outputTokens;
        if (msg.inputCost) meta.ic = msg.inputCost;
        if (msg.outputCost) meta.oc = msg.outputCost;
        if (msg.collapsed) meta.c = 1;
        
        const compact: CompactMessage = [
            msg.id,
            role,
            msg.parts[0].text,
            msg.parentId,
            msg.childrenIds,
            msg.selectedChildIndex,
            msg.timestamp,
        ];
        
        if (Object.keys(meta).length > 0) {
            compact.push(meta);
        }
        
        messages.push(compact);
    }

    const exportData: CompactExport = {
        v: 1,
        r: rootId.value,
        d: messages
    };
    
    return JSON.stringify(exportData);
  };

  /**
   * Restores chat history from a JSON string.
   */
  const importState = (json: string) => {
      try {
          const data = JSON.parse(json) as CompactExport;
          // Simple version check
          if (data.v !== 1) throw new Error('Unsupported file version');
          if (!data.d || !Array.isArray(data.d)) throw new Error('Invalid data format');
          
          // Clear current state
          messageMap.clear();
          rootId.value = null;
          
          data.d.forEach(m => {
              // Destructure compact array
              const [id, roleEnum, text, parentId, childrenIds, selectedChildIndex, timestamp, meta] = m;
              
              const msg: Message = {
                  id,
                  role: roleEnum === 0 ? 'user' : 'model',
                  parts: [{ text }],
                  parentId,
                  childrenIds,
                  selectedChildIndex,
                  timestamp,
                  // Rehydrate metadata
                  inputTokens: meta?.it,
                  outputTokens: meta?.ot,
                  inputCost: meta?.ic,
                  outputCost: meta?.oc,
                  collapsed: !!meta?.c,
                  // Recalculate basic chars for UI
                  sentChars: roleEnum === 0 ? text.length : undefined,
                  receivedChars: roleEnum === 1 ? text.length : undefined
              };
              
              messageMap.set(id, msg);
          });
          
          rootId.value = data.r;
          
      } catch (e) {
          console.error('Import failed', e);
          throw e; // Propagate to UI
      }
  };

  return {
    conversationHistory,
    isLoading,
    currentGeneratingMessageId,
    sendMessage,
    stopGeneration,
    deleteMessage,
    createBranch,
    switchBranch,
    navigateToMessage,
    exportState,
    importState
  };
}