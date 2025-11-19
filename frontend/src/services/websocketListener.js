/**
 * WebSocket 监听器服务
 * 替代原来的 IPC 监听器，用于处理后端推送的实时事件
 */
import websocketClient from './websocketClient.js';

export const registerWebSocketListeners = (dispatch) => {
  // 处理 AI 响应事件
  const handleAiResponse = (payload) => {
    // 根据 payload 的 type 智能分发 action
    const { type, payload: innerPayload } = payload;
    
    switch (type) {
      case 'initial-checkpoint-created':
      case 'file-content-updated':
        // 这是一个文件更新事件，它会触发两个动作：
        // 1. 同步 novelSlice 中的文件内容
        if (type === 'file-content-updated') {
          console.log(`[WebSocketListener] Dispatching novel/syncFileContent for path: ${innerPayload.filePath}`);
          dispatch({ type: 'novel/syncFileContent', payload: innerPayload });
        }

        // 2. 如果存在 checkpointId，则向 chatSlice 追加一条系统消息
        if (innerPayload.checkpointId) {
          const messageText = type === 'initial-checkpoint-created'
            ? innerPayload.message
            : `文件 ${innerPayload.filePath} 已保存一个新版本。`;

          console.log(`[WebSocketListener] Dispatching chat/appendMessage for checkpoint: ${innerPayload.checkpointId}`);
          const systemMessage = {
            sender: 'System',
            role: 'system',
            name: 'Checkpoint Saved',
            text: messageText,
            content: messageText,
            checkpointId: innerPayload.checkpointId,
            className: 'system-info',
            // 确保消息有唯一的 id，以避免 react key 警告
            id: `checkpoint-${innerPayload.checkpointId}-${Date.now()}`
          };
          dispatch({ type: 'chat/appendMessage', payload: systemMessage });
        }
        break;

      case 'system-message':
        // 专门处理后端主动推送的系统消息（例如，首次存档）
        console.log(`[WebSocketListener] Dispatching chat/appendMessage for system message.`);
        dispatch({ type: 'chat/appendMessage', payload: innerPayload });
        break;

      default:
        // 所有其他事件都属于 chatSlice
        dispatch({ type: 'chat/ipcAiResponse', payload });
        break;
    }
  };

  // 处理文件写入事件
  const handleFileWritten = (payload) => {
    const { filePath, content } = payload;
    dispatch({ type: 'novel/fileWritten', payload: { filePath, content } });
  };

  // 处理文件删除事件
  const handleFileDeleted = (payload) => {
    const { filePath } = payload;
    dispatch({ type: 'novel/fileDeleted', payload: { filePath } });
  };

  // 处理文件重命名事件
  const handleFileRenamed = (payload) => {
    const { oldFilePath, newFilePath } = payload;
    dispatch({ type: 'novel/fileRenamed', payload: { oldFilePath, newFilePath } });
  };

  // 处理当前文件更新事件
  const handleUpdateCurrentFile = (payload) => {
    dispatch({ type: 'novel/updateCurrentFile', payload });
  };

  // 处理工具调用事件
  const handleToolCallEvents = (payload) => {
    const { type, payload: innerPayload } = payload;
    
    switch (type) {
      case 'tool_calls_detected':
        console.log('[WebSocketListener] 检测到工具调用:', innerPayload);
        dispatch({ type: 'chat/ipcAiResponse', payload: {
          type: 'tool_suggestions',
          payload: innerPayload.tool_calls || []
        }});
        break;
        
      case 'tool_call_request':
        console.log('[WebSocketListener] 收到工具调用请求:', innerPayload);
        dispatch({ type: 'chat/ipcAiResponse', payload: {
          type: 'tool_suggestions',
          payload: [innerPayload]
        }});
        break;
        
      case 'tool_call_approved':
        console.log('[WebSocketListener] 工具调用已批准:', innerPayload);
        // 可以在这里添加批准后的处理逻辑
        break;
        
      case 'tool_call_rejected':
        console.log('[WebSocketListener] 工具调用已拒绝:', innerPayload);
        // 可以在这里添加拒绝后的处理逻辑
        break;
        
      case 'tool_call_completed':
        console.log('[WebSocketListener] 工具调用已完成:', innerPayload);
        // 可以在这里添加完成后的处理逻辑
        break;
        
      case 'tool_call_failed':
        console.log('[WebSocketListener] 工具调用失败:', innerPayload);
        // 可以在这里添加失败后的处理逻辑
        break;
        
      default:
        console.log('[WebSocketListener] 未知的工具调用事件类型:', type);
    }
  };

  // 注册 WebSocket 监听器
  const cleanupFunctions = [
    websocketClient.on('ai-response', handleAiResponse),
    websocketClient.on('file-written', handleFileWritten),
    websocketClient.on('file-deleted', handleFileDeleted),
    websocketClient.on('file-renamed', handleFileRenamed),
    websocketClient.on('update-current-file', handleUpdateCurrentFile),
    websocketClient.on('tool-call-events', handleToolCallEvents),
  ];

  console.log("[WebSocketListener] 所有 WebSocket 监听器已注册.");

  // 启动 WebSocket 连接
  websocketClient.connect();

  // 返回清理函数
  return () => {
    // 移除所有监听器
    cleanupFunctions.forEach(cleanup => cleanup());
    // 断开 WebSocket 连接
    websocketClient.disconnect();
    console.log("[WebSocketListener] 所有 WebSocket 监听器已移除.");
  };
};
