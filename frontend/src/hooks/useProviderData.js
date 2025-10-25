import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  setAvailableModels,
  setCustomProviders as setCustomProvidersAction
} from '../store/slices/apiSlice';
import useIpcRenderer from './useIpcRenderer';

// 内置提供商配置
const BUILT_IN_PROVIDERS = [
  { id: 'deepseek', name: 'DeepSeek', type: 'builtin', enabled: true },
  { id: 'openrouter', name: 'OpenRouter', type: 'builtin', enabled: true },
  { id: 'ollama', name: 'Ollama', type: 'builtin', enabled: true },
  { id: 'siliconflow', name: '硅基流动', type: 'builtin', enabled: true },
  { id: 'aliyun', name: '阿里云百炼', type: 'builtin', enabled: true }
];

const useProviderData = () => {
  const dispatch = useDispatch();
  const { invoke } = useIpcRenderer();
  
  // 从 Redux Store 获取自定义提供商数据
  const customProviders = useSelector((state) => state.chat.api.customProviders || []);
  
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(false);

  // 加载提供商列表
  const loadProviders = useCallback(async () => {
    try {
      setLoading(true);
      
      // 直接从存储加载自定义提供商，避免依赖循环
      const storedCustomProviders = await invoke('get-store-value', 'customProviders') || [];
      
      // 如果存储中有数据，则更新 Redux（应用启动时）
      if (storedCustomProviders.length > 0) {
        dispatch(setCustomProvidersAction(storedCustomProviders));
      }

      const allProviders = [
        ...BUILT_IN_PROVIDERS,
        ...storedCustomProviders.map(p => ({
          id: p.providerName,
          name: p.providerName,
          type: 'custom',
          enabled: p.enabled
        }))
      ];

      setProviders(allProviders);
      
    } catch (error) {
      console.error('加载提供商列表失败:', error);
    } finally {
      setLoading(false);
    }
  }, [invoke, dispatch]); // 移除 customProviders 依赖，避免循环

  // 加载可用模型列表
  const loadAvailableModels = useCallback(async () => {
    try {
      const models = await invoke('get-available-models');
      if (models.success) {
        dispatch(setAvailableModels(models.models));
        console.log(`[提供商设置] 加载到 ${models.models.length} 个模型`);
      } else {
        console.warn('[提供商设置] 获取模型列表失败，使用空列表:', models.error);
        dispatch(setAvailableModels([]));
      }
    } catch (error) {
      console.error('加载模型列表失败:', error);
    }
  }, [invoke, dispatch]);

  // Ollama服务重连
  const handleRedetectOllama = useCallback(async () => {
    try {
      const result = await invoke('redetect-ollama');
      if (result.success) {
        await loadAvailableModels(); // 重新加载模型列表
      } else {
        console.error('Ollama服务重新检测失败:', result.error);
      }
    } catch (error) {
      console.error('调用Ollama重连失败:', error);
    }
  }, [invoke, loadAvailableModels]);

  // 处理删除自定义提供商
  const handleDeleteCustomProvider = useCallback(async (providerName) => {
    try {
      // 过滤掉要删除的提供商
      const updatedProviders = customProviders.filter(p => p.providerName !== providerName);
      
      // 更新 Redux Store
      dispatch(setCustomProvidersAction(updatedProviders));
      
      // 保存更新后的列表到持久化存储
      await invoke('set-store-value', 'customProviders', updatedProviders);
      
      // 重新加载提供商列表
      await loadProviders();
      
      console.log(`已删除自定义提供商: ${providerName}`);
      return true;
    } catch (error) {
      console.error('删除自定义提供商失败:', error);
      return false;
    }
  }, [invoke, loadProviders, customProviders, dispatch]);

  // 初始化加载数据 - 只在组件挂载时执行一次
  useEffect(() => {
    loadProviders();
    loadAvailableModels();
  }, []); // 空依赖数组确保只执行一次

  return {
    providers,
    customProviders,
    loading,
    loadProviders,
    loadAvailableModels,
    handleRedetectOllama,
    handleDeleteCustomProvider
  };
};

export default useProviderData;