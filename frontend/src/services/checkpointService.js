// 检查点服务 - 负责检查点创建、恢复、删除等操作
import httpClient from '../utils/httpClient.js';

class CheckpointService {
  constructor() {
    this.baseURL = 'http://localhost:8000';
  }

  /**
   * 获取检查点列表
   * @param {string} filePath - 文件路径（可选）
   * @param {number} limit - 限制数量（可选）
   * @returns {Promise<Object>} 检查点列表数据
   */
  async getCheckpoints(filePath = null, limit = null) {
    try {
      const params = {};
      if (filePath) params.file_path = filePath;
      if (limit) params.limit = limit;
      
      const response = await httpClient.get('/api/checkpoints/', { params });
      return {
        success: true,
        data: response.data,
        message: '检查点列表获取成功'
      };
    } catch (error) {
      console.error('获取检查点列表失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message
      };
    }
  }

  /**
   * 创建检查点
   * @param {Object} request - 检查点创建请求
   * @returns {Promise<Object>} 创建结果
   */
  async createCheckpoint(request) {
    try {
      const response = await httpClient.post('/api/checkpoints/', request);
      return {
        success: true,
        data: response.data,
        message: '检查点创建成功'
      };
    } catch (error) {
      console.error('创建检查点失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message
      };
    }
  }

  /**
   * 恢复检查点
   * @param {string} checkpointId - 检查点ID
   * @returns {Promise<Object>} 恢复结果
   */
  async restoreCheckpoint(checkpointId) {
    try {
      const response = await httpClient.post('/api/checkpoints/restore', null, {
        params: { checkpoint_id: checkpointId }
      });
      return {
        success: true,
        data: response.data,
        message: '检查点恢复成功'
      };
    } catch (error) {
      console.error('恢复检查点失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message
      };
    }
  }

  /**
   * 删除检查点
   * @param {string} checkpointId - 检查点ID
   * @returns {Promise<Object>} 删除结果
   */
  async deleteCheckpoint(checkpointId) {
    try {
      const response = await httpClient.delete(`/api/checkpoints/${checkpointId}`);
      return {
        success: true,
        message: '检查点删除成功'
      };
    } catch (error) {
      console.error('删除检查点失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message
      };
    }
  }

  /**
   * 创建小说存档
   * @param {string} taskId - 任务ID
   * @param {string} workspaceDir - 工作空间目录
   * @param {string} message - 存档消息
   * @returns {Promise<Object>} 创建结果
   */
  async createNovelArchive(taskId, workspaceDir, message) {
    try {
      const response = await httpClient.post('/api/checkpoints/novel/archive', null, {
        params: {
          task_id: taskId,
          workspace_dir: workspaceDir,
          message: message
        }
      });
      return {
        success: true,
        data: response.data,
        message: '小说存档创建成功'
      };
    } catch (error) {
      console.error('创建小说存档失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message
      };
    }
  }

  /**
   * 恢复小说存档
   * @param {string} taskId - 任务ID
   * @param {string} archiveId - 存档ID
   * @param {string} workspaceDir - 工作空间目录
   * @returns {Promise<Object>} 恢复结果
   */
  async restoreNovelArchive(taskId, archiveId, workspaceDir) {
    try {
      const response = await httpClient.post('/api/checkpoints/novel/restore', null, {
        params: {
          task_id: taskId,
          archive_id: archiveId,
          workspace_dir: workspaceDir
        }
      });
      return {
        success: true,
        data: response.data,
        message: '小说存档恢复成功'
      };
    } catch (error) {
      console.error('恢复小说存档失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message
      };
    }
  }

  /**
   * 获取小说存档列表
   * @param {string} taskId - 任务ID
   * @returns {Promise<Object>} 存档列表数据
   */
  async listNovelArchives(taskId) {
    try {
      const response = await httpClient.get(`/api/checkpoints/novel/archives/${taskId}`);
      return {
        success: true,
        data: response.data,
        message: '小说存档列表获取成功'
      };
    } catch (error) {
      console.error('获取小说存档列表失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message
      };
    }
  }

  /**
   * 删除小说存档
   * @param {string} taskId - 任务ID
   * @param {string} archiveId - 存档ID
   * @returns {Promise<Object>} 删除结果
   */
  async deleteNovelArchive(taskId, archiveId) {
    try {
      const response = await httpClient.delete(`/api/checkpoints/novel/archives/${taskId}/${archiveId}`);
      return {
        success: true,
        message: '小说存档删除成功'
      };
    } catch (error) {
      console.error('删除小说存档失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message
      };
    }
  }
}

// 创建全局检查点服务实例
const checkpointService = new CheckpointService();

export default checkpointService;