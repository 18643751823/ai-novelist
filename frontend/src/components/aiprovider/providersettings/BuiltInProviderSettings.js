import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  setDeepseekApiKey,
  setOpenrouterApiKey,
  setSiliconflowApiKey,
  setAliyunApiKey,
  setOllamaBaseUrl
} from '../../../store/slices/chatSlice';
import AvailableModelsList from './AvailableModelsList';

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
  ollama: {
    label: '服务地址',
    placeholder: 'http://127.0.0.1:11434',
    helpText: '本地运行的 Ollama 服务地址，默认: http://127.0.0.1:11434',
    apiKeyField: 'ollamaBaseUrl'
  }
};

// Action 映射表
const ACTION_MAP = {
  deepseek: setDeepseekApiKey,
  openrouter: setOpenrouterApiKey,
  siliconflow: setSiliconflowApiKey,
  aliyun: setAliyunApiKey,
  ollama: setOllamaBaseUrl
};

const BuiltInProviderSettings = ({ providerId, onRedetectOllama }) => {
  const dispatch = useDispatch();
  const { availableModels, ollamaBaseUrl, deepseekApiKey, openrouterApiKey, siliconflowApiKey, aliyunApiKey } = useSelector((state) => state.chat);

  const config = PROVIDER_CONFIGS[providerId] || {};

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
            value={ollamaBaseUrl || 'http://127.0.0.1:11434'}
            onChange={(e) => dispatch(setOllamaBaseUrl(e.target.value))}
            placeholder={config.placeholder}
          />
        ) : (
          <input
            type="password"
            id={`${providerId}-config`}
            value={(() => {
              const apiKeyField = config.apiKeyField;
              const apiKeys = {
                deepseekApiKey,
                openrouterApiKey,
                siliconflowApiKey,
                aliyunApiKey
              };
              return apiKeys[apiKeyField] || '';
            })()}
            onChange={(e) => {
              const action = ACTION_MAP[providerId];
              if (action) {
                dispatch(action(e.target.value));
              }
            }}
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
          <div className="available-models-display">
            {availableModels.length === 0 ? (
              <div className="no-models-message">
                暂无可用模型，请先配置API密钥
              </div>
            ) : (
              <AvailableModelsList models={availableModels} currentProvider={providerId} />
            )}
          </div>
          {availableModels.length === 0 && (
            <div className="setting-description" style={{color: '#ff6b6b'}}>
              当前没有可用的AI模型。请先配置API密钥。
            </div>
          )}
          {/* Ollama服务不可用时的特殊提示 */}
          {providerId === 'ollama' && availableModels.length > 0 &&
           availableModels.some(model => model.id === 'no-service') && (
            <div className="setting-description" style={{color: '#ff6b6b', marginTop: '10px'}}>
              ⚠️ Ollama服务当前不可用。请启动Ollama服务后点击"重新检测"按钮。
            </div>
          )}
        </div>

        {/* Ollama服务重连按钮 */}
        {providerId === 'ollama' && (
          <div className="setting-group">
            <label>Ollama服务重连:</label>
            <button
              onClick={onRedetectOllama}
              className="redetect-button"
              title="如果忘记先启动Ollama服务，点击此按钮重新检测"
            >
              重新检测Ollama服务
            </button>
            <div className="setting-description">
              如果Ollama服务当前不可用，请启动服务后点击此按钮重新检测。检测成功后模型列表将自动更新。
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BuiltInProviderSettings;