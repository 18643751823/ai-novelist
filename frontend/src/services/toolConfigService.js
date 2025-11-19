// 工具配置服务 - 负责模式工具配置管理
import httpClient from '../utils/httpClient.js';

class ToolConfigService {
  constructor() {
    this.baseURL = 'http://localhost:8000';
  }

  /**
   * 获取模式工具配置
   * @param {string} modeId - 模式ID
   * @returns {Promise<Object>} 工具配置数据
   */
  async getModeToolConfig(modeId) {
    try {
      const response = await httpClient.get(`/api/tool-config/modes/${modeId}`);
      return {
        success: true,
        data: response.data,
        message: '模式工具配置获取成功'
      };
    } catch (error) {
      console.error('获取模式工具配置失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message
      };
    }
  }

  /**
   * 更新模式工具配置
   * @param {string} modeId - 模式ID
   * @param {Object} config - 配置数据
   * @returns {Promise<Object>} 更新结果
   */
  async updateModeToolConfig(modeId, config) {
    try {
      const response = await httpClient.put(`/api/tool-config/modes/${modeId}`, config);
      return {
        success: true,
        data: response.data,
        message: '模式工具配置更新成功'
      };
    } catch (error) {
      console.error('更新模式工具配置失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message
      };
    }
  }

  /**
   * 重置模式工具配置
   * @param {string} modeId - 模式ID
   * @returns {Promise<Object>} 重置结果
   */
  async resetModeToolConfig(modeId) {
    try {
      const response = await httpClient.post(`/api/tool-config/modes/${modeId}/reset`);
      return {
        success: true,
        data: response.data,
        message: '模式工具配置重置成功'
      };
    } catch (error) {
      console.error('重置模式工具配置失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message
      };
    }
  }

  /**
   * 获取所有模式工具配置
   * @returns {Promise<Object>} 所有配置数据
   */
  async getAllModeToolConfigs() {
    try {
      const response = await httpClient.get('/api/tool-config/modes');
      return {
        success: true,
        data: response.data,
        message: '所有模式工具配置获取成功'
      };
    } catch (error) {
      console.error('获取所有模式工具配置失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message
      };
    }
  }

  /**
   * 获取可用工具列表
   * @returns {Promise<Object>} 工具列表数据
   */
  async getAvailableTools() {
    try {
      const response = await httpClient.get('/api/tool-config/available-tools');
      return {
        success: true,
        data: response.data,
        message: '可用工具列表获取成功'
      };
    } catch (error) {
      console.error('获取可用工具列表失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message
      };
    }
  }
}

// 创建全局工具配置服务实例
const toolConfigService = new ToolConfigService();

export default toolConfigService;