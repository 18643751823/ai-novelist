/**
 * 统一的模型适配器基类 - JavaScript版本
 * 遵循 AI模型提供商适配改进计划 的接口规范
 */

class BaseModelAdapter {
  /**
   * 构造函数
   * @param {Object} config - 适配器配置
   * @param {string} config.providerId - 提供商唯一标识符
   * @param {string} config.providerName - 提供商显示名称
   * @param {string} config.providerType - 提供商类型
   * @param {boolean} [config.isEnabled=true] - 是否启用
   */
  constructor(config) {
    const validation = this.validateConfig(config);
    if (!validation.isValid) {
      throw new Error(`Invalid adapter configuration: ${validation.errors.join(', ')}`);
    }

    this.providerId = config.providerId;
    this.providerName = config.providerName;
    this.providerType = config.providerType;
    this.isEnabled = config.isEnabled !== false;
  }

  /**
   * 核心方法 - 生成AI完成响应（必须由子类实现）
   * @param {Array} messages - 聊天消息数组
   * @param {Object} options - 生成选项
   * @returns {AsyncIterable<Object>} 统一格式的AI响应异步迭代器
   */
  async *generateCompletion(messages, options) {
    throw new Error('generateCompletion() must be implemented by subclass');
  }

  /**
   * 列出提供商支持的所有模型（必须由子类实现）
   * @returns {Promise<Array<Object>>} 模型信息列表
   */
  async listModels() {
    throw new Error('listModels() must be implemented by subclass');
  }

  /**
   * 获取特定模型的详细信息（必须由子类实现）
   * @param {string} modelId - 模型ID
   * @returns {Promise<Object>} 模型详细信息
   */
  async getModelInfo(modelId) {
    throw new Error('getModelInfo() must be implemented by subclass');
  }

  /**
   * 配置管理 - 更新适配器配置
   * @param {Object} newConfig - 新配置
   * @returns {Promise<void>}
   */
  async updateConfig(newConfig) {
    const validation = this.validateConfig({ ...this.getProviderMetadata(), ...newConfig });
    if (!validation.isValid) {
      throw new Error(`Invalid configuration update: ${validation.errors.join(', ')}`);
    }

    Object.assign(this, newConfig);
  }

  /**
   * 配置验证
   * @param {Object} config - 配置对象
   * @returns {{isValid: boolean, errors: string[]}} 验证结果
   */
  validateConfig(config) {
    const errors = [];
    
    if (!config.providerId) errors.push('providerId is required');
    if (!config.providerName) errors.push('providerName is required');
    if (!config.providerType) errors.push('providerType is required');
    
    return { isValid: errors.length === 0, errors };
  }

  /**
   * 获取提供商元数据
   * @returns {Object} 提供商元数据
   */
  getProviderMetadata() {
    return {
      providerId: this.providerId,
      providerName: this.providerName,
      providerType: this.providerType,
      isEnabled: this.isEnabled
    };
  }

  /**
   * 检查适配器是否可用
   * @returns {Promise<boolean>} 是否可用
   */
  async isAvailable() {
    try {
      await this.listModels();
      return true;
    } catch (error) {
      console.warn(`Provider ${this.providerName} is not available:`, error.message);
      return false;
    }
  }

  /**
   * 获取嵌入模型的维度（可选实现）
   * @param {string} modelId - 模型ID
   * @returns {Promise<number>} 嵌入维度
   */
  async getEmbeddingDimensions(modelId) {
    // 默认实现，子类可以重写此方法
    throw new Error('getEmbeddingDimensions() must be implemented by subclass for embedding models');
  }

  /**
   * 检查模型是否为嵌入模型
   * @param {string} modelId - 模型ID
   * @returns {boolean} 是否为嵌入模型
   */
  isEmbeddingModel(modelId) {
    // 默认实现，子类可以重写此方法
    const modelLower = modelId.toLowerCase();
    return modelLower.includes('embedding') ||
           modelLower.includes('embed') ||
           modelLower.includes('bge') ||
           modelLower.includes('multilingual-e5');
  }

  /**
   * 工具方法 - 标准化错误处理
   * @param {Error} error - 原始错误
   * @param {string} context - 错误上下文
   * @returns {Error} 标准化错误
   */
  _standardizeError(error, context = '') {
    const prefix = context ? `[${this.providerName}] ${context}: ` : `[${this.providerName}] `;
    return new Error(`${prefix}${error.message}`);
  }
}

module.exports = BaseModelAdapter;