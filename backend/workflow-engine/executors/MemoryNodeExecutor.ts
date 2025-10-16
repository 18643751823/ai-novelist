import { NodeType, NodeData, WorkflowContext, NodeExecutionResult, NodeExecutor } from '../types';

/**
 * 记忆节点执行器 - 处理记忆管理
 */
export class MemoryNodeExecutor implements NodeExecutor {
  readonly type = NodeType.MEMORY;

  async execute(node: NodeData, context: WorkflowContext): Promise<NodeExecutionResult> {
    try {
      // 获取节点配置
      const config = node.data.config || {};
      
      // 收集输入数据
      const inputs = this.collectInputs(node, context);
      
      // 处理记忆操作
      const memoryResult = await this.processMemoryOperation(config, inputs, context);
      
      return {
        nodeId: node.id,
        success: true,
        output: {
          memory: memoryResult
        },
        executionTime: 0, // 将在WorkflowExecutor中计算
        timestamp: new Date()
      };

    } catch (error) {
      return {
        nodeId: node.id,
        success: false,
        error: error instanceof Error ? error.message : 'Memory operation failed',
        executionTime: 0,
        timestamp: new Date()
      };
    }
  }

  /**
   * 收集节点输入数据
   */
  private collectInputs(node: NodeData, context: WorkflowContext): Record<string, any> {
    const inputs: Record<string, any> = {};
    
    // 从上游节点收集数据
    const nodeResultKeys = Object.keys(context.results);
    for (const key of nodeResultKeys) {
      const result = context.results[key];
      if (result && result.success && result.output) {
        Object.assign(inputs, result.output);
      }
    }

    // 合并工作流输入
    Object.assign(inputs, context.inputs);

    // 合并节点配置
    Object.assign(inputs, node.data.config || {});

    return inputs;
  }

  /**
   * 处理记忆操作
   */
  private async processMemoryOperation(
    config: Record<string, any>,
    inputs: Record<string, any>,
    context: WorkflowContext
  ): Promise<any> {
    const operation = config.operation || 'store';
    const key = config.key || inputs.key;
    const value = config.value || inputs.value;

    // 初始化记忆存储
    if (!context.memory) {
      context.memory = {};
    }

    switch (operation.toLowerCase()) {
      case 'store':
      case 'save':
        return this.storeMemory(key, value, context.memory);

      case 'retrieve':
      case 'load':
        return this.retrieveMemory(key, context.memory);

      case 'update':
        return this.updateMemory(key, value, context.memory);

      case 'delete':
      case 'remove':
        return this.deleteMemory(key, context.memory);

      case 'clear':
        return this.clearMemory(context.memory);

      default:
        throw new Error(`Unknown memory operation: ${operation}`);
    }
  }

  /**
   * 存储记忆
   */
  private storeMemory(key: string, value: any, memory: Record<string, any>): any {
    if (!key) {
      throw new Error('Memory key is required for store operation');
    }
    
    memory[key] = value;
    return { stored: true, key, value };
  }

  /**
   * 检索记忆
   */
  private retrieveMemory(key: string, memory: Record<string, any>): any {
    if (!key) {
      // 如果没有指定key，返回所有记忆
      return { memory: { ...memory } };
    }
    
    const value = memory[key];
    return { retrieved: true, key, value, exists: value !== undefined };
  }

  /**
   * 更新记忆
   */
  private updateMemory(key: string, value: any, memory: Record<string, any>): any {
    if (!key) {
      throw new Error('Memory key is required for update operation');
    }
    
    if (memory[key] === undefined) {
      throw new Error(`Memory key not found: ${key}`);
    }
    
    memory[key] = value;
    return { updated: true, key, value };
  }

  /**
   * 删除记忆
   */
  private deleteMemory(key: string, memory: Record<string, any>): any {
    if (!key) {
      throw new Error('Memory key is required for delete operation');
    }
    
    const value = memory[key];
    delete memory[key];
    return { deleted: true, key, value, existed: value !== undefined };
  }

  /**
   * 清空记忆
   */
  private clearMemory(memory: Record<string, any>): any {
    const keys = Object.keys(memory);
    const clearedCount = keys.length;
    
    for (const key of keys) {
      delete memory[key];
    }
    
    return { cleared: true, count: clearedCount };
  }
}