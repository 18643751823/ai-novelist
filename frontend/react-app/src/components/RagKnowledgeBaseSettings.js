import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  setModeFeatureSetting,
  setRagCollectionNames,
  setAliyunEmbeddingApiKey,
  setIntentAnalysisModel,
  setAvailableModels,
  setShowRagSettingsModal
} from '../store/slices/chatSlice';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBook, faCheckSquare, faSquare, faSync } from '@fortawesome/free-solid-svg-icons';
import useIpcRenderer from '../hooks/useIpcRenderer';

const RagKnowledgeBaseSettings = forwardRef(({ onSaveComplete }, ref) => {
  const dispatch = useDispatch();
  const { invoke, setStoreValue } = useIpcRenderer();
  const {
    modeFeatureSettings,
    aliyunEmbeddingApiKey,
    intentAnalysisModel,
    availableModels
  } = useSelector((state) => state.chat);
  
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [localSettings, setLocalSettings] = useState({});
  const [localAliyunKey, setLocalAliyunKey] = useState('');
  const [localIntentModel, setLocalIntentModel] = useState('');

  // 新增：RAG提供商相关状态
  const [embeddingProvider, setEmbeddingProvider] = useState('aliyun'); // 'aliyun' | 'ollama'
  const [ollamaConfig, setOllamaConfig] = useState({
    baseUrl: 'http://localhost:11434',
    modelName: 'nomic-embed-text'
  });
  const [availableOllamaModels, setAvailableOllamaModels] = useState([]);
  const [testingOllama, setTestingOllama] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null); // null | 'success' | 'error' | 'testing'

  // 从后端获取所有集合列表
  const fetchCollections = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke('list-kb-collections');
      if (result.success) {
        setCollections(result.collections || []);
      } else {
        setError(result.error || '获取集合列表失败');
      }
    } catch (err) {
      console.error('调用获取集合列表API失败:', err);
      setError('调用API失败: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 加载RAG相关设置
  const loadRagSettings = useCallback(async () => {
    try {
      // 加载嵌入配置
      const embeddingConfigResult = await invoke('get-embedding-config');
      if (embeddingConfigResult.success) {
        if (embeddingConfigResult.config) {
          setEmbeddingProvider(embeddingConfigResult.config.provider);

          if (embeddingConfigResult.config.provider === 'aliyun') {
            setLocalAliyunKey(embeddingConfigResult.config.config.apiKey || '');
          } else if (embeddingConfigResult.config.provider === 'ollama') {
            setOllamaConfig(embeddingConfigResult.config.config || {
              baseUrl: 'http://localhost:11434',
              modelName: 'nomic-embed-text'
            });
          }
        }
      }

      // 向后兼容：加载旧的阿里云API Key配置
      const storedAliyunKey = await invoke('get-store-value', 'aliyunEmbeddingApiKey');
      if (storedAliyunKey && !localAliyunKey) {
        setLocalAliyunKey(storedAliyunKey);
        setEmbeddingProvider('aliyun');
      }

      // 加载意图分析模型
      const storedIntentModel = await invoke('get-store-value', 'intentAnalysisModel');
      setLocalIntentModel(storedIntentModel || '');

      // 加载可用模型列表
      const models = await invoke('get-available-models');
      if (models.success) {
        dispatch(setAvailableModels(models.models));
      }

      // 如果当前提供商是Ollama，获取可用模型列表
      if (embeddingProvider === 'ollama') {
        await fetchOllamaModels(ollamaConfig.baseUrl);
      }
    } catch (error) {
      console.error('加载RAG设置失败:', error);
    }
  }, [invoke, dispatch, embeddingProvider, ollamaConfig.baseUrl]);

  // 初始化加载设置和集合列表
  useEffect(() => {
    // 从Redux状态初始化本地设置
    setLocalSettings(modeFeatureSettings);
    fetchCollections();
    loadRagSettings();
  }, [modeFeatureSettings, loadRagSettings]);

  // 当提供商切换到Ollama时，获取模型列表
  useEffect(() => {
    if (embeddingProvider === 'ollama' && ollamaConfig.baseUrl) {
      fetchOllamaModels(ollamaConfig.baseUrl);
    }
  }, [embeddingProvider, ollamaConfig.baseUrl]);

  // 当Ollama配置改变时，重置连接状态
  useEffect(() => {
    if (embeddingProvider === 'ollama') {
      setConnectionStatus(null);
    }
  }, [ollamaConfig.baseUrl, ollamaConfig.modelName, embeddingProvider]);

  // 处理集合选择变化
  const handleCollectionChange = (mode, collectionName, checked) => {
    setLocalSettings(prev => {
      const currentCollections = prev[mode]?.ragCollectionNames || [];
      let newCollections;
      
      if (checked) {
        // 添加集合
        newCollections = [...currentCollections, collectionName];
      } else {
        // 移除集合
        newCollections = currentCollections.filter(name => name !== collectionName);
      }
      
      return {
        ...prev,
        [mode]: {
          ...prev[mode],
          ragCollectionNames: newCollections
        }
      };
    });
  };

  // 处理RAG检索开关变化
  const handleRagToggle = (mode, enabled) => {
    setLocalSettings(prev => ({
      ...prev,
      [mode]: {
        ...prev[mode],
        ragRetrievalEnabled: enabled
      }
    }));
  };

  // 获取Ollama模型列表
  const fetchOllamaModels = async (baseUrl) => {
    try {
      const result = await invoke('get-ollama-models', baseUrl);
      if (result.success) {
        setAvailableOllamaModels(result.models || []);
      } else {
        console.warn('获取Ollama模型列表失败:', result.error);
      }
    } catch (error) {
      console.error('获取Ollama模型列表异常:', error);
    }
  };

  // 测试Ollama连接
  const testOllamaConnection = async () => {
    if (!ollamaConfig.baseUrl || !ollamaConfig.modelName) {
      setConnectionStatus('error');
      return;
    }

    setTestingOllama(true);
    setConnectionStatus('testing');

    try {
      const result = await invoke('test-ollama-connection', ollamaConfig.baseUrl, ollamaConfig.modelName);

      if (result.success) {
        setConnectionStatus('success');
        if (onSaveComplete) {
          onSaveComplete(`Ollama连接测试成功！嵌入维度: ${result.embeddingDimension}`, true);
        }
      } else {
        setConnectionStatus('error');
        if (onSaveComplete) {
          onSaveComplete(`Ollama连接测试失败: ${result.error}`, false);
        }
      }
    } catch (error) {
      setConnectionStatus('error');
      if (onSaveComplete) {
        onSaveComplete(`Ollama连接测试异常: ${error.message}`, false);
      }
    } finally {
      setTestingOllama(false);
    }
  };

  // 处理外部链接点击
  const handleExternalLinkClick = (url, e) => {
    e.preventDefault();
    invoke('open-external', url);
  };

  // 保存设置
  const handleSave = async () => {
    try {
      // 保存嵌入配置
      let embeddingConfig;
      if (embeddingProvider === 'aliyun') {
        if (!localAliyunKey.trim()) {
          throw new Error('阿里云API Key不能为空');
        }
        embeddingConfig = {
          provider: 'aliyun',
          config: {
            apiKey: localAliyunKey.trim(),
            modelName: 'text-embedding-v4',
            dimensions: 1024
          }
        };
      } else if (embeddingProvider === 'ollama') {
        if (!ollamaConfig.baseUrl.trim() || !ollamaConfig.modelName.trim()) {
          throw new Error('Ollama服务器地址和模型名称不能为空');
        }
        embeddingConfig = {
          provider: 'ollama',
          config: {
            baseUrl: ollamaConfig.baseUrl.trim(),
            modelName: ollamaConfig.modelName.trim()
          }
        };
      }

      // 设置嵌入配置
      const embeddingResult = await invoke('set-embedding-config', embeddingConfig.provider, embeddingConfig.config);
      if (!embeddingResult.success) {
        throw new Error(embeddingResult.error);
      }

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

          // 保存集合选择
          dispatch(setRagCollectionNames({
            mode,
            collectionNames: settings.ragCollectionNames || []
          }));
        }
      }

      // 保存RAG模型设置到Redux
      dispatch(setAliyunEmbeddingApiKey(embeddingProvider === 'aliyun' ? localAliyunKey : ''));
      dispatch(setIntentAnalysisModel(localIntentModel));

      // 保存到持久化存储
      await Promise.all([
        invoke('set-store-value', 'modeFeatureSettings', localSettings),
        setStoreValue('intentAnalysisModel', localIntentModel)
      ]);

      if (onSaveComplete) {
        onSaveComplete(`RAG知识库设置保存成功！使用提供商: ${embeddingProvider === 'aliyun' ? '阿里云' : 'Ollama'}`, true);
      }
    } catch (error) {
      console.error('保存RAG知识库设置失败:', error);
      if (onSaveComplete) {
        onSaveComplete(`RAG知识库设置保存失败: ${error.message}`, false);
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

  const isCollectionSelected = (mode, collectionName) => {
    return localSettings[mode]?.ragCollectionNames?.includes(collectionName) || false;
  };

  // 暴露保存方法给父组件
  useImperativeHandle(ref, () => ({
    handleSave
  }));

  return (
    <div className="tab-content">
      {/* RAG模型配置部分 */}
      <div className="settings-section">
        <h4>RAG模型配置</h4>

        <div className="setting-item">
          <label htmlFor="embeddingProvider">嵌入模型提供商:</label>
          <select
            id="embeddingProvider"
            value={embeddingProvider}
            onChange={(e) => setEmbeddingProvider(e.target.value)}
          >
            <option value="aliyun">阿里云</option>
            <option value="ollama">Ollama (本地)</option>
          </select>
          <div className="setting-description">
            选择RAG功能的文本嵌入模型提供商
          </div>
        </div>

        {embeddingProvider === 'aliyun' && (
          <div className="setting-item">
            <label htmlFor="aliyunEmbeddingApiKey">阿里云嵌入API Key:</label>
            <input
              type="password"
              id="aliyunEmbeddingApiKey"
              value={localAliyunKey || ''}
              onChange={(e) => setLocalAliyunKey(e.target.value)}
              placeholder="请输入您的阿里云嵌入API Key"
            />
            <div className="setting-description">
              用于RAG功能的文本嵌入模型，获取地址：<a href="https://www.aliyun.com/product/bailian" onClick={(e) => handleExternalLinkClick('https://www.aliyun.com/product/bailian', e)} style={{cursor: 'pointer', color: '#007acc', textDecoration: 'underline'}}>阿里云百炼</a>
            </div>
          </div>
        )}

        {embeddingProvider === 'ollama' && (
          <>
            <div className="setting-item">
              <label htmlFor="ollamaBaseUrl">Ollama服务器地址:</label>
              <input
                type="text"
                id="ollamaBaseUrl"
                value={ollamaConfig.baseUrl || ''}
                onChange={(e) => setOllamaConfig(prev => ({ ...prev, baseUrl: e.target.value }))}
                placeholder="http://localhost:11434"
              />
              <div className="setting-description">
                Ollama服务器的地址，默认为本地 http://localhost:11434
              </div>
            </div>

            <div className="setting-item">
              <label htmlFor="ollamaModelName">嵌入模型:</label>
              <select
                id="ollamaModelName"
                value={ollamaConfig.modelName || ''}
                onChange={(e) => setOllamaConfig(prev => ({ ...prev, modelName: e.target.value }))}
              >
                <option value="">选择模型...</option>
                {availableOllamaModels.map(model => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
              <div className="setting-description">
                选择用于生成文本向量的Ollama模型。如果没有看到模型，请先在Ollama中拉取：<code>ollama pull nomic-embed-text</code>
              </div>
            </div>

            <div className="setting-item">
              <button
                className="test-button"
                onClick={testOllamaConnection}
                disabled={testingOllama || !ollamaConfig.baseUrl || !ollamaConfig.modelName}
              >
                {testingOllama ? '测试中...' : '测试连接'}
              </button>

              {connectionStatus && (
                <div className={`connection-status ${connectionStatus}`}>
                  {connectionStatus === 'success' && '✅ 连接成功'}
                  {connectionStatus === 'error' && '❌ 连接失败'}
                  {connectionStatus === 'testing' && '🔄 正在测试...'}
                </div>
              )}
            </div>
          </>
        )}

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
          onClick={fetchCollections}
          disabled={loading}
        >
          <FontAwesomeIcon icon={faSync} spin={loading} />
          {loading ? '加载中...' : '刷新集合列表'}
        </button>
      </div>

      {error && (
        <div className="error-message">
          <p>{error}</p>
        </div>
      )}

      {collections.length === 0 && !loading ? (
        <div className="no-collections">
          <p>暂无知识库集合，请先导入文件到知识库。</p>
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
                <div className="collection-selection">
                  <h4>选择要查询的知识库集合:</h4>
                  <div className="collection-list">
                    {collections.map((collection) => (
                      <div key={collection.collectionName} className="collection-item">
                        <label>
                          <FontAwesomeIcon
                            icon={isCollectionSelected(mode, collection.collectionName) ? faCheckSquare : faSquare}
                            className="collection-checkbox"
                            onClick={(e) => {
                              if (!localSettings[mode]?.ragRetrievalEnabled) return;
                              handleCollectionChange(mode, collection.collectionName, !isCollectionSelected(mode, collection.collectionName));
                            }}
                            style={{
                              cursor: localSettings[mode]?.ragRetrievalEnabled ? 'pointer' : 'not-allowed',
                              opacity: localSettings[mode]?.ragRetrievalEnabled ? 1 : 0.5
                            }}
                          />
                          <span className="collection-info">
                            <strong>{collection.filename}</strong>
                            <span className="collection-details">
                              ({collection.documentCount} 个片段) - {collection.collectionName}
                            </span>
                          </span>
                        </label>
                      </div>
                    ))}
                  </div>
                  <div className="collection-help">
                    <p>💡 提示：选择特定的集合可以提高检索精度，减少无关信息的干扰。</p>
                    <p>如果不选择任何集合，将查询所有可用的知识库集合。</p>
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