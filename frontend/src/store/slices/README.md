# Chat Store 模块化重构指南

## 概述

本项目对原有的 `chatSlice.js` 进行了模块化重构，将1000多行的庞大文件拆分为6个独立的子模块，便于管理和维护。

## 模块结构

```
frontend/src/store/slices/
├── chatSlice.js          # 主组合模块（轻量级）
├── messageSlice.js       # 消息管理模块
├── toolSlice.js          # 工具调用模块  
├── ragSlice.js           # RAG设置模块
├── apiSlice.js           # API配置模块
└── modeSlice.js          # 模式设置模块
```

## 各模块职责

### 1. messageSlice.js - 消息管理
- **职责**: 管理聊天消息、历史记录、流式传输
- **状态**:
  - `messages`: 消息列表
  - `questionCard`: 问题卡片
  - `isHistoryPanelVisible`: 历史面板显示状态
  - `editingMessageId`: 正在编辑的消息ID
  - `isStreaming`: 流式传输状态
  - `abortController`: 中止控制器

### 2. toolSlice.js - 工具调用
- **职责**: 管理工具调用状态、审批流程
- **状态**:
  - `pendingToolCalls`: 待处理工具调用
  - `toolCallState`: 工具调用状态
  - `enableStream`: 流式传输启用状态

### 3. ragSlice.js - RAG设置
- **职责**: 管理RAG检索、嵌入模型、知识库
- **状态**:
  - `ragRetrievalEnabled`: RAG检索启用状态
  - `ragState`: RAG统一状态管理
  - `modeFeatureSettings`: 模式特定的RAG设置

### 4. apiSlice.js - API配置
- **职责**: 管理API密钥、模型选择、服务配置
- **状态**:
  - 各提供商API密钥
  - `selectedModel`: 选择的模型
  - `selectedProvider`: 选择的提供商
  - `customProviders`: 自定义提供商列表

### 5. modeSlice.js - 模式设置
- **职责**: 管理提示词、上下文限制、AI参数
- **状态**:
  - `customPrompts`: 自定义提示词
  - `contextLimitSettings`: 上下文限制
  - `additionalInfo`: 附加信息
  - `aiParameters`: AI参数设置

### 6. chatSlice.js - 主模块
- **职责**: 组合所有子模块、管理界面状态
- **状态**:
  - 各种模态框显示状态
  - 面板显示状态

## 状态访问方式

### 重构前（旧方式）
```javascript
// 访问消息
const messages = useSelector(state => state.chat.messages);
// 访问API密钥
const apiKey = useSelector(state => state.chat.deepseekApiKey);
```

### 重构后（新方式）
```javascript
// 访问消息
const messages = useSelector(state => state.chat.message.messages);
// 访问API密钥
const apiKey = useSelector(state => state.chat.api.deepseekApiKey);
```

### 状态路径映射表

| 原状态路径 | 新状态路径 |
|-----------|-----------|
| `state.chat.messages` | `state.chat.message.messages` |
| `state.chat.pendingToolCalls` | `state.chat.tool.pendingToolCalls` |
| `state.chat.ragRetrievalEnabled` | `state.chat.rag.ragRetrievalEnabled` |
| `state.chat.deepseekApiKey` | `state.chat.api.deepseekApiKey` |
| `state.chat.customPrompts` | `state.chat.mode.customPrompts` |
| `state.chat.showApiSettingsModal` | `state.chat.ui.showApiSettingsModal` |

## Action使用方式

### 向后兼容性
所有原有的action creators都通过主 `chatSlice.js` 重新导出，因此现有的代码不需要修改：

```javascript
// 这些仍然正常工作
import { appendMessage, setSelectedModel } from '../store/slices/chatSlice';

dispatch(appendMessage(newMessage));
dispatch(setSelectedModel('gpt-4'));
```

### 新的模块化actions
如果需要更精确的控制，可以直接导入特定模块的actions：

```javascript
import { appendMessage } from '../store/slices/messageSlice';
import { setSelectedModel } from '../store/slices/apiSlice';

dispatch(appendMessage(newMessage));
dispatch(setSelectedModel('gpt-4'));
```

## 迁移指南

### 1. 状态访问迁移
如果您的组件直接访问chat状态，需要更新选择器：

```javascript
// 迁移前
const { messages, pendingToolCalls, deepseekApiKey } = useSelector(state => state.chat);

// 迁移后
const messages = useSelector(state => state.chat.message.messages);
const pendingToolCalls = useSelector(state => state.chat.tool.pendingToolCalls);
const deepseekApiKey = useSelector(state => state.chat.api.deepseekApiKey);
```

### 2. 批量状态访问
对于需要访问多个状态的组件，建议使用多个选择器：

```javascript
// 推荐方式
const messages = useSelector(state => state.chat.message.messages);
const toolState = useSelector(state => state.chat.tool.toolCallState);
const apiKey = useSelector(state => state.chat.api.deepseekApiKey);

// 或者创建组合选择器
const selectChatState = state => ({
  messages: state.chat.message.messages,
  toolState: state.chat.tool.toolCallState,
  apiKey: state.chat.api.deepseekApiKey
});
```

### 3. 测试更新
确保更新相关的单元测试和集成测试，使用新的状态路径。

## 优势

1. **更好的代码组织**: 每个模块职责单一，便于理解和维护
2. **减少耦合**: 各模块独立，修改一个模块不会影响其他模块
3. **便于测试**: 可以单独测试每个模块
4. **更好的性能**: 更细粒度的状态更新
5. **向后兼容**: 现有的action使用方式保持不变

## 注意事项

1. **状态路径变化**: 访问状态时需要更新路径
2. **模块间依赖**: 跨模块操作需要通过主chatSlice协调
3. **调试工具**: Redux DevTools中会显示模块化的状态结构

## 扩展指南

### 添加新模块
1. 在新文件中创建slice
2. 在主chatSlice中导入并组合
3. 重新导出actions

### 修改现有模块
1. 直接修改对应的slice文件
2. 确保不破坏其他模块的接口

## 故障排除

如果遇到状态访问问题，请检查：
1. 状态路径是否正确
2. 是否导入了正确的action
3. Redux DevTools中的状态结构

如有问题，请参考各模块的详细注释和类型定义。