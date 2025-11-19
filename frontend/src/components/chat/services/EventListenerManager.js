import { setStreamingState } from '../../../store/slices/chatSlice';
import { startDiff } from '../../../store/slices/novelSlice';
import websocketClient from '../../../services/websocketClient';

/**
 * 事件监听管理器
 * 负责管理所有事件监听（WebSocket + IPC）
 */
class EventListenerManager {
  constructor(dispatch) {
    this.dispatch = dispatch;
    this.websocketListeners = new Map();
  }

  /**
   * 设置AI响应事件监听
   */
  setupAiResponseListener() {
    // WebSocket事件监听
    const handleWebSocketAiResponse = (payload) => {
      const { type, payload: responsePayload } = payload;
      this.handleAiResponseEvent(type, responsePayload);
    };

    const unsubscribe = websocketClient.on('ai-response', handleWebSocketAiResponse);
    this.websocketListeners.set('ai-response', unsubscribe);
  }

  /**
   * 处理AI响应事件
   */
  handleAiResponseEvent(type, payload) {
    console.log(`[EventListenerManager] 收到AI响应事件: ${type}`, payload);
    
    if (type === 'streaming_started') {
      console.log('[EventListenerManager] 收到流式传输开始事件');
      this.dispatch(setStreamingState({ isStreaming: true, abortController: null }));
    } else if (type === 'streaming_ended') {
      console.log('[EventListenerManager] 收到流式传输结束事件');
      this.dispatch(setStreamingState({ isStreaming: false, abortController: null }));
    }
  }

  /**
   * 设置diff预览事件监听
   */
  setupDiffPreviewListener(openTabs) {
    // WebSocket事件监听
    const handleWebSocketDiffPreview = (data) => {
      console.log('[EventListenerManager] 收到WebSocket show-diff-preview 事件:', data);
      this.handleDiffPreviewEvent(data, openTabs);
    };

    const unsubscribe = websocketClient.on('show-diff-preview', handleWebSocketDiffPreview);
    this.websocketListeners.set('show-diff-preview', unsubscribe);
  }

  /**
   * 处理diff预览事件
   */
  handleDiffPreviewEvent(data, openTabs) {
    const { filePath, suggestedContent } = data;

    // 确保收到的数据有效
    if (!filePath || typeof suggestedContent !== 'string') {
      console.warn('[EventListenerManager] show-diff-preview 事件缺少必要数据。');
      return;
    }

    // 兼容性修复：在匹配前，将两边的路径都统一为不带 'novel/' 前缀的干净格式
    const cleanIncomingPath = filePath.startsWith('novel/') ? filePath.substring(6) : filePath;
    
    const targetTab = openTabs.find(tab => {
      const cleanTabId = tab.id.startsWith('novel/') ? tab.id.substring(6) : tab.id;
      return cleanTabId === cleanIncomingPath;
    });

    if (targetTab) {
      console.log(`[EventListenerManager] 兼容性匹配成功！找到标签页 (ID: ${targetTab.id})，准备触发 diff。`);
      this.dispatch(startDiff({ tabId: targetTab.id, suggestion: suggestedContent }));
    } else {
      console.warn(`[EventListenerManager] 兼容性匹配失败：未找到与路径 '${filePath}' (clean: '${cleanIncomingPath}') 匹配的活动标签页。`);
    }
  }

  /**
   * 设置所有事件监听
   */
  setupAllListeners(openTabs) {
    this.setupAiResponseListener();
    this.setupDiffPreviewListener(openTabs);
    console.log('[EventListenerManager] 所有事件监听器已设置');
  }

  /**
   * 清理所有事件监听
   */
  cleanupAllListeners() {
    // 清理WebSocket监听器
    for (const [event, unsubscribe] of this.websocketListeners) {
      unsubscribe();
    }
    this.websocketListeners.clear();

    console.log('[EventListenerManager] 所有事件监听器已清理');
  }

  /**
   * 移除特定事件监听
   */
  removeListener(event) {
    const unsubscribe = this.websocketListeners.get(event);
    if (unsubscribe) {
      unsubscribe();
      this.websocketListeners.delete(event);
      console.log(`[EventListenerManager] 事件监听器 '${event}' 已移除`);
    }
  }
}

export default EventListenerManager;
