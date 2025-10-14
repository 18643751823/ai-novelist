import React, { useState, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faSync, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import useIpcRenderer from '../../hooks/useIpcRenderer';
import './EmbeddingModelSelector.css';

const EmbeddingModelSelector = ({
  selectedModel,
  availableModels,
  onModelChange,
  onClose
}) => {
  const [searchText, setSearchText] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('');
  const [loadingDimensions, setLoadingDimensions] = useState({});
  const [modelDimensions, setModelDimensions] = useState({});
  const [dimensionErrors, setDimensionErrors] = useState({});
  const { invoke } = useIpcRenderer();

  // 获取所有提供商列表
  const providers = useMemo(() => {
    const uniqueProviders = [...new Set(availableModels.map(model => model.provider))];
    return uniqueProviders.sort();
  }, [availableModels]);

  // 过滤模型
  const filteredModels = useMemo(() => {
    let filtered = availableModels;
    
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
  }, [availableModels, searchText, selectedProvider]);

  // 处理模型选择
  const handleModelSelect = (modelId) => {
    onModelChange(modelId);
  };

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

  // 检查是否为嵌入模型
  const isEmbeddingModel = (model) => {
    const modelLower = model.id.toLowerCase();
    return modelLower.includes('embedding') ||
           modelLower.includes('embed') ||
           modelLower.includes('bge') ||
           modelLower.includes('multilingual-e5') ||
           model.isEmbedding;
  };

  return (
    <div className="embedding-model-selector-panel">
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
                  className={`embedding-model-card ${selectedModel === model.id ? 'selected' : ''}`}
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
                  {selectedModel === model.id && (
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