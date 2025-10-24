import { createSlice } from '@reduxjs/toolkit';

// 消息管理子模块
const messageSlice = createSlice({
  name: 'message',
  initialState: {
    messages: [],
    questionCard: null,
    isHistoryPanelVisible: false,
    deepSeekHistory: [],
    isStreaming: false,
    abortController: null
  },
  reducers: {
    // 消息操作
    appendMessage: (state, action) => {
      const message = action.payload;
      // 确保每条消息都有唯一ID
      if (!message.id) {
        message.id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      }
      state.messages.push(message);
    },
    
    setMessages: (state, action) => {
      state.messages = action.payload;
    },
    
    deleteMessage: (state, action) => {
      const { messageId } = action.payload;
      const messageIndex = state.messages.findIndex(msg => msg.id === messageId);
      if (messageIndex !== -1) {
        // 删除该消息及之后的所有消息
        state.messages.splice(messageIndex);
      }
    },
    
    updateMessageContent: (state, action) => {
      const { messageId, content } = action.payload;
      const message = state.messages.find(msg => msg.id === messageId);
      if (message) {
        message.content = content;
        message.text = content; // 确保 text 和 content 同步
      }
    },
    
    // 历史消息恢复
    restoreMessages: (state, action) => {
      const rawMessages = action.payload;
      const newMessages = [];
      
      if (!rawMessages || !Array.isArray(rawMessages)) {
        state.messages = [];
        return;
      }

      for (const msg of rawMessages) {
        // 为每个恢复的消息生成唯一的React key
        const id = msg.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-restored`;

        if (msg.role === 'user') {
          newMessages.push({
            id,
            sender: 'User',
            text: msg.content,
            role: 'user',
            content: msg.content,
            className: 'user',
            sessionId: msg.sessionId,
          });
        } else if (msg.role === 'assistant') {
          // 解析工具调用，并为历史记录添加 'historical' 状态
          const toolCalls = (msg.tool_calls || []).map(tc => {
            let toolArgs;
            try {
              toolArgs = JSON.parse(tc.function.arguments || '{}');
            } catch (e) {
              toolArgs = { error: 'failed to parse arguments', raw: tc.function.arguments };
            }
            return {
              id: tc.id,
              function: tc.function,
              type: 'function',
              toolArgs,
              // **关键**: 添加状态以告知UI这是历史记录，不应有交互按钮
              status: 'historical',
            };
          });

          newMessages.push({
            id,
            sender: 'AI',
            text: msg.content || '',
            role: 'assistant',
            content: msg.content || '',
            className: 'ai',
            sessionId: msg.sessionId,
            // 只有当存在工具调用时才添加此属性
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
            isLoading: false,
          });
        } else if (msg.role === 'tool') {
            // 将工具执行结果格式化为一条易于阅读的系统消息
            let resultText = `[Tool execution: ${msg.name}]`;
            try {
                const result = JSON.parse(msg.content);
                if (result.success) {
                    resultText = `✅ 工具 [${msg.name}] 已成功执行。`;
                } else {
                    resultText = `❌ 工具 [${msg.name}] 执行失败: ${result.error || '未知错误'}`;
                }
            } catch(e) { /* 忽略解析错误，使用默认文本 */ }

            newMessages.push({
                id,
                sender: 'System',
                text: resultText,
                role: 'system',
                content: resultText,
                className: 'system-message',
                sessionId: msg.sessionId,
            });
        }
        // 我们在此处特意过滤掉 role === 'system' 的消息，因为它们是给AI的上下文，通常不在对话中展示。
      }
      
      // 重置整个聊天状态，并用重构后的消息列表替换
      state.messages = newMessages;
      state.questionCard = null;
    },
    
    
    // 流式传输控制
    setStreamingState: (state, action) => {
      const { isStreaming, abortController } = action.payload;
      state.isStreaming = isStreaming;
      state.abortController = abortController;
    },
    
    stopStreaming: (state) => {
      if (state.abortController) {
        state.abortController.abort();
        console.log('[messageSlice] 已中止流式传输');
      }
      state.isStreaming = false;
      state.abortController = null;
      
      // 将最后一条AI消息的加载状态设为false
      const lastMessage = state.messages[state.messages.length - 1];
      if (lastMessage && lastMessage.role === 'assistant' && lastMessage.isLoading) {
        lastMessage.isLoading = false;
      }
    },
    
    // 问题卡片管理
    setQuestionCard: (state, action) => {
      state.questionCard = action.payload;
    },
    
    // 历史面板管理
    setIsHistoryPanelVisible: (state, action) => {
      state.isHistoryPanelVisible = action.payload;
    },
    
    setDeepSeekHistory: (state, action) => {
      state.deepSeekHistory = action.payload;
    },
    
    // 流式消息处理
    handleStreamingMessage: (state, action) => {
      const { type, payload } = action.payload;
      const currentMessages = state.messages;

      switch (type) {
        case 'text_stream':
        case 'tool_stream':
          // 处理流式响应，智能创建占位符
          let lastAssistantMessage = currentMessages[currentMessages.length - 1];

          // 检查最后一条消息是否不是AI消息，如果是，则说明需要一个新的AI消息占位符
          if (!lastAssistantMessage || lastAssistantMessage.role !== 'assistant') {
            const newPlaceholder = {
              sender: 'AI',
              text: '',
              role: 'assistant',
              content: '',
              className: 'ai',
              sessionId: payload.sessionId,
              isLoading: true,
              id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}` // 确保有唯一ID
            };
            currentMessages.push(newPlaceholder);
            lastAssistantMessage = newPlaceholder;
          }

          // 确保消息有唯一ID
          if (!lastAssistantMessage.id) {
            lastAssistantMessage.id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          }

          // 只有在第一次收到数据时才清空占位内容，但保持 isLoading 状态
          if (lastAssistantMessage.isLoading && !lastAssistantMessage.content && !lastAssistantMessage.text) {
            lastAssistantMessage.content = '';
            lastAssistantMessage.text = '';
          }

          // 根据类型处理数据
          if (type === 'text_stream') {
            // 流式文本内容追加
            lastAssistantMessage.content += payload.content;
            lastAssistantMessage.text += payload.content;
          } else if (type === 'tool_stream') {
            const toolCallDeltas = payload;

            if (!lastAssistantMessage.toolCalls) {
              lastAssistantMessage.toolCalls = [];
            }
            toolCallDeltas.forEach(delta => {
              const { index, id } = delta;
              const func = delta.function;
              if (func && func.arguments) {
                lastAssistantMessage.content += func.arguments;
                lastAssistantMessage.text += func.arguments;
              }
              if (!lastAssistantMessage.toolCalls[index]) {
                lastAssistantMessage.toolCalls[index] = { id: '', function: { name: '', arguments: '' }, type: 'function' };
              }
              const toolCall = lastAssistantMessage.toolCalls[index];
              if (id) toolCall.id = id;
              if (func) {
                if (func.name) toolCall.function.name = func.name;
                if (func.arguments) toolCall.function.arguments += func.arguments;
              }
            });
          }
          break;
          
        case 'text_stream_end':
          // 流结束时，对最终的消息进行处理
          const lastMessage = currentMessages[currentMessages.length - 1];
          if (lastMessage && lastMessage.role === 'assistant') {
            lastMessage.isLoading = false;
            // 确保内容格式正确
            if (!lastMessage.content && lastMessage.text) {
              lastMessage.content = lastMessage.text;
            }
            if (!lastMessage.text && lastMessage.content) {
              lastMessage.text = lastMessage.content;
            }
          }

          // 最终解析所有累积的工具调用参数
          const processAndParseTools = (toolList) => {
            if (!Array.isArray(toolList)) return;
            toolList.forEach(tool => {
              if (tool.function && typeof tool.function.arguments === 'string' && !tool.toolArgs) {
                try {
                  tool.toolArgs = JSON.parse(tool.function.arguments);
                } catch (e) {
                  console.error(`解析工具参数失败: ${tool.function.arguments}`, e);
                  tool.toolArgs = { "error": "failed to parse arguments" };
                }
              }
            });
          };

          processAndParseTools(lastMessage.toolCalls);
          break;
          
        case 'text':
          let messageUpdated = false;
          for (let i = currentMessages.length - 1; i >= 0; i--) {
            const msg = currentMessages[i];
            if (msg.role === 'assistant' && msg.isLoading) {
              msg.text = payload.content;
              msg.content = payload.content;
              msg.isLoading = false;
              messageUpdated = true;
              break;
            }
          }
          if (!messageUpdated) {
            currentMessages.push({
              sender: 'AI',
              text: payload.content,
              role: 'assistant',
              content: payload.content,
              className: 'ai',
              sessionId: payload.sessionId,
              isLoading: false,
            });
          }
          break;
          
        case 'reasoning_content':
          let foundExistingReasoningMessage = false;
          const lastAiMessageIndex = currentMessages.length - 1;
          if (lastAiMessageIndex >= 0 && currentMessages[lastAiMessageIndex].role === 'assistant' && currentMessages[lastAiMessageIndex].sessionId === payload.sessionId) {
            currentMessages[lastAiMessageIndex].reasoning_content = payload.content;
            foundExistingReasoningMessage = true;
          }
          if (!foundExistingReasoningMessage) {
            currentMessages.push({
              sender: 'AI',
              text: '',
              role: 'assistant',
              content: '',
              className: 'ai',
              sessionId: payload.sessionId,
              reasoning_content: payload.content,
            });
          }
          break;
          
        case 'error':
          currentMessages.push({ sender: 'System', text: `错误: ${payload}`, role: 'system', content: `错误: ${payload}`, className: 'system-error', sessionId: payload.sessionId });
          break;
          
        case 'warning':
          currentMessages.push({ sender: 'System', text: `警告: ${payload}`, role: 'system', content: `警告: ${payload}`, className: 'system-warning', sessionId: payload.sessionId });
          break;
          
        case 'tool_action_status':
        case 'tool_execution_status':
          const messageText = `工具 ${payload.toolName} 执行${payload.success ? '成功' : '失败'}：${payload.message}`;
          currentMessages.push({
            sender: 'System',
            text: messageText,
            role: 'system',
            content: messageText,
            className: 'system-message',
            sessionId: payload.sessionId,
          });
          break;
          
        case 'batch_action_status':
          currentMessages.push({
            sender: 'System',
            text: payload.message,
            role: 'system',
            content: payload.message,
            className: 'system-message',
            sessionId: payload.sessionId,
          });
          break;
          
        case 'tool_suggestions':
          // 处理工具建议，只更新消息显示，工具状态由toolSlice管理
          const suggestions = payload;
          const lastMessageForSuggestions = currentMessages[currentMessages.length - 1];
          
          if (lastMessageForSuggestions && lastMessageForSuggestions.role === 'assistant') {
            // 更新消息中的工具调用信息用于显示
            lastMessageForSuggestions.toolCalls = suggestions.map(tool => ({
              id: tool.toolCallId,
              function: tool.function,
              type: 'function',
              toolArgs: tool.toolArgs,
            }));
          }
          break;
          
        case 'ask_user_question':
          // 处理用户提问卡片
          state.questionCard = payload;
          break;
          
        case 'streaming_started':
          // 流式传输开始，设置流式状态
          state.isStreaming = true;
          break;
          
        case 'streaming_ended':
          // 流式传输结束，清除流式状态
          state.isStreaming = false;
          break;
          
        default:
          console.warn(`[messageSlice] 未知消息类型: ${type}`);
      }
    }
  },
  // 使用extraReducers来监听来自chatSlice的AI响应
  extraReducers: (builder) => {
    builder
      .addCase('chat/ipcAiResponse', (state, action) => {
        // 调用handleStreamingMessage来处理AI响应
        messageSlice.caseReducers.handleStreamingMessage(state, action);
      });
  }
});

export const {
  appendMessage,
  setMessages,
  deleteMessage,
  updateMessageContent,
  restoreMessages,
  setStreamingState,
  stopStreaming,
  setQuestionCard,
  setIsHistoryPanelVisible,
  setDeepSeekHistory,
  handleStreamingMessage
} = messageSlice.actions;

export default messageSlice.reducer;