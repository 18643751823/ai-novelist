import React, { useEffect, useRef, useCallback, memo, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  setQuestionCard,
  setMessages,
  stopStreaming,
} from '../../store/slices/chatSlice';
import {
  setSessionHistory,
  clearInterruptCard
} from '../../store/slices/messageSlice';
import {
  selectChatPanelState
} from '../../store/selectors';
import useHttpService from '../../hooks/useHttpService.js';
import ChatService from '../../services/chatService.js';
import SettingsManager from './services/SettingsManager';
import MessageServiceNew from './services/MessageServiceNew';
import EventListenerManager from './services/EventListenerManager';
import sessionService from '../../services/sessionService.js';
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
  // 使用记忆化的选择器获取状态
  const {
    messages,
    questionCard,
    interruptCard,
    isHistoryPanelVisible,
    aliyunEmbeddingApiKey,
    enableStream,
    modeFeatureSettings,
    isStreaming,
    aiParameters,
    toolCallState,
    pendingToolCalls,
    sessionHistory
  } = useSelector(selectChatPanelState);
  
  // 使用 ref 来获取最新的状态值，避免闭包问题
  const latestAliyunEmbeddingApiKey = useRef(aliyunEmbeddingApiKey);
  latestAliyunEmbeddingApiKey.current = aliyunEmbeddingApiKey;
  

  // 从 novel slice 获取状态
  const { openTabs } = useSelector((state) => state.novel);
 
  const chatDisplayRef = useRef(null);
  const messageDisplayRef = useRef(null);
  const currentSessionIdRef = useRef(null);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState('');
  const [onConfirmCallback, setOnConfirmCallback] = useState(null);
  const [onCancelCallback, setOnCancelCallback] = useState(null);
  const [notification, setNotification] = useState({ show: false, message: '' });
  const [currentMode, setCurrentMode] = useState('outline'); // 新增：当前创作模式
  const [customModes, setCustomModes] = useState([]); // 新增：自定义模式列表
  const [showModelSelectorPanel, setShowModelSelectorPanel] = useState(false);

  const { invoke, getStoreValue, setStoreValue, listAvailableModels, send, on, removeListener, stopStreaming: stopStreamingIpc } = useHttpService();
  
  // 创建设置管理器实例
  const settingsManagerRef = useRef(null);
  if (!settingsManagerRef.current) {
    settingsManagerRef.current = new SettingsManager(dispatch);
    // 设置当前模式变化的回调函数，给settingsManager使用
    settingsManagerRef.current.onCurrentModeChange = (mode) => {
      console.log(`[ChatPanel] SettingsManager 请求设置当前模式为: ${mode}`);
      setCurrentMode(mode);
    };
  }
  // 创建消息服务实例
  const messageServiceRef = useRef(null);
  if (!messageServiceRef.current) {
    messageServiceRef.current = new MessageServiceNew(dispatch);
  }


  // 创建事件监听管理器实例
  const eventListenerManagerRef = useRef(null);
  if (!eventListenerManagerRef.current) {
    eventListenerManagerRef.current = new EventListenerManager(dispatch);
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

  // 新增：处理中断响应
  const handleInterruptResponse = useCallback(async (interruptData) => {
    try {
      console.log('ChatPanel: 处理中断响应:', interruptData);
      
      // 立即清除中断卡片，让用户知道响应已发送
      dispatch(clearInterruptCard());
      
      // 使用后端连接器发送中断响应
      const stream = await ChatService.sendInterruptResponse(interruptData);
      
      console.log('中断响应发送成功，开始处理流式响应');
      
      // 流式传输开始
      dispatch({
        type: 'message/handleStreamingMessage',
        payload: {
          type: 'streaming_started'
        }
      });
      
      // 处理中断响应的流式响应
      // 如果后端返回新的中断，MessageServiceNew.handleStreamResponse 会自动再次设置中断卡片
      await messageServiceRef.current.handleStreamResponse(stream, interruptData.threadId);
      
    } catch (error) {
      console.error('ChatPanel: 处理中断响应失败:', error);
    }
  }, [dispatch]);

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
        messageDisplayRef // 新增：传递消息显示组件的引用
      });
    } catch (error) {
      console.error('ChatPanel: 发送消息失败:', error);
    }
  }, [questionCard, enableStream, currentMode, modeFeatureSettings, aiParameters, messages]);



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

  // 从后端加载会话历史
  const loadSessionHistory = useCallback(async () => {
    try {
      const sessionsResult = await sessionService.listSessions();
      if (sessionsResult.success) {
        dispatch(setSessionHistory(sessionsResult.sessions));
      } else {
        console.error('加载会话历史失败:', sessionsResult.error);
      }
    } catch (error) {
      console.error('加载会话历史失败:', error);
    }
  }, [dispatch]);

  const handleResetChat = useCallback(async () => { // 将 handleResetChat 封装为 useCallback
    try {
      // 调用后端清除消息API，后端会重新分配会话ID
      const clearResult = await sessionService.clearMessages();
      if (clearResult.success) {
        console.log('[ChatPanel] 消息已清除，新会话ID:', clearResult.new_session_id);
        
        // 清除前端消息
        dispatch(setMessages([])); // 清除聊天消息
        dispatch(setQuestionCard(null)); // 清除提问卡片
        dispatch(clearInterruptCard()); // 清除中断卡片
        currentSessionIdRef.current = clearResult.new_session_id; // 更新当前会话ID
        
        // 显示成功消息
        setNotification({
          show: true,
          message: '消息已清除，已开始新的会话'
        });
      } else {
        console.error('[ChatPanel] 清除消息失败:', clearResult.error);
        setNotification({
          show: true,
          message: '清除消息失败: ' + clearResult.error
        });
      }
    } catch (error) {
      console.error('[ChatPanel] 调用清除消息API失败:', error);
      setNotification({
        show: true,
        message: '清除消息失败: ' + error.message
      });
    }
  }, [dispatch]);



  // 设置事件监听器
  useEffect(() => {
    eventListenerManagerRef.current.setupAllListeners(openTabs);

    return () => {
      eventListenerManagerRef.current.cleanupAllListeners();
    };
  }, [openTabs]);

  // WebSocket 连接现在在 App 级别管理，这里不再需要

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
        const storedCustomModes = await getStoreValue('customModes');
        // 现在getStoreValue直接返回值，而不是嵌套结构
        const customModesArray = Array.isArray(storedCustomModes) ? storedCustomModes : [];
        setCustomModes(prevCustomModes => {
          // 只有当customModes实际发生变化时才更新状态
          if (JSON.stringify(prevCustomModes) !== JSON.stringify(customModesArray)) {
            console.log('[ChatPanel] 检测到customModes存储变化，更新状态:', customModesArray);
            return customModesArray;
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






  // 当历史面板显示时，从后端加载会话历史
  useEffect(() => {
    if (isHistoryPanelVisible) {
      loadSessionHistory();
    }
  }, [isHistoryPanelVisible, loadSessionHistory]);

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
          ref={messageDisplayRef}
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
            history={sessionHistory}
          />
        )}

        {/* 模型选择面板 */}
        {showModelSelectorPanel && (
          <ModelSelectorPanel
            onModelChange={() => {
              // 新的模型选择服务会自动保存到后端
              setShowModelSelectorPanel(false);
            }}
            onClose={() => setShowModelSelectorPanel(false)}
          />
        )}

        {/* 工具调用操作栏 */}
        <ToolActionBar
          interruptInfo={interruptCard}
          onInterruptResponse={handleInterruptResponse}
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
