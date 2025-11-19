import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import modelSelectionService from '../../../services/modelSelectionService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClock } from '@fortawesome/free-solid-svg-icons';
import { setIsHistoryPanelVisible } from '../../../store/slices/messageSlice';
import { selectIsHistoryPanelVisible } from '../../../store/selectors/chatSelectors';

const ChatHeader = ({
  showModelSelectorPanel,
  setShowModelSelectorPanel,
  setStoreValue
}) => {
  const dispatch = useDispatch();
  // 使用Redux store管理历史面板可见性
  const isHistoryPanelVisible = useSelector(selectIsHistoryPanelVisible);
  
  // 本地状态管理 - 模型相关状态
  const [selectedModel, setSelectedModel] = useState('');
  const [availableModels, setAvailableModels] = useState([]);

  // 加载选中的模型和模型列表
  const loadSelectedModel = async () => {
    try {
      const result = await modelSelectionService.getSelectedModel();
      if (result.success) {
        setSelectedModel(result.selectedModel);
      } else {
        console.error('获取选中模型失败:', result.error);
      }
    } catch (error) {
      console.error('加载选中模型失败:', error);
    }
  };

  // 加载模型列表
  const loadAvailableModels = async () => {
    try {
      const result = await modelSelectionService.getAvailableModels();
      if (result.success) {
        setAvailableModels(result.models);
      } else {
        console.error('获取模型列表失败:', result.error);
      }
    } catch (error) {
      console.error('加载模型列表失败:', error);
    }
  };

  // 处理模型选择器切换
  const handleModelSelectorToggle = () => {
    setShowModelSelectorPanel(!showModelSelectorPanel);
    // 关闭其他面板
    if (!showModelSelectorPanel) {
      dispatch(setIsHistoryPanelVisible(false));
    }
  };

  // 处理历史面板切换
  const handleHistoryToggle = () => {
    dispatch(setIsHistoryPanelVisible(!isHistoryPanelVisible));
    // 关闭其他面板
    if (!isHistoryPanelVisible) {
      setShowModelSelectorPanel(false);
    }
  };


  // 组件挂载时加载数据
  useEffect(() => {
    loadSelectedModel();
    loadAvailableModels();
  }, []);

  // 监听模型选择器面板关闭时重新加载选中的模型
  useEffect(() => {
    if (!showModelSelectorPanel) {
      loadSelectedModel();
    }
  }, [showModelSelectorPanel]);

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
            {selectedModel ? availableModels.find(m => m.id === selectedModel)?.id || selectedModel : '选择模型'}
          </span>
          <span className="expand-icon">▼</span>
        </button>
      </div>
      {/* 停止按钮已移动到输入区域 */}
    </div>
  );
};

export default ChatHeader;