import React, { useCallback } from 'react';
import ContextMenu from '../others/ContextMenu';

/**
 * 右键菜单管理模块
 * 负责管理章节树中的右键菜单显示和菜单项构建
 */
const ContextMenuManager = ({
  contextMenu,
  copiedItem,
  cutItem,
  onCloseContextMenu,
  onNewFile,
  onNewFolder,
  onCopy,
  onPaste,
  onRenameItem,
  onDeleteItem
}) => {

  /**
   * 构建右键菜单项列表
   */
  const getContextMenuItems = useCallback(() => {
    const items = [];
    const isItemSelected = contextMenu.itemId !== null && 
                          contextMenu.itemId !== undefined && 
                          contextMenu.itemId !== '';
    const canPaste = copiedItem || cutItem;

    // 根据右键点击的对象类型构建菜单项
    if (isItemSelected) {
      // 右键点击了文件或文件夹
      const isFolder = contextMenu.isFolder;
      const targetPath = isFolder ? contextMenu.itemId : contextMenu.itemParentPath;

      items.push(
        { label: '复制', onClick: () => onCopy(contextMenu.itemId, false) },
        { label: '剪切', onClick: () => onCopy(contextMenu.itemId, true) },
        { label: '重命名', onClick: () => onRenameItem({ 
          id: contextMenu.itemId, 
          title: contextMenu.itemTitle 
        }) },
        { label: '删除', onClick: () => onDeleteItem(contextMenu.itemId) }
      );

      if (isFolder && canPaste) {
        // 右键点击文件夹，且有复制/剪切内容时显示粘贴
        items.push({ label: '粘贴', onClick: () => onPaste(contextMenu.itemId) });
      }
      
      if (isFolder) {
        // 右键点击文件夹，显示新建文件和新建文件夹
        items.push(
          { label: '新建文件', onClick: () => onNewFile(contextMenu.itemId) },
          { label: '新建文件夹', onClick: () => onNewFolder(contextMenu.itemId) }
        );
      }
    } else {
      // 右键点击空白处 (contextMenu.itemId 为 null 或 undefined)
      items.push(
        { label: '新建文件', onClick: () => onNewFile('') }, // 新建到根目录
        { label: '新建文件夹', onClick: () => onNewFolder('') } // 新建到根目录
      );
      if (canPaste) {
        // 空白处有复制/剪切内容时显示粘贴到根目录
        items.push({ label: '粘贴', onClick: () => onPaste('') });
      }
    }

    return items;
  }, [
    contextMenu, 
    copiedItem, 
    cutItem, 
    onNewFile, 
    onNewFolder, 
    onCopy, 
    onPaste, 
    onRenameItem, 
    onDeleteItem
  ]);

  // 如果菜单不显示，返回 null
  if (!contextMenu.show) {
    return null;
  }

  return (
    <ContextMenu
      x={contextMenu.x}
      y={contextMenu.y}
      items={getContextMenuItems()}
      onClose={onCloseContextMenu}
    />
  );
};

export default ContextMenuManager;