const { ChromaClient } = require("chromadb");
const path = require('path');
const AliyunEmbeddingFunction = require('./aliyunEmbeddingFunction');
const OllamaEmbeddingFunction = require('./ollamaEmbeddingFunction');

/**
 * 集合管理器类，负责管理多个ChromaDB集合
 * 每个文件对应一个独立的集合，支持多集合查询和管理
 */
class CollectionManager {
    constructor() {
        if (CollectionManager.instance) {
            return CollectionManager.instance;
        }

        this.client = new ChromaClient();
        this.collections = new Map(); // 集合注册表：collectionName -> collection
        this.collectionMetadata = new Map(); // 集合元数据：collectionName -> metadata
        this.isInitialized = false;
        
        // 初始化嵌入函数（先使用空值，后续通过配置设置）
        this.embeddingFunction = null;
        this.embeddingProvider = null; // 嵌入提供商类型
        this.storeInstance = null; // 用于存储 electron-store 实例

        CollectionManager.instance = this;
    }

    /**
     * 初始化集合管理器
     */
    /**
     * 设置阿里云API Key（仅用于向后兼容，实际已改为启动时初始化）
     * @param {string} apiKey 阿里云API Key
     */
    setEmbeddingApiKey(apiKey) {
        console.warn("[CollectionManager] setEmbeddingApiKey已弃用，API Key应在启动时通过store设置");
        // 不再进行动态重新初始化，改为类似DeepSeek的启动时一次性初始化模式
    }

    /**
     * 设置阿里云API Key（向后兼容）
     * @param {string} apiKey 阿里云API Key
     */
    setEmbeddingApiKey(apiKey) {
        console.warn("[CollectionManager] setEmbeddingApiKey已弃用，请使用setEmbeddingType方法");
        // 保持向后兼容，但建议使用新的API
    }

    /**
     * 重新初始化嵌入函数，用于API Key更新后刷新嵌入功能
     * @returns {boolean} 重新初始化是否成功
     */
    reinitializeEmbeddingFunction() {
        try {
            console.log("[CollectionManager] 重新初始化嵌入函数...");
            this.initializeEmbeddingFunction();
            
            // 重新加载所有现有集合以使用新的嵌入函数
            this.reloadCollectionsWithNewEmbeddingFunction();
            
            console.log("[CollectionManager] 嵌入函数重新初始化成功");
            return true;
        } catch (error) {
            console.error("[CollectionManager] 嵌入函数重新初始化失败:", error);
            return false;
        }
    }

    /**
     * 重新加载所有现有集合以使用新的嵌入函数
     */
    async reloadCollectionsWithNewEmbeddingFunction() {
        if (this.collections.size === 0) {
            return;
        }

        console.log(`[CollectionManager] 重新加载 ${this.collections.size} 个集合以使用新的嵌入函数`);
        
        for (const [collectionName, collection] of this.collections) {
            try {
                // 重新获取集合以使用新的嵌入函数
                const newCollection = await this.client.getCollection({
                    name: collectionName,
                    embeddingFunction: this.embeddingFunction
                });
                
                // 更新集合引用
                this.collections.set(collectionName, newCollection);
                console.log(`[CollectionManager] 集合 ${collectionName} 已重新加载`);
            } catch (error) {
                console.warn(`[CollectionManager] 重新加载集合 ${collectionName} 失败:`, error);
            }
        }
    }

    /**
     * 初始化嵌入函数（启动时一次性初始化）
     */
    initializeEmbeddingFunction() {
        try {
            const embeddingConfig = this.getEmbeddingConfigFromStore();

            if (!embeddingConfig) {
                console.warn("[CollectionManager] 嵌入配置未设置，嵌入功能将不可用");
                this.embeddingFunction = null;
                this.embeddingProvider = null;
                return;
            }

            const { provider, config } = embeddingConfig;
            this.embeddingProvider = provider;

            switch (provider) {
                case 'aliyun':
                    const aliyunApiKey = config.apiKey;
                    if (!aliyunApiKey) {
                        console.warn("[CollectionManager] 阿里云API Key未设置，嵌入功能将不可用");
                        this.embeddingFunction = null;
                        return;
                    }
                    this.embeddingFunction = new AliyunEmbeddingFunction(
                        aliyunApiKey,
                        config.modelName || 'text-embedding-v4',
                        config.dimensions || 1024
                    );
                    console.log("[CollectionManager] 阿里云嵌入函数初始化成功");
                    break;

                case 'ollama':
                    this.embeddingFunction = new OllamaEmbeddingFunction(
                        config.baseUrl || 'http://localhost:11434',
                        config.modelName || 'nomic-embed-text'
                    );
                    console.log("[CollectionManager] Ollama嵌入函数初始化成功");
                    break;

                default:
                    console.warn(`[CollectionManager] 不支持的嵌入提供商: ${provider}`);
                    this.embeddingFunction = null;
                    this.embeddingProvider = null;
                    return;
            }

            console.log(`[CollectionManager] 嵌入函数初始化成功，提供商: ${provider}`);
        } catch (error) {
            console.error("[CollectionManager] 嵌入函数初始化失败:", error);
            this.embeddingFunction = null;
            this.embeddingProvider = null;
        }
    }

    /**
     * 从store获取嵌入配置
     * @returns {Object|null} 嵌入配置对象，如果没有设置则返回null
     */
    getEmbeddingConfigFromStore() {
        if (!this.storeInstance) {
            console.warn("[CollectionManager] store实例未设置，无法获取嵌入配置");
            return null;
        }

        // 尝试获取新的配置格式
        const embeddingConfig = this.storeInstance.get('embeddingConfig');
        if (embeddingConfig && embeddingConfig.provider && embeddingConfig.config) {
            console.log(`[CollectionManager] 使用新的嵌入配置格式，提供商: ${embeddingConfig.provider}`);
            return embeddingConfig;
        }

        // 向后兼容：检查旧的阿里云API Key配置
        const legacyAliyunKey = this.storeInstance.get('aliyunEmbeddingApiKey');
        if (legacyAliyunKey && legacyAliyunKey.trim()) {
            console.log("[CollectionManager] 检测到旧的阿里云配置，转换为新的配置格式");
            return {
                provider: 'aliyun',
                config: {
                    apiKey: legacyAliyunKey.trim(),
                    modelName: 'text-embedding-v4',
                    dimensions: 1024
                }
            };
        }

        console.log("[CollectionManager] 未找到嵌入配置");
        return null;
    }

    /**
     * 从store获取当前的API Key（向后兼容方法）
     * @returns {string} 当前的API Key，如果没有设置则返回空字符串
     * @deprecated 使用 getEmbeddingConfigFromStore 替代
     */
    getCurrentApiKeyFromStore() {
        console.warn("[CollectionManager] getCurrentApiKeyFromStore已弃用，请使用getEmbeddingConfigFromStore");
        const config = this.getEmbeddingConfigFromStore();
        if (config && config.provider === 'aliyun' && config.config.apiKey) {
            return config.config.apiKey;
        }
        return '';
    }

    /**
     * 保存集合元数据到持久化存储
     */
    saveCollectionMetadataToStore() {
        if (!this.storeInstance) {
            console.warn("[CollectionManager] store实例未设置，无法保存集合元数据");
            return;
        }
        
        const metadataToSave = {};
        for (const [collectionName, metadata] of this.collectionMetadata) {
            metadataToSave[collectionName] = metadata;
        }
        
        this.storeInstance.set('collectionMetadata', metadataToSave);
        console.log("[CollectionManager] 集合元数据已保存到持久化存储");
    }

    /**
     * 从持久化存储加载集合元数据
     */
    loadCollectionMetadataFromStore() {
        if (!this.storeInstance) {
            console.warn("[CollectionManager] store实例未设置，无法加载集合元数据");
            return;
        }
        
        const savedMetadata = this.storeInstance.get('collectionMetadata') || {};
        for (const [collectionName, metadata] of Object.entries(savedMetadata)) {
            this.collectionMetadata.set(collectionName, metadata);
        }
        
        console.log("[CollectionManager] 集合元数据已从持久化存储加载");
    }

    /**
     * 设置存储实例以便后续使用
     * @param {Object} store electron-store实例
     */
    setStore(store) {
        this.storeInstance = store;

        // 设置store实例，不再自动重新初始化嵌入函数
        console.log("[CollectionManager] store实例已设置");
    }

    /**
     * 设置嵌入配置
     * @param {string} provider 提供商类型 ('aliyun' | 'ollama')
     * @param {Object} config 配置对象
     * @returns {Promise<Object>} 设置结果
     */
    async setEmbeddingConfig(provider, config) {
        try {
            console.log(`[CollectionManager] 设置嵌入配置: provider=${provider}`);

            // 验证提供商
            if (!['aliyun', 'ollama'].includes(provider)) {
                throw new Error(`不支持的嵌入提供商: ${provider}`);
            }

            // 验证配置
            if (provider === 'aliyun') {
                if (!config.apiKey || !config.apiKey.trim()) {
                    throw new Error('阿里云API Key不能为空');
                }
            } else if (provider === 'ollama') {
                if (!config.baseUrl || !config.baseUrl.trim()) {
                    throw new Error('Ollama服务器地址不能为空');
                }
                if (!config.modelName || !config.modelName.trim()) {
                    throw new Error('Ollama模型名称不能为空');
                }
            }

            // 保存配置到store
            const embeddingConfig = {
                provider,
                config: {
                    ...config,
                    // 设置默认值
                    modelName: config.modelName || (provider === 'aliyun' ? 'text-embedding-v4' : 'nomic-embed-text'),
                    dimensions: config.dimensions || (provider === 'aliyun' ? 1024 : undefined),
                    baseUrl: config.baseUrl || (provider === 'ollama' ? 'http://localhost:11434' : undefined)
                }
            };

            this.storeInstance.set('embeddingConfig', embeddingConfig);
            console.log("[CollectionManager] 嵌入配置已保存到store");

            // 重新初始化嵌入函数
            this.reinitializeEmbeddingFunction();

            return {
                success: true,
                message: `嵌入配置设置成功，提供商: ${provider}`
            };

        } catch (error) {
            console.error('[CollectionManager] 设置嵌入配置失败:', error);
            return {
                success: false,
                error: `设置嵌入配置失败: ${error.message}`
            };
        }
    }

    /**
     * 获取当前嵌入提供商信息
     * @returns {Object|null} 提供商信息
     */
    getEmbeddingProviderInfo() {
        if (!this.embeddingFunction) {
            return null;
        }

        return {
            provider: this.embeddingProvider,
            isInitialized: true
        };
    }


    async initialize() {
        if (this.isInitialized) {
            return;
        }

        try {
            console.log("[CollectionManager] 开始初始化...");
            
            // 初始化嵌入函数（会自动从store读取最新API Key）
            this.initializeEmbeddingFunction();
            
            // 首先从持久化存储加载集合元数据
            this.loadCollectionMetadataFromStore();
            
            // 获取所有现有集合并加载到注册表
            const existingCollections = await this.client.listCollections();
            for (const collectionInfo of existingCollections) {
                try {
                    const collection = await this.client.getCollection({
                        name: collectionInfo.name,
                        embeddingFunction: this.embeddingFunction
                    });
                    
                    this.collections.set(collectionInfo.name, collection);
                    
                    // 如果持久化存储中有这个集合的元数据，使用保存的数据
                    if (this.collectionMetadata.has(collectionInfo.name)) {
                        const savedMetadata = this.collectionMetadata.get(collectionInfo.name);
                        // 只更新文档数量，保持其他元数据不变
                        const documents = await collection.get();
                        savedMetadata.documentCount = documents.ids.length;
                    } else {
                        // 如果没有保存的元数据，创建新的元数据条目
                        this.collectionMetadata.set(collectionInfo.name, {
                            filename: this.extractFilenameFromCollectionName(collectionInfo.name),
                            originalFilename: this.extractFilenameFromCollectionName(collectionInfo.name),
                            createdAt: new Date().toISOString(),
                            documentCount: 0
                        });
                        
                        // 获取集合中的文档数量
                        const documents = await collection.get();
                        this.collectionMetadata.get(collectionInfo.name).documentCount = documents.ids.length;
                    }
                    
                } catch (error) {
                    console.warn(`[CollectionManager] 加载集合 ${collectionInfo.name} 失败:`, error);
                }
            }

            // 保存更新后的元数据到持久化存储
            this.saveCollectionMetadataToStore();
            
            this.isInitialized = true;
            console.log("[CollectionManager] 初始化成功，已加载", this.collections.size, "个集合");
        } catch (error) {
            console.error("[CollectionManager] 初始化失败:", error);
            throw new Error("CollectionManager 初始化失败");
        }
    }

    /**
     * 规范化集合名称（移除特殊字符，确保ChromaDB兼容性）
     * @param {string} filename 文件名
     * @returns {string} 规范化后的集合名称
     */
    normalizeCollectionName(filename) {
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
     * 从集合名称中提取原始文件名
     * @param {string} collectionName 集合名称
     * @returns {string} 原始文件名
     */
    extractFilenameFromCollectionName(collectionName) {
        // 首先尝试从元数据中获取保存的原始文件名
        if (this.collectionMetadata.has(collectionName)) {
            const metadata = this.collectionMetadata.get(collectionName);
            if (metadata && metadata.originalFilename) {
                return metadata.originalFilename;
            }
        }
        
        // 如果没有保存原始文件名，使用向后兼容的恢复逻辑
        // 移除前缀并恢复文件名
        return collectionName.replace(/^kb-/, '').replace(/_/g, ' ') + '.txt';
    }

    /**
     * 根据文件名获取或创建集合
     * @param {string} filename 文件名
     * @returns {Promise<Object>} ChromaDB集合对象
     */
    async getOrCreateCollection(filename) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        // 检查嵌入函数是否可用
        if (!this.embeddingFunction) {
            throw new Error('嵌入函数未初始化，请先在设置中配置RAG嵌入模型');
        }

        const collectionName = this.normalizeCollectionName(filename);
        
        // 如果集合已存在，确保文档数量是最新的
        if (this.collections.has(collectionName)) {
            const collection = this.collections.get(collectionName);
            // 更新文档数量到最新状态
            try {
                const documents = await collection.get();
                if (this.collectionMetadata.has(collectionName)) {
                    this.collectionMetadata.get(collectionName).documentCount = documents.ids.length;
                }
            } catch (error) {
                console.warn(`[CollectionManager] 更新集合 ${collectionName} 文档数量失败:`, error);
            }
            return collection;
        }

        try {
            console.log(`[CollectionManager] 创建新集合: ${collectionName}`);
            
            // 创建新集合
            const collection = await this.client.createCollection({
                name: collectionName,
                embeddingFunction: this.embeddingFunction
            });
            
            // 注册集合和元数据
            this.collections.set(collectionName, collection);
            this.collectionMetadata.set(collectionName, {
                filename: path.basename(filename),
                originalFilename: path.basename(filename), // 保存原始文件名
                createdAt: new Date().toISOString(),
                documentCount: 0
            });
            
            // 保存元数据到持久化存储
            this.saveCollectionMetadataToStore();
            
            console.log(`[CollectionManager] 集合 ${collectionName} 创建成功`);
            return collection;
            
        } catch (error) {
            // 如果集合已存在（并发创建），尝试获取现有集合
            if (error.message.includes('already exists') || error.message.includes('409')) {
                console.log(`[CollectionManager] 集合已存在，获取现有集合: ${collectionName}`);
                const collection = await this.client.getCollection({
                    name: collectionName,
                    embeddingFunction: this.embeddingFunction
                });
                
                this.collections.set(collectionName, collection);
                
                // 获取文档数量
                const documents = await collection.get();
                this.collectionMetadata.set(collectionName, {
                    filename: path.basename(filename),
                    originalFilename: path.basename(filename), // 保存原始文件名
                    createdAt: new Date().toISOString(),
                    documentCount: documents.ids.length
                });
                
                // 保存元数据到持久化存储
                this.saveCollectionMetadataToStore();
                
                return collection;
            }
            
            throw error;
        }
    }

    /**
     * 获取所有集合的元数据列表
     * 每次调用都会从ChromaDB获取最新的文档数量，确保数据准确性
     * @returns {Array} 集合元数据数组
     */
    async listCollections() {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const collections = [];
        
        // 获取所有现有集合
        const existingCollections = await this.client.listCollections();
        
        for (const collectionInfo of existingCollections) {
            try {
                // 获取集合对象
                const collection = await this.client.getCollection({
                    name: collectionInfo.name,
                    embeddingFunction: this.embeddingFunction
                });
                
                // 获取最新的文档数量
                const documents = await collection.get();
                const documentCount = documents.ids.length;
                
                // 更新内存中的元数据
                if (this.collectionMetadata.has(collectionInfo.name)) {
                    this.collectionMetadata.get(collectionInfo.name).documentCount = documentCount;
                } else {
                    // 如果集合不在内存中，创建新的元数据条目
                    this.collectionMetadata.set(collectionInfo.name, {
                        filename: this.extractFilenameFromCollectionName(collectionInfo.name),
                        createdAt: new Date().toISOString(),
                        documentCount: documentCount
                    });
                }
                
                // 确保集合在内存中
                if (!this.collections.has(collectionInfo.name)) {
                    this.collections.set(collectionInfo.name, collection);
                }
                
                // 添加到返回结果
                const metadata = this.collectionMetadata.get(collectionInfo.name);
                collections.push({
                    collectionName: collectionInfo.name,
                    filename: metadata.filename,
                    createdAt: metadata.createdAt,
                    documentCount: metadata.documentCount
                });
                
            } catch (error) {
                console.warn(`[CollectionManager] 获取集合 ${collectionInfo.name} 信息失败:`, error);
                // 如果获取失败，使用内存中的缓存数据
                if (this.collectionMetadata.has(collectionInfo.name)) {
                    const metadata = this.collectionMetadata.get(collectionInfo.name);
                    collections.push({
                        collectionName: collectionInfo.name,
                        filename: metadata.filename,
                        createdAt: metadata.createdAt,
                        documentCount: metadata.documentCount
                    });
                }
            }
        }

        return collections;
    }

    /**
     * 根据文件名删除集合
     * @param {string} filename 文件名
     * @returns {Promise<Object>} 删除结果
     */
    async deleteCollection(filename) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const expectedCollectionName = this.normalizeCollectionName(filename);
        
        // 首先检查标准化的集合名称
        if (this.collections.has(expectedCollectionName)) {
            try {
                console.log(`[CollectionManager] 删除集合: ${expectedCollectionName}`);
                
                // 从ChromaDB删除集合
                await this.client.deleteCollection({ name: expectedCollectionName });
                
                // 从注册表中移除
                this.collections.delete(expectedCollectionName);
                this.collectionMetadata.delete(expectedCollectionName);
                
                // 保存更新后的元数据到持久化存储
                this.saveCollectionMetadataToStore();
                
                console.log(`[CollectionManager] 集合 ${expectedCollectionName} 删除成功`);
                return { success: true, message: `集合 ${expectedCollectionName} 已删除` };
                
            } catch (error) {
                console.error(`[CollectionManager] 删除集合失败: ${expectedCollectionName}`, error);
                return { success: false, error: `删除集合失败: ${error.message}` };
            }
        }
        
        // 如果没有找到标准化的集合名称，尝试查找匹配的集合
        const baseFilename = path.basename(filename, path.extname(filename));
        for (const [collectionName, metadata] of this.collectionMetadata) {
            if (metadata.filename === path.basename(filename)) {
                try {
                    console.log(`[CollectionManager] 删除集合: ${collectionName}`);
                    
                    // 从ChromaDB删除集合
                    await this.client.deleteCollection({ name: collectionName });
                    
                    // 从注册表中移除
                    this.collections.delete(collectionName);
                    this.collectionMetadata.delete(collectionName);
                    
                    // 保存更新后的元数据到持久化存储
                    this.saveCollectionMetadataToStore();
                    
                    console.log(`[CollectionManager] 集合 ${collectionName} 删除成功`);
                    return { success: true, message: `集合 ${collectionName} 已删除` };
                    
                } catch (error) {
                    console.error(`[CollectionManager] 删除集合失败: ${collectionName}`, error);
                    return { success: false, error: `删除集合失败: ${error.message}` };
                }
            }
        }
        
        return { success: false, error: `集合不存在: ${expectedCollectionName}` };
    }

    /**
     * 重命名集合（实际上是修改集合的显示名称）
     * @param {string} oldFilename 原文件名
     * @param {string} newFilename 新文件名
     * @returns {Promise<Object>} 重命名结果
     */
    async renameCollection(oldFilename, newFilename) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        // 首先尝试使用标准化的集合名称查找
        const expectedCollectionName = this.normalizeCollectionName(oldFilename);
        
        // 检查标准化的集合名称是否存在
        if (this.collections.has(expectedCollectionName)) {
            try {
                console.log(`[CollectionManager] 重命名集合: ${expectedCollectionName} -> ${newFilename}`);
                
                // 获取集合元数据
                const metadata = this.collectionMetadata.get(expectedCollectionName);
                if (!metadata) {
                    return { success: false, error: `集合元数据不存在: ${expectedCollectionName}` };
                }

                // 更新文件名和原始文件名
                metadata.filename = path.basename(newFilename);
                metadata.originalFilename = path.basename(newFilename);
                
                // 保存更新后的元数据到持久化存储
                this.saveCollectionMetadataToStore();
                
                console.log(`[CollectionManager] 集合 ${expectedCollectionName} 重命名成功`);
                return {
                    success: true,
                    message: `集合重命名成功`,
                    collectionName: expectedCollectionName, // 集合名称不变，只修改显示名称
                    newFilename: path.basename(newFilename)
                };
                
            } catch (error) {
                console.error(`[CollectionManager] 重命名集合失败: ${expectedCollectionName}`, error);
                return { success: false, error: `重命名集合失败: ${error.message}` };
            }
        }
        
        // 如果没有找到标准化的集合名称，尝试查找匹配的文件名
        const baseOldFilename = path.basename(oldFilename);
        for (const [collectionName, metadata] of this.collectionMetadata) {
            if (metadata.filename === baseOldFilename) {
                try {
                    console.log(`[CollectionManager] 重命名集合: ${collectionName} -> ${newFilename}`);
                    
                    // 更新文件名和原始文件名
                    metadata.filename = path.basename(newFilename);
                    metadata.originalFilename = path.basename(newFilename);
                    
                    // 保存更新后的元数据到持久化存储
                    this.saveCollectionMetadataToStore();
                    
                    console.log(`[CollectionManager] 集合 ${collectionName} 重命名成功`);
                    return {
                        success: true,
                        message: `集合重命名成功`,
                        collectionName: collectionName,
                        newFilename: path.basename(newFilename)
                    };
                    
                } catch (error) {
                    console.error(`[CollectionManager] 重命名集合失败: ${collectionName}`, error);
                    return { success: false, error: `重命名集合失败: ${error.message}` };
                }
            }
        }
        
        return { success: false, error: `集合不存在: ${expectedCollectionName}` };
    }

    /**
     * 多集合查询 - 支持单个集合、多个集合或全部集合查询
     * @param {string} queryText 查询文本
     * @param {Array} collectionNames 要查询的集合名称数组（空数组表示查询所有集合）
     * @param {number} nResults 每个集合返回的结果数量
     * @returns {Promise<Array>} 查询结果数组
     */
    async queryMultipleCollections(queryText, collectionNames = [], nResults = 3) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        // 检查嵌入函数是否可用
        if (!this.embeddingFunction) {
            console.warn('[CollectionManager] 嵌入函数未初始化，无法执行查询');
            return [];
        }

        if (!queryText || typeof queryText !== 'string' || queryText.trim() === '') {
            return [];
        }

        // 确定要查询的目标集合
        let targetCollections = [];
        if (collectionNames.length === 0) {
            // 查询所有集合
            targetCollections = Array.from(this.collections.values());
        } else {
            // 查询指定集合
            targetCollections = collectionNames
                .filter(name => this.collections.has(name))
                .map(name => this.collections.get(name));
        }

        if (targetCollections.length === 0) {
            return [];
        }

        try {
            console.log(`[CollectionManager] 在多集合中查询: "${queryText}"`);
            console.log(`[CollectionManager] 目标集合数量: ${targetCollections.length}`);
            
            // 并行查询所有目标集合
            const queries = targetCollections.map(collection => 
                collection.query({
                    queryTexts: [queryText],
                    nResults: nResults
                }).catch(error => {
                    console.warn(`[CollectionManager] 集合查询失败:`, error);
                    return { documents: [], distances: [], metadatas: [] };
                })
            );

            const results = await Promise.all(queries);
            
            // 合并和排序结果
            const mergedResults = this.mergeQueryResults(results);
            console.log(`[CollectionManager] 查询完成，共找到 ${mergedResults.length} 个相关片段`);
            
            return mergedResults;
            
        } catch (error) {
            console.error("[CollectionManager] 多集合查询失败:", error);
            return [];
        }
    }

    /**
     * 合并多个集合的查询结果并按相关性排序
     * @param {Array} results 多个集合的查询结果数组
     * @returns {Array} 合并和排序后的结果
     */
    mergeQueryResults(results) {
        const allResults = [];
        
        // 收集所有结果
        for (const result of results) {
            if (result && result.documents && result.documents.length > 0) {
                for (let i = 0; i < result.documents[0].length; i++) {
                    allResults.push({
                        content: result.documents[0][i],
                        distance: result.distances[0][i],
                        metadata: result.metadatas[0][i]
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
     * 向指定集合添加文档
     * @param {string} filename 文件名
     * @param {Array} documents 文档数组
     * @param {Array} metadatas 元数据数组
     * @param {Array} ids ID数组
     * @returns {Promise<Object>} 添加结果
     */
    async addDocumentsToCollection(filename, documents, metadatas, ids) {
        // 检查嵌入函数是否可用
        if (!this.embeddingFunction) {
            throw new Error('嵌入函数未初始化，无法添加文档。请先在设置中配置RAG嵌入模型');
        }

        const collection = await this.getOrCreateCollection(filename);
        
        try {
            await collection.add({
                ids: ids,
                metadatas: metadatas,
                documents: documents
            });
            
            // 更新文档计数
            const metadata = this.collectionMetadata.get(this.normalizeCollectionName(filename));
            if (metadata) {
                metadata.documentCount += documents.length;
            }
            
            return { success: true };
        } catch (error) {
            console.error("[CollectionManager] 添加文档失败:", error);
            throw error;
        }
    }
}

// 导出单例
module.exports = new CollectionManager();