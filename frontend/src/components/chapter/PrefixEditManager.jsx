import React from 'react';
import chapterService from '../../services/chapterService';

/**
 * 前缀编辑管理模块
 * 处理章节前缀的编辑、确认、取消操作
 */
const PrefixEditManager = ({
  editingPrefix,
  chapters,
  onPrefixEdit,
  onPrefixEditConfirm,
  onPrefixEditCancel,
  getSiblingItems,
  setNotificationMessage,
  setShowNotificationModal,
  fetchChapters
}) => {

  /**
   * 处理前缀编辑确认
   */
  const handlePrefixEditConfirm = async () => {
    if (!editingPrefix.itemId || !editingPrefix.prefix) {
      onPrefixEditCancel();
      return;
    }

    try {
      const newPosition = parseInt(editingPrefix.prefix, 10);
      if (isNaN(newPosition) || newPosition < 1) {
        setNotificationMessage('请输入有效的数字！');
        setShowNotificationModal(true);
        return;
      }

      // 获取当前目录的所有项目
      const currentItems = getSiblingItems(chapters, editingPrefix.currentPath);
      if (!currentItems || currentItems.length === 0) {
        console.error('无法获取当前目录的项目');
        return;
      }

      // 找到要移动的项目
      const targetItem = currentItems.find(item => item.id === editingPrefix.itemId);
      if (!targetItem) {
        console.error('未找到要移动的项目');
        return;
      }

      // 创建新的排序顺序
      const newOrder = [...currentItems];
      const currentIndex = newOrder.findIndex(item => item.id === editingPrefix.itemId);
      
      if (currentIndex === -1) {
        console.error('项目不在当前列表中');
        return;
      }

      // 分离文件和文件夹
      const files = currentItems.filter(item => !item.isFolder);
      const folders = currentItems.filter(item => item.isFolder);
      
      let newFileIds = [...files.map(item => item.id)];
      let newFolderIds = [...folders.map(item => item.id)];

      // 根据项目类型和用户输入的位置重新计算实际位置
      if (targetItem.isFolder) {
        // 处理文件夹排序
        const currentFolderIndex = newFolderIds.indexOf(targetItem.id);
        if (currentFolderIndex !== -1) {
          // 从原位置移除
          newFolderIds.splice(currentFolderIndex, 1);
          // 插入到新位置（文件夹从1开始编号）
          const newFolderIndex = Math.min(Math.max(newPosition - 1, 0), newFolderIds.length);
          newFolderIds.splice(newFolderIndex, 0, targetItem.id);
        }
      } else {
        // 处理文件排序
        const currentFileIndex = newFileIds.indexOf(targetItem.id);
        if (currentFileIndex !== -1) {
          // 从原位置移除
          newFileIds.splice(currentFileIndex, 1);
          // 插入到新位置（文件从1开始编号，独立于文件夹）
          const newFileIndex = Math.min(Math.max(newPosition - 1, 0), newFileIds.length);
          newFileIds.splice(newFileIndex, 0, targetItem.id);
        }
      }

      // 调用后端API更新排序顺序
      let result;
      if (targetItem.isFolder) {
        // 如果是文件夹，更新文件夹顺序
        result = await chapterService.updateFolderOrder(
          editingPrefix.currentPath || '',
          newFolderIds
        );
      } else {
        // 如果是文件，更新文件顺序
        result = await chapterService.updateFileOrder(
          editingPrefix.currentPath || '',
          newFileIds
        );
      }

      if (result.success) {
        setNotificationMessage(result.message || '排序顺序更新成功！');
        setShowNotificationModal(true);
        fetchChapters(); // 刷新章节列表
      } else {
        setNotificationMessage(`排序顺序更新失败: ${result.error}`);
        setShowNotificationModal(true);
      }
    } catch (error) {
      console.error('排序顺序更改失败:', error);
      setNotificationMessage('排序顺序更改失败！');
      setShowNotificationModal(true);
    } finally {
      onPrefixEditCancel();
    }
  };

  /**
   * 渲染前缀编辑界面
   */
  const renderPrefixEdit = (item, displayPrefix, currentPath) => {
    if (editingPrefix.itemId === item.id) {
      return (
        <div className="prefix-edit-container">
          <input
            type="text"
            value={editingPrefix.prefix}
            onChange={(e) => onPrefixEdit(item.id, e.target.value, item.isFolder, currentPath)}
            className="prefix-edit-input"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handlePrefixEditConfirm();
              } else if (e.key === 'Escape') {
                onPrefixEditCancel();
              }
            }}
            autoFocus
          />
          <button onClick={handlePrefixEditConfirm} className="prefix-edit-confirm">
            ✓
          </button>
          <button onClick={onPrefixEditCancel} className="prefix-edit-cancel">
            ✕
          </button>
        </div>
      );
    } else {
      return (
        <span
          className="prefix-display clickable"
          onClick={() => onPrefixEdit(item.id, displayPrefix, item.isFolder, currentPath)}
          title="点击编辑前缀"
        >
          {displayPrefix}
        </span>
      );
    }
  };

  return {
    handlePrefixEditConfirm,
    renderPrefixEdit
  };
};

export default PrefixEditManager;