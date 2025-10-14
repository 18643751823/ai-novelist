const { OpenAI } = require('openai');

/**
 * 阿里云嵌入函数类，用于与ChromaDB集成
 */
class AliyunEmbeddingFunction {
    constructor(apiKey, modelName = 'text-embedding-v4', dimensions = 1024) {
        if (!apiKey) {
            throw new Error('阿里云API Key是必需的');
        }
        
        const effectiveApiKey = apiKey;

        this.client = new OpenAI({
            apiKey: effectiveApiKey,
            baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
            defaultHeaders: {
                'Authorization': `Bearer ${effectiveApiKey}`
            }
        });

        this.modelName = modelName;
        this.dimensions = dimensions;
    }

    /**
     * 生成嵌入向量（ChromaDB要求的接口方法）
     * @param {string[]} texts 要嵌入的文本数组
     * @returns {Promise<number[][]>} 嵌入向量数组
     */
    async generate(texts) {
        try {
            if (!texts || texts.length === 0) {
                return [];
            }

            console.log(`[AliyunEmbedding] 开始为 ${texts.length} 个文本生成嵌入向量，维度: ${this.dimensions}`);

            // 阿里云API限制：最多10条文本，每条最多8192个token
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

                console.log(`[AliyunEmbedding] 已完成批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(texts.length / batchSize)}`);
            }

            console.log(`[AliyunEmbedding] 嵌入向量生成完成，共 ${allEmbeddings.length} 个向量`);
            return allEmbeddings;

        } catch (error) {
            console.error('[AliyunEmbedding] 生成嵌入向量失败:', error);
            throw new Error(`阿里云嵌入失败: ${error.message}`);
        }
    }
}

module.exports = AliyunEmbeddingFunction;