import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBoxArchive } from '@fortawesome/free-solid-svg-icons';
import { approveToolCalls, rejectToolCalls, appendMessage } from '../../../store/slices/chatSlice';
import { rejectSuggestion } from '../../../store/slices/novelSlice';

// 工具调用卡片组件
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

/**
 * 工具调用处理服务
 * 负责处理工具调用的批准和拒绝
 */
class ToolCallService {
  constructor(ipcRenderer, dispatch) {
    this.ipcRenderer = ipcRenderer;
    this.dispatch = dispatch;
  }

  /**
   * 处理工具调用批准/拒绝
   */
  async handleToolApproval(action, pendingToolCalls, toolCallState, activeTabId) {
    if (toolCallState !== 'pending_user_action' || !pendingToolCalls || pendingToolCalls.length === 0) {
      return;
    }

    const isFileModification = pendingToolCalls.some(call => 
      call.tool_name === 'write_to_file' || call.tool_name === 'apply_diff'
    );

    // Dispatch action to update state immediately
    if (action === 'approve') {
      // 移除对 acceptSuggestion 的前端调用。UI 更新将由后端的 'file-content-updated' 事件驱动。
      this.dispatch(approveToolCalls());
    } else {
      this.dispatch(rejectToolCalls());
      if (isFileModification && activeTabId) {
        this.dispatch(rejectSuggestion(activeTabId));
      }
    }

    // Send IPC message to the backend
    try {
      // The backend now expects 'approve' or 'reject' for the entire batch
      await this.ipcRenderer.invoke('process-tool-action', {
        actionType: action,
        toolCalls: pendingToolCalls,
      });
    } catch (error) {
      console.error('ToolCallService: 处理工具操作失败:', error);
      // Optionally dispatch an error message to the UI
      this.dispatch(appendMessage({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        sender: 'Tool',
        text: `工具操作失败: ${error.message}`,
        role: 'tool',
        content: `工具操作失败: ${error.message}`,
        className: 'tool-message'
      }));
      throw error;
    }
  }

  /**
   * 检查是否为文件修改操作
   */
  isFileModification(pendingToolCalls) {
    return pendingToolCalls.some(call => 
      call.tool_name === 'write_to_file' || call.tool_name === 'apply_diff'
    );
  }

  /**
   * 验证工具调用状态
   */
  validateToolCallState(toolCallState, pendingToolCalls) {
    return toolCallState === 'pending_user_action' && 
           pendingToolCalls && 
           pendingToolCalls.length > 0;
  }
}

// 导出合并后的模块
export { ToolCallCard, ToolCallService };
export default { ToolCallCard, ToolCallService };