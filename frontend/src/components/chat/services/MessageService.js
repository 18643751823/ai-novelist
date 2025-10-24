import { appendMessage, setQuestionCard } from '../../../store/slices/chatSlice';
import contextManager from './ContextManager'; // 导入单例实例

/**
 * 消息处理服务
 * 负责处理用户消息发送、AI响应、流式传输等
 */
class MessageService {
  constructor(ipcRenderer, dispatch) {
    this.ipcRenderer = ipcRenderer;
    this.dispatch = dispatch;
    this.contextManager = contextManager; // 使用导入的单例实例
  }

  /**
   * 处理用户问题响应
   */
  async handleUserQuestionResponse(response, toolCallId, isButtonClick, enableStream) {
    this.dispatch(setQuestionCard(null));

    const formattedResponse = isButtonClick
      ? `同意/批准此建议：${response}`
      : `用户暂时没有采纳这些建议，而是给出了其他回复：${response}`;
    
    // 将用户的原始回复（未格式化）添加到聊天记录中
    this.dispatch(appendMessage({ 
      sender: 'User', 
      text: response, 
      role: 'user', 
      content: response, 
      className: 'user', 
      sessionId: toolCallId 
    }));

    if (enableStream) {
      this.dispatch(appendMessage({
        sender: 'AI',
        text: '',
        role: 'assistant',
        content: '',
        className: 'ai',
        sessionId: toolCallId,
        isLoading: true,
      }));
    }
    
    try {
      await this.ipcRenderer.invoke('user-question-response', { 
        response: formattedResponse, 
        toolCallId 
      });
    } catch (error) {
      console.error('MessageService: 发送用户问题响应失败:', error);
      throw error;
    }
  }

  /**
   * 处理发送消息
   */
  async handleSendMessage(messageText, options) {
    const {
      questionCard,
      currentSessionIdRef,
      enableStream,
      currentMode,
      modeFeatureSettings,
      aiParameters,
      messages,
      getStoreValue,
      messageDisplayRef // 新增：消息显示组件的引用
    } = options;

    if (!messageText.trim()) return;

    // **新逻辑**: 检查是否存在一个待回答的问题
    if (questionCard && questionCard.toolCallId) {
      // 如果有，则此消息是对该问题的回答
      await this.handleUserQuestionResponse(messageText, questionCard.toolCallId, false, enableStream);
      return; // 结束函数，不执行常规消息发送
    }

    // --- 以下是常规消息发送逻辑 ---
    const currentSessionId = currentSessionIdRef.current || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    currentSessionIdRef.current = currentSessionId;

    // 使用ContextManager获取对话上下文
    let latestMessages = messages;
    try {
      const contextData = await this.contextManager.exportContextForBackend({
        messages,
        messageDisplayRef,
        includeStatistics: false
      });
      latestMessages = contextData.messages;
      console.log('[MessageService] 已通过ContextManager获取对话上下文');
    } catch (error) {
      console.warn('[MessageService] 通过ContextManager获取上下文失败，使用原始消息:', error);
    }

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
      // 检查是否有可用的模型 - 直接从存储获取，避免Redux状态同步问题
      const currentStoredModel = await getStoreValue('selectedModel');
      const currentModel = currentStoredModel || options.selectedModel || '';
      console.log(`[MessageService] handleSendMessage - 存储模型: "${currentStoredModel}", 最终使用: "${currentModel}"`);
      
      if (!currentModel || currentModel.trim() === '') {
        console.log('[MessageService] 最终模型为空，显示错误消息');
        this.dispatch(appendMessage({
          sender: 'System',
          text: '当前没有可用的AI模型。请先前往设置页面配置API密钥。如果已经配置，请在上方重新选择模型，再次发送信息即可',
          role: 'system',
          content: '当前没有可用的AI模型。请先前往设置页面配置API密钥。如果已经配置，请在上方重新选择模型，再次发送信息即可',
          className: 'system-error'
        }));
        return;
      }

      // 直接从存储获取当前模式的自定义提示词，避免Redux状态同步延迟问题
      const storedCustomPrompts = await getStoreValue('customPrompts');
      const customPrompt = storedCustomPrompts ? storedCustomPrompts[currentMode] : '';
      const hasCustomPrompt = customPrompt !== null && customPrompt !== undefined && customPrompt !== '';
      console.log(`[MessageService] 发送消息，模式: ${currentMode}, 自定义提示词: ${hasCustomPrompt ? '有' : '无'}`);

      // 获取当前模式的功能设置（工具功能已硬编码，只传递RAG检索状态）
      const currentModeFeatures = modeFeatureSettings[currentMode] || {
        ragRetrievalEnabled: false
      };

      // 获取当前模式的AI参数
      const currentModeAiParameters = aiParameters[currentMode] || {
        temperature: 0.7,
        top_p: 0.7,
        n: 1,
      };

      await this.ipcRenderer.invoke('process-command', {
        message: messageText,
        sessionId: currentSessionId,
        currentMessages: latestMessages, // 使用最新的消息内容
        mode: currentMode,
        customPrompt: customPrompt,
        ragRetrievalEnabled: currentModeFeatures.ragRetrievalEnabled,
        model: currentModel,
        aiParameters: currentModeAiParameters
      });
      console.log(`[MessageService] 已调用 invoke('process-command')，模型参数: ${currentModel}`);
      console.log(`[DEBUG][MessageService] 传递给后端的AI参数:`, JSON.stringify(currentModeAiParameters, null, 2));
    } catch (error) {
      console.error('MessageService: 发送消息到AI失败:', error);
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
   * 验证模型可用性
   */
  async validateModelAvailability(getStoreValue, selectedModel) {
    const currentStoredModel = await getStoreValue('selectedModel');
    const currentModel = currentStoredModel || selectedModel || '';
    
    if (!currentModel || currentModel.trim() === '') {
      return {
        valid: false,
        message: '当前没有可用的AI模型。请先前往设置页面配置API密钥。如果已经配置，请在上方重新选择模型，再次发送信息即可'
      };
    }
    
    return { valid: true, model: currentModel };
  }

  /**
   * 获取消息发送参数
   */
  async getMessageParameters(getStoreValue, currentMode, modeFeatureSettings, aiParameters) {
    // 获取自定义提示词
    const storedCustomPrompts = await getStoreValue('customPrompts');
    const customPrompt = storedCustomPrompts ? storedCustomPrompts[currentMode] : '';

    // 获取当前模式的功能设置
    const currentModeFeatures = modeFeatureSettings[currentMode] || {
      ragRetrievalEnabled: false
    };

    // 获取当前模式的AI参数
    const currentModeAiParameters = aiParameters[currentMode] || {
      temperature: 0.7,
      top_p: 0.7,
      n: 1,
    };

    return {
      customPrompt,
      ragRetrievalEnabled: currentModeFeatures.ragRetrievalEnabled,
      aiParameters: currentModeAiParameters
    };
  }
}

export default MessageService;
