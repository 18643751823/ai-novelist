# 工作流引擎集成指南

## 概述

本文档说明如何将基于LangChain的工作流引擎集成到现有的AI Novelist项目中。

## 集成步骤

### 1. 后端集成

#### 1.1 在主进程中注册IPC处理器

在 `main.js` 或相应的主进程文件中添加：

```javascript
// 导入工作流IPC处理器
const { workflowIpcHandler } = require('./backend/workflow-engine/ipc/WorkflowIpcHandler');

// 在应用准备就绪后初始化
app.whenReady().then(async () => {
  // ... 现有代码 ...
  
  // 初始化工作流引擎
  try {
    await workflowIpcHandler.initialize();
    console.log('Workflow engine initialized');
  } catch (error) {
    console.error('Failed to initialize workflow engine:', error);
  }
});
```

#### 1.2 更新TypeScript配置

确保 `tsconfig.backend.json` 包含工作流引擎目录：

```json
{
  "include": [
    "backend/**/*.ts",
    "backend/**/*.js",
    "backend/workflow-engine/**/*.ts"
  ]
}
```

### 2. 前端集成

#### 2.1 工作区面板更新

工作区面板已经更新为使用自定义工作流编辑器，替换了原来的Flowise嵌入。

#### 2.2 IPC通信

前端通过 `workflowIpcHandler` 与后端通信：

```javascript
import workflowIpcHandler from '../ipc/workflowIpcHandler';

// 执行工作流
const result = await workflowIpcHandler.executeWorkflow(workflowData, inputs);

// 验证工作流
const validation = await workflowIpcHandler.validateWorkflow(workflowData);

// 保存工作流
await workflowIpcHandler.saveWorkflow(workflowData);
```

### 3. 与现有系统集成

#### 3.1 模型配置集成

工作流引擎需要访问现有的模型配置系统。在 `LLMNodeExecutor` 中：

```typescript
// 需要集成 backend/engine/models/ 中的模型适配器
const modelAdapter = await getModelAdapter(config.model);
const response = await modelAdapter.generate(config.prompt);
```

#### 3.2 工具系统集成

工作流引擎需要集成现有的工具系统。在 `ToolRegistry` 中：

```typescript
// 需要从 backend/tool-service/tools/definitions.js 加载工具定义
const existingTools = await loadExistingTools();
existingTools.forEach(tool => this.registerTool(tool));
```

#### 3.3 RAG知识库集成

记忆节点可以集成RAG功能：

```typescript
// 需要集成 backend/rag-service/ 中的向量检索功能
const retriever = await getVectorStoreRetriever();
const memories = await retriever.getRelevantDocuments(query);
```

## 节点类型与LangChain组件映射

### 核心节点类型

1. **LLM节点** (`NodeType.LLM`)
   - 对应: `ChatOpenAI`, `ChatAnthropic` 等
   - 功能: 语言模型调用
   - 集成: 现有模型配置系统

2. **工具节点** (`NodeType.TOOL`)
   - 对应: `Tool`, `DynamicTool`
   - 功能: 工具函数执行
   - 集成: 现有工具系统

3. **条件节点** (`NodeType.CONDITION`)
   - 对应: `ConditionalRouter`, `IfElseChain`
   - 功能: 条件分支控制

4. **输入/输出节点** (`NodeType.INPUT/OUTPUT`)
   - 功能: 工作流数据接口

5. **记忆节点** (`NodeType.MEMORY`)
   - 对应: `BufferMemory`, `VectorStoreRetrieverMemory`
   - 功能: 记忆管理
   - 集成: RAG知识库系统

## 配置说明

### 工作流定义格式

```typescript
interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  nodes: NodeData[];
  edges: Edge[];
  createdAt: Date;
  updatedAt: Date;
}
```

### 节点配置示例

```typescript
// LLM节点配置
{
  type: NodeType.LLM,
  data: {
    config: {
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      maxTokens: 1000,
      prompt: '请回答：{{question}}'
    }
  }
}

// 工具节点配置
{
  type: NodeType.TOOL,
  data: {
    config: {
      toolName: 'search_files',
      pattern: '*.md'
    }
  }
}

// 条件节点配置
{
  type: NodeType.CONDITION,
  data: {
    config: {
      condition: '{{score}} >= 60'
    }
  }
}
```

## 扩展开发

### 添加自定义节点

1. 创建节点执行器：
```typescript
export class CustomNodeExecutor implements NodeExecutor {
  readonly type = NodeType.CUSTOM;
  
  async execute(node: NodeData, context: WorkflowContext): Promise<NodeExecutionResult> {
    // 实现节点逻辑
  }
}
```

2. 注册节点执行器：
```typescript
nodeRegistry.registerExecutor(new CustomNodeExecutor());
```

3. 在前端添加节点类型：
```javascript
// 在 types/index.js 中添加
export const NODE_TYPES = {
  // ... 现有类型 ...
  CUSTOM: 'custom'
};

// 在节点库中添加
const nodeLibrary = [
  // ... 现有节点 ...
  {
    type: NODE_TYPES.CUSTOM,
    name: '自定义节点',
    description: '自定义功能节点',
    icon: '⭐'
  }
];
```

### 集成新的LangChain组件

1. 在对应的节点执行器中集成新的LangChain组件
2. 更新类型定义以支持新的配置参数
3. 在前端添加相应的配置界面

## 故障排除

### 常见问题

1. **节点执行失败**
   - 检查节点配置是否正确
   - 验证输入数据格式
   - 查看后端日志获取详细错误信息

2. **工作流验证错误**
   - 检查节点连接是否有效
   - 验证类型兼容性
   - 确保没有循环依赖

3. **IPC通信失败**
   - 确认后端IPC处理器已正确初始化
   - 检查通道名称是否匹配
   - 验证数据序列化

### 调试模式

启用调试模式以获取详细日志：

```typescript
const workflowEngine = new WorkflowEngine({
  debug: true
});
```

## 性能优化建议

1. **节点懒加载**: 对于复杂节点，实现懒加载机制
2. **结果缓存**: 对重复计算的结果进行缓存
3. **并行执行**: 对无依赖的节点进行并行执行
4. **内存管理**: 及时清理不再需要的执行上下文

## 安全考虑

1. **表达式评估**: 条件节点使用安全的表达式评估
2. **工具执行**: 限制工具的系统访问权限
3. **输入验证**: 对所有输入数据进行严格验证
4. **资源限制**: 设置执行时间和内存使用限制