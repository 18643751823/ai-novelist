// 使用新的服务注册中心获取方式
const serviceRegistry = require('../../service-registry');
const logger = require('../../utils/logger');
const path = require('path');
const fs = require('fs'); // 引入 fs 模块以便写入日志

// 调用 MCP 服务
async function callMcpTool(toolName, args) {
    try {
        let result;
        // 获取服务实例
        const services = serviceRegistry.getServices();
        
        switch(toolName) {
            case 'write_file':
                result = await services.filesystem.writeFile(args);
                return { success: true, content: "操作成功。" };
            case 'read_file':
                result = await services.filesystem.readFile(args);
                return { success: result.success, content: result.content };
            case 'end_task': // 添加对 end_task 的处理
                return { success: true, message: args.final_message || "任务已结束。" };
           case 'insert_content':
               result = await services.filesystem.insertContent(args);
               return { success: result.success, content: result.success ? "内容插入成功。" : result.error };
           case 'search_and_replace':
               result = await services.filesystem.searchAndReplace(args);
               return { success: result.success, content: result.success ? "搜索和替换成功。" : result.error };
           case 'apply_diff':
               result = await services.filesystem.applyDiff(args);
               return { success: result.success, content: result.success ? "差异应用成功。" : result.error };
            case 'search_files':
                result = await services.filesystem.searchFiles(args);
                return { success: result.success, content: result.results };
            default:
                return { success: false, error: `未知工具: ${toolName}` };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// 核心工具执行逻辑
async function performToolExecution(toolCallId, toolName, toolArgs, mainWindow, sessionId = null) {
    let toolResult;
    let finalMessage = '';

    try {
        // 根据工具名称调用对应的 MCP 工具
        toolResult = await callMcpTool(toolName, toolArgs);
        
        if (toolResult.success) {
            // 更新前端状态
            if (toolName === "write_file") {
                const chapterId = toolArgs.path; // 直接使用 path 作为 chapterId
                logger.writeLog(`[executor.js] 接收到 write_file 操作，文件名为: ${chapterId}`);
                mainWindow.webContents.send('file-written', { filePath: toolArgs.path, content: toolArgs.content });
                logger.writeLog(`[executor.js] 发送 file-written 事件`);
                finalMessage = `章节 '${chapterId}' 已创建/更新，并已加载到编辑框。`;
            } else if (toolName === "read_file") {
                finalMessage = `文件 '${toolArgs.path}' 读取成功。`;
            } else if (toolName === "end_task") {
                // end_task 工具的执行结果不应被添加到 conversationHistory
                // AI 已经通过 _sendAiResponseToFrontend('end_task', ...) 接收到最终消息
                // 这里只需要返回一个成功的状态，不包含 content
                finalMessage = toolResult.message || "任务已结束。";
                return { result: { success: true, message: finalMessage } };
            } else if (toolName === "insert_content" || toolName === "search_and_replace" || toolName === "apply_diff") {
               // 对于这些文件修改工具，我们可以发送一个通用消息，并更新文件树
               mainWindow.webContents.send('update-current-file', toolArgs.path);
               finalMessage = `文件 '${toolArgs.path}' 已通过 ${toolName} 操作成功修改。`;
            }
        } else {
            finalMessage = `${toolName} 操作失败: ${toolResult.error}`;
        }
        
        // 发送工具执行结果作为tool角色消息
        if (toolResult.success) {
            // 直接发送原始工具结果内容，不进行格式化
            let toolResultContent;
            
            // 根据工具结果类型选择合适的内容
            if (toolResult.content && typeof toolResult.content === 'string') {
                toolResultContent = toolResult.content;
            } else if (toolResult.message) {
                toolResultContent = toolResult.message;
            } else if (toolResult.results) {
                toolResultContent = JSON.stringify(toolResult.results, null, 2);
            } else {
                toolResultContent = `${toolName} 执行成功`;
            }
            
            console.log(`[DEBUG][executor.js] 准备发送 tool_result 消息，工具: ${toolName}, 内容长度: ${toolResultContent.length}`);
            console.log(`[DEBUG][executor.js] tool_result 内容预览: ${toolResultContent.substring(0, 100)}...`);
            
            // 发送工具结果消息
            const toolResultPayload = {
                toolCallId: String(toolCallId), // 确保是字符串
                toolName: toolName,
                content: toolResultContent,
                sessionId: String(sessionId || toolArgs.sessionId || 'default-session') // 确保是字符串
            };
            
            console.log(`[DEBUG][executor.js] 准备发送的 payload:`, JSON.stringify(toolResultPayload, null, 2).substring(0, 200));
            
            mainWindow.webContents.send('ai-response', {
                type: 'tool_result',
                payload: toolResultPayload
            });
            
            console.log(`[DEBUG][executor.js] tool_result 消息已发送`);
        } else {
            // 工具执行失败时发送错误信息
            console.log(`[DEBUG][executor.js] 准备发送失败 tool_result 消息，工具: ${toolName}, 错误: ${toolResult.error}`);
            
            const errorPayload = {
                toolCallId: String(toolCallId), // 确保是字符串
                toolName: toolName,
                content: `${toolName} 操作失败: ${toolResult.error}`,
                sessionId: String(sessionId || toolArgs.sessionId || 'default-session') // 确保是字符串
            };
            
            console.log(`[DEBUG][executor.js] 准备发送的错误 payload:`, JSON.stringify(errorPayload, null, 2));
            
            mainWindow.webContents.send('ai-response', {
                type: 'tool_result',
                payload: errorPayload
            });
            
            console.log(`[DEBUG][executor.js] 失败 tool_result 消息已发送`);
        }
        
        // 写入调试日志到文件
        const debugLogPath = path.join(__dirname, '../debug_tool_action.log');
        const logEntry = {
            timestamp: new Date().toISOString(),
            event: 'perform-tool-execution-return',
            toolName: toolName,
            toolCallId: toolCallId,
            success: toolResult.success,
            message: finalMessage,
            result: toolResult
        };
        try {
            // 使用 fs.promises.appendFile 确保异步写入
            await fs.promises.appendFile(debugLogPath, JSON.stringify(logEntry, null, 2) + '\n---\n', 'utf8');
        } catch (error) {
            logger.writeLog(`写入调试日志失败: ${error.message}`);
        }
        
        // 返回工具执行结果
        return { result: toolResult }; // 返回原始工具结果，包含 success 和 content
    } catch (error) {
        finalMessage = `执行工具 ${toolName} 时发生异常: ${error.message}`;
        toolResult = { success: false, error: error.message };
        // 工具执行失败时发送错误信息
        const catchErrorPayload = {
            toolCallId: String(toolCallId), // 确保是字符串
            toolName: toolName,
            content: `${toolName} 操作失败: ${toolResult.error}`,
            sessionId: String(sessionId || toolArgs.sessionId || 'default-session') // 确保是字符串
        };
        
        console.log(`[DEBUG][executor.js] 准备发送的catch错误 payload:`, JSON.stringify(catchErrorPayload, null, 2));
        
        mainWindow.webContents.send('ai-response', {
            type: 'tool_result',
            payload: catchErrorPayload
        });
        // 写入调试日志到文件
        const debugLogPath = path.join(__dirname, '../debug_tool_action.log');
        const logEntry = {
            timestamp: new Date().toISOString(),
            event: 'perform-tool-execution-error-return',
            toolName: toolName,
            toolCallId: toolCallId,
            success: toolResult.success,
            message: finalMessage,
            result: toolResult,
            errorMessage: error.message
        };
        try {
            await fs.promises.appendFile(debugLogPath, JSON.stringify(logEntry, null, 2) + '\n---\n', 'utf8');
        } catch (error) {
            logger.writeLog(`写入调试日志失败: ${error.message}`);
        }
        
        return { success: false, message: finalMessage, result: toolResult };
    }
}

module.exports = {
  callMcpTool,
  performToolExecution
};