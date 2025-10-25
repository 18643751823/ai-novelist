import { createSlice } from '@reduxjs/toolkit';
import { produce } from 'immer'; // 确保导入

// 定义默认系统提示词
const DEFAULT_SYSTEM_PROMPT = `你是一个**工具使用型AI**，精通使用各种工具来完成用户请求。

**你的核心任务是：**
1. **准确理解用户意图。**
2. **根据用户意图，规划需要使用的工具和步骤。**
3. **严格按照工具的 JSON Schema 定义，生成有效的 'tool_calls' 对象。**
   - **极其重要：** 你必须将工具调用生成在响应的 **'tool_calls' 字段**中。
   - **绝对禁止：** **切勿**将工具调用的 JSON 结构以文本形式（例如，Markdown 代码块）输出到 'content' 字段中。系统无法解析 'content' 字段中的工具调用。
   - **只有通过 'tool_calls' 字段生成的工具请求，系统才能识别并执行。**
4. **根据工具执行结果，继续执行任务或进行后续工具调用。**
5. **当所有任务都已完成时，你必须、也只能调用名为 'end_task' 的工具来结束对话。**

**工具使用流程示例：**
- **分析并首次调用：**
  - (可选) 提供简明扼要的分析或下一步计划的文本（在 'content' 字段）。
  - **紧接着，生成第一个工具的 'tool_calls' 对象。**
- **工具执行后反馈：**
  - 系统会将工具执行结果（'tool' 角色消息）提供给你。
  - 根据结果（成功或失败），决定是继续下一个工具调用，还是修正并重试当前工具。
  - **确保每一次工具调用都生成在 'tool_calls' 字段。**
- **任务完成与收尾（至关重要）：**
  - 当你确信所有用户请求均已满足，**你必须生成最后一次 'tool_calls'**。
  - **这一次的工具调用，其 'name' 字段必须是 "end_task"**。
  - **其 'arguments' 字段必须是一个包含 "summary" 或 "final_message" 键的JSON对象**。
  - **示例**: {"summary": "已完成所有任务，文件已创建。"} 或 {"final_message": "所有章节均已保存。"}
  - **只有 'end_task' 工具会被系统识别为任务结束的信号。**

**重要交互原则 - 请严格遵循以优化用户体验和效率：**
1. **单步执行优先：** 除非任务性质要求必须同时进行，否则请尽量一次只建议一个工具操作。例如，如果用户请求创建多章内容，请逐章进行，每次只建议创建一章，等待用户确认和系统反馈后再建议下一章。
2. **等待反馈：** 在建议并调用工具后，请耐心等待系统返回该工具的执行结果（成功或失败或被用户忽略）。只有收到反馈后，才能基于该反馈决定下一步的行动。
3. **避免重复建议：** 如果系统反馈某个工具操作被用户忽略或未执行，请不要立即重复建议该操作，除非用户明确要求或任务逻辑需要。在重复之前，可尝试分析原因或询问用户意图。
4. **简洁明了：** 你的响应应由简要的文本（可选）和精确的 'tool_calls' 构成，避免冗余信息。

**记住：你的响应应该由文本（可选）和精确的 'tool_calls' 构成，而不是描述。**`;

const chatSlice = createSlice({
  name: 'chat',
  initialState: {
    messages: [],
    pendingToolCalls: [], // 用于存储流式传输完成的工具调用
    toolCallState: 'idle', // 'idle', 'streaming', 'pending_user_action'
    questionCard: null,
    deepSeekHistory: [],
    deepseekApiKey: '',
    openrouterApiKey: '',
    siliconflowApiKey: '', // 新增：硅基流动API Key
    aliyunApiKey: '', // 新增：阿里云百炼API Key
    aliyunEmbeddingApiKey: '', // 新增：阿里云嵌入API Key
    embeddingModel: '', // 新增：嵌入模型
    ollamaBaseUrl: 'http://127.0.0.1:11434', // 新增：Ollama服务地址
    intentAnalysisModel: '', // 新增：意图分析模型
    selectedModel: '',
    selectedProvider: '', // 取消默认的DeepSeek设置
    customProviders: [], // 新增：自定义提供商列表
    isHistoryPanelVisible: false,
    showApiSettingsModal: false,
    showRagSettingsModal: false,
    showGeneralSettingsModal: false,
    showHomePage: true, // 新增：控制主页面显示状态
    showWorkspacePanel: false, // 新增：控制工作区面板显示状态
    showPersistentMemoryPanel: false, // 新增：控制持久记忆面板显示状态
    availableModels: [], // 新增：用于存储所有可用模型列表
    customSystemPrompt: DEFAULT_SYSTEM_PROMPT, // 新增：自定义系统提示词（旧版，用于通用模式）
    customPrompts: { // 新增：每个模式的自定义提示词
      general: '',
      outline: '',
      writing: '',
      adjustment: ''
    },
    enableStream: true, // 新增：是否启用流式传输，默认为 true
    editingMessageId: null, // 新增：用于跟踪正在编辑的消息ID
    ragRetrievalEnabled: false, // 新增：RAG检索启用状态（全局默认）
    // 新增：每个模式的功能启用状态（工具功能已硬编码，只保留RAG检索）
    // 注意：自定义模式的状态会在运行时动态创建
    modeFeatureSettings: {
      general: {
        ragRetrievalEnabled: false,
        ragTableNames: [] // 新增：选择的RAG表名称数组
      },
      outline: {
        ragRetrievalEnabled: false,
        ragTableNames: []
      },
      writing: {
        ragRetrievalEnabled: false,
        ragTableNames: []
      },
      adjustment: {
        ragRetrievalEnabled: false,
        ragTableNames: []
      }
    },
    // 新增：上下文限制设置
    // 注意：自定义模式的上下文限制设置会在运行时动态创建
    contextLimitSettings: {
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
    },
    // 新增：附加信息/持久记忆
    // 注意：自定义模式的附加信息会在运行时动态创建
    additionalInfo: {
      general: {
        outline: '',
        previousChapter: '',
        characterSettings: ''
      },
      outline: {
        outline: '',
        previousChapter: '',
        characterSettings: ''
      },
      writing: {
        outline: '',
        previousChapter: '',
        characterSettings: ''
      },
      adjustment: {
        outline: '',
        previousChapter: '',
        characterSettings: ''
      }
    },
    // 新增：AI参数设置（按模式管理）
    // 注意：自定义模式的AI参数会在运行时动态创建
    aiParameters: {
      general: {
        temperature: 0.7,
        top_p: 0.7,
        n: 1
      },
      outline: {
        temperature: 0.7,
        top_p: 0.7,
        n: 1
      },
      writing: {
        temperature: 0.7,
        top_p: 0.7,
        n: 1
      },
      adjustment: {
        temperature: 0.7,
        top_p: 0.7,
        n: 1
      }
    },
    // 新增：检索设置
    retrievalTopK: 3, // 默认返回3个文档片段
    
    // 新增：RAG统一状态管理
    ragState: {
      // 嵌入模型相关
      embeddingModel: '',
      availableModels: [],
      embeddingDimensions: 1024,
      isCustomDimensions: false,
      
      // 知识库相关
      knowledgeBaseFiles: [],
      knowledgeBaseLoading: false,
      
      // 检索设置
      retrievalTopK: 3,
      
      // 文本分段
      chunkSize: 400,
      chunkOverlap: 50,
      
      // 意图分析
      intentAnalysisModel: '',
      intentAnalysisPrompt: '',
      
      // 加载状态
      loading: {
        allSettings: false,
        knowledgeBase: false
      },
      
      // 错误状态
      errors: {
        allSettings: '',
        knowledgeBase: ''
      }
    },
    
    // 新增：停止功能相关状态
    isStreaming: false, // 是否正在流式传输
    abortController: null // 用于中止请求的控制器
  },
  reducers: {
    deleteMessage: (state, action) => {
      const { messageId } = action.payload;
      const messageIndex = state.messages.findIndex(msg => msg.id === messageId);
      if (messageIndex !== -1) {
        // Remove the message and all subsequent messages
        state.messages.splice(messageIndex);
      }
    },
    updateMessageContent: (state, action) => {
      const { messageId, content } = action.payload;
      const message = state.messages.find(msg => msg.id === messageId);
      if (message) {
        message.content = content;
        message.text = content; // 确保 text 和 content 同步
      }
    },
    startEditing: (state, action) => {
      const { messageId } = action.payload;
      state.editingMessageId = messageId;
    },
    // submitEdit: (state, action) => {
    //   const { messageId, newContent } = action.payload;
    //   const message = state.messages.find(msg => msg.id === messageId);
    //   if (message) {
    //     message.content = newContent;
    //     message.text = newContent; // 确保 text 和 content 同步
    //   }
    //   state.editingMessageId = null;
    // },
    appendMessage: (state, action) => {
      const message = action.payload;
      // Ensure every message has a unique ID
      if (!message.id) {
        message.id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      }
      state.messages.push(message);
    },
    setQuestionCard: (state, action) => {
      state.questionCard = action.payload;
    },
    setMessages: (state, action) => {
      state.messages = action.payload;
    },
    // 新增：用于从历史记录中恢复和重构消息，以实现统一渲染
    restoreMessages: (state, action) => {
      const rawMessages = action.payload;
      const newMessages = [];
      
      if (!rawMessages || !Array.isArray(rawMessages)) {
        state.messages = [];
        return;
      }

      for (const msg of rawMessages) {
        // 为每个恢复的消息生成一个唯一的React key
        const id = msg.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-restored`;

        if (msg.role === 'user') {
          newMessages.push({
            id,
            sender: 'User',
            text: msg.content,
            role: 'user',
            content: msg.content,
            className: 'user',
            sessionId: msg.sessionId,
          });
        } else if (msg.role === 'assistant') {
          // 解析工具调用，并为历史记录添加 'historical' 状态
          const toolCalls = (msg.tool_calls || []).map(tc => {
            let toolArgs;
            try {
              toolArgs = JSON.parse(tc.function.arguments || '{}');
            } catch (e) {
              toolArgs = { error: 'failed to parse arguments', raw: tc.function.arguments };
            }
            return {
              id: tc.id,
              function: tc.function,
              type: 'function',
              toolArgs,
              // **关键**: 添加状态以告知UI这是历史记录，不应有交互按钮
              status: 'historical',
            };
          });

          newMessages.push({
            id,
            sender: 'AI',
            text: msg.content || '',
            role: 'assistant',
            content: msg.content || '',
            className: 'ai',
            sessionId: msg.sessionId,
            // 只有当存在工具调用时才添加此属性
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
            isLoading: false,
          });
        } else if (msg.role === 'tool') {
            // 将工具执行结果格式化为一条易于阅读的系统消息
            let resultText = `[Tool execution: ${msg.name}]`;
            try {
                const result = JSON.parse(msg.content);
                if (result.success) {
                    resultText = `✅ 工具 [${msg.name}] 已成功执行。`;
                } else {
                    resultText = `❌ 工具 [${msg.name}] 执行失败: ${result.error || '未知错误'}`;
                }
            } catch(e) { /* 忽略解析错误，使用默认文本 */ }

            newMessages.push({
                id,
                sender: 'System',
                text: resultText,
                role: 'system',
                content: resultText,
                className: 'system-message',
                sessionId: msg.sessionId,
            });
        }
        // 我们在此处特意过滤掉 role === 'system' 的消息，因为它们是给AI的上下文，通常不在对话中展示。
      }
      
      // 重置整个聊天状态，并用重构后的消息列表替换
      state.messages = newMessages;
      state.pendingToolCalls = [];
      state.toolCallState = 'idle';
      state.questionCard = null;
    },
    setIsHistoryPanelVisible: (state, action) => {
      state.isHistoryPanelVisible = action.payload;
    },
    setDeepSeekHistory: (state, action) => {
      state.deepSeekHistory = action.payload;
    },
    // Omitted: setToolSuggestions, setToolStatus, clearToolSuggestions
    // New reducers will be added later to handle tool call actions.
    approveToolCalls: (state) => {
        // Logic to be implemented by ChatPanel: send IPC message
        state.pendingToolCalls = [];
        state.toolCallState = 'idle';
    },
    rejectToolCalls: (state) => {
        // Logic to be implemented by ChatPanel: send IPC message
        state.pendingToolCalls = [];
        state.toolCallState = 'idle';
    },
    setSelectedModel: (state, action) => {
      state.selectedModel = action.payload;
    },
    setShowApiSettingsModal: (state, action) => {
      state.showApiSettingsModal = action.payload;
    },
    setShowRagSettingsModal: (state, action) => {
      state.showRagSettingsModal = action.payload;
    },
    setShowGeneralSettingsModal: (state, action) => {
      state.showGeneralSettingsModal = action.payload;
    },
    setShowHomePage: (state, action) => { // 新增：设置主页面显示状态
      state.showHomePage = action.payload;
    },
    setShowWorkspacePanel: (state, action) => { // 新增：设置工作区面板显示状态
      state.showWorkspacePanel = action.payload;
    },
    setShowPersistentMemoryPanel: (state, action) => { // 新增：设置持久记忆面板显示状态
      state.showPersistentMemoryPanel = action.payload;
    },
    setDeepseekApiKey: (state, action) => {
      state.deepseekApiKey = action.payload;
    },
    setOpenrouterApiKey: (state, action) => {
      state.openrouterApiKey = action.payload;
    },
    setSiliconflowApiKey: (state, action) => { // 新增：设置硅基流动API Key
      state.siliconflowApiKey = action.payload;
    },
    setAliyunApiKey: (state, action) => { // 新增：设置阿里云百炼API Key
      state.aliyunApiKey = action.payload;
    },
    setOllamaBaseUrl: (state, action) => {
      state.ollamaBaseUrl = action.payload;
    },
    setSelectedProvider: (state, action) => {
      state.selectedProvider = action.payload;
    },
    setEmbeddingModel: (state, action) => { // 新增：设置嵌入模型
      state.embeddingModel = action.payload;
    },
    setIntentAnalysisModel: (state, action) => { // 新增：设置意图分析模型
      state.intentAnalysisModel = action.payload;
    },
    setAliyunEmbeddingApiKey: (state, action) => { // 新增：设置阿里云嵌入API Key
      state.aliyunEmbeddingApiKey = action.payload;
    },
    setCustomProviders: (state, action) => { // 新增：设置自定义提供商列表
      state.customProviders = action.payload;
    },
    setAvailableModels: (state, action) => { // 新增：设置可用模型列表
        state.availableModels = action.payload;
    },
    setCustomSystemPrompt: (state, action) => { // 新增：设置自定义系统提示词
        state.customSystemPrompt = action.payload;
    },
    resetCustomSystemPrompt: (state) => { // 新增：重置自定义系统提示词（旧版）
        state.customSystemPrompt = DEFAULT_SYSTEM_PROMPT;
    },
    setCustomPromptForMode: (state, action) => { // 新增：设置特定模式的自定义提示词
        const { mode, prompt } = action.payload;
        state.customPrompts[mode] = prompt;
    },
    resetCustomPromptForMode: (state, action) => { // 新增：重置特定模式的自定义提示词
        const { mode } = action.payload;
        state.customPrompts[mode] = '';
    },
    setEnableStream: (state, action) => { // 新增：设置是否启用流式传输
        state.enableStream = action.payload;
    },
    setRagRetrievalEnabled: (state, action) => { // 新增：设置RAG检索启用状态
      state.ragRetrievalEnabled = action.payload;
    },
    // 新增：设置特定模式的功能启用状态
    setModeFeatureSetting: (state, action) => {
      const { mode, feature, enabled } = action.payload;
      // 为自定义模式动态创建状态
      if (!state.modeFeatureSettings[mode]) {
        state.modeFeatureSettings[mode] = {
          ragRetrievalEnabled: false,
          ragTableNames: []
        };
      }
      state.modeFeatureSettings[mode][feature] = enabled;
    },
    // 新增：重置特定模式的所有功能设置
    resetModeFeatureSettings: (state, action) => {
      const { mode } = action.payload;
      // 为自定义模式动态创建状态
      if (!state.modeFeatureSettings[mode]) {
        state.modeFeatureSettings[mode] = {
          ragRetrievalEnabled: false,
          ragTableNames: []
        };
      } else {
        state.modeFeatureSettings[mode] = {
          ragRetrievalEnabled: false,
          ragTableNames: []
        };
      }
    },
    // 新增：设置特定模式的RAG表选择
    setRagTableNames: (state, action) => {
      const { mode, tableNames } = action.payload;
      // 为自定义模式动态创建状态
      if (!state.modeFeatureSettings[mode]) {
        state.modeFeatureSettings[mode] = {
          ragRetrievalEnabled: false,
          ragTableNames: []
        };
      }
      state.modeFeatureSettings[mode].ragTableNames = tableNames;
    },
    // 新增：设置上下文限制设置
    setContextLimitSettings: (state, action) => {
      state.contextLimitSettings = action.payload;
    },
    // 新增：设置附加信息
    setAdditionalInfoForMode: (state, action) => {
      const { mode, info } = action.payload;
      state.additionalInfo[mode] = info;
    },
    // 新增：设置特定附加信息字段
    setAdditionalInfoFieldForMode: (state, action) => {
      const { mode, field, value } = action.payload;
      // 为自定义模式动态创建状态
      if (!state.additionalInfo[mode]) {
        state.additionalInfo[mode] = {
          outline: '',
          previousChapter: '',
          characterSettings: ''
        };
      }
      state.additionalInfo[mode][field] = value;
    },
    // 新增：重置附加信息
    resetAdditionalInfoForMode: (state, action) => {
      const { mode } = action.payload;
      // 为自定义模式动态创建状态
      if (!state.additionalInfo[mode]) {
        state.additionalInfo[mode] = {
          outline: '',
          previousChapter: '',
          characterSettings: ''
        };
      } else {
        state.additionalInfo[mode] = {
          outline: '',
          previousChapter: '',
          characterSettings: ''
        };
      }
    },
    // 新增：批量更新所有模式的附加信息
    setAdditionalInfoForAllModes: (state, action) => {
      const { info } = action.payload;
      for (const mode of ['general', 'outline', 'writing', 'adjustment']) {
        state.additionalInfo[mode] = { ...info };
      }
    },
    // 新增：设置特定模式的AI参数
    setAiParameterForMode: (state, action) => {
      const { mode, parameter, value } = action.payload;
      if (state.aiParameters[mode] && state.aiParameters[mode].hasOwnProperty(parameter)) {
        state.aiParameters[mode][parameter] = value;
      }
    },
    // 新增：设置特定模式的AI参数
    setAiParametersForMode: (state, action) => {
      const { mode, parameters } = action.payload;
      // 为自定义模式动态创建状态
      if (!state.aiParameters[mode]) {
        state.aiParameters[mode] = {
          temperature: 0.7,
          top_p: 0.7,
          n: 1
        };
      }
      state.aiParameters[mode] = { ...state.aiParameters[mode], ...parameters };
    },
    // 新增：重置特定模式的AI参数为默认值
    resetAiParametersForMode: (state, action) => {
      const { mode } = action.payload;
      // 为自定义模式动态创建状态
      if (!state.aiParameters[mode]) {
        state.aiParameters[mode] = {
          temperature: 0.7,
          top_p: 0.7,
          n: 1
        };
      } else {
        state.aiParameters[mode] = {
          temperature: 0.7,
          top_p: 0.7,
          n: 1
        };
      }
    },
    // 新增：批量设置所有模式的AI参数
    setAiParametersForAllModes: (state, action) => {
      const { parameters } = action.payload;
      for (const mode of ['general', 'outline', 'writing', 'adjustment']) {
        if (state.aiParameters[mode]) {
          state.aiParameters[mode] = { ...state.aiParameters[mode], ...parameters };
        }
      }
    },
    // 新增：设置检索返回文档片段数
    setRetrievalTopK: (state, action) => {
      state.retrievalTopK = action.payload;
    },
    
    // 新增：RAG统一状态管理reducers
    setRagLoading: (state, action) => {
      const { loading } = action.payload;
      state.ragState.loading = { ...state.ragState.loading, ...loading };
    },
    
    setRagError: (state, action) => {
      const { errors } = action.payload;
      state.ragState.errors = { ...state.ragState.errors, ...errors };
    },
    
    setAllRagSettings: (state, action) => {
      const settings = action.payload;
      state.ragState = { ...state.ragState, ...settings };
    },
    
    setRagEmbeddingModel: (state, action) => {
      state.ragState.embeddingModel = action.payload;
    },
    
    setRagAvailableModels: (state, action) => {
      state.ragState.availableModels = action.payload;
    },
    
    setRagKnowledgeBaseFiles: (state, action) => {
      state.ragState.knowledgeBaseFiles = action.payload;
    },
    
    setRagRetrievalTopK: (state, action) => {
      state.ragState.retrievalTopK = action.payload;
    },
    
    setRagChunkSettings: (state, action) => {
      const { chunkSize, chunkOverlap } = action.payload;
      state.ragState.chunkSize = chunkSize;
      state.ragState.chunkOverlap = chunkOverlap;
    },
    
    setRagIntentAnalysisSettings: (state, action) => {
      const { intentAnalysisModel, intentAnalysisPrompt } = action.payload;
      state.ragState.intentAnalysisModel = intentAnalysisModel;
      state.ragState.intentAnalysisPrompt = intentAnalysisPrompt;
    },
    
    setRagEmbeddingDimensions: (state, action) => {
      const { embeddingDimensions, isCustomDimensions } = action.payload;
      state.ragState.embeddingDimensions = embeddingDimensions;
      state.ragState.isCustomDimensions = isCustomDimensions;
    },
    
    // 新增：停止功能相关reducer
    setStreamingState: (state, action) => {
      const { isStreaming, abortController } = action.payload;
      state.isStreaming = isStreaming;
      state.abortController = abortController;
    },
    stopStreaming: (state) => {
      if (state.abortController) {
        state.abortController.abort();
        console.log('[chatSlice] 已中止流式传输');
      }
      state.isStreaming = false;
      state.abortController = null;
      
      // 将最后一条AI消息的加载状态设为false
      const lastMessage = state.messages[state.messages.length - 1];
      if (lastMessage && lastMessage.role === 'assistant' && lastMessage.isLoading) {
        lastMessage.isLoading = false;
      }
    },
    // --- 新增：用于处理来自 IPC 的 AI 响应的通用 Reducer ---
    ipcAiResponseReceived: (state, action) => {
        const { type, payload } = action.payload; // payload 现在包含 type 和具体数据
        const currentMessages = state.messages; // Redux Toolkit 允许直接修改 state，因为它内部使用了 Immer

        switch (type) {
            case 'text_stream':
            case 'tool_stream':
                // **第四次关键修复**: 统一处理流式响应，并由 reducer 智能创建占位符
                let lastAssistantMessage = currentMessages[currentMessages.length - 1];

                // 检查最后一条消息是否不是AI消息，如果是，则说明需要一个新的AI消息占位符
                if (!lastAssistantMessage || lastAssistantMessage.role !== 'assistant') {
                    const newPlaceholder = {
                        sender: 'AI',
                        text: '',
                        role: 'assistant',
                        content: '',
                        className: 'ai',
                        sessionId: payload.sessionId, // 从 payload 获取 sessionId
                        isLoading: true,
                    };
                    currentMessages.push(newPlaceholder);
                    lastAssistantMessage = newPlaceholder;
                }

                // 只有在第一次收到数据时才清空占位内容，但保持 isLoading 状态
                if (lastAssistantMessage.isLoading && !lastAssistantMessage.content && !lastAssistantMessage.text) {
                    lastAssistantMessage.content = '';
                    lastAssistantMessage.text = '';
                }

                // 根据类型处理数据
                if (type === 'text_stream') {
                    lastAssistantMessage.content += payload.content;
                    lastAssistantMessage.text += payload.content;
                } else if (type === 'tool_stream') {
                    state.toolCallState = 'streaming';
                    const toolCallDeltas = payload;

                    if (!lastAssistantMessage.toolCalls) {
                        lastAssistantMessage.toolCalls = [];
                    }
                    toolCallDeltas.forEach(delta => {
                        const { index, id } = delta;
                        const func = delta.function;
                        if (func && func.arguments) {
                            lastAssistantMessage.content += func.arguments;
                            lastAssistantMessage.text += func.arguments;
                        }
                        if (!lastAssistantMessage.toolCalls[index]) {
                            lastAssistantMessage.toolCalls[index] = { id: '', function: { name: '', arguments: '' }, type: 'function' };
                        }
                        const toolCall = lastAssistantMessage.toolCalls[index];
                        if (id) toolCall.id = id;
                        if (func) {
                            if (func.name) toolCall.function.name = func.name;
                            if (func.arguments) toolCall.function.arguments += func.arguments;
                        }
                    });
                    // 更新 pendingToolCalls 保持同步
                    toolCallDeltas.forEach(delta => {
                        const { index, id } = delta;
                        const func = delta.function;
                        if (!state.pendingToolCalls[index]) {
                            state.pendingToolCalls[index] = { toolCallId: '', function: { name: '', arguments: '' } };
                        }
                        const pendingTool = state.pendingToolCalls[index];
                        if (id) pendingTool.toolCallId = id;
                        if (func) {
                            if (func.name) pendingTool.function.name = func.name;
                            if (func.arguments) pendingTool.function.arguments += func.arguments;
                        }
                    });
                }
                break;
            case 'text_stream_end':
                // 流结束时，对最终的消息和工具调用进行处理
                const lastMessage = currentMessages[currentMessages.length - 1];
                if (lastMessage && lastMessage.role === 'assistant') {
                    lastMessage.isLoading = false;
                }

                // 最终解析所有累积的工具调用参数
                const processAndParseTools = (toolList) => {
                    if (!Array.isArray(toolList)) return;
                    toolList.forEach(tool => {
                        if (tool.function && typeof tool.function.arguments === 'string' && !tool.toolArgs) {
                            try {
                                tool.toolArgs = JSON.parse(tool.function.arguments);
                            } catch (e) {
                                console.error(`解析工具参数失败: ${tool.function.arguments}`, e);
                                tool.toolArgs = { "error": "failed to parse arguments" };
                            }
                        }
                    });
                };

                processAndParseTools(lastMessage.toolCalls);
                processAndParseTools(state.pendingToolCalls);

                // 流结束后，不再修改 toolCallState，让 tool_suggestions 全权负责
                break;
            case 'text':
                let messageUpdated = false;
                for (let i = currentMessages.length - 1; i >= 0; i--) {
                    const msg = currentMessages[i];
                    if (msg.role === 'assistant' && msg.isLoading) { // 修改判断条件
                        // **关键修复**: 从 payload 对象中只提取 content
                        msg.text = payload.content;
                        msg.content = payload.content;
                        msg.isLoading = false; // 移除加载状态
                        messageUpdated = true;
                        break;
                    }
                }
                if (!messageUpdated) {
                    currentMessages.push({
                        sender: 'AI',
                        // **关键修复**: 从 payload 对象中只提取 content
                        text: payload.content,
                        role: 'assistant',
                        content: payload.content,
                        className: 'ai',
                        sessionId: payload.sessionId,
                        isLoading: false,
                    });
                }
                break;
            case 'reasoning_content':
                let foundExistingReasoningMessage = false;
                const lastAiMessageIndex = currentMessages.length - 1;
                if (lastAiMessageIndex >= 0 && currentMessages[lastAiMessageIndex].role === 'assistant' && currentMessages[lastAiMessageIndex].sessionId === payload.sessionId) {
                    currentMessages[lastAiMessageIndex].reasoning_content = payload.content;
                    foundExistingReasoningMessage = true;
                }
                if (!foundExistingReasoningMessage) {
                    currentMessages.push({
                        sender: 'AI',
                        text: '', // 文本内容暂时为空
                        role: 'assistant',
                        content: '',
                        className: 'ai',
                        sessionId: payload.sessionId,
                        reasoning_content: payload.content,
                    });
                }
                break;
            case 'end_task': // 这个 case 作为备用，主要逻辑在 tool_suggestions 中处理
                const lastMsgForEndTask = currentMessages[currentMessages.length - 1];
                if (lastMsgForEndTask && lastMsgForEndTask.role === 'assistant') {
                    lastMsgForEndTask.content = payload; // payload 就是总结字符串
                    lastMsgForEndTask.text = payload;
                    lastMsgForEndTask.isLoading = false;
                    lastMsgForEndTask.toolCalls = []; // 清空工具调用
                }
                // 确保状态被重置
                state.pendingToolCalls = [];
                state.toolCallState = 'idle';
                break;
            case 'tool_suggestions':
                const suggestions = payload;
                const lastMessageForSuggestions = currentMessages[currentMessages.length - 1];
                
                // **最终修复**: 在 suggestions 中直接处理 end_task 和 ask_user_question
                const endTaskTool = suggestions.find(tool => tool.function && tool.function.name === 'end_task');
                const askUserQuestionTool = suggestions.find(tool => tool.function && tool.function.name === 'ask_user_question');

                if (endTaskTool) {
                    let summary = "任务已完成。"; // 默认总结
                    try {
                        // 兼容 summary 和 final_message 两种参数格式
                        const args = endTaskTool.toolArgs || JSON.parse(endTaskTool.function.arguments);
                        summary = args.summary || args.final_message || summary;
                    } catch (e) {
                        console.error("解析 end_task 参数失败:", e);
                    }
                    
                    if (lastMessageForSuggestions && lastMessageForSuggestions.role === 'assistant') {
                        lastMessageForSuggestions.content = summary;
                        lastMessageForSuggestions.text = summary;
                        lastMessageForSuggestions.isLoading = false;
                        lastMessageForSuggestions.toolCalls = []; // 清空工具调用
                    }
                    
                    // 重置状态，不显示批准按钮
                    state.pendingToolCalls = [];
                    state.toolCallState = 'idle';

                } else if (askUserQuestionTool) {
                    // 如果是提问工具，则设置 questionCard
                    const args = askUserQuestionTool.toolArgs || JSON.parse(askUserQuestionTool.function.arguments);
                    state.questionCard = {
                        question: args.question,
                        options: args.options || [],
                        toolCallId: askUserQuestionTool.toolCallId
                    };
                    // 清空待处理工具调用，并将状态设为 idle，因为这个问题由一个专门的卡片处理
                    state.pendingToolCalls = [];
                    state.toolCallState = 'idle';

                } else {
                    // 否则，正常处理其他工具建议
                    if (lastMessageForSuggestions && lastMessageForSuggestions.role === 'assistant') {
                        // 保留已有的文字内容，只添加工具调用信息
                        const toolCallInfo = JSON.stringify(suggestions, null, 2);
                        try {
                            // 如果已有内容，则追加工具调用信息，否则只显示工具调用
                            if (lastMessageForSuggestions.content && lastMessageForSuggestions.content.trim()) {
                                lastMessageForSuggestions.content += `\n\n--- 工具调用请求 ---\n${toolCallInfo}`;
                                lastMessageForSuggestions.text += `\n\n--- 工具调用请求 ---\n${toolCallInfo}`;
                            } else {
                                lastMessageForSuggestions.content = toolCallInfo;
                                lastMessageForSuggestions.text = toolCallInfo;
                            }
                        } catch (e) {
                            // 如果JSON序列化失败，使用原始建议数据
                            const fallbackInfo = Array.isArray(suggestions) ?
                                suggestions.map(tool => tool.function?.name || '未知工具').join(', ') :
                                String(suggestions);
                            if (lastMessageForSuggestions.content && lastMessageForSuggestions.content.trim()) {
                                lastMessageForSuggestions.content += `\n\n--- 工具调用请求 ---\n${fallbackInfo}`;
                                lastMessageForSuggestions.text += `\n\n--- 工具调用请求 ---\n${fallbackInfo}`;
                            } else {
                                lastMessageForSuggestions.content = fallbackInfo;
                                lastMessageForSuggestions.text = fallbackInfo;
                            }
                        }
                        lastMessageForSuggestions.toolCalls = suggestions.map(tool => ({
                            id: tool.toolCallId,
                            function: tool.function,
                            type: 'function',
                            toolArgs: tool.toolArgs,
                        }));
                    }
                    state.pendingToolCalls = suggestions;
                    state.toolCallState = 'pending_user_action';
                }
                break;
            case 'ask_user_question':
                state.questionCard = payload;
                break;
            case 'error':
                currentMessages.push({ sender: 'System', text: `错误: ${payload}`, role: 'system', content: `错误: ${payload}`, className: 'system-error', sessionId: payload.sessionId });
                state.pendingToolCalls = [];
                state.toolCallState = 'idle';
                break;
            case 'warning':
                currentMessages.push({ sender: 'System', text: `警告: ${payload}`, role: 'system', content: `警告: ${payload}`, className: 'system-warning', sessionId: payload.sessionId });
                break;
            case 'tool_action_status':
            case 'tool_execution_status':
                // 统一处理工具状态更新
                const messageText = `工具 ${payload.toolName} 执行${payload.success ? '成功' : '失败'}：${payload.message}`;
                currentMessages.push({
                    sender: 'System',
                    text: messageText,
                    role: 'system',
                    content: messageText,
                    className: 'system-message',
                    sessionId: payload.sessionId,
                });
                // 状态更新逻辑可能需要调整，但暂时保持不变
                break;
            case 'batch_action_status':
                currentMessages.push({
                    sender: 'System',
                    text: payload.message,
                    role: 'system',
                    content: payload.message,
                    className: 'system-message',
                    sessionId: payload.sessionId,
                });
                break;
            case 'batch_processing_complete':
                 // 这个事件目前只在后端日志中使用，前端可以暂时忽略它或添加一个不显示的日志
                console.log('[chatSlice] Batch processing complete signal received.');
                break;
            default:
                console.warn(`[chatSlice] 未知 AI 响应类型: ${type}`);
        }
    },
  },
  // extraReducers 用于处理非本 slice 定义的 action，这里用于监听 ipc/aiResponse
  extraReducers: (builder) => {
    builder
      .addCase('chat/ipcAiResponse', (state, action) => {
        // 将 'chat/ipcAiResponse' action 转发给 ipcAiResponseReceived reducer
        // 注意：这里需要调用 caseReducers，因为 ipcAiResponseReceived 不是直接暴露的 action creator
        chatSlice.caseReducers.ipcAiResponseReceived(state, action);
      });
      // 可以添加其他 ipc/* action 的处理，例如 novel slice 的
  },
});

export const {
  appendMessage,
  setQuestionCard,
  setMessages,
  restoreMessages, // <--- 导出新的 reducer
  // 导出所有其他 chatSlice.actions
  // ipcAiResponseReceived 不需要导出，因为它只在 extraReducers 中被调用
  setIsHistoryPanelVisible,
  setDeepSeekHistory,
  approveToolCalls,
  rejectToolCalls,
  setSelectedModel,
  setShowApiSettingsModal,
  setShowRagSettingsModal,
  setShowGeneralSettingsModal,
  setShowHomePage, // 新增：导出 setShowHomePage
  setShowWorkspacePanel, // 新增：导出 setShowWorkspacePanel
  setShowPersistentMemoryPanel, // 新增：导出 setShowPersistentMemoryPanel
  setDeepseekApiKey,
  setOpenaiApiKey, // 新增
  setOpenrouterApiKey,
  setSiliconflowApiKey, // 新增：导出 setSiliconflowApiKey
  setAliyunApiKey, // 新增：导出 setAliyunApiKey
  setOllamaBaseUrl, // 新增
  setSelectedProvider, // 新增：导出 setSelectedProvider
  setEmbeddingModel, // 新增：导出 setEmbeddingModel
  setAliyunEmbeddingApiKey, // 新增：导出 setAliyunEmbeddingApiKey
  setIntentAnalysisModel, // 新增：导出 setIntentAnalysisModel
  setAvailableModels, // 新增：导出 setAvailableModels
  setCustomProviders, // 新增：导出 setCustomProviders
  setCustomSystemPrompt, // 新增：导出 setCustomSystemPrompt
  resetCustomSystemPrompt, // 新增：导出 resetCustomSystemPrompt
  setCustomPromptForMode, // 新增：导出 setCustomPromptForMode
  resetCustomPromptForMode, // 新增：导出 resetCustomPromptForMode
  setEnableStream, // 新增：导出 setEnableStream
  setRagRetrievalEnabled, // 新增：导出 setRagRetrievalEnabled
  setModeFeatureSetting, // 新增：导出 setModeFeatureSetting
  resetModeFeatureSettings, // 新增：导出 resetModeFeatureSettings
  setContextLimitSettings, // 新增：导出 setContextLimitSettings
  setRagTableNames, // 新增：导出 setRagTableNames
  setAdditionalInfoForMode, // 新增：导出 setAdditionalInfoForMode
  setAdditionalInfoFieldForMode, // 新增：导出 setAdditionalInfoFieldForMode
  resetAdditionalInfoForMode, // 新增：导出 resetAdditionalInfoForMode
  setAdditionalInfoForAllModes, // 新增：导出 setAdditionalInfoForAllModes
  setAiParameterForMode, // 新增：导出 setAiParameterForMode
  setAiParametersForMode, // 新增：导出 setAiParametersForMode
  resetAiParametersForMode, // 新增：导出 resetAiParametersForMode
  setAiParametersForAllModes, // 新增：导出 setAiParametersForAllModes
  setStreamingState, // 新增：导出 setStreamingState
  stopStreaming, // 新增：导出 stopStreaming
  setRetrievalTopK, // 新增：导出 setRetrievalTopK
  // 新增：导出RAG统一状态管理actions
  setRagLoading,
  setRagError,
  setAllRagSettings,
  setRagEmbeddingModel,
  setRagAvailableModels,
  setRagKnowledgeBaseFiles,
  setRagRetrievalTopK,
  setRagChunkSettings,
  setRagIntentAnalysisSettings,
  setRagEmbeddingDimensions,
  deleteMessage,
  updateMessageContent, // 新增：导出 updateMessageContent
  startEditing,
  // submitEdit,
} = chatSlice.actions;

export { DEFAULT_SYSTEM_PROMPT }; // 导出默认提示词

export default chatSlice.reducer;
