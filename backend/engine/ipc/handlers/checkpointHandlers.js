const { ipcMain } = require('electron');
const { getCheckpointDirs } = require('./sharedUtils');
const checkpointService = require('../../../../dist-backend/checkpoint-service');
const { handleGetAiChatHistory } = require('./aiHistoryHandlers');

// Checkpoint Service Handlers
const handleCheckpointSave = async (event, { taskId, message }) => {
    const { workspaceDir, shadowDir } = await getCheckpointDirs();
    return await checkpointService.saveArchive(taskId, workspaceDir, shadowDir, message);
};

// 用于章节列表栏的基于文件复制的存档恢复
const handleCheckpointRestoreNovel = async (event, { taskId, archiveId }) => {
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
            console.error(`[checkpointHandlers.js] 恢复存档后读取聊天记录失败 for task ${taskId}:`, error);
            // 即使读取历史失败，也应将恢复成功的信息返回
            return { success: true, error: 'File system restored, but failed to reload chat history.' };
        }
    } catch (error) {
        console.error(`[checkpointHandlers.js] 恢复Novel存档失败 for task ${taskId}:`, error);
        return { success: false, error: error.message };
    }
};

// 用于聊天栏的Git影子存档恢复
const handleCheckpointRestoreChat = async (event, { taskId, archiveId }) => {
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
                console.error(`[checkpointHandlers.js] 恢复存档后读取聊天记录失败 for task ${taskId}:`, error);
                // 即使读取历史失败，也应将恢复成功的信息返回
                return { ...restoreResult, error: 'File system restored, but failed to reload chat history.' };
            }
        }
        return restoreResult;
    } catch (error) {
        console.error(`[checkpointHandlers.js] 恢复Git存档失败 for task ${taskId}:`, error);
        return { success: false, error: error.message };
    }
};

const handleCheckpointDelete = async (event, { taskId, archiveId }) => {
    const { workspaceDir, shadowDir } = await getCheckpointDirs();
    return await checkpointService.deleteNovelArchive(taskId, workspaceDir, shadowDir, archiveId);
};

const handleCheckpointGetDiff = async (event, { taskId, from, to }) => {
    const { workspaceDir, shadowDir } = await getCheckpointDirs();
    return await checkpointService.getDiff(taskId, workspaceDir, shadowDir, from, to);
};

const handleCheckpointGetHistory = async (event, { taskId }) => {
    const { workspaceDir, shadowDir } = await getCheckpointDirs();
    return await checkpointService.getHistory(taskId, workspaceDir, shadowDir);
};

// 注册检查点服务IPC处理器
function registerCheckpointHandlers() {
    console.log('[checkpointHandlers.js] 注册检查点服务IPC处理器...');
    
    ipcMain.handle('checkpoints:save', handleCheckpointSave);
    ipcMain.handle('checkpoints:restoreNovel', handleCheckpointRestoreNovel);
    ipcMain.handle('checkpoints:restoreChat', handleCheckpointRestoreChat);
    ipcMain.handle('checkpoints:delete', handleCheckpointDelete);
    ipcMain.handle('checkpoints:getDiff', handleCheckpointGetDiff);
    ipcMain.handle('checkpoints:getHistory', handleCheckpointGetHistory);
}

module.exports = {
    registerCheckpointHandlers,
    handleCheckpointSave,
    handleCheckpointRestoreNovel,
    handleCheckpointRestoreChat,
    handleCheckpointDelete,
    handleCheckpointGetDiff,
    handleCheckpointGetHistory
};