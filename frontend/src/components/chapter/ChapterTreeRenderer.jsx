import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretRight, faCaretDown, faFolder, faFile } from '@fortawesome/free-solid-svg-icons';

/**
 * 章节树渲染模块
 * 负责递归渲染章节树结构
 */
const ChapterTreeRenderer = ({
  items,
  collapsedChapters,
  getDisplayName,
  getDisplayPrefix,
  handleChapterClick,
  handleContextMenu,
  renderPrefixEdit,
  level = 0,
  currentPath = ''
}) => {

  /**
   * 渲染单个章节项
   */
  const renderChapterItem = (item) => {
    const itemId = item.id || item.path || '';
    const itemTitle = item.title || item.name || '';
    const isFolder = item.isFolder || item.type === 'folder';
    const hasChildren = item.children && item.children.length > 0;
    const displayName = getDisplayName(itemTitle, isFolder);
    const displayPrefix = getDisplayPrefix(item);

    return (
      <li
        key={itemId}
        className={`chapter-list-item ${isFolder ? 'folder-item' : 'file-item'} level-${level}`}
      >
        <div
          className={`chapter-item-content ${isFolder && level > 0 ? 'nested-folder-content' : ''}`}
          style={{ paddingLeft: `${0 + level * 20}px` }}
          onContextMenu={(e) => {
            e.stopPropagation();
            const parentPath = isFolder ? itemId : (itemId.includes('/') ? itemId.substring(0, itemId.lastIndexOf('/')) : '');
            
            handleContextMenu(e, itemId, isFolder, itemTitle, parentPath);
          }}
        >
          {isFolder && (
            <span onClick={() => handleChapterClick(item)} className="collapse-icon">
              <FontAwesomeIcon icon={collapsedChapters[itemId] ? faCaretRight : faCaretDown} />
            </span>
          )}
          
          {/* 文件/文件夹图标 */}
          <FontAwesomeIcon icon={isFolder ? faFolder : faFile} className="item-icon" />

          {/* 前缀显示/编辑区域 */}
          <div className="prefix-section">
            {renderPrefixEdit(item, displayPrefix, currentPath)}
          </div>

          <button
            onClick={() => handleChapterClick(item)}
            className="chapter-title-button"
          >
            {displayName}
          </button>
        </div>
        
        {isFolder && hasChildren && !collapsedChapters[itemId] && (
          <ChapterTreeRenderer
            items={item.children}
            collapsedChapters={collapsedChapters}
            getDisplayName={getDisplayName}
            getDisplayPrefix={getDisplayPrefix}
            handleChapterClick={handleChapterClick}
            handleContextMenu={handleContextMenu}
            renderPrefixEdit={renderPrefixEdit}
            level={level + 1}
            currentPath={itemId}
          />
        )}
      </li>
    );
  };


  // 使用后端排序
  const sortedItems = items;

  return (
    <ul className="chapter-list">
      {sortedItems.map(item => renderChapterItem(item))}
    </ul>
  );
};

export default ChapterTreeRenderer;
