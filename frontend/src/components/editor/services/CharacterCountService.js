import { useCallback } from 'react';

/**
 * 字符统计服务 Hook
 * 处理字符计数计算和状态管理
 */
export const useCharacterCount = () => {
  // 计算字符数的函数
  const calculateCharacterCount = useCallback((content) => {
    if (!content) return 0;
    // 去除所有空白字符（包括空格、换行、制表符等）后计算字符数
    return content.replace(/\s/g, '').length;
  }, []);

  return {
    calculateCharacterCount
  };
};