/**
 * 硅基流动嵌入函数类
 */
class SiliconFlowEmbeddingFunction {
    constructor(apiKey, modelName = 'BAAI/bge-large-zh-v1.5', dimensions = 1024) {
        this.apiKey = apiKey;
        this.modelName = modelName;
        this.dimensions = dimensions;
        this.baseURL = 'https://api.siliconflow.cn/v1';
        
        // 验证API密钥
        if (!this.apiKey) {
            throw new Error('SiliconFlow API Key是必需的');
        }
    }

    /**
     * 检查模型是否为嵌入模型
     */
    isEmbeddingModel() {
        const modelLower = this.modelName.toLowerCase();
        return modelLower.includes('bge') || 
               modelLower.includes('embedding') ||
               modelLower.includes('qwen');
    }

    /**
     * 生成嵌入向量
     * @param {string[]} texts 要嵌入的文本数组
     * @returns {Promise<number[][]>} 嵌入向量数组
     */
    async generate(texts) {
        if (!texts || texts.length === 0) {
            return [];
        }

        console.log(`[SiliconFlowEmbeddingFunction] 使用模型 ${this.modelName} 开始为 ${texts.length} 个文本生成嵌入向量`);

        try {
            const batchSize = 10;
            const allEmbeddings = [];

            for (let i = 0; i < texts.length; i += batchSize) {
                const batchTexts = texts.slice(i, i + batchSize);
                
                // 构建请求体 - 不传递dimensions参数，使用网站默认值
                const requestBody = {
                    model: this.modelName,
                    input: batchTexts,
                    encoding_format: 'float'
                };

                const response = await global.fetch(`${this.baseURL}/embeddings`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestBody)
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`硅基流动API请求失败: ${response.status} ${response.statusText} - ${errorText}`);
                }

                const data = await response.json();
                
                if (!data.data || !Array.isArray(data.data)) {
                    throw new Error('硅基流动API返回数据格式错误');
                }

                const batchEmbeddings = data.data.map(item => item.embedding);
                allEmbeddings.push(...batchEmbeddings);

                console.log(`[SiliconFlowEmbeddingFunction] 已完成批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(texts.length / batchSize)}`);
            }

            console.log(`[SiliconFlowEmbeddingFunction] 嵌入向量生成完成，共 ${allEmbeddings.length} 个向量`);
            return allEmbeddings;

        } catch (error) {
            console.error(`[SiliconFlowEmbeddingFunction] 使用模型 ${this.modelName} 生成嵌入向量失败:`, error);
            throw new Error(`硅基流动嵌入失败: ${error.message}`);
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

    /**
     * 设置嵌入维度
     * @param {number} dimensions - 嵌入维度
     */
    setDimensions(dimensions) {
        this.dimensions = dimensions;
    }

    /**
     * 获取当前嵌入维度
     * @returns {number} 当前维度
     */
    getDimensions() {
        return this.dimensions;
    }
}

module.exports = SiliconFlowEmbeddingFunction;