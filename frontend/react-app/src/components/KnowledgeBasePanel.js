import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faSync, faTimes, faBook, faTrash, faEdit } from '@fortawesome/free-solid-svg-icons';
import ConfirmationModal from './ConfirmationModal';
import NotificationModal from './NotificationModal';
import RenameKbFileModal from './RenameKbFileModal';
import './KnowledgeBasePanel.css';

const KnowledgeBasePanel = ({ onClose }) => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null);
  const [fileToRename, setFileToRename] = useState(null);
  const [notification, setNotification] = useState(null);
  
  // 监听 notification 状态变化
  useEffect(() => {
    console.log('notification 状态变化:', notification);
    if (notification) {
      console.log('通知模态框将显示，消息:', notification.message);
    }
  }, [notification]);

  // 加载知识库文件列表
  const loadKnowledgeBaseFiles = async () => {
    setLoading(true);
    setError(null);
    console.log('开始加载知识库文件...');
    console.log('当前 notification 状态:', notification); // 添加当前 notification 状态日志
    
    // 检查 ipcRenderer 是否可用
    if (!window.ipcRenderer) {
      const errorMsg = 'ipcRenderer 未定义，请检查预加载脚本';
      console.error(errorMsg);
      setError(errorMsg);
      setLoading(false);
      return;
    }

    try {
      console.log('调用 list-kb-files IPC...');
      const result = await window.ipcRenderer.invoke('list-kb-files');
      console.log('IPC调用结果:', result);
      
      if (result.success) {
        console.log(`获取到 ${result.files?.length || 0} 个文件`);
        console.log('文件详情:', result.files);
        setFiles(result.files || []);
        // 检查状态更新
        setTimeout(() => {
          console.log('当前 files 状态:', files);
        }, 0);
      } else {
        console.error('获取文件列表失败:', result.error);
        setError(result.error || '获取文件列表失败');
      }
    } catch (err) {
      console.error('调用API失败:', err);
      setError('调用API失败: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 初始化加载文件列表
  useEffect(() => {
    console.log('KnowledgeBasePanel 挂载，初始 notification:', notification);
    console.log('KnowledgeBasePanel useEffect 触发，开始加载文件列表');
    loadKnowledgeBaseFiles();
  }, []);

  // 监听 files 状态变化
  useEffect(() => {
    console.log('files 状态变化:', files);
  }, [files]);

  // 处理删除文件
  const handleDeleteFile = async (filename) => {
    try {
      const result = await window.ipcRenderer.invoke('delete-kb-file', filename);
      if (result.success) {
        setNotification({
          type: 'success',
          message: `文件 "${filename}" 已成功删除`,
          duration: 3000
        });
        // 重新加载文件列表
        await loadKnowledgeBaseFiles();
      } else {
        setNotification({
          type: 'error',
          message: `删除失败: ${result.error}`,
          duration: 5000
        });
      }
    } catch (err) {
      setNotification({
        type: 'error',
          message: `删除操作失败: ${err.message}`,
          duration: 5000
      });
    } finally {
      setDeleteModalOpen(false);
      setFileToDelete(null);
    }
  };


  // 处理文件重命名
  const handleRenameFile = async (oldFilename, newFilename) => {
    setLoading(true);
    try {
      const result = await window.ipcRenderer.invoke('rename-kb-file', oldFilename, newFilename);
      if (result.success) {
        setNotification({
          type: 'success',
          message: `文件 "${oldFilename}" 已成功重命名为 "${newFilename}"`,
          duration: 3000
        });
        // 重新加载文件列表
        await loadKnowledgeBaseFiles();
      } else {
        throw new Error(result.error || '重命名失败');
      }
    } catch (err) {
      setNotification({
        type: 'error',
        message: `重命名失败: ${err.message}`,
        duration: 5000
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // 打开重命名确认对话框
  const openRenameModal = (file) => {
    console.log('打开重命名对话框，文件:', file);
    setFileToRename(file);
    setRenameModalOpen(true);
  };

  // 关闭重命名确认对话框
  const closeRenameModal = () => {
    console.log('关闭重命名对话框');
    setRenameModalOpen(false);
    setFileToRename(null);
  };

  // 打开删除确认对话框
  const openDeleteConfirm = (file) => {
    console.log('打开删除确认对话框，文件:', file);
    setFileToDelete(file);
    setDeleteModalOpen(true);
  };

  // 关闭删除确认对话框
  const closeDeleteConfirm = () => {
    console.log('关闭删除确认对话框');
    setDeleteModalOpen(false);
    setFileToDelete(null);
  };

  // 确认删除
  const confirmDelete = () => {
    console.log('确认删除文件:', fileToDelete);
    if (fileToDelete) {
      handleDeleteFile(fileToDelete.filename);
    } else {
      // 如果fileToDelete为null，仍然关闭模态框
      closeDeleteConfirm();
    }
  };

  // 关闭通知
  const closeNotification = () => {
    setNotification(null);
  };

  // 刷新文件列表
  const handleRefresh = () => {
    console.log('手动刷新知识库文件列表');
    loadKnowledgeBaseFiles();
  };

  // 添加文件到知识库
  const handleAddFile = async () => {
    setLoading(true);
    try {
      const result = await window.ipcRenderer.invoke('add-file-to-kb');
      if (result.success) {
        setNotification({
          type: 'success',
          message: result.message || '文件添加成功',
          duration: 3000
        });
        // 重新加载文件列表
        await loadKnowledgeBaseFiles();
      } else {
        setNotification({
          type: 'error',
          message: `添加失败: ${result.error || result.message}`,
          duration: 5000
        });
      }
    } catch (err) {
      setNotification({
        type: 'error',
        message: `添加操作失败: ${err.message}`,
        duration: 5000
      });
    } finally {
      setLoading(false);
    }
  };

  console.log('KnowledgeBasePanel 渲染，files:', files, 'loading:', loading, 'error:', error);

  return (
    <div className="knowledge-base-panel">
      <div className="kb-header">
        <h2>知识库</h2>
        <div className="kb-actions">
          <button
            className="add-btn"
            onClick={handleAddFile}
            disabled={loading}
            title="添加文档到知识库"
          >
            <FontAwesomeIcon icon={faPlus} />
          </button>
          <button
            className="refresh-btn"
            onClick={handleRefresh}
            disabled={loading}
            title="刷新列表"
          >
            <FontAwesomeIcon icon={loading ? faSync : faSync} spin={loading} />
          </button>
          {onClose && <button onClick={onClose} className="close-btn" title="关闭"><FontAwesomeIcon icon={faTimes} /></button>}
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={loadKnowledgeBaseFiles}>重试</button>
        </div>
      )}

      <div className="kb-file-list">
        {loading ? (
          <div className="loading-state">加载中...</div>
        ) : files.length === 0 ? (
          <div className="empty-state">
            知识库为空，请添加文件
          </div>
        ) : (
          files.map((file) => (
            <div key={file.tableName} className="kb-file-item">
              <div className="file-info">
                <div className="file-name">{file.filename}</div>
                <div className="file-details">
                  <span className="document-count">{file.documentCount} 片段</span>
                </div>
              </div>
              <div className="file-actions">
                <button
                  className="rename-btn"
                  onClick={() => openRenameModal(file)}
                  title="重命名此文件"
                  disabled={loading}
                >
                  <FontAwesomeIcon icon={faEdit} />
                </button>
                <button
                  className="delete-btn"
                  onClick={() => openDeleteConfirm(file)}
                  title="删除此文件的知识库"
                  disabled={loading}
                >
                  <FontAwesomeIcon icon={faTrash} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 删除确认对话框 */}
      {deleteModalOpen && (
        <ConfirmationModal
          message={
            fileToDelete ?
            `确定要删除文件 "${fileToDelete.filename}" 的知识库吗？\n此操作将永久删除该文件的所有嵌入向量数据，且无法恢复。`
            : '确定要删除吗？'
          }
          onConfirm={confirmDelete}
          onCancel={closeDeleteConfirm}
        />
      )}

      {/* 重命名模态框 */}
      {renameModalOpen && (
        <RenameKbFileModal
          isOpen={renameModalOpen}
          onClose={closeRenameModal}
          file={fileToRename}
          onRename={handleRenameFile}
        />
      )}

      {/* 通知模态框 */}
      {notification && (
        <NotificationModal
          message={notification.message}
          onClose={closeNotification}
        />
      )}
    </div>
  );
};

export default KnowledgeBasePanel;