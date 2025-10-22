import React from 'react';
import { useDispatch } from 'react-redux';
import { deleteMessage, restoreMessages } from '../../../store/slices/chatSlice';
import { restoreChatCheckpoint } from '../../../ipc/checkpointIpcHandler';
import { ToolCallCard } from '../services/ToolCallManager';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCopy, faTrashCan, faSpinner, faClock } from '@fortawesome/free-solid-svg-icons';

// 消息显示组件
const MessageDisplay = ({
  messages,
  currentMode,
  currentSessionId,
  onSetConfirmation,
  onSetNotification,
  onEnterAdjustmentMode
}) => {
  const dispatch = useDispatch();

  const handleCopyMessage = (content) => {
    navigator.clipboard.writeText(content);
    onSetNotification({ show: true, message: '复制成功' });
  };

  const handleDeleteMessage = (messageId) => {
    onSetConfirmation({
      message: '确定删除吗，这将会导致后续所有内容丢失！',
      onConfirm: () => {
        dispatch(deleteMessage({ messageId }));
        onSetConfirmation({ show: false });
      },
      onCancel: () => onSetConfirmation({ show: false })
    });
  };

  // 渲染AI消息
  const renderAIMessage = (msg) => (
    <>
      <div className="message-header">AI:</div>
      {msg.reasoning_content && (
        <details className="reasoning-details">
          <summary className="reasoning-summary">思考过程 (点击展开)</summary>
          <pre className="reasoning-content">{msg.reasoning_content}</pre>
        </details>
      )}

      {/* 工具调用显示 */}
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
        {msg.isLoading && (!msg.toolCalls || msg.toolCalls.length === 0) && (
          <FontAwesomeIcon icon={faSpinner} spin className="ai-typing-spinner" />
        )}
        {/* 只显示纯文字内容，不显示工具调用的JSON信息 */}
        <span>
          {msg.toolCalls && msg.toolCalls.length > 0 ?
            (msg.content || msg.text || '').replace(/--- 工具调用请求 ---.*$/s, '').replace(/工具调用:.*$/s, '').trim() :
            msg.content || msg.text}
        </span>
      </div>

      {/* 正文生成后的选项按钮 */}
      {msg.role === 'assistant' && currentMode === 'writing' && !msg.isLoading && !msg.toolCalls && (
        <div className="writing-options">
          <button onClick={onEnterAdjustmentMode}>进入调整模式</button>
        </div>
      )}
      
      <div className="message-actions">
        <button title="复制" onClick={() => handleCopyMessage(msg.content)}>
          <FontAwesomeIcon icon={faCopy} />
        </button>
        <button title="删除" onClick={() => handleDeleteMessage(msg.id)}>
          <FontAwesomeIcon icon={faTrashCan} />
        </button>
      </div>
    </>
  );

  // 渲染系统消息
  const renderSystemMessage = (msg) => (
    <>
      <div className="message-header">系统: {msg.name ? `${msg.name}` : ''}</div>
      <div className="message-content">
        {msg.text || msg.content}
      </div>
    </>
  );

  // 渲染用户消息
  const renderUserMessage = (msg) => (
    <>
      <div className="message-header">用户:</div>
      <div className="message-content">
        {msg.content || msg.text || '[消息内容缺失]'}
      </div>
      <div className="message-actions">
        <button title="复制" onClick={() => handleCopyMessage(msg.content)}>
          <FontAwesomeIcon icon={faCopy} />
        </button>
        <button title="删除" onClick={() => handleDeleteMessage(msg.id)}>
          <FontAwesomeIcon icon={faTrashCan} />
        </button>
      </div>
    </>
  );

  return (
    <div id="chatDisplay">
      {messages.map((msg, index) => (
        <div key={msg.id || index} className={`message ${msg.role === 'user' ? 'user' : msg.role === 'assistant' ? 'ai' : msg.role} ${msg.className || ''}`}>
          {msg.role === 'system' && msg.checkpointId ? (
            <div className="checkpoint-message">
              <button
                className="checkpoint-restore-button"
                onClick={() => {
                  onSetConfirmation({
                    message: '是否回档，后续内容将会清空！',
                    onConfirm: async () => {
                      const taskId = msg.sessionId || currentSessionId || 'default-task';
                      console.log(`Restoring checkpoint ${msg.checkpointId} for task ${taskId}...`);
                      const result = await restoreChatCheckpoint(taskId, msg.checkpointId);
                      if (result.success) {
                        // **关键修复**: 调用新的 restoreMessages action 来重构历史状态
                        if (result.messages) {
                          dispatch(restoreMessages(result.messages));
                        }
                        onSetNotification({ show: true, message: '回档成功！聊天记录已恢复。' });
                      } else {
                        onSetNotification({ show: true, message: `恢复失败: ${result.error || '未知错误'}` });
                      }
                      // 回档操作完成后关闭确认模态框
                      onSetConfirmation({ show: false });
                    },
                    onCancel: () => {
                      // 取消操作时关闭确认模态框
                      onSetConfirmation({ show: false });
                    }
                  });
                }}
              >
                <FontAwesomeIcon icon={faClock} />
              </button>
              <span className="checkpoint-id-display">ID: {msg.checkpointId.substring(0, 7)}</span>
            </div>
          ) : msg.role === 'system' ? (
            renderSystemMessage(msg)
          ) : msg.role === 'assistant' ? (
            renderAIMessage(msg)
          ) : (
            renderUserMessage(msg)
          )}
        </div>
      ))}
    </div>
  );
};

export default MessageDisplay;