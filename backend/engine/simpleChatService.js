const { getModelRegistry, initializeModelProvider } = require('./models/modelProvider');
const logger = require('../utils/logger');
const prompts = require('./prompts');
const contextManager = require('./contextManager');
const { state } = require('../state-manager');
const { getFileTree } = require('../utils/file-tree-builder');
const retriever = require('../rag-service/retriever');

const fs = require('fs').promises;
const path = require('path');
const { app } = require('electron');
const isDev = require('electron-is-dev');

// 统一获取 novel 目录路径的辅助函数
const getNovelPath = () => {
    if (isDev) {
        // 开发环境：位于项目根目录
        return path.join(app.getAppPath(), 'novel');
    } else {
        // 生产环境：位于 .exe 文件同级目录
        return path.join(path.dirname(app.getPath('exe')), 'novel');
    }
}

// 服务级别的状态，用于存储持久化设置
const serviceState = {
    isStreaming: true, // 默认为流式
    abortController: null, // 新增：用于中止请求的控制器
};

function setStreamingMode({ stream }) {
    console.log(`[SimpleChatService] 更新流式模式为: ${stream}`);
    serviceState.isStreaming = stream;
}

// 新增 getter 函数以安全地暴露状态
function getStreamingMode() {
    return serviceState.isStreaming;
}

// 新增：设置中止控制器
function setAbortController(controller) {
    serviceState.abortController = controller;
}

// 新增：中止当前请求
function abortCurrentRequest() {
    if (serviceState.abortController) {
        serviceState.abortController.abort();
        console.log('[SimpleChatService] 已中止当前请求');
        serviceState.abortController = null;
    }
}

let aiResponseSendCount = 0;

function resetResponseCount() {
    aiResponseSendCount = 0;
}

/**
 * 清理消息对象，移除非标准的OpenAI API字段
 * 只保留 role, content, name, tool_call_id, tool_calls 等标准字段
 * @param {Array} messages 原始消息数组
 * @returns {Array} 清理后的消息数组
 */
function sanitizeMessagesForAI(messages) {
    if (!Array.isArray(messages)) {
        return messages;
    }

    return messages.map(message => {
        if (!message || typeof message !== 'object') {
            return message;
        }

        // 只保留OpenAI API标准字段
        const sanitizedMessage = {
            role: message.role,
            content: message.content
        };

        // 可选的标准字段
        if (message.name) sanitizedMessage.name = message.name;
        if (message.tool_call_id) sanitizedMessage.tool_call_id = message.tool_call_id;
        if (message.tool_calls) sanitizedMessage.tool_calls = message.tool_calls;

        return sanitizedMessage;
    });
}

function _sendAiResponseToFrontend(type, payload) {
    if (state.mainWindow) {
        aiResponseSendCount++;
        const sendTimestamp = Date.now();
        // 跳过 tool_stream 和 text_stream 类型的日志打印，避免流式传输产生过多日志
        if (type !== 'tool_stream' && type !== 'text_stream') {
            console.log(`[SimpleChatService] Sending ai-response. Type: ${type}, Count: ${aiResponseSendCount}, Timestamp: ${sendTimestamp}, Payload:`, JSON.stringify(payload).substring(0, 500));
        }
        state.mainWindow.webContents.send('ai-response', { type, payload, sendTimestamp }); // 添加时间戳到 payload
    }
}

// 动态组合系统提示词（简化版，不包含工具说明）
function buildSystemPrompt(basePrompt, options = {}) {
    let prompt = basePrompt;
    
    // 新增：持久记忆信息
    if (options.additionalInfo) {
        const info = options.additionalInfo;
        let memoryContent = '\n\n[持久记忆信息]:\n';
        
        if (info.outline) {
            memoryContent += `\n【大纲】:\n${info.outline}\n`;
        }
        if (info.previousChapter) {
            memoryContent += `\n【上一章全文】:\n${info.previousChapter}\n`;
        }
        if (info.characterSettings) {
            memoryContent += `\n【本章重要人设】:\n${info.characterSettings}\n`;
        }
        
        prompt += memoryContent;
    }
    
    // RAG内容控制
    if (options.ragRetrievalEnabled && options.ragContent) {
        prompt += options.ragContent;
    }
    
    return prompt;
}

async function* chatWithAI(messages, modelId, customSystemPrompt, mode = 'general', ragRetrievalEnabled, aiParameters = {}) {
    console.log(`[SimpleChatService] 开始处理聊天请求:`, {
        modelId: modelId || '未指定',
        mode,
        ragRetrievalEnabled,
        customPromptLength: customSystemPrompt ? customSystemPrompt.length : 0,
        aiParameters: aiParameters
    });
    
    try {
        await initializeModelProvider(); // 确保 ModelProvider 已初始化
        const modelRegistry = getModelRegistry();
        const adapter = modelRegistry.getAdapterForModel(modelId);
        
        console.log('[SimpleChatService] 模型查找结果:', {
            requestedModel: modelId,
            adapterFound: !!adapter,
            adapterType: adapter ? adapter.constructor.name : '无适配器'
        });

        // 新增：获取上下文限制设置并应用
        let contextLimitSettings = null;
        try {
            const handlers = require('./ipc/handlers');
            const result = await handlers.handleGetContextLimitSettings();
            if (result.success) {
                contextLimitSettings = result.settings;
                console.log('[SimpleChatService] 已加载上下文限制设置:', contextLimitSettings);
            } else {
                console.warn('[SimpleChatService] 获取上下文限制设置失败，使用默认设置');
                contextLimitSettings = contextManager.defaultSettings;
            }
        } catch (error) {
            console.warn('[SimpleChatService] 获取上下文限制设置时出错，使用默认设置:', error.message);
            contextLimitSettings = contextManager.defaultSettings;
        }

        // 应用上下文限制（只对对话消息，不包括系统消息）
        const filteredMessages = contextManager.truncateMessages(
            messages,
            contextLimitSettings,
            mode,
            false // 不是RAG上下文
        );
        
        // 获取对话模型的上下文配置用于日志显示
        const chatContextConfig = contextManager.getContextConfig(contextLimitSettings, mode, false);
        console.log(`[SimpleChatService] 对话模型上下文约束: ${chatContextConfig.type === 'tokens' && chatContextConfig.value === 'full' ? '满tokens' : '附加' + chatContextConfig.value + '轮上下文'}, 原始消息 ${messages.length} 条, 过滤后 ${filteredMessages.length} 条`);

        // 初始化RAG检索器（从handlers.js的storeInstance获取）
        try {
            const handlers = require('./ipc/handlers');
            if (handlers.storeInstance) {
                await retriever.initialize(handlers.storeInstance);
            }
        } catch (error) {
            console.warn('[SimpleChatService] 无法获取storeInstance，RAG功能可能受限:', error.message);
        }

        if (!adapter) {
            const errorMessage = `模型 '${modelId}' 不可用或未注册。`;
            console.warn(`[SimpleChatService] chatWithAI: ${errorMessage}`);
            console.log('[SimpleChatService] 当前注册的模型映射:', Object.keys(modelRegistry.modelMapping));
            _sendAiResponseToFrontend('error', errorMessage);
            return { type: 'error', payload: errorMessage };
        }

        // 获取 novel 文件夹的文件结构
        const novelPath = getNovelPath();
        const fileTreeResult = await getFileTree(novelPath);
        let fileTreeContent = '';
        if (fileTreeResult && fileTreeResult.success) {
            const formatFileTree = (nodes, indent = 0) => {
                let result = '';
                for (const node of nodes) {
                    const prefix = ' '.repeat(indent * 2) + '- ';
                    result += `${prefix}${node.title}${(node.type === 'folder' ? '/' : '')}\n`;
                    if (node.children && node.children.length > 0) {
                        result += formatFileTree(node.children, indent + 1);
                    }
                }
                return result;
            };
            fileTreeContent = `\n\n[当前工作区文件结构 (novel 目录)]:\n${formatFileTree(fileTreeResult.tree)}\n`;
        } else {
            console.warn(`获取 novel 目录文件树失败: ${fileTreeResult.error}`);
            fileTreeContent = `\n\n[获取 novel 目录文件结构失败: ${fileTreeResult.error}]\n`;
        }

        const selectedSystemPrompt = prompts[mode] || prompts['general'];
        const effectiveSystemPrompt = customSystemPrompt && customSystemPrompt.trim() !== ''
                                      ? customSystemPrompt
                                      : selectedSystemPrompt;
        console.log(`[SimpleChatService] 系统提示词选择 - 模式: ${mode}, 自定义: "${customSystemPrompt}", 最终使用: "${effectiveSystemPrompt}"`);

        // 提取系统消息，如果存在
        const initialSystemMessage = filteredMessages.find(msg => msg.role === 'system');
        const effectiveInitialSystemPrompt = initialSystemMessage ? initialSystemMessage.content : '';

        // --- RAG检索注入 ---
        const lastUserMessage = filteredMessages.filter(m => m.role === 'user').pop();
        let ragContext = '';
        let retrievalInfo = null;
        
        // RAG检索控制：只有在启用时才执行检索
        if (lastUserMessage && lastUserMessage.content && ragRetrievalEnabled) {
            // 获取当前模式的RAG表选择设置
            let ragTableNames = null;
            try {
                const storeInstance = await getStoreInstance();
                const modeFeatureSettings = storeInstance.get('modeFeatureSettings') || {};
                const currentModeSettings = modeFeatureSettings[mode] || {};
                // 如果用户没有选择任何表，传递 null 而不是空数组
                ragTableNames = currentModeSettings.ragTableNames || null;
                
                console.log(`[SimpleChatService] RAG表选择设置 - 模式: ${mode}, 选择的表:`, ragTableNames);
            } catch (error) {
                console.warn('[SimpleChatService] 获取RAG集合设置失败，跳过RAG检索:', error.message);
            }
            
            // 获取存储的检索设置
            let retrievalTopK = 3; // 默认值
            try {
                const storeInstance = await getStoreInstance();
                retrievalTopK = storeInstance.get('retrievalTopK') || 3;
                console.log(`[SimpleChatService] 使用检索设置: topK=${retrievalTopK}`);
            } catch (error) {
                console.warn('[SimpleChatService] 获取检索设置失败，使用默认值:', error.message);
            }
            
            // 使用增强的检索功能，启用意图分析，并传递当前模式和选择的表
            const retrievalResult = await retriever.retrieve(messages, retrievalTopK, true, mode, ragTableNames);
            
            if (retrievalResult.documents && retrievalResult.documents.length > 0) {
                retrievalInfo = retrievalResult;
                
                // 根据模式提供差异化的引导语句
                let ragGuidance = '';
                if (mode === 'writing') {
                    ragGuidance = '这些内容主要作为文风、句式结构和描写方式的参考。请模仿其中的写作风格和表达方式。';
                } else if (mode === 'adjustment') {
                    ragGuidance = '这些内容主要作为风格一致性和语言表达的参考。请确保修改后的内容与参考风格保持一致。';
                } else if (mode === 'outline') {
                    ragGuidance = '这些内容主要作为情节结构和叙事手法的参考。可以参考其中的故事架构技巧。';
                } else {
                    ragGuidance = '这些内容仅供参考，请根据当前任务需求合理使用。';
                }
                
                // 构建RAG上下文
                ragContext = `\n\n[知识库参考内容]：
这是从知识库中检索到的相关内容，${ragGuidance}
请注意：这些内容可能与当前剧情无关，请谨慎参考，不要将其作为实际剧情内容。

检索到的参考内容：
${retrievalResult.documents.map(doc => `- ${doc}`).join('\n')}\n`;
                
                console.log('[SimpleChatService] 已成功注入增强的RAG上下文。');
                if (retrievalResult.isAnalyzed) {
                    console.log('[SimpleChatService] 意图分析已启用，检索优化完成');
                }
            }
        }
        // --- RAG检索结束 ---

        // 新增：获取附加信息（支持新旧数据格式）
        let additionalInfo = {};
        try {
            const StoreModule = await import('electron-store');
            const Store = StoreModule.default;
            const storeInstance = new Store();
            const additionalInfoData = storeInstance.get('additionalInfo') || {};
            const modeInfo = additionalInfoData[mode];
            
            if (typeof modeInfo === 'string') {
                // 旧格式：字符串，迁移到新格式
                additionalInfo = {
                    outline: modeInfo,
                    previousChapter: '',
                    characterSettings: ''
                };
                console.log('[SimpleChatService] 检测到旧格式附加信息，已迁移到新格式，模式:', mode);
            } else if (typeof modeInfo === 'object' && modeInfo !== null) {
                // 新格式：对象
                additionalInfo = {
                    outline: modeInfo.outline || '',
                    previousChapter: modeInfo.previousChapter || '',
                    characterSettings: modeInfo.characterSettings || ''
                };
                console.log('[SimpleChatService] 已加载新格式附加信息，模式:', mode);
            } else {
                // 空数据
                additionalInfo = {
                    outline: '',
                    previousChapter: '',
                    characterSettings: ''
                };
            }
            
            console.log('[SimpleChatService] 附加信息详情:', {
                outlineLength: additionalInfo.outline.length,
                previousChapterLength: additionalInfo.previousChapter.length,
                characterSettingsLength: additionalInfo.characterSettings.length
            });
        } catch (error) {
            console.warn('[SimpleChatService] 获取附加信息失败:', error.message);
            additionalInfo = {
                outline: '',
                previousChapter: '',
                characterSettings: ''
            };
        }

        // 使用动态提示词组合构建最终系统消息（不包含工具说明）
        const systemMessageContent = buildSystemPrompt(effectiveSystemPrompt, {
            ragRetrievalEnabled: ragRetrievalEnabled,
            ragContent: ragContext ? `${fileTreeContent}${ragContext}` : fileTreeContent,
            additionalInfo: additionalInfo
        });

        // **关键修复**: 移除不安全的 .map() 重构。
        // 直接过滤掉旧的 system 消息，然后 unshift 添加新的。
        const messagesToSend = filteredMessages.filter(msg => msg.role !== 'system');
        messagesToSend.unshift({ role: "system", content: systemMessageContent, name: "system" });

        // **新增**: 清理消息，移除非标准的OpenAI API字段
        const sanitizedMessages = sanitizeMessagesForAI(messagesToSend);
        console.log('[SimpleChatService] 消息清理完成，移除非标准字段');
        
        // 合并默认参数和前端传递的参数
        const defaultAiParameters = {
            temperature: 0.7,
            top_p: 0.7,
            n: 1
        };
        
        // 新增：详细的参数合并调试日志
        console.log(`[DEBUG][SimpleChatService] 参数合并调试信息:`);
        console.log(`  - 前端传入的aiParameters:`, JSON.stringify(aiParameters, null, 2));
        console.log(`  - 默认参数defaultAiParameters:`, JSON.stringify(defaultAiParameters, null, 2));
        
        const mergedAiParameters = { ...defaultAiParameters, ...aiParameters };
        
        console.log(`  - 合并后的mergedAiParameters:`, JSON.stringify(mergedAiParameters, null, 2));
        console.log(`  - 最终参数值:`);
        console.log(`    * temperature: ${mergedAiParameters.temperature} (默认: ${defaultAiParameters.temperature})`);
        console.log(`    * top_p: ${mergedAiParameters.top_p} (默认: ${defaultAiParameters.top_p})`);
        console.log(`    * n: ${mergedAiParameters.n} (默认: ${defaultAiParameters.n})`);
        
        // 完整的请求参数（服务层显示完整参数，但让适配器处理实际值）
        const requestOptions = {
            model: modelId,
            stream: serviceState.isStreaming, // 使用服务级别状态
            temperature: mergedAiParameters.temperature,
            top_p: mergedAiParameters.top_p,
            n: mergedAiParameters.n
        };
        
        // 打印完整的请求参数（服务层显示）
        console.log('[SimpleChatService] 服务层请求参数:', JSON.stringify(requestOptions, null, 2));
        
        // 打印完整的消息内容（显示完整的AI请求体）
        console.log('[SimpleChatService] 完整的AI请求体 - 消息内容:');
        sanitizedMessages.forEach((msg, index) => {
            console.log(`[SimpleChatService] 消息 ${index + 1} (${msg.role}):`);
            if (msg.role === 'system') {
                // 显示完整的系统消息内容，便于诊断问题
                const content = msg.content || '';
                console.log(`  完整内容: ${content}`);
            } else {
                console.log(`  内容: ${msg.content || '(空)'}`);
            }
            if (msg.tool_calls) {
                console.log(`  工具调用: ${JSON.stringify(msg.tool_calls, null, 2)}`);
            }
            if (msg.tool_call_id) {
                console.log(`  工具调用ID: ${msg.tool_call_id}`);
            }
            console.log(''); // 空行分隔
        });
        
        // 实际传递给适配器的参数（让适配器处理默认值）
        const adapterOptions = {
            model: modelId,
            stream: serviceState.isStreaming
            // 其他参数由适配器处理默认值
        };
        
        const aiResponse = await adapter.generateCompletion(sanitizedMessages, adapterOptions);

        let fullAssistantContent = "";
        let finalReasoningContent = "";
        let lastUsage = null;
        let currentSessionId = state.conversationHistory.length > 0
            ? state.conversationHistory[0].sessionId
            : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        if (serviceState.isStreaming) {
            for await (const chunk of aiResponse) {
                if (chunk.type === "text") {
                    fullAssistantContent += chunk.text;
                    yield { type: "text", content: chunk.text };
                } else if (chunk.type === "reasoning") {
                    finalReasoningContent += chunk.text;
                    yield { type: "reasoning", content: chunk.text };
                } else if (chunk.type === "usage") {
                    lastUsage = chunk;
                    yield { type: "usage", content: chunk };
                }
            }
        } else {
            // 非流式处理，但 adapter 仍然返回一个生成器，需要迭代它来构建完整响应
            for await (const chunk of aiResponse) {
                if (chunk.type === "text") {
                    fullAssistantContent += chunk.text || '';
                    if (chunk.reasoning_content) {
                        finalReasoningContent += chunk.reasoning_content;
                    }
                } else if (chunk.type === "usage") {
                    lastUsage = chunk;
                }
            }
            
            // 模拟流式输出，以便下游代码统一处理
            if (fullAssistantContent) {
                yield { type: "text", content: fullAssistantContent };
            }
            if (lastUsage) {
                yield { type: "usage", content: lastUsage };
            }
        }

        // 在流结束后，将完整的 assistant 消息添加到 conversationHistory
        const messageToStore = {
            role: "assistant",
            content: fullAssistantContent || null,
            reasoning_content: finalReasoningContent || null,
            sessionId: currentSessionId
        };
        state.conversationHistory.push(messageToStore);

        // 如果有推理内容，发送给前端
        if (finalReasoningContent) {
            _sendAiResponseToFrontend('reasoning_content', {
                content: finalReasoningContent,
                sessionId: currentSessionId
            });
        }

        if (!fullAssistantContent) {
            _sendAiResponseToFrontend('error', 'AI 没有给出明确的回复。');
            yield { type: 'error', payload: 'AI 没有给出明确的回复。' };
        }

        await logger.logAiConversation(currentSessionId);
        yield { type: 'processed', payload: 'AI 响应已处理' }; // 最终的成功标记

    } catch (error) {
        console.error(`[SimpleChatService] 处理消息时出错: ${error.message}`);
        _sendAiResponseToFrontend('error', `处理消息时出错: ${error.message}`);
        throw error;
    }
}

async function processUserMessage(message, sessionId, currentMessages, mode, customPrompt, ragRetrievalEnabled, model, aiParameters = {}) {
    // This function will contain the core logic from handleProcessCommand
    state.conversationHistory = currentMessages || [];
    
    console.log(`[SimpleChatService] processUserMessage: 使用模型: ${model}`);
    console.log(`[DEBUG] RAG检索状态 - 前端传递: ${ragRetrievalEnabled}, 模式: ${mode}`);
    
    // Append the latest user message if it's not already there
    if (!state.conversationHistory.some(msg => msg.content === message && msg.role === 'user')) {
        const latestMessage = { role: 'user', content: message, sessionId: sessionId, id: `${Date.now()}` };
        state.conversationHistory.push(latestMessage);
    }
    
    resetResponseCount();
    
    const storeModule = await import('electron-store');
    const store = new storeModule.default();
    // 优先使用前端传递的模型，如果没有则使用存储中的模型
    const storedSelectedModel = store.get('selectedModel');
    const storedDefaultModel = store.get('selectedModel');
    const defaultModelId = model || storedSelectedModel || storedDefaultModel || '';
    
    console.log(`[SimpleChatService] processUserMessage: 模型选择详情 -`);
    console.log(`  前端传递的模型: ${model || '未提供'}`);
    console.log(`  存储的selectedModel: ${storedSelectedModel || '未设置'}`);
    console.log(`  存储的selectedModel: ${storedDefaultModel || '未设置'}`);
    console.log(`  最终使用的模型ID: ${defaultModelId || '未设置模型'}`);
    
    // 记录完整的存储状态用于调试
    console.log('[SimpleChatService] 当前存储中的相关设置:', {
        selectedModel: store.get('selectedModel'),
        selectedProvider: store.get('selectedProvider'),
        deepseekApiKey: store.get('deepseekApiKey') ? '已设置' : '未设置',
        openrouterApiKey: store.get('openrouterApiKey') ? '已设置' : '未设置'
    });

    const validHistory = state.conversationHistory.filter(msg =>
        msg && msg.role && (msg.content || msg.tool_calls)
    );

    try {
        // 创建AbortController用于停止功能
        const abortController = new AbortController();
        setAbortController(abortController);
        
        // 通知前端开始流式传输
        _sendAiResponseToFrontend('streaming_started', { sessionId: sessionId });
        
        // 新增：详细的AI参数调试日志
        console.log(`[DEBUG][SimpleChatService] AI参数详细调试信息:`);
        console.log(`  - 原始aiParameters对象:`, JSON.stringify(aiParameters, null, 2));
        console.log(`  - temperature: ${aiParameters?.temperature ?? '未设置'}`);
        console.log(`  - top_p: ${aiParameters?.top_p ?? '未设置'}`);
        console.log(`  - n: ${aiParameters?.n ?? '未设置'}`);
        
        const stream = chatWithAI(validHistory, defaultModelId, customPrompt, mode, ragRetrievalEnabled, aiParameters);
        for await (const chunk of stream) {
            // 检查是否被中止
            if (abortController.signal.aborted) {
                console.log('[SimpleChatService] 请求已被中止，停止处理流式响应');
                break;
            }
            
            if (chunk.type === 'text') {
                if (getStreamingMode()) {
                    _sendAiResponseToFrontend('text_stream', { content: chunk.content, sessionId: sessionId });
                } else {
                    _sendAiResponseToFrontend('text', { content: chunk.content, sessionId: sessionId });
                }
            }
        }
        if (getStreamingMode() && !abortController.signal.aborted) {
            _sendAiResponseToFrontend('text_stream_end', null);
        }
        
        // 通知前端流式传输已结束
        _sendAiResponseToFrontend('streaming_ended', { sessionId: sessionId });
        
        // 清理AbortController
        setAbortController(null);
        
    } catch (error) {
        console.error('调用聊天服务失败:', error);
        _sendAiResponseToFrontend('error', `调用聊天服务失败: ${error.message}`);
        // 清理AbortController
        setAbortController(null);
    }
}

// 辅助函数：获取存储实例
async function getStoreInstance() {
    const StoreModule = await import('electron-store');
    const Store = StoreModule.default;
    return new Store();
}

module.exports = {
    chatWithAI,
    resetResponseCount,
    _sendAiResponseToFrontend,
    setStreamingMode,
    getStreamingMode,
    processUserMessage,
    abortCurrentRequest, // 新增：导出停止功能
    setAbortController, // 新增：导出设置中止控制器
}
