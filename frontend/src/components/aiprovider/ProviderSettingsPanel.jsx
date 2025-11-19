import React, { useState, useEffect } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import providerConfigService from '../../services/providerConfigService';
import modelSelectionService from '../../services/modelSelectionService';
import ProviderList from './ProviderList';
import BuiltInProviderSettings from './providersettings/BuiltInProviderSettings';
import CustomProviderSettings from './providersettings/CustomProviderSettings';
import CustomProviderSettingsDetail from './providersettings/CustomProviderSettingsDetail';
import ConfirmationModal from '../others/ConfirmationModal';
import NotificationModal from '../others/NotificationModal';
import './ProviderSettingsPanel.css';

const ProviderSettingsPanel = ({ isOpen, onClose }) => {
  // 本地状态管理 - 不再使用Redux
  const [configs, setConfigs] = useState(providerConfigService.getDefaultProviderConfigs());
  const [providers, setProviders] = useState([]);
  const [availableModels, setAvailableModels] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [loading, setLoading] = useState(false);
  
  // UI状态
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

  // 加载提供商配置和列表
  const loadProviderConfigs = async () => {
    try {
      setLoading(true);
      
      // 并行加载提供商和模型列表
      const [providersResult, customProvidersResult, modelsResult] = await Promise.all([
        providerConfigService.getProviders(),
        providerConfigService.getCustomProviders(),
        modelSelectionService.getAvailableModels()
      ]);

      if (providersResult.success && customProvidersResult.success) {
        // 生成配置对象
        const configs = providerConfigService.getDefaultProviderConfigs();
        
        // 处理预设提供商的API密钥
        for (const [providerId, providerInfo] of Object.entries(providersResult.data)) {
          if (providerId === 'deepseek') {
            configs.deepseekApiKey = providerInfo.saved_api_key || '';
          } else if (providerId === 'openrouter') {
            configs.openrouterApiKey = providerInfo.saved_api_key || '';
          } else if (providerId === 'siliconflow') {
            configs.siliconflowApiKey = providerInfo.saved_api_key || '';
          } else if (providerId === 'aliyun') {
            configs.aliyunApiKey = providerInfo.saved_api_key || '';
          } else if (providerId === 'ollama') {
            configs.ollamaBaseUrl = providerInfo.base_url || 'http://127.0.0.1:11434';
          } else if (providerId === 'kimi') {
            configs.kimiApiKey = providerInfo.saved_api_key || '';
          } else if (providerId === 'zhipuai') {
            configs.zhipuaiApiKey = providerInfo.saved_api_key || '';
          } else if (providerId === 'gemini') {
            configs.geminiApiKey = providerInfo.saved_api_key || '';
          }
        }

        // 处理自定义提供商
        configs.customProviders = Object.values(customProvidersResult.data).map(provider => ({
          providerName: provider.name,
          baseUrl: provider.base_url,
          apiKey: provider.saved_api_key || '',
          enabled: true
        }));

        setConfigs(configs);
        
        // 生成提供商列表
        const providerList = providerConfigService.generateProviderList(configs);
        setProviders(providerList);
      }

      if (modelsResult.success) {
        setAvailableModels(modelsResult.models);
      }

    } catch (error) {
      console.error('加载提供商配置失败:', error);
      showNotification('加载提供商配置失败，请重试。', false);
    } finally {
      setLoading(false);
    }
  };

  // 加载可用模型列表
  const loadAvailableModels = async () => {
    try {
      const modelsResult = await modelSelectionService.getAvailableModels();
      if (modelsResult.success) {
        setAvailableModels(modelsResult.models);
      }
    } catch (error) {
      console.error('加载模型列表失败:', error);
    }
  };

  // 保存提供商配置
  const handleSave = async () => {
    try {
      setLoading(true);
      
      const result = await providerConfigService.saveProviderConfigs(configs);
      
      if (result.success) {
        // 重新初始化模型提供者
        await modelSelectionService.refreshModels();
        
        // 重新加载配置和模型列表以确保状态一致
        await Promise.all([
          loadProviderConfigs(),
          loadAvailableModels()
        ]);
        
        showNotification('提供商配置保存成功！', true);
      } else {
        showNotification('提供商配置保存失败，请重试。', false);
      }
      
    } catch (error) {
      console.error('保存提供商配置失败:', error);
      showNotification('提供商配置保存失败，请重试。', false);
    } finally {
      setLoading(false);
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

  // 处理通知关闭
  const handleNotificationClose = () => {
    const shouldClose = notification.success;
    setNotification({ isOpen: false, message: '', success: false });
    if (shouldClose) {
      handleClose();
    }
  };

  // 处理关闭
  const handleClose = () => {
    if (onClose) onClose();
  };

  // 处理删除自定义提供商
  const handleDeleteCustomProvider = async (providerName) => {
    try {
      // 使用新的API删除自定义提供商
      const result = await providerConfigService.deleteCustomProvider(providerName);
      
      if (result.success) {
        // 重新加载提供商配置
        await loadProviderConfigs();
        
        // 如果删除的是当前选中的提供商，清空选择
        if (selectedProvider === providerName) {
          setSelectedProvider('');
        }
        
        showNotification(`自定义提供商 "${providerName}" 已删除`, true);
      } else {
        showNotification('删除提供商失败，请重试。', false);
      }
    } catch (error) {
      console.error('删除自定义提供商失败:', error);
      showNotification('删除提供商失败，请重试。', false);
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
    loadProviderConfigs(); // 刷新提供商列表
  };

  // 处理关闭自定义提供商表单
  const handleCloseCustomProviderForm = () => {
    setShowCustomProviderForm(false);
    setEditingProvider(null);
  };

  // 更新配置值
  const updateConfigValue = (key, value) => {
    setConfigs(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // 组件挂载时加载配置
  useEffect(() => {
    if (isOpen) {
      loadProviderConfigs();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="prompt-manager-modal-content">
      {/* 内容区域 */}
      <div className="tab-content-container">
        <div className="tab-content-actions">
          <button className="save-button" onClick={handleSave} disabled={loading}>
            {loading ? '保存中...' : '保存'}
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
                onProviderSelect={setSelectedProvider}
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
                      configs={configs}
                      onConfigsUpdate={setConfigs}
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
                          configs={configs}
                          onConfigsUpdate={updateConfigValue}
                          availableModels={availableModels}
                        />
                      )}

                      {/* 自定义提供商设置 */}
                      {isCustomProvider && (
                        <CustomProviderSettingsDetail
                          provider={configs.customProviders.find(p => p.providerName === selectedProvider)}
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