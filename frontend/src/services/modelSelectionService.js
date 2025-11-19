// 模型选择服务 - 直接与litellm网关通信，不经过Redux
import httpClient from '../utils/httpClient.js';

class ModelSelectionService {
  constructor() {
    this.baseURL = 'http://localhost:8000';
    this.litellmBaseURL = 'http://127.0.0.1:4000'; // litellm网关地址
  }

  /**
   * 获取当前选中的模型
   */
  async getSelectedModel() {
    try {
      const response = await httpClient.get('/api/ai-config/selected-model');
      return {
        success: true,
        selectedModel: response.data.selectedModel || '',
        selectedProvider: response.data.selectedProvider || '',
        message: '选中模型获取成功'
      };
    } catch (error) {
      console.error('获取选中模型失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message,
        selectedModel: '',
        selectedProvider: ''
      };
    }
  }

  /**
   * 设置当前选中的模型
   */
  async setSelectedModel(selectedModel, selectedProvider = '') {
    try {
      const response = await httpClient.post('/api/ai-config/selected-model', {
        selectedModel,
        selectedProvider
      });
      return {
        success: true,
        message: '模型选择已保存'
      };
    } catch (error) {
      console.error('设置选中模型失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message
      };
    }
  }

  /**
   * 获取可用模型列表 - 从litellm网关获取
   */
  async getAvailableModels() {
    try {
      // 从litellm网关获取模型列表
      const response = await fetch(`${this.litellmBaseURL}/model/info`, {
        method: 'GET',
        headers: {
          'accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // 根据实际返回的数据结构获取模型列表
      const modelsData = data.all_models || data.data || data.models || [];
      console.log('从litellm获取的原始数据:', data);
      console.log('解析出的模型数据:', modelsData);
      
      // 转换litellm返回的数据格式为前端期望的格式
      const models = this.convertLiteLLMModels(modelsData);
      
      // 过滤掉嵌入模型
      const filteredModels = this.filterEmbeddingModels(models);
      
      return {
        success: true,
        models: filteredModels,
        message: '模型列表获取成功'
      };
    } catch (error) {
      console.error('获取模型列表失败:', error);
      return {
        success: false,
        error: '从litellm网关获取模型列表失败: ' + error.message,
        models: []
      };
    }
  }

  /**
   * 转换litellm返回的模型数据格式为前端期望的格式
   * @param {Array} litellmModels - litellm网关返回的模型数据
   * @returns {Array} 转换后的模型数据
   */
  convertLiteLLMModels(litellmModels) {
    if (!Array.isArray(litellmModels)) {
      console.warn('convertLiteLLMModels: 输入不是数组', litellmModels);
      return [];
    }

    return litellmModels.map(model => {
      // 根据实际数据结构获取模型名称
      const modelName = model.model_name || model.id?.model_name || model.id || '';
      
      // 使用智能提供商推断逻辑
      const provider = this._inferProviderFromModelName(modelName);
      
      console.log(`转换模型: ${modelName} -> 提供商: ${provider}`);

      return {
        id: modelName,
        provider: provider,
        // 保留原始数据以备后用
        originalData: model
      };
    });
  }

  /**
   * 根据模型名称智能推断提供商
   * @param {string} modelName - 模型名称
   * @returns {string} 提供商名称
   */
  _inferProviderFromModelName(modelName) {
    if (!modelName) {
      return 'unknown';
    }

    // 定义模型名称前缀与提供商的映射
    const providerMapping = {
      'openai/deepseek': 'DeepSeek',
      'openai/qwen': '阿里云',
      'openai/qwen3': '阿里云',
      'openai/kimi': 'Kimi',
      'openai/glm': '智谱AI',
      'openai/deepseek-ai': '硅基流动',
      'gemini/gemini': 'Google Gemini',
      'ollama/': 'Ollama',
      'anthropic/claude': 'Anthropic',
      'openai/gpt': 'OpenAI',
      'openai/dall': 'OpenAI',
      'openai/tts': 'OpenAI',
      'openai/whisper': 'OpenAI'
    };

    // 检查模型名称是否匹配已知前缀
    for (const [prefix, providerName] of Object.entries(providerMapping)) {
      if (modelName.startsWith(prefix)) {
        return providerName;
      }
    }

    // 如果没有匹配到已知前缀，尝试从斜杠前推断
    if (modelName.includes('/')) {
      const firstPart = modelName.split('/')[0];
      const prefixToProvider = {
        'openai': 'OpenAI兼容',
        'gemini': 'Google Gemini',
        'ollama': 'Ollama',
        'anthropic': 'Anthropic',
        'cohere': 'Cohere',
        'azure': 'Azure OpenAI'
      };
      
      if (prefixToProvider[firstPart]) {
        return prefixToProvider[firstPart];
      }
    }

    return 'unknown';
  }

  /**
   * 过滤掉嵌入模型
   * @param {Array} models - 模型列表
   * @returns {Array} 过滤后的模型列表
   */
  filterEmbeddingModels(models) {
    if (!Array.isArray(models)) {
      console.warn('filterEmbeddingModels: 输入不是数组', models);
      return [];
    }

    return models.filter(model => {
      const modelName = model.id || '';
      const isEmbeddingModel = this._isEmbeddingModel(modelName);
      
      if (isEmbeddingModel) {
        console.log(`过滤掉嵌入模型: ${modelName}`);
      }
      
      return !isEmbeddingModel;
    });
  }

  /**
   * 判断是否为嵌入模型
   * @param {string} modelName - 模型名称
   * @returns {boolean} 是否为嵌入模型
   */
  _isEmbeddingModel(modelName) {
    if (!modelName) {
      return false;
    }

    // 嵌入模型的关键词
    const embeddingKeywords = [
      'embedding',
      'embed',
      'text-embedding',
      'bge-', // 常见的中文嵌入模型前缀
      'e5-',  // 常见的嵌入模型前缀
      'sentence-transformers',
      'qwen3-embedding' // 添加特定的qwen3嵌入模型
    ];

    // 检查模型名称是否包含嵌入模型的关键词
    const lowerModelName = modelName.toLowerCase();
    return embeddingKeywords.some(keyword => lowerModelName.includes(keyword));
  }

  /**
   * 刷新模型列表（重新从litellm网关获取）
   */
  async refreshModels() {
    try {
      // 直接调用getAvailableModels来刷新模型列表
      const result = await this.getAvailableModels();
      return {
        success: result.success,
        message: result.success ? '模型列表刷新成功' : result.error
      };
    } catch (error) {
      console.error('刷新模型列表失败:', error);
      return {
        success: false,
        error: '刷新模型列表失败: ' + error.message
      };
    }
  }

  /**
   * 获取嵌入模型列表 - 从litellm网关获取
   */
  async getEmbeddingModels() {
    try {
      // 从litellm网关获取模型列表
      const response = await fetch(`${this.litellmBaseURL}/model/info`, {
        method: 'GET',
        headers: {
          'accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // 根据实际返回的数据结构获取模型列表
      const modelsData = data.all_models || data.data || data.models || [];
      console.log('从litellm获取的原始数据:', data);
      console.log('解析出的模型数据:', modelsData);
      
      // 转换litellm返回的数据格式为前端期望的格式
      const models = this.convertLiteLLMModels(modelsData);
      
      // 只保留嵌入模型
      const embeddingModels = this.filterNonEmbeddingModels(models);
      
      return {
        success: true,
        models: embeddingModels,
        message: '嵌入模型列表获取成功'
      };
    } catch (error) {
      console.error('获取嵌入模型列表失败:', error);
      return {
        success: false,
        error: '从litellm网关获取嵌入模型列表失败: ' + error.message,
        models: []
      };
    }
  }

  /**
   * 根据嵌入模型名称获取默认维度
   * @param {string} modelName - 嵌入模型名称
   * @returns {Promise<Object>} 嵌入维度数据
   */
  async getEmbeddingDimensions(modelName) {
    try {
      // 常见嵌入模型的默认维度映射
      const modelDimensionsMap = {
        'text-embedding-ada-002': 1536,
        'text-embedding-3-small': 1536,
        'text-embedding-3-large': 3072,
        'bge-large-zh': 1024,
        'bge-base-zh': 768,
        'bge-small-zh': 512,
        'e5-large-v2': 1024,
        'e5-base-v2': 768,
        'e5-small-v2': 384,
        'sentence-transformers/all-MiniLM-L6-v2': 384,
        'sentence-transformers/all-mpnet-base-v2': 768,
      };

      // 如果模型名称在映射中，直接返回对应维度
      if (modelDimensionsMap[modelName]) {
        return {
          success: true,
          dimensions: modelDimensionsMap[modelName],
          message: '嵌入维度获取成功'
        };
      }

      // 尝试从模型名称推断维度
      const inferredDimensions = this._inferDimensionsFromModelName(modelName);
      if (inferredDimensions) {
        return {
          success: true,
          dimensions: inferredDimensions,
          message: '嵌入维度获取成功'
        };
      }

      // 如果无法确定维度，返回默认值
      return {
        success: true,
        dimensions: 1024, // 默认维度
        message: '使用默认嵌入维度'
      };
    } catch (error) {
      console.error('获取嵌入维度失败:', error);
      return {
        success: false,
        error: '获取嵌入维度失败: ' + error.message,
        dimensions: 1024 // 默认维度
      };
    }
  }

  /**
   * 从模型名称推断嵌入维度
   * @param {string} modelName - 模型名称
   * @returns {number|null} 推断的维度或null
   */
  _inferDimensionsFromModelName(modelName) {
    if (!modelName) {
      return null;
    }

    // 尝试从模型名称中提取维度信息
    const dimensionPatterns = [
      /(\d+)d/i,           // 匹配 "1024d" 格式
      /dim(\d+)/i,         // 匹配 "dim1024" 格式
      /size(\d+)/i,        // 匹配 "size1024" 格式
      /-(\d+)$/,           // 匹配末尾的 "-1024" 格式
    ];

    for (const pattern of dimensionPatterns) {
      const match = modelName.match(pattern);
      if (match && match[1]) {
        const dimension = parseInt(match[1], 10);
        if (dimension > 0) {
          return dimension;
        }
      }
    }

    // 根据模型名称中的关键词推断维度
    const keywordDimensions = {
      'small': 512,
      'base': 768,
      'large': 1024,
      'xlarge': 1536,
      'xxlarge': 2048,
    };

    const lowerModelName = modelName.toLowerCase();
    for (const [keyword, dimension] of Object.entries(keywordDimensions)) {
      if (lowerModelName.includes(keyword)) {
        return dimension;
      }
    }

    return null;
  }

  /**
   * 只保留嵌入模型
   * @param {Array} models - 模型列表
   * @returns {Array} 过滤后的嵌入模型列表
   */
  filterNonEmbeddingModels(models) {
    if (!Array.isArray(models)) {
      console.warn('filterNonEmbeddingModels: 输入不是数组', models);
      return [];
    }

    return models.filter(model => {
      const modelName = model.id || '';
      const isEmbeddingModel = this._isEmbeddingModel(modelName);
      
      if (!isEmbeddingModel) {
        console.log(`过滤掉非嵌入模型: ${modelName}`);
      }
      
      return isEmbeddingModel;
    });
  }
}

// 创建全局模型选择服务实例
const modelSelectionService = new ModelSelectionService();

export default modelSelectionService;