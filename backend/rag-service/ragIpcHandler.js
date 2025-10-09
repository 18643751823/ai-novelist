const CollectionManager = require('./CollectionManager');

/**
 * RAG服务的IPC处理器
 */
class RagIpcHandler {
    constructor() {
        this.collectionManager = CollectionManager;
    }

    /**
     * 设置存储实例以便CollectionManager使用
     * @param {Object} store electron-store实例
     */
    setStore(store) {
        this.collectionManager.setStore(store);
    }

    /**
     * 设置阿里云嵌入API Key（已弃用，改为启动时一次性初始化）
     * @param {Object} event IPC事件对象
     * @param {string} apiKey 阿里云API Key
     * @returns {Promise<Object>} 设置结果
     */
    async setAliyunEmbeddingApiKey(event, apiKey) {
        console.warn("[RagIpcHandler] setAliyunEmbeddingApiKey已弃用，API Key应在启动时通过store设置");
        return { success: true, message: "API Key已保存，需要重启应用生效" };
    }

    /**
     * 重新初始化阿里云嵌入函数，用于API Key更新后实时刷新
     * @returns {Promise<Object>} 重新初始化结果
     */
    async reinitializeAliyunEmbedding() {
        try {
            console.log("[RagIpcHandler] 重新初始化阿里云嵌入函数...");
            const result = this.collectionManager.reinitializeEmbeddingFunction();
            
            if (result) {
                return {
                    success: true,
                    message: "阿里云嵌入函数已重新初始化，现在可以使用新的API Key"
                };
            } else {
                return {
                    success: false,
                    error: "阿里云嵌入函数重新初始化失败"
                };
            }
        } catch (error) {
            console.error("[RagIpcHandler] 重新初始化阿里云嵌入函数失败:", error);
            return {
                success: false,
                error: `重新初始化失败: ${error.message}`
            };
        }
    }

    /**
     * 获取当前嵌入函数状态
     * @returns {Promise<Object>} 状态信息
     */
    async getEmbeddingStatus() {
        try {
            const providerInfo = this.collectionManager.getEmbeddingProviderInfo();
            const isInitialized = !!this.collectionManager.embeddingFunction;

            return {
                success: true,
                isInitialized: isInitialized,
                provider: providerInfo?.provider || null,
                message: isInitialized ? `嵌入函数已初始化 (${providerInfo?.provider || '未知提供商'})` : '嵌入函数未初始化'
            };

        } catch (error) {
            console.error('[RagIpcHandler] 获取嵌入状态失败:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 测试阿里云API Key有效性（已弃用，改为启动时一次性初始化）
     * @param {Object} event IPC事件对象
     * @param {string} apiKey 要测试的API Key
     * @returns {Promise<Object>} 测试结果
     */
    async testAliyunApiKey(event, apiKey) {
        console.warn("[RagIpcHandler] testAliyunApiKey已弃用，改为启动时一次性初始化模式");
        return {
            success: true,
            message: 'API Key测试功能已禁用，请保存后重启应用'
        };
    }

    /**
     * 设置嵌入配置
     * @param {string} provider 提供商类型 ('aliyun' | 'ollama')
     * @param {Object} config 配置对象
     * @returns {Promise<Object>} 设置结果
     */
    async setEmbeddingConfig(provider, config) {
        try {
            console.log(`[RagIpcHandler] 设置嵌入配置: provider=${provider}`);

            const result = await this.collectionManager.setEmbeddingConfig(provider, config);

            console.log(`[RagIpcHandler] 嵌入配置设置完成:`, result);
            return result;

        } catch (error) {
            console.error('[RagIpcHandler] 设置嵌入配置失败:', error);
            return {
                success: false,
                error: `设置嵌入配置失败: ${error.message}`
            };
        }
    }

    /**
     * 获取嵌入配置
     * @returns {Promise<Object>} 配置信息
     */
    async getEmbeddingConfig() {
        try {
            const config = this.collectionManager.getEmbeddingConfigFromStore();
            const providerInfo = this.collectionManager.getEmbeddingProviderInfo();

            return {
                success: true,
                config: config,
                currentProvider: providerInfo?.provider || null,
                isInitialized: !!providerInfo
            };

        } catch (error) {
            console.error('[RagIpcHandler] 获取嵌入配置失败:', error);
            return {
                success: false,
                error: `获取嵌入配置失败: ${error.message}`
            };
        }
    }

    /**
     * 测试Ollama连接
     * @param {string} baseUrl Ollama服务器地址
     * @param {string} modelName 模型名称
     * @returns {Promise<Object>} 测试结果
     */
    async testOllamaConnection(baseUrl, modelName) {
        try {
            const OllamaEmbeddingFunction = require('./ollamaEmbeddingFunction');
            const testEmbedding = new OllamaEmbeddingFunction(baseUrl, modelName);

            console.log(`[RagIpcHandler] 测试Ollama连接: ${baseUrl}, model: ${modelName}`);

            const result = await testEmbedding.testConnection();

            console.log(`[RagIpcHandler] Ollama连接测试完成:`, result);
            return result;

        } catch (error) {
            console.error('[RagIpcHandler] 测试Ollama连接失败:', error);
            return {
                success: false,
                error: `测试Ollama连接失败: ${error.message}`
            };
        }
    }

    /**
     * 获取Ollama可用模型列表
     * @param {string} baseUrl Ollama服务器地址
     * @returns {Promise<Object>} 模型列表
     */
    async getOllamaModels(baseUrl) {
        try {
            const OllamaEmbeddingFunction = require('./ollamaEmbeddingFunction');
            const tempEmbedding = new OllamaEmbeddingFunction(baseUrl);

            console.log(`[RagIpcHandler] 获取Ollama模型列表: ${baseUrl}`);

            const models = await tempEmbedding.getAvailableModels();

            return {
                success: true,
                models: models
            };

        } catch (error) {
            console.error('[RagIpcHandler] 获取Ollama模型列表失败:', error);
            return {
                success: false,
                error: `获取Ollama模型列表失败: ${error.message}`
            };
        }
    }

    /**
     * 获取所有知识库集合列表
     * @returns {Promise<Object>} 集合列表结果
     */
    async listKbCollections() {
        try {
            console.log("[RagIpcHandler] 获取知识库集合列表...");

            // 使用CollectionManager的listCollections方法
            const collections = await this.collectionManager.listCollections();

            console.log(`[RagIpcHandler] 获取到 ${collections.length} 个集合`);

            return {
                success: true,
                collections: collections
            };

        } catch (error) {
            console.error("[RagIpcHandler] 获取集合列表失败:", error);
            return {
                success: false,
                error: `获取集合列表失败: ${error.message}`
            };
        }
    }
}

// 导出单例
module.exports = new RagIpcHandler();