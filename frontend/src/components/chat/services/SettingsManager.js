import {
  setDeepseekApiKey,
  setOpenrouterApiKey,
  setSiliconflowApiKey,
  setAliyunApiKey,
  setAliyunEmbeddingApiKey,
  setOllamaBaseUrl,
  setEnableStream,
  setCustomPromptForMode,
  setModeFeatureSetting,
  setContextLimitSettings,
  setAdditionalInfoForMode,
  setAiParametersForMode,
} from '../../../store/slices/chatSlice';

/**
 * 设置管理服务
 * 负责加载和管理所有聊天相关的设置
 */
class SettingsManager {
  constructor(dispatch) {
    this.dispatch = dispatch;
  }

  /**
   * 加载所有设置
   */
  async loadSettings() {
    try {
      // 加载API密钥设置
      await this.loadApiKeys();
      
      // 加载模型设置
      await this.loadModelSettings();
      
      // 加载模式设置
      await this.loadModeSettings();
      
      // 加载AI参数设置
      await this.loadAiParameters();
      
      // 加载流式传输设置
      await this.loadStreamSettings();
      
      // 加载功能设置
      await this.loadFeatureSettings();
      
      // 加载上下文限制设置
      await this.loadContextLimitSettings();
      
      // 加载附加信息设置
      await this.loadAdditionalInfo();
      
      console.log('SettingsManager: 所有设置加载完成');
    } catch (error) {
      console.error('SettingsManager: 加载设置失败:', error);
      throw error;
    }
  }

  /**
   * 加载API密钥设置
   */
  async loadApiKeys() {
    console.log('SettingsManager: 开始加载API密钥设置...');
    
    // 加载DeepSeek API密钥
    const storedDeepseekApiKey = await this.getStoreValue('deepseekApiKey');
    console.log('[SettingsManager] 从后端获取的DeepSeek API密钥原始数据:', storedDeepseekApiKey);
    if (storedDeepseekApiKey) {
      this.dispatch(setDeepseekApiKey(storedDeepseekApiKey));
      console.log('SettingsManager: 加载到DeepSeek API密钥');
    }

    // 加载OpenRouter API密钥
    const storedOpenrouterApiKey = await this.getStoreValue('openrouterApiKey');
    console.log('[SettingsManager] 从后端获取的OpenRouter API密钥原始数据:', storedOpenrouterApiKey);
    if (storedOpenrouterApiKey) {
      this.dispatch(setOpenrouterApiKey(storedOpenrouterApiKey));
      console.log('SettingsManager: 加载到OpenRouter API密钥');
    }

    // 加载SiliconFlow API密钥
    const storedSiliconflowApiKey = await this.getStoreValue('siliconflowApiKey');
    console.log('[SettingsManager] 从后端获取的SiliconFlow API密钥原始数据:', storedSiliconflowApiKey);
    if (storedSiliconflowApiKey) {
      this.dispatch(setSiliconflowApiKey(storedSiliconflowApiKey));
      console.log('SettingsManager: 加载到SiliconFlow API密钥');
    }

    // 加载阿里云嵌入API密钥
    const storedAliyunEmbeddingApiKey = await this.getStoreValue('aliyunEmbeddingApiKey');
    console.log('[SettingsManager] 从后端获取的阿里云嵌入API密钥原始数据:', storedAliyunEmbeddingApiKey);
    if (storedAliyunEmbeddingApiKey) {
      this.dispatch(setAliyunEmbeddingApiKey(storedAliyunEmbeddingApiKey));
      console.log('SettingsManager: 加载到阿里云嵌入API密钥');
    }

    // 加载阿里云API密钥
    const storedAliyunApiKey = await this.getStoreValue('aliyunApiKey');
    console.log('[SettingsManager] 从后端获取的阿里云API密钥原始数据:', storedAliyunApiKey);
    if (storedAliyunApiKey) {
      this.dispatch(setAliyunApiKey(storedAliyunApiKey));
      console.log('SettingsManager: 加载到阿里云API密钥');
    }

    // 加载Ollama服务地址
    const storedOllamaBaseUrl = await this.getStoreValue('ollamaBaseUrl');
    console.log('[SettingsManager] 从后端获取的Ollama服务地址原始数据:', storedOllamaBaseUrl);
    if (storedOllamaBaseUrl) {
      this.dispatch(setOllamaBaseUrl(storedOllamaBaseUrl));
      console.log(`SettingsManager: 加载到Ollama服务地址: ${storedOllamaBaseUrl}`);
    }
  }

  /**
   * 加载模型设置
   */
  async loadModelSettings() {
    console.log('SettingsManager:现在模型从litellm网关加载');
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
  async loadModeSettings() {
    // 加载当前模式
    const storedCurrentMode = await this.getStoreValue('currentMode');
    if (storedCurrentMode) {
      console.log(`SettingsManager: 加载到当前模式: ${storedCurrentMode}`);
      // 设置当前模式到组件状态
      this.setCurrentMode(storedCurrentMode);
    }

    // 加载自定义模式
    const storedCustomModesResult = await this.getStoreValue('customModes');
    const storedCustomModes = Array.isArray(storedCustomModesResult) ? storedCustomModesResult : [];
    console.log(`SettingsManager: 加载到自定义模式: ${storedCustomModes.length}个`);

    // 加载自定义提示词
    const storedCustomPrompts = await this.getStoreValue('customPrompts');
    if (storedCustomPrompts && typeof storedCustomPrompts === 'object') {
      Object.entries(storedCustomPrompts).forEach(([mode, prompt]) => {
        this.dispatch(setCustomPromptForMode({ mode, prompt }));
      });
      console.log('SettingsManager: 加载到模式自定义提示词');
    }
  }

  /**
   * 设置当前模式
   * 这个方法需要在组件中实现，用于更新组件的currentMode状态
   */
  setCurrentMode(mode) {
    console.log(`SettingsManager: 设置当前模式为: ${mode}`);
    // 这个方法需要在组件中重写，用于更新组件的currentMode状态
    if (this.onCurrentModeChange) {  //那我感觉这个if可以去掉，直接调用不就行了
      this.onCurrentModeChange(mode);  //调用回调函数，将mode传递出去
    }
  }

  /**
   * 加载AI参数设置
   */
  async loadAiParameters() {
    const storedAiParametersResult = await this.getStoreValue('aiParameters');
    const storedCustomModesResult = await this.getStoreValue('customModes');
    const storedAiParameters = storedAiParametersResult && typeof storedAiParametersResult === 'object' ? storedAiParametersResult : {};
    const storedCustomModes = Array.isArray(storedCustomModesResult) ? storedCustomModesResult : [];

    if (Object.keys(storedAiParameters).length > 0) {
      // 设置各个模式的AI参数
      const allModes = new Set([
        'outline', 'writing', 'adjustment', // 内置模式
        ...storedCustomModes.map(mode => mode.id) // 自定义模式
      ]);

      for (const mode of allModes) {
        if (storedAiParameters[mode] && typeof storedAiParameters[mode] === 'object') {
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
        'outline', 'writing', 'adjustment',
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
  async loadStreamSettings() {
    const storedEnableStream = await this.getStoreValue('enableStream');
    const streamEnabled = storedEnableStream !== false; // 默认为 true
    this.dispatch(setEnableStream(streamEnabled));
    console.log(`SettingsManager: 加载到流式传输设置: ${streamEnabled}`);
  }

  /**
   * 加载功能设置
   */
  async loadFeatureSettings() {
    const storedModeFeatureSettings = await this.getStoreValue('modeFeatureSettings');
    if (storedModeFeatureSettings && typeof storedModeFeatureSettings === 'object') {
      Object.entries(storedModeFeatureSettings).forEach(([mode, settings]) => {
        if (settings && typeof settings === 'object' && settings.ragRetrievalEnabled !== undefined) {
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
  async loadContextLimitSettings() {
    try {
      // HTTP 服务暂不支持上下文限制设置，使用默认值
      const defaultSettings = {
        maxTokens: 4000,
        maxMessages: 50,
        maxHistoryLength: 10000
      };
      this.dispatch(setContextLimitSettings(defaultSettings));
      console.log('SettingsManager: 使用默认上下文限制设置');
    } catch (error) {
      console.error('SettingsManager: 加载上下文限制设置失败:', error);
    }
  }

  /**
   * 加载附加信息设置
   */
  async loadAdditionalInfo() {
    const storedAdditionalInfo = await this.getStoreValue('additionalInfo');
    if (storedAdditionalInfo && typeof storedAdditionalInfo === 'object') {
      Object.entries(storedAdditionalInfo).forEach(([mode, info]) => {
        this.dispatch(setAdditionalInfoForMode({ mode, info }));
      });
      console.log('SettingsManager: 加载到附加信息设置');
    }
  }

  /**
   * 获取存储值 - 使用 HTTP 服务
   */
  async getStoreValue(key) {
    try {
      const response = await fetch(`/api/config/store?key=${encodeURIComponent(key)}`);
      if (response.ok) {
        const data = await response.json();
        return data.data;
      }
      return null;
    } catch (error) {
      console.error('获取存储值失败:', error);
      return null;
    }
  }

  /**
   * 获取模型列表 - 使用 HTTP 服务
   */
  async listAllModels() {
    try {
      const response = await fetch('/api/models/');
      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          models: data.data || []
        };
      }
      return {
        success: false,
        error: '获取模型列表失败',
        models: []
      };
    } catch (error) {
      console.error('获取模型列表失败:', error);
      return {
        success: false,
        error: error.message,
        models: []
      };
    }
  }
}

export default SettingsManager;
