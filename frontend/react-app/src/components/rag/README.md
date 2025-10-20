# RAG 前端组件文档

## 概述

RAG（Retrieval-Augmented Generation）前端组件负责提供检索增强生成功能的用户界面，包括知识库管理、嵌入模型配置、文本分段参数设置等功能。

## 目录结构

```
rag/
├── RagManagementPanel.js          # RAG 统一管理面板（主组件）
├── RagManagementPanel.css         # 管理面板样式
├── knowledgebaseTab/              # 知识库管理相关组件
│   ├── KnowledgeBaseSettings.js      # 知识库文件管理面板
│   ├── KnowledgeBaseSettings.css     # 知识库面板样式
│   ├── IntentAnalysisSettings.js  # 意图分析模型配置
│   ├── IntentAnalysisSettings.css # 意图分析设置样式
│   ├── RetrievalSettings.js       # 检索参数设置
│   ├── RetrievalSettings.css      # 检索设置样式
│   ├── RenameKbFileModal.js       # 知识库文件重命名模态框
│   └── RenameKbFileModal.css      # 重命名模态框样式
└── ragsettingsTab/                # RAG 设置相关组件
    ├── EmbeddingModelSelector.js  # 嵌入模型选择器
    ├── EmbeddingModelSelector.css # 模型选择器样式
    ├── TextChunkingSettings.js    # 文本分段参数设置
    ├── TextChunkingSettings.css   # 分段设置样式
    ├── EmbeddingDimensionsSettings.js # 嵌入向量维度设置
    └── EmbeddingDimensionsSettings.css # 维度设置样式
```

## 组件详细说明

### 1. RagManagementPanel.js
**主要功能**: RAG 统一管理面板，作为所有 RAG 相关设置的入口点
- 提供标签页导航：RAG 设置和知识库管理
- 协调所有子组件的状态管理和数据流
- 处理统一的保存操作和状态同步

**关键特性**:
- 并行加载所有 RAG 相关设置
- 实时状态同步（Redux + 本地存储）
- 统一的错误处理和加载状态管理

### 2. KnowledgeBaseSettings.js
**主要功能**: 知识库文件管理
- 显示知识库中的文件列表
- 支持添加、删除、重命名知识库文件
- 显示文件详细信息（文档片段数、嵌入维度）


### 3. IntentAnalysisSettings.js
**主要功能**: 意图分析模型配置
- 选择用于分析写作意图的 AI 模型
- 自定义意图分析提示词
- 支持重置为默认提示词


### 4. RetrievalSettings.js
**主要功能**: 检索参数配置
- 设置每次 RAG 检索返回的文档片段数量（Top-K）
- 参数验证（1-20 范围）


### 5. EmbeddingModelSelector.js
**主要功能**: 嵌入模型选择器
- 显示所有可用的嵌入模型
- 支持按提供商和模型名称搜索过滤
- 自动获取模型嵌入维度信息
- 实时模型切换和重新初始化


### 6. TextChunkingSettings.js
**主要功能**: 文本分段参数设置
- 配置文本分段大小（chunkSize）
- 配置文本重叠大小（chunkOverlap）
- 参数验证和关系检查


### 7. EmbeddingDimensionsSettings.js
**主要功能**: 嵌入向量维度设置
- 显示当前嵌入模型的默认维度
- （暂不支持自定义维度）