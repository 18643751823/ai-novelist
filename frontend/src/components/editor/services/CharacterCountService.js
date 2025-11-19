import { useCallback } from 'react';

/**
 * 字符统计服务 Hook
 * 处理字符计数计算和状态管理
 */
export const useCharacterCount = () => {
  // 计算字符数的函数 - 对于HTML内容，先提取纯文本
  const calculateCharacterCount = useCallback((content) => {
    // 添加更严格的null/undefined检查
    if (content === null || content === undefined) return 0;
    if (typeof content !== 'string') return 0;
    if (content.trim() === '') return 0;
    
    // 如果是HTML内容，提取纯文本
    if (content.includes('<')) {
      try {
        // 创建一个临时的DOM元素来解析HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = content;
        const textContent = tempDiv.textContent || tempDiv.innerText || '';
        // 确保返回的是数字，防止NaN
        const count = parseInt(textContent.length, 10) || 0;
        return Math.max(0, count);
      } catch (error) {
        console.error('计算字符数时出错:', error);
        // 如果解析HTML失败，尝试直接计算字符串长度
        const count = parseInt(content.length, 10) || 0;
        return Math.max(0, count);
      }
    }
    
    // 对于纯文本内容，直接计算字符数
    const count = parseInt(content.length, 10) || 0;
    return Math.max(0, count);
  }, []);

  // 从Tiptap编辑器实例获取字符数
  const getCharacterCountFromEditor = useCallback((editor) => {
    if (!editor) return 0;
    
    try {
      // 如果编辑器有内置的字符计数功能
      if (editor.storage && editor.storage.characterCount && typeof editor.storage.characterCount.characters === 'function') {
        const count = editor.storage.characterCount.characters();
        return parseInt(count, 10) || 0;
      }
      
      // 否则使用getText方法获取纯文本并计算
      if (typeof editor.getText === 'function') {
        const text = editor.getText() || '';
        const count = parseInt(text.length, 10) || 0;
        return Math.max(0, count);
      }
    } catch (error) {
      console.error('从编辑器获取字符数时出错:', error);
    }
    
    return 0;
  }, []);

  return {
    calculateCharacterCount,
    getCharacterCountFromEditor
  };
};
