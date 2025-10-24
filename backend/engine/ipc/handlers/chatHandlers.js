const { ipcMain } = require('electron');
const chatService = require('../chatService');
const simpleChatService = require('../simpleChatService');
const { state, setSessionState, getSessionState } = require('../../../state-manager');
const { getCheckpointDirs } = require('./sharedUtils');
const checkpointService = require('../../../../dist-backend/checkpoint-service');

let storeInstance = null;

// 处理用户命令
const handleProcessCommand = async (event, { message, sessionId, currentMessages, mode, customPrompt, toolUsageEnabled, ragRetrievalEnabled, model, aiParameters }) => {
    console.log(`[chatHandlers.js] handleProcessCommand: Received command: "${message}", Mode: ${mode}, Custom Prompt: "${customPrompt}", RAG Retrieval Enabled: ${ragRetrievalEnabled}, Model: ${model}, AI Parameters:`, aiParameters);
    console.log(`[chatHandlers.js] Custom Prompt type: ${typeof customPrompt}, length: ${customPrompt ? customPrompt.length : 0}`);
    
    // 新增：详细的AI参数调试日志
    console.log(`[DEBUG][chatHandlers.js] AI参数详细调试信息:`);
    console.log(`  - 原始aiParameters对象:`, JSON.stringify(aiParameters, null, 2));
    console.log(`  - temperature: ${aiParameters?.temperature ?? '未设置'}`);
    console.log(`  - top_p: ${aiParameters?.top_p ?? '未设置'}`);
    console.log(`  - n: ${aiParameters?.n ?? '未设置'}`);
    console.log(`  - stream: ${aiParameters?.stream ?? '未设置'}`);
    console.log(`  - aiParameters类型: ${typeof aiParameters}`);
    console.log(`  - aiParameters是否为null: ${aiParameters === null}`);
    console.log(`  - aiParameters是否为undefined: ${aiParameters === undefined}`);
    
    // 根据模式选择服务：通用模式使用chatService，其他模式使用simpleChatService
    const isGeneralMode = mode === 'general';
    const targetService = isGeneralMode ? chatService : simpleChatService;
    
    console.log(`[chatHandlers.js] 模式路由: ${mode} -> ${isGeneralMode ? 'chatService (通用模式)' : 'simpleChatService (其他模式)'}`);
    
    // 优先使用存储中的模型设置，而不是前端传递的模型参数
    let finalModel = model;
    try {
        if (!storeInstance) {
            const StoreModule = await import('electron-store');
            const Store = StoreModule.default;
            storeInstance = new Store();
        }
        
        const storedModel = storeInstance.get('selectedModel');
        if (storedModel) {
            console.log(`[chatHandlers.js] 使用存储中的模型设置: ${storedModel} (替代前端传递的: ${model})`);
            finalModel = storedModel;
        } else {
            console.log(`[chatHandlers.js] 存储中没有模型设置，使用前端传递的模型: ${model}`);
        }
    } catch (error) {
        console.error(`[chatHandlers.js] 获取存储模型设置失败，使用前端模型: ${model}`, error);
    }
    
    // Check if it's the start of a new conversation to initialize checkpoint
    const isNewTask = !currentMessages || currentMessages.filter(m => m.role === 'user').length === 0;
    if (isNewTask) {
        try {
            console.log(`[chatHandlers.js] New task detected (sessionId: ${sessionId}). Initializing checkpoint service...`);
            const { workspaceDir, shadowDir } = await getCheckpointDirs();
            const initResult = await checkpointService.initializeTaskCheckpoint(sessionId, workspaceDir, shadowDir);
            console.log(`[chatHandlers.js] Checkpoint service for task ${sessionId} initialized successfully.`);

            // Send the initial checkpoint to the frontend
            if (initResult.success && initResult.checkpointId) {
                targetService._sendAiResponseToFrontend('initial-checkpoint-created', {
                    checkpointId: initResult.checkpointId,
                    message: '初始状态已存档'
                });
                console.log(`[chatHandlers.js] Initial checkpoint ${initResult.checkpointId} created and sent to frontend.`);
            }
        } catch (error) {
            console.error(`[chatHandlers.js] Failed to initialize checkpoint service for task ${sessionId}:`, error);
            // We can decide if we want to stop the process or just log the error.
            // For now, just log it and continue. The user might not need the checkpoint feature.
        }
    }

    // 保存会话状态信息（移除toolUsageEnabled，因为现在根据模式硬编码）
    setSessionState(sessionId, {
      mode: mode,
      ragRetrievalEnabled: ragRetrievalEnabled,
      model: finalModel,
      customPrompt: customPrompt,
      aiParameters: aiParameters
    });
    
    // 调用相应的服务处理消息
    await targetService.processUserMessage(message, sessionId, currentMessages, mode, customPrompt, ragRetrievalEnabled, finalModel, aiParameters);
    return { success: true };
};

// 新的、修复后的用户问题回复处理器
const handleUserQuestionResponse = async (event, { response, toolCallId }) => {
    console.log(`[chatHandlers.js] 收到用户问题回复: "${response}", 关联 toolCallId: ${toolCallId}`);

    // 幂等性检查
    const alreadyProcessed = state.conversationHistory.some(msg => msg.role === 'tool' && msg.tool_call_id === toolCallId);
    if (alreadyProcessed) {
        console.warn(`[chatHandlers.js] 检测到对 toolCallId: ${toolCallId} 的重复回复。已忽略。`);
        return { success: true, message: '重复的回复，已忽略。' };
    }

    try {
        const toolResultsArray = [{
            toolCallId: toolCallId,
            toolName: "ask_user_question",
            result: { content: response } // 只包含工具执行结果，不包含工具调用请求信息
        }];
        
        // 获取默认模型 ID
        if (!storeInstance) {
            const StoreModule = await import('electron-store');
            const Store = StoreModule.default;
            storeInstance = new Store();
        }
        const defaultModelId = storeInstance.get('selectedModel') || '';
        // 不再从存储中读取旧版自定义提示词，使用前端传递的参数

        // 从会话历史中获取 sessionId
        const sessionId = state.conversationHistory.length > 0 ? state.conversationHistory.find(m => m.sessionId)?.sessionId : null;
        
        // 获取会话状态信息
        let sessionState = { mode: 'general' };
        if (sessionId) {
            sessionState = getSessionState(sessionId) || sessionState;
        }
        
        // 工具功能状态已移除，通用模式始终启用工具功能
        const isGeneralMode = sessionState.mode === 'general';
        console.log(`[handleUserQuestionResponse] 会话状态: mode=${sessionState.mode}, 工具功能: ${isGeneralMode ? '启用(通用模式)' : '禁用(其他模式)'}`);

        // **关键修复**: 调用新的流式 sendToolResultToAI 并正确处理其输出
        // 从会话状态获取AI参数
        const sessionAiParameters = sessionState.aiParameters || {};
        console.log(`[DEBUG][chatHandlers.js] 用户问题回复 - 从会话状态获取AI参数:`, JSON.stringify(sessionAiParameters, null, 2));
        
        const stream = chatService.sendToolResultToAI(
            toolResultsArray,
            defaultModelId,
            null, // customSystemPrompt
            sessionState.mode, // mode
            sessionAiParameters // aiParameters
        );

        for await (const chunk of stream) {
            if (chunk.type === 'text') {
                if (chatService.getStreamingMode()) {
                    chatService._sendAiResponseToFrontend('text_stream', { content: chunk.content, sessionId: sessionId });
                } else {
                    chatService._sendAiResponseToFrontend('text', { content: chunk.content, sessionId: sessionId });
                }
            } else if (chunk.type === 'tool_calls' && chunk.content) {
                 if (chatService.getStreamingMode()) {
                    for (const delta of chunk.content) {
                        chatService._sendAiResponseToFrontend('tool_stream', [delta]);
                        await new Promise(resolve => setTimeout(resolve, 10));
                    }
                } else {
                    chatService._sendAiResponseToFrontend('tool_suggestions', state.pendingToolCalls);
                }
            } else if (chunk.type === 'error') {
                chatService._sendAiResponseToFrontend('error', chunk.payload);
            }
        }
        // 仅在流式模式下才需要发送流结束信号
        if (chatService.getStreamingMode()) {
            chatService._sendAiResponseToFrontend('text_stream_end', null);
        }

        return { success: true };

    } catch (error) {
        console.error("[chatHandlers.js] 处理用户回复后再次调用 AI API 失败:", error);
        chatService._sendAiResponseToFrontend('error', `处理用户回复后 AI 反馈失败: ${error.message}`);
        return { success: false, error: error.message };
    }
};

// 新增：清空 AI 对话历史
const handleClearAiConversation = async () => {
    state.conversationHistory = [];
    chatService.resetResponseCount();
    console.log('[chatHandlers.js] AI 对话历史已清空，响应计数器已重置。');
    return { success: true, message: 'AI 对话历史已清空。' };
};

// 处理渲染进程注册监听器的请求
const handleRegisterRendererListeners = (event) => {
  console.log('[chatHandlers.js] Renderer process requests main process to register listeners.');
  // 这里可以添加任何需要注册的监听器，或者验证是否已注册
};

// 设置存储实例
const setStoreInstance = (store) => {
    storeInstance = store;
};

// 注册聊天相关IPC处理器
function registerChatHandlers() {
    console.log('[chatHandlers.js] 注册聊天相关IPC处理器...');
    
    ipcMain.handle('process-command', handleProcessCommand);
    ipcMain.handle('user-question-response', handleUserQuestionResponse);
    ipcMain.handle('register-renderer-listeners', handleRegisterRendererListeners);
    ipcMain.handle('clear-ai-conversation', handleClearAiConversation);
    
    // 新增: 处理前端发送的流式设置
    ipcMain.on('set-streaming-mode', (event, payload) => {
        chatService.setStreamingMode(payload);
    });
    
    // 新增：停止流式传输处理器
    ipcMain.handle('stop-streaming', async () => {
        try {
            console.log('[chatHandlers.js] 收到停止流式传输请求');
            chatService.abortCurrentRequest();
            simpleChatService.abortCurrentRequest();
            return { success: true, message: '流式传输已停止' };
        } catch (error) {
            console.error('[chatHandlers.js] 停止流式传输失败:', error);
            return { success: false, error: error.message };
        }
    });
}

module.exports = {
    registerChatHandlers,
    handleProcessCommand,
    handleUserQuestionResponse,
    handleClearAiConversation,
    handleRegisterRendererListeners,
    setStoreInstance
};