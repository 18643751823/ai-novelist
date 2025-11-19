# 青烛 v0.1.0

[English Version](README_en.md) | 中文版

> **版本说明**: 由于这是个人学习项目，前期版本号管理较为混乱，故从 v0.1.0 开始重新进行版本管理。

![项目截图](images/示例图片.jpg)
## 项目介绍

青烛(正式名)是一个智能写作辅助工具，采用 Python 后端和 JavaScript 前端架构，提供全方位的写作支持。

**核心功能**:
*   **AI 智能交互**: 与AI进行实时对话，辅助创作。
*   **章节管理**: 创建、编辑、删除和组织章节。
*   **内容编辑器**: 基于 Tiptap 的富文本编辑器。
*   **文风模仿**: 基于 RAG 技术，检索文本片段，增强ai能力。
*   **工具调用**: 支持类似 vibecoding 的工具调用解决问题，目前部分功能仍在完善中。

## 技术栈

### 前端技术
*   **React**: 前端用户界面框架
*   **Redux**: 前端状态管理库
*   **Tiptap**: 富文本编辑器框架

### 后端技术
*   **LangChain**: 用于构建AI应用的工具链
*   **LangGraph**: 基于图的AI工作流编排框架
*   **LiteLLM**: 统一的AI模型调用接口
*   **LanceDB**: 向量数据库，提供语义搜索和知识库管理



## 快速开始

### 安装&启动

1.  **克隆仓库**:
    ```bash
    git clone git@github.com:FlickeringLamp/ai-novelist.git
    cd ai-novelist
    ```


2.  **安装前端依赖**:
    进入前端目录 (`frontend/`) 并安装依赖,构建前端，启动：
    ```bash
    cd frontend
    npm install
    npm run build
    npm start
    ```


3.  **安装后端依赖**:
    从根目录(`ai-novelist`)创建虚拟环境，激活，并安装后端依赖，启动：
    ```bash
    python -m venv backend_env
    backend_env\Scripts\activate
    cd backend
    pip install -r requirements.txt
    python main.py
    ```

4.  **安装litellm网关**
    进入根目录(`ai-novelist`)，创建虚拟环境(名称随意)，并安装litellm，启动。(backend/api_provider/config.yaml自行配置)
    ```bash
    python -m venv litellm_env
    litellm_env\Scripts\activate
    pip install 'litellm[proxy]'
    litellm --config backend/api_provider/config.yaml --port 4000 --host 0.0.0.0 --debug
    ```

5. **浏览器访问**：
    浏览器访问localhost:3000




## 贡献

我们欢迎各种形式的贡献！如果您发现 Bug、有功能建议或希望提交代码，请随时通过 GitHub Issues 或 Pull Requests 参与。

为了保持项目的健康发展，请确保：
- 提交的代码与 [MIT 协议](LICENSE) 兼容
- 避免引入与 MIT 协议不兼容的代码

**关于 DCO 的说明**：先前本项目有 DCO（开发者来源证书）要求，但检查未正确移除。现已完全移除所有 DCO 检查和要求。贡献者不再需要在提交时进行签名确认。

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