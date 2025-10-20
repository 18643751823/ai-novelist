import React, { useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUndo, faPlus, faEdit, faTrash } from '@fortawesome/free-solid-svg-icons';
import AiParametersSettings from './AiParametersSettings';
import AgentRagTab from './AgentRagTab';
import ConfirmationModal from '../others/ConfirmationModal';
import './GeneralSettingsPanel.css';

const GeneralSettingsPanel = ({
  defaultPrompts = {},
  localPrompts = {},
  localFeatureSettings = {},
  localAdditionalInfo = {},
  localAiParameters = {},
  localRagSettings = {},
  customModes = [],
  onPromptChange,
  onFeatureSettingChange,
  onAdditionalInfoChange,
  onAiParametersChange,
  onRagSettingsChange,
  onReset,
  onAddCustomMode,
  onEditCustomMode,
  onDeleteCustomMode,
  isLoadingPrompts = false
}) => {
  const [selectedMode, setSelectedMode] = useState('general');
  const [searchText, setSearchText] = useState('');
  const [showCustomModeForm, setShowCustomModeForm] = useState(false);
  const [editingMode, setEditingMode] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [newModeName, setNewModeName] = useState('');
  const [activeTab, setActiveTab] = useState('prompt'); // 'prompt', 'rag', 'ai'

  // 获取模式显示名称
  const getModeDisplayName = (mode) => {
    const names = {
      general: '通用',
      outline: '细纲',
      writing: '写作',
      adjustment: '调整'
    };
    
    // 如果是自定义模式，从customModes中查找
    if (mode.startsWith('custom_')) {
      const customMode = customModes.find(m => m.id === mode);
      return customMode ? customMode.name : mode;
    }
    
    return names[mode] || mode;
  };

  // 获取所有模式（内置 + 自定义）
  const getAllModes = () => {
    const builtInModes = Object.keys(defaultPrompts).map(mode => ({
      id: mode,
      name: getModeDisplayName(mode),
      type: 'builtin'
    }));
    
    const customModeList = customModes.map(mode => ({
      id: mode.id,
      name: mode.name,
      type: 'custom'
    }));
    
    return [...builtInModes, ...customModeList];
  };

  // 过滤模式列表
  const filteredModes = getAllModes().filter(mode =>
    mode.name.toLowerCase().includes(searchText.toLowerCase())
  );

  // 获取当前选中的模式详情
  const selectedModeDetail = {
    name: getModeDisplayName(selectedMode),
    defaultPrompt: defaultPrompts[selectedMode] || '',
    customPrompt: localPrompts[selectedMode] || '',
    featureSettings: localFeatureSettings[selectedMode] || {},
    additionalInfo: localAdditionalInfo[selectedMode] || {},
    aiParameters: localAiParameters[selectedMode] || {
      temperature: 0.7,
      top_p: 0.7,
      n: 1
    },
    type: selectedMode.startsWith('custom_') ? 'custom' : 'builtin'
  };

  // 渲染标签页内容
  const renderTabContent = () => {
    switch (activeTab) {
      case 'rag':
        return (
          <div className="tab-content">
            <AgentRagTab
              ragSettings={localRagSettings}
              onRagSettingsChange={onRagSettingsChange}
              customModes={customModes}
              selectedMode={selectedMode}
            />
          </div>
        );
      case 'ai':
        return (
          <div className="tab-content">
            <AiParametersSettings
              aiParameters={localAiParameters}
              onParametersChange={onAiParametersChange}
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
                onChange={(e) => onPromptChange && onPromptChange(selectedMode, e.target.value)}
                placeholder={selectedModeDetail.type === 'builtin' ? selectedModeDetail.defaultPrompt : `输入${selectedModeDetail.name}模式的自定义提示词...`}
                rows={4}
              />
              <button
                className="reset-button"
                onClick={() => onReset && onReset(selectedMode)}
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

  // 处理添加自定义模式
  const handleAddCustomMode = () => {
    if (newModeName.trim()) {
      const modeId = `custom_${Date.now()}`;
      onAddCustomMode && onAddCustomMode({
        id: modeId,
        name: newModeName.trim()
      });
      setNewModeName('');
      setShowCustomModeForm(false);
      setSelectedMode(modeId);
    }
  };

  // 处理编辑自定义模式
  const handleEditCustomMode = () => {
    if (newModeName.trim() && editingMode) {
      onEditCustomMode && onEditCustomMode(editingMode.id, {
        ...editingMode,
        name: newModeName.trim()
      });
      setNewModeName('');
      setShowCustomModeForm(false);
      setEditingMode(null);
    }
  };

  // 处理删除自定义模式
  const handleDeleteCustomMode = () => {
    if (selectedModeDetail.type === 'custom') {
      onDeleteCustomMode && onDeleteCustomMode(selectedMode);
      setShowDeleteConfirm(false);
      // 删除后切换到第一个模式
      const allModes = getAllModes();
      if (allModes.length > 0) {
        setSelectedMode(allModes[0].id);
      }
    }
  };

  // 开始编辑自定义模式
  const startEditCustomMode = () => {
    const customMode = customModes.find(m => m.id === selectedMode);
    if (customMode) {
      setEditingMode(customMode);
      setNewModeName(customMode.name);
      setShowCustomModeForm(true);
    }
  };

  return (
    <div className="general-settings-panel">
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
                    {localPrompts[mode.id] ? '已自定义' : '默认'}
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
                      onClick={editingMode ? handleEditCustomMode : handleAddCustomMode}
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
                    AI参数
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
          onConfirm={handleDeleteCustomMode}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
};

export default GeneralSettingsPanel;