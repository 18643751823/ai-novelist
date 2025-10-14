import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  setDeepseekApiKey,
  setOpenrouterApiKey,
  setSiliconflowApiKey,
  setOllamaBaseUrl
} from '../../store/slices/chatSlice';
import useIpcRenderer from '../../hooks/useIpcRenderer';

const ProviderSettingsTab = ({ provider }) => {
  const dispatch = useDispatch();
  const { invoke } = useIpcRenderer();
  const {
    deepseekApiKey,
    openrouterApiKey,
    siliconflowApiKey,
    ollamaBaseUrl
  } = useSelector((state) => state.chat);

  const [localApiKey, setLocalApiKey] = useState(
    provider === 'deepseek' ? deepseekApiKey || '' :
    provider === 'openrouter' ? openrouterApiKey || '' :
    provider === 'siliconflow' ? siliconflowApiKey || '' : ''
  );

  const [localBaseUrl, setLocalBaseUrl] = useState(
    provider === 'ollama' ? ollamaBaseUrl || 'http://127.0.0.1:11434' : ''
  );

  const handleSave = async () => {
    try {
      if (provider === 'deepseek') {
        dispatch(setDeepseekApiKey(localApiKey));
        // 立即保存到持久化存储
        await invoke('set-store-value', 'deepseekApiKey', localApiKey);
      } else if (provider === 'openrouter') {
        dispatch(setOpenrouterApiKey(localApiKey));
        await invoke('set-store-value', 'openrouterApiKey', localApiKey);
      } else if (provider === 'siliconflow') {
        dispatch(setSiliconflowApiKey(localApiKey));
        await invoke('set-store-value', 'siliconflowApiKey', localApiKey);
      } else if (provider === 'ollama') {
        dispatch(setOllamaBaseUrl(localBaseUrl));
        await invoke('set-store-value', 'ollamaBaseUrl', localBaseUrl);
      }
      
      // 重新初始化模型提供者
      await invoke('reinitialize-model-provider');
      console.log(`${provider} 设置保存成功`);
    } catch (error) {
      console.error(`保存 ${provider} 设置失败:`, error);
    }
  };

  const renderProviderSettings = () => {
    switch (provider) {
      case 'deepseek':
        return (
          <div className="provider-settings">
            <div className="setting-item">
              <label htmlFor="deepseekApiKey">DeepSeek API Key:</label>
              <input
                type="password"
                id="deepseekApiKey"
                value={localApiKey}
                onChange={(e) => setLocalApiKey(e.target.value)}
                placeholder="请输入您的 DeepSeek API Key"
              />
              <div className="setting-description">
                获取地址：<a href="https://platform.deepseek.com/" target="_blank" rel="noopener noreferrer">DeepSeek Platform</a>
              </div>
            </div>
          </div>
        );

      case 'openrouter':
        return (
          <div className="provider-settings">
            <div className="setting-item">
              <label htmlFor="openrouterApiKey">OpenRouter API Key:</label>
              <input
                type="password"
                id="openrouterApiKey"
                value={localApiKey}
                onChange={(e) => setLocalApiKey(e.target.value)}
                placeholder="请输入您的 OpenRouter API Key"
              />
              <div className="setting-description">
                获取地址：<a href="https://openrouter.ai/" target="_blank" rel="noopener noreferrer">OpenRouter</a>
              </div>
            </div>
          </div>
        );

      case 'ollama':
        return (
          <div className="provider-settings">
            <div className="setting-item">
              <label htmlFor="ollamaBaseUrl">Ollama 服务地址:</label>
              <input
                type="text"
                id="ollamaBaseUrl"
                value={localBaseUrl}
                onChange={(e) => setLocalBaseUrl(e.target.value)}
                placeholder="http://127.0.0.1:11434"
              />
              <div className="setting-description">
                本地运行的 Ollama 服务地址，默认: http://127.0.0.1:11434
              </div>
            </div>
          </div>
        );

      case 'siliconflow':
        return (
          <div className="provider-settings">
            <div className="setting-item">
              <label htmlFor="siliconflowApiKey">硅基流动 API Key:</label>
              <input
                type="password"
                id="siliconflowApiKey"
                value={localApiKey}
                onChange={(e) => setLocalApiKey(e.target.value)}
                placeholder="请输入您的硅基流动 API Key"
              />
              <div className="setting-description">
                获取地址：<a href="https://siliconflow.cn/" target="_blank" rel="noopener noreferrer">硅基流动官网</a>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="provider-tab-content">
      <h4>{getProviderDisplayName(provider)} 设置</h4>
      {renderProviderSettings()}
      <div className="provider-actions">
        <button className="save-button" onClick={handleSave}>
          保存 {getProviderDisplayName(provider)} 设置
        </button>
      </div>
    </div>
  );
};

// 辅助函数：获取提供商显示名称
const getProviderDisplayName = (provider) => {
  const names = {
    'deepseek': 'DeepSeek',
    'openrouter': 'OpenRouter',
    'ollama': 'Ollama',
    'siliconflow': '硅基流动'
  };
  return names[provider] || provider;
};

export default ProviderSettingsTab;