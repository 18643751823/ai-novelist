const { OpenAI } = require('openai');
const AliyunEmbeddingFunction = require('./aliyunEmbeddingFunction');
const OllamaEmbeddingFunction = require('./ollamaEmbeddingFunction');

/**
 * 通用嵌入函数类，支持多种模型提供商
 */
class EmbeddingFunction {
    constructor(modelId, apiKeys = {}) {
        this.modelId = modelId;
        this.apiKeys = apiKeys;
        this.client = null;
        this.modelName = modelId;
        this.dimensions = 1024; // 默认维度
        
        // 根据模型ID初始化对应的客户端
        this.initializeClient();
    }

    /**
     * 根据模型ID初始化对应的客户端
     */
    initializeClient() {
        const modelLower = this.modelId.toLowerCase();
         
        // Ollama 模型
        if (modelLower.includes('ollama') || modelLower.includes('bge-')) {
            // 提取实际的模型名称（移除 ollama/ 前缀）
            const actualModelName = this.modelId.replace(/^ollama\//, '');
            this.client = new OllamaEmbeddingFunction('http://127.0.0.1:11434', actualModelName, this.dimensions);
            return;
        }
         
        // 阿里云模型
        if (modelLower.includes('aliyun') || modelLower.includes('text-embedding')) {
            const apiKey = this.apiKeys.aliyun || this.apiKeys.aliyunEmbedding;
            if (!apiKey) {
                throw new Error('阿里云API Key是必需的');
            }
            
            // 移除 aliyun/ 前缀，使用实际的模型名称
            const actualModelName = this.modelId.replace(/^aliyun\//, '');
            this.client = new AliyunEmbeddingFunction(apiKey, actualModelName, this.dimensions);
            return;
        }
         
        // OpenAI兼容模型
        if (modelLower.includes('openai') || modelLower.includes('text-embedding')) {
            const apiKey = this.apiKeys.openai || this.apiKeys.openrouter;
            if (!apiKey) {
                throw new Error('OpenAI API Key是必需的');
            }
             
            this.client = new OpenAI({
                apiKey: apiKey,
                baseURL: 'https://api.openai.com/v1'
            });
            return;
        }
         
        // DeepSeek模型
        if (modelLower.includes('deepseek')) {
            const apiKey = this.apiKeys.deepseek;
            if (!apiKey) {
                throw new Error('DeepSeek API Key是必需的');
            }
             
            this.client = new OpenAI({
                apiKey: apiKey,
                baseURL: 'https://api.deepseek.com/v1'
            });
            return;
        }
         
        // SiliconFlow模型
        if (modelLower.includes('siliconflow')) {
            const apiKey = this.apiKeys.siliconflow;
            if (!apiKey) {
                throw new Error('SiliconFlow API Key是必需的');
            }
             
            this.client = new OpenAI({
                apiKey: apiKey,
                baseURL: 'https://api.siliconflow.cn/v1'
            });
            return;
        }
         
        // 默认使用OpenAI兼容接口
        const apiKey = this.apiKeys.openai || this.apiKeys.openrouter || this.apiKeys.deepseek;
        if (apiKey) {
            this.client = new OpenAI({
                apiKey: apiKey,
                baseURL: 'https://api.openai.com/v1'
            });
            return;
        }
         
        throw new Error(`不支持的嵌入模型: ${this.modelId}`);
    }

    /**
     * 检查模型是否为嵌入模型
     */
    isEmbeddingModel() {
        const modelLower = this.modelId.toLowerCase();
        return modelLower.includes('embedding') || 
               modelLower.includes('text-embedding') ||
               modelLower.includes('bge') ||
               modelLower.includes('multilingual-e5');
    }

    /**
     * 生成嵌入向量（ChromaDB要求的接口方法）
     * @param {string[]} texts 要嵌入的文本数组
     * @returns {Promise<number[][]>} 嵌入向量数组
     */
    async generate(texts) {
        if (!this.client) {
            throw new Error('嵌入客户端未初始化');
        }

        // 检查是否为嵌入模型
        if (!this.isEmbeddingModel()) {
            throw new Error(`模型 ${this.modelId} 不是嵌入模型，无法生成嵌入向量`);
        }

        try {
            if (!texts || texts.length === 0) {
                return [];
            }

            console.log(`[EmbeddingFunction] 使用模型 ${this.modelId} 开始为 ${texts.length} 个文本生成嵌入向量`);

            // 阿里云嵌入函数有自己的批处理逻辑
            if (this.client instanceof AliyunEmbeddingFunction) {
                return await this.client.generate(texts);
            }

            // Ollama 嵌入函数有自己的处理逻辑
            if (this.client instanceof OllamaEmbeddingFunction) {
                return await this.client.generate(texts);
            }

            // 其他OpenAI兼容模型的批处理逻辑
            const batchSize = 10;
            const allEmbeddings = [];

            for (let i = 0; i < texts.length; i += batchSize) {
                const batchTexts = texts.slice(i, i + batchSize);
                
                const response = await this.client.embeddings.create({
                    model: this.modelName,
                    input: batchTexts,
                    dimensions: this.dimensions,
                    encoding_format: 'float'
                });

                const batchEmbeddings = response.data.map(item => item.embedding);
                allEmbeddings.push(...batchEmbeddings);

                console.log(`[EmbeddingFunction] 已完成批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(texts.length / batchSize)}`);
            }

            console.log(`[EmbeddingFunction] 嵌入向量生成完成，共 ${allEmbeddings.length} 个向量`);
            return allEmbeddings;

        } catch (error) {
            console.error(`[EmbeddingFunction] 使用模型 ${this.modelId} 生成嵌入向量失败:`, error);
            throw new Error(`嵌入失败: ${error.message}`);
        }
    }

    /**
     * 验证模型是否可用
     */
    async validate() {
        try {
            // 尝试生成一个测试嵌入向量
            const testText = ['test'];
            await this.generate(testText);
            return { valid: true };
        } catch (error) {
            return { 
                valid: false, 
                error: error.message 
            };
        }
    }
}

module.exports = EmbeddingFunction;