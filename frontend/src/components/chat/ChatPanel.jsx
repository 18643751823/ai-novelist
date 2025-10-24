import React, { useEffect, useRef, useCallback, memo, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  setQuestionCard,
  setMessages,
  setDeepSeekHistory,
  stopStreaming,
  setSelectedModel,
} from '../../store/slices/chatSlice';
import useIpcRenderer from '../../hooks/useIpcRenderer';
import SettingsManager from './services/SettingsManager';
import MessageService from './services/MessageService';
import EventListenerManager from './services/EventListenerManager';
import NotificationModal from '../others/NotificationModal';
import ConfirmationModal from '../others/ConfirmationModal';
import StreamingSupport from './messagedisplay/StreamingSupport';
import ChatHeader from './header/ChatHeader';
import MessageDisplay from './messagedisplay/MessageDisplay';
import ChatHistoryPanel from './header/ChatHistoryPanel';
import ModelSelectorPanel from './header/ModelSelectorPanel';
import ToolActionBar from './input/ToolActionBar';
import QuestionCard from './input/QuestionCard';
import ChatInputArea from './input/ChatInputArea';
import './ChatPanel.css';


const ChatPanel = memo(() => {
  const dispatch = useDispatch();
  // 从 chat slice 获取状态
  const {
    messages,
    questionCard,
    isHistoryPanelVisible,
    aliyunEmbeddingApiKey, // 新增：阿里云嵌入API Key
    selectedModel,
    enableStream,
    modeFeatureSettings, // 新增：模式特定的功能设置
    isStreaming, // 新增：流式传输状态
    aiParameters, // 新增：AI参数
    deepSeekHistory,
    toolCallState,
    pendingToolCalls,
    availableModels
  } = useSelector((state) => state.chat);
  
  // 使用 ref 来获取最新的状态值，避免闭包问题
  const latestAliyunEmbeddingApiKey = useRef(aliyunEmbeddingApiKey);
  latestAliyunEmbeddingApiKey.current = aliyunEmbeddingApiKey;
  

  // 从 novel slice 获取状态
  const { openTabs } = useSelector((state) => state.novel);
 
  const chatDisplayRef = useRef(null);
  const currentSessionIdRef = useRef(null);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState('');
  const [onConfirmCallback, setOnConfirmCallback] = useState(null);
  const [onCancelCallback, setOnCancelCallback] = useState(null);
  const [notification, setNotification] = useState({ show: false, message: '' });
  const [currentMode, setCurrentMode] = useState('general'); // 新增：当前创作模式
  const [customModes, setCustomModes] = useState([]); // 新增：自定义模式列表
  const [showModelSelectorPanel, setShowModelSelectorPanel] = useState(false);

  const { invoke, getDeepSeekChatHistory, clearDeepSeekConversation, getStoreValue, setStoreValue, listAllModels, send, on, removeListener, stopStreaming: stopStreamingIpc } = useIpcRenderer();
  
  // 创建设置管理器实例
  const settingsManagerRef = useRef(null);
  if (!settingsManagerRef.current) {
    settingsManagerRef.current = new SettingsManager(
      { getStoreValue, listAllModels, invoke, send },
      dispatch
    );
  }
  // 创建消息服务实例
  const messageServiceRef = useRef(null);
  if (!messageServiceRef.current) {
    messageServiceRef.current = new MessageService(
      { invoke },
      dispatch
    );
  }


  // 创建事件监听管理器实例
  const eventListenerManagerRef = useRef(null);
  if (!eventListenerManagerRef.current) {
    eventListenerManagerRef.current = new EventListenerManager(
      { on, removeListener },
      dispatch
    );
  }



  // 将 loadSettings 定义为 useCallback，确保其稳定性
  // 使用设置管理器加载设置
  const loadSettings = useCallback(async () => {
    try {
      console.log('ChatPanel: 开始使用SettingsManager加载设置...');
      await settingsManagerRef.current.loadSettings();
      console.log('ChatPanel: SettingsManager加载设置完成');
    } catch (error) {
      console.error('ChatPanel: 使用SettingsManager加载设置失败:', error);
    }
  }, []);
  const handleUserQuestionResponse = useCallback(async (response, toolCallId, isButtonClick) => {
    try {
      await messageServiceRef.current.handleUserQuestionResponse(
        response,
        toolCallId,
        isButtonClick,
        enableStream
      );
    } catch (error) {
      console.error('ChatPanel: 处理用户问题响应失败:', error);
    }
  }, [enableStream]);

  const handleSendMessage = useCallback(async (messageText) => {
    try {
      await messageServiceRef.current.handleSendMessage(messageText, {
        questionCard,
        currentSessionIdRef,
        enableStream,
        currentMode,
        modeFeatureSettings,
        aiParameters,
        messages,
        getStoreValue,
        selectedModel
      });
    } catch (error) {
      console.error('ChatPanel: 发送消息失败:', error);
    }
  }, [questionCard, enableStream, currentMode, modeFeatureSettings, aiParameters, messages, selectedModel]);



  // 新增：处理模式切换回调
  const handleModeSwitch = useCallback((mode) => {
    setCurrentMode(mode);
    setStoreValue('currentMode', mode);
  }, [setStoreValue]);


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


  // 设置事件监听器
  useEffect(() => {
    eventListenerManagerRef.current.setupAllListeners(openTabs);

    return () => {
      eventListenerManagerRef.current.cleanupAllListeners();
    };
  }, [openTabs]);

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



  useEffect(() => {
    if (isHistoryPanelVisible) {
      loadDeepSeekChatHistory();
    }
  }, [isHistoryPanelVisible, loadDeepSeekChatHistory]);



  // 自动滚动聊天区到底部 (此 useEffect 保留)
  useEffect(() => {
    if (chatDisplayRef.current) {
      chatDisplayRef.current.scrollTop = chatDisplayRef.current.scrollHeight;
    }
  }, [messages, questionCard, isHistoryPanelVisible]);

  return (
    <React.Fragment>
      {/* 流式传输支持组件 */}
      <StreamingSupport
        isStreaming={isStreaming}
        onStopStreaming={() => dispatch(stopStreaming())}
      />
      
      <div className="chat-panel-content">
        {/* 头部操作栏 */}
        <ChatHeader
          showModelSelectorPanel={showModelSelectorPanel}
          setShowModelSelectorPanel={setShowModelSelectorPanel}
          setStoreValue={setStoreValue}
        />

        <button className="reset-chat-button" onClick={handleResetChat}>×</button>
        
        {/* 消息展示框 */}
        <MessageDisplay
          messages={messages}
          currentMode={currentMode}
          currentSessionId={currentSessionIdRef.current}
          onSetConfirmation={({ message, onConfirm, onCancel, show }) => {
            if (show === false) {
              setShowConfirmationModal(false);
            } else {
              setConfirmationMessage(message);
              setOnConfirmCallback(() => onConfirm);
              setOnCancelCallback(() => onCancel);
              setShowConfirmationModal(true);
            }
          }}
          onSetNotification={setNotification}
          onEnterAdjustmentMode={handleEnterAdjustmentMode}
        />

        {/* 历史对话面板 */}
        {isHistoryPanelVisible && (
          <ChatHistoryPanel
            history={deepSeekHistory}
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

        {/* 工具调用操作栏 */}
        <ToolActionBar
          toolCallState={toolCallState}
          pendingToolCalls={pendingToolCalls}
        />

        {/* 提问卡片 */}
        <QuestionCard
          questionCard={questionCard}
          onUserQuestionResponse={handleUserQuestionResponse}
        />

        {/* 信息输入栏 */}
        <ChatInputArea
          currentMode={currentMode}
          customModes={customModes}
          handleModeSwitch={handleModeSwitch}
          handleSendMessage={handleSendMessage}
          stopStreamingIpc={stopStreamingIpc}
          setStoreValue={setStoreValue}
        />
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


    </React.Fragment>
  );
});

export default ChatPanel;