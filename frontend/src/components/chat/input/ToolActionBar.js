import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { ToolCallService } from '../services/ToolCallManager';
import useIpcRenderer from '../../../hooks/useIpcRenderer';

// 工具调用操作栏组件
const ToolActionBar = ({
  toolCallState,
  pendingToolCalls
}) => {
  const dispatch = useDispatch();
  const { activeTabId } = useSelector((state) => state.novel);
  const { invoke } = useIpcRenderer();
  
  // 创建工具调用服务实例
  const toolCallServiceRef = React.useRef(null);
  if (!toolCallServiceRef.current) {
    toolCallServiceRef.current = new ToolCallService(
      { invoke },
      dispatch
    );
  }

  if (toolCallState !== 'pending_user_action' || !pendingToolCalls || pendingToolCalls.length === 0) {
    return null;
  }

  const handleToolApproval = async (action) => {
    try {
      await toolCallServiceRef.current.handleToolApproval(
        action,
        pendingToolCalls,
        toolCallState,
        activeTabId
      );
    } catch (error) {
      console.error('ToolActionBar: 处理工具调用失败:', error);
    }
  };

  const handleApprove = () => {
    handleToolApproval('approve');
  };

  const handleReject = () => {
    handleToolApproval('reject');
  };

  return (
    <div className="tool-action-bar">
      <span>AI 请求执行工具，请确认：</span>
      <div className="tool-action-buttons">
        <button
          className="approve-all-button"
          onClick={handleApprove}
          disabled={toolCallState !== 'pending_user_action'}
        >
          批准
        </button>
        <button
          className="reject-all-button"
          onClick={handleReject}
          disabled={toolCallState !== 'pending_user_action'}
        >
          取消
        </button>
      </div>
    </div>
  );
};

export default ToolActionBar;