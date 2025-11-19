/**
 * Tiptap 编辑器生命周期管理
 * 处理标签页相关的注册和注销功能
 */
export class TiptapLifecycleManager {
  constructor() {
    this.editorInstances = new Map();
  }

  /**
   * 注册编辑器实例
   * @param {string} tabId - 标签页ID
   * @param {Object} editorInstance - Tiptap 编辑器实例
   */
  registerEditor(tabId, editorInstance) {
    console.log(`[TiptapLifecycleManager] 注册编辑器实例 for tab: ${tabId}`);
    this.editorInstances.set(tabId, editorInstance);
  }

  /**
   * 注销编辑器实例
   * @param {string} tabId - 标签页ID
   */
  unregisterEditor(tabId) {
    console.log(`[TiptapLifecycleManager] 注销编辑器实例 for tab: ${tabId}`);
    const instance = this.editorInstances.get(tabId);
    
    if (instance) {
      try {
        // 销毁编辑器实例
        if (instance && typeof instance.destroy === 'function') {
          instance.destroy();
        }
      } catch (error) {
        console.warn(`[TiptapLifecycleManager] 销毁编辑器实例失败 for tab ${tabId}:`, error);
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
    console.log('[TiptapLifecycleManager] 清理所有编辑器实例');
    for (const [tabId, instance] of this.editorInstances) {
      try {
        if (instance && typeof instance.destroy === 'function') {
          instance.destroy();
        }
      } catch (error) {
        console.warn(`[TiptapLifecycleManager] 清理编辑器实例失败 for tab ${tabId}:`, error);
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
    if (instance && typeof instance.getHTML === 'function') {
      return instance.getHTML();
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
    if (instance && instance.commands && typeof instance.commands.setContent === 'function') {
      instance.commands.setContent(content);
    }
  }

  /**
   * 聚焦编辑器
   * @param {string} tabId - 标签页ID
   */
  focusEditor(tabId) {
    const instance = this.editorInstances.get(tabId);
    if (instance && instance.commands && typeof instance.commands.focus === 'function') {
      instance.commands.focus();
    }
  }

  /**
   * 插入内容到编辑器
   * @param {string} tabId - 标签页ID
   * @param {string} content - 要插入的内容
   */
  insertContent(tabId, content) {
    const instance = this.editorInstances.get(tabId);
    if (instance && instance.chain) {
      instance.chain().focus().insertContent(content).run();
    }
  }

  /**
   * 获取编辑器纯文本内容
   * @param {string} tabId - 标签页ID
   * @returns {string} 纯文本内容
   */
  getEditorText(tabId) {
    const instance = this.editorInstances.get(tabId);
    if (instance && typeof instance.getText === 'function') {
      return instance.getText();
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
    if (instance && typeof instance.isEmpty === 'function') {
      return instance.isEmpty;
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
    if (instance && instance.storage && instance.storage.characterCount) {
      return instance.storage.characterCount.characters();
    }
    return 0;
  }
}

// 创建全局单例实例
export const tiptapLifecycleManager = new TiptapLifecycleManager();