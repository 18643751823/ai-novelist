// 使用 LanceDB 嵌入式向量数据库
const path = require('path');
const fs = require('fs').promises;
const mammoth = require('mammoth');
const pdf = require('pdf-parse');
const TableManager = require('./TableManager');
const SemanticTextSplitter = require('./SemanticTextSplitter');

class KnowledgeBaseManager {
    constructor() {
        if (KnowledgeBaseManager.instance) {
            return KnowledgeBaseManager.instance;
        }
        this.tableManager = TableManager;
        this.isInitialized = false;
        this.textSplitter = new SemanticTextSplitter({
            chunkSize: 400,    // 更适合小说的片段大小
            chunkOverlap: 50   // 减少重叠，避免重复内容
        });
        
        KnowledgeBaseManager.instance = this;
    }

    /**
     * 设置存储实例以便TableManager使用
     * @param {Object} store electron-store实例
     */
    setStore(store) {
        this.tableManager.setStore(store);
    }

    /**
     * 初始化知识库管理器
     * @param {Object} store electron-store实例
     */
    async initialize(store) {
        if (this.isInitialized) {
            console.log("[KBManager] 已初始化。");
            return;
        }

        try {
            console.log("[KBManager] 开始初始化...");
            
            // 设置存储实例给TableManager
            if (store) {
                this.tableManager.setStore(store);
            }
            
            await this.tableManager.initialize();
            this.isInitialized = true;
            console.log("[KBManager] 初始化成功。");

        } catch (error) {
            console.error("[KBManager] 初始化失败:", error);
            this.isInitialized = false;
            throw new Error("KnowledgeBaseManager 初始化失败。");
        }
    }

    /**
     * 根据文件路径将文件内容添加/更新到知识库
     * @param {string} filePath 文件的绝对路径
     */
    async addFileToKnowledgeBase(filePath) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        console.log(`[KBManager] 准备处理文件: ${filePath}`);
        const extension = path.extname(filePath).toLowerCase();

        // 检查文件类型支持
        if (!['.txt', '.md', '.pdf', '.docx'].includes(extension)) {
            console.warn(`[KBManager] 不支持的文件类型: ${extension}`);
            return { success: false, error: `不支持的文件类型: ${extension}` };
        }

        try {
            // 1. 读取文件内容
            let content = '';
            if (extension === '.txt' || extension === '.md') {
                content = await fs.readFile(filePath, 'utf-8');
            } else if (extension === '.pdf') {
                const dataBuffer = await fs.readFile(filePath);
                const pdfData = await pdf(dataBuffer);
                content = pdfData.text;
            } else if (extension === '.docx') {
                const result = await mammoth.extractRawText({ path: filePath });
                content = result.value;
            }

            console.log(`[KBManager] 文件读取成功，内容长度: ${content.length} 字符。`);

            // 2. 使用语义分割器分割文本
            const splits = await this.textSplitter.splitText(content);
            console.log(`[KBManager] 语义文本分割完成，共 ${splits.length} 个片段。`);

            // 3. 添加到集合（LanceDB 会自动处理嵌入）
            const documents = splits;
            
            // 创建元数据
            const metadatas = splits.map(() => ({
                source: filePath,
                timestamp: new Date().toISOString()
            }));
            
            const ids = splits.map((_, i) => `${path.basename(filePath)}-${i}`);
            
            // 使用 TableManager 添加文档到指定文件的表
            await this.tableManager.addDocumentsToTable(filePath, documents, metadatas, ids);
            console.log(`[KBManager] 文件 '${filePath}' 已成功添加到知识库。`);
            return { success: true, message: `文件 '${path.basename(filePath)}' 已添加。` };

        } catch (error) {
            console.error(`[KBManager] 处理文件失败: ${filePath}`, error);
            return { success: false, error: `处理文件失败: ${error.message}` };
        }
    }

    /**
     * 简单的文本分割函数（已弃用，使用SemanticTextSplitter替代）
     * @param {string} text 要分割的文本
     * @param {number} chunkSize 每个片段的最大字符数
     * @param {number} chunkOverlap 片段之间的重叠字符数
     * @returns {string[]} 分割后的文本片段数组
     */
    /*
    splitText(text, chunkSize = 1000, chunkOverlap = 200) {
        if (chunkOverlap >= chunkSize) {
            throw new Error('chunkOverlap 必须小于 chunkSize');
        }

        const chunks = [];
        
        // 首先尝试按段落分割
        const paragraphs = text.split(/\n\s*\n/);
        
        for (const paragraph of paragraphs) {
            if (paragraph.length <= chunkSize) {
                // 如果段落长度小于等于 chunkSize，直接作为一个片段
                chunks.push(paragraph.trim());
            } else {
                // 如果段落太长，按句子分割
                const sentences = paragraph.split(/(?<=[.!?。！？])\s+/);
                let currentChunk = '';
                
                for (const sentence of sentences) {
                    if (currentChunk.length + sentence.length > chunkSize) {
                        if (currentChunk) {
                            chunks.push(currentChunk.trim());
                            // 保留重叠部分
                            const overlapStart = Math.max(0, currentChunk.length - chunkOverlap);
                            currentChunk = currentChunk.substring(overlapStart);
                        }
                    }
                    currentChunk += (currentChunk ? ' ' : '') + sentence;
                }
                
                if (currentChunk.trim()) {
                    chunks.push(currentChunk.trim());
                }
            }
        }

        // 如果还是太大，按字符分割（最后的手段）
        const finalChunks = [];
        for (const chunk of chunks) {
            if (chunk.length <= chunkSize) {
                finalChunks.push(chunk);
            } else {
                for (let i = 0; i < chunk.length; i += chunkSize - chunkOverlap) {
                    const end = Math.min(i + chunkSize, chunk.length);
                    finalChunks.push(chunk.substring(i, end).trim());
                }
            }
        }

        return finalChunks.filter(chunk => chunk.length > 0);
    }
    */
    
    /**
     * 查询集合 - 现在支持多集合查询
     * @param {string} queryText 查询文本
     * @param {number} nResults 返回结果数量
     * @param {Array} collectionNames 要查询的集合名称数组（空数组表示查询所有集合）
     */
    async queryCollection(queryText, nResults = 3, collectionNames = []) {
        try {
            // 使用 TableManager 进行多表查询
            const results = await this.tableManager.queryMultipleTables(
                queryText,
                collectionNames,
                nResults
            );
            return { documents: [results] }; // 保持与原有接口兼容
        } catch (error) {
            console.error("[KBManager] 查询失败:", error);
            throw error;
        }
    }

    /**
     * 列出所有知识库文件（集合）
     */
    async listFiles() {
        if (!this.isInitialized) {
            await this.initialize();
        }
        return await this.tableManager.listTables();
    }

    /**
     * 根据文件名删除知识库文件（集合）
     * @param {string} filename 文件名
     */
    async deleteFile(filename) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        return await this.tableManager.deleteTable(filename);
    }

    /**
     * 重命名知识库文件（修改显示名称）
     * @param {string} oldFilename 原文件名
     * @param {string} newFilename 新文件名
     */
    async renameFile(oldFilename, newFilename) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        return await this.tableManager.renameTable(oldFilename, newFilename);
    }
}

// 导出单例
module.exports = new KnowledgeBaseManager();