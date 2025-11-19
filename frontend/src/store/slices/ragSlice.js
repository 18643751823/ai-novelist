import { createSlice } from '@reduxjs/toolkit';

// RAG设置子模块
const ragSlice = createSlice({
  name: 'rag',
  initialState: {
    // 全局RAG状态
    ragRetrievalEnabled: false,
    
    // RAG统一状态管理
    ragState: {
      // 嵌入模型相关
      embeddingModel: '',
      availableModels: [],
      embeddingDimensions: 1024,
      isCustomDimensions: false,
      
      // 知识库相关
      knowledgeBaseFiles: [],
      knowledgeBaseLoading: false,
      
      
      // 文本分段
      chunkSize: 400,
      chunkOverlap: 50,
      
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
    
    // 模式特定的RAG设置
    modeFeatureSettings: {
      outline: {
        ragRetrievalEnabled: false,
        ragTableNames: []
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
    }
  },
  reducers: {
    // 全局RAG设置
    setRagRetrievalEnabled: (state, action) => {
      state.ragRetrievalEnabled = action.payload;
    },
    
    
    // 模式特定的RAG设置
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
    
    // RAG统一状态管理reducers
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
    
    
    setRagChunkSettings: (state, action) => {
      const { chunkSize, chunkOverlap } = action.payload;
      state.ragState.chunkSize = chunkSize;
      state.ragState.chunkOverlap = chunkOverlap;
    },
    
    setRagEmbeddingDimensions: (state, action) => {
      const { embeddingDimensions, isCustomDimensions } = action.payload;
      state.ragState.embeddingDimensions = embeddingDimensions;
      state.ragState.isCustomDimensions = isCustomDimensions;
    },
    
    // 批量更新所有模式的RAG设置
    setRagSettingsForAllModes: (state, action) => {
      const { settings } = action.payload;
      for (const mode of ['outline', 'writing', 'adjustment']) {
        if (state.modeFeatureSettings[mode]) {
          state.modeFeatureSettings[mode] = { ...state.modeFeatureSettings[mode], ...settings };
        }
      }
    },
    
    // 重置所有RAG设置
    resetAllRagSettings: (state) => {
      state.ragRetrievalEnabled = false;
      state.ragState = {
        embeddingModel: '',
        availableModels: [],
        embeddingDimensions: 1024,
        isCustomDimensions: false,
        knowledgeBaseFiles: [],
        knowledgeBaseLoading: false,
        chunkSize: 400,
        chunkOverlap: 50,
        loading: {
          allSettings: false,
          knowledgeBase: false
        },
        errors: {
          allSettings: '',
          knowledgeBase: ''
        }
      };
      
      // 重置所有模式的RAG设置
      for (const mode of ['outline', 'writing', 'adjustment']) {
        state.modeFeatureSettings[mode] = {
          ragRetrievalEnabled: false,
          ragTableNames: []
        };
      }
    }
  }
});

export const {
  setRagRetrievalEnabled,
  setModeFeatureSetting,
  resetModeFeatureSettings,
  setRagTableNames,
  setRagLoading,
  setRagError,
  setAllRagSettings,
  setRagEmbeddingModel,
  setRagAvailableModels,
  setRagKnowledgeBaseFiles,
  setRagChunkSettings,
  setRagEmbeddingDimensions,
  setRagSettingsForAllModes,
  resetAllRagSettings
} = ragSlice.actions;

export default ragSlice.reducer;