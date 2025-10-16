const { getModelRegistry, initializeModelProvider } = require('../engine/models/modelProvider');

/**
 * 意图分析器 - 分析用户细纲并生成标签化的检索词
 * 使用用户选择的模型进行意图识别和标签提取
 */
class IntentAnalyzer {
    constructor() {
        if (IntentAnalyzer.instance) {
            return IntentAnalyzer.instance;
        }
        
        // 默认意图分析提示词模板
        this.defaultPrompt = `你是一个专业的写作助手，请分析先前的所有对话，总结一篇精简的细纲，约300字`;
        this.analysisPrompt = this.defaultPrompt;

        this.storeInstance = null;
        IntentAnalyzer.instance = this;
    }

    /**
     * 设置存储实例
     * @param {Object} store electron-store实例
     */
    setStore(store) {
        this.storeInstance = store;
    }

    /**
     * 获取默认的意图分析模型
     * @returns {string} 模型ID
     */
    getDefaultAnalysisModel() {
        if (!this.storeInstance) {
            return 'deepseek-chat'; // 默认回退
        }
        
        // 优先使用用户配置的意图分析模型
        const intentAnalysisModel = this.storeInstance.get('intentAnalysisModel');
        if (intentAnalysisModel) {
            return intentAnalysisModel;
        }
        
        // 其次使用默认AI模型
        const defaultModel = this.storeInstance.get('selectedModel') || this.storeInstance.get('selectedModel');
        if (defaultModel) {
            return defaultModel;
        }
        
        // 最后回退到deepseek-chat
        return 'deepseek-chat';
    }

    /**
     * 检查模型是否可用
     * @param {string} modelId 模型ID
     * @returns {Promise<boolean>} 是否可用
     */
    async checkModelAvailability(modelId) {
        try {
            const modelRegistry = getModelRegistry();
            const adapter = modelRegistry.getAdapterForModel(modelId);
            return adapter !== null;
        } catch (error) {
            console.error('[IntentAnalyzer] 检查模型可用性失败:', error);
            return false;
        }
    }

    /**
     * 设置自定义提示词
     * @param {string} prompt 自定义提示词
     */
    setCustomPrompt(prompt) {
        if (prompt && prompt.trim()) {
            this.analysisPrompt = prompt.trim();
        } else {
            this.analysisPrompt = this.defaultPrompt;
        }
        
        // 保存到存储
        if (this.storeInstance) {
            this.storeInstance.set('intentAnalysisPrompt', this.analysisPrompt);
        }
    }

    /**
     * 获取当前使用的提示词
     * @returns {string} 当前提示词
     */
    getCurrentPrompt() {
        if (this.storeInstance) {
            const storedPrompt = this.storeInstance.get('intentAnalysisPrompt');
            if (storedPrompt) {
                this.analysisPrompt = storedPrompt;
            }
        }
        return this.analysisPrompt;
    }

    /**
     * 重置为默认提示词
     */
    resetToDefaultPrompt() {
        this.analysisPrompt = this.defaultPrompt;
        if (this.storeInstance) {
            this.storeInstance.delete('intentAnalysisPrompt');
        }
    }

    /**
     * 生成完整的提示词
     * @param {string} outline 用户细纲
     * @returns {string} 完整的提示词
     */
    generatePrompt(outline) {
        return this.getCurrentPrompt();
    }


    /**
     * 分析对话历史并生成检索标签（用于聊天流程）
     * @param {Array} messages 完整的对话消息数组
     * @param {string} modelId 使用的模型ID（可选，如果未提供则使用默认模型）
     * @returns {Promise<Object>} 包含标签和检索词的对象
     */
    async analyzeConversation(messages, modelId = null) {
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return {
                tags: {},
                searchQuery: '小说描写',
                success: false,
                error: '消息内容为空'
            };
        }

        // 提取最后一条用户消息作为细纲内容
        const userMessages = messages.filter(msg => msg.role === 'user');
        const outline = userMessages.length > 0 ? userMessages[userMessages.length - 1].content : '';
        
        if (!outline || outline.trim().length === 0) {
            return {
                tags: {},
                searchQuery: '小说描写',
                success: false,
                error: '细纲内容为空'
            };
        }

        try {
            // 确定使用的模型
            const targetModelId = modelId || this.getDefaultAnalysisModel();
            
            // 检查模型可用性
            const isModelAvailable = await this.checkModelAvailability(targetModelId);
            if (!isModelAvailable) {
                throw new Error(`模型 '${targetModelId}' 不可用或未配置API Key`);
            }

            console.log(`[IntentAnalyzer] 开始分析对话历史 (模型: ${targetModelId}): "${outline.substring(0, 50)}..."`);
            console.log(`[IntentAnalyzer] 接收到的消息数量: ${messages.length}`);
            
            // 生成提示词并调用AI模型
            const prompt = this.generatePrompt(outline);
            
            // 构建完整的消息上下文：自定义提示词作为系统提示词 + 对话历史
            const messagesToSend = [
                { role: "system", content: prompt }, // 自定义提示词作为系统提示词
                ...messages // 包含完整的对话历史
            ];
            
            console.log(`[IntentAnalyzer] 发送给意图识别模型的消息数量: ${messagesToSend.length}`);
            
            // 打印每条消息的详细信息
            console.log('[IntentAnalyzer] 消息内容详情:');
            messagesToSend.forEach((msg, index) => {
                console.log(`[IntentAnalyzer] 消息 ${index + 1} (${msg.role}):`);
                console.log(`[IntentAnalyzer]   内容: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`);
                console.log(`[IntentAnalyzer]   长度: ${msg.content.length} 字符`);
            });
            
            // 直接使用模型适配器进行调用（避免循环依赖）
            let fullResponse = '';
            
            // 确保模型提供者已初始化
            await initializeModelProvider();
            const modelRegistry = getModelRegistry();
            const adapter = modelRegistry.getAdapterForModel(targetModelId);
            
            if (!adapter) {
                throw new Error(`模型 '${targetModelId}' 不可用或未注册。`);
            }
            
            // 使用适配器的generateCompletion方法（使用非流式模式）
            console.log(`[IntentAnalyzer] 调用模型 ${targetModelId} 生成完成...`);
            const stream = adapter.generateCompletion(messagesToSend, {
                model: targetModelId,
                temperature: 0.1, // 低温度确保确定性输出
                max_tokens: 500,
                stream: false // 明确设置为非流式模式
            });
            
            console.log(`[IntentAnalyzer] generateCompletion 返回类型: ${typeof stream}`);
            console.log(`[IntentAnalyzer] 是否为Promise: ${stream && typeof stream.then === 'function'}`);
            console.log(`[IntentAnalyzer] 是否为AsyncIterable: ${stream && typeof stream[Symbol.asyncIterator] === 'function'}`);
            
            // 统一处理流式和非流式结果
            if (stream && typeof stream[Symbol.asyncIterator] === 'function') {
                // 流式结果 - 使用异步迭代
                console.log('[IntentAnalyzer] 使用异步迭代处理流式结果');
                try {
                    for await (const chunk of stream) {
                        console.log(`[IntentAnalyzer] 收到chunk类型: ${chunk.type}`);
                        if (chunk.type === 'text') {
                            const content = chunk.content || chunk.text || '';
                            fullResponse += content;
                            console.log(`[IntentAnalyzer] 收到文本内容: ${content.substring(0, 50)}...`);
                        } else if (chunk.type === 'error') {
                            throw new Error(chunk.payload);
                        }
                        // 忽略其他类型的chunk（如usage、tool_calls等）
                    }
                } catch (iterateError) {
                    console.error('[IntentAnalyzer] 异步迭代失败:', iterateError);
                    throw iterateError;
                }
            } else if (stream && typeof stream.then === 'function') {
                // Promise结果 - 等待解析
                console.log('[IntentAnalyzer] 处理Promise结果');
                try {
                    const result = await stream;
                    console.log(`[IntentAnalyzer] Promise解析结果类型: ${typeof result}`);
                    console.log(`[IntentAnalyzer] 结果对象结构:`, JSON.stringify(result, null, 2).substring(0, 200));
                    
                    // 处理 OpenAI 兼容的响应格式
                    if (result && result.choices && Array.isArray(result.choices) && result.choices.length > 0) {
                        const message = result.choices[0].message;
                        if (message && message.content) {
                            fullResponse = message.content;
                            console.log(`[IntentAnalyzer] 提取到OpenAI格式内容: ${fullResponse.substring(0, 50)}...`);
                        } else {
                            console.warn('[IntentAnalyzer] OpenAI响应格式正确但内容为空');
                        }
                    } else if (result && result.content) {
                        fullResponse = result.content;
                    } else if (result && result.text) {
                        fullResponse = result.text;
                    } else if (typeof result === 'string') {
                        fullResponse = result;
                    } else {
                        console.warn('[IntentAnalyzer] 未知的Promise结果格式:', result);
                        fullResponse = String(result || '');
                    }
                } catch (promiseError) {
                    console.error('[IntentAnalyzer] Promise处理失败:', promiseError);
                    throw promiseError;
                }
            } else {
                // 其他情况 - 直接赋值
                console.warn('[IntentAnalyzer] 未知的返回类型:', typeof stream, stream);
                fullResponse = String(stream || '');
            }
            
            console.log(`[IntentAnalyzer] 完整响应长度: ${fullResponse.length}`);

            if (!fullResponse) {
                throw new Error('模型返回空响应');
            }

            // 直接使用AI返回的细纲作为检索查询词
            const searchQuery = fullResponse.trim();
            
            console.log(`[IntentAnalyzer] 分析完成 - 生成的细纲: "${searchQuery.substring(0, 50)}..."`);
            console.log(`[IntentAnalyzer] 使用模型: ${targetModelId}`);
            
            return {
                tags: {},
                searchQuery,
                modelUsed: targetModelId,
                success: true
            };
            
        } catch (error) {
            console.error('[IntentAnalyzer] 分析失败:', error);
            return {
                tags: {},
                searchQuery: '小说描写',
                success: false,
                error: error.message
            };
        }
    }

}

module.exports = new IntentAnalyzer();