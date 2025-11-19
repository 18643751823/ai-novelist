import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { stopStreaming } from '../../../store/slices/chatSlice';
import { selectIsStreaming } from '../../../store/selectors';
import ModeSelector from './ModeSelector';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperPlane, faStop } from '@fortawesome/free-solid-svg-icons';

const ChatInputArea = ({ 
  currentMode,
  customModes,
  handleModeSwitch,
  handleSendMessage,
  stopStreamingIpc,
  setStoreValue
}) => {
  const dispatch = useDispatch();
  
  const isStreaming = useSelector(selectIsStreaming);

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e.target.value);
      e.target.value = '';
    }
  };

  const handleSendClick = () => {
    const chatInput = document.getElementById('chatInput');
    handleSendMessage(chatInput.value);
    chatInput.value = '';
  };

  const handleStopClick = async () => {
    try {
      console.log('[ChatInputArea] 用户点击停止按钮');
      dispatch(stopStreaming());
      // 我们只需要dispatch停止流式状态，不需要调用IPC
      console.log('[ChatInputArea] 停止流式传输已处理');
    } catch (error) {
      console.error('[ChatInputArea] 停止流式传输失败:', error);
    }
  };

  return (
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
        onKeyPress={handleKeyPress}
      ></textarea>
      
      {/* 动态切换发送按钮和停止按钮 */}
      {isStreaming ? (
        <button
          className="stop-button"
          onClick={handleStopClick}
          title="停止生成"
        >
          <FontAwesomeIcon icon={faStop} />
        </button>
      ) : (
        <button 
          id="sendMessage" 
          className="send-icon" 
          onClick={handleSendClick}
          title="发送消息"
        >
          <FontAwesomeIcon icon={faPaperPlane} />
        </button>
      )}
    </div>
  );
};

export default ChatInputArea;
