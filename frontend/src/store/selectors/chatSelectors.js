import { createSelector } from '@reduxjs/toolkit';

// 基础选择器 - 获取各个子模块的状态
const selectMessageState = (state) => state.chat.message;
const selectApiState = (state) => state.chat.api;
const selectToolState = (state) => state.chat.tool;
const selectModeState = (state) => state.chat.mode;

// 记忆化的选择器 - 避免不必要的重新渲染

// 消息相关选择器
export const selectMessages = createSelector(
  [selectMessageState],
  (messageState) => messageState.messages
);

export const selectQuestionCard = createSelector(
  [selectMessageState],
  (messageState) => messageState.questionCard
);

export const selectInterruptCard = createSelector(
  [selectMessageState],
  (messageState) => messageState.interruptCard
);

export const selectIsHistoryPanelVisible = createSelector(
  [selectMessageState],
  (messageState) => messageState.isHistoryPanelVisible
);

export const selectSessionHistory = createSelector(
  [selectMessageState],
  (messageState) => messageState.sessionHistory
);

export const selectIsStreaming = createSelector(
  [selectMessageState],
  (messageState) => messageState.isStreaming
);

// API相关选择器
export const selectAliyunEmbeddingApiKey = createSelector(
  [selectApiState],
  (apiState) => apiState.aliyunEmbeddingApiKey
);

export const selectSelectedModel = createSelector(
  [selectApiState],
  (apiState) => apiState.selectedModel
);

export const selectAvailableModels = createSelector(
  [selectApiState],
  (apiState) => apiState.availableModels
);

// 工具相关选择器
export const selectEnableStream = createSelector(
  [selectToolState],
  (toolState) => toolState.enableStream
);

export const selectToolCallState = createSelector(
  [selectToolState],
  (toolState) => toolState.toolCallState
);

export const selectPendingToolCalls = createSelector(
  [selectToolState],
  (toolState) => toolState.pendingToolCalls
);

// 模式相关选择器
export const selectModeFeatureSettings = createSelector(
  [selectModeState],
  (modeState) => modeState.modeFeatureSettings
);

export const selectAiParameters = createSelector(
  [selectModeState],
  (modeState) => modeState.aiParameters
);

// 组合选择器 - 用于ChatPanel的多个状态
export const selectChatPanelState = createSelector(
  [
    selectMessages,
    selectQuestionCard,
    selectInterruptCard,
    selectIsHistoryPanelVisible,
    selectAliyunEmbeddingApiKey,
    selectSelectedModel,
    selectEnableStream,
    selectModeFeatureSettings,
    selectIsStreaming,
    selectAiParameters,
    selectSessionHistory,
    selectToolCallState,
    selectPendingToolCalls,
    selectAvailableModels
  ],
  (
    messages,
    questionCard,
    interruptCard,
    isHistoryPanelVisible,
    aliyunEmbeddingApiKey,
    selectedModel,
    enableStream,
    modeFeatureSettings,
    isStreaming,
    aiParameters,
    sessionHistory,
    toolCallState,
    pendingToolCalls,
    availableModels
  ) => ({
    messages,
    questionCard,
    interruptCard,
    isHistoryPanelVisible,
    aliyunEmbeddingApiKey,
    selectedModel,
    enableStream,
    modeFeatureSettings,
    isStreaming,
    aiParameters,
    sessionHistory,
    toolCallState,
    pendingToolCalls,
    availableModels
  })
);