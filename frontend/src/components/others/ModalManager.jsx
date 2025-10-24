import React from 'react';
import NotificationModal from './NotificationModal';
import ConfirmationModal from './ConfirmationModal';

/**
 * ModalManager - 模态框管理模块
 * 统一管理重命名模态框、通知模态框、确认模态框
 */
const ModalManager = ({
  // 重命名模态框相关属性
  showRenameModal,
  currentRenameItemTitle,
  onRenameInputChange,
  onRenameModalConfirm,
  onRenameModalCancel,
  
  // 通知模态框相关属性
  showNotificationModal,
  notificationMessage,
  onNotificationClose,
  
  // 确认模态框相关属性
  showConfirmationModal,
  confirmationMessage,
  onConfirmCallback,
  onCancelCallback
}) => {
  return (
    <>
      {/* 重命名模态框 */}
      {showRenameModal && (
        <div className="settings-modal-overlay">
          <div className="settings-modal-content">
            <h2>重命名</h2>
            <div className="setting-item">
              <label htmlFor="renameInput">新名称:</label>
              <input
                type="text"
                id="renameInput"
                value={currentRenameItemTitle}
                onChange={onRenameInputChange}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    onRenameModalConfirm();
                  }
                }}
                autoFocus
              />
            </div>
            <div className="modal-actions">
              <button onClick={onRenameModalConfirm} className="save-button">确定</button>
              <button onClick={onRenameModalCancel} className="cancel-button">取消</button>
            </div>
          </div>
        </div>
      )}

      {/* 通知模态框 */}
      {showNotificationModal && (
        <NotificationModal 
          message={notificationMessage} 
          onClose={onNotificationClose} 
        />
      )}

      {/* 确认模态框 */}
      {showConfirmationModal && (
        <ConfirmationModal
          message={confirmationMessage}
          onConfirm={onConfirmCallback}
          onCancel={onCancelCallback}
        />
      )}
    </>
  );
};

export default ModalManager;