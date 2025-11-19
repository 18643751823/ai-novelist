/**
 * WebSocket 客户端服务
 * 用于接收后端推送的实时事件
 */
class WebSocketClient {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectInterval = 3000; // 3秒
    this.eventListeners = new Map();
    this.isConnected = false;
    this.backendUrl = this.getBackendUrl();
  }

  /**
   * 获取后端URL
   */
  getBackendUrl() {
    // 从环境变量或配置中获取后端URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = process.env.REACT_APP_BACKEND_HOST || window.location.hostname;
    const port = process.env.REACT_APP_BACKEND_PORT || '8000';
    return `${protocol}//${host}:${port}/api/chat/ws`;
  }

  /**
   * 连接到WebSocket服务器
   */
  connect() {
    try {
      this.ws = new WebSocket(this.backendUrl);
      
      this.ws.onopen = () => {
        console.log('WebSocket连接已建立');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.notifyListeners('connected', {});
        
        // 延迟订阅事件类型，确保WebSocket完全准备好
        setTimeout(() => {
          this.subscribeToEvents(['ai-response', 'show-diff-preview']);
        }, 100);
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('解析WebSocket消息失败:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket连接已关闭:', event.code, event.reason);
        this.isConnected = false;
        this.notifyListeners('disconnected', { code: event.code, reason: event.reason });
        
        // 尝试重新连接
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          setTimeout(() => {
            this.reconnectAttempts++;
            console.log(`尝试重新连接 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            this.connect();
          }, this.reconnectInterval);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket错误:', error);
        this.notifyListeners('error', { error });
      };

    } catch (error) {
      console.error('创建WebSocket连接失败:', error);
    }
  }

  /**
   * 处理收到的消息
   */
  handleMessage(message) {
    const { type, payload, timestamp } = message;
    
    // 更新消息时间戳
    if (timestamp === null) {
      message.timestamp = Date.now();
    }

    console.log(`收到WebSocket消息: ${type}`, payload);

    // 通知特定类型的监听器
    this.notifyListeners(type, payload);

    // 特殊处理ai-response事件
    if (type === 'ai-response') {
      const { type: responseType, payload: responsePayload } = payload;
      this.notifyListeners(`ai-response:${responseType}`, responsePayload);
    }
  }

  /**
   * 订阅事件类型
   */
  subscribeToEvents(eventTypes) {
    if (this.isConnected) {
      this.sendMessage({
        type: 'subscribe',
        event_types: eventTypes
      });
    }
  }

  /**
   * 取消订阅事件类型
   */
  unsubscribeFromEvents(eventTypes) {
    if (this.isConnected) {
      this.sendMessage({
        type: 'unsubscribe',
        event_types: eventTypes
      });
    }
  }

  /**
   * 发送消息到服务器
   */
  sendMessage(message) {
    if (this.isConnected && this.ws) {
      try {
        this.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('发送WebSocket消息失败:', error);
      }
    }
  }

  /**
   * 添加事件监听器
   */
  on(eventType, callback) {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType).push(callback);
    
    // 返回取消监听的函数
    return () => this.off(eventType, callback);
  }

  /**
   * 移除事件监听器
   */
  off(eventType, callback) {
    if (this.eventListeners.has(eventType)) {
      const listeners = this.eventListeners.get(eventType);
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * 通知所有监听器
   */
  notifyListeners(eventType, data) {
    if (this.eventListeners.has(eventType)) {
      const listeners = this.eventListeners.get(eventType);
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`事件监听器执行错误 (${eventType}):`, error);
        }
      });
    }
  }

  /**
   * 断开连接
   */
  disconnect() {
    if (this.ws && this.isConnected) {
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
    }
    this.eventListeners.clear();
  }

  /**
   * 获取连接状态
   */
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts
    };
  }
}

// 创建全局WebSocket客户端实例
const websocketClient = new WebSocketClient();

export default websocketClient;
