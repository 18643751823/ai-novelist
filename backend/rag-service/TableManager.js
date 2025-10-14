const lancedb = require('@lancedb/lancedb');
const path = require('path');
const fs = require('fs').promises;
const EmbeddingFunction = require('./embeddingFunction');

/**
 * LanceDB 表管理器类，负责管理多个LanceDB表
 * 每个文件对应一个独立的表，支持多表查询和管理
 */
class TableManager {
    constructor() {
        if (TableManager.instance) {
            return TableManager.instance;
        }

        this.db = null;
        this.dbPath = './db/lance_db'; // 默认数据库路径
        this.tables = new Map(); // 表注册表：tableName -> table
        this.tableMetadata = new Map(); // 表元数据：tableName -> metadata
        this.isInitialized = false;
        
        // 初始化阿里云嵌入函数（先使用空值，后续通过setEmbeddingApiKey设置）
        this.embeddingFunction = null;
        this.storeInstance = null; // 用于存储 electron-store 实例

        TableManager.instance = this;
    }

    /**
     * 设置阿里云API Key（仅用于向后兼容，实际已改为启动时初始化）
     * @param {string} apiKey 阿里云API Key
     */
    setEmbeddingApiKey(apiKey) {
        console.warn("[TableManager] setEmbeddingApiKey已弃用，API Key应在启动时通过store设置");
        // 不再进行动态重新初始化，改为类似DeepSeek的启动时一次性初始化模式
    }

    /**
     * 重新初始化嵌入函数，用于API Key更新后刷新嵌入功能
     * @returns {Promise<boolean>} 重新初始化是否成功
     */
    async reinitializeEmbeddingFunction() {
        try {
            console.log("[TableManager] 重新初始化嵌入函数...");
            await this.initializeEmbeddingFunction();
            
            // 重新加载所有现有表以使用新的嵌入函数
            await this.reloadTablesWithNewEmbeddingFunction();
            
            console.log("[TableManager] 嵌入函数重新初始化成功");
            return true;
        } catch (error) {
            console.error("[TableManager] 嵌入函数重新初始化失败:", error);
            return false;
        }
    }
    /**
     * 重新加载所有现有表以使用新的嵌入函数
     */
    async reloadTablesWithNewEmbeddingFunction() {
        if (this.tables.size === 0) {
            return;
        }

        console.log(`[TableManager] 重新加载 ${this.tables.size} 个表以使用新的嵌入函数`);
        
        for (const [tableName, table] of this.tables) {
            try {
                // 重新获取表以使用新的嵌入函数
                const newTable = await this.db.openTable(tableName);
                
                // 更新表引用
                this.tables.set(tableName, newTable);
                console.log(`[TableManager] 表 ${tableName} 已重新加载`);
            } catch (error) {
                console.warn(`[TableManager] 重新加载表 ${tableName} 失败:`, error);
            }
        }
    }

    /**
     * 初始化嵌入函数（启动时一次性初始化）
     */
    async initializeEmbeddingFunction() {
        try {
            const { embeddingModel, apiKeys, embeddingDimensions } = this.getEmbeddingSettingsFromStore();
            
            if (!embeddingModel) {
                console.warn("[TableManager] 嵌入模型未设置，嵌入功能将不可用");
                this.embeddingFunction = null;
                return;
            }

            // 优先使用从模型获取的实际维度，如果无法获取则使用store中的值
            let dimensions = embeddingDimensions;
            
            // 如果store中没有维度设置或使用默认值，尝试从模型获取实际维度
            if (!dimensions || dimensions === 1024) {
                try {
                    const { getModelRegistry } = require('../engine/models/modelProvider');
                    const modelRegistry = getModelRegistry();
                    const adapter = modelRegistry.getAdapterForModel(embeddingModel);
                    if (adapter && adapter.getEmbeddingDimensions) {
                        const modelDimensions = await adapter.getEmbeddingDimensions(embeddingModel);
                        if (modelDimensions && modelDimensions > 0) {
                            dimensions = modelDimensions;
                            console.log(`[TableManager] 使用模型实际维度: ${dimensions}`);
                        }
                    }
                } catch (error) {
                    console.warn(`[TableManager] 无法获取模型 ${embeddingModel} 的维度，使用store值: ${dimensions}`, error);
                }
            }

            this.embeddingFunction = new EmbeddingFunction(embeddingModel, apiKeys, dimensions);
            console.log(`[TableManager] 嵌入函数初始化成功，使用模型: ${embeddingModel}, 维度: ${dimensions}`);
        } catch (error) {
            console.error("[TableManager] 嵌入函数初始化失败:", error);
            this.embeddingFunction = null;
        }
    }
    /**
     * 从store获取嵌入设置
     * @returns {Object} 包含embeddingModel和apiKeys的对象
     */
    getEmbeddingSettingsFromStore() {
        if (!this.storeInstance) {
            console.warn("[TableManager] store实例未设置，无法获取嵌入设置");
            return { embeddingModel: '', apiKeys: {}, embeddingDimensions: 1024 };
        }
        
        const embeddingModel = this.storeInstance.get('embeddingModel') || '';
        const embeddingDimensions = this.storeInstance.get('embeddingDimensions') || 1024;
        const apiKeys = {
            aliyun: this.storeInstance.get('aliyunApiKey') || '',
            aliyunEmbedding: this.storeInstance.get('aliyunEmbeddingApiKey') || '',
            openai: this.storeInstance.get('openaiApiKey') || '',
            openrouter: this.storeInstance.get('openrouterApiKey') || '',
            deepseek: this.storeInstance.get('deepseekApiKey') || '',
            siliconflow: this.storeInstance.get('siliconflowApiKey') || ''
        };
        
        return { embeddingModel, apiKeys, embeddingDimensions };
    }

    /**
     * 保存表元数据到持久化存储
     */
    saveTableMetadataToStore() {
        if (!this.storeInstance) {
            console.warn("[TableManager] store实例未设置，无法保存表元数据");
            return;
        }
        
        const metadataToSave = {};
        for (const [tableName, metadata] of this.tableMetadata) {
            metadataToSave[tableName] = metadata;
        }
        
        this.storeInstance.set('tableMetadata', metadataToSave);
        console.log("[TableManager] 表元数据已保存到持久化存储");
    }

    /**
     * 从持久化存储加载表元数据
     */
    loadTableMetadataFromStore() {
        if (!this.storeInstance) {
            console.warn("[TableManager] store实例未设置，无法加载表元数据");
            return;
        }
        
        const savedMetadata = this.storeInstance.get('tableMetadata') || {};
        for (const [tableName, metadata] of Object.entries(savedMetadata)) {
            this.tableMetadata.set(tableName, metadata);
        }
        
        console.log("[TableManager] 表元数据已从持久化存储加载");
    }

    /**
     * 设置存储实例以便后续使用
     * @param {Object} store electron-store实例
     */
    setStore(store) {
        this.storeInstance = store;
        
        // 设置store实例，不再自动重新初始化嵌入函数
        console.log("[TableManager] store实例已设置");
    }

    async initialize() {
        if (this.isInitialized) {
            return;
        }

        try {
            console.log("[TableManager] 开始初始化...");
            
            // 初始化嵌入函数（会自动从store读取最新API Key）
            await this.initializeEmbeddingFunction();
            
            // 首先从持久化存储加载表元数据
            this.loadTableMetadataFromStore();
            
            // 初始化LanceDB连接
            this.db = await lancedb.connect(this.dbPath);
            
            // 获取所有现有表并加载到注册表
            const tableNames = await this.db.tableNames();
            for (const tableName of tableNames) {
                try {
                    const table = await this.db.openTable(tableName);
                    
                    this.tables.set(tableName, table);
                    
                    // 如果持久化存储中有这个表的元数据，使用保存的数据
                    if (this.tableMetadata.has(tableName)) {
                        const savedMetadata = this.tableMetadata.get(tableName);
                        // 只更新文档数量，保持其他元数据不变
                        const count = await table.countRows();
                        savedMetadata.documentCount = count;
                    } else {
                        // 如果没有保存的元数据，创建新的元数据条目
                        this.tableMetadata.set(tableName, {
                            filename: this.extractFilenameFromTableName(tableName),
                            originalFilename: this.extractFilenameFromTableName(tableName),
                            createdAt: new Date().toISOString(),
                            documentCount: 0,
                            embeddingDimensions: this.embeddingFunction.getDimensions() // 保存嵌入函数实际使用的维度
                        });
                        
                        // 获取表中的文档数量
                        const count = await table.countRows();
                        this.tableMetadata.get(tableName).documentCount = count;
                    }
                    
                } catch (error) {
                    console.warn(`[TableManager] 加载表 ${tableName} 失败:`, error);
                }
            }

            // 保存更新后的元数据到持久化存储
            this.saveTableMetadataToStore();
            
            this.isInitialized = true;
            console.log("[TableManager] 初始化成功，已加载", this.tables.size, "个表");
        } catch (error) {
            console.error("[TableManager] 初始化失败:", error);
            throw new Error("TableManager 初始化失败");
        }
    }

    /**
     * 规范化表名称（移除特殊字符，确保LanceDB兼容性）
     * @param {string} filename 文件名
     * @returns {string} 规范化后的表名称
     */
    normalizeTableName(filename) {
        // 移除文件扩展名和特殊字符，只保留字母数字、连字符和下划线
        const baseName = path.basename(filename, path.extname(filename));
        
        // 只允许字母数字、连字符和下划线，并且确保以字母开头
        let normalizedName = baseName
            .replace(/[^a-zA-Z0-9_-]/g, '_')  // 只保留字母数字、连字符、下划线
            .replace(/^[^a-zA-Z]+/, '')       // 确保以字母开头
            .replace(/[^a-zA-Z0-9]+$/, '');   // 确保以字母或数字结尾
        
        // 如果名称为空或太短，使用基于时间戳的fallback名称
        if (!normalizedName || normalizedName.length < 3) {
            normalizedName = `file_${Date.now()}`;
        }
        
        // 确保名称长度在3-50个字符之间
        if (normalizedName.length > 50) {
            normalizedName = normalizedName.substring(0, 50);
        }
        
        return `kb-${normalizedName.toLowerCase()}`;
    }

    /**
     * 从表名称中提取原始文件名
     * @param {string} tableName 表名称
     * @returns {string} 原始文件名
     */
    extractFilenameFromTableName(tableName) {
        // 首先尝试从元数据中获取保存的原始文件名
        if (this.tableMetadata.has(tableName)) {
            const metadata = this.tableMetadata.get(tableName);
            if (metadata && metadata.originalFilename) {
                return metadata.originalFilename;
            }
        }
        
        // 如果没有保存原始文件名，使用向后兼容的恢复逻辑
        // 移除前缀并恢复文件名
        return tableName.replace(/^kb-/, '').replace(/_/g, ' ') + '.txt';
    }

    /**
     * 根据文件名获取或创建表
     * @param {string} filename 文件名
     * @returns {Promise<Object>} LanceDB表对象
     */
    async getOrCreateTable(filename) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        // 检查嵌入函数是否可用
        if (!this.embeddingFunction) {
            throw new Error('嵌入函数未初始化，请先设置嵌入模型和相应的API Key');
        }

        // 检查嵌入函数是否支持当前模型
        if (this.embeddingFunction && !this.embeddingFunction.isEmbeddingModel()) {
            throw new Error(`模型 ${this.embeddingFunction.modelId} 不是嵌入模型，无法生成嵌入向量`);
        }

        const tableName = this.normalizeTableName(filename);
        
        // 如果表已存在，确保文档数量是最新的
        if (this.tables.has(tableName)) {
            const table = this.tables.get(tableName);
            // 更新文档数量到最新状态
            try {
                const count = await table.countRows();
                if (this.tableMetadata.has(tableName)) {
                    this.tableMetadata.get(tableName).documentCount = count;
                }
            } catch (error) {
                console.warn(`[TableManager] 更新表 ${tableName} 文档数量失败:`, error);
            }
            return table;
        }

        try {
            console.log(`[TableManager] 创建新表: ${tableName}`);
            
            // 创建新表 - 使用嵌入函数的实际维度
            const dimensions = this.embeddingFunction.getDimensions();
            const table = await this.db.createTable(tableName, [
                { id: "dummy", vector: Array(dimensions).fill(0), text: "", metadata: "{}" }
            ]);
            
            // 注册表和元数据
            this.tables.set(tableName, table);
            this.tableMetadata.set(tableName, {
                filename: path.basename(filename),
                originalFilename: path.basename(filename), // 保存原始文件名
                createdAt: new Date().toISOString(),
                documentCount: 0,
                embeddingDimensions: this.embeddingFunction.getDimensions() // 保存嵌入函数实际使用的维度
            });
            
            // 保存元数据到持久化存储
            this.saveTableMetadataToStore();
            
            console.log(`[TableManager] 表 ${tableName} 创建成功`);
            return table;
            
        } catch (error) {
            // 如果表已存在（并发创建），尝试获取现有表
            if (error.message.includes('already exists') || error.message.includes('409')) {
                console.log(`[TableManager] 表已存在，获取现有表: ${tableName}`);
                const table = await this.db.openTable(tableName);
                
                this.tables.set(tableName, table);
                
                // 获取文档数量
                const count = await table.countRows();
                this.tableMetadata.set(tableName, {
                    filename: path.basename(filename),
                    originalFilename: path.basename(filename), // 保存原始文件名
                    createdAt: new Date().toISOString(),
                    documentCount: count,
                    embeddingDimensions: this.embeddingFunction.getDimensions() // 保存嵌入函数实际使用的维度
                });
                
                // 保存元数据到持久化存储
                this.saveTableMetadataToStore();
                
                return table;
            }
            
            throw error;
        }
    }

    /**
     * 获取所有表的元数据列表
     * 每次调用都会从LanceDB获取最新的文档数量，确保数据准确性
     * @returns {Array} 表元数据数组
     */
    async listTables() {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const tables = [];
        
        // 获取所有现有表
        const tableNames = await this.db.tableNames();
        
        for (const tableName of tableNames) {
            try {
                // 获取表对象
                const table = await this.db.openTable(tableName);
                
                // 获取最新的文档数量
                const count = await table.countRows();
                
                // 更新内存中的元数据
                if (this.tableMetadata.has(tableName)) {
                    this.tableMetadata.get(tableName).documentCount = count;
                } else {
                    // 如果表不在内存中，创建新的元数据条目
                    this.tableMetadata.set(tableName, {
                        filename: this.extractFilenameFromTableName(tableName),
                        createdAt: new Date().toISOString(),
                        documentCount: count,
                        embeddingDimensions: this.embeddingFunction.getDimensions() // 保存嵌入函数实际使用的维度
                    });
                }
                
                // 确保表在内存中
                if (!this.tables.has(tableName)) {
                    this.tables.set(tableName, table);
                }
                
                // 添加到返回结果
                const metadata = this.tableMetadata.get(tableName);
                tables.push({
                    tableName: tableName,
                    filename: metadata.filename,
                    createdAt: metadata.createdAt,
                    documentCount: metadata.documentCount,
                    embeddingDimensions: metadata.embeddingDimensions || this.embeddingFunction.getDimensions() // 返回嵌入函数实际使用的维度
                });
                
            } catch (error) {
                console.warn(`[TableManager] 获取表 ${tableName} 信息失败:`, error);
                // 如果获取失败，使用内存中的缓存数据
                if (this.tableMetadata.has(tableName)) {
                    const metadata = this.tableMetadata.get(tableName);
                    tables.push({
                        tableName: tableName,
                        filename: metadata.filename,
                        createdAt: metadata.createdAt,
                        documentCount: metadata.documentCount,
                        embeddingDimensions: metadata.embeddingDimensions || this.embeddingFunction.getDimensions() // 返回嵌入函数实际使用的维度
                    });
                }
            }
        }

        return tables;
    }

    /**
     * 根据文件名删除表
     * @param {string} filename 文件名
     * @returns {Promise<Object>} 删除结果
     */
    async deleteTable(filename) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const expectedTableName = this.normalizeTableName(filename);
        
        // 首先检查标准化的表名称
        if (this.tables.has(expectedTableName)) {
            try {
                console.log(`[TableManager] 删除表: ${expectedTableName}`);
                
                // 从LanceDB删除表
                await this.db.dropTable(expectedTableName);
                
                // 从注册表中移除
                this.tables.delete(expectedTableName);
                this.tableMetadata.delete(expectedTableName);
                
                // 保存更新后的元数据到持久化存储
                this.saveTableMetadataToStore();
                
                console.log(`[TableManager] 表 ${expectedTableName} 删除成功`);
                return { success: true, message: `表 ${expectedTableName} 已删除` };
                
            } catch (error) {
                console.error(`[TableManager] 删除表失败: ${expectedTableName}`, error);
                return { success: false, error: `删除表失败: ${error.message}` };
            }
        }
        
        // 如果没有找到标准化的表名称，尝试查找匹配的表
        const baseFilename = path.basename(filename, path.extname(filename));
        for (const [tableName, metadata] of this.tableMetadata) {
            if (metadata.filename === path.basename(filename)) {
                try {
                    console.log(`[TableManager] 删除表: ${tableName}`);
                    
                    // 从LanceDB删除表
                    await this.db.dropTable(tableName);
                    
                    // 从注册表中移除
                    this.tables.delete(tableName);
                    this.tableMetadata.delete(tableName);
                    
                    // 保存更新后的元数据到持久化存储
                    this.saveTableMetadataToStore();
                    
                    console.log(`[TableManager] 表 ${tableName} 删除成功`);
                    return { success: true, message: `表 ${tableName} 已删除` };
                    
                } catch (error) {
                    console.error(`[TableManager] 删除表失败: ${tableName}`, error);
                    return { success: false, error: `删除表失败: ${error.message}` };
                }
            }
        }
        
        return { success: false, error: `表不存在: ${expectedTableName}` };
    }

    /**
     * 重命名表（实际上是修改表的显示名称）
     * @param {string} oldFilename 原文件名
     * @param {string} newFilename 新文件名
     * @returns {Promise<Object>} 重命名结果
     */
    async renameTable(oldFilename, newFilename) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        // 首先尝试使用标准化的表名称查找
        const expectedTableName = this.normalizeTableName(oldFilename);
        
        // 检查标准化的表名称是否存在
        if (this.tables.has(expectedTableName)) {
            try {
                console.log(`[TableManager] 重命名表: ${expectedTableName} -> ${newFilename}`);
                
                // 获取表元数据
                const metadata = this.tableMetadata.get(expectedTableName);
                if (!metadata) {
                    return { success: false, error: `表元数据不存在: ${expectedTableName}` };
                }

                // 更新文件名和原始文件名
                metadata.filename = path.basename(newFilename);
                metadata.originalFilename = path.basename(newFilename);
                
                // 保存更新后的元数据到持久化存储
                this.saveTableMetadataToStore();
                
                console.log(`[TableManager] 表 ${expectedTableName} 重命名成功`);
                return {
                    success: true,
                    message: `表重命名成功`,
                    tableName: expectedTableName, // 表名称不变，只修改显示名称
                    newFilename: path.basename(newFilename)
                };
                
            } catch (error) {
                console.error(`[TableManager] 重命名表失败: ${expectedTableName}`, error);
                return { success: false, error: `重命名表失败: ${error.message}` };
            }
        }
        
        // 如果没有找到标准化的表名称，尝试查找匹配的文件名
        const baseOldFilename = path.basename(oldFilename);
        for (const [tableName, metadata] of this.tableMetadata) {
            if (metadata.filename === baseOldFilename) {
                try {
                    console.log(`[TableManager] 重命名表: ${tableName} -> ${newFilename}`);
                    
                    // 更新文件名和原始文件名
                    metadata.filename = path.basename(newFilename);
                    metadata.originalFilename = path.basename(newFilename);
                    
                    // 保存更新后的元数据到持久化存储
                    this.saveTableMetadataToStore();
                    
                    console.log(`[TableManager] 表 ${tableName} 重命名成功`);
                    return {
                        success: true,
                        message: `表重命名成功`,
                        tableName: tableName,
                        newFilename: path.basename(newFilename)
                    };
                    
                } catch (error) {
                    console.error(`[TableManager] 重命名表失败: ${tableName}`, error);
                    return { success: false, error: `重命名表失败: ${error.message}` };
                }
            }
        }
        
        return { success: false, error: `表不存在: ${expectedTableName}` };
    }

    /**
     * 多表查询 - 支持单个表、多个表或全部表查询
     * @param {string} queryText 查询文本
     * @param {Array} tableNames 要查询的表名称数组（空数组表示查询所有表）
     * @param {number} nResults 每个表返回的结果数量
     * @returns {Promise<Array>} 查询结果数组
     */
    async queryMultipleTables(queryText, tableNames = [], nResults = 3) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        // 检查嵌入函数是否可用
        if (!this.embeddingFunction) {
            console.warn('[TableManager] 嵌入函数未初始化，无法执行查询');
            return [];
        }

        if (!queryText || typeof queryText !== 'string' || queryText.trim() === '') {
            return [];
        }

        // 确定要查询的目标表
        let targetTables = [];
        if (tableNames.length === 0) {
            // 查询所有表
            targetTables = Array.from(this.tables.values());
        } else {
            // 查询指定表
            targetTables = tableNames
                .filter(name => this.tables.has(name))
                .map(name => this.tables.get(name));
        }

        if (targetTables.length === 0) {
            return [];
        }

        try {
            console.log(`[TableManager] 在多表中查询: "${queryText}"`);
            console.log(`[TableManager] 目标表数量: ${targetTables.length}, 期望总结果数: ${nResults}`);
            
            // 生成查询文本的嵌入向量
            const queryEmbedding = await this.embeddingFunction.generate([queryText]);
            const queryVector = queryEmbedding[0];
            
            // 并行查询所有目标表
            // 计算每个表应该返回的结果数量，确保总结果数不超过 nResults
            const resultsPerTable = Math.max(1, Math.ceil(nResults / targetTables.length));
            console.log(`[TableManager] 每个表返回结果数: ${resultsPerTable}`);
            
            const queries = targetTables.map(table => {
                // 使用LanceDB的向量搜索
                return table.search(queryVector)
                    .limit(resultsPerTable)
                    .toArray()
                    .catch(error => {
                        console.warn(`[TableManager] 表查询失败:`, error);
                        return [];
                    });
            });

            const results = await Promise.all(queries);
            
            // 合并和排序结果
            const mergedResults = this.mergeTableQueryResults(results);
            
            // 确保返回的结果数量不超过 nResults
            const finalResults = mergedResults.slice(0, nResults);
            console.log(`[TableManager] 查询完成，共找到 ${mergedResults.length} 个相关片段，返回 ${finalResults.length} 个片段`);
            
            return finalResults;
            
        } catch (error) {
            console.error("[TableManager] 多表查询失败:", error);
            return [];
        }
    }

    /**
     * 合并多个表的查询结果并按相关性排序
     * @param {Array} results 多个表的查询结果数组
     * @returns {Array} 合并和排序后的结果
     */
    mergeTableQueryResults(results) {
        const allResults = [];
        
        // 收集所有结果
        for (const tableResults of results) {
            if (tableResults && tableResults.length > 0) {
                for (const item of tableResults) {
                    allResults.push({
                        content: item.text || item.content,
                        distance: item._distance || 0,
                        metadata: item.metadata || {}
                    });
                }
            }
        }
        
        // 按距离排序（距离越小越相关）
        allResults.sort((a, b) => a.distance - b.distance);
        
        // 转换为前端需要的格式
        return allResults.map(item => item.content);
    }

    /**
     * 向指定表添加文档
     * @param {string} filename 文件名
     * @param {Array} documents 文档数组
     * @param {Array} metadatas 元数据数组
     * @param {Array} ids ID数组
     * @returns {Promise<Object>} 添加结果
     */
    async addDocumentsToTable(filename, documents, metadatas, ids) {
        // 检查嵌入函数是否可用
        if (!this.embeddingFunction) {
            throw new Error('嵌入函数未初始化，无法添加文档');
        }

        const table = await this.getOrCreateTable(filename);
        
        try {
            // 生成嵌入向量
            const dimensions = this.embeddingFunction.getDimensions();
            console.log(`[TableManager] 开始生成嵌入向量，维度: ${dimensions}, 文档数量: ${documents.length}`);
            const embeddings = await this.embeddingFunction.generate(documents);
            
            // 准备要插入的数据
            const dataToInsert = documents.map((doc, index) => ({
                id: ids[index],
                vector: embeddings[index],
                text: doc,
                metadata: JSON.stringify(metadatas[index] || {})
            }));
            
            // 插入数据到表
            await table.add(dataToInsert);
            
            // 更新文档计数和嵌入维度
            const metadata = this.tableMetadata.get(this.normalizeTableName(filename));
            if (metadata) {
                metadata.documentCount += documents.length;
                // 保存嵌入函数实际使用的维度
                metadata.embeddingDimensions = dimensions;
            }
            
            return { success: true };
        } catch (error) {
            console.error("[TableManager] 添加文档失败:", error);
            throw error;
        }
    }

    /**
     * 向后兼容的方法别名
     */
    async addDocumentsToCollection(filename, documents, metadatas, ids) {
        return this.addDocumentsToTable(filename, documents, metadatas, ids);
    }

    /**
     * 向后兼容的方法别名
     */
    async queryMultipleCollections(queryText, collectionNames = [], nResults = 3) {
        return this.queryMultipleTables(queryText, collectionNames, nResults);
    }

    /**
     * 向后兼容的方法别名
     */
    async listCollections() {
        return this.listTables();
    }

    /**
     * 向后兼容的方法别名
     */
    async deleteCollection(filename) {
        return this.deleteTable(filename);
    }

    /**
     * 向后兼容的方法别名
     */
    async renameCollection(oldFilename, newFilename) {
        return this.renameTable(oldFilename, newFilename);
    }

    /**
     * 设置嵌入维度
     * @param {number} dimensions 嵌入维度
     * @returns {Promise<boolean>} 设置是否成功
     */
    async setEmbeddingDimensions(dimensions) {
        try {
            if (!dimensions || dimensions <= 0) {
                console.error('[TableManager] 嵌入维度必须为正整数');
                return false;
            }

            // 保存到store
            if (this.storeInstance) {
                this.storeInstance.set('embeddingDimensions', dimensions);
                console.log(`[TableManager] 嵌入维度已保存到store: ${dimensions}`);
            }

            // 重新初始化嵌入函数以应用新的维度设置
            await this.initializeEmbeddingFunction();
            
            // 重新加载所有现有表以使用新的嵌入函数
            await this.reloadTablesWithNewEmbeddingFunction();
            
            console.log(`[TableManager] 嵌入维度设置成功: ${dimensions}`);
            return true;
        } catch (error) {
            console.error('[TableManager] 设置嵌入维度失败:', error);
            return false;
        }
    }

    /**
     * 获取当前嵌入维度
     * @returns {number} 当前维度
     */
    getEmbeddingDimensions() {
        if (this.storeInstance) {
            const storedDimensions = this.storeInstance.get('embeddingDimensions');
            return storedDimensions || 1024;
        }
        return 1024;
    }
}

// 导出单例
module.exports = new TableManager();