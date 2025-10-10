import { NodeType, NodeData, WorkflowContext, NodeExecutionResult, NodeExecutor } from '../types';

/**
 * 条件节点执行器 - 处理条件分支逻辑
 */
export class ConditionNodeExecutor implements NodeExecutor {
  readonly type = NodeType.CONDITION;

  async execute(node: NodeData, context: WorkflowContext): Promise<NodeExecutionResult> {
    try {
      // 获取节点配置
      const config = node.data.config || {};
      
      // 收集输入数据
      const inputs = this.collectInputs(node, context);
      
      // 评估条件
      const conditionResult = this.evaluateCondition(config.condition, inputs);
      
      // 根据条件结果选择输出分支
      const outputBranch = conditionResult ? 'true' : 'false';

      return {
        nodeId: node.id,
        success: true,
        output: {
          branch: outputBranch,
          condition: conditionResult,
          data: inputs // 传递输入数据到下游
        },
        executionTime: 0, // 将在WorkflowExecutor中计算
        timestamp: new Date()
      };

    } catch (error) {
      return {
        nodeId: node.id,
        success: false,
        error: error instanceof Error ? error.message : 'Condition evaluation failed',
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
   * 评估条件表达式
   */
  private evaluateCondition(condition: string, inputs: Record<string, any>): boolean {
    if (!condition) {
      // 如果没有明确条件，检查是否有condition输入
      return Boolean(inputs.condition);
    }

    try {
      // 简单的条件表达式评估
      // 支持常见的比较操作符和逻辑操作符
      const expression = this.prepareExpression(condition, inputs);
      
      // 使用Function构造函数安全地评估表达式
      // 注意：在生产环境中应该使用更安全的表达式解析器
      const result = new Function('inputs', `return ${expression}`)(inputs);
      
      return Boolean(result);

    } catch (error) {
      console.error('Condition evaluation error:', error);
      
      // 如果表达式评估失败，尝试简单的字符串比较
      return this.fallbackConditionEvaluation(condition, inputs);
    }
  }

  /**
   * 准备条件表达式
   */
  private prepareExpression(condition: string, inputs: Record<string, any>): string {
    let expression = condition;
    
    // 替换变量引用
    for (const [key, value] of Object.entries(inputs)) {
      const placeholder = `{{${key}}}`;
      if (expression.includes(placeholder)) {
        if (typeof value === 'string') {
          expression = expression.replace(new RegExp(placeholder, 'g'), `"${value}"`);
        } else {
          expression = expression.replace(new RegExp(placeholder, 'g'), String(value));
        }
      }
    }

    // 支持简单的布尔值替换
    expression = expression
      .replace(/\btrue\b/gi, 'true')
      .replace(/\bfalse\b/gi, 'false')
      .replace(/\band\b/gi, '&&')
      .replace(/\bor\b/gi, '||')
      .replace(/\bnot\b/gi, '!');

    return expression;
  }

  /**
   * 回退条件评估方法
   */
  private fallbackConditionEvaluation(condition: string, inputs: Record<string, any>): boolean {
    // 简单的字符串比较
    if (condition.includes('===') || condition.includes('==')) {
      const [left, right] = condition.split(/===|==/).map(part => part.trim());
      const leftValue = this.resolveValue(left, inputs);
      const rightValue = this.resolveValue(right, inputs);
      return leftValue == rightValue;
    }

    if (condition.includes('!==') || condition.includes('!=')) {
      const [left, right] = condition.split(/!==|!=/).map(part => part.trim());
      const leftValue = this.resolveValue(left, inputs);
      const rightValue = this.resolveValue(right, inputs);
      return leftValue != rightValue;
    }

    // 默认情况下，检查条件是否为真值
    const conditionValue = this.resolveValue(condition, inputs);
    return Boolean(conditionValue);
  }

  /**
   * 解析值（支持变量引用）
   */
  private resolveValue(value: string, inputs: Record<string, any>): any {
    value = value.trim();
    
    // 如果是变量引用
    if (value.startsWith('{{') && value.endsWith('}}')) {
      const key = value.slice(2, -2).trim();
      return inputs[key];
    }
    
    // 如果是字符串字面量
    if ((value.startsWith('"') && value.endsWith('"')) || 
        (value.startsWith("'") && value.endsWith("'"))) {
      return value.slice(1, -1);
    }
    
    // 如果是数字
    if (!isNaN(Number(value))) {
      return Number(value);
    }
    
    // 如果是布尔值
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
    
    // 默认返回原始值
    return value;
  }
}