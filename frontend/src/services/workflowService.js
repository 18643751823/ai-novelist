// 工作流服务 - 负责工作流验证、执行、保存等操作
import httpClient from '../utils/httpClient.js';

class WorkflowService {
  constructor() {
    this.baseURL = 'http://localhost:8000';
  }

  /**
   * 验证工作流
   * @param {Object} workflow - 工作流定义
   * @returns {Promise<Object>} 验证结果
   */
  async validateWorkflow(workflow) {
    try {
      const response = await httpClient.post('/api/tools/workflow/validate', workflow);
      return {
        success: true,
        data: response.data,
        message: '工作流验证成功'
      };
    } catch (error) {
      console.error('工作流验证失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message
      };
    }
  }

  /**
   * 执行工作流
   * @param {Object} workflow - 工作流定义
   * @param {Object} inputs - 输入参数
   * @returns {Promise<Object>} 执行结果
   */
  async executeWorkflow(workflow, inputs) {
    try {
      const response = await httpClient.post('/api/tools/workflow/execute', {
        workflow,
        inputs
      });
      return {
        success: true,
        data: response.data,
        message: '工作流执行成功'
      };
    } catch (error) {
      console.error('工作流执行失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message
      };
    }
  }

  /**
   * 保存工作流
   * @param {Object} workflow - 工作流定义
   * @returns {Promise<Object>} 保存结果
   */
  async saveWorkflow(workflow) {
    try {
      const response = await httpClient.post('/api/tools/workflow/save', workflow);
      return {
        success: true,
        data: response.data,
        message: '工作流保存成功'
      };
    } catch (error) {
      console.error('工作流保存失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message
      };
    }
  }
}

// 创建全局工作流服务实例
const workflowService = new WorkflowService();

export default workflowService;