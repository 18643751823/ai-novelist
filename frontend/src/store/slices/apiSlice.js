import { createSlice } from '@reduxjs/toolkit';

// API配置子模块
const apiSlice = createSlice({
  name: 'api',
  initialState: {
    // API密钥配置
    deepseekApiKey: '',
    openrouterApiKey: '',
    siliconflowApiKey: '',
    aliyunApiKey: '',
    aliyunEmbeddingApiKey: '',
    
    // 服务配置
    ollamaBaseUrl: 'http://127.0.0.1:11434',
    
    // 模型配置
    selectedModel: '',
    selectedProvider: '',
    embeddingModel: '',
    intentAnalysisModel: '',
    availableModels: [],
    
    // 自定义提供商
    customProviders: []
  },
  reducers: {
    // API密钥设置
    setDeepseekApiKey: (state, action) => {
      state.deepseekApiKey = action.payload;
    },
    
    setOpenrouterApiKey: (state, action) => {
      state.openrouterApiKey = action.payload;
    },
    
    setSiliconflowApiKey: (state, action) => {
      state.siliconflowApiKey = action.payload;
    },
    
    setAliyunApiKey: (state, action) => {
      state.aliyunApiKey = action.payload;
    },
    
    setAliyunEmbeddingApiKey: (state, action) => {
      state.aliyunEmbeddingApiKey = action.payload;
    },
    
    // 服务配置设置
    setOllamaBaseUrl: (state, action) => {
      state.ollamaBaseUrl = action.payload;
    },
    
    // 模型配置设置
    setSelectedModel: (state, action) => {
      state.selectedModel = action.payload;
    },
    
    setSelectedProvider: (state, action) => {
      state.selectedProvider = action.payload;
    },
    
    setEmbeddingModel: (state, action) => {
      state.embeddingModel = action.payload;
    },
    
    setIntentAnalysisModel: (state, action) => {
      state.intentAnalysisModel = action.payload;
    },
    
    setAvailableModels: (state, action) => {
      state.availableModels = action.payload;
    },
    
    // 自定义提供商管理
    setCustomProviders: (state, action) => {
      state.customProviders = action.payload;
    },
    
    addCustomProvider: (state, action) => {
      const newProvider = action.payload;
      // 确保新提供商有唯一ID
      if (!newProvider.id) {
        newProvider.id = `custom-${Date.now()}`;
      }
      state.customProviders.push(newProvider);
    },
    
    updateCustomProvider: (state, action) => {
      const { id, updates } = action.payload;
      const providerIndex = state.customProviders.findIndex(provider => provider.id === id);
      if (providerIndex !== -1) {
        state.customProviders[providerIndex] = { ...state.customProviders[providerIndex], ...updates };
      }
    },
    
    removeCustomProvider: (state, action) => {
      const providerId = action.payload;
      state.customProviders = state.customProviders.filter(provider => provider.id !== providerId);
    },
    
    // 批量API配置更新
    updateApiConfig: (state, action) => {
      const config = action.payload;
      Object.keys(config).forEach(key => {
        if (state.hasOwnProperty(key)) {
          state[key] = config[key];
        }
      });
    },
    
    // 重置所有API配置
    resetApiConfig: (state) => {
      state.deepseekApiKey = '';
      state.openrouterApiKey = '';
      state.siliconflowApiKey = '';
      state.aliyunApiKey = '';
      state.aliyunEmbeddingApiKey = '';
      state.ollamaBaseUrl = 'http://127.0.0.1:11434';
      state.selectedModel = '';
      state.selectedProvider = '';
      state.embeddingModel = '';
      state.intentAnalysisModel = '';
      state.availableModels = [];
      state.customProviders = [];
    },
    
    // 清除敏感信息（用于安全目的）
    clearSensitiveData: (state) => {
      state.deepseekApiKey = '';
      state.openrouterApiKey = '';
      state.siliconflowApiKey = '';
      state.aliyunApiKey = '';
      state.aliyunEmbeddingApiKey = '';
      state.customProviders = state.customProviders.map(provider => ({
        ...provider,
        apiKey: '' // 清除自定义提供商的API密钥
      }));
    }
  }
});

export const {
  setDeepseekApiKey,
  setOpenrouterApiKey,
  setSiliconflowApiKey,
  setAliyunApiKey,
  setAliyunEmbeddingApiKey,
  setOllamaBaseUrl,
  setSelectedModel,
  setSelectedProvider,
  setEmbeddingModel,
  setIntentAnalysisModel,
  setAvailableModels,
  setCustomProviders,
  addCustomProvider,
  updateCustomProvider,
  removeCustomProvider,
  updateApiConfig,
  resetApiConfig,
  clearSensitiveData
} = apiSlice.actions;

export default apiSlice.reducer;