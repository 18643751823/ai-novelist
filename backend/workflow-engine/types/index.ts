// 工作流引擎类型定义

// 节点类型枚举
export enum NodeType {
  LLM = 'llm',
  TOOL = 'tool',
  CONDITION = 'condition',
  INPUT = 'input',
  OUTPUT = 'output',
  MEMORY = 'memory'
}

// 节点数据接口
export interface NodeData {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: {
    name: string;
    category: NodeCategory;
    inputs: NodeInput[];
    outputs: NodeOutput[];
    config?: Record<string, any>;
  };
}

// 节点类别
export interface NodeCategory {
  name: string;
  color: string;
  description: string;
}

// 节点输入
export interface NodeInput {
  id: string;
  type: string;
  label: string;
  defaultValue?: any;
}

// 节点输出
export interface NodeOutput {
  id: string;
  type: string;
  label: string;
}

// 连接边
export interface Edge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

// 工作流定义
export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  nodes: NodeData[];
  edges: Edge[];
  createdAt: Date;
  updatedAt: Date;
}

// 工作流执行上下文
export interface WorkflowContext {
  workflowId: string;
  inputs: Record<string, any>;
  variables: Record<string, any>;
  results: Record<string, NodeExecutionResult>;
  memory?: Record<string, any>;
}

// 节点执行结果
export interface NodeExecutionResult {
  nodeId: string;
  success: boolean;
  output?: any;
  error?: string;
  executionTime: number;
  timestamp: Date;
}

// 工作流执行结果
export interface WorkflowExecutionResult {
  workflowId: string;
  success: boolean;
  outputs: Record<string, any>;
  nodeResults: Record<string, NodeExecutionResult>;
  totalExecutionTime: number;
  timestamp: Date;
}

// 节点执行器接口
export interface NodeExecutor {
  type: NodeType;
  execute(node: NodeData, context: WorkflowContext): Promise<NodeExecutionResult>;
}

// 工具定义
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
  execute(inputs: Record<string, any>): Promise<any>;
}

// 模型配置
export interface ModelConfig {
  provider: string;
  modelName: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
}

// 工作流执行选项
export interface WorkflowExecutionOptions {
  timeout?: number;
  maxRetries?: number;
  validateConnections?: boolean;
  debug?: boolean;
}