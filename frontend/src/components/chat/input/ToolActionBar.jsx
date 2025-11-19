import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import ToolCallService from '../../../services/ToolCallService';
import './ToolActionBar.css';

// 工具调用操作栏组件 - 适配新的中断机制
const ToolActionBar = ({
  interruptInfo,
  onInterruptResponse
}) => {
  const dispatch = useDispatch();
  const { activeTabId } = useSelector((state) => state.novel);
  const { autoApproveSettings } = useSelector((state) => state.chat.mode);
  const [userInput, setUserInput] = useState('');
  const [showAutoApproveCountdown, setShowAutoApproveCountdown] = useState(false);
  const [countdown, setCountdown] = useState(0);
  
  // 创建工具调用服务实例
  const toolCallServiceRef = React.useRef(null);
  if (!toolCallServiceRef.current) {
    toolCallServiceRef.current = new ToolCallService(dispatch);
  }

  // 自动批准逻辑
  useEffect(() => {
    if (interruptInfo && autoApproveSettings.enabled) {
      const delay = autoApproveSettings.delay || 1000;
      const seconds = Math.ceil(delay / 1000);
      
      setShowAutoApproveCountdown(true);
      setCountdown(seconds);
      
      const countdownInterval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      const autoApproveTimeout = setTimeout(() => {
        console.log('自动批准工具调用:', displayInfo);
        handleInterruptResponse('approve');
        setShowAutoApproveCountdown(false);
      }, delay);
      
      return () => {
        clearTimeout(autoApproveTimeout);
        clearInterval(countdownInterval);
      };
    }
  }, [interruptInfo, autoApproveSettings.enabled, autoApproveSettings.delay]);

  // 如果没有中断信息，不显示操作栏
  if (!interruptInfo) {
    return null;
  }

  // 处理中断响应
  const handleInterruptResponse = async (action) => {
    try {
      // 调用父组件的中断响应处理函数
      if (onInterruptResponse) {
        await onInterruptResponse({
          interruptId: interruptInfo.id,
          choice: action === 'approve' ? '1' : '2', // '1'=恢复, '2'=取消
          additionalData: userInput,
          threadId: interruptInfo.sessionId || 'default'
        });
      }
      
      // 清空用户输入
      setUserInput('');
    } catch (error) {
      console.error('ToolActionBar: 处理中断响应失败:', error);
    }
  };

  const handleApprove = () => {
    handleInterruptResponse('approve');
  };

  const handleReject = () => {
    handleInterruptResponse('reject');
  };

  // 格式化中断信息显示
  const formatInterruptDisplay = () => {
    const { reason, value, id } = interruptInfo;
    
    let displayText = '';
    let toolName = '工具调用';
    
    // 根据中断原因和值格式化显示
    switch (reason) {
      case 'tool_call':
        if (typeof value === 'object') {
          // 处理工具调用对象
          const toolCall = value;
          const displayInfo = toolCallServiceRef.current.formatToolCallDisplay(toolCall);
          toolName = displayInfo.toolName;
          displayText = displayInfo.displayText;
        } else {
          // 处理字符串值
          displayText = value || '工具调用请求';
        }
        break;
        
      case 'user_confirmation':
        displayText = value || '需要用户确认';
        toolName = '用户确认';
        break;
        
      case 'ask_user':
        displayText = value || '需要用户输入';
        toolName = '用户提问';
        break;
        
      default:
        displayText = value || '中断请求';
        toolName = reason || '未知中断';
    }
    
    return {
      toolName,
      displayText,
      interruptId: id
    };
  };

  const displayInfo = formatInterruptDisplay();

  return (
    <div className="tool-action-bar">
      <div className="tool-call-header">
        <h4>AI 请求执行以下操作，请确认：</h4>
        {showAutoApproveCountdown && (
          <div className="auto-approve-countdown">
            <span className="countdown-text">
              自动批准倒计时: {countdown}秒
            </span>
          </div>
        )}
      </div>
      
      <div className="tool-call-info">
        <div className="tool-name">{displayInfo.toolName}</div>
        <div className="tool-description">{displayInfo.displayText}</div>
        {autoApproveSettings.enabled && (
          <div className="auto-approve-notice">
            <span className="notice-text">
              ⚡ 自动批准已启用 ({autoApproveSettings.delay / 1000}秒延迟)
            </span>
          </div>
        )}
      </div>
      
      {/* 用户输入区域 */}
      <div className="user-input-section">
        <label htmlFor="tool-action-input">附加信息（可选）:</label>
        <textarea
          id="tool-action-input"
          className="tool-action-input"
          placeholder="请输入额外的说明或信息..."
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          rows={3}
        />
      </div>
      
      <div className="tool-action-buttons">
        <button
          className="approve-button"
          onClick={handleApprove}
        >
          批准执行
        </button>
        <button
          className="reject-button"
          onClick={handleReject}
        >
          取消执行
        </button>
      </div>
    </div>
  );
};

export default ToolActionBar;
