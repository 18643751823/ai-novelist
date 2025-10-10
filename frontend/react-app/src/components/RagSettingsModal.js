import React, { useState, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setShowRagSettingsModal } from '../store/slices/chatSlice';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faSave, faBook } from '@fortawesome/free-solid-svg-icons';
import RagRepositoryManager from './RagRepositoryManager';
import NotificationModal from './NotificationModal';
import './PromptManagerModal.css'; // 复用标签页样式

const RagSettingsModal = ({ isOpen, onClose }) => {
  const dispatch = useDispatch();
  const ragRepositoryRef = useRef(null);
  // 不再使用标签页切换，只显示RAG知识库面板
  const [notification, setNotification] = useState({
    isOpen: false,
    message: '',
    success: false
  });
  
  const handleClose = () => {
    dispatch(setShowRagSettingsModal(false));
    if (onClose) onClose();
  };

  const handleNotificationClose = () => {
    setNotification({ isOpen: false, message: '', success: false });
    if (notification.success) {
      handleClose();
    }
  };

  const showNotification = (message, success = true) => {
    setNotification({
      isOpen: true,
      message,
      success
    });
  };

  // 保存处理函数 - 只保存RAG仓库设置
  const handleSave = () => {
    let saveSuccess = true;
    
    // 保存 RAG 仓库设置
    if (ragRepositoryRef.current && ragRepositoryRef.current.handleSave) {
      try {
        ragRepositoryRef.current.handleSave();
      } catch (error) {
        console.error('RAG仓库保存失败:', error);
        saveSuccess = false;
      }
    }
    
    if (saveSuccess) {
      showNotification('RAG知识库设置保存成功');
    } else {
      showNotification('RAG知识库设置保存失败，请检查控制台', false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="prompt-manager-modal-content">
        {/* 内容区域 */}
        <div className="tab-content-container">
          <div className="tab-content-actions">
            <button className="save-button" onClick={handleSave}>
              保存
            </button>
            <button className="cancel-button" onClick={handleClose}>
              关闭
            </button>
          </div>
          
          {/* 只显示RAG知识库面板 */}
          <div className="single-panel-container">
            <div className="panel-section">
              <div className="panel-header">
                <FontAwesomeIcon icon={faBook} />
                <span>RAG知识库</span>
              </div>
              <RagRepositoryManager
                ref={ragRepositoryRef}
                onSaveComplete={showNotification}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 通知模态框 */}
      {notification.isOpen && (
        <NotificationModal
          message={notification.message}
          onClose={handleNotificationClose}
        />
      )}
    </>
  );
};

export default RagSettingsModal;