const { ChatPromptTemplate } = require('@langchain/core/prompts');
const { RunnableSequence, RunnableParallel, RunnablePassthrough } = require('@langchain/core/runnables');
const systemPromptBuilder = require('../systemPromptBuilder');
const ragRetrievalService = require('../ragRetrievalService');
const requestBuilder = require('../requestBuilder');

/**
 * LangChain 请求体构建服务
 * 使用 LangChain Expression Language (LCEL) 构建完整的AI请求体
 */
class LangChainRequestBodyBuilder {
  constructor() {
    // 初始化组件构建器
    this.componentBuilders = {
      systemPrompt: this.buildSystemPromptComponent.bind(this),
      fileTree: this.buildFileTreeComponent.bind(this),
      additionalInfo: this.buildAdditionalInfoComponent.bind(this),
      ragContext: this.buildRagContextComponent.bind(this),
      tools: this.buildToolsComponent.bind(this)
    };

    // 构建请求组装链
    this.requestAssemblyChain = this.buildRequestAssemblyChain();
  }

  /**
   * 构建请求组装链
   */
  buildRequestAssemblyChain() {
    // 系统提示词模板
    const systemPromptTemplate = ChatPromptTemplate.fromMessages([
      ["system", `{baseSystemPrompt}
      
[当前工作区文件结构]:
{fileTreeContent}

[持久记忆信息]:
{additionalInfo}

[知识库参考内容]:
{ragContext}`]
    ]);

    // 并行构建所有组件
    const componentBuilderChain = new RunnableParallel({
      baseSystemPrompt: ({ mode, customSystemPrompt }) =>
        systemPromptBuilder.getSystemPrompt(mode, customSystemPrompt),
      fileTreeContent: this.componentBuilders.fileTree,
      additionalInfo: ({ mode }) => this.componentBuilders.additionalInfo(mode),
      ragContext: ({ messages, ragRetrievalEnabled, mode }) =>
        this.componentBuilders.ragContext(messages, ragRetrievalEnabled, mode),
      tools: this.componentBuilders.tools
    });

    // 组装系统消息
    const systemMessageAssembler = RunnableSequence.from([
      componentBuilderChain,
      async (components) => {
        const systemMessageContent = await systemPromptTemplate.format({
          baseSystemPrompt: components.baseSystemPrompt,
          fileTreeContent: components.fileTreeContent,
          additionalInfo: components.additionalInfo,
          ragContext: components.ragContext
        });

        return {
          systemMessage: { role: "system", content: systemMessageContent },
          tools: components.tools,
          components: {
            systemPrompt: components.baseSystemPrompt,
            fileTreeContent: components.fileTreeContent,
            additionalInfo: components.additionalInfo,
            ragContext: components.ragContext
          }
        };
      }
    ]);

    // 构建最终请求体
    const requestBodyBuilder = RunnableSequence.from([
      systemMessageAssembler,
      async (assembledData, { messages, modelId, aiParameters, isStreaming }) => {
        const { systemMessage, tools, components } = assembledData;

        // 构建消息数组（前端管理的对话历史 + 系统消息）
        const messagesToSend = [systemMessage, ...messages];

        // 构建请求选项
        const { requestOptions, mergedAiParameters } = requestBuilder.buildRequestOptions(
          modelId,
          aiParameters,
          isStreaming
        );

        // 构建适配器选项
        const adapterOptions = requestBuilder.buildAdapterOptions(
          modelId,
          mergedAiParameters,
          isStreaming
        );

        // 添加工具定义到请求选项
        if (tools && tools.length > 0) {
          requestOptions.tools = tools;
        }

        const requestBody = {
          messages: messagesToSend,
          requestOptions,
          adapterOptions,
          components,
          metadata: {
            mode: mode,
            timestamp: Date.now(),
            streaming: isStreaming,
            systemPromptLength: systemMessage.content.length,
            totalMessages: messagesToSend.length
          }
        };

        // 记录调试信息
        requestBuilder.logMessagesForDebugging(messagesToSend, 'LangChain构建的AI请求体 - 消息内容:');

        console.log(`[LangChainRequestBodyBuilder] 请求体构建完成 - 系统提示词长度: ${systemMessage.content.length}, 总消息数: ${messagesToSend.length}`);

        return requestBody;
      }
    ]);

    return requestBodyBuilder;
  }

  /**
   * 构建系统提示词组件
   */
  async buildSystemPromptComponent(mode, customSystemPrompt) {
    try {
      const effectiveSystemPrompt = systemPromptBuilder.getSystemPrompt(mode, customSystemPrompt);
      console.log(`[LangChainRequestBodyBuilder] 系统提示词组件构建完成 - 长度: ${effectiveSystemPrompt.length}`);
      return effectiveSystemPrompt;
    } catch (error) {
      console.error(`[LangChainRequestBodyBuilder] 构建系统提示词组件失败:`, error);
      return '';
    }
  }

  /**
   * 构建文件结构树组件
   */
  async buildFileTreeComponent() {
    try {
      const fileTreeContent = await systemPromptBuilder.getFileTreeContent();
      console.log(`[LangChainRequestBodyBuilder] 文件结构树组件构建完成`);
      return fileTreeContent;
    } catch (error) {
      console.error(`[LangChainRequestBodyBuilder] 构建文件结构树组件失败:`, error);
      return '';
    }
  }

  /**
   * 构建持久记忆组件
   */
  async buildAdditionalInfoComponent(mode) {
    try {
      const additionalInfo = await systemPromptBuilder.getAdditionalInfo(mode);
      
      // 格式化持久记忆信息
      let formattedInfo = '';
      if (additionalInfo.outline) {
        formattedInfo += `\n【大纲】:\n${additionalInfo.outline}\n`;
      }
      if (additionalInfo.previousChapter) {
        formattedInfo += `\n【上一章全文】:\n${additionalInfo.previousChapter}\n`;
      }
      if (additionalInfo.characterSettings) {
        formattedInfo += `\n【本章重要人设】:\n${additionalInfo.characterSettings}\n`;
      }

      console.log(`[LangChainRequestBodyBuilder] 持久记忆组件构建完成`);
      return formattedInfo;
    } catch (error) {
      console.error(`[LangChainRequestBodyBuilder] 构建持久记忆组件失败:`, error);
      return '';
    }
  }

  /**
   * 构建RAG上下文组件
   */
  async buildRagContextComponent(messages, ragRetrievalEnabled, mode) {
    try {
      if (!ragRetrievalEnabled) {
        return '';
      }

      const { ragContext } = await ragRetrievalService.performRagRetrieval(
        messages, 
        ragRetrievalEnabled, 
        mode
      );

      console.log(`[LangChainRequestBodyBuilder] RAG上下文组件构建完成 - 启用: ${ragRetrievalEnabled}`);
      return ragContext || '';
    } catch (error) {
      console.error(`[LangChainRequestBodyBuilder] 构建RAG上下文组件失败:`, error);
      return '';
    }
  }

  /**
   * 构建工具定义组件
   */
  async buildToolsComponent() {
    try {
      // 工具定义已经在requestBuilder中定义，这里只需要引用
      const { requestOptions } = requestBuilder.buildRequestOptions('dummy-model', {}, false);
      console.log(`[LangChainRequestBodyBuilder] 工具定义组件构建完成 - 工具数量: ${requestOptions.tools.length}`);
      return requestOptions.tools;
    } catch (error) {
      console.error(`[LangChainRequestBodyBuilder] 构建工具定义组件失败:`, error);
      return [];
    }
  }

  /**
   * 构建完整的AI请求体
   * @param {Object} options 构建选项
   * @param {Array} options.messages 对话消息（由前端管理）
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

    console.log(`[LangChainRequestBodyBuilder] 开始构建请求体 - 模式: ${mode}, 模型: ${modelId}`);

    try {
      // 使用LangChain链式构建请求体
      const requestBody = await this.requestAssemblyChain.invoke({
        messages,
        modelId,
        mode,
        customSystemPrompt,
        ragRetrievalEnabled,
        aiParameters,
        isStreaming
      });

      console.log(`[LangChainRequestBodyBuilder] 请求体构建完成`);
      return requestBody;

    } catch (error) {
      console.error(`[LangChainRequestBodyBuilder] 构建请求体失败:`, error);
      throw error;
    }
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
}

// 创建单例实例
const langChainRequestBodyBuilder = new LangChainRequestBodyBuilder();

module.exports = langChainRequestBodyBuilder;