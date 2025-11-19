// HTTP 服务 Hook - 替换 useIpcRenderer，使用 HTTP 服务
import { useCallback } from 'react';
import chatService from '../services/chatService.js';
import chapterService from '../services/chapterService.js';
import fileService from '../services/fileService.js';
import checkpointService from '../services/checkpointService.js';
import configStoreService from '../services/configStoreService.js';
import ragService from '../services/ragService.js';
import toolConfigService from '../services/toolConfigService.js';
import modelSelectionService from '../services/modelSelectionService.js';
import websocketClient from '../services/websocketClient.js';

const useHttpService = () => {
  // 章节相关操作
  const getChapters = useCallback(() => chapterService.getChapters(), []);
  const updateFileOrder = useCallback((directoryPath, fileIds) =>
    fileService.updateFileOrder(directoryPath, fileIds), []);
  const updateFolderOrder = useCallback((directoryPath, folderIds) =>
    fileService.updateFolderOrder(directoryPath, folderIds), []);
  const onChaptersUpdated = useCallback((callback) =>
    chapterService.onChaptersUpdated(callback), []);
  const removeChaptersUpdatedListener = useCallback((callback) =>
    chapterService.removeChaptersUpdatedListener(callback), []);

  // 文件操作
  const readFile = useCallback((filePath) => fileService.readFile(filePath), []);
  const writeFile = useCallback((filePath, content) =>
    fileService.writeFile(filePath, content), []);
  const createFile = useCallback((name, content, parentPath) =>
    chapterService.createFile(name, content, parentPath), []);
  const createFolder = useCallback((name, parentPath) =>
    chapterService.createFolder(name, parentPath), []);
  const renameItem = useCallback((oldPath, newName) =>
    chapterService.renameItem(oldPath, newName), []);
  const deleteItem = useCallback((itemPath) =>
    chapterService.deleteItem(itemPath), []);
  const moveItem = useCallback((sourcePath, targetPath) =>
    chapterService.moveItem(sourcePath, targetPath), []);
  const copyItem = useCallback((sourcePath, targetPath) =>
    chapterService.copyItem(sourcePath, targetPath), []);

  // 聊天相关操作
  const sendChatMessage = useCallback((messageData) =>
    chatService.sendChatMessage(messageData), []);
  const sendInterruptResponse = useCallback((interruptData) =>
    chatService.sendInterruptResponse(interruptData), []);
  const listAvailableModels = useCallback(() =>
    modelSelectionService.getAvailableModels(), []);

  // 检查点相关操作
  const getCheckpoints = useCallback((filePath, limit) =>
    checkpointService.getCheckpoints(filePath, limit), []);
  const createCheckpoint = useCallback((request) =>
    checkpointService.createCheckpoint(request), []);
  const restoreCheckpoint = useCallback((checkpointId) =>
    checkpointService.restoreCheckpoint(checkpointId), []);
  const deleteCheckpoint = useCallback((checkpointId) =>
    checkpointService.deleteCheckpoint(checkpointId), []);

  // 小说存档相关操作
  const createNovelArchive = useCallback((taskId, workspaceDir, message) =>
    checkpointService.createNovelArchive(taskId, workspaceDir, message), []);
  const restoreNovelArchive = useCallback((taskId, archiveId, workspaceDir) =>
    checkpointService.restoreNovelArchive(taskId, archiveId, workspaceDir), []);
  const listNovelArchives = useCallback((taskId) =>
    checkpointService.listNovelArchives(taskId), []);
  const deleteNovelArchive = useCallback((taskId, archiveId) =>
    checkpointService.deleteNovelArchive(taskId, archiveId), []);

  // 存储相关操作
  const getStoreValue = useCallback((key) =>
    configStoreService.getStoreValue(key), []);
  const setStoreValue = useCallback((key, value) =>
    configStoreService.setStoreValue(key, value), []);

  // 其他操作
  const getApiKey = useCallback(() =>
    configStoreService.getApiKey(), []);
  const reinitializeModelProvider = useCallback(() =>
    chapterService.reinitializeModelProvider(), []);
  const getDefaultPrompts = useCallback(() =>
    configStoreService.getDefaultPrompts(), []);
  
  // 工具配置操作
  const getModeToolConfig = useCallback((modeId) =>
    toolConfigService.getModeToolConfig(modeId), []);
  const updateModeToolConfig = useCallback((modeId, config) =>
    toolConfigService.updateModeToolConfig(modeId, config), []);
  const resetModeToolConfig = useCallback((modeId) =>
    toolConfigService.resetModeToolConfig(modeId), []);
  const getAllModeToolConfigs = useCallback(() =>
    toolConfigService.getAllModeToolConfigs(), []);
  const getAvailableTools = useCallback(() =>
    toolConfigService.getAvailableTools(), []);

  // 为了向后兼容，提供与 useIpcRenderer 相同的接口
  return {
    // 章节操作
    getChapters,
    updateFileOrder,
    updateFolderOrder,
    onChaptersUpdated,
    removeChaptersUpdatedListener,
    
    // 文件操作
    readFile,
    writeFile,
    createFile,
    createFolder,
    renameItem,
    deleteItem,
    moveItem,
    copyItem,
    
    // 聊天操作
    sendChatMessage,
    sendInterruptResponse,
    listAvailableModels,
    
    // 检查点操作
    getCheckpoints,
    createCheckpoint,
    restoreCheckpoint,
    deleteCheckpoint,
    
    // 小说存档操作
    createNovelArchive,
    restoreNovelArchive,
    listNovelArchives,
    deleteNovelArchive,
    
    // 存储操作
    getStoreValue,
    setStoreValue,
    
    // 其他操作
    getApiKey,
    reinitializeModelProvider,
    
    // 工具配置操作
    getModeToolConfig,
    updateModeToolConfig,
    resetModeToolConfig,
    getAllModeToolConfigs,
    getAvailableTools,
    
    // 向后兼容的别名（与 useIpcRenderer 保持一致）
    invoke: useCallback(async (channel, ...args) => {
      // 根据 channel 路由到相应的服务方法
      switch (channel) {
        case 'get-chapters':
          return await getChapters();
        case 'get-api-key':
          return await getApiKey();
        case 'set-store-value':
          return await setStoreValue(args[0], args[1]);
        case 'get-store-value':
          return await getStoreValue(args[0]);
        case 'reinitialize-model-provider':
          return await reinitializeModelProvider();
        case 'list-all-models':
          return await listAvailableModels();
        case 'get-available-models':
          return await listAvailableModels();
        case 'read-file':
          return await readFile(args[0]?.filePath);
        case 'write-file':
          return await writeFile(args[0]?.filePath, args[0]?.content);
        case 'save-novel-content':
          // 保存小说内容，参数格式：filePath, content
          return await writeFile(args[0], args[1]);
        case 'get-default-prompts':
          // 获取默认提示词
          return await getDefaultPrompts();
        case 'get-embedding-dimensions':
          // 获取嵌入维度设置
          return await ragService.getEmbeddingDimensions(args[0]);
        case 'get-embedding-models':
          // 获取嵌入模型列表
          return await ragService.getEmbeddingModels();
        case 'list-kb-files':
          // 列出知识库文件
          return await ragService.listKnowledgeBaseFiles();
        case 'get-rag-chunk-settings':
          // 获取RAG分块设置
          return await ragService.getRagChunkSettings();
        case 'add-file-to-kb':
          // 添加文件到知识库
          return await ragService.addFileToKnowledgeBase(args[0]);
        case 'delete-kb-file':
          // 删除知识库文件
          return await ragService.deleteKnowledgeBaseFile(args[0]);
        case 'rename-kb-file':
          // 重命名知识库文件
          return await ragService.renameKnowledgeBaseFile(args[0], args[1]);
        case 'get-mode-tool-config':
          // 获取模式工具配置
          return await getModeToolConfig(args[0]);
        case 'update-mode-tool-config':
          // 更新模式工具配置
          return await updateModeToolConfig(args[0], args[1]);
        case 'reset-mode-tool-config':
          // 重置模式工具配置
          return await resetModeToolConfig(args[0]);
        case 'get-all-mode-tool-configs':
          // 获取所有模式工具配置
          return await getAllModeToolConfigs();
        case 'get-available-tools':
          // 获取可用工具列表
          return await getAvailableTools();
        default:
          console.warn(`未知的调用通道: ${channel}`);
          return { success: false, error: `未知的调用通道: ${channel}` };
      }
    }, [
      getChapters, updateFileOrder, updateFolderOrder, getApiKey, setStoreValue, getStoreValue,
      reinitializeModelProvider, listAvailableModels, readFile, writeFile, getDefaultPrompts,
      getModeToolConfig, updateModeToolConfig, resetModeToolConfig, getAllModeToolConfigs, getAvailableTools
    ]),
    
    send: useCallback((channel, ...args) => {
      // HTTP 服务中 send 方法主要用于发送不需要响应的消息
      // 这里可以记录日志或执行其他操作
      console.log(`HTTP 服务发送消息: ${channel}`, args);
    }, []),
    
    on: useCallback((channel, listener) => {
      // HTTP 服务中 on 方法主要用于事件监听
      // 支持的事件通道
      if (channel === 'chapters-updated') {
        return onChaptersUpdated(listener);
      }
      // 支持 ai-response 和 show-diff-preview 事件通道
      if (channel === 'ai-response' || channel === 'show-diff-preview') {
        // 这些事件通过 WebSocket 处理，返回一个空的清理函数
        console.log(`HTTP 服务注册事件监听器: ${channel}`);
        return () => {
          console.log(`HTTP 服务移除事件监听器: ${channel}`);
        };
      }
      // 其他事件通道在 HTTP 模式下通过 WebSocket 直接处理
      console.warn(`HTTP 服务不支持的事件通道: ${channel}`);
    }, [onChaptersUpdated]),
    
    removeListener: useCallback((channel, listener) => {
      // HTTP 服务中 removeListener 方法用于移除事件监听
      if (channel === 'chapters-updated') {
        removeChaptersUpdatedListener(listener);
      }
      // 其他事件通道在 HTTP 模式下通过 WebSocket 直接处理
    }, [removeChaptersUpdatedListener]),
    
    sendToMainLog: useCallback((message) => {
      console.log('主进程日志:', message);
    }, []),
    reinitializeAliyunEmbedding: useCallback(() => {
      // 暂时不支持重新初始化阿里云嵌入
      console.warn('HTTP 服务暂不支持重新初始化阿里云嵌入');
      return { success: false, error: '暂不支持此操作' };
    }, []),
  };
};

export default useHttpService;
