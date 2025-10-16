import { NodeType, NodeData, WorkflowContext, NodeExecutionResult, NodeExecutor } from '../types';

/**
 * 输入节点执行器 - 处理工作流输入
 */
export class InputNodeExecutor implements NodeExecutor {
  readonly type = NodeType.INPUT;

  async execute(node: NodeData, context: WorkflowContext): Promise<NodeExecutionResult> {
    try {
      // 输入节点直接传递工作流输入数据
      return {
        nodeId: node.id,
        success: true,
        output: {
          ...context.inputs
        },
        executionTime: 0,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        nodeId: node.id,
        success: false,
        error: error instanceof Error ? error.message : 'Input node execution failed',
        executionTime: 0,
        timestamp: new Date()
      };
    }
  }
}

/**
 * 输出节点执行器 - 处理工作流输出
 */
export class OutputNodeExecutor implements NodeExecutor {
  readonly type = NodeType.OUTPUT;

  async execute(node: NodeData, context: WorkflowContext): Promise<NodeExecutionResult> {
    try {
      // 收集所有上游节点的数据
      const outputData = this.collectOutputData(node, context);
      
      return {
        nodeId: node.id,
        success: true,
        output: outputData,
        executionTime: 0,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        nodeId: node.id,
        success: false,
        error: error instanceof Error ? error.message : 'Output node execution failed',
        executionTime: 0,
        timestamp: new Date()
      };
    }
  }

  /**
   * 收集输出数据
   */
  private collectOutputData(node: NodeData, context: WorkflowContext): Record<string, any> {
    const outputData: Record<string, any> = {};
    
    // 从所有上游节点收集数据
    const nodeResultKeys = Object.keys(context.results);
    for (const key of nodeResultKeys) {
      const result = context.results[key];
      if (result && result.success && result.output) {
        Object.assign(outputData, result.output);
      }
    }

    // 合并工作流输入
    Object.assign(outputData, context.inputs);

    return outputData;
  }
}