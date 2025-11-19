import React from 'react';

const ProviderList = ({ 
  providers, 
  searchText, 
  onSearchChange, 
  selectedProvider,
  onProviderSelect,
  onAddProvider 
}) => {
  // 过滤提供商列表
  const filteredProviders = providers.filter(provider =>
    provider.name.toLowerCase().includes(searchText.toLowerCase())
  );

  return (
    <div className="provider-list-container">
      <div className="provider-list-header">
        <h3>AI提供商</h3>
        <div className="search-container">
          <input
            type="text"
            placeholder="搜索提供商..."
            value={searchText}
            onChange={(e) => onSearchChange(e.target.value)}
            className="provider-search"
          />
        </div>
      </div>
      
      <div className="provider-list">
        {filteredProviders.map(provider => (
          <div
            key={provider.id}
            className={`provider-item ${selectedProvider === provider.id ? 'active' : ''}`}
            onClick={() => onProviderSelect(provider.id)}
          >
            <div className="provider-info">
              <div className="provider-name">{provider.name}</div>
              <div className="provider-type">
                {provider.type === 'builtin' ? '内置' : '自定义'}
              </div>
            </div>
            <div className={`provider-status ${provider.enabled ? 'enabled' : 'disabled'}`}>
              {provider.enabled ? '启用' : '禁用'}
            </div>
          </div>
        ))}
      </div>

      <div className="provider-list-actions">
        <button
          className="add-provider-btn"
          onClick={onAddProvider}
        >
          + 添加自定义提供商
        </button>
      </div>
    </div>
  );
};

export default ProviderList;