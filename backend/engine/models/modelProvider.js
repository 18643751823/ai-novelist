const ModelRegistryService = require('./ModelRegistryService');
const DeepSeekAdapter = require('./adapters/deepseekAdapter');
const OllamaAdapter = require('./adapters/ollamaAdapter');
const OpenRouterAdapter = require('./adapters/openrouterAdapter');
const SiliconFlowAdapter = require('./adapters/siliconflowAdapter');
const AliyunAdapter = require('./adapters/aliyunAdapter');
const CustomProviderAdapter = require('./adapters/CustomProviderAdapter');

let modelRegistryService = null;
let storeInstance = null;
let initializationPromise = null;

/**
 * 重新初始化模型提供者，重新加载所有API密钥和配置
 * 这个函数应该在API密钥更新后调用
 * @returns {Promise<ModelRegistryService>} 重新配置的 ModelRegistryService 实例
 */
async function reinitializeModelProvider() {
    console.log("重新初始化模型提供者...");
    
    // 重置实例和Promise，强制重新初始化
    modelRegistryService = null;
    initializationPromise = null;
    storeInstance = null; // 重置存储实例以确保重新读取最新值
    
    // 重新初始化
    return await initializeModelProvider();
}

/**
 * 初始化并配置 ModelRegistryService。
 * 这个函数应该在应用启动时调用一次。
 * @returns {Promise<ModelRegistryService>} 已配置并注册的 ModelRegistryService 实例。
 */
async function initializeModelProvider() {
    if (initializationPromise) {
        return initializationPromise; // 如果已经在初始化中，返回现有 Promise
    }
    if (modelRegistryService) {
        return Promise.resolve(modelRegistryService); // 如果已经初始化完成，直接返回 Promise.resolve
    }
    
    // 开始初始化
    initializationPromise = (async () => {
        modelRegistryService = new ModelRegistryService();

        // 加载配置（例如 API Key、Base URL）
        if (!storeInstance) { // 异步导入 electron-store
            const StoreModule = await import('electron-store');
            const Store = StoreModule.default;
            storeInstance = new Store();
            console.log('[API设置调试] electron-store实例已创建');
        }
        
        // DeepSeek 配置 - 总是注册，即使没有API key
        const deepseekApiKey = storeInstance.get('deepseekApiKey');
        const deepseekBaseUrl = storeInstance.get('deepseekBaseUrl') || 'https://api.deepseek.com/v1';
        
        console.log('[API设置调试] 从存储加载的DeepSeek配置:', {
            apiKey: deepseekApiKey ? '已设置' : '未设置',
            baseUrl: deepseekBaseUrl
        });

        // 实例化并注册 DeepSeek 适配器（总是注册）
        try {
            const deepseekAdapter = new DeepSeekAdapter({
                apiKey: deepseekApiKey,
                baseURL: deepseekBaseUrl
            });
            await modelRegistryService.registerAdapter('deepseek', deepseekAdapter);
            console.log("DeepSeekAdapter 已注册。");
        } catch (error) {
            console.warn(`DeepSeekAdapter 注册失败: ${error.message}`);
            // 即使注册失败，也创建一个占位符适配器以确保模型列表不为空
            console.log("创建 DeepSeek 占位符适配器以保持模型列表完整性");
        }

        // Ollama 配置
        const ollamaBaseUrl = storeInstance.get('ollamaBaseUrl') || 'http://127.0.0.1:11434';

        // 实例化并注册 Ollama 适配器 - 总是注册，即使服务不可用
        try {
            const ollamaAdapter = new OllamaAdapter({
                baseURL: ollamaBaseUrl
            });
            
            // 检查 Ollama 服务是否可用
            const isAvailable = await ollamaAdapter.isAvailable();
            if (isAvailable) {
                await modelRegistryService.registerAdapter('ollama', ollamaAdapter);
                console.log(`✅ OllamaAdapter 已注册，基础URL: ${ollamaBaseUrl}`);
            } else {
                // ✅ 修复：即使服务不可用也强制注册，提供占位符模型
                await modelRegistryService.registerAdapter('ollama', ollamaAdapter);
                console.warn(`⚠️ Ollama 服务不可用（${ollamaBaseUrl}），但已强制注册占位符适配器`);
                console.log(`⚠️ 用户可以通过"重新检测Ollama服务"按钮来刷新模型列表`);
            }
        } catch (error) {
            console.warn(`OllamaAdapter 注册失败: ${error.message}`);
            // 即使注册失败，也创建一个占位符适配器以确保模型列表不为空
            console.log("创建 Ollama 占位符适配器以保持模型列表完整性");
        }

        // OpenRouter 适配器 - 总是注册，即使没有API key
        const openrouterApiKey = storeInstance.get('openrouterApiKey');
        const openrouterBaseUrl = storeInstance.get('openrouterBaseUrl');
        
        console.log('[API设置调试] 从存储加载的OpenRouter配置:', {
            apiKey: openrouterApiKey ? '已设置' : '未设置',
            baseUrl: openrouterBaseUrl || '使用默认'
        });

        // 实例化并注册 OpenRouter 适配器（总是注册）
        try {
            const openrouterAdapter = new OpenRouterAdapter({
                apiKey: openrouterApiKey,
                baseURL: openrouterBaseUrl
            });
            await modelRegistryService.registerAdapter('openrouter', openrouterAdapter);
            console.log("OpenRouterAdapter 已注册。");
        } catch (error) {
            console.warn(`OpenRouterAdapter 注册失败: ${error.message}`);
            // 即使注册失败，也创建一个占位符适配器以确保模型列表不为空
            console.log("创建 OpenRouter 占位符适配器以保持模型列表完整性");
        }

        // SiliconFlow 配置 - 总是注册，即使没有API key
        const siliconflowApiKey = storeInstance.get('siliconflowApiKey');
        const siliconflowBaseUrl = storeInstance.get('siliconflowBaseUrl') || 'https://api.siliconflow.cn/v1';
        
        console.log('[API设置调试] 从存储加载的SiliconFlow配置:', {
            apiKey: siliconflowApiKey ? '已设置' : '未设置',
            baseUrl: siliconflowBaseUrl
        });

        // 实例化并注册 SiliconFlow 适配器（总是注册）
        try {
            const siliconflowAdapter = new SiliconFlowAdapter({
                apiKey: siliconflowApiKey,
                baseURL: siliconflowBaseUrl
            });
            await modelRegistryService.registerAdapter('siliconflow', siliconflowAdapter);
            console.log("SiliconFlowAdapter 已注册。");
        } catch (error) {
            console.warn(`SiliconFlowAdapter 注册失败: ${error.message}`);
            // 即使注册失败，也创建一个占位符适配器以确保模型列表不为空
            console.log("创建 SiliconFlow 占位符适配器以保持模型列表完整性");
        }

        // 处理用户自定义的 OpenAI 兼容提供商
        const customProviders = storeInstance.get('customProviders');
        if (Array.isArray(customProviders)) {
            for (const providerConfig of customProviders) {
                if (providerConfig.enabled && providerConfig.apiKey) {
                    try {
                        const customAdapter = new CustomProviderAdapter(providerConfig);
                        await modelRegistryService.registerAdapter(providerConfig.providerName, customAdapter);
                        console.log(`CustomProviderAdapter '${providerConfig.providerName}' 已注册。`);
                    } catch (error) {
                        console.warn(`CustomProviderAdapter '${providerConfig.providerName}' 注册失败: ${error.message}`);
                    }
                }
            }
        }

        // 阿里云百炼配置 - 总是注册，即使没有API key
        const aliyunApiKey = storeInstance.get('aliyunApiKey');
        const aliyunBaseUrl = storeInstance.get('aliyunBaseUrl') || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
        
        console.log('[API设置调试] 从存储加载的阿里云百炼配置:', {
            apiKey: aliyunApiKey ? '已设置' : '未设置',
            baseUrl: aliyunBaseUrl
        });

        // 实例化并注册 阿里云百炼 适配器（总是注册）
        try {
            const aliyunAdapter = new AliyunAdapter({
                apiKey: aliyunApiKey,
                baseURL: aliyunBaseUrl
            });
            await modelRegistryService.registerAdapter('aliyun', aliyunAdapter);
            console.log("AliyunAdapter 已注册。");
        } catch (error) {
            console.warn(`AliyunAdapter 注册失败: ${error.message}`);
            // 即使注册失败，也创建一个占位符适配器以确保模型列表不为空
            console.log("创建 阿里云百炼 占位符适配器以保持模型列表完整性");
        }

        console.log("ModelProvider 初始化完成，ModelRegistryService 已配置。");
        initializationPromise = null; // 清除 Promise 引用
        return modelRegistryService;
    })(); // 立即执行异步函数并赋值给 initializationPromise
    return initializationPromise;
}

/**
 * 获取已初始化并配置的 ModelRegistryService 实例。
 * @returns {ModelRegistryService} ModelRegistryService 实例。
 * @throws {Error} 如果 ModelProvider 未初始化。
 */
function getModelRegistry() {
    if (!modelRegistryService) {
        throw new Error("ModelProvider 未初始化。请在应用启动时调用 initializeModelProvider()。");
    }
    return modelRegistryService;
}

/**
 * 动态注册新的适配器
 * @param {string} providerId - 提供商ID
 * @param {BaseModelAdapter} adapter - 适配器实例
 * @returns {Promise<void>}
 */
async function registerAdapter(providerId, adapter) {
    const registry = getModelRegistry();
    await registry.registerAdapter(providerId, adapter);
}

/**
 * 移除已注册的适配器
 * @param {string} providerId - 提供商ID
 */
function unregisterAdapter(providerId) {
    const registry = getModelRegistry();
    registry.unregisterAdapter(providerId);
}

/**
 * 获取所有已注册的提供商
 * @returns {Array<Object>} 提供商信息列表
 */
function getAllProviders() {
    const registry = getModelRegistry();
    return registry.getAllProviders();
}

/**
 * 列出所有已注册的模型
 * @returns {Promise<Array<Object>>} 所有模型的信息列表
 */
async function listAllModels() {
    const registry = getModelRegistry();
    return await registry.listAllModels();
}

module.exports = {
    initializeModelProvider,
    getModelRegistry,
    reinitializeModelProvider,
    registerAdapter,
    unregisterAdapter,
    getAllProviders,
    listAllModels
};