const { ipcMain } = require('electron');
const { getModelRegistry, initializeModelProvider, reinitializeModelProvider } = require('../models/modelProvider');

let storeInstance = null;

// 新增：处理获取所有可用模型列表请求
const handleListAllModels = async () => {
    try {
        // 确保 ModelProvider 已初始化，这在 chatService 中已经处理，这里再次确保
        await initializeModelProvider();
        const modelRegistry = getModelRegistry();
        const allModels = await modelRegistry.listAllModels(); // **关键修改：添加 await**
        
        console.log(`[modelHandlers.js] handleListAllModels: 获取到 ${allModels.length} 个模型。`);
        
        // 尝试对模型数据进行深拷贝和序列化检查
        try {
            // 使用 JSON.stringify 和 JSON.parse 来进行深拷贝和清理
            // 这会自动移除所有值为 `undefined` 的键，并处理大多数可序列化的数据类型
            const serializableModels = JSON.parse(JSON.stringify(allModels));
            return { success: true, models: serializableModels };
        } catch (error) {
            console.error('[modelHandlers.js] 模型数据序列化失败:', error);
            // 记录失败时的原始数据以供调试
            console.error('[modelHandlers.js] 导致失败的原始模型数据:', allModels);
            return { success: false, error: `模型数据序列化失败: ${error.message}` };
        }
    } catch (error) {
        console.error('[modelHandlers.js] 获取所有模型列表失败:', error);
        return { success: false, error: error.message };
    }
};

// 新增：处理按提供商获取模型列表请求
const handleGetModelsByProvider = async (event, providerId) => {
    try {
        console.log(`[modelHandlers.js] handleGetModelsByProvider: 获取提供商 ${providerId} 的模型列表`);
        
        // 确保 ModelProvider 已初始化
        await initializeModelProvider();
        const modelRegistry = getModelRegistry();
        
        // 获取指定提供商的适配器
        const adapter = modelRegistry.getAdapter(providerId);
        if (!adapter) {
            console.warn(`[modelHandlers.js] 提供商 ${providerId} 的适配器未找到`);
            return { success: true, models: [] }; // 返回空列表而不是错误
        }
        
        // 获取该提供商的模型列表
        const models = await adapter.listModels();
        console.log(`[modelHandlers.js] 提供商 ${providerId} 有 ${models.length} 个模型`);
        
        // 处理模型数据，添加提供商信息和标准化ID
        const processedModels = models.map(model => ({
            ...model,
            id: modelRegistry._normalizeModelId(model.id, providerId),
            provider: providerId
        }));
        
        // 序列化模型数据
        const serializableModels = JSON.parse(JSON.stringify(processedModels));
        return { success: true, models: serializableModels };
        
    } catch (error) {
        console.error(`[modelHandlers.js] 获取提供商 ${providerId} 的模型列表失败:`, error);
        // 返回空列表而不是错误，避免影响前端显示
        return { success: true, models: [] };
    }
};

// 新增：处理重新检测Ollama服务请求
const handleRedetectOllama = async () => {
    try {
        console.log('[modelHandlers.js] 开始重新检测Ollama服务...');
        
        // 获取当前的Ollama适配器
        const modelRegistry = getModelRegistry();
        
        // ✅ 修复：使用正确的适配器访问方式
        const ollamaAdapter = modelRegistry.adapters['ollama'];
        
        if (!ollamaAdapter) {
            console.warn('[modelHandlers.js] Ollama适配器未找到，尝试重新创建适配器');
            // 即使适配器不存在，也继续创建新的适配器
        }

        // ✅ 修复：重新创建适配器实例以刷新连接
        const OllamaAdapter = require('../models/adapters/ollamaAdapter');
        
        // 获取存储的Ollama基础URL设置
        let ollamaBaseUrl = 'http://127.0.0.1:11434';
        if (storeInstance) {
            const storedUrl = storeInstance.get('ollamaBaseUrl');
            if (storedUrl) {
                ollamaBaseUrl = storedUrl;
            }
        }
        
        const newOllamaAdapter = new OllamaAdapter({
            baseURL: ollamaBaseUrl
        });

        // ✅ 修复：重新注册新的适配器实例
        await modelRegistry.registerAdapter('ollama', newOllamaAdapter);
        
        // 获取新的模型列表
        const models = await newOllamaAdapter.listModels();
        console.log(`[modelHandlers.js] 重新检测Ollama成功，获取到 ${models.length} 个模型`);
        
        return { success: true, message: `Ollama服务重新检测成功，发现 ${models.length} 个模型` };
    } catch (error) {
        console.error('[modelHandlers.js] 重新检测Ollama失败:', error);
        return { success: false, error: error.message };
    }
};

// 新增：处理获取嵌入模型维度请求
const handleGetEmbeddingDimensions = async (event, modelId) => {
    try {
        console.log(`[modelHandlers.js] 开始获取嵌入模型维度: ${modelId}`);
        
        // 确保 ModelProvider 已初始化
        await initializeModelProvider();
        const modelRegistry = getModelRegistry();
        
        // 获取模型信息
        const modelInfo = await modelRegistry.getModelInfo(modelId);
        if (!modelInfo) {
            return { success: false, error: `模型 ${modelId} 未找到` };
        }
        
        // 获取适配器
        const adapter = modelRegistry.getAdapter(modelInfo.provider);
        if (!adapter) {
            return { success: false, error: `提供商 ${modelInfo.provider} 的适配器未找到` };
        }
        
        // 检查适配器是否支持获取嵌入维度
        if (typeof adapter.getEmbeddingDimensions !== 'function') {
            return { success: false, error: `模型 ${modelId} 不支持自动获取嵌入维度` };
        }
        
        // 获取嵌入维度
        const dimensions = await adapter.getEmbeddingDimensions(modelInfo);
        console.log(`[modelHandlers.js] 模型 ${modelId} 的嵌入维度: ${dimensions}`);
        
        return { success: true, dimensions };
        
    } catch (error) {
        console.error(`[modelHandlers.js] 获取嵌入模型维度失败: ${modelId}`, error);
        return { success: false, error: `获取嵌入维度失败: ${error.message}` };
    }
};

// 新增：重新初始化模型提供者处理器
const handleReinitializeModelProvider = async () => {
    try {
        console.log('[modelHandlers.js] 收到重新初始化模型提供者请求');
        await reinitializeModelProvider();
        return { success: true, message: '模型提供者重新初始化成功' };
    } catch (error) {
        console.error('[modelHandlers.js] 重新初始化模型提供者失败:', error);
        return { success: false, error: error.message };
    }
};

// 设置存储实例
const setStoreInstance = (store) => {
    storeInstance = store;
};

// 注册模型管理相关IPC处理器
function registerModelHandlers() {
    console.log('[modelHandlers.js] 注册模型管理相关IPC处理器...');
    
    ipcMain.handle('list-all-models', handleListAllModels); // 新增：注册获取所有模型列表处理器
    ipcMain.handle('get-available-models', handleListAllModels); // 新增：注册get-available-models别名处理器
    ipcMain.handle('get-models-by-provider', handleGetModelsByProvider); // 新增：注册按提供商获取模型列表处理器
    ipcMain.handle('redetect-ollama', handleRedetectOllama); // 新增：注册重新检测Ollama服务处理器
    ipcMain.handle('get-embedding-dimensions', handleGetEmbeddingDimensions); // 新增：注册获取嵌入模型维度处理器
    ipcMain.handle('reinitialize-model-provider', handleReinitializeModelProvider); // 新增：注册重新初始化模型提供者处理器
}

module.exports = {
    registerModelHandlers,
    handleListAllModels,
    handleGetModelsByProvider,
    handleRedetectOllama,
    handleGetEmbeddingDimensions,
    handleReinitializeModelProvider,
    setStoreInstance
};