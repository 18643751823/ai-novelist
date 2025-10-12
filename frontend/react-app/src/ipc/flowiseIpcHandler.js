import { useDispatch } from 'react-redux';
import { 
  setFlowiseServiceStatus, 
  setFlowiseWorkflows 
} from '../store/slices/chatSlice';

/**
 * Flowise IPC 处理器 - 前端部分
 */
class FlowiseIpcHandler {
  constructor() {
    this.dispatch = null;
    this.isInitialized = false;
  }

  /**
   * 初始化 Flowise IPC 处理器
   */
  initialize(dispatch) {
    if (this.isInitialized) return;
    
    this.dispatch = dispatch;
    this.isInitialized = true;
    
    console.log('[FlowiseIpcHandler] 初始化 Flowise IPC 处理器');
    
    // 监听 Flowise 服务状态变化
    this.setupIpcListeners();
    
    // 初始获取服务状态
    this.getServiceStatus();
  }

  /**
   * 设置 IPC 监听器
   */
  setupIpcListeners() {
    if (!window.api) {
      console.warn('[FlowiseIpcHandler] api 不可用');
      return;
    }

    // 监听服务状态更新
    window.api.on('flowise-service-status-update', (status) => {
      console.log('[FlowiseIpcHandler] 收到服务状态更新:', status);
      this.handleServiceStatusUpdate(status);
    });

    // 监听工作流列表更新
    window.api.on('flowise-workflows-update', (workflows) => {
      console.log('[FlowiseIpcHandler] 收到工作流列表更新:', workflows);
      this.handleWorkflowsUpdate(workflows);
    });

    // 监听服务错误
    window.api.on('flowise-service-error', (error) => {
      console.error('[FlowiseIpcHandler] 收到服务错误:', error);
      this.handleServiceError(error);
    });
  }

  /**
   * 处理服务状态更新
   */
  handleServiceStatusUpdate(status) {
    console.log('[FlowiseIpcHandler] handleServiceStatusUpdate 被调用，状态:', status);
    if (!this.dispatch) {
      console.warn('[FlowiseIpcHandler] dispatch 不可用，无法更新状态');
      return;
    }

    console.log('[FlowiseIpcHandler] 正在更新 Redux store 状态');
    this.dispatch(setFlowiseServiceStatus({
      status: status.status,
      port: status.port,
      baseURL: status.baseURL,
      lastError: null
    }));
    console.log('[FlowiseIpcHandler] Redux store 状态更新完成');
  }

  /**
   * 处理工作流列表更新
   */
  handleWorkflowsUpdate(workflows) {
    if (!this.dispatch) return;
    
    this.dispatch(setFlowiseWorkflows(workflows));
  }

  /**
   * 处理服务错误
   */
  handleServiceError(error) {
    if (!this.dispatch) return;
    
    this.dispatch(setFlowiseServiceStatus({
      status: 'error',
      lastError: error.message || '未知错误'
    }));
  }

  /**
   * 获取服务状态
   */
  async getServiceStatus() {
    if (!window.api) return;

    try {
      const result = await window.api.invoke('flowise-get-status');
      if (result.success) {
        this.handleServiceStatusUpdate(result.status);
      }
    } catch (error) {
      console.error('[FlowiseIpcHandler] 获取服务状态失败:', error);
    }
  }

  /**
   * 启动 Flowise 服务
   */
  async startService() {
    if (!window.api) return { success: false, message: 'api 不可用' };

    try {
      const result = await window.api.invoke('flowise-start-service');
      console.log('[FlowiseIpcHandler] 启动服务结果:', result);
      return result;
    } catch (error) {
      console.error('[FlowiseIpcHandler] 启动服务失败:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * 停止 Flowise 服务
   */
  async stopService() {
    if (!window.api) return { success: false, message: 'api 不可用' };

    try {
      const result = await window.api.invoke('flowise-stop-service');
      console.log('[FlowiseIpcHandler] 停止服务结果:', result);
      return result;
    } catch (error) {
      console.error('[FlowiseIpcHandler] 停止服务失败:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * 重启 Flowise 服务
   */
  async restartService() {
    if (!window.api) return { success: false, message: 'api 不可用' };

    try {
      const result = await window.api.invoke('flowise-restart-service');
      console.log('[FlowiseIpcHandler] 重启服务结果:', result);
      return result;
    } catch (error) {
      console.error('[FlowiseIpcHandler] 重启服务失败:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * 检查服务健康状态
   */
  async checkHealth() {
    if (!window.api) return { success: false, isHealthy: false };

    try {
      const result = await window.api.invoke('flowise-check-health');
      return result;
    } catch (error) {
      console.error('[FlowiseIpcHandler] 检查健康状态失败:', error);
      return { success: false, isHealthy: false };
    }
  }

  /**
   * 获取工作流列表
   */
  async getWorkflows() {
    if (!window.api) return { success: false, workflows: [] };

    try {
      const result = await window.api.invoke('flowise-get-workflows');
      if (result.success) {
        this.handleWorkflowsUpdate(result.workflows);
      }
      return result;
    } catch (error) {
      console.error('[FlowiseIpcHandler] 获取工作流列表失败:', error);
      return { success: false, workflows: [] };
    }
  }

  /**
   * 清理资源
   */
  cleanup() {
    // 移除所有监听器
    if (window.api) {
      // 注意：在实际实现中，需要根据具体的 electron API 来移除监听器
      // 这里只是占位符，实际实现需要根据具体的 electron 版本和 API 来调整
    }
    
    this.isInitialized = false;
    this.dispatch = null;
    console.log('[FlowiseIpcHandler] 已清理');
  }
}

// 创建单例实例
const flowiseIpcHandler = new FlowiseIpcHandler();

export default flowiseIpcHandler;