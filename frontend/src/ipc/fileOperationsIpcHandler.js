/**
 * 文件操作 IPC 处理器
 * 封装文件操作相关的 IPC 调用逻辑，提供统一的错误处理
 */

class FileOperationsIpcHandler {
  constructor(ipcRenderer) {
    this.ipcRenderer = ipcRenderer;
  }

  /**
   * 删除项目
   * @param {string} itemId - 项目ID
   * @returns {Promise<Object>} 删除结果
   */
  async deleteItem(itemId) {
    try {
      const result = await this.ipcRenderer.invoke('delete-item', itemId);
      if (result.success) {
        return {
          success: true,
          message: result.message || '项目删除成功'
        };
      } else {
        return {
          success: false,
          error: result.error || '删除项目失败'
        };
      }
    } catch (error) {
      console.error('调用 delete-item IPC 失败:', error);
      return {
        success: false,
        error: 'IPC 调用失败: ' + error.message
      };
    }
  }

  /**
   * 重命名项目
   * @param {string} oldItemId - 原项目ID
   * @param {string} newTitle - 新标题
   * @returns {Promise<Object>} 重命名结果
   */
  async renameItem(oldItemId, newTitle) {
    try {
      const result = await this.ipcRenderer.invoke('rename-item', oldItemId, newTitle);
      if (result.success) {
        return {
          success: true,
          message: result.message || '项目重命名成功'
        };
      } else {
        return {
          success: false,
          error: result.error || '重命名项目失败'
        };
      }
    } catch (error) {
      console.error('调用 rename-item IPC 失败:', error);
      return {
        success: false,
        error: 'IPC 调用失败: ' + error.message
      };
    }
  }

  /**
   * 创建小说文件
   * @param {Object} fileData - 文件数据
   * @param {string} fileData.filePath - 文件路径
   * @param {string} fileData.content - 文件内容
   * @returns {Promise<Object>} 创建结果
   */
  async createNovelFile(fileData) {
    try {
      const result = await this.ipcRenderer.invoke('create-novel-file', fileData);
      if (result.success) {
        return {
          success: true,
          message: result.message || '文件创建成功'
        };
      } else {
        return {
          success: false,
          error: result.error || '创建文件失败'
        };
      }
    } catch (error) {
      console.error('调用 create-novel-file IPC 失败:', error);
      return {
        success: false,
        error: 'IPC 调用失败: ' + error.message
      };
    }
  }

  /**
   * 创建文件夹
   * @param {string} folderPath - 文件夹路径
   * @returns {Promise<Object>} 创建结果
   */
  async createFolder(folderPath) {
    try {
      const result = await this.ipcRenderer.invoke('create-folder', folderPath);
      if (result.success) {
        return {
          success: true,
          message: result.message || '文件夹创建成功'
        };
      } else {
        return {
          success: false,
          error: result.error || '创建文件夹失败'
        };
      }
    } catch (error) {
      console.error('调用 create-folder IPC 失败:', error);
      return {
        success: false,
        error: 'IPC 调用失败: ' + error.message
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
      const result = await this.ipcRenderer.invoke('move-item', sourceId, targetFolderId);
      if (result.success) {
        return {
          success: true,
          message: result.message || '项目移动成功'
        };
      } else {
        return {
          success: false,
          error: result.error || '移动项目失败'
        };
      }
    } catch (error) {
      console.error('调用 move-item IPC 失败:', error);
      return {
        success: false,
        error: 'IPC 调用失败: ' + error.message
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
      const result = await this.ipcRenderer.invoke('copy-item', sourceId, targetFolderId);
      if (result.success) {
        return {
          success: true,
          message: result.message || '项目复制成功'
        };
      } else {
        return {
          success: false,
          error: result.error || '复制项目失败'
        };
      }
    } catch (error) {
      console.error('调用 copy-item IPC 失败:', error);
      return {
        success: false,
        error: 'IPC 调用失败: ' + error.message
      };
    }
  }

  /**
   * 触发焦点修复
   * @returns {Promise<Object>} 触发结果
   */
  async triggerFocusFix() {
    try {
      await this.ipcRenderer.invoke('trigger-focus-fix');
      return {
        success: true,
        message: '焦点修复已触发'
      };
    } catch (error) {
      console.error('调用 trigger-focus-fix IPC 失败:', error);
      return {
        success: false,
        error: 'IPC 调用失败: ' + error.message
      };
    }
  }
}

// 创建全局实例
const fileOperationsIpcHandler = new FileOperationsIpcHandler(window.ipcRenderer);

export default fileOperationsIpcHandler;