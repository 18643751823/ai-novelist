const BaseModelAdapter = require('../BaseModelAdapter');
const OpenAI = require('openai');

class AliyunAdapter extends BaseModelAdapter {
  /**
   * 阿里云百炼适配器构造函数
   * @param {Object} config - 适配器配置
   * @param {string} config.apiKey - 阿里云API密钥
   * @param {string} [config.baseURL="https://dashscope.aliyuncs.com/compatible-mode/v1"] - API基础URL
   */
  constructor(config) {
    const adapterConfig = {
      providerId: 'aliyun',
      providerName: '阿里云百炼',
      providerType: 'aliyun',
      isEnabled: true,
      ...config
    };

    super(adapterConfig);

    this.apiKey = config.apiKey;
    this.baseURL = config.baseURL || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
    this.client = null; // 延迟初始化
    this.providerModels = {}; // 模型缓存
  }

  /**
   * 获取 OpenAI 客户端（延迟初始化）
   * @returns {OpenAI|null} OpenAI 客户端实例，如果没有API密钥则返回null
   * @private
   */
  _getClient() {
    if (!this.client) {
      if (!this.apiKey) {
        console.warn("阿里云百炼 API key is not set. Please configure it in the settings.");
        return null; // 返回null而不是抛出错误
      }

      this.client = new OpenAI({
        apiKey: this.apiKey,
        baseURL: this.baseURL,
        defaultHeaders: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Authorization": `Bearer ${this.apiKey}`
        },
        timeout: 30000,
        maxRetries: 2
      });
    }
    return this.client;
  }

  /**
   * 生成AI完成响应
   * @param {Array} messages - 聊天消息数组
   * @param {Object} options - 生成选项
   * @returns {AsyncIterable<Object>} 统一格式的AI响应异步迭代器
   */
  async *generateCompletion(messages, options = {}) {
    let modelId = options.model || 'qwen-plus'; // 默认使用 qwen-plus

    // 在发送到阿里云API之前，移除内部使用的 'aliyun/' 前缀
    if (modelId.startsWith('aliyun/')) {
      modelId = modelId.substring('aliyun/'.length);
    }

    const completionParams = {
      model: modelId,
      messages: messages,
      temperature: options.temperature, // 使用前端传递的参数，不设置默认值
      max_tokens: options.max_tokens,
      stream: options.stream !== false, // 默认启用流式
      top_p: options.top_p,
      n: options.n,
      frequency_penalty: options.frequency_penalty,
      presence_penalty: options.presence_penalty,
      stop: options.stop
    };

    // 传递工具相关参数
    if (options.tools && options.tools.length > 0) {
      completionParams.tools = options.tools;
      completionParams.tool_choice = options.tool_choice || "auto";
    }

    try {
      const client = this._getClient();

      if (completionParams.stream) {
        const stream = await client.chat.completions.create(completionParams);
        yield* this._transformStreamToGenerator(stream);
      } else {
        const response = await client.chat.completions.create(completionParams);
        const message = response.choices[0]?.message;
        
        if (message) {
          yield {
            type: "text",
            text: message.content || '',
            ...(message.tool_calls && { tool_calls: message.tool_calls })
          };

          if (response.usage) {
            yield {
              type: "usage",
              inputTokens: response.usage.prompt_tokens || 0,
              outputTokens: response.usage.completion_tokens || 0,
            };
          }
        }
      }
    } catch (error) {
      console.error('阿里云百炼 API call failed:', error);
      throw this._standardizeError(error, 'API call failed');
    }
  }

  /**
   * 转换流式响应为生成器
   * @param {AsyncIterable} stream - OpenAI 流式响应
   * @returns {AsyncIterable<Object>} 标准化响应生成器
   * @private
   */
  async *_transformStreamToGenerator(stream) {
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;

      if (delta?.content) {
        yield {
          type: "text",
          text: delta.content
        };
      }

      if (delta?.tool_calls) {
        yield {
          type: "tool_calls",
          tool_calls: delta.tool_calls,
        };
      }

      if (chunk.usage) {
        yield {
          type: "usage",
          inputTokens: chunk.usage.prompt_tokens || 0,
          outputTokens: chunk.usage.completion_tokens || 0,
        };
      }
    }
  }

  /**
   * 列出提供商支持的所有模型
   * @returns {Promise<Array<Object>>} 模型信息列表
   */
  async listModels() {
    try {
      const client = this._getClient();
      if (!client) {
        // 如果没有API密钥，返回默认模型列表
        return this._getDefaultModels();
      }

      const modelsList = await client.models.list();
      
      // 检查 modelsList 和 modelsList.data 是否存在
      if (!modelsList || !modelsList.data) {
        console.warn('阿里云百炼 API returned empty models list, using default models');
        return this._getDefaultModels();
      }
      
      const models = Array.from(modelsList.data);
      
      // 更新内部的 providerModels 缓存
      models.forEach(model => {
        this.providerModels[model.id] = {
          ...model,
          provider: this.providerId,
          name: model.id // 使用模型ID作为名称
        };
      });

      // 阿里云百炼的API不返回嵌入模型，需要手动添加
      const embeddingModels = this._getEmbeddingModels();
      embeddingModels.forEach(model => {
        this.providerModels[model.id] = model;
      });

      // 返回符合格式的列表
      return Object.values(this.providerModels);
    } catch (error) {
      console.error('Failed to fetch models from 阿里云百炼:', error);
      // 如果获取失败，返回已知的默认模型
      return this._getDefaultModels();
    }
  }

  /**
   * 获取嵌入模型列表
   * @returns {Array<Object>} 嵌入模型列表
   * @private
   */
  _getEmbeddingModels() {
    return [
      // 文本嵌入模型
      {
        id: 'text-embedding-v4',
        name: 'Text Embedding V4',
        description: '阿里云最新文本嵌入模型，支持多维度选择',
        provider: 'aliyun',
        maxTokens: 8192,
        isEmbedding: true
      },
      {
        id: 'text-embedding-v3',
        name: 'Text Embedding V3',
        description: '阿里云文本嵌入模型 V3',
        provider: 'aliyun',
        maxTokens: 8192,
        isEmbedding: true
      },
      {
        id: 'text-embedding-v2',
        name: 'Text Embedding V2',
        description: '阿里云文本嵌入模型 V2',
        provider: 'aliyun',
        maxTokens: 2048,
        isEmbedding: true
      },
      {
        id: 'text-embedding-v1',
        name: 'Text Embedding V1',
        description: '阿里云文本嵌入模型 V1',
        provider: 'aliyun',
        maxTokens: 2048,
        isEmbedding: true
      },
      {
        id: 'text-embedding-async-v2',
        name: 'Text Embedding Async V2',
        description: '阿里云异步文本嵌入模型 V2，支持批量处理',
        provider: 'aliyun',
        maxTokens: 2048,
        isEmbedding: true
      },
      {
        id: 'text-embedding-async-v1',
        name: 'Text Embedding Async V1',
        description: '阿里云异步文本嵌入模型 V1',
        provider: 'aliyun',
        maxTokens: 2048,
        isEmbedding: true
      },
      // 多模态嵌入模型
      {
        id: 'tongyi-embedding-vision-plus',
        name: 'Tongyi Embedding Vision Plus',
        description: '阿里云多模态嵌入模型 Plus，支持文本、图像、视频',
        provider: 'aliyun',
        maxTokens: 1024,
        isEmbedding: true
      },
      {
        id: 'tongyi-embedding-vision-flash',
        name: 'Tongyi Embedding Vision Flash',
        description: '阿里云轻量多模态嵌入模型，支持文本、图像、视频',
        provider: 'aliyun',
        maxTokens: 1024,
        isEmbedding: true
      },
      {
        id: 'multimodal-embedding-v1',
        name: 'Multimodal Embedding V1',
        description: '阿里云通用多模态嵌入模型 V1',
        provider: 'aliyun',
        maxTokens: 512,
        isEmbedding: true
      }
    ];
  }

  /**
   * 获取默认模型列表
   * @returns {Array<Object>} 默认模型列表
   * @private
   */
  _getDefaultModels() {
    return [
      // 聊天模型
      {
        id: 'qwen-turbo',
        name: 'Qwen Turbo',
        description: '阿里云通义千问 Turbo 模型',
        provider: 'aliyun',
        maxTokens: 8192
      },
      {
        id: 'qwen-plus',
        name: 'Qwen Plus',
        description: '阿里云通义千问 Plus 模型',
        provider: 'aliyun',
        maxTokens: 32768
      },
      {
        id: 'qwen-max',
        name: 'Qwen Max',
        description: '阿里云通义千问 Max 模型',
        provider: 'aliyun',
        maxTokens: 8192
      },
      {
        id: 'qwen-long',
        name: 'Qwen Long',
        description: '阿里云通义千问 Long 模型',
        provider: 'aliyun',
        maxTokens: 10000000
      },
      {
        id: 'qwen-vl-plus',
        name: 'Qwen VL Plus',
        description: '阿里云通义千问视觉语言模型',
        provider: 'aliyun',
        maxTokens: 8192
      },
      {
        id: 'qwen-vl-max',
        name: 'Qwen VL Max',
        description: '阿里云通义千问视觉语言模型 Max',
        provider: 'aliyun',
        maxTokens: 8192
      },
      // 嵌入模型
      ...this._getEmbeddingModels()
    ];
  }

  /**
   * 获取特定模型的详细信息
   * @param {string} modelId - 模型ID
   * @returns {Promise<Object>} 模型详细信息
   */
  async getModelInfo(modelId) {
    // 先从缓存中查找
    if (this.providerModels[modelId]) {
      return this.providerModels[modelId];
    }

    // 如果缓存中没有，尝试获取所有模型
    const models = await this.listModels();
    const model = models.find(m => m.id === modelId);
    
    if (!model) {
      throw new Error(`模型 '${modelId}' 不存在于 AliyunAdapter 中。`);
    }
    
    return model;
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

    // 阿里云百炼特定验证 - API密钥改为可选，允许无密钥注册
    // 如果没有API密钥，适配器仍然可以注册，但无法实际使用
    if (!config.apiKey) {
      console.warn('阿里云百炼 API key is not set. Adapter will be registered but cannot be used until configured.');
    }

    return { isValid: true, errors }; // 总是返回有效，允许注册
  }
  /**
   * 获取嵌入模型的维度
   * @param {string} modelId - 模型ID
   * @returns {Promise<number>} 嵌入维度
   */
  async getEmbeddingDimensions(modelId) {
    try {
      const client = this._getClient();
      if (!client) {
        throw new Error('阿里云百炼客户端未初始化，请检查 API 密钥配置');
      }

      // 检查是否为嵌入模型
      if (!this.isEmbeddingModel(modelId)) {
        throw new Error(`模型 ${modelId} 不是嵌入模型`);
      }

      // 移除 aliyun/ 前缀，使用实际的模型名称
      const actualModelName = modelId.replace(/^aliyun\//, '');
      
      // 发送测试请求获取嵌入向量
      const response = await client.embeddings.create({
        model: actualModelName,
        input: 'test',
        encoding_format: 'float'
      });

      // 从响应中提取嵌入向量长度
      if (response.data && response.data.length > 0 && response.data[0].embedding) {
        return response.data[0].embedding.length;
      } else {
        throw new Error('无法从响应中获取嵌入向量');
      }
    } catch (error) {
      console.error(`获取阿里云百炼模型 ${modelId} 嵌入维度失败:`, error);
      throw this._standardizeError(error, '获取嵌入维度失败');
    }
  }

  /**
   * 更新配置
   * @param {Object} newConfig - 新配置
   * @returns {Promise<void>}
   */
  async updateConfig(newConfig) {
    // 重置客户端以应用新配置
    if (newConfig.apiKey || newConfig.baseURL) {
      this.client = null;
      this.providerModels = {}; // 清空模型缓存
    }
    
    await super.updateConfig(newConfig);
  }
}

module.exports = AliyunAdapter;