// 使用通过预加载脚本注入的 ipcRenderer
const { ipcRenderer } = window.api || {};

/**
 * 工作流IPC处理器 - 前端与后端工作流引擎的通信接口
 */
class WorkflowIpcHandler {
  /**
   * 执行工作流
   * @param {Object} workflow - 工作流定义
   * @param {Object} inputs - 输入数据
   * @returns {Promise<Object>} 执行结果
   */
  async executeWorkflow(workflow, inputs = {}) {
    try {
      const result = await ipcRenderer.invoke('workflow:execute', workflow, inputs);
      return result;
    } catch (error) {
      console.error('Failed to execute workflow:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 验证工作流
   * @param {Object} workflow - 工作流定义
   * @returns {Promise<Object>} 验证结果
   */
  async validateWorkflow(workflow) {
    try {
      const result = await ipcRenderer.invoke('workflow:validate', workflow);
      return result;
    } catch (error) {
      console.error('Failed to validate workflow:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取支持的节点类型
   * @returns {Promise<Object>} 节点类型列表
   */
  async getNodeTypes() {
    try {
      const result = await ipcRenderer.invoke('workflow:getNodeTypes');
      return result;
    } catch (error) {
      console.error('Failed to get node types:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取可用工具列表
   * @returns {Promise<Object>} 工具列表
   */
  async getTools() {
    try {
      const result = await ipcRenderer.invoke('workflow:getTools');
      return result;
    } catch (error) {
      console.error('Failed to get tools:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 检查工具是否存在
   * @param {string} toolName - 工具名称
   * @returns {Promise<Object>} 检查结果
   */
  async hasTool(toolName) {
    try {
      const result = await ipcRenderer.invoke('workflow:hasTool', toolName);
      return result;
    } catch (error) {
      console.error('Failed to check tool:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 保存工作流
   * @param {Object} workflow - 工作流定义
   * @returns {Promise<Object>} 保存结果
   */
  async saveWorkflow(workflow) {
    try {
      const result = await ipcRenderer.invoke('workflow:save', workflow);
      return result;
    } catch (error) {
      console.error('Failed to save workflow:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 加载工作流
   * @param {string} workflowId - 工作流ID
   * @returns {Promise<Object>} 工作流数据
   */
  async loadWorkflow(workflowId) {
    try {
      const result = await ipcRenderer.invoke('workflow:load', workflowId);
      return result;
    } catch (error) {
      console.error('Failed to load workflow:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取工作流列表
   * @returns {Promise<Object>} 工作流列表
   */
  async getWorkflowList() {
    try {
      const result = await ipcRenderer.invoke('workflow:list');
      return result;
    } catch (error) {
      console.error('Failed to get workflow list:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 删除工作流
   * @param {string} workflowId - 工作流ID
   * @returns {Promise<Object>} 删除结果
   */
  async deleteWorkflow(workflowId) {
    try {
      const result = await ipcRenderer.invoke('workflow:delete', workflowId);
      return result;
    } catch (error) {
      console.error('Failed to delete workflow:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取工作流执行状态
   * @param {string} executionId - 执行ID
   * @returns {Promise<Object>} 执行状态
   */
  async getWorkflowStatus(executionId) {
    try {
      const result = await ipcRenderer.invoke('workflow:status', executionId);
      return result;
    } catch (error) {
      console.error('Failed to get workflow status:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 初始化工作流系统
   * @returns {Promise<boolean>} 初始化结果
   */
  async initialize() {
    try {
      // 这里可以添加前端初始化逻辑
      console.log('Workflow IPC handler initialized');
      return true;
    } catch (error) {
      console.error('Failed to initialize workflow IPC handler:', error);
      return false;
    }
  }
}

// 创建全局实例
const workflowIpcHandler = new WorkflowIpcHandler();

export default workflowIpcHandler;