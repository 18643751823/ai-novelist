const TableManager = require('./TableManager');

/**
 * RAG服务的IPC处理器
 */
class RagIpcHandler {
    constructor() {
        this.tableManager = TableManager;
    }

    /**
     * 设置存储实例以便TableManager使用
     * @param {Object} store electron-store实例
     */
    setStore(store) {
        this.tableManager.setStore(store);
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
     * 重新初始化嵌入函数，用于嵌入模型或API Key更新后实时刷新
     * @returns {Promise<Object>} 重新初始化结果
     */
    async reinitializeEmbeddingFunction() {
        try {
            console.log("[RagIpcHandler] 重新初始化嵌入函数...");
            const result = this.tableManager.reinitializeEmbeddingFunction();
            
            if (result) {
                return {
                    success: true,
                    message: "嵌入函数已重新初始化，现在可以使用新的嵌入模型和API Key"
                };
            } else {
                return {
                    success: false,
                    error: "嵌入函数重新初始化失败"
                };
            }
        } catch (error) {
            console.error("[RagIpcHandler] 重新初始化嵌入函数失败:", error);
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
            const { embeddingModel, apiKeys } = this.tableManager.getEmbeddingSettingsFromStore();
            const isInitialized = !!this.tableManager.embeddingFunction;
            const hasApiKey = Object.values(apiKeys).some(key => key && key.trim());
            
            return {
                success: true,
                hasApiKey: hasApiKey,
                isInitialized: isInitialized,
                embeddingModel: embeddingModel,
                message: isInitialized ? `嵌入函数已初始化 (${embeddingModel})` : '嵌入函数未初始化'
            };
            
        } catch (error) {
            console.error('[RagIpcHandler] 获取嵌入状态失败:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 验证嵌入模型是否可用
     * @param {Object} event IPC事件对象
     * @param {string} modelId 要验证的模型ID
     * @param {Object} apiKeys API密钥对象
     * @returns {Promise<Object>} 验证结果
     */
    async validateEmbeddingModel(event, modelId, apiKeys = {}) {
        try {
            console.log(`[RagIpcHandler] 验证嵌入模型: ${modelId}`);
            
            // 创建临时嵌入函数进行验证
            const EmbeddingFunction = require('./embeddingFunction');
            const embeddingFunction = new EmbeddingFunction(modelId, apiKeys);
            
            const validationResult = await embeddingFunction.validate();
            
            if (validationResult.valid) {
                return {
                    success: true,
                    message: `模型 ${modelId} 验证成功，可用于嵌入功能`
                };
            } else {
                return {
                    success: false,
                    error: `模型 ${modelId} 验证失败: ${validationResult.error}`
                };
            }
        } catch (error) {
            console.error(`[RagIpcHandler] 验证嵌入模型失败:`, error);
            return {
                success: false,
                error: `验证失败: ${error.message}`
            };
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
     * 获取所有知识库集合列表
     * @returns {Promise<Object>} 集合列表结果
     */
    async listKbCollections() {
        try {
            console.log("[RagIpcHandler] 获取知识库集合列表...");
            
            // 使用TableManager的listTables方法
            const tables = await this.tableManager.listTables();
            
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