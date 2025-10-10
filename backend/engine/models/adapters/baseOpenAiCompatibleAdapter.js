const BaseModelAdapter = require('./baseAdapter');
const OpenAI = require('openai');
const { AzureOpenAI } = require('openai');

const azureOpenAiDefaultApiVersion = "2024-05-01-preview";

// 假设的 ApiStream 类型定义，后续可以根据实际需求完善
/**
 * @typedef {AsyncGenerator<Object, void, unknown>} ApiStream
 */

// 假设的 convertToOpenAiMessages 函数，后续可以根据实际需求完善
// 它的作用是将输入的消息格式转换为 OpenAI API 所需的消息格式
function convertToOpenAiMessages(messages) {
    if (!Array.isArray(messages)) {
        console.error("Invalid 'messages' argument: not an array.", messages);
        return [];
    }

    return messages.map(msg => {
        if (!msg || !msg.role) {
            return null; // Skip invalid messages
        }

        const messagePayload = { role: msg.role };

        // Handle tool messages
        if (msg.role === 'tool') {
            if (!msg.tool_call_id || !msg.name) {
                console.warn("Skipping invalid tool message:", msg);
                return null;
            }
            messagePayload.tool_call_id = msg.tool_call_id;
            messagePayload.name = msg.name;
            messagePayload.content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
            return messagePayload;
        }

        // Handle assistant messages (content can be null, tool_calls can exist)
        if (msg.role === 'assistant') {
            // Content can be null if there are only tool calls
            messagePayload.content = msg.content || null;
            if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
                messagePayload.tool_calls = msg.tool_calls;
            }
            return messagePayload;
        }

        // Handle user and system messages (must have content)
        if (!msg.content) {
             // For user/system, content is required. For assistant, it's optional if tool_calls are present.
            if(msg.role !== 'assistant') {
                console.warn("Skipping message with no content:", msg);
                return null;
            }
        }
        
        if (typeof msg.content === "string") {
            messagePayload.content = msg.content;
        } else if (Array.isArray(msg.content)) { // Handle multimodal content
            messagePayload.content = msg.content.map(part => {
                if (part.type === "image") {
                    return {
                        type: "image_url",
                        image_url: { url: `data:${part.source.media_type};base64,${part.source.data}` },
                    };
                }
                return { type: "text", text: part.text };
            });
        } else {
            // Fallback for other content types
            messagePayload.content = String(msg.content);
        }

        // Add name field if it exists (e.g., for system messages)
        if (msg.name) {
            messagePayload.name = msg.name;
        }

        return messagePayload;
    }).filter(Boolean); // Filter out any null (invalid) messages
}

// 假设的 DEFAULT_HEADERS，后续可以根据实际需求完善
const DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
};

/**
 * @typedef {Object} ModelInfo
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string} provider
 * @property {number} [maxTokens]
 * @property {number} [reasoningEffort]
 */

/**
 * @typedef {Object} ApiHandlerOptions
 * @property {string} [apiKey]
 * @property {string} [apiModelId]
 * @property {number} [modelTemperature]
 * @property {Object} [openAiCustomModelInfo]
 * @property {boolean} [openAiStreamingEnabled]
 * @property {string} [azureApiVersion]
 * @property {boolean} [openAiUseAzure]
 */

/**
 * @typedef {Object} BaseOpenAiCompatibleProviderOptions
 * @property {string} providerName
 * @property {string} baseURL
 * @property {string} defaultProviderModelId
 * @property {Record<string, ModelInfo>} providerModels
 * @property {number} [defaultTemperature]
 * @property {string} [apiKey]
 * @property {string} [apiModelId]
 * @property {number} [modelTemperature]
 * @property {Object} [openAiCustomModelInfo]
 * @property {boolean} [openAiStreamingEnabled]
 */

class BaseOpenAiCompatibleAdapter extends BaseModelAdapter {
    /**
     * @param {BaseOpenAiCompatibleProviderOptions} options
     */
    constructor(options) {
        super();
        this.providerName = options.providerName;
        this.baseURL = options.baseURL;
        this.defaultProviderModelId = options.defaultProviderModelId;
        this.providerModels = options.providerModels;
        this.defaultTemperature = options.defaultTemperature ?? 0;

        this.options = options;

        this.client = null; // 延迟初始化
    }

    _getClient() {
        if (this.client) {
            return this.client;
        }

        if (!this.options.apiKey) {
            throw new Error(`[${this.providerName}] API Key is not set. Please configure it in the settings.`);
        }

        const isAzureAiInference = this._isAzureAiInference(this.baseURL);
        const urlHost = this._getUrlHost(this.baseURL);
        const isAzureOpenAi = urlHost.includes("azure.com") || urlHost.endsWith(".azure.com") || this.options.openAiUseAzure;

        if (isAzureAiInference) {
            this.client = new OpenAI({
                baseURL: this.baseURL,
                apiKey: this.options.apiKey,
                defaultHeaders: DEFAULT_HEADERS,
                timeout: 30000,
                maxRetries: 2,
                defaultQuery: { "api-version": this.options.azureApiVersion || azureOpenAiDefaultApiVersion },
            });
        } else if (isAzureOpenAi) {
            this.client = new AzureOpenAI({
                baseURL: this.baseURL,
                apiKey: this.options.apiKey,
                apiVersion: this.options.azureApiVersion || azureOpenAiDefaultApiVersion,
                defaultHeaders: DEFAULT_HEADERS,
                timeout: 30000,
                maxRetries: 2,
            });
        } else {
            this.client = new OpenAI({
                baseURL: this.baseURL,
                apiKey: this.options.apiKey,
                defaultHeaders: DEFAULT_HEADERS,
                timeout: 30000,
                maxRetries: 2,
            });
        }
        return this.client;
    }

    /**
     * @param {Array<Object>} allMessages - A comprehensive array of messages, which may include a system prompt.
     * @param {Object} [options={}] - Additional options for the completion request.
     * @param {Array<Object>} [options.tools] - A list of tools the model may call.
     * @param {string|Object} [options.tool_choice] - Controls which tool the model should use.
     * @returns {AsyncGenerator<Object, void, unknown>} An asynchronous generator yielding AI response chunks.
     */
    async *generateCompletion(allMessages, options = {}) {
        if (!Array.isArray(allMessages)) {
            throw new TypeError('The "allMessages" argument must be an array.');
        }

        const { id: model, info: modelInfo } = this.getModel();
        const temperature = this.options.modelTemperature ?? this.defaultTemperature;
        const processedMessages = convertToOpenAiMessages(allMessages);

        // 新增：适配器层参数调试日志
        console.log(`[DEBUG][${this.providerName}Adapter] 适配器参数调试信息:`);
        console.log(`  - 模型ID: ${model}`);
        console.log(`  - 适配器温度设置: ${this.options.modelTemperature ?? '未设置'} (使用默认: ${this.defaultTemperature})`);
        console.log(`  - 最终温度值: ${temperature}`);
        console.log(`  - 消息数量: ${processedMessages.length}`);
        console.log(`  - 传入的options参数:`, JSON.stringify(options, null, 2));
        console.log(`  - options.tools数量: ${options.tools?.length ?? 0}`);
        console.log(`  - options.tool_choice: ${options.tool_choice}`);
        console.log(`  - options.stream: ${options.stream}`);
        console.log(`  - options.temperature: ${options.temperature}`);
        console.log(`  - options.top_p: ${options.top_p}`);
        console.log(`  - options.n: ${options.n}`);

        const params = {
            model: model,
            max_tokens: modelInfo.maxTokens,
            temperature: options.temperature ?? temperature, // 前端参数优先
            messages: processedMessages,
            stream: true,
            tools: options.tools,
            tool_choice: options.tool_choice,
            top_p: options.top_p,              // 新增：传递top_p
            n: options.n,                      // 新增：传递n
            ...(this._isGrokXAI(this.baseURL) ? {} : { stream_options: { include_usage: true } }),
        };

        console.log(`[DEBUG][${this.providerName}Adapter] 最终发送到API的参数:`);
        console.log(`  - model: ${params.model}`);
        console.log(`  - temperature: ${params.temperature}`);
        console.log(`  - stream: ${params.stream}`);
        console.log(`  - max_tokens: ${params.max_tokens}`);
        console.log(`  - tools数量: ${params.tools?.length ?? 0}`);
        console.log(`  - tool_choice: ${params.tool_choice}`);
        console.log(`  - 其他参数:`, JSON.stringify({
            top_p: options.top_p,
            n: options.n
        }, null, 2));

        const client = this._getClient();
        console.log(`[DEBUG][${this.providerName}Adapter] 开始调用API...`);
        const stream = await client.chat.completions.create(params);
        console.log(`[DEBUG][${this.providerName}Adapter] API调用成功，开始流式响应`);

        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta;

            if (delta?.content) {
                yield {
                    type: "text",
                    text: delta.content,
                };
            }
 
            if (delta?.tool_calls) {
                yield {
                    type: "tool_calls",
                    tool_calls: delta.tool_calls,
                };
            }

             if (chunk.usage) {
                 yield this.processUsageMetrics(chunk.usage);
             }
        }
    }

    processUsageMetrics(usage) {
        return {
            type: "usage",
            inputTokens: usage?.prompt_tokens || 0,
            outputTokens: usage?.completion_tokens || 0,
            cacheWriteTokens: usage?.cache_creation_input_tokens || undefined,
            cacheReadTokens: usage?.cache_read_input_tokens || undefined,
        };
    }

    /**
     * @param {string} prompt
     * @returns {Promise<string>}
     */
    async completePrompt(prompt) {
        const { id: modelId } = this.getModel();

        try {
            const client = this._getClient();
            const response = await client.chat.completions.create({
                model: modelId,
                messages: [{ role: "user", content: prompt }],
            });

            return response.choices[0]?.message.content || "";
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`${this.providerName} completion error: ${error.message}`);
            }

            throw error;
        }
    }

    /**
     * @returns {{id: string, info: ModelInfo}}
     */
    getModel() {
        const id =
            this.options.apiModelId && this.options.apiModelId in this.providerModels
                ? this.options.apiModelId
                : this.defaultProviderModelId;

        return { id, info: this.providerModels[id] };
    }

    // BaseModelAdapter 要求的抽象方法
    listModels() {
        return Object.values(this.providerModels);
    }

    getModelInfo(modelId) {
        const model = this.providerModels[modelId];
        if (!model) {
            throw new Error(`模型 '${modelId}' 不存在于 ${this.providerName} 中。`);
        }
        return model;
    }

    _getUrlHost(baseUrl) {
        try {
            return new URL(baseUrl ?? "").host;
        } catch (error) {
            return "";
        }
    }

    _isGrokXAI(baseUrl) {
        const urlHost = this._getUrlHost(baseUrl);
        return urlHost.includes("x.ai");
    }

    _isAzureAiInference(baseUrl) {
        const urlHost = this._getUrlHost(baseUrl);
        // Azure AI Inference Service 的常见域名模式
        return urlHost.endsWith(".openai.azure.com") || urlHost.endsWith(".services.ai.azure.com");
    }
}

module.exports = BaseOpenAiCompatibleAdapter;