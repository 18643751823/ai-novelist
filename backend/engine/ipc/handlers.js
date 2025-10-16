const { ipcMain, app, dialog, shell } = require('electron');
const isDev = require('electron-is-dev');
const logger = require('../../utils/logger');
const { getAiChatHistoryFilePath } = require('../../utils/logger'); // 修改
const chatService = require('../chatService'); // 引入 chatService（通用模式专用）
const simpleChatService = require('../simpleChatService'); // 引入 simpleChatService（其他模式专用）
const { getModelRegistry, initializeModelProvider, reinitializeModelProvider } = require('../models/modelProvider'); // 修正路径
const contextManager = require('../contextManager'); // 新增：引入上下文管理器
let serviceRegistry = null;
const path = require('path');

// 统一获取 novel 目录路径的辅助函数
const getNovelPath = () => {
    if (isDev) {
        // 开发环境：位于项目根目录
        return path.join(app.getAppPath(), 'novel');
    } else {
        // 生产环境：位于 .exe 文件同级目录
        return path.join(path.dirname(app.getPath('exe')), 'novel');
    }
};

// 新增：清空 DeepSeek 对话历史
const handleClearAiConversation = async () => { // 修改函数名
    state.conversationHistory = [];
    chatService.resetResponseCount();
    console.log('[handlers.js] AI 对话历史已清空，响应计数器已重置。');
    return { success: true, message: 'AI 对话历史已清空。' };
};
const fs = require('fs').promises;
const toolExecutor = require('../../tool-service/tools/executor');
const tools = require('../../tool-service/tools/definitions'); // 引入 tools 定义，用于 send-user-response
const { state, setMainWindow, setSessionState, getSessionState } = require('../../state-manager');
const { getFileTree } = require('../../utils/file-tree-builder');
const sortConfigManager = require('../../utils/sortConfigManager');
const knowledgeBaseManager = require('../../rag-service/knowledgeBaseManager'); // 新增：导入知识库管理器
const ragIpcHandler = require('../../rag-service/ragIpcHandler'); // 新增：导入RAG IPC处理器
const intentAnalysisIpcHandler = require('../../rag-service/IntentAnalysisIpcHandler'); // 新增：导入意图分析IPC处理器
const ripgrepService = require('../../tool-service/ripgrep-service'); // 新增：导入ripgrep服务

let storeInstance = null; // 新增：用于 electron-store 实例
const checkpointService = require('../../../dist-backend/checkpoint-service'); // 引入编译后的 Checkpoint 服务


// 新增：设置上下文限制设置
const handleSetContextLimitSettings = async (event, data) => {
  try {
    console.log('[handlers.js] 收到上下文设置保存请求');
    console.log('[handlers.js] 传入的数据:', JSON.stringify(data, null, 2));
    
    // 提取实际的settings对象（前端传递的是 {settings: {...}}）
    const settings = data.settings || data;
    console.log('[handlers.js] 提取的设置:', JSON.stringify(settings, null, 2));
    
    // 验证设置
    if (!contextManager.validateContextSettings(settings)) {
      console.error('[handlers.js] 上下文设置验证失败');
      console.error('[handlers.js] 设置详情:', settings);
      return { success: false, error: '无效的上下文设置格式' };
    }

    console.log('[handlers.js] 上下文设置验证通过');

    // 确保storeInstance已初始化
    if (!storeInstance) {
      console.error('[ERROR] storeInstance未初始化！这表示register()函数没有被正确调用');
      console.error('[ERROR] 上下文设置无法保存，因为store实例不存在');
      return { success: false, error: '存储实例未初始化，无法保存设置' };
    }

    // 保存到electron-store
    console.log('[handlers.js] 正在保存到electron-store...');
    storeInstance.set('contextLimitSettings', settings);
    console.log('[handlers.js] 上下文限制设置已保存到electron-store');

    // 验证保存是否成功
    const savedSettings = storeInstance.get('contextLimitSettings');
    console.log('[handlers.js] 从electron-store读取验证:', savedSettings);
    
    if (savedSettings) {
      console.log('[handlers.js] 保存验证成功');
    } else {
      console.error('[handlers.js] 保存验证失败 - 从存储读取为空');
    }

    return { success: true, settings };
  } catch (error) {
    console.error('[handlers.js] 设置上下文限制失败:', error);
    console.error('[handlers.js] 错误堆栈:', error.stack);
    return { success: false, error: error.message };
  }
};

// 新增：设置RAG检索启用状态
const handleSetRagRetrievalEnabled = async (event, mode, enabled) => {
  try {
    console.log(`[handlers.js] 设置RAG检索状态: mode=${mode}, enabled=${enabled}`);
    
    // 确保storeInstance已初始化
    if (!storeInstance) {
      console.error('[ERROR] storeInstance未初始化！无法保存RAG设置');
      return { success: false, error: '存储实例未初始化，无法保存设置' };
    }

    // 获取当前的模式功能设置
    let modeFeatureSettings = storeInstance.get('modeFeatureSettings') || {};
    
    // 确保该模式的对象存在
    if (!modeFeatureSettings[mode]) {
      modeFeatureSettings[mode] = {};
    }
    
    // 更新RAG检索设置
    modeFeatureSettings[mode].ragRetrievalEnabled = enabled;
    
    // 保存到存储
    storeInstance.set('modeFeatureSettings', modeFeatureSettings);
    
    console.log(`[handlers.js] RAG检索状态已保存: mode=${mode}, enabled=${enabled}`);
    console.log(`[handlers.js] 当前所有模式设置:`, JSON.stringify(modeFeatureSettings, null, 2));
    
    return { success: true, mode, enabled };
  } catch (error) {
    console.error('[handlers.js] 设置RAG检索状态失败:', error);
    return { success: false, error: error.message };
  }
};

// 新增：获取上下文限制设置
const handleGetContextLimitSettings = async () => {
  try {
    let settings = null;
    
    // 确保storeInstance已初始化
    if (!storeInstance) {
      console.warn('[WARNING] storeInstance未初始化，返回默认上下文设置');
      // 返回默认设置而不是错误
      return {
        success: true,
        settings: {
          modes: {
            general: {
              chatContext: { type: 'turns', value: 20 },
              ragContext: { type: 'turns', value: 10 }
            },
            outline: {
              chatContext: { type: 'turns', value: 30 },
              ragContext: { type: 'turns', value: 15 }
            },
            writing: {
              chatContext: { type: 'turns', value: 20 },
              ragContext: { type: 'turns', value: 15 }
            },
            adjustment: {
              chatContext: { type: 'turns', value: 15 },
              ragContext: { type: 'turns', value: 8 }
            }
          }
        }
      };
    }

    // 从electron-store获取设置
    settings = storeInstance.get('contextLimitSettings');
    console.log('[handlers.js] 从electron-store获取上下文限制设置:', settings);

    // 如果没有保存的设置，使用默认设置
    if (!settings) {
      settings = contextManager.defaultSettings;
      console.log('[handlers.js] 使用默认上下文限制设置');
    }

    return { success: true, settings };
  } catch (error) {
    console.error('[handlers.js] 获取上下文限制设置失败:', error);
    return { success: false, error: error.message };
  }
};
// 辅助函数：生成唯一的文件或文件夹名称
const generateUniqueName = async (targetDir, originalFullName, isFolder) => {
    let baseName = path.basename(originalFullName, path.extname(originalFullName));
    let extName = isFolder ? '' : path.extname(originalFullName);
    let counter = 0;
    let uniqueName = originalFullName;
    let newFullPath;

    while (true) {
        let currentTryName;
        if (counter === 0) {
            currentTryName = originalFullName;
        } else {
            currentTryName = `${baseName}-副本${counter}${extName}`;
        }
        newFullPath = path.join(targetDir, currentTryName);

        try {
            await fs.access(newFullPath, fs.constants.F_OK);
            // 如果文件或目录存在，则继续尝试下一个副本
            counter++;
        } catch (e) {
            // 如果文件或目录不存在，则找到唯一名称
            uniqueName = currentTryName;
            break;
        }
    }
    return uniqueName;
};

const getCheckpointDirs = async () => {
    if (!storeInstance) {
        const StoreModule = await import('electron-store');
        const Store = StoreModule.default;
        storeInstance = new Store();
    }
    const novelDirPath = getNovelPath();
    const userDataPath = storeInstance.get('customStoragePath') || path.join(require('electron').app.getPath('userData'));
    return { workspaceDir: novelDirPath, shadowDir: userDataPath };
};

// 检查并自动发送批量结果
const checkAndAutoSendBatchResults = async () => {
    console.log(`[main.js] checkAndAutoSendBatchResults: 开始检查。当前 pendingToolCalls 长度: ${state.pendingToolCalls.length}`);
    
    // 详细记录每个工具的状态
    state.pendingToolCalls.forEach((tool, index) => {
        console.log(`[main.js] 工具 ${index}: ID=${tool.toolCallId}, 名称=${tool.toolName}, 状态=${tool.status}`);
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
       console.log('[main.js] 所有本轮工具都已处理完毕，pendingToolCalls 已清空，batch_processing_complete 已发送。');

       // 获取默认模型 ID
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
           
           console.log('[main.js] 准备调用 chatService.sendToolResultToAI 发送批量结果。');
           
           // 从工具结果中获取 sessionId（优先使用第一个有效的结果）
           const sessionIdFromTools = resultsToSend.find(tool => tool.sessionId)?.sessionId;
           
           // 获取会话状态信息
           let sessionState = { mode: 'general' };
           if (sessionIdFromTools) {
               sessionState = getSessionState(sessionIdFromTools) || sessionState;
           }
           
           // 工具功能状态已移除，通用模式始终启用工具功能
           const isGeneralMode = sessionState.mode === 'general';
           console.log(`[main.js] 会话状态: mode=${sessionState.mode}, 工具功能: ${isGeneralMode ? '启用(通用模式)' : '禁用(其他模式)'}`);
           console.log(`[main.js] 准备发送工具结果给AI，工具数量: ${resultsToSend.length}`);
           
           // **关键重构**: 调用新的流式生成器并处理其返回的块
           // **关键重构**: chatService 现在从其内部状态获取流式设置
           // 从会话状态获取AI参数
           const sessionAiParameters = sessionState.aiParameters || {};
           console.log(`[DEBUG][handlers.js] 工具结果反馈 - 从会话状态获取AI参数:`, JSON.stringify(sessionAiParameters, null, 2));
           
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
                console.log('[main.js] AI 返回了新的 pending_tools，UI 应该已通过 tool_stream 更新。');
           } else {
               console.log('[main.js] AI 在工具反馈后没有返回新的 pending_tools。');
           }


        } catch (error) {
            console.error('[main.js] 自动批量工具结果反馈失败:', error);
            chatService._sendAiResponseToFrontend('error', `自动批量反馈失败: ${error.message}`);
        }
    } else if (state.pendingToolCalls.length === 0) {
        // 如果 pendingToolCalls 为空，初始状态或所有工具都已通过上述逻辑处理并清空
        console.log('[main.js] pendingToolCalls 为空，无需处理。');
        // 确保 UI 也是空的，虽然上面已经发送了 batch_processing_complete
        chatService._sendAiResponseToFrontend('batch_processing_complete', null);
    } else {
        // 仍有待处理的工具，等待用户操作或工具执行完成。
        console.log('[main.js] 仍有待处理的工具，等待用户操作或工具执行完成。当前状态:', state.pendingToolCalls.map(t => ({ id: t.toolCallId, status: t.status })));
    }
};

// 新增：处理添加文件到知识库的请求
const handleAddFileToKb = async (event) => {
    try {
        const { canceled, filePaths } = await dialog.showOpenDialog(state.mainWindow, {
            properties: ['openFile'],
            filters: [
                { name: 'Documents', extensions: ['txt', 'md', 'pdf', 'docx'] }
            ]
        });

        if (canceled || !filePaths || filePaths.length === 0) {
            return { success: false, message: '用户取消了文件选择。' };
        }

        const filePath = filePaths[0];
        const result = await knowledgeBaseManager.addFileToKnowledgeBase(filePath);
        return result;

    } catch (error) {
        console.error('[handlers.js] 添加文件到知识库失败:', error);
        return { success: false, error: error.message };
    }
};

// 新增：处理列出知识库文件请求
const handleListKbFiles = async () => {
    try {
        const result = await knowledgeBaseManager.listFiles();
        return { success: true, files: result };
    } catch (error) {
        console.error('[handlers.js] 列出知识库文件失败:', error);
        return { success: false, error: error.message };
    }
};

// 新增：处理删除知识库文件请求
const handleDeleteKbFile = async (event, filename) => {
    try {
        const result = await knowledgeBaseManager.deleteFile(filename);
        return result;
    } catch (error) {
        console.error('[handlers.js] 删除知识库文件失败:', error);
        return { success: false, error: error.message };
    }
};

// 新增：处理重命名知识库文件请求
const handleRenameKbFile = async (event, oldFilename, newFilename) => {
    try {
        const result = await knowledgeBaseManager.renameFile(oldFilename, newFilename);
        return result;
    } catch (error) {
        console.error('[handlers.js] 重命名知识库文件失败:', error);
        return { success: false, error: error.message };
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
    console.log(`[handlers.js] 收到 'process-tool-action' 请求。actionType: ${actionType}, toolCalls 数量: ${toolCalls ? toolCalls.length : 0}`);
    
    // 记录当前工具使用状态
    console.log(`[handlers.js] handleProcessToolAction - 当前工具状态检查:`);
    console.log(`  当前 pendingToolCalls 数量: ${state.pendingToolCalls.length}`);
    console.log(`  当前会话状态:`, state.conversationHistory.length > 0 ?
        `会话ID: ${state.conversationHistory[0].sessionId}` : '无会话');

    if (!toolCalls || toolCalls.length === 0) {
        // 在前端，状态已经改变，这里只是记录一个警告
        console.warn('[handlers.js] process-tool-action 被调用，但没有提供 toolCalls。可能是用户取消后没有待处理的工具。');
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
                serviceRegistry = require('../../service-registry').getServices();
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
                                    console.log(`[handlers.js] Checkpoint saved after ${toolName}. ID: ${checkpointId}`);
                                }
                            } catch(err) {
                                console.error(`[handlers.js] Failed to save checkpoint after ${toolName}:`, err);
                            }
                            // ========================================================

                            // 使用 chatService 发送，因为它已经处理了 mainWindow 的引用
                            chatService._sendAiResponseToFrontend('file-content-updated', {
                                filePath: frontendPathId,
                                newContent,
                                checkpointId // <--- 附带 checkpointId
                            });
                            console.log(`[handlers.js] 文件 ${frontendPathId} 更新成功，已发送 file-content-updated (with checkpointId: ${checkpointId}) 通知到前端。`);
                        } catch (readError) {
                            console.error(`[handlers.js] 执行工具后读取文件 '${fullPath}' 失败:`, readError);
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

    console.log(`[handlers.js] handleProcessToolAction: 工具动作处理完成，准备检查批量结果`);
    await checkAndAutoSendBatchResults();
    
    // 记录处理完成后的状态
    console.log(`[handlers.js] handleProcessToolAction: 处理完成 - pendingToolCalls 数量: ${state.pendingToolCalls.length}`);
    
    return { success: true, message: `批量工具动作 '${actionType}' 已处理。` };
};


// 处理批量工具结果反馈请求
const handleSendBatchToolResults = async (event, processedTools) => {
    console.log('收到批量工具结果反馈请求:', processedTools);
    try {
        // 获取默认模型 ID
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
        console.log(`[DEBUG][handlers.js] 批量工具结果反馈 - 从会话状态获取AI参数:`, JSON.stringify(sessionAiParameters, null, 2));
        
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

// 处理用户命令
const handleProcessCommand = async (event, { message, sessionId, currentMessages, mode, customPrompt, toolUsageEnabled, ragRetrievalEnabled, model, aiParameters }) => {
    console.log(`[handlers.js] handleProcessCommand: Received command: "${message}", Mode: ${mode}, Custom Prompt: "${customPrompt}", RAG Retrieval Enabled: ${ragRetrievalEnabled}, Model: ${model}, AI Parameters:`, aiParameters);
    console.log(`[handlers.js] Custom Prompt type: ${typeof customPrompt}, length: ${customPrompt ? customPrompt.length : 0}`);
    
    // 新增：详细的AI参数调试日志
    console.log(`[DEBUG][handlers.js] AI参数详细调试信息:`);
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
    
    console.log(`[handlers.js] 模式路由: ${mode} -> ${isGeneralMode ? 'chatService (通用模式)' : 'simpleChatService (其他模式)'}`);
    
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
            console.log(`[handlers.js] 使用存储中的模型设置: ${storedModel} (替代前端传递的: ${model})`);
            finalModel = storedModel;
        } else {
            console.log(`[handlers.js] 存储中没有模型设置，使用前端传递的模型: ${model}`);
        }
    } catch (error) {
        console.error(`[handlers.js] 获取存储模型设置失败，使用前端模型: ${model}`, error);
    }
    
    // Check if it's the start of a new conversation to initialize checkpoint
    const isNewTask = !currentMessages || currentMessages.filter(m => m.role === 'user').length === 0;
    if (isNewTask) {
        try {
            console.log(`[handlers.js] New task detected (sessionId: ${sessionId}). Initializing checkpoint service...`);
            const { workspaceDir, shadowDir } = await getCheckpointDirs();
            const initResult = await checkpointService.initializeTaskCheckpoint(sessionId, workspaceDir, shadowDir);
            console.log(`[handlers.js] Checkpoint service for task ${sessionId} initialized successfully.`);

            // Send the initial checkpoint to the frontend
            if (initResult.success && initResult.checkpointId) {
                targetService._sendAiResponseToFrontend('initial-checkpoint-created', {
                    checkpointId: initResult.checkpointId,
                    message: '初始状态已存档'
                });
                console.log(`[handlers.js] Initial checkpoint ${initResult.checkpointId} created and sent to frontend.`);
            }
        } catch (error) {
            console.error(`[handlers.js] Failed to initialize checkpoint service for task ${sessionId}:`, error);
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
    console.log(`[handlers.js] 收到用户问题回复: "${response}", 关联 toolCallId: ${toolCallId}`);

    // 幂等性检查
    const alreadyProcessed = state.conversationHistory.some(msg => msg.role === 'tool' && msg.tool_call_id === toolCallId);
    if (alreadyProcessed) {
        console.warn(`[handlers.js] 检测到对 toolCallId: ${toolCallId} 的重复回复。已忽略。`);
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
        console.log(`[DEBUG][handlers.js] 用户问题回复 - 从会话状态获取AI参数:`, JSON.stringify(sessionAiParameters, null, 2));
        
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
        console.error("[handlers.js] 处理用户回复后再次调用 AI API 失败:", error);
        chatService._sendAiResponseToFrontend('error', `处理用户回复后 AI 反馈失败: ${error.message}`);
        return { success: false, error: error.message };
    }
};

 
const getChaptersAndUpdateFrontend = async (mainWindow) => {
    const novelDirPath = getNovelPath();
    try {
        await fs.mkdir(novelDirPath, { recursive: true }).catch(() => {}); // 确保目录存在
        const fileTreeResult = await getFileTree(novelDirPath); // 使用新的文件树构建函数
        let chapters = [];
        if (fileTreeResult.success) {
            // 将文件树的 children 数组作为 chapters 返回
            // 注意：getFileTree 返回的根是 'novel' 目录，我们只需要其子项
            chapters = fileTreeResult.tree;
        } else {
            console.warn(`[handlers.js] 从 file-tree-builder 获取文件树失败: ${fileTreeResult.error}`);
        }

        if (mainWindow && mainWindow.webContents) {
            const payloadToSend = { success: true, chapters };
            console.log(`[handlers.js] 准备发送 chapters-updated 事件。mainWindow.isDestroyed()=${mainWindow.isDestroyed()}, payload类型: ${typeof payloadToSend}, payload.chapters类型: ${typeof payloadToSend.chapters}, payload.chapters是否数组: ${Array.isArray(payloadToSend.chapters)}, 章节数量: ${payloadToSend.chapters.length}, payload JSON长度: ${JSON.stringify(payloadToSend).length}`);
            // 确保 mainWindow 和 webContents 存在，且窗口未被销毁
            if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
                mainWindow.webContents.send('chapters-updated', JSON.stringify(payloadToSend)); // 尝试发送JSON字符串
                console.log('[handlers.js] 已发送 chapters-updated 事件 (JSON 字符串模式)。');
            } else {
                console.warn('[handlers.js] 尝试发送 chapters-updated 事件时 mainWindow 或 webContents 不可用，或窗口已销毁。');
            }
        }
        return { success: true, chapters }; // 也返回给调用者
    } catch (error) {
        console.error('[handlers.js] 获取章节列表并更新前端失败:', error);
        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('chapters-updated', { success: false, error: error.message });
        }
        return { success: false, error: error.message };
    }
};

// 辅助函数：将文件树扁平化为文件路径数组
const flattenFileTree = (nodes) => {
    let filePaths = [];
    nodes.forEach(node => {
        if (!node.isFolder) { // 如果不是文件夹，那就是文件
            filePaths.push(node.id); // 使用 node.id 来获取文件路径
        } else if (node.isFolder && node.children) { // 如果是文件夹且有子节点
            filePaths = filePaths.concat(flattenFileTree(node.children));
        }
    });
    return filePaths;
};

// 新增：处理列出 novel 目录下所有文件请求
const handleListNovelFiles = async () => {
    try {
        const fileTreeResult = await getFileTree(getNovelPath()); // 获取 novel 目录的文件树
        console.log('[handleListNovelFiles] fileTreeResult.tree:', JSON.stringify(fileTreeResult.tree, null, 2)); // 添加日志

        if (fileTreeResult.success) {
            const files = flattenFileTree(fileTreeResult.tree);
            console.log('[handleListNovelFiles] 扁平化后的文件列表 (files):', files); // 添加日志
            return { success: true, files };
        } else {
            console.error(`[handlers.js] 获取 novel 文件列表失败: ${fileTreeResult.error}`);
            return { success: false, error: fileTreeResult.error };
        }
    } catch (error) {
        console.error('[handlers.js] 列出 novel 文件时发生异常:', error);
        return { success: false, error: error.message };
    }
};
// 处理搜索novel文件夹中的文件内容
const handleSearchNovelFiles = async (event, searchQuery) => {
    try {
        const novelDirPath = getNovelPath();
        console.log(`[handleSearchNovelFiles] 搜索novel目录: ${novelDirPath}, 查询: ${searchQuery}`);
        
        // 使用ripgrep搜索文件内容
        const searchResults = await ripgrepService.regexSearchFiles(
            novelDirPath,
            novelDirPath,
            searchQuery,
            '*' // 搜索所有文件
        );

        // 解析搜索结果并返回格式化的结果
        const results = parseSearchResults(searchResults, novelDirPath);
        return { success: true, results };
    } catch (error) {
        console.error('[handleSearchNovelFiles] 搜索novel文件时发生异常:', error);
        return { success: false, error: error.message };
    }
};

// 解析ripgrep搜索结果
function parseSearchResults(searchOutput, novelDirPath) {
    const results = [];
    const lines = searchOutput.split('\n');
    let currentFile = null;
    
    for (const line of lines) {
        if (line.startsWith('# ')) {
            // 文件路径行
            const filePath = line.substring(2).trim();
            currentFile = {
                name: path.basename(filePath),
                path: filePath,
                preview: ''
            };
            results.push(currentFile);
        } else if (line.trim() && !line.startsWith('---') && currentFile) {
            // 内容行，添加到预览
            if (currentFile.preview.length < 100) { // 限制预览长度
                currentFile.preview += line.trim() + ' ';
            }
        }
    }
    
    return results;
}

// 处理获取章节列表请求 (供渲染进程直接调用，例如首次加载)
const handleGetChapters = async () => {
    return await getChaptersAndUpdateFrontend(state.mainWindow); // 复用逻辑，并确保通过 mainWindow 发送
};

// 处理加载章节内容请求
const handleLoadChapterContent = async (event, chapterId) => {
    const novelDirPath = getNovelPath();
    const chapterFilePath = path.join(novelDirPath, chapterId); // chapterId 已经是相对路径
    console.log(`[handlers.js] handleLoadChapterContent: 尝试加载文件: ${chapterFilePath}`);
    try {
        const content = await fs.readFile(chapterFilePath, 'utf8');
        console.log(`[handlers.js] handleLoadChapterContent: 章节 '${chapterId}' 内容长度: ${content.length}`);
        console.log(`[handlers.js] handleLoadChapterContent: 章节内容前50字符: '${content.substring(0, 50)}...'`);
        return { success: true, content };
    } catch (error) {
        console.error(`[handlers.js] 加载章节内容失败: ${chapterId}`, error);
        return { success: false, error: error.message };
    }
};

// 处理渲染进程注册监听器的请求
const handleRegisterRendererListeners = (event) => {
  console.log('[handlers.js] Renderer process requests main process to register listeners.');
  // 这里可以添加任何需要注册的监听器，或者验证是否已注册
};

// 处理创建新章节请求
const handleCreateChapter = async (event, chapterTitle) => { // 这个名字有点歧义，现在主要用于创建文件
    const novelDirPath = getNovelPath();
    // 确保novel目录存在
    await fs.mkdir(novelDirPath, { recursive: true }).catch(() => {}); // 忽略目录已存在的错误

    const chapterFilePath = path.join(novelDirPath, chapterTitle);
    try {
        await fs.writeFile(chapterFilePath, ''); // 创建空文件
        await getChaptersAndUpdateFrontend(state.mainWindow); // 创建成功后更新前端
        return { success: true, message: `章节 '${chapterTitle}' 创建成功` };
    } catch (error) {
        console.error(`[handlers.js] 创建章节失败: ${chapterTitle}`, error);
        return { success: false, error: error.message };
    }
};

// 新增：处理创建文件夹请求
const handleCreateFolder = async (event, folderPathInput) => {
    const novelRootPath = getNovelPath();
    const parentDir = path.dirname(folderPathInput); // 获取父目录
    const folderName = path.basename(folderPathInput); // 获取文件夹名

    const targetDir = path.join(novelRootPath, parentDir);

    await fs.mkdir(targetDir, { recursive: true }).catch(() => {});

    // 使用 generateUniqueName 来获取最终的文件夹名
    const finalUniqueFolderName = await generateUniqueName(targetDir, folderName, true); // true 表示是文件夹
    const fullPath = path.join(targetDir, finalUniqueFolderName);

    try {
        await fs.mkdir(fullPath, { recursive: true });
        await getChaptersAndUpdateFrontend(state.mainWindow);
        return { success: true, message: `文件夹 '${path.relative(novelRootPath, fullPath).replace(/\\/g, '/')}' 创建成功` };
    } catch (error) {
        console.error(`[handlers.js] 创建文件夹失败: ${folderPathInput}`, error);
        return { success: false, error: error.message };
    }
};

// 处理创建新小说文件请求
const handleCreateNovelFile = async (event, { filePath, content = '' }) => { // 实际创建文件 IPC
    logger.writeLog(`[IPC] handleCreateNovelFile received: filePath=${filePath}, content length=${content?.length || 0}`);

    if (typeof filePath !== 'string' || !filePath) {
        logger.writeLog(`[ERROR][IPC] handleCreateNovelFile: Invalid or missing filePath.`);
        return { success: false, error: 'Invalid or missing filePath' };
    }

    const novelRootPath = getNovelPath();
    // 移除 filePath 开头的 'novel/' 前缀，因为 novelRootPath 已经指向 novel 目录
    const cleanFilePath = filePath.startsWith('novel/') ? filePath.substring(6) : filePath;
    const fullPath = path.join(novelRootPath, cleanFilePath); // 使用清理后的路径

    // 确保目标目录存在
    const targetDir = path.dirname(fullPath);
    await fs.mkdir(targetDir, { recursive: true }).catch(() => {}); // 忽略目录已存在的错误

    try {
        await fs.writeFile(fullPath, content, 'utf8');
        // 构建返回给前端的相对路径，例如 novel/folder/file.txt
        const relativeFilePath = path.relative(novelRootPath, fullPath).replace(/\\/g, '/');

        // 创建成功后，理论上新文件内容为空，直接返回成功状态和路径
        return {
            success: true,
            newFilePath: `novel/${relativeFilePath}`, // 返回带 'novel/' 前缀的完整相对路径
            content: content, // 返回新文件的内容 (通常为空字符串)
            message: `文件 '${relativeFilePath}' 创建成功`
        };
    } catch (error) {
        console.error(`[handlers.js] 创建小说文件失败: ${newFilePath}`, error);
        return { success: false, error: error.message };
    }
};

// 处理删除章节请求
const handleDeleteItem = async (event, itemId) => {
    const itemPath = path.join(getNovelPath(), itemId);
    try {
        const stats = await fs.stat(itemPath);
        if (stats.isDirectory()) {
            await fs.rm(itemPath, { recursive: true, force: true }); // 删除目录及其内容
            return { success: true, message: `文件夹 '${itemId}' 及其内容删除成功` };
        } else {
            await fs.unlink(itemPath); // 删除文件
            // 发送文件删除事件通知前端更新标签页状态
            if (state.mainWindow && !state.mainWindow.isDestroyed() && state.mainWindow.webContents) {
                state.mainWindow.webContents.send('file-deleted', { filePath: itemId });
            }
            return { success: true, message: `文件 '${itemId}' 删除成功` };
        }
    } catch (error) {
        console.error(`[handlers.js] 删除失败: ${itemId}`, error);
        return { success: false, error: error.message };
    } finally {
        await getChaptersAndUpdateFrontend(state.mainWindow); // 始终更新前端
    }
};

// 处理重命名章节请求
const handleRenameItem = async (event, oldItemId, newItemName) => {
    const novelRootPath = getNovelPath();
    const oldItemPath = path.join(novelRootPath, oldItemId);
    const parentDir = path.dirname(oldItemPath); // 目标文件夹

    let isFolder = false;
    try {
        const stats = await fs.stat(oldItemPath);
        isFolder = stats.isDirectory();
    } catch (error) {
        console.error(`[handlers.js] 重命名项目时获取源项目信息失败: ${oldItemId}`, error);
        return { success: false, error: `源项目不存在或无法访问: ${error.message}` };
    }

    // 使用 generateUniqueName 生成唯一的名称
    const uniqueNewItemName = await generateUniqueName(parentDir, newItemName, isFolder);
    const newItemPath = path.join(parentDir, uniqueNewItemName);

    try {
        await fs.rename(oldItemPath, newItemPath);
        // 发送文件重命名事件通知前端更新标签页状态
        if (state.mainWindow && !state.mainWindow.isDestroyed() && state.mainWindow.webContents) {
            const relativeNewItemPath = path.relative(novelRootPath, newItemPath).replace(/\\/g, '/');
            state.mainWindow.webContents.send('file-renamed', {
                oldFilePath: oldItemId,
                newFilePath: relativeNewItemPath
            });
        }
        await getChaptersAndUpdateFrontend(state.mainWindow); // 始终更新前端
        // 返回新的相对路径，以便前端更新当前文件
        const relativeNewItemPath = path.relative(novelRootPath, newItemPath).replace(/\\/g, '/');
        return { success: true, message: `项目 '${oldItemId}' 已重命名为 '${uniqueNewItemName}'`, newFilePath: relativeNewItemPath };
    } catch (error) {
        console.error(`[handlers.js] 重命名失败: ${oldItemId} -> ${newItemName}`, error);
        return { success: false, error: error.message };
    }
};

// 辅助函数：递归复制
const copyRecursive = async (src, dest) => {
    const stats = await fs.stat(src);
    if (stats.isDirectory()) {
        await fs.mkdir(dest, { recursive: true });
        const entries = await fs.readdir(src);
        for (const entry of entries) {
            await copyRecursive(path.join(src, entry), path.join(dest, entry));
        }
    } else {
        await fs.copyFile(src, dest);
    }
};

// 处理复制项目请求
const handleCopyItem = async (event, sourceId, targetFolderId) => {
    const novelRootPath = getNovelPath();
    const sourcePath = path.join(novelRootPath, sourceId);
    
    // 确保 targetFolderId 为空时目标目录是 novel 根目录
    const targetFolderPath = targetFolderId ? path.join(novelRootPath, targetFolderId) : novelRootPath;
    
    // 获取源文件/文件夹的原始名称（带拓展名）
    const originalBasename = path.basename(sourceId);
    
    // 判断源是文件还是文件夹
    let isFolder = false;
    try {
        const stats = await fs.stat(sourcePath);
    isFolder = stats.isDirectory();
    } catch (error) {
        console.error(`[handlers.js] 复制项目时获取源项目信息失败: ${sourceId}`, error);
        return { success: false, error: `源项目不存在或无法访问: ${error.message}` };
    }

    // 调用 generateUniqueName 生成唯一的名称
    const uniqueTargetName = await generateUniqueName(targetFolderPath, originalBasename, isFolder);
    const newTargetPath = path.join(targetFolderPath, uniqueTargetName);

    try {
        await copyRecursive(sourcePath, newTargetPath);
        await getChaptersAndUpdateFrontend(state.mainWindow); // 更新前端以反映变化
        return { success: true, message: `项目 '${sourceId}' 已成功复制为 '${uniqueTargetName}'` };
    } catch (error) {
        console.error(`[handlers.js] 复制失败: ${sourceId} -> ${newTargetPath}`, error);
        return { success: false, error: error.message };
    }
};


// 处理更新项目排序顺序
const handleUpdateItemOrder = async (event, { directoryPath, itemIds }) => {
    const novelRootPath = getNovelPath();
    
    try {
        // 确保排序配置管理器已初始化
        await sortConfigManager.initialize(novelRootPath);
        
        // 设置自定义排序
        await sortConfigManager.setCustomOrder(directoryPath, itemIds);
        
        await getChaptersAndUpdateFrontend(state.mainWindow);
        return { success: true, message: '排序顺序更新成功' };
    } catch (error) {
        console.error(`[handlers.js] 更新排序顺序失败: ${directoryPath}`, error);
        return { success: false, error: error.message };
    }
};

// 处理移动项目请求 (相当于剪切+粘贴)
const handleMoveItem = async (event, sourceId, targetFolderId) => {
    const novelRootPath = getNovelPath();
    const sourcePath = path.join(novelRootPath, sourceId);
    const targetFolderPath = targetFolderId ? path.join(novelRootPath, targetFolderId) : novelRootPath;

    // 获取源文件/文件夹的原始名称（带拓展名）
    const originalBasename = path.basename(sourceId);

    // 判断源是文件还是文件夹
    let isFolder = false;
    try {
        const stats = await fs.stat(sourcePath);
        isFolder = stats.isDirectory();
    } catch (error) {
        console.error(`[handlers.js] 移动项目时获取源项目信息失败: ${sourceId}`, error);
        return { success: false, error: `源项目不存在或无法访问: ${error.message}` };
    }

    // 调用 generateUniqueName 生成唯一的名称
    const uniqueTargetName = await generateUniqueName(targetFolderPath, originalBasename, isFolder);
    const newTargetPath = path.join(targetFolderPath, uniqueTargetName);

    try {
        await fs.rename(sourcePath, newTargetPath); // rename 在同一文件系统内是移动
        await getChaptersAndUpdateFrontend(state.mainWindow); // 更新前端以反映变化
        return { success: true, message: `项目 '${sourceId}' 已成功移动为 '${uniqueTargetName}'` };
    } catch (error) {
        console.error(`[handlers.js] 移动失败: ${sourceId} -> ${newTargetPath}`, error);
        return { success: false, error: error.message };
    }
};

// 处理更新小说文件标题请求
const handleUpdateNovelTitle = async (event, { oldFilePath, newTitle }) => {
    const novelDirPath = getNovelPath();
    // 处理 oldFilePath：移除 'novel/' 前缀（如果存在），然后构建完整路径
    const cleanOldFilePath = oldFilePath.startsWith('novel/') ? oldFilePath.substring(6) : oldFilePath;
    const oldFullPath = path.join(novelDirPath, cleanOldFilePath);
    // 清理新标题以确保文件名合法
    const sanitize = (name) => name.replace(/[<>:"/\\|?*]/g, '_');
    const sanitizedNewTitle = sanitize(newTitle);
    
    // 构建新文件的完整路径，保持原有的目录结构
    const oldDir = path.dirname(cleanOldFilePath);
    const newFullPath = oldDir !== '.' ?
        path.join(novelDirPath, oldDir, `${sanitizedNewTitle}.txt`) :
        path.join(novelDirPath, `${sanitizedNewTitle}.txt`);

    console.log(`[handlers.js] handleUpdateNovelTitle: 尝试将 '${oldFullPath}' 重命名为 '${newFullPath}'`);
    try {
        await fs.rename(oldFullPath, newFullPath); // 重命名文件
        await getChaptersAndUpdateFrontend(state.mainWindow); // 更新前端章节列表

        // 构建新的相对文件路径，保持原有的目录结构
        const oldDir = path.dirname(cleanOldFilePath);
        const newRelativePath = oldDir !== '.' ?
            `novel/${oldDir}/${sanitizedNewTitle}.txt` :
            `novel/${sanitizedNewTitle}.txt`;
        
        return { success: true, newFilePath: newRelativePath, message: `文件 '${path.basename(oldFilePath)}' 已重命名为 '${sanitizedNewTitle}.txt'` };
    } catch (error) {
        console.error(`[handlers.js] 更新小说文件标题失败: ${oldFilePath} -> ${newTitle}`, error);
        return { success: false, error: error.message };
    }
};
 
// 处理保存小说文件内容的请求
const handleSaveNovelContent = async (event, filePath, content) => {
    const novelDirPath = getNovelPath();

    // 严谨性检查：确保 filePath 是有效的相对路径且不为空
    if (!filePath || typeof filePath !== 'string' || filePath.trim() === '' || filePath === '未选择') {
        const errorMessage = `文件路径无效: ${filePath}`;
        console.error(`[handlers.js] handleSaveNovelContent: ${errorMessage}`);
        return { success: false, error: errorMessage };
    }

    // 确保 filePath 是相对于 novelDirPath 的路径，不应包含盘符或绝对路径
    // 如果 filePath 包含了 novel/ 前缀，需要移除，以避免路径重复
    let cleanFilePath = filePath.startsWith('novel/') ? filePath.substring(6) : filePath;
    cleanFilePath = cleanFilePath.replace(/\\/g, '/'); // 统一路径分隔符

    const fullPath = path.join(novelDirPath, cleanFilePath); // 正确拼接路径

    console.log(`[handlers.js] handleSaveNovelContent: 尝试保存文件: ${fullPath}`);
    try {
        // 确保文件所在的目录存在
        const dirForFile = path.dirname(fullPath);
        await fs.mkdir(dirForFile, { recursive: true }).catch(() => {});
        
        await fs.writeFile(fullPath, content, 'utf8');
        return { success: true, message: `文件 '${cleanFilePath}' 保存成功` };
    } catch (error) {
        console.error(`[handlers.js] 保存小说文件内容失败: ${fullPath}`, error);
        return { success: false, error: error.message };
    }
};

// 新增：获取 AI 对话历史
const handleGetAiChatHistory = async () => { // 修改函数名
    console.log('进入 handleGetAiChatHistory 函数');
    try {
        await logger.initialize(); // 确保日志目录存在
        console.log('logger.initialize() 完成');
        const historyPath = getAiChatHistoryFilePath(); // 修改函数调用
        console.log(`尝试读取文件路径: ${historyPath}`);
        console.log('准备读取文件内容');
        const fileContent = await fs.readFile(historyPath, 'utf8');
        console.log('文件内容读取成功');
        
        if (fileContent.trim() === '') {
            console.log('文件内容为空，返回空历史。');
            return [];
        }

        console.log('准备解析 JSON');
        const history = JSON.parse(fileContent);
        console.log('JSON 解析成功');
        if (!Array.isArray(history)) {
            console.log('读取到的历史不是数组，返回空数组。');
            return [];
        }
        console.log('成功获取 AI 对话历史。');
        console.log('AI 对话历史内容:', history);
        return history;
    } catch (error) {
        console.log(`捕获到错误: ${error.code || error.message}`);
        if (error.code === 'ENOENT') {
            console.log('AI 历史文件不存在，返回空历史。');
            return [];
        }
        console.error('获取 AI 对话历史失败:', error);
        return [];
    }
};

// 新增：删除 AI 对话历史中的某条记录
const handleDeleteAiChatHistory = async (event, sessionIdToDelete) => { // 修改函数名
    try {
        await logger.initialize(); // 确保日志目录存在
        const historyPath = getAiChatHistoryFilePath(); // 修改函数调用
        let history = [];
        try {
            const fileContent = await fs.readFile(historyPath, 'utf8');
            history = JSON.parse(fileContent);
            if (!Array.isArray(history)) {
                history = [];
            }
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.log('AI 历史文件不存在，无需删除。');
                return { success: true, message: '历史记录已为空或文件不存在。' };
            }
            throw error;
        }

        const initialLength = history.length;
        history = history.filter(conv => conv.sessionId !== sessionIdToDelete);

        if (history.length < initialLength) {
            await fs.writeFile(historyPath, JSON.stringify(history, null, 2), 'utf8');
            return { success: true, message: `已删除会话: ${sessionIdToDelete}` };
        } else {
            return { success: false, message: `未找到会话: ${sessionIdToDelete}` };
        }
    } catch (error) {
        console.error('删除 AI 对话历史失败:', error);
        return { success: false, error: error.message };
    }
};

// 新增：处理获取所有可用模型列表请求
const handleListAllModels = async () => {
    try {
        // 确保 ModelProvider 已初始化，这在 chatService 中已经处理，这里再次确保
        await initializeModelProvider();
        const modelRegistry = getModelRegistry();
        const allModels = await modelRegistry.listAllModels(); // **关键修改：添加 await**
        
        console.log(`[handlers.js] handleListAllModels: 获取到 ${allModels.length} 个模型。`);
        
        // 尝试对模型数据进行深拷贝和序列化检查
        try {
            // 使用 JSON.stringify 和 JSON.parse 来进行深拷贝和清理
            // 这会自动移除所有值为 `undefined` 的键，并处理大多数可序列化的数据类型
            const serializableModels = JSON.parse(JSON.stringify(allModels));
            return { success: true, models: serializableModels };
        } catch (error) {
            console.error('[handlers.js] 模型数据序列化失败:', error);
            // 记录失败时的原始数据以供调试
            console.error('[handlers.js] 导致失败的原始模型数据:', allModels);
            return { success: false, error: `模型数据序列化失败: ${error.message}` };
        }
    } catch (error) {
        console.error('[handlers.js] 获取所有模型列表失败:', error);
        return { success: false, error: error.message };
    }
};

// 新增：处理按提供商获取模型列表请求
const handleGetModelsByProvider = async (event, providerId) => {
    try {
        console.log(`[handlers.js] handleGetModelsByProvider: 获取提供商 ${providerId} 的模型列表`);
        
        // 确保 ModelProvider 已初始化
        await initializeModelProvider();
        const modelRegistry = getModelRegistry();
        
        // 获取指定提供商的适配器
        const adapter = modelRegistry.getAdapter(providerId);
        if (!adapter) {
            console.warn(`[handlers.js] 提供商 ${providerId} 的适配器未找到`);
            return { success: true, models: [] }; // 返回空列表而不是错误
        }
        
        // 获取该提供商的模型列表
        const models = await adapter.listModels();
        console.log(`[handlers.js] 提供商 ${providerId} 有 ${models.length} 个模型`);
        
        // 处理模型数据，添加提供商信息和标准化ID
        const processedModels = models.map(model => ({
            ...model,
            id: modelRegistry._normalizeModelId(model.id, providerId),
            provider: providerId
        }));
        
        // 序列化模型数据
        const serializableModels = JSON.parse(JSON.stringify(processedModels));
        return { success: true, models: serializableModels };
        
    } catch (error) {
        console.error(`[handlers.js] 获取提供商 ${providerId} 的模型列表失败:`, error);
        // 返回空列表而不是错误，避免影响前端显示
        return { success: true, models: [] };
    }
};

// 新增：处理重新检测Ollama服务请求
const handleRedetectOllama = async () => {
    try {
        console.log('[handlers.js] 开始重新检测Ollama服务...');
        
        // 获取当前的Ollama适配器
        const modelRegistry = getModelRegistry();
        
        // ✅ 修复：使用正确的适配器访问方式
        const ollamaAdapter = modelRegistry.adapters['ollama'];
        
        if (!ollamaAdapter) {
            console.warn('[handlers.js] Ollama适配器未找到，尝试重新创建适配器');
            // 即使适配器不存在，也继续创建新的适配器
        }

        // ✅ 修复：重新创建适配器实例以刷新连接
        const OllamaAdapter = require('../models/adapters/ollamaAdapter');
        
        // 获取存储的Ollama基础URL设置
        let ollamaBaseUrl = 'http://127.0.0.1:11434';
        if (storeInstance) {
            const storedUrl = storeInstance.get('ollamaBaseUrl');
            if (storedUrl) {
                ollamaBaseUrl = storedUrl;
            }
        }
        
        const newOllamaAdapter = new OllamaAdapter({
            baseURL: ollamaBaseUrl
        });

        // ✅ 修复：重新注册新的适配器实例
        await modelRegistry.registerAdapter('ollama', newOllamaAdapter);
        
        // 获取新的模型列表
        const models = await newOllamaAdapter.listModels();
        console.log(`[handlers.js] 重新检测Ollama成功，获取到 ${models.length} 个模型`);
        
        return { success: true, message: `Ollama服务重新检测成功，发现 ${models.length} 个模型` };
    } catch (error) {
        console.error('[handlers.js] 重新检测Ollama失败:', error);
        return { success: false, error: error.message };
    }
};

// 新增：处理获取嵌入模型维度请求
const handleGetEmbeddingDimensions = async (event, modelId) => {
    try {
        console.log(`[handlers.js] 开始获取嵌入模型维度: ${modelId}`);
        
        // 确保 ModelProvider 已初始化
        await initializeModelProvider();
        const modelRegistry = getModelRegistry();
        
        // 获取模型信息
        const modelInfo = await modelRegistry.getModelInfo(modelId);
        if (!modelInfo) {
            return { success: false, error: `模型 ${modelId} 未找到` };
        }
        
        // 获取适配器
        const adapter = modelRegistry.getAdapter(modelInfo.provider);
        if (!adapter) {
            return { success: false, error: `提供商 ${modelInfo.provider} 的适配器未找到` };
        }
        
        // 检查适配器是否支持获取嵌入维度
        if (typeof adapter.getEmbeddingDimensions !== 'function') {
            return { success: false, error: `模型 ${modelId} 不支持自动获取嵌入维度` };
        }
        
        // 获取嵌入维度
        const dimensions = await adapter.getEmbeddingDimensions(modelInfo);
        console.log(`[handlers.js] 模型 ${modelId} 的嵌入维度: ${dimensions}`);
        
        return { success: true, dimensions };
        
    } catch (error) {
        console.error(`[handlers.js] 获取嵌入模型维度失败: ${modelId}`, error);
        return { success: false, error: `获取嵌入维度失败: ${error.message}` };
    }
};
// 注册所有IPC处理器
function register(store, mainWindow) { // 接收 store 和 mainWindow 参数并设置全局实例
  storeInstance = store; // 设置全局存储实例
  console.log('[handlers.js] register: 开始注册 IPC 处理器...');
  console.log(`[DEBUG] register: storeInstance set, path: ${storeInstance.path}`);
  
  // 记录应用启动时的配置状态
  console.log('[handlers.js] 应用启动配置检查:');
  try {
    const modeFeatureSettings = storeInstance.get('modeFeatureSettings');
    console.log('[handlers.js] 存储中的 modeFeatureSettings:', JSON.stringify(modeFeatureSettings, null, 2));
    
    const toolUsageEnabled = storeInstance.get('toolUsageEnabled');
    console.log('[handlers.js] 存储中的 toolUsageEnabled:', toolUsageEnabled);
    
    // 注意：工具功能状态管理已移除，不再初始化相关状态
    console.log('[handlers.js] 工具功能状态管理已移除，使用硬编码模式路由');
  } catch (error) {
    console.error('[handlers.js] 初始化配置状态失败:', error);
  }
  
  // 设置存储实例给RAG相关服务（实现API key自动加载）
  if (knowledgeBaseManager) {
      knowledgeBaseManager.setStore(store);
  }
  if (ragIpcHandler) {
      ragIpcHandler.setStore(store);
  }
  
  if (intentAnalysisIpcHandler) {
      intentAnalysisIpcHandler.setStore(store);
      intentAnalysisIpcHandler.initialize(store);
  }
  
  // 设置IntentAnalyzer的存储实例
  const intentAnalyzer = require('../../rag-service/IntentAnalyzer');
  if (intentAnalyzer && intentAnalyzer.setStore) {
      intentAnalyzer.setStore(store);
  }
  // 新增: 处理前端发送的流式设置
  ipcMain.on('set-streaming-mode', (event, payload) => {
    chatService.setStreamingMode(payload);
  });

  ipcMain.handle('cancel-tool', handleCancelTool);
  ipcMain.handle('process-tool-action', handleProcessToolAction);
  // ipcMain.handle('process-batch-action', handleProcessBatchAction); // This is now obsolete
  ipcMain.handle('send-batch-tool-results', handleSendBatchToolResults);
  ipcMain.handle('process-command', handleProcessCommand);
  ipcMain.handle('user-question-response', handleUserQuestionResponse);
  ipcMain.handle('list-novel-files', handleListNovelFiles); // 新增：注册列出 novel 目录下所有文件请求
  ipcMain.handle('search-novel-files', handleSearchNovelFiles); // 新增：注册搜索novel文件请求
  ipcMain.handle('get-chapters', handleGetChapters); // 注册新的IPC处理器
  ipcMain.handle('load-chapter-content', handleLoadChapterContent); // 注册新的IPC处理器
  ipcMain.handle('register-renderer-listeners', handleRegisterRendererListeners); // 注册新的IPC处理器
  ipcMain.handle('create-chapter', handleCreateChapter); // 注册新的IPC处理器
  ipcMain.handle('create-folder', handleCreateFolder); // 新增：创建文件夹
  ipcMain.handle('create-novel-file', handleCreateNovelFile); // 注册新的IPC处理器
  ipcMain.handle('delete-item', handleDeleteItem); // 修改：删除文件/文件夹
  ipcMain.handle('rename-item', handleRenameItem); // 修改：重命名文件/文件夹
  ipcMain.handle('copy-item', handleCopyItem); // 新增：复制文件/文件夹
  ipcMain.handle('move-item', handleMoveItem); // 新增：移动文件/文件夹 (剪切)
  ipcMain.handle('update-item-order', handleUpdateItemOrder); // 新增：更新项目排序顺序
  ipcMain.handle('update-novel-title', handleUpdateNovelTitle); // 注册新的IPC处理器
  console.log('[handlers.js] register: 注册 save-novel-content 处理器...');
  ipcMain.handle('save-novel-content', handleSaveNovelContent);
  ipcMain.handle('get-ai-chat-history', handleGetAiChatHistory); // 修改 IPC 处理器名称
  ipcMain.handle('delete-ai-chat-history', handleDeleteAiChatHistory); // 修改 IPC 处理器名称
  ipcMain.handle('clear-ai-conversation', handleClearAiConversation); // 修改 IPC 处理器名称
  ipcMain.handle('list-all-models', handleListAllModels); // 新增：注册获取所有模型列表处理器
  ipcMain.handle('get-available-models', handleListAllModels); // 新增：注册get-available-models别名处理器
  ipcMain.handle('get-models-by-provider', handleGetModelsByProvider); // 新增：注册按提供商获取模型列表处理器
  ipcMain.handle('redetect-ollama', handleRedetectOllama); // 新增：注册重新检测Ollama服务处理器
  ipcMain.handle('add-file-to-kb', handleAddFileToKb); // 新增：注册添加文件到知识库的处理器
  ipcMain.handle('list-kb-files', handleListKbFiles); // 新增：注册列出知识库文件处理器
  ipcMain.handle('delete-kb-file', handleDeleteKbFile); // 新增：注册删除知识库文件处理器
  ipcMain.handle('rename-kb-file', handleRenameKbFile); // 新增：注册重命名知识库文件处理器
  

  // 新增：上下文限制设置处理器
  ipcMain.handle('set-context-limit-settings', handleSetContextLimitSettings);
  ipcMain.handle('get-context-limit-settings', handleGetContextLimitSettings);

  // 新增：RAG检索状态设置处理器
  ipcMain.handle('set-rag-retrieval-enabled', handleSetRagRetrievalEnabled);

  // 新增：RAG嵌入函数处理器
  ipcMain.handle('reinitialize-embedding-function', ragIpcHandler.reinitializeEmbeddingFunction.bind(ragIpcHandler));
  ipcMain.handle('set-embedding-dimensions', ragIpcHandler.setEmbeddingDimensions.bind(ragIpcHandler));
  ipcMain.handle('get-embedding-dimensions', ragIpcHandler.getEmbeddingDimensions.bind(ragIpcHandler));
  
  // 新增：RAG分段参数处理器
  ipcMain.handle('set-rag-chunk-settings', ragIpcHandler.setRagChunkSettings.bind(ragIpcHandler));
  ipcMain.handle('get-rag-chunk-settings', ragIpcHandler.getRagChunkSettings.bind(ragIpcHandler));

  // 新增：检索设置处理器
  ipcMain.handle('set-retrieval-top-k', ragIpcHandler.setRetrievalTopK.bind(ragIpcHandler));
  ipcMain.handle('get-retrieval-top-k', ragIpcHandler.getRetrievalTopK.bind(ragIpcHandler));

  // 新增：排序配置处理器
  ipcMain.handle('get-sort-config', handleGetSortConfig);
  ipcMain.handle('set-sort-enabled', handleSetSortEnabled);
  ipcMain.handle('set-custom-order', handleSetCustomOrder);
  ipcMain.handle('clear-custom-order', handleClearCustomOrder);

  // ipcMain.handle('regenerate-response', async (event, { messageId }) => {
  //   try {
  //     await chatService.regenerateResponse(messageId);
  //     return { success: true };
  //   } catch (error) {
  //     console.error('IPC Error in regenerate-response:', error);
  //     return { success: false, error: error.message };
  //   }
  // });

  // ipcMain.handle('edit-message', async (event, { messageId, newContent }) => {
  //   try {
  //     await chatService.editMessage(messageId, newContent);
  //     return { success: true };
  //   } catch (error) {
  //     console.error('IPC Error in edit-message:', error);
  //     return { success: false, error: error.message };
  //   }
  // });
  

  // Checkpoint Service Handlers
  ipcMain.handle('checkpoints:save', async (event, { taskId, message }) => {
    const { workspaceDir, shadowDir } = await getCheckpointDirs();
    return await checkpointService.saveArchive(taskId, workspaceDir, shadowDir, message);
  });

  // 用于章节列表栏的基于文件复制的存档恢复
  ipcMain.handle('checkpoints:restoreNovel', async (event, { taskId, archiveId }) => {
    const { workspaceDir, shadowDir } = await getCheckpointDirs();
    
    try {
      // 使用基于文件复制的存档系统恢复章节内容
      await checkpointService.restoreNovelArchive(taskId, workspaceDir, shadowDir, archiveId);
      
      // 恢复成功后处理聊天记录
      try {
        // 在恢复成功后，立即读取并返回该任务的最新聊天记录
        const fullHistory = await handleGetAiChatHistory();
        const taskHistory = fullHistory.find(conv => conv.sessionId === taskId);
        if (taskHistory) {
          return { success: true, messages: taskHistory.messages };
        }
        // 如果在历史中未找到该会话，则可能是一个新的或空的会话
        return { success: true, messages: [] };
      } catch (error) {
        console.error(`[handlers.js] 恢复存档后读取聊天记录失败 for task ${taskId}:`, error);
        // 即使读取历史失败，也应将恢复成功的信息返回
        return { success: true, error: 'File system restored, but failed to reload chat history.' };
      }
    } catch (error) {
      console.error(`[handlers.js] 恢复Novel存档失败 for task ${taskId}:`, error);
      return { success: false, error: error.message };
    }
  });

  // 用于聊天栏的Git影子存档恢复
  ipcMain.handle('checkpoints:restoreChat', async (event, { taskId, archiveId }) => {
    const { workspaceDir, shadowDir } = await getCheckpointDirs();
    
    try {
      const restoreResult = await checkpointService.restoreCheckpoint(taskId, workspaceDir, shadowDir, archiveId);
      
      if (restoreResult.success) {
        try {
          // 在恢复成功后，立即读取并返回该任务的最新聊天记录
          const fullHistory = await handleGetAiChatHistory();
          const taskHistory = fullHistory.find(conv => conv.sessionId === taskId);
          if (taskHistory) {
            return { ...restoreResult, messages: taskHistory.messages };
          }
          // 如果在历史中未找到该会话，则可能是一个新的或空的会话
          return { ...restoreResult, messages: [] };
        } catch (error) {
          console.error(`[handlers.js] 恢复存档后读取聊天记录失败 for task ${taskId}:`, error);
          // 即使读取历史失败，也应将恢复成功的信息返回
          return { ...restoreResult, error: 'File system restored, but failed to reload chat history.' };
        }
      }
      return restoreResult;
    } catch (error) {
      console.error(`[handlers.js] 恢复Git存档失败 for task ${taskId}:`, error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('checkpoints:delete', async (event, { taskId, archiveId }) => {
    const { workspaceDir, shadowDir } = await getCheckpointDirs();
    return await checkpointService.deleteNovelArchive(taskId, workspaceDir, shadowDir, archiveId);
  });

  ipcMain.handle('checkpoints:getDiff', async (event, { taskId, from, to }) => {
    const { workspaceDir, shadowDir } = await getCheckpointDirs();
    return await checkpointService.getDiff(taskId, workspaceDir, shadowDir, from, to);
  });

  ipcMain.handle('checkpoints:getHistory', async (event, { taskId }) => {
    const { workspaceDir, shadowDir } = await getCheckpointDirs();
    return await checkpointService.getHistory(taskId, workspaceDir, shadowDir);
  });




  // 新增：打开外部链接处理器
  ipcMain.handle('open-external', async (event, url) => {
    try {
      console.log(`[handlers.js] 正在打开外部链接: ${url}`);
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      console.error(`[handlers.js] 打开外部链接失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  });

  // get-store-value 处理器
  ipcMain.handle('get-store-value', async (event, key) => {
    try {
        if (!storeInstance) {
            console.error(`[ERROR] get-store-value: storeInstance 未初始化！key: ${key}`);
            console.error(`[ERROR] 这表示 register() 函数没有被正确调用，或者 store 实例没有正确传递`);
            // 作为fallback，创建新实例，但这会导致配置同步问题
            const StoreModule = await import('electron-store');
            const Store = StoreModule.default;
            storeInstance = new Store();
            console.warn(`[WARNING] get-store-value: 创建了新的 storeInstance 作为fallback，路径: ${storeInstance.path}`);
        } else {
        }
        const value = storeInstance.get(key);
        
        // 特别处理功能状态设置的详细日志
        const featureKeys = ['modeFeatureSettings', 'toolUsageEnabled', 'ragRetrievalEnabled'];
        if (featureKeys.includes(key)) {
        } else {
            // 特别处理API相关设置的详细日志
            const apiKeys = ['selectedModel', 'selectedProvider', 'deepseekApiKey', 'openrouterApiKey', 'aliyunEmbeddingApiKey', 'intentAnalysisModel'];
            if (apiKeys.includes(key)) {
            }
        }
        
        return value;
    } catch (error) {
        console.error(`[API设置调试] 获取值失败: ${key}`, error);
        return undefined; // 返回 undefined 而不是抛出错误，以便前端处理
    }
  });

  // set-store-value 处理器
  ipcMain.handle('set-store-value', async (event, key, value) => {
    try {
        if (!storeInstance) {
            console.error(`[ERROR] set-store-value: storeInstance 未初始化！key: ${key}`);
            console.error(`[ERROR] 这表示 register() 函数没有被正确调用，或者 store 实例没有正确传递`);
            // 作为fallback，创建新实例，但这会导致配置同步问题
            const StoreModule = await import('electron-store');
            const Store = StoreModule.default;
            storeInstance = new Store();
            console.warn(`[WARNING] set-store-value: 创建了新的 storeInstance 作为fallback，路径: ${storeInstance.path}`);
        } else {
        }
        
        // 特别处理功能状态设置的详细日志
        const featureKeys = ['modeFeatureSettings', 'toolUsageEnabled', 'ragRetrievalEnabled'];
        if (featureKeys.includes(key)) {
        } else {
            // 特别处理API相关设置的详细日志
            const apiKeys = ['selectedModel', 'selectedProvider', 'deepseekApiKey', 'openrouterApiKey', 'aliyunEmbeddingApiKey', 'intentAnalysisModel'];
            if (apiKeys.includes(key)) {
            }
        }
        
        storeInstance.set(key, value);
        
        // 验证保存是否成功
        const savedValue = storeInstance.get(key);
        
        // 强制写入磁盘
        await storeInstance.store;
        
        return { success: true, message: `值已保存: ${key}` };
    } catch (error) {
        console.error(`[API设置调试] 保存值失败: ${key}`, error);
        return { success: false, error: error.message };
    }
  });

  // 新增：获取附加信息处理器
  const handleGetAdditionalInfo = async (mode) => {
    try {
      if (!storeInstance) {
        const StoreModule = await import('electron-store');
        const Store = StoreModule.default;
        storeInstance = new Store();
      }
      
      const additionalInfoData = storeInstance.get('additionalInfo') || {};
      const modeInfo = additionalInfoData[mode];
      
      let info;
      if (typeof modeInfo === 'string') {
        // 旧格式：字符串，迁移到新格式
        info = {
          outline: modeInfo,
          previousChapter: '',
          characterSettings: ''
        };
        console.log(`[handlers.js] 检测到旧格式附加信息，已迁移到新格式，mode=${mode}`);
      } else if (typeof modeInfo === 'object' && modeInfo !== null) {
        // 新格式：对象
        info = {
          outline: modeInfo.outline || '',
          previousChapter: modeInfo.previousChapter || '',
          characterSettings: modeInfo.characterSettings || ''
        };
      } else {
        // 空数据
        info = {
          outline: '',
          previousChapter: '',
          characterSettings: ''
        };
      }
      
      console.log(`[handlers.js] 获取附加信息 mode=${mode}, 各字段长度:`, {
        outline: info.outline.length,
        previousChapter: info.previousChapter.length,
        characterSettings: info.characterSettings.length
      });
      return { success: true, info };
    } catch (error) {
      console.error('[handlers.js] 获取附加信息失败:', error);
      return { success: false, error: error.message };
    }
  };

  ipcMain.handle('get-additional-info', async (event, mode) => {
    return await handleGetAdditionalInfo(mode);
  });

  // 新增：重新初始化模型提供者处理器
  const handleReinitializeModelProvider = async () => {
    try {
      console.log('[handlers.js] 收到重新初始化模型提供者请求');
      await reinitializeModelProvider();
      return { success: true, message: '模型提供者重新初始化成功' };
    } catch (error) {
      console.error('[handlers.js] 重新初始化模型提供者失败:', error);
      return { success: false, error: error.message };
    }
  };

  // 新增：获取默认提示词处理器
  const handleGetDefaultPrompts = async () => {
    try {
      // 导入prompts模块
      const prompts = require('../prompts');
      return { success: true, prompts };
    } catch (error) {
      console.error('[handlers.js] 获取默认提示词失败:', error);
      return { success: false, error: error.message };
    }
  };

  ipcMain.handle('get-default-prompts', async () => {
    return await handleGetDefaultPrompts();
  });

  // 新增：重新初始化模型提供者处理器
  ipcMain.handle('reinitialize-model-provider', async () => {
    return await handleReinitializeModelProvider();
  });

  // 新增：RAG相关IPC处理器
  ipcMain.handle('get-embedding-status', async () => {
    return await ragIpcHandler.getEmbeddingStatus();
  });

  // 新增：重新初始化阿里云嵌入函数处理器
  ipcMain.handle('reinitialize-aliyun-embedding', async () => {
    return await ragIpcHandler.reinitializeAliyunEmbedding();
  });

  // 新增：获取知识库集合列表处理器
  ipcMain.handle('list-kb-collections', async () => {
    return await ragIpcHandler.listKbCollections();
  });


  // 新增：停止流式传输处理器
  ipcMain.handle('stop-streaming', async () => {
    try {
      console.log('[handlers.js] 收到停止流式传输请求');
      chatService.abortCurrentRequest();
      simpleChatService.abortCurrentRequest();
      return { success: true, message: '流式传输已停止' };
    } catch (error) {
      console.error('[handlers.js] 停止流式传输失败:', error);
      return { success: false, error: error.message };
    }
  });

  // 新增：用于接收前端日志并输出到主进程终端
  ipcMain.on('main-log', (event, message) => {
    console.log('[Frontend Log]:', message);
  });
}

// 分开导出避免循环引用
exports.register = register;
exports.setMainWindow = setMainWindow;
exports.state = state;
exports.processCommand = handleProcessCommand;
exports.sendUserResponse = handleUserQuestionResponse;
exports.processToolAction = handleProcessToolAction;
// exports.processBatchAction = handleProcessBatchAction; // This is now obsolete
exports.getChaptersAndUpdateFrontend = getChaptersAndUpdateFrontend; // 导出新函数
exports.handleGetContextLimitSettings = handleGetContextLimitSettings; // 导出上下文限制设置获取函数
exports.handleSetContextLimitSettings = handleSetContextLimitSettings; // 导出上下文限制设置保存函数
exports.handleSetRagRetrievalEnabled = handleSetRagRetrievalEnabled; // 导出RAG检索状态设置函数
// 处理排序配置相关请求
const handleGetSortConfig = async () => {
    try {
        const config = sortConfigManager.getConfig();
        return { success: true, config };
    } catch (error) {
        console.error('[handlers.js] 获取排序配置失败:', error);
        return { success: false, error: error.message };
    }
};

const handleSetSortEnabled = async (event, enabled) => {
    try {
        await sortConfigManager.setSortEnabled(enabled);
        return { success: true, enabled };
    } catch (error) {
        console.error('[handlers.js] 设置排序启用状态失败:', error);
        return { success: false, error: error.message };
    }
};

const handleSetCustomOrder = async (event, { directoryPath, itemIds }) => {
    try {
        await sortConfigManager.setCustomOrder(directoryPath, itemIds);
        return { success: true };
    } catch (error) {
        console.error('[handlers.js] 设置自定义排序失败:', error);
        return { success: false, error: error.message };
    }
};

const handleClearCustomOrder = async (event, directoryPath) => {
    try {
        await sortConfigManager.clearCustomOrder(directoryPath);
        return { success: true };
    } catch (error) {
        console.error('[handlers.js] 清除自定义排序失败:', error);
        return { success: false, error: error.message };
    }
};
