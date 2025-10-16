const tools = require('../../tool-service/tools/definitions');

// 清理消息对象，移除非标准的OpenAI API字段
function sanitizeMessagesForAI(messages) {
  if (!Array.isArray(messages)) {
    return messages;
  }

  return messages.map(message => {
    if (!message || typeof message !== 'object') {
      return message;
    }

    // 过滤掉工具调用请求信息，避免进入AI上下文
    let filteredContent = message.content;
    if (typeof filteredContent === 'string') {
      // 过滤掉"--- 工具调用请求 ---"部分
      filteredContent = filteredContent.replace(/--- 工具调用请求 ---.*$/s, '').trim();
      // 过滤掉"工具调用："调试信息部分
      filteredContent = filteredContent.replace(/工具调用:.*$/s, '').trim();
    }

    // 只保留OpenAI API标准字段
    const sanitizedMessage = {
      role: message.role,
      content: filteredContent
    };

    // 可选的标准字段
    if (message.name) sanitizedMessage.name = message.name;
    if (message.tool_call_id) sanitizedMessage.tool_call_id = message.tool_call_id;
    if (message.tool_calls) sanitizedMessage.tool_calls = message.tool_calls;

    return sanitizedMessage;
  });
}

// 构建 AI 请求参数
function buildRequestOptions(modelId, aiParameters = {}, isStreaming = true) {
  // 合并默认参数和前端传递的参数
  const defaultAiParameters = {
    temperature: 0.7,
    top_p: 0.7,
    n: 1
  };
  
  // 新增：详细的参数合并调试日志
  console.log(`[DEBUG][RequestBuilder] 参数合并调试信息:`);
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
    tools: tools, // 始终启用工具
    tool_choice: "auto", // 始终自动选择工具
    stream: isStreaming, // 使用服务级别状态
    temperature: mergedAiParameters.temperature,
    top_p: mergedAiParameters.top_p,
    n: mergedAiParameters.n
  };
  
  console.log('[RequestBuilder] AI参数设置:', mergedAiParameters);
  console.log(`[DEBUG][RequestBuilder] 服务层请求参数requestOptions:`, JSON.stringify(requestOptions, null, 2));
  console.log(`[DEBUG][RequestBuilder] 流式模式: ${isStreaming}`);
  
  return { requestOptions, mergedAiParameters };
}

// 构建适配器选项
function buildAdapterOptions(modelId, aiParameters = {}, isStreaming = true) {
  // 实际传递给适配器的参数（让适配器处理默认值）
  const adapterOptions = {
    model: modelId,
    tools: tools,
    tool_choice: "auto",
    stream: isStreaming,
    temperature: aiParameters.temperature,
    top_p: aiParameters.top_p,
    n: aiParameters.n
  };
  
  return adapterOptions;
}

// 打印完整的消息内容用于调试
function logMessagesForDebugging(messages, title = '完整的AI请求体 - 消息内容:') {
  console.log(`[RequestBuilder] ${title}`);
  messages.forEach((msg, index) => {
    console.log(`[RequestBuilder] 消息 ${index + 1} (${msg.role}):`);
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
}

module.exports = {
  sanitizeMessagesForAI,
  buildRequestOptions,
  buildAdapterOptions,
  logMessagesForDebugging
};