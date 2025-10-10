const knowledgeBaseManager = require('./knowledgeBaseManager');
const intentAnalyzer = require('./IntentAnalyzer');

class Retriever {
    constructor() {
        this.isInitialized = false;
        this.collection = null;
        this.useIntentAnalysis = true; // 是否启用意图分析
    }

    /**
     * 初始化，确保 KnowledgeBaseManager 已就绪
     * @param {Object} store electron-store实例
     */
    async initialize(store) {
        if (this.isInitialized) {
            return;
        }
        await knowledgeBaseManager.initialize(store);
        this.isInitialized = true;
        console.log("[Retriever] 初始化成功。");
    }

    /**
     * 设置是否启用意图分析
     * @param {boolean} enabled 是否启用
     */
    setIntentAnalysis(enabled) {
        this.useIntentAnalysis = enabled;
        console.log(`[Retriever] 意图分析${enabled ? '启用' : '禁用'}`);
    }

    /**
     * 分析用户细纲并生成优化的检索查询
     * @param {Array} messages 完整的对话消息数组
     * @returns {Promise<Object>} 包含优化查询和标签信息
     */
    async analyzeAndGenerateQuery(messages) {
        // 提取最后一条用户消息作为细纲内容
        const userMessages = messages.filter(msg => msg.role === 'user');
        const outline = userMessages.length > 0 ? userMessages[userMessages.length - 1].content : '';
        
        if (!outline || outline.trim().length === 0) {
            return {
                searchQuery: '小说描写',
                tags: null,
                isAnalyzed: false
            };
        }
        
        if (!this.useIntentAnalysis) {
            return {
                searchQuery: outline,
                tags: null,
                isAnalyzed: false
            };
        }

        try {
            const analysisResult = await intentAnalyzer.analyzeConversation(messages);
            
            if (analysisResult.success) {
                return {
                    searchQuery: analysisResult.searchQuery,
                    tags: analysisResult.tags,
                    isAnalyzed: true
                };
            } else {
                console.warn('[Retriever] 意图分析失败，使用原始查询');
                return {
                    searchQuery: outline,
                    tags: null,
                    isAnalyzed: false
                };
            }
        } catch (error) {
            console.error('[Retriever] 意图分析异常:', error);
            return {
                searchQuery: outline,
                tags: null,
                isAnalyzed: false
            };
        }
    }

    /**
     * 从知识库中检索与查询相关的文档片段
     * @param {Array} messages 完整的对话消息数组
     * @param {number} topK 返回的最相关结果数量
     * @param {boolean} enableAnalysis 是否启用意图分析
     * @param {string} mode 当前模式
     * @param {Array} tableNames 要查询的表名称数组（空数组表示查询所有表）
     * @returns {Promise<Array<string>>} 返回文档片段内容数组
     */
    async retrieve(messages, topK = 3, enableAnalysis = true, mode = 'general', tableNames = null) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        // 新增：获取上下文限制设置并应用RAG上下文限制
        let contextLimitSettings = null;
        let filteredMessages = messages;
        
        try {
            const handlers = require('../engine/ipc/handlers');
            const result = await handlers.handleGetContextLimitSettings();
            if (result.success) {
                contextLimitSettings = result.settings;
                
                // 应用RAG上下文限制（专门用于意图分析）
                filteredMessages = require('../engine/contextManager').truncateMessages(
                    messages,
                    contextLimitSettings,
                    mode,
                    true // 是RAG上下文
                );
                
                // 获取意图识别模型的上下文配置用于日志显示
                const ragContextConfig = require('../engine/contextManager').getContextConfig(contextLimitSettings, mode, true);
                console.log(`[Retriever] 意图识别模型上下文约束: ${ragContextConfig.type === 'tokens' && ragContextConfig.value === 'full' ? '满tokens' : ragContextConfig.value + '轮'}, 原始消息 ${messages.length} 条, 过滤后 ${filteredMessages.length} 条`);
            }
        } catch (error) {
            console.warn('[Retriever] 获取上下文限制设置时出错，使用全部消息:', error.message);
        }

        // 提取最后一条用户消息作为查询内容
        const userMessages = filteredMessages.filter(msg => msg.role === 'user');
        const query = userMessages.length > 0 ? userMessages[userMessages.length - 1].content : '';

        if (!query || query.trim() === '') {
            console.log("[Retriever] 查询为空，跳过检索。");
            return [];
        }

        try {
            let finalQuery = query;
            let tags = null;
            let isAnalyzed = false;

            // 如果启用意图分析，分析细纲生成优化查询
            if (enableAnalysis && this.useIntentAnalysis) {
                const analysisResult = await this.analyzeAndGenerateQuery(filteredMessages);
                finalQuery = analysisResult.searchQuery;
                tags = analysisResult.tags;
                isAnalyzed = analysisResult.isAnalyzed;
                
                if (isAnalyzed) {
                    console.log(`[Retriever] 意图分析完成 - 优化查询: "${finalQuery}"`);
                }
            }

            console.log(`[Retriever] 正在执行查询: "${finalQuery}"`);
            
            // 使用 knowledgeBaseManager 的查询方法，支持指定表
            // 如果 tableNames 为 null 或 undefined，表示用户明确不选择任何表，跳过检索
            // 如果 tableNames 为空数组，表示用户选择查询所有表
            let results;
            if (tableNames === null || tableNames === undefined) {
                console.log(`[Retriever] 用户未选择任何表，跳过RAG检索`);
                results = { documents: [] };
            } else {
                results = await knowledgeBaseManager.queryCollection(finalQuery, topK, tableNames);
            }

            if (results && results.documents && results.documents.length > 0) {
                console.log(`[Retriever] 检索到 ${results.documents.length} 个相关片段。`);
                
                // 返回增强的结果对象，包含标签信息
                return {
                    documents: results.documents,
                    tags: tags,
                    originalQuery: query,
                    optimizedQuery: finalQuery,
                    isAnalyzed: isAnalyzed
                };
            } else {
                console.log("[Retriever] 未检索到相关内容。");
                return {
                    documents: [],
                    tags: tags,
                    originalQuery: query,
                    optimizedQuery: finalQuery,
                    isAnalyzed: isAnalyzed
                };
            }

        } catch (error) {
            console.error("[Retriever] 检索失败:", error);
            return {
                documents: [],
                tags: null,
                originalQuery: query,
                optimizedQuery: query,
                isAnalyzed: false,
                error: error.message
            };
        }
    }

    /**
     * 简单的直接检索（向后兼容）
     * @param {string} query 用户查询
     * @param {number} topK 返回结果数量
     * @returns {Promise<Array<string>>} 文档片段数组
     */
    async simpleRetrieve(query, topK = 3) {
        const result = await this.retrieve(query, topK, false);
        return result.documents;
    }
}

module.exports = new Retriever();