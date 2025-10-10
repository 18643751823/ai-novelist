import React, { useState, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch } from '@fortawesome/free-solid-svg-icons';
import './EmbeddingModelSelector.css';

const EmbeddingModelSelector = ({
  selectedModel,
  availableModels,
  onModelChange,
  onClose
}) => {
  const [searchText, setSearchText] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('');

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
            {filteredModels.map((model) => (
              <div
                key={model.id}
                className={`embedding-model-card ${selectedModel === model.id ? 'selected' : ''}`}
                onClick={() => handleModelSelect(model.id)}
              >
                <div className="embedding-model-info">
                  <div className="embedding-model-name">{model.id}</div>
                  <div className="embedding-model-provider">{model.provider}</div>
                </div>
                {selectedModel === model.id && (
                  <div className="selected-indicator">✓</div>
                )}
              </div>
            ))}
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