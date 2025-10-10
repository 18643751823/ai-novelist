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
     * 获取所有RAG仓库列表
     * @returns {Promise<Object>} 仓库列表结果
     */
    async listRagRepositories() {
        try {
            console.log("[RagIpcHandler] 获取RAG仓库列表...");
            
            // 复用现有的知识库文件列表功能
            const tables = await this.tableManager.listTables();
            
            // 将文件列表转换为仓库格式
            const repositories = tables.map(table => ({
                id: table.tableName,
                name: table.filename,
                fileCount: table.documentCount || 0,
                embeddingModel: table.embeddingModel || 'default',
                createdAt: table.createdAt || new Date().toISOString()
            }));
             
            console.log(`[RagIpcHandler] 获取到 ${repositories.length} 个仓库`);
            
            return {
                success: true,
                repositories: repositories
            };
             
        } catch (error) {
            console.error("[RagIpcHandler] 获取仓库列表失败:", error);
            return {
                success: false,
                error: `获取仓库列表失败: ${error.message}`
            };
        }
    }

    /**
     * 创建新的RAG仓库
     * @param {Object} event IPC事件对象
     * @param {Object} config 仓库配置
     * @returns {Promise<Object>} 创建结果
     */
    async createRagRepository(event, config) {
        try {
            console.log("[RagIpcHandler] 创建RAG仓库:", config);
            
            // 目前复用现有的知识库系统，仓库实际上就是文件级别的集合
            // 这里可以添加更复杂的仓库管理逻辑
            return {
                success: true,
                message: `仓库 "${config.name}" 创建成功`,
                repository: {
                    id: config.name,
                    name: config.name,
                    fileCount: 0,
                    embeddingModel: config.embeddingModel,
                    createdAt: new Date().toISOString()
                }
            };
             
        } catch (error) {
            console.error("[RagIpcHandler] 创建仓库失败:", error);
            return {
                success: false,
                error: `创建仓库失败: ${error.message}`
            };
        }
    }
 
    /**
     * 删除RAG仓库
     * @param {Object} event IPC事件对象
     * @param {string} repoId 仓库ID
     * @returns {Promise<Object>} 删除结果
     */
    async deleteRagRepository(event, repoId) {
        try {
            console.log("[RagIpcHandler] 删除RAG仓库:", repoId);
            
            // 复用现有的知识库文件删除功能
            const result = await this.tableManager.deleteTable(repoId);
            
            if (result.success) {
                return {
                    success: true,
                    message: `仓库 "${repoId}" 删除成功`
                };
            } else {
                return {
                    success: false,
                    error: result.error || '删除仓库失败'
                };
            }
            
        } catch (error) {
            console.error("[RagIpcHandler] 删除仓库失败:", error);
            return {
                success: false,
                error: `删除仓库失败: ${error.message}`
            };
        }
    }

    /**
     * 获取仓库中的文件列表
     * @param {Object} event IPC事件对象
     * @param {string} repoId 仓库ID
     * @returns {Promise<Object>} 文件列表结果
     */
    async listRepoFiles(event, repoId) {
        try {
            console.log("[RagIpcHandler] 获取仓库文件列表:", repoId);
            
            // 目前仓库就是单个文件，所以返回该文件的信息
            const tables = await this.tableManager.listTables();
            const targetTable = tables.find(table => table.tableName === repoId);
            
            if (targetTable) {
                return {
                    success: true,
                    files: [{
                        id: targetTable.tableName,
                        filename: targetTable.filename,
                        documentCount: targetTable.documentCount || 0,
                        size: targetTable.size || '未知'
                    }]
                };
            } else {
                return {
                    success: true,
                    files: []
                };
            }
            
        } catch (error) {
            console.error("[RagIpcHandler] 获取仓库文件列表失败:", error);
            return {
                success: false,
                error: `获取文件列表失败: ${error.message}`
            };
        }
    }

    /**
     * 添加文件到仓库
     * @param {Object} event IPC事件对象
     * @param {string} repoId 仓库ID
     * @returns {Promise<Object>} 添加结果
     */
    async addFileToRagRepository(event, repoId) {
        try {
            console.log("[RagIpcHandler] 添加文件到仓库:", repoId);
            
            // 目前仓库就是单个文件，所以这个操作相当于选择文件添加到知识库
            // 这里可以调用现有的文件选择逻辑
            const { dialog } = require('electron');
            const { state } = require('../state-manager');
            
            const { canceled, filePaths } = await dialog.showOpenDialog(state.mainWindow, {
                properties: ['openFile'],
                filters: [
                    { name: 'Documents', extensions: ['txt', 'md', 'pdf', 'docx'] }
                ]
            });

            if (canceled || !filePaths || filePaths.length === 0) {
                return { success: false, message: '用户取消了文件选择。' };
            }

            const filePath = filePaths[0];
            
            // 使用现有的知识库管理器添加文件
            const knowledgeBaseManager = require('./knowledgeBaseManager');
            const result = await knowledgeBaseManager.addFileToKnowledgeBase(filePath);
            
            return result;
            
        } catch (error) {
            console.error("[RagIpcHandler] 添加文件到仓库失败:", error);
            return {
                success: false,
                error: `添加文件失败: ${error.message}`
            };
        }
    }

    /**
     * 从仓库删除文件
     * @param {Object} event IPC事件对象
     * @param {Object} params 参数对象 { repoId, filename }
     * @returns {Promise<Object>} 删除结果
     */
    async deleteFileFromRagRepository(event, { repoId, filename }) {
        try {
            console.log("[RagIpcHandler] 从仓库删除文件:", { repoId, filename });
            
            // 复用现有的知识库文件删除功能
            const result = await this.tableManager.deleteTable(filename);
            
            if (result.success) {
                return {
                    success: true,
                    message: `文件 "${filename}" 已从仓库删除`
                };
            } else {
                return {
                    success: false,
                    error: result.error || '删除文件失败'
                };
            }
            
        } catch (error) {
            console.error("[RagIpcHandler] 从仓库删除文件失败:", error);
            return {
                success: false,
                error: `删除文件失败: ${error.message}`
            };
        }
    }
}

// 导出单例
module.exports = new RagIpcHandler();