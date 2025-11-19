// 提供商配置服务 - 直接与后端通信，不经过Redux
import httpClient from '../utils/httpClient.js';

class ProviderConfigService {
  constructor() {
    this.baseURL = 'http://localhost:8000';
  }

  /**
   * 获取所有预设提供商
   */
  async getProviders() {
    try {
      const response = await httpClient.get('/api/provider/providers');
      return {
        success: true,
        data: response.data.data || response.data || {},
        message: '提供商列表获取成功'
      };
    } catch (error) {
      console.error('获取提供商列表失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message,
        data: {}
      };
    }
  }

  /**
   * 获取所有自定义提供商
   */
  async getCustomProviders() {
    try {
      const response = await httpClient.get('/api/provider/custom-providers');
      return {
        success: true,
        data: response.data.data || response.data || {},
        message: '自定义提供商列表获取成功'
      };
    } catch (error) {
      console.error('获取自定义提供商列表失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message,
        data: {}
      };
    }
  }

  /**
   * 获取指定提供商的模型列表
   */
  async getProviderModels(providerId, apiKey) {
    try {
      const params = apiKey ? { api_key: apiKey } : {};
      const response = await httpClient.get(`/api/provider/models/${providerId}`, { params });
      
      // 修复：直接使用响应数据，而不是嵌套的data字段
      const responseData = response.data || [];
      
      return {
        success: true,
        data: responseData,
        message: '模型列表获取成功'
      };
    } catch (error) {
      console.error(`获取提供商 ${providerId} 的模型列表失败:`, error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message,
        data: []
      };
    }
  }

  /**
   * 获取自定义提供商的模型列表
   */
  async getCustomProviderModels(name, baseUrl, apiKey) {
    try {
      const response = await httpClient.post('/api/provider/custom-models', {
        name,
        base_url: baseUrl,
        api_key: apiKey
      });
      return {
        success: true,
        data: response.data.data || [],
        message: '自定义提供商模型列表获取成功'
      };
    } catch (error) {
      console.error('获取自定义提供商模型列表失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message,
        data: []
      };
    }
  }

  /**
   * 保存自定义提供商
   */
  async saveCustomProvider(name, baseUrl, apiKey) {
    try {
      const response = await httpClient.post('/api/provider/custom-providers', {
        name,
        base_url: baseUrl,
        api_key: apiKey
      });
      return {
        success: true,
        message: response.data.message || '自定义提供商保存成功'
      };
    } catch (error) {
      console.error('保存自定义提供商失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message
      };
    }
  }

  /**
   * 删除自定义提供商
   */
  async deleteCustomProvider(providerId) {
    try {
      const response = await httpClient.delete(`/api/provider/custom-providers/${providerId}`);
      return {
        success: true,
        message: response.data.message || '自定义提供商删除成功'
      };
    } catch (error) {
      console.error('删除自定义提供商失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message
      };
    }
  }

  /**
   * 将模型添加到配置中
   */
  async addModelToConfig(providerId, modelId, apiKey) {
    try {
      const response = await httpClient.post('/api/provider/models', {
        provider_id: providerId,
        model_id: modelId,
        api_key: apiKey
      });
      return {
        success: true,
        message: (response.data && response.data.message) || '模型添加成功'
      };
    } catch (error) {
      console.error('添加模型失败:', error);
      // 提取更详细的错误信息
      const errorMessage = error.details || error.message || '未知错误';
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * 将自定义模型添加到配置中
   */
  async addCustomModelToConfig(modelId, baseUrl, apiKey) {
    try {
      const response = await httpClient.post('/api/provider/custom-models/config', {
        model_id: modelId,
        base_url: baseUrl,
        api_key: apiKey
      });
      return {
        success: true,
        message: response.data.message || '自定义模型添加成功'
      };
    } catch (error) {
      console.error('添加自定义模型失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message
      };
    }
  }

  /**
   * 从配置中移除模型
   */
  async removeModelFromConfig(modelName) {
    try {
      const response = await httpClient.delete(`/api/provider/models/${encodeURIComponent(modelName)}`);
      return {
        success: true,
        message: response.data.message || '模型删除成功'
      };
    } catch (error) {
      console.error('删除模型失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message
      };
    }
  }

  /**
   * 获取当前配置的模型列表
   */
  async getConfiguredModels() {
    try {
      const response = await httpClient.get('/api/provider/config/models');
      return {
        success: true,
        data: response.data.data || [],
        message: '配置模型列表获取成功'
      };
    } catch (error) {
      console.error('获取配置模型列表失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message,
        data: []
      };
    }
  }

  /**
   * 保存API密钥到预设配置中
   */
  async saveApiKeyToPreset(providerId, apiKey) {
    try {
      const response = await httpClient.post('/api/provider/api-key', {
        provider_id: providerId,
        api_key: apiKey
      });
      return {
        success: true,
        message: response.data.message || 'API密钥保存成功'
      };
    } catch (error) {
      console.error('保存API密钥失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message
      };
    }
  }

  /**
   * 获取所有提供商配置（兼容旧接口）
   */
  async getProviderConfigs() {
    try {
      // 获取预设提供商和自定义提供商
      const [providersResult, customProvidersResult, configuredModelsResult] = await Promise.all([
        this.getProviders(),
        this.getCustomProviders(),
        this.getConfiguredModels()
      ]);

      if (providersResult.success && customProvidersResult.success) {
        // 转换为旧格式
        const configs = this.getDefaultProviderConfigs();
        
        // 处理预设提供商的API密钥
        for (const [providerId, providerInfo] of Object.entries(providersResult.data)) {
          if (providerId === 'deepseek') {
            configs.deepseekApiKey = providerInfo.saved_api_key || '';
          } else if (providerId === 'openrouter') {
            configs.openrouterApiKey = providerInfo.saved_api_key || '';
          } else if (providerId === 'siliconflow') {
            configs.siliconflowApiKey = providerInfo.saved_api_key || '';
          } else if (providerId === 'aliyun') {
            configs.aliyunApiKey = providerInfo.saved_api_key || '';
          } else if (providerId === 'ollama') {
            configs.ollamaBaseUrl = providerInfo.base_url || 'http://127.0.0.1:11434';
          } else if (providerId === 'kimi') {
            configs.kimiApiKey = providerInfo.saved_api_key || '';
          } else if (providerId === 'zhipuai') {
            configs.zhipuaiApiKey = providerInfo.saved_api_key || '';
          } else if (providerId === 'gemini') {
            configs.geminiApiKey = providerInfo.saved_api_key || '';
          }
        }

        // 处理自定义提供商
        configs.customProviders = Object.values(customProvidersResult.data).map(provider => ({
          providerName: provider.name,
          baseUrl: provider.base_url,
          apiKey: provider.saved_api_key || '',
          enabled: true
        }));

        return {
          success: true,
          configs,
          message: '提供商配置获取成功'
        };
      } else {
        return {
          success: false,
          error: '获取提供商配置失败',
          configs: this.getDefaultProviderConfigs()
        };
      }
    } catch (error) {
      console.error('获取提供商配置失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message,
        configs: this.getDefaultProviderConfigs()
      };
    }
  }

  /**
   * 保存提供商配置（兼容旧接口）
   */
  async saveProviderConfigs(configs) {
    try {
      // 保存预设提供商的API密钥
      const savePromises = [];
      
      if (configs.deepseekApiKey) {
        savePromises.push(this.saveApiKeyToPreset('deepseek', configs.deepseekApiKey));
      }
      if (configs.openrouterApiKey) {
        savePromises.push(this.saveApiKeyToPreset('openrouter', configs.openrouterApiKey));
      }
      if (configs.siliconflowApiKey) {
        savePromises.push(this.saveApiKeyToPreset('siliconflow', configs.siliconflowApiKey));
      }
      if (configs.aliyunApiKey) {
        savePromises.push(this.saveApiKeyToPreset('aliyun', configs.aliyunApiKey));
      }
      if (configs.kimiApiKey) {
        savePromises.push(this.saveApiKeyToPreset('kimi', configs.kimiApiKey));
      }
      if (configs.zhipuaiApiKey) {
        savePromises.push(this.saveApiKeyToPreset('zhipuai', configs.zhipuaiApiKey));
      }
      if (configs.geminiApiKey) {
        savePromises.push(this.saveApiKeyToPreset('gemini', configs.geminiApiKey));
      }

      // 保存自定义提供商
      if (configs.customProviders && Array.isArray(configs.customProviders)) {
        for (const customProvider of configs.customProviders) {
          savePromises.push(
            this.saveCustomProvider(
              customProvider.providerName,
              customProvider.baseUrl,
              customProvider.apiKey
            )
          );
        }
      }

      await Promise.all(savePromises);
      
      return {
        success: true,
        message: '提供商配置保存成功'
      };
    } catch (error) {
      console.error('保存提供商配置失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message
      };
    }
  }

  /**
   * 获取特定提供商的配置
   */
  async getProviderConfig(providerId) {
    try {
      // 获取预设提供商和自定义提供商
      const [providersResult, customProvidersResult] = await Promise.all([
        this.getProviders(),
        this.getCustomProviders()
      ]);

      if (providersResult.success && customProvidersResult.success) {
        // 从预设提供商中查找
        let providerConfig = {};
        const providerInfo = providersResult.data[providerId];
        
        if (providerInfo) {
          // 预设提供商
          if (providerId === 'ollama') {
            providerConfig = {
              baseUrl: providerInfo.base_url || 'http://127.0.0.1:11434',
              isLocal: providerInfo.is_local || false
            };
          } else {
            providerConfig = {
              apiKey: providerInfo.saved_api_key || '',
              isLocal: providerInfo.is_local || false
            };
          }
        } else {
          // 自定义提供商
          const customProvider = Object.values(customProvidersResult.data).find(p => p.name === providerId);
          if (customProvider) {
            providerConfig = {
              apiKey: customProvider.saved_api_key || '',
              baseUrl: customProvider.base_url || '',
              isCustom: true
            };
          }
        }
        
        return {
          success: true,
          config: providerConfig,
          message: '提供商配置获取成功'
        };
      } else {
        return {
          success: false,
          error: '获取提供商配置失败',
          config: {}
        };
      }
    } catch (error) {
      console.error(`获取提供商 ${providerId} 配置失败:`, error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message,
        config: {}
      };
    }
  }

  /**
   * 更新特定提供商的配置
   */
  async updateProviderConfig(providerId, config) {
    try {
      // 先获取当前所有配置
      const currentConfigs = await this.getProviderConfigs();
      if (!currentConfigs.success) {
        return currentConfigs;
      }
      
      // 更新特定提供商的配置
      const updatedConfigs = { ...currentConfigs.configs };
      
      if (providerId === 'deepseek') {
        updatedConfigs.deepseekApiKey = config.apiKey || '';
      } else if (providerId === 'openrouter') {
        updatedConfigs.openrouterApiKey = config.apiKey || '';
      } else if (providerId === 'siliconflow') {
        updatedConfigs.siliconflowApiKey = config.apiKey || '';
      } else if (providerId === 'aliyun') {
        updatedConfigs.aliyunApiKey = config.apiKey || '';
      } else if (providerId === 'ollama') {
        updatedConfigs.ollamaBaseUrl = config.baseUrl || 'http://127.0.0.1:11434';
      } else if (providerId === 'kimi') {
        updatedConfigs.kimiApiKey = config.apiKey || '';
      } else if (providerId === 'zhipuai') {
        updatedConfigs.zhipuaiApiKey = config.apiKey || '';
      } else if (providerId === 'gemini') {
        updatedConfigs.geminiApiKey = config.apiKey || '';
      } else {
        // 自定义提供商
        const customProviders = updatedConfigs.customProviders || [];
        const existingIndex = customProviders.findIndex(p => p.providerName === providerId);
        
        if (existingIndex > -1) {
          customProviders[existingIndex] = { ...customProviders[existingIndex], ...config };
        } else {
          customProviders.push({ providerName: providerId, ...config });
        }
        updatedConfigs.customProviders = customProviders;
      }
      
      // 保存更新后的配置
      return await this.saveProviderConfigs(updatedConfigs);
    } catch (error) {
      console.error(`更新提供商 ${providerId} 配置失败:`, error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message
      };
    }
  }


  /**
   * 获取内置提供商列表
   */
  getBuiltInProviders() {
    return [
      { id: 'deepseek', name: 'DeepSeek', type: 'builtin', enabled: true },
      { id: 'openrouter', name: 'OpenRouter', type: 'builtin', enabled: true },
      { id: 'ollama', name: 'Ollama', type: 'builtin', enabled: true },
      { id: 'siliconflow', name: '硅基流动', type: 'builtin', enabled: true },
      { id: 'aliyun', name: '阿里云百炼', type: 'builtin', enabled: true },
      { id: 'kimi', name: 'Kimi', type: 'builtin', enabled: true },
      { id: 'zhipuai', name: '智谱AI', type: 'builtin', enabled: true },
      { id: 'gemini', name: 'Google Gemini', type: 'builtin', enabled: true }
    ];
  }

  /**
   * 从配置数据生成提供商列表
   */
  generateProviderList(configs) {
    const builtInProviders = this.getBuiltInProviders();
    const customProviders = configs.customProviders || [];
    
    const allProviders = [
      ...builtInProviders,
      ...customProviders.map(p => ({
        id: p.providerName,
        name: p.providerName,
        type: 'custom',
        enabled: p.enabled
      }))
    ];

    return allProviders;
  }

  /**
   * 获取提供商配置的默认结构
   */
  getDefaultProviderConfigs() {
    return {
      deepseekApiKey: '',
      openrouterApiKey: '',
      siliconflowApiKey: '',
      aliyunApiKey: '',
      kimiApiKey: '',
      zhipuaiApiKey: '',
      aliyunEmbeddingApiKey: '',
      geminiApiKey: '',
      ollamaBaseUrl: 'http://127.0.0.1:11434',
      intentAnalysisModel: '',
      customProviders: []
    };
  }
}

// 创建全局提供商配置服务实例
const providerConfigService = new ProviderConfigService();

export default providerConfigService;