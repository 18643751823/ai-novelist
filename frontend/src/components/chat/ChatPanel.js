import React, { useEffect, useRef, useCallback, memo, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  appendMessage,
  setQuestionCard,
  setMessages,
  setIsHistoryPanelVisible,
  setDeepSeekHistory,
  setSelectedModel,
  setSelectedProvider, // 新增：导入设置选中提供商的action
  setShowApiSettingsModal,
  setShowRagSettingsModal,
  setShowGeneralSettingsModal,
  // setShowWorkspacePanel, // 新增：导入设置工作区面板的action - 暂时隐藏工作流功能
  setDeepseekApiKey,
  setOpenrouterApiKey,
  setSiliconflowApiKey, // 新增：导入设置硅基流动API Key的action
  setAliyunEmbeddingApiKey, // 新增：导入设置阿里云嵌入API Key的action
  setIntentAnalysisModel, // 新增：导入设置意图分析模型的action
  setAvailableModels,
  setCustomSystemPrompt, // 新增
  resetCustomSystemPrompt, // 新增
  setEnableStream, // 新增
  approveToolCalls,
  rejectToolCalls,
  deleteMessage,
  startEditing,
  restoreMessages, // <--- 导入新的 action
  setCustomPromptForMode, // 新增：导入设置模式特定提示词的action
  resetCustomPromptForMode, // 新增：导入重置模式特定提示词的action
  setModeFeatureSetting, // 新增：导入设置模式功能设置的action
  resetModeFeatureSettings, // 新增：导入重置模式功能设置的action
  setContextLimitSettings, // 新增：导入设置上下文限制设置的action
  setAdditionalInfoForMode, // 新增：导入设置附加信息的action
  setIsCreationModeEnabled, // 新增：导入设置创作模式启用状态的action
  setShowCreationModal, // 新增：导入设置创作模式弹窗显示状态的action
  setAdditionalInfoForAllModes, // 新增：导入批量设置附加信息的action
  setStreamingState, // 新增：导入设置流式状态的action
  stopStreaming, // 新增：导入停止流式传输的action
  setAiParametersForAllModes, // 新增：导入设置所有模式AI参数的action
  setAiParametersForMode, // 新增：导入设置特定模式AI参数的action
  setRetrievalTopK, // 新增：导入设置检索返回文档片段数的action
} from '../../store/slices/chatSlice';
import { DEFAULT_SYSTEM_PROMPT } from '../../store/slices/chatSlice'; // 导入默认系统提示词
import { startDiff, acceptSuggestion, rejectSuggestion } from '../../store/slices/novelSlice';
import useIpcRenderer from '../../hooks/useIpcRenderer';
import { restoreChatCheckpoint } from '../../ipc/checkpointIpcHandler';
import ChatHistoryPanel from './ChatHistoryPanel';
import NotificationModal from '../others/NotificationModal';
import ConfirmationModal from '../others/ConfirmationModal';
import CreationModeModal from './CreationModeModal';
import PromptManagerModal from '../agent/promptTab/PromptManagerModal'; // 新增：导入提示词管理模态框
import ModeSelector from './ModeSelector'; // 新增：导入模式选择器
import ModelSelectorPanel from './ModelSelectorPanel'; // 新增：导入模型选择面板
import './ChatPanel.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClock, faTrashCan, faPaperPlane, faGear, faSpinner, faBoxArchive, faCopy, faRedo, faPencil, faPlus, faWrench, faBook, faAngleLeft, faAngleRight, faStop } from '@fortawesome/free-solid-svg-icons';
import CustomProviderSettings from '../aiprovider/providersettings/CustomProviderSettings'; // 新增

// 新增：可重用的工具调用渲染组件
const ToolCallCard = ({ toolCall }) => {
  // 确保 toolCall 和其属性是存在的，避免运行时错误
  const toolName = toolCall?.function?.name || '未知工具';
  const toolArgs = toolCall?.toolArgs || {};
  const status = toolCall?.status;
  const isHistorical = status === 'historical';

  // 根据工具名称生成可读的标题
  const getToolDisplayName = (name) => {
    const nameMap = {
      'write_file': '写入文件',
      'ask_user_question': '提问',
      'end_task': '结束任务',
      'apply_diff': '应用差异',
      'insert_content': '插入内容',
    };
    return nameMap[name] || name;
  };

  return (
    <div className={`tool-call-card ${isHistorical ? 'historical' : ''}`}>
      <div className="tool-call-header">
        <FontAwesomeIcon icon={faBoxArchive} className="tool-icon" />
        <span className="tool-name">{getToolDisplayName(toolName)}</span>
        {isHistorical && <span className="historical-badge">历史记录</span>}
      </div>
      <pre className="tool-args">
        {JSON.stringify(toolArgs, null, 2)}
      </pre>
    </div>
  );
};


// 辅助函数：根据 insert_content 参数生成预览文本
const getInsertContentPreview = (currentContent, { paragraph, content: textToInsert }) => {
  if (typeof currentContent !== 'string' || typeof textToInsert !== 'string') return null;

  const lines = currentContent.split('\n');
  const paraIndex = parseInt(paragraph, 10);

  // paragraph 0 或无效值表示在末尾追加
  if (isNaN(paraIndex) || paraIndex <= 0) {
    lines.push(textToInsert);
  } else {
    // paragraph 是 1-based，数组索引是 0-based
    const insertAtIndex = Math.min(paraIndex - 1, lines.length);
    lines.splice(insertAtIndex, 0, textToInsert);
  }

  return lines.join('\n');
};

// 模型选择器组件
const ModelSelector = ({ selectedModel, availableModels, onModelChange, setStoreValue }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(0);
  const modelsPerPage = 5;

  // 过滤模型
  const filteredModels = availableModels.filter(model =>
    model.id.toLowerCase().includes(searchText.toLowerCase()) ||
    model.provider.toLowerCase().includes(searchText.toLowerCase())
  );

  // 分页模型
  const startIndex = page * modelsPerPage;
  const paginatedModels = filteredModels.slice(startIndex, startIndex + modelsPerPage);
  const totalPages = Math.ceil(filteredModels.length / modelsPerPage);

  // 获取当前选中模型的显示名称
  const getDisplayModelName = () => {
    if (!selectedModel) return '';
    const model = availableModels.find(m => m.id === selectedModel);
    return model ? model.id : selectedModel;
  };

  const handleModelSelect = async (modelId) => {
    onModelChange(modelId);
    
    // 保存到持久化存储
    if (setStoreValue) {
      try {
        await setStoreValue('selectedModel', modelId);
        console.log(`[模型选择器] 已保存模型选择: ${modelId}`);
      } catch (error) {
        console.error('[模型选择器] 保存模型选择失败:', error);
      }
    }
    
    setIsExpanded(false);
    setSearchText('');
    setPage(0);
  };

  // 处理搜索框点击事件，阻止事件冒泡
  const handleSearchClick = (e) => {
    e.stopPropagation();
  };

  // 处理搜索框输入变化
  const handleSearchChange = (e) => {
    setSearchText(e.target.value);
    setPage(0);
  };

  return (
    <div className="model-selector-container">
      <div
        className="model-selector-bar"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? (
          <input
            type="text"
            placeholder={getDisplayModelName()}
            value={searchText}
            onChange={handleSearchChange}
            onClick={handleSearchClick}
            className="model-search-input-bar"
            autoFocus
          />
        ) : (
          <span className="selected-model-name">{getDisplayModelName()}</span>
        )}
        <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
      </div>

      {isExpanded && (
        <div className="model-selector-dropdown">
          {/* 模型列表 */}
          <div className="model-list">
            {paginatedModels.map((model) => (
              <div
                key={model.id}
                className={`model-item ${selectedModel === model.id ? 'selected' : ''}`}
                onClick={() => handleModelSelect(model.id)}
              >
                <div className="model-name">{model.id}</div>
                <div className="model-provider">{model.provider}</div>
              </div>
            ))}
          </div>

          {/* 分页控制 */}
          {totalPages > 1 && (
            <div className="model-pagination">
              <button
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
                className="pagination-btn"
              >
                <FontAwesomeIcon icon={faAngleLeft} />
              </button>
              <span className="page-info">
                {page + 1} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage(page + 1)}
                className="pagination-btn"
              >
                <FontAwesomeIcon icon={faAngleRight} />
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
      )}
    </div>
  );
};

const ChatPanel = memo(() => {
  const dispatch = useDispatch();
  // 从 chat slice 获取状态
  const {
    messages,
    pendingToolCalls,
    toolCallState,
    questionCard,
    isHistoryPanelVisible,
    deepSeekHistory,
    showApiSettingsModal,
    showRagSettingsModal,
    showGeneralSettingsModal,
    showWorkspacePanel,
    deepseekApiKey,
    openrouterApiKey,
    siliconflowApiKey, // 新增：硅基流动API Key
    aliyunEmbeddingApiKey, // 新增：阿里云嵌入API Key
    intentAnalysisModel, // 新增：意图分析模型
    selectedModel,
    availableModels,
    customSystemPrompt,
    enableStream,
    editingMessageId,
    customPrompts,
    modeFeatureSettings, // 新增：模式特定的功能设置
    contextLimitSettings,
    additionalInfo,
    isCreationModeEnabled,
    showCreationModal,
    isStreaming, // 新增：流式传输状态
    aiParameters, // 新增：AI参数
  } = useSelector((state) => state.chat);
  
  // 使用 ref 来获取最新的状态值，避免闭包问题
  const latestAliyunEmbeddingApiKey = useRef(aliyunEmbeddingApiKey);
  latestAliyunEmbeddingApiKey.current = aliyunEmbeddingApiKey;
  
  // 使用 ref 来跟踪模型变化
  const previousSelectedModelRef = useRef(selectedModel);

  // 从 novel slice 获取状态
  const { openTabs, activeTabId } = useSelector((state) => state.novel);
  const activeTab = activeTabId ? openTabs.find(tab => tab.id === activeTabId) : null;
 
   const chatDisplayRef = useRef(null);
  const currentSessionIdRef = useRef(null);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState('');
  const [onConfirmCallback, setOnConfirmCallback] = useState(null);
  const [onCancelCallback, setOnCancelCallback] = useState(null);
  const [selectedProvider, setSelectedProvider] = useState(''); // 取消默认的DeepSeek选择
  const [notification, setNotification] = useState({ show: false, message: '' });
  const [editingText, setEditingText] = useState('');
  const [currentMode, setCurrentMode] = useState('general'); // 新增：当前创作模式
  const [customModes, setCustomModes] = useState([]); // 新增：自定义模式列表
  const [showPromptManager, setShowPromptManager] = useState(false); // 新增：提示词管理模态框状态
  const [showModelSelectorPanel, setShowModelSelectorPanel] = useState(false); // 新增：模型选择面板显示状态

  const { invoke, getDeepSeekChatHistory, deleteDeepSeekChatHistory, clearDeepSeekConversation, getStoreValue, setStoreValue, listAllModels, send, on, removeListener, setAliyunEmbeddingApiKey: setAliyunEmbeddingApiKeyIpc, reinitializeModelProvider, reinitializeAliyunEmbedding, stopStreaming: stopStreamingIpc } = useIpcRenderer();
  
  // 处理外部链接点击
  const handleExternalLinkClick = useCallback(async (url, event) => {
    event.preventDefault();
    try {
      // 使用 electron shell 打开外部链接
      if (window.electron && window.electron.openExternal) {
        await window.electron.openExternal(url);
      } else {
        // 备用方案：使用 IPC
        await invoke('open-external', url);
      }
    } catch (error) {
      console.error('打开外部链接失败:', error);
      // 如果所有方法都失败，回退到默认行为
      window.open(url, '_blank');
    }
  }, [invoke]);
  
  const handleToggleRagRetrieval = useCallback(async (mode, enabled) => {
    try {
      dispatch(setModeFeatureSetting({ mode, feature: 'ragRetrievalEnabled', enabled }));
      await invoke('set-rag-retrieval-enabled', mode, enabled); // 传递 mode 参数
      await setStoreValue('ragRetrievalEnabled', enabled); // 持久化全局状态
      await setStoreValue('modeFeatureSettings', { ...modeFeatureSettings, [mode]: { ...modeFeatureSettings[mode], ragRetrievalEnabled: enabled } }); // 持久化模式状态
      console.log(`[${mode}]模式RAG检索功能已${enabled ? '启用' : '禁用'}`);
    } catch (error) {
      console.error('切换RAG检索功能失败:', error);
    }
  }, [dispatch, invoke, setStoreValue, modeFeatureSettings]);

  // 将 loadSettings 定义为 useCallback，确保其稳定性
  const loadSettings = useCallback(async () => {
    try {
      // 加载 DeepSeek API Key
      const storedDeepseekApiKey = await getStoreValue('deepseekApiKey');
      if (storedDeepseekApiKey) {
        dispatch(setDeepseekApiKey(storedDeepseekApiKey));
        console.log(`加载到的 DeepSeek API Key: ${storedDeepseekApiKey}`);
      }

      // 加载 OpenRouter API Key
      const storedOpenrouterApiKey = await getStoreValue('openrouterApiKey');
      if (storedOpenrouterApiKey) {
        dispatch(setOpenrouterApiKey(storedOpenrouterApiKey));
        console.log(`加载到的 OpenRouter API Key: ${storedOpenrouterApiKey}`);
      }

      // 加载硅基流动 API Key
      const storedSiliconflowApiKey = await getStoreValue('siliconflowApiKey');
      if (storedSiliconflowApiKey) {
        dispatch(setSiliconflowApiKey(storedSiliconflowApiKey));
        console.log(`加载到的硅基流动 API Key: ${storedSiliconflowApiKey}`);
      }

      // 加载阿里云嵌入API Key
      const storedAliyunEmbeddingApiKey = await getStoreValue('aliyunEmbeddingApiKey');
      console.log(`从store获取的阿里云嵌入API Key值:`, storedAliyunEmbeddingApiKey);
      if (storedAliyunEmbeddingApiKey) {
        dispatch(setAliyunEmbeddingApiKey(storedAliyunEmbeddingApiKey));
        console.log(`加载到的阿里云嵌入API Key: ${storedAliyunEmbeddingApiKey}`);
      } else {
        console.log('阿里云嵌入API Key未设置或为空');
      }

      // 加载意图分析模型
      const storedIntentAnalysisModel = await getStoreValue('intentAnalysisModel');
      console.log(`从store获取的意图分析模型:`, storedIntentAnalysisModel);
      if (storedIntentAnalysisModel) {
        dispatch(setIntentAnalysisModel(storedIntentAnalysisModel));
        console.log(`加载到的意图分析模型: ${storedIntentAnalysisModel}`);
      } else {
        console.log('意图分析模型未设置，将使用默认模型');
      }

      // 注意：selectedModel 和 selectedProvider 已经在 App.js 中加载到 Redux
      // 这里不再重复加载，避免状态竞争问题
      console.log(`[ChatPanel] loadSettings - 当前Redux状态中的selectedModel: "${selectedModel}"`);
      console.log(`[ChatPanel] loadSettings - 当前Redux状态中的selectedProvider: "${selectedProvider}"`);
      // 加载当前模式设置
      const storedCurrentMode = await getStoreValue('currentMode');
      if (storedCurrentMode) {
        setCurrentMode(storedCurrentMode);
        console.log(`加载到的当前模式: ${storedCurrentMode}`);
      } else {
        setCurrentMode('general'); // 默认模式
        console.log('未加载到当前模式，使用默认模式: general');
      }

      // 加载自定义模式
      const storedCustomModes = await getStoreValue('customModes') || [];
      setCustomModes(storedCustomModes);
      console.log(`加载到的自定义模式: ${storedCustomModes.length}个`);

      // 加载每个模式的自定义提示词
      const storedCustomPrompts = await getStoreValue('customPrompts');
      console.log('从存储加载的 customPrompts:', storedCustomPrompts);
      if (storedCustomPrompts) {
        // 更新Redux state中的每个模式提示词
        Object.entries(storedCustomPrompts).forEach(([mode, prompt]) => {
          dispatch(setCustomPromptForMode({ mode, prompt }));
        });
        console.log('加载到的模式自定义提示词:', storedCustomPrompts);
      } else {
        console.log('未加载到自定义提示词，使用初始状态。');
      }

      // 获取并设置可用模型列表
      console.log('loadSettings: 开始调用 listAllModels...');
      const modelsResult = await listAllModels();
      console.log('loadSettings: listAllModels 调用完成，结果:', modelsResult.success, modelsResult.models ? modelsResult.models.length : 'N/A');
      if (modelsResult.success) {
          dispatch(setAvailableModels(modelsResult.models));
          console.log('loadSettings: availableModels 已 dispatch，Redux 状态更新。');
          console.log('可用模型列表已加载:', modelsResult.models.map(m => m.id));

          // 确保 selectedProvider 与当前选中的模型匹配
          // 直接从存储获取当前模型，避免依赖Redux状态
          const currentStoredModel = await getStoreValue('selectedModel');
          const currentSelectedModel = currentStoredModel || selectedModel || '';
          const matchedModel = modelsResult.models.find(m => m.id === currentSelectedModel);
          
          // 重新同步 selectedModel 为存储值，确保 Redux 状态与存储一致
          console.log(`[同步调试] 存储值=${currentStoredModel}, Redux状态=${selectedModel}, 是否不一致=${currentStoredModel && selectedModel !== currentStoredModel}`);
          if (currentStoredModel && selectedModel !== currentStoredModel) {
              dispatch(setSelectedModel(currentStoredModel));
              console.log(`重新同步 selectedModel 为存储值: ${currentStoredModel}`);
          } else {
              console.log(`[同步调试] 状态一致，无需同步: 存储=${currentStoredModel}, Redux=${selectedModel}`);
          }
          if (matchedModel) {
              setSelectedProvider(matchedModel.provider);
              console.log(`loadSettings: 根据选中模型 '${currentSelectedModel}'，设置 selectedProvider 为 '${matchedModel.provider}'`);
          } else if (currentSelectedModel) {
              // 如果当前选中模型不在可用列表中，则清空选择
              setSelectedProvider('');
              dispatch(setSelectedModel(''));
              console.warn(`loadSettings: 选中模型 '${currentSelectedModel}' 不在可用模型列表中，清空选择`);
          }
      } else {
          console.error('loadSettings: 获取可用模型列表失败:', modelsResult.error);
      }

      // 加载AI参数设置
      const storedAiParameters = await getStoreValue('aiParameters');
      if (storedAiParameters) {
        // 直接使用从存储中获取的aiParameters，跳过有问题的迁移逻辑
        console.log(`[DEBUG] 从存储加载的原始AI参数:`, JSON.stringify(storedAiParameters, null, 2));
        
        // 设置各个模式的AI参数（包括内置模式和自定义模式）
        const allModes = new Set([
          'general', 'outline', 'writing', 'adjustment', // 内置模式
          ...storedCustomModes.map(mode => mode.id) // 自定义模式
        ]);
        
        for (const mode of allModes) {
          if (storedAiParameters[mode]) {
            dispatch(setAiParametersForMode({ mode, parameters: storedAiParameters[mode] }));
            console.log(`[DEBUG] 为模式 ${mode} 设置AI参数:`, storedAiParameters[mode]);
          } else {
            // 对于没有存储参数的模式，使用默认参数
            const defaultParameters = {
              temperature: 0.7,
              top_p: 0.7,
              n: 1
            };
            dispatch(setAiParametersForMode({ mode, parameters: defaultParameters }));
            console.log(`[DEBUG] 为模式 ${mode} 初始化默认AI参数`);
          }
        }
        console.log(`加载到的AI参数设置:`, JSON.stringify(storedAiParameters, null, 2));
      } else {
        console.log('未加载到AI参数设置，使用默认值');
        // 如果没有存储的AI参数，为所有模式（包括自定义模式）初始化默认参数
        const allModes = new Set([
          'general', 'outline', 'writing', 'adjustment', // 内置模式
          ...storedCustomModes.map(mode => mode.id) // 自定义模式
        ]);
        
        const defaultParameters = {
          temperature: 0.7,
          top_p: 0.7,
          n: 1
        };
        
        for (const mode of allModes) {
          dispatch(setAiParametersForMode({ mode, parameters: defaultParameters }));
        }
        console.log(`[DEBUG] 为所有模式初始化默认AI参数`);
      }

      // 加载流式传输设置并同步到后端
      const storedEnableStream = await getStoreValue('enableStream');
      const streamEnabled = storedEnableStream !== false; // 默认为 true
      dispatch(setEnableStream(streamEnabled));
      send('set-streaming-mode', { stream: streamEnabled }); // **新增**: 将设置同步到后端
      console.log(`加载到的流式传输设置: ${streamEnabled}，并已同步到后端。`);

      // 加载功能启用状态（模式特定）- 只加载RAG检索功能
      const storedModeFeatureSettings = await getStoreValue('modeFeatureSettings');
      console.log('[DEBUG] 从存储获取的 modeFeatureSettings:', JSON.stringify(storedModeFeatureSettings, null, 2));
      
      if (storedModeFeatureSettings) {
        // 更新Redux state中的每个模式功能设置（只处理RAG检索）
        Object.entries(storedModeFeatureSettings).forEach(([mode, settings]) => {
          console.log(`[DEBUG] 处理模式 ${mode} 的功能设置:`, settings);
          if (settings.ragRetrievalEnabled !== undefined) {
            console.log(`[DEBUG] 分发模式 ${mode} 的 ragRetrievalEnabled: ${settings.ragRetrievalEnabled}`);
            dispatch(setModeFeatureSetting({ mode, feature: 'ragRetrievalEnabled', enabled: settings.ragRetrievalEnabled }));
          }
        });
        console.log('加载到的模式功能设置:', storedModeFeatureSettings);
      } else {
        console.log('未加载到模式功能设置，使用默认值');
      }

      // 加载上下文限制设置
      try {
        const contextSettingsResult = await invoke('get-context-limit-settings');
        if (contextSettingsResult.success) {
          dispatch(setContextLimitSettings(contextSettingsResult.settings));
          console.log('加载到的上下文限制设置:', contextSettingsResult.settings);
        } else {
          console.error('加载上下文限制设置失败:', contextSettingsResult.error);
        }
      } catch (error) {
        console.error('调用上下文限制设置API失败:', error);
      }

      // 加载附加信息
      const storedAdditionalInfo = await getStoreValue('additionalInfo');
      console.log('从存储加载的 additionalInfo:', storedAdditionalInfo);
      if (storedAdditionalInfo) {
        // 更新Redux state中的每个模式附加信息
        Object.entries(storedAdditionalInfo).forEach(([mode, info]) => {
          dispatch(setAdditionalInfoForMode({ mode, info }));
        });
        console.log('加载到的附加信息:', storedAdditionalInfo);
      } else {
        console.log('未加载到附加信息，使用初始状态。');
      }

      // 加载检索设置
      try {
        const retrievalSettingsResult = await invoke('get-retrieval-top-k');
        if (retrievalSettingsResult.success) {
          dispatch(setRetrievalTopK(retrievalSettingsResult.topK));
          console.log(`加载到的检索设置: topK=${retrievalSettingsResult.topK}`);
        } else {
          console.warn('加载检索设置失败:', retrievalSettingsResult.error);
          // 使用默认值
          dispatch(setRetrievalTopK(3));
        }
      } catch (error) {
        console.error('调用检索设置API失败:', error);
        // 使用默认值
        dispatch(setRetrievalTopK(3));
      }

      console.log('loadSettings: 结束加载设置。');

    } catch (error) {
      console.error('加载设置失败:', error);
    }
  }, [dispatch, getStoreValue, setDeepseekApiKey, setOpenrouterApiKey, setSiliconflowApiKey, setSelectedModel, listAllModels, setAvailableModels, setSelectedProvider, invoke, setRetrievalTopK]); // 更新依赖

  const handleUserQuestionResponse = useCallback(async (response, toolCallId, isButtonClick) => {
    dispatch(setQuestionCard(null));

    const formattedResponse = isButtonClick
      ? `同意/批准此建议：${response}`
      : `用户暂时没有采纳这些建议，而是给出了其他回复：${response}`;
    
    // 将用户的原始回复（未格式化）添加到聊天记录中
    dispatch(appendMessage({ sender: 'User', text: response, role: 'user', content: response, className: 'user', sessionId: toolCallId }));

    if (enableStream) {
      dispatch(appendMessage({
        sender: 'AI',
        text: '',
        role: 'assistant',
        content: '',
        className: 'ai',
        sessionId: toolCallId, // Use the same session ID for the loading response
        isLoading: true,
      }));
    }
    
    try {
      await invoke('user-question-response', { response: formattedResponse, toolCallId });
    } catch (error) {
      console.error('Error sending user question response:', error);
    }
  }, [dispatch, invoke, enableStream]);

  const handleSendMessage = useCallback(async (messageText) => {
    if (!messageText.trim()) return;

    // **新逻辑**: 检查是否存在一个待回答的问题
    if (questionCard && questionCard.toolCallId) {
      // 如果有，则此消息是对该问题的回答
      handleUserQuestionResponse(messageText, questionCard.toolCallId, false);
      return; // 结束函数，不执行常规消息发送
    }

    // --- 以下是常规消息发送逻辑 ---
    const currentSessionId = currentSessionIdRef.current || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    currentSessionIdRef.current = currentSessionId;

    const newUserMessage = {
      sender: 'User',
      text: messageText,
      role: 'user',
      content: messageText,
      className: 'user',
      sessionId: currentSessionId,
    };
    dispatch(appendMessage(newUserMessage));

    if (enableStream) {
      dispatch(appendMessage({
        sender: 'AI',
        text: '',
        role: 'assistant',
        content: '',
        className: 'ai',
        sessionId: currentSessionId,
        isLoading: true,
      }));
    }

    dispatch(setQuestionCard(null));

    try {
      // 检查是否有可用的模型 - 直接从存储获取，避免Redux状态同步问题
      const currentStoredModel = await getStoreValue('selectedModel');
      const currentModel = currentStoredModel || selectedModel || '';
      console.log(`[ChatPanel] handleSendMessage - 存储模型: "${currentStoredModel}", Redux模型: "${selectedModel}", 最终使用: "${currentModel}"`);
      
      if (!currentModel || currentModel.trim() === '') {
        console.log('[ChatPanel] 最终模型为空，显示错误消息');
        dispatch(appendMessage({
          sender: 'System',
          text: '当前没有可用的AI模型。请先前往设置页面配置API密钥。如果已经配置，请在上方重新选择模型，再次发送信息即可',
          role: 'system',
          content: '当前没有可用的AI模型。请先前往设置页面配置API密钥。如果已经配置，请在上方重新选择模型，再次发送信息即可',
          className: 'system-error'
        }));
        return;
      }

      // 直接从存储获取当前模式的自定义提示词，避免Redux状态同步延迟问题
      const storedCustomPrompts = await getStoreValue('customPrompts');
      const customPrompt = storedCustomPrompts ? storedCustomPrompts[currentMode] : '';
      const hasCustomPrompt = customPrompt !== null && customPrompt !== undefined && customPrompt !== '';
      console.log(`[ChatPanel] 发送消息，模式: ${currentMode}, 自定义提示词: ${hasCustomPrompt ? '有' : '无'}`);
      console.log(`[ChatPanel] 自定义提示词详情: 类型=${typeof customPrompt}, 值="${customPrompt}"`);
      console.log(`[ChatPanel] 从存储读取的完整提示词:`, storedCustomPrompts);
      console.log(`[值传递流程-4] 组件获取 selectedModel: ${currentModel} (存储: ${currentStoredModel}, Redux: ${selectedModel})`);
      console.log(`[ChatPanel] 当前选中模型: ${currentModel}, 将传递给后端`);
      // 获取当前模式的功能设置（工具功能已硬编码，只传递RAG检索状态）
      const currentModeFeatures = modeFeatureSettings[currentMode] || {
        ragRetrievalEnabled: false
      };

      // 获取当前模式的AI参数
      const currentModeAiParameters = aiParameters[currentMode] || {
        temperature: 0.7,
        top_p: 0.7,
        n: 1,
      };

      await invoke('process-command', {
        message: messageText,
        sessionId: currentSessionId,
        currentMessages: messages,
        mode: currentMode,
        customPrompt: customPrompt, // 添加自定义提示词参数
        ragRetrievalEnabled: currentModeFeatures.ragRetrievalEnabled, // 添加模式特定的RAG检索状态
        model: currentModel, // 新增：传递当前选中的模型（直接从存储获取，避免Redux延迟）
        aiParameters: currentModeAiParameters // 新增：传递当前模式的AI参数
      });
      console.log(`[值传递流程-5] 已调用 invoke('process-command')，模型参数: ${currentModel}`);
      console.log(`[DEBUG][ChatPanel] 传递给后端的AI参数:`, JSON.stringify(currentModeAiParameters, null, 2));
    } catch (error) {
      console.error('Error sending message to AI:', error);
      dispatch(appendMessage({ sender: 'System', text: `发送消息失败: ${error.message}`, role: 'system', content: `发送消息失败: ${error.message}`, className: 'system-error' }));
    }
  }, [dispatch, invoke, messages, questionCard, handleUserQuestionResponse, enableStream, currentMode, modeFeatureSettings]);

  // New handler for approving/rejecting all pending tool calls
  const handleToolApproval = useCallback(async (action) => {
    if (toolCallState !== 'pending_user_action' || !pendingToolCalls || pendingToolCalls.length === 0) {
      return;
    }

    const isFileModification = pendingToolCalls.some(call => call.tool_name === 'write_to_file' || call.tool_name === 'apply_diff');

    // Dispatch action to update state immediately
    if (action === 'approve') {
      // 移除对 acceptSuggestion 的前端调用。UI 更新将由后端的 'file-content-updated' 事件驱动。
      dispatch(approveToolCalls());
    } else {
      dispatch(rejectToolCalls());
      if (isFileModification && activeTabId) {
        dispatch(rejectSuggestion(activeTabId));
      }
    }

    // Send IPC message to the backend
    try {
      // The backend now expects 'approve' or 'reject' for the entire batch
      await invoke('process-tool-action', {
        actionType: action,
        toolCalls: pendingToolCalls,
      });
    } catch (error) {
      console.error('Error processing tool action:', error);
      // Optionally dispatch an error message to the UI
      dispatch(appendMessage({ sender: 'System', text: `工具操作失败: ${error.message}`, role: 'system', className: 'system-error' }));
    }
  }, [dispatch, invoke, pendingToolCalls, toolCallState, activeTabId]);

  // 设置相关函数已移至 ApiSettingsTab 和 GeneralSettingsTab 组件

 // 新增：处理模式切换回调
 const handleModeSwitch = useCallback((mode) => {
   setCurrentMode(mode);
   setStoreValue('currentMode', mode);
 }, [setStoreValue]);

 // 新增：处理重新生成正文
 const handleRegenerateWriting = useCallback(async () => {
   // 这里需要实现重新生成正文的逻辑
   // 可能需要发送特定的消息给AI来重新生成
   console.log('重新生成正文');
 }, []);

 // 新增：处理进入调整模式
 const handleEnterAdjustmentMode = useCallback(() => {
   setCurrentMode('adjustment');
   setStoreValue('currentMode', 'adjustment');
 }, [setStoreValue]);



  const handleResetChat = useCallback(async () => { // 将 handleResetChat 封装为 useCallback
    dispatch(setMessages([])); // 清除聊天消息
    // dispatch(clearToolSuggestions()); // This is now handled by the new tool call flow
    dispatch(setQuestionCard(null)); // 清除提问卡片
    currentSessionIdRef.current = null; // 重置 sessionId

      try {
        await clearDeepSeekConversation(); // 清除后端 DeepSeek 历史
      } catch (error) {
        console.error('Error clearing DeepSeek conversation:', error);
      }
   }, [dispatch, clearDeepSeekConversation]);

  const loadDeepSeekChatHistory = useCallback(async () => { // 将 loadDeepSeekChatHistory 封装为 useCallback
    try {
      const history = await getDeepSeekChatHistory();
      dispatch(setDeepSeekHistory(history));
    } catch (error) {
      console.error('Error loading DeepSeek chat history:', error);
    }
  }, [dispatch, getDeepSeekChatHistory]); // 依赖中添加 dispatch, getDeepSeekChatHistory

  const handleSelectConversation = useCallback(async (sessionId) => { // 调整参数为 sessionId，并封装为 useCallback
    try {
      const conversation = deepSeekHistory.find(conv => conv.sessionId === sessionId);
      if (conversation) {
        // **关键修改**: 使用 restoreMessages 来重构历史会话的UI状态
        dispatch(restoreMessages(conversation.messages));
        currentSessionIdRef.current = sessionId;
        dispatch(setIsHistoryPanelVisible(false));
      }
    } catch (error) {
      console.error('Error selecting conversation:', error);
    }
  }, [dispatch, deepSeekHistory]);

  const handleDeleteConversation = useCallback(async (sessionId) => { // 将 handleDeleteConversation 封装为 useCallback
    setConfirmationMessage('确定要删除此对话吗？');
    setOnConfirmCallback(() => async () => {
      setShowConfirmationModal(false); // 关闭确认弹窗
      try {
        await deleteDeepSeekChatHistory(sessionId);
        loadDeepSeekChatHistory();
      } catch (error) {
        console.error('Error deleting conversation:', error);
      }
    });
    setOnCancelCallback(() => () => {
      setShowConfirmationModal(false); // 关闭确认弹窗
    });
    setShowConfirmationModal(true); // 显示确认弹窗
  }, [deleteDeepSeekChatHistory, loadDeepSeekChatHistory]);

  // 处理ai-response事件，包括流式传输状态
  useEffect(() => {
    const handleAiResponse = (event, data) => {
      const { type, payload } = data;
      
      if (type === 'streaming_started') {
        console.log('[ChatPanel] 收到流式传输开始事件');
        dispatch(setStreamingState({ isStreaming: true, abortController: null }));
      } else if (type === 'streaming_ended') {
        console.log('[ChatPanel] 收到流式传输结束事件');
        dispatch(setStreamingState({ isStreaming: false, abortController: null }));
      }
    };

    on('ai-response', handleAiResponse);

    return () => {
      removeListener('ai-response', handleAiResponse);
    };
  }, [on, removeListener, dispatch]);

  // 应用启动时加载一次设置
  useEffect(() => {
    console.log('ChatPanel: 组件挂载，开始加载设置和模型列表');
    loadSettings();
  }, [loadSettings]); // loadSettings 已经是 useCallback，依赖稳定

  // 轮询监听存储中customModes的变化，实时更新状态
  useEffect(() => {
    let pollingInterval = null;
    
    const pollCustomModes = async () => {
      try {
        const storedCustomModes = await getStoreValue('customModes') || [];
        setCustomModes(prevCustomModes => {
          // 只有当customModes实际发生变化时才更新状态
          if (JSON.stringify(prevCustomModes) !== JSON.stringify(storedCustomModes)) {
            console.log('[ChatPanel] 检测到customModes存储变化，更新状态:', storedCustomModes);
            return storedCustomModes;
          }
          return prevCustomModes;
        });
      } catch (error) {
        console.error('[ChatPanel] 轮询customModes失败:', error);
      }
    };

    // 每2秒轮询一次
    pollingInterval = setInterval(pollCustomModes, 2000);
    
    // 立即执行一次
    pollCustomModes();

    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [getStoreValue]);

  // 新增：专门处理模型列表加载，确保模型选择器能正确显示
  useEffect(() => {
    const loadModelsOnStartup = async () => {
      try {
        console.log('ChatPanel: 启动时加载模型列表...');
        const modelsResult = await listAllModels();
        console.log('ChatPanel: 模型列表加载结果:', modelsResult.success, modelsResult.models ? modelsResult.models.length : 'N/A');
        
        if (modelsResult.success) {
          dispatch(setAvailableModels(modelsResult.models));
          console.log('ChatPanel: 模型列表已更新，数量:', modelsResult.models.length);
          
          // 如果没有选中模型，尝试设置一个默认模型
          if (!selectedModel && modelsResult.models.length > 0) {
            const defaultModel = modelsResult.models[0];
            dispatch(setSelectedModel(defaultModel.id));
            console.log('ChatPanel: 设置默认模型:', defaultModel.id);
          }
        } else {
          console.error('ChatPanel: 模型列表加载失败:', modelsResult.error);
        }
      } catch (error) {
        console.error('ChatPanel: 加载模型列表异常:', error);
      }
    };

    // 延迟加载模型列表，确保其他初始化完成
    const timer = setTimeout(() => {
      loadModelsOnStartup();
    }, 1000);

    return () => clearTimeout(timer);
  }, [listAllModels, dispatch, selectedModel]);

  // 移除不必要的 selectedModel 变化监听，避免无限循环
  // 状态同步已经在 loadSettings 中处理，不需要额外监听

  // 新增：处理 show-diff-preview 事件的专用 effect
  useEffect(() => {
    const handleShowDiffPreview = (event, data) => {
        console.log('[ChatPanel] 收到 show-diff-preview 事件:', data);
        const { filePath, suggestedContent } = data;

        // 确保收到的数据有效
        if (!filePath || typeof suggestedContent !== 'string') {
            console.warn('[ChatPanel] show-diff-preview 事件缺少必要数据。');
            return;
        }

        // 兼容性修复：在匹配前，将两边的路径都统一为不带 'novel/' 前缀的干净格式
        const cleanIncomingPath = filePath.startsWith('novel/') ? filePath.substring(6) : filePath;
        
        const targetTab = openTabs.find(tab => {
            const cleanTabId = tab.id.startsWith('novel/') ? tab.id.substring(6) : tab.id;
            return cleanTabId === cleanIncomingPath;
        });

        if (targetTab) {
            console.log(`[ChatPanel] 兼容性匹配成功！找到标签页 (ID: ${targetTab.id})，准备触发 diff。`);
            dispatch(startDiff({ tabId: targetTab.id, suggestion: suggestedContent }));
        } else {
            console.warn(`[ChatPanel] 兼容性匹配失败：未找到与路径 '${filePath}' (clean: '${cleanIncomingPath}') 匹配的活动标签页。`);
        }
    };

    // 增加最大监听器限制以避免内存泄漏警告
    if (window.ipcRenderer && window.ipcRenderer.setMaxListeners) {
      window.ipcRenderer.setMaxListeners(20);
    }

    on('show-diff-preview', handleShowDiffPreview);

    // 在组件卸载时清理监听器
    return () => {
        removeListener('show-diff-preview', handleShowDiffPreview);
    };
  }, [on, removeListener, dispatch, openTabs]); // 依赖项包括 on, removeListener, dispatch 和 openTabs

  useEffect(() => {
    if (isHistoryPanelVisible) {
      loadDeepSeekChatHistory();
    }
  }, [isHistoryPanelVisible, loadDeepSeekChatHistory]);
 
   // 旧的、基于 useEffect 的 diff 触发器已被移除，因为它不可靠。
   // 新的逻辑由一个专门的 'show-diff-preview' IPC 事件处理器直接触发。


  // 自动滚动聊天区到底部 (此 useEffect 保留)
  useEffect(() => {
    if (chatDisplayRef.current) {
      chatDisplayRef.current.scrollTop = chatDisplayRef.current.scrollHeight;
    }
  }, [messages, questionCard, isHistoryPanelVisible]);

  return (
    <React.Fragment>
      
      <div className="chat-panel-content">
        <div className="chat-header-actions">
          {/* 设置按钮已移动到左侧组件栏 */}
          {/* 历史会话按钮移回ChatPanel */}
          <button className="history-button" onClick={() => {
            dispatch(setIsHistoryPanelVisible(!isHistoryPanelVisible));
            // 关闭其他面板
            if (!isHistoryPanelVisible) {
              setShowModelSelectorPanel(false);
            }
          }} title="历史会话">
            <FontAwesomeIcon icon={faClock} />
          </button>
          {/* 模型选择器 - 移动到头部按钮区域 */}
          <div className="model-selector-header-wrapper">
            <button
              className="model-selector-button"
              onClick={() => {
                setShowModelSelectorPanel(!showModelSelectorPanel);
                // 关闭其他面板
                if (!showModelSelectorPanel) {
                  dispatch(setIsHistoryPanelVisible(false));
                }
              }}
              title=""
            >
              <span className="selected-model-name">
                {selectedModel ? availableModels.find(m => m.id === selectedModel)?.id || selectedModel : ''}
              </span>
              <span className="expand-icon">▼</span>
            </button>
          </div>
          {/* 停止按钮已移动到输入区域 */}
        </div>

        <button className="reset-chat-button" onClick={handleResetChat}>×</button>
        <div id="chatDisplay" ref={chatDisplayRef}>
          {messages.map((msg, index) => (
            <div key={msg.id || index} className={`message ${msg.role === 'user' ? 'user' : msg.role === 'assistant' ? 'ai' : msg.role} ${msg.className || ''}`}>
              {msg.role === 'system' && msg.checkpointId ? ( // 这是一个可回溯的存档点消息
                <div className="checkpoint-message">
                  <button
                    className="checkpoint-restore-button"
                    onClick={() => {
                      setConfirmationMessage('是否回档，后续内容将会清空！');
                      setOnConfirmCallback(() => async () => {
                        const taskId = msg.sessionId || currentSessionIdRef.current || 'default-task';
                        console.log(`Restoring checkpoint ${msg.checkpointId} for task ${taskId}...`);
                        const result = await restoreChatCheckpoint(taskId, msg.checkpointId);
                        if (result.success) {
                          // **关键修复**: 调用新的 restoreMessages action 来重构历史状态
                          if (result.messages) {
                            dispatch(restoreMessages(result.messages));
                          }
                          setNotification({ show: true, message: '回档成功！聊天记录已恢复。' });
                        } else {
                          setNotification({ show: true, message: `恢复失败: ${result.error || '未知错误'}` });
                        }
                        setShowConfirmationModal(false);
                      });
                      setOnCancelCallback(() => () => setShowConfirmationModal(false));
                      setShowConfirmationModal(true);
                    }}
                  >
                    <FontAwesomeIcon icon={faClock} />
                  </button>
                  <span className="checkpoint-id-display">ID: {msg.checkpointId.substring(0, 7)}</span>
                </div>
              ) : msg.role === 'system' ? ( // 普通系统消息
                <>
                  <div className="message-header">系统: {msg.name ? `${msg.name}` : ''}</div>
                  <div className="message-content">
                      {msg.text || msg.content}
                  </div>
                </>
              ) : msg.role === 'assistant' ? ( // AI 消息
                <>
                  <div className="message-header">AI:</div>
                  {msg.reasoning_content && (
                    <details className="reasoning-details">
                      <summary className="reasoning-summary">思考过程 (点击展开)</summary>
                      <pre className="reasoning-content">{msg.reasoning_content}</pre>
                    </details>
                  )}

                  {/* 工具调用现在置顶在消息内容之上 */}
                  {msg.toolCalls && msg.toolCalls.length > 0 && (
                    <details className="tool-call-details">
                      <summary className="tool-call-summary">
                        {msg.isLoading ? <FontAwesomeIcon icon={faSpinner} spin className="ai-typing-spinner" /> : null}
                        请求调用工具
                      </summary>
                      <div className="tool-calls-container">
                        {msg.toolCalls.map((toolCall, i) => (
                          <ToolCallCard key={toolCall.id || i} toolCall={toolCall} />
                        ))}
                      </div>
                    </details>
                  )}

                  <div className="message-content">
                      {/* 如果没有工具调用，则在文本流式传输时显示加载图标 */}
                      {msg.isLoading && (!msg.toolCalls || msg.toolCalls.length === 0) && <FontAwesomeIcon icon={faSpinner} spin className="ai-typing-spinner" />}
                      {/* 只显示纯文字内容，不显示工具调用的JSON信息 */}
                      <span>{msg.toolCalls && msg.toolCalls.length > 0 ?
                        (msg.content || msg.text || '').replace(/--- 工具调用请求 ---.*$/s, '').replace(/工具调用:.*$/s, '').trim() :
                        msg.content || msg.text}</span>
                  </div>

                  {/* 正文生成后的选项按钮 */}
                  {msg.role === 'assistant' && currentMode === 'writing' && !msg.isLoading && !msg.toolCalls && (
                    <div className="writing-options">
                      {/* <button onClick={handleRegenerateWriting}>重新生成正文</button> */}
                      <button onClick={handleEnterAdjustmentMode}>进入调整模式</button>
                    </div>
                  )}
                  
                  <div className="message-actions">
                    <button title="复制" onClick={() => {
                      navigator.clipboard.writeText(msg.content);
                      setNotification({ show: true, message: '复制成功' });
                    }}><FontAwesomeIcon icon={faCopy} /></button>
                    {/* <button title="重新生成" onClick={() => invoke('regenerate-response', { messageId: msg.id })}><FontAwesomeIcon icon={faRedo} /></button> */}
                    <button title="删除" onClick={() => {
                      setConfirmationMessage('确定删除吗，这将会导致后续所有内容丢失！');
                      setOnConfirmCallback(() => () => {
                        dispatch(deleteMessage({ messageId: msg.id }));
                        setShowConfirmationModal(false);
                      });
                      setOnCancelCallback(() => () => setShowConfirmationModal(false));
                      setShowConfirmationModal(true);
                    }}><FontAwesomeIcon icon={faTrashCan} /></button>
                  </div>
                </>
              ) : msg.role === 'system' ? ( // 系统消息 (包括错误、警告等)
               <>
                 <div className="message-header">系统:</div>
                 <div className="message-content">
                   {msg.content || msg.text || '[消息内容缺失]'}
                 </div>
               </>
              ) : ( // 用户消息 (msg.role === 'user')
                <>
                  <div className="message-header">用户:</div>
                  <div className="message-content">
                    {/* {editingMessageId === msg.id ? (
                      <div>
                        <textarea
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              dispatch(submitEdit({ messageId: msg.id, newContent: editingText }));
                              invoke('edit-message', { messageId: msg.id, newContent: editingText });
                            } else if (e.key === 'Escape') {
                              dispatch(startEditing({ messageId: null }));
                            }
                          }}
                          rows={3}
                        />
                        <button onClick={() => {
                          dispatch(submitEdit({ messageId: msg.id, newContent: editingText }));
                          invoke('edit-message', { messageId: msg.id, newContent: editingText });
                        }}>保存</button>
                        <button onClick={() => dispatch(startEditing({ messageId: null }))}>取消</button>
                      </div>
                    ) : ( */}
                      {msg.content || msg.text || '[消息内容缺失]'}
                    {/* )} */}
                  </div>
                  <div className="message-actions">
                    <button title="复制" onClick={() => {
                        navigator.clipboard.writeText(msg.content);
                        setNotification({ show: true, message: '复制成功' });
                    }}><FontAwesomeIcon icon={faCopy} /></button>
                    {/* <button title="编辑" onClick={() => {
                      dispatch(startEditing({ messageId: msg.id }));
                      setEditingText(msg.content);
                    }}><FontAwesomeIcon icon={faPencil} /></button> */}
                    <button title="删除" onClick={() => {
                      setConfirmationMessage('确定删除吗，这将会导致后续所有内容丢失！');
                      setOnConfirmCallback(() => () => {
                        dispatch(deleteMessage({ messageId: msg.id }));
                        setShowConfirmationModal(false);
                      });
                      setOnCancelCallback(() => () => setShowConfirmationModal(false));
                      setShowConfirmationModal(true);
                    }}><FontAwesomeIcon icon={faTrashCan} /></button>
                  </div>
                </>
              )}
              {/* The tool call content is now directly streamed into the message content, so this placeholder is no longer needed. */}
            </div>
          ))}
        </div>

        {isHistoryPanelVisible && (
          <ChatHistoryPanel
            history={deepSeekHistory}
            onSelectConversation={handleSelectConversation}
            onDeleteConversation={handleDeleteConversation}
          />
        )}

        {/* 模型选择面板 */}
        {showModelSelectorPanel && (
          <ModelSelectorPanel
            selectedModel={selectedModel}
            availableModels={availableModels}
            onModelChange={async (modelId) => {
              dispatch(setSelectedModel(modelId));
              // 保存到持久化存储
              try {
                await setStoreValue('selectedModel', modelId);
                console.log(`[模型选择面板] 已保存模型选择: ${modelId}`);
              } catch (error) {
                console.error('[模型选择面板] 保存模型选择失败:', error);
              }
              setShowModelSelectorPanel(false);
            }}
            onClose={() => setShowModelSelectorPanel(false)}
          />
        )}

        {/* New Tool Action Bar, displayed above the input group */}
        {toolCallState === 'pending_user_action' && (
            <div className="tool-action-bar">
                <span>AI 请求执行工具，请确认：</span>
                <div className="tool-action-buttons">
                    <button
                        className="approve-all-button"
                        onClick={() => handleToolApproval('approve')}
                        disabled={toolCallState !== 'pending_user_action'}
                    >
                        批准
                    </button>
                    <button
                        className="reject-all-button"
                        onClick={() => handleToolApproval('reject')}
                        disabled={toolCallState !== 'pending_user_action'}
                    >
                        取消
                    </button>
                </div>
            </div>
        )}

        {questionCard && (
          <div className="ai-question-card">
            <p className="ai-question-text">{questionCard.question}</p>
            <div className="ai-question-options">
              {questionCard.options && questionCard.options.length > 0 && (
                questionCard.options.map((option, index) => (
                  <button
                    key={index}
                    className="ai-question-option-button"
                    onClick={() => handleUserQuestionResponse(option, questionCard.toolCallId, true)}
                  >
                    {option}
                  </button>
                ))
              )}
            </div>
            {/* 输入区域已被移除，用户应使用主输入框进行回复 */}
          </div>
        )}


        <div className="chat-input-group">

          <ModeSelector
            currentMode={currentMode}
            customModes={customModes}
            onModeChange={handleModeSwitch}
            setStoreValue={setStoreValue}
          />
          <textarea
            id="chatInput"
            placeholder="输入指令..."
            rows="4"
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage(e.target.value);
                e.target.value = '';
              }
            }}
          ></textarea>
          {/* 动态切换发送按钮和停止按钮 */}
          {isStreaming ? (
            <button
              className="stop-button"
              onClick={async () => {
                try {
                  console.log('[ChatPanel] 用户点击停止按钮');
                  dispatch(stopStreaming());
                  await stopStreamingIpc();
                  console.log('[ChatPanel] 停止请求已发送到后端');
                } catch (error) {
                  console.error('[ChatPanel] 停止流式传输失败:', error);
                }
              }}
              title="停止生成"
            >
              <FontAwesomeIcon icon={faStop} />
            </button>
          ) : (
            <button id="sendMessage" className="send-icon" onClick={() => {
              const chatInput = document.getElementById('chatInput');
              handleSendMessage(chatInput.value);
              chatInput.value = '';
            }}><FontAwesomeIcon icon={faPaperPlane} /></button>
          )}
        </div>
      </div>


      {showConfirmationModal && (
        <ConfirmationModal
          message={confirmationMessage}
          onConfirm={onConfirmCallback}
          onCancel={onCancelCallback}
        />
      )}

      {notification.show && (
        <NotificationModal
          message={notification.message}
          onClose={() => setNotification({ show: false, message: '' })}
        />
      )}

      {/* 创作模式配置弹窗 */}
      {showCreationModal && (
        <CreationModeModal
          isOpen={showCreationModal}
          onClose={() => dispatch(setShowCreationModal(false))}
          onModeSwitch={handleModeSwitch}
          onOpenMemorySettings={() => setShowPromptManager(true)}
        />
      )}

      {/* 提示词管理模态框 */}
      {showPromptManager && (
        <PromptManagerModal
          isOpen={showPromptManager}
          onClose={() => setShowPromptManager(false)}
        />
      )}
    </React.Fragment>
  );
});

// 辅助函数：获取模式显示名称
const getModeDisplayName = (mode) => {
  const names = {
    general: '通用',
    outline: '细纲',
    writing: '写作',
    adjustment: '调整'
  };
  return names[mode] || mode;
};

export default ChatPanel;
