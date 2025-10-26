# 项目开发指南

本指南详细阐述了 `my-gemini-chat` 项目的开发与调试流程，主要基于其根目录下的 `package.json` 文件所定义的脚本和结构。

## 1. 项目概览

*   **项目名称**: `my-gemini-chat`
*   **描述**: 一个全栈的 Gemini 聊天应用。
*   **结构**: 项目采用根 `package.json` 管理整个应用，并包含 `backend` 和 `frontend` 两个子目录。每个子目录均应具备独立的 `package.json` 文件，用于管理各自的依赖和运行脚本。
*   **核心工具**: `npm` (包管理器), `concurrently` (并行运行脚本)。

## 2. 推断的项目目录结构

根据 `package.json` 中 `npm` 脚本的 `prefix` 选项，项目预期将具有以下基本结构：

```
my-gemini-chat/
├── package.json         <- 根package.json (此文件)
├── node_modules/        <- 根依赖 (例如: concurrently)
├── backend/
│   ├── package.json     <- 后端服务的package.json (需自行创建)
│   ├── node_modules/    <- 后端依赖
│   └── src/             <- 后端源代码 (例如: index.js, app.js, routes/, models/)
├── frontend/
│   ├── package.json     <- 前端应用的package.json (需自行创建)
│   ├── node_modules/    <- 前端依赖
│   └── src/             <- 前端源代码 (例如: index.html, App.js, components/, pages/)
├── .gitignore
└── README.md            <- 本指南所在的文件
```

## 3. 开发与调试流程

以下是完整的项目开发与调试流程以及相应的命令。

### 3.1. 初始设置

首次克隆项目或在 `package.json` 依赖发生变更后，必须安装所有项目依赖。

*   **目标**: 安装根目录、后端和前端的所有依赖。
*   **命令**:
    ```bash
    npm run install:all
    ```
*   **说明**:
    *   此命令执行了一系列 `npm install` 操作：
        *   `npm install`: 安装根目录 `package.json` 中定义的依赖（例如 `concurrently`）。
        *   `npm install --prefix backend`: 进入 `backend` 目录，安装其 `package.json` 中定义的依赖。
        *   `npm install --prefix frontend`: 进入 `frontend` 目录，安装其 `package.json` 中定义的依赖。
    *   该脚本确保所有三个层级的 `node_modules` 目录都被正确填充，使项目处于可运行状态。

### 3.2. 全栈开发模式 (日常开发推荐)

此模式同时启动后端服务和前端开发服务器，为全栈开发提供无缝体验。

*   **目标**: 启动后端 API 服务和前端开发服务器。前端通常配置为通过代理或直接请求后端 API。
*   **命令**:
    ```bash
    npm run dev
    ```
*   **说明**:
    *   此命令利用 `concurrently` 并行执行 `"npm run start:backend"` 和 `"npm run start:frontend"`。
    *   `npm run start:backend`: 运行 `backend` 目录中 `package.json` 里定义的 `start` 脚本。这通常会启动 Node.js 服务器（例如，使用 `node index.js` 或 `nodemon index.js`）。
    *   `npm run start:frontend`: 运行 `frontend` 目录中 `package.json` 里定义的 `dev` 脚本。这通常会启动一个前端开发服务器（例如，Vite, Webpack Dev Server, Create React App 的 `react-scripts start`），并提供热模块重载 (HMR) 功能。
    *   `concurrently` 会在同一个终端窗口中显示来自后端和前端的日志输出，便于同时监控。
*   **停止**: 在终端中按 `Ctrl + C` 即可停止所有由 `concurrently` 启动的进程。

### 3.3. 后端独立开发与调试

当开发者仅需关注后端逻辑时，可单独启动后端服务。

*   **目标**: 仅启动后端服务。
*   **命令**:
    ```bash
    npm run start:backend
    ```
*   **说明**: 此命令将只执行 `backend` 目录中的 `start` 脚本。开发者可通过浏览器（如访问 `http://localhost:3000/api/some-endpoint`）或API工具（如Postman, Insomnia）来测试后端API。
*   **调试**:
    *   **Node.js Inspector**: 如果 `backend/package.json` 中的 `start` 脚本是 `node index.js`，可修改该脚本或单独运行：
        ```bash
        node --inspect-brk backend/index.js # 或后端主文件路径
        ```
        之后可在 Chrome 浏览器中打开 `chrome://inspect` 进行调试，或通过 VS Code 等 IDE 连接到调试器。
    *   **nodemon**: 若后端配置使用 `nodemon` 进行开发（例如 `start` 脚本为 `nodemon src/index.js`），`nodemon` 会监听文件变化并自动重启服务，方便开发调试。

### 3.4. 前端独立开发与调试

当开发者仅需关注前端 UI 或与模拟 API 交互时，可单独启动前端开发服务器。

*   **目标**: 仅启动前端开发服务器。
*   **命令**:
    ```bash
    npm run start:frontend
    ```
*   **说明**: 此命令将只执行 `frontend` 目录中的 `dev` 脚本。前端应用将在其配置的端口（例如 `http://localhost:5173` 或 `http://localhost:3000`）运行。
*   **调试**:
    *   **浏览器开发者工具**: 使用 F12（或 macOS 上的 Cmd+Option+I）打开浏览器开发者工具，进行元素检查、网络请求监控、JavaScript 调试等。
    *   **IDE 集成**: 许多 IDE（如 VS Code）提供了与浏览器调试器的集成，允许开发者直接在 IDE 中设置断点并调试前端代码。
    *   **Mock API**: 在前端独立开发时，可能需要配置前端使用 Mock API 或模拟数据，而不是真实的后端服务。

## 4. 进一步的项目开发考虑

以下是全栈开发中同样重要，但未直接在此根 `package.json` 中定义的常见流程和命令，开发者需在 `backend/package.json` 和 `frontend/package.json` 中定义或单独处理。

### 4.1. 测试

*   **后端测试**: `backend/package.json` 中通常会定义 `test` 脚本（例如使用 `jest`, `mocha`, `vitest`）。
    *   **示例命令** (在 `backend` 目录下): `npm test` 或 `npm run test:watch`
*   **前端测试**: `frontend/package.json` 中也通常会定义 `test` 脚本（例如使用 `jest`, `vitest`, `cypress`, `testing-library`）。
    *   **示例命令** (在 `frontend` 目录下): `npm test` 或 `npm run cypress:open`

### 4.2. 代码质量与规范

*   **Linting**: 使用 ESLint 或 Prettier 检查并格式化代码。通常在 `backend/package.json` 和 `frontend/package.json` 中定义。
    *   **示例命令**: `npm run lint`, `npm run format`
*   **Pre-commit Hooks**: 可使用 Husky 等工具在提交代码前自动运行 linting 和测试。

### 4.3. 构建与部署 (生产环境)

*   **前端构建**: 将前端代码编译、打包、优化为静态文件，以便部署到生产环境。
    *   **示例命令** (在 `frontend` 目录下): `npm run build` (通常会在 `frontend/dist` 或 `frontend/build` 生成文件)
*   **后端构建/优化**: 对于一些后端框架（如 TypeScript），可能需要编译。对于 Node.js 应用，通常直接部署源代码，但可能涉及：
    *   **环境变量**: 设置 `NODE_ENV=production` 以启用生产优化。
    *   **进程管理器**: 使用 PM2 或 Forever 等工具在生产环境中运行后端服务。
    *   **Docker**: 将后端和前端打包成 Docker 镜像进行部署。
*   **部署脚本**: 可能会有一个顶层的 `deploy` 脚本或 CI/CD 流程来自动化构建和部署。
    *   **示例命令** (若在根 `package.json` 中定义): `npm run deploy`

### 4.4. 数据库管理 (若后端使用数据库)

*   **迁移**: 若后端使用 ORM (如 Sequelize, TypeORM, Prisma) 进行数据库管理，会有相应的迁移命令。
    *   **示例命令** (在 `backend` 目录下): `npm run migrate:up`, `npm run migrate:down`, `npm run seed`
*   **数据库启动/停止**: 若使用本地数据库（如通过 Docker Compose 启动 PostgreSQL/MongoDB），会有相应的命令。

### 4.5. 环境配置

*   **`.env` 文件**: 通常在 `backend` 和 `frontend` 目录中分别使用 `.env` 文件来管理环境变量（例如 API 密钥、数据库连接字符串、端口号）。
    *   **注意**: `.env` 文件通常不应提交到版本控制系统。