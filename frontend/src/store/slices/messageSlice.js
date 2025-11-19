import { createSlice } from '@reduxjs/toolkit';

// 消息管理子模块
const messageSlice = createSlice({
  name: 'message',
  initialState: {
    messages: [],
    questionCard: null,
    interruptCard: null, // 新增：中断操作卡片
    isHistoryPanelVisible: false,
    isStreaming: false,
    abortController: null,
    collapsedToolMessages: {}, // 新增：存储tool消息的折叠状态
    sessionHistory: [] // 修改：由后端管理的会话历史
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
            // 新的工具调用格式：{ name, args, id, type }
            const toolName = tc.name || tc.function?.name || 'unknown';
            const toolArgs = tc.args || tc.arguments || {};
            const toolId = tc.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            return {
              id: toolId,
              name: toolName,
              args: toolArgs,
              type: tc.type || 'tool_call',
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
            // 直接显示原始工具执行结果内容，不进行格式化
            const restoredToolMessage = {
                id,
                sender: 'Tool',
                text: msg.content,
                role: 'tool',
                content: msg.content,
                className: 'tool-message',
                sessionId: msg.sessionId,
                tool_call_id: msg.tool_call_id, // 修复：恢复 tool_call_id 字段
                toolCallId: msg.tool_call_id || msg.toolCallId, // 保持向后兼容
                toolName: msg.toolName
            };
            newMessages.push(restoredToolMessage);
            
            // 新增：默认折叠从历史记录恢复的工具消息
            state.collapsedToolMessages[id] = true;
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
    
    // 中断卡片管理
    setInterruptCard: (state, action) => {
      state.interruptCard = action.payload;
    },
    
    clearInterruptCard: (state) => {
      state.interruptCard = null;
    },
    // 历史面板管理
    setIsHistoryPanelVisible: (state, action) => {
      state.isHistoryPanelVisible = action.payload;
    },
    
    // 会话历史管理（由后端控制）
    setSessionHistory: (state, action) => {
      state.sessionHistory = action.payload;
    },
    // 新增：tool消息折叠状态管理
    toggleToolMessageCollapse: (state, action) => {
      const { messageId } = action.payload;
      if (state.collapsedToolMessages[messageId]) {
        delete state.collapsedToolMessages[messageId];
      } else {
        state.collapsedToolMessages[messageId] = true;
      }
    },

    setToolMessageCollapse: (state, action) => {
      const { messageId, collapsed } = action.payload;
      if (collapsed) {
        state.collapsedToolMessages[messageId] = true;
      } else {
        delete state.collapsedToolMessages[messageId];
      }
    },
    
    // 流式消息处理
    handleStreamingMessage: (state, action) => {
      const { type, payload } = action.payload;
      const currentMessages = state.messages;

      switch (type) {
        case 'interrupt':
          // 处理中断信息，设置中断操作卡片而不是显示消息
          state.interruptCard = {
            id: payload.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            reason: payload.reason,
            value: payload.value,
            sessionId: payload.sessionId
          };
          break;
          
        case 'text_stream':
        case 'tool_stream':
        case 'reasoning_stream':
          // 处理流式响应，简单方案：如果最后一条AI消息已完成，就创建新气泡
          let targetMessage = null;
          const lastMsg = currentMessages[currentMessages.length - 1];
          
          // 检查最后一条消息是否是AI消息且仍在加载中
          if (lastMsg && lastMsg.role === 'assistant' && lastMsg.isLoading) {
            // 继续使用最后一条AI消息
            targetMessage = lastMsg;
          } else {
            // 创建新的AI消息占位符
            const newPlaceholder = {
              sender: 'AI',
              text: '',
              role: 'assistant',
              content: '',
              className: 'ai',
              sessionId: payload.sessionId,
              isLoading: true,
              id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
            };
            currentMessages.push(newPlaceholder);
            targetMessage = newPlaceholder;
          }

          // 根据类型处理数据
          if (type === 'text_stream') {
            // 检查是否是重复内容，如果是则不追加
            const existingContent = targetMessage.content || '';
            const newContent = payload.content;
            
            // 如果新内容已经包含在现有内容中，则不追加
            if (existingContent && existingContent.includes(newContent)) {
              console.log('[messageSlice] 检测到重复内容，跳过追加:', newContent.substring(0, 50) + '...');
            } else if (existingContent && newContent.includes(existingContent)) {
              // 如果新内容包含了现有内容，则替换整个内容
              console.log('[messageSlice] 检测到内容包含关系，替换整个内容');
              targetMessage.content = newContent;
              targetMessage.text = newContent;
            } else {
              // 正常追加新内容
              targetMessage.content += newContent;
              targetMessage.text += newContent;
            }
          } else if (type === 'tool_stream') {
            const toolCallDeltas = payload.payload || payload; // 支持两种格式：payload.payload 或直接 payload
  
            if (!targetMessage.toolCalls) {
              targetMessage.toolCalls = [];
            }
            // 修复Immer错误：使用不可变的方式更新数组
            const updatedToolCalls = [...(targetMessage.toolCalls || [])];
            
            toolCallDeltas.forEach(delta => {
              const { name, args, id } = delta;
              
              if (args) {
                const argsString = typeof args === 'string' ? args : JSON.stringify(args);
                targetMessage.content += argsString;
                targetMessage.text += argsString;
              }
              
              // 创建新的工具调用对象
              const newToolCall = {
                id: id || '',
                name: name || '',
                args: args || {},
                type: 'tool_call'
              };
              
              // 添加到工具调用列表
              updatedToolCalls.push(newToolCall);
            });
            
            targetMessage.toolCalls = updatedToolCalls;
          } else if (type === 'reasoning_stream') {
            // 流式思考内容追加
            if (!targetMessage.reasoning_content) {
              targetMessage.reasoning_content = '';
            }
            targetMessage.reasoning_content += payload.content;
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
              // 新格式中 args 已经是对象，不需要额外解析
              if (tool.args && typeof tool.args === 'string') {
                try {
                  tool.args = JSON.parse(tool.args);
                } catch (e) {
                  console.error(`解析工具参数失败: ${tool.args}`, e);
                  tool.args = { "error": "failed to parse arguments" };
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
          const toolStatusMessage = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            sender: 'Tool',
            text: messageText,
            role: 'tool',
            content: messageText,
            className: 'tool-message',
            sessionId: payload.sessionId,
            toolName: payload.toolName
          };
          currentMessages.push(toolStatusMessage);
          
          // 新增：默认折叠工具状态消息
          state.collapsedToolMessages[toolStatusMessage.id] = true;
          break;
          
        case 'batch_action_status':
          const batchActionMessage = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            sender: 'Tool',
            text: payload.message,
            role: 'tool',
            content: payload.message,
            className: 'tool-message',
            sessionId: payload.sessionId,
          };
          currentMessages.push(batchActionMessage);
          
          // 新增：默认折叠批量操作状态消息
          state.collapsedToolMessages[batchActionMessage.id] = true;
          break;
          
        case 'tool_result':
          // 处理工具执行结果，作为tool角色消息显示
          console.log(`[DEBUG][messageSlice] 收到 tool_result 消息，工具: ${payload.toolName}, 内容长度: ${payload.content.length}`);
          console.log(`[DEBUG][messageSlice] tool_result 内容预览: ${payload.content.substring(0, 100)}...`);
          
          const toolMessage = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            sender: 'Tool',
            text: payload.content,
            role: 'tool',
            content: payload.content,
            className: 'tool-message',
            sessionId: payload.sessionId,
            tool_call_id: payload.toolCallId, // 修复：使用标准的 tool_call_id 字段
            toolCallId: payload.toolCallId,   // 保持向后兼容
            toolName: payload.toolName
          };
          currentMessages.push(toolMessage);
          
          // 新增：默认折叠工具消息
          state.collapsedToolMessages[toolMessage.id] = true;
          console.log(`[DEBUG][messageSlice] tool_result 消息已添加到消息列表，并设置为默认折叠`);
          break;
          
        case 'tool_suggestions':
          // 处理工具建议，只更新消息显示，工具状态由toolSlice管理
          const suggestions = payload;
          const lastMessageForSuggestions = currentMessages[currentMessages.length - 1];
          
          if (lastMessageForSuggestions && lastMessageForSuggestions.role === 'assistant') {
            // 更新消息中的工具调用信息用于显示（新格式）
            lastMessageForSuggestions.toolCalls = suggestions.map(tool => ({
              id: tool.toolCallId || tool.id,
              name: tool.name || tool.function?.name,
              args: tool.args || tool.toolArgs || {},
              type: tool.type || 'tool_call',
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
          // 流式传输结束，清除流式状态并更新所有AI消息的加载状态
          state.isStreaming = false;
          
          // 将所有AI消息的isLoading状态设为false
          currentMessages.forEach(msg => {
            if (msg.role === 'assistant' && msg.isLoading) {
              msg.isLoading = false;
            }
          });
          break;
          
        case 'batch_processing_complete':
          // 批量工具处理完成，不需要显示消息，静默处理
          console.log('[messageSlice] 批量工具处理完成');
          break;
          
        case 'tool_call_request':
          // 工具调用请求，由toolSlice处理，这里只记录日志
          console.log(`[messageSlice] 收到工具调用请求，由toolSlice处理`);
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
  setInterruptCard,
  clearInterruptCard,
  setIsHistoryPanelVisible,
  setSessionHistory,
  handleStreamingMessage,
  toggleToolMessageCollapse,
  setToolMessageCollapse
} = messageSlice.actions;

export default messageSlice.reducer;