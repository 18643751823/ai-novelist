import { createSlice, combineReducers } from '@reduxjs/toolkit';
import messageReducer from './messageSlice';
import toolReducer from './toolSlice';
import ragReducer from './ragSlice';
import apiReducer from './apiSlice';
import modeReducer from './modeSlice';

// 主chatSlice - 组合所有子模块
const chatSlice = createSlice({
  name: 'chat',
  initialState: {
    // 界面状态
    showApiSettingsModal: false,
    showRagSettingsModal: false,
    showGeneralSettingsModal: false,
    showHomePage: true,
    showWorkspacePanel: false,
    showPersistentMemoryPanel: false
  },
  reducers: {
    // 界面状态管理
    setShowApiSettingsModal: (state, action) => {
      state.showApiSettingsModal = action.payload;
    },
    
    setShowRagSettingsModal: (state, action) => {
      state.showRagSettingsModal = action.payload;
    },
    
    setShowGeneralSettingsModal: (state, action) => {
      state.showGeneralSettingsModal = action.payload;
    },
    
    setShowHomePage: (state, action) => {
      state.showHomePage = action.payload;
    },
    
    setShowWorkspacePanel: (state, action) => {
      state.showWorkspacePanel = action.payload;
    },
    
    setShowPersistentMemoryPanel: (state, action) => {
      state.showPersistentMemoryPanel = action.payload;
    },
    
    // 跨模块协调操作
    // 处理来自IPC的AI响应，分发到相应子模块
    ipcAiResponseReceived: (state, action) => {
      const { type, payload } = action.payload;
      
      // 这个action主要用于分发到其他子模块
      // 具体的处理逻辑在各个子模块中实现
      console.log(`[chatSlice] 分发AI响应类型: ${type}`, payload);
    },
    
    // 批量重置所有状态
    resetAllChatState: (state) => {
      // 重置界面状态
      state.showApiSettingsModal = false;
      state.showRagSettingsModal = false;
      state.showGeneralSettingsModal = false;
      state.showHomePage = true;
      state.showWorkspacePanel = false;
      state.showPersistentMemoryPanel = false;
      
      // 注意：子模块的状态需要在各自的reducer中重置
      console.log('[chatSlice] 重置所有聊天状态');
    }
  },
  // 使用extraReducers来监听其他slice的actions
  extraReducers: (builder) => {
    builder
      // 监听来自IPC的AI响应，并分发到messageSlice处理
      .addCase('chat/ipcAiResponse', (state, action) => {
        // 将 'chat/ipcAiResponse' action 转发给messageSlice处理
        // 具体的处理逻辑在messageSlice中实现
        console.log('[chatSlice] 接收到IPC AI响应', action.payload);
      });
  }
});

// 组合所有子模块的reducer
export const combinedChatReducer = combineReducers({
  // 主chatSlice的状态
  ui: chatSlice.reducer,
  // 子模块的状态
  message: messageReducer,
  tool: toolReducer,
  rag: ragReducer,
  api: apiReducer,
  mode: modeReducer
});

// 导出所有actions
export const {
  setShowApiSettingsModal,
  setShowRagSettingsModal,
  setShowGeneralSettingsModal,
  setShowHomePage,
  setShowWorkspacePanel,
  setShowPersistentMemoryPanel,
  ipcAiResponseReceived,
  resetAllChatState
} = chatSlice.actions;

// 重新导出所有子模块的actions，保持向后兼容性
export * from './messageSlice';
export * from './toolSlice';
export * from './ragSlice';
export * from './apiSlice';
export * from './modeSlice';


// 导出组合后的reducer作为默认导出
export default combinedChatReducer;
