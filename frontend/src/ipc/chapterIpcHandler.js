/**
 * 章节数据 IPC 处理器
 * 封装章节相关的 IPC 调用逻辑，提供统一的错误处理和章节数据管理
 */

class ChapterIpcHandler {
  constructor(ipcRenderer) {
    this.ipcRenderer = ipcRenderer;
  }

  /**
   * 获取章节列表
   * @returns {Promise<Object>} 章节列表数据
   */
  async getChapters() {
    try {
      const result = await this.ipcRenderer.invoke('get-chapters');
      if (result.success) {
        return {
          success: true,
          chapters: result.chapters,
          message: '章节列表获取成功'
        };
      } else {
        return {
          success: false,
          error: result.error || '获取章节列表失败',
          chapters: []
        };
      }
    } catch (error) {
      console.error('调用 get-chapters IPC 失败:', error);
      return {
        success: false,
        error: 'IPC 调用失败: ' + error.message,
        chapters: []
      };
    }
  }

  /**
   * 更新项目排序顺序
   * @param {string} directoryPath - 目录路径
   * @param {Array<string>} itemIds - 项目ID列表
   * @returns {Promise<Object>} 更新结果
   */
  async updateItemOrder(directoryPath, itemIds) {
    try {
      const result = await this.ipcRenderer.invoke('update-item-order', {
        directoryPath: directoryPath || '',
        itemIds: itemIds
      });
      
      if (result.success) {
        return {
          success: true,
          message: '排序顺序更新成功'
        };
      } else {
        return {
          success: false,
          error: result.error || '更新排序顺序失败'
        };
      }
    } catch (error) {
      console.error('调用 update-item-order IPC 失败:', error);
      return {
        success: false,
        error: 'IPC 调用失败: ' + error.message
      };
    }
  }

  /**
   * 获取 API Key
   * @returns {Promise<Object>} API Key 数据
   */
  async getApiKey() {
    try {
      const result = await this.ipcRenderer.invoke('get-api-key');
      if (result.success && result.apiKey) {
        return {
          success: true,
          apiKey: result.apiKey,
          message: 'API Key 获取成功'
        };
      } else {
        return {
          success: false,
          error: result.error || '获取 API Key 失败或无 API Key',
          apiKey: ''
        };
      }
    } catch (error) {
      console.error('调用 get-api-key IPC 失败:', error);
      return {
        success: false,
        error: 'IPC 调用失败: ' + error.message,
        apiKey: ''
      };
    }
  }

  /**
   * 设置存储值
   * @param {string} key - 存储键名
   * @param {any} value - 存储值
   * @returns {Promise<Object>} 设置结果
   */
  async setStoreValue(key, value) {
    try {
      await this.ipcRenderer.invoke('set-store-value', key, value);
      return {
        success: true,
        message: '存储值设置成功'
      };
    } catch (error) {
      console.error('调用 set-store-value IPC 失败:', error);
      return {
        success: false,
        error: 'IPC 调用失败: ' + error.message
      };
    }
  }

  /**
   * 获取存储值
   * @param {string} key - 存储键名
   * @returns {Promise<Object>} 存储值数据
   */
  async getStoreValue(key) {
    try {
      const value = await this.ipcRenderer.invoke('get-store-value', key);
      return {
        success: true,
        value: value,
        message: '存储值获取成功'
      };
    } catch (error) {
      console.error('调用 get-store-value IPC 失败:', error);
      return {
        success: false,
        error: 'IPC 调用失败: ' + error.message,
        value: null
      };
    }
  }

  /**
   * 重新初始化模型提供者
   * @returns {Promise<Object>} 初始化结果
   */
  async reinitializeModelProvider() {
    try {
      const result = await this.ipcRenderer.invoke('reinitialize-model-provider');
      if (result.success) {
        return {
          success: true,
          message: '模型提供者重新初始化成功'
        };
      } else {
        return {
          success: false,
          error: result.error || '重新初始化模型提供者失败'
        };
      }
    } catch (error) {
      console.error('调用 reinitialize-model-provider IPC 失败:', error);
      return {
        success: false,
        error: 'IPC 调用失败: ' + error.message
      };
    }
  }

  /**
   * 注册章节更新监听器
   * @param {Function} callback - 回调函数
   * @returns {Function} 清理函数
   */
  onChaptersUpdated(callback) {
    const handler = (event, rawPayload) => {
      let payload;
      try {
        if (typeof rawPayload === 'string') {
          payload = JSON.parse(rawPayload);
        } else {
          payload = rawPayload;
        }
      } catch (e) {
        console.error('解析 chapters-updated payload 失败:', e);
        return;
      }

      if (payload && payload.success) {
        callback(payload.chapters);
      } else {
        console.error('章节更新失败:', payload?.error);
      }
    };

    this.ipcRenderer.on('chapters-updated', handler);

    // 返回清理函数
    return () => {
      this.ipcRenderer.removeListener('chapters-updated', handler);
    };
  }

  /**
   * 移除章节更新监听器
   * @param {Function} callback - 回调函数
   */
  removeChaptersUpdatedListener(callback) {
    this.ipcRenderer.removeListener('chapters-updated', callback);
  }
}

// 创建全局实例
const chapterIpcHandler = new ChapterIpcHandler(window.ipcRenderer);

export default chapterIpcHandler;