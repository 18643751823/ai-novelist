import React, { useState, useMemo, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faSyncAlt } from '@fortawesome/free-solid-svg-icons';
import modelSelectionService from '../../../services/modelSelectionService';
import './ModelSelectorPanel.css';

const ModelSelectorPanel = ({ onModelChange, onClose }) => {
  // 本地状态管理 - 不再使用Redux
  const [availableModels, setAvailableModels] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // 加载模型列表
  const loadAvailableModels = async () => {
    try {
      setLoading(true);
      const result = await modelSelectionService.getAvailableModels();
      
      if (result.success) {
        setAvailableModels(result.models);
        console.log('ModelSelectorPanel: 从后端获取到模型数据:', {
          availableModelsCount: result.models.length,
          availableModels: result.models
        });
      } else {
        console.error('获取模型列表失败:', result.error);
      }
    } catch (error) {
      console.error('加载模型列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 刷新模型列表
  const handleRefreshModels = async () => {
    try {
      setRefreshing(true);
      const result = await modelSelectionService.refreshModels();
      
      if (result.success) {
        // 刷新成功后重新加载模型列表
        await loadAvailableModels();
      } else {
        console.error('刷新模型列表失败:', result.error);
      }
    } catch (error) {
      console.error('刷新模型列表失败:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // 处理模型选择
  const handleModelSelect = async (modelId) => {
    try {
      // 找到选中的模型信息
      const selectedModelInfo = availableModels.find(model => model.id === modelId);
      const provider = selectedModelInfo?.provider || '';
      
      // 保存选中的模型到后端
      const result = await modelSelectionService.setSelectedModel(modelId, provider);
      
      if (result.success) {
        console.log(`模型选择已保存: ${modelId}`);
        // 通知父组件模型已更改
        onModelChange(modelId);
      } else {
        console.error('保存模型选择失败:', result.error);
      }
    } catch (error) {
      console.error('处理模型选择失败:', error);
    }
  };

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

  // 处理搜索输入变化
  const handleSearchChange = (e) => {
    setSearchText(e.target.value);
  };

  // 处理提供商选择
  const handleProviderSelect = (provider) => {
    setSelectedProvider(provider === selectedProvider ? '' : provider);
  };

  // 组件挂载时加载模型列表
  useEffect(() => {
    loadAvailableModels();
  }, []);

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
          <button
            className={`refresh-button ${refreshing ? 'refreshing' : ''}`}
            onClick={handleRefreshModels}
            title="刷新模型列表"
            disabled={refreshing}
          >
            <FontAwesomeIcon icon={faSyncAlt} spin={refreshing} />
          </button>
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
        {loading ? (
          <div className="loading-state">
            正在加载模型列表...
          </div>
        ) : filteredModels.length === 0 ? (
          <div className="empty-state">
            {searchText || selectedProvider ? '没有找到匹配的模型' : '暂无可用模型'}
          </div>
        ) : (
          <div className="model-grid">
            {filteredModels.map((model) => (
              <div
                key={model.id}
                className="model-card"
                onClick={() => handleModelSelect(model.id)}
              >
                <div className="model-info">
                  <div className="model-name">{model.id}</div>
                  <div className="model-provider">{model.provider}</div>
                </div>
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
