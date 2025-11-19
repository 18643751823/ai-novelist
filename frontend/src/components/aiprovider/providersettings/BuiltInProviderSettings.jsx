import React, { useState, useEffect } from 'react';
import AvailableModelsList from './AvailableModelsList';
import providerConfigService from '../../../services/providerConfigService';
// 提供商配置常量
const PROVIDER_CONFIGS = {
  deepseek: {
    label: 'API Key',
    placeholder: '请输入您的 DeepSeek API Key',
    helpLink: 'https://platform.deepseek.com/',
    helpText: '获取地址：DeepSeek Platform',
    apiKeyField: 'deepseekApiKey'
  },
  openrouter: {
    label: 'API Key',
    placeholder: '请输入您的 OpenRouter API Key',
    helpLink: 'https://openrouter.ai/',
    helpText: '获取地址：OpenRouter',
    apiKeyField: 'openrouterApiKey'
  },
  siliconflow: {
    label: 'API Key',
    placeholder: '请输入您的硅基流动 API Key',
    helpLink: 'https://siliconflow.cn/',
    helpText: '获取地址：硅基流动官网',
    apiKeyField: 'siliconflowApiKey'
  },
  aliyun: {
    label: 'API Key',
    placeholder: '请输入您的阿里云百炼 API Key',
    helpLink: 'https://dashscope.aliyun.com/',
    helpText: '获取地址：阿里云百炼控制台',
    apiKeyField: 'aliyunApiKey'
  },
  kimi: {
    label: 'API Key',
    placeholder: '请输入您的 Kimi API Key',
    helpLink: 'https://platform.moonshot.cn/',
    helpText: '获取地址：Kimi 开放平台',
    apiKeyField: 'kimiApiKey'
  },
  zhipuai: {
    label: 'API Key',
    placeholder: '请输入您的智谱AI API Key',
    helpLink: 'https://open.bigmodel.cn/',
    helpText: '获取地址：智谱AI开放平台',
    apiKeyField: 'zhipuaiApiKey'
  },
  ollama: {
    label: '服务地址',
    placeholder: 'http://127.0.0.1:11434',
    helpText: '本地运行的 Ollama 服务地址，默认: http://127.0.0.1:11434',
    apiKeyField: 'ollamaBaseUrl'
  },
  gemini: {
    label: 'API Key',
    placeholder: '请输入您的 Google Gemini API Key',
    helpLink: 'https://ai.google.dev/',
    helpText: '获取地址：Google AI Studio',
    apiKeyField: 'geminiApiKey'
  }
};

const BuiltInProviderSettings = ({ providerId, configs, onConfigsUpdate, availableModels }) => {
  const config = PROVIDER_CONFIGS[providerId] || {};
  const [providerModels, setProviderModels] = useState([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [apiKey, setApiKey] = useState('');

  // 获取当前提供商的配置值
  const getConfigValue = () => {
    const apiKeyField = config.apiKeyField;
    return configs[apiKeyField] || '';
  };

  // 处理配置值变化
  const handleConfigChange = (value) => {
    const apiKeyField = config.apiKeyField;
    onConfigsUpdate(apiKeyField, value);
    
    // 更新本地API密钥状态
    setApiKey(value);
  };

  // 获取提供商模型列表
  const fetchProviderModels = async () => {
    if (!providerId) return;
    
    try {
      setLoadingModels(true);
      const currentApiKey = getConfigValue();
      
      // 使用后端 api_provider 端点获取模型列表
      // 对于本地提供商（如Ollama），不需要API密钥
      if (providerId === 'ollama') {
        const result = await providerConfigService.getProviderModels(providerId);
        if (result.success) {
          console.log(`从后端获取 ${providerId} 模型列表:`, result.data);
          setProviderModels(result.data);
        } else {
          console.error(`获取 ${providerId} 模型列表失败:`, result.error);
        }
      } else if (currentApiKey) {
        // 对于需要API密钥的提供商，只有当API密钥存在时才获取模型
        const result = await providerConfigService.getProviderModels(providerId, currentApiKey);
        if (result.success) {
          console.log(`从后端获取 ${providerId} 模型列表:`, result.data);
          setProviderModels(result.data);
        } else {
          console.error(`获取 ${providerId} 模型列表失败:`, result.error);
        }
      } else {
        console.warn(`提供商 ${providerId} 需要API密钥才能获取模型列表`);
      }
    } catch (error) {
      console.error(`获取提供商 ${providerId} 的模型列表失败:`, error);
    } finally {
      setLoadingModels(false);
    }
  };

  // 初始化时获取模型列表
  useEffect(() => {
    fetchProviderModels();
  }, [providerId, configs]);

  // 当API密钥变化时，重新获取模型列表
  useEffect(() => {
    const currentApiKey = getConfigValue();
    if (currentApiKey !== apiKey) {
      setApiKey(currentApiKey);
      if (currentApiKey) {
        fetchProviderModels();
      }
    }
  }, [configs, providerId]);

  return (
    <div className="builtin-provider-settings">
      <div className="setting-group">
        <label htmlFor={`${providerId}-config`}>
          {config.label}
        </label>
        
        {providerId === 'ollama' ? (
          <input
            type="text"
            id={`${providerId}-config`}
            value={getConfigValue() || 'http://127.0.0.1:11434'}
            onChange={(e) => handleConfigChange(e.target.value)}
            placeholder={config.placeholder}
          />
        ) : (
          <input
            type="password"
            id={`${providerId}-config`}
            value={getConfigValue()}
            onChange={(e) => handleConfigChange(e.target.value)}
            placeholder={config.placeholder}
          />
        )}

        {config.helpLink ? (
          <div className="setting-help">
            {config.helpText}：
            <a href={config.helpLink} target="_blank" rel="noopener noreferrer">
              {config.helpLink.split('//')[1]}
            </a>
          </div>
        ) : (
          <div className="setting-help">{config.helpText}</div>
        )}
      </div>

      {/* 可用模型展示部分 */}
      <div className="available-models-section">
        <h4>可用模型</h4>
        
        <div className="setting-group">
          <label>当前可用模型:</label>
          
          {/* 刷新按钮 */}
          <div className="models-refresh-container">
            <button
              className="refresh-models-btn"
              onClick={fetchProviderModels}
              disabled={loadingModels}
            >
              {loadingModels ? '获取中...' : '刷新模型列表'}
            </button>
          </div>
          
          <div className="available-models-display">
            {loadingModels ? (
              <div className="loading-models-message">
                正在获取模型列表...
              </div>
            ) : providerModels.length === 0 ? (
              <div className="no-models-message">
                {providerId === 'ollama'
                  ? '暂无可用模型，请确保Ollama服务正在运行'
                  : '暂无可用模型，请先配置API密钥'
                }
              </div>
            ) : (
              <AvailableModelsList
                models={providerModels}
                currentProvider={providerId}
                providerApiKey={getConfigValue()}
              />
            )}
          </div>
          {!loadingModels && providerModels.length === 0 && (
            <div className="setting-description" style={{color: '#ff6b6b'}}>
              {providerId === 'ollama'
                ? '当前没有可用的AI模型。请确保Ollama服务正在运行，然后点击"刷新模型列表"按钮。'
                : '当前没有可用的AI模型。请先配置API密钥，然后点击"刷新模型列表"按钮。'
              }
            </div>
          )}
          {/* Ollama服务不可用时的特殊提示 */}
          {providerId === 'ollama' && providerModels.length > 0 &&
           providerModels.some(model => model.id === 'no-service') && (
            <div className="setting-description" style={{color: '#ff6b6b', marginTop: '10px'}}>
              ⚠️ Ollama服务当前不可用。请启动Ollama服务后点击"刷新模型列表"按钮。
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default BuiltInProviderSettings;