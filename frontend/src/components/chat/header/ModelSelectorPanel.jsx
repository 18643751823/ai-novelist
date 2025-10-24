import React, { useState, useMemo, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch } from '@fortawesome/free-solid-svg-icons';
import { setAvailableModels, setSelectedModel } from '../../../store/slices/chatSlice';
import useIpcRenderer from '../../../hooks/useIpcRenderer';
import './ModelSelectorPanel.css';

const ModelSelectorPanel = ({ selectedModel, availableModels, onModelChange, onClose }) => {
  const dispatch = useDispatch();
  const { listAllModels } = useIpcRenderer();
  const [searchText, setSearchText] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('');

  // 新增：专门处理模型列表加载，确保模型选择器能正确显示
  useEffect(() => {
    const loadModelsOnStartup = async () => {
      try {
        console.log('ModelSelectorPanel: 启动时加载模型列表...');
        const modelsResult = await listAllModels();
        console.log('ModelSelectorPanel: 模型列表加载结果:', modelsResult.success, modelsResult.models ? modelsResult.models.length : 'N/A');
        
        if (modelsResult.success) {
          dispatch(setAvailableModels(modelsResult.models));
          console.log('ModelSelectorPanel: 模型列表已更新，数量:', modelsResult.models.length);
          
          // 如果没有选中模型，尝试设置一个默认模型
          if (!selectedModel && modelsResult.models.length > 0) {
            const defaultModel = modelsResult.models[0];
            dispatch(setSelectedModel(defaultModel.id));
            console.log('ModelSelectorPanel: 设置默认模型:', defaultModel.id);
          }
        } else {
          console.error('ModelSelectorPanel: 模型列表加载失败:', modelsResult.error);
        }
      } catch (error) {
        console.error('ModelSelectorPanel: 加载模型列表异常:', error);
      }
    };

    // 延迟加载模型列表，确保其他初始化完成
    const timer = setTimeout(() => {
      loadModelsOnStartup();
    }, 1000);

    return () => clearTimeout(timer);
  }, [listAllModels, dispatch, selectedModel]);

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
    <div className="model-selector-panel">
      {/* 搜索和过滤区域 */}
      <div className="model-filter-section">
        <div className="search-container">
          <FontAwesomeIcon icon={faSearch} className="search-icon" />
          <input
            type="text"
            placeholder="搜索模型名称或提供商..."
            value={searchText}
            onChange={handleSearchChange}
            className="search-input"
          />
        </div>
        
        {/* 提供商筛选 */}
        <div className="provider-filter">
          <span className="filter-label">提供商：</span>
          <div className="provider-tags">
            {providers.map(provider => (
              <button
                key={provider}
                className={`provider-tag ${selectedProvider === provider ? 'active' : ''}`}
                onClick={() => handleProviderSelect(provider)}
              >
                {provider}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 模型列表 */}
      <div className="model-list-container">
        {filteredModels.length === 0 ? (
          <div className="empty-state">
            {searchText || selectedProvider ? '没有找到匹配的模型' : '暂无可用模型'}
          </div>
        ) : (
          <div className="model-grid">
            {filteredModels.map((model) => (
              <div
                key={model.id}
                className={`model-card ${selectedModel === model.id ? 'selected' : ''}`}
                onClick={() => handleModelSelect(model.id)}
              >
                <div className="model-info">
                  <div className="model-name">{model.id}</div>
                  <div className="model-provider">{model.provider}</div>
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
          <div className="search-results-info">
            找到 {filteredModels.length} 个匹配的模型
          </div>
        )}
      </div>
    </div>
  );
};

export default ModelSelectorPanel;