import React, { useCallback, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  setSelectedModel,
  setSelectedProvider,
  setDeepseekApiKey,
  setOpenrouterApiKey,
  setSiliconflowApiKey,
  setAliyunApiKey,
  setAliyunEmbeddingApiKey,
  setIntentAnalysisModel,
  setAvailableModels,
  setOllamaBaseUrl,
  setShowApiSettingsModal
} from '../store/slices/chatSlice';
import useIpcRenderer from '../hooks/useIpcRenderer';
import ProviderSettingsPanel from './ProviderSettingsPanel';

const ApiSettingsTab = forwardRef(({ onSaveComplete }, ref) => {
  const dispatch = useDispatch();
  const { invoke, setStoreValue, reinitializeModelProvider, reinitializeAliyunEmbedding } = useIpcRenderer();
  const {
    selectedModel,
    selectedProvider,
    deepseekApiKey,
    openrouterApiKey,
    siliconflowApiKey,
    aliyunApiKey,
    aliyunEmbeddingApiKey,
    intentAnalysisModel,
    availableModels,
    ollamaBaseUrl
  } = useSelector((state) => state.chat);

  // 加载设置
  const loadSettings = useCallback(async () => {
    try {
      // 从存储加载保存的设置
      const [
        storedModel,
        storedProvider,
        storedDeepseekKey,
        storedOpenrouterKey,
        storedSiliconflowKey,
        storedAliyunKey,
        storedAliyunEmbeddingKey,
        storedIntentModel,
        storedOllamaUrl
      ] = await Promise.all([
        invoke('get-store-value', 'selectedModel'),
        invoke('get-store-value', 'selectedProvider'),
        invoke('get-store-value', 'deepseekApiKey'),
        invoke('get-store-value', 'openrouterApiKey'),
        invoke('get-store-value', 'siliconflowApiKey'),
        invoke('get-store-value', 'aliyunApiKey'),
        invoke('get-store-value', 'aliyunEmbeddingApiKey'),
        invoke('get-store-value', 'intentAnalysisModel'),
        invoke('get-store-value', 'ollamaBaseUrl')
      ]);

      // 更新Redux store中的设置
      if (storedModel) {
        dispatch(setSelectedModel(storedModel));
      }
      if (storedProvider) {
        dispatch(setSelectedProvider(storedProvider));
      }
      if (storedDeepseekKey) {
        dispatch(setDeepseekApiKey(storedDeepseekKey));
      }
      if (storedOpenrouterKey) {
        dispatch(setOpenrouterApiKey(storedOpenrouterKey));
      }
      if (storedSiliconflowKey) {
        dispatch(setSiliconflowApiKey(storedSiliconflowKey));
      }
      if (storedAliyunKey) {
        dispatch(setAliyunApiKey(storedAliyunKey));
      }
      if (storedAliyunEmbeddingKey) {
        dispatch(setAliyunEmbeddingApiKey(storedAliyunEmbeddingKey));
      }
      if (storedIntentModel) {
        dispatch(setIntentAnalysisModel(storedIntentModel));
      }
      if (storedOllamaUrl) {
        dispatch(setOllamaBaseUrl(storedOllamaUrl));
      }

      // 加载可用模型列表
      const models = await invoke('get-available-models');
      if (models.success) {
        dispatch(setAvailableModels(models.models));
        console.log(`[API设置] 加载到 ${models.models.length} 个模型`);
      } else {
        console.warn('[API设置] 获取模型列表失败，使用空列表:', models.error);
        dispatch(setAvailableModels([]));
      }
    } catch (error) {
      console.error('加载设置失败:', error);
    }
  }, [invoke, dispatch]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleExternalLinkClick = (url, e) => {
    e.preventDefault();
    invoke('open-external', url);
  };

  const handleRedetectOllama = async () => {
    try {
      const result = await invoke('redetect-ollama');
      if (result.success) {
        loadSettings(); // 重新加载模型列表
      } else {
        console.error('Ollama服务重新检测失败:', result.error);
      }
    } catch (error) {
      console.error('调用Ollama重连失败:', error);
    }
  };

  const handleSave = async () => {
    try {
      console.log('[API设置保存] 开始保存，当前Redux状态:', {
        selectedModel,
        selectedProvider,
        deepseekApiKey: deepseekApiKey ? '已设置(隐藏)' : '未设置',
        openrouterApiKey: openrouterApiKey ? '已设置(隐藏)' : '未设置',
        siliconflowApiKey: siliconflowApiKey ? '已设置(隐藏)' : '未设置',
        aliyunApiKey: aliyunApiKey ? '已设置(隐藏)' : '未设置',
        aliyunEmbeddingApiKey: aliyunEmbeddingApiKey ? '已设置(隐藏)' : '未设置',
        ollamaBaseUrl,
        intentAnalysisModel
      });

      // 保存到持久化存储 - 直接使用Redux状态
      await Promise.all([
        setStoreValue('deepseekApiKey', deepseekApiKey),
        setStoreValue('openrouterApiKey', openrouterApiKey),
        setStoreValue('siliconflowApiKey', siliconflowApiKey),
        setStoreValue('aliyunApiKey', aliyunApiKey),
        setStoreValue('aliyunEmbeddingApiKey', aliyunEmbeddingApiKey),
        setStoreValue('ollamaBaseUrl', ollamaBaseUrl),
        setStoreValue('intentAnalysisModel', intentAnalysisModel),
        setStoreValue('selectedModel', selectedModel),
        setStoreValue('selectedProvider', selectedProvider)
      ]);

      console.log('[API设置保存] 存储保存完成，保存的值:', {
        selectedModel,
        selectedProvider,
        intentAnalysisModel,
        ollamaBaseUrl
      });

      // 重新初始化API提供者以确保新设置立即生效
      try {
        // 重新初始化模型提供者
        await reinitializeModelProvider();
        
        // 重新初始化阿里云嵌入函数
        await reinitializeAliyunEmbedding();
        console.log('[API设置保存] API重新初始化完成');
      } catch (error) {
        console.warn('重新初始化API时出错:', error);
      }

      // 通知保存成功
      if (onSaveComplete) {
        onSaveComplete('API设置保存成功！', true);
      }
      
      console.log('[API设置保存] 保存流程完成，通知已发送');
      
      // 保存后手动触发重新加载设置以确保状态同步
      loadSettings();
      console.log('[API设置保存] 设置重新加载已触发');
      
    } catch (error) {
      console.error('保存API设置失败:', error);
      // 通知保存失败
      if (onSaveComplete) {
        onSaveComplete('API设置保存失败，请重试。', false);
      }
    }
  };

  // 暴露保存方法给父组件
  useImperativeHandle(ref, () => ({
    handleSave
  }));

  return (
    <div className="tab-content">
      {/* 使用新的分栏布局 */}
      <ProviderSettingsPanel />
    </div>
  );
});

export default ApiSettingsTab;
