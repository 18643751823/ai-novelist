import React, { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  setModeFeatureSetting,
  setRagTableNames
} from '../../store/slices/chatSlice';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckSquare, faSquare, faSync } from '@fortawesome/free-solid-svg-icons';
import useIpcRenderer from '../../hooks/useIpcRenderer';
import './AgentRagTab.css';

/**
 * 当前选中模式的RAG设置面板组件
 * 只显示当前选中模式的RAG设置，允许设置是否启用RAG和选择知识库文件
 * 采用实时保存模式，通过回调通知父组件设置变化
 */
const AgentRagTab = ({
  ragSettings = {},
  onRagSettingsChange,
  customModes = [],
  selectedMode = 'general'
}) => {
  const dispatch = useDispatch();
  const { invoke } = useIpcRenderer();
  const {
    modeFeatureSettings
  } = useSelector((state) => state.chat);
  
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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
  // 获取当前选中模式的显示名称
  const getCurrentModeDisplayName = () => {
    const names = {
      general: '通用',
      outline: '细纲',
      writing: '写作',
      adjustment: '调整'
    };
    
    // 如果是自定义模式，从customModes中查找
    if (selectedMode.startsWith('custom_')) {
      const customMode = customModes.find(m => m.id === selectedMode);
      return customMode ? customMode.name : selectedMode;
    }
    
    return names[selectedMode] || selectedMode;
  };

  // 初始化加载设置和集合列表
  useEffect(() => {
    fetchTables();
  }, []); // 空依赖数组，只在组件挂载时执行一次
  // 处理文件选择变化 - 实时通知父组件
  const handleTableChange = (mode, tableName, checked) => {
    const currentModeSettings = ragSettings[mode] || {};
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
    
    const updatedSettings = {
      ...ragSettings,
      [mode]: {
        ...currentModeSettings,
        ragTableNames: newTables
      }
    };
    
    // 实时通知父组件设置变化
    if (onRagSettingsChange) {
      onRagSettingsChange(updatedSettings);
    }
  };

  // 处理RAG检索开关变化 - 实时通知父组件
  const handleRagToggle = (mode, enabled) => {
    const currentModeSettings = ragSettings[mode] || {};
    const updatedSettings = {
      ...ragSettings,
      [mode]: {
        ...currentModeSettings,
        ragRetrievalEnabled: enabled,
        // 当关闭RAG检索时，不清空已选择的集合，只是隐藏选择界面
        ragTableNames: currentModeSettings.ragTableNames || []
      }
    };
    
    // 实时通知父组件设置变化
    if (onRagSettingsChange) {
      onRagSettingsChange(updatedSettings);
    }
  };

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

  const isTableSelected = (mode, tableName) => {
    return ragSettings[mode]?.ragTableNames?.includes(tableName) || false;
  };

  return (
    <div className="rag-settings-panel">
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
          <div className="rag-settings-section">
            <h4>{getCurrentModeDisplayName()}模式</h4>
            
            <div className="rag-toggle">
              <input
                type="checkbox"
                id={`${selectedMode}-rag-toggle`}
                checked={ragSettings[selectedMode]?.ragRetrievalEnabled || false}
                onChange={(e) => handleRagToggle(selectedMode, e.target.checked)}
              />
              <label htmlFor={`${selectedMode}-rag-toggle`}>
                启用RAG检索
              </label>
              <div className="feature-description">
                在此模式下允许AI使用知识库检索功能获取相关信息
              </div>
            </div>

            <div className="table-selection">
              <h5>选择要查询的知识库文件:</h5>
              <div className="table-list">
                {tables.map((table) => (
                  <div key={table.tableName} className="table-item">
                    <label>
                      <FontAwesomeIcon
                        icon={isTableSelected(selectedMode, table.tableName) ? faCheckSquare : faSquare}
                        className="table-checkbox"
                        onClick={(e) => {
                          if (!ragSettings[selectedMode]?.ragRetrievalEnabled) return;
                          handleTableChange(selectedMode, table.tableName, !isTableSelected(selectedMode, table.tableName));
                        }}
                        style={{
                          cursor: ragSettings[selectedMode]?.ragRetrievalEnabled ? 'pointer' : 'not-allowed',
                          opacity: ragSettings[selectedMode]?.ragRetrievalEnabled ? 1 : 0.5
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
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentRagTab;