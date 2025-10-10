const axios = require('axios');

/**
 * Ollama 嵌入函数类，专门处理 Ollama 嵌入模型
 */
class OllamaEmbeddingFunction {
    constructor(baseURL = 'http://127.0.0.1:11434', modelName = 'bge-m3:567m', dimensions = 1024) {
        this.baseURL = baseURL;
        this.modelName = modelName;
        this.dimensions = dimensions;
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

        console.log(`[OllamaEmbeddingFunction] 使用模型 ${this.modelName} 开始为 ${texts.length} 个文本生成嵌入向量`);

        try {
            const allEmbeddings = [];
            
            // Ollama 的嵌入 API 不支持批量处理，需要逐个处理
            for (let i = 0; i < texts.length; i++) {
                const text = texts[i];
                
                try {
                    const response = await axios.post(`${this.baseURL}/api/embed`, {
                        model: this.modelName,
                        input: text
                    }, {
                        timeout: 60000 // 60秒超时，嵌入模型可能较慢
                    });

                    // Ollama 嵌入 API 返回格式: {"model":"model-name","embeddings":[[...]]}
                    if (response.data && response.data.embeddings && Array.isArray(response.data.embeddings)) {
                        allEmbeddings.push(response.data.embeddings[0]); // 取第一个嵌入向量
                        console.log(`[OllamaEmbeddingFunction] 已完成 ${i + 1}/${texts.length} 个文本的嵌入`);
                    } else {
                        console.error(`[OllamaEmbeddingFunction] 未知的响应格式:`, response.data);
                        throw new Error('响应中缺少嵌入向量数据');
                    }
                } catch (error) {
                    console.error(`[OllamaEmbeddingFunction] 处理第 ${i + 1} 个文本失败:`, error.message);
                    // 如果单个文本失败，使用零向量作为占位符
                    allEmbeddings.push(new Array(this.dimensions).fill(0));
                }
            }

            console.log(`[OllamaEmbeddingFunction] 嵌入向量生成完成，共 ${allEmbeddings.length} 个向量`);
            return allEmbeddings;

        } catch (error) {
            console.error(`[OllamaEmbeddingFunction] 使用模型 ${this.modelName} 生成嵌入向量失败:`, error);
            throw new Error(`Ollama 嵌入失败: ${error.message}`);
        }
    }

    /**
     * 验证模型是否可用
     * @returns {Promise<{valid: boolean, error?: string}>} 验证结果
     */
    async validate() {
        try {
            // 尝试调用 Ollama 的模型列表 API 来验证连接
            await axios.get(`${this.baseURL}/api/tags`, { timeout: 5000 });
            
            // 尝试生成一个测试嵌入向量
            const testText = ['test'];
            await this.generate(testText);
            
            return { valid: true };
        } catch (error) {
            return { 
                valid: false, 
                error: `Ollama 服务不可用: ${error.message}` 
            };
        }
    }

    /**
     * 检查模型是否为嵌入模型
     * @returns {boolean} 是否为嵌入模型
     */
    isEmbeddingModel() {
        // Ollama 的嵌入模型通常包含 'embed' 或 'bge' 等关键词
        const modelLower = this.modelName.toLowerCase();
        return modelLower.includes('embed') || 
               modelLower.includes('bge') ||
               modelLower.includes('multilingual-e5');
    }
}

module.exports = OllamaEmbeddingFunction;