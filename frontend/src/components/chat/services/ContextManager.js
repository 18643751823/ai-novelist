import { store } from '../../../store';

/**
 * 对话上下文管理服务
 * 负责从前端获取对话上下文数据，并构建供后端使用的消息格式
 */
class ContextManager {
  constructor() {
    this.messageFields = ['id', 'sender', 'text', 'role', 'content', 'className', 'sessionId', 'toolCalls', 'isLoading'];
  }

  /**
   * 获取前端所有气泡的最新对话上下文
   * @param {Object} options 选项参数
   * @param {Array} options.messages 消息数组
   * @param {Function} options.messageDisplayRef 消息显示组件的引用（可选）
   * @returns {Array} 格式化后的对话上下文
   */
  async getConversationContext(options = {}) {
    const { messages, messageDisplayRef } = options;
    
    try {
      // 获取最新的消息内容（包括用户编辑后的内容）
      let latestMessages = messages || [];
      
      // 如果有消息显示组件的引用，尝试获取最新的编辑内容
      if (messageDisplayRef && messageDisplayRef.current && typeof messageDisplayRef.current.getAllMessagesLatestContent === 'function') {
        try {
          latestMessages = messageDisplayRef.current.getAllMessagesLatestContent();
          console.log('[ContextManager] 已获取所有消息的最新编辑内容');
        } catch (error) {
          console.warn('[ContextManager] 获取最新消息内容失败，使用原始消息:', error);
        }
      }

      // 格式化消息为后端需要的格式
      const formattedContext = this.formatMessagesForBackend(latestMessages);
      
      console.log(`[ContextManager] 获取到 ${formattedContext.length} 条对话上下文`);
      return formattedContext;
      
    } catch (error) {
      console.error('[ContextManager] 获取对话上下文失败:', error);
      throw error;
    }
  }

  /**
   * 格式化消息为后端需要的格式
   * @param {Array} messages 原始消息数组
   * @returns {Array} 格式化后的消息数组
   */
  formatMessagesForBackend(messages) {
    if (!Array.isArray(messages)) {
      return [];
    }

    return messages
      .filter(message => message && message.role && (message.content || message.tool_calls || message.toolCalls))
      .map(message => {
        const formattedMessage = {
          role: message.role,
          content: message.content || '',
          sessionId: message.sessionId || this.generateSessionId()
        };

        // 添加可选字段
        if (message.id) formattedMessage.id = message.id;
        
        // 关键修复：将前端的 toolCalls 字段转换为后端的 tool_calls 字段
        if (message.tool_calls) {
          formattedMessage.tool_calls = message.tool_calls;
        } else if (message.toolCalls) {
          // 将前端的 toolCalls 格式转换为标准的 tool_calls 格式
          formattedMessage.tool_calls = message.toolCalls.map(toolCall => ({
            id: toolCall.id,
            type: toolCall.type || 'function',
            function: toolCall.function || {
              name: toolCall.toolName || 'unknown',
              arguments: JSON.stringify(toolCall.toolArgs || {})
            }
          }));
          console.log('[ContextManager] 已将 toolCalls 转换为 tool_calls:', formattedMessage.tool_calls);
        }
        
        if (message.tool_call_id) formattedMessage.tool_call_id = message.tool_call_id;
        if (message.toolCallId) formattedMessage.tool_call_id = message.toolCallId; // 修复：兼容 toolCallId 字段
        if (message.name) formattedMessage.name = message.name;
        if (message.reasoning_content) formattedMessage.reasoning_content = message.reasoning_content;
        if (message.toolName) formattedMessage.toolName = message.toolName; // 保留工具名称

        return formattedMessage;
      });
  }

  /**
   * 获取当前对话的上下文统计信息
   * @param {Array} messages 消息数组
   * @returns {Object} 统计信息
   */
  getContextStatistics(messages) {
    if (!Array.isArray(messages)) {
      return {
        totalMessages: 0,
        userMessages: 0,
        assistantMessages: 0,
        systemMessages: 0,
        toolMessages: 0,
        hasToolCalls: false
      };
    }

    const stats = {
      totalMessages: messages.length,
      userMessages: messages.filter(msg => msg.role === 'user').length,
      assistantMessages: messages.filter(msg => msg.role === 'assistant').length,
      systemMessages: messages.filter(msg => msg.role === 'system').length,
      toolMessages: messages.filter(msg => msg.role === 'tool').length,
      hasToolCalls: messages.some(msg => msg.tool_calls && msg.tool_calls.length > 0)
    };

    console.log('[ContextManager] 上下文统计:', stats);
    return stats;
  }

  /**
   * 验证消息格式是否正确
   * @param {Object} message 消息对象
   * @returns {boolean} 是否有效
   */
  validateMessageFormat(message) {
    if (!message || typeof message !== 'object') {
      return false;
    }

    // 必需字段检查
    if (!message.role || !['user', 'assistant', 'system', 'tool'].includes(message.role)) {
      return false;
    }

    // 内容检查：至少要有 content 或 tool_calls
    if (!message.content && (!message.tool_calls || !Array.isArray(message.tool_calls))) {
      return false;
    }

    return true;
  }

  /**
   * 清理消息中的敏感信息
   * @param {Array} messages 消息数组
   * @returns {Array} 清理后的消息数组
   */
  sanitizeMessages(messages) {
    if (!Array.isArray(messages)) {
      return [];
    }

    return messages.map(message => {
      const sanitized = { ...message };
      
      // 移除前端特定的字段，但保留工具相关的字段
      delete sanitized.sender;
      delete sanitized.text;
      delete sanitized.className;
      delete sanitized.isLoading;
      
      // 修复：确保 tool_call_id 和 toolCallId 字段不被删除
      // 这些字段对于工具调用关联至关重要
      
      return sanitized;
    });
  }

  /**
   * 生成会话ID
   * @returns {string} 会话ID
   */
  generateSessionId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 导出上下文数据供后端使用
   * @param {Object} options 选项参数
   * @returns {Object} 导出的上下文数据
   */
  async exportContextForBackend(options = {}) {
    const { messages, messageDisplayRef, includeStatistics = true } = options;
    
    try {
      // 获取对话上下文
      const conversationContext = await this.getConversationContext({ messages, messageDisplayRef });
      
      // 清理消息
      const sanitizedContext = this.sanitizeMessages(conversationContext);
      
      // 构建导出对象
      const exportData = {
        messages: sanitizedContext,
        timestamp: Date.now(),
        sessionId: sanitizedContext.length > 0 ? sanitizedContext[0].sessionId : this.generateSessionId()
      };

      // 可选：包含统计信息
      if (includeStatistics) {
        exportData.statistics = this.getContextStatistics(sanitizedContext);
      }

      console.log('[ContextManager] 导出上下文数据:', exportData);
      return exportData;
      
    } catch (error) {
      console.error('[ContextManager] 导出上下文数据失败:', error);
      throw error;
    }
  }
}

// 创建单例实例
const contextManager = new ContextManager();

export default contextManager;