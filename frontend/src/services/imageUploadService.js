// 图片上传服务 - 负责图片上传、列表获取、删除等操作
import httpClient from '../utils/httpClient.js';

class ImageUploadService {
  constructor() {
    this.baseURL = 'http://localhost:8000';
  }

  /**
   * 上传图片文件
   * @param {File} file - 图片文件
   * @returns {Promise<Object>} 上传结果
   */
  async uploadImage(file) {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await httpClient.post('/api/file/upload/image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return {
        success: true,
        data: response.data,
        message: '图片上传成功'
      };
    } catch (error) {
      console.error('图片上传失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message
      };
    }
  }

  /**
   * 从缓冲区上传图片
   * @param {ArrayBuffer} bufferData - 图片缓冲区数据
   * @param {string} filename - 文件名（可选）
   * @returns {Promise<Object>} 上传结果
   */
  async uploadImageFromBuffer(bufferData, filename = null) {
    try {
      // 将 ArrayBuffer 转换为 base64
      const uint8Array = new Uint8Array(bufferData);
      const base64Data = btoa(String.fromCharCode(...uint8Array));
      
      const formData = new FormData();
      formData.append('buffer_data', base64Data);
      if (filename) {
        formData.append('filename', filename);
      }

      const response = await httpClient.post('/api/file/upload/image/base64', {
        data: base64Data,
        filename: filename
      });
      return {
        success: true,
        data: response.data,
        message: '图片上传成功'
      };
    } catch (error) {
      console.error('图片上传失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message
      };
    }
  }

  /**
   * 获取已上传图片列表
   * @returns {Promise<Object>} 图片列表数据
   */
  async listUploadedImages() {
    try {
      const response = await httpClient.get('/api/file/upload/images');
      return {
        success: true,
        data: response.data,
        message: '图片列表获取成功'
      };
    } catch (error) {
      console.error('获取图片列表失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message
      };
    }
  }

  /**
   * 删除已上传图片
   * @param {string} filename - 文件名
   * @returns {Promise<Object>} 删除结果
   */
  async deleteUploadedImage(filename) {
    try {
      const response = await httpClient.delete(`/api/file/upload/images/${filename}`);
      return {
        success: true,
        message: '图片删除成功'
      };
    } catch (error) {
      console.error('删除图片失败:', error);
      return {
        success: false,
        error: 'HTTP 请求失败: ' + error.message
      };
    }
  }
}

// 创建全局图片上传服务实例
const imageUploadService = new ImageUploadService();

export default imageUploadService;