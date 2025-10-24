const { getModelRegistry, initializeModelProvider } = require('../models/modelProvider');
const contextManager = require('../contextManager');
const { state } = require('../../state-manager');

const systemPromptBuilder = require('./systemPromptBuilder');
const ragRetrievalService = require('./ragRetrievalService');
const requestBuilder = require('./requestBuilder');
const requestBodyBuilder = require('./requestBodyBuilder');
const toolCallService = require('./toolCallService');
const messageProcessor = require('./messageProcessor');

// 服务级别的状态，用于存储持久化设置
const serviceState = {
  isStreaming: true, // 默认为流式
  abortController: null, // 新增：用于中止请求的控制器
};

function setStreamingMode({ stream }) {
  console.log(`[ChatCoordinator] 更新流式模式为: ${stream}`);
  serviceState.isStreaming = stream;
}

// 新增 getter 函数以安全地暴露状态
function getStreamingMode() {
  return serviceState.isStreaming;
}

// 新增：设置中止控制器
function setAbortController(controller) {
  serviceState.abortController = controller;
}

// 新增：中止当前请求
function abortCurrentRequest() {
  if (serviceState.abortController) {
    serviceState.abortController.abort();
    console.log('[ChatCoordinator] 已中止当前请求');
    serviceState.abortController = null;
  }
}

// 获取上下文限制设置
async function getContextLimitSettings() {
  let contextLimitSettings = null;
  try {
    const handlers = require('../ipc/handlers');
    const result = await handlers.handleGetContextLimitSettings();
    if (result.success) {
      contextLimitSettings = result.settings;
      console.log('[ChatCoordinator] 已加载上下文限制设置:', contextLimitSettings);
    } else {
      console.warn('[ChatCoordinator] 获取上下文限制设置失败，使用默认设置');
      contextLimitSettings = contextManager.defaultSettings;
    }
  } catch (error) {
    console.warn('[ChatCoordinator] 获取上下文限制设置时出错，使用默认设置:', error.message);
    contextLimitSettings = contextManager.defaultSettings;
  }
  return contextLimitSettings;
}
// 主聊天函数
async function* chatWithAI(messages, modelId, customSystemPrompt, mode = 'general', ragRetrievalEnabled, aiParameters = {}) {
  console.log(`[ChatCoordinator] 开始处理聊天请求:`, {
    modelId: modelId || '未指定',
    mode,
    ragRetrievalEnabled,
    customPromptLength: customSystemPrompt ? customSystemPrompt.length : 0
  });

  try {
    await initializeModelProvider(); // 确保 ModelProvider 已初始化
    const modelRegistry = getModelRegistry();
    const adapter = modelRegistry.getAdapterForModel(modelId);
    
    console.log('[API设置调试] 模型查找结果:', {
      requestedModel: modelId,
      adapterFound: !!adapter,
      adapterType: adapter ? adapter.constructor.name : '无适配器'
    });

    if (!adapter) {
      const errorMessage = `模型 '${modelId}' 不可用或未注册。`;
      console.warn(`[API设置调试] chatWithAI: ${errorMessage}`);
      console.log('[API设置调试] 当前注册的模型映射:', Object.keys(modelRegistry.modelMapping));
      messageProcessor._sendAiResponseToFrontend('error', errorMessage);
      return { type: 'error', payload: errorMessage };
    }

    // 使用RequestBodyBuilder构建完整的请求体
    const requestBody = await requestBodyBuilder.buildRequestBody({
      messages,
      modelId,
      mode,
      customSystemPrompt,
      ragRetrievalEnabled,
      aiParameters,
      isStreaming: serviceState.isStreaming
    });

    // 验证请求体
    const validationResult = requestBodyBuilder.validateRequestBody(requestBody);
    if (!validationResult.valid) {
      const errorMessage = `请求体验证失败: ${validationResult.error}`;
      console.error(`[ChatCoordinator] ${errorMessage}`);
      messageProcessor._sendAiResponseToFrontend('error', errorMessage);
      return { type: 'error', payload: errorMessage };
    }

    console.log(`[ChatCoordinator] 请求体构建完成 - 系统提示词长度: ${requestBody.metadata.systemPromptLength}, 总消息数: ${requestBody.metadata.totalMessages}`);

    // 使用构建好的请求体调用AI
    const aiResponse = await adapter.generateCompletion(requestBody.messages, requestBody.adapterOptions);

    let currentSessionId = state.conversationHistory.length > 0
      ? state.conversationHistory[0].sessionId
      : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // 处理流式响应
    if (serviceState.isStreaming) {
      // 流式处理：直接返回生成器
      let fullAssistantContent = "";
      let finalToolCalls = [];
      let finalReasoningContent = "";
      let lastUsage = null;

      for await (const chunk of aiResponse) {
        if (chunk.type === "text") {
          fullAssistantContent += chunk.text;
          yield { type: "text", content: chunk.text };
        } else if (chunk.type === "tool_calls" && chunk.tool_calls) {
          yield { type: "tool_calls", content: chunk.tool_calls };
          chunk.tool_calls.forEach(delta => {
            let existingCall = finalToolCalls.find(call => call.index === delta.index);
            if (!existingCall) {
              existingCall = { index: delta.index, id: null, type: 'function', function: { name: '', arguments: '' } };
              finalToolCalls.splice(delta.index, 0, existingCall);
            }
            if (delta.id) existingCall.id = delta.id;
            if (delta.function && delta.function.name) existingCall.function.name = delta.function.name;
            if (delta.function && delta.function.arguments) existingCall.function.arguments += delta.function.arguments;
          });
        } else if (chunk.type === "reasoning") {
          finalReasoningContent += chunk.text;
          yield { type: "reasoning", content: chunk.text };
        } else if (chunk.type === "usage") {
          lastUsage = chunk;
          yield { type: "usage", content: chunk };
        }
      }

      // 在流结束后，将完整的 assistant 消息添加到 conversationHistory
      const messageToStore = {
        role: "assistant",
        content: fullAssistantContent || null,
        reasoning_content: finalReasoningContent || null,
        tool_calls: finalToolCalls || null,
        sessionId: currentSessionId
      };
      state.conversationHistory.push(messageToStore);

      // 如果有推理内容，发送给前端
      if (finalReasoningContent) {
        messageProcessor._sendAiResponseToFrontend('reasoning_content', {
          content: finalReasoningContent,
          sessionId: currentSessionId
        });
      }

      // 处理工具调用
      toolCallService.processToolCalls(finalToolCalls, currentSessionId);

      if (!fullAssistantContent && state.pendingToolCalls.length === 0) {
        messageProcessor._sendAiResponseToFrontend('error', 'AI 没有给出明确的回复或工具调用。');
        yield { type: 'error', payload: 'AI 没有给出明确的回复或工具调用。' };
      }

      await messageProcessor.logConversation(currentSessionId);
      yield { type: 'processed', payload: 'AI 响应已处理' }; // 最终的成功标记
    } else {
      // 非流式处理
      const { fullAssistantContent, finalToolCalls } = await messageProcessor.processStreamResponse(aiResponse, serviceState.isStreaming, currentSessionId);

      // 处理工具调用
      toolCallService.processToolCalls(finalToolCalls, currentSessionId);

      if (!fullAssistantContent && state.pendingToolCalls.length === 0) {
        messageProcessor._sendAiResponseToFrontend('error', 'AI 没有给出明确的回复或工具调用。');
        yield { type: 'error', payload: 'AI 没有给出明确的回复或工具调用。' };
      }

      await messageProcessor.logConversation(currentSessionId);
      yield { type: 'processed', payload: 'AI 响应已处理' }; // 最终的成功标记
    }

  } catch (error) {
    console.error(`[ChatCoordinator] 处理消息时出错: ${error.message}`);
    messageProcessor._sendAiResponseToFrontend('error', `处理消息时出错: ${error.message}`);
    throw error;
  }
}

// 工具结果反馈函数
async function* sendToolResultToAI(toolResultsArray, modelId, customSystemPrompt = null, mode = 'general', aiParameters = {}) {
  console.log(`[ChatCoordinator] 开始处理工具结果反馈 (模型: ${modelId}, 模式: ${mode})`);
  
  try {
    await initializeModelProvider();
    const modelRegistry = getModelRegistry();
    const adapter = modelRegistry.getAdapterForModel(modelId);

    if (!adapter) {
      const errorMessage = `模型 '${modelId}' 不可用或未注册。`;
      console.warn(`[ChatCoordinator] sendToolResultToAI: ${errorMessage}`);
      yield { type: 'error', payload: errorMessage };
      return;
    }

    // 构建工具消息
    const toolMessages = toolCallService.buildToolMessages(toolResultsArray);

    // 只有在确实有工具结果需要推送时才执行
    if (toolMessages.length > 0) {
      state.conversationHistory.push(...toolMessages);
    }

    // 获取最新的对话上下文（只更新 user 和 assistant 角色的内容，保留 tool 消息）
    let latestMessages = state.conversationHistory;
    try {
      const handlers = require('../ipc/handlers');
      const contextResult = await handlers.handleGetConversationContext();
      if (contextResult.success && contextResult.messages) {
        const frontendMessages = contextResult.messages;
        
        // 创建一个映射，用于快速查找前端消息
        const frontendMessageMap = new Map();
        frontendMessages.forEach(msg => {
          if (msg.role === 'user' || msg.role === 'assistant') {
            const key = `${msg.role}_${msg.content?.substring(0, 50)}`; // 使用角色和内容前50字符作为键
            frontendMessageMap.set(key, msg);
          }
        });

        // 更新后端消息中的 user 和 assistant 内容，保留 tool 消息
        latestMessages = state.conversationHistory.map(backendMsg => {
          if (backendMsg.role === 'user' || backendMsg.role === 'assistant') {
            const key = `${backendMsg.role}_${backendMsg.content?.substring(0, 50)}`;
            const frontendMsg = frontendMessageMap.get(key);
            if (frontendMsg && frontendMsg.content !== backendMsg.content) {
              console.log(`[ChatCoordinator] 更新 ${backendMsg.role} 消息内容`);
              return { ...backendMsg, content: frontendMsg.content };
            }
          }
          return backendMsg; // 保持 tool 消息和其他消息不变
        });

        console.log(`[ChatCoordinator] 已同步最新的 user 和 assistant 消息内容`);
      } else {
        console.warn('[ChatCoordinator] 获取最新对话上下文失败，使用后端存储的上下文');
      }
    } catch (error) {
      console.warn('[ChatCoordinator] 获取最新对话上下文时出错:', error.message);
    }

    // 使用RequestBodyBuilder构建完整的请求体（使用最新的对话上下文）
    const requestBody = await requestBodyBuilder.buildRequestBody({
      messages: latestMessages,
      modelId,
      mode,
      customSystemPrompt,
      ragRetrievalEnabled: false, // 工具结果反馈通常不需要RAG
      aiParameters,
      isStreaming: serviceState.isStreaming
    });

    // 验证请求体
    const validationResult = requestBodyBuilder.validateRequestBody(requestBody);
    if (!validationResult.valid) {
      const errorMessage = `请求体验证失败: ${validationResult.error}`;
      console.error(`[ChatCoordinator] ${errorMessage}`);
      yield { type: 'error', payload: errorMessage };
      return;
    }

    console.log(`[ChatCoordinator] 工具反馈请求体构建完成 - 系统提示词长度: ${requestBody.metadata.systemPromptLength}, 总消息数: ${requestBody.metadata.totalMessages}`);

    // 使用构建好的请求体调用AI
    const aiResponse = await adapter.generateCompletion(requestBody.messages, requestBody.adapterOptions);

    let currentSessionId = state.conversationHistory.length > 0 ? state.conversationHistory.find(m => m.sessionId)?.sessionId : `${Date.now()}`;

    // 处理流式响应
    if (serviceState.isStreaming) {
      // 流式处理：直接返回生成器
      let fullAssistantContent = "";
      let finalToolCalls = [];
      let finalReasoningContent = "";
      let lastUsage = null;

      for await (const chunk of aiResponse) {
        if (chunk.type === "text") {
          fullAssistantContent += chunk.text;
          yield { type: "text", content: chunk.text, sessionId: currentSessionId };
        } else if (chunk.type === "tool_calls" && chunk.tool_calls) {
          yield { type: "tool_calls", content: chunk.tool_calls };
          chunk.tool_calls.forEach(delta => {
            let existingCall = finalToolCalls.find(call => call.index === delta.index);
            if (!existingCall) {
              existingCall = {
                index: delta.index,
                id: null,
                type: 'function',
                function: { name: '', arguments: '' }
              };
              finalToolCalls.splice(delta.index, 0, existingCall);
            }
            if (delta.id) existingCall.id = delta.id;
            if (delta.function && delta.function.name) existingCall.function.name = delta.function.name;
            if (delta.function && delta.function.arguments) existingCall.function.arguments += delta.function.arguments;
          });
        }
        // 可以根据需要添加对 'reasoning' 和 'usage' 的处理
      }

      // 在流结束后，将完整的 assistant 消息添加到 conversationHistory
      const messageToStore = {
        role: "assistant",
        content: fullAssistantContent || null,
        tool_calls: finalToolCalls.length > 0 ? finalToolCalls : null,
        sessionId: currentSessionId
      };
      state.conversationHistory.push(messageToStore);

      // 处理工具调用
      toolCallService.processToolCalls(finalToolCalls, currentSessionId);
      
      await messageProcessor.logConversation(currentSessionId);
      yield { type: 'processed', payload: '工具反馈响应已处理' };
    } else {
      // 非流式处理
      const { fullAssistantContent, finalToolCalls } = await messageProcessor.processStreamResponse(aiResponse, serviceState.isStreaming, currentSessionId);

      // 处理工具调用
      toolCallService.processToolCalls(finalToolCalls, currentSessionId);
      
      await messageProcessor.logConversation(currentSessionId);
      yield { type: 'processed', payload: '工具反馈响应已处理' };
    }

  } catch (error) {
    console.error("sendToolResultToAI: 再次调用 AI API 失败:", error);
    yield { type: 'error', payload: `AI 反馈失败: ${error.message}` };
  }
}

module.exports = {
  chatWithAI,
  sendToolResultToAI,
  setStreamingMode,
  getStreamingMode,
  abortCurrentRequest,
  setAbortController
};