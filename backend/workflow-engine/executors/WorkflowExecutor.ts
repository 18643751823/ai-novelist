import { 
  WorkflowDefinition, 
  WorkflowContext, 
  WorkflowExecutionResult, 
  NodeExecutionResult,
  WorkflowExecutionOptions,
  NodeData,
  Edge
} from '../types';
import { nodeRegistry } from '../registries/NodeRegistry';

/**
 * 工作流执行器 - 核心执行引擎
 */
export class WorkflowExecutor {
  private options: Required<WorkflowExecutionOptions>;

  constructor(options: WorkflowExecutionOptions = {}) {
    this.options = {
      timeout: options.timeout || 30000,
      maxRetries: options.maxRetries || 3,
      validateConnections: options.validateConnections ?? true,
      debug: options.debug ?? false
    };
  }

  /**
   * 执行工作流
   */
  async execute(
    workflow: WorkflowDefinition, 
    inputs: Record<string, any> = {}
  ): Promise<WorkflowExecutionResult> {
    const startTime = Date.now();
    
    try {
      // 验证工作流
      if (this.options.validateConnections) {
        this.validateWorkflow(workflow);
      }

      // 创建执行上下文
      const context: WorkflowContext = {
        workflowId: workflow.id,
        inputs,
        variables: {},
        results: {},
        memory: {}
      };

      // 拓扑排序确定执行顺序
      const executionOrder = this.topologicalSort(workflow.nodes, workflow.edges);

      // 按顺序执行节点
      for (const nodeId of executionOrder) {
        const node = workflow.nodes.find(n => n.id === nodeId);
        if (!node) continue;

        await this.executeNode(node, workflow.edges, context);
      }

      // 收集输出结果
      const outputs = this.collectOutputs(workflow, context);

      const executionTime = Date.now() - startTime;

      return {
        workflowId: workflow.id,
        success: true,
        outputs,
        nodeResults: context.results,
        totalExecutionTime: executionTime,
        timestamp: new Date()
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      return {
        workflowId: workflow.id,
        success: false,
        outputs: {},
        nodeResults: {},
        totalExecutionTime: executionTime,
        timestamp: new Date()
      };
    }
  }

  /**
   * 执行单个节点
   */
  private async executeNode(
    node: NodeData, 
    edges: Edge[], 
    context: WorkflowContext
  ): Promise<void> {
    const nodeStartTime = Date.now();

    try {
      // 收集节点输入数据
      const nodeInputs = this.gatherNodeInputs(node, edges, context);

      // 更新上下文中的输入数据
      context.variables = { ...context.variables, ...nodeInputs };

      // 执行节点
      const result = await nodeRegistry.executeNode(node, context);

      const executionTime = Date.now() - nodeStartTime;

      // 保存执行结果
      context.results[node.id] = {
        ...result,
        executionTime,
        timestamp: new Date()
      };

      if (this.options.debug) {
        console.log(`Node ${node.id} executed in ${executionTime}ms`);
      }

    } catch (error) {
      const executionTime = Date.now() - nodeStartTime;
      
      context.results[node.id] = {
        nodeId: node.id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime,
        timestamp: new Date()
      };

      throw error;
    }
  }

  /**
   * 收集节点输入数据
   */
  private gatherNodeInputs(node: NodeData, edges: Edge[], context: WorkflowContext): Record<string, any> {
    const inputs: Record<string, any> = {};

    // 从上游节点收集数据
    const incomingEdges = edges.filter(edge => edge.target === node.id);
    
    for (const edge of incomingEdges) {
      const sourceNodeId = edge.source;
      const sourceResult = context.results[sourceNodeId];
      
      if (sourceResult && sourceResult.success) {
        // 根据句柄ID映射数据
        const outputKey = edge.sourceHandle || 'output';
        const inputKey = edge.targetHandle || 'input';
        
        if (sourceResult.output && sourceResult.output[outputKey] !== undefined) {
          inputs[inputKey] = sourceResult.output[outputKey];
        }
      }
    }

    // 合并节点配置中的默认值
    if (node.data.config) {
      Object.assign(inputs, node.data.config);
    }

    return inputs;
  }

  /**
   * 拓扑排序 - 确定节点执行顺序
   */
  private topologicalSort(nodes: NodeData[], edges: Edge[]): string[] {
    const nodeIds = nodes.map(node => node.id);
    const graph: Map<string, string[]> = new Map();
    const inDegree: Map<string, number> = new Map();

    // 初始化图和入度
    nodeIds.forEach(id => {
      graph.set(id, []);
      inDegree.set(id, 0);
    });

    // 构建图
    edges.forEach(edge => {
      if (graph.has(edge.source) && graph.has(edge.target)) {
        graph.get(edge.source)!.push(edge.target);
        inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
      }
    });

    // 找到入度为0的节点（起始节点）
    const queue: string[] = nodeIds.filter(id => inDegree.get(id) === 0);
    const result: string[] = [];

    // 执行拓扑排序
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      result.push(nodeId);

      for (const neighbor of graph.get(nodeId) || []) {
        inDegree.set(neighbor, inDegree.get(neighbor)! - 1);
        if (inDegree.get(neighbor) === 0) {
          queue.push(neighbor);
        }
      }
    }

    // 检查是否有环
    if (result.length !== nodeIds.length) {
      throw new Error('Workflow contains cycles or disconnected nodes');
    }

    return result;
  }

  /**
   * 验证工作流连接
   */
  private validateWorkflow(workflow: WorkflowDefinition): void {
    // 检查所有连接的目标节点是否存在
    for (const edge of workflow.edges) {
      const sourceNode = workflow.nodes.find(n => n.id === edge.source);
      const targetNode = workflow.nodes.find(n => n.id === edge.target);
      
      if (!sourceNode) {
        throw new Error(`Source node not found for edge: ${edge.id}`);
      }
      if (!targetNode) {
        throw new Error(`Target node not found for edge: ${edge.id}`);
      }
    }

    // 检查是否有孤立节点
    const connectedNodes = new Set(workflow.edges.flatMap(edge => [edge.source, edge.target]));
    const isolatedNodes = workflow.nodes.filter(node => !connectedNodes.has(node.id));
    
    if (isolatedNodes.length > 0 && workflow.nodes.length > 1) {
      console.warn('Workflow contains isolated nodes:', isolatedNodes.map(n => n.id));
    }
  }

  /**
   * 收集输出结果
   */
  private collectOutputs(workflow: WorkflowDefinition, context: WorkflowContext): Record<string, any> {
    const outputs: Record<string, any> = {};

    // 找到所有输出节点
    const outputNodes = workflow.nodes.filter(node => node.type === 'output');
    
    for (const node of outputNodes) {
      const result = context.results[node.id];
      if (result && result.success && result.output) {
        Object.assign(outputs, result.output);
      }
    }

    return outputs;
  }
}