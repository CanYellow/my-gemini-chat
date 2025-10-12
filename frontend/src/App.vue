<template>
  <div id="app">
      <!-- 使用 template 标签和 v-if 来包裹整个聊天界面 -->
    <template v-if="isAuthenticated">
    <div id="header">
      <h1>我的 Gemini 客户端</h1>
      <div id="settings">
        <!-- 注意：模型名称已更新以匹配价格表中的键名 -->
		<select v-model="selectedModel">
		  <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
		  <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
		</select>
        <select v-model="contextLength" title="选择上下文轮次">
          <option value="all">全部对话</option>
          <option value="20">最近10轮</option>
          <option value="12">最近6轮</option>
          <option value="8">最近4轮</option>
          <option value="4">最近2轮</option>
          <option value="0">无上下文</option>
        </select>
      </div>
    </div>
    <div id="chat-window" ref="chatWindowRef" @scroll="handleScroll">
      <div v-for="(message, index) in conversationHistory" :key="index" :class="['message', message.role]">
        <div class="role">{{ message.role === 'user' ? 'You' : 'Model' }}</div>
        <div class="text" v-if="message.role === 'user'">{{ message.parts[0].text }}</div>
        <div class="text" v-else v-html="renderMarkdown(message.parts[0].text)"></div>
        <!-- 原始字符统计信息 -->
        <div v-if="message.sentChars !== undefined || message.receivedChars !== undefined" class="token-info">
          <span v-if="message.sentChars !== undefined">发送字符数: {{ message.sentChars }}</span>
          <span v-if="message.receivedChars !== undefined" class="received-chars">接收字符数: {{ message.receivedChars }}</span>
        </div>
        <!-- 新增：Token 和费用信息 -->
        <div v-if="message.inputTokens !== undefined" class="token-info cost-info">
          <span title="输入 Token 数及费用 (USD)">
            消耗: {{ message.inputTokens }} tokens (≈ ${{ message.inputCost?.toFixed(6) }})
          </span>
          <span title="输出 Token 数及费用 (USD)" class="received-chars">
            生成: {{ message.outputTokens }} tokens (≈ ${{ message.outputCost?.toFixed(6) }})
          </span>
        </div>
      </div>
    </div>
	<button v-if="showCompletionHint" @click="forceScrollToBottom" class="completion-hint" title="滚动到底部">
	  ↓ 新消息
	</button>

    <div id="input-area">
      <textarea
        id="message-input"
        placeholder="在这里输入消息... (Shift+Enter 换行)"
        rows="1"
        v-model="userInput"
        @keydown.enter.prevent.exact="sendMessage"
        @keydown.shift.enter.prevent
        @keyup.shift.enter="userInput += '\n'; autoResizeTextarea($event)"
        @input="autoResizeTextarea"
        :disabled="isLoading"
        ref="textareaRef"
      ></textarea>
      <button
        id="send-button"
        :title="isLoading ? '停止生成' : '发送'"
        @click="isLoading ? stopGeneration() : sendMessage()"
        :disabled="!userInput.trim() && !isLoading"
        :class="{ 'stop-button': isLoading }"
      >
        <span v-if="isLoading">✕</span>
        <span v-else>➤</span>
      </button>
    </div>
    </template> <!-- 这是 v-if="isAuthenticated" 的结束标签 -->   

    <!-- 新增：当验证失败时，显示这个访问受限的界面 -->
    <div v-else class="access-denied">
      <h2>🔒 访问受限</h2>
      <p>请通过包含有效访问令牌的链接访问此页面。</p>
      <p class="warning">
        <strong>重要:</strong> 如果您的令牌包含 <code>#</code>, <code>+</code>, <code>&</code>, <code>%</code> 等特殊字符,
        您必须使用 <strong>URL编码后</strong> 的令牌。
      </p>
      <p>
        <strong>错误示例:</strong> <code>.../?token=my#secret+key</code><br>
        <strong>正确示例:</strong> <code>.../?token=my%23secret%2Bkey</code>
      </p>
    </div>
        
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted } from 'vue';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

// --- 新增：价格和汇率配置 ---
// 价格来源: Google AI Platform 定价 (USD per 1 million tokens)
// 注意：这里我们只处理了“标准”使用场景下的文本输入定价。
const MODEL_PRICING = {
  'gemini-2.5-pro': {
    // 价格分层，以输入 token 数为依据
    tier1: {
      threshold: 200000, // 阈值：<= 200k tokens
      input: 1.25,
      output: 10.00,
    },
    tier2: { // > 200k tokens
      input: 2.50,
      output: 15.00,
    },
  },
  'gemini-2.5-flash': {
    // 固定价格
    input: 0.30,
    output: 2.50,
  },
};

// 兼容旧的模型名称，映射到新的
const MODEL_NAME_MAPPING: { [key: string]: keyof typeof MODEL_PRICING } = {
  'gemini-2.5-pro': 'gemini-2.5-pro',
  'gemini-2.5-flash': 'gemini-2.5-flash',
}


// --- 类型定义 (已扩展) ---
interface MessagePart {
  text: string;
}
interface Message {
  role: 'user' | 'model';
  // 将 parts 的类型从 MessagePart[] 修改为 [MessagePart, ...MessagePart[]]
  // 这表示 parts 数组至少包含一个 MessagePart 元素
  parts: [MessagePart, ...MessagePart[]];
  sentChars?: number;
  receivedChars?: number;
  // 新增：用于存储 token 和费用信息
  inputTokens?: number;
  outputTokens?: number;
  inputCost?: number;
  outputCost?: number;
}

// --- 响应式状态 ---
const userInput = ref('');
const conversationHistory = ref<Message[]>([]);
const selectedModel = ref<keyof typeof MODEL_PRICING>('gemini-2.5-flash'); // 默认模型
const contextLength = ref('12'); // 默认最近6轮
const isLoading = ref(false);
const shouldAutoScroll = ref(true); // 新增：用于控制当前消息是否自动滚动
const abortController = ref<AbortController | null>(null);
const showCompletionHint = ref(false);
const isAuthenticated = ref(false); // 新增：用于控制访问权限

// --- DOM 引用 ---
const chatWindowRef = ref<HTMLElement | null>(null);
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const streamBuffer = ref(''); // 文本缓冲区
const rendererIntervalId = ref<number | null>(null); // 渲染器定时器 ID

// --- API 配置 ---
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// --- 方法 ---

// 自动滚动到底部 (无需修改)
const scrollToBottom = (force = false) => {
  nextTick(() => {
    const chatWindow = chatWindowRef.value;
    if (chatWindow) {
      const isScrolledToBottom = chatWindow.scrollHeight - chatWindow.scrollTop - chatWindow.clientHeight < 100;
      if (force || isScrolledToBottom) {
        chatWindow.scrollTop = chatWindow.scrollHeight;
      }
    }
  });
};

// 动态调整文本框高度 (无需修改)
const autoResizeTextarea = (event: Event) => {
  const textarea = event.target as HTMLTextAreaElement;
  textarea.style.height = 'auto';
  const newHeight = Math.min(textarea.scrollHeight, 120);
  textarea.style.height = `${newHeight}px`;
  textarea.scrollTop = textarea.scrollHeight;
};

// 安全地渲染 Markdown (无需修改)
const renderMarkdown = (text: string) => {
  marked.setOptions({
    gfm: true,
    breaks: true,
  });
  return DOMPurify.sanitize(marked.parse(text) as string);
};

// --- 新增：计费函数 ---
const calculateCost = (model: keyof typeof MODEL_PRICING, inputTokens: number, outputTokens: number) => {
  const modelPricingInfo = MODEL_PRICING[model];
  if (!modelPricingInfo) {
    return { inputCost: 0, outputCost: 0 };
  }

  let inputPrice = 0;
  let outputPrice = 0;

  // 检查是否为具有分层定价的 Pro 模型
  if (model === 'gemini-2.5-pro' && 'tier1' in modelPricingInfo) {
    if (inputTokens <= modelPricingInfo.tier1.threshold) {
      inputPrice = modelPricingInfo.tier1.input;
      outputPrice = modelPricingInfo.tier1.output;
    } else {
      inputPrice = modelPricingInfo.tier2.input;
      outputPrice = modelPricingInfo.tier2.output;
    }
  } else if ('input' in modelPricingInfo) { // 处理像 Flash 这样的固定价格模型
    inputPrice = modelPricingInfo.input;
    outputPrice = modelPricingInfo.output;
  }

  const inputCost = (inputTokens / 1_000_000) * inputPrice;
  const outputCost = (outputTokens / 1_000_000) * outputPrice;

  return { inputCost, outputCost }; // 直接返回美元成本
};

// --- 新增：平滑流式输出的渲染器 (已优化) ---
const startStreamRenderer = (modelMessageIndex: number) => {
  if (rendererIntervalId.value) {
    clearInterval(rendererIntervalId.value);
  }

  let isFirstRender = true; // 新增一个标志，用于判断是否是首次渲染

  rendererIntervalId.value = setInterval(() => {
    if (streamBuffer.value.length > 0) {
      
      const messageToUpdate = conversationHistory.value[modelMessageIndex]!; // 添加非空断言，并存为变量
      
      // --- 核心修改 1: 固定渲染速度 ---
      const charsToRender = 2; // 每次只渲染 2 个字符，可以调整这个值来控制速度
      const textToAdd = streamBuffer.value.substring(0, charsToRender);
      
      // --- 核心修改 2: 首次替换，后续追加 ---
      if (isFirstRender) {
        messageToUpdate.parts[0].text = textToAdd;
        isFirstRender = false; // 更新标志
      } else {
        messageToUpdate.parts[0].text += textToAdd;
      }
      
      streamBuffer.value = streamBuffer.value.substring(charsToRender);

      if (shouldAutoScroll.value) {
        scrollToBottom(true);
      }
    } else if (!isLoading.value) {
      // 在这里，当缓冲区为空且加载已停止时，渲染才算真正完成。
      // 这是判断是否显示“新消息”提示的正确时机。
      if (!shouldAutoScroll.value) {
        showCompletionHint.value = true;
      }
      clearInterval(rendererIntervalId.value!);
      rendererIntervalId.value = null;
    }
  }, 10);
};

// 发送消息 (核心逻辑修改)
const sendMessage = async () => {
    showCompletionHint.value = false;
    const trimmedInput = userInput.value.trim();
    if (!trimmedInput || isLoading.value) return;

    isLoading.value = true;
    abortController.value = new AbortController();
    shouldAutoScroll.value = true;

    let historyForPayload: Message[] = [];
    if (contextLength.value === 'all') {
        historyForPayload = conversationHistory.value;
    } else {
        const length = parseInt(contextLength.value, 10);
        if (length > 0) {
            historyForPayload = conversationHistory.value.slice(-length);
        }
    }

    const payloadContents = [
        ...historyForPayload.map(msg => ({ role: msg.role, parts: msg.parts })),
        { role: 'user', parts: [{ text: trimmedInput }] }
    ];

    const userMessage: Message = {
        role: 'user',
        parts: [{ text: trimmedInput }],
        sentChars: trimmedInput.length
    };
    conversationHistory.value.push(userMessage);
    userInput.value = '';
    if (textareaRef.value) textareaRef.value.style.height = 'auto';
    scrollToBottom(true);

    const modelMessage: Message = { role: 'model', parts: [{ text: '思考中...' }] }; // --- 修改：初始文本为空，等待渲染器填充
    conversationHistory.value.push(modelMessage);
    const modelMessageIndex = conversationHistory.value.length - 1;
    const apiModelName = MODEL_NAME_MAPPING[selectedModel.value] || selectedModel.value;
    
    streamBuffer.value = ''; // --- 新增：清空缓冲区
    startStreamRenderer(modelMessageIndex); // --- 新增：启动渲染器

    try {
        const response = await fetch(`${API_BASE_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: apiModelName,
                contents: payloadContents,
            }),
            signal: abortController.value.signal,
        });

        if (!response.ok || !response.body) {
            let errorText = `HTTP 错误! 状态: ${response.status}`;
            try {
                const errorData = await response.json();
                errorText = errorData.error?.message || JSON.stringify(errorData);
            } catch (e) {
                errorText = response.statusText;
            }
            throw new Error(errorText);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        let fullResponseText = '';
        let usageMetadata: { promptTokenCount: number; candidatesTokenCount: number } | null = null;
        
        // --- 修改：在接收数据前设置滚动锁 ---
        const chatWindow = chatWindowRef.value;
        if (chatWindow) {
            const isAtBottom = chatWindow.scrollHeight - chatWindow.scrollTop - chatWindow.clientHeight < 100;
            shouldAutoScroll.value = isAtBottom;
        }

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const jsonStr = line.substring(6).trim();
                    if (!jsonStr || jsonStr === '[DONE]') continue;

                    try {
                        const data = JSON.parse(jsonStr);
                        const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

                        if (textContent) {
                            // isFirstChunk 的逻辑已移至渲染器，这里直接将数据送入缓冲区即可
                            streamBuffer.value += textContent;
                            fullResponseText += textContent;
                        }

                        if (data.usageMetadata) {
                            usageMetadata = data.usageMetadata;
                        }
                    } catch (e) {
                        console.error('无法解析 JSON 数据块:', jsonStr, e);
                    }
                }
            }
        }
        
       const finalModelMessage = conversationHistory.value[modelMessageIndex]!; // 添加非空断言
        finalModelMessage.receivedChars = fullResponseText.length;
        if (usageMetadata) {
            const { promptTokenCount, candidatesTokenCount } = usageMetadata;
            const { inputCost, outputCost } = calculateCost(
                apiModelName,
                promptTokenCount,
                candidatesTokenCount
            );
            finalModelMessage.inputTokens = promptTokenCount;
            finalModelMessage.outputTokens = candidatesTokenCount;
            finalModelMessage.inputCost = inputCost;
            finalModelMessage.outputCost = outputCost;
        }

    } catch (error: any) {
        if (error.name === 'AbortError') {
            console.log('生成已停止。');
            // 停止时，让渲染器自己处理完缓冲区剩余内容
            const abortedMessage = conversationHistory.value[modelMessageIndex];
            if (abortedMessage && abortedMessage.parts[0].text.trim() === '') {
                 conversationHistory.value.splice(modelMessageIndex, 1);
            } else {
                 streamBuffer.value += '\n\n**[生成已停止]**';
            }
        } else {
            console.error('发送消息时出错:', error);
            const errorMessage = error instanceof Error ? error.message : '未知错误';
            streamBuffer.value += `**出错了:** ${errorMessage}`;
        }
        scrollToBottom(true);
    } finally {
        isLoading.value = false;
        abortController.value = null;
        // 注意：不要在这里清除 interval，让它自然结束
        nextTick(() => {
            textareaRef.value?.focus();
        });
    }
};

// 滚动事件处理器
const handleScroll = () => {
  const chatWindow = chatWindowRef.value;
  if (chatWindow) {
    const isNearBottom = chatWindow.scrollHeight - chatWindow.scrollTop - chatWindow.clientHeight < 150;

    // 核心修改：实时根据用户滚动位置更新自动滚动状态
    // 如果用户在底部附近，我们就认为他希望自动滚动。一旦他向上滚动，就立即禁用。
    shouldAutoScroll.value = isNearBottom;

    // 当用户快要滚动回底部时，自动隐藏提示按钮 (此逻辑保留)
    if (isNearBottom) {
      showCompletionHint.value = false;
    }
  }
};

// 强制滚动到底部并隐藏提示
const forceScrollToBottom = () => {
  scrollToBottom(true);
  showCompletionHint.value = false;
};

// 停止生成
const stopGeneration = () => {
  if (abortController.value) {
    abortController.value.abort();
    isLoading.value = false; // 这会触发渲染器在清空缓冲区后自动停止
  }
  // --- 新增：如果渲染器仍在运行，也立即清除它 ---
  if (rendererIntervalId.value) {
    clearInterval(rendererIntervalId.value);
    rendererIntervalId.value = null;
  }
};

onMounted(() => {
  // --- 新增：访问权限验证逻辑 ---
  const SECRET_KEY = import.meta.env.VITE_ACCESS_KEY;
  if (!SECRET_KEY) {
    console.error("错误：未在 .env.local 文件中设置 VITE_ACCESS_KEY");
    isAuthenticated.value = false; // 如果未设置密钥，则锁定应用
    return;
  }

  // 1. 首先检查 sessionStorage
  if (sessionStorage.getItem('app_access_key') === SECRET_KEY) {
    isAuthenticated.value = true;
  } else {
    // 2. 如果 sessionStorage 中没有，则检查 URL 参数
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (token === SECRET_KEY) {
      isAuthenticated.value = true;
      // 验证成功后，将密钥存入 sessionStorage
      sessionStorage.setItem('app_access_key', SECRET_KEY);
      // 并从 URL 中移除 token 参数，以增强安全性
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  // 如果验证通过，才执行后续操作
  if (isAuthenticated.value) {
    textareaRef.value?.focus();
    const chatWindow = chatWindowRef.value;
    if (chatWindow) {
      chatWindow.addEventListener('scroll', handleScroll);
    }
  }
});

onUnmounted(() => {
  const chatWindow = chatWindowRef.value;
  if (chatWindow) {
    chatWindow.removeEventListener('scroll', handleScroll);
  }
});
</script>

<style>
/* ... 你的所有现有 CSS 样式都保留 ... */
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  background-color: #f4f4f9;
  margin: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  color: #333;
  font-size: 15px;
}

#app {
  width: 90%;
  max-width: 800px;
  height: 95vh;
  max-height: 900px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

#header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
  border-bottom: 1px solid #eee;
  background-color: #fafafa;
  flex-shrink: 0;
}

h1 {
  font-size: 1.1em;
  color: #444;
  margin: 0;
  padding: 15px 0;
}

#settings {
  display: flex;
  align-items: center;
  gap: 10px;
}

#settings select {
  padding: 5px 8px;
  border-radius: 6px;
  border: 1px solid #ddd;
  font-size: 0.9em;
  background-color: #fff;
}

#chat-window {
  flex-grow: 1;
  overflow-y: auto;
  padding: 15px;
  display: flex;
  flex-direction: column;
}

.message {
  display: flex;
  flex-direction: column;
  margin-bottom: 15px;
  max-width: 95%;
}

.message .role {
  font-weight: bold;
  font-size: 0.85em;
  margin-bottom: 4px;
  color: #555;
}

.message .text {
  padding: 10px 15px;
  border-radius: 16px;
  line-height: 1.5;
  word-wrap: break-word;
  text-align: left;
}

.message.user {
  align-self: flex-end;
  align-items: flex-end;
}

.message.user .text {
  background: #007bff;
  color: white;
  border-bottom-right-radius: 4px;
  white-space: pre-wrap;
}

.message.model {
  align-self: flex-start;
  align-items: flex-start;
}

.message.model .text {
  background: #e9ecef;
  color: #333;
  border-bottom-left-radius: 4px;
}

.token-info {
  font-size: 0.75em;
  color: #888;
  margin-top: 5px;
  display: flex;
  gap: 12px; /* 增加了间距 */
}
.message.user .token-info {
  align-self: flex-end;
}
.message.model .token-info {
  align-self: flex-start;
}
.token-info .received-chars {
  color: #666;
}

/* --- 新增：费用信息样式 --- */
.cost-info {
  color: #6c757d; /* 使用更柔和的颜色 */
  margin-top: 3px;
}

.completion-hint {
  position: absolute;
  bottom: 75px; /* 调整位置，使其在输入框上方 */
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 20px;
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  box-shadow: 0 2px 10px rgba(0,0,0,0.2);
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.completion-hint:hover {
  background-color: #0056b3;
  transform: translateX(-50%) translateY(-2px);
}

#input-area {
  display: flex;
  align-items: flex-end;
  padding: 12px;
  border-top: 1px solid #eee;
  background-color: #fafafa;
  flex-shrink: 0;
}

#message-input {
  flex-grow: 1;
  border: 1px solid #ccc;
  border-radius: 18px;
  padding: 10px 15px;
  resize: none;
  font-size: 1em;
  font-family: inherit;
  line-height: 1.4;
  max-height: 120px;
  overflow-y: auto;
}

#message-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0,123,255,0.25);
}

#send-button {
  background: #007bff;
  color: white;
  border: none;
  border-radius: 50%;
  width: 44px;
  height: 44px;
  margin-left: 10px;
  cursor: pointer;
  font-size: 18px;
  display: flex;
  justify-content: center;
  align-items: center;
  transition: background-color 0.2s;
  flex-shrink: 0;
}

#send-button.stop-button {
  background-color: #dc3545;
}
#send-button.stop-button:hover {
  background-color: #c82333;
}

#send-button:hover {
  background: #0056b3;
}

#send-button:disabled {
  background-color: #a0a0a0;
  cursor: not-allowed;
}

.message.model .text pre {
  background-color: #282c34;
  color: #abb2bf;
  padding: 0.8em;
  margin: 0.5em 0;
  border-radius: 8px;
  overflow-x: auto;
  font-size: 0.9em;
}
.message.model .text code {
  font-family: 'Courier New', Courier, monospace;
  background-color: rgba(0,0,0,0.08);
  padding: 2px 5px;
  border-radius: 4px;
}
.message.model .text pre > code {
  background-color: transparent;
  padding: 0;
  color: inherit;
}
.message.model .text blockquote {
  border-left: 3px solid #ccc;
  padding-left: 1em;
  margin: 0.5em 0;
  color: #666;
}
.message.model .text ul, .message.model .text ol {
  padding-left: 1.5em;
  margin: 0.5em 0;
}
.message.model .text p {
  margin: 0.5em 0;
}
.message.model .text p:first-child {
  margin-top: 0;
}
.message.model .text p:last-child {
  margin-bottom: 0;
}
.message.model .text strong {
  font-weight: bold;
}

/* --- 新增：访问受限页面的样式 --- */
.access-denied {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100%;
  padding: 20px;
  text-align: center;
  background-color: #f8f9fa;
  color: #495057;
}

.access-denied h2 {
  font-size: 2em;
  margin-bottom: 15px;
}

.access-denied p {
  font-size: 1.1em;
  margin-bottom: 20px;
  max-width: 500px;
  line-height: 1.6;
}

.access-denied code {
  background-color: #e9ecef;
  padding: 4px 8px;
  border-radius: 4px;
  font-family: 'Courier New', Courier, monospace;
  color: #c7254e;
}

.access-denied .warning {
  background-color: #fff3cd;
  color: #856404;
  padding: 10px 15px;
  border-radius: 6px;
  border: 1px solid #ffeeba;
  max-width: 90%;
  margin-top: 20px;
  margin-bottom: 20px;
}
</style>