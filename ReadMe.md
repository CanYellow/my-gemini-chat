# 项目开发与部署指南

本指南详细阐述了 `my-gemini-chat` 项目的开发、调试、构建与生产环境部署流程。它分为开发指南和生产环境部署指南两部分。

---

## 第一部分：项目开发指南

本部分详细阐述了 `my-gemini-chat` 项目的开发与调试流程，主要基于其根目录下的 `package.json` 文件所定义的脚本和结构。

### 1. 项目概览

*   **项目名称**: `my-gemini-chat`
*   **描述**: 一个全栈的 Gemini 聊天应用。
*   **结构**: 项目采用根 `package.json` 管理整个应用，并包含 `backend` 和 `frontend` 两个子目录。每个子目录均应具备独立的 `package.json` 文件，用于管理各自的依赖和运行脚本。
*   **核心工具**: `npm` (包管理器), `concurrently` (并行运行脚本)。

### 2. 推断的项目目录结构

根据 `package.json` 中 `npm` 脚本的 `prefix` 选项，项目预期将具有以下基本结构：

```
my-gemini-chat/
├── package.json         <- 根package.json (此文件)
├── node_modules/        <- 根依赖 (例如: concurrently)
├── backend/
│   ├── package.json     <- 后端服务的package.json
│   ├── tsconfig.json    <- TypeScript 配置文件
│   ├── node_modules/    <- 后端依赖
│   └── src/             <- 后端TypeScript源代码
├── frontend/
│   ├── package.json     <- 前端应用的package.json
│   ├── node_modules/    <- 前端依赖
│   └── src/             <- 前端源代码
├── .gitignore
└── README.md            <- 本指南所在的文件
```

### 3. 开发与调试流程

以下是完整的项目开发与调试流程以及相应的命令。

#### 3.1. 初始设置

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

*   **安全**: 必须在 backend 目录下面建立 .env 文件，里面添加项目敏感信息。
    ```shell
    API_KEY="XXXXXXXX"
    API_HOST="XXXXXXX"
    PORT=3000
    FRONTEND_ORIGIN="http://localhost:5173"
    ```


#### 3.2. 全栈开发模式 (日常开发推荐)

此模式同时启动后端服务和前端开发服务器，为全栈开发提供无缝体验。

*   **目标**: 启动后端 API 服务和前端开发服务器。前端通常配置为通过代理或直接请求后端 API。
*   **命令**:
    ```bash
    npm run dev
    ```
*   **说明**:
    *   此命令利用 `concurrently` 并行执行 `"npm run start:backend"` 和 `"npm run start:frontend"`。
    *   `npm run start:backend`: 运行 `backend` 目录中 `package.json` 里定义的 `start` 脚本。这通常会启动 Node.js 服务器（例如，使用 `ts-node-dev` 或 `nodemon` 配合 `ts-node`）。
    *   `npm run start:frontend`: 运行 `frontend` 目录中 `package.json` 里定义的 `dev` 脚本。这通常会启动一个前端开发服务器（例如，Vite, Webpack Dev Server），并提供热模块重载 (HMR) 功能。
*   **停止**: 在终端中按 `Ctrl + C` 即可停止所有由 `concurrently` 启动的进程。

#### 3.3. 后端独立开发与调试

当开发者仅需关注后端逻辑时，可单独启动后端服务。

*   **目标**: 仅启动后端服务。
*   **命令**:
    ```bash
    npm run start:backend
    ```

#### 3.4. 前端独立开发与调试

当开发者仅需关注前端 UI 或与模拟 API 交互时，可单独启动前端开发服务器。

*   **目标**: 仅启动前端开发服务器。
*   **命令**:
    ```bash
    npm run start:frontend
    ```

---

## 第二部分：生产环境部署指南

本部分提供了将 `my-gemini-chat` 项目部署到生产服务器的详细步骤。我们将使用 **PM2** 作为 Node.js 进程管理器，并使用 **Caddy** 作为反向代理和 HTTPS 服务器。

### 1. 部署架构概览

*   **前端 (Frontend)**: 将被构建为静态文件（HTML, CSS, JS），由 Caddy直接提供服务。
*   **后端 (Backend)**: TypeScript 代码将被编译为 JavaScript，然后由 PM2 在后台作为一个持久化服务运行。
*   **Caddy**: 将作为流量入口。
    *   它会自动处理 SSL 证书（HTTPS）。
    *   它会将静态文件请求（例如 `your-domain.com`）直接响应。
    *   它会将 API 请求（例如 `your-domain.com/api/*`）反向代理到后台运行的 Node.js 服务。

### 2. 服务器环境准备

在开始部署之前，请确保您的生产服务器（例如一个 Ubuntu 22.04 LTS VPS）已准备好以下软件：

1.  **Node.js 和 npm**:
    ```bash
    # 推荐使用 nvm (Node Version Manager) 来安装
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    # 重新加载 shell 或打开新终端
    nvm install --lts
    nvm use --lts
    ```

2.  **Git**: 用于从代码仓库拉取最新代码。
    ```bash
    sudo apt update
    sudo apt install git -y
    ```

3.  **PM2**: 全局安装 Node.js 进程管理器。
    ```bash
    npm install pm2 -g
    ```

4.  **Caddy**: 安装 Caddy v2。
    ```bash
    # 参考 Caddy 官方文档获取最新安装指令
    # 以下是针对 Ubuntu/Debian 的示例
    sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
    sudo apt update
    sudo apt install caddy -y
    ```

### 3. 部署步骤

#### 3.1. 准备项目构建脚本

在部署之前，请确保 `frontend/package.json` 和 `backend/package.json` 中包含 `build` 脚本。

**示例 `frontend/package.json`**:
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "...": "..."
  }
}
```

**示例 `backend/package.json`**:
```json
{
  "scripts": {
    "start": "ts-node-dev src/index.ts",
    "build": "tsc",
    "prod": "node dist/index.js",
    "...": "..."
  }
}
```
*   `backend` 的 `build` 脚本 (`tsc`) 将 TypeScript 编译为 JavaScript，并输出到 `dist` 目录（由 `tsconfig.json` 的 `outDir` 选项定义）。
*   `backend` 的 `prod` 脚本用于在生产中运行编译后的代码。

**安全**: 必须在 backend 目录下面建立 .env 文件，里面添加项目敏感信息。

    ```shell
    API_KEY="XXXXXXXX"
    API_HOST="XXXXXXX"
    PORT=3000
    FRONTEND_ORIGIN="http://localhost:5173"
    ```
  
**安全**: 必须在 frontend 目录下面建立 .env .local文件，里面添加项目敏感信息。

    ```shell
    # 请将 "your_super_secret_random_string" 替换成您的真实密钥
    #  例如，你可以使用密码生成器生成一个32位的随机字符串
    # 特殊字符需要转义，
    # 使用 http://localhost:5173/?token=VITE_ACCESS_KEY访问
    VITE_ACCESS_KEY="XXXXX"
    	```

#### 3.2. 拉取代码并安装依赖

1.  **克隆或拉取项目代码**:
    ```bash
    # 如果是首次部署
    git clone <your-repo-url> my-gemini-chat
    cd my-gemini-chat

    # 如果是更新
    git pull origin main # 或者你的主分支
    ```

2.  **安装所有依赖**:
    ```bash
    npm run install:all
    ```

#### 3.3. 构建前端和后端应用

1.  **构建前端**:
    ```bash
    npm run build --prefix frontend
    ```
    此命令将在 `frontend/dist` (或类似目录) 中生成静态网站文件。

2.  **构建后端**:
    ```bash
    npm run build --prefix backend
    ```
    此命令将在 `backend/dist` 目录中生成编译后的 JavaScript 文件。

#### 3.4. 使用 PM2 运行后端服务

1.  **启动后端服务**:
    我们使用 PM2 启动编译后的 JavaScript 文件 (`backend/dist/index.js`)。

    ```bash
    # 确保你位于项目根目录 my-gemini-chat/
    # 假设后端服务监听 3001 端口
    pm2 start backend/dist/index.js --name my-gemini-chat-backend -- --port 3001
    ```
    或者，如果后端应用通过 `backend/package.json` 中的 `prod` 脚本启动：
    ```bash
    # 设置 NODE_ENV=production 以获得最佳性能
    # 假设后端服务在 package.json 中硬编码了端口或通过 .env 读取
    NODE_ENV=production pm2 start npm --name "my-gemini-chat-backend" -- run prod --prefix backend
    ```

    *   `--name my-gemini-chat-backend`: 为 PM2 进程指定一个易于识别的名称。
    *   `NODE_ENV=production`: 设置环境变量，许多库会根据此变量进行优化。

2.  **验证 PM2 进程状态**:
    ```bash
    pm2 list
    # 或查看日志
    pm2 logs my-gemini-chat-backend
    ```

3.  **设置 PM2 开机自启**:
    这是**至关重要**的一步，确保服务器重启后后端服务能自动恢复。
    ```bash
    pm2 save
    pm2 startup
    ```
    PM2 会生成并提示你运行一条命令（通常需要 `sudo` 权限）来完成自启设置。

#### 3.5. 配置 Caddy 反向代理

1.  **编辑 Caddyfile**:
    Caddy 的主配置文件位于 `/etc/caddy/Caddyfile`。使用你喜欢的编辑器（如 `nano` 或 `vim`）打开它。
    ```bash
    sudo nano /etc/caddy/Caddyfile
    ```

2.  **配置 Caddy**:
    清空文件内容，并替换为以下配置。请务必将 `your-domain.com` 替换为你的实际域名，并确保项目路径 `/path/to/my-gemini-chat` 正确。

    ```caddyfile
    # 将 your-domain.com 替换为你的域名
    your-domain.com {
        # 开启 gzip 和 zstd 压缩以优化性能
        encode gzip zstd

        # 设置静态文件服务的根目录为前端构建产物目录
        # !! 确保这里的路径是绝对路径 !!
        root * /path/to/my-gemini-chat/frontend/dist

        # 将所有 /api/* 的请求反向代理到由 PM2 管理的后端服务
        # 假设后端服务运行在 3001 端口
        reverse_proxy /api/* http://localhost:3001

        # 将所有未匹配到具体文件的请求重写到 index.html
        # 这对于单页面应用 (SPA) 的路由至关重要
        try_files {path} {path}/ /index.html

        # 提供静态文件服务
        file_server
    }
    ```

    **配置解释**:
    *   `your-domain.com`: Caddy 会自动为这个域名申请和续订 Let's Encrypt SSL 证书。
    *   `root * /path/to/...`: 指定网站的根目录。
    *   `reverse_proxy /api/* http://localhost:3001`: 这是核心。所有以 `/api/` 开头的请求都会被转发到本地的 3001 端口，也就是我们后端服务的监听端口。
    *   `try_files ... /index.html`: 处理前端路由。如果用户直接访问 `your-domain.com/some-page`，服务器上没有这个文件，Caddy 会返回 `index.html`，让前端的路由库接管。

3.  **重载 Caddy 配置**:
    保存 `Caddyfile` 后，重载 Caddy 以使新配置生效。
    ```bash
    sudo systemctl reload caddy
    ```
    Caddy 会在后台自动应用新配置，服务不会中断。

### 4. 部署完成

现在，访问 `https://your-domain.com`，你应该能看到你的 Gemini 聊天应用了。Caddy 会自动处理 HTTPS，前端应用由 Caddy 直接提供，API 请求会被正确代理到由 PM2 稳定运行的后端服务。

### 5. 日常维护与更新

当需要更新应用时，流程如下：

1.  SSH 登录到服务器，并进入项目目录。
    ```bash
    cd /path/to/my-gemini-chat
    ```
2.  拉取最新代码。
    ```bash
    git pull origin main
    ```
3.  重新安装依赖（以防有变动）。
    ```bash
    npm run install:all
    ```
4.  重新构建前端和后端。
    ```bash
    npm run build --prefix frontend
    #后端不需要构建
    #npm run build --prefix backend
    ```
5.  重启 PM2 管理的后端服务。
    ```bash
    pm2 restart my-gemini-chat-backend
    ```
6.  (可选) 如果 `Caddyfile` 有修改，重载 Caddy。
    ```bash
    sudo systemctl reload caddy
    ```

前端文件的更新是即时的，因为 Caddy 直接从 `frontend/dist` 目录提供服务，该目录在构建后已被更新。
