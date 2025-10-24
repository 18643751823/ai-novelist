const { ipcMain } = require('electron');
const logger = require('../../../utils/logger');
const { getAiChatHistoryFilePath } = require('../../../utils/logger');
const fs = require('fs').promises;

// 新增：获取 AI 对话历史
const handleGetAiChatHistory = async () => {
    console.log('进入 handleGetAiChatHistory 函数');
    try {
        await logger.initialize(); // 确保日志目录存在
        console.log('logger.initialize() 完成');
        const historyPath = getAiChatHistoryFilePath();
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
const handleDeleteAiChatHistory = async (event, sessionIdToDelete) => {
    try {
        await logger.initialize(); // 确保日志目录存在
        const historyPath = getAiChatHistoryFilePath();
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

// 注册AI历史相关IPC处理器
function registerAiHistoryHandlers() {
    console.log('[aiHistoryHandlers.js] 注册AI历史相关IPC处理器...');
    
    ipcMain.handle('get-ai-chat-history', handleGetAiChatHistory);
    ipcMain.handle('delete-ai-chat-history', handleDeleteAiChatHistory);
}

module.exports = {
    registerAiHistoryHandlers,
    handleGetAiChatHistory,
    handleDeleteAiChatHistory
};