// 工作流编辑器类型定义

// 节点类型
export const NODE_TYPES = {
  LLM: 'llm',
  TOOL: 'tool',
  CONDITION: 'condition',
  INPUT: 'input',
  OUTPUT: 'output',
  MEMORY: 'memory'
};

// 节点数据接口
export const NODE_CATEGORIES = {
  LLM: {
    name: 'LLM节点',
    color: '#4CAF50',
    description: '语言模型调用节点'
  },
  TOOL: {
    name: '工具节点',
    color: '#2196F3',
    description: '工具执行节点'
  },
  CONDITION: {
    name: '条件节点',
    color: '#FF9800',
    description: '条件分支控制节点'
  },
  INPUT: {
    name: '输入节点',
    color: '#9C27B0',
    description: '数据输入节点'
  },
  OUTPUT: {
    name: '输出节点',
    color: '#F44336',
    description: '数据输出节点'
  },
  MEMORY: {
    name: '记忆节点',
    color: '#607D8B',
    description: '记忆管理节点'
  }
};

// 节点配置
export const NODE_CONFIGS = {
  [NODE_TYPES.LLM]: {
    name: 'ChatModel',
    category: NODE_CATEGORIES.LLM,
    inputs: [
      { id: 'model', type: 'select', label: '模型', options: [
        { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
        { value: 'gpt-4', label: 'GPT-4' },
        { value: 'claude-3', label: 'Claude 3' }
      ] },
      { id: 'temperature', type: 'number', label: '温度', defaultValue: 0.7 },
      { id: 'maxTokens', type: 'number', label: '最大Token数', defaultValue: 1000 },
      { id: 'prompt', type: 'string', label: '提示词', multiline: true }
    ],
    outputs: [
      { id: 'response', type: 'string', label: '响应' }
    ]
  },
  [NODE_TYPES.TOOL]: {
    name: '工具节点',
    category: NODE_CATEGORIES.TOOL,
    inputs: [
      { id: 'toolName', type: 'select', label: '工具名称', options: [
        { value: 'search', label: '搜索工具' },
        { value: 'calculator', label: '计算器' },
        { value: 'file_reader', label: '文件读取器' }
      ] },
      { id: 'input', type: 'string', label: '输入参数' }
    ],
    outputs: [
      { id: 'result', type: 'any', label: '结果' }
    ]
  },
  [NODE_TYPES.CONDITION]: {
    name: '条件分支',
    category: NODE_CATEGORIES.CONDITION,
    inputs: [
      { id: 'condition', type: 'string', label: '条件表达式' }
    ],
    outputs: [
      { id: 'true', type: 'any', label: '真分支' },
      { id: 'false', type: 'any', label: '假分支' }
    ]
  },
  [NODE_TYPES.INPUT]: {
    name: '输入节点',
    category: NODE_CATEGORIES.INPUT,
    inputs: [
      { id: 'inputValue', type: 'string', label: '输入值' }
    ],
    outputs: [
      { id: 'output', type: 'any', label: '输出' }
    ]
  },
  [NODE_TYPES.OUTPUT]: {
    name: '输出节点',
    category: NODE_CATEGORIES.OUTPUT,
    inputs: [
      { id: 'input', type: 'any', label: '输入数据' }
    ],
    outputs: []
  },
  [NODE_TYPES.MEMORY]: {
    name: '记忆节点',
    category: NODE_CATEGORIES.MEMORY,
    inputs: [
      { id: 'key', type: 'string', label: '记忆键' },
      { id: 'value', type: 'string', label: '记忆值' },
      { id: 'operation', type: 'select', label: '操作类型', options: [
        { value: 'set', label: '设置' },
        { value: 'get', label: '获取' },
        { value: 'delete', label: '删除' }
      ] }
    ],
    outputs: [
      { id: 'memory', type: 'any', label: '记忆数据' }
    ]
  }
};

// 节点数据接口
export const createNodeData = (type, position = { x: 0, y: 0 }, data = {}) => ({
  id: `${type}-${Date.now()}`,
  type,
  position,
  data: {
    ...NODE_CONFIGS[type],
    ...data
  }
});

// 连接类型兼容性
export const TYPE_COMPATIBILITY = {
  'string': ['string', 'text', 'any'],
  'number': ['number', 'any'],
  'boolean': ['boolean', 'any'],
  'object': ['object', 'any'],
  'array': ['array', 'any'],
  'any': ['string', 'number', 'boolean', 'object', 'array', 'any']
};