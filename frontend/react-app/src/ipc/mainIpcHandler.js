// frontend/react-app/src/ipc/mainIpcHandler.js
import { setDeepSeekHistory } from '../store/slices/chatSlice';

export const registerMainIpcListeners = (dispatch) => {
  const handleAiResponse = (event, payload) => {
    // 根据 payload 的 type 智能分发 action
    const { type, payload: innerPayload } = payload;
    
    switch (type) {
      case 'initial-checkpoint-created':
      case 'file-content-updated':
        // 这是一个文件更新事件，它会触发两个动作：
        // 1. 同步 novelSlice 中的文件内容
        if (type === 'file-content-updated') {
          console.log(`[MainIpcHandler] Dispatching novel/syncFileContent for path: ${innerPayload.filePath}`);
          dispatch({ type: 'novel/syncFileContent', payload: innerPayload });
        }

        // 2. 如果存在 checkpointId，则向 chatSlice 追加一条系统消息
        if (innerPayload.checkpointId) {
          const messageText = type === 'initial-checkpoint-created'
            ? innerPayload.message
            : `文件 ${innerPayload.filePath} 已保存一个新版本。`;

          console.log(`[MainIpcHandler] Dispatching chat/appendMessage for checkpoint: ${innerPayload.checkpointId}`);
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
        console.log(`[MainIpcHandler] Dispatching chat/appendMessage for system message.`);
        dispatch({ type: 'chat/appendMessage', payload: innerPayload });
        break;

      default:
        // 所有其他事件都属于 chatSlice
        dispatch({ type: 'chat/ipcAiResponse', payload });
        break;
    }
  };

  const handleUpdateCurrentFile = (event, filename) => {
    dispatch({ type: 'novel/updateCurrentFile', payload: filename });
  };

  const handleFileWritten = (event, { filePath, content }) => {
    dispatch({ type: 'novel/fileWritten', payload: { filePath, content } });
  };

  const handleFileDeleted = (event, { filePath }) => {
    dispatch({ type: 'novel/fileDeleted', payload: { filePath } });
  };

  const handleFileRenamed = (event, { oldFilePath, newFilePath }) => {
    dispatch({ type: 'novel/fileRenamed', payload: { oldFilePath, newFilePath } });
  };

  if (window.ipcRenderer) {
    window.ipcRenderer.on('ai-response', handleAiResponse);
    window.ipcRenderer.on('update-current-file', handleUpdateCurrentFile);
    window.ipcRenderer.on('file-written', handleFileWritten);
    window.ipcRenderer.on('file-deleted', handleFileDeleted);
    window.ipcRenderer.on('file-renamed', handleFileRenamed);
    window.ipcRenderer.on('ai-chat-history', (event, history) => {
      dispatch(setDeepSeekHistory(history));
    });
    console.log("[MainIpcHandler] 所有 IPC 监听器已注册.");
  }

  // 返回清理函数
  return () => {
    if (window.ipcRenderer) {
      window.ipcRenderer.removeListener('ai-response', handleAiResponse);
      window.ipcRenderer.removeListener('update-current-file', handleUpdateCurrentFile);
      window.ipcRenderer.removeListener('file-written', handleFileWritten);
      window.ipcRenderer.removeListener('file-deleted', handleFileDeleted);
      window.ipcRenderer.removeListener('file-renamed', handleFileRenamed);
      // 注意：这里移除监听器时，回调函数必须是同一个引用，否则无法正确移除。
      // 对于匿名函数，需要单独定义
      const removeHistoryListener = (event, history) => {
        dispatch(setDeepSeekHistory(history));
      };
      window.ipcRenderer.removeListener('ai-chat-history', removeHistoryListener);
      console.log("[MainIpcHandler] 所有 IPC 监听器已移除.");
    }
  };
};