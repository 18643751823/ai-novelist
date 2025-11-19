import React, { useRef, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setActiveTab, closeTab, reorderTabs, enableSplitView, updateTabContent } from '../../store/slices/novelSlice';
import { tiptapLifecycleManager } from './services/TiptapLifecycleManager';
import SaveConfirmationModal from './SaveConfirmationModal';
import useHttpService from '../../hooks/useHttpService';
import './TabBar.css';

// 辅助函数：获取不带扩展名的显示名称
const getDisplayName = (fileName) => {
  if (!fileName) return '未命名';
  const lastDotIndex = fileName.lastIndexOf('.');
  return lastDotIndex !== -1 ? fileName.substring(0, lastDotIndex) : fileName;
};

function TabBar() {
  const dispatch = useDispatch();
  const { openTabs, activeTabId } = useSelector((state) => state.novel);
  const { writeFile } = useHttpService();
  const tabBarRef = useRef(null);
  const [draggedTab, setDraggedTab] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [pendingTabId, setPendingTabId] = useState(null);

  const handleTabClick = (tabId) => {
    dispatch(setActiveTab(tabId));
  };

  const handleCloseTab = (e, tabId) => {
    e.stopPropagation(); // 防止触发 handleTabClick
    
    const tab = openTabs.find(t => t.id === tabId);
    
    // 检查是否有未保存的更改
    if (tab && tab.isDirty) {
      // 显示保存确认弹窗
      setPendingTabId(tabId);
      setShowSaveConfirm(true);
    } else {
      // 直接关闭标签页
      closeTabInternal(tabId);
    }
  };

  const closeTabInternal = (tabId) => {
    // 在关闭标签页前注销编辑器实例
    tiptapLifecycleManager.unregisterEditor(tabId);
    dispatch(closeTab(tabId));
  };

  const handleSaveConfirm = async () => {
    if (pendingTabId) {
      const tab = openTabs.find(t => t.id === pendingTabId);
      if (tab) {
        try {
          // 调用保存文件API
          const result = await writeFile(tab.id, tab.content);
          if (result.success) {
            // 保存成功后标记为已保存
            dispatch(updateTabContent({
              tabId: pendingTabId,
              content: tab.content,
              isDirty: false
            }));
          } else {
            console.error('保存文件失败:', result.error);
            // 可以在这里添加错误处理，比如显示错误提示
          }
        } catch (error) {
          console.error('保存文件时发生错误:', error);
          // 可以在这里添加错误处理
        }
      }
      // 关闭标签页
      closeTabInternal(pendingTabId);
    }
    setShowSaveConfirm(false);
    setPendingTabId(null);
  };

  const handleDiscardConfirm = () => {
    if (pendingTabId) {
      // 直接关闭标签页，丢弃更改
      closeTabInternal(pendingTabId);
    }
    setShowSaveConfirm(false);
    setPendingTabId(null);
  };

  const handleCancelConfirm = () => {
    setShowSaveConfirm(false);
    setPendingTabId(null);
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
    <>
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
            <span className="tab-title">{getDisplayName(tab.title)}</span>
            {tab.isDeleted && <span className="deleted-indicator">🗑️</span>}
            <button
              className={`close-tab-button ${tab.isDirty ? 'dirty-dot' : ''}`}
              onClick={(e) => handleCloseTab(e, tab.id)}
            >
              {tab.isDirty ? '•' : '×'}
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
      
      {/* 保存确认弹窗 */}
      {showSaveConfirm && (
        <SaveConfirmationModal
          message="文件有未保存的更改，是否保存？"
          onSave={handleSaveConfirm}
          onDiscard={handleDiscardConfirm}
          onCancel={handleCancelConfirm}
        />
      )}
    </>
  );
}

export default TabBar;
