import React, { useState, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setShowAdditionalInfoModal } from '../store/slices/chatSlice';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faSave } from '@fortawesome/free-solid-svg-icons';
import AdditionalInfoTab from './AdditionalInfoTab';
import NotificationModal from './NotificationModal';
import './PromptManagerModal.css'; // 复用标签页样式

const AdditionalInfoModal = ({ isOpen, onClose }) => {
  const dispatch = useDispatch();
  const additionalInfoRef = useRef(null);
  const [notification, setNotification] = useState({
    isOpen: false,
    message: '',
    success: false
  });
  
  const handleClose = () => {
    dispatch(setShowAdditionalInfoModal(false));
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

  // 保存处理函数
  const handleSave = () => {
    if (additionalInfoRef.current && additionalInfoRef.current.handleSave) {
      additionalInfoRef.current.handleSave();
    } else {
      console.error('无法调用AdditionalInfoTab的保存方法');
      showNotification('保存失败：无法调用保存逻辑', false);
    }
  };

  if (!isOpen) return null;

  return (
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
        <AdditionalInfoTab
          ref={additionalInfoRef}
          onSaveComplete={showNotification}
        />
      </div>

      {/* 通知模态框 */}
      {notification.isOpen && (
        <NotificationModal
          message={notification.message}
          onClose={handleNotificationClose}
        />
      )}
    </div>
  );
};

export default AdditionalInfoModal;