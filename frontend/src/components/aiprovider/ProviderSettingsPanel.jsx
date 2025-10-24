import React, { useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useSelector, useDispatch } from 'react-redux';
import { setShowApiSettingsModal } from '../../store/slices/chatSlice';
import useProviderData from '../../hooks/useProviderData';
import useIpcRenderer from '../../hooks/useIpcRenderer';
import ProviderList from './ProviderList';
import BuiltInProviderSettings from './providersettings/BuiltInProviderSettings';
import CustomProviderSettings from './providersettings/CustomProviderSettings';
import CustomProviderSettingsDetail from './providersettings/CustomProviderSettingsDetail';
import ConfirmationModal from '../others/ConfirmationModal';
import NotificationModal from '../others/NotificationModal';
import './ProviderSettingsPanel.css';

const ProviderSettingsPanel = ({ isOpen, onClose }) => {
  const dispatch = useDispatch();
  const { setStoreValue, reinitializeModelProvider, reinitializeAliyunEmbedding } = useIpcRenderer();
  
  const {
    selectedModel,
    selectedProvider,
    deepseekApiKey,
    openrouterApiKey,
    siliconflowApiKey,
    aliyunApiKey,
    aliyunEmbeddingApiKey,
    intentAnalysisModel,
    ollamaBaseUrl
  } = useSelector((state) => state.chat);

  // 使用数据管理钩子
  const {
    providers,
    customProviders,
    loading,
    loadProviders,
    handleRedetectOllama,
    handleDeleteCustomProvider
  } = useProviderData();

  // 本地状态管理
  const [searchText, setSearchText] = useState('');
  const [showCustomProviderForm, setShowCustomProviderForm] = useState(false);
  const [editingProvider, setEditingProvider] = useState(null);
  const [notification, setNotification] = useState({
    isOpen: false,
    message: '',
    success: false
  });

  // 获取当前选中的提供商详情
  const selectedProviderDetail = providers.find(p => p.id === selectedProvider) || {};
  const isCustomProvider = selectedProviderDetail.type === 'custom';

  // 处理关闭
  const handleClose = () => {
    dispatch(setShowApiSettingsModal(false));
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

  // 保存处理函数
  const handleSave = async () => {
    try {
      console.log('[API设置保存] 开始保存，当前Redux状态:', {
        selectedModel,
        selectedProvider,
        deepseekApiKey: deepseekApiKey ? '已设置(隐藏)' : '未设置',
        openrouterApiKey: openrouterApiKey ? '已设置(隐藏)' : '未设置',
        siliconflowApiKey: siliconflowApiKey ? '已设置(隐藏)' : '未设置',
        aliyunApiKey: aliyunApiKey ? '已设置(隐藏)' : '未设置',
        aliyunEmbeddingApiKey: aliyunEmbeddingApiKey ? '已设置(隐藏)' : '未设置',
        ollamaBaseUrl,
        intentAnalysisModel
      });

      // 保存到持久化存储 - 使用并行Promise.all减少等待时间
      await Promise.all([
        setStoreValue('deepseekApiKey', deepseekApiKey),
        setStoreValue('openrouterApiKey', openrouterApiKey),
        setStoreValue('siliconflowApiKey', siliconflowApiKey),
        setStoreValue('aliyunApiKey', aliyunApiKey),
        setStoreValue('aliyunEmbeddingApiKey', aliyunEmbeddingApiKey),
        setStoreValue('ollamaBaseUrl', ollamaBaseUrl),
        setStoreValue('intentAnalysisModel', intentAnalysisModel),
        setStoreValue('selectedModel', selectedModel),
        setStoreValue('selectedProvider', selectedProvider)
      ]);

      console.log('[API设置保存] 存储保存完成，保存的值:', {
        selectedModel,
        selectedProvider,
        intentAnalysisModel,
        ollamaBaseUrl
      });

      // 重新初始化API提供者以确保新设置立即生效
      try {
        // 重新初始化模型提供者
        await reinitializeModelProvider();
        
        // 重新初始化阿里云嵌入函数
        await reinitializeAliyunEmbedding();
        console.log('[API设置保存] API重新初始化完成');
      } catch (error) {
        console.warn('重新初始化API时出错:', error);
      }

      // 通知保存成功
      showNotification('API设置保存成功！', true);
      console.log('[API设置保存] 保存流程完成，通知已发送');
      
    } catch (error) {
      console.error('保存API设置失败:', error);
      // 通知保存失败
      showNotification('API设置保存失败，请重试。', false);
    }
  };

  // 处理编辑自定义提供商
  const handleEditCustomProvider = (provider) => {
    setEditingProvider(provider);
    setShowCustomProviderForm(true);
  };

  // 处理自定义提供商保存完成
  const handleCustomProviderSaveComplete = () => {
    setShowCustomProviderForm(false);
    setEditingProvider(null);
    loadProviders(); // 刷新提供商列表
  };

  // 处理关闭自定义提供商表单
  const handleCloseCustomProviderForm = () => {
    setShowCustomProviderForm(false);
    setEditingProvider(null);
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
        
        <div className="provider-settings-panel">
          <PanelGroup direction="horizontal" className="provider-panel-group">
            {/* 左侧提供商列表 */}
            <Panel defaultSize={25} minSize={0} maxSize={100} className="provider-list-panel">
              <ProviderList
                providers={providers}
                searchText={searchText}
                onSearchChange={setSearchText}
                selectedProvider={selectedProvider}
                onAddProvider={() => setShowCustomProviderForm(true)}
              />
            </Panel>

            {/* 分隔条 */}
            <PanelResizeHandle className="panel-resize-handle">
              <div className="resize-handle-inner" />
            </PanelResizeHandle>

            {/* 右侧设置面板 */}
            <Panel minSize={0} maxSize={100} className="provider-settings-panel">
              <div className="provider-settings-container">
                {showCustomProviderForm ? (
                  <div className="custom-provider-form-container">
                    <div className="custom-provider-form-header">
                      <h3>{editingProvider ? '编辑' : '添加'}自定义提供商</h3>
                      <button
                        className="close-form-btn"
                        onClick={handleCloseCustomProviderForm}
                      >
                        ×
                      </button>
                    </div>
                    <CustomProviderSettings
                      onSaveComplete={handleCustomProviderSaveComplete}
                      editingProvider={editingProvider}
                    />
                  </div>
                ) : selectedProvider ? (
                  <>
                    <div className="provider-settings-header">
                      <h3>{selectedProviderDetail.name} 设置</h3>
                    </div>

                    <div className="provider-settings-content">
                      {/* 内置提供商设置 */}
                      {!isCustomProvider && (
                        <BuiltInProviderSettings
                          providerId={selectedProvider}
                          onRedetectOllama={handleRedetectOllama}
                        />
                      )}

                      {/* 自定义提供商设置 */}
                      {isCustomProvider && (
                        <CustomProviderSettingsDetail
                          provider={customProviders.find(p => p.providerName === selectedProvider)}
                          onEdit={handleEditCustomProvider}
                          onDelete={handleDeleteCustomProvider}
                        />
                      )}
                    </div>
                  </>
                ) : (
                  <div className="no-provider-selected">
                    <p>请从左侧选择一个提供商进行配置</p>
                  </div>
                )}
              </div>
            </Panel>
          </PanelGroup>
        </div>
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

export default ProviderSettingsPanel;