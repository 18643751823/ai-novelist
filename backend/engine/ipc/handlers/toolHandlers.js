const { ipcMain } = require('electron');
const toolExecutor = require('../../tool-service/tools/executor');
const chatService = require('../chatService');
const { state, getSessionState } = require('../../../state-manager');
const { getNovelPath } = require('./sharedUtils');
const fs = require('fs').promises;
const path = require('path');
const checkpointService = require('../../../../dist-backend/checkpoint-service');

let serviceRegistry = null;

// 检查并自动发送批量结果
const checkAndAutoSendBatchResults = async () => {
    console.log(`[toolHandlers.js] checkAndAutoSendBatchResults: 开始检查。当前 pendingToolCalls 长度: ${state.pendingToolCalls.length}`);
    
    // 详细记录每个工具的状态
    state.pendingToolCalls.forEach((tool, index) => {
        console.log(`[toolHandlers.js] 工具 ${index}: ID=${tool.toolCallId}, 名称=${tool.toolName}, 状态=${tool.status}`);
    });
    
    const allProcessed = state.pendingToolCalls.every(tool =>
        tool.status === 'executed' ||
        tool.status === 'failed' ||
        tool.status === 'rejected'
    );

    if (allProcessed && state.pendingToolCalls.length > 0) {
        // 1. 将所有已处理的工具保存起来，以便发送给 DeepSeek
        const completedTools = state.pendingToolCalls.filter(tool =>
            tool.status === 'executed' || tool.status === 'failed' || tool.status === 'rejected'
        );

        // 2. 清空 state.pendingToolCalls，并发送 batch_processing_complete 事件给前端
        //    这确保了立即清空 UI
        state.pendingToolCalls = [];
        chatService._sendAiResponseToFrontend('batch_processing_complete', null);
        console.log('[toolHandlers.js] 所有本轮工具都已处理完毕，pendingToolCalls 已清空，batch_processing_complete 已发送。');

        // 获取默认模型 ID
        let storeInstance = null;
        if (!storeInstance) {
            const StoreModule = await import('electron-store');
            const Store = StoreModule.default;
            storeInstance = new Store();
        }
        const defaultModelId = storeInstance.get('selectedModel') || '';

        try {
            const resultsToSend = completedTools.map(tool => ({
                toolCallId: tool.toolCallId,
                toolName: tool.toolName,
                result: tool.result,
                sessionId: tool.sessionId // 确保 sessionId 被传递
            }));
            
            console.log('[toolHandlers.js] 准备调用 chatService.sendToolResultToAI 发送批量结果。');
            
            // 从工具结果中获取 sessionId（优先使用第一个有效的结果）
            const sessionIdFromTools = resultsToSend.find(tool => tool.sessionId)?.sessionId;
            
            // 获取会话状态信息
            let sessionState = { mode: 'general' };
            if (sessionIdFromTools) {
                sessionState = getSessionState(sessionIdFromTools) || sessionState;
            }
            
            // 工具功能状态已移除，通用模式始终启用工具功能
            const isGeneralMode = sessionState.mode === 'general';
            console.log(`[toolHandlers.js] 会话状态: mode=${sessionState.mode}, 工具功能: ${isGeneralMode ? '启用(通用模式)' : '禁用(其他模式)'}`);
            console.log(`[toolHandlers.js] 准备发送工具结果给AI，工具数量: ${resultsToSend.length}`);
            
            // 从会话状态获取AI参数
            const sessionAiParameters = sessionState.aiParameters || {};
            console.log(`[DEBUG][toolHandlers.js] 工具结果反馈 - 从会话状态获取AI参数:`, JSON.stringify(sessionAiParameters, null, 2));
            
            const stream = chatService.sendToolResultToAI(
                resultsToSend,
                defaultModelId,
                null, // customSystemPrompt
                sessionState.mode, // mode
                sessionAiParameters // aiParameters
            );
            let hasNewPendingTools = false;
            
            // 获取当前会话ID，用于发送给前端
            const currentSessionId = state.conversationHistory.length > 0 ? state.conversationHistory.find(m => m.sessionId)?.sessionId : null;

            for await (const chunk of stream) {
                if (chunk.type === 'text') {
                    // AI 开始回复文本，先让前端创建一个新的 assistant 消息占位符
                    chatService._sendAiResponseToFrontend('text_stream', { content: chunk.content, sessionId: currentSessionId });
                } else if (chunk.type === 'tool_calls' && chunk.content) {
                    hasNewPendingTools = true;
                    // 直接将工具调用块转发给前端
                    for (const delta of chunk.content) {
                        chatService._sendAiResponseToFrontend('tool_stream', [delta]);
                        await new Promise(resolve => setTimeout(resolve, 10)); // 保持UI流畅
                    }
                } else if (chunk.type === 'error') {
                    chatService._sendAiResponseToFrontend('error', chunk.payload);
                }
            }
            // 流结束后，发送结束信号
            chatService._sendAiResponseToFrontend('text_stream_end', null);

            // 检查在流处理后，state.pendingToolCalls 是否真的被填充了
            if (hasNewPendingTools) {
                console.log('[toolHandlers.js] AI 返回了新的 pending_tools，UI 应该已通过 tool_stream 更新。');
            } else {
                console.log('[toolHandlers.js] AI 在工具反馈后没有返回新的 pending_tools。');
            }

        } catch (error) {
            console.error('[toolHandlers.js] 自动批量工具结果反馈失败:', error);
            chatService._sendAiResponseToFrontend('error', `自动批量反馈失败: ${error.message}`);
        }
    } else if (state.pendingToolCalls.length === 0) {
        // 如果 pendingToolCalls 为空，初始状态或所有工具都已通过上述逻辑处理并清空
        console.log('[toolHandlers.js] pendingToolCalls 为空，无需处理。');
        // 确保 UI 也是空的，虽然上面已经发送了 batch_processing_complete
        chatService._sendAiResponseToFrontend('batch_processing_complete', null);
    } else {
        // 仍有待处理的工具，等待用户操作或工具执行完成。
        console.log('[toolHandlers.js] 仍有待处理的工具，等待用户操作或工具执行完成。当前状态:', state.pendingToolCalls.map(t => ({ id: t.toolCallId, status: t.status })));
    }
};

// 处理工具取消请求
const handleCancelTool = async (event, toolName, toolArgs, toolCallId) => {
    console.log(`收到取消工具请求: ${toolName}，参数:`, toolArgs);
    let toolToUpdate = state.pendingToolCalls.find(t => t.toolCallId === toolCallId);
    if (toolToUpdate) {
        toolToUpdate.status = 'cancelled';
        toolToUpdate.result = { success: false, error: `用户取消了 ${toolName} 操作。` };
    }
    await checkAndAutoSendBatchResults();
    return { success: true, message: `已取消 ${toolName} 操作。` };
};

// 处理单个工具动作
// Unified tool action handler for both single and batch actions from the new UI
const handleProcessToolAction = async (event, { actionType, toolCalls }) => {
    console.log(`[toolHandlers.js] 收到 'process-tool-action' 请求。actionType: ${actionType}, toolCalls 数量: ${toolCalls ? toolCalls.length : 0}`);
    
    // 记录当前工具使用状态
    console.log(`[toolHandlers.js] handleProcessToolAction - 当前工具状态检查:`);
    console.log(`  当前 pendingToolCalls 数量: ${state.pendingToolCalls.length}`);
    console.log(`  当前会话状态:`, state.conversationHistory.length > 0 ?
        `会话ID: ${state.conversationHistory[0].sessionId}` : '无会话');

    if (!toolCalls || toolCalls.length === 0) {
        // 在前端，状态已经改变，这里只是记录一个警告
        console.warn('[toolHandlers.js] process-tool-action 被调用，但没有提供 toolCalls。可能是用户取消后没有待处理的工具。');
        return { success: true, message: '没有提供工具调用来处理。' };
    }

    if (actionType === 'approve') {
        chatService._sendAiResponseToFrontend('batch_action_status', { status: 'executing_all', message: `正在批量执行所有待处理工具...` });
        for (const tool of toolCalls) {
            let toolToProcess = state.pendingToolCalls.find(t => t.toolCallId === tool.toolCallId);
            if (!toolToProcess) {
                console.warn(`未找到 toolCallId 为 ${tool.toolCallId} 的待处理工具。可能已被处理。`);
                continue; // Skip to the next tool
            }

            if (!serviceRegistry) {
                serviceRegistry = require('../../../service-registry').getServices();
            }
            
            const executionResult = await toolExecutor.performToolExecution(
                toolToProcess.toolCallId,
                toolToProcess.function.name, // Use the name from the pending call
                toolToProcess.toolArgs,
                state.mainWindow,
                serviceRegistry.toolService
            );

            toolToProcess.status = executionResult.result.success ? 'executed' : 'failed';
            toolToProcess.result = executionResult.result;

            if (toolToProcess.function.name === 'apply_diff') {
                if (executionResult.result.success) {
                    toolToProcess.result = { success: true };
                } else {
                    toolToProcess.result = { success: false, error: executionResult.result.error };
                }
            }

            // 新增：如果工具执行成功且是文件修改类工具，则读取新内容并通知前端
            if (executionResult.result.success) {
                const toolName = toolToProcess.function.name;
                const fileModificationTools = ['insert_content', 'write_file', 'apply_diff', 'create_file'];
                
                if (fileModificationTools.includes(toolName)) {
                    const filePathArg = toolToProcess.toolArgs.path; // e.g., '我的第一章.txt' or 'subdir/file.txt'
                    if (filePathArg) {
                        // 构造正确的 novel 目录根路径
                        const novelRootDir = getNovelPath();
                        
                        // 清理 AI 可能提供的、带 'novel/' 前缀的路径
                        let cleanFilePath = filePathArg;
                        if (cleanFilePath.startsWith('novel/') || cleanFilePath.startsWith('novel\\')) {
                            cleanFilePath = cleanFilePath.substring('novel/'.length);
                        }

                        // 构造文件的完整绝对路径
                        const fullPath = path.join(novelRootDir, cleanFilePath);
                        // 构造前端使用的、带 'novel/' 前缀的相对路径 ID
                        const frontendPathId = `novel/${cleanFilePath.replace(/\\/g, '/')}`;

                        try {
                            const newContent = await fs.readFile(fullPath, 'utf8');
                            
                            // ================== 历史存档：工具调用后存档 ==================
                            let checkpointId = null;
                            try {
                                const { workspaceDir, shadowDir } = await getCheckpointDirs();
                                const taskId = toolToProcess.sessionId || 'default-task';
                                const checkpoint = await checkpointService.saveShadowCheckpoint(taskId, workspaceDir, shadowDir, `Saved after executing ${toolName}`);
                                if (checkpoint && checkpoint.commit) {
                                    checkpointId = checkpoint.commit;
                                    console.log(`[toolHandlers.js] Checkpoint saved after ${toolName}. ID: ${checkpointId}`);
                                }
                            } catch(err) {
                                console.error(`[toolHandlers.js] Failed to save checkpoint after ${toolName}:`, err);
                            }
                            // ========================================================

                            // 使用 chatService 发送，因为它已经处理了 mainWindow 的引用
                            chatService._sendAiResponseToFrontend('file-content-updated', {
                                filePath: frontendPathId,
                                newContent,
                                checkpointId // <--- 附带 checkpointId
                            });
                            console.log(`[toolHandlers.js] 文件 ${frontendPathId} 更新成功，已发送 file-content-updated (with checkpointId: ${checkpointId}) 通知到前端。`);
                        } catch (readError) {
                            console.error(`[toolHandlers.js] 执行工具后读取文件 '${fullPath}' 失败:`, readError);
                            // 即使读取失败，也发送一个错误信号，让前端知道操作已完成但同步失败
                            chatService._sendAiResponseToFrontend('error', `文件 ${frontendPathId} 已被修改，但无法读取最新内容。`);
                        }
                    }
                }
            }
        }
    } else if (actionType === 'reject') {
        for (const tool of toolCalls) {
            let toolToProcess = state.pendingToolCalls.find(t => t.toolCallId === tool.toolCallId);
            if (!toolToProcess) {
                console.warn(`未找到 toolCallId 为 ${tool.toolCallId} 的待处理工具。可能已被处理。`);
                continue; // Skip to the next tool
            }
            toolToProcess.status = 'rejected';
            toolToProcess.result = { success: false, error: `用户拒绝了 ${toolToProcess.function.name} 操作。` };
        }
        chatService._sendAiResponseToFrontend('batch_action_status', { status: 'rejected_all', message: `所有待处理工具已被批量拒绝。` });
    } else {
        console.warn(`未知的工具动作: ${actionType}`);
        return { success: false, message: '未知的工具动作。' };
    }

    console.log(`[toolHandlers.js] handleProcessToolAction: 工具动作处理完成，准备检查批量结果`);
    await checkAndAutoSendBatchResults();
    
    // 记录处理完成后的状态
    console.log(`[toolHandlers.js] handleProcessToolAction: 处理完成 - pendingToolCalls 数量: ${state.pendingToolCalls.length}`);
    
    return { success: true, message: `批量工具动作 '${actionType}' 已处理。` };
};

// 处理批量工具结果反馈请求
const handleSendBatchToolResults = async (event, processedTools) => {
    console.log('收到批量工具结果反馈请求:', processedTools);
    try {
        // 获取默认模型 ID
        let storeInstance = null;
        if (!storeInstance) {
            const StoreModule = await import('electron-store');
            const Store = StoreModule.default;
            storeInstance = new Store();
        }
        const defaultModelId = storeInstance.get('selectedModel') || '';

        // 从处理后的工具中获取 sessionId（优先使用第一个有效的结果）
        const sessionIdFromTools = processedTools.find(tool => tool.sessionId)?.sessionId;
        
        // 获取会话状态信息
        let sessionState = { mode: 'general' };
        if (sessionIdFromTools) {
            sessionState = getSessionState(sessionIdFromTools) || sessionState;
        }
        
        // 工具功能状态已移除，通用模式始终启用工具功能
        const isGeneralMode = sessionState.mode === 'general';
        console.log(`[handleSendBatchToolResults] 会话状态: mode=${sessionState.mode}, 工具功能: ${isGeneralMode ? '启用(通用模式)' : '禁用(其他模式)'}`);

        // 从会话状态获取AI参数
        const sessionAiParameters = sessionState.aiParameters || {};
        console.log(`[DEBUG][toolHandlers.js] 批量工具结果反馈 - 从会话状态获取AI参数:`, JSON.stringify(sessionAiParameters, null, 2));
        
        const aiResponseResult = await chatService.sendToolResultToAI(
            processedTools,
            defaultModelId,
            null, // customSystemPrompt
            sessionState.mode, // mode
            sessionAiParameters // aiParameters
        ); // 修改并添加 modelId 参数
        state.pendingToolCalls = [];
        chatService._sendAiResponseToFrontend('batch_processing_complete', null); // 修改
        return { success: true, message: '批量工具结果已成功反馈给 AI。' };
    } catch (error) {
        console.error('批量工具结果反馈失败:', error);
        chatService._sendAiResponseToFrontend('error', `批量反馈失败: ${error.message}`); // 修改
        return { success: false, error: error.message };
    }
};

// 注册工具相关IPC处理器
function registerToolHandlers() {
    console.log('[toolHandlers.js] 注册工具相关IPC处理器...');
    
    ipcMain.handle('cancel-tool', handleCancelTool);
    ipcMain.handle('process-tool-action', handleProcessToolAction);
    ipcMain.handle('send-batch-tool-results', handleSendBatchToolResults);
}

module.exports = {
    registerToolHandlers,
    handleCancelTool,
    handleProcessToolAction,
    handleSendBatchToolResults,
    checkAndAutoSendBatchResults
};