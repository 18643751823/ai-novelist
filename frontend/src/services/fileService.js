// 文件操作服务 - 负责文件读写、创建、删除、重命名等操作
import httpClient from '../utils/httpClient.js';

class FileService {
  constructor() {
    this.baseURL = 'http://localhost:8000';
  }

  /**
   * 读取文件内容
   * @param {string} filePath - 文件路径
   * @returns {Promise<Object>} 文件内容数据
   */
  async readFile(filePath) {
    try {
      const response = await httpClient.get(`/api/file/read/${encodeURIComponent(filePath)}`);
      return {
        success: true,
        content: response.data,
        message: '文件读取成功'
      };
    } catch (error) {
      console.error('读取文件失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message,
        content: ''
      };
    }
  }

  /**
   * 写入文件内容
   * @param {string} filePath - 文件路径
   * @param {string} content - 文件内容
   * @returns {Promise<Object>} 写入结果
   */
  async writeFile(filePath, content) {
    try {
      const response = await httpClient.put(`/api/file/write/${encodeURIComponent(filePath)}`, {
        content
      });
      return {
        success: true,
        message: '文件写入成功'
      };
    } catch (error) {
      console.error('写入文件失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message
      };
    }
  }

  /**
   * 创建文件
   * @param {string} name - 文件名
   * @param {string} content - 文件内容
   * @param {string} parentPath - 父目录路径
   * @returns {Promise<Object>} 创建结果
   */
  async createFile(name, content = '', parentPath = '') {
    try {
      const response = await httpClient.post('/api/file/chapters', {
        name,
        content,
        parent_path: parentPath
      });
      return {
        success: true,
        data: response.data,
        message: '文件创建成功'
      };
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
   * @param {string} name - 文件夹名
   * @param {string} parentPath - 父目录路径
   * @returns {Promise<Object>} 创建结果
   */
  async createFolder(name, parentPath = '') {
    try {
      const response = await httpClient.post('/api/file/folders', {
        name,
        parent_path: parentPath
      });
      return {
        success: true,
        data: response.data,
        message: '文件夹创建成功'
      };
    } catch (error) {
      console.error('创建文件夹失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message
      };
    }
  }

  /**
   * 重命名项目
   * @param {string} oldPath - 原路径
   * @param {string} newName - 新名称
   * @returns {Promise<Object>} 重命名结果
   */
  async renameItem(oldPath, newName) {
    try {
      const response = await httpClient.post('/api/file/rename', {
        old_path: oldPath,
        new_name: newName
      });
      return {
        success: true,
        message: '重命名成功'
      };
    } catch (error) {
      console.error('重命名失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message
      };
    }
  }

  /**
   * 删除项目
   * @param {string} itemPath - 项目路径
   * @returns {Promise<Object>} 删除结果
   */
  async deleteItem(itemPath) {
    try {
      const response = await httpClient.delete(`/api/file/chapters/${encodeURIComponent(itemPath)}`);
      return {
        success: true,
        message: '删除成功'
      };
    } catch (error) {
      console.error('删除失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message
      };
    }
  }

  /**
   * 移动项目
   * @param {string} sourcePath - 源路径
   * @param {string} targetPath - 目标路径
   * @returns {Promise<Object>} 移动结果
   */
  async moveItem(sourcePath, targetPath) {
    try {
      const response = await httpClient.post('/api/file/move', {
        source_path: sourcePath,
        target_path: targetPath
      });
      return {
        success: true,
        message: '移动成功'
      };
    } catch (error) {
      console.error('移动失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message
      };
    }
  }

  /**
   * 复制项目
   * @param {string} sourcePath - 源路径
   * @param {string} targetPath - 目标路径
   * @returns {Promise<Object>} 复制结果
   */
  async copyItem(sourcePath, targetPath) {
    try {
      const response = await httpClient.post('/api/file/copy', {
        source_path: sourcePath,
        target_path: targetPath
      });
      return {
        success: true,
        message: '复制成功'
      };
    } catch (error) {
      console.error('复制失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message
      };
    }
  }

  /**
   * 更新文件排序顺序
   * @param {string} directoryPath - 目录路径
   * @param {Array<string>} fileIds - 文件ID列表
   * @returns {Promise<Object>} 更新结果
   */
  async updateFileOrder(directoryPath, fileIds) {
    try {
      const response = await httpClient.post('/api/file/order/files', {
        file_paths: fileIds,
        directory_path: directoryPath
      });
      return {
        success: true,
        message: '文件排序顺序更新成功'
      };
    } catch (error) {
      console.error('更新文件排序顺序失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message
      };
    }
  }

  /**
   * 更新文件夹排序顺序
   * @param {string} directoryPath - 目录路径
   * @param {Array<string>} folderIds - 文件夹ID列表
   * @returns {Promise<Object>} 更新结果
   */
  async updateFolderOrder(directoryPath, folderIds) {
    try {
      const response = await httpClient.post('/api/file/order/folders', {
        folder_paths: folderIds,
        directory_path: directoryPath
      });
      return {
        success: true,
        message: '文件夹排序顺序更新成功'
      };
    } catch (error) {
      console.error('更新文件夹排序顺序失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message
      };
    }
  }
}

// 创建全局文件服务实例
const fileService = new FileService();

export default fileService;