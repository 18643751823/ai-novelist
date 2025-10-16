import { WorkflowDefinition, NodeType } from '../types';
import { workflowEngine } from '../index';

/**
 * 简单工作流示例 - 问答系统
 * 输入 -> LLM处理 -> 输出
 */
export const simpleQaWorkflow: WorkflowDefinition = {
  id: 'simple-qa-workflow',
  name: '简单问答工作流',
  description: '一个简单的问答工作流示例',
  createdAt: new Date(),
  updatedAt: new Date(),
  nodes: [
    {
      id: 'input-1',
      type: NodeType.INPUT,
      position: { x: 100, y: 100 },
      data: {
        name: '输入',
        category: {
          name: '输入节点',
          color: '#9C27B0',
          description: '数据输入节点'
        },
        inputs: [],
        outputs: [
          { id: 'output', type: 'any', label: '输出' }
        ]
      }
    },
    {
      id: 'llm-1',
      type: NodeType.LLM,
      position: { x: 300, y: 100 },
      data: {
        name: 'ChatModel',
        category: {
          name: 'LLM节点',
          color: '#4CAF50',
          description: '语言模型调用节点'
        },
        inputs: [
          { id: 'model', type: 'string', label: '模型' },
          { id: 'temperature', type: 'number', label: '温度' },
          { id: 'maxTokens', type: 'number', label: '最大Token数' },
          { id: 'prompt', type: 'string', label: '提示词' }
        ],
        outputs: [
          { id: 'response', type: 'string', label: '响应' }
        ],
        config: {
          model: 'gpt-3.5-turbo',
          temperature: 0.7,
          maxTokens: 500,
          prompt: '请回答以下问题：{{question}}'
        }
      }
    },
    {
      id: 'output-1',
      type: NodeType.OUTPUT,
      position: { x: 500, y: 100 },
      data: {
        name: '输出',
        category: {
          name: '输出节点',
          color: '#F44336',
          description: '数据输出节点'
        },
        inputs: [
          { id: 'input', type: 'any', label: '输入' }
        ],
        outputs: []
      }
    }
  ],
  edges: [
    {
      id: 'edge-1',
      source: 'input-1',
      target: 'llm-1',
      sourceHandle: 'output',
      targetHandle: 'prompt'
    },
    {
      id: 'edge-2',
      source: 'llm-1',
      target: 'output-1',
      sourceHandle: 'response',
      targetHandle: 'input'
    }
  ]
};

/**
 * 条件分支工作流示例
 * 输入 -> 条件判断 -> 真分支/假分支 -> 输出
 */
export const conditionalWorkflow: WorkflowDefinition = {
  id: 'conditional-workflow',
  name: '条件分支工作流',
  description: '包含条件分支的工作流示例',
  createdAt: new Date(),
  updatedAt: new Date(),
  nodes: [
    {
      id: 'input-1',
      type: NodeType.INPUT,
      position: { x: 100, y: 100 },
      data: {
        name: '输入',
        category: {
          name: '输入节点',
          color: '#9C27B0',
          description: '数据输入节点'
        },
        inputs: [],
        outputs: [
          { id: 'output', type: 'any', label: '输出' }
        ]
      }
    },
    {
      id: 'condition-1',
      type: NodeType.CONDITION,
      position: { x: 300, y: 100 },
      data: {
        name: '条件分支',
        category: {
          name: '条件节点',
          color: '#FF9800',
          description: '条件分支控制节点'
        },
        inputs: [
          { id: 'condition', type: 'boolean', label: '条件' }
        ],
        outputs: [
          { id: 'true', type: 'any', label: '真分支' },
          { id: 'false', type: 'any', label: '假分支' }
        ],
        config: {
          condition: '{{score}} >= 60'
        }
      }
    },
    {
      id: 'llm-pass',
      type: NodeType.LLM,
      position: { x: 500, y: 50 },
      data: {
        name: '通过处理',
        category: {
          name: 'LLM节点',
          color: '#4CAF50',
          description: '语言模型调用节点'
        },
        inputs: [
          { id: 'prompt', type: 'string', label: '提示词' }
        ],
        outputs: [
          { id: 'response', type: 'string', label: '响应' }
        ],
        config: {
          model: 'gpt-3.5-turbo',
          prompt: '恭喜通过！分数：{{score}}'
        }
      }
    },
    {
      id: 'llm-fail',
      type: NodeType.LLM,
      position: { x: 500, y: 150 },
      data: {
        name: '失败处理',
        category: {
          name: 'LLM节点',
          color: '#4CAF50',
          description: '语言模型调用节点'
        },
        inputs: [
          { id: 'prompt', type: 'string', label: '提示词' }
        ],
        outputs: [
          { id: 'response', type: 'string', label: '响应' }
        ],
        config: {
          model: 'gpt-3.5-turbo',
          prompt: '很遗憾未通过，请继续努力。分数：{{score}}'
        }
      }
    },
    {
      id: 'output-1',
      type: NodeType.OUTPUT,
      position: { x: 700, y: 100 },
      data: {
        name: '输出',
        category: {
          name: '输出节点',
          color: '#F44336',
          description: '数据输出节点'
        },
        inputs: [
          { id: 'input', type: 'any', label: '输入' }
        ],
        outputs: []
      }
    }
  ],
  edges: [
    {
      id: 'edge-1',
      source: 'input-1',
      target: 'condition-1',
      sourceHandle: 'output',
      targetHandle: 'condition'
    },
    {
      id: 'edge-2',
      source: 'condition-1',
      target: 'llm-pass',
      sourceHandle: 'true',
      targetHandle: 'prompt'
    },
    {
      id: 'edge-3',
      source: 'condition-1',
      target: 'llm-fail',
      sourceHandle: 'false',
      targetHandle: 'prompt'
    },
    {
      id: 'edge-4',
      source: 'llm-pass',
      target: 'output-1',
      sourceHandle: 'response',
      targetHandle: 'input'
    },
    {
      id: 'edge-5',
      source: 'llm-fail',
      target: 'output-1',
      sourceHandle: 'response',
      targetHandle: 'input'
    }
  ]
};

/**
 * 运行工作流示例
 */
export async function runWorkflowExample() {
  try {
    console.log('初始化工作流引擎...');
    await workflowEngine.initialize();

    console.log('\n=== 运行简单问答工作流 ===');
    const qaResult = await workflowEngine.executeWorkflow(simpleQaWorkflow, {
      question: '什么是人工智能？'
    });

    console.log('工作流执行结果:', {
      success: qaResult.success,
      executionTime: qaResult.totalExecutionTime,
      outputs: qaResult.outputs
    });

    console.log('\n=== 运行条件分支工作流 ===');
    const conditionalResult = await workflowEngine.executeWorkflow(conditionalWorkflow, {
      score: 75
    });

    console.log('条件工作流执行结果:', {
      success: conditionalResult.success,
      executionTime: conditionalResult.totalExecutionTime,
      outputs: conditionalResult.outputs
    });

    console.log('\n=== 节点执行详情 ===');
    for (const [nodeId, result] of Object.entries(conditionalResult.nodeResults)) {
      console.log(`节点 ${nodeId}:`, {
        success: result.success,
        executionTime: result.executionTime,
        output: result.output
      });
    }

  } catch (error) {
    console.error('工作流执行失败:', error);
  }
}

// 如果直接运行此文件，执行示例
if (require.main === module) {
  runWorkflowExample();
}