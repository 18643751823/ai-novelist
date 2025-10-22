import { setStreamingState } from '../../../store/slices/chatSlice';
import { startDiff } from '../../../store/slices/novelSlice';

/**
 * 事件监听管理器
 * 负责管理所有IPC事件监听
 */
class EventListenerManager {
  constructor(ipcRenderer, dispatch) {
    this.ipcRenderer = ipcRenderer;
    this.dispatch = dispatch;
    this.listeners = new Map();
  }

  /**
   * 设置AI响应事件监听
   */
  setupAiResponseListener() {
    const handleAiResponse = (event, data) => {
      const { type, payload } = data;
      
      if (type === 'streaming_started') {
        console.log('[EventListenerManager] 收到流式传输开始事件');
        this.dispatch(setStreamingState({ isStreaming: true, abortController: null }));
      } else if (type === 'streaming_ended') {
        console.log('[EventListenerManager] 收到流式传输结束事件');
        this.dispatch(setStreamingState({ isStreaming: false, abortController: null }));
      }
    };

    this.ipcRenderer.on('ai-response', handleAiResponse);
    this.listeners.set('ai-response', handleAiResponse);
  }

  /**
   * 设置diff预览事件监听
   */
  setupDiffPreviewListener(openTabs) {
    const handleShowDiffPreview = (event, data) => {
      console.log('[EventListenerManager] 收到 show-diff-preview 事件:', data);
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
    };

    // 增加最大监听器限制以避免内存泄漏警告
    if (window.ipcRenderer && window.ipcRenderer.setMaxListeners) {
      window.ipcRenderer.setMaxListeners(20);
    }

    this.ipcRenderer.on('show-diff-preview', handleShowDiffPreview);
    this.listeners.set('show-diff-preview', handleShowDiffPreview);
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
    for (const [event, listener] of this.listeners) {
      this.ipcRenderer.removeListener(event, listener);
    }
    this.listeners.clear();
    console.log('[EventListenerManager] 所有事件监听器已清理');
  }

  /**
   * 移除特定事件监听
   */
  removeListener(event) {
    const listener = this.listeners.get(event);
    if (listener) {
      this.ipcRenderer.removeListener(event, listener);
      this.listeners.delete(event);
      console.log(`[EventListenerManager] 事件监听器 '${event}' 已移除`);
    }
  }
}

export default EventListenerManager;