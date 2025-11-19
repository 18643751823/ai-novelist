// 会话管理服务 - 负责与后端会话API通信
import httpClient from '../utils/httpClient.js';

class SessionService {
  constructor() {
    this.baseURL = 'http://localhost:8000';
  }

  /**
   * 获取所有会话列表
   */
  async listSessions(includeExpired = false) {
    try {
      // 使用新的会话管理API获取所有会话
      const response = await httpClient.get('/api/history/sessions');
      
      if (response.success && response.sessions) {
        // 直接使用后端返回的会话数据
        const sessions = response.sessions.map(session => ({
          session_id: session.session_id,
          title: session.preview || `会话: ${session.session_id}`,
          created_at: session.created_at || new Date().toISOString(),
          updated_at: session.last_accessed || new Date().toISOString(),
          message_count: session.message_count,
          preview: session.preview,
          is_current: session.is_current || false
        }));
        
        return {
          success: true,
          sessions: sessions,
          message: response.message || '会话列表获取成功'
        };
      } else {
        return {
          success: false,
          error: response.message || '获取会话列表失败',
          sessions: []
        };
      }
    } catch (error) {
      console.error('获取会话列表失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message,
        sessions: []
      };
    }
  }

  /**
   * 创建新会话
   */
  async createSession(sessionId = null, mode = 'outline', initialMessages = []) {
    try {
      // 前端只需要保存消息，不需要显式创建会话
      return {
        success: true,
        session: {
          session_id: sessionId || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          mode: mode,
          messages: initialMessages || []
        },
        message: '会话创建成功'
      };
    } catch (error) {
      console.error('创建会话失败:', error);
      return {
        success: false,
        error: '创建会话失败: ' + error.message
      };
    }
  }

  /**
   * 获取会话详情
   */
  async getSession(sessionId) {
    try {
      const response = await httpClient.get(`/api/history/sessions/${sessionId}`);
      return {
        success: true,
        session: response.data?.session_data,
        message: '会话详情获取成功'
      };
    } catch (error) {
      console.error('获取会话详情失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message
      };
    }
  }

  /**
   * 更新会话
   */
  async updateSession(sessionId, updates) {
    try {
      // 前端只需要保存消息，不需要显式更新会话
      return {
        success: true,
        session: {
          session_id: sessionId,
          ...updates
        },
        message: '会话更新成功'
      };
    } catch (error) {
      console.error('更新会话失败:', error);
      return {
        success: false,
        error: '更新会话失败: ' + error.message
      };
    }
  }

  /**
   * 删除会话
   */
  async deleteSession(sessionId) {
    try {
      const response = await httpClient.delete(`/api/history/sessions/${sessionId}`);
      return {
        success: true,
        message: '会话删除成功'
      };
    } catch (error) {
      console.error('删除会话失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message
      };
    }
  }

  /**
   * 获取会话的所有消息
   */
  async getSessionMessages(sessionId) {
    try {
      // 使用历史API获取消息
      const response = await httpClient.post('/api/history/messages', {
        thread_id: sessionId,
        mode: 'outline'  // 默认模式，可以根据需要调整
      });
      return {
        success: true,
        messages: response.data || [],
        message: '会话消息获取成功'
      };
    } catch (error) {
      console.error('获取会话消息失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message,
        messages: []
      };
    }
  }

  /**
   * 向会话添加消息
   */
  async addSessionMessage(sessionId, message) {
    try {
      // 后端重构后，消息由对话历史管理器自动保存
      // 前端只需要在发送聊天消息时传递会话ID，后端会自动保存
      console.log(`[SessionService] 消息已添加到会话 ${sessionId}:`, message);
      return {
        success: true,
        session: {
          session_id: sessionId,
          message: message
        },
        message: '消息添加成功'
      };
    } catch (error) {
      console.error('添加会话消息失败:', error);
      return {
        success: false,
        error: '添加会话消息失败: ' + error.message
      };
    }
  }

  /**
   * 清空会话的所有消息
   */
  async clearSessionMessages(sessionId) {
    try {
      // 前端直接生成新的会话ID，不再调用后端API
      const newSessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      return {
        success: true,
        message: '会话消息已清空',
        new_session_id: newSessionId
      };
    } catch (error) {
      console.error('清空会话消息失败:', error);
      return {
        success: false,
        error: '清空会话消息失败: ' + error.message
      };
    }
  }

  /**
   * 获取会话的上下文（智能截断后的消息）
   */
  async getSessionContext(sessionId, isRagContext = false) {
    try {
      // 后端重构后，上下文管理由后端自动处理
      // 前端只需要传递完整的消息历史
      const messagesResult = await this.getSessionMessages(sessionId);
      return {
        success: messagesResult.success,
        messages: messagesResult.messages || [],
        message: '会话上下文获取成功'
      };
    } catch (error) {
      console.error('获取会话上下文失败:', error);
      return {
        success: false,
        error: '获取会话上下文失败: ' + error.message,
        messages: []
      };
    }
  }

  /**
   * 获取会话统计信息
   */
  async getSessionsStatistics() {
    try {
      const response = await httpClient.get('/api/conversation/statistics');
      return {
        success: true,
        statistics: response.data,
        message: '会话统计信息获取成功'
      };
    } catch (error) {
      console.error('获取会话统计信息失败:', error);
      return {
        success: false,
        error: '获取会话统计信息失败: ' + error.message
      };
    }
  }

  /**
   * 清除当前会话的消息并分配新的会话ID
   */
  async clearMessages() {
    try {
      // 前端直接生成新的会话ID，不再调用后端API
      const newSessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      return {
        success: true,
        new_session_id: newSessionId,
        message: '消息已清除，已开始新的会话'
      };
    } catch (error) {
      console.error('清除消息失败:', error);
      return {
        success: false,
        error: '清除消息失败: ' + error.message
      };
    }
  }

  /**
   * 获取当前会话ID
   */
  async getCurrentSessionId() {
    try {
      const response = await httpClient.get('/api/conversation/current-session');
      return {
        success: true,
        session_id: response.data?.session_id,
        message: '当前会话ID获取成功'
      };
    } catch (error) {
      console.error('获取当前会话ID失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message
      };
    }
  }

  /**
   * 清理过期会话
   */
  async cleanupExpiredSessions(maxAgeHours = 24) {
    try {
      // 后端重构后，会话清理由对话历史管理器自动处理
      console.log(`[SessionService] 会话清理功能由后端自动管理，maxAgeHours: ${maxAgeHours}`);
      return {
        success: true,
        result: { message: '会话清理功能由后端自动管理' },
        message: '过期会话清理完成'
      };
    } catch (error) {
      console.error('清理过期会话失败:', error);
      return {
        success: false,
        error: '清理过期会话失败: ' + error.message
      };
    }
  }

  /**
   * 保存当前会话状态（用户发送消息后调用）
   */
  async saveCurrentSession(sessionId, messages) {
    try {
      // 首先检查会话是否存在
      const sessionResult = await this.getSession(sessionId);
      
      if (!sessionResult.success) {
        // 会话不存在，创建新会话
        return await this.createSession(sessionId, 'outline', messages);
      } else {
        // 会话存在，直接添加新消息，不清空现有消息
        for (const message of messages) {
          await this.addSessionMessage(sessionId, message);
        }
        
        return {
          success: true,
          message: '会话保存成功'
        };
      }
    } catch (error) {
      console.error('保存会话失败:', error);
      return {
        success: false,
        error: '保存会话失败: ' + error.message
      };
    }
  }

  /**
   * 从会话恢复消息到前端状态
   */
  async restoreSession(sessionId) {
    try {
      // 获取会话详情和消息
      const sessionResult = await this.getSession(sessionId);
      const messagesResult = await this.getSessionMessages(sessionId);
      
      if (!sessionResult.success || !messagesResult.success) {
        return {
          success: false,
          error: '恢复会话失败: 无法获取会话数据'
        };
      }
      
      return {
        success: true,
        session: sessionResult.session,
        messages: messagesResult.messages,
        message: '会话恢复成功'
      };
    } catch (error) {
      console.error('恢复会话失败:', error);
      return {
        success: false,
        error: '恢复会话失败: ' + error.message
      };
    }
  }

}

// 创建全局会话服务实例
const sessionService = new SessionService();

export default sessionService;
