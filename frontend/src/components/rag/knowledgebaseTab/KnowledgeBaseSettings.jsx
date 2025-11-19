import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faSync, faTimes, faBook, faTrash, faEdit } from '@fortawesome/free-solid-svg-icons';
import ConfirmationModal from '../../others/ConfirmationModal';
import NotificationModal from '../../others/NotificationModal';
import RenameKbFileModal from './RenameKbFileModal';
import useIpcRenderer from '../../../hooks/useIpcRenderer';
import './KnowledgeBaseSettings.css';

const KnowledgeBaseSettings = ({
  onClose,
  files = [],
  loading = false,
  error = null,
  onRefresh,
  onUpdate
}) => {
  const { invoke } = useIpcRenderer();
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

  // 当父组件传递的error变化时，显示错误通知
  useEffect(() => {
    if (error) {
      setNotification({
        type: 'error',
        message: error,
        duration: 5000
      });
    }
  }, [error]);

  // 处理删除文件
  const handleDeleteFile = async (filename) => {
    try {
      const result = await invoke('delete-kb-file', filename);
      if (result.success) {
        setNotification({
          type: 'success',
          message: `文件 "${filename}" 已成功删除`,
          duration: 3000
        });
        // 通知父组件更新文件列表
        if (onUpdate) onUpdate();
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
  const handleRenameFile = async (fileId, newFilename) => {
    try {
      const result = await invoke('rename-kb-file', fileId, newFilename);
      if (result.success) {
        setNotification({
          type: 'success',
          message: `文件已成功重命名为 "${newFilename}"`,
          duration: 3000
        });
        // 通知父组件更新文件列表
        if (onUpdate) onUpdate();
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
      handleDeleteFile(fileToDelete.id);
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
    if (onRefresh) onRefresh();
  };

  // 添加文件到知识库
  const handleAddFile = async () => {
    try {
      // 创建隐藏的文件输入元素
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = '.txt,.md,.pdf,.docx';
      fileInput.style.display = 'none';
      
      // 添加文件选择事件监听
      fileInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) {
          return; // 用户取消了选择
        }
        
        try {
          const result = await invoke('add-file-to-kb', file);
          if (result.success) {
            setNotification({
              type: 'success',
              message: result.message || '文件添加成功',
              duration: 3000
            });
            // 通知父组件更新文件列表
            if (onUpdate) onUpdate();
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
          // 清理文件输入元素
          document.body.removeChild(fileInput);
        }
      });
      
      // 添加到DOM并触发点击
      document.body.appendChild(fileInput);
      fileInput.click();
      
    } catch (err) {
      setNotification({
        type: 'error',
        message: `添加操作失败: ${err.message}`,
        duration: 5000
      });
    }
  };

  console.log('KnowledgeBaseSettings 渲染，files:', files, 'loading:', loading, 'error:', error);
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
          <button onClick={handleRefresh}>重试</button>
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
            <div key={file.id} className="kb-file-item">
              <div className="file-info">
                <div className="file-name">{file.name}</div>
                <div className="file-details">
                  <span className="document-count">{file.total_chunks} 片段</span>
                  <span className="embedding-dimensions">创建时间: {file.created_at}</span>
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
            `确定要删除文件 "${fileToDelete.name}" 的知识库吗？\n此操作将永久删除该文件的所有嵌入向量数据，且无法恢复。`
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

export default KnowledgeBaseSettings;