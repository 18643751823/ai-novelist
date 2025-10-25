import React, { useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { deleteMessage, restoreMessages } from '../../../store/slices/chatSlice';
import { toggleToolMessageCollapse } from '../../../store/slices/messageSlice';
import { restoreChatCheckpoint } from '../../../ipc/checkpointIpcHandler';
import { ToolCallCard } from '../services/ToolCallManager';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCopy, faTrashCan, faSpinner, faClock, faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons';
import MarkdownMessageRenderer from './MarkdownMessageRenderer';

// 消息显示组件
const MessageDisplay = React.forwardRef(({
  messages,
  currentMode,
  currentSessionId,
  onSetConfirmation,
  onSetNotification,
  onEnterAdjustmentMode
}, ref) => {
  const dispatch = useDispatch();
  const editorRefs = useRef({});
  
  // 获取tool消息折叠状态
  const collapsedToolMessages = useSelector((state) => state.chat.message.collapsedToolMessages);

  // 新增：获取所有消息的最新内容
  const getAllMessagesLatestContent = () => {
    const updatedMessages = messages.map(msg => {
      const editor = editorRefs.current[msg.id];
      let latestContent = msg.content || msg.text || '';
      
      // 如果消息有对应的编辑器实例，获取编辑器中的最新内容
      if (editor && typeof editor.getValue === 'function') {
        try {
          const editorContent = editor.getValue();
          if (editorContent !== undefined && editorContent !== null) {
            latestContent = editorContent;
          }
        } catch (error) {
          console.warn(`获取消息 ${msg.id} 编辑器内容失败:`, error);
        }
      }
      
      return {
        ...msg,
        content: latestContent,
        text: latestContent // 确保 text 和 content 同步
      };
    });
    
    return updatedMessages;
  };

  // 提供获取最新内容的方法给父组件
  React.useImperativeHandle(ref, () => ({
    getAllMessagesLatestContent
  }));

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

  const handleEditMessage = (messageId, content) => {
    setEditingMessageId(messageId);
    setEditedContent(content);
  };

  const handleSaveMessage = (messageId) => {
    if (editedContent.trim()) {
      dispatch(updateMessageContent({ messageId, content: editedContent }));
    }
    setEditingMessageId(null);
    setEditedContent('');
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditedContent('');
  };

  const handleContentChange = (content) => {
    setEditedContent(content);
  };

  // 渲染AI消息
  const renderAIMessage = (msg) => {
    const content = msg.content || msg.text || '';
    return (
      <>
        <div className="message-header">
          AI:
          {/* 流式传输时在消息头部显示加载指示器 */}
          {msg.isLoading && (
            <div className="streaming-indicator-header">
              <FontAwesomeIcon icon={faSpinner} spin className="ai-typing-spinner" />
              <span className="streaming-text">AI正在思考中...</span>
            </div>
          )}
        </div>
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
          {/* 使用Markdown渲染器显示消息内容 - 流式传输时也显示内容 */}
          <MarkdownMessageRenderer
            ref={(el) => {
              if (el) editorRefs.current[msg.id] = el;
            }}
            value={content}
            height="auto"
            isStreaming={msg.isLoading} // 传递流式传输状态
          />
        </div>

        {/* 正文生成后的选项按钮 */}
        {msg.role === 'assistant' && currentMode === 'writing' && !msg.isLoading && !msg.toolCalls && (
          <div className="writing-options">
            <button onClick={onEnterAdjustmentMode}>进入调整模式</button>
          </div>
        )}
        
        <div className="message-actions">
          <button title="复制" onClick={() => handleCopyMessage(msg.content || msg.text)}>
            <FontAwesomeIcon icon={faCopy} />
          </button>
          <button title="删除" onClick={() => handleDeleteMessage(msg.id)}>
            <FontAwesomeIcon icon={faTrashCan} />
          </button>
        </div>
      </>
    );
  };
  // 渲染系统消息
  const renderSystemMessage = (msg) => (
    <>
      <div className="message-header">系统: {msg.name ? `${msg.name}` : ''}</div>
      <div className="message-content">
        {msg.text || msg.content}
      </div>
    </>
  );

  // 渲染工具消息
  const renderToolMessage = (msg) => {
    const content = msg.content || msg.text || '[工具执行结果]';
    const isCollapsed = collapsedToolMessages[msg.id];
    
    return (
      <>
        <div className="message-header">
          <div className="tool-message-header-content">
            <span>工具执行结果: {msg.toolName ? `${msg.toolName}` : ''}</span>
            <button
              className="collapse-toggle-button"
              onClick={() => dispatch(toggleToolMessageCollapse({ messageId: msg.id }))}
              title={isCollapsed ? '展开' : '折叠'}
            >
              <FontAwesomeIcon icon={isCollapsed ? faChevronDown : faChevronUp} />
            </button>
          </div>
        </div>
        {!isCollapsed && (
          <div className="message-content">
            <MarkdownMessageRenderer
              ref={(el) => {
                if (el) editorRefs.current[msg.id] = el;
              }}
              value={content}
              height="auto"
            />
          </div>
        )}
        <div className="message-actions">
          <button title="复制" onClick={() => handleCopyMessage(msg.content || msg.text)}>
            <FontAwesomeIcon icon={faCopy} />
          </button>
          <button title="删除" onClick={() => handleDeleteMessage(msg.id)}>
            <FontAwesomeIcon icon={faTrashCan} />
          </button>
        </div>
      </>
    );
  };
  // 渲染用户消息
  const renderUserMessage = (msg) => {
    const content = msg.content || msg.text || '[消息内容缺失]';
    
    return (
      <>
        <div className="message-header">用户:</div>
        <div className="message-content">
          <MarkdownMessageRenderer
            ref={(el) => {
              if (el) editorRefs.current[msg.id] = el;
            }}
            value={content}
            height="auto"
          />
        </div>
        <div className="message-actions">
          <button title="复制" onClick={() => handleCopyMessage(msg.content || msg.text)}>
            <FontAwesomeIcon icon={faCopy} />
          </button>
          <button title="删除" onClick={() => handleDeleteMessage(msg.id)}>
            <FontAwesomeIcon icon={faTrashCan} />
          </button>
        </div>
      </>
    );
  };

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
          ) : msg.role === 'tool' ? (
            renderToolMessage(msg)
          ) : (
            renderUserMessage(msg)
          )}
        </div>
      ))}
    </div>
  );
});

export default MessageDisplay;