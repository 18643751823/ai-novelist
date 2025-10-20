# 青烛 v2.0.1

[English Version](README_en.md) | 中文版

![项目截图](images/示例图片.jpg)
## 项目介绍

青烛（正式名） 是一个基于 Electron 框架构建的桌面应用程序，旨在做一个写作版ai ide。

**核心功能**:
*   **AI 智能交互**: 与AI进行实时对话，从提供灵感到正文写作，修改润色等，写作全流程的智能辅助。
*   **章节管理**: 用户/AI直观地创建、编辑、删除和组织小说的章节，清晰呈现作品结构。
*   **内容编辑器**: 提供基础的文本编辑界面，支持小说内容的撰写和修改。
*   **文风模仿**: 基于rag技术，分析文本片段并模仿文风。
*   **工具调用**: 支持像vibecoding一样，调用工具解决问题。 

## 技术栈

*   **Electron**: 用于构建跨平台的桌面应用程序，结合了Web技术（HTML、CSS、JavaScript）和原生能力。
*   **React.js**: 前端用户界面框架，提供高效的组件化开发模式和出色的用户体验。
*   **Node.js**: 后端服务运行时环境，负责处理与AI的交互、文件系统操作以及与前端的IPC通信。
*   **AI API集成**: 支持 DeepSeek、Open Router、Ollama、硅基流动模型提供商，提供统一的接口调用体验。
*   **LanceDB**: 向量数据库，用于RAG（检索增强生成）功能，提供语义搜索和知识库管理。
*   **Redux**: 前端状态管理库，用于统一管理应用程序的复杂状态。
*   **Tiptap**: 优秀的富文本编辑器。
*   **electron-store**: 轻量级的Electron配置存储库，用于持久化应用程序设置，例如API Key。
*   **LangChain**: 用于构建AI应用的工具链，目前已有简单应用，后续将进一步扩展LangChain功能实现。



## 快速开始

### 先决条件

*   Node.js (推荐 LTS 版本)
*   npm 或 yarn

### 安装

1.  **克隆仓库**:
    ```bash
    git clone git@github.com:18643751823/ai-novelist.git
    cd ai-novel
    ```


2.  **安装依赖**:
    在项目根目录 (`ai-novel/`) 下执行：
    ```bash
    npm install
    ```


3.  **安装前端依赖**:
    进入前端目录 (`frontend/react-app/`) 并安装依赖：
    ```bash
    cd frontend/react-app
    npm install
    ```

4.  **构建前端应用**:
    回到项目根目录 (`ai-novel/`) 并执行构建：
    ```bash
    cd ../..
    npm run build
    ```

### 运行应用

**启动 Electron 应用**:
项目根目录 (`ai-novel/`) 执行：
```bash
npm run start:full
```



## 贡献

我们欢迎各种形式的贡献！如果您发现 Bug、有功能建议或希望提交代码，请随时通过 GitHub Issues 或 Pull Requests 参与。

为了保持项目的健康发展，请确保：
- 提交的代码与 [MIT 协议](LICENSE) 兼容
- 避免引入与 MIT 协议不兼容的代码

感谢每一位贡献者的支持！

## 许可证

本项目采用 [MIT 许可证](LICENSE)。


---

## 致谢 (Acknowledgements)

本项目的开发在很大程度上借鉴了 `roo-code` 项目。我们对 `roo-code` 的开发者们表示衷心的感谢。

`roo-code` 项目基于 Apache License 2.0 开源。根据其许可证要求，我们在项目中包含了其原始的许可证声明，您可以在 [`LICENSE-roo-code.txt`](./LICENSE-roo-code.txt) 文件中查看。

## Acknowledgements

This project is heavily inspired by and based on the work of the `roo-code` project. We extend our sincere gratitude to the developers of `roo-code`.

The `roo-code` project is licensed under the Apache License, Version 2.0. In compliance with its terms, we have included the original license notice within our project, which can be found in the [`LICENSE-roo-code.txt`](./LICENSE-roo-code.txt) file.