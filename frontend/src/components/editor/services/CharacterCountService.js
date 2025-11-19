import { useCallback } from 'react';

/**
 * 字符统计服务 Hook
 * 处理字符计数计算和状态管理
 */
export const useCharacterCount = () => {
  // 计算字符数的函数 - 对于Markdown内容，先提取纯文本
  const calculateCharacterCount = useCallback((content) => {
    // 添加更严格的null/undefined检查
    if (content === null || content === undefined) return 0;
    if (typeof content !== 'string') return 0;
    if (content.trim() === '') return 0;
    
    // 如果是Markdown内容，提取纯文本
    if (content.includes('<') || content.includes('#') || content.includes('*') || content.includes('`')) {
      try {
        // 简单的Markdown到纯文本转换
        let plainText = content;
        // 移除标题标记
        plainText = plainText.replace(/^#+\s+/gm, '');
        // 移除粗体和斜体标记
        plainText = plainText.replace(/(\*\*|__)(.*?)\1/g, '$2');
        plainText = plainText.replace(/(\*|_)(.*?)\1/g, '$2');
        // 移除删除线
        plainText = plainText.replace(/~~(.*?)~~/g, '$1');
        // 移除代码块
        plainText = plainText.replace(/```[\s\S]*?```/g, '');
        plainText = plainText.replace(/`([^`]+)`/g, '$1');
        // 移除链接
        plainText = plainText.replace(/\[[^\]]*\]\([^)]*\)/g, '$1');
        // 移除图片
        plainText = plainText.replace(/!\[[^\]]*\]\([^)]*\)/g, '');
        // 移除引用标记
        plainText = plainText.replace(/^>\s+/gm, '');
        // 移除列表标记
        plainText = plainText.replace(/^[\s]*[-*+]\s+/gm, '');
        plainText = plainText.replace(/^[\s]*\d+\.\s+/gm, '');
        // 移除表格标记
        plainText = plainText.replace(/\|/g, '');
        
        // 确保返回的是数字，防止NaN
        const count = parseInt(plainText.length, 10) || 0;
        return Math.max(0, count);
      } catch (error) {
        console.error('计算字符数时出错:', error);
        // 如果解析Markdown失败，尝试直接计算字符串长度
        const count = parseInt(content.length, 10) || 0;
        return Math.max(0, count);
      }
    }
    
    // 对于纯文本内容，直接计算字符数
    const count = parseInt(content.length, 10) || 0;
    return Math.max(0, count);
  }, []);

  // 从Vditor编辑器实例获取字符数
  const getCharacterCountFromEditor = useCallback((editor) => {
    if (!editor) return 0;
    
    try {
      // 检查是否是Vditor编辑器实例
      if (editor.getValue && typeof editor.getValue === 'function' && editor.currentMode) {
        const content = editor.getValue() || '';
        // 简单的Markdown到纯文本转换并计算字符数
        const plainText = content.replace(/[#*`\[\]()_~]/g, '').replace(/\n+/g, ' ').trim();
        const count = parseInt(plainText.length, 10) || 0;
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
