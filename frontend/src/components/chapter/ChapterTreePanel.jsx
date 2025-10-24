import React, { useEffect, useCallback, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setChapters, triggerChapterRefresh, openTab } from '../../store/slices/novelSlice';
import './ChapterTreePanel.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGear, faCaretRight, faCaretDown, faFolderPlus, faFileCirclePlus, faFolder, faFile, faRotate, faEdit, faCheck, faTimes } from '@fortawesome/free-solid-svg-icons';
import CombinedIcon from '../others/CombinedIcon';
import ContextMenuManager from './ContextMenuManager';
import NotificationModal from '../others/NotificationModal';
import ConfirmationModal from '../others/ConfirmationModal';
import ModalManager from '../others/ModalManager';
import CheckpointPanel from './CheckpointPanel';
import { faHistory } from '@fortawesome/free-solid-svg-icons';
import FileOperations from './FileOperations';
import chapterIpcHandler from '../../ipc/chapterIpcHandler';
import PrefixEditManager from './PrefixEditManager';
import ChapterTreeRenderer from './ChapterTreeRenderer';
import SettingsManager from './SettingsManager';

function ChapterTreePanel() {
  const chapters = useSelector((state) => state.novel.chapters);
  const refreshCounter = useSelector((state) => state.novel.refreshCounter);
  const [currentView, setCurrentView] = useState('chapters');
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [currentRenameItemId, setCurrentRenameItemId] = useState(null);
  const [currentRenameItemTitle, setCurrentRenameItemTitle] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [collapsedChapters, setCollapsedChapters] = useState({});
  const dispatch = useDispatch();
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState('');
  const [onConfirmCallback, setOnConfirmCallback] = useState(null);
  const [onCancelCallback, setOnCancelCallback] = useState(null);

  // 前缀编辑状态
  const [editingPrefix, setEditingPrefix] = useState({
    itemId: null,
    prefix: '',
    isFolder: false,
    currentPath: ''
  });

  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState({
    show: false,
    x: 0,
    y: 0,
    itemId: null,
    isFolder: false,
    itemTitle: null,
    itemParentPath: null
  });

  // 文件操作模块实例
  const [fileOperations, setFileOperations] = useState(null);

  // 获取 API Key
  useEffect(() => {
    const getApiKey = async () => {
      const result = await chapterIpcHandler.getApiKey();
      if (result.success) {
        setApiKey(result.apiKey);
      } else {
        console.warn('获取 API Key 失败:', result.error);
      }
    };
    getApiKey();
  }, []);

  // 获取章节列表
  const fetchChapters = useCallback(async () => {
    const result = await chapterIpcHandler.getChapters();
    if (result.success) {
      dispatch(setChapters(result.chapters));
    } else {
      console.error('获取章节列表失败:', result.error);
    }
  }, [dispatch]);

  // 辅助函数：根据文件名获取显示名称
  const getDisplayName = useCallback((name, isFolder) => {
    if (isFolder) {
      return name;
    }
    const lastDotIndex = name.lastIndexOf('.');
    return lastDotIndex !== -1 ? name.substring(0, lastDotIndex) : name;
  }, []);

  // 辅助函数：获取兄弟节点
  const getSiblingItems = useCallback((items, path) => {
    if (!path) return items;
    
    const findFolderByPath = (currentItems, targetPathParts, currentIndex) => {
      if (currentIndex === targetPathParts.length) {
        return currentItems;
      }
      const part = targetPathParts[currentIndex];
      const folder = currentItems.find(item => item.isFolder && item.title === part);
      if (folder && folder.children) {
        return findFolderByPath(folder.children, targetPathParts, currentIndex + 1);
      }
      return [];
    };

    const pathParts = path.split('/');
    return findFolderByPath(items, pathParts, 0);
  }, []);

  // 辅助函数：提取前缀
  const getDisplayPrefix = useCallback((item) => {
    return item.displayPrefix || '';
  }, []);

  // 前缀编辑处理函数
  const handlePrefixEdit = useCallback((itemId, currentPrefix, isFolder, currentPath) => {
    setEditingPrefix({
      itemId,
      prefix: currentPrefix,
      isFolder,
      currentPath
    });
  }, []);

  const handlePrefixEditCancel = useCallback(() => {
    setEditingPrefix({
      itemId: null,
      prefix: '',
      isFolder: false,
      currentPath: ''
    });
  }, []);

  // 初始化文件操作模块
  useEffect(() => {
    const operations = new FileOperations(
      null,
      fetchChapters,
      dispatch,
      setNotificationMessage,
      setShowNotificationModal
    );
    setFileOperations(operations);
  }, [fetchChapters, dispatch, setNotificationMessage, setShowNotificationModal]);

  // 注册 IPC 监听器和初始加载
  useEffect(() => {
    fetchChapters();
    
    const cleanup = chapterIpcHandler.onChaptersUpdated((chapters) => {
      dispatch(setChapters(chapters));
    });
    
    return cleanup;
  }, [fetchChapters, dispatch]);

  // 监听 refreshCounter 变化
  useEffect(() => {
    console.log('[ChapterTreePanel] refreshCounter 变化，触发 fetchChapters()');
    fetchChapters();
  }, [refreshCounter, fetchChapters]);

  // 章节点击处理
  const handleChapterClick = (item) => {
    if (item.isFolder) {
      setCollapsedChapters(prev => ({
        ...prev,
        [item.id]: !prev[item.id]
      }));
    } else {
      console.log(`请求打开文件: ${item.id}`);
      dispatch(openTab(item.id));
    }
  };

  // 右键菜单处理
  const handleContextMenu = useCallback((event, itemId, isFolder, itemTitle, itemParentPath) => {
    event.preventDefault();
    setContextMenu({
      show: true,
      x: event.clientX,
      y: event.clientY,
      itemId: itemId,
      isFolder: isFolder,
      itemTitle: itemTitle,
      itemParentPath: itemParentPath,
    });
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu({ ...contextMenu, show: false });
  }, [contextMenu]);

  // 文件操作处理函数
  const handleDeleteItem = useCallback(async (itemId) => {
    if (!fileOperations) return;
    fileOperations.handleDeleteItem(
      itemId,
      setConfirmationMessage,
      setOnConfirmCallback,
      setOnCancelCallback,
      setShowConfirmationModal
    );
  }, [fileOperations]);

  const handleRenameConfirm = useCallback(async (oldItemId, newTitle) => {
    if (!fileOperations) return;
    await fileOperations.handleRenameConfirm(oldItemId, newTitle, chapters, handleCloseContextMenu);
  }, [fileOperations, chapters, handleCloseContextMenu]);

  const handleRenameItem = useCallback((item) => {
    handleCloseContextMenu();
    setCurrentRenameItemId(item.id);
    setCurrentRenameItemTitle(getDisplayName(item.title, item.isFolder));
    setShowRenameModal(true);
  }, [handleCloseContextMenu, getDisplayName]);

  const handleRenameModalConfirm = useCallback(() => {
    if (currentRenameItemId && currentRenameItemTitle) {
      handleRenameConfirm(currentRenameItemId, currentRenameItemTitle);
      setShowRenameModal(false);
      setCurrentRenameItemId(null);
      setCurrentRenameItemTitle('');
    }
  }, [currentRenameItemId, currentRenameItemTitle, handleRenameConfirm]);

  const handleRenameModalCancel = useCallback(() => {
    setShowRenameModal(false);
    setCurrentRenameItemId(null);
    setCurrentRenameItemTitle('');
  }, []);

  const handleRenameInputChange = useCallback((e) => {
    setCurrentRenameItemTitle(e.target.value);
  }, []);

  const handleNewFile = useCallback(async (parentPath = '') => {
    if (!fileOperations) return;
    await fileOperations.handleNewFile(parentPath, handleCloseContextMenu);
  }, [fileOperations, handleCloseContextMenu]);

  const handleNewFolder = useCallback(async (parentPath = '') => {
    if (!fileOperations) return;
    await fileOperations.handleNewFolder(parentPath, handleCloseContextMenu);
  }, [fileOperations, handleCloseContextMenu]);

  const handleCopy = useCallback((itemId, isCut) => {
    if (!fileOperations) return;
    fileOperations.handleCopy(itemId, isCut, handleCloseContextMenu);
  }, [fileOperations, handleCloseContextMenu]);

  const handlePaste = useCallback(async (targetFolderId) => {
    if (!fileOperations) return;
    await fileOperations.handlePaste(targetFolderId, handleCloseContextMenu);
  }, [fileOperations, handleCloseContextMenu]);

  const getCopyCutState = useCallback(() => {
    if (!fileOperations) return { copiedItem: null, cutItem: null };
    return fileOperations.getCopyCutState();
  }, [fileOperations]);

  // 使用模块管理器
  const prefixEditManager = PrefixEditManager({
    editingPrefix,
    chapters,
    onPrefixEdit: handlePrefixEdit,
    onPrefixEditCancel: handlePrefixEditCancel,
    getSiblingItems,
    setNotificationMessage,
    setShowNotificationModal,
    fetchChapters
  });

  const settingsManager = SettingsManager({
    apiKey,
    setApiKey,
    setNotificationMessage,
    setShowNotificationModal,
    setShowSettings
  });

  return (
    <div className="chapter-tree-panel-container">
      <div className="chapter-tree-panel-header">
        <button className="new-file-button" onClick={() => handleNewFile()}>
          <CombinedIcon baseIcon="file" overlayIcon="plus" size="sm" />
        </button>
        <button className="new-folder-button" onClick={() => handleNewFolder()}>
          <CombinedIcon baseIcon="folder" overlayIcon="plus" size="sm" />
        </button>
        <button className="refresh-button" onClick={fetchChapters} title="刷新章节列表">
          <FontAwesomeIcon icon={faRotate} />
        </button>
        <button className="checkpoint-button" onClick={() => setCurrentView(currentView === 'chapters' ? 'checkpoints' : 'chapters')} title="查看版本历史">
          <FontAwesomeIcon icon={faHistory} />
        </button>
      </div>

      <div className="main-chapter-area">
        {currentView === 'checkpoints' ? (
          <CheckpointPanel onClose={() => setCurrentView('chapters')} />
        ) : (
          <div className="chapter-tree-panel-content" onContextMenu={(e) => handleContextMenu(e, null, false, null, '')}>
            {chapters.length === 0 ? (
              <p className="no-chapters-message">暂无文件</p>
            ) : (
              <ChapterTreeRenderer
                items={chapters}
                collapsedChapters={collapsedChapters}
                getDisplayName={getDisplayName}
                getDisplayPrefix={getDisplayPrefix}
                handleChapterClick={handleChapterClick}
                handleContextMenu={handleContextMenu}
                renderPrefixEdit={prefixEditManager.renderPrefixEdit}
              />
            )}
          </div>
        )}
      </div>

      {/* 右键菜单管理模块 */}
      <ContextMenuManager
        contextMenu={contextMenu}
        copiedItem={getCopyCutState().copiedItem}
        cutItem={getCopyCutState().cutItem}
        onCloseContextMenu={handleCloseContextMenu}
        onNewFile={handleNewFile}
        onNewFolder={handleNewFolder}
        onCopy={handleCopy}
        onPaste={handlePaste}
        onRenameItem={handleRenameItem}
        onDeleteItem={handleDeleteItem}
      />

      {/* 设置按钮区域 */}
      <div className="settings-button-area">
        <button className="settings-button" onClick={settingsManager.handleToggleSettings}>
          <FontAwesomeIcon icon={faGear} />
        </button>
      </div>

      {/* 模态框管理模块 */}
      <ModalManager
        showRenameModal={showRenameModal}
        currentRenameItemTitle={currentRenameItemTitle}
        onRenameInputChange={handleRenameInputChange}
        onRenameModalConfirm={handleRenameModalConfirm}
        onRenameModalCancel={handleRenameModalCancel}
        
        showNotificationModal={showNotificationModal}
        notificationMessage={notificationMessage}
        onNotificationClose={() => setShowNotificationModal(false)}
        
        showConfirmationModal={showConfirmationModal}
        confirmationMessage={confirmationMessage}
        onConfirmCallback={onConfirmCallback}
        onCancelCallback={onCancelCallback}
      />

    </div>
  );
}

export default ChapterTreePanel;