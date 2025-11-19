import React, { useState, forwardRef, useImperativeHandle, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  setShowRagSettingsModal,
  setEmbeddingModel,
  // 新增：RAG统一状态管理actions
  setRagLoading,
  setRagError,
  setAllRagSettings,
  setRagKnowledgeBaseFiles,
  setRagEmbeddingModel
} from '../../store/slices/chatSlice';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCog, faDatabase, faTimes, faSave, faInfoCircle, faSync } from '@fortawesome/free-solid-svg-icons';
import EmbeddingModelSelector from './ragsettingsTab/EmbeddingModelSelector';
import EmbeddingDimensionsSettings from './ragsettingsTab/EmbeddingDimensionsSettings';
import TextChunkingSettings from './ragsettingsTab/TextChunkingSettings';
import KnowledgeBaseSettings from './knowledgebaseTab/KnowledgeBaseSettings';
import NotificationModal from '../others/NotificationModal';
import useIpcRenderer from '../../hooks/useIpcRenderer';
import './RagManagementPanel.css';

// RAG统一管理面板组件（包含模态框功能）
const RagManagementPanel = forwardRef(({ isOpen, onClose, onSaveComplete }, ref) => {
  const dispatch = useDispatch();
  const { invoke, setStoreValue } = useIpcRenderer();
  const {
    availableModels,
    embeddingModel
  } = useSelector((state) => state.chat);
  
  const ragState = useSelector((state) => state.chat.rag.ragState);
  
  const [activeTab, setActiveTab] = useState('rag-settings'); // 'rag-settings', 'knowledge-base'
  const [notification, setNotification] = useState({
    isOpen: false,
    message: '',
    success: false
  });

  // 统一加载所有RAG相关设置
  const loadAllRagSettings = useCallback(async () => {
    try {
      dispatch(setRagLoading({ allSettings: true }));
      dispatch(setRagError({ allSettings: '' }));
      
      // 并行加载所有RAG设置
      const [
        embeddingModelResult,
        availableModelsResult,
        embeddingModelsResult,
        knowledgeBaseFilesResult,
        chunkSettingsResult
      ] = await Promise.all([
        invoke('get-store-value', 'embeddingModel'),
        invoke('get-available-models'),
        invoke('get-embedding-models'),
        invoke('list-kb-files'),
        invoke('get-rag-chunk-settings')
      ]);
      // 合并普通模型和嵌入模型
      const allModels = [
        ...(availableModelsResult.models || []),
        ...(embeddingModelsResult.models || [])
      ];
      // 批量更新Redux状态
      console.log('从API获取的chunkSettingsResult:', chunkSettingsResult);
      const finalChunkSize = chunkSettingsResult.chunkSize !== undefined ? chunkSettingsResult.chunkSize : 100;
      const finalChunkOverlap = chunkSettingsResult.chunkOverlap !== undefined ? chunkSettingsResult.chunkOverlap : 20;
      console.log('最终设置的chunkSize:', finalChunkSize, 'chunkOverlap:', finalChunkOverlap);
      
      dispatch(setAllRagSettings({
        embeddingModel: embeddingModelResult || '',
        availableModels: allModels,
        knowledgeBaseFiles: knowledgeBaseFilesResult.files || [],
        chunkSize: finalChunkSize,
        chunkOverlap: finalChunkOverlap,
        embeddingDimensions: 1024, // 使用默认维度
        isCustomDimensions: false // 默认使用模型维度
      }));
      // 同时更新根级别的嵌入模型状态，确保状态同步
      if (embeddingModelResult) {
        dispatch(setEmbeddingModel(embeddingModelResult));
      }
      
    } catch (error) {
      console.error('加载RAG设置失败:', error);
      dispatch(setRagError({ allSettings: '加载RAG设置失败，请重试' }));
    } finally {
      dispatch(setRagLoading({ allSettings: false }));
    }
  }, [invoke, dispatch]);

  // 刷新知识库文件列表
  const refreshKnowledgeBaseFiles = useCallback(async () => {
    try {
      dispatch(setRagLoading({ knowledgeBase: true }));
      dispatch(setRagError({ knowledgeBase: '' }));
      
      const result = await invoke('list-kb-files');
      if (result.success) {
        dispatch(setRagKnowledgeBaseFiles(result.files || []));
      } else {
        dispatch(setRagError({ knowledgeBase: result.error || '获取知识库文件失败' }));
      }
    } catch (error) {
      console.error('刷新知识库文件失败:', error);
      dispatch(setRagError({ knowledgeBase: '刷新知识库文件失败' }));
    } finally {
      dispatch(setRagLoading({ knowledgeBase: false }));
    }
  }, [invoke, dispatch]);

  // 初始化加载所有设置
  useEffect(() => {
    if (isOpen) {
      // 添加防抖，避免频繁加载
      const timeoutId = setTimeout(() => {
        loadAllRagSettings();
      }, 300);
      return () => clearTimeout(timeoutId);
    }
  }, [isOpen, loadAllRagSettings]);

  // 处理关闭
  const handleClose = () => {
    dispatch(setShowRagSettingsModal(false));
    if (onClose) onClose();
  };

  // 处理通知关闭
  const handleNotificationClose = () => {
    setNotification({ isOpen: false, message: '', success: false });
    if (notification.success) {
      handleClose();
    }
  };

  // 显示通知
  const showNotification = (message, success = true) => {
    setNotification({
      isOpen: true,
      message,
      success
    });
  };

  // 暴露保存方法给父组件
  useImperativeHandle(ref, () => ({
    handleSave: () => {
      // 这里可以协调子组件的保存操作
      console.log('RAG管理面板保存操作');
      showNotification('RAG设置保存成功！', true);
    },
    refreshKnowledgeBaseFiles
  }));

  // 处理嵌入模型变更
  const handleEmbeddingModelChange = (modelId) => {
    dispatch(setEmbeddingModel(modelId));
    // 同时更新RAG状态中的嵌入模型，确保状态同步
    dispatch(setRagEmbeddingModel(modelId));
  };


  // 统一保存处理函数
  const handleSave = async () => {
    try {
      console.log('[RAG设置保存] 开始保存RAG设置，当前Redux状态:', {
        embeddingModel: ragState.embeddingModel,
        chunkSize: ragState.chunkSize,
        chunkOverlap: ragState.chunkOverlap,
        retrievalTopK: ragState.retrievalTopK,
        embeddingDimensions: ragState.embeddingDimensions
      });

      // 保存所有RAG相关设置到持久化存储
      await Promise.all([
        setStoreValue('embeddingModel', ragState.embeddingModel),
        setStoreValue('ragChunkSize', ragState.chunkSize),
        setStoreValue('ragChunkOverlap', ragState.chunkOverlap),
        setStoreValue('retrievalTopK', ragState.retrievalTopK),
        setStoreValue('embeddingDimensions', ragState.embeddingDimensions)
      ]);
      console.log('[RAG设置保存] 存储保存完成');

      // 重新初始化嵌入函数以确保新设置立即生效
      try {
        await invoke('reinitialize-embedding-function');
        console.log('[RAG设置保存] 嵌入函数重新初始化完成');
      } catch (error) {
        console.warn('重新初始化嵌入函数时出错:', error);
      }

      // 通知保存成功
      showNotification('RAG设置保存成功！', true);
      
      console.log('[RAG设置保存] 保存流程完成');
      
      // 保存后重新加载设置以确保状态同步
      // 添加防抖，避免频繁加载
      const timeoutId = setTimeout(() => {
        loadAllRagSettings();
        console.log('[RAG设置保存] 设置重新加载已触发');
      }, 500);
      
    } catch (error) {
      console.error('RAG设置保存失败:', error);
      showNotification('RAG设置保存失败，请重试。', false);
    }
  };

  // 处理知识库文件更新
  const handleKnowledgeBaseUpdate = () => {
    refreshKnowledgeBaseFiles();
  };

  // 如果不打开，返回null
  if (!isOpen) return null;

  // 渲染当前激活标签页的内容
  const renderActiveTabContent = () => {
    switch (activeTab) {
      case 'rag-settings':
        return (
          <div className="rag-settings-tab">
            {/* 加载状态显示 */}
            {ragState.loading.allSettings && (
              <div className="loading-overlay">
                <FontAwesomeIcon icon={faSync} spin />
                <span>加载RAG设置中...</span>
              </div>
            )}
            
            {/* 错误状态显示 */}
            {ragState.errors.allSettings && (
              <div className="error-message">
                {ragState.errors.allSettings}
                <button onClick={loadAllRagSettings}>重试</button>
              </div>
            )}

            {/* 嵌入模型配置 */}
            <div className="settings-section">
              <h5>嵌入模型配置</h5>
              
              <div className="setting-item">
                <EmbeddingModelSelector
                  selectedModel={ragState.embeddingModel}
                  availableModels={ragState.availableModels}
                  onModelChange={handleEmbeddingModelChange}
                  showCurrentSelection={true}
                />
                <div className="setting-description">
                  用于RAG功能的文本嵌入模型（仅显示嵌入模型）
                </div>
              </div>

              {/* 嵌入向量维度设置 */}
              <EmbeddingDimensionsSettings
                embeddingModel={ragState.embeddingModel}
                onDimensionsChange={() => {}}
                onSaveComplete={onSaveComplete}
              />
            </div>
            {/* 文本分段参数配置 */}
            <div className="settings-section">
              <TextChunkingSettings
                onSaveComplete={onSaveComplete}
                chunkSize={ragState.chunkSize}
                chunkOverlap={ragState.chunkOverlap}
              />
            </div>
          </div>
        );
      case 'knowledge-base':
        return (
          <div className="knowledge-base-tab">
            {/* 知识库文件列表 */}
            <div className="settings-section">
              <div className="knowledge-base-panel-inline">
                <KnowledgeBaseSettings
                  onClose={null}
                  files={ragState.knowledgeBaseFiles}
                  loading={ragState.loading.knowledgeBase}
                  error={ragState.errors.knowledgeBase}
                  onRefresh={refreshKnowledgeBaseFiles}
                  onUpdate={handleKnowledgeBaseUpdate}
                />
              </div>
            </div>


          </div>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <div className="rag-settings-modal-content">
        {/* 主内容区域 */}
        <div className="rag-management-content">
          <div className="rag-management-panel">
            {/* 标签页导航 */}
            <div className="tab-navigation">
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

              {/* 内容区域 */}
              <div className="tab-content-area">
                {renderActiveTabContent()}
              </div>
            </div>
          </div>
        </div>

        {/* 操作按钮区域 */}
        <div className="tab-content-actions">
          <button className="save-button" onClick={handleSave}>
            <FontAwesomeIcon icon={faSave} />
            保存
          </button>
          <button className="cancel-button" onClick={handleClose}>
            <FontAwesomeIcon icon={faTimes} />
            关闭
          </button>
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
});

export default RagManagementPanel;