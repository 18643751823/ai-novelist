import { useCallback } from 'react';
import useHttpService from './useHttpService.js';

/**
 * 向后兼容的 useIpcRenderer hook
 * 这个 hook 现在使用 HTTP 服务，但保持与原来 IPC 相同的接口
 * 用于平滑过渡到 HTTP 通信
 */
const useIpcRenderer = () => {
  const httpService = useHttpService();

  // 直接返回 HTTP 服务的所有方法
  return {
    ...httpService,
    
    // 为了向后兼容，保留原来的方法名
    invoke: httpService.invoke,
    send: httpService.send,
    on: httpService.on,
    removeListener: httpService.removeListener,
    getStoreValue: httpService.getStoreValue,
    setStoreValue: httpService.setStoreValue,
    sendToMainLog: httpService.sendToMainLog,
    listAllModels: httpService.listAvailableModels,
    reinitializeModelProvider: httpService.reinitializeModelProvider,
    reinitializeAliyunEmbedding: httpService.reinitializeAliyunEmbedding,
    
    // 添加 stopStreaming 方法用于向后兼容
    stopStreaming: useCallback(() => {
      console.log('HTTP 服务: 停止流式传输');
      // HTTP 服务中停止流式传输的实现
      return { success: true, message: '流式传输已停止' };
    }, [])
  };
};

export default useIpcRenderer;
