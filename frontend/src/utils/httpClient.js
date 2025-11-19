// HTTP客户端封装，用于连接后端
class HttpClient {
  constructor(baseURL = 'http://localhost:8000') {
    this.baseURL = baseURL;
    this.timeout = 30000; // 30秒超时
  }

  //处理所有HTTP请求，非流式
  async request(endpoint, options = {}) {
    // 处理查询参数
    let url = `${this.baseURL}${endpoint}`;
    if (options.params) {
      const urlParams = new URLSearchParams();
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          urlParams.append(key, value);
        }
      });
      const queryString = urlParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    const config = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        ...options.headers,
      },
      timeout: this.timeout,
      ...options,
    };

    // 处理请求体
    if (options.body) {
      if (options.body instanceof FormData) {
        // 对于 FormData，不设置 Content-Type，让浏览器自动设置
        delete config.headers['Content-Type'];
        config.body = options.body;
      } else if (typeof options.body === 'object') {
        config.body = JSON.stringify(options.body);
      } else {
        config.body = options.body;
      }
    }
    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        console.error('HTTP响应状态码错误:', response.status, response.statusText);
        
        // 尝试解析错误响应体中的详细信息
        let errorDetails = '';
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            errorDetails = errorData.detail || errorData.message || JSON.stringify(errorData);
          } else {
            errorDetails = await response.text();
          }
        } catch (parseError) {
          // 如果解析错误响应体失败，使用默认错误信息
          errorDetails = response.statusText || 'Unknown error';
        }
        
        // 创建一个包含状态码和详细信息的错误对象
        const error = new Error(`HTTP error! status: ${response.status}`);
        error.status = response.status;
        error.details = errorDetails;
        throw error;
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      } else {
        return await response.text();
      }
    } catch (error) {
      console.error(`HTTP request failed for ${endpoint}:`, error);
      throw error;
    }
  }



  // 流式请求方法
  async streamRequest(endpoint, options = {}) {
    // 处理查询参数
    let url = `${this.baseURL}${endpoint}`;
    if (options.params) {
      const urlParams = new URLSearchParams();
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          urlParams.append(key, value);
        }
      });
      const queryString = urlParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    const config = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        ...options.headers,
      },
      ...options,
    };

    // 处理请求体
    if (options.body) {
      if (options.body instanceof FormData) {
        delete config.headers['Content-Type'];
        config.body = options.body;
      } else if (typeof options.body === 'object') {
        config.body = JSON.stringify(options.body);
      } else {
        config.body = options.body;
      }
    }

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // 返回流式响应
      return response;
    } catch (error) {
      console.error(`HTTP stream request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  //便捷HTTP方法
  async get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  async post(endpoint, data, options = {}) {
    return this.request(endpoint, { 
      ...options, 
      method: 'POST', 
      body: data 
    });
  }

  async put(endpoint, data, options = {}) {
    return this.request(endpoint, { 
      ...options, 
      method: 'PUT', 
      body: data 
    });
  }

  async delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }

  // 健康检查
  async healthCheck() {
    try {
      const result = await this.get('/health');
      // 检查是否返回了预期的状态
      return result && result.status === 'healthy' && result.message && result.message.includes('AI Novelist Python Backend is running');
    } catch (error) {
      // 如果/health端点失败，尝试根路径作为备用
      try {
        const fallbackResult = await this.get('/');
        return fallbackResult && fallbackResult.message && fallbackResult.message.includes('AI Novelist Python Backend is running');
      } catch (fallbackError) {
        console.warn('后端健康检查失败:', error.message);
        return false;
      }
    }
  }
}

// 创建全局HTTP客户端实例
const httpClient = new HttpClient();

export default httpClient;
