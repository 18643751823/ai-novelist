const { ipcMain, shell } = require('electron');
const contextManager = require('../contextManager');
const sortConfigManager = require('../../../utils/sortConfigManager');
const { getNovelPath } = require('./sharedUtils');

let storeInstance = null;

// 新增：设置上下文限制设置
const handleSetContextLimitSettings = async (event, data) => {
  try {
    console.log('[configHandlers.js] 收到上下文设置保存请求');
    console.log('[configHandlers.js] 传入的数据:', JSON.stringify(data, null, 2));
    
    // 提取实际的settings对象（前端传递的是 {settings: {...}}）
    const settings = data.settings || data;
    console.log('[configHandlers.js] 提取的设置:', JSON.stringify(settings, null, 2));
    
    // 验证设置
    if (!contextManager.validateContextSettings(settings)) {
      console.error('[configHandlers.js] 上下文设置验证失败');
      console.error('[configHandlers.js] 设置详情:', settings);
      return { success: false, error: '无效的上下文设置格式' };
    }

    console.log('[configHandlers.js] 上下文设置验证通过');

    // 确保storeInstance已初始化
    if (!storeInstance) {
      console.error('[ERROR] storeInstance未初始化！这表示register()函数没有被正确调用');
      console.error('[ERROR] 上下文设置无法保存，因为store实例不存在');
      return { success: false, error: '存储实例未初始化，无法保存设置' };
    }

    // 保存到electron-store
    console.log('[configHandlers.js] 正在保存到electron-store...');
    storeInstance.set('contextLimitSettings', settings);
    console.log('[configHandlers.js] 上下文限制设置已保存到electron-store');

    // 验证保存是否成功
    const savedSettings = storeInstance.get('contextLimitSettings');
    console.log('[configHandlers.js] 从electron-store读取验证:', savedSettings);
    
    if (savedSettings) {
      console.log('[configHandlers.js] 保存验证成功');
    } else {
      console.error('[configHandlers.js] 保存验证失败 - 从存储读取为空');
    }

    return { success: true, settings };
  } catch (error) {
    console.error('[configHandlers.js] 设置上下文限制失败:', error);
    console.error('[configHandlers.js] 错误堆栈:', error.stack);
    return { success: false, error: error.message };
  }
};

// 新增：设置RAG检索启用状态
const handleSetRagRetrievalEnabled = async (event, mode, enabled) => {
  try {
    console.log(`[configHandlers.js] 设置RAG检索状态: mode=${mode}, enabled=${enabled}`);
    
    // 确保storeInstance已初始化
    if (!storeInstance) {
      console.error('[ERROR] storeInstance未初始化！无法保存RAG设置');
      return { success: false, error: '存储实例未初始化，无法保存设置' };
    }

    // 获取当前的模式功能设置
    let modeFeatureSettings = storeInstance.get('modeFeatureSettings') || {};
    
    // 确保该模式的对象存在
    if (!modeFeatureSettings[mode]) {
      modeFeatureSettings[mode] = {};
    }
    
    // 更新RAG检索设置
    modeFeatureSettings[mode].ragRetrievalEnabled = enabled;
    
    // 保存到存储
    storeInstance.set('modeFeatureSettings', modeFeatureSettings);
    
    console.log(`[configHandlers.js] RAG检索状态已保存: mode=${mode}, enabled=${enabled}`);
    console.log(`[configHandlers.js] 当前所有模式设置:`, JSON.stringify(modeFeatureSettings, null, 2));
    
    return { success: true, mode, enabled };
  } catch (error) {
    console.error('[configHandlers.js] 设置RAG检索状态失败:', error);
    return { success: false, error: error.message };
  }
};

// 新增：获取上下文限制设置
const handleGetContextLimitSettings = async () => {
  try {
    let settings = null;
    
    // 确保storeInstance已初始化
    if (!storeInstance) {
      console.warn('[WARNING] storeInstance未初始化，返回默认上下文设置');
      // 返回默认设置而不是错误
      return {
        success: true,
        settings: {
          modes: {
            general: {
              chatContext: { type: 'turns', value: 20 },
              ragContext: { type: 'turns', value: 10 }
            },
            outline: {
              chatContext: { type: 'turns', value: 30 },
              ragContext: { type: 'turns', value: 15 }
            },
            writing: {
              chatContext: { type: 'turns', value: 20 },
              ragContext: { type: 'turns', value: 15 }
            },
            adjustment: {
              chatContext: { type: 'turns', value: 15 },
              ragContext: { type: 'turns', value: 8 }
            }
          }
        }
      };
    }

    // 从electron-store获取设置
    settings = storeInstance.get('contextLimitSettings');
    console.log('[configHandlers.js] 从electron-store获取上下文限制设置:', settings);

    // 如果没有保存的设置，使用默认设置
    if (!settings) {
      settings = contextManager.defaultSettings;
      console.log('[configHandlers.js] 使用默认上下文限制设置');
    }

    return { success: true, settings };
  } catch (error) {
    console.error('[configHandlers.js] 获取上下文限制设置失败:', error);
    return { success: false, error: error.message };
  }
};

// 处理排序配置相关请求
const handleGetSortConfig = async () => {
    try {
        const config = sortConfigManager.getConfig();
        return { success: true, config };
    } catch (error) {
        console.error('[configHandlers.js] 获取排序配置失败:', error);
        return { success: false, error: error.message };
    }
};

const handleSetSortEnabled = async (event, enabled) => {
    try {
        await sortConfigManager.setSortEnabled(enabled);
        return { success: true, enabled };
    } catch (error) {
        console.error('[configHandlers.js] 设置排序启用状态失败:', error);
        return { success: false, error: error.message };
    }
};

const handleSetCustomOrder = async (event, { directoryPath, itemIds }) => {
    try {
        await sortConfigManager.setCustomOrder(directoryPath, itemIds);
        return { success: true };
    } catch (error) {
        console.error('[configHandlers.js] 设置自定义排序失败:', error);
        return { success: false, error: error.message };
    }
};

const handleClearCustomOrder = async (event, directoryPath) => {
    try {
        await sortConfigManager.clearCustomOrder(directoryPath);
        return { success: true };
    } catch (error) {
        console.error('[configHandlers.js] 清除自定义排序失败:', error);
        return { success: false, error: error.message };
    }
};

// 新增：获取附加信息处理器
const handleGetAdditionalInfo = async (mode) => {
  try {
    if (!storeInstance) {
      const StoreModule = await import('electron-store');
      const Store = StoreModule.default;
      storeInstance = new Store();
    }
    
    const additionalInfoData = storeInstance.get('additionalInfo') || {};
    const modeInfo = additionalInfoData[mode];
    
    let info;
    if (typeof modeInfo === 'string') {
      // 旧格式：字符串，迁移到新格式
      info = {
        outline: modeInfo,
        previousChapter: '',
        characterSettings: ''
      };
      console.log(`[configHandlers.js] 检测到旧格式附加信息，已迁移到新格式，mode=${mode}`);
    } else if (typeof modeInfo === 'object' && modeInfo !== null) {
      // 新格式：对象
      info = {
        outline: modeInfo.outline || '',
        previousChapter: modeInfo.previousChapter || '',
        characterSettings: modeInfo.characterSettings || ''
      };
    } else {
      // 空数据
      info = {
        outline: '',
        previousChapter: '',
        characterSettings: ''
      };
    }
    
    console.log(`[configHandlers.js] 获取附加信息 mode=${mode}, 各字段长度:`, {
      outline: info.outline.length,
      previousChapter: info.previousChapter.length,
      characterSettings: info.characterSettings.length
    });
    return { success: true, info };
  } catch (error) {
    console.error('[configHandlers.js] 获取附加信息失败:', error);
    return { success: false, error: error.message };
  }
};

// 新增：获取默认提示词处理器
const handleGetDefaultPrompts = async () => {
  try {
    // 导入prompts模块
    const prompts = require('../prompts');
    return { success: true, prompts };
  } catch (error) {
    console.error('[configHandlers.js] 获取默认提示词失败:', error);
    return { success: false, error: error.message };
  }
};

// 新增：打开外部链接处理器
const handleOpenExternal = async (event, url) => {
  try {
    console.log(`[configHandlers.js] 正在打开外部链接: ${url}`);
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    console.error(`[configHandlers.js] 打开外部链接失败: ${error.message}`);
    return { success: false, error: error.message };
  }
};

// get-store-value 处理器
const handleGetStoreValue = async (event, key) => {
  try {
    if (!storeInstance) {
      console.error(`[ERROR] get-store-value: storeInstance 未初始化！key: ${key}`);
      console.error(`[ERROR] 这表示 register() 函数没有被正确调用，或者 store 实例没有正确传递`);
      // 作为fallback，创建新实例，但这会导致配置同步问题
      const StoreModule = await import('electron-store');
      const Store = StoreModule.default;
      storeInstance = new Store();
      console.warn(`[WARNING] get-store-value: 创建了新的 storeInstance 作为fallback，路径: ${storeInstance.path}`);
    }
    const value = storeInstance.get(key);
    
    // 特别处理功能状态设置的详细日志
    const featureKeys = ['modeFeatureSettings', 'toolUsageEnabled', 'ragRetrievalEnabled'];
    if (featureKeys.includes(key)) {
    } else {
      // 特别处理API相关设置的详细日志
      const apiKeys = ['selectedModel', 'selectedProvider', 'deepseekApiKey', 'openrouterApiKey', 'aliyunEmbeddingApiKey', 'intentAnalysisModel'];
      if (apiKeys.includes(key)) {
      }
    }
    
    return value;
  } catch (error) {
    console.error(`[API设置调试] 获取值失败: ${key}`, error);
    return undefined; // 返回 undefined 而不是抛出错误，以便前端处理
  }
};

// set-store-value 处理器
const handleSetStoreValue = async (event, key, value) => {
  try {
    if (!storeInstance) {
      console.error(`[ERROR] set-store-value: storeInstance 未初始化！key: ${key}`);
      console.error(`[ERROR] 这表示 register() 函数没有被正确调用，或者 store 实例没有正确传递`);
      // 作为fallback，创建新实例，但这会导致配置同步问题
      const StoreModule = await import('electron-store');
      const Store = StoreModule.default;
      storeInstance = new Store();
      console.warn(`[WARNING] set-store-value: 创建了新的 storeInstance 作为fallback，路径: ${storeInstance.path}`);
    }
    
    // 特别处理功能状态设置的详细日志
    const featureKeys = ['modeFeatureSettings', 'toolUsageEnabled', 'ragRetrievalEnabled'];
    if (featureKeys.includes(key)) {
    } else {
      // 特别处理API相关设置的详细日志
      const apiKeys = ['selectedModel', 'selectedProvider', 'deepseekApiKey', 'openrouterApiKey', 'aliyunEmbeddingApiKey', 'intentAnalysisModel'];
      if (apiKeys.includes(key)) {
      }
    }
    
    storeInstance.set(key, value);
    
    // 验证保存是否成功
    const savedValue = storeInstance.get(key);
    
    // 强制写入磁盘
    await storeInstance.store;
    
    return { success: true, message: `值已保存: ${key}` };
  } catch (error) {
    console.error(`[API设置调试] 保存值失败: ${key}`, error);
    return { success: false, error: error.message };
  }
};

// 设置存储实例
const setStoreInstance = (store) => {
  storeInstance = store;
};

// 注册配置相关IPC处理器
function registerConfigHandlers() {
  console.log('[configHandlers.js] 注册配置相关IPC处理器...');
  
  // 上下文限制设置处理器
  ipcMain.handle('set-context-limit-settings', handleSetContextLimitSettings);
  ipcMain.handle('get-context-limit-settings', handleGetContextLimitSettings);

  // RAG检索状态设置处理器
  ipcMain.handle('set-rag-retrieval-enabled', handleSetRagRetrievalEnabled);

  // 排序配置处理器
  ipcMain.handle('get-sort-config', handleGetSortConfig);
  ipcMain.handle('set-sort-enabled', handleSetSortEnabled);
  ipcMain.handle('set-custom-order', handleSetCustomOrder);
  ipcMain.handle('clear-custom-order', handleClearCustomOrder);

  // 存储相关处理器
  ipcMain.handle('get-store-value', handleGetStoreValue);
  ipcMain.handle('set-store-value', handleSetStoreValue);

  // 其他配置处理器
  ipcMain.handle('get-additional-info', async (event, mode) => {
    return await handleGetAdditionalInfo(mode);
  });
  ipcMain.handle('get-default-prompts', async () => {
    return await handleGetDefaultPrompts();
  });
  ipcMain.handle('open-external', handleOpenExternal);
  
  // 用于接收前端日志并输出到主进程终端
  ipcMain.on('main-log', (event, message) => {
    console.log('[Frontend Log]:', message);
  });
}

module.exports = {
  registerConfigHandlers,
  handleSetContextLimitSettings,
  handleGetContextLimitSettings,
  handleSetRagRetrievalEnabled,
  handleGetAdditionalInfo,
  handleGetDefaultPrompts,
  handleOpenExternal,
  handleGetStoreValue,
  handleSetStoreValue,
  setStoreInstance
};