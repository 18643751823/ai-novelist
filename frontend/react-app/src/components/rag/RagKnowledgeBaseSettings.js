
import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  setEmbeddingModel,
  setIntentAnalysisModel,
  setAvailableModels
} from '../../store/slices/chatSlice';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBook, faSync, faCog, faDatabase } from '@fortawesome/free-solid-svg-icons';
import useIpcRenderer from '../../hooks/useIpcRenderer';
import EmbeddingModelSelector from './EmbeddingModelSelector';
import KnowledgeBasePanel from './KnowledgeBasePanel';
import RenameKbFileModal from './RenameKbFileModal';
import RetrievalSettings from './RetrievalSettings';
import './RagKnowledgeBaseSettings.css';

// RAG设置组件 - 包含嵌入模型配置和意图分析模型配置
const RagSettings = forwardRef(({ onSaveComplete }, ref) => {
  const dispatch = useDispatch();
  const { invoke, setStoreValue } = useIpcRenderer();
  const {
    embeddingModel,
    intentAnalysisModel,
    availableModels
  } = useSelector((state) => state.chat);
  
  const [localEmbeddingModel, setLocalEmbeddingModel] = useState('');
  const [localIntentModel, setLocalIntentModel] = useState('');
  const [localIntentPrompt, setLocalIntentPrompt] = useState('');
  const [showEmbeddingModelSelector, setShowEmbeddingModelSelector] = useState(false);
  const [localChunkSize, setLocalChunkSize] = useState(400);
  const [localChunkOverlap, setLocalChunkOverlap] = useState(50);
  const [localEmbeddingDimensions, setLocalEmbeddingDimensions] = useState(1024);
  const [modelDefaultDimensions, setModelDefaultDimensions] = useState(1024);
  const [isCustomDimensions, setIsCustomDimensions] = useState(false);
  const [isLoadingDimensions, setIsLoadingDimensions] = useState(false);
  const [chunkSizeError, setChunkSizeError] = useState('');
  const [chunkOverlapError, setChunkOverlapError] = useState('');
  const [chunkValidationError, setChunkValidationError] = useState('');
  const [embeddingDimensionsError, setEmbeddingDimensionsError] = useState('');
  // 加载RAG相关设置
  const loadRagSettings = useCallback(async () => {
    try {
      setIsLoadingDimensions(true);
      // 从存储加载嵌入模型、意图分析模型和提示词
      const [storedEmbeddingModel, storedIntentModel, storedIntentPrompt, chunkSettings, embeddingDimensions] = await Promise.all([
        invoke('get-store-value', 'embeddingModel'),
        invoke('get-store-value', 'intentAnalysisModel'),
        invoke('get-intent-analysis-prompt'),
        invoke('get-rag-chunk-settings'),
        invoke('get-embedding-dimensions')
      ]);
      
      setLocalEmbeddingModel(storedEmbeddingModel || '');
      setLocalIntentModel(storedIntentModel || '');
      setLocalIntentPrompt(storedIntentPrompt.prompt || '');
      
      // 加载分段参数
      if (chunkSettings.success) {
        setLocalChunkSize(chunkSettings.chunkSize || 400);
        setLocalChunkOverlap(chunkSettings.chunkOverlap || 50);
      }
      
      // 加载嵌入维度
      if (embeddingDimensions.success) {
        const storedDimensions = embeddingDimensions.dimensions || 1024;
        setLocalEmbeddingDimensions(storedDimensions);
        
        // 检查是否为自定义维度
        if (storedEmbeddingModel) {
          try {
            const modelDimensions = await invoke('get-embedding-dimensions', storedEmbeddingModel);
            if (modelDimensions.success) {
              const defaultDimensions = modelDimensions.dimensions;
              setModelDefaultDimensions(defaultDimensions);
              setIsCustomDimensions(storedDimensions !== defaultDimensions);
            }
          } catch (error) {
            console.warn('获取模型默认维度失败:', error);
            setModelDefaultDimensions(1024);
            setIsCustomDimensions(storedDimensions !== 1024);
          }
        }
      }
      
      // 加载可用模型列表
      const models = await invoke('get-available-models');
      if (models.success) {
        dispatch(setAvailableModels(models.models));
      }
    } catch (error) {
      console.error('加载RAG设置失败:', error);
    } finally {
      setIsLoadingDimensions(false);
    }
  }, [invoke, dispatch]);

  // 当嵌入模型变化时，自动获取默认维度
  useEffect(() => {
    const updateModelDefaultDimensions = async () => {
      if (localEmbeddingModel) {
        setIsLoadingDimensions(true);
        try {
          const modelDimensions = await invoke('get-embedding-dimensions', localEmbeddingModel);
          if (modelDimensions.success) {
            const defaultDimensions = modelDimensions.dimensions;
            setModelDefaultDimensions(defaultDimensions);
            
            // 如果当前不是自定义维度，则更新为模型默认值
            if (!isCustomDimensions) {
              setLocalEmbeddingDimensions(defaultDimensions);
            }
          }
        } catch (error) {
          console.warn('获取模型默认维度失败:', error);
          setModelDefaultDimensions(1024);
          if (!isCustomDimensions) {
            setLocalEmbeddingDimensions(1024);
          }
        } finally {
          setIsLoadingDimensions(false);
        }
      }
    };

    updateModelDefaultDimensions();
  }, [localEmbeddingModel, isCustomDimensions, invoke]);

  // 初始化加载设置
  useEffect(() => {
    loadRagSettings();
  }, [loadRagSettings]);

  // 保存设置
  const handleSave = async () => {
    // 检查验证错误
    if (chunkSizeError || chunkOverlapError || chunkValidationError || embeddingDimensionsError) {
      if (onSaveComplete) {
        onSaveComplete('请先修正输入错误', false);
      }
      return;
    }

    // 检查必填字段
    if (localChunkSize === '' || localChunkOverlap === '' || localEmbeddingDimensions === '') {
      if (onSaveComplete) {
        onSaveComplete('文本分段参数和嵌入维度不能为空', false);
      }
      return;
    }

    // 检查嵌入维度是否为正整数
    if (localEmbeddingDimensions <= 0) {
      if (onSaveComplete) {
        onSaveComplete('嵌入维度必须为正整数', false);
      }
      return;
    }

    // 检查分段参数是否大于重叠大小
    if (localChunkSize <= localChunkOverlap) {
      if (onSaveComplete) {
        onSaveComplete('文本分段大小必须大于文本重叠大小', false);
      }
      return;
    }

    try {
      // 保存RAG模型设置
      dispatch(setEmbeddingModel(localEmbeddingModel));
      dispatch(setIntentAnalysisModel(localIntentModel));
      
      // 保存到持久化存储
      await Promise.all([
        setStoreValue('embeddingModel', localEmbeddingModel),
        setStoreValue('intentAnalysisModel', localIntentModel)
      ]);
      
      // 保存分段参数
      await invoke('set-rag-chunk-settings', localChunkSize, localChunkOverlap);
      
      // 保存嵌入维度 - 如果用户没有自定义，则使用模型默认值
      const dimensionsToSave = isCustomDimensions ? localEmbeddingDimensions : modelDefaultDimensions;
      await invoke('set-embedding-dimensions', dimensionsToSave);
      
      // 保存自定义提示词
      if (localIntentPrompt.trim()) {
        await invoke('set-intent-analysis-prompt', localIntentPrompt.trim());
      } else {
        // 如果提示词为空，重置为默认值
        await invoke('reset-intent-analysis-prompt');
      }
      
      // 重新初始化嵌入函数
      await invoke('reinitialize-embedding-function');
      
      if (onSaveComplete) {
        onSaveComplete('RAG设置保存成功！', true);
      }
    } catch (error) {
      console.error('保存RAG设置失败:', error);
      if (onSaveComplete) {
        onSaveComplete('RAG设置保存失败，请重试。', false);
      }
    }
  };

  // 重置提示词为默认值
  const handleResetPrompt = async () => {
    try {
      const result = await invoke('reset-intent-analysis-prompt');
      if (result.success) {
        setLocalIntentPrompt(result.prompt || '');
        if (onSaveComplete) {
          onSaveComplete('提示词已重置为默认值！', true);
        }
      }
    } catch (error) {
      console.error('重置提示词失败:', error);
      if (onSaveComplete) {
        onSaveComplete('重置提示词失败，请重试。', false);
      }
    }
  };

  // 验证分段参数关系
  const validateChunkRelationship = (chunkSize, chunkOverlap) => {
    if (chunkSize && chunkOverlap && chunkSize <= chunkOverlap) {
      setChunkValidationError('文本分段大小必须大于文本重叠大小');
    } else {
      setChunkValidationError('');
    }
  };

  // 处理嵌入模型选择
  const handleEmbeddingModelChange = async (modelId) => {
    setLocalEmbeddingModel(modelId);
    setShowEmbeddingModelSelector(false);
    
    // 立即保存嵌入模型到持久化存储
    try {
      dispatch(setEmbeddingModel(modelId));
      await setStoreValue('embeddingModel', modelId);
    } catch (error) {
      console.error('保存嵌入模型失败:', error);
    }
    
    // 当模型变化时，自动获取并保存默认维度
    if (modelId) {
      try {
        const modelDimensions = await invoke('get-embedding-dimensions', modelId);
        if (modelDimensions.success) {
          const defaultDimensions = modelDimensions.dimensions;
          setModelDefaultDimensions(defaultDimensions);
          
          // 如果当前不是自定义维度，则更新为模型默认值并保存
          if (!isCustomDimensions) {
            setLocalEmbeddingDimensions(defaultDimensions);
            // 自动保存模型默认维度到store并重新初始化嵌入函数
            await invoke('set-embedding-dimensions', defaultDimensions);
            await invoke('reinitialize-embedding-function');
          }
        }
      } catch (error) {
        console.warn('获取模型默认维度失败:', error);
      }
    }
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
    <div className="rag-settings-content">
      {/* 嵌入模型配置 */}
      <div className="settings-section">
        <h5>嵌入模型配置</h5>
        
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
              <div className="embedding-model-selector-dropdown">
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
          <label htmlFor="embeddingDimensions">嵌入向量维度:</label>
          <div className="embedding-dimensions-container">
            {isLoadingDimensions ? (
              <div className="dimensions-loading">
                <FontAwesomeIcon icon={faSync} spin />
                <span>获取嵌入向量维度中...</span>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  id="embeddingDimensions"
                  value={localEmbeddingDimensions}
                  disabled
                  className="embedding-dimensions-input disabled"
                  placeholder="暂时不可自定义"
                />
                <div className="disabled-note">暂时不可自定义</div>
              </>
            )}
          </div>
          <div className="setting-description">
            嵌入向量的维度大小（常见值：512, 768, 1024, 1536, 2048）
            {!isLoadingDimensions && !isCustomDimensions && localEmbeddingModel && (
              <span style={{color: '#28a745', fontWeight: 'bold'}}>
                （当前使用模型默认值：{modelDefaultDimensions}）
              </span>
            )}
            {!isLoadingDimensions && isCustomDimensions && (
              <span style={{color: '#ffc107', fontWeight: 'bold'}}>
                （已自定义，模型默认值：{modelDefaultDimensions}）
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 文本分段参数 */}
      <div className="settings-section">
        <h5>文本分段参数</h5>
        
        <div className="setting-item">
          <label htmlFor="ragChunkSize">文本分段大小:</label>
          <input
            type="text"
            id="ragChunkSize"
            value={localChunkSize}
            onChange={(e) => {
              const value = e.target.value;
              if (value === '') {
                setChunkSizeError('不能为空');
                setLocalChunkSize('');
              } else if (!/^\d+$/.test(value)) {
                setChunkSizeError('不能包含非数字');
                setLocalChunkSize(value);
              } else {
                setChunkSizeError('');
                const newChunkSize = parseInt(value);
                setLocalChunkSize(newChunkSize);
                validateChunkRelationship(newChunkSize, localChunkOverlap);
              }
            }}
            className={`chunk-size-input ${chunkSizeError ? 'error' : ''}`}
            placeholder="请输入数字"
          />
          {chunkSizeError && (
            <div className="error-message">{chunkSizeError}</div>
          )}
          <div className="setting-description">
            每个文本片段的最大字符数（建议400-800）
          </div>
        </div>

        <div className="setting-item">
          <label htmlFor="ragChunkOverlap">文本重叠大小:</label>
          <input
            type="text"
            id="ragChunkOverlap"
            value={localChunkOverlap}
            onChange={(e) => {
              const value = e.target.value;
              if (value === '') {
                setChunkOverlapError('不能为空');
                setLocalChunkOverlap('');
              } else if (!/^\d+$/.test(value)) {
                setChunkOverlapError('不能包含非数字');
                setLocalChunkOverlap(value);
              } else {
                setChunkOverlapError('');
                const newChunkOverlap = parseInt(value);
                setLocalChunkOverlap(newChunkOverlap);
                validateChunkRelationship(localChunkSize, newChunkOverlap);
              }
            }}
            className={`chunk-overlap-input ${chunkOverlapError ? 'error' : ''}`}
            placeholder="请输入数字"
          />
          {chunkOverlapError && (
            <div className="error-message">{chunkOverlapError}</div>
          )}
          {chunkValidationError && (
            <div className="error-message">{chunkValidationError}</div>
          )}
          <div className="setting-description">
            片段之间的重叠字符数（建议50-100）
          </div>
        </div>
      </div>

    </div>
  );
});

// 知识库管理组件 - 包含知识库文件列表、检索设置和意图分析模型配置
const KnowledgeBaseManagement = forwardRef(({ onSaveComplete }, ref) => {
  const dispatch = useDispatch();
  const { invoke, setStoreValue } = useIpcRenderer();
  const {
    intentAnalysisModel,
    availableModels
  } = useSelector((state) => state.chat);
  
  const [localIntentModel, setLocalIntentModel] = useState('');
  const [localIntentPrompt, setLocalIntentPrompt] = useState('');

  // 加载意图分析设置
  const loadIntentAnalysisSettings = useCallback(async () => {
    try {
      const [storedIntentModel, storedIntentPrompt] = await Promise.all([
        invoke('get-store-value', 'intentAnalysisModel'),
        invoke('get-intent-analysis-prompt')
      ]);
      
      setLocalIntentModel(storedIntentModel || '');
      setLocalIntentPrompt(storedIntentPrompt.prompt || '');
    } catch (error) {
      console.error('加载意图分析设置失败:', error);
    }
  }, [invoke]);

  // 初始化加载设置
  useEffect(() => {
    loadIntentAnalysisSettings();
  }, [loadIntentAnalysisSettings]);

  // 保存意图分析设置
  const handleSaveIntentAnalysis = async () => {
    try {
      // 保存意图分析模型
      dispatch(setIntentAnalysisModel(localIntentModel));
      await setStoreValue('intentAnalysisModel', localIntentModel);
      
      // 保存自定义提示词
      if (localIntentPrompt.trim()) {
        await invoke('set-intent-analysis-prompt', localIntentPrompt.trim());
      } else {
        // 如果提示词为空，重置为默认值
        await invoke('reset-intent-analysis-prompt');
      }
      
      if (onSaveComplete) {
        onSaveComplete('意图分析设置保存成功！', true);
      }
    } catch (error) {
      console.error('保存意图分析设置失败:', error);
      if (onSaveComplete) {
        onSaveComplete('意图分析设置保存失败，请重试。', false);
      }
    }
  };

  // 重置提示词为默认值
  const handleResetPrompt = async () => {
    try {
      const result = await invoke('reset-intent-analysis-prompt');
      if (result.success) {
        setLocalIntentPrompt(result.prompt || '');
        if (onSaveComplete) {
          onSaveComplete('提示词已重置为默认值！', true);
        }
      }
    } catch (error) {
      console.error('重置提示词失败:', error);
      if (onSaveComplete) {
        onSaveComplete('重置提示词失败，请重试。', false);
      }
    }
  };

  // 暴露保存方法给父组件
  useImperativeHandle(ref, () => ({
    handleSaveIntentAnalysis
  }));

  return (
    <div className="knowledge-base-management-content">
      {/* 知识库文件列表 */}
      <div className="settings-section">
        <div className="knowledge-base-panel-inline">
          <KnowledgeBasePanel onClose={null} />
        </div>
      </div>

      {/* 检索设置 */}
      <div className="settings-section">
        <h5>检索设置</h5>
        <RetrievalSettings />
      </div>

      {/* 意图分析模型配置 */}
      <div className="settings-section">
        <h5>意图分析模型配置</h5>
        
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

        <div className="setting-item">
          <label htmlFor="intentAnalysisPrompt">意图分析提示词:</label>
          <div className="prompt-input-container">
            <textarea
              id="intentAnalysisPrompt"
              value={localIntentPrompt}
              onChange={(e) => setLocalIntentPrompt(e.target.value)}
              placeholder="请输入自定义意图分析提示词..."
              rows={4}
              className="prompt-textarea"
            />
            <div className="prompt-actions">
              <button
                type="button"
                onClick={handleResetPrompt}
                className="reset-prompt-button"
                title="重置为默认提示词"
              >
                重置
              </button>
            </div>
          </div>
          <div className="setting-description">
            自定义意图分析模型的提示词。留空将使用默认提示词。
          </div>
        </div>
      </div>
    </div>
  );
});

// 主组件 - 整合RAG设置和知识库管理
const RagKnowledgeBaseSettings = forwardRef(({ onSaveComplete }, ref) => {
  return (
    <div className="rag-knowledge-base-settings">
      {/* 这里将包含RAG设置和知识库管理两个部分 */}
      <RagSettings ref={ref} onSaveComplete={onSaveComplete} />
    </div>
  );
});

export { RagSettings, KnowledgeBaseManagement };
export default RagKnowledgeBaseSettings;
