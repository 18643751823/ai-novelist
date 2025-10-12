import React, { useState, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setShowRagSettingsModal } from '../../store/slices/chatSlice';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faSave, faBook } from '@fortawesome/free-solid-svg-icons';
import RagKnowledgeBaseSettings from './RagKnowledgeBaseSettings';
import NotificationModal from '../NotificationModal';
import '../agent/PromptManagerModal.css'; // 复用标签页样式

const RagSettingsModal = ({ isOpen, onClose }) => {
  const dispatch = useDispatch();
  const ragSettingsRef = useRef(null);
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

  // 保存处理函数 - 保存 RAG 知识库设置
  const handleSave = () => {
    let saveSuccess = true;
    
    // 保存 RAG 知识库设置
    if (ragSettingsRef.current && ragSettingsRef.current.handleSave) {
      try {
        ragSettingsRef.current.handleSave();
      } catch (error) {
        console.error('RAG知识库保存失败:', error);
        saveSuccess = false;
      }
    }
    
    if (saveSuccess) {
      showNotification('设置保存成功');
    } else {
      showNotification('部分设置保存失败，请检查控制台', false);
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
          
          {/* 显示 RAG 知识库面板 */}
          <div className="panel-section">
            <div className="panel-header">
              <FontAwesomeIcon icon={faBook} />
              <span>RAG知识库</span>
            </div>
            <RagKnowledgeBaseSettings
              ref={ragSettingsRef}
              onSaveComplete={showNotification}
            />
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