import { createSlice } from '@reduxjs/toolkit';

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

// 模式设置子模块
const modeSlice = createSlice({
  name: 'mode',
  initialState: {
    // 自定义提示词
    customSystemPrompt: DEFAULT_SYSTEM_PROMPT, // 旧版，用于通用模式
    customPrompts: {
      general: '',
      outline: '',
      writing: '',
      adjustment: ''
    },
    
    // 模式功能设置
    modeFeatureSettings: {
      general: {},
      outline: {},
      writing: {},
      adjustment: {}
    },
    
    // 上下文限制设置
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
    
    // 附加信息/持久记忆
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
    
    // AI参数设置（按模式管理）
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
    }
  },
  reducers: {
    // 自定义提示词管理
    setCustomSystemPrompt: (state, action) => {
      state.customSystemPrompt = action.payload;
    },
    
    resetCustomSystemPrompt: (state) => {
      state.customSystemPrompt = DEFAULT_SYSTEM_PROMPT;
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
      for (const mode of ['general', 'outline', 'writing', 'adjustment']) {
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
      for (const mode of ['general', 'outline', 'writing', 'adjustment']) {
        if (state.aiParameters[mode]) {
          state.aiParameters[mode] = { ...state.aiParameters[mode], ...parameters };
        }
      }
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
    resetAllModeSettings: (state) => {
      state.customSystemPrompt = DEFAULT_SYSTEM_PROMPT;
      state.customPrompts = {
        general: '',
        outline: '',
        writing: '',
        adjustment: ''
      };
      state.modeFeatureSettings = {
        general: {},
        outline: {},
        writing: {},
        adjustment: {}
      };
      state.contextLimitSettings = {
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
      };
      state.additionalInfo = {
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
      };
      state.aiParameters = {
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
  updateModeSettings,
  resetAllModeSettings
} = modeSlice.actions;

export { DEFAULT_SYSTEM_PROMPT };

export default modeSlice.reducer;