const BaseModelAdapter = require('../BaseModelAdapter');
const OpenAI = require('openai');
const { XmlMatcher } = require('../../../utils/xmlMatcher');
const axios = require('axios');

class OllamaAdapter extends BaseModelAdapter {
  /**
   * Ollama 适配器构造函数
   * @param {Object} config - 适配器配置
   * @param {string} [config.baseURL="http://127.0.0.1:11434"] - Ollama API基础URL
   */
  constructor(config = {}) {
    const adapterConfig = {
      providerId: 'ollama',
      providerName: 'Ollama',
      providerType: 'ollama',
      isEnabled: true,
      ...config
    };

    super(adapterConfig);

    this.baseURL = config.baseURL || 'http://127.0.0.1:11434';
    
    // Ollama 提供兼容 OpenAI 的 API，所以我们可以直接使用 OpenAI 客户端
    this.client = new OpenAI({
      baseURL: `${this.baseURL}/v1`, // Ollama 的 OpenAI 兼容 API 端点
      apiKey: 'ollama', // Ollama 通常不需要 API Key，这里可以填任意值
      timeout: 30000,
      maxRetries: 2
    });

    this.xmlMatcher = new XmlMatcher(
      "think",
      (chunk) => ({
        type: chunk.matched ? "reasoning" : "text",
        text: chunk.data,
      })
    );
  }

  /**
   * 生成AI完成响应
   * @param {Array} messages - 聊天消息数组
   * @param {Object} options - 生成选项
   * @returns {AsyncIterable<Object>} 统一格式的AI响应异步迭代器
   */
  async *generateCompletion(messages, options = {}) {
    const modelId = options.model?.replace(/^ollama\//, '') || 'llama2'; // 移除 "ollama/" 前缀，默认使用 llama2
    const stream = options.stream !== false; // 默认启用流式

    // 注意：Ollama 的 OpenAI 兼容层目前可能不支持 `tools` 和 `tool_choice`
    // 我们按标准传递，但行为可能取决于具体模型和 Ollama 版本
    const tools = options.tools;
    const tool_choice = options.tool_choice;

    const payload = {
      model: modelId,
      messages: messages,
      stream: stream,
      temperature: options.temperature, // 使用前端传递的参数，不设置默认值
      top_p: options.top_p,
      n: options.n,
      ...(options.max_tokens && { max_tokens: options.max_tokens }),
      ...(options.stop && { stop: options.stop }),
      ...(tools && { tools }),
      ...(tool_choice && { tool_choice }),
    };

    try {
      if (stream) {
        const responseStream = await this.client.chat.completions.create({
          ...payload,
          stream: true,
          stream_options: { include_usage: true },
        });

        yield* this._transformStreamToGenerator(responseStream);
      } else {
        const response = await this.client.chat.completions.create(payload);
        const standardized = this._standardizeOpenAIMessage(response.choices[0].message, response.usage);
        
        yield {
          type: "text",
          text: standardized.content,
          ...(standardized.tool_calls && { tool_calls: standardized.tool_calls }),
          ...(standardized.usage && { usage: standardized.usage })
        };
      }
    } catch (error) {
      console.error('Error calling Ollama API:', error);
      throw this._standardizeError(error, 'API call failed');
    }
  }

  /**
   * 转换流式响应为生成器
   * @param {AsyncIterable} responseStream - OpenAI 流式响应
   * @returns {AsyncIterable<Object>} 标准化响应生成器
   * @private
   */
  async *_transformStreamToGenerator(responseStream) {
    let lastUsage = null;

    for await (const chunk of responseStream) {
      const delta = chunk.choices[0]?.delta;

      if (delta?.content) {
        for (const matcherChunk of this.xmlMatcher.update(delta.content)) {
          yield matcherChunk;
        }
      }

      if (delta?.tool_calls) {
        // 如果模型在 <think> 标签内返回 tool_calls，这可能需要更复杂的处理
        // 目前，我们假设 tool_calls 和 <think> 是互斥的
        yield {
          type: "tool_calls",
          tool_calls: delta.tool_calls,
        };
      }

      if (chunk.usage) {
        lastUsage = chunk.usage;
      }
    }
    
    // 处理匹配器中剩余的任何缓存内容
    for (const finalChunk of this.xmlMatcher.final()) {
      yield finalChunk;
    }

    if (lastUsage) {
      yield {
        type: 'usage',
        inputTokens: lastUsage.prompt_tokens || 0,
        outputTokens: lastUsage.completion_tokens || 0,
      };
    }
  }

  /**
   * 标准化 OpenAI 消息格式
   * @param {Object} openAiMessage - OpenAI 消息对象
   * @param {Object} usage - 使用量信息
   * @returns {Object} 标准化消息
   * @private
   */
  _standardizeOpenAIMessage(openAiMessage, usage) {
    const standardized = {
      role: openAiMessage.role,
      content: openAiMessage.content || '',
      tool_calls: openAiMessage.tool_calls || [],
      reasoning_content: null, // OpenAI API 不直接提供 reasoning_content
    };

    if (usage) {
      standardized.usage = {
        inputTokens: usage.prompt_tokens || 0,
        outputTokens: usage.completion_tokens || 0,
      };
    }
    return standardized;
  }

  /**
   * 列出提供商支持的所有模型
   * @returns {Promise<Array<Object>>} 模型信息列表
   */
  async listModels() {
    try {
      const response = await axios.get(`${this.baseURL}/api/tags`, { timeout: 5000 });
      const modelsArray = response.data?.models?.map((model) => model.name) || [];
      
      return [...new Set(modelsArray)].map(modelName => ({
        id: modelName,
        name: modelName,
        description: `Ollama model: ${modelName}`,
        provider: 'ollama',
        object: 'model',
        created: 0, // Ollama API 没有提供 created 时间戳
        owned_by: 'ollama',
        details: {},
      }));
    } catch (error) {
      console.warn('无法连接到Ollama服务，返回无服务状态。错误:', error.message);
      
      // ✅ 修复：返回无服务状态，而不是默认模型
      return [{
        id: 'no-service',
        name: '无服务',
        description: 'Ollama服务不可用，请启动服务后点击"重新检测"',
        provider: 'ollama',
        object: 'model',
        created: 0,
        owned_by: 'ollama',
        details: {
          serviceUnavailable: true,
          errorMessage: error.message
        },
      }];
    }
  }

  /**
   * 获取特定模型的详细信息
   * @param {string} modelId - 模型ID
   * @returns {Promise<Object>} 模型详细信息
   */
  async getModelInfo(modelId) {
    const models = await this.listModels();
    const model = models.find(m => m.id === modelId);
    
    if (!model) {
      throw new Error(`Ollama model '${modelId}' not found.`);
    }
    
    return model;
  }

  /**
   * 检查适配器是否可用
   * @returns {Promise<boolean>} 是否可用
   */
  async isAvailable() {
    try {
      await axios.get(`${this.baseURL}/api/tags`, { timeout: 3000 });
      return true;
    } catch (error) {
      console.warn('Ollama service is not available:', error.message);
      return false;
    }
  }

  /**
   * 配置验证（重写父类方法）
   * @param {Object} config - 配置对象
   * @returns {{isValid: boolean, errors: string[]}} 验证结果
   */
  validateConfig(config) {
    const errors = [];
    
    // 基础验证
    const baseValidation = super.validateConfig(config);
    if (!baseValidation.isValid) {
      return baseValidation;
    }

    // URL 格式验证
    if (config.baseURL) {
      try {
        new URL(config.baseURL);
      } catch (error) {
        errors.push('baseURL must be a valid URL');
      }
    }

    return { isValid: errors.length === 0, errors };
  }
}

module.exports = OllamaAdapter;