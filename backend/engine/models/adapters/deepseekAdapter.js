const BaseModelAdapter = require('../BaseModelAdapter');
const { OpenAI } = require('openai');

class DeepSeekAdapter extends BaseModelAdapter {
  /**
   * DeepSeek 适配器构造函数
   * @param {Object} config - 适配器配置
   * @param {string} config.apiKey - DeepSeek API密钥
   * @param {string} [config.baseURL="https://api.deepseek.com"] - API基础URL
   */
  constructor(config) {
    const adapterConfig = {
      providerId: 'deepseek',
      providerName: 'DeepSeek',
      providerType: 'openai',
      isEnabled: true,
      ...config
    };

    super(adapterConfig);

    this.apiKey = config.apiKey;
    this.baseURL = config.baseURL || "https://api.deepseek.com";
    this.openaiClient = null; // 延迟初始化

    // DeepSeek 明确支持的模型
    this.supportedModels = [
      { 
        id: "deepseek-chat", 
        name: "DeepSeek Chat", 
        description: "DeepSeek 的聊天模型", 
        provider: "deepseek",
        maxTokens: 4096
      },
      { 
        id: "deepseek-coder", 
        name: "DeepSeek Coder", 
        description: "DeepSeek 的代码模型", 
        provider: "deepseek",
        maxTokens: 4096
      },
      { 
        id: "deepseek-reasoner", 
        name: "DeepSeek Reasoner", 
        description: "DeepSeek 的推理模型 (R1)", 
        provider: "deepseek",
        maxTokens: 4096
      }
    ];
  }

  /**
   * 获取 OpenAI 客户端（延迟初始化）
   * @returns {OpenAI|null} OpenAI 客户端实例，如果没有API密钥则返回null
   * @private
   */
  _getClient() {
    if (!this.openaiClient) {
      if (!this.apiKey) {
        console.warn("DeepSeek API key is not set. Please configure it in the settings.");
        return null; // 返回null而不是抛出错误
      }
      this.openaiClient = new OpenAI({
        apiKey: this.apiKey,
        baseURL: this.baseURL,
        timeout: 30000, // 30秒超时
        maxRetries: 2    // 失败重试2次
      });
    }
    return this.openaiClient;
  }

  /**
   * 生成AI完成响应
   * @param {Array} messages - 聊天消息数组
   * @param {Object} options - 生成选项
   * @returns {AsyncIterable<Object>} 统一格式的AI响应异步迭代器
   */
  async *generateCompletion(messages, options = {}) {
    try {
      const client = this._getClient();
      
      // 关键修复：仅从消息中移除 'reasoning_content'，保留所有其他字段
      const processedMessages = messages.map(({ reasoning_content, ...rest }) => rest);
      
      const params = {
        messages: processedMessages,
        model: options.model || "deepseek-chat", // 默认使用 deepseek-chat
        tools: options.tools,
        tool_choice: options.tool_choice || "auto",
        stream: options.stream !== false, // 默认启用流式
        temperature: options.temperature, // 使用前端传递的参数，不设置默认值
        top_p: options.top_p,
        n: options.n,
        max_tokens: options.max_tokens
      };

      console.log(`[DeepSeekAdapter] Sending request:`, JSON.stringify({
        model: params.model,
        message_count: processedMessages.length,
        has_tools: !!params.tools
      }, null, 2));

      const completion = await client.chat.completions.create(params);

      if (params.stream) {
        for await (const chunk of completion) {
          const delta = chunk.choices[0]?.delta;

          if (delta?.content) {
            yield {
              type: "text",
              text: delta.content,
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

          // DeepSeek 特有的 reasoning_content
          if (delta?.reasoning_content) {
            yield {
              type: "reasoning",
              text: delta.reasoning_content,
            };
          }
        }
      } else {
        if (completion && completion.choices && completion.choices.length > 0 && completion.choices[0].message) {
          const message = completion.choices[0].message;
          
          // 检查是否存在 reasoning_content，并将其包含在返回中
          if (message.reasoning_content) {
            yield {
              type: "text",
              text: message.content,
              reasoning_content: message.reasoning_content,
            };
          } else {
            yield {
              type: "text",
              text: message.content,
            };
          }

          if (message.tool_calls) {
            yield {
              type: "tool_calls",
              tool_calls: message.tool_calls,
            };
          }

          if (completion.usage) {
            yield {
              type: "usage",
              inputTokens: completion.usage.prompt_tokens || 0,
              outputTokens: completion.usage.completion_tokens || 0,
            };
          }
        } else {
          throw new Error("DeepSeek API 响应中缺少有效的消息内容。");
        }
      }
    } catch (error) {
      console.error(`[DeepSeekAdapter] API call failed: ${error.message}`);
      throw this._standardizeError(error, 'API call failed');
    }
  }

  /**
   * 列出提供商支持的所有模型
   * @returns {Promise<Array<Object>>} 模型信息列表
   */
  async listModels() {
    return this.supportedModels;
  }

  /**
   * 获取特定模型的详细信息
   * @param {string} modelId - 模型ID
   * @returns {Promise<Object>} 模型详细信息
   */
  async getModelInfo(modelId) {
    const model = this.supportedModels.find(m => m.id === modelId);
    if (!model) {
      throw new Error(`模型 '${modelId}' 不存在于 DeepSeekAdapter 中。`);
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

    // DeepSeek 特定验证 - API密钥改为可选，允许无密钥注册
    // 如果没有API密钥，适配器仍然可以注册，但无法实际使用
    if (!config.apiKey) {
      console.warn('DeepSeek API key is not set. Adapter will be registered but cannot be used until configured.');
    }

    return { isValid: true, errors }; // 总是返回有效，允许注册
  }

  /**
   * 更新配置
   * @param {Object} newConfig - 新配置
   * @returns {Promise<void>}
   */
  async updateConfig(newConfig) {
    // 重置客户端以应用新配置
    if (newConfig.apiKey || newConfig.baseURL) {
      this.openaiClient = null;
    }
    
    await super.updateConfig(newConfig);
  }
}

module.exports = DeepSeekAdapter;