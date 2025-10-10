import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  setModeFeatureSetting,
  setRagTableNames,
  setEmbeddingModel,
  setIntentAnalysisModel,
  setAvailableModels,
  setShowRagSettingsModal
} from '../store/slices/chatSlice';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBook, faCheckSquare, faSquare, faSync } from '@fortawesome/free-solid-svg-icons';
import useIpcRenderer from '../hooks/useIpcRenderer';
import EmbeddingModelSelector from './EmbeddingModelSelector';

const RagKnowledgeBaseSettings = forwardRef(({ onSaveComplete }, ref) => {
  const dispatch = useDispatch();
  const { invoke, setStoreValue } = useIpcRenderer();
  const {
    modeFeatureSettings,
    embeddingModel,
    intentAnalysisModel,
    availableModels
  } = useSelector((state) => state.chat);
  
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [localSettings, setLocalSettings] = useState({});
  const [localEmbeddingModel, setLocalEmbeddingModel] = useState('');
  const [localIntentModel, setLocalIntentModel] = useState('');
  const [showEmbeddingModelSelector, setShowEmbeddingModelSelector] = useState(false);

  // 从后端获取所有知识库文件列表
  const fetchTables = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke('list-kb-files');
      if (result.success) {
        setTables(result.files || []);
      } else {
        setError(result.error || '获取知识库文件列表失败');
      }
    } catch (err) {
      console.error('调用获取知识库文件列表API失败:', err);
      setError('调用API失败: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 加载RAG相关设置
  const loadRagSettings = useCallback(async () => {
    try {
      // 从存储加载嵌入模型和意图分析模型
      const [storedEmbeddingModel, storedIntentModel] = await Promise.all([
        invoke('get-store-value', 'embeddingModel'),
        invoke('get-store-value', 'intentAnalysisModel')
      ]);
      
      setLocalEmbeddingModel(storedEmbeddingModel || '');
      setLocalIntentModel(storedIntentModel || '');
      
      // 加载可用模型列表
      const models = await invoke('get-available-models');
      if (models.success) {
        dispatch(setAvailableModels(models.models));
      }
    } catch (error) {
      console.error('加载RAG设置失败:', error);
    }
  }, [invoke, dispatch]);

  // 初始化加载设置和集合列表
  useEffect(() => {
    // 从Redux状态初始化本地设置，确保每个模式都有独立的状态
    const initializedSettings = {};
    ['general', 'outline', 'writing', 'adjustment'].forEach(mode => {
      initializedSettings[mode] = {
        ragRetrievalEnabled: modeFeatureSettings[mode]?.ragRetrievalEnabled || false,
        ragTableNames: modeFeatureSettings[mode]?.ragTableNames || []
      };
    });
    setLocalSettings(initializedSettings);
    fetchTables();
    loadRagSettings();
  }, [modeFeatureSettings, loadRagSettings]);

  // 处理文件选择变化 - 确保只修改当前模式的文件选择
  const handleTableChange = (mode, tableName, checked) => {
    setLocalSettings(prev => {
      const currentModeSettings = prev[mode] || {};
      const currentTables = currentModeSettings.ragTableNames || [];
      let newTables;
      
      if (checked) {
        // 添加文件 - 确保不重复
        if (!currentTables.includes(tableName)) {
          newTables = [...currentTables, tableName];
        } else {
          newTables = currentTables; // 如果已存在，保持不变
        }
      } else {
        // 移除文件
        newTables = currentTables.filter(name => name !== tableName);
      }
      
      return {
        ...prev,
        [mode]: {
          ...currentModeSettings,
          ragTableNames: newTables
        }
      };
    });
  };

  // 处理RAG检索开关变化 - 确保只修改当前模式的设置
  const handleRagToggle = (mode, enabled) => {
    setLocalSettings(prev => ({
      ...prev,
      [mode]: {
        ...(prev[mode] || {}),
        ragRetrievalEnabled: enabled,
        // 当关闭RAG检索时，不清空已选择的集合，只是隐藏选择界面
        ragTableNames: prev[mode]?.ragTableNames || []
      }
    }));
  };

  // 处理外部链接点击
  const handleExternalLinkClick = (url, e) => {
    e.preventDefault();
    invoke('open-external', url);
  };

  // 保存设置
  const handleSave = async () => {
    try {
      // 保存所有模式的设置
      for (const mode of ['general', 'outline', 'writing', 'adjustment']) {
        const settings = localSettings[mode];
        if (settings) {
          // 保存RAG检索启用状态
          dispatch(setModeFeatureSetting({
            mode,
            feature: 'ragRetrievalEnabled',
            enabled: settings.ragRetrievalEnabled || false
          }));
          
          // 保存文件选择
          // 如果用户没有选择任何文件，传递 null 而不是空数组
          const tableNames = settings.ragTableNames && settings.ragTableNames.length > 0
            ? settings.ragTableNames
            : null;
          dispatch(setRagTableNames({
            mode,
            tableNames: tableNames
          }));
        }
      }
      
      // 保存RAG模型设置
      dispatch(setEmbeddingModel(localEmbeddingModel));
      dispatch(setIntentAnalysisModel(localIntentModel));
      
      // 保存到持久化存储
      await Promise.all([
        invoke('set-store-value', 'modeFeatureSettings', localSettings),
        setStoreValue('embeddingModel', localEmbeddingModel),
        setStoreValue('intentAnalysisModel', localIntentModel)
      ]);
      
      // 重新初始化嵌入函数
      await invoke('reinitialize-embedding-function');
      
      if (onSaveComplete) {
        onSaveComplete('RAG知识库设置保存成功！', true);
      }
    } catch (error) {
      console.error('保存RAG知识库设置失败:', error);
      if (onSaveComplete) {
        onSaveComplete('RAG知识库设置保存失败，请重试。', false);
      }
    }
  };

  const getModeDisplayName = (mode) => {
    const names = {
      general: '通用',
      outline: '细纲',
      writing: '写作',
      adjustment: '调整'
    };
    return names[mode] || mode;
  };

  const isTableSelected = (mode, tableName) => {
    return localSettings[mode]?.ragTableNames?.includes(tableName) || false;
  };
// 处理嵌入模型选择
const handleEmbeddingModelChange = (modelId) => {
  setLocalEmbeddingModel(modelId);
  setShowEmbeddingModelSelector(false);
};

// 获取当前选择的嵌入模型显示名称
const getSelectedEmbeddingModelName = () => {
  if (!localEmbeddingModel) return '选择嵌入模型';
  const model = availableModels.find(m => m.id === localEmbeddingModel);
  return model ? `${model.id} (${model.provider})` : localEmbeddingModel;
};

// 暴露保存方法给父组件
useImperativeHandle(ref, () => ({
  handleSave
}));

  return (
    <div className="tab-content">
      <style jsx>{`
        .model-selector-container {
          position: relative;
          width: 100%;
        }
        
        .model-selector-button {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          background: white;
          text-align: left;
          cursor: pointer;
          font-size: 14px;
          color: #333;
        }
        
        .model-selector-button:hover {
          border-color: #007acc;
        }
        
        .model-selector-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          z-index: 1000;
          background: white;
          border: 1px solid #ddd;
          border-radius: 4px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          margin-top: 4px;
          max-height: 300px;
          overflow: hidden;
        }
      `}</style>
      {/* RAG模型配置部分 */}
      <div className="settings-section">
        <h4>RAG模型配置</h4>
        
        <div className="setting-item">
          <label htmlFor="embeddingModel">嵌入模型:</label>
          <div className="model-selector-container">
            <button
              className="model-selector-button"
              onClick={() => setShowEmbeddingModelSelector(!showEmbeddingModelSelector)}
            >
              {getSelectedEmbeddingModelName()}
            </button>
            {showEmbeddingModelSelector && (
              <div className="model-selector-dropdown">
                <EmbeddingModelSelector
                  selectedModel={localEmbeddingModel}
                  availableModels={availableModels}
                  onModelChange={handleEmbeddingModelChange}
                  onClose={() => setShowEmbeddingModelSelector(false)}
                />
              </div>
            )}
          </div>
          <div className="setting-description">
            用于RAG功能的文本嵌入模型
          </div>
        </div>

        <div className="setting-item">
          <label htmlFor="intentAnalysisModel">意图分析模型:</label>
          <select
            id="intentAnalysisModel"
            value={localIntentModel || ''}
            onChange={(e) => setLocalIntentModel(e.target.value)}
          >
            <option value="">使用默认模型（自动选择）</option>
            {availableModels.map(model => (
              <option key={model.id} value={model.id}>
                {model.name} ({model.provider})
              </option>
            ))}
          </select>
          <div className="setting-description">
            用于分析写作意图和生成检索词的AI模型
          </div>
        </div>
      </div>

      <div className="rag-settings-header">
        <button
          className="refresh-button"
          onClick={fetchTables}
          disabled={loading}
        >
          <FontAwesomeIcon icon={faSync} spin={loading} />
          {loading ? '加载中...' : '刷新文件列表'}
        </button>
      </div>

      {error && (
        <div className="error-message">
          <p>{error}</p>
        </div>
      )}

      {tables.length === 0 && !loading ? (
        <div className="no-tables">
          <p>暂无知识库文件，请先导入文件到知识库。</p>
        </div>
      ) : (
        <div className="rag-settings-sections">
          {['general', 'outline', 'writing', 'adjustment'].map((mode) => (
            <div key={mode} className="rag-settings-section">
              <h3>{getModeDisplayName(mode)}模式</h3>
              
              <div className="rag-toggle">
                <input
                  type="checkbox"
                  id={`${mode}-rag-toggle`}
                  checked={localSettings[mode]?.ragRetrievalEnabled || false}
                  onChange={(e) => handleRagToggle(mode, e.target.checked)}
                />
                <label htmlFor={`${mode}-rag-toggle`}>
                  启用RAG检索
                </label>
                <div className="feature-description">
                  在此模式下允许AI使用知识库检索功能获取相关信息
                </div>
              </div>

              {localSettings[mode]?.ragRetrievalEnabled && (
                <div className="table-selection">
                  <h4>选择要查询的知识库文件:</h4>
                  <div className="table-list">
                    {tables.map((table) => (
                      <div key={table.tableName} className="table-item">
                        <label>
                          <FontAwesomeIcon
                            icon={isTableSelected(mode, table.tableName) ? faCheckSquare : faSquare}
                            className="table-checkbox"
                            onClick={(e) => {
                              if (!localSettings[mode]?.ragRetrievalEnabled) return;
                              handleTableChange(mode, table.tableName, !isTableSelected(mode, table.tableName));
                            }}
                            style={{
                              cursor: localSettings[mode]?.ragRetrievalEnabled ? 'pointer' : 'not-allowed',
                              opacity: localSettings[mode]?.ragRetrievalEnabled ? 1 : 0.5
                            }}
                          />
                          <span className="table-info">
                            <strong>{table.filename}</strong>
                            <span className="table-details">
                              ({table.documentCount} 个片段) - {table.tableName}
                            </span>
                          </span>
                        </label>
                      </div>
                    ))}
                  </div>
                  <div className="table-help">
                    <p>💡 提示：选择特定的文件可以提高检索精度，减少无关信息的干扰。</p>
                    <p>如果不选择任何文件，将查询所有可用的知识库文件。</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

    </div>
  );
});

export default RagKnowledgeBaseSettings;