import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setEmbeddingModel, setRagEmbeddingModel } from '../../../store/slices/chatSlice';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faSync, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import useIpcRenderer from '../../../hooks/useIpcRenderer';
import configStoreService from '../../../services/configStoreService';
import './EmbeddingModelSelector.css';

const EmbeddingModelSelector = ({
  selectedModel,
  availableModels = [],
  onModelChange,
  onClose,
  showCurrentSelection = false
}) => {
  const dispatch = useDispatch();
  const { invoke, setStoreValue } = useIpcRenderer();
  
  const [localEmbeddingModel, setLocalEmbeddingModel] = useState(selectedModel || '');
  const [searchText, setSearchText] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('');
  const [loadingDimensions, setLoadingDimensions] = useState({});
  const [modelDimensions, setModelDimensions] = useState({});
  const [dimensionErrors, setDimensionErrors] = useState({});

  // 获取所有提供商列表
  const providers = useMemo(() => {
    const uniqueProviders = [...new Set(availableModels.map(model => model.provider))];
    return uniqueProviders.sort();
  }, [availableModels]);

  // 检查是否为嵌入模型 - 完全在前端识别
  const isEmbeddingModel = (model) => {
    // 首先检查模型是否明确标记为嵌入模型
    if (model.isEmbedding === true) {
      return true;
    }
    
    const modelLower = model.id.toLowerCase();
    const modelNameLower = model.name ? model.name.toLowerCase() : '';
    
    // 嵌入模型关键词列表
    const embeddingKeywords = [
      'embedding', 'embed', 'bge', 'multilingual-e5', 'text-embedding',
      'ada-002', 'text-embed', 'instructor', 'sentence', 'vector',
      'embeddings', 'embed-model', 'embedding-model', 'e5', 'mpnet', 'minilm'
    ];
    
    // 检查模型ID或名称是否包含嵌入关键词
    const hasEmbeddingKeyword = embeddingKeywords.some(keyword =>
      modelLower.includes(keyword) || modelNameLower.includes(keyword)
    );
    
    // 检查是否为已知的嵌入模型
    const knownEmbeddingModels = [
      'text-embedding-ada-002', 'text-embedding-3-small', 'text-embedding-3-large',
      'bge-large-en', 'bge-large-zh', 'multilingual-e5-large', 'instructor-xl',
      'all-mpnet-base-v2', 'all-MiniLM-L6-v2', 'text-embedding-ada-002-v2',
      'text-embedding-3-small', 'text-embedding-3-large', 'bge-small-en',
      'bge-base-en', 'bge-large-en-v1.5', 'bge-large-zh-v1.5'
    ];
    
    const isKnownEmbeddingModel = knownEmbeddingModels.some(knownModel =>
      modelLower.includes(knownModel.toLowerCase())
    );
    
    return hasEmbeddingKeyword || isKnownEmbeddingModel;
  };

  // 过滤模型 - 只显示嵌入模型
  const filteredModels = useMemo(() => {
    // 首先筛选出嵌入模型
    let filtered = availableModels.filter(model => isEmbeddingModel(model));
    
    // 按搜索文本过滤
    if (searchText) {
      filtered = filtered.filter(model =>
        model.id.toLowerCase().includes(searchText.toLowerCase()) ||
        model.provider.toLowerCase().includes(searchText.toLowerCase())
      );
    }
    
    // 按提供商过滤
    if (selectedProvider) {
      filtered = filtered.filter(model => model.provider === selectedProvider);
    }
    
    return filtered;
  }, [availableModels, searchText, selectedProvider, isEmbeddingModel]);

  // 处理模型选择
  const handleModelSelect = async (modelId) => {
    setLocalEmbeddingModel(modelId);
    
    // 立即保存嵌入模型到持久化存储
    try {
      dispatch(setEmbeddingModel(modelId));
      dispatch(setRagEmbeddingModel(modelId)); // 同时更新RAG状态
      
      // 获取模型对应的URL
      let embeddingUrl = 'http://127.0.0.1:4000'; // 默认URL
      
      // 尝试从后端API获取模型URL
      try {
        const result = await configStoreService.getModelUrl(modelId);
        if (result.success && result.url) {
          embeddingUrl = result.url;
        }
      } catch (error) {
        console.warn('获取模型URL失败，使用默认URL:', error);
      }
      
      // 获取模型对应的API密钥
      let embeddingApiKey = ''; // 默认为空
      
      // 尝试从后端API获取模型API密钥
      try {
        const result = await configStoreService.getModelApiKey(modelId);
        if (result.success && result.apiKey) {
          embeddingApiKey = result.apiKey;
        }
      } catch (error) {
        console.warn('获取模型API密钥失败，使用默认空值:', error);
      }
      
      // 同时保存模型ID、URL和API密钥
      await setStoreValue('embeddingModel', modelId);
      await setStoreValue('embeddingUrl', embeddingUrl);
      await setStoreValue('embeddingApiKey', embeddingApiKey);
      console.log(`到底存了密钥没有？${embeddingApiKey}`)
      console.log(`已保存嵌入模型: ${modelId}, URL: ${embeddingUrl}, API Key: ${embeddingApiKey ? '已设置' : '未设置'}`);
    } catch (error) {
      console.error('保存嵌入模型失败:', error);
    }
    
    // 调用父组件的回调
    if (onModelChange) {
      onModelChange(modelId);
    }
  };
  // 获取当前选择的嵌入模型显示名称
  const getSelectedEmbeddingModelName = () => {
    const currentModel = localEmbeddingModel || selectedModel;
    if (!currentModel) return '选择嵌入模型';
    const model = availableModels.find(m => m.id === currentModel);
    return model ? `${model.id} (${model.provider})` : currentModel;
  };

  // 当selectedModel属性变化时更新本地状态
  useEffect(() => {
    if (selectedModel && selectedModel !== localEmbeddingModel) {
      setLocalEmbeddingModel(selectedModel);
    }
  }, [selectedModel]);

  // 处理搜索输入变化
  const handleSearchChange = (e) => {
    setSearchText(e.target.value);
  };

  // 处理提供商选择
  const handleProviderSelect = (provider) => {
    setSelectedProvider(provider === selectedProvider ? '' : provider);
  };

  // 获取嵌入模型维度
  const handleGetDimensions = async (modelId, e) => {
    e.stopPropagation();
    
    // 如果已经获取过维度，不再重复获取
    if (modelDimensions[modelId]) {
      return;
    }
    
    setLoadingDimensions(prev => ({ ...prev, [modelId]: true }));
    setDimensionErrors(prev => ({ ...prev, [modelId]: null }));
    
    try {
      const result = await invoke('get-embedding-dimensions', modelId);
      
      if (result.success) {
        setModelDimensions(prev => ({ ...prev, [modelId]: result.dimensions }));
      } else {
        setDimensionErrors(prev => ({ ...prev, [modelId]: result.error }));
      }
    } catch (error) {
      setDimensionErrors(prev => ({ ...prev, [modelId]: error.message }));
    } finally {
      setLoadingDimensions(prev => ({ ...prev, [modelId]: false }));
    }
  };

  // 渲染当前选择模型显示
  const renderCurrentSelection = () => {
    if (!showCurrentSelection) return null;
    
    const currentModel = localEmbeddingModel || selectedModel;
    const model = availableModels.find(m => m.id === currentModel);
    const displayName = model ? `${model.id} (${model.provider})` : (currentModel || '选择嵌入模型');
    
    return (
      <div className="embedding-current-selection">
        <div className="current-selection-label">当前嵌入模型:</div>
        <div className="current-selection-value">{displayName}</div>
      </div>
    );
  };

  return (
    <div className="embedding-model-selector-panel">
      {/* 当前选择显示 */}
      {renderCurrentSelection()}
      
      {/* 搜索和过滤区域 */}
      <div className="embedding-model-filter-section">
        <div className="embedding-search-container">
          <FontAwesomeIcon icon={faSearch} className="embedding-search-icon" />
          <input
            type="text"
            placeholder="搜索模型名称或提供商..."
            value={searchText}
            onChange={handleSearchChange}
            className="embedding-search-input"
          />
        </div>
        
        {/* 提供商筛选 */}
        <div className="embedding-provider-filter">
          <span className="embedding-filter-label">提供商：</span>
          <div className="embedding-provider-tags">
            {providers.map(provider => (
              <button
                key={provider}
                className={`embedding-provider-tag ${selectedProvider === provider ? 'active' : ''}`}
                onClick={() => handleProviderSelect(provider)}
              >
                {provider}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 模型列表 */}
      <div className="embedding-model-list-container">
        {filteredModels.length === 0 ? (
          <div className="embedding-empty-state">
            {searchText || selectedProvider ? '没有找到匹配的模型' : '暂无可用模型'}
          </div>
        ) : (
          <div className="embedding-model-grid">
            {filteredModels.map((model) => {
              const isEmbedding = isEmbeddingModel(model);
              const isLoading = loadingDimensions[model.id];
              const dimensions = modelDimensions[model.id];
              const error = dimensionErrors[model.id];
              
              return (
                <div
                  key={model.id}
                  className={`embedding-model-card ${localEmbeddingModel === model.id ? 'selected' : ''}`}
                  onClick={() => handleModelSelect(model.id)}
                >
                  <div className="embedding-model-info">
                    <div className="embedding-model-name">{model.id}</div>
                    <div className="embedding-model-provider">{model.provider}</div>
                    
                    {/* 嵌入维度信息 */}
                    {isEmbedding && (
                      <div className="embedding-dimensions-info">
                        {isLoading ? (
                          <div className="dimensions-loading">
                            <FontAwesomeIcon icon={faSync} spin />
                            <span>获取维度中...</span>
                          </div>
                        ) : dimensions ? (
                          <div className="dimensions-success">
                            <span className="dimensions-label">维度:</span>
                            <span className="dimensions-value">{dimensions}</span>
                          </div>
                        ) : error ? (
                          <div className="dimensions-error">
                            <FontAwesomeIcon icon={faExclamationTriangle} />
                            <span className="error-message">获取失败</span>
                          </div>
                        ) : (
                          <button
                            className="get-dimensions-button"
                            onClick={(e) => handleGetDimensions(model.id, e)}
                            title="自动获取嵌入维度"
                          >
                            <FontAwesomeIcon icon={faSync} />
                            <span>获取维度</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {localEmbeddingModel === model.id && (
                    <div className="selected-indicator">✓</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        
        {/* 搜索结果统计 */}
        {searchText && (
          <div className="embedding-search-results-info">
            找到 {filteredModels.length} 个匹配的模型
          </div>
        )}
      </div>
    </div>
  );
};

export default EmbeddingModelSelector;