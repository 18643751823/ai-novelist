const TableManager = require('./TableManager');

/**
 * RAG服务的IPC处理器
 */
class RagIpcHandler {
    constructor() {
        this.tableManager = TableManager;
    }

    /**
     * 设置存储实例以便TableManager和KnowledgeBaseManager使用
     * @param {Object} store electron-store实例
     */
    setStore(store) {
        this.tableManager.setStore(store);
        // 同时设置KnowledgeBaseManager的store实例，确保SemanticTextSplitter能获取最新配置
        const KnowledgeBaseManager = require('./knowledgeBaseManager');
        KnowledgeBaseManager.setStore(store);
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
            const result = await this.tableManager.reinitializeEmbeddingFunction();
            
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
            const { embeddingModel, apiKeys, embeddingDimensions } = this.tableManager.getEmbeddingSettingsFromStore();
            const isInitialized = !!this.tableManager.embeddingFunction;
            const hasApiKey = Object.values(apiKeys).some(key => key && key.trim());
            const currentDimensions = this.tableManager.getEmbeddingDimensions();
            
            return {
                success: true,
                hasApiKey: hasApiKey,
                isInitialized: isInitialized,
                embeddingModel: embeddingModel,
                embeddingDimensions: currentDimensions,
                message: isInitialized ? `嵌入函数已初始化 (${embeddingModel}, 维度: ${currentDimensions})` : '嵌入函数未初始化'
            };
            
        } catch (error) {
            console.error('[RagIpcHandler] 获取嵌入状态失败:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 设置嵌入维度
     * @param {Object} event IPC事件对象
     * @param {number} dimensions 嵌入维度
     * @returns {Promise<Object>} 设置结果
     */
    async setEmbeddingDimensions(event, dimensions) {
        try {
            console.log(`[RagIpcHandler] 设置嵌入维度: ${dimensions}`);
            
            if (!dimensions || dimensions <= 0) {
                return { success: false, error: '嵌入维度必须为正整数' };
            }
            
            const success = await this.tableManager.setEmbeddingDimensions(dimensions);
            
            if (success) {
                return {
                    success: true,
                    message: `嵌入维度已设置为: ${dimensions}`
                };
            } else {
                return {
                    success: false,
                    error: '设置嵌入维度失败，嵌入函数未初始化'
                };
            }
        } catch (error) {
            console.error('[RagIpcHandler] 设置嵌入维度失败:', error);
            return {
                success: false,
                error: `设置嵌入维度失败: ${error.message}`
            };
        }
    }

    /**
     * 获取当前嵌入维度
     * @returns {Promise<Object>} 维度信息
     */
    async getEmbeddingDimensions() {
        try {
            const dimensions = this.tableManager.getEmbeddingDimensions();
            return {
                success: true,
                dimensions: dimensions
            };
        } catch (error) {
            console.error('[RagIpcHandler] 获取嵌入维度失败:', error);
            return {
                success: false,
                error: `获取嵌入维度失败: ${error.message}`
            };
        }
    }

    /**
     * 设置RAG分段参数
     * @param {Object} event IPC事件对象
     * @param {number} chunkSize 分段大小
     * @param {number} chunkOverlap 重叠大小
     * @returns {Promise<Object>} 设置结果
     */
    async setRagChunkSettings(event, chunkSize, chunkOverlap) {
        try {
            console.log(`[RagIpcHandler] 设置RAG分段参数: chunkSize=${chunkSize}, chunkOverlap=${chunkOverlap}`);
            
            if (!chunkSize || chunkSize <= 0) {
                return { success: false, error: '分段大小必须为正整数' };
            }
            
            if (!chunkOverlap || chunkOverlap < 0) {
                return { success: false, error: '重叠大小必须为非负整数' };
            }
            
            if (chunkOverlap >= chunkSize) {
                return { success: false, error: '重叠大小必须小于分段大小' };
            }

            // 保存到store
            this.tableManager.storeInstance.set('ragChunkSize', chunkSize);
            this.tableManager.storeInstance.set('ragChunkOverlap', chunkOverlap);
            
            // 重新加载KnowledgeBaseManager中的SemanticTextSplitter参数
            const KnowledgeBaseManager = require('./knowledgeBaseManager');
            if (KnowledgeBaseManager.textSplitter && KnowledgeBaseManager.textSplitter.reloadSettings) {
                KnowledgeBaseManager.textSplitter.reloadSettings();
                console.log(`[RagIpcHandler] SemanticTextSplitter参数已重新加载`);
            }
            
            return {
                success: true,
                message: `RAG分段参数已设置为: chunkSize=${chunkSize}, chunkOverlap=${chunkOverlap}`
            };
            
        } catch (error) {
            console.error('[RagIpcHandler] 设置RAG分段参数失败:', error);
            return {
                success: false,
                error: `设置RAG分段参数失败: ${error.message}`
            };
        }
    }

    /**
     * 获取RAG分段参数
     * @returns {Promise<Object>} 分段参数信息
     */
    async getRagChunkSettings() {
        try {
            const chunkSize = this.tableManager.storeInstance.get('ragChunkSize') || 400;
            const chunkOverlap = this.tableManager.storeInstance.get('ragChunkOverlap') || 50;
            
            return {
                success: true,
                chunkSize: chunkSize,
                chunkOverlap: chunkOverlap
            };
        } catch (error) {
            console.error('[RagIpcHandler] 获取RAG分段参数失败:', error);
            return {
                success: false,
                error: `获取RAG分段参数失败: ${error.message}`
            };
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
     * 获取嵌入模型的维度
     * @param {Object} event - IPC事件对象
     * @param {string} modelId - 模型ID
     * @returns {Promise<Object>} 维度获取结果
     */
    async getEmbeddingDimensions(event, modelId) {
        try {
            console.log(`[RagIpcHandler] 获取模型 ${modelId} 的嵌入维度...`);
            
            if (!modelId) {
                return {
                    success: false,
                    error: '模型ID不能为空'
                };
            }

            // 获取模型注册服务
            const { getModelRegistry } = require('../engine/models/modelProvider');
            const modelRegistry = getModelRegistry();
            
            // 获取模型信息以确定提供商
            const models = await modelRegistry.listAllModels();
            const model = models.find(m => m.id === modelId);
            
            if (!model) {
                return {
                    success: false,
                    error: `未找到模型: ${modelId}`
                };
            }

            // 获取对应的适配器
            const adapter = modelRegistry.getAdapter(model.provider);
            if (!adapter) {
                return {
                    success: false,
                    error: `未找到模型提供商适配器: ${model.provider}`
                };
            }

            // 检查是否为嵌入模型
            if (!adapter.isEmbeddingModel(modelId)) {
                return {
                    success: false,
                    error: `模型 ${modelId} 不是嵌入模型`
                };
            }

            // 获取嵌入维度
            const dimensions = await adapter.getEmbeddingDimensions(modelId);
            
            console.log(`[RagIpcHandler] 模型 ${modelId} 的嵌入维度: ${dimensions}`);
            
            return {
                success: true,
                dimensions: dimensions,
                message: `成功获取嵌入维度: ${dimensions}`
            };
            
        } catch (error) {
            console.error(`[RagIpcHandler] 获取嵌入维度失败:`, error);
            return {
                success: false,
                error: `获取嵌入维度失败: ${error.message}`
            };
        }
    }

    /**
     * 设置检索返回文档片段数
     * @param {Object} event IPC事件对象
     * @param {number} topK 返回文档片段数
     * @returns {Promise<Object>} 设置结果
     */
    async setRetrievalTopK(event, topK) {
      try {
        console.log(`[RagIpcHandler] 设置检索返回文档片段数: ${topK}`);
        
        if (!topK || topK <= 0 || topK > 20) {
          return {
            success: false,
            error: '返回文档片段数必须是1-20之间的整数'
          };
        }

        // 保存到store
        this.tableManager.storeInstance.set('retrievalTopK', topK);
        
        return {
          success: true,
          message: `已设置返回 ${topK} 个文档片段`
        };
        
      } catch (error) {
        console.error('[RagIpcHandler] 设置检索返回文档片段数失败:', error);
        return {
          success: false,
          error: `设置失败: ${error.message}`
        };
      }
    }

    /**
     * 获取当前检索返回文档片段数
     * @returns {Promise<Object>} 检索设置信息
     */
    async getRetrievalTopK() {
      try {
        const topK = this.tableManager.storeInstance.get('retrievalTopK') || 3;
        
        return {
          success: true,
          topK: topK
        };
        
      } catch (error) {
        console.error('[RagIpcHandler] 获取检索返回文档片段数失败:', error);
        return {
          success: false,
          error: `获取失败: ${error.message}`
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
        
        // 使用TableManager的listTables方法
        const tables = await this.tableManager.listTables();
        
        console.log(`[RagIpcHandler] 获取到 ${tables.length} 个集合`);
        
        return {
          success: true,
          collections: tables
        };
        
      } catch (error) {
        console.error("[RagIpcHandler] 获取集合列表失败:", error);
        return {
          success: false,
          error: `获取集合列表失败: ${error.message}`
        };
      }
    }

    /**
     * 重新初始化阿里云嵌入函数（兼容性方法）
     * @returns {Promise<Object>} 重新初始化结果
     */
    async reinitializeAliyunEmbedding() {
        console.log("[RagIpcHandler] 重新初始化阿里云嵌入函数...");
        // 调用通用的重新初始化方法
        return await this.reinitializeEmbeddingFunction();
    }
}

// 导出单例
module.exports = new RagIpcHandler();