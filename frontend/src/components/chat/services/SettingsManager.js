import { 
  setDeepseekApiKey,
  setOpenrouterApiKey,
  setSiliconflowApiKey,
  setAliyunEmbeddingApiKey,
  setIntentAnalysisModel,
  setSelectedModel,
  setAvailableModels,
  setEnableStream,
  setCustomPromptForMode,
  setModeFeatureSetting,
  setContextLimitSettings,
  setAdditionalInfoForMode,
  setAiParametersForMode,
  setRetrievalTopK
} from '../../../store/slices/chatSlice';

/**
 * 设置管理服务
 * 负责加载和管理所有聊天相关的设置
 */
class SettingsManager {
  constructor(ipcRenderer, dispatch) {
    this.ipcRenderer = ipcRenderer;
    this.dispatch = dispatch;
  }

  /**
   * 加载所有设置
   */
  async loadSettings() {
    try {
      const {
        getStoreValue,
        listAllModels,
        invoke,
        send
      } = this.ipcRenderer;

      // 加载API密钥设置
      await this.loadApiKeys(getStoreValue);
      
      // 加载模型设置
      await this.loadModelSettings(getStoreValue, listAllModels);
      
      // 加载模式设置
      await this.loadModeSettings(getStoreValue);
      
      // 加载AI参数设置
      await this.loadAiParameters(getStoreValue);
      
      // 加载流式传输设置
      await this.loadStreamSettings(getStoreValue, send);
      
      // 加载功能设置
      await this.loadFeatureSettings(getStoreValue);
      
      // 加载上下文限制设置
      await this.loadContextLimitSettings(invoke);
      
      // 加载附加信息设置
      await this.loadAdditionalInfo(getStoreValue);
      
      // 加载检索设置
      await this.loadRetrievalSettings(invoke);

      console.log('SettingsManager: 所有设置加载完成');
    } catch (error) {
      console.error('SettingsManager: 加载设置失败:', error);
      throw error;
    }
  }

  /**
   * 加载API密钥设置
   */
  async loadApiKeys(getStoreValue) {
    const apiKeys = [
      { key: 'deepseekApiKey', action: setDeepseekApiKey, name: 'DeepSeek' },
      { key: 'openrouterApiKey', action: setOpenrouterApiKey, name: 'OpenRouter' },
      { key: 'siliconflowApiKey', action: setSiliconflowApiKey, name: '硅基流动' },
      { key: 'aliyunEmbeddingApiKey', action: setAliyunEmbeddingApiKey, name: '阿里云嵌入' }
    ];

    for (const { key, action, name } of apiKeys) {
      const storedValue = await getStoreValue(key);
      if (storedValue) {
        this.dispatch(action(storedValue));
        console.log(`SettingsManager: 加载到${name} API Key`);
      }
    }

    // 加载意图分析模型
    const storedIntentAnalysisModel = await getStoreValue('intentAnalysisModel');
    if (storedIntentAnalysisModel) {
      this.dispatch(setIntentAnalysisModel(storedIntentAnalysisModel));
      console.log(`SettingsManager: 加载到意图分析模型: ${storedIntentAnalysisModel}`);
    }
  }

  /**
   * 加载模型设置
   */
  async loadModelSettings(getStoreValue, listAllModels) {
    console.log('SettingsManager: 开始加载模型设置...');
    const modelsResult = await listAllModels();
    
    if (modelsResult.success) {
      this.dispatch(setAvailableModels(modelsResult.models));
      console.log(`SettingsManager: 加载到可用模型: ${modelsResult.models.length}个`);

      // 同步选中模型
      const currentStoredModel = await getStoreValue('selectedModel');
      if (currentStoredModel && this.isModelAvailable(modelsResult.models, currentStoredModel)) {
        this.dispatch(setSelectedModel(currentStoredModel));
        console.log(`SettingsManager: 同步选中模型: ${currentStoredModel}`);
      } else if (modelsResult.models.length > 0) {
        // 设置默认模型
        const defaultModel = modelsResult.models[0].id;
        this.dispatch(setSelectedModel(defaultModel));
        console.log(`SettingsManager: 设置默认模型: ${defaultModel}`);
      }
    } else {
      console.error('SettingsManager: 获取可用模型列表失败:', modelsResult.error);
    }
  }

  /**
   * 检查模型是否可用
   */
  isModelAvailable(models, modelId) {
    return models.some(model => model.id === modelId);
  }

  /**
   * 加载模式设置
   */
  async loadModeSettings(getStoreValue) {
    // 加载当前模式
    const storedCurrentMode = await getStoreValue('currentMode');
    if (storedCurrentMode) {
      console.log(`SettingsManager: 加载到当前模式: ${storedCurrentMode}`);
    }

    // 加载自定义模式
    const storedCustomModes = await getStoreValue('customModes') || [];
    console.log(`SettingsManager: 加载到自定义模式: ${storedCustomModes.length}个`);

    // 加载自定义提示词
    const storedCustomPrompts = await getStoreValue('customPrompts');
    if (storedCustomPrompts) {
      Object.entries(storedCustomPrompts).forEach(([mode, prompt]) => {
        this.dispatch(setCustomPromptForMode({ mode, prompt }));
      });
      console.log('SettingsManager: 加载到模式自定义提示词');
    }
  }

  /**
   * 加载AI参数设置
   */
  async loadAiParameters(getStoreValue) {
    const storedAiParameters = await getStoreValue('aiParameters');
    const storedCustomModes = await getStoreValue('customModes') || [];

    if (storedAiParameters) {
      // 设置各个模式的AI参数
      const allModes = new Set([
        'general', 'outline', 'writing', 'adjustment', // 内置模式
        ...storedCustomModes.map(mode => mode.id) // 自定义模式
      ]);

      for (const mode of allModes) {
        if (storedAiParameters[mode]) {
          this.dispatch(setAiParametersForMode({ mode, parameters: storedAiParameters[mode] }));
        } else {
          // 使用默认参数
          const defaultParameters = { temperature: 0.7, top_p: 0.7, n: 1 };
          this.dispatch(setAiParametersForMode({ mode, parameters: defaultParameters }));
        }
      }
      console.log('SettingsManager: 加载到AI参数设置');
    } else {
      // 初始化所有模式的默认参数
      const allModes = new Set([
        'general', 'outline', 'writing', 'adjustment',
        ...storedCustomModes.map(mode => mode.id)
      ]);
      
      const defaultParameters = { temperature: 0.7, top_p: 0.7, n: 1 };
      for (const mode of allModes) {
        this.dispatch(setAiParametersForMode({ mode, parameters: defaultParameters }));
      }
      console.log('SettingsManager: 初始化默认AI参数');
    }
  }

  /**
   * 加载流式传输设置
   */
  async loadStreamSettings(getStoreValue, send) {
    const storedEnableStream = await getStoreValue('enableStream');
    const streamEnabled = storedEnableStream !== false; // 默认为 true
    this.dispatch(setEnableStream(streamEnabled));
    send('set-streaming-mode', { stream: streamEnabled });
    console.log(`SettingsManager: 加载到流式传输设置: ${streamEnabled}，并已同步到后端`);
  }

  /**
   * 加载功能设置
   */
  async loadFeatureSettings(getStoreValue) {
    const storedModeFeatureSettings = await getStoreValue('modeFeatureSettings');
    if (storedModeFeatureSettings) {
      Object.entries(storedModeFeatureSettings).forEach(([mode, settings]) => {
        if (settings.ragRetrievalEnabled !== undefined) {
          this.dispatch(setModeFeatureSetting({ 
            mode, 
            feature: 'ragRetrievalEnabled', 
            enabled: settings.ragRetrievalEnabled 
          }));
        }
      });
      console.log('SettingsManager: 加载到模式功能设置');
    }
  }

  /**
   * 加载上下文限制设置
   */
  async loadContextLimitSettings(invoke) {
    try {
      const contextSettingsResult = await invoke('get-context-limit-settings');
      if (contextSettingsResult.success) {
        this.dispatch(setContextLimitSettings(contextSettingsResult.settings));
        console.log('SettingsManager: 加载到上下文限制设置');
      } else {
        console.error('SettingsManager: 加载上下文限制设置失败:', contextSettingsResult.error);
      }
    } catch (error) {
      console.error('SettingsManager: 调用上下文限制设置API失败:', error);
    }
  }

  /**
   * 加载附加信息设置
   */
  async loadAdditionalInfo(getStoreValue) {
    const storedAdditionalInfo = await getStoreValue('additionalInfo');
    if (storedAdditionalInfo) {
      Object.entries(storedAdditionalInfo).forEach(([mode, info]) => {
        this.dispatch(setAdditionalInfoForMode({ mode, info }));
      });
      console.log('SettingsManager: 加载到附加信息设置');
    }
  }

  /**
   * 加载检索设置
   */
  async loadRetrievalSettings(invoke) {
    try {
      const retrievalSettingsResult = await invoke('get-retrieval-top-k');
      if (retrievalSettingsResult.success) {
        this.dispatch(setRetrievalTopK(retrievalSettingsResult.topK));
        console.log(`SettingsManager: 加载到检索设置: topK=${retrievalSettingsResult.topK}`);
      } else {
        console.warn('SettingsManager: 加载检索设置失败，使用默认值');
        this.dispatch(setRetrievalTopK(3));
      }
    } catch (error) {
      console.error('SettingsManager: 调用检索设置API失败，使用默认值:', error);
      this.dispatch(setRetrievalTopK(3));
    }
  }
}

export default SettingsManager;