const axios = require('axios');

/**
 * Ollama嵌入函数类，用于与ChromaDB集成
 */
class OllamaEmbeddingFunction {
    constructor(baseUrl = 'http://localhost:11434', modelName = 'nomic-embed-text') {
        this.baseUrl = baseUrl.replace(/\/$/, ''); // 移除末尾斜杠
        this.modelName = modelName;

        // 验证配置
        if (!this.baseUrl) {
            throw new Error('Ollama服务器地址是必需的');
        }
        if (!this.modelName) {
            throw new Error('Ollama模型名称是必需的');
        }
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

            console.log(`[OllamaEmbedding] 开始为 ${texts.length} 个文本生成嵌入向量`);
            console.log(`[OllamaEmbedding] 使用模型: ${this.modelName}`);
            console.log(`[OllamaEmbedding] 服务器地址: ${this.baseUrl}`);

            // Ollama API通常支持批量处理，但为了稳定性，我们逐个处理
            const allEmbeddings = [];

            for (let i = 0; i < texts.length; i++) {
                const text = texts[i];

                try {
                    const response = await axios.post(`${this.baseUrl}/api/embeddings`, {
                        model: this.modelName,
                        prompt: text
                    }, {
                        timeout: 30000, // 30秒超时
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    });

                    if (response.data && response.data.embedding) {
                        allEmbeddings.push(response.data.embedding);
                        console.log(`[OllamaEmbedding] 已完成文本 ${i + 1}/${texts.length}`);
                    } else {
                        throw new Error(`响应格式错误: 缺少embedding字段`);
                    }
                } catch (error) {
                    console.error(`[OllamaEmbedding] 文本 ${i + 1} 嵌入失败:`, error.message);
                    throw new Error(`文本嵌入失败 (${i + 1}/${texts.length}): ${error.message}`);
                }
            }

            console.log(`[OllamaEmbedding] 嵌入向量生成完成，共 ${allEmbeddings.length} 个向量`);
            return allEmbeddings;

        } catch (error) {
            console.error('[OllamaEmbedding] 生成嵌入向量失败:', error);

            // 提供更详细的错误信息
            let errorMessage = 'Ollama嵌入失败';
            if (error.code === 'ECONNREFUSED') {
                errorMessage = `无法连接到Ollama服务器 (${this.baseUrl})，请确保Ollama正在运行`;
            } else if (error.code === 'ENOTFOUND') {
                errorMessage = `无法解析Ollama服务器地址 (${this.baseUrl})，请检查地址是否正确`;
            } else if (error.code === 'ECONNRESET') {
                errorMessage = '与Ollama服务器的连接被重置，请检查网络连接';
            } else if (error.response) {
                if (error.response.status === 404) {
                    errorMessage = `模型 "${this.modelName}" 不存在，请先在Ollama中运行: ollama pull ${this.modelName}`;
                } else if (error.response.status === 400) {
                    errorMessage = `请求参数错误: ${error.response.data?.error || '未知错误'}`;
                } else {
                    errorMessage = `Ollama服务器错误 (${error.response.status}): ${error.response.data?.error || '未知错误'}`;
                }
            } else {
                errorMessage = `Ollama嵌入失败: ${error.message}`;
            }

            throw new Error(errorMessage);
        }
    }

    /**
     * 测试Ollama连接和模型可用性
     * @returns {Promise<Object>} 测试结果
     */
    async testConnection() {
        try {
            console.log(`[OllamaEmbedding] 测试连接: ${this.baseUrl}`);

            // 首先测试服务器连接
            const response = await axios.get(`${this.baseUrl}/api/tags`, {
                timeout: 10000
            });

            if (!response.data || !response.data.models) {
                throw new Error('Ollama服务器响应格式错误');
            }

            // 检查模型是否存在
            const models = response.data.models.map(model => model.name);
            const modelExists = models.some(model => model.includes(this.modelName));

            if (!modelExists) {
                return {
                    success: false,
                    error: `模型 "${this.modelName}" 不存在。可用模型: ${models.join(', ')}`,
                    availableModels: models
                };
            }

            // 测试嵌入功能
            const testEmbedding = await this.generate(['Hello world']);

            return {
                success: true,
                message: `连接成功，模型 "${this.modelName}" 可用`,
                embeddingDimension: testEmbedding[0]?.length || 0,
                availableModels: models
            };

        } catch (error) {
            console.error('[OllamaEmbedding] 连接测试失败:', error);

            let errorMessage = '连接测试失败';
            if (error.code === 'ECONNREFUSED') {
                errorMessage = `无法连接到Ollama服务器 (${this.baseUrl})，请确保Ollama正在运行`;
            } else if (error.code === 'ENOTFOUND') {
                errorMessage = `无法解析Ollama服务器地址 (${this.baseUrl})`;
            } else if (error.response) {
                errorMessage = `Ollama服务器错误: ${error.response.status}`;
            } else {
                errorMessage = `连接测试失败: ${error.message}`;
            }

            return {
                success: false,
                error: errorMessage
            };
        }
    }

    /**
     * 获取可用的模型列表
     * @returns {Promise<Array>} 模型列表
     */
    async getAvailableModels() {
        try {
            const response = await axios.get(`${this.baseUrl}/api/tags`, {
                timeout: 10000
            });

            if (response.data && response.data.models) {
                // 过滤出支持嵌入的模型（通常包含embed关键字）
                const embeddingModels = response.data.models
                    .map(model => model.name)
                    .filter(name => name.includes('embed'));

                // 如果没有找到专门的嵌入模型，返回所有模型
                return embeddingModels.length > 0 ? embeddingModels : response.data.models.map(model => model.name);
            }

            return [];
        } catch (error) {
            console.error('[OllamaEmbedding] 获取模型列表失败:', error);
            return [];
        }
    }

    /**
     * ChromaDB兼容的嵌入方法
     * @param {string[]} texts 文本数组
     * @returns {Promise<number[][]>} 嵌入向量数组
     */
    async embedDocuments(texts) {
        return this.generate(texts);
    }

    /**
     * ChromaDB兼容的查询嵌入方法
     * @param {string} text 查询文本
     * @returns {Promise<number[]>} 嵌入向量
     */
    async embedQuery(text) {
        const embeddings = await this.generate([text]);
        return embeddings[0];
    }
}

module.exports = OllamaEmbeddingFunction;