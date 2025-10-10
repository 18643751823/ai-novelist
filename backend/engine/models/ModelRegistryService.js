/**
 * 模型注册表服务 - JavaScript版本
 * 提供动态注册、类型映射管理和提供商实例缓存功能
 */

const BaseModelAdapter = require('./BaseModelAdapter');
const ProviderTypeResolver = require('./ProviderTypeResolver');

class ModelRegistryService {
  constructor() {
    this.adapters = new Map(); // { providerId: adapterInstance }
    this.modelMapping = new Map(); // { modelId: providerId }
    this.providerTypes = new Map(); // { providerId: providerType }
  }

  /**
   * 注册一个新的模型适配器
   * @param {string} providerId - 提供商唯一标识符
   * @param {BaseModelAdapter} adapterInstance - 适配器实例
   * @returns {Promise<void>}
   */
  async registerAdapter(providerId, adapterInstance) {
    if (!(adapterInstance instanceof BaseModelAdapter)) {
      throw new Error('Registered adapter must be an instance of BaseModelAdapter');
    }

    if (this.adapters.has(providerId)) {
      console.warn(`[ModelRegistry] Adapter '${providerId}' already exists, will be overwritten`);
    }

    // 验证适配器配置
    const metadata = adapterInstance.getProviderMetadata();
    if (metadata.providerId !== providerId) {
      throw new Error(`Adapter providerId (${metadata.providerId}) does not match registration ID (${providerId})`);
    }

    // 存储适配器实例
    this.adapters.set(providerId, adapterInstance);
    this.providerTypes.set(providerId, metadata.providerType);

    // 注册此适配器支持的所有模型
    try {
      const models = await adapterInstance.listModels();
      console.log(`[ModelRegistry] Adapter '${providerId}' registered ${models.length} models`);

      models.forEach(modelInfo => {
        const modelId = this._normalizeModelId(modelInfo.id, providerId);
        
        if (this.modelMapping.has(modelId)) {
          const existingProvider = this.modelMapping.get(modelId);
          console.warn(`[ModelRegistry] Model '${modelId}' already registered by provider '${existingProvider}', will be overwritten by '${providerId}'`);
        }

        this.modelMapping.set(modelId, providerId);
        console.log(`[ModelRegistry] Registered model: ${modelId} -> ${providerId}`);
      });
    } catch (error) {
      console.warn(`[ModelRegistry] Failed to list models for provider '${providerId}':`, error.message);
    }
  }

  /**
   * 根据模型ID获取对应的适配器
   * @param {string} modelId - 模型ID
   * @returns {BaseModelAdapter|null} 对应的适配器实例
   */
  getAdapterForModel(modelId) {
    const normalizedModelId = this._normalizeModelId(modelId);
    const providerId = this.modelMapping.get(normalizedModelId);
    
    if (!providerId) {
      return null;
    }

    return this.adapters.get(providerId);
  }

  /**
   * 根据提供商ID获取适配器
   * @param {string} providerId - 提供商ID
   * @returns {BaseModelAdapter|null} 适配器实例
   */
  getAdapter(providerId) {
    return this.adapters.get(providerId);
  }

  /**
   * 列出所有已注册的模型
   * @returns {Promise<Array<Object>>} 所有模型的信息列表
   */
  async listAllModels() {
    const allModels = [];
    
    for (const [providerId, adapter] of this.adapters) {
      try {
        const models = await adapter.listModels();
        const processedModels = models.map(model => ({
          ...model,
          id: this._normalizeModelId(model.id, providerId),
          provider: providerId
        }));
        
        allModels.push(...processedModels);
      } catch (error) {
        console.warn(`[ModelRegistry] Failed to list models for provider '${providerId}':`, error.message);
      }
    }

    return allModels;
  }

  /**
   * 获取所有已注册的提供商
   * @returns {Array<Object>} 提供商信息列表
   */
  getAllProviders() {
    const providers = [];
    
    for (const [providerId, adapter] of this.adapters) {
      providers.push(adapter.getProviderMetadata());
    }

    return providers;
  }

  /**
   * 检查提供商是否已注册
   * @param {string} providerId - 提供商ID
   * @returns {boolean} 是否已注册
   */
  hasProvider(providerId) {
    return this.adapters.has(providerId);
  }

  /**
   * 移除提供商注册
   * @param {string} providerId - 提供商ID
   */
  unregisterAdapter(providerId) {
    if (this.adapters.has(providerId)) {
      // 移除该提供商的所有模型映射
      for (const [modelId, mappedProviderId] of this.modelMapping.entries()) {
        if (mappedProviderId === providerId) {
          this.modelMapping.delete(modelId);
        }
      }

      this.adapters.delete(providerId);
      this.providerTypes.delete(providerId);
      console.log(`[ModelRegistry] Unregistered provider '${providerId}'`);
    }
  }

  /**
   * 获取提供商类型
   * @param {string} providerId - 提供商ID
   * @returns {string|null} 提供商类型
   */
  getProviderType(providerId) {
    return this.providerTypes.get(providerId) || null;
  }

  /**
   * 根据类型获取所有提供商
   * @param {string} providerType - 提供商类型
   * @returns {Array<BaseModelAdapter>} 适配器实例列表
   */
  getAdaptersByType(providerType) {
    const result = [];
    
    for (const [providerId, type] of this.providerTypes.entries()) {
      if (type === providerType) {
        result.push(this.adapters.get(providerId));
      }
    }

    return result;
  }

  /**
   * 标准化模型ID（添加提供商前缀以确保唯一性）
   * @param {string} modelId - 原始模型ID
   * @param {string} [providerId] - 提供商ID（用于生成标准化ID）
   * @returns {string} 标准化模型ID
   * @private
   */
  _normalizeModelId(modelId, providerId) {
    if (!modelId) return modelId;
    
    // 如果已经包含提供商前缀，直接返回
    if (modelId.includes('/')) {
      return modelId;
    }
    
    // 为特定提供商添加前缀
    const prefixMap = {
      'openrouter': 'openrouter/',
      'ollama': 'ollama/',
      'aliyun': 'aliyun/',
      'azure': 'azure/'
    };

    const prefix = prefixMap[providerId] || '';
    return prefix + modelId;
  }

  /**
   * 清空所有注册信息
   */
  clear() {
    this.adapters.clear();
    this.modelMapping.clear();
    this.providerTypes.clear();
    console.log('[ModelRegistry] Cleared all registrations');
  }
}

module.exports = ModelRegistryService;