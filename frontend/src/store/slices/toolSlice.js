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
        const { index, id, name, args } = delta;
        if (!state.pendingToolCalls[index]) {
          state.pendingToolCalls[index] = {
            toolCallId: '',
            name: '',
            args: {}
          };
        }
        const pendingTool = state.pendingToolCalls[index];
        if (id) pendingTool.toolCallId = id;
        if (name) pendingTool.name = name;
        if (args) {
          // 合并参数
          pendingTool.args = { ...pendingTool.args, ...args };
        }
      });
    },
    
    // 工具建议处理
    handleToolSuggestions: (state, action) => {
      const suggestions = action.payload;
      
      // 处理 ask_user_question 特殊工具
      const askUserQuestionTool = suggestions.find(tool =>
        (tool.name === 'ask_user_question') || (tool.function && tool.function.name === 'ask_user_question')
      );

      if (askUserQuestionTool) {
        // 如果是提问工具，清空待处理工具调用
        state.pendingToolCalls = [];
        state.toolCallState = 'idle';
      } else {
        // 正常处理其他工具建议
        state.pendingToolCalls = suggestions.map(tool => ({
          toolCallId: tool.toolCallId || tool.id,
          name: tool.name || tool.function?.name,
          args: tool.args || tool.toolArgs || {},
          type: tool.type || 'tool_call'
        }));
        state.toolCallState = 'pending_user_action';
      }
    },
    
    // 工具流结束处理
    handleToolStreamEnd: (state) => {
      // 新格式中 args 已经是对象，不需要额外解析
      const processAndParseTools = (toolList) => {
        if (!Array.isArray(toolList)) return;
        toolList.forEach(tool => {
          // 确保 args 是对象格式
          if (tool.args && typeof tool.args === 'string') {
            try {
              tool.args = JSON.parse(tool.args);
            } catch (e) {
              console.error(`解析工具参数失败: ${tool.args}`, e);
              tool.args = { "error": "failed to parse arguments" };
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