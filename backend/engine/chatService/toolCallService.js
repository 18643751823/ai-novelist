const fs = require('fs').promises;
const path = require('path');
const { MultiSearchReplaceStrategy } = require('../../tool-service/diff/multi-search-replace');
const { state } = require('../../state-manager');
const { _sendAiResponseToFrontend } = require('./messageProcessor');

// 统一获取 novel 目录路径的辅助函数
const getNovelPath = () => {
  const { app } = require('electron');
  const isDev = require('electron-is-dev');
  
  if (isDev) {
    // 开发环境：位于项目根目录
    return path.join(app.getAppPath(), 'novel');
  } else {
    // 生产环境：位于 .exe 文件同级目录
    return path.join(path.dirname(app.getPath('exe')), 'novel');
  }
};

// 预处理 apply_diff 工具调用
async function preprocessApplyDiff(toolCall, toolArgs) {
  if (toolCall.function.name === 'apply_diff' && toolArgs.path && toolArgs.diff) {
    try {
      const novelRootDir = getNovelPath();
      let cleanFilePath = toolArgs.path;
      if (cleanFilePath.startsWith('novel/') || cleanFilePath.startsWith('novel\\')) {
        cleanFilePath = cleanFilePath.substring('novel/'.length);
      }
      const fullPath = path.join(novelRootDir, cleanFilePath);
      
      const originalContent = await fs.readFile(fullPath, 'utf-8');
      const strategy = new MultiSearchReplaceStrategy(0.9);
      const result = await strategy.applyDiff(originalContent, toolArgs.diff);

      if (result.success) {
        toolArgs.suggestedContentPreview = result.content;
        console.log(`[ToolCallService] 成功为 apply_diff 预计算了预览内容。路径: ${toolArgs.path}`);
        
        // 发送专用的预览事件
        if (state.mainWindow) {
          // 确保发送给前端的路径总是以 'novel/' 开头
          const frontendPath = toolArgs.path.startsWith('novel/') ? toolArgs.path : `novel/${toolArgs.path}`;
          state.mainWindow.webContents.send('show-diff-preview', {
            filePath: frontendPath,
            originalContent: originalContent,
            suggestedContent: result.content
          });
          console.log(`[ToolCallService] 已发送 show-diff-preview 顶级事件，路径: ${frontendPath}`);
        }
      } else {
        console.warn(`[ToolCallService] 为 apply_diff 预计算预览内容失败: ${result.error}`);
      }
    } catch (previewError) {
      console.error(`[ToolCallService] 在为 apply_diff 生成预览时发生异常: ${previewError.message}`);
    }
  }
}

// 解析工具调用参数
function parseToolCallArguments(toolCall) {
  let toolArgs;
  try {
    // 预解析参数，方便前端使用
    toolArgs = JSON.parse(toolCall.function.arguments);
  } catch (e) {
    console.error(`[ToolCallService] 解析工具参数失败: ${e.message}`);
    toolArgs = { "error": "failed to parse arguments", "raw_arguments": toolCall.function.arguments };
  }
  return toolArgs;
}

// 处理工具调用结果
function processToolCalls(finalToolCalls, currentSessionId) {
  if (!finalToolCalls || finalToolCalls.length === 0) {
    return [];
  }

  // 注意：旧的 pendingToolCalls 应该在工具执行后被清除，这里我们假设每次都是新的调用
  const newPendingToolCalls = [];
  
  for (const toolCall of finalToolCalls) {
    const toolArgs = parseToolCallArguments(toolCall);
    
    // 预处理 apply_diff 工具调用
    preprocessApplyDiff(toolCall, toolArgs);
    
    newPendingToolCalls.push({
      toolCallId: toolCall.id,
      toolName: toolCall.function.name,
      toolArgs: toolArgs,
      function: toolCall.function, // 保持 function 对象的完整性
      aiExplanation: `AI 建议执行 ${toolCall.function.name} 操作。`,
      status: 'pending',
      result: null,
      sessionId: currentSessionId
    });
  }

  // 将新解析的工具调用存入状态
  state.pendingToolCalls = newPendingToolCalls;

  // 统一通过 'tool_suggestions' 发送给前端
  if (state.pendingToolCalls.length > 0) {
    _sendAiResponseToFrontend('tool_suggestions', state.pendingToolCalls);
  }
  
  return newPendingToolCalls;
}

// 构建工具消息
function buildToolMessages(toolResultsArray) {
  // **关键修复**：在映射之前过滤掉 end_task，因为它不应该有执行结果被发送回AI
  const filteredToolResults = toolResultsArray.filter(item => item.toolName !== "end_task");

  const toolMessages = filteredToolResults.map(item => {
    // 确保 result 存在且有意义，避免创建空的 tool message
    if (!item.result) {
      return null;
    }
    
    // **关键修复**：只返回工具执行结果，不包含工具调用请求信息
    const content = (item.result && typeof item.result.content === 'string')
                  ? item.result.content
                  : JSON.stringify(item.result);

    return {
      role: "tool",
      tool_call_id: item.toolCallId,
      name: item.toolName, // 关键修复：添加缺失的 toolName
      content: content,
    };
  }).filter(Boolean); // 过滤掉 null 值

  return toolMessages;
}

module.exports = {
  preprocessApplyDiff,
  parseToolCallArguments,
  processToolCalls,
  buildToolMessages
};