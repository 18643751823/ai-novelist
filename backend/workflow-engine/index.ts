import { NodeType, WorkflowDefinition, WorkflowExecutionOptions, WorkflowExecutionResult } from './types';
import { nodeRegistry } from './registries/NodeRegistry';
import { toolRegistry } from './registries/ToolRegistry';
import { WorkflowExecutor } from './executors/WorkflowExecutor';

// 导入所有节点执行器
import { LLMNodeExecutor } from './executors/LLMNodeExecutor';
import { ToolNodeExecutor } from './executors/ToolNodeExecutor';
import { ConditionNodeExecutor } from './executors/ConditionNodeExecutor';
import { InputNodeExecutor, OutputNodeExecutor } from './executors/IONodeExecutor';
import { MemoryNodeExecutor } from './executors/MemoryNodeExecutor';

/**
 * LangChain工作流引擎主类
 */
export class WorkflowEngine {
  private workflowExecutor: WorkflowExecutor;
  private isInitialized = false;

  constructor(options: WorkflowExecutionOptions = {}) {
    this.workflowExecutor = new WorkflowExecutor(options);
  }

  /**
   * 初始化工作流引擎
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // 注册所有节点执行器
      this.registerNodeExecutors();

      // 加载工具
      await toolRegistry.loadToolsFromExistingSystem();

      this.isInitialized = true;
      console.log('Workflow engine initialized successfully');

    } catch (error) {
      console.error('Failed to initialize workflow engine:', error);
      throw error;
    }
  }

  /**
   * 注册所有节点执行器
   */
  private registerNodeExecutors(): void {
    // LLM节点
    nodeRegistry.registerExecutor(new LLMNodeExecutor());

    // 工具节点
    nodeRegistry.registerExecutor(new ToolNodeExecutor());

    // 条件节点
    nodeRegistry.registerExecutor(new ConditionNodeExecutor());

    // 输入/输出节点
    nodeRegistry.registerExecutor(new InputNodeExecutor());
    nodeRegistry.registerExecutor(new OutputNodeExecutor());

    // 记忆节点
    nodeRegistry.registerExecutor(new MemoryNodeExecutor());

    console.log(`Registered ${nodeRegistry.getRegisteredNodeTypes().length} node executors`);
  }

  /**
   * 执行工作流
   */
  async executeWorkflow(
    workflow: WorkflowDefinition,
    inputs: Record<string, any> = {}
  ): Promise<WorkflowExecutionResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return await this.workflowExecutor.execute(workflow, inputs);
  }

  /**
   * 验证工作流定义
   */
  validateWorkflow(workflow: WorkflowDefinition): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 检查基本结构
    if (!workflow.id) {
      errors.push('Workflow ID is required');
    }

    if (!workflow.nodes || workflow.nodes.length === 0) {
      errors.push('Workflow must contain at least one node');
    }

    // 检查节点类型是否支持
    for (const node of workflow.nodes) {
      if (!nodeRegistry.isNodeTypeRegistered(node.type as NodeType)) {
        errors.push(`Unsupported node type: ${node.type}`);
      }
    }

    // 检查连接有效性
    for (const edge of workflow.edges || []) {
      const sourceNode = workflow.nodes.find(n => n.id === edge.source);
      const targetNode = workflow.nodes.find(n => n.id === edge.target);
      
      if (!sourceNode) {
        errors.push(`Source node not found for edge: ${edge.id}`);
      }
      if (!targetNode) {
        errors.push(`Target node not found for edge: ${edge.id}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 获取支持的节点类型
   */
  getSupportedNodeTypes(): NodeType[] {
    return nodeRegistry.getRegisteredNodeTypes();
  }

  /**
   * 获取可用工具列表
   */
  getAvailableTools() {
    return toolRegistry.getAllTools();
  }

  /**
   * 检查工具是否存在
   */
  hasTool(toolName: string): boolean {
    return toolRegistry.hasTool(toolName);
  }
}

// 创建默认工作流引擎实例
export const workflowEngine = new WorkflowEngine();

// 导出主要类型和组件
export * from './types';
export { WorkflowExecutor } from './executors/WorkflowExecutor';
export { nodeRegistry } from './registries/NodeRegistry';
export { toolRegistry } from './registries/ToolRegistry';