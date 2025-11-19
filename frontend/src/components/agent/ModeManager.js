import { useState, useEffect } from 'react';
import useHttpService from '../../hooks/useHttpService';

/**
 * 内置模式配置
 */
export const BUILTIN_MODES = {
  outline: {
    id: 'outline',
    name: '细纲',
    type: 'builtin',
    description: '小说创作顾问，负责与用户深度沟通本章核心需求'
  },
  writing: {
    id: 'writing',
    name: '写作',
    type: 'builtin',
    description: '专业小说代笔，基于最终版细纲进行创作'
  },
  adjustment: {
    id: 'adjustment',
    name: '调整',
    type: 'builtin',
    description: '资深编辑和小说精修师'
  }
};


/**
 * 模式管理模块 - 作为单一数据源管理所有模式状态
 * 职责：管理所有模式（内置 + 自定义）的状态和操作
 */
export const useModeManager = () => {
  const { getStoreValue, setStoreValue } = useHttpService();
  
  // 模式状态管理 - 单一数据源
  const [customModes, setCustomModes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * 初始化模式管理器
   */
  const initialize = async () => {
    setIsLoading(true);
    try {
      const storedCustomModes = await getStoreValue('customModes') || [];
      setCustomModes(storedCustomModes);
      console.log('[ModeManager] 初始化完成，自定义模式:', storedCustomModes);
    } catch (error) {
      console.error('[ModeManager] 初始化失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 获取所有模式（内置 + 自定义）
   */
  const getAllModes = () => {
    const builtInModes = Object.values(BUILTIN_MODES);
    const customModeList = customModes.map(mode => ({
      id: mode.id,
      name: mode.name,
      type: 'custom',
      description: '自定义模式'
    }));
    
    return [...builtInModes, ...customModeList];
  };

  /**
   * 添加自定义模式
   */
  const addCustomMode = async (newMode) => {
    try {
      const updatedCustomModes = [...customModes, newMode];
      await setStoreValue('customModes', updatedCustomModes);
      setCustomModes(updatedCustomModes);
      console.log('[ModeManager] 添加自定义模式:', newMode);
      return updatedCustomModes;
    } catch (error) {
      console.error('[ModeManager] 添加自定义模式失败:', error);
      throw error;
    }
  };

  /**
   * 编辑自定义模式
   */
  const editCustomMode = async (modeId, updatedMode) => {
    try {
      const updatedCustomModes = customModes.map(mode =>
        mode.id === modeId ? updatedMode : mode
      );
      await setStoreValue('customModes', updatedCustomModes);
      setCustomModes(updatedCustomModes);
      console.log('[ModeManager] 编辑自定义模式:', updatedMode);
      return updatedCustomModes;
    } catch (error) {
      console.error('[ModeManager] 编辑自定义模式失败:', error);
      throw error;
    }
  };

  /**
   * 删除自定义模式
   */
  const deleteCustomMode = async (modeId) => {
    try {
      const updatedCustomModes = customModes.filter(mode => mode.id !== modeId);
      await setStoreValue('customModes', updatedCustomModes);
      setCustomModes(updatedCustomModes);
      console.log('[ModeManager] 删除自定义模式:', modeId);
      return updatedCustomModes;
    } catch (error) {
      console.error('[ModeManager] 删除自定义模式失败:', error);
      throw error;
    }
  };

  /**
   * 清理与自定义模式相关的设置数据
   */
  const cleanupModeSettings = async (modeId) => {
    try {
      // 获取当前设置
      const [customPrompts, modeFeatureSettings, additionalInfo, ragSettings] = await Promise.all([
        getStoreValue('customPrompts') || {},
        getStoreValue('modeFeatureSettings') || {},
        getStoreValue('additionalInfo') || {},
        getStoreValue('ragSettings') || {}
      ]);
      
      // 删除相关的设置数据
      const updatedPrompts = { ...customPrompts };
      delete updatedPrompts[modeId];
      
      const updatedFeatureSettings = { ...modeFeatureSettings };
      delete updatedFeatureSettings[modeId];
      
      const updatedAdditionalInfo = { ...additionalInfo };
      delete updatedAdditionalInfo[modeId];
      
      const updatedRagSettings = { ...ragSettings };
      delete updatedRagSettings[modeId];
      
      // 保存清理后的设置
      await Promise.all([
        setStoreValue('customPrompts', updatedPrompts),
        setStoreValue('modeFeatureSettings', updatedFeatureSettings),
        setStoreValue('additionalInfo', updatedAdditionalInfo),
        setStoreValue('ragSettings', updatedRagSettings)
      ]);
      
      console.log('[ModeManager] 清理模式设置完成:', modeId);
      
      return {
        customPrompts: updatedPrompts,
        modeFeatureSettings: updatedFeatureSettings,
        additionalInfo: updatedAdditionalInfo,
        ragSettings: updatedRagSettings
      };
    } catch (error) {
      console.error('[ModeManager] 清理模式设置失败:', error);
      throw error;
    }
  };

  /**
   * 生成新的自定义模式ID
   */
  const generateCustomModeId = () => {
    return `custom_${Date.now()}`;
  };

  /**
   * 验证模式名称
   */
  const validateModeName = (name) => {
    if (!name || !name.trim()) {
      return '模式名称不能为空';
    }
    if (name.trim().length > 50) {
      return '模式名称不能超过50个字符';
    }
    
    // 检查名称是否已存在
    const allModes = getAllModes();
    const existingMode = allModes.find(mode => 
      mode.name.toLowerCase() === name.trim().toLowerCase()
    );
    if (existingMode) {
      return '模式名称已存在';
    }
    
    return null;
  };

  /**
   * 获取模式显示名称
   */
  const getModeDisplayName = (modeId) => {
    // 如果是内置模式
    if (isBuiltinMode(modeId)) {
      return BUILTIN_MODES[modeId]?.name || modeId;
    }
    
    // 如果是自定义模式
    if (isCustomMode(modeId)) {
      const customMode = customModes.find(m => m.id === modeId);
      return customMode ? customMode.name : modeId;
    }
    
    return modeId;
  };

  /**
   * 获取模式描述
   */
  const getModeDescription = (modeId) => {
    // 如果是内置模式
    if (isBuiltinMode(modeId)) {
      return BUILTIN_MODES[modeId]?.description || '';
    }
    
    // 如果是自定义模式
    if (isCustomMode(modeId)) {
      const customMode = customModes.find(m => m.id === modeId);
      return customMode ? '自定义模式' : '';
    }
    
    return '';
  };

  /**
   * 根据搜索文本过滤模式
   */
  const filterModes = (searchText = '') => {
    const allModes = getAllModes();
    if (!searchText.trim()) {
      return allModes;
    }
    
    const searchLower = searchText.toLowerCase();
    return allModes.filter(mode => 
      mode.name.toLowerCase().includes(searchLower) ||
      mode.description.toLowerCase().includes(searchLower)
    );
  };

  /**
   * 检查是否为内置模式
   */
  const isBuiltinMode = (modeId) => {
    return Object.keys(BUILTIN_MODES).includes(modeId);
  };

  /**
   * 检查是否为自定义模式
   */
  const isCustomMode = (modeId) => {
    return modeId.startsWith('custom_');
  };

  /**
   * 获取内置模式配置
   */
  const getBuiltinMode = (modeId) => {
    return BUILTIN_MODES[modeId];
  };

  /**
   * 获取所有内置模式
   */
  const getBuiltinModes = () => {
    return Object.values(BUILTIN_MODES);
  };

  /**
   * 获取默认提示词
   */
  const getDefaultPrompt = (modeId) => {
    return '';
  };

  /**
   * 获取所有内置模式的默认提示词
   */
  const getAllDefaultPrompts = () => {
    return {};
  };

  // 组件挂载时初始化
  useEffect(() => {
    initialize();
  }, []);

  return {
    // 状态
    customModes,
    isLoading,
    
    // 核心操作
    initialize,
    getAllModes,
    addCustomMode,
    editCustomMode,
    deleteCustomMode,
    cleanupModeSettings,
    filterModes,
    
    // 工具方法
    generateCustomModeId,
    validateModeName,
    getModeDisplayName,
    getModeDescription,
    isBuiltinMode,
    isCustomMode,
    
    // 内置模式相关
    BUILTIN_MODES,
    getBuiltinMode,
    getBuiltinModes,
    getDefaultPrompt,
    getAllDefaultPrompts
  };
};

export default useModeManager;