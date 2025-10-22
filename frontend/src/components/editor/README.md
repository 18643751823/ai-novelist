# Editor 组件目录说明

本目录包含小说编辑器的主要组件，负责文本编辑、差异对比、分屏显示等功能。

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
└── README.md              # 本说明文档
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

### 2. DiffViewer.js

**功能**: 文本差异对比查看器，支持并排显示原始版本和修改后版本

**主要特性**:
- 使用 `diffChars` 算法进行字符级差异分析
- 左侧显示原始版本（删除内容高亮）
- 右侧显示修改后版本（新增内容高亮）
- 双编辑器滚动同步
- 基于 Tiptap 的富文本编辑器

**核心方法**:
- `DiffHighlightExtension`: 自定义 Tiptap 扩展，用于差异高亮
- `useEffect`: 处理差异计算和编辑器初始化
- 滚动同步机制防止循环触发

**技术依赖**:
- `@tiptap/core`: 富文本编辑器核心
- `@tiptap/starter-kit`: 基础编辑器功能
- `diff`: 差异计算库
- `prosemirror-view`: 编辑器视图层

### 3. EditorPanel.js

**功能**: 主编辑器面板，提供完整的文本编辑功能

**主要特性**:
- 基于 Tiptap 的富文本编辑器
- 自动保存机制（3秒延迟）
- 手动保存支持
- 字符计数统计
- 行号显示
- 右键上下文菜单
- 支持分屏模式
- 差异对比模式

**核心状态管理**:
- `TiptapEditorInstance`: Tiptap 编辑器实例引用
- `autoSaveTimerRef`: 自动保存定时器
- `initialContentRef`: 初始内容引用，用于判断是否修改

**主要方法**:
- `saveContent`: 文件保存逻辑
- `handleEditorChange`: 编辑器内容变化处理
- `updateParagraphs`: 更新行号显示
- `calculateCharacterCount`: 字符计数计算

**生命周期管理**:
- 组件挂载时创建 Tiptap 实例
- 标签页切换时销毁/重新创建实例
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

## 使用注意事项

1. 编辑器实例在标签页切换时会销毁重建，确保内存管理
2. 自动保存有 3 秒延迟，避免频繁 IO 操作
3. 分屏模式需要至少打开两个文件
4. 差异对比功能需要提供原始内容和修改后内容