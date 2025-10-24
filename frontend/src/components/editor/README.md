# Editor 组件目录说明

本目录包含小说编辑器的主要组件，负责文本编辑、差异对比、分屏显示等功能。

**重要变更**: 项目已从 Tiptap 编辑器重构为 Vditor 编辑器，提供更好的 Markdown 编辑体验。

## 文件结构概览

```
editor/
├── BackgroundImage.js      # 背景图片动画组件
├── BackgroundImage.css     # 背景图片样式
├── DiffViewer.js          # 差异对比查看器
├── DiffViewer.css         # 差异对比样式
├── EditorPanel.js         # 主编辑器面板
├── EditorPanel.css        # 编辑器面板样式
├── SplitViewPanel.js      # 分屏对比面板
├── SplitViewPanel.css     # 分屏对比样式
├── TabBar.js              # 标签栏组件
├── TabBar.css             # 标签栏样式
├── VditorEditor.jsx       # Vditor 编辑器封装组件
├── README.md              # 本说明文档
├── hooks/                 # 自定义 React Hooks
│   └── useContextMenu.js  # 上下文菜单 Hook
├── services/              # 编辑器服务模块
│   ├── AutoSaveService.js # 自动保存服务
│   ├── CharacterCountService.js # 字符计数服务
│   ├── TitleManager.js    # 标题管理服务
│   └── VditorLifecycleManager.js # Vditor 生命周期管理
└── utils/                 # 工具函数
    └── editorHelpers.js   # 编辑器辅助函数
```

## 组件详细说明

### 1. BackgroundImage.js

**功能**: 提供动态背景图片效果，增强编辑器视觉体验

**主要特性**:
- 三层背景图片叠加显示
- 卷云层：逆时针旋转动画（20秒/圈）
- 雷云层：顺时针旋转动画（16秒/圈）
- 烛火层：垂直浮动动画（正弦波效果）

**核心方法**:
- `useEffect`: 设置三个定时器分别控制不同图层的动画
- 组件卸载时清理所有定时器

**依赖资源**:
- `卷云.png`: 卷云背景图片
- `雷云.png`: 雷云背景图片  
- `烛火.png`: 烛火背景图片

### 2. VditorEditor.jsx

**功能**: Vditor Markdown 编辑器封装组件，提供完整的 Markdown 编辑体验

**主要特性**:
- 基于 Vditor 的 Markdown 编辑器
- 支持即时渲染 (IR) 模式
- 丰富的工具栏功能（标题、粗体、斜体、列表、表格等）
- 图片上传和拖拽上传支持
- 复制为纯文本功能
- 语法高亮和代码块支持
- 数学公式渲染 (KaTeX)
- 深色主题支持

**核心方法**:
- `useEffect`: 处理 Vditor 实例的初始化和销毁
- `useImperativeHandle`: 提供编辑器 API 给父组件
- 图片上传处理器：集成 IPC 进行文件上传

**技术依赖**:
- `vditor`: Markdown 编辑器核心
- `vditor/dist/index.css`: 编辑器样式
- IPC 通信：图片上传功能

### 3. DiffViewer.js

**功能**: 文本差异对比查看器，支持并排显示原始版本和修改后版本

**主要特性**:
- 使用 `diffChars` 算法进行字符级差异分析
- 左侧显示原始版本（删除内容高亮）
- 右侧显示修改后版本（新增内容高亮）
- 双编辑器滚动同步
- 基于 Vditor 的 Markdown 编辑器

**核心方法**:
- `useEffect`: 处理差异计算和编辑器初始化
- 滚动同步机制防止循环触发

**技术依赖**:
- `diff`: 差异计算库
- `vditor`: Markdown 编辑器

### 4. EditorPanel.js

**功能**: 主编辑器面板，提供完整的文本编辑功能

**主要特性**:
- 基于 Vditor 的 Markdown 编辑器
- 自动保存机制（3秒延迟）
- 字符计数统计
- 右键上下文菜单
- 支持分屏模式
- 差异对比模式
- 标题编辑功能

**核心状态管理**:
- `editorRef`: Vditor 编辑器实例引用
- `autoSaveTimerRef`: 自动保存定时器
- `initialContentRef`: 初始内容引用，用于判断是否修改

**主要方法**:
- `saveContent`: 文件保存逻辑
- `handleEditorChange`: 编辑器内容变化处理
- `calculateCharacterCount`: 字符计数计算

**服务模块集成**:
- `useAutoSave`: 自动保存服务
- `useVditorLifecycle`: Vditor 生命周期管理
- `useCharacterCount`: 字符计数服务
- `useTitleManager`: 标题管理服务
- `useContextMenu`: 上下文菜单管理

**生命周期管理**:
- 组件挂载时初始化 Vditor 编辑器
- 标签页切换时管理编辑器实例
- 内容同步确保编辑器与 Redux 状态一致

### 4. SplitViewPanel.js

**功能**: 分屏对比面板，支持左右并排编辑

**主要特性**:
- 可调整大小的面板布局
- 支持水平和垂直分屏
- 左右面板文件选择器
- 面板交换功能
- 基于 `react-resizable-panels` 的布局管理

**核心功能**:
- `handleTabSwap`: 交换左右面板内容
- `handleTabSelect`: 选择分屏文件
- `handleCloseSplitView`: 关闭分屏模式

**布局选项**:
- `horizontal`: 水平分屏（默认）
- `vertical`: 垂直分屏

### 5. TabBar.js

**功能**: 标签栏管理组件，支持标签页的打开、关闭、排序

**主要特性**:
- 标签页拖拽排序
- 分屏对比功能入口
- 未保存状态指示
- 已删除文件标识

**核心交互**:
- `handleDragStart/End/Over/Drop`: 拖拽排序逻辑
- `handleSplitView`: 分屏对比功能
- `handleCloseTab`: 关闭标签页

**状态指示**:
- `*`: 未保存修改
- `🗑️`: 文件已删除

## 数据流架构

```
Redux Store (novelSlice)
    ↓
EditorPanel / SplitViewPanel / TabBar
    ↓
Tiptap Editor Instance
    ↓
用户交互 → 状态更新 → 自动保存
```

## 关键技术点

1. **编辑器管理**: 使用 Tiptap 作为富文本编辑器，支持 Markdown 风格编辑
2. **状态同步**: 通过 Redux 管理编辑器状态，确保多组件间数据一致性
3. **性能优化**: 合理使用 `useCallback` 和 `useRef` 避免不必要的重渲染
4. **错误处理**: 完善的错误捕获和用户提示机制
5. **自动保存**: 智能的自动保存策略，避免数据丢失
