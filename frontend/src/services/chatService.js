// 新的后端连接器 - 完全适配后端 API
import httpClient from '../utils/httpClient.js';

class ChatService {
  // 聊天消息发送 - 完全适配后端 API
  async sendChatMessage(messageData) {
    try {
      // 后端期望的格式：
      // {
      //   message: string,
      //   thread_id: string (默认 "default"),
      //   mode: string
      // }
      // 构造请求体
      const backendRequest = {
        message: messageData.message || '',
        thread_id: messageData.thread_id || 'default',
        mode: messageData.mode || 'outline'
      };

      console.log('发送到后端的聊天请求:', backendRequest);

      // 流式请求
      const response = await httpClient.streamRequest('/api/chat/message', {
        method: 'POST',
        body: backendRequest
      });
      
      return this.handleStreamResponse(response);
    } catch (error) {
      console.error('后端聊天请求失败:', error);
      throw new Error(`后端请求失败: ${error.message}`);
    }
  }

  // 处理流式响应
  async handleStreamResponse(response) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = ''; // 用于存储不完整的数据
    
    // 将方法绑定到局部变量，避免this绑定问题
    const decodeBase64Data = (base64String) => {
      try {
        // 解码Base64字符串为二进制数据
        const binaryString = atob(base64String);
        // 将二进制字符串转换为Uint8Array
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        // 使用TextDecoder解码为UTF-8字符串
        const decodedString = new TextDecoder('utf-8').decode(bytes);
        // 解析JSON
        return JSON.parse(decodedString);
      } catch (e) {
        console.error('Base64解码或JSON解析失败:', e);
        return null;
      }
    };
    
    return {
      async *[Symbol.asyncIterator]() {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            // 将新数据添加到缓冲区
            buffer += decoder.decode(value, { stream: true });
            
            // 处理缓冲区中的完整行
            const lines = buffer.split('\n');
            // 保留最后一行（可能不完整）
            buffer = lines.pop() || '';
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6).trim(); // 移除 'data: ' 前缀并去除空白
                if (data === '') continue;
                
                try {
                  // 使用Base64解码
                  const decodedData = decodeBase64Data(data);
                  if (decodedData) {
                    yield decodedData;
                  }
                } catch (e) {
                  console.error('解码Base64数据失败:', e, '原始数据:', data);
                }
              }
            }
          }
          
          // 处理缓冲区中剩余的数据
          if (buffer.trim() && buffer.startsWith('data: ')) {
            const data = buffer.slice(6).trim();
            if (data !== '') {
              try {
                const decodedData = decodeBase64Data(data);
                if (decodedData) {
                  yield decodedData;
                }
              } catch (e) {
                console.error('解码剩余Base64数据失败:', e, '原始数据:', data);
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      }
    };
  }

  // 发送中断响应 - 适配后端 API
  async sendInterruptResponse(interruptData) {
    try {
      // 后端期望的格式：
      // {
      //   interrupt_id: string,
      //   choice: string ('1'=恢复, '2'=取消),
      //   additional_data: string,
      //   thread_id: string (默认 "default")
      // }
      
      const backendRequest = {
        interrupt_id: interruptData.interruptId || interruptData.interrupt_id || '',
        choice: interruptData.choice || '1', // '1'=恢复, '2'=取消
        additional_data: interruptData.additionalData || interruptData.additional_data || '',
        thread_id: interruptData.threadId || interruptData.thread_id || 'default'
      };

      console.log('发送到后端的中断响应请求:', backendRequest);

      // 中断响应也是流式请求，需要使用 streamRequest
      const response = await httpClient.streamRequest('/api/chat/interrupt-response', {
        method: 'POST',
        body: backendRequest
      });
      
      return this.handleStreamResponse(response);
    } catch (error) {
      console.error('中断响应发送失败:', error);
      throw new Error(`中断响应发送失败: ${error.message}`);
    }
  }
}

// 创建全局后端连接器实例
export default new ChatService();
