import React, { useState, useEffect, useCallback } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useSelector, useDispatch } from 'react-redux';
import {
  setSelectedProvider,
  setSelectedModel,
  setDeepseekApiKey,
  setOpenrouterApiKey,
  setSiliconflowApiKey,
  setAliyunApiKey,
  setOllamaBaseUrl,
  setAvailableModels
} from '../../store/slices/chatSlice';
import useIpcRenderer from '../../hooks/useIpcRenderer';
import CustomProviderSettings from './CustomProviderSettings';
import ConfirmationModal from '../ConfirmationModal';
import './ProviderSettingsPanel.css';

const ProviderSettingsPanel = () => {
  const dispatch = useDispatch();
  const { invoke } = useIpcRenderer();
  const { selectedProvider, selectedModel, availableModels } = useSelector((state) => state.chat);
  
  const [providers, setProviders] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [customProviders, setCustomProviders] = useState([]);
  const [showCustomProviderForm, setShowCustomProviderForm] = useState(false);
  const [editingProvider, setEditingProvider] = useState(null);

  // 加载提供商列表
  // 加载提供商列表
  const loadProviders = useCallback(async () => {
    try {
      // 获取内置提供商
      const builtInProviders = [
        { id: 'deepseek', name: 'DeepSeek', type: 'builtin', enabled: true },
        { id: 'openrouter', name: 'OpenRouter', type: 'builtin', enabled: true },
        { id: 'ollama', name: 'Ollama', type: 'builtin', enabled: true },
        { id: 'siliconflow', name: '硅基流动', type: 'builtin', enabled: true },
        { id: 'aliyun', name: '阿里云百炼', type: 'builtin', enabled: true }
      ];

      // 获取自定义提供商
      const storedCustomProviders = await invoke('get-store-value', 'customProviders') || [];
      setCustomProviders(storedCustomProviders);

      const allProviders = [
        ...builtInProviders,
        ...storedCustomProviders.map(p => ({
          id: p.providerName,
          name: p.providerName,
          type: 'custom',
          enabled: p.enabled
        }))
      ];

      setProviders(allProviders);

      // 如果没有选中提供商，默认选择第一个
      if (!selectedProvider && allProviders.length > 0) {
        dispatch(setSelectedProvider(allProviders[0].id));
      }
    } catch (error) {
      console.error('加载提供商列表失败:', error);
    }
  }, [invoke, selectedProvider, dispatch]);

  // 处理编辑自定义提供商
  const handleEditCustomProvider = (provider) => {
    setEditingProvider(provider);
    setShowCustomProviderForm(true);
  };

  // 处理删除自定义提供商
  const handleDeleteCustomProvider = async (providerName) => {
    try {
      // 获取当前自定义提供商列表
      const storedCustomProviders = await invoke('get-store-value', 'customProviders') || [];
      
      // 过滤掉要删除的提供商
      const updatedProviders = storedCustomProviders.filter(p => p.providerName !== providerName);
      
      // 保存更新后的列表
      await invoke('set-store-value', 'customProviders', updatedProviders);
      
      // 重新加载提供商列表
      await loadProviders();
      
      // 如果删除的是当前选中的提供商，清除选中状态
      if (selectedProvider === providerName) {
        dispatch(setSelectedProvider(null));
      }
      
      console.log(`已删除自定义提供商: ${providerName}`);
    } catch (error) {
      console.error('删除自定义提供商失败:', error);
    }
  };
  // 加载可用模型列表
  const loadAvailableModels = useCallback(async () => {
    try {
      const models = await invoke('get-available-models');
      if (models.success) {
        dispatch(setAvailableModels(models.models));
        console.log(`[提供商设置] 加载到 ${models.models.length} 个模型`);
      } else {
        console.warn('[提供商设置] 获取模型列表失败，使用空列表:', models.error);
        dispatch(setAvailableModels([]));
      }
    } catch (error) {
      console.error('加载模型列表失败:', error);
    }
  }, [invoke, dispatch]);

  // Ollama服务重连
  const handleRedetectOllama = async () => {
    try {
      const result = await invoke('redetect-ollama');
      if (result.success) {
        loadAvailableModels(); // 重新加载模型列表
      } else {
        console.error('Ollama服务重新检测失败:', result.error);
      }
    } catch (error) {
      console.error('调用Ollama重连失败:', error);
    }
  };

  useEffect(() => {
    loadProviders();
    loadAvailableModels();
  }, [loadProviders, loadAvailableModels]);

  // 过滤提供商列表
  const filteredProviders = providers.filter(provider =>
    provider.name.toLowerCase().includes(searchText.toLowerCase())
  );

  // 获取当前选中的提供商详情
  const selectedProviderDetail = providers.find(p => p.id === selectedProvider) || {};
  const isCustomProvider = selectedProviderDetail.type === 'custom';

  return (
    <div className="provider-settings-panel">
      <PanelGroup direction="horizontal" className="provider-panel-group">
        {/* 左侧提供商列表 */}
        <Panel defaultSize={25} minSize={0} maxSize={100} className="provider-list-panel">
          <div className="provider-list-container">
            <div className="provider-list-header">
              <h3>AI提供商</h3>
              <div className="search-container">
                <input
                  type="text"
                  placeholder="搜索提供商..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="provider-search"
                />
              </div>
            </div>
            
            <div className="provider-list">
              {filteredProviders.map(provider => (
                <div
                  key={provider.id}
                  className={`provider-item ${selectedProvider === provider.id ? 'active' : ''}`}
                  onClick={() => dispatch(setSelectedProvider(provider.id))}
                >
                  <div className="provider-info">
                    <div className="provider-name">{provider.name}</div>
                  </div>
                  <div className={`provider-status ${provider.enabled ? 'enabled' : 'disabled'}`}>
                    {provider.enabled ? '启用' : '禁用'}
                  </div>
                </div>
              ))}
            </div>

            <div className="provider-list-actions">
              <button
                className="add-provider-btn"
                onClick={() => setShowCustomProviderForm(true)}
              >
                + 添加自定义提供商
              </button>
            </div>
          </div>
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
                  <h3>添加自定义提供商</h3>
                  <button
                    className="close-form-btn"
                    onClick={() => {
                      setShowCustomProviderForm(false);
                      setEditingProvider(null);
                    }}
                  >
                    ×
                  </button>
                </div>
                <CustomProviderSettings
                  onSaveComplete={() => {
                    setShowCustomProviderForm(false);
                    setEditingProvider(null);
                    loadProviders(); // 刷新提供商列表
                  }}
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
  );
};

// 内置提供商设置组件
const BuiltInProviderSettings = ({ providerId, onRedetectOllama }) => {
  const dispatch = useDispatch();
  const { invoke } = useIpcRenderer();
  const {
    deepseekApiKey,
    openrouterApiKey,
    siliconflowApiKey,
    aliyunApiKey,
    ollamaBaseUrl,
    selectedModel,
    availableModels
  } = useSelector((state) => ({
    deepseekApiKey: state.chat.deepseekApiKey,
    openrouterApiKey: state.chat.openrouterApiKey,
    siliconflowApiKey: state.chat.siliconflowApiKey,
    aliyunApiKey: state.chat.aliyunApiKey,
    ollamaBaseUrl: state.chat.ollamaBaseUrl,
    selectedModel: state.chat.selectedModel,
    availableModels: state.chat.availableModels
  }));




  const getProviderConfig = () => {
    const configs = {
      deepseek: {
        label: 'API Key',
        placeholder: '请输入您的 DeepSeek API Key',
        helpLink: 'https://platform.deepseek.com/',
        helpText: '获取地址：DeepSeek Platform'
      },
      openrouter: {
        label: 'API Key',
        placeholder: '请输入您的 OpenRouter API Key',
        helpLink: 'https://openrouter.ai/',
        helpText: '获取地址：OpenRouter'
      },
      siliconflow: {
        label: 'API Key',
        placeholder: '请输入您的硅基流动 API Key',
        helpLink: 'https://siliconflow.cn/',
        helpText: '获取地址：硅基流动官网'
      },
      aliyun: {
        label: 'API Key',
        placeholder: '请输入您的阿里云百炼 API Key',
        helpLink: 'https://dashscope.aliyun.com/',
        helpText: '获取地址：阿里云百炼控制台'
      },
      ollama: {
        label: '服务地址',
        placeholder: 'http://127.0.0.1:11434',
        helpText: '本地运行的 Ollama 服务地址，默认: http://127.0.0.1:11434'
      }
    };
    return configs[providerId] || {};
  };

  const config = getProviderConfig();

  return (
    <div className="builtin-provider-settings">
      <div className="setting-group">
        <label htmlFor={`${providerId}-config`}>
          {config.label}
        </label>
        
        {providerId === 'ollama' ? (
          <input
            type="text"
            id={`${providerId}-config`}
            value={ollamaBaseUrl || 'http://127.0.0.1:11434'}
            onChange={(e) => dispatch(setOllamaBaseUrl(e.target.value))}
            placeholder={config.placeholder}
          />
        ) : (
          <input
            type="password"
            id={`${providerId}-config`}
            value={(() => {
              switch (providerId) {
                case 'deepseek':
                  return deepseekApiKey || '';
                case 'openrouter':
                  return openrouterApiKey || '';
                case 'siliconflow':
                  return siliconflowApiKey || '';
                case 'aliyun':
                  return aliyunApiKey || '';
                default:
                  return '';
              }
            })()}
            onChange={(e) => {
              // 根据providerId分发对应的action
              switch (providerId) {
                case 'deepseek':
                  dispatch(setDeepseekApiKey(e.target.value));
                  break;
                case 'openrouter':
                  dispatch(setOpenrouterApiKey(e.target.value));
                  break;
                case 'siliconflow':
                  dispatch(setSiliconflowApiKey(e.target.value));
                  break;
                case 'aliyun':
                  dispatch(setAliyunApiKey(e.target.value));
                  break;
                default:
                  break;
              }
            }}
            placeholder={config.placeholder}
          />
        )}

        {config.helpLink ? (
          <div className="setting-help">
            {config.helpText}：
            <a href={config.helpLink} target="_blank" rel="noopener noreferrer">
              {config.helpLink.split('//')[1]}
            </a>
          </div>
        ) : (
          <div className="setting-help">{config.helpText}</div>
        )}
      </div>

      {/* 可用模型展示部分 */}
      <div className="available-models-section">
        <h4>可用模型</h4>
        
        <div className="setting-group">
          <label>当前可用模型:</label>
          <div className="available-models-display">
            {availableModels.length === 0 ? (
              <div className="no-models-message">
                暂无可用模型，请先配置API密钥
              </div>
            ) : (
              <AvailableModelsList models={availableModels} currentProvider={providerId} />
            )}
          </div>
          {availableModels.length === 0 && (
            <div className="setting-description" style={{color: '#ff6b6b'}}>
              当前没有可用的AI模型。请先配置API密钥。
            </div>
          )}
          {/* Ollama服务不可用时的特殊提示 */}
          {providerId === 'ollama' && availableModels.length > 0 &&
           availableModels.some(model => model.id === 'no-service') && (
            <div className="setting-description" style={{color: '#ff6b6b', marginTop: '10px'}}>
              ⚠️ Ollama服务当前不可用。请启动Ollama服务后点击"重新检测"按钮。
            </div>
          )}
        </div>

        {/* Ollama服务重连按钮 */}
        {providerId === 'ollama' && (
          <div className="setting-group">
            <label>Ollama服务重连:</label>
            <button
              onClick={onRedetectOllama}
              className="redetect-button"
              title="如果忘记先启动Ollama服务，点击此按钮重新检测"
            >
              重新检测Ollama服务
            </button>
            <div className="setting-description">
              如果Ollama服务当前不可用，请启动服务后点击此按钮重新检测。检测成功后模型列表将自动更新。
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

// 可用模型列表组件
const AvailableModelsList = ({ models, currentProvider }) => {
  const [showAll, setShowAll] = useState(false);
  const [searchText, setSearchText] = useState('');
  
  // 过滤模型：只显示当前提供商的模型
  const filteredModels = models.filter(model => {
    // 首先按提供商过滤
    const isCurrentProvider = model.provider === currentProvider;
    if (!isCurrentProvider) return false;
    
    // 然后按搜索文本过滤
    return model.id.toLowerCase().includes(searchText.toLowerCase()) ||
           model.provider.toLowerCase().includes(searchText.toLowerCase());
  });
  
  // 显示模型数量控制
  const displayModels = showAll ? filteredModels : filteredModels.slice(0, 10);
  
  return (
    <div className="available-models-list">
      {/* 搜索框 */}
      <div className="models-search-container">
        <input
          type="text"
          placeholder={`搜索${currentProvider}模型...`}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="models-search-input"
        />
      </div>
      
      {/* 模型列表 */}
      <div className="models-grid">
        {displayModels.map((model) => (
          <div key={model.id} className="model-item">
            <div className="model-name">{model.id}</div>
            <div className="model-provider">{model.provider}</div>
          </div>
        ))}
      </div>
      
      {/* 展开/收起按钮 */}
      {filteredModels.length > 3 && (
        <div className="models-expand-section">
          <button
            className="expand-models-btn"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? '收起' : `展开更多 (${filteredModels.length - 3}个)`}
          </button>
        </div>
      )}
      
      {/* 搜索结果统计 */}
      {searchText && (
        <div className="search-results-info">
          找到 {filteredModels.length} 个匹配的模型
        </div>
      )}
    </div>
  );
};

// 自定义提供商设置详情组件
// 自定义提供商设置详情组件
const CustomProviderSettingsDetail = ({ provider, onEdit, onDelete }) => {
  const { invoke } = useIpcRenderer();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  if (!provider) {
    return <div className="no-provider-data">提供商数据不存在</div>;
  }

  const handleEdit = () => {
    if (onEdit) {
      onEdit(provider);
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (onDelete) {
      await onDelete(provider.providerName);
    }
    setShowDeleteConfirm(false);
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  return (
    <div className="custom-provider-detail">
      <div className="setting-group">
        <label>提供商名称</label>
        <input type="text" value={provider.providerName} readOnly />
      </div>

      <div className="setting-group">
        <label>API Key</label>
        <input type="password" value={provider.apiKey} readOnly />
      </div>

      <div className="setting-group">
        <label>Base URL</label>
        <input type="text" value={provider.baseURL} readOnly />
      </div>

      <div className="setting-group">
        <label>模型 ID</label>
        <input type="text" value={provider.modelId} readOnly />
      </div>

      <div className="setting-group">
        <label>状态</label>
        <div className={`status-badge ${provider.enabled ? 'enabled' : 'disabled'}`}>
          {provider.enabled ? '已启用' : '已禁用'}
        </div>
      </div>

      <div className="setting-actions">
        <button className="edit-btn" onClick={handleEdit}>编辑</button>
        <button className="delete-btn" onClick={handleDeleteClick}>删除</button>
      </div>

      {/* 删除确认对话框 - 使用项目标准的 ConfirmationModal */}
      {showDeleteConfirm && (
        <ConfirmationModal
          message={`确定要删除提供商 "${provider.providerName}" 吗？此操作不可撤销。`}
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
        />
      )}
    </div>
  );
};
export default ProviderSettingsPanel;