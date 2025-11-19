// RAG 服务 - 负责知识库管理、文件上传、检索设置等操作
import httpClient from '../utils/httpClient.js';

class RagService {
  constructor() {
    this.baseURL = 'http://localhost:8000';
  }

  /**
   * 添加文件到知识库
   * @param {File} file - 文件对象
   * @returns {Promise<Object>} 添加结果
   */
  async addFileToKnowledgeBase(file) {
    try {
      const formData = new FormData();
      formData.append('file', file);

      // 不手动设置Content-Type，让浏览器自动设置multipart/form-data和boundary
      const response = await httpClient.post('/api/embedding/rag/files', formData);
      return {
        success: true,
        data: response,
        message: response.message || '文件已成功添加到知识库'
      };
    } catch (error) {
      console.error('添加文件到知识库失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message
      };
    }
  }

  /**
   * 获取嵌入维度
   * @param {string} modelId - 模型ID
   * @returns {Promise<Object>} 嵌入维度数据
   */
  async getEmbeddingDimensions(modelId) {
    try {
      const response = await httpClient.get(`/api/embedding/dimensions/${modelId}`);
      
      // 确保response存在
      if (!response) {
        throw new Error('API响应为空');
      }
      
      // 处理不同的响应格式
      let responseData;
      if (response.data) {
        responseData = response.data;
      } else if (response.success !== undefined) {
        // 如果响应本身就是数据对象
        responseData = response;
      } else {
        throw new Error('API响应格式不正确');
      }
      
      return {
        success: responseData.success !== undefined ? responseData.success : true,
        dimensions: responseData.dimensions || 1024,
        message: responseData.message || '获取嵌入维度成功',
        modelId: modelId
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
   * 获取嵌入模型列表 - 从litellm网关获取
   * @returns {Promise<Object>} 嵌入模型列表数据
   */
  async getEmbeddingModels() {
    try {
      // 从litellm网关获取模型列表
      const response = await fetch('http://127.0.0.1:4000/model/info', {
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
      const models = this._convertLiteLLMModels(modelsData);
      
      // 只保留嵌入模型
      const embeddingModels = this._filterEmbeddingModels(models);
      
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
   * 转换litellm返回的模型数据格式为前端期望的格式
   * @param {Array} litellmModels - litellm网关返回的模型数据
   * @returns {Array} 转换后的模型数据
   */
  _convertLiteLLMModels(litellmModels) {
    if (!Array.isArray(litellmModels)) {
      console.warn('_convertLiteLLMModels: 输入不是数组', litellmModels);
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
   * 只保留嵌入模型
   * @param {Array} models - 模型列表
   * @returns {Array} 过滤后的嵌入模型列表
   */
  _filterEmbeddingModels(models) {
    if (!Array.isArray(models)) {
      console.warn('_filterEmbeddingModels: 输入不是数组', models);
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
   * 获取知识库文件列表
   * @returns {Promise<Object>} 文件列表数据
   */
  async listKnowledgeBaseFiles() {
    try {
      const response = await httpClient.get('/api/embedding/rag/files');
      return {
        success: true,
        files: response.files || [],
        message: '知识库文件列表获取成功'
      };
    } catch (error) {
      console.error('获取知识库文件列表失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message,
        files: []
      };
    }
  }

  /**
   * 删除知识库文件
   * @param {string} fileId - 文件ID
   * @returns {Promise<Object>} 删除结果
   */
  async deleteKnowledgeBaseFile(fileId) {
    try {
      const response = await httpClient.delete(`/api/embedding/rag/files/${fileId}`);
      return {
        success: response.success || true,
        data: response,
        message: response.message || '知识库文件删除成功'
      };
    } catch (error) {
      console.error('删除知识库文件失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message
      };
    }
  }

  /**
   * 重命名知识库文件
   * @param {string} fileId - 文件ID
   * @param {string} newName - 新名称
   * @returns {Promise<Object>} 重命名结果
   */
  async renameKnowledgeBaseFile(fileId, newName) {
    try {
      const response = await httpClient.put(`/api/embedding/rag/files/${fileId}/rename`, null, {
        params: { new_name: newName }
      });
      return {
        success: response.success || true,
        data: response,
        message: response.message || '知识库文件重命名成功'
      };
    } catch (error) {
      console.error('重命名知识库文件失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message
      };
    }
  }


  /**
   * 获取 RAG 分块设置
   * @returns {Promise<Object>} 分块设置数据
   */
  async getRagChunkSettings() {
    console.log('开始获取RAG分块设置...');
    try {
      console.log('准备发送请求到: /api/embedding/rag/chunk-settings');
      const response = await httpClient.get('/api/embedding/rag/chunk-settings');
      console.log('收到响应:', response);
      console.log('response.data:', response.data);
      console.log('response.chunkSize:', response?.chunkSize);
      console.log('response.chunkOverlap:', response?.chunkOverlap);
      
      // 直接从response对象获取数据，而不是从response.data
      const chunkSize = response?.chunkSize || response.data?.chunkSize || 100;
      const chunkOverlap = response?.chunkOverlap || response.data?.chunkOverlap || 20;
      
      return {
        success: true,
        chunkSize: chunkSize,
        chunkOverlap: chunkOverlap,
        message: 'RAG分块设置获取成功'
      };
    } catch (error) {
      console.error('获取RAG分块设置失败:', error);
      console.error('错误详情:', error.stack);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message,
        chunkSize: 100,
        chunkOverlap: 20
      };
    }
  }
}
 
// 创建全局 RAG 服务实例
const ragService = new RagService();

export default ragService;