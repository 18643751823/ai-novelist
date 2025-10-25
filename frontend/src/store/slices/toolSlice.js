import { createSlice } from '@reduxjs/toolkit';

// 工具调用子模块
const toolSlice = createSlice({
  name: 'tool',
  initialState: {
    pendingToolCalls: [],
    toolCallState: 'idle', // 'idle', 'streaming', 'pending_user_action'
    enableStream: true
  },
  reducers: {
    // 工具调用状态管理
    setToolCallState: (state, action) => {
      state.toolCallState = action.payload;
    },
    
    setPendingToolCalls: (state, action) => {
      state.pendingToolCalls = action.payload;
    },
    
    // 工具调用审批
    approveToolCalls: (state) => {
      state.pendingToolCalls = [];
      state.toolCallState = 'idle';
    },
    
    rejectToolCalls: (state) => {
      state.pendingToolCalls = [];
      state.toolCallState = 'idle';
    },
    
    // 流式传输设置
    setEnableStream: (state, action) => {
      state.enableStream = action.payload;
    },
    
    // 工具流式处理
    handleToolStream: (state, action) => {
      const toolCallDeltas = action.payload;
      state.toolCallState = 'streaming';

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
    },
    
    // 工具建议处理
    handleToolSuggestions: (state, action) => {
      const suggestions = action.payload;
      
      // 处理 ask_user_question 特殊工具
      const askUserQuestionTool = suggestions.find(tool => tool.function && tool.function.name === 'ask_user_question');

      if (askUserQuestionTool) {
        // 如果是提问工具，清空待处理工具调用
        state.pendingToolCalls = [];
        state.toolCallState = 'idle';
      } else {
        // 正常处理其他工具建议
        state.pendingToolCalls = suggestions;
        state.toolCallState = 'pending_user_action';
      }
    },
    
    // 工具流结束处理
    handleToolStreamEnd: (state) => {
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

      processAndParseTools(state.pendingToolCalls);
    },
    
    // 清除工具调用状态
    clearToolCalls: (state) => {
      state.pendingToolCalls = [];
      state.toolCallState = 'idle';
    }
  },
  // 使用extraReducers来监听来自chatSlice的AI响应
  extraReducers: (builder) => {
    builder
      .addCase('chat/ipcAiResponse', (state, action) => {
        const { type, payload } = action.payload;
        
        switch (type) {
          case 'tool_stream':
            // 处理工具流式传输
            toolSlice.caseReducers.handleToolStream(state, { payload });
            break;
            
          case 'tool_suggestions':
            // 处理工具建议
            toolSlice.caseReducers.handleToolSuggestions(state, { payload });
            break;
            
          case 'text_stream_end':
            // 处理流结束
            toolSlice.caseReducers.handleToolStreamEnd(state);
            break;
            
          default:
            // 其他消息类型由其他slice处理
            break;
        }
      });
  }
});

export const {
  setToolCallState,
  setPendingToolCalls,
  approveToolCalls,
  rejectToolCalls,
  setEnableStream,
  handleToolStream,
  handleToolSuggestions,
  handleToolStreamEnd,
  clearToolCalls
} = toolSlice.actions;

export default toolSlice.reducer;