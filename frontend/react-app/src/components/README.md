# Components 目录说明

## 顶层文件概览

### [`LayoutComponent.js`](frontend/react-app/src/components/LayoutComponent.js:1)
**功能**: 主布局容器组件
- 管理整个应用的布局结构
- 包含可调整大小的面板（左侧章节面板、中间编辑器面板、右侧聊天面板）
- 集成侧边栏、分屏对比、Tab栏等功能
- 处理各种设置模态框的显示逻辑

### [`OverlayPanel.js`](frontend/react-app/src/components/OverlayPanel.js:1)
**功能**: 覆盖层面板组件
- 在特定区域显示半透明覆盖层
- 动态计算覆盖区域，确保只覆盖指定部分
- 支持各种模态框内容的显示

### [`SidebarComponent.js`](frontend/react-app/src/components/SidebarComponent.js:1)
**功能**: 侧边栏导航组件
- 固定宽度的图标栏（50px）
- 包含首页、工作区、API设置、RAG知识库、通用设置、插入信息等功能入口
- 管理各个模态框的打开/关闭状态
- 提供悬停提示功能
