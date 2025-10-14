import React, { useState, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setShowRagSettingsModal } from '../../store/slices/chatSlice';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faSave, faCog, faDatabase, faInfoCircle } from '@fortawesome/free-solid-svg-icons';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { RagSettings, KnowledgeBaseManagement } from './RagKnowledgeBaseSettings';
import NotificationModal from '../NotificationModal';
import './RagSettingsModal.css'; // 新的CSS文件

const RagSettingsModal = ({ isOpen, onClose }) => {
  const dispatch = useDispatch();
  const ragSettingsRef = useRef(null);
  const knowledgeBaseRef = useRef(null);
  const [notification, setNotification] = useState({
    isOpen: false,
    message: '',
    success: false
  });
  const [activeTab, setActiveTab] = useState('rag-settings'); // 'rag-settings', 'knowledge-base'
  
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
    
    // 根据当前激活的标签页调用相应的保存方法
    if (activeTab === 'rag-settings') {
      // 保存 RAG 设置
      if (ragSettingsRef.current && ragSettingsRef.current.handleSave) {
        try {
          ragSettingsRef.current.handleSave();
        } catch (error) {
          console.error('RAG设置保存失败:', error);
          saveSuccess = false;
        }
      }
    } else if (activeTab === 'knowledge-base') {
      // 保存知识库管理设置（包括意图分析设置）
      if (knowledgeBaseRef.current && knowledgeBaseRef.current.handleSaveIntentAnalysis) {
        try {
          knowledgeBaseRef.current.handleSaveIntentAnalysis();
        } catch (error) {
          console.error('知识库管理设置保存失败:', error);
          saveSuccess = false;
        }
      }
    }
    
    if (saveSuccess) {
      showNotification('设置保存成功');
    } else {
      showNotification('部分设置保存失败，请检查控制台', false);
    }
  };

  // 渲染右侧内容
  const renderRightContent = () => {
    switch (activeTab) {
      case 'rag-settings':
        return (
          <div className="tab-content-full">
            <RagSettings
              ref={ragSettingsRef}
              onSaveComplete={showNotification}
            />
          </div>
        );
      case 'knowledge-base':
        return (
          <div className="tab-content-full">
            <KnowledgeBaseManagement
              ref={knowledgeBaseRef}
              onSaveComplete={showNotification}
            />
          </div>
        );
      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="rag-settings-modal-content">
        {/* 操作按钮区域 - 按照通用设置面板样式 */}
        <div className="tab-content-actions">
          <button className="save-button" onClick={handleSave}>
            保存
          </button>
          <button className="cancel-button" onClick={handleClose}>
            关闭
          </button>
        </div>
        
        {/* 左右分栏布局 */}
        <PanelGroup direction="horizontal" className="rag-settings-panel-group">
          {/* 左侧标签页列表 */}
          <Panel defaultSize={25} minSize={0} maxSize={100} className="rag-left-panel">
            <div className="rag-left-container">
              <div className="panel-header">
                <FontAwesomeIcon icon={faCog} />
                <span>设置管理</span>
              </div>
              <div className="tab-list">
                <div
                  className={`tab-item ${activeTab === 'rag-settings' ? 'active' : ''}`}
                  onClick={() => setActiveTab('rag-settings')}
                >
                  <FontAwesomeIcon icon={faCog} />
                  <span>RAG设置</span>
                </div>
                <div
                  className={`tab-item ${activeTab === 'knowledge-base' ? 'active' : ''}`}
                  onClick={() => setActiveTab('knowledge-base')}
                >
                  <FontAwesomeIcon icon={faDatabase} />
                  <span>知识库管理</span>
                </div>
              </div>
            </div>
          </Panel>

          {/* 分隔条 */}
          <PanelResizeHandle className="rag-panel-resize-handle">
            <div className="rag-resize-handle-inner" />
          </PanelResizeHandle>

          {/* 右侧内容区域 */}
          <Panel minSize={0} maxSize={100} className="rag-right-panel">
            <div className="rag-right-container">
              <div className="panel-header">
                <FontAwesomeIcon icon={faInfoCircle} />
                <span>具体信息</span>
              </div>
              {renderRightContent()}
            </div>
          </Panel>
        </PanelGroup>
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