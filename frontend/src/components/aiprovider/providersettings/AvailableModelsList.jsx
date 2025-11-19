import React, { useState } from 'react';
import providerConfigService from '../../../services/providerConfigService';

const AvailableModelsList = ({ models, currentProvider, providerApiKey }) => {
  const [showAll, setShowAll] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [addingModels, setAddingModels] = useState(new Set()); // 跟踪正在添加的模型
  
  // 过滤模型：只显示当前提供商的模型
  const filteredModels = models.filter(model => {
    // 首先按提供商过滤
    const isCurrentProvider = model.provider === currentProvider;
    if (!isCurrentProvider) return false;
    
    // 然后按搜索文本过滤
    return model.id.toLowerCase().includes(searchText.toLowerCase()) ||
           model.provider.toLowerCase().includes(searchText.toLowerCase());
  });
  
  // 显示模型数量控制
  const displayModels = showAll ? filteredModels : filteredModels.slice(0, 10);
  
  // 处理添加模型到配置
  const handleAddModel = async (model) => {
    // 如果正在添加这个模型，则不执行任何操作
    if (addingModels.has(model.id)) {
      return;
    }
    
    // 将模型ID添加到正在添加的集合中
    setAddingModels(prev => new Set(prev).add(model.id));
    
    try {
      // 调用后端API将模型添加到配置
      const result = await providerConfigService.addModelToConfig(
        currentProvider,
        model.id,
        providerApiKey
      );
      
      if (result.success) {
        // 可以在这里添加成功提示
        alert(`模型 ${model.id} 已成功添加到配置中`);
      } else {
        // 显示更友好的错误信息
        if (result.error.includes('已存在于配置中')) {
          alert(`模型 ${model.id} 已经存在于配置中，无需重复添加`);
        } else {
          alert(`添加模型失败: ${result.error}`);
        }
      }
    } catch (error) {
      console.error('添加模型时出错:', error);
      alert(`添加模型时出错: ${error.message}`);
    } finally {
      // 从正在添加的集合中移除模型ID
      setAddingModels(prev => {
        const newSet = new Set(prev);
        newSet.delete(model.id);
        return newSet;
      });
    }
  };
  
  return (
    <div className="available-models-list">
      {/* 搜索框 */}
      <div className="models-search-container">
        <input
          type="text"
          placeholder={`搜索${currentProvider}模型...`}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="models-search-input"
        />
      </div>
      
      {/* 模型列表 */}
      <div className="models-grid">
        {displayModels.map((model) => (
          <div key={model.id} className="model-item">
            <div className="model-info">
              <div className="model-name">{model.id}</div>
              <div className="model-provider">{model.provider}</div>
            </div>
            <button
              className={`add-model-btn ${addingModels.has(model.id) ? 'adding' : ''}`}
              onClick={() => handleAddModel(model)}
              disabled={addingModels.has(model.id)}
            >
              {addingModels.has(model.id) ? '添加中...' : '添加'}
            </button>
          </div>
        ))}
      </div>
      
      {/* 展开/收起按钮 */}
      {filteredModels.length > 3 && (
        <div className="models-expand-section">
          <button
            className="expand-models-btn"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? '收起' : `展开更多 (${filteredModels.length - 3}个)`}
          </button>
        </div>
      )}
      
      {/* 搜索结果统计 */}
      {searchText && (
        <div className="search-results-info">
          找到 {filteredModels.length} 个匹配的模型
        </div>
      )}
    </div>
  );
};

export default AvailableModelsList;