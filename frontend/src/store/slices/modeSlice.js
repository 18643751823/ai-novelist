import { createSlice } from '@reduxjs/toolkit';

// 模式设置子模块
const modeSlice = createSlice({
  name: 'mode',
  initialState: {
    // 自定义提示词
    customSystemPrompt: '',
    customPrompts: {
      outline: '',
      writing: '',
      adjustment: ''
    },
    
    // 模式功能设置
    modeFeatureSettings: {
      outline: {},
      writing: {},
      adjustment: {}
    },
    // 上下文限制设置
    contextLimitSettings: {
      modes: {
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
    // 附加信息/持久记忆
    additionalInfo: {
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
    
    // AI参数设置（按模式管理）
    aiParameters: {
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
    
    // 自动批准设置
    autoApproveSettings: {
      enabled: false,
      delay: 1000 // 延迟时间（毫秒）
    }
  },
  reducers: {
    // 自定义提示词管理
    setCustomSystemPrompt: (state, action) => {
      state.customSystemPrompt = action.payload;
    },
    
    resetCustomSystemPrompt: (state) => {
      state.customSystemPrompt = '';
    },
    
    setCustomPromptForMode: (state, action) => {
      const { mode, prompt } = action.payload;
      state.customPrompts[mode] = prompt;
    },
    
    resetCustomPromptForMode: (state, action) => {
      const { mode } = action.payload;
      state.customPrompts[mode] = '';
    },
    
    // 上下文限制设置
    setContextLimitSettings: (state, action) => {
      state.contextLimitSettings = action.payload;
    },
    
    setContextLimitForMode: (state, action) => {
      const { mode, chatContext, ragContext } = action.payload;
      if (state.contextLimitSettings.modes[mode]) {
        if (chatContext) state.contextLimitSettings.modes[mode].chatContext = chatContext;
        if (ragContext) state.contextLimitSettings.modes[mode].ragContext = ragContext;
      }
    },
    
    // 附加信息管理
    setAdditionalInfoForMode: (state, action) => {
      const { mode, info } = action.payload;
      state.additionalInfo[mode] = info;
    },
    
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
    
    setAdditionalInfoForAllModes: (state, action) => {
      const { info } = action.payload;
      for (const mode of ['outline', 'writing', 'adjustment']) {
        state.additionalInfo[mode] = { ...info };
      }
    },
    
    // AI参数管理
    setAiParameterForMode: (state, action) => {
      const { mode, parameter, value } = action.payload;
      if (state.aiParameters[mode] && state.aiParameters[mode].hasOwnProperty(parameter)) {
        state.aiParameters[mode][parameter] = value;
      }
    },
    
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
    
    setAiParametersForAllModes: (state, action) => {
      const { parameters } = action.payload;
      for (const mode of ['outline', 'writing', 'adjustment']) {
        if (state.aiParameters[mode]) {
          state.aiParameters[mode] = { ...state.aiParameters[mode], ...parameters };
        }
      }
    },
    
    // 自动批准设置管理
    setAutoApproveEnabled: (state, action) => {
      state.autoApproveSettings.enabled = action.payload;
    },
    
    setAutoApproveDelay: (state, action) => {
      state.autoApproveSettings.delay = action.payload;
    },
    
    setAutoApproveSettings: (state, action) => {
      state.autoApproveSettings = { ...state.autoApproveSettings, ...action.payload };
    },
    
    // 批量模式设置更新
    updateModeSettings: (state, action) => {
      const { mode, settings } = action.payload;
      if (settings.customPrompt !== undefined) {
        state.customPrompts[mode] = settings.customPrompt;
      }
      if (settings.contextLimits !== undefined) {
        state.contextLimitSettings.modes[mode] = settings.contextLimits;
      }
      if (settings.additionalInfo !== undefined) {
        state.additionalInfo[mode] = settings.additionalInfo;
      }
      if (settings.aiParameters !== undefined) {
        state.aiParameters[mode] = settings.aiParameters;
      }
    },
    
    // 重置所有模式设置
    // 重置所有模式设置
    resetAllModeSettings: (state) => {
      state.customSystemPrompt = '';
      state.customPrompts = {
        outline: '',
        writing: '',
        adjustment: ''
      };
      state.modeFeatureSettings = {
        outline: {},
        writing: {},
        adjustment: {}
      };
      state.contextLimitSettings = {
        modes: {
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
      };
      state.additionalInfo = {
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
      };
      state.aiParameters = {
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
      };
    }
  }
});

export const {
  setCustomSystemPrompt,
  resetCustomSystemPrompt,
  setCustomPromptForMode,
  resetCustomPromptForMode,
  setContextLimitSettings,
  setContextLimitForMode,
  setAdditionalInfoForMode,
  setAdditionalInfoFieldForMode,
  resetAdditionalInfoForMode,
  setAdditionalInfoForAllModes,
  setAiParameterForMode,
  setAiParametersForMode,
  resetAiParametersForMode,
  setAiParametersForAllModes,
  setAutoApproveEnabled,
  setAutoApproveDelay,
  setAutoApproveSettings,
  updateModeSettings,
  resetAllModeSettings
} = modeSlice.actions;

export default modeSlice.reducer;
