import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  setCustomPromptForMode,
  resetCustomPromptForMode,
  setModeFeatureSetting,
  resetModeFeatureSettings,
  setAdditionalInfoForMode,
  resetAdditionalInfoForMode,
  setContextLimitSettings,
  setShowGeneralSettingsModal,
  setAiParametersForMode,
  resetAiParametersForMode
} from '../store/slices/chatSlice';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUndo, faSave } from '@fortawesome/free-solid-svg-icons';
import useIpcRenderer from '../hooks/useIpcRenderer';
import GeneralSettingsPanel from './GeneralSettingsPanel';

const GeneralSettingsTab = forwardRef(({ onSaveComplete }, ref) => {
  const dispatch = useDispatch();
  const { invoke, getStoreValue, setStoreValue } = useIpcRenderer();
  const { customPrompts, modeFeatureSettings, additionalInfo, aiParameters } = useSelector((state) => state.chat);
  
  const [localPrompts, setLocalPrompts] = useState({});
  const [localFeatureSettings, setLocalFeatureSettings] = useState({});
  const [localAdditionalInfo, setLocalAdditionalInfo] = useState({});
  const [localAiParameters, setLocalAiParameters] = useState({});
  const [defaultPrompts, setDefaultPrompts] = useState({});
  const [customModes, setCustomModes] = useState([]);
  const [isLoadingPrompts, setIsLoadingPrompts] = useState(false);

  // 从后端获取默认提示词
  const fetchDefaultPrompts = async () => {
    setIsLoadingPrompts(true);
    try {
      const result = await invoke('get-default-prompts');
      if (result.success) {
        setDefaultPrompts(result.prompts);
      } else {
        // 如果后端获取失败，使用前端默认值作为fallback
        setDefaultPrompts({
          general: `你是一个**工具使用型AI**，精通使用各种工具来完成用户请求。`,
          outline: `你是一位小说创作顾问，负责与用户深度沟通本章核心需求。`,
          writing: `你是一位专业小说代笔，需严格基于用户提供的【最终版细纲】进行创作。`,
          adjustment: `你是一位资深编辑和小说精修师。`
        });
      }
    } catch (error) {
      console.error('调用获取默认提示词API失败:', error);
    } finally {
      setIsLoadingPrompts(false);
    }
  };
  // 加载自定义模式
  const loadCustomModes = async () => {
    try {
      const storedCustomModes = await getStoreValue('customModes') || [];
      setCustomModes(storedCustomModes);
      console.log('[GeneralSettingsTab] 加载自定义模式:', storedCustomModes);
    } catch (error) {
      console.error('[GeneralSettingsTab] 加载自定义模式失败:', error);
    }
  };

  // 直接从存储加载设置，避免Redux状态同步问题
  const loadSettingsFromStore = async () => {
    try {
      console.log('[GeneralSettingsTab] 开始直接从存储加载设置...');
      
      // 从存储获取所有设置
      const [storedCustomPrompts, storedModeFeatureSettings, storedAdditionalInfo, storedAiParameters] = await Promise.all([
        getStoreValue('customPrompts'),
        getStoreValue('modeFeatureSettings'),
        getStoreValue('additionalInfo'),
        getStoreValue('aiParameters')
      ]);
      
      console.log('[GeneralSettingsTab] 从存储获取的设置:');
      console.log('[GeneralSettingsTab] customPrompts:', JSON.stringify(storedCustomPrompts, null, 2));
      console.log('[GeneralSettingsTab] modeFeatureSettings:', JSON.stringify(storedModeFeatureSettings, null, 2));
      console.log('[GeneralSettingsTab] additionalInfo:', JSON.stringify(storedAdditionalInfo, null, 2));
      console.log('[GeneralSettingsTab] aiParameters:', JSON.stringify(storedAiParameters, null, 2));
      
      // 设置本地状态
      setLocalPrompts(storedCustomPrompts || {});
      setLocalFeatureSettings(storedModeFeatureSettings || {});
      
      // 直接使用从存储中获取的AI参数，不进行迁移处理
      const aiParametersData = storedAiParameters || {};
      setLocalAiParameters(aiParametersData);
      
      // 同时更新Redux状态
      for (const mode of Object.keys(aiParametersData)) {
        const modeParameters = aiParametersData[mode];
        if (typeof modeParameters === 'object' && modeParameters !== null) {
          dispatch(setAiParametersForMode({ mode, parameters: modeParameters }));
        }
      }
      
      // 处理附加信息的旧格式迁移
      const migratedAdditionalInfo = {};
      const additionalInfoData = storedAdditionalInfo || {};
      
      // 获取所有模式（内置 + 自定义） - 使用不同的变量名
      const allModesForAdditionalInfo = ['general', 'outline', 'writing', 'adjustment', ...customModes.map(m => m.id)];
      
      for (const mode of allModesForAdditionalInfo) {
        const modeInfo = additionalInfoData[mode];
        if (typeof modeInfo === 'string') {
          migratedAdditionalInfo[mode] = {
            outline: modeInfo,
            previousChapter: '',
            characterSettings: ''
          };
        } else if (typeof modeInfo === 'object' && modeInfo !== null) {
          migratedAdditionalInfo[mode] = {
            outline: modeInfo.outline || '',
            previousChapter: modeInfo.previousChapter || '',
            characterSettings: modeInfo.characterSettings || ''
          };
        } else {
          migratedAdditionalInfo[mode] = {
            outline: '',
            previousChapter: '',
            characterSettings: ''
          };
        }
      }
      setLocalAdditionalInfo(migratedAdditionalInfo);
      
      console.log('[GeneralSettingsTab] 直接从存储加载完成:');
      console.log('[GeneralSettingsTab] localPrompts:', JSON.stringify(storedCustomPrompts, null, 2));
      console.log('[GeneralSettingsTab] localFeatureSettings:', JSON.stringify(storedModeFeatureSettings, null, 2));
      console.log('[GeneralSettingsTab] migratedAdditionalInfo:', JSON.stringify(migratedAdditionalInfo, null, 2));
      console.log('[GeneralSettingsTab] localAiParameters:', JSON.stringify(aiParametersData, null, 2));
      
    } catch (error) {
      console.error('[GeneralSettingsTab] 从存储加载设置失败:', error);
      // 如果存储加载失败，回退到Redux状态
      console.log('[GeneralSettingsTab] 回退到Redux状态');
      setLocalPrompts(customPrompts);
      setLocalFeatureSettings(modeFeatureSettings);
      
      // 处理AI参数
      const aiParametersData = {};
      const allModesForRedux = ['general', 'outline', 'writing', 'adjustment', ...customModes.map(m => m.id)];
      
      for (const mode of allModesForRedux) {
        // 从Redux状态获取AI参数
        if (aiParameters && aiParameters[mode]) {
          aiParametersData[mode] = aiParameters[mode];
        } else {
          // 如果没有，使用默认值
          aiParametersData[mode] = {
            temperature: 0.7,
            top_p: 0.7,
            n: 1
          };
        }
      }
      setLocalAiParameters(aiParametersData);
      
      const migratedAdditionalInfo = {};
      
      for (const mode of allModesForRedux) {
        const modeInfo = additionalInfo[mode];
        if (typeof modeInfo === 'string') {
          migratedAdditionalInfo[mode] = {
            outline: modeInfo,
            previousChapter: '',
            characterSettings: ''
          };
        } else if (typeof modeInfo === 'object' && modeInfo !== null) {
          migratedAdditionalInfo[mode] = {
            outline: modeInfo.outline || '',
            previousChapter: modeInfo.previousChapter || '',
            characterSettings: modeInfo.characterSettings || ''
          };
        } else {
          migratedAdditionalInfo[mode] = {
            outline: '',
            previousChapter: '',
            characterSettings: ''
          };
        }
      }
      setLocalAdditionalInfo(migratedAdditionalInfo);
    }
  };

  // 处理自定义模式操作
  const handleAddCustomMode = async (newMode) => {
    try {
      const updatedCustomModes = [...customModes, newMode];
      setCustomModes(updatedCustomModes);
      await setStoreValue('customModes', updatedCustomModes);
      console.log('[GeneralSettingsTab] 添加自定义模式:', newMode);
    } catch (error) {
      console.error('[GeneralSettingsTab] 添加自定义模式失败:', error);
    }
  };

  const handleEditCustomMode = async (modeId, updatedMode) => {
    try {
      const updatedCustomModes = customModes.map(mode =>
        mode.id === modeId ? updatedMode : mode
      );
      setCustomModes(updatedCustomModes);
      await setStoreValue('customModes', updatedCustomModes);
      console.log('[GeneralSettingsTab] 编辑自定义模式:', updatedMode);
    } catch (error) {
      console.error('[GeneralSettingsTab] 编辑自定义模式失败:', error);
    }
  };

  const handleDeleteCustomMode = async (modeId) => {
    try {
      const updatedCustomModes = customModes.filter(mode => mode.id !== modeId);
      setCustomModes(updatedCustomModes);
      await setStoreValue('customModes', updatedCustomModes);
      
      // 删除相关的设置数据
      const updatedPrompts = { ...localPrompts };
      delete updatedPrompts[modeId];
      setLocalPrompts(updatedPrompts);
      
      const updatedFeatureSettings = { ...localFeatureSettings };
      delete updatedFeatureSettings[modeId];
      setLocalFeatureSettings(updatedFeatureSettings);
      
      const updatedAdditionalInfo = { ...localAdditionalInfo };
      delete updatedAdditionalInfo[modeId];
      setLocalAdditionalInfo(updatedAdditionalInfo);
      
      console.log('[GeneralSettingsTab] 删除自定义模式:', modeId);
    } catch (error) {
      console.error('[GeneralSettingsTab] 删除自定义模式失败:', error);
    }
  };

  useEffect(() => {
    fetchDefaultPrompts();
    loadCustomModes();
    loadSettingsFromStore();
  }, []); // 空依赖数组，只在组件挂载时执行一次

  const handlePromptChange = (mode, value) => {
    setLocalPrompts(prev => ({
      ...prev,
      [mode]: value
    }));
  };

  // 功能设置变更处理（现在主要用于其他功能，RAG设置已移到专门页面）
  const handleFeatureSettingChange = (mode, feature, enabled) => {
    setLocalFeatureSettings(prev => ({
      ...prev,
      [mode]: {
        ...prev[mode],
        [feature]: enabled
      }
    }));
  };

  const handleAdditionalInfoChange = (mode, field, value) => {
    setLocalAdditionalInfo(prev => ({
      ...prev,
      [mode]: {
        ...prev[mode],
        [field]: value
      }
    }));
  };

  // 处理AI参数变化（按模式）
  const handleAiParametersChange = (mode, newParameters) => {
    console.log(`[GeneralSettingsTab] 模式 ${mode} 的AI参数已更新:`, newParameters);
    setLocalAiParameters(prev => ({
      ...prev,
      [mode]: newParameters
    }));
    
    // 同时更新Redux状态
    dispatch(setAiParametersForMode({ mode, parameters: newParameters }));
  };

  const handleReset = (mode) => {
    setLocalPrompts(prev => ({
      ...prev,
      [mode]: ''
    }));
    setLocalFeatureSettings(prev => ({
      ...prev,
      [mode]: {}
    }));
    setLocalAdditionalInfo(prev => ({
      ...prev,
      [mode]: {
        outline: '',
        previousChapter: '',
        characterSettings: ''
      }
    }));
    
    dispatch(resetCustomPromptForMode({ mode }));
    dispatch(resetModeFeatureSettings({ mode }));
    dispatch(resetAdditionalInfoForMode({ mode }));
  };


  const handleSave = async () => {
    try {
      console.log('[GeneralSettingsTab] 开始保存通用设置');
      
      // 保存所有模式的自定义提示词
      for (const mode of Object.keys(localPrompts)) {
        dispatch(setCustomPromptForMode({ mode, prompt: localPrompts[mode] }));
        console.log(`[GeneralSettingsTab] 保存模式 ${mode} 的自定义提示词: ${localPrompts[mode] ? '有内容' : '空'}`);
      }
      
      // 保存所有模式的功能设置（现在只保存其他功能设置，RAG设置已移到专门页面）
      for (const mode of Object.keys(localFeatureSettings)) {
        const settings = localFeatureSettings[mode];
        console.log(`[GeneralSettingsTab] 保存模式 ${mode} 的功能设置:`, settings);
        
        // 这里可以保存其他功能设置，RAG设置现在在专门页面处理
      }
      
      // 保存所有模式的附加信息
      for (const mode of Object.keys(localAdditionalInfo)) {
        const info = localAdditionalInfo[mode];
        console.log(`[GeneralSettingsTab] 保存模式 ${mode} 的附加信息:`, {
          outlineLength: info.outline?.length || 0,
          previousChapterLength: info.previousChapter?.length || 0,
          characterSettingsLength: info.characterSettings?.length || 0
        });
        dispatch(setAdditionalInfoForMode({ mode, info: localAdditionalInfo[mode] }));
      }
      
      // 保存AI参数设置（按模式）
      for (const mode of Object.keys(localAiParameters)) {
        const parameters = localAiParameters[mode];
        if (parameters && Object.keys(parameters).length > 0) {
          console.log(`[GeneralSettingsTab] 保存模式 ${mode} 的AI参数设置:`, parameters);
          dispatch(setAiParametersForMode({ mode, parameters }));
        }
      }
      
      // 保存到持久化存储
      console.log('[GeneralSettingsTab] 保存到持久化存储...');
      await invoke('set-store-value', 'customPrompts', localPrompts);
      await invoke('set-store-value', 'modeFeatureSettings', localFeatureSettings);
      await invoke('set-store-value', 'additionalInfo', localAdditionalInfo);
      await invoke('set-store-value', 'aiParameters', localAiParameters);

      console.log('[GeneralSettingsTab] 通用设置保存完成');
      
      // 通知保存成功
      if (onSaveComplete) {
        onSaveComplete('通用设置保存成功！', true);
      }
    } catch (error) {
      console.error('保存通用设置失败:', error);
      // 通知保存失败
      if (onSaveComplete) {
        onSaveComplete('通用设置保存失败，请重试。', false);
      }
    }
  };

  const getModeDisplayName = (mode) => {
    const names = {
      general: '通用',
      outline: '细纲',
      writing: '写作',
      adjustment: '调整'
    };
    return names[mode] || mode;
  };

  // 暴露保存方法给父组件
  useImperativeHandle(ref, () => ({
    handleSave
  }));

  return (
    <div className="tab-content">
      <GeneralSettingsPanel
        defaultPrompts={defaultPrompts}
        localPrompts={localPrompts}
        localFeatureSettings={localFeatureSettings}
        localAdditionalInfo={localAdditionalInfo}
        localAiParameters={localAiParameters}
        customModes={customModes}
        onPromptChange={handlePromptChange}
        onFeatureSettingChange={handleFeatureSettingChange}
        onAdditionalInfoChange={handleAdditionalInfoChange}
        onAiParametersChange={handleAiParametersChange}
        onReset={handleReset}
        onAddCustomMode={handleAddCustomMode}
        onEditCustomMode={handleEditCustomMode}
        onDeleteCustomMode={handleDeleteCustomMode}
        isLoadingPrompts={isLoadingPrompts}
      />
    </div>
  );
});

export default GeneralSettingsTab;