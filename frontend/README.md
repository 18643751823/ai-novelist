# ai-novelist - React 前端应用
此文档用于快速了解前端结构


## 技术栈

- **前端框架**: React 18
- **构建工具**: Vite
- **状态管理**: Redux Toolkit
- **UI 组件库**: Material-UI (MUI)
- **富文本编辑器**: Tiptap
- **拖拽功能**: React DnD
- **工作流编辑器**: ReactFlow
- **样式**: CSS Modules + Emotion

## 项目结构

```
frontend/
├── src/
│   ├── components/          # React 组件
│   │   ├── agent/          # AI参数设置组件
│   │   ├── aiprovider/     # AI提供商设置
│   │   ├── chapter/        # 章节栏所有组件
│   │   ├── chat/           # 聊天栏所有组件
│   │   ├── editor/         # 文本编辑器组件
│   │   ├── insert/         # 插入信息面板组件
│   │   ├── rag/            # RAG面板相关组件
│   │   └── workflow-editor/ # 工作流编辑器面板
│   ├── hooks/              # 自定义 React Hooks
│   ├── ipc/                # IPC 通信处理
│   ├── store/              # Redux 状态管理
│   │   └── slices/         # Redux slices
│   └── utils/              # 工具函数
├── public/                 # 静态资源
├── package.json           # 项目依赖配置
└── vite.config.js         # Vite 构建配置
```