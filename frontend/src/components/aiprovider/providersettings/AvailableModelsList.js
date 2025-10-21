import React, { useState } from 'react';

const AvailableModelsList = ({ models, currentProvider }) => {
  const [showAll, setShowAll] = useState(false);
  const [searchText, setSearchText] = useState('');
  
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
            <div className="model-name">{model.id}</div>
            <div className="model-provider">{model.provider}</div>
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