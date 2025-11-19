import { appendMessage, setQuestionCard } from '../../../store/slices/chatSlice';
import ChatService from '../../../services/chatService.js';

//新的消息处理服务
class MessageServiceNew {
  constructor(dispatch) {
    this.dispatch = dispatch;
    this.ChatService = ChatService;
    this.processedToolMessages = new Set(); // 用于跟踪已处理的工具消息，避免重复
  }
  //发送消息
  async handleSendMessage(messageText, options) {
    const {
      questionCard,
      currentSessionIdRef,
      enableStream,
      currentMode,
      getStoreValue,
    } = options;

    if (!messageText.trim()) return;


    // --- 以下是常规消息发送逻辑 ---
    const currentSessionId = currentSessionIdRef.current || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    currentSessionIdRef.current = currentSessionId;

    const newUserMessage = {
      sender: 'User',
      text: messageText,
      role: 'user',
      content: messageText,
      className: 'user',
      sessionId: currentSessionId,
    };
    this.dispatch(appendMessage(newUserMessage));

    if (enableStream) {
      this.dispatch(appendMessage({
        sender: 'AI',
        text: '',
        role: 'assistant',
        content: '',
        className: 'ai',
        sessionId: currentSessionId,
        isLoading: true,
      }));
    }

    this.dispatch(setQuestionCard(null));

    try {
      // 检查是否有可用的模型
      const currentStoredModel = await getStoreValue('selectedModel');
      const currentModel = currentStoredModel || '';
      
      if (!currentModel || currentModel.trim() === '') {
        console.log('[MessageServiceNew] 最终模型为空，显示错误消息');
        this.dispatch(appendMessage({
          sender: 'System',
          text: '当前没有可用的AI模型。请先前往设置页面配置API密钥。如果已经配置，请在上方重新选择模型，再次发送信息即可',
          role: 'system',
          content: '当前没有可用的AI模型。请先前往设置页面配置API密钥。如果已经配置，请在上方重新选择模型，再次发送信息即可',
          className: 'system-error'
        }));
        return;
      }

      // 发送聊天消息
      const chatRequest = {
        message: messageText,
        thread_id: currentSessionId,
        stream: enableStream,
        mode: currentMode
      };

      console.log('[MessageServiceNew] 发送聊天请求:', chatRequest);

      const result = await this.ChatService.sendChatMessage(chatRequest);

      // 流式传输开始
      this.dispatch({
        type: 'message/handleStreamingMessage',
        payload: {
          type: 'streaming_started'
        }
      });
      
      await this.handleStreamResponse(result, currentSessionId);
    } catch (error) {
      console.error('MessageServiceNew: 发送消息到AI失败:', error);
      this.dispatch(appendMessage({ 
        sender: 'System', 
        text: `发送消息失败: ${error.message}`, 
        role: 'system', 
        content: `发送消息失败: ${error.message}`, 
        className: 'system-error' 
      }));
      throw error;
    }
  }

  /**
   * 处理流式响应
   */
  async handleStreamResponse(stream, sessionId) {
    try {
      console.log('[MessageServiceNew] 开始处理流式响应');
      
      // 用于跟踪已处理的AI消息，避免重复处理
      const processedAiMessages = new Set();
      
      for await (const chunk of stream) {
        console.log('[MessageServiceNew] 收到流式chunk:', chunk);
        
        // 根据chunk类型分发处理
        // 处理状态快照对象
        if (chunk.type === 'state_snapshot') {
          console.log('[MessageServiceNew] 处理状态快照:', chunk);
          
          // 从状态快照中提取消息
          if (chunk.values && chunk.values.messages && Array.isArray(chunk.values.messages)) {
            // 遍历所有消息，提取AI消息和工具消息
            for (const msg of chunk.values.messages) {
              // 处理AI消息
              if (msg.type === 'aimessage' && msg.content) {
                // 创建唯一标识符来避免重复处理AI消息
                const messageKey = `${msg.id || ''}-${msg.content.substring(0, 50)}`;
                
                if (!processedAiMessages.has(messageKey)) {
                  processedAiMessages.add(messageKey);
                  
                  this.dispatch({
                    type: 'message/handleStreamingMessage',
                    payload: {
                      type: 'text_stream',
                      payload: {
                        content: msg.content,
                        sessionId: sessionId
                      }
                    }
                  });
                }
              }
              
              // 处理工具消息
              if (msg.type === 'toolmessage' && msg.content) {
                // 创建唯一标识符来避免重复处理
                const messageKey = `${msg.tool_call_id || msg.id || ''}-${msg.content.substring(0, 50)}`;
                
                if (!this.processedToolMessages.has(messageKey)) {
                  this.processedToolMessages.add(messageKey);
                  
                  this.dispatch({
                    type: 'message/handleStreamingMessage',
                    payload: {
                      type: 'tool_result',
                      payload: {
                        content: msg.content,
                        sessionId: sessionId,
                        toolName: '工具执行结果',
                        toolCallId: msg.tool_call_id || null
                      }
                    }
                  });
                }
              }
            }
          }
          
          // 处理状态快照中的中断信息
          if (chunk.interrupts && chunk.interrupts.length > 0) {
            console.log('[MessageServiceNew] 状态快照包含中断信息:', chunk.interrupts);
            for (const interrupt of chunk.interrupts) {
              if (interrupt.type === 'interrupt') {
                this.dispatch({
                  type: 'message/handleStreamingMessage',
                  payload: {
                    type: 'interrupt',
                    payload: {
                      reason: interrupt.reason || 'unknown',
                      value: interrupt.value || '工具中断',
                      id: interrupt.id || null,
                      sessionId: sessionId
                    }
                  }
                });
              }
            }
          }
          continue;
        }
        
        // 处理独立的中断对象
        if (chunk.type === 'interrupt') {
          console.log('[MessageServiceNew] 收到中断信息:', chunk);
          
          this.dispatch({
            type: 'message/handleStreamingMessage',
            payload: {
              type: 'interrupt',
              payload: {
                reason: chunk.reason || 'unknown',
                value: chunk.value || '工具中断',
                id: chunk.id || null,
                sessionId: sessionId
              }
            }
          });
          continue;
        }
        if (chunk.type === 'done') {
          // 流式处理完成
          console.log('[MessageServiceNew] 流式处理完成');
          continue;
        }
        
        // 处理 call_llm 类型的chunk
        if (chunk.call_llm) {
          console.log('[MessageServiceNew] 处理 call_llm chunk:', chunk.call_llm);
          
          // 从 call_llm 中提取消息
          if (chunk.call_llm.messages && Array.isArray(chunk.call_llm.messages)) {
            // 只处理最后一条AI消息，避免重复处理历史消息
            const aiMessages = chunk.call_llm.messages.filter(msg => msg.type === 'aimessage');
            if (aiMessages.length > 0) {
              // 只处理最后一条AI消息
              const lastAiMessage = aiMessages[aiMessages.length - 1];
              if (lastAiMessage && lastAiMessage.content) {
                // 创建唯一标识符来避免重复处理AI消息
                const messageKey = `${lastAiMessage.id || ''}-${lastAiMessage.content.substring(0, 50)}`;
                
                if (!processedAiMessages.has(messageKey)) {
                  processedAiMessages.add(messageKey);
                  
                  this.dispatch({
                    type: 'message/handleStreamingMessage',
                    payload: {
                      type: 'text_stream',
                      payload: {
                        content: lastAiMessage.content,
                        sessionId: sessionId
                      }
                    }
                  });
                }
              }
            }
            
            // 处理工具消息
            const toolMessages = chunk.call_llm.messages.filter(msg => msg.type === 'toolmessage');
            for (const msg of toolMessages) {
              if (msg.content) {
                // 创建唯一标识符来避免重复处理
                const messageKey = `${msg.tool_call_id || msg.id || ''}-${msg.content.substring(0, 50)}`;
                
                if (!this.processedToolMessages.has(messageKey)) {
                  this.processedToolMessages.add(messageKey);
                  
                  this.dispatch({
                    type: 'message/handleStreamingMessage',
                    payload: {
                      type: 'tool_result',
                      payload: {
                        content: msg.content,
                        sessionId: sessionId,
                        toolName: '工具执行结果',
                        toolCallId: msg.tool_call_id || null
                      }
                    }
                  });
                }
              }
            }
          }
          continue;
        }
      }
      
      // 流式传输结束 - 发送流式结束事件
      this.dispatch({
        type: 'message/handleStreamingMessage',
        payload: {
          type: 'streaming_ended'
        }
      });
      
    } catch (error) {
      console.error('[MessageServiceNew] 处理流式响应失败:', error);
      this.dispatch({
        type: 'message/handleStreamingMessage',
        payload: {
          type: 'error',
          payload: `流式响应处理失败: ${error.message}`
        }
      });
      
      // 发生错误时也要结束流式状态
      this.dispatch({
        type: 'message/handleStreamingMessage',
        payload: {
          type: 'streaming_ended'
        }
      });
    }
  }
}

export default MessageServiceNew;
