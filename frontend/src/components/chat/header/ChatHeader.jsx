import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setIsHistoryPanelVisible, setSelectedModel } from '../../../store/slices/chatSlice';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClock } from '@fortawesome/free-solid-svg-icons';

const ChatHeader = ({ 
  showModelSelectorPanel, 
  setShowModelSelectorPanel,
  setStoreValue 
}) => {
  const dispatch = useDispatch();
  
  const {
    isHistoryPanelVisible,
    selectedModel,
    availableModels
  } = useSelector((state) => state.chat);

  const handleHistoryToggle = () => {
    dispatch(setIsHistoryPanelVisible(!isHistoryPanelVisible));
    // 关闭其他面板
    if (!isHistoryPanelVisible) {
      setShowModelSelectorPanel(false);
    }
  };

  const handleModelSelectorToggle = () => {
    setShowModelSelectorPanel(!showModelSelectorPanel);
    // 关闭其他面板
    if (!showModelSelectorPanel) {
      dispatch(setIsHistoryPanelVisible(false));
    }
  };

  return (
    <div className="chat-header-actions">
      <button 
        className="history-button" 
        onClick={handleHistoryToggle}
        title="历史会话"
      >
        <FontAwesomeIcon icon={faClock} />
      </button>
      
      {/* 模型选择器 - 移动到头部按钮区域 */}
      <div className="model-selector-header-wrapper">
        <button
          className="model-selector-button"
          onClick={handleModelSelectorToggle}
          title=""
        >
          <span className="selected-model-name">
            {selectedModel ? availableModels.find(m => m.id === selectedModel)?.id || selectedModel : ''}
          </span>
          <span className="expand-icon">▼</span>
        </button>
      </div>
      {/* 停止按钮已移动到输入区域 */}
    </div>
  );
};

export default ChatHeader;