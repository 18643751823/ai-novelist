import { NodeType, NodeData, WorkflowContext, NodeExecutionResult, NodeExecutor } from '../types';

/**
 * LLM节点执行器 - 处理语言模型调用
 */
export class LLMNodeExecutor implements NodeExecutor {
  readonly type = NodeType.LLM;

  async execute(node: NodeData, context: WorkflowContext): Promise<NodeExecutionResult> {
    try {
      // 获取节点配置
      const config = node.data.config || {};
      
      // 收集输入数据
      const inputs = this.collectInputs(node, context);
      
      // 构建提示词
      const prompt = this.buildPrompt(config.prompt, inputs);
      
      // 调用语言模型
      const response = await this.callLanguageModel({
        model: config.model || 'gpt-3.5-turbo',
        temperature: config.temperature || 0.7,
        maxTokens: config.maxTokens || 1000,
        prompt
      });

      return {
        nodeId: node.id,
        success: true,
        output: {
          response: response
        },
        executionTime: 0, // 将在WorkflowExecutor中计算
        timestamp: new Date()
      };

    } catch (error) {
      return {
        nodeId: node.id,
        success: false,
        error: error instanceof Error ? error.message : 'LLM execution failed',
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

    return inputs;
  }

  /**
   * 构建提示词
   */
  private buildPrompt(promptTemplate: string, inputs: Record<string, any>): string {
    if (!promptTemplate) {
      return inputs.prompt || inputs.input || 'Please provide a response.';
    }

    // 简单的模板替换
    let prompt = promptTemplate;
    for (const [key, value] of Object.entries(inputs)) {
      const placeholder = `{{${key}}}`;
      if (prompt.includes(placeholder)) {
        prompt = prompt.replace(new RegExp(placeholder, 'g'), String(value));
      }
    }

    return prompt;
  }

  /**
   * 调用语言模型
   * 这里需要集成现有的模型调用系统
   */
  private async callLanguageModel(config: {
    model: string;
    temperature: number;
    maxTokens: number;
    prompt: string;
  }): Promise<string> {
    try {
      // 这里需要集成现有的模型调用系统
      // 例如从 backend/engine/models/ 加载模型适配器
      
      // 临时模拟实现
      console.log(`Calling LLM: ${config.model}`);
      console.log(`Prompt: ${config.prompt.substring(0, 100)}...`);
      
      // 模拟API调用延迟
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 返回模拟响应
      return `This is a simulated response from ${config.model} for the prompt: "${config.prompt.substring(0, 50)}..."`;

    } catch (error) {
      console.error('LLM call failed:', error);
      throw new Error(`Failed to call language model: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}