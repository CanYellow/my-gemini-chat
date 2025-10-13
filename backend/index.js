// 1. 引入依赖
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

// 2. 检查环境变量
const API_KEY = process.env.API_KEY;
const API_HOST = process.env.API_HOST;
const PORT = process.env.PORT || 3000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN;

if (!API_KEY || !API_HOST || !FRONTEND_ORIGIN) {
    console.error("错误：请确保 .env 文件中已设置 API_KEY, API_HOST 和 FRONTEND_ORIGIN");
    process.exit(1);
}

// 3. 初始化 Express 应用
const app = express();

// 4. 配置中间件
// 使用 cors 中间件处理跨域请求
app.use(cors({ origin: FRONTEND_ORIGIN }));
// 使用 express.json() 中间件解析 JSON 请求体
//app.use(express.json());
app.use(express.json({ limit: '5mb' })); // 将默认的100kb提高到5mb

// --- 新增：配置速率限制中间件 ---
const limiter = rateLimit({
    windowMs: 60 * 1000, // 1 分钟
    max: 45, // 每个 IP 在 1 分钟内最多允许 45 次请求
    message: {
        error: '请求过于频繁，请稍后再试。'
    },
    standardHeaders: true, // 返回速率限制信息在 `RateLimit-*` 头中
    legacyHeaders: false, // 禁用 `X-RateLimit-*` 头
});

// 将速率限制应用于 /api/chat 路由
app.use('/api/chat', limiter);
// --- 速率限制配置结束 ---

// 5. 定义核心 API 路由
app.post('/api/chat', async (req, res) => {
    try {
        const { model, contents } = req.body;

        // 基本的输入验证
        if (!model || !Array.isArray(contents) || contents.length === 0) {
            return res.status(400).json({ error: '请求格式错误，需要 model 和 contents' });
        }
        
        const apiUrl = `${API_HOST}/v1beta/models/${model}:streamGenerateContent?key=${API_KEY}&alt=sse`;
        
        // 使用 Node.js 18+ 内置的 fetch API
        const geminiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ contents }),
        });
        
        // 安全检查：如果 Gemini API 返回错误，则将其转发给客户端
        if (!geminiResponse.ok) {
            const errorData = await geminiResponse.json();
            console.error('Gemini API Error:', errorData);
            return res.status(geminiResponse.status).json(errorData);
        }

        // 设置响应头，告诉客户端这是一个流式响应
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // 将 Gemini API 的流式响应体直接管道(pipe)到我们的后端响应中
        // 这是最高效的方式，无需在服务器上缓冲整个响应
        const reader = geminiResponse.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            res.write(decoder.decode(value));
        }
        res.end();

    } catch (error) {
        console.error('代理服务器内部错误:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

// 6. 启动服务器
app.listen(PORT, () => {
    console.log(`后端代理服务器运行在 http://localhost:${PORT}`);
    console.log(`允许来自 ${FRONTEND_ORIGIN} 的跨域请求`);
});
