# Others 组件文件夹

这个文件夹包含一些通用的UI组件，用于整个应用程序的各种界面功能。

## 文件说明

### [`CombinedIcon.js`](frontend/react-app/src/components/others/CombinedIcon.js:1) 和 [`CombinedIcon.css`](frontend/react-app/src/components/others/CombinedIcon.css:1)
**组合图标组件**

- **功能**: 创建一个可以叠加多个图标的组合图标
- **使用场景**: 用于显示带有状态指示的图标，目前在章节列表栏，为文件图标和文件夹图标添加加号，表示“新建”含义

### [`ContextMenu.js`](frontend/react-app/src/components/others/ContextMenu.js:1) 和 [`ContextMenu.css`](frontend/react-app/src/components/others/ContextMenu.css:1)
**右键菜单组件**

- **功能**: 提供自定义的右键上下文菜单
- **使用场景**: 在编辑器、文件树等地方提供右键操作菜单

### [`NotificationModal.js`](frontend/react-app/src/components/others/NotificationModal.js:1) 和 [`NotificationModal.css`](frontend/react-app/src/components/others/NotificationModal.css:1)
**通知模态框组件**

- **功能**: 显示简单的通知消息对话框
- **使用场景**: 用于显示操作结果、警告信息或确认消息

### [`ConfirmationModal.js`](frontend/react-app/src/components/ConfirmationModal.js:1)
**功能**: 确认对话框组件
- 提供"确定"和"取消"两个按钮
- 支持键盘导航（左右箭头切换焦点，Enter确认，Esc取消）
- 复用 [`NotificationModal.css`](frontend/react-app/src/components/others/NotificationModal.css) 样式
- 自动焦点管理，确保正确的按钮获得焦点

