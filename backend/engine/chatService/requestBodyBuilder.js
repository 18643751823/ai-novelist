const requestBuilder = require('./requestBuilder');
const systemPromptBuilder = require('./systemPromptBuilder');
const ragRetrievalService = require('./ragRetrievalService');
const contextManager = require('../contextManager');
const { state } = require('../../state-manager');

/**
 * 请求体构建服务
 * 负责构建完整的AI请求体，包括系统提示词、对话上下文、工具定义、RAG内容等
 */
class RequestBodyBuilder {
  constructor() {
    this.components = {
      systemPrompt: null,
      fileTreeContent: null,
      additionalInfo: null,
      ragContext: null,
      conversationContext: null,
      tools: null,
      aiParameters: null
    };
  }

  /**
   * 构建完整的AI请求体
   * @param {Object} options 构建选项
   * @param {Array} options.messages 对话消息
   * @param {string} options.modelId 模型ID
   * @param {string} options.mode 当前模式
   * @param {string} options.customSystemPrompt 自定义系统提示词
   * @param {boolean} options.ragRetrievalEnabled 是否启用RAG检索
   * @param {Object} options.aiParameters AI参数
   * @param {boolean} options.isStreaming 是否流式传输
   * @returns {Object} 完整的请求体
   */
  async buildRequestBody(options = {}) {
    const {
      messages = [],
      modelId,
      mode = 'general',
      customSystemPrompt = null,
      ragRetrievalEnabled = false,
      aiParameters = {},
      isStreaming = true
    } = options;

    console.log(`[RequestBodyBuilder] 开始构建请求体 - 模式: ${mode}, 模型: ${modelId}`);

    try {
      // 1. 构建系统提示词组件
      await this.buildSystemPromptComponent(mode, customSystemPrompt);

      // 2. 构建文件结构树组件
      await this.buildFileTreeComponent();

      // 3. 构建持久记忆组件
      await this.buildAdditionalInfoComponent(mode);

      // 4. 构建RAG上下文组件
      await this.buildRagContextComponent(messages, ragRetrievalEnabled, mode);

      // 5. 构建对话上下文组件
      await this.buildConversationContextComponent(messages, mode);

      // 6. 构建工具定义组件
      await this.buildToolsComponent();

      // 7. 构建AI参数组件
      await this.buildAiParametersComponent(aiParameters);

      // 8. 组装完整的请求体
      const requestBody = await this.assembleRequestBody({
        modelId,
        isStreaming,
        mode
      });

      console.log(`[RequestBodyBuilder] 请求体构建完成`);
      return requestBody;

    } catch (error) {
      console.error(`[RequestBodyBuilder] 构建请求体失败:`, error);
      throw error;
    }
  }

  /**
   * 构建系统提示词组件
   */
  async buildSystemPromptComponent(mode, customSystemPrompt) {
    try {
      const effectiveSystemPrompt = systemPromptBuilder.getSystemPrompt(mode, customSystemPrompt);
      this.components.systemPrompt = effectiveSystemPrompt;
      console.log(`[RequestBodyBuilder] 系统提示词组件构建完成 - 长度: ${effectiveSystemPrompt.length}`);
    } catch (error) {
      console.error(`[RequestBodyBuilder] 构建系统提示词组件失败:`, error);
      this.components.systemPrompt = '';
    }
  }

  /**
   * 构建文件结构树组件
   */
  async buildFileTreeComponent() {
    try {
      const fileTreeContent = await systemPromptBuilder.getFileTreeContent();
      this.components.fileTreeContent = fileTreeContent;
      console.log(`[RequestBodyBuilder] 文件结构树组件构建完成`);
    } catch (error) {
      console.error(`[RequestBodyBuilder] 构建文件结构树组件失败:`, error);
      this.components.fileTreeContent = '';
    }
  }

  /**
   * 构建持久记忆组件
   */
  async buildAdditionalInfoComponent(mode) {
    try {
      const additionalInfo = await systemPromptBuilder.getAdditionalInfo(mode);
      this.components.additionalInfo = additionalInfo;
      console.log(`[RequestBodyBuilder] 持久记忆组件构建完成`);
    } catch (error) {
      console.error(`[RequestBodyBuilder] 构建持久记忆组件失败:`, error);
      this.components.additionalInfo = { outline: '', previousChapter: '', characterSettings: '' };
    }
  }

  /**
   * 构建RAG上下文组件
   */
  async buildRagContextComponent(messages, ragRetrievalEnabled, mode) {
    try {
      const { ragContext, retrievalInfo } = await ragRetrievalService.performRagRetrieval(
        messages, 
        ragRetrievalEnabled, 
        mode
      );
      this.components.ragContext = ragContext;
      this.components.retrievalInfo = retrievalInfo;
      console.log(`[RequestBodyBuilder] RAG上下文组件构建完成 - 启用: ${ragRetrievalEnabled}`);
    } catch (error) {
      console.error(`[RequestBodyBuilder] 构建RAG上下文组件失败:`, error);
      this.components.ragContext = '';
    }
  }

  /**
   * 构建对话上下文组件
   */
  async buildConversationContextComponent(messages, mode) {
    try {
      // 获取上下文限制设置
      const contextLimitSettings = await this.getContextLimitSettings();
      
      // 应用上下文限制
      const filteredMessages = contextManager.truncateMessages(
        messages,
        contextLimitSettings,
        mode,
        false // 不是RAG上下文
      );

      // 清理消息格式
      const sanitizedMessages = requestBuilder.sanitizeMessagesForAI(filteredMessages);
      
      this.components.conversationContext = sanitizedMessages;
      console.log(`[RequestBodyBuilder] 对话上下文组件构建完成 - 原始: ${messages.length}条, 过滤后: ${sanitizedMessages.length}条`);
    } catch (error) {
      console.error(`[RequestBodyBuilder] 构建对话上下文组件失败:`, error);
      this.components.conversationContext = [];
    }
  }

  /**
   * 构建工具定义组件
   */
  async buildToolsComponent() {
    try {
      // 工具定义已经在requestBuilder中定义，这里只需要引用
      const { requestOptions } = requestBuilder.buildRequestOptions('dummy-model', {}, false);
      this.components.tools = requestOptions.tools;
      console.log(`[RequestBodyBuilder] 工具定义组件构建完成 - 工具数量: ${requestOptions.tools.length}`);
    } catch (error) {
      console.error(`[RequestBodyBuilder] 构建工具定义组件失败:`, error);
      this.components.tools = [];
    }
  }

  /**
   * 构建AI参数组件
   */
  async buildAiParametersComponent(aiParameters) {
    try {
      this.components.aiParameters = aiParameters;
      console.log(`[RequestBodyBuilder] AI参数组件构建完成:`, aiParameters);
    } catch (error) {
      console.error(`[RequestBodyBuilder] 构建AI参数组件失败:`, error);
      this.components.aiParameters = {};
    }
  }

  /**
   * 组装完整的请求体
   */
  async assembleRequestBody(options) {
    const { modelId, isStreaming, mode } = options;

    // 构建完整的系统消息
    const fullSystemPrompt = systemPromptBuilder.buildSystemPrompt(
      this.components.systemPrompt,
      {
        fileTreeContent: this.components.fileTreeContent,
        ragRetrievalEnabled: !!this.components.ragContext,
        ragContent: this.components.ragContext,
        additionalInfo: this.components.additionalInfo
      }
    );

    // 构建消息数组
    const messagesToSend = [...this.components.conversationContext];
    messagesToSend.unshift({ 
      role: "system", 
      content: fullSystemPrompt, 
      name: "system" 
    });

    // 构建请求选项
    const { requestOptions, mergedAiParameters } = requestBuilder.buildRequestOptions(
      modelId,
      this.components.aiParameters,
      isStreaming
    );

    // 构建适配器选项
    const adapterOptions = requestBuilder.buildAdapterOptions(
      modelId,
      mergedAiParameters,
      isStreaming
    );

    const requestBody = {
      messages: messagesToSend,
      requestOptions: requestOptions,
      adapterOptions: adapterOptions,
      components: {
        systemPrompt: this.components.systemPrompt,
        fileTreeContent: this.components.fileTreeContent,
        additionalInfo: this.components.additionalInfo,
        ragContext: this.components.ragContext,
        conversationContext: this.components.conversationContext,
        tools: this.components.tools,
        aiParameters: this.components.aiParameters
      },
      metadata: {
        mode: mode,
        timestamp: Date.now(),
        streaming: isStreaming,
        systemPromptLength: fullSystemPrompt.length,
        totalMessages: messagesToSend.length
      }
    };

    // 记录调试信息
    requestBuilder.logMessagesForDebugging(messagesToSend, '完整的AI请求体 - 消息内容:');

    return requestBody;
  }

  /**
   * 获取上下文限制设置
   */
  async getContextLimitSettings() {
    try {
      const handlers = require('../ipc/handlers');
      const result = await handlers.handleGetContextLimitSettings();
      if (result.success) {
        return result.settings;
      } else {
        console.warn('[RequestBodyBuilder] 获取上下文限制设置失败，使用默认设置');
        return contextManager.defaultSettings;
      }
    } catch (error) {
      console.warn('[RequestBodyBuilder] 获取上下文限制设置时出错，使用默认设置:', error.message);
      return contextManager.defaultSettings;
    }
  }

  /**
   * 获取请求体统计信息
   */
  getRequestBodyStatistics(requestBody) {
    if (!requestBody || !requestBody.metadata) {
      return null;
    }

    return {
      systemPromptLength: requestBody.metadata.systemPromptLength,
      totalMessages: requestBody.metadata.totalMessages,
      mode: requestBody.metadata.mode,
      streaming: requestBody.metadata.streaming,
      timestamp: requestBody.metadata.timestamp
    };
  }

  /**
   * 验证请求体格式
   */
  validateRequestBody(requestBody) {
    if (!requestBody) {
      return { valid: false, error: '请求体为空' };
    }

    if (!requestBody.messages || !Array.isArray(requestBody.messages)) {
      return { valid: false, error: '消息数组无效' };
    }

    if (!requestBody.requestOptions || !requestBody.adapterOptions) {
      return { valid: false, error: '请求选项或适配器选项无效' };
    }

    return { valid: true };
  }
}

// 创建单例实例
const requestBodyBuilder = new RequestBodyBuilder();

module.exports = requestBodyBuilder;