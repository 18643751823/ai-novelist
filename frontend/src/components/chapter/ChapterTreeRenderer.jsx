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
    const isCollapsed = collapsedChapters[item.id];
    const hasChildren = item.children && item.children.length > 0;
    const displayName = getDisplayName(item.title, item.isFolder);
    const displayPrefix = getDisplayPrefix(item);

    return (
      <li
        key={item.id}
        className={`chapter-list-item ${item.isFolder ? 'folder-item' : 'file-item'} level-${level}`}
      >
        <div
          className={`chapter-item-content ${item.isFolder && level > 0 ? 'nested-folder-content' : ''}`}
          style={{ paddingLeft: `${0 + level * 20}px` }}
          onContextMenu={(e) => {
            e.stopPropagation();
            handleContextMenu(e, item.id, item.isFolder, item.title, 
              item.isFolder ? item.id : (item.id.includes('/') ? item.id.substring(0, item.id.lastIndexOf('/')) : ''));
          }}
        >
          {item.isFolder && (
            <span onClick={() => handleChapterClick(item)} className="collapse-icon">
              <FontAwesomeIcon icon={isCollapsed ? faCaretRight : faCaretDown} />
            </span>
          )}
          
          {/* 文件/文件夹图标 */}
          <FontAwesomeIcon icon={item.isFolder ? faFolder : faFile} className="item-icon" />

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
        
        {item.isFolder && hasChildren && !isCollapsed && (
          <ChapterTreeRenderer
            items={item.children}
            collapsedChapters={collapsedChapters}
            getDisplayName={getDisplayName}
            getDisplayPrefix={getDisplayPrefix}
            handleChapterClick={handleChapterClick}
            handleContextMenu={handleContextMenu}
            renderPrefixEdit={renderPrefixEdit}
            level={level + 1}
            currentPath={item.id}
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