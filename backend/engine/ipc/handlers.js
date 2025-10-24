const { ipcMain } = require('electron');
const { state, setMainWindow } = require('../../state-manager');

// 导入各个功能模块
const toolHandlers = require('./handlers/toolHandlers');
const fileHandlers = require('./handlers/fileHandlers');
const chatHandlers = require('./handlers/chatHandlers');
const ragHandlers = require('./handlers/ragHandlers');
const modelHandlers = require('./handlers/modelHandlers');
const configHandlers = require('./handlers/configHandlers');
const checkpointHandlers = require('./handlers/checkpointHandlers');
const aiHistoryHandlers = require('./handlers/aiHistoryHandlers');
const { setStoreInstance: setSharedUtilsStore } = require('./handlers/sharedUtils');

let storeInstance = null;

// 注册所有IPC处理器
function register(store, mainWindow) {
  storeInstance = store; // 设置全局存储实例
  console.log('[handlers.js] register: 开始注册 IPC 处理器...');
  console.log(`[DEBUG] register: storeInstance set, path: ${storeInstance.path}`);
  
  // 设置存储实例给各个模块
  setSharedUtilsStore(store);
  chatHandlers.setStoreInstance(store);
  ragHandlers.setStoreInstance(store);
  modelHandlers.setStoreInstance(store);
  configHandlers.setStoreInstance(store);
  
  // 记录应用启动时的配置状态
  console.log('[handlers.js] 应用启动配置检查:');
  try {
    const modeFeatureSettings = storeInstance.get('modeFeatureSettings');
    console.log('[handlers.js] 存储中的 modeFeatureSettings:', JSON.stringify(modeFeatureSettings, null, 2));
    
    const toolUsageEnabled = storeInstance.get('toolUsageEnabled');
    console.log('[handlers.js] 存储中的 toolUsageEnabled:', toolUsageEnabled);
    
    // 注意：工具功能状态管理已移除，不再初始化相关状态
    console.log('[handlers.js] 工具功能状态管理已移除，使用硬编码模式路由');
  } catch (error) {
    console.error('[handlers.js] 初始化配置状态失败:', error);
  }
  
  // 注册各个功能模块的处理器
  toolHandlers.registerToolHandlers();
  fileHandlers.registerFileHandlers();
  chatHandlers.registerChatHandlers();
  ragHandlers.registerRagHandlers();
  modelHandlers.registerModelHandlers();
  configHandlers.registerConfigHandlers();
  checkpointHandlers.registerCheckpointHandlers();
  aiHistoryHandlers.registerAiHistoryHandlers();
  
  console.log('[handlers.js] 所有 IPC 处理器注册完成。');
}

// 分开导出避免循环引用
exports.register = register;
exports.setMainWindow = setMainWindow;
exports.state = state;

// 导出各个处理器函数，供其他模块使用
exports.processCommand = chatHandlers.handleProcessCommand;
exports.sendUserResponse = chatHandlers.handleUserQuestionResponse;
exports.processToolAction = toolHandlers.handleProcessToolAction;
exports.getChaptersAndUpdateFrontend = fileHandlers.getChaptersAndUpdateFrontend;
exports.handleGetContextLimitSettings = configHandlers.handleGetContextLimitSettings;
exports.handleSetContextLimitSettings = configHandlers.handleSetContextLimitSettings;
exports.handleSetRagRetrievalEnabled = configHandlers.handleSetRagRetrievalEnabled;

// 导出其他可能需要的外部函数
exports.handleGetChapters = fileHandlers.handleGetChapters;
exports.handleLoadChapterContent = fileHandlers.handleLoadChapterContent;
exports.handleCreateChapter = fileHandlers.handleCreateChapter;
exports.handleCreateFolder = fileHandlers.handleCreateFolder;
exports.handleCreateNovelFile = fileHandlers.handleCreateNovelFile;
exports.handleDeleteItem = fileHandlers.handleDeleteItem;
exports.handleRenameItem = fileHandlers.handleRenameItem;
exports.handleCopyItem = fileHandlers.handleCopyItem;
exports.handleMoveItem = fileHandlers.handleMoveItem;
exports.handleUpdateItemOrder = fileHandlers.handleUpdateItemOrder;
exports.handleUpdateNovelTitle = fileHandlers.handleUpdateNovelTitle;
exports.handleSaveNovelContent = fileHandlers.handleSaveNovelContent;
exports.handleListNovelFiles = fileHandlers.handleListNovelFiles;
exports.handleSearchNovelFiles = fileHandlers.handleSearchNovelFiles;
exports.handleGetAiChatHistory = aiHistoryHandlers.handleGetAiChatHistory;
exports.handleDeleteAiChatHistory = aiHistoryHandlers.handleDeleteAiChatHistory;
exports.handleClearAiConversation = chatHandlers.handleClearAiConversation;
exports.handleListAllModels = modelHandlers.handleListAllModels;
exports.handleGetModelsByProvider = modelHandlers.handleGetModelsByProvider;
exports.handleRedetectOllama = modelHandlers.handleRedetectOllama;
exports.handleGetEmbeddingDimensions = modelHandlers.handleGetEmbeddingDimensions;
exports.handleAddFileToKb = ragHandlers.handleAddFileToKb;
exports.handleListKbFiles = ragHandlers.handleListKbFiles;
exports.handleDeleteKbFile = ragHandlers.handleDeleteKbFile;
exports.handleRenameKbFile = ragHandlers.handleRenameKbFile;
exports.handleGetAdditionalInfo = configHandlers.handleGetAdditionalInfo;
exports.handleGetDefaultPrompts = configHandlers.handleGetDefaultPrompts;
exports.handleOpenExternal = configHandlers.handleOpenExternal;
exports.handleGetStoreValue = configHandlers.handleGetStoreValue;
exports.handleSetStoreValue = configHandlers.handleSetStoreValue;
exports.handleReinitializeModelProvider = modelHandlers.handleReinitializeModelProvider;
exports.handleCheckpointSave = checkpointHandlers.handleCheckpointSave;
exports.handleCheckpointRestoreNovel = checkpointHandlers.handleCheckpointRestoreNovel;
exports.handleCheckpointRestoreChat = checkpointHandlers.handleCheckpointRestoreChat;
exports.handleCheckpointDelete = checkpointHandlers.handleCheckpointDelete;
exports.handleCheckpointGetDiff = checkpointHandlers.handleCheckpointGetDiff;
exports.handleCheckpointGetHistory = checkpointHandlers.handleCheckpointGetHistory;
