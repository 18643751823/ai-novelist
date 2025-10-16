import { NodeType, NodeData, WorkflowContext, NodeExecutionResult, NodeExecutor } from '../types';
import { toolRegistry } from '../registries/ToolRegistry';

/**
 * 工具节点执行器 - 处理工具函数调用
 */
export class ToolNodeExecutor implements NodeExecutor {
  readonly type = NodeType.TOOL;

  async execute(node: NodeData, context: WorkflowContext): Promise<NodeExecutionResult> {
    try {
      // 获取节点配置
      const config = node.data.config || {};
      
      // 获取工具名称
      const toolName = config.toolName;
      if (!toolName) {
        throw new Error('Tool name is required');
      }

      // 收集输入数据
      const inputs = this.collectInputs(node, context);
      
      // 执行工具
      const result = await toolRegistry.executeTool(toolName, inputs);

      return {
        nodeId: node.id,
        success: true,
        output: {
          result: result
        },
        executionTime: 0, // 将在WorkflowExecutor中计算
        timestamp: new Date()
      };

    } catch (error) {
      return {
        nodeId: node.id,
        success: false,
        error: error instanceof Error ? error.message : 'Tool execution failed',
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
}