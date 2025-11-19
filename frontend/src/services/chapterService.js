//章节服务 - 专注于章节管理相关操作
import httpClient from '../utils/httpClient.js';

class ChapterService {
  constructor() {
    this.baseURL = '/api';
  }

  /**
   * 获取章节列表
   * @returns {Promise<Object>} 章节列表数据
   */
  async getChapters() {
    try {
      const response = await httpClient.get(`${this.baseURL}/file/tree`);
      
      if (response.success) {
        return {
          success: true,
          chapters: response.data || [],
          message: response.message || '章节列表获取成功'
        };
      } else {
        return {
          success: false,
          error: response.error || '获取章节列表失败',
          chapters: []
        };
      }
    } catch (error) {
      console.error('获取章节列表失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message,
        chapters: []
      };
    }
  }

  /**
   * 创建文件
   * @param {string} fileName - 文件名
   * @param {string} content - 文件内容
   * @param {string} parentPath - 父路径
   * @returns {Promise<Object>} 创建结果
   */
  async createFile(fileName, content = '', parentPath = '') {
    try {
      const response = await httpClient.post(`${this.baseURL}/file/chapters`, {
        name: fileName,
        content: content,
        parent_path: parentPath
      });
      
      if (response.success) {
        return {
          success: true,
          message: response.message || '文件创建成功'
        };
      } else {
        return {
          success: false,
          error: response.error || '文件创建失败'
        };
      }
    } catch (error) {
      console.error('创建文件失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message
      };
    }
  }

  /**
   * 创建文件夹
   * @param {string} folderName - 文件夹名
   * @param {string} parentPath - 父路径
   * @returns {Promise<Object>} 创建结果
   */
  async createFolder(folderName, parentPath = '') {
    try {
      const response = await httpClient.post(`${this.baseURL}/file/folders`, {
        name: folderName,
        parent_path: parentPath
      });
      
      if (response.success) {
        return {
          success: true,
          message: response.message || '文件夹创建成功'
        };
      } else {
        return {
          success: false,
          error: response.error || '文件夹创建失败'
        };
      }
    } catch (error) {
      console.error('创建文件夹失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message
      };
    }
  }

  /**
   * 删除项目
   * @param {string} itemId - 项目ID
   * @returns {Promise<Object>} 删除结果
   */
  async deleteItem(itemId) {
    try {
      const response = await httpClient.delete(`${this.baseURL}/file/chapters/${itemId}`);
      
      if (response.success) {
        return {
          success: true,
          message: response.message || '项目删除成功'
        };
      } else {
        return {
          success: false,
          error: response.error || '项目删除失败'
        };
      }
    } catch (error) {
      console.error('删除项目失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message
      };
    }
  }

  /**
   * 重命名项目
   * @param {string} oldItemId - 旧项目ID
   * @param {string} newName - 新名称
   * @returns {Promise<Object>} 重命名结果
   */
  async renameItem(oldItemId, newName) {
    try {
      const response = await httpClient.post(`${this.baseURL}/file/rename`, {
        old_path: oldItemId,
        new_name: newName
      });
      
      if (response.success) {
        return {
          success: true,
          message: response.message || '重命名成功'
        };
      } else {
        return {
          success: false,
          error: response.error || '重命名失败'
        };
      }
    } catch (error) {
      console.error('重命名项目失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message
      };
    }
  }

  /**
   * 移动项目
   * @param {string} sourceId - 源项目ID
   * @param {string} targetFolderId - 目标文件夹ID
   * @returns {Promise<Object>} 移动结果
   */
  async moveItem(sourceId, targetFolderId) {
    try {
      const response = await httpClient.post(`${this.baseURL}/file/move`, {
        source_path: sourceId,
        target_path: targetFolderId
      });
      
      if (response.success) {
        return {
          success: true,
          message: response.message || '移动成功'
        };
      } else {
        return {
          success: false,
          error: response.error || '移动失败'
        };
      }
    } catch (error) {
      console.error('移动项目失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message
      };
    }
  }

  /**
   * 复制项目
   * @param {string} sourceId - 源项目ID
   * @param {string} targetFolderId - 目标文件夹ID
   * @returns {Promise<Object>} 复制结果
   */
  async copyItem(sourceId, targetFolderId) {
    try {
      const response = await httpClient.post(`${this.baseURL}/file/copy`, {
        source_path: sourceId,
        target_path: targetFolderId
      });
      
      if (response.success) {
        return {
          success: true,
          message: response.message || '复制成功'
        };
      } else {
        return {
          success: false,
          error: response.error || '复制失败'
        };
      }
    } catch (error) {
      console.error('复制项目失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message
      };
    }
  }

  /**
   * 触发章节更新
   * @returns {Promise<Object>} 更新结果
   */
  async triggerChaptersUpdate() {
    try {
      // 在 HTTP 模式下，通过重新获取章节列表来触发更新
      const response = await this.getChapters();
      return {
        success: response.success,
        message: response.success ? '章节更新成功' : '章节更新失败'
      };
    } catch (error) {
      console.error('触发章节更新失败:', error);
      return {
        success: false,
        error: '触发章节更新失败: ' + error.message
      };
    }
  }

  /**
   * 重新初始化模型提供者
   * @returns {Promise<Object>} 初始化结果
   */
  async reinitializeModelProvider() {
    try {
      const response = await httpClient.post(`${this.baseURL}/models/reinitialize`);
      
      if (response.success) {
        return {
          success: true,
          message: response.message || '模型提供者重新初始化成功'
        };
      } else {
        return {
          success: false,
          error: response.error || '重新初始化模型提供者失败'
        };
      }
    } catch (error) {
      console.error('重新初始化模型提供者失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message
      };
    }
  }

  /**
   * 监听章节更新事件
   * @param {Function} callback - 回调函数
   * @returns {Function} 清理函数
   */
  onChaptersUpdated(callback) {
    // 在 HTTP 模式下，需要通过轮询或 WebSocket 来监听更新
    // 这里暂时返回一个空的清理函数
    console.warn('HTTP 模式下章节更新监听需要实现轮询或 WebSocket');
    return () => {};
  }

  /**
   * 移除章节更新监听器
   * @param {Function} callback - 回调函数
   */
  removeChaptersUpdatedListener(callback) {
    // HTTP 模式下暂时不需要实现
    console.warn('HTTP 模式下章节更新监听器移除需要实现');
  }

}

// 创建全局章节服务实例
const chapterService = new ChapterService();

export default chapterService;
