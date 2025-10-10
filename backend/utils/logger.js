const path = require('path');
const getFsPromises = () => require('fs').promises;
const getFsSync = () => require('fs');

const UNIFIED_LOG_PATH = path.join(__dirname, '../logs/1.log');
const aiSessionLogDir = path.join(__dirname, '../logs/ai');
const aiHistoryFilePath = path.join(aiSessionLogDir, 'history.json');

async function ensureDirectoryExists(dirPath) {
  const fs = getFsPromises();
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      console.error(`logger.js: 确保目录 (${dirPath}) 存在失败:`, error);
    }
  }
}

async function writeLog(message) {
    const fs = getFsPromises();
    const timestamp = new Date().toISOString();
    const logEntry = `[SYSTEM] ${timestamp} - ${message}\n`;
    
    try {
        await ensureDirectoryExists(path.dirname(UNIFIED_LOG_PATH));
        await fs.appendFile(UNIFIED_LOG_PATH, logEntry, 'utf8');
    } catch (error) {
        console.error(`logger.js: 写入日志文件 (${UNIFIED_LOG_PATH}) 失败:`, error);
        console.error(`logger.js: 写入失败时 typeof fs.promises =`, typeof fs);
        console.error(`logger.js: 写入失败时 error.name =`, error.name);
        console.error(`logger.js: 写入失败时 error.message =`, error.message);
        console.error(`logger.js: 写入失败时 error.code =`, error.code);
    }
}

async function logPendingToolCalls(calls) {
    const fs = getFsPromises();
    const logEntry = `时间: ${new Date().toISOString()}\n内容: ${JSON.stringify(calls, null, 2)}\n---\n`;
    try {
        await writeLog(`pendingToolCalls 已记录到 1.log。`);
        await ensureDirectoryExists(path.dirname(UNIFIED_LOG_PATH));
        await fs.appendFile(UNIFIED_LOG_PATH, logEntry, 'utf8');
    } catch (error) {
        await writeLog(`记录工具调用结果失败: ${error.message}`);
    }
}

const { state } = require('../state-manager');

async function logAiConversation(sessionId) {
    console.log('进入 logAiConversation 函数');
    const fs = getFsPromises();
    const fsSync = getFsSync();
    try {
        await ensureDirectoryExists(aiSessionLogDir);
        console.log(`目录确保存在: ${aiSessionLogDir}`);
        let history = [];
        if (fsSync.existsSync(aiHistoryFilePath)) {
            console.log(`文件存在: ${aiHistoryFilePath}, 正在读取...`);
            const data = await fs.readFile(aiHistoryFilePath, 'utf8');
            if (!data.trim()) {
                console.warn(`[Logger] 历史文件 ${aiHistoryFilePath} 为空或无效，将初始化空历史。`);
                history = [];
            } else {
                try {
                    history = JSON.parse(data);
                    history = history.filter(conv => typeof conv === 'object' && conv !== null && conv.sessionId);
                    console.log('文件读取并解析完成并已过滤。');
                } catch (parseError) {
                    console.error(`[Logger] 解析历史文件 ${aiHistoryFilePath} 失败: ${parseError.message}，将初始化空历史。`);
                    history = [];
                }
            }
        } else {
            console.log(`文件不存在: ${aiHistoryFilePath}, 将创建新文件。`);
        }

        const messagesToSave = state.conversationHistory;
        if (!messagesToSave || messagesToSave.length === 0) {
            console.warn('[Logger] 尝试保存会话，但 state.conversationHistory 为空，操作已取消。');
            return;
        }

        const conversationObjectToSave = {
            sessionId: sessionId,
            timestamp: new Date().toISOString(),
            messages: messagesToSave
        };

        const existingIndex = history.findIndex(
            (conv) => conv.sessionId === sessionId
        );

        if (existingIndex !== -1) {
            history[existingIndex] = conversationObjectToSave;
        } else {
            history.unshift(conversationObjectToSave);
        }

        if (history.length > 50) {
            history = history.slice(0, 50);
        }

        console.log(`准备写入 history.json, 会话ID: ${sessionId}`);
        await fs.writeFile(
            aiHistoryFilePath,
            JSON.stringify(history, null, 2),
            'utf8'
        );
        console.log('history.json 写入完成。');
        await writeLog(`AI 会话 (${sessionId}) 已保存。`);
    } catch (error) {
        console.error('logger.js: 保存 AI 会话失败:', error);
        console.log(`错误详情: ${error.name}: ${error.message}, Code: ${error.code}`);
        await writeLog(`保存 AI 会话 (${sessionId}) 失败: ${error.message}`);
    }
}

async function initialize() {
    const fs = getFsPromises();
    const fsSync = getFsSync();
    try {
        await ensureDirectoryExists(path.dirname(UNIFIED_LOG_PATH));
        if (!fsSync.existsSync(UNIFIED_LOG_PATH)) {
            await fs.writeFile(UNIFIED_LOG_PATH, '');
        }
        
        await ensureDirectoryExists(aiSessionLogDir);
        
        await writeLog('日志系统初始化完成');
    } catch (error) {
        console.error('logger.js: 初始化日志系统失败:', error);
        console.error(`logger.js: 初始化失败时 typeof fs.promises =`, typeof fs);
        console.error(`logger.js: 初始化失败时 error.name =`, error.name);
        console.error(`logger.js: 初始化失败时 error.message =`, error.message);
        console.error(`logger.js: 初始化失败时 error.code =`, error.code);
    }
}

module.exports = {
    writeLog,
    logPendingToolCalls,
    initialize,
    logAiConversation,
    getAiChatHistoryFilePath: () => aiHistoryFilePath,
    async logToolResult(toolCallId, toolName, result) {
        const fs = getFsPromises();
        const logEntry = `=== 工具调用结果 ===
时间: ${new Date().toISOString()}
工具ID: ${toolCallId}
工具名称: ${toolName}
结果: ${JSON.stringify(result, null, 2)}
--------------------------\n`;
        try {
            await writeLog(`工具调用结果已记录: ${toolName}`);
            await ensureDirectoryExists(path.dirname(UNIFIED_LOG_PATH));
            await fs.appendFile(UNIFIED_LOG_PATH, `[TOOL-RESULT] ${logEntry}`, 'utf8');
        } catch (error) {
            await writeLog(`记录工具调用结果失败: ${error.message}`);
        }
    },
    info: (message) => {
        console.log(`[INFO] ${message}`);
        writeLog(`[INFO] ${message}`);
    },
    error: (message) => {
        console.error(`[ERROR] ${message}`);
        writeLog(`[ERROR] ${message}`);
    },
    warn: (message) => {
        console.warn(`[WARN] ${message}`);
        writeLog(`[WARN] ${message}`);
    }
};