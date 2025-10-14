const { RecursiveCharacterTextSplitter } = require('@langchain/textsplitters');
const { Document } = require('langchain/document');

/**
 * 智能语义文本分割器
 * 基于LangChain的RecursiveCharacterTextSplitter实现语义感知的文本分割
 */
class SemanticTextSplitter {
    constructor(options = {}) {
        this.storeInstance = options.store || null;
        this.options = {
            chunkSize: 400,          // 默认值，可被store中的设置覆盖
            chunkOverlap: 50,        // 默认值，可被store中的设置覆盖
            separators: ["\n\n", "\n", "。", "！", "？", ".", "!", "?", " ", ""],
            keepSeparator: true,      // 是否保留分隔符
            ...options
        };
        
        // 从store获取配置（如果可用）
        this.loadSettingsFromStore();
        
        // 初始化LangChain分割器
        this.recursiveSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: this.options.chunkSize,
            chunkOverlap: this.options.chunkOverlap,
            separators: this.options.separators,
            keepSeparator: this.options.keepSeparator
        });
    }

    /**
     * 从store加载分段参数设置
     */
    loadSettingsFromStore() {
        if (this.storeInstance) {
            const chunkSize = this.storeInstance.get('ragChunkSize');
            const chunkOverlap = this.storeInstance.get('ragChunkOverlap');
            
            console.log(`[SemanticTextSplitter] 从store读取分段参数: ragChunkSize=${chunkSize}, ragChunkOverlap=${chunkOverlap}`);
            
            if (chunkSize !== undefined && chunkSize !== null) {
                this.options.chunkSize = parseInt(chunkSize) || this.options.chunkSize;
            }
            
            if (chunkOverlap !== undefined && chunkOverlap !== null) {
                this.options.chunkOverlap = parseInt(chunkOverlap) || this.options.chunkOverlap;
            }
            
            console.log(`[SemanticTextSplitter] 加载后的分段参数: chunkSize=${this.options.chunkSize}, chunkOverlap=${this.options.chunkOverlap}`);
            
            // 更新分割器配置
            this.updateSplitter();
        }
    }

    /**
     * 重新加载分段参数（用于store值更新后）
     */
    reloadSettings() {
        console.log(`[SemanticTextSplitter] 重新加载分段参数...`);
        this.loadSettingsFromStore();
    }
    /**
     * 设置存储实例以便获取配置
     * @param {Object} store electron-store实例
     */
    setStore(store) {
        this.storeInstance = store;
        this.loadSettingsFromStore();
        this.updateSplitter();
    }

    /**
     * 更新分割器配置
     */
    updateSplitter() {
        this.recursiveSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: this.options.chunkSize,
            chunkOverlap: this.options.chunkOverlap,
            separators: this.options.separators,
            keepSeparator: this.options.keepSeparator
        });
    }

    /**
     * 文本预处理 - 清理和标准化文本
     * @param {string} text 原始文本
     * @returns {string} 处理后的文本
     */
    preprocessText(text) {
        if (!text || typeof text !== 'string') {
            return '';
        }

        return text
            .replace(/\r\n/g, '\n')           // 统一换行符
            .replace(/\r/g, '\n')             // 统一换行符
            .replace(/\t/g, ' ')              // 制表符转空格
            .replace(/\s+/g, ' ')             // 合并多余空格
            .replace(/[^\w\s\u4e00-\u9fa5。！？.,!?\-:;'"()\[\]{}]/g, '') // 清理特殊字符
            .trim();
    }

    /**
     * 语义分割主方法
     * @param {string} text 要分割的文本
     * @returns {Promise<string[]>} 分割后的文本片段数组
     */
    async splitText(text) {
        try {
            // 记录当前使用的分段参数
            console.log(`[SemanticTextSplitter] 当前分段参数: chunkSize=${this.options.chunkSize}, chunkOverlap=${this.options.chunkOverlap}`);
            
            const cleanedText = this.preprocessText(text);
            
            if (!cleanedText) {
                return [];
            }

            // 使用LangChain的分割器进行语义分割
            const documents = await this.recursiveSplitter.splitDocuments([
                new Document({ pageContent: cleanedText })
            ]);
            
            // 提取分割后的文本内容
            const chunks = documents.map(doc => doc.pageContent.trim());
            
            // 过滤空字符串和过短的片段
            return chunks.filter(chunk => chunk.length > 10);
            
        } catch (error) {
            console.error('[SemanticTextSplitter] 分割文本失败:', error);
            // 降级处理：使用简单的字符分割
            return this.fallbackSplit(text);
        }
    }
    /**
     * 降级分割方法 - 当语义分割失败时使用
     * @param {string} text 要分割的文本
     * @returns {string[]} 分割后的文本片段
     */
    fallbackSplit(text) {
        const chunks = [];
        const chunkSize = this.options.chunkSize;
        const chunkOverlap = this.options.chunkOverlap;
        
        for (let i = 0; i < text.length; i += chunkSize - chunkOverlap) {
            const end = Math.min(i + chunkSize, text.length);
            const chunk = text.substring(i, end).trim();
            if (chunk.length > 0) {
                chunks.push(chunk);
            }
        }
        
        return chunks;
    }

    /**
     * 批量分割文本
     * @param {string[]} texts 文本数组
     * @returns {Promise<string[][]>} 分割后的文本片段二维数组
     */
    async splitTexts(texts) {
        const results = [];
        for (const text of texts) {
            const chunks = await this.splitText(text);
            results.push(chunks);
        }
        return results;
    }

    /**
     * 获取分割统计信息
     * @param {string} text 文本
     * @returns {Promise<Object>} 统计信息
     */
    async getSplitStats(text) {
        const chunks = await this.splitText(text);
        return {
            totalChunks: chunks.length,
            avgChunkLength: chunks.reduce((sum, chunk) => sum + chunk.length, 0) / chunks.length,
            minChunkLength: Math.min(...chunks.map(chunk => chunk.length)),
            maxChunkLength: Math.max(...chunks.map(chunk => chunk.length)),
            totalCharacters: text.length
        };
    }
}

module.exports = SemanticTextSplitter;