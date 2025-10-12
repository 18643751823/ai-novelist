import React, { useRef, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setActiveTab, closeTab, reorderTabs, enableSplitView } from '../../store/slices/novelSlice';
import './TabBar.css';

function TabBar() {
  const dispatch = useDispatch();
  const { openTabs, activeTabId } = useSelector((state) => state.novel);
  const tabBarRef = useRef(null);
  const [draggedTab, setDraggedTab] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const handleTabClick = (tabId) => {
    dispatch(setActiveTab(tabId));
  };

  const handleCloseTab = (e, tabId) => {
    e.stopPropagation(); // 防止触发 handleTabClick
    dispatch(closeTab(tabId));
  };

  const handleSplitView = () => {
    if (openTabs.length < 2) {
      alert('需要至少打开两个文件才能使用分屏对比功能');
      return;
    }
    
    // 获取当前激活的标签页和另一个标签页
    const activeTabIndex = openTabs.findIndex(tab => tab.id === activeTabId);
    const otherTabIndex = activeTabIndex === 0 ? 1 : 0;
    
    dispatch(enableSplitView({
      leftTabId: openTabs[otherTabIndex].id,
      rightTabId: openTabs[activeTabIndex].id,
      layout: 'horizontal'
    }));
  };

  // 拖动开始
  const handleDragStart = (e, tabId, index) => {
    setDraggedTab({ id: tabId, index });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', tabId);
    
    // 添加拖动时的视觉反馈
    e.currentTarget.classList.add('dragging');
  };

  // 拖动结束
  const handleDragEnd = (e) => {
    setDraggedTab(null);
    setDragOverIndex(null);
    
    // 移除所有拖动相关的样式
    const tabItems = document.querySelectorAll('.tab-item');
    tabItems.forEach(tab => {
      tab.classList.remove('dragging', 'drag-over-left', 'drag-over-right');
    });
  };

  // 拖动经过
  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    if (draggedTab && draggedTab.index !== index) {
      setDragOverIndex(index);
      
      // 添加拖动指示器样式
      const tabItems = document.querySelectorAll('.tab-item');
      tabItems.forEach(tab => tab.classList.remove('drag-over-left', 'drag-over-right'));
      
      const rect = e.currentTarget.getBoundingClientRect();
      const mouseX = e.clientX;
      const centerX = rect.left + rect.width / 2;
      
      if (mouseX < centerX) {
        e.currentTarget.classList.add('drag-over-left');
      } else {
        e.currentTarget.classList.add('drag-over-right');
      }
    }
  };

  // 放置
  const handleDrop = (e, toIndex) => {
    e.preventDefault();
    
    if (draggedTab && draggedTab.index !== toIndex) {
      // 计算最终放置位置
      const rect = e.currentTarget.getBoundingClientRect();
      const mouseX = e.clientX;
      const centerX = rect.left + rect.width / 2;
      
      let finalToIndex = toIndex;
      if (mouseX < centerX && draggedTab.index > toIndex) {
        // 放在左侧
        finalToIndex = toIndex;
      } else if (mouseX >= centerX && draggedTab.index < toIndex) {
        // 放在右侧
        finalToIndex = toIndex + 1;
      } else if (draggedTab.index < toIndex) {
        finalToIndex = toIndex;
      } else {
        finalToIndex = toIndex;
      }
      
      dispatch(reorderTabs({
        fromIndex: draggedTab.index,
        toIndex: finalToIndex
      }));
    }
    
    setDraggedTab(null);
    setDragOverIndex(null);
    
    // 移除所有拖动相关的样式
    const tabItems = document.querySelectorAll('.tab-item');
    tabItems.forEach(tab => {
      tab.classList.remove('dragging', 'drag-over-left', 'drag-over-right');
    });
  };

  // 拖动离开
  const handleDragLeave = (e) => {
    e.currentTarget.classList.remove('drag-over-left', 'drag-over-right');
  };

  if (openTabs.length === 0) {
    return null; // 如果没有打开的标签页，则不渲染任何内容
  }

  return (
    <div className="tab-bar" ref={tabBarRef}>
      {openTabs.map((tab, index) => (
        <div
          key={tab.id}
          className={`tab-item ${tab.id === activeTabId ? 'active' : ''} ${tab.isDeleted ? 'deleted' : ''}`}
          onClick={() => handleTabClick(tab.id)}
          draggable
          onDragStart={(e) => handleDragStart(e, tab.id, index)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => handleDragOver(e, index)}
          onDrop={(e) => handleDrop(e, index)}
          onDragLeave={handleDragLeave}
        >
          <span className="tab-title">{tab.title}</span>
          {tab.isDirty && <span className="dirty-indicator">*</span>}
          {tab.isDeleted && <span className="deleted-indicator">🗑️</span>}
          <button
            className="close-tab-button"
            onClick={(e) => handleCloseTab(e, tab.id)}
          >
            &times;
          </button>
        </div>
      ))}
      
      {/* 分屏对比按钮 */}
      {openTabs.length >= 2 && (
        <div className="tab-actions">
          <button
            className="split-view-toggle"
            onClick={handleSplitView}
            title="分屏对比"
          >
            ⇄
          </button>
        </div>
      )}
    </div>
  );
}

export default TabBar;