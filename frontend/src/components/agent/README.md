# Agent 模块说明文档

本目录包含AI小说创作系统的Agent设置面板相关组件，负责管理不同AI模式（细纲、写作、调整）的配置和自定义功能。

## 目录结构

```
agent/
├── AgentPanel.js              # 主面板组件 - 统一管理所有模式设置
├── AgentPanel.css             # 主面板样式
├── ModeManager.js             # 模式管理核心逻辑
├── common/                    # 通用组件
│   ├── SettingGroup.js        # 设置项分组组件
│   ├── SettingGroup.css
│   ├── SliderComponent.js     # 滑动条组件
│   └── SliderComponent.css
├── parameterTab/              # AI参数设置标签页
│   ├── ChatParameters.js    # 高级参数设置组件
│   └── ChatParameters.css
├── promptTab/                 # 提示词管理标签页
│   ├── PromptManagerModal.js  # 提示词管理器模态框
│   └── PromptManagerModal.css
└── ragTab/                    # RAG设置标签页
    ├── AgentRagTab.js         # RAG检索设置组件
    └── AgentRagTab.css
```

## 文件功能说明

### 核心组件

#### [`AgentPanel.js`](AgentPanel.js:1)
**功能**: Agent设置UI主面板 - 专注于用户界面展示和交互
**职责**:
- 提供左侧模式列表和右侧设置面板的布局
- 渲染模式列表和设置界面
- 处理用户交互事件（点击、输入等）
- 调用ModeManager执行模式操作
- 集成三个标签页（提示词、RAG、AI参数）的UI展示
- 统一保存所有设置到Redux状态和持久化存储
- **不直接管理模式状态**，通过ModeManager获取数据

#### [`ModeManager.js`](ModeManager.js:1)
**功能**: 模式管理核心模块 - 单一数据源管理所有模式状态
**职责**:
- 定义内置模式配置（细纲、写作、调整）
- 提供内置模式的默认提示词
- **作为单一数据源管理所有模式状态**（内置 + 自定义）
- 处理自定义模式的增删改查操作
- 提供模式验证、ID生成和名称检查
- 处理模式设置数据的清理和迁移
- 提供模式过滤和搜索功能
- **自动初始化和管理模式状态**

### 通用组件

#### [`SettingGroup.js`](common/SettingGroup.js:1)
**功能**: 统一的设置项分组组件
**职责**:
- 提供一致的设置项布局和样式
- 支持可折叠功能
- 包含标题和描述信息
- 作为其他设置组件的容器

#### [`SliderComponent.js`](common/SliderComponent.js:1)
**功能**: 统一的滑动条组件
**职责**:
- 支持自定义范围、步长和标签
- 提供进度条可视化效果
- 支持不同类型的滑动条（参数、上下文等）
- 包含值显示和描述信息

### 标签页组件

#### [`ChatParameters.js`](parameterTab/ChatParameters.js:1)
**功能**: AI参数和上下文限制设置组件
**职责**:
- 管理AI模型参数（temperature、top_p、n）
- 设置对话上下文和RAG上下文的限制
- 支持轮数和满tokens两种限制模式
- 实时保存设置到后端

#### [`PromptManagerModal.js`](promptTab/PromptManagerModal.js:1)
**功能**: 提示词管理器模态框组件
**职责**:
- 管理各模式的自定义提示词
- 提供重置到默认提示词功能
- 处理附加信息设置（大纲、前章、角色设定）
- 集成AI参数设置功能

#### [`AgentRagTab.js`](ragTab/AgentRagTab.js:1)
**功能**: RAG检索设置组件
**职责**:
- 管理各模式的RAG检索启用状态
- 选择特定知识库文件进行检索
- 显示知识库文件列表和统计信息
- 实时保存RAG设置

## 模式分工

### 内置模式

1. **细纲模式** ([`ModeManager.js:13`](ModeManager.js:13))
   - 小说创作顾问，负责与用户深度沟通本章核心需求
   - 生成结构化细纲
   - 支持工具使用功能

2. **写作模式** ([`ModeManager.js:19`](ModeManager.js:19))
   - 专业小说代笔，基于最终版细纲进行创作
   - 扩展细纲为2000字左右的正文
   - 支持工具使用功能

3. **调整模式** ([`ModeManager.js:25`](ModeManager.js:25))
   - 资深编辑和小说精修师
   - 诊断问题并提供修改建议
   - 支持工具使用功能

### 自定义模式

- 支持用户创建自定义模式
- 可以设置自定义提示词和功能
- 与内置模式共享相同的设置结构

## 数据流

1. **状态管理**:
   - **模式状态**: 由ModeManager作为单一数据源管理
   - **设置状态**: 使用Redux管理所有设置状态
2. **持久化**: 通过IPC调用保存到后端存储
3. **实时更新**: 设置变更立即生效并保存
4. **回退机制**: 后端API失败时使用前端默认值
5. **职责分离**:
   - ModeManager: 管理模式状态和业务逻辑
   - AgentPanel: 处理UI展示和用户交互

## 主要功能

- ✅ 模式管理（内置 + 自定义）
- ✅ 提示词自定义
- ✅ AI参数设置（temperature、top_p、n）
- ✅ 上下文限制设置
- ✅ RAG检索配置
- ✅ 实时保存和重置功能
- ✅ 搜索和过滤模式

## 使用说明

1. 在左侧选择要配置的模式
2. 在右侧标签页中设置相应参数：
   - **提示词设置**: 自定义AI的提示词
   - **RAG设置**: 启用/禁用RAG检索并选择知识库文件
   - **AI参数**: 调整模型生成参数和上下文限制
3. 点击"保存"按钮应用所有设置
4. 使用"重置"按钮恢复默认设置

## 注意事项

- 所有模式都支持工具使用功能
- 自定义模式删除时会清理相关设置数据
- 上下文限制设置支持轮数和满tokens两种模式
- RAG设置需要先导入文件到知识库才能选择