import { useCallback } from 'react';

const useIpcRenderer = () => {
  const send = useCallback((channel, ...args) => {
    if (window.ipcRenderer) {
      window.ipcRenderer.send(channel, ...args);
    } else {
      console.warn('ipcRenderer is not available. Are you running in Electron?');
    }
  }, []);

  const invoke = useCallback(async (channel, ...args) => {
    if (window.ipcRenderer) {
      return await window.ipcRenderer.invoke(channel, ...args);
    } else {
      console.warn('ipcRenderer is not available. Are you running in Electron?');
      return null;
    }
  }, []);

  const on = useCallback((channel, listener) => {
    if (window.ipcRenderer) {
      window.ipcRenderer.on(channel, listener);
    } else {
      console.warn('ipcRenderer is not available. Are you running in Electron?');
    }
  }, []);

  const removeListener = useCallback((channel, listener) => {
    if (window.ipcRenderer) {
      window.ipcRenderer.removeListener(channel, listener);
    } else {
      console.warn('ipcRenderer is not available. Are you running in Electron?');
    }
  }, []);

  return {
    send,
    invoke,
    on,
    removeListener,
    getDeepSeekChatHistory: useCallback(() => invoke('get-ai-chat-history'), [invoke]), // 修改为更通用的 ai 名称
    deleteDeepSeekChatHistory: useCallback((sessionId) => invoke('delete-ai-chat-history', sessionId), [invoke]), // 修改为更通用的 ai 名称
    clearDeepSeekConversation: useCallback(() => invoke('clear-ai-conversation'), [invoke]), // 修改为更通用的 ai 名称
    getStoreValue: useCallback((key) => invoke('get-store-value', key), [invoke]), // 新增：获取 electron-store 值
    setStoreValue: useCallback((key, value) => invoke('set-store-value', key, value), [invoke]), // 新增：设置 electron-store 值
    sendToMainLog: useCallback((message) => send('main-log', message), [send]), // 新增：发送日志到主进程
    listAllModels: useCallback(() => invoke('list-all-models'), [invoke]), // 新增：获取所有可用模型列表
    reinitializeModelProvider: useCallback(() => invoke('reinitialize-model-provider'), [invoke]), // 新增：重新初始化模型提供者
    reinitializeAliyunEmbedding: useCallback(() => invoke('reinitialize-aliyun-embedding'), [invoke]) // 新增：重新初始化阿里云嵌入函数
  };
};

export default useIpcRenderer;
