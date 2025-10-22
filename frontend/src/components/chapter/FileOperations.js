import React from 'react';
import fileOperationsIpcHandler from '../../ipc/fileOperationsIpcHandler';

/**
 * 文件操作模块
 * 处理新建文件/文件夹、重命名、删除、复制、剪切、粘贴操作
 */
export class FileOperations {
  constructor(invoke, fetchChapters, dispatch, setNotificationMessage, setShowNotificationModal) {
    this.invoke = invoke;
    this.fetchChapters = fetchChapters;
    this.dispatch = dispatch;
    this.setNotificationMessage = setNotificationMessage;
    this.setShowNotificationModal = setShowNotificationModal;
    
    // 复制/剪切操作的临时存储
    this.copiedItem = null;
    this.cutItem = null;
  }

  /**
   * 辅助函数：根据文件名获取显示名称（去除文件拓展名）
   */
  getDisplayName(name, isFolder) {
    if (isFolder) {
      return name;
    }
    const lastDotIndex = name.lastIndexOf('.');
    return lastDotIndex !== -1 ? name.substring(0, lastDotIndex) : name;
  }

  /**
   * 辅助函数：获取指定路径下的兄弟节点（包括文件和文件夹），以便检查重名
   */
  getSiblingItems(items, path) {
    if (!path) return items; // 根目录
    
    const findFolderByPath = (currentItems, targetPathParts, currentIndex) => {
      if (currentIndex === targetPathParts.length) {
        return currentItems; // 找到目标文件夹的子项列表
      }
      const part = targetPathParts[currentIndex];
      // 注意这里用 item.title 匹配文件夹名，因为 getDisplayName 已经移除了文件的拓展名
      const folder = currentItems.find(item => item.isFolder && item.title === part);
      if (folder && folder.children) {
        return findFolderByPath(folder.children, targetPathParts, currentIndex + 1);
      }
      return []; // 未找到路径中的文件夹
    };

    const pathParts = path.split('/');
    return findFolderByPath(items, pathParts, 0);
  }
  /**
   * IPC 相关操作的统一处理函数
   */
  async handleIPCAction(action, ...args) {
    let result;
    
    // 使用对应的 IPCHandler 方法
    switch (action) {
      case 'delete-item':
        result = await fileOperationsIpcHandler.deleteItem(...args);
        break;
      case 'rename-item':
        result = await fileOperationsIpcHandler.renameItem(...args);
        break;
      case 'create-novel-file':
        result = await fileOperationsIpcHandler.createNovelFile(...args);
        break;
      case 'create-folder':
        result = await fileOperationsIpcHandler.createFolder(...args);
        break;
      case 'move-item':
        result = await fileOperationsIpcHandler.moveItem(...args);
        break;
      case 'copy-item':
        result = await fileOperationsIpcHandler.copyItem(...args);
        break;
      default:
        // 对于未知操作，回退到原始 invoke
        try {
          result = await this.invoke(action, ...args);
          if (result.success) {
            result = { success: true, message: result.message };
          } else {
            result = { success: false, error: result.error };
          }
        } catch (error) {
          result = { success: false, error: error.message };
        }
    }

    if (result.success) {
      // 过滤掉"结束加载设置"消息，避免不必要的通知
      if (result.message && result.message.includes('结束加载设置')) {
        console.log('过滤掉通知消息:', result.message);
      } else {
        this.setNotificationMessage(result.message);
        this.setShowNotificationModal(true);
      }
      this.fetchChapters(); // 刷新章节列表
    } else {
      this.setNotificationMessage(`操作失败: ${result.error}`);
      this.setShowNotificationModal(true);
      console.error(`操作失败: ${action}`, result.error);
    }
    return result;
  }

  /**
   * 删除项目
   */
  async handleDeleteItem(itemId, setConfirmationMessage, setOnConfirmCallback, setOnCancelCallback, setShowConfirmationModal) {
    setConfirmationMessage(`确定要删除 "${itemId}" 吗？`);
    setOnConfirmCallback(() => async () => {
      setShowConfirmationModal(false); // 关闭确认弹窗
      await this.handleIPCAction('delete-item', itemId);
    });
    setOnCancelCallback(() => () => {
      setShowConfirmationModal(false); // 关闭确认弹窗
    });
    setShowConfirmationModal(true); // 显示确认弹窗
  }

  /**
   * 重命名确认
   */
  async handleRenameConfirm(oldItemId, newTitle, chapters, handleCloseContextMenu) {
    if (!newTitle || !newTitle.trim()) {
      this.setNotificationMessage('名称不能为空！');
      this.setShowNotificationModal(true);
      return;
    }

    // 从 chapters 中查找原始项，以获取其类型和原始文件名
    const findItemInChapters = (items, idToFind) => {
      for (const item of items) {
        if (item.id === idToFind) {
          return item;
        }
        if (item.children) {
          const found = findItemInChapters(item.children, idToFind);
          if (found) return found;
        }
      }
      return null;
    };

    const originalItem = findItemInChapters(chapters, oldItemId);
    if (!originalItem) {
      console.error('未找到要重命名的项:', oldItemId);
      this.setNotificationMessage('重命名失败：原始项不存在。');
      this.setShowNotificationModal(true);
      return;
    }

    let finalNewTitle = newTitle.trim();

    // 如果是文件，补回拓展名
    if (!originalItem.isFolder) {
      const originalFileName = originalItem.title; // 原始文件名，包含拓展名
      const lastDotIndex = originalFileName.lastIndexOf('.');
      if (lastDotIndex !== -1) {
        const originalExtension = originalFileName.substring(lastDotIndex); // 包括点号
        // 如果用户输入的新名称不包含拓展名，且原始文件名有拓展名，则自动补回原始拓展名
        if (!finalNewTitle.includes('.') && originalExtension) {
          finalNewTitle += originalExtension;
        }
      }
    }
    
    const result = await this.handleIPCAction('rename-item', oldItemId, finalNewTitle);

    if (result.success) {
      // 在重命名操作完成后，触发主进程的焦点修复
      await fileOperationsIpcHandler.triggerFocusFix();
    }
  }

  /**
   * 新建文件
   */
  async handleNewFile(parentPath = '', handleCloseContextMenu) {
    const defaultTitle = '新建文件';
    
    // 不再使用前缀文件名，直接使用原始文件名
    const fileName = `${defaultTitle}.txt`;
    const newFilePath = parentPath ? `${parentPath}/${fileName}` : fileName;
    await this.handleIPCAction('create-novel-file', { filePath: newFilePath, content: '' });
    if (handleCloseContextMenu) {
      handleCloseContextMenu();
    }
  }

  /**
   * 新建文件夹
   */
  async handleNewFolder(parentPath = '', handleCloseContextMenu) {
    const defaultFolderName = '新文件夹';
    
    // 不再使用前缀文件夹名，直接使用原始文件夹名
    const newFilePath = parentPath ? `${parentPath}/${defaultFolderName}` : defaultFolderName;
    await this.handleIPCAction('create-folder', newFilePath);
    if (handleCloseContextMenu) {
      handleCloseContextMenu();
    }
  }

  /**
   * 复制操作
   */
  handleCopy(itemId, isCut, handleCloseContextMenu) {
    if (isCut) {
      this.cutItem = { id: itemId, isCut: true };
      this.copiedItem = null;
    } else {
      this.copiedItem = { id: itemId, isCut: false };
      this.cutItem = null;
    }
    if (handleCloseContextMenu) {
      handleCloseContextMenu();
    }
  }

  /**
   * 粘贴操作
   */
  async handlePaste(targetFolderId, handleCloseContextMenu) {
    if (this.cutItem) {
      await this.handleIPCAction('move-item', this.cutItem.id, targetFolderId);
      this.cutItem = null;
    } else if (this.copiedItem) {
      await this.handleIPCAction('copy-item', this.copiedItem.id, targetFolderId);
      this.copiedItem = null;
    }
    if (handleCloseContextMenu) {
      handleCloseContextMenu();
    }
  }

  /**
   * 获取复制/剪切状态
   */
  getCopyCutState() {
    return {
      copiedItem: this.copiedItem,
      cutItem: this.cutItem
    };
  }
}

export default FileOperations;