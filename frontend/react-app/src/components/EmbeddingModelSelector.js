import React, { useState, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faSpinner } from '@fortawesome/free-solid-svg-icons';
import './EmbeddingModelSelector.css';

const EmbeddingModelSelector = ({
  selectedModel,
  availableModels,
  onModelChange,
  loading = false
}) => {
  const [searchText, setSearchText] = useState('');

  // 获取选中的模型信息
  const selectedModelInfo = useMemo(() => {
    return availableModels.find(model => model.id === selectedModel);
  }, [availableModels, selectedModel]);

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
    
    return filtered;
  }, [availableModels, searchText]);

  // 处理模型选择
  const handleModelSelect = (modelId) => {
    onModelChange(modelId);
  };

  // 处理搜索输入变化
  const handleSearchChange = (e) => {
    setSearchText(e.target.value);
  };

  return (
    <div className="embedding-model-selector-panel">
      {/* 搜索栏 */}
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

      {/* 当前选中模型显示 */}
      {selectedModelInfo && (
        <div className="embedding-selected-display">
          <div className="selected-model-info">
            <span className="selected-model-text">当前选中: {selectedModelInfo.id}</span>
            <span className="selected-model-provider">{selectedModelInfo.provider}</span>
          </div>
        </div>
      )}

      {/* 模型列表 - 始终显示 */}
      <div className="embedding-model-list-container">
        {loading ? (
          <div className="embedding-loading-state">
            <FontAwesomeIcon icon={faSpinner} spin />
            <span>正在加载模型列表...</span>
          </div>
        ) : filteredModels.length === 0 ? (
          <div className="embedding-empty-state">
            {searchText ? '没有找到匹配的模型' : '暂无可用嵌入模型'}
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
                  <div className="embedding-model-details">
                    <span className="embedding-model-provider">{model.provider}</span>
                    {model.name && model.name !== model.id && (
                      <span className="embedding-model-display-name">{model.name}</span>
                    )}
                  </div>
                </div>
                {selectedModel === model.id && (
                  <div className="selected-indicator">✓</div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 搜索结果统计 */}
        {searchText && !loading && (
          <div className="embedding-search-results-info">
            找到 {filteredModels.length} 个匹配的模型
          </div>
        )}
      </div>
    </div>
  );
};

export default EmbeddingModelSelector;