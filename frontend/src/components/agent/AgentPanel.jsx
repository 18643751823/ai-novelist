
import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import {
  setCustomPromptForMode,
  resetCustomPromptForMode,
  setModeFeatureSetting,
  resetModeFeatureSettings,
  setAdditionalInfoForMode,
  resetAdditionalInfoForMode,
  setAiParametersForMode,
  resetAiParametersForMode,
  setRagTableNames
} from '../../store/slices/chatSlice';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUndo, faSave, faTimes, faPlus, faEdit, faTrash } from '@fortawesome/free-solid-svg-icons';
import useIpcRenderer from '../../hooks/useIpcRenderer';
import useModeManager from './ModeManager';
import NotificationModal from '../others/NotificationModal';
import ConfirmationModal from '../others/ConfirmationModal';
import ChatParameters from '././parameterTab/ChatParameters';
import AgentRagTab from './ragTab/AgentRagTab';
import './AgentPanel.css';

/**
 * 统一的Agent面板组件 - 整合了原来的三个GeneralSettings文件的功能
 */
const AgentPanel = ({ isOpen = true, onClose }) => {
  const dispatch = useDispatch();
  const { invoke, getStoreValue, setStoreValue } = useIpcRenderer();
  
  // 统一使用Redux状态作为单一数据源
  const {
    customPrompts,
    modeFeatureSettings,
    additionalInfo,
    aiParameters,
    contextLimitSettings
  } = useSelector((state) => state.chat.mode);
  
  // UI状态 - 专注于展示和交互
  const [defaultPrompts, setDefaultPrompts] = useState({});
  const [isLoadingPrompts, setIsLoadingPrompts] = useState(false);
  const [selectedMode, setSelectedMode] = useState('general');
  const [searchText, setSearchText] = useState('');
  const [showCustomModeForm, setShowCustomModeForm] = useState(false);
  const [editingMode, setEditingMode] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [newModeName, setNewModeName] = useState('');
  const [activeTab, setActiveTab] = useState('prompt');
  const [notification, setNotification] = useState({
    isOpen: false,
    message: '',
    success: false
  });

  // 使用模式管理模块 - 单一数据源
  const modeManager = useModeManager();

  // 从后端获取默认提示词
  const fetchDefaultPrompts = async () => {
    setIsLoadingPrompts(true);
    try {
      const result = await invoke('get-default-prompts');
      if (result.success) {
        setDefaultPrompts(result.prompts);
      } else {
        // 如果后端获取失败，使用内置默认值作为fallback
        setDefaultPrompts(modeManager.getAllDefaultPrompts());
      }
    } catch (error) {
      console.error('调用获取默认提示词API失败:', error);
      // 如果API调用失败，使用内置默认值
      setDefaultPrompts(modeManager.getAllDefaultPrompts());
    } finally {
      setIsLoadingPrompts(false);
    }
  };

  // 统一数据初始化
  const initializeData = async () => {
    try {
      setIsLoadingPrompts(true);
      
      // 并行加载所有必要数据
      await Promise.all([
        fetchDefaultPrompts()
      ]);
      
    } catch (error) {
      console.error('[AgentPanel] 数据初始化失败:', error);
    } finally {
      setIsLoadingPrompts(false);
    }
  };

  useEffect(() => {
    initializeData();
  }, []);


  // 统一设置变更处理 - 直接更新Redux状态
  const handlePromptChange = (mode, value) => {
    dispatch(setCustomPromptForMode({ mode, prompt: value }));
  };

  const handleFeatureSettingChange = (mode, feature, enabled) => {
    dispatch(setModeFeatureSetting({ mode, feature, enabled }));
  };

  const handleAdditionalInfoChange = (mode, field, value) => {
    const currentInfo = additionalInfo[mode] || {};
    const updatedInfo = {
      ...currentInfo,
      [field]: value
    };
    dispatch(setAdditionalInfoForMode({ mode, info: updatedInfo }));
  };

  const handleAiParametersChange = (mode, newParameters) => {
    dispatch(setAiParametersForMode({ mode, parameters: newParameters }));
  };

  const handleRagSettingsChange = (newRagSettings) => {
    // 直接更新Redux状态
    for (const mode of Object.keys(newRagSettings)) {
      const settings = newRagSettings[mode];
      if (settings) {
        // 保存RAG检索启用状态
        dispatch(setModeFeatureSetting({
          mode,
          feature: 'ragRetrievalEnabled',
          enabled: settings.ragRetrievalEnabled || false
        }));
        
        // 保存文件选择
        const tableNames = settings.ragTableNames && settings.ragTableNames.length > 0
          ? settings.ragTableNames
          : null;
        dispatch(setRagTableNames({
          mode,
          tableNames: tableNames
        }));
      }
    }
  };

  const handleReset = (mode) => {
    dispatch(resetCustomPromptForMode({ mode }));
    dispatch(resetModeFeatureSettings({ mode }));
    dispatch(resetAdditionalInfoForMode({ mode }));
  };

  // 保存设置 - 直接使用Redux状态
  const handleSave = async () => {
    try {
      console.log('[AgentPanel] 开始保存通用设置');
      
      // 保存到持久化存储 - 直接使用Redux状态
      await invoke('set-store-value', 'customPrompts', customPrompts);
      await invoke('set-store-value', 'modeFeatureSettings', modeFeatureSettings);
      await invoke('set-store-value', 'additionalInfo', additionalInfo);
      await invoke('set-store-value', 'aiParameters', aiParameters);
      
      // 通知保存成功
      showNotification('通用设置保存成功！', true);
    } catch (error) {
      console.error('保存通用设置失败:', error);
      showNotification('通用设置保存失败，请重试。', false);
    }
  };

  // 通知处理
  const showNotification = (message, success = true) => {
    setNotification({
      isOpen: true,
      message,
      success
    });
  };

  const handleNotificationClose = () => {
    setNotification({ isOpen: false, message: '', success: false });
    if (notification.success && onClose) {
      onClose();
    }
  };

  // 模式管理相关函数 - 通过ModeManager获取
  const getModeDisplayName = (mode) => {
    return modeManager.getModeDisplayName(mode);
  };

  const getAllModes = () => {
    return modeManager.getAllModes();
  };

  const filteredModes = modeManager.filterModes(searchText);

  // 获取当前选中的模式详情 - 使用Redux状态
  const selectedModeDetail = {
    name: getModeDisplayName(selectedMode),
    defaultPrompt: defaultPrompts[selectedMode] || '',
    customPrompt: customPrompts[selectedMode] || '',
    featureSettings: modeFeatureSettings[selectedMode] || {},
    additionalInfo: additionalInfo[selectedMode] || {},
    aiParameters: aiParameters[selectedMode] || {
      temperature: 0.7,
      top_p: 0.7,
      n: 1
    },
    type: modeManager.isCustomMode(selectedMode) ? 'custom' : 'builtin'
  };

  // 处理添加自定义模式
  const handleAddCustomModeUI = async () => {
    if (newModeName.trim()) {
      const validationError = modeManager.validateModeName(newModeName);
      if (validationError) {
        showNotification(validationError, false);
        return;
      }
      
      try {
        const modeId = modeManager.generateCustomModeId();
        await modeManager.addCustomMode({
          id: modeId,
          name: newModeName.trim()
        });
        setNewModeName('');
        setShowCustomModeForm(false);
        setSelectedMode(modeId);
        showNotification('自定义模式添加成功', true);
      } catch (error) {
        showNotification('添加自定义模式失败', false);
      }
    }
  };

  // 处理编辑自定义模式
  const handleEditCustomModeUI = async () => {
    if (newModeName.trim() && editingMode) {
      const validationError = modeManager.validateModeName(newModeName);
      if (validationError) {
        showNotification(validationError, false);
        return;
      }
      
      try {
        await modeManager.editCustomMode(editingMode.id, {
          ...editingMode,
          name: newModeName.trim()
        });
        setNewModeName('');
        setShowCustomModeForm(false);
        setEditingMode(null);
        showNotification('自定义模式编辑成功', true);
      } catch (error) {
        showNotification('编辑自定义模式失败', false);
      }
    }
  };

  // 处理删除自定义模式
  const handleDeleteCustomModeUI = async () => {
    if (selectedModeDetail.type === 'custom') {
      try {
        await modeManager.deleteCustomMode(selectedMode);
        await modeManager.cleanupModeSettings(selectedMode);
        setShowDeleteConfirm(false);
        // 删除后切换到第一个模式
        const allModes = getAllModes();
        if (allModes.length > 0) {
          setSelectedMode(allModes[0].id);
        }
        showNotification('自定义模式删除成功', true);
      } catch (error) {
        showNotification('删除自定义模式失败', false);
      }
    }
  };

  // 开始编辑自定义模式
  const startEditCustomMode = () => {
    const customMode = modeManager.customModes.find(m => m.id === selectedMode);
    if (customMode) {
      setEditingMode(customMode);
      setNewModeName(customMode.name);
      setShowCustomModeForm(true);
    }
  };

  // 渲染标签页内容
  const renderTabContent = () => {
    switch (activeTab) {
      case 'rag':
        return (
          <div className="tab-content">
            <AgentRagTab
              ragSettings={modeFeatureSettings}
              onRagSettingsChange={handleRagSettingsChange}
              customModes={modeManager.customModes}
              selectedMode={selectedMode}
            />
          </div>
        );
      case 'ai':
        return (
          <div className="tab-content">
            <ChatParameters
              aiParameters={aiParameters}
              onParametersChange={handleAiParametersChange}
              mode={selectedMode}
            />
          </div>
        );
      case 'prompt':
      default:
        return (
          <div className="prompt-sections">
            {/* 自定义提示词 */}
            <div className="custom-prompt">
              <h4>自定义提示词:</h4>
              <textarea
                value={selectedModeDetail.customPrompt}
                onChange={(e) => handlePromptChange(selectedMode, e.target.value)}
                placeholder={selectedModeDetail.type === 'builtin' ? selectedModeDetail.defaultPrompt : `输入${selectedModeDetail.name}模式的自定义提示词...`}
                rows={4}
              />
              <button
                className="reset-button"
                onClick={() => handleReset(selectedMode)}
                disabled={!selectedModeDetail.customPrompt}
              >
                <FontAwesomeIcon icon={faUndo} /> 重置
              </button>
            </div>

            {/* 功能设置 */}
            <div className="feature-settings">
              <h4>功能设置:</h4>
              
              {/* 工具功能状态说明 */}
              {selectedMode === 'general' ? (
                <div className="feature-info">
                  <strong>工具功能：始终启用</strong>
                  <div className="feature-description">
                    通用模式下AI可以自动使用工具进行文件操作、代码编辑等
                  </div>
                </div>
              ) : (
                <div className="feature-info">
                  <strong>工具功能：禁用</strong>
                  <div className="feature-description">
                    此模式下AI仅提供对话功能，无法使用工具
                  </div>
                </div>
              )}
            </div>
          </div>
        );
    }
  };

  if (!isOpen) return null;

  return (
    <div className="general-settings-panel">
      {/* 头部操作栏 */}
      <div className="agent-panel-header">
        <h2>Agent设置面板</h2>
        <div className="header-actions">
          <button className="save-button" onClick={handleSave}>
            <FontAwesomeIcon icon={faSave} /> 保存
          </button>
          {onClose && (
            <button className="close-button" onClick={onClose}>
              <FontAwesomeIcon icon={faTimes} /> 关闭
            </button>
          )}
        </div>
      </div>

      <PanelGroup direction="horizontal" className="settings-panel-group">
        {/* 左侧模式列表 */}
        <Panel defaultSize={25} minSize={0} maxSize={100} className="mode-list-panel">
          <div className="mode-list-container">
            <div className="mode-list-header">
              <h3>模式设置</h3>
              <div className="search-container">
                <input
                  type="text"
                  placeholder="搜索模式..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="mode-search"
                />
              </div>
            </div>
            
            <div className="mode-list">
              {filteredModes.map(mode => (
                <div
                  key={mode.id}
                  className={`mode-item ${selectedMode === mode.id ? 'active' : ''}`}
                  onClick={() => setSelectedMode(mode.id)}
                >
                  <div className="mode-info">
                    <div className="mode-name">{mode.name}</div>
                    <div className="mode-type">
                      {mode.type === 'custom' ? '自定义模式' : '内置模式'}
                    </div>
                  </div>
                  <div className="mode-status">
                    {customPrompts[mode.id] ? '已自定义' : '默认'}
                  </div>
                </div>
              ))}
            </div>

            <div className="mode-list-actions">
              <button
                className="add-mode-btn"
                onClick={() => {
                  setShowCustomModeForm(true);
                  setEditingMode(null);
                  setNewModeName('');
                }}
              >
                <FontAwesomeIcon icon={faPlus} /> 添加自定义模式
              </button>
            </div>
          </div>
        </Panel>

        {/* 分隔条 */}
        <PanelResizeHandle className="panel-resize-handle">
          <div className="resize-handle-inner" />
        </PanelResizeHandle>

        {/* 右侧设置面板 */}
        <Panel minSize={0} maxSize={100} className="mode-settings-panel">
          <div className="mode-settings-container">
            {isLoadingPrompts ? (
              <div className="loading-prompts">
                <p>正在加载默认提示词...</p>
              </div>
            ) : Object.keys(defaultPrompts).length === 0 ? (
              <div className="no-prompts">
                <p>无法加载默认提示词</p>
              </div>
            ) : showCustomModeForm ? (
              <div className="custom-mode-form-container">
                <div className="custom-mode-form-header">
                  <h3>{editingMode ? '编辑自定义模式' : '添加自定义模式'}</h3>
                  <button
                    className="close-form-btn"
                    onClick={() => {
                      setShowCustomModeForm(false);
                      setEditingMode(null);
                      setNewModeName('');
                    }}
                  >
                    ×
                  </button>
                </div>
                <div className="custom-mode-form">
                  <div className="setting-group">
                    <label>模式名称</label>
                    <input
                      type="text"
                      value={newModeName}
                      onChange={(e) => setNewModeName(e.target.value)}
                      placeholder="输入自定义模式名称..."
                    />
                  </div>
                  <div className="form-actions">
                    <button
                      className="save-btn"
                      onClick={editingMode ? handleEditCustomModeUI : handleAddCustomModeUI}
                      disabled={!newModeName.trim()}
                    >
                      {editingMode ? '保存' : '添加'}
                    </button>
                    <button
                      className="cancel-btn"
                      onClick={() => {
                        setShowCustomModeForm(false);
                        setEditingMode(null);
                        setNewModeName('');
                      }}
                    >
                      取消
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mode-settings-content">
                <div className="mode-settings-header">
                  <h3>{selectedModeDetail.name}模式设置</h3>
                  {selectedModeDetail.type === 'custom' && (
                    <div className="mode-actions">
                      <button
                        className="edit-mode-btn"
                        onClick={startEditCustomMode}
                        title="编辑模式名称"
                      >
                        <FontAwesomeIcon icon={faEdit} />
                      </button>
                      <button
                        className="delete-mode-btn"
                        onClick={() => setShowDeleteConfirm(true)}
                        title="删除模式"
                      >
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    </div>
                  )}
                </div>

                {/* 标签页导航 */}
                <div className="settings-tabs">
                  <button
                    className={`tab-button ${activeTab === 'prompt' ? 'active' : ''}`}
                    onClick={() => setActiveTab('prompt')}
                  >
                    提示词设置
                  </button>
                  <button
                    className={`tab-button ${activeTab === 'rag' ? 'active' : ''}`}
                    onClick={() => setActiveTab('rag')}
                  >
                    RAG设置
                  </button>
                  <button
                    className={`tab-button ${activeTab === 'ai' ? 'active' : ''}`}
                    onClick={() => setActiveTab('ai')}
                  >
                    聊天参数
                  </button>
                </div>
  
                {/* 标签页内容 */}
                {renderTabContent()}
              </div>
            )}
          </div>
        </Panel>
      </PanelGroup>

      {/* 删除确认对话框 */}
      {showDeleteConfirm && (
        <ConfirmationModal
          message={`确定要删除自定义模式 "${selectedModeDetail.name}" 吗？此操作不可撤销。`}
          onConfirm={handleDeleteCustomModeUI}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

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

export default AgentPanel;