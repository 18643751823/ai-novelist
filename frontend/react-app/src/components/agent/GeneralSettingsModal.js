import React, { useState, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setShowGeneralSettingsModal } from '../../store/slices/chatSlice';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faSave } from '@fortawesome/free-solid-svg-icons';
import GeneralSettingsTab from './GeneralSettingsTab';
import NotificationModal from '../others/NotificationModal';
import './PromptManagerModal.css'; // 复用标签页样式

const GeneralSettingsModal = ({ isOpen, onClose }) => {
  const dispatch = useDispatch();
  const settingsTabRef = useRef(null);
  const [notification, setNotification] = useState({
    isOpen: false,
    message: '',
    success: false
  });
  
  const handleClose = () => {
    dispatch(setShowGeneralSettingsModal(false));
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
    if (settingsTabRef.current && settingsTabRef.current.handleSave) {
      settingsTabRef.current.handleSave();
    } else {
      console.error('无法调用GeneralSettingsTab的保存方法');
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
        <GeneralSettingsTab
          ref={settingsTabRef}
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

export default GeneralSettingsModal;