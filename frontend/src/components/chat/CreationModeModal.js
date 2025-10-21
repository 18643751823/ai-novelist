import React from 'react';
import { useDispatch } from 'react-redux';
import {
  setIsCreationModeEnabled,
  setShowCreationModal
} from '../../store/slices/chatSlice';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faCheck, faCog } from '@fortawesome/free-solid-svg-icons';
import './CreationModeModal.css';

const CreationModeModal = ({ isOpen, onClose, onModeSwitch, onOpenMemorySettings }) => {
  const dispatch = useDispatch();
  
  const handleConfirm = () => {
    // 启用创作模式
    dispatch(setIsCreationModeEnabled(true));
    
    // 关闭弹窗
    dispatch(setShowCreationModal(false));
    
    // 自动切换到细纲模式
    if (onModeSwitch) {
      onModeSwitch('outline');
    }
  };

  const handleOpenMemorySettings = () => {
    // 关闭创作模式弹窗
    dispatch(setShowCreationModal(false));
    
    // 打开持久记忆设置
    if (onOpenMemorySettings) {
      onOpenMemorySettings();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="creation-mode-modal-overlay">
      <div className="creation-mode-modal-content">
        <div className="creation-mode-modal-header">
          <h2>创作模式配置</h2>
          <button className="close-button" onClick={onClose}>
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <div className="creation-mode-description">
          <p>创作模式将启用细纲、写作和调整模式，帮助您更好地进行小说创作。</p>
          <p>建议每写一章，重新设置持久记忆信息（大纲、上一章内容、人设等）。</p>
        </div>

        <div className="creation-mode-modal-actions">
          <button className="memory-settings-button" onClick={handleOpenMemorySettings}>
            <FontAwesomeIcon icon={faCog} /> 设置持久记忆
          </button>
          <button className="confirm-button" onClick={handleConfirm}>
            <FontAwesomeIcon icon={faCheck} /> 确认开启创作
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreationModeModal;