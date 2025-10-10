import { NodeType, NodeExecutor, NodeData, WorkflowContext, NodeExecutionResult } from '../types';

/**
 * 节点注册器 - 管理所有节点类型的执行器
 */
export class NodeRegistry {
  private executors: Map<NodeType, NodeExecutor> = new Map();

  /**
   * 注册节点执行器
   */
  registerExecutor(executor: NodeExecutor): void {
    this.executors.set(executor.type, executor);
  }

  /**
   * 获取节点执行器
   */
  getExecutor(nodeType: NodeType): NodeExecutor {
    const executor = this.executors.get(nodeType);
    if (!executor) {
      throw new Error(`No executor registered for node type: ${nodeType}`);
    }
    return executor;
  }

  /**
   * 执行节点
   */
  async executeNode(node: NodeData, context: WorkflowContext): Promise<NodeExecutionResult> {
    const executor = this.getExecutor(node.type as NodeType);
    return await executor.execute(node, context);
  }

  /**
   * 获取所有已注册的节点类型
   */
  getRegisteredNodeTypes(): NodeType[] {
    return Array.from(this.executors.keys());
  }

  /**
   * 检查节点类型是否已注册
   */
  isNodeTypeRegistered(nodeType: NodeType): boolean {
    return this.executors.has(nodeType);
  }
}

// 创建全局节点注册器实例
export const nodeRegistry = new NodeRegistry();