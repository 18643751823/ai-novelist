/**
 * 简化的 Vditor 编辑器生命周期管理
 * 只处理标签页相关的注册和注销功能
 */
export class VditorLifecycleManager {
  constructor() {
    this.editorInstances = new Map();
  }

  /**
   * 注册编辑器实例
   * @param {string} tabId - 标签页ID
   * @param {Object} editorInstance - Vditor 编辑器实例
   */
  registerEditor(tabId, editorInstance) {
    console.log(`[VditorLifecycleManager] 注册编辑器实例 for tab: ${tabId}`);
    this.editorInstances.set(tabId, editorInstance);
  }

  /**
   * 注销编辑器实例
   * @param {string} tabId - 标签页ID
   */
  unregisterEditor(tabId) {
    console.log(`[VditorLifecycleManager] 注销编辑器实例 for tab: ${tabId}`);
    const instance = this.editorInstances.get(tabId);
    
    if (instance) {
      try {
        // 销毁编辑器实例
        if (instance.destroy && instance.element) {
          instance.destroy();
        }
      } catch (error) {
        console.warn(`[VditorLifecycleManager] 销毁编辑器实例失败 for tab ${tabId}:`, error);
      }
      
      // 从映射中移除
      this.editorInstances.delete(tabId);
    }
  }

  /**
   * 获取编辑器实例
   * @param {string} tabId - 标签页ID
   * @returns {Object|null} 编辑器实例
   */
  getEditorInstance(tabId) {
    return this.editorInstances.get(tabId) || null;
  }

  /**
   * 检查标签页是否有编辑器实例
   * @param {string} tabId - 标签页ID
   * @returns {boolean}
   */
  hasEditorInstance(tabId) {
    return this.editorInstances.has(tabId);
  }

  /**
   * 获取所有注册的标签页ID
   * @returns {string[]}
   */
  getRegisteredTabIds() {
    return Array.from(this.editorInstances.keys());
  }

  /**
   * 清理所有编辑器实例
   */
  clearAll() {
    console.log('[VditorLifecycleManager] 清理所有编辑器实例');
    for (const [tabId, instance] of this.editorInstances) {
      try {
        if (instance.destroy && instance.element) {
          instance.destroy();
        }
      } catch (error) {
        console.warn(`[VditorLifecycleManager] 清理编辑器实例失败 for tab ${tabId}:`, error);
      }
    }
    this.editorInstances.clear();
  }

  /**
   * 获取编辑器内容
   * @param {string} tabId - 标签页ID
   * @returns {string} 编辑器内容
   */
  getEditorContent(tabId) {
    const instance = this.editorInstances.get(tabId);
    if (instance && typeof instance.getValue === 'function' && instance.currentMode) {
      return instance.getValue();
    }
    return '';
  }

  /**
   * 设置编辑器内容
   * @param {string} tabId - 标签页ID
   * @param {string} content - 内容
   */
  setEditorContent(tabId, content) {
    const instance = this.editorInstances.get(tabId);
    if (instance && typeof instance.setValue === 'function' && instance.currentMode) {
      instance.setValue(content);
    }
  }

  /**
   * 聚焦编辑器
   * @param {string} tabId - 标签页ID
   */
  focusEditor(tabId) {
    const instance = this.editorInstances.get(tabId);
    if (instance && typeof instance.focus === 'function' && instance.currentMode) {
      instance.focus();
    }
  }

  /**
   * 插入内容到编辑器
   * @param {string} tabId - 标签页ID
   * @param {string} content - 要插入的内容
   */
  insertContent(tabId, content) {
    const instance = this.editorInstances.get(tabId);
    if (instance && typeof instance.insertValue === 'function' && instance.currentMode) {
      instance.insertValue(content);
    }
  }

  /**
   * 获取编辑器纯文本内容
   * @param {string} tabId - 标签页ID
   * @returns {string} 纯文本内容
   */
  getEditorText(tabId) {
    const instance = this.editorInstances.get(tabId);
    if (instance && typeof instance.getValue === 'function' && instance.currentMode) {
      const content = instance.getValue();
      // 简单的Markdown到纯文本转换
      return content.replace(/[#*`\[\]()_~]/g, '').replace(/\n+/g, ' ').trim();
    }
    return '';
  }

  /**
   * 检查编辑器是否为空
   * @param {string} tabId - 标签页ID
   * @returns {boolean} 是否为空
   */
  isEditorEmpty(tabId) {
    const instance = this.editorInstances.get(tabId);
    if (instance && typeof instance.getValue === 'function' && instance.currentMode) {
      const content = instance.getValue();
      return !content || content.trim() === '';
    }
    return true;
  }

  /**
   * 获取编辑器字符数
   * @param {string} tabId - 标签页ID
   * @returns {number} 字符数
   */
  getCharacterCount(tabId) {
    const instance = this.editorInstances.get(tabId);
    if (instance && typeof instance.getValue === 'function' && instance.currentMode) {
      const content = instance.getValue();
      // 简单的Markdown到纯文本转换并计算字符数
      const plainText = content.replace(/[#*`\[\]()_~]/g, '').replace(/\n+/g, ' ').trim();
      return plainText.length;
    }
    return 0;
  }
}

// 创建全局单例实例
export const vditorLifecycleManager = new VditorLifecycleManager();