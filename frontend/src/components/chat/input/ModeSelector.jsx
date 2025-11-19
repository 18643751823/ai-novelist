import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faAngleLeft, faAngleRight } from '@fortawesome/free-solid-svg-icons';
import './ModeSelector.css';

// 模式选择器组件
const ModeSelector = ({ 
  currentMode, 
  customModes = [], 
  onModeChange, 
  setStoreValue 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(0);
  const modesPerPage = 5;

  // 内置模式定义
  const builtInModes = [
    { id: 'outline', name: '细纲', type: 'builtin' },
    { id: 'writing', name: '写作', type: 'builtin' },
    { id: 'adjustment', name: '调整', type: 'builtin' }
  ];

  // 获取所有模式（内置 + 自定义）
  const allModes = [
    ...builtInModes,
    ...(Array.isArray(customModes) ? customModes.map(mode => ({
      id: mode.id,
      name: mode.name,
      type: 'custom'
    })) : [])
  ];

  // 过滤模式
  const filteredModes = allModes.filter(mode =>
    mode.name.toLowerCase().includes(searchText.toLowerCase())
  );

  // 分页模式
  const startIndex = page * modesPerPage;
  const paginatedModes = filteredModes.slice(startIndex, startIndex + modesPerPage);
  const totalPages = Math.ceil(filteredModes.length / modesPerPage);

  // 获取当前选中模式的显示名称
  const getDisplayModeName = () => {
    if (!currentMode) return '选择模式';
    const mode = allModes.find(m => m.id === currentMode);
    return mode ? `${mode.name}模式` : '选择模式';
  };

  const handleModeSelect = async (modeId) => {
    onModeChange(modeId);
    
    // 保存到持久化存储
    if (setStoreValue) {
      try {
        await setStoreValue('currentMode', modeId);
        console.log(`[模式选择器] 已保存模式选择: ${modeId}`);
      } catch (error) {
        console.error('[模式选择器] 保存模式选择失败:', error);
      }
    }
    
    setIsExpanded(false);
    setSearchText('');
    setPage(0);
  };

  // 处理搜索框点击事件，阻止事件冒泡
  const handleSearchClick = (e) => {
    e.stopPropagation();
  };

  // 处理搜索框输入变化
  const handleSearchChange = (e) => {
    setSearchText(e.target.value);
    setPage(0);
  };

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (isExpanded && !e.target.closest('.mode-selector-container')) {
        setIsExpanded(false);
        setSearchText('');
        setPage(0);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExpanded]);

  return (
    <div className="mode-selector-container">
      <div
        className="mode-selector-bar"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? (
          <input
            type="text"
            placeholder="搜索模式..."
            value={searchText}
            onChange={handleSearchChange}
            onClick={handleSearchClick}
            className="mode-search-input-bar"
            autoFocus
          />
        ) : (
          <span className="selected-mode-name">{getDisplayModeName()}</span>
        )}
        <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
      </div>

      {isExpanded && (
        <div className="mode-selector-dropdown">
          {/* 模式列表 */}
          <div className="mode-list">
            {paginatedModes.map((mode) => (
              <div
                key={mode.id}
                className={`mode-item ${currentMode === mode.id ? 'selected' : ''}`}
                onClick={() => handleModeSelect(mode.id)}
              >
                <div className="mode-name">{mode.name}</div>
                <div className="mode-type">
                  {mode.type === 'custom' ? '自定义模式' : '内置模式'}
                </div>
              </div>
            ))}
          </div>

          {/* 分页控制 */}
          {totalPages > 1 && (
            <div className="mode-pagination">
              <button
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
                className="pagination-btn"
              >
                <FontAwesomeIcon icon={faAngleLeft} />
              </button>
              <span className="page-info">
                {page + 1} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage(page + 1)}
                className="pagination-btn"
              >
                <FontAwesomeIcon icon={faAngleRight} />
              </button>
            </div>
          )}

          {/* 搜索结果统计 */}
          {searchText && (
            <div className="search-results-info">
              找到 {filteredModes.length} 个匹配的模式
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ModeSelector;