const { state } = require('../../state-manager');
const logger = require('../../utils/logger');

let aiResponseSendCount = 0;

function resetResponseCount() {
  aiResponseSendCount = 0;
}

function _sendAiResponseToFrontend(type, payload) {
  if (state.mainWindow) {
    aiResponseSendCount++;
    const sendTimestamp = Date.now();
    // 跳过 tool_stream 和 text_stream 类型的日志打印，避免流式传输产生过多日志
    if (type !== 'tool_stream' && type !== 'text_stream') {
      console.log(`[MessageProcessor] Sending ai-response. Type: ${type}, Count: ${aiResponseSendCount}, Timestamp: ${sendTimestamp}, Payload:`, JSON.stringify(payload).substring(0, 500));
    }
    state.mainWindow.webContents.send('ai-response', { type, payload, sendTimestamp }); // 添加时间戳到 payload
  }
}

// 处理流式响应
async function processStreamResponse(aiResponse, isStreaming, currentSessionId) {
  let fullAssistantContent = "";
  let finalToolCalls = [];
  let finalReasoningContent = "";
  let lastUsage = null;

  if (isStreaming) {
    for await (const chunk of aiResponse) {
      if (chunk.type === "text") {
        fullAssistantContent += chunk.text;
      } else if (chunk.type === "tool_calls" && chunk.tool_calls) {
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
      } else if (chunk.type === "usage") {
        lastUsage = chunk;
      }
    }
  } else {
    // 非流式处理，但 adapter 仍然返回一个生成器，需要迭代它来构建完整响应
    for await (const chunk of aiResponse) {
      if (chunk.type === "text") {
        fullAssistantContent += chunk.text || '';
        if (chunk.reasoning_content) {
          finalReasoningContent += chunk.reasoning_content;
        }
      } else if (chunk.type === "tool_calls") {
        finalToolCalls = chunk.tool_calls || [];
      } else if (chunk.type === "usage") {
        lastUsage = chunk;
      }
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
    _sendAiResponseToFrontend('reasoning_content', {
      content: finalReasoningContent,
      sessionId: currentSessionId
    });
  }

  return { fullAssistantContent, finalToolCalls, finalReasoningContent, lastUsage };
}

// 处理用户消息
async function processUserMessage(message, sessionId, currentMessages, mode, customPrompt, ragRetrievalEnabled, model, aiParameters = {}) {
  state.conversationHistory = currentMessages || [];
  
  console.log(`[MessageProcessor] processUserMessage: 使用模型: ${model}`);
  
  // Append the latest user message if it's not already there
  if (!state.conversationHistory.some(msg => msg.content === message && msg.role === 'user')) {
    const latestMessage = { role: 'user', content: message, sessionId: sessionId, id: `${Date.now()}` };
    state.conversationHistory.push(latestMessage);
  }
  
  state.pendingToolCalls = [];
  resetResponseCount();
  
  const storeModule = await import('electron-store');
  const store = new storeModule.default();
  // 优先使用前端传递的模型，如果没有则使用存储中的模型
  const storedSelectedModel = store.get('selectedModel');
  const storedDefaultModel = store.get('selectedModel');
  const defaultModelId = model || storedSelectedModel || storedDefaultModel || '';
  
  console.log(`[API设置调试] processUserMessage: 模型选择详情 -`);
  console.log(`  前端传递的模型: ${model || '未提供'}`);
  console.log(`  存储的selectedModel: ${storedSelectedModel || '未设置'}`);
  console.log(`  存储的selectedModel: ${storedDefaultModel || '未设置'}`);
  console.log(`  最终使用的模型ID: ${defaultModelId || '未设置模型'}`);
  
  // 记录完整的存储状态用于调试
  console.log('[API设置调试] 当前存储中的相关设置:', {
    selectedModel: store.get('selectedModel'),
    selectedProvider: store.get('selectedProvider'),
    deepseekApiKey: store.get('deepseekApiKey') ? '已设置' : '未设置',
    openrouterApiKey: store.get('openrouterApiKey') ? '已设置' : '未设置'
  });

  const validHistory = state.conversationHistory.filter(msg =>
    msg && msg.role && (msg.content || msg.tool_calls)
  );

  try {
    // 创建AbortController用于停止功能
    const chatCoordinator = require('./chatCoordinator');
    const abortController = new AbortController();
    chatCoordinator.setAbortController(abortController);
    
    // 通知前端开始流式传输
    _sendAiResponseToFrontend('streaming_started', { sessionId: sessionId });
    
    const stream = chatCoordinator.chatWithAI(validHistory, defaultModelId, customPrompt, mode, ragRetrievalEnabled, aiParameters);
    for await (const chunk of stream) {
      // 检查是否被中止
      if (abortController.signal.aborted) {
        console.log('[MessageProcessor] 请求已被中止，停止处理流式响应');
        break;
      }
      
      if (chunk.type === 'text') {
        if (chatCoordinator.getStreamingMode()) {
          _sendAiResponseToFrontend('text_stream', { content: chunk.content, sessionId: sessionId });
        } else {
          _sendAiResponseToFrontend('text', { content: chunk.content, sessionId: sessionId });
        }
      } else if (chunk.type === 'tool_calls' && chunk.content) {
         if (chatCoordinator.getStreamingMode()) {
          for (const delta of chunk.content) {
            _sendAiResponseToFrontend('tool_stream', [delta]);
            await new Promise(resolve => setTimeout(resolve, 10));
          }
        } else {
          _sendAiResponseToFrontend('tool_suggestions', state.pendingToolCalls);
        }
      }
    }
    if (chatCoordinator.getStreamingMode() && !abortController.signal.aborted) {
      _sendAiResponseToFrontend('text_stream_end', null);
    }
    
    // 通知前端流式传输已结束
    _sendAiResponseToFrontend('streaming_ended', { sessionId: sessionId });
    
    // 清理AbortController
    chatCoordinator.setAbortController(null);
    
  } catch (error) {
    console.error('调用聊天服务失败:', error);
    _sendAiResponseToFrontend('error', `调用聊天服务失败: ${error.message}`);
    // 清理AbortController
    const chatCoordinator = require('./chatCoordinator');
    chatCoordinator.setAbortController(null);
  }
}

// 记录对话日志
async function logConversation(sessionId) {
  await logger.logAiConversation(sessionId);
}

module.exports = {
  _sendAiResponseToFrontend,
  resetResponseCount,
  processStreamResponse,
  processUserMessage,
  logConversation
};